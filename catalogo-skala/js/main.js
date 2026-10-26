/* ============================================================
   Skala Venezuela — Catálogo 2026
   Datos de productos + render + filtros + armador de pedido.
   ============================================================ */

/* -------------------- CONFIGURACIÓN -------------------- */
/* ⚠️ CAMBIAR por el número real de WhatsApp.
   Formato: código de país + número, SIN "+", SIN espacios ni guiones.
   Venezuela: 58 + número (ej. "584121234567"). */
const WHATSAPP_NUMBER = "584247042169";
const MIN_CAJAS = 40;   // mínimo de cajas por cliente
const META_CAJAS = 100; // meta de cajas
const STORAGE_KEY = "skala_pedido_v1";

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

/* -------------------- PEDIDO (estado) -------------------- */
let pedido = {};
try { pedido = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { pedido = {}; }

function savePedido() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pedido)); } catch (e) {}
}
function allProductsMap() {
  const m = {};
  [...BANOS, ...KITS].forEach((p) => { m[p.code] = p; });
  return m;
}
function totalCajas() {
  return Object.values(pedido).reduce((a, b) => a + (b || 0), 0);
}

/* -------------------- RENDER -------------------- */
function stockBadge(stock) {
  if (stock >= 300) return { label: "Stock alto", cls: "stock-alto" };
  if (stock >= 100) return { label: "Stock medio", cls: "stock-medio" };
  return { label: "Stock bajo", cls: "stock-bajo" };
}

function placeholder(name) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'>
    <rect width='100%' height='100%' fill='#fdf0f5'/>
    <text x='50%' y='44%' font-family='Arial' font-size='34' font-weight='bold'
      fill='#e94e8c' text-anchor='middle'>${name}</text>
    <text x='50%' y='58%' font-family='Arial' font-size='20' fill='#9a9488'
      text-anchor='middle'>Foto proximamente</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/* Imágenes responsive: WebP livianos (400/800 px) con PNG original de respaldo.
   Las primeras tarjetas cargan con prioridad; el resto en diferido (lazy). */
const IMG_SIZES = "(min-width: 901px) 270px, (min-width: 561px) 45vw, 92vw";

function cardHTML(p, group, i = 99) {
  const b = stockBadge(p.stock);
  const img = `assets/img/${p.code}.png`;
  const web = `assets/img/web/${p.code}`;
  const prioridad = i < 2 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  const q = pedido[p.code] || 0;
  return `
  <article class="card">
    <div class="card-img">
      <span class="card-badge ${b.cls}">${b.label}</span>
      <picture>
        <source type="image/webp" srcset="${web}-400.webp 400w, ${web}-800.webp 800w" sizes="${IMG_SIZES}" />
        <img src="${img}" alt="${p.name}" width="400" height="317" ${prioridad} decoding="async"
             onerror="this.onerror=null; this.parentNode.querySelectorAll('source').forEach(function(s){s.remove()}); this.src=placeholder('${p.name}');" />
      </picture>
    </div>
    <div class="card-body">
      <span class="card-line">${p.line}</span>
      <h3 class="card-name">${p.name}</h3>
      <p class="card-benefit">${p.benefit}</p>
      <div class="card-meta">
        <span>${group}</span>
        <span class="card-hair">${p.hair} <span class="hair-icons">${iconosCabelloHTML(p.hair)}</span></span>
        <span class="card-units">${textoUnidades(p)}</span>
      </div>
      <div class="card-order">
        <div class="qty">
          <button type="button" class="qty-btn" data-act="minus" data-code="${p.code}" aria-label="Restar una caja de ${p.name}">−</button>
          <input class="qty-input" type="number" min="0" step="1" value="${q}" data-code="${p.code}"
                 inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" aria-label="Cajas de ${p.name}" />
          <button type="button" class="qty-btn" data-act="plus" data-code="${p.code}" aria-label="Sumar una caja de ${p.name}">+</button>
        </div>
        <span class="qty-label">cajas</span>
      </div>
      <span class="card-code">Ref. ${p.code}</span>
    </div>
  </article>`;
}

function render(elId, items, group) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = items.map((p, i) => cardHTML(p, group, elId === "gridBanos" ? i : 99)).join("");
}

