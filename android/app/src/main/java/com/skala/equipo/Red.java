package com.skala.equipo;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Llamadas al CRM (Google Apps Script) y descargas, siguiendo las redirecciones a mano. */
final class Red {
    private Red() {}

    /** POST de texto (text/plain, como la web) y devuelve la respuesta como texto. */
    static String post(String url, String cuerpo) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(false);
        c.setConnectTimeout(20000);
        c.setReadTimeout(40000);
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "text/plain;charset=utf-8");
        byte[] datos = cuerpo.getBytes(StandardCharsets.UTF_8);
        c.setFixedLengthStreamingMode(datos.length);
        try (OutputStream os = c.getOutputStream()) {
            os.write(datos);
        }
        int codigo = c.getResponseCode();
        if (esRedireccion(codigo)) {
            String destino = c.getHeaderField("Location");
            c.disconnect();
            // Apps Script responde al POST con una redirección: la respuesta se lee con GET
            return get(destino);
        }
        try {
            if (codigo < 200 || codigo >= 300) throw new IOException("HTTP " + codigo);
            return leer(c.getInputStream());
        } finally {
            c.disconnect();
        }
    }

    static String get(String url) throws IOException {
        HttpURLConnection c = abrirGet(url, 5);
        try {
            return leer(c.getInputStream());
        } finally {
            c.disconnect();
        }
    }

    /** Descarga un archivo (sigue redirecciones, ej. GitHub Releases). */
    static void descargar(String url, File destino) throws IOException {
        HttpURLConnection c = abrirGet(url, 8);
        try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(destino)) {
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        } finally {
            c.disconnect();
        }
    }

    private static HttpURLConnection abrirGet(String url, int saltos) throws IOException {
        String actual = url;
        for (int i = 0; i <= saltos; i++) {
            if (actual == null || !actual.startsWith("https://")) throw new IOException("Dirección no segura");
            HttpURLConnection c = (HttpURLConnection) new URL(actual).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(20000);
            c.setReadTimeout(60000);
            c.setRequestMethod("GET");
            int codigo = c.getResponseCode();
            if (esRedireccion(codigo)) {
                actual = c.getHeaderField("Location");
                c.disconnect();
                continue;
            }
            if (codigo < 200 || codigo >= 300) {
                c.disconnect();
                throw new IOException("HTTP " + codigo);
            }
            return c;
        }
        throw new IOException("Demasiadas redirecciones");
    }

    private static boolean esRedireccion(int codigo) {
        return codigo == 301 || codigo == 302 || codigo == 303 || codigo == 307 || codigo == 308;
    }

    private static String leer(InputStream in) throws IOException {
        try (InputStream is = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[16384];
            int n;
            while ((n = is.read(buf)) != -1) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
