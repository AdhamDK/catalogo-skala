/* ============================================================
   Skala Venezuela — Datos de productos (catálogo y panel del equipo)
   Requiere js/producto.js (UNIDADES_POR_CAJA_BANO, DUOS_POR_CAJA_KIT).
   ============================================================ */

/* Datos de productos.
   - code: código de referencia (y nombre del archivo en assets/img/).
   - img:  ruta de la imagen (assets/img/{code}.png). Si no existe -> placeholder.
   - stock: cantidad disponible (solo para el badge Alto/Medio/Bajo).
   - hair: curvatura objetivo (1A–4C).
   - line: línea / beneficio (usada por los filtros).
   Revisar los textos de "benefit" contra la etiqueta de cada producto. */
const BANOS = [
  { code: "BC-01", name: "Babosa", line: "Hidratación", benefit: "Hidratación profunda con aloe vera. Suavidad y brillo.", hair: "1A–4C", stock: 100 },
  { code: "BC-02", name: "Banana e Macuri", line: "Nutrición", benefit: "Nutrición intensa. Cabello más sano y manejable.", hair: "1A–4C", stock: 100 },
  { code: "BC-03", name: "Divino Potao", line: "Hidratación", benefit: "Hidratación y nutrición diaria para todo tipo de cabello.", hair: "1A–4C", stock: 100 },
  { code: "BC-04", name: "Divino Potinho Kids", line: "Kids", benefit: "Fórmula suave pensada para el cabello de los niños.", hair: "1A–3C", stock: 100 },
  { code: "BC-05", name: "Dona Skala", line: "Hidratación", benefit: "Línea premium. Cuidado intensivo y acabado profesional.", hair: "1A–4C", stock: 200 },
  { code: "BC-06", name: "Mais Cachos", line: "Definición", benefit: "Define y controla los rizos. Hidratación y definición.", hair: "3A–4C", stock: 600 },
  { code: "BC-07", name: "Mais Crespinhos", line: "Definición", benefit: "Definición suave para rizos y cabello crespo. Menos frizz.", hair: "3A–4C", stock: 300 },
  { code: "BC-08", name: "Mais Crespos", line: "Definición", benefit: "Máxima definición y volumen para cabello crespo.", hair: "4A–4C", stock: 50 },
  { code: "BC-09", name: "Mais Lisos", line: "Hidratación", benefit: "Control y suavidad para cabello liso, sin encresparse.", hair: "1A–2C", stock: 200 },
  { code: "BC-10", name: "Potao de Amor", line: "Nutrición", benefit: "Nutrición que abraza. Cabello nutrido y brillante.", hair: "1A–4C", stock: 300 },
  { code: "BC-11", name: "Potao Despaiado", line: "Nutrición", benefit: "Nutrición intensa para cabello desmayado y sin vida.", hair: "1A–4C", stock: 200 },
];

const KITS = [
  { code: "KT-01", name: "Kit 12 em 1", line: "Completo", benefit: "Shampoo + acondicionador multiuso, todo en uno.", hair: "1A–4C", stock: 40 },
  { code: "KT-02", name: "Kit Aguacate", line: "Nutrición", benefit: "Nutrición con aguacate. Cabello suave y manejable.", hair: "1A–4C", stock: 40 },
  { code: "KT-03", name: "Kit Babosa", line: "Hidratación", benefit: "Hidratación con aloe vera para el día a día.", hair: "1A–4C", stock: 10 },
  { code: "KT-04", name: "Kit Bomba de Vitaminas S.O.S", line: "Reconstrucción", benefit: "Reposición de vitaminas. Cabello debilitado y quebradizo.", hair: "1A–4C", stock: 60 },
  { code: "KT-05", name: "Kit Ceramidas", line: "Reconstrucción", benefit: "Repara la fibra capilar con ceramidas.", hair: "1A–4C", stock: 40 },
  { code: "KT-06", name: "Kit Crespo Divino", line: "Definición", benefit: "Definición y nutrición para cabello crespo.", hair: "3A–4C", stock: 40 },
  { code: "KT-07", name: "Kit Mais Crespinhos", line: "Definición", benefit: "Definición suave para rizos y cabello crespo.", hair: "3A–4C", stock: 10 },
  { code: "KT-08", name: "Kit Mais Cachos", line: "Definición", benefit: "Define y controla los rizos.", hair: "3A–4C", stock: 10 },
];

/* Contenido por caja (ver js/producto.js).
   - Baños de crema: 6 unidades de 1 kg.
   - Kits: 6 dúos (shampoo + acondicionador). */
BANOS.forEach((p) => { p.unidades = UNIDADES_POR_CAJA_BANO; p.unidad = "unidades"; });
KITS.forEach((p) => { p.unidades = DUOS_POR_CAJA_KIT; p.unidad = "dúos"; });

/* Mapa code -> producto (lo usan el catálogo y el panel). */
function allProductsMap() {
  const m = {};
  [...BANOS, ...KITS].forEach((p) => { m[p.code] = p; });
  return m;
}