/* Refresca los inputs con el estado guardado (tras re-render por filtros). */
function applyQty() {
  document.querySelectorAll(".qty-input").forEach((inp) => {
    inp.value = pedido[inp.dataset.code] || 0;
  });
}

/* -------------------- PEDIDO (acciones) -------------------- */
function setQty(code, val) {
  pedido[code] = Math.max(0, Math.floor(val || 0));
  savePedido();
  const inp = document.querySelector(`.qty-input[data-code="${code}"]`);
  if (inp) inp.value = pedido[code];
  updateBar();
}

function updateBar() {
  const total = totalCajas();
  const bar = document.getElementById("orderBar");
  const totalEl = document.getElementById("orderTotal");
  const hintEl = document.getElementById("orderHint");
  if (!bar || !totalEl || !hintEl) return;

  totalEl.textContent = total;
  bar.classList.toggle("show", total > 0);
  document.body.classList.toggle("has-order", total > 0);

  if (total === 0) {
    hintEl.textContent = "";
    hintEl.className = "order-hint";
  } else if (total < MIN_CAJAS) {
    hintEl.textContent = `Mínimo ${MIN_CAJAS} cajas · te faltan ${MIN_CAJAS - total}`;
    hintEl.className = "order-hint";
  } else if (total < META_CAJAS) {
    hintEl.textContent = `Vas bien · meta ${META_CAJAS} cajas`;
    hintEl.className = "order-hint ok";
  } else {
    hintEl.textContent = `¡Meta alcanzada! (${META_CAJAS}+ cajas)`;
    hintEl.className = "order-hint ok";
  }
}

/* -------------------- Datos del cliente -------------------- */
let cliente = {};
try { cliente = JSON.parse(localStorage.getItem("skala_cliente_v1")) || {}; } catch (e) { cliente = {}; }
function saveCliente() { try { localStorage.setItem("skala_cliente_v1", JSON.stringify(cliente)); } catch (e) {} }

function collectCliente() {
  return {
    rif: (document.getElementById("fRif").value || "").trim(),
    negocio: (document.getElementById("fNegocio").value || "").trim(),
    direccion: (document.getElementById("fDireccion").value || "").trim(),
    telefono: (document.getElementById("fTelefono").value || "").trim(),
    pago: (document.querySelector('input[name="pago"]:checked') || {}).value || "",
  };
}
function fillCliente() {
  document.getElementById("fRif").value = cliente.rif || "";
  document.getElementById("fNegocio").value = cliente.negocio || "";
  document.getElementById("fDireccion").value = cliente.direccion || "";
  document.getElementById("fTelefono").value = cliente.telefono || "";
  document.querySelectorAll('input[name="pago"]').forEach((r) => {
    r.checked = r.value === cliente.pago;
  });
}

