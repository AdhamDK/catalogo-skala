package com.skala.equipo;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

/** Skala Equipo: el panel del equipo (después de ingresar) dentro de una app Android. */
public class MainActivity extends Activity {
    private static final String INICIO = "https://appassets.androidplatform.net/www/panel.html";
    private static final int PEDIR_UBICACION = 7;

    private WebView web;
    private GeolocationPermissions.Callback ubicacionPendiente;
    private String origenPendiente;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        web = new WebView(this);
        setContentView(web);

        final WebViewAssetLoader cargador = new WebViewAssetLoader.Builder()
                .addPathHandler("/www/", new Pantallas(this))
                .build();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);      // localStorage: sesión, pedido en curso, copia de datos
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false); // target=_blank se resuelve abajo
        s.setTextZoom(100);

        web.addJavascriptInterface(new Puente(this), "SkalaApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                return cargador.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                abrirAfuera(u); // WhatsApp, llamadas, mapas, Google…
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origen, GeolocationPermissions.Callback cb) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    cb.invoke(origen, true, false);
                } else {
                    ubicacionPendiente = cb;
                    origenPendiente = origen;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, PEDIR_UBICACION);
                }
            }
        });

        if (guardado != null) web.restoreState(guardado);
        else web.loadUrl(INICIO);

        Sincronizador.programar(this);
    }

    private void abrirAfuera(Uri u) {
        String esquema = u.getScheme() == null ? "" : u.getScheme();
        Intent i = "tel".equals(esquema) ? new Intent(Intent.ACTION_DIAL, u) : new Intent(Intent.ACTION_VIEW, u);
        try {
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No hay una app para abrir esto.", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onRequestPermissionsResult(int codigo, String[] permisos, int[] resultados) {
        super.onRequestPermissionsResult(codigo, permisos, resultados);
        if (codigo == PEDIR_UBICACION && ubicacionPendiente != null) {
            boolean ok = resultados.length > 0 && resultados[0] == PackageManager.PERMISSION_GRANTED;
            ubicacionPendiente.invoke(origenPendiente, ok, false);
            ubicacionPendiente = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        web.saveState(estado);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
