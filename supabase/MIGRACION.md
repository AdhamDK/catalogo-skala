# Guía de Migración Segura a Supabase Online Free + Netlify Free (0% pérdida de datos · 0 servidores)

Esta arquitectura funciona **100% gratis y sin servidores dedicados**:
- **Frontend estático (`catalogo-skala/`):** Alojado gratis en **Netlify Free** (y empaquetado en la APK de Android).
- **Base de datos y lógica RPC:** Alojadas gratis en **Supabase Online Free** (proyecto **`Dist.Ontiveros`**, ID `sntrykeefsacrzeygule`, región `us-east-1`), comunicándose directamente desde el navegador/APK por HTTPS (`https://sntrykeefsacrzeygule.supabase.co/rest/v1/rpc/skala_db`) usando únicamente la **Publishable Key (`sb_publishable_...`)**.
- **Integridad de datos (0% pérdida):** Tu hoja de Google Sheets actual no sufre ningún cambio ni borrado; funciona como respaldo histórico de solo lectura.

> **Nota sobre Conexión Directa vs API HTTPS en Supabase Free:**
> En el plan gratuito de Supabase, el host de conexión directa PostgreSQL (`db.sntrykeefsacrzeygule.supabase.co:5432`) opera exclusivamente sobre **IPv6**.
> - **La web (Netlify) y la APK Android NO usan conexión TCP PostgreSQL:** usan la API HTTPS REST/RPC (`https://sntrykeefsacrzeygule.supabase.co`), que funciona sobre IPv4 e IPv6 en cualquier operadora o Wi-Fi sin costo alguno.
> - Si alguna vez necesitás conectarte por consola/CLI desde una red solo-IPv4, usá el **Session Pooler gratuito (Supavisor IPv4)** en `aws-0-us-east-1.pooler.supabase.com:5432` (usuario `postgres.sntrykeefsacrzeygule`).

---

## Paso 1: Proyecto en Supabase Online Free (Completado ✅)

- **Proyecto:** `Dist.Ontiveros`
- **Project ID / Ref:** `sntrykeefsacrzeygule`
- **Región:** `us-east-1`
- **Project URL:** `https://sntrykeefsacrzeygule.supabase.co`
- **Publishable Key (pública para frontend/APK):** `sb_publishable_MwSEYT3JH1ZAiMKyrIZovA_h8M-9C9-`
- **Configuración local protegida:** Guardada en [`.env.local`](../.env.local) (excluido por [`.gitignore`](../.gitignore)).

---

## Paso 2: Crear las 13 tablas y funciones RPC en Supabase (30 segundos)

1. En el panel web de Supabase (`Dist.Ontiveros`), abrí **SQL Editor** → **New query**.
2. Copiá todo el contenido del archivo [`supabase/schema.sql`](./schema.sql) de este proyecto y pegalo en el editor.
3. Tocá el botón **"Run"** (abajo a la derecha).
4. Vas a ver `Success. No rows returned`. En **Table Editor** quedarán creadas las **11 tablas de dominio** más las 2 tablas internas blindadas con RLS:
   - `usuarios` (9 cols · incluye `comision_pct`)
   - `clientes` (14 cols · compatible con `GPS_CLIENTES`)
   - `pedidos` (53 cols · incluye abonos y ajustes de precio al cobrar)
   - `pedido_items` (13 cols + `row_id`)
   - `historial` (5 cols + `row_id`)
   - `precios` (18 cols · precargada con los 19 productos base `BC-01`..`KT-08`)
   - `inventario` (7 cols + `row_id`)
   - `pedidos_web` (23 cols)
   - `config` (3 cols · precargada con ajustes OTA y `comision_pct_default = 3`)
   - `pagos` (26 cols · abonos parciales, tasas BCV y liquidación de comisiones)
   - `tasas` (4 cols · histórico oficial BCV Bs/USD)
   - `skala_secretos` (tabla interna protegida para sincronizar `CRM_SECRET`)
   - `skala_intentos` (tabla interna protegida para control de fuerza bruta y rate-limit)

---

## Paso 3: Copiar todos los datos actuales de Google Sheets a Supabase

Primero asegurate de tener pegado el [`crm/Code.gs`](../crm/Code.gs) actualizado en tu Google Sheet (*Extensiones → Apps Script*) y haber publicado una nueva versión si usás la Opción B.

Tenés **dos formas** de copiar todos tus datos actuales en 1 clic (ambas dejan Google Sheets **100% intacto**):

### Opción A — Directamente desde el menú de Google Sheets (Recomendada)
1. En tu hoja de Google Sheets, recargá la página y abrí el menú superior **Skala CRM → 4. Copiar datos a Supabase (sin borrar nada)**.
2. Ingresá los dos datos de tu proyecto `Dist.Ontiveros`:
   - **Project URL:** `https://sntrykeefsacrzeygule.supabase.co`
   - **Publishable Key:** `sb_publishable_MwSEYT3JH1ZAiMKyrIZovA_h8M-9C9-`
3. Al aceptar, copiará todos los usuarios (con sus mismas claves cifradas y `CRM_SECRET`), clientes, coordenadas GPS, precios, inventario, pedidos, ítems, cobros, comisiones y tasas a Supabase.

### Opción B — Desde la app / panel de Skala (pestaña `Más`)
1. Ingresá en `panel.html` con tu usuario **Master** y entrá a **Más → Base de datos · Supabase → ⚙️ Configurar / Migrar a Supabase**.
2. Pegá:
   - **URL del proyecto:** `https://sntrykeefsacrzeygule.supabase.co`
   - **Clave pública:** `sb_publishable_MwSEYT3JH1ZAiMKyrIZovA_h8M-9C9-`
3. Tocá **"📥 1. Copiar datos de Google Sheets a Supabase"**.
4. Verificá el resumen de filas importadas en pantalla.
5. Marcá **"Usar Supabase como base de datos activa en este dispositivo"** para probar la velocidad de Supabase en tu teléfono o navegador antes de activarlo para todo el equipo.

---

## Paso 4: Dejar Supabase fijo para todos los teléfonos y Netlify Free

Una vez que verifiques que todos tus pedidos, clientes, inventario y usuarios están en Supabase:
1. Con **Claude** (siguiendo [`AGENTS.md`](../AGENTS.md)), actualizá [`catalogo-skala/js/crm-api.js`](../catalogo-skala/js/crm-api.js) (líneas 14–15) con las constantes públicas del proyecto:
   ```js
   const SUPABASE_URL = "https://sntrykeefsacrzeygule.supabase.co";
   const SUPABASE_ANON_KEY = "sb_publishable_MwSEYT3JH1ZAiMKyrIZovA_h8M-9C9-";
   ```
2. Guardá, hacé commit y `git push` a `main` (para actualizar **Netlify Free** automáticamente) y, si usás la APK de Android, publicá el paquete de pantallas con `android\hacer_pantallas.bat`.
3. Todos los teléfonos y el catálogo web pasarán automáticamente a trabajar sobre **Supabase Online Free** en milisegundos, manteniendo tu Google Sheet intacto como respaldo histórico.