function buildMessage(c) {
  const map = allProductsMap();
  const items = Object.entries(pedido)
    .filter(([code, q]) => q > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const total = items.reduce((a, [, q]) => a + q, 0);
  const lineas = items.map(([code, q]) => {
    const p = map[code];
    const name = p ? p.name : code;
    const und = textoUnidadesPedido(p, q);
    return `• ${name} (${code}) — ${q} caja${q === 1 ? "" : "s"}${und}`;
  });
  const parts = [
    "Hola! Quiero cotizar este pedido de Skala:",
    "",
    "*Datos del cliente*",
    `RIF: ${c.rif || "—"}`,
    `Negocio: ${c.negocio || "—"}`,
    `Dirección: ${c.direccion || "—"}`,
    `Teléfono: ${c.telefono || "—"}`,
    `Método de pago: ${c.pago || "—"}`,
    "",
    "*Pedido*",
    ...lineas,
    "",
    `Total: ${total} caja${total === 1 ? "" : "s"}`,
  ];
  if (total < MIN_CAJAS) parts.push(`(Ojo: el mínimo es ${MIN_CAJAS} cajas)`);
  return parts.join("\n");
}

/* Recalcula el mensaje y muestra qué datos faltan (todos opcionales). */
function refreshMessage() {
  const c = collectCliente();
  const msg = buildMessage(c);
  document.getElementById("orderText").value = msg;
  const wa = document.getElementById("btnWhatsapp");
  wa.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  wa.classList.remove("is-disabled");
  wa.setAttribute("aria-disabled", "false");
  const missing = [];
  if (!c.rif) missing.push("RIF");
  if (!c.negocio) missing.push("Nombre del negocio");
  if (!c.direccion) missing.push("Dirección");
  if (!c.telefono) missing.push("Teléfono");
  if (!c.pago) missing.push("Método de pago");
  const warn = document.getElementById("formWarn");
  if (missing.length) {
    warn.innerHTML = "Faltó llenar: <strong>" + missing.join(" · ") + "</strong>";
    warn.hidden = false;
  } else {
    warn.hidden = true;
  }
}

function openModal() {
  if (totalCajas() <= 0) return;
  fillCliente();
  refreshMessage();
  lastFocus = document.activeElement;
  document.getElementById("orderModal").hidden = false;
  document.body.classList.add("modal-open"); // bloquea el scroll del fondo en móvil
  const box = document.querySelector("#orderModal .modal-box");
  box.scrollTop = 0;
  box.focus({ preventScroll: true });
}
let lastFocus = null;
function closeModal() {
  const modal = document.getElementById("orderModal");
  if (modal.hidden) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}

/* Vacía la selección (también lo usa el modo vendedor al guardar). */
function vaciarPedido() {
  pedido = {};
  savePedido();
  applyQty();
  updateBar();
}

/* -------------------- INICIALIZACIÓN -------------------- */
document.addEventListener("DOMContentLoaded", () => {
  render("gridBanos", BANOS, "Baño de crema 1kg");
  render("gridKits", KITS, "Kit shampoo + acondicionador");

  /* Filtros de baños de crema */
  const filters = document.querySelectorAll("#filterBanos .filter");
  filters.forEach((btn) => {
    btn.addEventListener("click", () => {
      filters.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const f = btn.dataset.filter;
      const items = f === "all" ? BANOS : BANOS.filter((p) => p.line === f);
      render("gridBanos", items, "Baño de crema 1kg");
      applyQty();
    });
  });

  /* Delegación: botones +/- del selector de cajas */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".qty-btn");
    if (btn) {
      const code = btn.dataset.code;
      const cur = pedido[code] || 0;
      setQty(code, btn.dataset.act === "plus" ? cur + 1 : cur - 1);
    }
  });

  /* Delegación: escribir la cantidad directamente */
  document.addEventListener("input", (e) => {
    if (e.target.classList && e.target.classList.contains("qty-input")) {
      const code = e.target.dataset.code;
      pedido[code] = Math.max(0, Math.floor(parseInt(e.target.value, 10) || 0));
      savePedido();
      updateBar();
    }
  });

  /* Botones del pedido / modal */
  /* "Armar pedido": primero se elige Cliente o Vendedor (js/vendedor.js) */
  document.getElementById("btnArmarPedido").addEventListener("click", () => {
    if (window.SkalaVendedor) window.SkalaVendedor.elegirModo();
    else openModal();
  });
  document.getElementById("btnClose").addEventListener("click", closeModal);
  document.getElementById("orderModal").addEventListener("click", (e) => {
    if (e.target.id === "orderModal") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  const btnCopy = document.getElementById("btnCopy");
  btnCopy.addEventListener("click", async () => {
    const ta = document.getElementById("orderText");
    try {
      await navigator.clipboard.writeText(ta.value);
      btnCopy.textContent = "¡Copiado!";
      setTimeout(() => (btnCopy.textContent = "Copiar mensaje"), 1500);
    } catch (err) {
      ta.select();
      document.execCommand("copy");
    }
  });

  /* Datos del cliente: guardar y refrescar mensaje en vivo */
  ["fRif", "fNegocio", "fDireccion", "fTelefono"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      Object.assign(cliente, collectCliente());
      saveCliente();
      refreshMessage();
    });
  });
  document.querySelectorAll('input[name="pago"]').forEach((r) => {
    r.addEventListener("change", () => {
      Object.assign(cliente, collectCliente());
      saveCliente();
      refreshMessage();
    });
  });

  /* Papelera: borrar toda la selección */
  document.getElementById("btnClear").addEventListener("click", vaciarPedido);

  /* Link de WhatsApp de la sección contacto */
  const cw = document.getElementById("contactWhatsapp");
  if (cw) cw.href = `https://wa.me/${WHATSAPP_NUMBER}`;

  applyQty();
  updateBar();
});
