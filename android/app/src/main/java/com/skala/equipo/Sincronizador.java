package com.skala.equipo;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.util.Calendar;
import java.util.concurrent.TimeUnit;

/**
 * Actualiza la copia de los datos del teléfono a las 8 am, 1 pm y 4 pm, aunque la app esté cerrada
 * (Android puede atrasarla unos minutos para cuidar la batería, y espera a que haya internet).
 */
public class Sincronizador extends Worker {
    static final int[] HORAS = {8, 13, 16};

    public Sincronizador(@NonNull Context ctx, @NonNull WorkerParameters params) {
        super(ctx, params);
    }

    /** Programa la próxima actualización (no duplica si ya está programada). */
    static void programar(Context ctx) {
        long ahora = System.currentTimeMillis();
        long proxima = proximaHora(ahora);
        Constraints conRed = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(Sincronizador.class)
                .setInitialDelay(Math.max(0, proxima - ahora), TimeUnit.MILLISECONDS)
                .setConstraints(conRed)
                .addTag("sync")
                .build();
        WorkManager.getInstance(ctx).enqueueUniqueWork("sync-" + proxima, ExistingWorkPolicy.KEEP, req);
    }

    /** Actualizar ya (botón "Actualizar ahora" o al abrir la app). */
    static void ahora(Context ctx) {
        Constraints conRed = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(Sincronizador.class).setConstraints(conRed).addTag("sync").build();
        WorkManager.getInstance(ctx).enqueueUniqueWork("sync-ya", ExistingWorkPolicy.REPLACE, req);
    }

    static long proximaHora(long ahora) {
        Calendar c = Calendar.getInstance();
        for (int d = 0; d <= 1; d++) {
            for (int h : HORAS) {
                c.setTimeInMillis(ahora);
                c.add(Calendar.DAY_OF_YEAR, d);
                c.set(Calendar.HOUR_OF_DAY, h);
                c.set(Calendar.MINUTE, 0);
                c.set(Calendar.SECOND, 0);
                c.set(Calendar.MILLISECOND, 0);
                if (c.getTimeInMillis() > ahora) return c.getTimeInMillis();
            }
        }
        return ahora + TimeUnit.HOURS.toMillis(8);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        try {
            String token = Almacen.token(ctx);
            if (!token.isEmpty() && !BuildConfig.API_URL.isEmpty()) {
                JSONObject pedido = new JSONObject();
                pedido.put("action", "sincronizar");
                pedido.put("token", token);
                JSONObject r = new JSONObject(Red.post(BuildConfig.API_URL, pedido.toString()));
                if (r.optBoolean("ok")) {
                    r.remove("ok");
                    Almacen.guardarDatos(ctx, r.toString());
                    JSONObject config = r.optJSONObject("config");
                    if (config != null) Actualizador.revisarPantallas(ctx, config);
                } else if ("auth".equals(r.optString("code"))) {
                    Almacen.guardarToken(ctx, ""); // sesión vencida: se pide ingresar de nuevo
                }
            }
            programar(ctx);
            return Result.success();
        } catch (Exception e) {
            if (getRunAttemptCount() < 3) return Result.retry();
            programar(ctx);
            return Result.failure();
        }
    }
}
