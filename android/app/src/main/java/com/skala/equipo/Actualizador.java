package com.skala.equipo;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.widget.Toast;

import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Actualizaciones sin Play Store:
 *  - APK nueva: se descarga con el gestor de descargas y se abre el instalador de Android.
 *  - Pantallas nuevas (.zip): se bajan en segundo plano y se usan la próxima vez que se abre la app.
 */
final class Actualizador {
    private Actualizador() {}

    private static final String NOMBRE_APK = "skala-equipo.apk";
    private static long descargaId = -1;
    private static BroadcastReceiver receptor;

    static void descargarApk(Context ctx, String url) {
        if (url == null || !url.startsWith("https://")) {
            Toast.makeText(ctx, "No hay enlace de actualización.", Toast.LENGTH_LONG).show();
            return;
        }
        // Primero el permiso para instalar apps de esta fuente (una sola vez)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !ctx.getPackageManager().canRequestPackageInstalls()) {
            Toast.makeText(ctx, "Permití \"Instalar apps de esta fuente\" para Skala y volvé a tocar Actualizar.", Toast.LENGTH_LONG).show();
            Intent permiso = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            permiso.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(permiso);
            return;
        }
        File carpeta = ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (carpeta == null) return;
        File apk = new File(carpeta, NOMBRE_APK);
        //noinspection ResultOfMethodCallIgnored
        apk.delete();

        DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
        DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url))
                .setTitle("Skala Equipo")
                .setDescription("Descargando la actualización")
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalFilesDir(ctx, Environment.DIRECTORY_DOWNLOADS, NOMBRE_APK);
        descargaId = dm.enqueue(req);

        final Context app = ctx.getApplicationContext();
        if (receptor == null) {
            receptor = new BroadcastReceiver() {
                @Override
                public void onReceive(Context c, Intent intent) {
                    long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (id != descargaId) return;
                    if (!descargaCorrecta(c, id)) {
                        Toast.makeText(c, "No se pudo descargar la actualización. Probá de nuevo.", Toast.LENGTH_LONG).show();
                        return;
                    }
                    instalar(c, new File(c.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), NOMBRE_APK));
                }
            };
            ContextCompat.registerReceiver(app, receptor, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), ContextCompat.RECEIVER_EXPORTED);
        }
        Toast.makeText(ctx, "Descargando la actualización…", Toast.LENGTH_SHORT).show();
    }

    private static boolean descargaCorrecta(Context ctx, long id) {
        DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
        android.database.Cursor cur = dm.query(new DownloadManager.Query().setFilterById(id));
        if (cur == null) return false;
        try {
            if (!cur.moveToFirst()) return false;
            int col = cur.getColumnIndex(DownloadManager.COLUMN_STATUS);
            return col >= 0 && cur.getInt(col) == DownloadManager.STATUS_SUCCESSFUL;
        } finally {
            cur.close();
        }
    }

    static void instalar(Context ctx, File apk) {
        if (!apk.exists()) return;
        Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".archivos", apk);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
    }

    /** Pantallas: si la hoja Config trae otra versión con enlace, bajar el .zip y dejarlo listo. */
    static synchronized void revisarPantallas(Context ctx, JSONObject config) {
        String version = config.optString("version_pantallas", "").trim();
        String url = config.optString("url_pantallas", "").trim();
        String actual = Almacen.versionPantallas(ctx);
        if (version.isEmpty() || url.isEmpty()) {
            // Sin paquete publicado: volver a las pantallas que trae la app
            if (!actual.isEmpty()) Almacen.fijarPantallas(ctx, "", "");
            return;
        }
        if (version.equals(actual) || !version.matches("[A-Za-z0-9._-]{1,40}")) return;
        File base = new File(ctx.getFilesDir(), "pantallas");
        File destino = new File(base, version);
        File zip = new File(ctx.getCacheDir(), "pantallas.zip");
        try {
            Red.descargar(url, zip);
            borrar(destino);
            descomprimir(zip, destino);
            if (!new File(destino, "panel.html").exists()) throw new IOException("Falta panel.html en el paquete");
            Almacen.fijarPantallas(ctx, version, destino.getAbsolutePath());
            // Borrar paquetes viejos
            File[] viejos = base.listFiles();
            if (viejos != null) for (File f : viejos) if (!f.getName().equals(version)) borrar(f);
        } catch (IOException e) {
            borrar(destino);
        } finally {
            //noinspection ResultOfMethodCallIgnored
            zip.delete();
        }
    }

    private static void descomprimir(File zip, File destino) throws IOException {
        String raiz = destino.getCanonicalPath() + File.separator;
        if (!destino.mkdirs() && !destino.isDirectory()) throw new IOException("No se pudo crear " + destino);
        try (ZipInputStream zis = new ZipInputStream(new java.io.FileInputStream(zip))) {
            ZipEntry e;
            byte[] buf = new byte[16384];
            while ((e = zis.getNextEntry()) != null) {
                // Los .zip hechos en Windows pueden traer "\" como separador
                String nombre = e.getName().replace('\\', '/');
                File f = new File(destino, nombre);
                // Protección: ningún archivo puede quedar fuera de la carpeta
                if (!f.getCanonicalPath().startsWith(raiz)) throw new IOException("Ruta inválida en el paquete");
                if (e.isDirectory() || nombre.endsWith("/")) {
                    //noinspection ResultOfMethodCallIgnored
                    f.mkdirs();
                    continue;
                }
                File padre = f.getParentFile();
                if (padre != null) {
                    //noinspection ResultOfMethodCallIgnored
                    padre.mkdirs();
                }
                try (OutputStream out = new FileOutputStream(f)) {
                    int n;
                    while ((n = zis.read(buf)) != -1) out.write(buf, 0, n);
                }
            }
        }
    }

    static void borrar(File f) {
        if (f == null || !f.exists()) return;
        File[] hijos = f.listFiles();
        if (hijos != null) for (File h : hijos) borrar(h);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }
}
