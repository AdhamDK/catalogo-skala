# Spec: Modo vendedor + mini CRM (Google Sheets)

Estado: implementado (v1) · Fecha: 2026-10-25

## Objetivo
El vendedor toma pedidos en la calle desde el catálogo web. Cada pedido queda
registrado en Google Sheets (CRM simple) y se envía al grupo de WhatsApp de la empresa.

## Flujo
1. Botón **"Armar pedido por WhatsApp"** → hoja con 2 opciones: **Cliente** / **Vendedor**.
2. **Cliente** → flujo actual sin cambios (modal + wa.me al número de la empresa).
3. **Vendedor**:
   1. Si no hay sesión: elegir vendedor (lista desde la hoja `Vendedores`) + PIN de 4–6 dígitos.
   2. Sesión de 12 h (token firmado HMAC, guardado en el teléfono). Botón "Salir".
   3. Formulario del pedido: buscar cliente existente o crear uno nuevo
      (nombre del cliente, negocio, RIF/cédula, dirección, teléfono 1, teléfono 2,
      ubicación GPS con un toque), método de pago y nota.
   4. **Guardar y enviar al grupo** → se guarda en Sheets → se abre el menú de compartir
      del teléfono (o `wa.me/?text=`) para elegir el grupo de la empresa.
   5. Si no hay señal, el pedido queda **pendiente de subir** en el teléfono y se reintenta.
4. **Mis pedidos** (en el menú cuando hay sesión): lista por estado
   (pendiente / entregado / cancelado), marcar **Entregado** o **Cancelado** (con motivo),
   reenviar al grupo.

## Datos (Google Sheets, un archivo en Google Drive)
| Hoja | Columnas |
|---|---|
| `Vendedores` | id, nombre, pin_hash, activo |
| `Clientes` | id, nombre, rif_cedula, direccion, latitud, longitud, telefono, updated_at, sync_status, deleted, contacto, telefono2, vendedor_id, created_at |
| `Pedidos` | id, fecha, vendedor_id, vendedor, cliente_id, cliente, negocio, total_cajas, detalle_unidades, pago, nota, estado, estado_at, estado_por, motivo, client_ref, created_at, updated_at |
| `PedidoItems` | pedido_id, code, producto, cajas, unidades_caja, unidad, total_unidades |

- **Compatibilidad con GPS_CLIENTES:** las primeras 10 columnas de `Clientes` son idénticas
  a las de GPS_CLIENTES (`backend/Code.gs`). `nombre` = nombre del negocio (lo que se ve en
  el mapa); `contacto` = nombre de la persona. GPS_CLIENTES solo escribe las 10 primeras
  columnas, así que puede apuntar a esta misma hoja sin borrar los datos extra.
- IDs de pedido: `SKL-AAMMDD-NNN` (correlativo diario, hora de Caracas).
- `client_ref` (UUID generado en el teléfono) evita pedidos duplicados al reintentar.

## API (Apps Script Web App, POST JSON como `text/plain` para evitar preflight CORS)
| action | entrada | salida |
|---|---|---|
| `vendedores` | — | `[{id, nombre}]` activos |
| `login` | vendedor_id, pin | token, vendedor |
| `clientes` | token, q | hasta 20 clientes que coinciden (nombre, contacto, teléfono, RIF) |
| `guardarPedido` | token, client_ref, cliente{…}, items[{code, producto, cajas, unidades_caja, unidad}], pago, nota | pedido (con id), cliente_id |
| `pedidos` | token, estado?, dias? | pedidos del vendedor con items |
| `estado` | token, pedido_id, estado (entregado/cancelado/pendiente), motivo? | pedido |

## Seguridad (básica, a propósito)
- PIN guardado como SHA-256 con sal (nunca en texto plano). Se asigna desde el menú
  **Skala CRM → Asignar PIN** dentro de la hoja.
- 5 intentos fallidos → bloqueo de 10 min por vendedor.
- Token HMAC con secreto en *Script Properties*; vence a las 12 h.
- Un vendedor solo ve y cambia sus propios pedidos.

## Fuera de alcance (v1)
Precios, inventario, roles de administrador, publicación automática en grupos de WhatsApp
(no existe una vía oficial y gratuita; se usa el menú de compartir).
