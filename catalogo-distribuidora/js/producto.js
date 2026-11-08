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

/* Versión corta para listas: "Caja x 6 und" / "Caja x 6 dúos" */
function textoUnidadesCorto(p) {
  const u = p && p.unidades;
  if (!(Number.isFinite(u) && u > 0)) return "";
  const un = (p && p.unidad) || "unidades";
  return `Caja x ${u} ${un === "unidades" ? "und" : un}`;
}

/* Sufijo para el mensaje de pedido: 2 cajas de 6 -> " (12 unidades)". */
function textoUnidadesPedido(p, cajas) {
  const u = p && p.unidades;
  if (!(Number.isFinite(u) && u > 0) || !(cajas > 0)) return "";
  return ` (${cajas * u} ${p.unidad || "unidades"})`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { UNIDADES_POR_CAJA_BANO, DUOS_POR_CAJA_KIT, CURVATURAS, tiposDeCabello, iconosCabelloHTML, textoUnidades, textoUnidadesCorto, textoUnidadesPedido };
}

/* -------------------- Detalles de los campos (catálogo y panel) --------------------
   - Cantidad: al tocar el número se selecciona entero, así lo que escribís lo reemplaza
     (antes el cursor quedaba detrás del "1" y salía "12").
   - Dirección: crece hacia abajo en vez de correr el texto hacia un costado; Enter no hace salto de línea. */
(function () {
  if (typeof document === "undefined") return;
  const esCantidad = (el) => el && el.classList && el.classList.contains("qty-input");
  const esDir = (el) => el && el.classList && el.classList.contains("dir-texto");
  const crecer = (el) => { el.style.height = "auto"; el.style.height = el.scrollHeight + 2 + "px"; };
  let recien = null;
  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (esCantidad(el)) { recien = el; try { el.select(); } catch (_) {} setTimeout(() => { try { el.select(); } catch (_) {} }, 0); }
    if (esDir(el)) crecer(el);
  });
  // el toque que enfoca no debe mover el cursor y deshacer la selección
  document.addEventListener("mouseup", (e) => { if (esCantidad(e.target) && recien === e.target) { e.preventDefault(); recien = null; } });
  document.addEventListener("touchend", (e) => { if (esCantidad(e.target) && recien === e.target) { setTimeout(() => { try { e.target.select(); } catch (_) {} }, 0); recien = null; } });
  document.addEventListener("input", (e) => {
    if (!esDir(e.target)) return;
    if (/\n/.test(e.target.value)) { const pos = e.target.selectionStart; e.target.value = e.target.value.replace(/\s*\n+\s*/g, " "); try { e.target.setSelectionRange(pos, pos); } catch (_) {} }
    crecer(e.target);
  });
  document.addEventListener("keydown", (e) => { if (esDir(e.target) && e.key === "Enter") { e.preventDefault(); e.target.blur(); } });
  window.crecerDireccion = crecer; // para cuando el valor se pone desde el código
  // los formularios que se dibujan después (panel) también se ajustan solos
  const ajustar = (raiz) => { if (raiz.querySelectorAll) raiz.querySelectorAll(".dir-texto").forEach((t) => { if (t.offsetParent) crecer(t); }); };
  const iniciar = () => {
    ajustar(document);
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) ajustar(n.parentNode || n); }))).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) iniciar(); else document.addEventListener("DOMContentLoaded", iniciar);
})();
