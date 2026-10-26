# Instalar el CRM de pedidos (Google Sheets + Drive)

El catálogo sigue publicado en Netlify. Los pedidos se guardan en **una hoja de Google en tu
Drive**, y un **Apps Script** pegado en esa hoja hace de "servidor" (gratis, sin hosting extra).

Tiempo: ~10 minutos. Usá la cuenta de Google de la empresa (será la dueña de los datos).

## 1. Crear la hoja
1. En Google Drive: **Nuevo → Hojas de cálculo de Google**. Nombre sugerido: `Skala CRM`.
2. En la hoja: **Extensiones → Apps Script**.
3. Borrá lo que haya en `Código.gs` y pegá **todo** el contenido de `crm/Code.gs`. Guardá (💾).
4. En **Configuración del proyecto** (engranaje), poné la zona horaria **(GMT-04:00) Caracas**.

## 2. Preparar hojas y vendedores
1. Volvé a la hoja y recargá la página. Aparece el menú **Skala CRM**.
2. **Skala CRM → 1. Preparar hojas** (la primera vez Google pide permisos: *Revisar permisos →
   tu cuenta → Configuración avanzada → Ir a … → Permitir*).
3. **Skala CRM → 2. Agregar vendedor** (uno por vendedor; queda con id V1, V2…).
4. **Skala CRM → 3. Asignar / cambiar PIN** (4 a 6 números). El PIN se guarda cifrado.
   - Para desactivar un vendedor: en la hoja `Vendedores`, columna `activo` = `FALSE`.

## 3. Publicar la API
1. En Apps Script: **Implementar → Nueva implementación → tipo: App web**.
2. *Ejecutar como*: **Yo** · *Quién tiene acceso*: **Cualquier persona**.
3. **Implementar** y copiá la **URL de la app web** (termina en `/exec`).

> "Cualquier persona" es necesario para que el catálogo pueda llamarla. Nadie puede leer ni
> escribir pedidos sin un PIN válido; la lista pública solo muestra nombres de vendedores.

## 4. Conectar el catálogo
1. En `catalogo-skala/js/vendedor.js`, pegá la URL en `const CRM_API_URL = "…/exec";`.
2. Subí el cambio (Netlify publica solo).

## 5. Probar
1. En el teléfono abrí el catálogo, agregá productos → **Armar pedido** → **Vendedor**.
2. Entrá con tu PIN, cargá un cliente, **Tomar ubicación GPS**, **Guardar pedido**.
3. Revisá la hoja: aparecen filas en `Clientes`, `Pedidos` y `PedidoItems`.
4. **Enviar al grupo de WhatsApp** → elegí el grupo de la empresa.

## Si cambiás `Code.gs` más adelante
**Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar.**
Así la URL `/exec` no cambia.

## Respaldo
La hoja vive en tu Drive: **Archivo → Historial de versiones** guarda todo. Para una copia
mensual: **Archivo → Hacer una copia**.

## Conectar con GPS_CLIENTES (opcional, más adelante)
Las 10 primeras columnas de `Clientes` son las mismas que usa GPS_CLIENTES. Pegando su
`backend/Code.gs` en **otro** proyecto de Apps Script apuntando a esta misma hoja
(propiedad `SPREADSHEET_ID`), la app de rutas vería los clientes con su GPS. Ver
`docs/specs/modo-vendedor-crm.md`.
