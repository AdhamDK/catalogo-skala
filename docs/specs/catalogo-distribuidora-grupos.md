# Especificación SDD — Doble Dominio Independiente (`skala-venezuela` vs `dist-ontiveros`) y Grupos con Selector de Fragancias

> **Gobernanza Multiagente ([`AGENTS.md`](../../AGENTS.md)):**
> - **Preparado por:** Argon 4 (Arquitecto SDD)
> - **Implementación y Certificación QA:** Claude

---

## 1. Separación de Dominios y Negocios en Netlify Free

| Parámetro | Negocio 1: Importadora Skala | Negocio 2: Distribuidora Ontiveros |
| :--- | :--- | :--- |
| **Dominio en Netlify Free** | `skala-venezuela.netlify.app` | **`dist-ontiveros.netlify.app`** |
| **Directorio de publicación** | `catalogo-skala/` | `catalogo-distribuidora/` |
| **Logo e Identidad** | Skala Brasil (`assets/img/logo.png`) | Distribuciones Ontiveros (`DO`) (`00-logo-distribuidora/web/`) |
| **Vendedor asignado** | Exclusivo **Kevin (`U2`)** | Vendedores de ruta de la **Distribuidora** |
| **Modalidad de Venta** | **Solo por Caja cerrada** (`6 und` o `6 dúos` por caja) | **Configurable por grupo desde el Panel:** el vendedor asignado marca qué grupos se venden **solo por Caja/Bulto** y cuáles permiten **también por Unidad** |
| **Precios y Ofertas** | **Lista Importadora** (precios exclusivos para Skala por volumen, configurados por Kevin desde su panel) | **Lista Distribuidora** (precios propios por **Caja/Bulto** y, si está habilitado en ese grupo, por **Unidad**) |
| **Base de Datos** | Supabase (`sntrykeefsacrzeygule`) | Misma base Supabase (`sntrykeefsacrzeygule`) |

---

## 2. Arquitectura de "Producto Padre (Grupo) + Selector de Fragancias + Control de Venta por Unidad"

### 2.1. Regla de Negocio Central
1. **Un mismo precio por Grupo de Producto + Interruptor "Permitir venta por unidad" en el Panel:**
   - **En Importadora (`skala-venezuela.netlify.app`):** Se vende únicamente por **Caja cerrada**. Todos los productos dentro de **"Baño de Crema Skala 1Kg"** (`BC-01`..`BC-16`) comparten el mismo precio de grupo por caja; todos los **"Kits Skala"** (`KT-01`..`KT-08`) comparten su precio de grupo por caja.
   - **En Distribuidora (`dist-ontiveros.netlify.app`):**
     - Desde el **Panel (`panel.html`)**, el vendedor asignado puede marcar en cada grupo de producto un interruptor **`[x] Permitir venta por unidad`** (y definir su precio por unidad):
       - **Si NO está marcado (`Solo por Caja / Bulto`):** Ese grupo en el catálogo solo deja pedir por caja/bulto cerrado.
       - **Si SÍ está marcado (`Caja + Unidad`):** Ese grupo muestra en el catálogo el conmutador **`[ 📦 Por Caja / Bulto ]` | `[ 🧴 Por Unidad ]`**, permitiendo al cliente llevar unidades sueltas o cajas de las fragancias disponibles.
2. **Disponibilidad y Selección por Fragancia (`X de Y fragancias disponibles`):**
   - La tarjeta principal del grupo muestra cuántas fragancias/variantes están disponibles (ej. `5 de 7 fragancias disponibles`).
   - Al tocar la tarjeta del grupo (`Elegir fragancias`), se abre un modal/cajón rápido (`.modal-fragancias`) donde el cliente:
     - Si el grupo tiene habilitada la venta por unidad, elige si va a pedir en **`[ 🧴 Unidades ]`** o en **`[ 📦 Cajas / Bultos ]`**; si no, pide directamente en **`Cajas / Bultos`**.
     - Marca la cantidad deseada en cada fragancia disponible (`[-][cantidad][+]`).
   - Al confirmar (`Listo · Seguir viendo productos`), la tarjeta del grupo muestra el resumen exacto (ej. `1 caja + 4 unidades elegidas: 3 Floral · 1 Limón`) y el cliente continúa viendo los demás productos.
