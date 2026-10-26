/* ============================================================
   Skala Venezuela — helpers de producto (sin DOM, testeables)
   - Curvaturas de cabello (iconos) según la Guía de curvatura.
   - Unidades por caja.
   Se carga antes de js/main.js. Tests: node --test tests/
   ============================================================ */

/* Contenido de cada caja. */
const UNIDADES_POR_CAJA_BANO = 6; // 6 unidades de baño de crema 1 kg
const DUOS_POR_CAJA_KIT = 6;      // 6 dúos (shampoo + acondicionador)

/* Mismo orden, nombres y símbolos que la sección "Guía de curvatura". */
const CURVATURAS = [
  { num: 1, clase: "liso", nombre: "Liso", simbolo: "●", tipos: "1A · 1B · 1C" },
  { num: 2, clase: "ondulado", nombre: "Ondulado", simbolo: "◒", tipos: "2A · 2B · 2C" },
  { num: 3, clase: "cacheado", nombre: "Cacheado", simbolo: "◉", tipos: "3A · 3B · 3C" },
  { num: 4, clase: "crespo", nombre: "Crespo", simbolo: "✦", tipos: "4A · 4B · 4C" },
];

/* "1A–4C" -> [Liso, Ondulado, Cacheado, Crespo]; "3A–4C" -> [Cacheado, Crespo].
   Acepta guion largo (–) o normal (-) y un valor único ("3B"). */
function tiposDeCabello(hair) {
  const m = String(hair || "").trim().match(/^([1-4])[A-C]?(?:\s*[–-]\s*([1-4])[A-C]?)?$/i);
  if (!m) return [];
  const desde = parseInt(m[1], 10);
  const hasta = m[2] ? parseInt(m[2], 10) : desde;
  const lo = Math.min(desde, hasta);
  const hi = Math.max(desde, hasta);
  return CURVATURAS.filter((c) => c.num >= lo && c.num <= hi);
}

/* HTML de los iconos de curvatura para una tarjeta. */
function iconosCabelloHTML(hair) {
  return tiposDeCabello(hair)
    .map((c) => {
      const label = `${c.nombre} (${c.tipos})`;
      return `<span class="hair-icon hair-${c.clase}" role="img" title="${label}" aria-label="${label}">${c.simbolo}</span>`;
    })
    .join("");
}

/* Texto de unidades por caja ("Caja x 6 unidades" / "Caja x 6 dúos").
   p.unidad es el nombre de la unidad (por defecto "unidades").
   Si no hay dato, se informa. */
function textoUnidades(p) {
  const u = p && p.unidades;
  if (Number.isFinite(u) && u > 0) return `Caja x ${u} ${(p && p.unidad) || "unidades"}`;
  return "Unidades por caja: información no disponible";
}

/* Sufijo para el mensaje de pedido: 2 cajas de 6 -> " (12 unidades)". */
function textoUnidadesPedido(p, cajas) {
  const u = p && p.unidades;
  if (!(Number.isFinite(u) && u > 0) || !(cajas > 0)) return "";
  return ` (${cajas * u} ${p.unidad || "unidades"})`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { UNIDADES_POR_CAJA_BANO, DUOS_POR_CAJA_KIT, CURVATURAS, tiposDeCabello, iconosCabelloHTML, textoUnidades, textoUnidadesPedido };
}
