# Instalar el CRM de pedidos (Google Sheets + Drive) — v2 con roles

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
   - Crea `Usuarios`, `Clientes`, `Pedidos`, `PedidoItems` e `Historial`.
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
4. Prueba: abrila en el navegador; debe mostrar `{"ok":true,"app":"skala-crm","version":2,"claves":true}`.

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
- **Vendedor**: **Nuevo** → elige productos con + / − → **Continuar** → datos del cliente
  (o buscarlo) + GPS → **Guardar pedido** → **Enviar al grupo**.
- **Administración**: **Inicio / Pedidos → Por aprobar** → abrir el pedido → **Aprobar** (elige despachador) o **Anular** (con motivo).
- **Despachador**: **Entregas** → abrir el pedido → *Salió en ruta* → *Entregado* (con Llamar, WhatsApp y Mapa).
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

## Respaldo
La hoja vive en tu Drive: **Archivo → Historial de versiones** guarda todo. La hoja
`Historial` registra quién cambió cada pedido y cuándo.

## Conectar con GPS_CLIENTES (más adelante)
Las 10 primeras columnas de `Clientes` son las mismas que usa GPS_CLIENTES, así que la app
de rutas puede usar esta misma hoja (propiedad `SPREADSHEET_ID`). Ver `docs/specs/modo-vendedor-crm.md`.
