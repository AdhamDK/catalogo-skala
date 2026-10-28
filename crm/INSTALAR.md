# Instalar el CRM de pedidos (Google Sheets + Drive) — v3

El catálogo sigue publicado en Netlify. Los pedidos se guardan en **una hoja de Google en tu
Drive**, y un **Apps Script** pegado en esa hoja hace de "servidor" (gratis, sin hosting extra).

Roles: **Master** (dueño) · **Administración** · **Vendedor** · **Despachador**.
Tiempo: ~10 minutos. Usá la cuenta de Google de la empresa (será la dueña de los datos).

## 1. Pegar el código
1. Abrí la hoja `Skala CRM` → **Extensiones → Apps Script**.
2. En `Código.gs`: **Ctrl + A → Supr** (que quede vacío, sin `function myFunction`),
   pegá **todo** `crm/Code.gs` y guardá (**Ctrl + S**). La línea 1 empieza con `/* ====`.
3. En **Configuración del proyecto** (engranaje): zona horaria **(GMT-04:00) Caracas**.

## 2. Preparar hojas y crear el Master
1. En el editor, en el desplegable de funciones elegí **prepararHojas** → **▶ Ejecutar**
   (si pide permisos: *Revisar permisos → tu cuenta → Configuración avanzada → Ir a … → Permitir*).
   - Crea `Usuarios`, `Clientes`, `Pedidos`, `PedidoItems`, `Historial`, `Precios`, `Inventario`,
     `PedidosWeb` y `Config` (las que falten; no borra nada).
   - Si ya tenías la hoja `Vendedores` (versión anterior), pasa esos vendedores a `Usuarios`
     con el mismo PIN (les sirve para entrar; conviene cambiarlo por una clave). Después podés borrar la hoja `Vendedores`.
2. Recargá la hoja → menú **Skala CRM → 2. Crear usuario**:
   usuario `jose` (o el que quieras), nombre, rol **master** y una **clave de al menos 8
   caracteres con letras y números** (puede llevar símbolos: `Skala#2026`).
3. Los demás usuarios los podés crear igual, o más cómodo **desde la web** con el Master
   (botón **Ingresar → Usuarios → Nuevo usuario**).

## 3. Publicar la API
1. **Implementar → Nueva implementación → tipo: App web**.
2. *Ejecutar como*: **Yo** · *Quién tiene acceso*: **Cualquier persona**.
3. **Implementar** y copiá la **URL de la app web** (termina en `/exec`).
4. Prueba: abrila en el navegador; debe mostrar `{"ok":true,"app":"skala-crm","version":3,"claves":true,"precios":true}`.

> "Cualquier persona" es necesario para que el catálogo pueda llamarla. Sin usuario y clave
> válidos no se puede leer ni escribir nada; cada acción se valida según el rol.

## 4. Conectar el catálogo
Pegá la URL en `catalogo-skala/js/crm-api.js` → `const CRM_API_URL = "…/exec";` y subí el cambio.
(Ya está configurada con la URL de Skala.)

## Si cambiás `Code.gs` más adelante
**Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar.**
Así la URL `/exec` no cambia.

## El panel del equipo
Todo el equipo trabaja en **`panel.html`** (desde el catálogo: botón **Ingresar**).
En el teléfono se puede instalar: Chrome → menú ⋮ → **Instalar app** (iPhone: Compartir →
**Agregar a inicio**). Abre a pantalla completa con el ícono de Skala.

## Uso diario
- **Vendedor**: **Nuevo** → 1) **Buscar cliente** o **Cliente nuevo** (si existe, ficha con ✏️
  para corregir datos) → 2) productos con + / − → 3) **¿Nota de entrega o factura?** (factura pide
  RIF), pago y nota → **Enviar pedido** → **Enviar al grupo**.
