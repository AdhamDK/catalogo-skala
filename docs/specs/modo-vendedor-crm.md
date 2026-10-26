# Spec: CRM de pedidos con roles (Google Sheets)

Estado: v2 implementado · Fecha: 2026-10-25
Arquitectura: catálogo estático en Netlify + Google Sheets (en Drive) con Apps Script como API.

## Roles
| | Master | Administración | Vendedor | Despachador |
|---|:-:|:-:|:-:|:-:|
| Tomar pedidos | ✔ | ✔ | ✔ | — |
| Ver pedidos | todos | todos | los suyos | los asignados (confirmado / en ruta / entregado) |
| Confirmar + asignar despachador | ✔ | ✔ | — | — |
| Marcar en ruta / entregado | ✔ | ✔ | — | ✔ (los suyos) |
| Cancelar (con motivo) | ✔ | ✔ | los suyos en *pendiente* | — |
| Reabrir (volver a pendiente) | ✔ | ✔ | — | — |
| Buscar / editar clientes | ✔ | ✔ | ✔ | — (ve los datos dentro del pedido) |
| Usuarios (crear, PIN, rol, activar) | ✔ | — | — | — |
| Resumen | todo | todo | sus ventas | — |

El servidor valida el rol en **cada** acción (la interfaz solo oculta botones).
El rol se lee de la hoja en cada llamada: un cambio de rol o desactivación aplica al instante.

## Estados del pedido
Clave interna (hoja) → nombre que ve el equipo:
`pendiente` **En proceso** (enviado, espera aprobación de Administración) →
`confirmado` **Aprobado · Preparando despacho** (Administración aprueba y asigna despachador) →
`en_ruta` **En ruta** → `entregado` **Entregado**;
`cancelado` **Anulado** desde cualquier estado no entregado (motivo obligatorio).
Admin/Master pueden corregir (reabrir a pendiente, reasignar despachador).
Cada cambio queda en la hoja `Historial` (fecha, pedido, usuario, acción, detalle).

## Panel del equipo (v3)
`panel.html`: app instalable (manifest + service worker) con páginas por hash y barra inferior:
Inicio · Nuevo (lista rápida de productos → datos del cliente → listo) · Pedidos (+ detalle con
historial y acciones) · Clientes (+ ficha con historial) · Más (Resumen, Usuarios, catálogo, salir).
Despachador: Inicio · Entregas · Más.
Clientes: botón **Añadir cliente** (sin pedido, para traspasar la base): teléfono opcional,
ubicación pegada (coordenadas o enlace largo de Google Maps) o GPS actual; "Guardar y añadir otro".
Tema claro / oscuro / automático (Más → Tema; en el catálogo, pie de página). `js/tema.js`. El catálogo comparte el carrito (`skala_pedido_v1`) y solo
lleva al panel.

## Ingreso
Botón **Ingresar** en la barra superior: **usuario + clave** (mínimo 6 caracteres con letras y
números, símbolos permitidos; Master mínimo 8). Botón "Ver" para mostrarla. Los PIN numéricos de
la v1 siguen sirviendo para entrar.
5 intentos fallidos → 10 min de bloqueo. Token HMAC de 12 h.
"Armar pedido": sin sesión pregunta Cliente/Vendedor; con sesión de vendedor/admin/master
va directo al formulario del pedido.

## Hojas
| Hoja | Columnas |
|---|---|
| `Usuarios` | id, usuario, nombre, rol, pin_hash, activo, created_at |
| `Clientes` | (10 de GPS_CLIENTES) id, nombre, rif_cedula, direccion, latitud, longitud, telefono, updated_at, sync_status, deleted + contacto, telefono2, vendedor_id, created_at |
| `Pedidos` | id, fecha, vendedor_id, vendedor, cliente_id, cliente, negocio, total_cajas, detalle_unidades, pago, nota, estado, estado_at, estado_por, motivo, client_ref, created_at, updated_at, despachador_id, despachador, confirmado_por, confirmado_at, entregado_por, entregado_at |
| `PedidoItems` | pedido_id, code, producto, cajas, unidades_caja, unidad, total_unidades |
| `Historial` | fecha, pedido_id, usuario, accion, detalle |

Migración: si existe la hoja `Vendedores` (v1), *Preparar hojas* copia sus filas a `Usuarios`
como rol `vendedor` conservando id y PIN.

## API (POST JSON `text/plain`)
| action | roles | entrada |
|---|---|---|
| `login` | público | usuario, clave |
| `yo` | todos | — |
| `clientes` | M, A, V | q, limite? |
| `guardarCliente` | M, A, V | cliente{id?, negocio, contacto, rif_cedula, telefono?, telefono2, direccion, latitud, longitud} — alta/edición sin pedido; no duplica (teléfono, RIF o mismo nombre) |
| `guardarPedido` | M, A, V | client_ref, cliente{…}, items[], pago, nota |
| `pedidos` | todos (filtrado por rol) | estados[]?, dias?, cliente_id? |
| `pedido` | todos (si lo puede ver) | pedido_id → pedido + items + cliente + historial |
| `estado` | según tabla | pedido_id, estado, motivo?, despachador_id? |
| `despachadores` | M, A | — |
| `resumen` | M, A, V | dias |
| `usuarios` / `guardarUsuario` | M | id?, usuario, nombre, rol, activo, clave? |

## Fuera de alcance
Precios, inventario, envío automático a grupos de WhatsApp (se usa el menú compartir).
