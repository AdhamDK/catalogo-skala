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

/* Foto de un producto: WebP liviano + PNG (los de siempre), enlace propio o dibujo (los nuevos) */
function fotoVacia(nombre) {
  const t = String(nombre || "").replace(/[<&>"']/g, "");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='317'><rect width='100%' height='100%' fill='#fdf0f5'/>
    <text x='50%' y='46%' font-family='Arial' font-size='30' font-weight='bold' fill='#e94e8c' text-anchor='middle'>${t}</text>
    <text x='50%' y='60%' font-family='Arial' font-size='18' fill='#9a9488' text-anchor='middle'>Foto próximamente</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
function fotoHTML(code, { ancho = 64, alto = 51, alt = "", grande = false, sizes = "", carga = 'loading="lazy"' } = {}) {
  const p = allProductsMap()[code] || {};
  const img = (src) => `<img src="${src}" alt="${alt}" width="${ancho}" height="${alto}" ${carga} decoding="async" />`;
  if (p.nuevo) return `<picture>${img(p.foto || fotoVacia(p.name || code))}</picture>`;
  const web = `assets/img/web/${code}`;
  const set = grande ? `${web}-400.webp 400w, ${web}-800.webp 800w` : `${web}-400.webp`;
  return `<picture><source type="image/webp" srcset="${set}"${sizes ? ` sizes="${sizes}"` : ""} />${img(`assets/img/${code}.png`)}</picture>`;
}
function fotoGrande(code) {
  const p = allProductsMap()[code] || {};
  if (p.nuevo) return p.foto || fotoVacia(p.name || code);
  return `assets/img/web/${code}-800.webp`;
}
