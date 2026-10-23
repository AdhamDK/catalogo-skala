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
