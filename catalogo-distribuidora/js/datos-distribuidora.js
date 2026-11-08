/* ============================================================
   Distribuciones Ontiveros — Catálogo Mayorista y por Unidad
   25 Grupos de Productos (22 Carpetas Oficiales de Estudio)
   Imágenes Estudio-Pro 4:3 (#FFFFFF) en 3 Resoluciones (-400, -800, -hq)
   ============================================================ */

const WHATSAPP_NUMBER = "584247392349";
const MIN_CAJAS = 10;
const META_CAJAS = 15;

/* Helper para derivar los 3 niveles de resolución (-400.jpg, -800.jpg, -hq.jpg) */
function nivelesImagen(rutaBase400o800) {
  const base = String(rutaBase400o800 || "").replace(/-(400|800|hq)\.jpg$/i, "");
  return {
    img400: `${base}-400.jpg`,
    img800: `${base}-800.jpg`,
    imgHq: `${base}-hq.jpg`,
  };
}

/* 25 Grupos oficiales de Distribuciones Ontiveros cubriendo las 22 carpetas de catalogo-aprobado */
const GRUPOS_DISTRIBUIDORA = [
  {
    id: "GRP-ALV-DET-1KG",
    nombre: "Detergente Alive 1kg",
    categoria: "Detergentes",
    marca: "Alive",
    unidades: 12,
    unidad: "bolsas de 1 kg",
    precioMenor: 16.80,
    precioMayor: 15.60,
    permiteUnidad: true,
    precioUnidad: 1.45,
    portada400: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/portada-7-variantes-detergente-alive-400.jpg",
    portada: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/portada-7-variantes-detergente-alive-800.jpg",
    portada800: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/portada-7-variantes-detergente-alive-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/portada-7-variantes-detergente-alive-hq.jpg",
    descripcion: "Fórmula concentrada multiacción de 1 kg. Elegí las fragancias que querés combinar con un mismo precio.",
    variantes: [
      { code: "ALV-DET1K-01", name: "Blanco Perla Blanqueador 1 kg", fragancia: "Blanco Perla Blanqueador", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-01-blanco-perla-blanqueador-1kg-800.jpg" },
      { code: "ALV-DET1K-02", name: "Morado Floral 1 kg", fragancia: "Morado Floral", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-02-morado-floral-1kg-800.jpg" },
      { code: "ALV-DET1K-03", name: "Rosado con Suavizante 1 kg", fragancia: "Rosado con Suavizante", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-03-rosado-con-suavizante-1kg-800.jpg" },
      { code: "ALV-DET1K-04", name: "Verde Limón 1 kg", fragancia: "Verde Limón", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-04-verde-limon-1kg-800.jpg" },
      { code: "ALV-DET1K-05", name: "Azul Todo Tipo de Ropa 1 kg", fragancia: "Azul Todo Tipo de Ropa", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-05-azul-todo-tipo-ropa-1kg-800.jpg" },
      { code: "ALV-DET1K-06", name: "Rosa Fragancia Bebé 1 kg", fragancia: "Rosa Fragancia Bebé", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-06-rosa-fragancia-bebe-1kg-800.jpg" },
      { code: "ALV-DET1K-07", name: "Azul Fragancia Bebé 1 kg", fragancia: "Azul Fragancia Bebé", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-07-azul-fragancia-bebe-1kg-800.jpg" }
    ]
  },
  {
    id: "GRP-AZ-DET",
    nombre: "Detergente A-Z 1kg",
    categoria: "Detergentes",
    marca: "AZ",
    unidades: 12,
    unidad: "bolsas de 1 kg",
    precioMenor: 15.60,
    precioMayor: 14.40,
    permiteUnidad: true,
    precioUnidad: 1.35,
    portada400: "assets/img/catalogo-aprobado/02-AZ-DET-detergente-az/portada-estudio-2-colores-az-400.jpg",
    portada: "assets/img/catalogo-aprobado/02-AZ-DET-detergente-az/portada-estudio-2-colores-az-800.jpg",
    portada800: "assets/img/catalogo-aprobado/02-AZ-DET-detergente-az/portada-estudio-2-colores-az-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/02-AZ-DET-detergente-az/portada-estudio-2-colores-az-hq.jpg",
    descripcion: "Detergente biológico multiacción A-Z para ropa blanca y de color.",
    variantes: [
      { code: "AZ-DET-01", name: "A-Z Azul Naranja Todo Tipo de Ropa 1 kg", fragancia: "Azul Todo Tipo de Ropa", img: "assets/img/catalogo-aprobado/02-AZ-DET-detergente-az/variantes/estudio-pro-01-azul-naranja-todo-tipo-1kg-800.jpg" },
      { code: "AZ-DET-02", name: "A-Z Rosado Ultra Floral 1 kg", fragancia: "Rosado Ultra Floral", img: "assets/img/catalogo-aprobado/02-AZ-DET-detergente-az/variantes/estudio-pro-02-rosado-ultra-floral-1kg-800.jpg" }
    ]
  },
  {
    id: "GRP-ALV-DET-500G",
    nombre: "Detergente Alive 500g",
    categoria: "Detergentes",
    marca: "Alive",
    unidades: 24,
    unidad: "bolsas de 500 g",
    precioMenor: 17.50,
    precioMayor: 16.20,
    permiteUnidad: true,
    precioUnidad: 0.78,
    portada400: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/portada-7-variantes-detergente-alive-400.jpg",
    portada: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/portada-7-variantes-detergente-alive-800.jpg",
    portada800: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/portada-7-variantes-detergente-alive-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/portada-7-variantes-detergente-alive-hq.jpg",
    descripcion: "Presentación de alta rotación para bodegas y abastos. Bulto de 24 unidades o por unidad.",
    variantes: [
      { code: "ALV-DET500-01", name: "Blanco Perla Blanqueador 500 g", fragancia: "Blanco Perla 500g", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-01-blanco-perla-blanqueador-1kg-800.jpg" },
      { code: "ALV-DET500-02", name: "Morado Floral 500 g", fragancia: "Morado Floral 500g", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-02-morado-floral-1kg-800.jpg" },
      { code: "ALV-DET500-03", name: "Rosado con Suavizante 500 g", fragancia: "Rosado Suavizante 500g", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-03-rosado-con-suavizante-1kg-800.jpg" },
      { code: "ALV-DET500-04", name: "Verde Limón 500 g", fragancia: "Verde Limón 500g", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-04-verde-limon-1kg-800.jpg" },
      { code: "ALV-DET500-05", name: "Azul Todo Tipo de Ropa 500 g", fragancia: "Azul Todo Tipo 500g", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-05-azul-todo-tipo-ropa-1kg-800.jpg" },
      { code: "ALV-DET500-06", name: "Rosa Fragancia Bebé 400 g", fragancia: "Rosa Bebé 400g", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-06-rosa-fragancia-bebe-1kg-800.jpg" },
      { code: "ALV-DET500-07", name: "Rosado con Suavizante 200 g", fragancia: "Rosado Suavizante 200g", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-03-rosado-con-suavizante-1kg-800.jpg" }
    ]
  },
  {
    id: "GRP-ALV-PAN-150G",
    nombre: "Jabón Panela Alive 150g",
    categoria: "Detergentes",
    marca: "Alive",
    unidades: 36,
    unidad: "panelas de 150 g",
    precioMenor: 14.40,
    precioMayor: 13.50,
    permiteUnidad: true,
    precioUnidad: 0.45,
    portada400: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/portada-estudio-3-panelas-alive-400.jpg",
    portada: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/portada-estudio-3-panelas-alive-800.jpg",
    portada800: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/portada-estudio-3-panelas-alive-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/portada-estudio-3-panelas-alive-hq.jpg",
    descripcion: "Jabón en barra multiuso para lavado de ropa delicada y desmanchado.",
    variantes: [
      { code: "ALV-PAN-01", name: "Panela Alive Lavanda 150 g", fragancia: "Lavanda", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-panela-01-lavanda-150g-800.jpg" },
      { code: "ALV-PAN-02", name: "Panela Alive Limón 150 g", fragancia: "Limón", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-panela-02-limon-150g-800.jpg" },
      { code: "ALV-PAN-03", name: "Panela Alive con Suavizante 150 g", fragancia: "Con Suavizante", img: "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-panela-03-suavizante-150g-800.jpg" }
    ]
  },
  {
    id: "GRP-JAB-POPULAR",
    nombre: "Jabón Popular Barra",
    categoria: "Detergentes",
    marca: "Popular",
    unidades: 36,
    unidad: "barras",
    precioMenor: 13.80,
    precioMayor: 12.90,
    permiteUnidad: true,
    precioUnidad: 0.42,
    portada400: "assets/img/catalogo-aprobado/20-jabon-popular/portada-estudio-jabon-popular-400.jpg",
    portada: "assets/img/catalogo-aprobado/20-jabon-popular/portada-estudio-jabon-popular-800.jpg",
    portada800: "assets/img/catalogo-aprobado/20-jabon-popular/portada-estudio-jabon-popular-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/20-jabon-popular/portada-estudio-jabon-popular-hq.jpg",
    descripcion: "Jabón en barra tradicional de alta espuma y rendimiento para lavado general.",
    variantes: [
      { code: "JAB-POP-01", name: "Jabón Popular en Barra", fragancia: "Original Barra", img: "assets/img/catalogo-aprobado/20-jabon-popular/variantes/estudio-pro-01-jabon-popular-barra-800.jpg" }
    ]
  },
  {
    id: "GRP-ALV-SUA-1L",
    nombre: "Suavizante Alive 1L",
    categoria: "Suavizantes",
    marca: "Alive",
    unidades: 12,
    unidad: "envases",
    precioMenor: 18.00,
    precioMayor: 16.80,
    permiteUnidad: true,
    precioUnidad: 1.55,
    portada400: "assets/img/catalogo-aprobado/06-ALV-SUA-suavizante-alive/portada-estudio-6-colores-400.jpg",
    portada: "assets/img/catalogo-aprobado/06-ALV-SUA-suavizante-alive/portada-estudio-6-colores-800.jpg",
    portada800: "assets/img/catalogo-aprobado/06-ALV-SUA-suavizante-alive/portada-estudio-6-colores-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/06-ALV-SUA-suavizante-alive/portada-estudio-6-colores-hq.jpg",
    descripcion: "Suavizante textil con cápsulas de perfume prolongado (48 horas). 6 fragancias disponibles.",
    variantes: [
      { code: "ALV-SUA-01", name: "Suavizante Alive Celeste Fresca Primavera", fragancia: "Fresca Primavera", img: "assets/img/catalogo-aprobado/06-ALV-SUA-suavizante-alive/variantes/estudio-pro-01-celeste-fresca-primavera-500ml-800.jpg" },
      { code: "ALV-SUA-02", name: "Suavizante Alive Verde Manzana", fragancia: "Verde Manzana", img: "assets/img/catalogo-aprobado/06-ALV-SUA-suavizante-alive/variantes/estudio-pro-02-verde-manzana-500ml-800.jpg" },
      { code: "ALV-SUA-03", name: "Suavizante Alive Rosado Floral", fragancia: "Rosado Floral", img: "assets/img/catalogo-aprobado/06-ALV-SUA-suavizante-alive/variantes/estudio-pro-03-rosado-floral-500ml-800.jpg" },
      { code: "ALV-SUA-04", name: "Suavizante Alive Celeste Bebé", fragancia: "Celeste Bebé", img: "assets/img/catalogo-aprobado/06-ALV-SUA-suavizante-alive/variantes/estudio-pro-04-celeste-bebe-500ml-800.jpg" },
      { code: "ALV-SUA-05", name: "Suavizante Alive Morado Lavanda", fragancia: "Morado Lavanda", img: "assets/img/catalogo-aprobado/06-ALV-SUA-suavizante-alive/variantes/estudio-pro-05-morado-lavanda-500ml-800.jpg" },
      { code: "ALV-SUA-06", name: "Suavizante Alive Rojo Fresa y Chocolate", fragancia: "Fresa y Chocolate", img: "assets/img/catalogo-aprobado/06-ALV-SUA-suavizante-alive/variantes/estudio-pro-06-rojo-fresa-chocolate-500ml-800.jpg" }
    ]
  },
  {
    id: "GRP-ALV-LAV",
    nombre: "Lavaplatos Aliclean 350ml",
    categoria: "Detergentes",
    marca: "Alive",
    unidades: 24,
    unidad: "envases de 350 ml",
    precioMenor: 19.20,
    precioMayor: 18.00,
    permiteUnidad: true,
    precioUnidad: 0.85,
    portada400: "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/portada-estudio-3-almacen-400.jpg",
    portada: "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/portada-estudio-3-almacen-800.jpg",
    portada800: "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/portada-estudio-3-almacen-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/portada-estudio-3-almacen-hq.jpg",
    descripcion: "Arranca grasa concentrado Aliclean en presentación de 350 ml con sus 3 fragancias (mismo precio por fragancia).",
    variantes: [
      { code: "ALV-LAV-01", name: "Aliclean Azul Limón Amarillo 350 ml", fragancia: "Limón Amarillo 350ml", img: "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/variantes/estudio-pro-01-azul-limon-amarillo-350ml-800.jpg" },
      { code: "ALV-LAV-02", name: "Aliclean Naranja Mandarina 350 ml", fragancia: "Mandarina 350ml", img: "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/variantes/estudio-pro-02-naranja-mandarina-350ml-800.jpg" },
      { code: "ALV-LAV-03", name: "Aliclean Verde Limón 350 ml", fragancia: "Verde Limón 350ml", img: "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/variantes/estudio-pro-03-verde-limon-350ml-800.jpg" }
    ]
  },
  {
    id: "GRP-ALV-LAV-750",
    nombre: "Lavaplatos Aliclean 750ml",
    categoria: "Detergentes",
    marca: "Alive",
    unidades: 12,
    unidad: "envases de 750 ml",
    precioMenor: 22.80,
    precioMayor: 21.00,
    permiteUnidad: true,
    precioUnidad: 1.95,
    portada400: "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/portada-estudio-350ml-y-750ml-400.jpg",
    portada: "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/portada-estudio-350ml-y-750ml-800.jpg",
    portada800: "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/portada-estudio-350ml-y-750ml-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/portada-estudio-350ml-y-750ml-hq.jpg",
    descripcion: "Arranca grasa concentrado Aliclean en presentación grande de 750 ml con sus fragancias (precio distinto a 350 ml).",
    variantes: [
      { code: "ALV-LAV-04", name: "Aliclean Azul Limón Amarillo 750 ml", fragancia: "Limón Amarillo 750ml", img: "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/variantes/estudio-pro-04-azul-limon-amarillo-750ml-800.jpg" },
      { code: "ALV-LAV-05", name: "Aliclean Verde Limón 750 ml", fragancia: "Verde Limón 750ml", img: "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/variantes/estudio-pro-05-verde-limon-750ml-800.jpg" }
    ]
  },
  {
    id: "GRP-ALV-PAP",
    nombre: "Papel Alisoft 4 Rollos",
    categoria: "Hogar y Papel",
    marca: "Alisoft",
    unidades: 12,
    unidad: "paquetes de 4 rollos",
    preciosDistintos: true,
    precioMenor: 19.80,
    precioMayor: 18.60,
    permiteUnidad: true,
    precioUnidad: 1.70,
    portada400: "assets/img/catalogo-aprobado/08-ALV-PAP-papel-alisoft/portada-estudio-4-cuadricula-400.jpg",
    portada: "assets/img/catalogo-aprobado/08-ALV-PAP-papel-alisoft/portada-estudio-4-cuadricula-800.jpg",
    portada800: "assets/img/catalogo-aprobado/08-ALV-PAP-papel-alisoft/portada-estudio-4-cuadricula-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/08-ALV-PAP-papel-alisoft/portada-estudio-4-cuadricula-hq.jpg",
    descripcion: "Papel higiénico doble hoja 100% material virgen Alisoft en 4 presentaciones (215, 300, 400 y 600 hojas). Todas manejan distintos precios.",
    variantes: [
      { code: "ALV-PAP-01", name: "Alisoft Rosado 215 Hojas × 4 Rollos", fragancia: "Rosado 215 Hojas ×4", precioMenor: 19.80, precioMayor: 18.60, precioUnidad: 1.70, img: "assets/img/catalogo-aprobado/08-ALV-PAP-papel-alisoft/variantes/estudio-pro-01-alisoft-rosado-215-hojas-x4-800.jpg" },
      { code: "ALV-PAP-02", name: "Alisoft Dorado Comfort Plus 300 Hojas × 4 Rollos", fragancia: "Dorado Comfort Plus 300 Hojas ×4", precioMenor: 22.20, precioMayor: 20.80, precioUnidad: 1.90, img: "assets/img/catalogo-aprobado/08-ALV-PAP-papel-alisoft/variantes/estudio-pro-02-alisoft-dorado-comfort-plus-300-hojas-x4-800.jpg" },
      { code: "ALV-PAP-03", name: "Alisoft Azul Premium Max 400 Hojas × 4 Rollos", fragancia: "Azul Premium Max 400 Hojas ×4", precioMenor: 24.00, precioMayor: 22.50, precioUnidad: 2.05, img: "assets/img/catalogo-aprobado/08-ALV-PAP-papel-alisoft/variantes/estudio-pro-03-alisoft-azul-premium-max-400-hojas-x4-800.jpg" },
      { code: "ALV-PAP-04", name: "Alisoft Negro Premium Jumbo 600 Hojas × 4 Rollos", fragancia: "Negro Jumbo 600 Hojas ×4", precioMenor: 27.60, precioMayor: 25.80, precioUnidad: 2.35, img: "assets/img/catalogo-aprobado/08-ALV-PAP-papel-alisoft/variantes/estudio-pro-04-alisoft-negro-premium-jumbo-600-hojas-x4-800.jpg" }
    ]
  },
  {
    id: "GRP-ALV-TOA-ABS",
    nombre: "Toallín Alisoft",
    categoria: "Hogar y Papel",
    marca: "Alisoft",
    unidades: 12,
    unidad: "rollos",
    preciosDistintos: true,
    precioMenor: 18.60,
    precioMayor: 17.40,
    permiteUnidad: true,
    precioUnidad: 1.60,
    portada400: "assets/img/catalogo-aprobado/09-ALV-TOA-ABS-toallin-absorbente-alisoft/portada-estudio-toallin-absorbente-400.jpg",
    portada: "assets/img/catalogo-aprobado/09-ALV-TOA-ABS-toallin-absorbente-alisoft/portada-estudio-toallin-absorbente-800.jpg",
    portada800: "assets/img/catalogo-aprobado/09-ALV-TOA-ABS-toallin-absorbente-alisoft/portada-estudio-toallin-absorbente-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/09-ALV-TOA-ABS-toallin-absorbente-alisoft/portada-estudio-toallin-absorbente-hq.jpg",
    descripcion: "Toalla de papel absorbente multiuso para cocina y hogar. Ambas presentaciones manejan distintos precios.",
    variantes: [
      { code: "ALV-TOAABS-01", name: "Toallín Alisoft Azul 80 Hojas", fragancia: "Azul 80 Hojas", precioMenor: 18.60, precioMayor: 17.40, precioUnidad: 1.60, img: "assets/img/catalogo-aprobado/09-ALV-TOA-ABS-toallin-absorbente-alisoft/variantes/estudio-pro-01-toallin-alisoft-azul-80-hojas-800.jpg" },
      { code: "ALV-TOAABS-02", name: "Toallín Alisoft Naranja Doble Hoja", fragancia: "Naranja Doble Hoja", precioMenor: 20.40, precioMayor: 19.20, precioUnidad: 1.75, img: "assets/img/catalogo-aprobado/09-ALV-TOA-ABS-toallin-absorbente-alisoft/variantes/estudio-pro-02-toallin-alisoft-naranja-doble-hoja-800.jpg" }
    ]
  },
  {
    id: "GRP-BER-ESP",
    nombre: "Espirales Bernice x60",
    categoria: "Hogar y Papel",
    marca: "Bernice",
    unidades: 60,
    unidad: "cajas de 10 und",
    precioMenor: 22.00,
    precioMayor: 20.40,
    permiteUnidad: true,
    precioUnidad: 0.42,
    portada400: "assets/img/catalogo-aprobado/18-BER-ESP-espiral-bernice-x60/portada-estudio-espirales-bernice-400.jpg",
    portada: "assets/img/catalogo-aprobado/18-BER-ESP-espiral-bernice-x60/portada-estudio-espirales-bernice-800.jpg",
    portada800: "assets/img/catalogo-aprobado/18-BER-ESP-espiral-bernice-x60/portada-estudio-espirales-bernice-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/18-BER-ESP-espiral-bernice-x60/portada-estudio-espirales-bernice-hq.jpg",
    descripcion: "Espirales repelentes de mosquitos y zancudos Bernice de combustión uniforme.",
    variantes: [
      { code: "BER-ESP-60", name: "Espiral Antimosquitos Bernice × 10 Unidades", fragancia: "Bernice Caja ×10 und", img: "assets/img/catalogo-aprobado/18-BER-ESP-espiral-bernice-x60/variantes/estudio-pro-01-espirales-bernice-10und-800.jpg" }
    ]
  },
  {
    id: "GRP-DOR-PACE3",
    nombre: "Afeitadora Dorco Pace 3",
    categoria: "Hogar y Papel",
    marca: "Dorco",
    unidades: 12,
    unidad: "blísters (1 blíster = 12 pqts × 3 afeitadoras)",
    etiquetaCaja: "Caja (=×12 blísters)",
    etiquetaUnidad: "Blíster (=×12 pqts de 3 afeitadoras)",
    precioMenor: 22.00,
    precioMayor: 20.40,
    permiteUnidad: true,
    precioUnidad: 1.90,
    portada400: "assets/img/catalogo-aprobado/19-afeitadora-dorco-pace3/portada-estudio-afeitadora-dorco-pace3-400.jpg",
    portada: "assets/img/catalogo-aprobado/19-afeitadora-dorco-pace3/portada-estudio-afeitadora-dorco-pace3-800.jpg",
    portada800: "assets/img/catalogo-aprobado/19-afeitadora-dorco-pace3/portada-estudio-afeitadora-dorco-pace3-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/19-afeitadora-dorco-pace3/portada-estudio-afeitadora-dorco-pace3-hq.jpg",
    descripcion: "Máquina de afeitar Dorco Pace 3 de 3 hojillas. Se vende por Caja (=×12 blísters) o por Blíster (1 blíster = ×12 paquetes de 3 afeitadoras).",
    variantes: [
      { code: "DOR-PACE3-01", name: "Afeitadora Dorco Pace 3 (1 Caja = 12 Blísters · 1 Blíster = 12 pqts de 3 afeitadoras)", fragancia: "Dorco Pace 3 (Blíster ×12 pqts de 3)", img: "assets/img/catalogo-aprobado/19-afeitadora-dorco-pace3/variantes/estudio-pro-01-afeitadora-dorco-pace3-3und-800.jpg" }
    ]
  },
  {
    id: "GRP-ALV-CAP",
    nombre: "Baño de Crema Alive 400g",
    categoria: "Cuidado Personal",
    marca: "Alive",
    unidades: 12,
    unidad: "tarros de 400 g",
    precioMenor: 20.40,
    precioMayor: 18.90,
    permiteUnidad: true,
    precioUnidad: 1.75,
    portada400: "assets/img/catalogo-aprobado/10-ALV-CAP-tratamiento-capilar-alive/portada-estudio-3-banos-de-crema-400.jpg",
    portada: "assets/img/catalogo-aprobado/10-ALV-CAP-tratamiento-capilar-alive/portada-estudio-3-banos-de-crema-800.jpg",
    portada800: "assets/img/catalogo-aprobado/10-ALV-CAP-tratamiento-capilar-alive/portada-estudio-3-banos-de-crema-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/10-ALV-CAP-tratamiento-capilar-alive/portada-estudio-3-banos-de-crema-hq.jpg",
    descripcion: "Mascarilla de nutrición profunda para todo tipo de cabellos: Aceite de Oliva, Argán y Antifrizz Keratina.",
    variantes: [
      { code: "ALV-CAP-01", name: "Baño de Crema Alive Aceite de Oliva 400 g", fragancia: "Aceite de Oliva (Verde)", img: "assets/img/catalogo-aprobado/10-ALV-CAP-tratamiento-capilar-alive/variantes/estudio-pro-01-bano-crema-alive-oliva-400g-800.jpg" },
      { code: "ALV-CAP-02", name: "Baño de Crema Alive Aceite de Argán 400 g", fragancia: "Aceite de Argán (Turquesa)", img: "assets/img/catalogo-aprobado/10-ALV-CAP-tratamiento-capilar-alive/variantes/estudio-pro-02-bano-crema-alive-argan-400g-800.jpg" },
      { code: "ALV-CAP-03", name: "Baño de Crema Alive Antifrizz Keratina 400 g", fragancia: "Antifrizz Keratina (Rosado)", img: "assets/img/catalogo-aprobado/10-ALV-CAP-tratamiento-capilar-alive/variantes/estudio-pro-03-bano-crema-alive-keratina-400g-800.jpg" }
    ]
  },
  {
    id: "GRP-ALV-LOC",
    nombre: "Loción Corporal Alive 400ml",
    categoria: "Cuidado Personal",
    marca: "Alive",
    unidades: 12,
    unidad: "envases de 400 ml",
    precioMenor: 22.80,
    precioMayor: 21.00,
    permiteUnidad: true,
    precioUnidad: 1.95,
    portada400: "assets/img/catalogo-aprobado/11-ALV-LOC-locion-y-fragancias-alive/portada-estudio-4-lociones-alive-400.jpg",
    portada: "assets/img/catalogo-aprobado/11-ALV-LOC-locion-y-fragancias-alive/portada-estudio-4-lociones-alive-800.jpg",
    portada800: "assets/img/catalogo-aprobado/11-ALV-LOC-locion-y-fragancias-alive/portada-estudio-4-lociones-alive-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/11-ALV-LOC-locion-y-fragancias-alive/portada-estudio-4-lociones-alive-hq.jpg",
    descripcion: "Cremas perfumadas de hidratación profunda para piel seca y sedienta en 4 aromas exclusivos.",
    variantes: [
      { code: "ALV-LOC-01", name: "Loción Alive Lila Beso Granada 400 ml", fragancia: "Beso Granada (Lila)", img: "assets/img/catalogo-aprobado/11-ALV-LOC-locion-y-fragancias-alive/variantes/estudio-pro-01-locion-alive-beso-granada-400ml-800.jpg" },
      { code: "ALV-LOC-02", name: "Loción Alive Rojo Flor de la Pasión 400 ml", fragancia: "Flor de la Pasión (Rojo)", img: "assets/img/catalogo-aprobado/11-ALV-LOC-locion-y-fragancias-alive/variantes/estudio-pro-02-locion-alive-flor-pasion-400ml-800.jpg" },
      { code: "ALV-LOC-03", name: "Loción Alive Verde Coco Tropical 400 ml", fragancia: "Coco Tropical (Verde)", img: "assets/img/catalogo-aprobado/11-ALV-LOC-locion-y-fragancias-alive/variantes/estudio-pro-03-locion-alive-coco-tropical-400ml-800.jpg" },
      { code: "ALV-LOC-04", name: "Loción Alive Dorado Flor de Vainilla 400 ml", fragancia: "Flor de Vainilla (Dorado)", img: "assets/img/catalogo-aprobado/11-ALV-LOC-locion-y-fragancias-alive/variantes/estudio-pro-04-locion-alive-flor-vainilla-400ml-800.jpg" }
    ]
  },
  {
    id: "GRP-ALV-SHA-350",
    nombre: "Shampoo Alive 350ml",
    categoria: "Cuidado Personal",
    marca: "Alive",
    unidades: 12,
    unidad: "envases de 350 ml",
    precioMenor: 19.20,
    precioMayor: 17.80,
    permiteUnidad: true,
    precioUnidad: 1.65,
    portada400: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/portada-estudio-shampoo-350ml-7-colores-400.jpg",
    portada: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/portada-estudio-shampoo-350ml-7-colores-800.jpg",
    portada800: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/portada-estudio-shampoo-350ml-7-colores-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/portada-estudio-shampoo-350ml-7-colores-hq.jpg",
    descripcion: "Shampoo 2 en 1 con Pro-Vitamina B5 y línea Alive Gold de 350 ml (7 variedades).",
    variantes: [
      { code: "ALV-SHA350-01", name: "Shampoo 2en1 Azul Todo Tipo de Cabello 350 ml", fragancia: "2en1 Azul Todo Tipo", img: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-05-shampoo-350ml-2en1-azul-todo-tipo-800.jpg" },
      { code: "ALV-SHA350-02", name: "Shampoo 2en1 Morado Cabello Graso 350 ml", fragancia: "2en1 Morado Cabello Graso", img: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-06-shampoo-350ml-2en1-morado-cabello-graso-800.jpg" },
      { code: "ALV-SHA350-03", name: "Shampoo 2en1 Rojo Cabello Seco 350 ml", fragancia: "2en1 Rojo Cabello Seco", img: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-07-shampoo-350ml-2en1-rojo-cabello-seco-800.jpg" },
      { code: "ALV-SHA350-04", name: "Shampoo 2en1 Fucsia Cabello Normal 350 ml", fragancia: "2en1 Fucsia Normal", img: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-08-shampoo-350ml-2en1-fucsia-cabello-normal-800.jpg" },
      { code: "ALV-SHA350-05", name: "Shampoo Gold Verde Refrescante 350 ml", fragancia: "Gold Verde Refrescante", img: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-09-shampoo-350ml-gold-verde-refrescante-800.jpg" },
      { code: "ALV-SHA350-06", name: "Shampoo Gold Amarillo Brillo 350 ml", fragancia: "Gold Amarillo Brillo", img: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-10-shampoo-350ml-gold-amarillo-brillo-800.jpg" },
      { code: "ALV-SHA350-07", name: "Shampoo Gold Azul Anticaspa 350 ml", fragancia: "Gold Azul Anticaspa", img: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-11-shampoo-350ml-gold-azul-anticaspa-800.jpg" }
    ]
  },
  {
    id: "GRP-ALV-SHA-250",
    nombre: "Shampoo Alive 250ml",
    categoria: "Cuidado Personal",
    marca: "Alive",
    unidades: 12,
    unidad: "envases de 250 ml",
    variacionesLineaTotal: 8,
    precioMenor: 16.80,
    precioMayor: 15.60,
    permiteUnidad: true,
    precioUnidad: 1.45,
    portada400: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/portada-estudio-shampoo-250ml-4-colores-400.jpg",
    portada: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/portada-estudio-shampoo-250ml-4-colores-800.jpg",
    portada800: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/portada-estudio-shampoo-250ml-4-colores-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/portada-estudio-shampoo-250ml-4-colores-hq.jpg",
    descripcion: "Línea de champú botánico Alive de 250 ml (cuenta con 8 variaciones en la línea; 4 disponibles de momento: Flor de Manzana, Coco Tropical, Beso de Granada y Flor de la Pasión).",
    variantes: [
      { code: "ALV-SHA250-01", name: "Shampoo Alive Verde Flor de Manzana 250 ml", fragancia: "Flor de Manzana 250ml", img: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-01-shampoo-250ml-verde-flor-manzana-800.jpg" },
      { code: "ALV-SHA250-02", name: "Shampoo Alive Naranja Coco Tropical 250 ml", fragancia: "Coco Tropical 250ml", img: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-02-shampoo-250ml-naranja-coco-tropical-800.jpg" },
      { code: "ALV-SHA250-03", name: "Shampoo Alive Rosado Beso de Granada 250 ml", fragancia: "Beso de Granada 250ml", img: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-03-shampoo-250ml-rosado-beso-granada-800.jpg" },
      { code: "ALV-SHA250-04", name: "Shampoo Alive Morado Flor de la Pasión 250 ml", fragancia: "Flor de la Pasión 250ml", img: "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-04-shampoo-250ml-morado-flor-pasion-800.jpg" }
    ]
  },
  {
    id: "GRP-ALV-DEN",
    nombre: "Crema Dental Alident 100g",
    categoria: "Cuidado Personal",
    marca: "Alive",
    unidades: 8,
    unidad: "blísters ×12 und",
    empaqueDetalle: "1 cja = 8 blísters × 12 und",
    precioMenor: 28.80,
    precioMayor: 26.40,
    permiteUnidad: true,
    precioUnidad: 3.65,
    portada400: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/portada-estudio-10-variedades-400.jpg",
    portada: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/portada-estudio-10-variedades-800.jpg",
    portada800: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/portada-estudio-10-variedades-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/portada-estudio-10-variedades-hq.jpg",
    descripcion: "Línea odontológica Alident 100 g (1 caja = 8 blísters × 12 und): Ultra Fresh, Gel Verde/Azul, Fresh Mint, Extra Blancura, Triple Action, Pro-White, Sensitive y Kids.",
    variantes: [
      { code: "ALV-DEN-01", name: "Alident Ultra Fresh Roja 100 g", fragancia: "Ultra Fresh Roja 100g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-01-ultra-fresh-roja-100g-800.jpg" },
      { code: "ALV-DEN-02", name: "Alident Gel Verde Aliento Fresco 100 g", fragancia: "Gel Verde Aliento Fresco 100g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-02-gel-verde-aliento-fresco-100g-800.jpg" },
      { code: "ALV-DEN-03", name: "Alident Fresh Mint Menta Suave 100 g", fragancia: "Fresh Mint Menta Suave 100g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-03-fresh-mint-menta-suave-100g-800.jpg" },
      { code: "ALV-DEN-04", name: "Alident Gel Azul Ice Cool Mint 100 g", fragancia: "Gel Azul Ice Cool Mint 100g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-04-gel-azul-ice-cool-mint-100g-800.jpg" },
      { code: "ALV-DEN-05", name: "Alident Extra Blancura Triple Acción Verde 100 g", fragancia: "Extra Blancura Verde 100g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-05-extra-blancura-triple-accion-verde-100g-800.jpg" },
      { code: "ALV-DEN-06", name: "Alident Triple Action Roja 100 g", fragancia: "Triple Action Roja 100g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-06-triple-action-roja-100g-800.jpg" },
      { code: "ALV-DEN-07", name: "Alident Pro-White Blanqueador 100 g", fragancia: "Pro-White Blanqueador 100g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-07-pro-white-blanqueador-100g-800.jpg" },
      { code: "ALV-DEN-08", name: "Alident Sensitive Uso Diario 100 g", fragancia: "Sensitive Uso Diario 100g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-08-sensitive-uso-diario-100g-800.jpg" },
      { code: "ALV-DEN-09", name: "Alident Kids Niño 100 g", fragancia: "Kids Niño 100g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-09-kids-nino-100g-800.jpg" },
      { code: "ALV-DEN-10", name: "Alident Kids Niña 100 g", fragancia: "Kids Niña 100g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-10-kids-nina-100g-800.jpg" }
    ]
  },
  {
    id: "GRP-ALV-DEN-75G",
    nombre: "Crema Dental Alident 75g",
    categoria: "Cuidado Personal",
    marca: "Alive",
    unidades: 10,
    unidad: "blísters ×12 und",
    empaqueDetalle: "1 cja = 10 blísters × 12 und",
    precioMenor: 25.00,
    precioMayor: 23.50,
    permiteUnidad: true,
    precioUnidad: 2.55,
    portada400: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/portada-estudio-5-variedades-400.jpg",
    portada: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/portada-estudio-5-variedades-800.jpg",
    portada800: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/portada-estudio-5-variedades-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/portada-estudio-5-variedades-hq.jpg",
    descripcion: "Línea odontológica Alident 75 g (1 caja = 10 blísters × 12 und): Ultra Fresh, Gel Verde/Azul, Fresh Mint, Extra Blancura, Triple Action, Pro-White, Sensitive y Kids.",
    variantes: [
      { code: "ALV-DEN75-01", name: "Alident Ultra Fresh Roja 75 g", fragancia: "Ultra Fresh Roja 75g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-01-ultra-fresh-roja-100g-800.jpg" },
      { code: "ALV-DEN75-02", name: "Alident Gel Verde Aliento Fresco 75 g", fragancia: "Gel Verde Aliento Fresco 75g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-02-gel-verde-aliento-fresco-100g-800.jpg" },
      { code: "ALV-DEN75-03", name: "Alident Fresh Mint Menta Suave 75 g", fragancia: "Fresh Mint Menta Suave 75g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-03-fresh-mint-menta-suave-100g-800.jpg" },
      { code: "ALV-DEN75-04", name: "Alident Gel Azul Ice Cool Mint 75 g", fragancia: "Gel Azul Ice Cool Mint 75g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-04-gel-azul-ice-cool-mint-100g-800.jpg" },
      { code: "ALV-DEN75-05", name: "Alident Extra Blancura Triple Acción Verde 75 g", fragancia: "Extra Blancura Verde 75g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-05-extra-blancura-triple-accion-verde-100g-800.jpg" },
      { code: "ALV-DEN75-06", name: "Alident Triple Action Roja 75 g", fragancia: "Triple Action Roja 75g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-06-triple-action-roja-100g-800.jpg" },
      { code: "ALV-DEN75-07", name: "Alident Pro-White Blanqueador 75 g", fragancia: "Pro-White Blanqueador 75g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-07-pro-white-blanqueador-100g-800.jpg" },
      { code: "ALV-DEN75-08", name: "Alident Sensitive Uso Diario 75 g", fragancia: "Sensitive Uso Diario 75g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-08-sensitive-uso-diario-100g-800.jpg" },
      { code: "ALV-DEN75-09", name: "Alident Kids Niño 75 g", fragancia: "Kids Niño 75g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-09-kids-nino-100g-800.jpg" },
      { code: "ALV-DEN75-10", name: "Alident Kids Niña 75 g", fragancia: "Kids Niña 75g", img: "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-10-kids-nina-100g-800.jpg" }
    ]
  },
  {
    id: "GRP-ALV-JAB-ANITA",
    nombre: "Jabón Anita 125g",
    categoria: "Cuidado Personal",
    marca: "Alive",
    unidades: 72,
    unidad: "pastillas de 125 g",
    precioMenor: 24.00,
    precioMayor: 22.50,
    permiteUnidad: true,
    precioUnidad: 0.38,
    portada400: "assets/img/catalogo-aprobado/04-ALV-JAB-jabon-bano-anita-125g/portada-estudio-5-fragancias-400.jpg",
    portada: "assets/img/catalogo-aprobado/04-ALV-JAB-jabon-bano-anita-125g/portada-estudio-5-fragancias-800.jpg",
    portada800: "assets/img/catalogo-aprobado/04-ALV-JAB-jabon-bano-anita-125g/portada-estudio-5-fragancias-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/04-ALV-JAB-jabon-bano-anita-125g/portada-estudio-5-fragancias-hq.jpg",
    descripcion: "Jabón cremoso hidratante Anita con extractos naturales (Avena, Perla, Aguacate, Almendra y Pepino).",
    variantes: [
      { code: "ALV-JAB-01", name: "Anita Dorado Avena (Oats) 125 g", fragancia: "Avena (Dorado)", img: "assets/img/catalogo-aprobado/04-ALV-JAB-jabon-bano-anita-125g/variantes/estudio-pro-01-dorado-avena-oats-125g-800.jpg" },
      { code: "ALV-JAB-02", name: "Anita Rosado Extracto de Perla 125 g", fragancia: "Extracto de Perla (Rosado)", img: "assets/img/catalogo-aprobado/04-ALV-JAB-jabon-bano-anita-125g/variantes/estudio-pro-02-rosado-pearl-extract-125g-800.jpg" },
      { code: "ALV-JAB-03", name: "Anita Celeste Extracto de Aguacate 125 g", fragancia: "Aguacate (Celeste)", img: "assets/img/catalogo-aprobado/04-ALV-JAB-jabon-bano-anita-125g/variantes/estudio-pro-03-celeste-avocado-extract-125g-800.jpg" },
      { code: "ALV-JAB-03B", name: "Anita Turquesa Aguacate Hoja 125 g", fragancia: "Aguacate Hoja (Turquesa)", img: "assets/img/catalogo-aprobado/04-ALV-JAB-jabon-bano-anita-125g/variantes/estudio-pro-03b-turquesa-avocado-extract-hoja-125g-800.jpg" },
      { code: "ALV-JAB-04", name: "Anita Morado Extracto de Almendra 125 g", fragancia: "Almendra (Morado)", img: "assets/img/catalogo-aprobado/04-ALV-JAB-jabon-bano-anita-125g/variantes/estudio-pro-04-morado-almond-extract-125g-800.jpg" },
      { code: "ALV-JAB-05", name: "Anita Verde Extracto de Pepino 125 g", fragancia: "Pepino (Verde)", img: "assets/img/catalogo-aprobado/04-ALV-JAB-jabon-bano-anita-125g/variantes/estudio-pro-05-verde-pepino-cucumber-extract-125g-800.jpg" }
    ]
  },
  {
    id: "GRP-ALV-TOA-FEM",
    nombre: "Toallas Femeninas Alive",
    categoria: "Cuidado Personal",
    marca: "Alive",
    unidades: 72,
    unidad: "paquetes",
    preciosDistintos: true,
    precioMenor: 36.00,
    precioMayor: 33.80,
    permiteUnidad: true,
    precioUnidad: 0.55,
    portada400: "assets/img/catalogo-aprobado/07-ALV-TOA-toallas-femeninas-y-protectores/portada-estudio-4-presentaciones-alive-400.jpg",
    portada: "assets/img/catalogo-aprobado/07-ALV-TOA-toallas-femeninas-y-protectores/portada-estudio-4-presentaciones-alive-800.jpg",
    portada800: "assets/img/catalogo-aprobado/07-ALV-TOA-toallas-femeninas-y-protectores/portada-estudio-4-presentaciones-alive-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/07-ALV-TOA-toallas-femeninas-y-protectores/portada-estudio-4-presentaciones-alive-hq.jpg",
    descripcion: "Protección femenina anatómica Alive (todas las cajas traen 72 paquetes): Regular Día (245mm), Nocturna (290mm), Extra Larga (340mm) y Protectores Diarios ×20 manejan distintos precios.",
    variantes: [
      { code: "ALV-TOAFEM-01", name: "Toallas Alive Regular Día con Alas 245 mm", fragancia: "Regular Día 245mm", precioMenor: 36.00, precioMayor: 33.80, precioUnidad: 0.55, img: "assets/img/catalogo-aprobado/07-ALV-TOA-toallas-femeninas-y-protectores/variantes/estudio-pro-01-alive-regular-dia-245mm-800.jpg" },
      { code: "ALV-TOAFEM-02", name: "Toallas Alive Nocturna Noche 290 mm", fragancia: "Nocturna Noche 290mm", precioMenor: 39.60, precioMayor: 37.40, precioUnidad: 0.60, img: "assets/img/catalogo-aprobado/07-ALV-TOA-toallas-femeninas-y-protectores/variantes/estudio-pro-02-alive-nocturna-noche-290mm-800.jpg" },
      { code: "ALV-TOAFEM-03", name: "Toallas Alive Extra Larga 340 mm", fragancia: "Extra Larga 340mm", precioMenor: 43.20, precioMayor: 41.00, precioUnidad: 0.65, img: "assets/img/catalogo-aprobado/07-ALV-TOA-toallas-femeninas-y-protectores/variantes/estudio-pro-03-alive-extra-larga-340mm-800.jpg" },
      { code: "ALV-TOAFEM-04", name: "Protectores Diarios Alive × 20 Unidades", fragancia: "Protectores Diarios ×20", precioMenor: 32.40, precioMayor: 30.20, precioUnidad: 0.50, img: "assets/img/catalogo-aprobado/07-ALV-TOA-toallas-femeninas-y-protectores/variantes/estudio-pro-04-alive-protector-diario-x20-800.jpg" }
    ]
  },
  {
    id: "GRP-HAR-MILKY",
    nombre: "Jabón Harmony Milky",
    categoria: "Cuidado Personal",
    marca: "Harmony",
    unidades: 48,
    unidad: "und de 135 g",
    empaqueDetalle: "1 cja = 48 und (135 g)",
    precioMenor: 23.40,
    precioMayor: 21.60,
    permiteUnidad: true,
    precioUnidad: 0.52,
    portada400: "assets/img/catalogo-aprobado/21-jabon-harmony-premium-milky/portada-estudio-3-fragancias-harmony-premium-400.jpg",
    portada: "assets/img/catalogo-aprobado/21-jabon-harmony-premium-milky/portada-estudio-3-fragancias-harmony-premium-800.jpg",
    portada800: "assets/img/catalogo-aprobado/21-jabon-harmony-premium-milky/portada-estudio-3-fragancias-harmony-premium-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/21-jabon-harmony-premium-milky/portada-estudio-3-fragancias-harmony-premium-hq.jpg",
    descripcion: "Jabón cremoso Harmony Premium Milky de 135 g (1 caja = 48 und) con extractos florales e hidratantes (Rosa Inglesa, Lavanda y Girasol).",
    variantes: [
      { code: "HAR-MIL-01", name: "Harmony Premium Milky English Rose 135 g", fragancia: "Rosa Inglesa 135g", img: "assets/img/catalogo-aprobado/21-jabon-harmony-premium-milky/variantes/estudio-pro-01-english-rose-800.jpg" },
      { code: "HAR-MIL-02", name: "Harmony Premium Milky Lavender 135 g", fragancia: "Lavanda 135g", img: "assets/img/catalogo-aprobado/21-jabon-harmony-premium-milky/variantes/estudio-pro-02-lavender-800.jpg" },
      { code: "HAR-MIL-03", name: "Harmony Premium Milky Sunflower 135 g", fragancia: "Girasol 135g", img: "assets/img/catalogo-aprobado/21-jabon-harmony-premium-milky/variantes/estudio-pro-03-sunflower-800.jpg" }
    ]
  },
  {
    id: "GRP-HAR-FRUITY",
    nombre: "Jabón Harmony Fruity",
    categoria: "Cuidado Personal",
    marca: "Harmony",
    unidades: 72,
    unidad: "und",
    empaqueDetalle: "1 cja = 72 und (pequeño fruit)",
    precioMenor: 22.80,
    precioMayor: 21.00,
    permiteUnidad: true,
    precioUnidad: 0.35,
    portada400: "assets/img/catalogo-aprobado/22-jabon-harmony-fruity/portada-estudio-6-fragancias-harmony-fruity-400.jpg",
    portada: "assets/img/catalogo-aprobado/22-jabon-harmony-fruity/portada-estudio-6-fragancias-harmony-fruity-800.jpg",
    portada800: "assets/img/catalogo-aprobado/22-jabon-harmony-fruity/portada-estudio-6-fragancias-harmony-fruity-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/22-jabon-harmony-fruity/portada-estudio-6-fragancias-harmony-fruity-hq.jpg",
    descripcion: "Jabón Harmony Pequeño Fruity (1 caja = 72 und) con extractos frutales (Agua de Coco, Fresa, Naranja, Limón, Manzana y Uva).",
    variantes: [
      { code: "HAR-FRU-01", name: "Harmony Fruity Coconut Water (Agua de Coco)", fragancia: "Agua de Coco", img: "assets/img/catalogo-aprobado/22-jabon-harmony-fruity/variantes/estudio-pro-01-coconut-water-800.jpg" },
      { code: "HAR-FRU-02", name: "Harmony Fruity Strawberry (Fresa)", fragancia: "Fresa (Strawberry)", img: "assets/img/catalogo-aprobado/22-jabon-harmony-fruity/variantes/estudio-pro-02-strawberry-800.jpg" },
      { code: "HAR-FRU-03", name: "Harmony Fruity Orange (Naranja)", fragancia: "Naranja (Orange)", img: "assets/img/catalogo-aprobado/22-jabon-harmony-fruity/variantes/estudio-pro-03-orange-800.jpg" },
      { code: "HAR-FRU-04", name: "Harmony Fruity Lemon (Limón)", fragancia: "Limón (Lemon)", img: "assets/img/catalogo-aprobado/22-jabon-harmony-fruity/variantes/estudio-pro-04-lemon-800.jpg" },
      { code: "HAR-FRU-05", name: "Harmony Fruity Apple (Manzana)", fragancia: "Manzana (Apple)", img: "assets/img/catalogo-aprobado/22-jabon-harmony-fruity/variantes/estudio-pro-05-apple-800.jpg" },
      { code: "HAR-FRU-06", name: "Harmony Fruity Grape (Uva)", fragancia: "Uva (Grape)", img: "assets/img/catalogo-aprobado/22-jabon-harmony-fruity/variantes/estudio-pro-06-grape-800.jpg" }
    ]
  },
  {
    id: "GRP-SKL-BANOS-DIST",
    nombre: "Baño de Crema Skala 1kg",
    categoria: "Cuidado Personal",
    marca: "Skala",
    unidades: 6,
    unidad: "potes de 1 kg",
    precioMenor: 25.50,
    precioMayor: 24.00,
    permiteUnidad: true,
    precioUnidad: 4.35,
    portada400: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/portada-estudio-16-banos-skala-400.jpg",
    portada: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/portada-estudio-16-banos-skala-800.jpg",
    portada800: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/portada-estudio-16-banos-skala-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/portada-estudio-16-banos-skala-hq.jpg",
    descripcion: "16 variedades oficiales de cremas de tratamiento Skala 1 kg disponibles para distribución mixta.",
    variantes: [
      { code: "BC-01", name: "Skala Babosa (Aloe Vera) 1 kg", fragancia: "Babosa (Aloe Vera)", img: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-01-800.jpg" },
      { code: "BC-02", name: "Skala Banana e Bacuri 1 kg", fragancia: "Banana e Bacuri", img: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-02-800.jpg" },
      { code: "BC-03", name: "Skala Divino Potão 1 kg", fragancia: "Divino Potão", img: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-03-800.jpg" },
      { code: "BC-04", name: "Skala Divino Potinho Kids 1 kg", fragancia: "Divino Potinho Kids", img: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-04-800.jpg" },
      { code: "BC-05", name: "Skala Dona Skala 1 kg", fragancia: "Dona Skala", img: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-05-800.jpg" },
      { code: "BC-06", name: "Skala Mais Cachos 1 kg", fragancia: "Mais Cachos", img: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-06-800.jpg" },
      { code: "BC-07", name: "Skala Mais Crespinhos 1 kg", fragancia: "Mais Crespinhos", img: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-07-800.jpg" },
      { code: "BC-08", name: "Skala Mais Crespos 1 kg", fragancia: "Mais Crespos", img: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-08-800.jpg" },
      { code: "BC-09", name: "Skala Mais Lisos 1 kg", fragancia: "Mais Lisos", img: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-09-800.jpg" },
      { code: "BC-10", name: "Skala Potão de Amor 1 kg", fragancia: "Potão de Amor", img: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-10-800.jpg" },
      { code: "BC-11", name: "Skala Potão Desmaiado 1 kg", fragancia: "Potão Desmaiado", img: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-11-800.jpg" },
      { code: "BC-12", name: "Skala #Mais Cachinhos 1 kg", fragancia: "#Mais Cachinhos", img: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-12-mais-cachinhos-800.jpg" },
      { code: "BC-13", name: "Skala Ceramidas G3 1 kg", fragancia: "Ceramidas G3", img: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-13-ceramidas-800.jpg" },
      { code: "BC-14", name: "Skala Amido de Milho 1 kg", fragancia: "Amido de Milho", img: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-14-amido-de-milho-800.jpg" },
      { code: "BC-15", name: "Skala Keratina Vegetal 1 kg", fragancia: "Keratina Vegetal", img: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-15-keratina-vegetal-800.jpg" },
      { code: "BC-16", name: "Skala Bomba de Vitaminas 1 kg", fragancia: "Bomba de Vitaminas", img: "assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-16-bomba-de-vitaminas-800.jpg" }
    ]
  },
  {
    id: "GRP-SKL-KITS-DIST",
    nombre: "Kits Skala Dúo",
    categoria: "Cuidado Personal",
    marca: "Skala",
    unidades: 6,
    unidad: "dúos",
    precioMenor: 29.00,
    precioMayor: 27.50,
    permiteUnidad: true,
    precioUnidad: 4.95,
    portada400: "assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/portada-estudio-8-kits-skala-400.jpg",
    portada: "assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/portada-estudio-8-kits-skala-800.jpg",
    portada800: "assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/portada-estudio-8-kits-skala-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/portada-estudio-8-kits-skala-hq.jpg",
    descripcion: "8 variedades de Kits Skala (Shampoo 325 ml + Acondicionador 325 ml).",
    variantes: [
      { code: "KT-01", name: "Kit Skala 12 em 1", fragancia: "12 em 1", img: "assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/variantes/estudio-pro-KT-01-800.jpg" },
      { code: "KT-02", name: "Kit Skala Aguacate", fragancia: "Aguacate", img: "assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/variantes/estudio-pro-KT-02-800.jpg" },
      { code: "KT-03", name: "Kit Skala Babosa", fragancia: "Babosa", img: "assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/variantes/estudio-pro-KT-03-800.jpg" },
      { code: "KT-04", name: "Kit Skala Bomba de Vitaminas S.O.S", fragancia: "Bomba de Vitaminas S.O.S", img: "assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/variantes/estudio-pro-KT-04-800.jpg" },
      { code: "KT-05", name: "Kit Skala Ceramidas", fragancia: "Ceramidas", img: "assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/variantes/estudio-pro-KT-05-800.jpg" },
      { code: "KT-06", name: "Kit Skala Crespo Divino", fragancia: "Crespo Divino", img: "assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/variantes/estudio-pro-KT-06-800.jpg" },
      { code: "KT-07", name: "Kit Skala Mais Crespinhos", fragancia: "Mais Crespinhos", img: "assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/variantes/estudio-pro-KT-07-800.jpg" },
      { code: "KT-08", name: "Kit Skala Mais Cachos", fragancia: "Mais Cachos", img: "assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/variantes/estudio-pro-KT-08-800.jpg" }
    ]
  },
  {
    id: "GRP-BF-PAN",
    nombre: "Pañales Baby Finger",
    categoria: "Bebé y Pañales",
    marca: "Baby Finger",
    unidades: 12,
    unidad: "paquetes",
    preciosDistintos: true,
    precioMenor: 25.20,
    precioMayor: 23.80,
    permiteUnidad: true,
    precioUnidad: 2.15,
    portada400: "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/portada-estudio-5-tallas-baby-finger-400.jpg",
    portada: "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/portada-estudio-5-tallas-baby-finger-800.jpg",
    portada800: "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/portada-estudio-5-tallas-baby-finger-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/portada-estudio-5-tallas-baby-finger-hq.jpg",
    descripcion: "Pañales ultra absorbentes Baby Finger por tallas (P, M, G, XG, XXG, XXXG) y Pañal Adulto Alive (M y XG). Todos los bultos llevan 12 paquetes y cada talla maneja distinto precio.",
    variantes: [
      { code: "BF-PAN-P10", name: "Baby Finger Talla P · 10 Unidades", fragancia: "Talla P (10 und)", precioMenor: 15.60, precioMayor: 14.40, precioUnidad: 1.35, img: "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-01-panal-baby-finger-talla-P-20und-800.jpg" },
      { code: "BF-PAN-P20", name: "Baby Finger Talla P · 20 Unidades", fragancia: "Talla P (20 und)", precioMenor: 25.20, precioMayor: 23.80, precioUnidad: 2.15, img: "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-01-panal-baby-finger-talla-P-20und-800.jpg" },
      { code: "BF-PAN-M18", name: "Baby Finger Talla M · 18 Unidades", fragancia: "Talla M (18 und)", precioMenor: 26.40, precioMayor: 24.80, precioUnidad: 2.25, img: "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-02-panal-baby-finger-talla-M-18und-800.jpg" },
      { code: "BF-PAN-G18", name: "Baby Finger Talla G · 18 Unidades", fragancia: "Talla G (18 und)", precioMenor: 27.60, precioMayor: 26.00, precioUnidad: 2.35, img: "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-03-panal-baby-finger-talla-G-18und-800.jpg" },
      { code: "BF-PAN-XG16", name: "Baby Finger Talla XG · 16 Unidades", fragancia: "Talla XG (16 und)", precioMenor: 28.80, precioMayor: 27.20, precioUnidad: 2.45, img: "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-04-panal-baby-finger-talla-XG-16und-800.jpg" },
      { code: "BF-PAN-XXG16", name: "Baby Finger Talla XXG · 16 Unidades", fragancia: "Talla XXG (16 und)", precioMenor: 30.00, precioMayor: 28.40, precioUnidad: 2.55, img: "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-05-panal-baby-finger-talla-XXG-16und-800.jpg" },
      { code: "BF-PAN-XXXG", name: "Baby Finger Talla XXXG · 14 Unidades", fragancia: "Talla XXXG (14 und)", precioMenor: 31.20, precioMayor: 29.60, precioUnidad: 2.65, img: "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-05-panal-baby-finger-talla-XXG-16und-800.jpg" },
      { code: "ALV-PAN-ADM", name: "Pañal Adulto Alive Talla M · 6 Unidades", fragancia: "Adulto M (6 und)", precioMenor: 33.60, precioMayor: 31.80, precioUnidad: 2.85, img: "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-06-panal-adulto-alive-talla-M-6und-800.jpg" },
      { code: "ALV-PAN-ADXG", name: "Pañal Adulto Alive Talla XG · 6 Unidades", fragancia: "Adulto XG (6 und)", precioMenor: 36.00, precioMayor: 34.00, precioUnidad: 3.05, img: "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-07-panal-adulto-alive-talla-XG-6und-800.jpg" }
    ]
  },
  {
    id: "GRP-BF-THU",
    nombre: "Toallas Húmedas Baby Finger",
    categoria: "Bebé y Pañales",
    marca: "Baby Finger",
    unidades: 24,
    unidad: "paquetes de 50 und",
    precioMenor: 21.60,
    precioMayor: 19.80,
    permiteUnidad: true,
    precioUnidad: 0.92,
    portada400: "assets/img/catalogo-aprobado/14-BF-THU-toallas-humedas-baby-finger/portada-estudio-3-colores-400.jpg",
    portada: "assets/img/catalogo-aprobado/14-BF-THU-toallas-humedas-baby-finger/portada-estudio-3-colores-800.jpg",
    portada800: "assets/img/catalogo-aprobado/14-BF-THU-toallas-humedas-baby-finger/portada-estudio-3-colores-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/14-BF-THU-toallas-humedas-baby-finger/portada-estudio-3-colores-hq.jpg",
    descripcion: "Toallitas húmedas hipoalergénicas sin alcohol en 3 presentaciones.",
    variantes: [
      { code: "BF-THU-01", name: "Toallas Húmedas Baby Finger Rosado × 50 und", fragancia: "Rosado (50 und)", img: "assets/img/catalogo-aprobado/14-BF-THU-toallas-humedas-baby-finger/variantes/estudio-pro-01-toallas-humedas-baby-finger-rosado-50und-800.jpg" },
      { code: "BF-THU-02", name: "Toallas Húmedas Baby Finger Celeste × 50 und", fragancia: "Celeste (50 und)", img: "assets/img/catalogo-aprobado/14-BF-THU-toallas-humedas-baby-finger/variantes/estudio-pro-02-toallas-humedas-baby-finger-celeste-50und-800.jpg" },
      { code: "BF-THU-03", name: "Toallas Húmedas Baby Finger Verde Aloe × 50 und", fragancia: "Verde Aloe (50 und)", img: "assets/img/catalogo-aprobado/14-BF-THU-toallas-humedas-baby-finger/variantes/estudio-pro-03-toallas-humedas-baby-finger-verde-50und-800.jpg" }
    ]
  },
  {
    id: "GRP-BF-CUI",
    nombre: "Cuidado Bebé Baby Finger",
    categoria: "Bebé y Pañales",
    marca: "Baby Finger",
    unidades: 12,
    unidad: "unidades",
    precioMenor: 19.20,
    precioMayor: 17.80,
    permiteUnidad: true,
    precioUnidad: 1.65,
    portada400: "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/portada-estudio-linea-completa-bebe-400.jpg",
    portada: "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/portada-estudio-linea-completa-bebe-800.jpg",
    portada800: "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/portada-estudio-linea-completa-bebe-800.jpg",
    portadaHq: "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/portada-estudio-linea-completa-bebe-hq.jpg",
    descripcion: "Shampoo, Colonia, Aceite, Jabón Líquido, Vaselina Petroleum, Loción y Talcos (200g y 100g) Baby Finger.",
    variantes: [
      { code: "BF-CUI-01", name: "Shampoo para Niños Baby Finger 200 ml", fragancia: "Shampoo Niños 200ml", img: "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/variantes/estudio-pro-01-shampoo-ninos-200ml-800.jpg" },
      { code: "BF-CUI-02", name: "Colonia para Niños Baby Finger 200 ml", fragancia: "Colonia Niños 200ml", img: "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/variantes/estudio-pro-02-colonia-ninos-200ml-800.jpg" },
      { code: "BF-CUI-03", name: "Aceite para Bebé Baby Finger 200 ml", fragancia: "Aceite Bebé 200ml", img: "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/variantes/estudio-pro-03-aceite-ninos-200ml-800.jpg" },
      { code: "BF-CUI-04", name: "Jabón Líquido para Bebé Baby Finger 200 ml", fragancia: "Jabón Líquido 200ml", img: "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/variantes/estudio-pro-04-jabon-liquido-ninos-200ml-800.jpg" },
      { code: "BF-CUI-05", name: "Petroleum Jelly para Bebé Baby Finger 35 g", fragancia: "Petroleum Bebé 35g", img: "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/variantes/estudio-pro-05-petroleum-bebe-35g-800.jpg" },
      { code: "BF-CUI-06", name: "Loción Hidratante para Bebé Baby Finger 200 ml", fragancia: "Loción Bebé 200ml", img: "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/variantes/estudio-pro-06-locion-ninos-200ml-800.jpg" },
      { code: "BF-CUI-07", name: "Talco para Bebé Baby Finger 200 g", fragancia: "Talco Bebé 200g", img: "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/variantes/estudio-pro-07-talco-ninos-200g-800.jpg" },
      { code: "BF-CUI-08", name: "Talco para Bebé Baby Finger 100 g", fragancia: "Talco Bebé 100g", img: "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/variantes/estudio-pro-08-talco-ninos-100g-800.jpg" }
    ]
  }
];

/* Mapa plano de todas las variantes para compatibilidad con crm-core.js y producto.js */
const BANOS = [];
const KITS = [];
GRUPOS_DISTRIBUIDORA.forEach((g) => {
  const portLevels = nivelesImagen(g.portada800 || g.portada);
  g.portada400 = g.portada400 || portLevels.img400;
  g.portada800 = g.portada800 || portLevels.img800;
  g.portadaHq = g.portadaHq || portLevels.imgHq;
  g.portada = g.portada800;

  g.variantes.forEach((v) => {
    const varLevels = nivelesImagen(v.img);
    v.img400 = varLevels.img400;
    v.img800 = varLevels.img800;
    v.imgHq = varLevels.imgHq;
    v.img = varLevels.img800;

    const pMenor = Number(v.precioMenor) > 0 ? Number(v.precioMenor) : g.precioMenor;
    const pMayor = Number(v.precioMayor) > 0 ? Number(v.precioMayor) : g.precioMayor;
    const pUnidad = Number(v.precioUnidad) > 0 ? Number(v.precioUnidad) : g.precioUnidad;

    const item = {
      code: v.code,
      name: v.name,
      fragancia: v.fragancia,
      line: g.categoria,
      marca: g.marca || "Alive",
      benefit: g.descripcion || "",
      hair: "1A–4C",
      grupoId: g.id,
      grupoNombre: g.nombre,
      unidades: g.unidades,
      unidad: g.unidad,
      preciosDistintos: Boolean(g.preciosDistintos),
      img400: v.img400,
      img800: v.img800,
      imgHq: v.imgHq,
      precioMenor: pMenor,
      precioMayor: pMayor,
      precioUnidad: pUnidad,
      permiteUnidad: g.permiteUnidad,
      precioMenorDefault: pMenor,
      precioMayorDefault: pMayor,
      precioUnidadDefault: pUnidad,
      permiteUnidadDefault: g.permiteUnidad,
      tipo: g.id === "GRP-SKL-KITS-DIST" ? "kits" : "banos",
    };
    BANOS.push(item);
  });
});

function allProductsMap() {
  const m = {};
  [...BANOS, ...KITS].forEach((p) => {
    m[p.code] = p;
    if (/^(BC|KT)-\d+$/.test(p.code)) {
      Object.defineProperty(m, "DIST-" + p.code, { value: p, enumerable: false, configurable: true });
    }
  });
  return m;
}

function sumarProductosNuevos(productos) {
  const map = allProductsMap();
  let cambio = false;
  (productos || []).forEach((x) => {
    const i = x && x.info;
    if (!i || !x.code) return;
    const lista = i.tipo === "kits" ? KITS : BANOS;
    const prev = map[x.code];
    const p = prev || { code: x.code, nuevo: true };
    const datos = {
      name: i.nombre || x.code,
      line: i.linea || (i.tipo === "kits" ? "Kits" : "Nuevo"),
      benefit: i.beneficio || "",
      hair: i.cabello || "1A–4C",
      unidades: Number(i.unidades) || 6,
      unidad: i.tipo === "kits" ? "dúos" : "unidades",
      foto: i.imagen || "",
    };
    if (!prev || Object.keys(datos).some((k) => p[k] !== datos[k])) { Object.assign(p, datos); cambio = true; }
    if (!prev) lista.push(p);
  });
  return cambio;
}

function fotoVacia(nombre) {
  const t = String(nombre || "").replace(/[<&>"']/g, "");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='#ffffff'/>
    <text x='50%' y='46%' font-family='Arial' font-size='28' font-weight='bold' fill='#003882' text-anchor='middle'>${t}</text>
    <text x='50%' y='60%' font-family='Arial' font-size='18' fill='#4a6158' text-anchor='middle'>Distribuciones Ontiveros</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/* Regla de los 3 niveles de resolución (4:3 sobre #FFFFFF):
   - grande === false (inventario, carrito, miniaturas): src="-400.jpg" srcset="-400.jpg 1x, -800.jpg 2x"
   - grande === true (tarjetas del catálogo / vista previa): src="-800.jpg" srcset="-800.jpg 1x, -hq.jpg 2x" */
function fotoHTML(code, { ancho = 64, alto = 48, alt = "", grande = false, carga = 'loading="lazy"' } = {}) {
  const p = allProductsMap()[code] || {};
  const usar800 = grande || ancho > 400;
  const src = (usar800 ? (p.img800 || p.img400) : (p.img400 || p.img800)) || p.foto || fotoVacia(p.name || code);
  const src2x = usar800 ? (p.imgHq || p.img800) : (p.img800 || p.img400);
  const srcsetAttr = src2x && src2x !== src ? ` srcset="${src} 1x, ${src2x} 2x"` : "";
  return `<picture><img src="${src}"${srcsetAttr} alt="${alt}" width="${ancho}" height="${alto}" ${carga} decoding="async" /></picture>`;
}

/* Visor de zoom / lightbox y catálogos imprimibles: devuelve -hq.jpg (1200x900 Q95) */
function fotoGrande(code) {
  const p = allProductsMap()[code] || {};
  return p.imgHq || p.img800 || p.img400 || p.foto || fotoVacia(p.name || code);
}
