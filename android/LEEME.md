# Skala Equipo — app Android

Es el **panel del equipo** (lo que se ve después de *Ingresar*) dentro de una app.
El catálogo público no va en la app.

- **Se instala vacía.** Cada persona entra con su usuario y clave, y recién ahí se baja la
  base de datos de la nube: precios, existencias, clientes, sus pedidos y los pedidos web.
- **Datos en el teléfono.** Se actualizan solos a las **8 am, 1 pm y 4 pm**, aunque la app esté
  cerrada (hace falta internet; Android puede atrasarlo unos minutos para cuidar la batería).
  También hay **Más → Actualizar ahora**. Sin señal, la app muestra lo guardado y los pedidos
  nuevos quedan en el teléfono hasta que vuelva la conexión.
- **La sesión dura 30 días** en la app (en la web, 12 horas).
- **Compartir al grupo** abre el menú de Android (WhatsApp, etc.).

## Compilar la APK (en Windows)

Requisitos: **Android Studio** instalado (trae Java 17 y el SDK). Abrilo una vez para que
instale el SDK (*More Actions → SDK Manager*: Android 14 / API 34).

1. Doble clic en `android\compilar_apk.bat`.
   - La primera vez crea la **llave de firma** en `android\keystore\` → **guardá una copia** de esa
     carpeta (Drive, pendrive). Sin esa llave, las actualizaciones no se pueden instalar encima.
   - La primera compilación descarga Gradle y tarda unos minutos.
2. La APK queda en `android\salida\SkalaEquipo-AAAAMMDD-HHMM.apk`.
3. Pasala al teléfono (WhatsApp, cable, Drive) e instalala. Android pide permitir
   *Instalar apps de esta fuente*.

Las pantallas se copian solas desde `catalogo-skala/` al compilar.

## Publicar una actualización de la app (APK nueva)

Se usa para los cambios de la parte Android (permisos, sincronización en segundo plano).

1. En `android\app\build.gradle.kts` subí `versionCode` (ej. 1 → 2) y `versionName` (ej. "1.1.0").
2. `compilar_apk.bat`.
3. En GitHub → repositorio → **Releases → Draft a new release** → adjuntá la APK → *Publish*.
   Copiá el enlace del archivo (clic derecho en la APK → copiar enlace).
4. En la hoja del CRM, pestaña **Config**: `version_apk` = 2 y `url_apk` = el enlace.
   Si querés obligar a todos a actualizar, poné también `minima_apk` = 2. En `notas` podés
   escribir qué cambió.

Los teléfonos ven el aviso **"Hay una versión nueva de la app"** en la próxima actualización de
datos. Al tocar **Actualizar**, la app la descarga y abre el instalador de Android, y la persona
toca **Instalar**. Los datos y la sesión se conservan.

## Publicar pantallas nuevas (sin reinstalar)

Se usa para los cambios de diseño, botones o textos del panel. No gasta deploys de Netlify.

1. Doble clic en `android\hacer_pantallas.bat` → `android\salida\pantallas-VERSION.zip`.
2. Subí el .zip a GitHub Releases, igual que la APK, y copiá el enlace.
3. En la hoja **Config**: `version_pantallas` = la VERSION que mostró el script, y
   `url_pantallas` = el enlace.

En la próxima actualización de datos la app baja el paquete y lo usa **la próxima vez que se
abre**. Si el paquete falla, la app sigue con las pantallas que trae de fábrica. Para volver a
esas pantallas, dejá `version_pantallas` vacío.

> Si las pantallas nuevas usan algo nuevo del servidor, primero publicá el `Code.gs` nuevo
> (Implementar → Administrar implementaciones → ✏️ → Nueva versión).

## Cómo está hecha

| Archivo | Qué hace |
|---|---|
| `MainActivity.java` | WebView con las pantallas (`https://appassets.androidplatform.net/www/panel.html`), GPS, enlaces a WhatsApp, llamadas y mapas |
| `Pantallas.java` | Sirve primero el paquete de pantallas descargado; si no, las de fábrica |
| `Puente.java` | `window.SkalaApp` para las pantallas: versión, sesión, copia de datos, compartir y actualizar |
| `Sincronizador.java` | WorkManager: actualización a las 8, 13 y 16 h (con internet) |
| `Actualizador.java` | Descarga e instala la APK; baja y descomprime el paquete de pantallas |
| `Red.java` | Llamadas al CRM (la URL sale de `catalogo-skala/js/crm-api.js`) |

Las pruebas de las pantallas dentro de la app (con el puente simulado) están en
`catalogo-skala/tests/e2e-app.js`.