3. **Almacenamiento en `public.pedido_items`:**
   - La tabla `public.pedido_items` ya cuenta con `cajas` (`numeric`), `unidades_caja`, `unidad` (`'unidades'` vs `'cajas'`) y `total_unidades`, por lo que registra de forma nativa si cada renglón fue pedido por **Unidad** o por **Caja/Bulto**, descontando proporcionalmente del inventario.

---

## 3. Mapa Oficial de los 22 Grupos y sus Fragancias / Variantes (`catalogo-organizado/`)

| # | `grupo_id` | Nombre del Grupo | Marca / Categoría | Portada Grupal (`-400.jpg` / `-800.jpg`) | Fragancias / Variantes Incluidas |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | `SKL-BANOS` | **Baño de Crema Skala 1Kg (Caja x6)** | Skala Brasil | `04-productos-skala/SKL-BANOS-1kg-x6/portada-todos-los-banos-skala` | `BC-01` Babosa · `BC-02` Banana e Macuri · `BC-03` Divino Potao · `BC-04` Divino Potinho Kids · `BC-05` Dona Skala · `BC-06` Mais Cachos · `BC-07` Mais Crespinhos · `BC-08` Mais Crespos · `BC-09` Mais Lisos · `BC-10` Potao de Amor · `BC-11` Potao Despaiado · `BC-12` Mais Cachinhos · `BC-13` Ceramidas · `BC-14` Amido de Milho · `BC-15` Keratina Vegetal · `BC-16` Bomba de Vitaminas |
| 2 | `SKL-KITS` | **Kits Skala Shampoo + Acondicionador (Caja x6)** | Skala Brasil | `04-productos-skala/SKL-KITS-shampoo-acondicionador-x6/portada-todos-los-kits-skala` | `KT-01` Kit 12 em 1 · `KT-02` Kit Aguacate · `KT-03` Kit Babosa · `KT-04` Kit Bomba Vitaminas S.O.S · `KT-05` Kit Ceramidas · `KT-06` Kit Crespo Divino · `KT-07` Kit Mais Crespinhos · `KT-08` Kit Mais Cachos |
| 3 | `ALV-DET` | **Detergente en Polvo Alive 900g / 1Kg** | Alive Hogar | `01-productos-alive/ALV-DET-detergente-alive/portada-estudio-5-colores` | `ALV-DET-01` Blanco Perlas Blanqueadoras · `ALV-DET-02` Morado Floral · `ALV-DET-03` Rosado con Suavizante · `ALV-DET-04` Verde Limón · `ALV-DET-05` Azul Todo Tipo de Ropa · `ALV-DET-06` Azul Blanqueador 1Kg · `ALV-DET-07` Rosado Fragancia Bebé |
| 4 | `ALV-DET-PAN` | **Detergente en Panela Alive 150g** | Alive Hogar | `01-productos-alive/ALV-DET-detergente-alive/portada-todos-los-colores` | `ALV-PAN-01` Lavanda 150g · `ALV-PAN-02` Limón 150g · `ALV-PAN-03` Suavizante 150g |
| 5 | `ALV-SUA` | **Suavizante Alive Doypack** | Alive Hogar | `01-productos-alive/ALV-SUA-suavizante-alive/portada-estudio-6-colores` | `ALV-SUA-01` Celeste Fresca Primavera · `ALV-SUA-02` Verde Manzana · `ALV-SUA-03` Rosado Floral · `ALV-SUA-04` Celeste Bebé · `ALV-SUA-05` Morado Lavanda · `ALV-SUA-06` Rojo Fresa y Chocolate |
| 6 | `ALV-LAV` | **Lavaplatos Líquido Aliclean** | Alive Hogar | `01-productos-alive/ALV-LAV-lavaplatos-aliclean/portada-todos-los-colores` | `ALV-LAV-01` Limón Amarillo (Azul) 750ml · `ALV-LAV-02` Mandarina (Naranja) 350ml · `ALV-LAV-03` Verde Limón 750ml · `ALV-LAV-04` Limón Amarillo 350ml |
| 7 | `ALV-PAP` | **Papel Higiénico Alisoft (Paquete x4)** | Alisoft | `01-productos-alive/ALV-PAP-papel-alisoft/portada-todas-las-presentaciones` | `ALV-PAP-215` Rosado 215 Hojas x4 · `ALV-PAP-300` Dorado Comfort Plus 300 Hojas x4 · `ALV-PAP-400` Azul Premium Max 400 Hojas x4 · `ALV-PAP-600` Negro Premium Jumbo 600 Hojas x4 |
| 8 | `ALV-TOA-ABS` | **Toallín Absorbente Multiuso Alisoft** | Alisoft | `01-productos-alive/ALV-TOA-ABS-toallin-absorbente-alisoft/portada-toallin-absorbente` | `ALV-TABS-01` Toallín 80 Hojas · `ALV-TABS-02` Toallín Doble Hoja |
| 9 | `ALV-SHA-413` | **Shampoo y Acondicionador Alive Hierbas 413ml** | Alive Cuidado Personal | `01-productos-alive/ALV-SHA-shampoo-y-acondicionador-alive/portada-todos-los-colores` | `ALV-SHA-01` Shampoo Coco Tropical · `ALV-SHA-02` Shampoo Flor de Manzana · `ALV-SHA-03` Shampoo Beso Granada · `ALV-SHA-04` Shampoo Flor de la Pasión · `ALV-ACO-01` Acond. Coco Tropical · `ALV-ACO-02` Acond. Flor de Manzana · `ALV-ACO-03` Acond. Beso Granada · `ALV-ACO-04` Acond. Flor de la Pasión |
| 10 | `ALV-SHA-2EN1` | **Shampoo Alive 2 en 1 Pro-Vitamina B5 350ml** | Alive Cuidado Personal | `01-productos-alive/ALV-SHA-shampoo-y-acondicionador-alive/portada-todos-los-colores` | `ALV-SHA-05` 2 en 1 Todo Tipo · `ALV-SHA-06` 2 en 1 Cabello Graso · `ALV-SHA-07` 2 en 1 Cabello Seco · `ALV-SHA-08` Anti-Caspa Agua de Coco 400ml |
| 11 | `ALV-CAP` | **Tratamiento Capilar Alive** | Alive Cuidado Personal | `01-productos-alive/ALV-CAP-tratamiento-capilar-alive/portada-todos-los-colores` | `ALV-CAP-01` Verde Aceite de Oliva · `ALV-CAP-02` Turquesa Aceite de Argán · `ALV-CAP-03` Rosado Keratina |
| 12 | `ALV-LOC` | **Lociones y Fragancias Corporales Alive** | Alive Cuidado Personal | `01-productos-alive/ALV-LOC-locion-y-fragancias-alive/portada-todos-los-colores` | `ALV-LOC-01` Lila Beso Granada · `ALV-LOC-02` Rojo Flor de la Pasión · `ALV-LOC-03` Verde Coco Tropical · `ALV-LOC-04` Dorado Flor de Vainilla |
| 13 | `ALV-DEN` | **Crema Dental Alident 100g** | Alive Cuidado Personal | `01-productos-alive/ALV-DEN-crema-dental-alident/portada-estudio-5-variedades` | `ALV-DEN-01` Triple Acción · `ALV-DEN-02` Gel Azul Aliento Fresco · `ALV-DEN-03` Gel Verde Aliento Fresco · `ALV-DEN-04` Fresh Mint Rojo · `ALV-DEN-05` Blanqueador · `ALV-DEN-06` Ultra Fresh |
| 14 | `ALV-JAB` | **Jabón de Tocador Anita 125g** | Alive Cuidado Personal | `01-productos-alive/ALV-JAB-jabon-bano-anita-125g/portada-estudio-3-colores` | `ALV-JAB-01` Avena (Oats) · `ALV-JAB-02` Extracto de Perla (Rosado) · `ALV-JAB-03` Extracto de Aguacate (Verde) · `ALV-JAB-04` Extracto de Almendra (Morado) |
| 15 | `ALV-TOA` | **Toallas Femeninas y Protectores Alive** | Alive Cuidado Personal | `01-productos-alive/ALV-TOA-toallas-femeninas-y-protectores/portada-estudio-3-presentaciones-alive` | `ALV-TOA-01` Regular Diurno con Alas 245mm · `ALV-TOA-02` Noche Extra Larga 340mm · `ALV-TOA-03` Protectores Diarios x20 |
| 16 | `BF-PAN` | **Pañales Desechables Baby Finger** | Baby Finger | `02-productos-baby-finger/BF-PAN-panales-baby-finger/portada-todas-las-tallas` | `BF-PAN-P10` Talla P x10 · `BF-PAN-P20` Talla P (Etapa 1) x20 · `BF-PAN-M18` Talla M (Etapa 2) x18 · `BF-PAN-G18` Talla G (Etapa 3) x18 · `BF-PAN-XG16` Talla XG (Etapa 4) x16 |
| 17 | `BF-THU` | **Toallas Húmedas Baby Finger x50** | Baby Finger | `02-productos-baby-finger/BF-THU-toallas-humedas-baby-finger/portada-estudio-3-colores` | `BF-THU-01` Rosado x50 · `BF-THU-02` Celeste x50 · `BF-THU-03` Verde x50 |
| 18 | `BF-CUI` | **Línea Cuidado Bebé Baby Finger** | Baby Finger | `02-productos-baby-finger/BF-CUI-cuidado-bebe-baby-finger/portada-linea-completa` | `BF-CUI-01` Shampoo Niños · `BF-CUI-02` Colonia Niños · `BF-CUI-03` Aceite Niños · `BF-CUI-04` Jabón Líquido · `BF-CUI-05` Petroleum Bebé · `BF-CUI-06` Loción Niños · `BF-CUI-07` Talco 200g |
| 19 | `AZ-DET` | **Detergente en Polvo AZ** | AZ | `03-productos-az/AZ-DET-detergente-az/portada-todos-los-colores` | `AZ-DET-01` Azul Todo Tipo de Ropa · `AZ-DET-02` Rosado Ultra Floral |
| 20 | `BER-ESP` | **Espirales Antimosquitos Bernice x60** | Bernice | `05-productos-bernice/BER-ESP-espiral-bernice-x60/portada-espiral-bernice` | `BER-ESP-01` Caja x60 Espirales |
| 21 | `DOR-AFE` | **Afeitadora Dorco Pace 3** | Otros Almacén | `07-otros-productos-almacen/afeitadora-dorco-pace3/portada-dorco-pace3` | `DOR-AFE-01` Dorco Pace 3 |
| 22 | `HAR-JAB` | **Jabones Harmony (Fruity / Milky) y Popular** | Otros Almacén | `07-otros-productos-almacen/jabon-harmony-fruity/portada-6-aromas-frutales` | `HAR-FRU-01` Harmony Fruity (6 aromas frutales) · `HAR-MIL-01` Harmony Premium Milky (3 aromas) · `JAB-POP-01` Jabón Popular |

