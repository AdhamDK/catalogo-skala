/* ============================================================
   Skala Venezuela — Catálogo 2026
   Render de productos + filtros + pedido del cliente.
   - Tocar una tarjeta suma una caja (los botones − / + ajustan).
   - Precios y "Agotado" vienen del CRM (acción "catalogo"); sin señal, lo último guardado.
   - "Tu pedido": revisar, sumar o quitar, monto según forma de pago, elegir vendedor y
     enviar por WhatsApp. El pedido llega también a la app de ese vendedor (pedido web).
   ============================================================ */

/* -------------------- CONFIGURACIÓN -------------------- */
/* Número de WhatsApp de la empresa: código de país + número, sin "+", espacios ni guiones. */
const WHATSAPP_NUMBER = "584247042169";
const MIN_CAJAS = 40;   // mínimo de cajas por cliente
const META_CAJAS = 100; // meta de cajas
const STORAGE_KEY = "skala_pedido_v1";
const K_CLIENTE_WEB = "skala_cliente_v1";
const K_REF_WEB = "skala_ref_web";
const K_VENDEDORES = "skala_vendedores_v1";

/* Los productos (BANOS, KITS) están en js/datos.js (los usa también el panel). */
const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch (e) { return def; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const escHTML = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* -------------------- PEDIDO (estado) -------------------- */
let pedido = leer(STORAGE_KEY, {}) || {};
let PRECIOS = {}; // code -> { menor, mayor, desc_*, agotado }

function savePedido() { guardar(STORAGE_KEY, pedido); }
function totalCajas() { return Object.values(pedido).reduce((a, b) => a + (b || 0), 0); }

/* -------------------- RENDER -------------------- */
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

/* Imágenes responsive: WebP livianos (400/800 px) con PNG original de respaldo. */
const IMG_SIZES = "(min-width: 901px) 270px, (min-width: 561px) 30vw, 46vw";

function cardHTML(p, group, i = 99) {
  const img = `assets/img/${p.code}.png`;
  const web = `assets/img/web/${p.code}`;
  const prioridad = i < 4 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  const q = pedido[p.code] || 0;
  return `
  <article class="card${q ? " elegido" : ""}" data-card="${p.code}" title="Tocá para sumar una caja">
    <div class="card-img">
      <span class="card-badge" data-badge hidden></span>
      <b class="card-n" aria-hidden="true">${q || ""}</b>
      <button type="button" class="card-zoom" data-zoom="${p.code}" aria-label="Ampliar imagen de ${p.name}" title="Ampliar imagen">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6"/></svg>
      </button>
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
        <span class="card-group">${group}</span>
        <span class="card-hair"><span class="hair-txt">${p.hair}</span> <span class="hair-icons">${iconosCabelloHTML(p.hair)}</span></span>
        <span class="card-units">${textoUnidades(p)}</span>
      </div>
      <p class="card-precio" data-precio></p>
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
  pintarCards();
}

/* Precio por caja (menor; y al mayor desde 15 cajas), "Agotado" y lo elegido */
function pintarCards() {
  document.querySelectorAll(".card[data-card]").forEach((card) => {
    const code = card.dataset.card;
    const pr = PRECIOS[code];
    const q = pedido[code] || 0;
    card.classList.toggle("elegido", q > 0);
    card.querySelector(".card-n").textContent = q ? String(q) : "";
    const el = card.querySelector("[data-precio]");
    el.innerHTML = pr && pr.menor
      ? `<strong>${dinero(pr.menor)}</strong> / caja${pr.mayor && pr.mayor < pr.menor ? ` <span>· al mayor ${dinero(pr.mayor)}</span>` : ""}`
      : "";
    const badge = card.querySelector("[data-badge]");
    const agotado = !!(pr && pr.agotado);
    badge.hidden = !agotado;
    badge.textContent = agotado ? "Agotado" : "";
    card.classList.toggle("agotado", agotado && !q);
  });
}

/* Refresca los inputs con el estado guardado. */
function applyQty() {
  document.querySelectorAll(".qty-input").forEach((inp) => { inp.value = pedido[inp.dataset.code] || 0; });
  pintarCards();
}

/* -------------------- PEDIDO (acciones) -------------------- */
function setQty(code, val) {
  const n = Math.max(0, Math.floor(val || 0));
  if (n) pedido[code] = n; else delete pedido[code];
  savePedido();
  marcarCambio();
  document.querySelectorAll(`.qty-input[data-code="${code}"]`).forEach((inp) => { if (document.activeElement !== inp) inp.value = n; });
  pintarCards();
  updateBar();
  if (!document.getElementById("orderModal").hidden) {
    if (totalCajas() <= 0) closeModal(); else { renderCarrito(); refreshMessage(); }
  }
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
  const its = itemsConPrecio();
  const monto = totalPorPago(its, "credito");
  if (total === 0) {
    hintEl.textContent = "";
    hintEl.className = "order-hint";
  } else if (total < MIN_CAJAS) {
    hintEl.textContent = `${monto ? dinero(monto) + " · " : ""}Mínimo ${MIN_CAJAS} cajas · te faltan ${MIN_CAJAS - total}`;
    hintEl.className = "order-hint";
  } else if (total < META_CAJAS) {
    hintEl.textContent = `${monto ? dinero(monto) + " · " : ""}Vas bien · meta ${META_CAJAS} cajas`;
    hintEl.className = "order-hint ok";
  } else {
    hintEl.textContent = `${monto ? dinero(monto) + " · " : ""}¡Meta alcanzada! (${META_CAJAS}+ cajas)`;
    hintEl.className = "order-hint ok";
  }
}

/* Items del pedido con precio según el nivel (al mayor desde 15 cajas) */
function itemsConPrecio() {
  const items = itemsDePedido(pedido, allProductsMap());
  return conPrecios(items, PRECIOS, nivelPrecio(totalCajas(), false));
}

/* -------------------- Datos del cliente y referencia -------------------- */
let cliente = leer(K_CLIENTE_WEB, {}) || {};
function saveCliente() { guardar(K_CLIENTE_WEB, cliente); }
/* Referencia del pedido web: cambia si el pedido cambia después de enviarlo */
function refActual() {
  let r = leer(K_REF_WEB, null);
  if (!r || !r.ref) { r = { ref: refWeb(), enviado: false }; guardar(K_REF_WEB, r); }
  return r.ref;
}
function marcarCambio() {
  const r = leer(K_REF_WEB, null);
  if (r && r.enviado) guardar(K_REF_WEB, { ref: refWeb(), enviado: false });
}

const $id = (id) => document.getElementById(id);
function collectCliente() {
  return {
    rif_cedula: ($id("fRif").value || "").trim(),
    negocio: ($id("fNegocio").value || "").trim(),
    contacto: ($id("fContacto").value || "").trim(),
    direccion: ($id("fDireccion").value || "").trim(),
    telefono: ($id("fTelefono").value || "").trim(),
    vendedor_id: $id("fVendedor").value || "",
    tipo_pago: (document.querySelector('input[name="pagoWeb"]:checked') || {}).value || "",
  };
}
function fillCliente() {
  $id("fRif").value = cliente.rif_cedula || cliente.rif || "";
  $id("fNegocio").value = cliente.negocio || "";
  $id("fContacto").value = cliente.contacto || "";
  $id("fDireccion").value = cliente.direccion || "";
  $id("fTelefono").value = cliente.telefono || "";
}

/* Vendedores (para que el cliente elija el suyo) */
let vendedores = leer(K_VENDEDORES, []) || [];
function pintarVendedores() {
  const sel = $id("fVendedor");
  const actual = sel.value || cliente.vendedor_id || "";
  sel.innerHTML = '<option value="">Elegí tu vendedor</option>' +
    vendedores.map((v) => `<option value="${escHTML(v.id)}"${v.id === actual ? " selected" : ""}>${escHTML(v.nombre)}</option>`).join("");
}
function cargarVendedores() {
  if (typeof SkalaAPI === "undefined") return;
  SkalaAPI.api("vendedores").then((r) => {
    vendedores = r.vendedores || [];
    guardar(K_VENDEDORES, vendedores);
    pintarVendedores();
    refreshMessage();
  }).catch(() => {});
}

/* -------------------- "Tu pedido" -------------------- */
function renderCarrito() {
  const its = itemsConPrecio();
  const total = totalCajas();
  const sel = (document.querySelector('input[name="pagoWeb"]:checked') || {}).value || cliente.tipo_pago || "";
  const tipo = sel || "credito";
  const escribiendo = document.activeElement && document.activeElement.closest && document.activeElement.closest("#cartList");
  if (!escribiendo || its.length !== $id("cartList").children.length) $id("cartList").innerHTML = its.map((it) => `
    <li class="cart-item">
      <picture class="cart-foto"><source type="image/webp" srcset="assets/img/web/${it.code}-400.webp" />
        <img src="assets/img/${it.code}.png" alt="" width="44" height="44" loading="lazy" decoding="async" /></picture>
      <div class="cart-info"><strong>${escHTML(it.producto)}</strong>
        <span>${it.code}${it.total_unidades ? ` · ${it.total_unidades} ${escHTML(it.unidad)}` : ""}${it.precio ? ` · ${dinero(precioUnitario(it, tipo))} c/u` : ""}</span></div>
      <div class="qty qty-chica">
        <button type="button" class="qty-btn" data-act="minus" data-code="${it.code}" aria-label="Restar una caja de ${escHTML(it.producto)}">−</button>
        <input class="qty-input" type="number" min="0" step="1" value="${it.cajas}" data-code="${it.code}" inputmode="numeric" aria-label="Cajas de ${escHTML(it.producto)}" />
        <button type="button" class="qty-btn" data-act="plus" data-code="${it.code}" aria-label="Sumar una caja de ${escHTML(it.producto)}">+</button>
      </div>
      <button type="button" class="cart-quitar" data-quitar="${it.code}" aria-label="Quitar ${escHTML(it.producto)}">✕</button>
    </li>`).join("");
  const hayPrecio = its.some((it) => it.precio > 0);
  $id("cartNivel").textContent = total >= CAJAS_MAYOR ? `Precio al mayor (${total} cajas).` : `Precio al por menor · desde ${CAJAS_MAYOR} cajas tenés precio al mayor (te faltan ${CAJAS_MAYOR - total}).`;
  $id("cartTotal").innerHTML = `<strong>${total} caja${total === 1 ? "" : "s"}</strong>${hayPrecio ? ` · <strong>${dinero(totalPorPago(its, tipo))}</strong> ${escHTML((pagoPorId(tipo) || {}).nombre || "")}` : ""}`;
  $id("pagosWeb").innerHTML = totalesPorPago(its).map((pg) => `<label class="pay-opt pago-opt">
      <input type="radio" name="pagoWeb" value="${pg.id}"${pg.id === sel ? " checked" : ""} />
      <span class="pago-txt"><strong>${escHTML(pg.nombre)}</strong><span>${escHTML(pg.ayuda)}</span></span>
      ${hayPrecio ? `<span class="pago-monto"><strong>${dinero(pg.total)}</strong>${pg.ahorro ? `<span>−${dinero(pg.ahorro)}</span>` : ""}</span>` : ""}
    </label>`).join("");
}

function datosPedidoWeb() {
  const c = collectCliente();
  const v = vendedores.find((x) => x.id === c.vendedor_id);
  return { ref: refActual(), cliente: c, vendedor: v ? v.nombre : "", vendedor_id: c.vendedor_id, items: itemsConPrecio(), tipo_pago: c.tipo_pago };
}

/* Recalcula el mensaje y muestra qué datos faltan. */
function faltantes(c) {
  const f = [];
  if (!c.negocio && !c.contacto) f.push("Nombre del negocio");
  if (c.telefono.replace(/\D/g, "").length < 7) f.push("Teléfono");
  if (!c.vendedor_id) f.push("Tu vendedor");
  if (!c.tipo_pago) f.push("Forma de pago");
  return f;
}
function refreshMessage() {
  const d = datosPedidoWeb();
  const msg = mensajeWeb(d);
  $id("orderText").value = msg;
  const wa = $id("btnWhatsapp");
  wa.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  const falta = faltantes(d.cliente);
  wa.classList.toggle("is-disabled", falta.length > 0);
  return falta;
}

function openModal() {
  if (totalCajas() <= 0) return;
  fillCliente();
  pintarVendedores();
  renderCarrito();
  refreshMessage();
  $id("formWarn").hidden = true;
  cargarVendedores();
  lastFocus = document.activeElement;
  $id("orderModal").hidden = false;
  document.body.classList.add("modal-open"); // bloquea el scroll del fondo en móvil
  const box = document.querySelector("#orderModal .modal-box");
  box.scrollTop = 0;
  box.focus({ preventScroll: true });
}
let lastFocus = null;
function closeModal() {
  const modal = $id("orderModal");
  if (modal.hidden) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}

/* -------------------- Ampliar imagen -------------------- */
let zoomFoco = null;
function abrirZoom(code) {
  const p = allProductsMap()[code];
  if (!p) return;
  const m = $id("zoomModal");
  const img = $id("zoomImg");
  img.onerror = () => { img.onerror = null; img.src = `assets/img/${code}.png`; };
  img.src = `assets/img/web/${code}-800.webp`;
  img.alt = p.name;
  $id("zoomTitulo").textContent = p.name;
  $id("zoomSub").textContent = `${code} · ${textoUnidades(p)} · ${p.hair}`;
  zoomFoco = document.activeElement;
  m.hidden = false;
  document.body.classList.add("modal-open");
  $id("zoomCerrar").focus({ preventScroll: true });
}
function cerrarZoom() {
  const m = $id("zoomModal");
  if (!m || m.hidden) return false;
  m.hidden = true;
  if ($id("orderModal").hidden) document.body.classList.remove("modal-open");
  if (zoomFoco && zoomFoco.focus) zoomFoco.focus({ preventScroll: true });
  return true;
}

/* Vacía la selección. */
function vaciarPedido() {
  pedido = {};
  savePedido();
  marcarCambio();
  applyQty();
  updateBar();
}

let toastT = null;
function avisar(msg) {
  const t = $id("toast");
  if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 3500);
}

/* Precios y existencias: lo guardado ya, y se actualiza desde el CRM */
function cargarPrecios() {
  if (typeof SkalaAPI === "undefined") return;
  PRECIOS = SkalaAPI.preciosMapa(SkalaAPI.catalogoGuardado());
  pintarCards(); updateBar();
  SkalaAPI.catalogo().then((d) => {
    PRECIOS = SkalaAPI.preciosMapa(d);
    pintarCards(); updateBar();
    if (!$id("orderModal").hidden) { renderCarrito(); refreshMessage(); }
  }).catch(() => {});
}

/* -------------------- INICIALIZACIÓN -------------------- */
document.addEventListener("DOMContentLoaded", () => {
  render("gridBanos", BANOS, "Baño de crema 1kg");
  render("gridKits", KITS, "Kit shampoo + acondicionador");
  cargarPrecios();

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

  document.addEventListener("click", (e) => {
    /* Botones − / + (tarjetas y "Tu pedido") */
    const btn = e.target.closest(".qty-btn");
    if (btn) {
      const code = btn.dataset.code;
      const cur = pedido[code] || 0;
      setQty(code, btn.dataset.act === "plus" ? cur + 1 : cur - 1);
      return;
    }
    const zoom = e.target.closest("[data-zoom]");
    if (zoom) { abrirZoom(zoom.dataset.zoom); return; }
    const quitar = e.target.closest("[data-quitar]");
    if (quitar) { setQty(quitar.dataset.quitar, 0); return; }
    /* Tocar la tarjeta suma una caja */
    const card = e.target.closest(".card[data-card]");
    if (card && !e.target.closest(".card-order, a, input, button")) {
      const code = card.dataset.card;
      if (PRECIOS[code] && PRECIOS[code].agotado) { avisar("Ese producto está agotado por ahora."); return; }
      setQty(code, (pedido[code] || 0) + 1);
      card.classList.remove("pulso"); void card.offsetWidth; card.classList.add("pulso");
    }
  });

  /* Escribir la cantidad directamente */
  document.addEventListener("input", (e) => {
    if (e.target.classList && e.target.classList.contains("qty-input")) {
      setQty(e.target.dataset.code, parseInt(e.target.value, 10) || 0);
    }
  });

  /* "Armar pedido": primero se elige Cliente o Vendedor (js/crm.js) */
  $id("btnArmarPedido").addEventListener("click", () => {
    if (window.SkalaCRM) window.SkalaCRM.elegirModo();
    else openModal();
  });
  $id("btnClose").addEventListener("click", closeModal);
  $id("orderModal").addEventListener("click", (e) => { if (e.target.id === "orderModal") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !cerrarZoom()) closeModal(); });
  $id("zoomModal").addEventListener("click", (e) => { if (e.target.id === "zoomModal" || e.target.closest("#zoomCerrar")) cerrarZoom(); });

  const btnCopy = $id("btnCopy");
  btnCopy.addEventListener("click", async () => {
    const ta = $id("orderText");
    try {
      await navigator.clipboard.writeText(ta.value);
      btnCopy.textContent = "¡Copiado!";
      setTimeout(() => (btnCopy.textContent = "Copiar mensaje"), 1500);
    } catch (err) {
      ta.select();
      document.execCommand("copy");
    }
  });

  /* Datos del cliente: guardar y refrescar el mensaje en vivo */
  const alCambiar = (e) => {
    Object.assign(cliente, collectCliente());
    saveCliente();
    if (e && e.target && e.target.name === "pagoWeb") renderCarrito();
    const falta = refreshMessage();
    if (!$id("formWarn").hidden && !falta.length) $id("formWarn").hidden = true;
  };
  ["fRif", "fNegocio", "fContacto", "fDireccion", "fTelefono"].forEach((id) => $id(id).addEventListener("input", alCambiar));
  $id("fVendedor").addEventListener("change", alCambiar);
  $id("pagosWeb").addEventListener("change", alCambiar);

  /* Enviar: valida, avisa al vendedor (pedido web en su app) y abre WhatsApp */
  $id("btnWhatsapp").addEventListener("click", (e) => {
    const d = datosPedidoWeb();
    const falta = faltantes(d.cliente);
    const warn = $id("formWarn");
    if (falta.length) {
      e.preventDefault();
      warn.innerHTML = "Para enviar falta: <strong>" + falta.join(" · ") + "</strong>";
      warn.hidden = false;
      warn.scrollIntoView({ block: "center" });
      return;
    }
    warn.hidden = true;
    if (typeof SkalaAPI !== "undefined") {
      SkalaAPI.enviarSinEsperar("pedidoWeb", { ref: d.ref, cliente: d.cliente, vendedor_id: d.vendedor_id, tipo_pago: d.tipo_pago,
        items: d.items.map((it) => ({ code: it.code, producto: it.producto, cajas: it.cajas, unidades_caja: it.unidades_caja, unidad: it.unidad })) });
    }
    guardar(K_REF_WEB, { ref: d.ref, enviado: true });
    avisar(`Pedido ${d.ref} enviado a ${d.vendedor}`);
  });

  /* Papelera: borrar toda la selección */
  $id("btnClear").addEventListener("click", vaciarPedido);

  /* Link de WhatsApp de la sección contacto */
  const cw = $id("contactWhatsapp");
  if (cw) cw.href = `https://wa.me/${WHATSAPP_NUMBER}`;

  applyQty();
  updateBar();
});
