package com.skala.equipo;

import android.content.Context;
import android.content.Intent;
import android.webkit.JavascriptInterface;

/** Lo que las pantallas (js/panel.js, js/crm-api.js) le piden a la app: window.SkalaApp */
final class Puente {
    private final MainActivity act;
    private final Context ctx;

    Puente(MainActivity act) {
        this.act = act;
        this.ctx = act.getApplicationContext();
    }

    @JavascriptInterface public int versionCode() { return BuildConfig.VERSION_CODE; }
    @JavascriptInterface public String versionName() { return BuildConfig.VERSION_NAME; }
    @JavascriptInterface public String versionPantallas() {
        String v = Almacen.versionPantallas(ctx);
        return v.isEmpty() ? "de fábrica" : v;
    }

    /** Sesión (30 días) para que la app se actualice sola aunque esté cerrada. "" = cerró sesión. */
    @JavascriptInterface public void guardarToken(String token) {
        Almacen.guardarToken(ctx, token);
        if (token != null && !token.isEmpty()) Sincronizador.programar(ctx);
    }

    @JavascriptInterface public void guardarDatos(String json) { Almacen.guardarDatos(ctx, json); }
    @JavascriptInterface public String leerDatos() { return Almacen.leerDatos(ctx); }

    /** Compartir (grupo de WhatsApp, etc.) con el menú de Android */
    @JavascriptInterface public void compartir(String texto) {
        act.runOnUiThread(() -> {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_TEXT, texto);
            act.startActivity(Intent.createChooser(i, "Enviar pedido"));
        });
    }

    @JavascriptInterface public void actualizarApp(String url) {
        act.runOnUiThread(() -> Actualizador.descargarApk(act, url));
    }

    /** Revisar ya si hay pantallas nuevas (tras "Actualizar ahora") */
    @JavascriptInterface public void revisarActualizaciones() { Sincronizador.ahora(ctx); }
}
