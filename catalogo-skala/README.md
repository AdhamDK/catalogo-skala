# Skala Venezuela — Catálogo 2026

Catálogo autocontenido con la estética de la web oficial de Skala Brasil. Funciona
como **página web** (tipo blog) y como **PDF imprimible**. Sin precios: los precios se
informan por cotización (varían por cliente, cantidad y forma de pago).

## Archivos

```
catalogo-skala/
├── index.html          → página principal
├── css/styles.css      → estilos web + estilos de impresión (PDF)
├── js/main.js          → datos de productos + render + filtros
├── assets/img/         → colocar aquí las imágenes de producto
└── README.md
```

## Imágenes de los productos (ya cargadas)

Las fotos ya están en `assets/img/` con el **código de referencia** como nombre:

- `BC-01.png` … `BC-11.png` → baños de crema (11 imágenes).
- `KT-01.png`, `KT-02.png`, `KT-04.png`, `KT-05.png` … `KT-08.png` → kits.

**Estado:** 18 de 19 productos con foto. Falta **KT-03 (Kit Babosa)**, que no existe
como kit en la fuente: se muestra un placeholder automático. Cuando consigas la foto,
guardala como `assets/img/KT-03.png` y aparece sola.

**Fuente de las imágenes:** catálogo de un distribuidor de referencia
(Ponto Hair Club, `pontohairclub.com/collections/skala`) + recortes del PDF de kits
del usuario. Son fotos de producto de la marca Skala.

> Ojo con derechos de imagen: si sos distribuidor autorizado, usá las fotos oficiales
> de la marca o, mejor, fotos propias de tu stock. Confirmá con la marca/importador.

Si una imagen falta, la tarjeta muestra un **placeholder** con el nombre del producto.

## Cómo editar productos

Todo el contenido está en `js/main.js`, en los arreglos `BANOS` y `KITS`.
Cada producto tiene: `code`, `name`, `line` (beneficio/línea), `benefit`, `hair`
(curvatura 1A–4C) y `stock` (cantidad disponible). El stock se convierte solo en
un badge discreto (Alto/Medio/Bajo) para no presionar la venta.

> Revisá los textos de `benefit` contra la etiqueta/ficha de cada producto.

## Cómo generar el PDF

1. Abrí `index.html` en tu navegador.
2. `Ctrl + P` (o `Cmd + P` en Mac) → Imprimir.
3. En destino elegí **Guardar como PDF**.
4. Activá **Gráficos de fondo** (Background graphics) para que se vean los colores.
5. Papel: **A4**, márgenes: **Predeterminado** o **Mínimo**.

Los estilos de impresión ya separan las secciones en páginas y quitan la navegación,
los botones y los fondos decorativos.

## Cómo publicarla como blog / web

Subí la carpeta completa a cualquier hosting estático (Netlify, Vercel, GitHub Pages,
o el hosting que uses). Solo necesita archivos estáticos: HTML + CSS + JS + imágenes.

## Armador de pedido (WhatsApp)

Cada producto tiene un selector de **cajas** (− / número / +). Abajo aparece una barra
flotante con el **total de cajas** y, al tocar **"Armar pedido por WhatsApp"**, se abre un
modal donde el cliente completa:

- **RIF**, **Nombre del negocio**, **Dirección** y **Número de teléfono** (obligatorios).
- **Método de pago** (obligatorio): Bolívares · Contado, Bolívares · Crédito,
  Divisas · Contado o Divisas · Crédito.

El mensaje se arma en vivo con los datos del cliente + el pedido (producto, código, cajas
y total). El botón **"Enviar por WhatsApp"** se habilita solo cuando están todos los datos;
además hay **"Copiar mensaje"** para reenviarlo manualmente.

- **Configurar el número:** en `js/main.js`, cambiá `WHATSAPP_NUMBER` por tu número real,
  con código de país y **sin** `+`, espacios ni guiones (ej. Venezuela: `"584121234567"`).
- **Mínimo y meta:** en el mismo archivo, `MIN_CAJAS` (40) y `META_CAJAS` (100). La barra
  muestra cuánto falta para el mínimo y avisa cuando se llega a la meta.
- Las cantidades y los datos del cliente se guardan en el navegador (localStorage), así que
  no se pierden al recargar.

## Personalización

- **Contacto**: editá en `index.html` la sección `#contacto`. El link de WhatsApp se arma
  solo con `WHATSAPP_NUMBER`.
- **Marca**: cambiá "Skala Venezuela" en la barra superior y el texto del hero.
- **Colores**: editá las variables `:root` al inicio de `css/styles.css`.
- **Productos**: los datos están en `js/main.js` (arreglos `BANOS` y `KITS`).

## Curvatura y unidades por caja

- **Iconos de curvatura:** cada tarjeta muestra el rango (ej. `1A–4C`) y un icono por cada
  curvatura que cubre (Liso ●, Ondulado ◒, Cacheado ◉, Crespo ✦), con los mismos colores
  de la *Guía de curvatura*. Se calculan solos a partir del campo `hair` (`js/producto.js`).
- **Unidades por caja:** baños de crema = **6 unidades** (`UNIDADES_POR_CAJA_BANO`) y
  kits = **6 dúos** shampoo + acondicionador (`DUOS_POR_CAJA_KIT`), ambos en
  `js/producto.js`. El mensaje de WhatsApp incluye el total (ej. "2 cajas (12 unidades)").

## Mobile first

El CSS parte del teléfono y agrega pantallas grandes con `@media (min-width: 561px | 901px)`.

- Menú y filtros como filas deslizables (sin hamburguesa); el título no queda bajo la barra fija.
- Botones táctiles de 44px o más; inputs con letra de 16px (iOS no hace zoom).
- Barra de pedido en 2 filas con el botón de WhatsApp a lo ancho; modal tipo hoja inferior
  con el botón de enviar siempre visible; Esc cierra; el fondo no se desplaza.
- Respeta el notch/barra de gestos (`safe-area-inset`), `dvh`, hover solo con mouse y
  `prefers-reduced-motion`.
- Imágenes WebP de 400/800 px en `assets/img/web/` con `srcset` (≈270 KB las 19 vs 14 MB en
  PNG); los PNG originales quedan de respaldo. Logo liviano de 96/192 px.
- Si agregás un producto: poné `assets/img/CODIGO.png` y generá `web/CODIGO-400.webp` y
  `web/CODIGO-800.webp` (si faltan, se usa el PNG).

## CRM de pedidos con roles (Google Sheets)

Botón **Ingresar** (usuario + PIN) en la barra superior. Roles:
**Master** (todo + usuarios + resumen) · **Administración** (confirma pedidos y asigna
despachador) · **Vendedor** (toma pedidos en la calle con GPS y los envía al grupo de
WhatsApp) · **Despachador** (sus entregas: en ruta → entregado, con llamar y mapa).
Estados: pendiente → confirmado → en ruta → entregado (o cancelado, con motivo).
Sin señal, el pedido queda en el teléfono y se sube solo después.

- Instalación de la hoja y la API: `crm/INSTALAR.md` (raíz del repo, no se publica).
- Configurar la URL en `js/crm.js` → `CRM_API_URL`.
- Spec: `docs/specs/modo-vendedor-crm.md`.

## Tests

- Unitarios (sin dependencias): `node --test tests/producto.test.js tests/crm-core.test.js ../crm/tests/code.test.js`
- En navegador (requiere Playwright): `node tests/e2e.js` — prueba 320, 360, 390, 768 y 1280 px.
- CRM con los 4 roles de punta a punta (backend simulado): `node tests/e2e-crm.js`
