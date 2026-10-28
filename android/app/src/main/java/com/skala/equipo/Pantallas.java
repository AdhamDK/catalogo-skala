package com.skala.equipo;

import android.content.Context;
import android.webkit.WebResourceResponse;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.WorkerThread;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.Locale;

/**
 * Sirve las pantallas en https://appassets.androidplatform.net/www/…
 * Primero busca en el paquete descargado (actualización de pantallas) y si no, usa las que trae la app.
 */
final class Pantallas implements WebViewAssetLoader.PathHandler {
    private final WebViewAssetLoader.AssetsPathHandler deFabrica;
    private final File carpeta; // null = solo las de fábrica

    Pantallas(Context ctx) {
        deFabrica = new WebViewAssetLoader.AssetsPathHandler(ctx);
        String dir = Almacen.carpetaPantallas(ctx);
        File f = dir.isEmpty() ? null : new File(dir);
        carpeta = f != null && new File(f, "panel.html").exists() ? f : null;
    }

    @Override
    @WorkerThread
    @Nullable
    public WebResourceResponse handle(@NonNull String path) {
        if (carpeta != null) {
            try {
                File f = new File(carpeta, path);
                if (f.isFile() && f.getCanonicalPath().startsWith(carpeta.getCanonicalPath() + File.separator)) {
                    return new WebResourceResponse(tipo(path), null, new FileInputStream(f));
                }
            } catch (IOException ignored) {
                // sigue con las de fábrica
            }
        }
        WebResourceResponse r = deFabrica.handle("www/" + path);
        if (r != null) r.setMimeType(tipo(path));
        return r;
    }

    static String tipo(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        return "application/octet-stream";
    }

    boolean usaPaquete() { return carpeta != null; }
}