- **Administración**: **Inicio / Pedidos → Por aprobar** → abrir el pedido → **Aprobar** (elige despachador) o **Anular** (con motivo).
- **Despachador**: en Inicio ve "Hoy tenés por entregar N cajas". **Entregas** muestra arriba cajas
  por entregar, por cargar y en ruta. En *Por cargar* toca las tarjetas de los pedidos que lleva →
  **Ver total de carga** (cajas por producto). Al marcar todo lo cargado sale **¡Completo!** y
  *¡Saliendo a despachar!* pasa esos pedidos a *En ruta*. Cada tarjeta muestra Mapa y el botón
  *Salió en ruta* / *Entregado*; la flecha despliega productos y dirección, y *Más detalles* el
  botón para llamar. La pestaña *Entregados* los agrupa por día.
- **Fecha de entrega**: al marcar *Entregado* se elige **Hoy**, **Ayer** u **Otro día** (no puede ser
  futura ni anterior al pedido). Sirve cuando se entregó antes y se olvidó registrarlo.
- **Cobro**: el vendedor, con el pedido entregado y pagado, toca **Marcar cancelado (pagado)** y
  escribe el **monto y la moneda** (USD o Bs). Administración lo ve en **Por conciliar**, verifica el
  dinero y toca **Conciliar pago** (puede corregir el monto), o **Pago no recibido** (vuelve a Por cobrar).
- **Conciliados** (Pedidos → Conciliados): total conciliado en USD y Bs de Hoy / 7 / 30 / 90 días,
  con pedidos, cajas, por vendedor y por método de pago.
- **Crédito**: al enviar un pedido a crédito se eligen los días; cuentan desde la entrega.
  Banderas: verde al día · amarilla por vencer (≤ 3 días) · roja vencido · morada vencido hace más de 15 días.
- **Master**: todo lo anterior + **Más → Resumen** y **Más → Usuarios** (crear, clave, rol, activar).
- **Clientes**: ficha con datos, mapa e historial de pedidos; "Nuevo pedido para este cliente".
- **Añadir cliente** (Clientes → Añadir cliente): para pasar la base de clientes sin pedidos.
  Ubicación: pegá coordenadas (`8.6123, -71.6543`) o un enlace largo de Google Maps; "Usar mi
  ubicación actual" solo si estás en el local del cliente. "Guardar y añadir otro" para ir rápido.
- **Estados**: En proceso → Aprobado · Preparando despacho → En ruta → Entregado (o Anulado con motivo).
- **Tema oscuro**: Más → Tema (Automático / Claro / Oscuro).
- Claves: mínimo 6 caracteres con letras y números (Master: 8); pueden llevar símbolos.
- Si alguien olvida la clave: el Master le pone una nueva (Usuarios → Editar).
- **La hoja NO debe compartirse con "Cualquier persona con el enlace"**: dejala en
  *Compartir → Restringido*. La API funciona igual (corre con tu cuenta).

## Pedidos (panel)
4 pestañas con contador: **Por hacer** (Administración: por aprobar, pagos por conciliar y
pedidos web; Vendedor: sus pedidos web y lo que tiene para cobrar: vencidos, por vencer o de
contado), **En curso**, **Cobros** (por cobrar / por conciliar / conciliados) e **Historial**
(entregados / anulados). Buscador por cliente, número o teléfono; Administración filtra por
vendedor. La lista se muestra al instante con lo guardado y se actualiza por detrás; abrir un
pedido es inmediato y el historial llega después.

## Precios e inventario
- **Precios** (hoja `Precios` o panel → Más → *Inventario y precios*): el **precio final** en $ por
  caja que paga el cliente en cada forma de pago, **al por menor** (`menor`, `pronto`,
  `efectivo_credito`, `efectivo_pronto`) y **al mayor**, 15 cajas o más (`mayor`, `mayor_pronto`,
  `mayor_efectivo_credito`, `mayor_efectivo_pronto`). Ejemplo al por menor: 29,5 · 28,3 · 24 · 23,3.
  Si un precio al mayor queda vacío, se le aplica la misma rebaja que al por menor.
  Se pueden **elegir varios productos** con la casilla y ponerles los mismos precios.
