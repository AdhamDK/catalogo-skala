package com.skala.equipo;

import android.content.Context;
import android.content.SharedPreferences;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Lo que la app guarda en el teléfono: sesión, copia de los datos y versión de pantallas. */
final class Almacen {
    private Almacen() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences("skala", Context.MODE_PRIVATE);
    }

    static String token(Context ctx) { return prefs(ctx).getString("token", ""); }
    static void guardarToken(Context ctx, String t) { prefs(ctx).edit().putString("token", t == null ? "" : t).apply(); }

    static String versionPantallas(Context ctx) { return prefs(ctx).getString("pantallas_version", ""); }
    static String carpetaPantallas(Context ctx) { return prefs(ctx).getString("pantallas_dir", ""); }
    static void fijarPantallas(Context ctx, String version, String carpeta) {
        prefs(ctx).edit().putString("pantallas_version", version).putString("pantallas_dir", carpeta).apply();
    }

    private static File archivoDatos(Context ctx) { return new File(ctx.getFilesDir(), "datos.json"); }

    static synchronized void guardarDatos(Context ctx, String json) {
        File f = archivoDatos(ctx);
        if (json == null || json.isEmpty()) {
            //noinspection ResultOfMethodCallIgnored
            f.delete();
            return;
        }
        File tmp = new File(ctx.getFilesDir(), "datos.json.tmp");
        try (OutputStream out = new FileOutputStream(tmp)) {
            out.write(json.getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            return;
        }
        //noinspection ResultOfMethodCallIgnored
        tmp.renameTo(f);
    }

    static synchronized String leerDatos(Context ctx) {
        File f = archivoDatos(ctx);
        if (!f.exists()) return "";
        try (InputStream in = new FileInputStream(f)) {
            byte[] b = new byte[(int) f.length()];
            int leidos = 0;
            while (leidos < b.length) {
                int n = in.read(b, leidos, b.length - leidos);
                if (n < 0) break;
                leidos += n;
            }
            return new String(b, 0, leidos, StandardCharsets.UTF_8);
        } catch (IOException e) {
            return "";
        }
    }
}
