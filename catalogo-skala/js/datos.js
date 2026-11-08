/* ============================================================
   Skala Venezuela & Distribuciones Ontiveros — Datos de productos
   Banco Oficial de Imágenes de Estudio 4:3 (#FFFFFF) en 3 Resoluciones (-400, -800, -hq)
   Requiere js/producto.js (UNIDADES_POR_CAJA_BANO, DUOS_POR_CAJA_KIT).
   ============================================================ */

function nivelesImagenEstudio(rutaBase) {
  const base = String(rutaBase || "").replace(/-(400|800|hq)\.jpg$/i, "");
  return {
    img400: `${base}-400.jpg`,
    img800: `${base}-800.jpg`,
    imgHq: `${base}-hq.jpg`,
  };
}

const PORTADAS_ESTUDIO_SKALA = {
  banos: nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/portada-estudio-16-banos-skala-800.jpg"),
  banosNuevos: nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/portada-estudio-5-nuevos-almacen-800.jpg"),
  kits: nivelesImagenEstudio("assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/portada-estudio-8-kits-skala-800.jpg"),
};

/* 16 Baños de Crema Skala 1 kg (BC-01..BC-11 + 5 nuevas variedades BC-12..BC-16) */
const BANOS = [
  { code: "BC-01", name: "Babosa", line: "Hidratación", benefit: "Hidratación profunda con aloe vera. Suavidad y brillo.", hair: "1A–4C", stock: 100, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-01-800.jpg") },
  { code: "BC-02", name: "Banana e Macuri", line: "Nutrición", benefit: "Nutrición intensa. Cabello más sano y manejable.", hair: "1A–4C", stock: 100, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-02-800.jpg") },
  { code: "BC-03", name: "Divino Potao", line: "Hidratación", benefit: "Hidratación y nutrición diaria para todo tipo de cabello.", hair: "1A–4C", stock: 100, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-03-800.jpg") },
  { code: "BC-04", name: "Divino Potinho Kids", line: "Kids", benefit: "Fórmula suave pensada para el cabello de los niños.", hair: "1A–3C", stock: 100, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-04-800.jpg") },
  { code: "BC-05", name: "Dona Skala", line: "Hidratación", benefit: "Línea premium. Cuidado intensivo y acabado profesional.", hair: "1A–4C", stock: 200, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-05-800.jpg") },
  { code: "BC-06", name: "Mais Cachos", line: "Definición", benefit: "Define y controla los rizos. Hidratación y definición.", hair: "3A–4C", stock: 600, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-06-800.jpg") },
  { code: "BC-07", name: "Mais Crespinhos", line: "Definición", benefit: "Definición suave para rizos y cabello crespo. Menos frizz.", hair: "3A–4C", stock: 300, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-07-800.jpg") },
  { code: "BC-08", name: "Mais Crespos", line: "Definición", benefit: "Máxima definición y volumen para cabello crespo.", hair: "4A–4C", stock: 50, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-08-800.jpg") },
  { code: "BC-09", name: "Mais Lisos", line: "Hidratación", benefit: "Control y suavidad para cabello liso, sin encresparse.", hair: "1A–2C", stock: 200, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-09-800.jpg") },
  { code: "BC-10", name: "Potao de Amor", line: "Nutrición", benefit: "Nutrición que abraza. Cabello nutrido y brillante.", hair: "1A–4C", stock: 300, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-10-800.jpg") },
  { code: "BC-11", name: "Potao Despaiado", line: "Nutrición", benefit: "Nutrición intensa para cabello desmayado y sin vida.", hair: "1A–4C", stock: 200, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-11-800.jpg") },
  { code: "BC-12", name: "#Mais Cachinhos", line: "Kids", benefit: "Definición y cuidado suave para los rizos de los niños.", hair: "3A–4C", stock: 150, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-12-mais-cachinhos-800.jpg") },
  { code: "BC-13", name: "Ceramidas G3", line: "Reconstrucción", benefit: "Brillo y sellado de cutículas con ceramidas vegetales G3.", hair: "1A–4C", stock: 150, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-13-ceramidas-800.jpg") },
  { code: "BC-14", name: "Amido de Milho", line: "Nutrición", benefit: "Ultra reparación, fuerza y brillo 2 en 1 con almidón de maíz.", hair: "1A–4C", stock: 150, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-14-amido-de-milho-800.jpg") },
  { code: "BC-15", name: "Keratina Vegetal", line: "Reconstrucción", benefit: "Reconstrucción profunda y vitalidad para cabellos dañados.", hair: "1A–4C", stock: 150, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-15-keratina-vegetal-800.jpg") },
  { code: "BC-16", name: "Bomba de Vitaminas", line: "Nutrición", benefit: "Nutrición e hidratación con aguacate, aloe vera y D-pantenol.", hair: "1A–4C", stock: 150, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/16-SKL-BANOS-1kg-x6/variantes/estudio-pro-BC-16-bomba-de-vitaminas-800.jpg") },
];

/* 8 Kits Skala Shampoo + Acondicionador (KT-01..KT-08) */
const KITS = [
  { code: "KT-01", name: "Kit 12 em 1", line: "Completo", benefit: "Shampoo + acondicionador multiuso, todo en uno.", hair: "1A–4C", stock: 40, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/variantes/estudio-pro-KT-01-800.jpg") },
  { code: "KT-02", name: "Kit Aguacate", line: "Nutrición", benefit: "Nutrición con aguacate. Cabello suave y manejable.", hair: "1A–4C", stock: 40, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/variantes/estudio-pro-KT-02-800.jpg") },
  { code: "KT-03", name: "Kit Babosa", line: "Hidratación", benefit: "Hidratación con aloe vera para el día a día.", hair: "1A–4C", stock: 10, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/variantes/estudio-pro-KT-03-800.jpg") },
  { code: "KT-04", name: "Kit Bomba de Vitaminas S.O.S", line: "Reconstrucción", benefit: "Reposición de vitaminas. Cabello debilitado y quebradizo.", hair: "1A–4C", stock: 60, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/variantes/estudio-pro-KT-04-800.jpg") },
  { code: "KT-05", name: "Kit Ceramidas", line: "Reconstrucción", benefit: "Repara la fibra capilar con ceramidas.", hair: "1A–4C", stock: 40, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/variantes/estudio-pro-KT-05-800.jpg") },
  { code: "KT-06", name: "Kit Crespo Divino", line: "Definición", benefit: "Definición y nutrición para cabello crespo.", hair: "3A–4C", stock: 40, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/variantes/estudio-pro-KT-06-800.jpg") },
  { code: "KT-07", name: "Kit Mais Crespinhos", line: "Definición", benefit: "Definición suave para rizos y cabello crespo.", hair: "3A–4C", stock: 10, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/variantes/estudio-pro-KT-07-800.jpg") },
  { code: "KT-08", name: "Kit Mais Cachos", line: "Definición", benefit: "Define y controla los rizos.", hair: "3A–4C", stock: 10, ...nivelesImagenEstudio("assets/img/catalogo-aprobado/17-SKL-KITS-shampoo-acondicionador-x6/variantes/estudio-pro-KT-08-800.jpg") },
];

/* Contenido por caja (ver js/producto.js).
   - Baños de crema: 6 unidades de 1 kg.
   - Kits: 6 dúos (shampoo + acondicionador). */
BANOS.forEach((p) => { p.unidades = UNIDADES_POR_CAJA_BANO; p.unidad = "unidades"; });
KITS.forEach((p) => { p.unidades = DUOS_POR_CAJA_KIT; p.unidad = "dúos"; });

/* Productos compartidos de Distribuciones Ontiveros en la misma base Supabase
   con sus rutas de estudio-pro (-400, -800, -hq) desde catalogo-aprobado */
const PRODUCTOS_COMPARTIDOS_ONTIVEROS = [
  ["ALV-DET1K-01", "Blanco Perla Blanqueador 1 kg", 12, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-01-blanco-perla-blanqueador-1kg-800.jpg"],
  ["ALV-DET1K-02", "Morado Floral 1 kg", 12, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-02-morado-floral-1kg-800.jpg"],
  ["ALV-DET1K-03", "Rosado con Suavizante 1 kg", 12, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-03-rosado-con-suavizante-1kg-800.jpg"],
  ["ALV-DET1K-04", "Verde Limón 1 kg", 12, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-04-verde-limon-1kg-800.jpg"],
  ["ALV-DET1K-05", "Azul Todo Tipo de Ropa 1 kg", 12, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-05-azul-todo-tipo-ropa-1kg-800.jpg"],
  ["ALV-DET1K-06", "Rosa Fragancia Bebé 1 kg", 12, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-06-rosa-fragancia-bebe-1kg-800.jpg"],
  ["ALV-DET1K-07", "Azul Fragancia Bebé 1 kg", 12, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-07-azul-fragancia-bebe-1kg-800.jpg"],
  ["AZ-DET-01", "A-Z Azul Naranja Todo Tipo de Ropa 1 kg", 12, "unidades", "Detergentes", "assets/img/catalogo-aprobado/02-AZ-DET-detergente-az/variantes/estudio-pro-01-azul-naranja-todo-tipo-1kg-800.jpg"],
  ["AZ-DET-02", "A-Z Rosado Ultra Floral 1 kg", 12, "unidades", "Detergentes", "assets/img/catalogo-aprobado/02-AZ-DET-detergente-az/variantes/estudio-pro-02-rosado-ultra-floral-1kg-800.jpg"],
  ["ALV-DET500-01", "Blanco Perla Blanqueador 500 g", 24, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-01-blanco-perla-blanqueador-1kg-800.jpg"],
  ["ALV-DET500-02", "Morado Floral 500 g", 24, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-02-morado-floral-1kg-800.jpg"],
  ["ALV-DET500-03", "Rosado con Suavizante 500 g", 24, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-03-rosado-con-suavizante-1kg-800.jpg"],
  ["ALV-DET500-04", "Verde Limón 500 g", 24, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-04-verde-limon-1kg-800.jpg"],
  ["ALV-DET500-05", "Azul Todo Tipo de Ropa 500 g", 24, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-05-azul-todo-tipo-ropa-1kg-800.jpg"],
  ["ALV-DET500-06", "Rosa Fragancia Bebé 400 g", 24, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-06-rosa-fragancia-bebe-1kg-800.jpg"],
  ["ALV-DET500-07", "Rosado con Suavizante 200 g", 24, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-03-rosado-con-suavizante-1kg-800.jpg"],
  ["ALV-PAN-01", "Panela Alive Lavanda 150 g", 36, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-panela-01-lavanda-150g-800.jpg"],
  ["ALV-PAN-02", "Panela Alive Limón 150 g", 36, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-panela-02-limon-150g-800.jpg"],
  ["ALV-PAN-03", "Panela Alive con Suavizante 150 g", 36, "unidades", "Detergentes", "assets/img/catalogo-aprobado/01-ALV-DET-detergente-alive/variantes/estudio-pro-panela-03-suavizante-150g-800.jpg"],
  ["JAB-POP-01", "Jabón Popular en Barra", 36, "barras", "Detergentes", "assets/img/catalogo-aprobado/20-jabon-popular/variantes/estudio-pro-01-jabon-popular-barra-800.jpg"],
  ["ALV-LAV-01", "Aliclean Azul Limón Amarillo 350 ml", 24, "envases de 350 ml", "Detergentes", "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/variantes/estudio-pro-01-azul-limon-amarillo-350ml-800.jpg"],
  ["ALV-LAV-02", "Aliclean Naranja Mandarina 350 ml", 24, "envases de 350 ml", "Detergentes", "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/variantes/estudio-pro-02-naranja-mandarina-350ml-800.jpg"],
  ["ALV-LAV-03", "Aliclean Verde Limón 350 ml", 24, "envases de 350 ml", "Detergentes", "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/variantes/estudio-pro-03-verde-limon-350ml-800.jpg"],
  ["ALV-LAV-04", "Aliclean Azul Limón Amarillo 750 ml", 12, "envases de 750 ml", "Detergentes", "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/variantes/estudio-pro-04-azul-limon-amarillo-750ml-800.jpg"],
  ["ALV-LAV-05", "Aliclean Verde Limón 750 ml", 12, "envases de 750 ml", "Detergentes", "assets/img/catalogo-aprobado/05-ALV-LAV-lavaplatos-aliclean/variantes/estudio-pro-05-verde-limon-750ml-800.jpg"],
  ["ALV-SUA-01", "Suavizante Alive Celeste Fresca Primavera", 12, "unidades", "Suavizantes", "assets/img/catalogo-aprobado/06-ALV-SUA-suavizante-alive/variantes/estudio-pro-01-celeste-fresca-primavera-500ml-800.jpg"],
  ["ALV-SUA-02", "Suavizante Alive Verde Manzana", 12, "unidades", "Suavizantes", "assets/img/catalogo-aprobado/06-ALV-SUA-suavizante-alive/variantes/estudio-pro-02-verde-manzana-500ml-800.jpg"],
  ["ALV-SUA-03", "Suavizante Alive Rosado Floral", 12, "unidades", "Suavizantes", "assets/img/catalogo-aprobado/06-ALV-SUA-suavizante-alive/variantes/estudio-pro-03-rosado-floral-500ml-800.jpg"],
  ["ALV-SUA-04", "Suavizante Alive Celeste Bebé", 12, "unidades", "Suavizantes", "assets/img/catalogo-aprobado/06-ALV-SUA-suavizante-alive/variantes/estudio-pro-04-celeste-bebe-500ml-800.jpg"],
  ["ALV-SUA-05", "Suavizante Alive Morado Lavanda", 12, "unidades", "Suavizantes", "assets/img/catalogo-aprobado/06-ALV-SUA-suavizante-alive/variantes/estudio-pro-05-morado-lavanda-500ml-800.jpg"],
  ["ALV-SUA-06", "Suavizante Alive Rojo Fresa y Chocolate", 12, "unidades", "Suavizantes", "assets/img/catalogo-aprobado/06-ALV-SUA-suavizante-alive/variantes/estudio-pro-06-rojo-fresa-chocolate-500ml-800.jpg"],
  ["ALV-CAP-01", "Baño de Crema Alive Aceite de Oliva 400 g", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/10-ALV-CAP-tratamiento-capilar-alive/variantes/estudio-pro-01-bano-crema-alive-oliva-400g-800.jpg"],
  ["ALV-CAP-02", "Baño de Crema Alive Aceite de Argán 400 g", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/10-ALV-CAP-tratamiento-capilar-alive/variantes/estudio-pro-02-bano-crema-alive-argan-400g-800.jpg"],
  ["ALV-CAP-03", "Baño de Crema Alive Antifrizz Keratina 400 g", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/10-ALV-CAP-tratamiento-capilar-alive/variantes/estudio-pro-03-bano-crema-alive-keratina-400g-800.jpg"],
  ["ALV-LOC-01", "Loción Alive Lila Beso Granada 400 ml", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/11-ALV-LOC-locion-y-fragancias-alive/variantes/estudio-pro-01-locion-alive-beso-granada-400ml-800.jpg"],
  ["ALV-LOC-02", "Loción Alive Rojo Flor de la Pasión 400 ml", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/11-ALV-LOC-locion-y-fragancias-alive/variantes/estudio-pro-02-locion-alive-flor-pasion-400ml-800.jpg"],
  ["ALV-LOC-03", "Loción Alive Verde Coco Tropical 400 ml", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/11-ALV-LOC-locion-y-fragancias-alive/variantes/estudio-pro-03-locion-alive-coco-tropical-400ml-800.jpg"],
  ["ALV-LOC-04", "Loción Alive Dorado Flor de Vainilla 400 ml", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/11-ALV-LOC-locion-y-fragancias-alive/variantes/estudio-pro-04-locion-alive-flor-vainilla-400ml-800.jpg"],
  ["ALV-SHA350-01", "Shampoo 2en1 Azul Todo Tipo de Cabello 350 ml", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-05-shampoo-350ml-2en1-azul-todo-tipo-800.jpg"],
  ["ALV-SHA350-02", "Shampoo 2en1 Morado Cabello Graso 350 ml", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-06-shampoo-350ml-2en1-morado-cabello-graso-800.jpg"],
  ["ALV-SHA350-03", "Shampoo 2en1 Rojo Cabello Seco 350 ml", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-07-shampoo-350ml-2en1-rojo-cabello-seco-800.jpg"],
  ["ALV-SHA350-04", "Shampoo 2en1 Fucsia Cabello Normal 350 ml", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-08-shampoo-350ml-2en1-fucsia-cabello-normal-800.jpg"],
  ["ALV-SHA350-05", "Shampoo Gold Verde Refrescante 350 ml", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-09-shampoo-350ml-gold-verde-refrescante-800.jpg"],
  ["ALV-SHA350-06", "Shampoo Gold Amarillo Brillo 350 ml", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-10-shampoo-350ml-gold-amarillo-brillo-800.jpg"],
  ["ALV-SHA350-07", "Shampoo Gold Azul Anticaspa 350 ml", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-11-shampoo-350ml-gold-azul-anticaspa-800.jpg"],
  ["ALV-SHA250-01", "Shampoo Alive Verde Flor de Manzana 250 ml", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-01-shampoo-250ml-verde-flor-manzana-800.jpg"],
  ["ALV-SHA250-02", "Shampoo Alive Naranja Coco Tropical 250 ml", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-02-shampoo-250ml-naranja-coco-tropical-800.jpg"],
  ["ALV-SHA250-03", "Shampoo Alive Rosado Beso de Granada 250 ml", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-03-shampoo-250ml-rosado-beso-granada-800.jpg"],
  ["ALV-SHA250-04", "Shampoo Alive Morado Flor de la Pasión 250 ml", 12, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/12-ALV-SHA-shampoo-y-acondicionador-alive/variantes/estudio-pro-04-shampoo-250ml-morado-flor-pasion-800.jpg"],
  ["ALV-DEN-01", "Alident Ultra Fresh Roja 100 g", 8, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-01-ultra-fresh-roja-100g-800.jpg"],
  ["ALV-DEN-02", "Alident Gel Verde Aliento Fresco 100 g", 8, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-02-gel-verde-aliento-fresco-100g-800.jpg"],
  ["ALV-DEN-03", "Alident Fresh Mint Menta Suave 100 g", 8, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-03-fresh-mint-menta-suave-100g-800.jpg"],
  ["ALV-DEN-04", "Alident Gel Azul Ice Cool Mint 100 g", 8, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-04-gel-azul-ice-cool-mint-100g-800.jpg"],
  ["ALV-DEN-05", "Alident Extra Blancura Triple Acción Verde 100 g", 8, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-05-extra-blancura-triple-accion-verde-100g-800.jpg"],
  ["ALV-DEN-06", "Alident Triple Action Roja 100 g", 8, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-06-triple-action-roja-100g-800.jpg"],
  ["ALV-DEN-07", "Alident Pro-White Blanqueador 100 g", 8, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-07-pro-white-blanqueador-100g-800.jpg"],
  ["ALV-DEN-08", "Alident Sensitive Uso Diario 100 g", 8, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-08-sensitive-uso-diario-100g-800.jpg"],
  ["ALV-DEN-09", "Alident Kids Niño 100 g", 8, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-09-kids-nino-100g-800.jpg"],
  ["ALV-DEN-10", "Alident Kids Niña 100 g", 8, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-10-kids-nina-100g-800.jpg"],
  ["ALV-DEN75-01", "Alident Ultra Fresh Roja 75 g", 10, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-01-ultra-fresh-roja-100g-800.jpg"],
  ["ALV-DEN75-02", "Alident Gel Verde Aliento Fresco 75 g", 10, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-02-gel-verde-aliento-fresco-100g-800.jpg"],
  ["ALV-DEN75-03", "Alident Fresh Mint Menta Suave 75 g", 10, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-03-fresh-mint-menta-suave-100g-800.jpg"],
  ["ALV-DEN75-04", "Alident Gel Azul Ice Cool Mint 75 g", 10, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-04-gel-azul-ice-cool-mint-100g-800.jpg"],
  ["ALV-DEN75-05", "Alident Extra Blancura Triple Acción Verde 75 g", 10, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-05-extra-blancura-triple-accion-verde-100g-800.jpg"],
  ["ALV-DEN75-06", "Alident Triple Action Roja 75 g", 10, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-06-triple-action-roja-100g-800.jpg"],
  ["ALV-DEN75-07", "Alident Pro-White Blanqueador 75 g", 10, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-07-pro-white-blanqueador-100g-800.jpg"],
  ["ALV-DEN75-08", "Alident Sensitive Uso Diario 75 g", 10, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-08-sensitive-uso-diario-100g-800.jpg"],
  ["ALV-DEN75-09", "Alident Kids Niño 75 g", 10, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-09-kids-nino-100g-800.jpg"],
  ["ALV-DEN75-10", "Alident Kids Niña 75 g", 10, "blísters ×12 und", "Cuidado Personal", "assets/img/catalogo-aprobado/03-ALV-DEN-crema-dental-alident/variantes/estudio-pro-10-kids-nina-100g-800.jpg"],
  ["ALV-JAB-01", "Anita Dorado Avena (Oats) 125 g", 72, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/04-ALV-JAB-jabon-bano-anita-125g/variantes/estudio-pro-01-dorado-avena-oats-125g-800.jpg"],
  ["ALV-JAB-02", "Anita Rosado Extracto de Perla 125 g", 72, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/04-ALV-JAB-jabon-bano-anita-125g/variantes/estudio-pro-02-rosado-pearl-extract-125g-800.jpg"],
  ["ALV-JAB-03", "Anita Celeste Extracto de Aguacate 125 g", 72, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/04-ALV-JAB-jabon-bano-anita-125g/variantes/estudio-pro-03-celeste-avocado-extract-125g-800.jpg"],
  ["ALV-JAB-03B", "Anita Turquesa Aguacate Hoja 125 g", 72, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/04-ALV-JAB-jabon-bano-anita-125g/variantes/estudio-pro-03b-turquesa-avocado-extract-hoja-125g-800.jpg"],
  ["ALV-JAB-04", "Anita Morado Extracto de Almendra 125 g", 72, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/04-ALV-JAB-jabon-bano-anita-125g/variantes/estudio-pro-04-morado-almond-extract-125g-800.jpg"],
  ["ALV-JAB-05", "Anita Verde Extracto de Pepino 125 g", 72, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/04-ALV-JAB-jabon-bano-anita-125g/variantes/estudio-pro-05-verde-pepino-cucumber-extract-125g-800.jpg"],
  ["HAR-MIL-01", "Harmony Premium Milky English Rose 135 g", 48, "und de 135 g", "Cuidado Personal", "assets/img/catalogo-aprobado/21-jabon-harmony-premium-milky/variantes/estudio-pro-01-english-rose-800.jpg"],
  ["HAR-MIL-02", "Harmony Premium Milky Lavender 135 g", 48, "und de 135 g", "Cuidado Personal", "assets/img/catalogo-aprobado/21-jabon-harmony-premium-milky/variantes/estudio-pro-02-lavender-800.jpg"],
  ["HAR-MIL-03", "Harmony Premium Milky Sunflower 135 g", 48, "und de 135 g", "Cuidado Personal", "assets/img/catalogo-aprobado/21-jabon-harmony-premium-milky/variantes/estudio-pro-03-sunflower-800.jpg"],
  ["HAR-FRU-01", "Harmony Fruity Coconut Water (Agua de Coco)", 72, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/22-jabon-harmony-fruity/variantes/estudio-pro-01-coconut-water-800.jpg"],
  ["HAR-FRU-02", "Harmony Fruity Strawberry (Fresa)", 72, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/22-jabon-harmony-fruity/variantes/estudio-pro-02-strawberry-800.jpg"],
  ["HAR-FRU-03", "Harmony Fruity Orange (Naranja)", 72, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/22-jabon-harmony-fruity/variantes/estudio-pro-03-orange-800.jpg"],
  ["HAR-FRU-04", "Harmony Fruity Lemon (Limón)", 72, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/22-jabon-harmony-fruity/variantes/estudio-pro-04-lemon-800.jpg"],
  ["HAR-FRU-05", "Harmony Fruity Apple (Manzana)", 72, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/22-jabon-harmony-fruity/variantes/estudio-pro-05-apple-800.jpg"],
  ["HAR-FRU-06", "Harmony Fruity Grape (Uva)", 72, "unidades", "Cuidado Personal", "assets/img/catalogo-aprobado/22-jabon-harmony-fruity/variantes/estudio-pro-06-grape-800.jpg"],
  ["ALV-TOAFEM-01", "Toallas Alive Regular Día con Alas 245 mm", 72, "paquetes", "Cuidado Personal", "assets/img/catalogo-aprobado/07-ALV-TOA-toallas-femeninas-y-protectores/variantes/estudio-pro-01-alive-regular-dia-245mm-800.jpg"],
  ["ALV-TOAFEM-02", "Toallas Alive Nocturna Noche 290 mm", 72, "paquetes", "Cuidado Personal", "assets/img/catalogo-aprobado/07-ALV-TOA-toallas-femeninas-y-protectores/variantes/estudio-pro-02-alive-nocturna-noche-290mm-800.jpg"],
  ["ALV-TOAFEM-03", "Toallas Alive Extra Larga 340 mm", 72, "paquetes", "Cuidado Personal", "assets/img/catalogo-aprobado/07-ALV-TOA-toallas-femeninas-y-protectores/variantes/estudio-pro-03-alive-extra-larga-340mm-800.jpg"],
  ["ALV-TOAFEM-04", "Protectores Diarios Alive × 20 Unidades", 72, "paquetes", "Cuidado Personal", "assets/img/catalogo-aprobado/07-ALV-TOA-toallas-femeninas-y-protectores/variantes/estudio-pro-04-alive-protector-diario-x20-800.jpg"],
  ["BF-PAN-P20", "Baby Finger Talla P · 20 Unidades", 12, "paquetes", "Bebé y Pañales", "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-01-panal-baby-finger-talla-P-20und-800.jpg"],
  ["BF-PAN-M18", "Baby Finger Talla M · 18 Unidades", 12, "paquetes", "Bebé y Pañales", "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-02-panal-baby-finger-talla-M-18und-800.jpg"],
  ["BF-PAN-G18", "Baby Finger Talla G · 18 Unidades", 12, "paquetes", "Bebé y Pañales", "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-03-panal-baby-finger-talla-G-18und-800.jpg"],
  ["BF-PAN-XG16", "Baby Finger Talla XG · 16 Unidades", 12, "paquetes", "Bebé y Pañales", "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-04-panal-baby-finger-talla-XG-16und-800.jpg"],
  ["BF-PAN-XXG16", "Baby Finger Talla XXG · 16 Unidades", 12, "paquetes", "Bebé y Pañales", "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-05-panal-baby-finger-talla-XXG-16und-800.jpg"],
  ["BF-PAN-XXXG", "Baby Finger Talla XXXG · 14 Unidades", 12, "paquetes", "Bebé y Pañales", "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-05-panal-baby-finger-talla-XXG-16und-800.jpg"],
  ["ALV-PAN-ADM", "Pañal Adulto Alive Talla M · 6 Unidades", 12, "paquetes", "Bebé y Pañales", "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-06-panal-adulto-alive-talla-M-6und-800.jpg"],
  ["ALV-PAN-ADXG", "Pañal Adulto Alive Talla XG · 6 Unidades", 12, "paquetes", "Bebé y Pañales", "assets/img/catalogo-aprobado/13-BF-PAN-panales-baby-finger/variantes/estudio-pro-07-panal-adulto-alive-talla-XG-6und-800.jpg"],
  ["BF-THU-01", "Toallas Húmedas Baby Finger Rosado × 50 und", 24, "paquetes", "Bebé y Pañales", "assets/img/catalogo-aprobado/14-BF-THU-toallas-humedas-baby-finger/variantes/estudio-pro-01-toallas-humedas-baby-finger-rosado-50und-800.jpg"],
  ["BF-THU-02", "Toallas Húmedas Baby Finger Celeste × 50 und", 24, "paquetes", "Bebé y Pañales", "assets/img/catalogo-aprobado/14-BF-THU-toallas-humedas-baby-finger/variantes/estudio-pro-02-toallas-humedas-baby-finger-celeste-50und-800.jpg"],
  ["BF-THU-03", "Toallas Húmedas Baby Finger Verde Aloe × 50 und", 24, "paquetes", "Bebé y Pañales", "assets/img/catalogo-aprobado/14-BF-THU-toallas-humedas-baby-finger/variantes/estudio-pro-03-toallas-humedas-baby-finger-verde-50und-800.jpg"],
  ["BF-CUI-01", "Shampoo para Niños Baby Finger 200 ml", 12, "unidades", "Bebé y Pañales", "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/variantes/estudio-pro-01-shampoo-ninos-200ml-800.jpg"],
  ["BF-CUI-02", "Colonia para Niños Baby Finger 200 ml", 12, "unidades", "Bebé y Pañales", "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/variantes/estudio-pro-02-colonia-ninos-200ml-800.jpg"],
  ["BF-CUI-03", "Aceite para Bebé Baby Finger 200 ml", 12, "unidades", "Bebé y Pañales", "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/variantes/estudio-pro-03-aceite-ninos-200ml-800.jpg"],
  ["BF-CUI-04", "Jabón Líquido para Bebé Baby Finger 200 ml", 12, "unidades", "Bebé y Pañales", "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/variantes/estudio-pro-04-jabon-liquido-ninos-200ml-800.jpg"],
  ["BF-CUI-05", "Petroleum Jelly para Bebé Baby Finger 35 g", 12, "unidades", "Bebé y Pañales", "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/variantes/estudio-pro-05-petroleum-bebe-35g-800.jpg"],
  ["BF-CUI-06", "Loción Hidratante para Bebé Baby Finger 200 ml", 12, "unidades", "Bebé y Pañales", "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/variantes/estudio-pro-06-locion-ninos-200ml-800.jpg"],
  ["BF-CUI-07", "Talco para Bebé Baby Finger 200 g", 12, "unidades", "Bebé y Pañales", "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/variantes/estudio-pro-07-talco-ninos-200g-800.jpg"],
  ["BF-CUI-08", "Talco para Bebé Baby Finger 100 g", 12, "unidades", "Bebé y Pañales", "assets/img/catalogo-aprobado/15-BF-CUI-cuidado-bebe-baby-finger/variantes/estudio-pro-08-talco-ninos-100g-800.jpg"],
  ["ALV-PAP-01", "Alisoft Rosado 215 Hojas × 4 Rollos", 12, "paquetes de 4 rollos", "Hogar y Papel", "assets/img/catalogo-aprobado/08-ALV-PAP-papel-alisoft/variantes/estudio-pro-01-alisoft-rosado-215-hojas-x4-800.jpg"],
  ["ALV-PAP-02", "Alisoft Dorado Comfort Plus 300 Hojas × 4 Rollos", 12, "paquetes de 4 rollos", "Hogar y Papel", "assets/img/catalogo-aprobado/08-ALV-PAP-papel-alisoft/variantes/estudio-pro-02-alisoft-dorado-comfort-plus-300-hojas-x4-800.jpg"],
  ["ALV-PAP-03", "Alisoft Azul Premium Max 400 Hojas × 4 Rollos", 12, "paquetes de 4 rollos", "Hogar y Papel", "assets/img/catalogo-aprobado/08-ALV-PAP-papel-alisoft/variantes/estudio-pro-03-alisoft-azul-premium-max-400-hojas-x4-800.jpg"],
  ["ALV-PAP-04", "Alisoft Negro Premium Jumbo 600 Hojas × 4 Rollos", 12, "paquetes de 4 rollos", "Hogar y Papel", "assets/img/catalogo-aprobado/08-ALV-PAP-papel-alisoft/variantes/estudio-pro-04-alisoft-negro-premium-jumbo-600-hojas-x4-800.jpg"],
  ["ALV-TOAABS-01", "Toallín Alisoft Azul 80 Hojas", 12, "rollos", "Hogar y Papel", "assets/img/catalogo-aprobado/09-ALV-TOA-ABS-toallin-absorbente-alisoft/variantes/estudio-pro-01-toallin-alisoft-azul-80-hojas-800.jpg"],
  ["ALV-TOAABS-02", "Toallín Alisoft Naranja Doble Hoja", 12, "rollos", "Hogar y Papel", "assets/img/catalogo-aprobado/09-ALV-TOA-ABS-toallin-absorbente-alisoft/variantes/estudio-pro-02-toallin-alisoft-naranja-doble-hoja-800.jpg"],
  ["DOR-PACE3-01", "Afeitadora Dorco Pace 3 (1 Caja = 12 Blísters · 1 Blíster = 12 pqts de 3 afeitadoras)", 12, "blísters (×12 pqts de 3)", "Hogar y Papel", "assets/img/catalogo-aprobado/19-afeitadora-dorco-pace3/variantes/estudio-pro-01-afeitadora-dorco-pace3-3und-800.jpg"],
  ["BER-ESP-60", "Espiral Antimosquitos Bernice × 10 Unidades", 60, "cajas", "Hogar y Papel", "assets/img/catalogo-aprobado/18-BER-ESP-espiral-bernice-x60/variantes/estudio-pro-01-espirales-bernice-10und-800.jpg"],
];

/* Mapa code -> producto (lo usan el catálogo y el panel).
   En el repositorio de Skala los productos de otras marcas de Distribuciones Ontiveros solo se muestran en miniaturas del panel compartido, por lo que usan su versión liviana -400.jpg. */
function allProductsMap() {
  const m = {};
  PRODUCTOS_COMPARTIDOS_ONTIVEROS.forEach(([code, name, unidades, unidad, line, imgBase]) => {
    const levels = nivelesImagenEstudio(imgBase);
    const miniatura = levels.img400;
    m[code] = { code, name, unidades, unidad, line, hair: "1A–4C", img: miniatura, img400: miniatura, img800: miniatura, imgHq: miniatura };
  });
  [...BANOS, ...KITS].forEach((p) => { m[p.code] = p; });
  return m;
}

/* -------------------- Productos nuevos (cargados en el panel) --------------------
   El CRM (acción "catalogo") trae los productos que no están arriba con su "info".
   Se suman a BANOS / KITS para que salgan en el catálogo y en el panel. */
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
      name: i.nombre || x.code, line: i.linea || (i.tipo === "kits" ? "Kits" : "Nuevo"), benefit: i.beneficio || "",
      hair: i.cabello || "1A–4C", unidades: Number(i.unidades) || 6, unidad: i.tipo === "kits" ? "dúos" : "unidades", foto: i.imagen || "",
    };
    if (!prev || Object.keys(datos).some((k) => p[k] !== datos[k])) { Object.assign(p, datos); cambio = true; }
    if (!prev) lista.push(p);
  });
  return cambio;
}

/* Foto de un producto:
   - Regla de 3 niveles de resolución (4:3 sobre #FFFFFF):
     * -400.jpg (400x300): grillas densas de inventario, miniaturas de carrito/pedidos
     * -800.jpg (800x600): tarjetas del catálogo web (ProductCard) y vista previa
     * -hq.jpg (1200x900 Q95): srcset (2x), visor de zoom/lightbox e impresión */
function fotoVacia(nombre) {
  const t = String(nombre || "").replace(/[<&>"']/g, "");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='#ffffff'/>
    <text x='50%' y='46%' font-family='Arial' font-size='30' font-weight='bold' fill='#e94e8c' text-anchor='middle'>${t}</text>
    <text x='50%' y='60%' font-family='Arial' font-size='18' fill='#9a9488' text-anchor='middle'>Foto próximamente</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
function fotoHTML(code, { ancho = 64, alto = 48, alt = "", grande = false, sizes = "", carga = 'loading="lazy"' } = {}) {
  const p = allProductsMap()[code] || {};
  const usar800 = grande || ancho > 400;
  const src = (usar800 ? (p.img800 || p.img400) : (p.img400 || p.img800)) || p.foto || fotoVacia(p.name || code);
  const src2x = usar800 ? (p.imgHq || p.img800) : (p.img800 || p.img400);
  const srcsetAttr = src2x && src2x !== src ? ` srcset="${src} 1x, ${src2x} 2x"` : "";
  const sizesAttr = sizes && srcsetAttr ? ` sizes="${sizes}"` : "";
  return `<picture><img src="${src}"${srcsetAttr}${sizesAttr} alt="${alt}" width="${ancho}" height="${alto}" ${carga} decoding="async" /></picture>`;
}
function fotoGrande(code) {
  const p = allProductsMap()[code] || {};
  return p.imgHq || p.img800 || p.img400 || p.foto || fotoVacia(p.name || code);
}