- **Producto nuevo** (Inventario y precios → Nuevo producto): nombre, tipo (baño o kit), línea,
  cabello, unidades por caja, foto (enlace https, opcional) y precios. Sale en el catálogo y en el
  panel; empieza **sin stock** (en gris, no se puede pedir) hasta cargar su primera entrada.
- El vendedor puede dar **precio al mayor por excepción** (ej. 10 cajas a precio mayor).
- Al **marcar cancelado** se elige cómo pagó de verdad (ej. era crédito y pagó en efectivo al
  contado): el total final se recalcula con ese descuento.
- **Inventario**: Administración usa dos pantallas con fotos (como al tomar un pedido):
  - **Cargar mercancía**: tocar cada producto suma las cajas que llegaron.
  - **Conteo total**: escribir cuántas cajas hay en el depósito. Se guarda la diferencia con el
    sistema (sirve para el primer ajuste y para los conteos de fin de mes).
  Lo escrito queda guardado en el teléfono hasta que se envía. Por producto: *Ajustar stock*
  (entrada, conteo o ajuste con motivo).
  En depósito = entradas, conteos y ajustes − lo que ya salió (en ruta / entregado).
  Disponible = en depósito − aprobados que todavía no salieron. Al **aprobar** se aparta la
  mercancía (si no alcanza, no deja aprobar); si se anula, vuelve. Un producto sin ninguna
  entrada ni conteo no se controla.

## Pedidos web (los arma el cliente)
En el catálogo el cliente revisa su pedido, ve el monto según la forma de pago, **elige a su
vendedor** y lo envía por WhatsApp. El pedido llega también a la app de ese vendedor
(Pedidos → **Web**, y un aviso en Inicio): lo toma, lo revisa o edita y lo envía a
Administración. Administración los ve, pero no los toma. Se pueden descartar con motivo.

En **Tu pedido** el cliente elige forma de pago y, si quiere, **Seleccionar cliente** (se busca por
su teléfono o RIF, o toca *Nuevo · registrarme*; al lado de Dirección puede tomar su ubicación
actual). Hay un solo botón: **Enviar pedido**.
- **Con sus datos:** el pedido llega a Skala ("¡Listo!" con confeti) y queda en la pestaña de
  pedidos web de **todos los vendedores** hasta que uno lo tome. Si además lo manda por WhatsApp
  a su vendedor (flechita), queda asignado a ese vendedor.
- **Sin sus datos:** se abre "Enviar al vendedor por WhatsApp": elige su vendedor (o Skala) y
  coordina los datos por WhatsApp. No se guarda en el sistema.
El **WhatsApp de cada vendedor** se carga en Más → Usuarios → Editar (si no tiene, se usa el
número de Skala).

## Borrar pedidos
El vendedor puede borrar sus pedidos (ej. uno de prueba) y el Master cualquiera, siempre con
motivo. El pedido sale de las listas, los totales y el inventario, pero queda en la hoja
(columna `borrado`) y en el Historial.

## App Android
Ver `android/LEEME.md` (compilar, instalar y publicar actualizaciones con la hoja `Config`).

## Varios roles por usuario
Un usuario puede tener varios roles (ej. Vendedor + Despachador) y hace todo lo de cada uno:
en Más → Usuarios → Editar marcá las casillas, o en la hoja `Usuarios`, columna `rol`, separados
por coma (`vendedor, despachador`).

## Respaldo
La hoja vive en tu Drive: **Archivo → Historial de versiones** guarda todo. La hoja
`Historial` registra quién cambió cada pedido y cuándo.

## Conectar con GPS_CLIENTES (más adelante)
Las 10 primeras columnas de `Clientes` son las mismas que usa GPS_CLIENTES, así que la app
de rutas puede usar esta misma hoja (propiedad `SPREADSHEET_ID`). Ver `docs/specs/modo-vendedor-crm.md`.