---

## 4. Diseño de Precios por Grupo y por Negocio en el Panel (`panel.html`)

1. **Edición de Precio por Grupo en 1 clic:**
   - En `#/precios`, el vendedor/administrador ve la tarjeta del **Grupo** (ej. *"Baño de Crema Skala 1Kg"* con sus 16 códigos `BC-01..BC-16`, o *"Detergente Alive 1Kg"* con sus 7 códigos `ALV-DET-01..07`).
   - Al guardar el precio del grupo, `guardarPrecio` envía `codes: [...]` (que ya soporta múltiples códigos de una sola vez en `crm-api.js` y `Code.gs`), aplicando exactamente el mismo precio a todas las fragancias del grupo.
2. **Separación de Precios Importadora vs. Distribuidora para Skala:**
   - En la **Importadora (`catalogo-skala/`)**, Skala lee los códigos `BC-01..BC-16` y `KT-01..KT-08`.
   - En la **Distribuidora (`catalogo-distribuidora/`)**, los grupos de Skala usan precios independientes de Distribuidora (`DIST-BC-01..16` / `DIST-KT-01..08` para precios, mientras el cálculo de `agotados` y stock en `catalogo_publico` descuenta del mismo stock físico `BC-01..16` y `KT-01..08`).
3. **Control por Grupo de `"Permitir venta por unidad"` desde el Panel (`panel.html`):**
   - En `#/precios`, cada tarjeta de grupo en el panel de la Distribuidora incluye el interruptor:
     - **`[ ] Permitir venta por unidad`** + campo **`Precio por Unidad ($)`** (además del precio por Caja/Bulto al detal y al mayor).
   - Esta configuración se guarda junto al precio del grupo en Supabase (`public.precios`), de modo que `catalogo_publico` la entrega en tiempo real a `dist-ontiveros.netlify.app`:
     - Si el vendedor activó **`Permitir venta por unidad`** en un grupo, el modal selector de fragancias de ese grupo habilita el botón **`[ 🧴 Por Unidad ]`** junto a **`[ 📦 Por Caja / Bulto ]`**.
     - Si el vendedor lo desactivó, ese grupo se vende **exclusivamente por Caja / Bulto**.
