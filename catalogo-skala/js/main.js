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
/* Imágenes responsive: WebP livianos (400/800 px) con PNG original de respaldo. */
const IMG_SIZES = "(min-width: 901px) 270px, (min-width: 561px) 30vw, 46vw";

function cardHTML(p, group, i = 99) {
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
      ${fotoHTML(p.code, { ancho: 400, alto: 317, alt: escHTML(p.name), grande: true, sizes: IMG_SIZES, carga: prioridad })}
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
    badge.textContent = agotado ? "Sin stock" : "";
    // sin stock: en gris y no se puede pedir (solo restar si ya estaba en el pedido)
    card.classList.toggle("agotado", agotado);
    card.querySelectorAll('[data-act="plus"], .qty-input').forEach((b) => { b.disabled = agotado; });
    card.setAttribute("aria-disabled", String(agotado));
  });
}

/* Refresca los inputs con el estado guardado. */
function applyQty() {
  document.querySelectorAll(".qty-input").forEach((inp) => { inp.value = pedido[inp.dataset.code] || 0; });
  pintarCards();
}

/* -------------------- PEDIDO (acciones) -------------------- */
function setQty(code, val) {
  let n = Math.max(0, Math.floor(val || 0));
  if (PRECIOS[code] && PRECIOS[code].agotado && n > (pedido[code] || 0)) { n = pedido[code] || 0; avisar("Ese producto no tiene stock por ahora."); }
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
    tipo_pago: (document.querySelector('input[name="pagoWeb"]:checked') || {}).value || "credito",
    cliente_id: cliente.cliente_id || "",
    latitud: cliente.latitud ?? "",
    longitud: cliente.longitud ?? "",
  };
}

/* -------------------- Seleccionar cliente: buscar (teléfono o RIF) o registrarse -------------------- */
const clienteListo = () => !!((cliente.negocio || cliente.contacto) && String(cliente.telefono || "").replace(/\D/g, "").length >= 7);
function pintarCliente() {
  const listo = clienteListo();
  const enForm = !$id("cliForm").hidden;
  const tieneUbic = cliente.latitud !== "" && cliente.latitud != null && cliente.longitud !== "" && cliente.longitud != null;
  $id("cliElegido").innerHTML = listo && !enForm
    ? `<div class="cli-elegido">
        <span class="avatar">${escHTML(inicial(cliente.negocio || cliente.contacto))}</span>
        <span class="cli-datos"><strong>${escHTML(cliente.negocio || cliente.contacto)}</strong>
          <span>${escHTML([cliente.telefono, cliente.direccion].filter(Boolean).join(" · "))}${tieneUbic ? " · 📍 ubicación" : ""}</span></span>
        <button type="button" class="link-cli" data-cli="editar">Editar</button>
        <button type="button" class="link-cli" data-cli="cambiar">Cambiar</button>
        <button type="button" class="cart-quitar" data-cli="quitar" aria-label="Quitar cliente" title="Quitar">${iconoPapelera}</button>
      </div>`
    : "";
  $id("ubicEstado").textContent = tieneUbic ? "📍 Ubicación lista" : "";
  $id("btnUbic").classList.toggle("lista", tieneUbic);
  const b = $id("btnCliente");
  const abierto = !$id("cliPanel").hidden;
  b.textContent = abierto ? "−" : "+";
  b.setAttribute("aria-expanded", String(abierto));
}
function abrirCliente(modo) {
  // modo: "buscar" (barra de búsqueda + Nuevo) · "form" (registrarse / editar) · "cerrar"
  $id("cliPanel").hidden = modo !== "buscar";
  $id("cliForm").hidden = modo !== "form";
  if (modo === "buscar") { $id("cliRes").textContent = ""; }
  pintarCliente();
}
async function buscarCliente(q) {
  const res = $id("cliRes");
  const dig = String(q || "").replace(/\D/g, "");
  if (dig.length < 6) { res.textContent = "Escribí tu teléfono o RIF completo."; return; }
  res.innerHTML = '<span class="spinner-chico" aria-hidden="true"></span> Buscando…';
  try {
    const r = await SkalaAPI.api("buscarClienteWeb", { q });
    if (!r.cliente) {
      res.innerHTML = "No te encontramos. Tocá <strong>Nuevo · registrarme</strong> para cargar tus datos.";
      $id("btnCliNuevo").classList.remove("pulso"); void $id("btnCliNuevo").offsetWidth; $id("btnCliNuevo").classList.add("pulso");
      return;
    }
    const c = r.cliente;
    Object.assign(cliente, { cliente_id: c.id, negocio: c.negocio, contacto: c.contacto, direccion: c.direccion, rif_cedula: c.rif_cedula,
      telefono: c.telefono || (dig.length >= 7 && !/[a-z]/i.test(q) ? q.trim() : cliente.telefono || ""), latitud: "", longitud: "" });
    saveCliente();
    fillCliente();
    // por RIF no se muestra el teléfono: se pide
    if (!clienteListo()) { abrirCliente("form"); $id("fTelefono").focus(); res.textContent = ""; }
    else abrirCliente("cerrar");
    refreshMessage();
  } catch (e) {
    res.textContent = e.message || "No se pudo buscar. Probá de nuevo.";
  }
}
function tomarUbicacion() {
  const b = $id("btnUbic"), est = $id("ubicEstado");
  if (!navigator.geolocation) { est.textContent = "Este teléfono no permite tomar la ubicación."; return; }
  b.disabled = true; b.classList.add("buscando"); est.textContent = "Buscando tu ubicación…";
  navigator.geolocation.getCurrentPosition((pos) => {
    b.disabled = false; b.classList.remove("buscando");
    cliente.latitud = Math.round(pos.coords.latitude * 1e6) / 1e6;
    cliente.longitud = Math.round(pos.coords.longitude * 1e6) / 1e6;
    saveCliente(); pintarCliente(); refreshMessage();
  }, (err) => {
    b.disabled = false; b.classList.remove("buscando");
    est.textContent = err.code === 1 ? "Permiso de ubicación negado." : "No se pudo tomar la ubicación.";
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
}
function fillCliente() {
  $id("fRif").value = cliente.rif_cedula || cliente.rif || "";
  $id("fNegocio").value = cliente.negocio || "";
  $id("fContacto").value = cliente.contacto || "";
  $id("fDireccion").value = cliente.direccion || "";
  $id("fTelefono").value = cliente.telefono || "";
}

/* Vendedores (después de enviar, el cliente elige a cuál mandarle el pedido por WhatsApp) */
let vendedores = leer(K_VENDEDORES, []) || [];
const inicial = (n) => String(n || "?").trim().charAt(0).toUpperCase();
function cargarVendedores() {
  if (typeof SkalaAPI === "undefined") return;
  SkalaAPI.api("vendedores").then((r) => {
    vendedores = r.vendedores || [];
    guardar(K_VENDEDORES, vendedores);
    if (!$id("listoModal").hidden) pintarListaWa();
  }).catch(() => {});
}

/* -------------------- "Tu pedido" -------------------- */
/* 3 estrellas en triángulo (doradas según la forma de pago) */
function estrellasHTML(n, premium) {
  const est = (on, cls) => `<svg class="estrella ${cls}${on ? " on" : ""}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17l-5.6 3 1.1-6.2-4.6-4.4 6.3-.9z"/></svg>`;
  return `<span class="estrellas" role="img" aria-label="${n} de 3 estrellas${premium ? ", premium" : ""}">${est(n >= 1, "e1")}${est(n >= 2, "e2")}${est(n >= 3, "e3")}</span>${premium ? '<span class="premium">Premium</span>' : ""}`;
}
let pagosAbiertos = false;
function abrirPagos(abrir) {
  pagosAbiertos = abrir === undefined ? !pagosAbiertos : abrir;
  $id("pagosWeb").hidden = !pagosAbiertos;
  const b = $id("btnPagos");
  b.setAttribute("aria-expanded", String(pagosAbiertos));
  const elegido = (document.querySelector('input[name="pagoWeb"]:checked') || {}).value;
  b.textContent = pagosAbiertos ? "Cerrar" : elegido ? "Cambiar" : "Ver opciones";
  $id("pagoElegido").hidden = pagosAbiertos;
}
const iconoPapelera = '<svg viewBox="0 0 24 24" aria-hidden="true"><g class="tapa"><path d="M4 7h16"/><path d="M9 7V4.5h6V7"/></g><path class="tacho" d="M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';

function renderCarrito() {
  const its = itemsConPrecio();
  const total = totalCajas();
  // de inicio, el pago normal (Crédito)
  const sel = (document.querySelector('input[name="pagoWeb"]:checked') || {}).value || cliente.tipo_pago || "credito";
  const tipo = sel;
  const lista = $id("cartList");
  const escribiendo = document.activeElement && document.activeElement.closest && document.activeElement.closest("#cartList");
  const map = allProductsMap();
  const precioTxt = (it) => {
    if (!it.precio) return "";
    const u = precioUnitario(it, tipo);
    return it.cajas >= 2 ? `<span class="pu">${dinero(u)} ×${it.cajas}</span><strong>${dinero(u * it.cajas)}</strong>` : `<strong>${dinero(u)}</strong>`;
  };
  if (!escribiendo || its.length !== lista.children.length) {
    lista.innerHTML = its.map((it) => `
    <li class="cart-item" data-item="${it.code}">
      <span class="cart-foto">${fotoHTML(it.code, { ancho: 44, alto: 44 })}</span>
      <div class="cart-info"><strong>${escHTML(it.producto)}</strong><span>${escHTML(textoUnidadesCorto(map[it.code]))}</span></div>
      <div class="cart-acc">
        <div class="qty qty-chica">
          <button type="button" class="qty-btn" data-act="minus" data-code="${it.code}" aria-label="Restar una caja de ${escHTML(it.producto)}">−</button>
          <input class="qty-input" type="number" min="0" step="1" value="${it.cajas}" data-code="${it.code}" inputmode="numeric" aria-label="Cajas de ${escHTML(it.producto)}" />
          <button type="button" class="qty-btn" data-act="plus" data-code="${it.code}" aria-label="Sumar una caja de ${escHTML(it.producto)}">+</button>
        </div>
        <span class="cart-precio" data-precio-item>${precioTxt(it)}</span>
        <button type="button" class="cart-quitar" data-quitar="${it.code}" aria-label="Quitar ${escHTML(it.producto)} del pedido" title="Quitar">${iconoPapelera}</button>
      </div>
    </li>`).join("");
  } else {
    its.forEach((it) => { const el = lista.querySelector(`[data-item="${it.code}"] [data-precio-item]`); if (el) el.innerHTML = precioTxt(it); });
  }
  const hayPrecio = its.some((it) => it.precio > 0);
  $id("cartNivel").textContent = total >= CAJAS_MAYOR ? `Precio al mayor (${total} cajas).` : `Precio al por menor · desde ${CAJAS_MAYOR} cajas tenés precio al mayor (te faltan ${CAJAS_MAYOR - total}).`;
  $id("cartTotal").innerHTML = `<strong>${total} caja${total === 1 ? "" : "s"}</strong>${hayPrecio ? ` · <strong>${dinero(totalPorPago(its, tipo))}</strong> ${escHTML((pagoPorId(tipo) || {}).nombre || "")}` : ""}`;
  const opciones = totalesPorPago(its);
  const fila = (pg, radio) => `<label class="pay-opt pago-opt${pg.premium ? " es-premium" : ""}">
      ${radio ? `<input type="radio" name="pagoWeb" value="${pg.id}"${pg.id === sel ? " checked" : ""} />` : ""}
      <span class="pago-txt"><strong>${escHTML(pg.nombre)}</strong>${estrellasHTML(pg.estrellas, pg.premium)}<span>${escHTML(pg.ayuda)}</span></span>
      ${hayPrecio ? `<span class="pago-monto"><strong>${dinero(pg.total)}</strong>${pg.ahorro ? `<span>−${dinero(pg.ahorro)}</span>` : ""}</span>` : ""}
    </label>`;
  $id("pagosWeb").innerHTML = opciones.map((pg) => fila(pg, true)).join("");
  const elegido = opciones.find((pg) => pg.id === sel) || opciones[0];
  const pct = descuentoMaximo(its);
  const mejor = opciones[opciones.length - 1];
  $id("pagoElegido").innerHTML = `<button type="button" class="pago-resumen" data-abrir-pagos>${fila(elegido, false).replace(/^<label/, "<span").replace(/<\/label>$/, "</span>")}</button>
    ${pct > 0 && elegido.id !== mejor.id ? `<button type="button" class="hasta-desc" data-abrir-pagos><span>Hasta <strong>${pct}%</strong> de descuento al nivel 3</span>${estrellasHTML(3, false)}</button>` : ""}`;
  abrirPagos(pagosAbiertos);
}

function datosPedidoWeb() {
  const c = collectCliente();
  const v = vendedores.find((x) => x.id === c.vendedor_id);
  return { ref: refActual(), cliente: c, vendedor: v ? v.nombre : "", vendedor_id: c.vendedor_id, items: itemsConPrecio(), tipo_pago: c.tipo_pago };
}

function refreshMessage() { return []; } // (el mensaje se arma al elegir vendedor)

/* -------------------- Enviar -------------------- */
let envio = null; // { modo: "listo" | "whatsapp", ref, datos, enviados: Set }
async function enviarPedido() {
  const d = datosPedidoWeb();
  if (!d.items.length) return;
  const btn = $id("btnEnviarPedido");
  if (clienteListo()) {
    // con datos: el pedido llega a Skala (y a la app de los vendedores)
    btn.disabled = true; btn.classList.add("ocupado"); btn.textContent = "Enviando…";
    try {
      await SkalaAPI.api("pedidoWeb", { ref: d.ref, cliente: d.cliente, tipo_pago: d.tipo_pago,
        items: d.items.map((it) => ({ code: it.code, producto: it.producto, cajas: it.cajas, unidades_caja: it.unidades_caja, unidad: it.unidad })) });
      guardar(K_REF_WEB, { ref: d.ref, enviado: true });
      mostrarEnvio("listo", d);
    } catch (e) {
      if (e && e.code === "limite") { $id("formWarn").textContent = e.message; $id("formWarn").hidden = false; }
      else mostrarEnvio("whatsapp", d, true); // sin conexión: que lo mande por WhatsApp
    } finally {
      btn.disabled = false; btn.classList.remove("ocupado"); btn.textContent = "Enviar pedido";
    }
    return;
  }
  // sin datos: se coordina con el vendedor por WhatsApp
  mostrarEnvio("whatsapp", d);
}
function pintarListaWa() {
  const lista = vendedores.map((v) => ({ id: v.id, nombre: v.nombre, wa: v.whatsapp || "" }));
  lista.push({ id: "", nombre: "No tengo vendedor · escribir a Skala", wa: WHATSAPP_NUMBER, oficina: true });
  $id("listoVend").innerHTML = lista.map((v, i) => `<li><button type="button" class="vend-wa${envio && envio.enviados.has(i) ? " enviado" : ""}" data-wa="${i}" aria-label="Enviar por WhatsApp a ${escHTML(v.nombre)}">
      <span class="avatar${v.oficina ? " oficina" : ""}">${v.oficina ? "S" : escHTML(inicial(v.nombre))}</span>
      <strong>${escHTML(v.nombre)}</strong>
      <span class="flecha" aria-hidden="true">${envio && envio.enviados.has(i) ? "✓" : '<svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg>'}</span>
    </button></li>`).join("");
  pintarListaWa.lista = lista;
}
function mostrarEnvio(modo, datos, sinConexion) {
  envio = { modo, ref: datos.ref, datos, enviados: new Set() };
  const m = $id("listoModal");
  $id("orderModal").hidden = true;
  m.classList.toggle("es-listo", modo === "listo");
  m.classList.toggle("es-wa", modo === "whatsapp");
  if (modo === "listo") {
    $id("listoAnim").innerHTML = '<svg viewBox="0 0 52 52" class="check"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-15"/></svg>';
    $id("listoTit").textContent = "¡Listo!";
    $id("listoSub").textContent = "Tu pedido llegó a Skala. Te contactamos pronto.";
    $id("listoPreg").textContent = "¿Deseas también enviarlo por WhatsApp a tu vendedor?";
    lanzarConfeti();
  } else {
    $id("listoAnim").innerHTML = '<svg viewBox="0 0 52 52" class="wa"><circle cx="26" cy="26" r="24"/><path d="M17 36l1.6-5A10 10 0 1 1 22 34.4z"/><path d="M22.5 21.5c.5 2.5 2.5 5 5.5 6.2l1.5-1.5 2.2 1.1-.6 1.9c-4.5.3-9.5-4.4-9.7-8.9l1.9-.6 1 2.3z"/></svg>';
    $id("listoTit").textContent = "Enviar al vendedor por WhatsApp";
    $id("listoSub").innerHTML = sinConexion
      ? "No pudimos conectar con Skala. Mandá tu pedido por WhatsApp y <strong>coordiná los datos necesarios con tu vendedor de confianza</strong>."
      : "<strong>Coordiná los datos necesarios con tu vendedor de confianza.</strong>";
    $id("listoPreg").textContent = "Elegí tu vendedor:";
    $id("confeti").innerHTML = "";
  }
  pintarListaWa();
  cargarVendedores();
  m.hidden = false;
  document.body.classList.add("modal-open");
  m.querySelector(".modal-box").focus({ preventScroll: true });
}
function lanzarConfeti() {
  const c = $id("confeti");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { c.innerHTML = ""; return; }
  const colores = ["#7ab648", "#e94e8c", "#f5822a", "#f5b301", "#4a90d9", "#a05bd0"];
  c.innerHTML = Array.from({ length: 46 }, (_, i) => {
    const x = Math.round(Math.random() * 100), d = (Math.random() * 0.5).toFixed(2), t = (1.3 + Math.random() * 0.9).toFixed(2), r = Math.round(Math.random() * 360);
    return `<i style="left:${x}%;background:${colores[i % colores.length]};animation-delay:${d}s;animation-duration:${t}s;transform:rotate(${r}deg)"></i>`;
  }).join("");
}
function enviarWhatsappA(i) {
  const v = (pintarListaWa.lista || [])[i];
  if (!v || !envio) return;
  const msg = mensajeWeb({ ...envio.datos, vendedor: v.oficina ? "" : v.nombre });
  const numero = v.wa || WHATSAPP_NUMBER;
  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  // si el pedido ya llegó a Skala, queda asignado a ese vendedor
  if (envio.modo === "listo" && v.id) SkalaAPI.enviarSinEsperar("asignarVendedorWeb", { id: envio.ref, vendedor_id: v.id });
  envio.enviados.add(i);
  pintarListaWa();
}
function cerrarEnvio() {
  const m = $id("listoModal");
  if (m.hidden) return false;
  m.hidden = true;
  $id("confeti").innerHTML = "";
  document.body.classList.remove("modal-open");
  // pedido entregado a Skala: se empieza uno nuevo
  if (envio && envio.modo === "listo") vaciarPedido();
  envio = null;
  return true;
}

function openModal() {
  if (totalCajas() <= 0) return;
  fillCliente();
  abrirCliente(clienteListo() ? "cerrar" : "cerrar");
  pagosAbiertos = false;
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
  img.onerror = () => { img.onerror = null; img.src = p.nuevo ? fotoVacia(p.name) : `assets/img/${code}.png`; };
  img.src = fotoGrande(code);
  img.alt = p.name;
  $id("zoomTitulo").textContent = p.name;
  $id("zoomSub").textContent = `${code} · ${textoUnidades(p)} · ${p.hair}`;
  zoomFoco = document.activeElement;
  // la foto crece desde la tarjeta tocada
  const desde = document.querySelector(`.card[data-card="${code}"] .card-img`);
  if (desde) {
    const r = desde.getBoundingClientRect();
    m.style.setProperty("--zx", `${r.left + r.width / 2 - innerWidth / 2}px`);
    m.style.setProperty("--zy", `${r.top + r.height / 2 - innerHeight / 2}px`);
  }
  m.classList.remove("cerrando");
  m.hidden = false;
  void m.offsetWidth;
  m.classList.add("abierto");
  document.body.classList.add("modal-open");
  $id("zoomCerrar").focus({ preventScroll: true });
}
function cerrarZoom() {
  const m = $id("zoomModal");
  if (!m || m.hidden || m.classList.contains("cerrando")) return !!(m && !m.hidden);
  m.classList.remove("abierto");
  m.classList.add("cerrando");
  const fin = () => { m.hidden = true; m.classList.remove("cerrando"); };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) fin(); else setTimeout(fin, 220);
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
  const guardado = SkalaAPI.catalogoGuardado();
  if (guardado && sumarProductosNuevos(guardado.productos)) renderTodo();
  PRECIOS = SkalaAPI.preciosMapa(guardado);
  pintarCards(); updateBar();
  SkalaAPI.catalogo().then((d) => {
    PRECIOS = SkalaAPI.preciosMapa(d);
    if (sumarProductosNuevos(d.productos)) renderTodo();
    pintarCards(); updateBar();
    if (!$id("orderModal").hidden) { renderCarrito(); refreshMessage(); }
  }).catch(() => {});
}

/* Dibuja las dos grillas respetando el filtro elegido */
function renderTodo() {
  const act = document.querySelector("#filterBanos .filter.active");
  const f = act ? act.dataset.filter : "all";
  render("gridBanos", f === "all" ? BANOS : BANOS.filter((p) => p.line === f), "Baño de crema 1kg");
  render("gridKits", KITS, "Kit shampoo + acondicionador");
  applyQty();
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
    if (quitar) {
      const li = quitar.closest(".cart-item");
      if (!li || li.classList.contains("saliendo")) return;
      quitar.classList.add("tirando");
      li.classList.add("saliendo");
      setTimeout(() => setQty(quitar.dataset.quitar, 0), 320);
      return;
    }
    /* Tocar la tarjeta suma una caja */
    const card = e.target.closest(".card[data-card]");
    if (card && !e.target.closest(".card-order, a, input, button")) {
      const code = card.dataset.card;
      if (PRECIOS[code] && PRECIOS[code].agotado) { avisar("Ese producto no tiene stock por ahora."); return; }
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
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !cerrarZoom() && !cerrarEnvio()) closeModal(); });
  $id("zoomModal").addEventListener("click", (e) => { if (e.target.id === "zoomModal" || e.target.closest("#zoomCerrar")) cerrarZoom(); });

  /* Datos del cliente: guardar y refrescar el mensaje en vivo */
  const alCambiar = (e) => {
    Object.assign(cliente, collectCliente());
    saveCliente();
    if (e && e.target && e.target.name === "pagoWeb") renderCarrito();
    const falta = refreshMessage();
    if (!$id("formWarn").hidden && !falta.length) $id("formWarn").hidden = true;
  };
  ["fRif", "fNegocio", "fContacto", "fDireccion", "fTelefono"].forEach((id) => $id(id).addEventListener("input", alCambiar));
  $id("pagosWeb").addEventListener("change", (e) => { alCambiar(e); abrirPagos(false); });
  $id("btnPagos").addEventListener("click", () => abrirPagos());
  $id("pagoElegido").addEventListener("click", (e) => { if (e.target.closest("[data-abrir-pagos]")) abrirPagos(true); });
  $id("btnCliente").addEventListener("click", () => abrirCliente($id("cliPanel").hidden ? "buscar" : "cerrar"));
  $id("fCliBuscar").addEventListener("submit", (e) => { e.preventDefault(); buscarCliente($id("cliBuscar").value); });
  $id("btnCliNuevo").addEventListener("click", () => {
    // nuevo cliente: datos en blanco (se conserva lo escrito si ya era nuevo)
    if (cliente.cliente_id) { cliente = { telefono: cliente.telefono }; saveCliente(); fillCliente(); }
    abrirCliente("form");
    $id("fNegocio").focus();
  });
  $id("btnCliListo").addEventListener("click", () => {
    if (!clienteListo()) { $id("formWarn").innerHTML = "Para continuar falta: <strong>nombre del negocio y teléfono</strong>"; $id("formWarn").hidden = false; return; }
    abrirCliente("cerrar");
  });
  $id("cliElegido").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cli]");
    if (!b) return;
    if (b.dataset.cli === "quitar") {
      // misma animación de la papelera: se sacude y la ficha sale deslizándose
      const ficha = b.closest(".cli-elegido");
      if (!ficha || ficha.classList.contains("saliendo")) return;
      b.classList.add("tirando");
      ficha.classList.add("saliendo");
      setTimeout(() => {
        cliente = { tipo_pago: cliente.tipo_pago };
        saveCliente(); fillCliente();
        abrirCliente("cerrar");
        refreshMessage();
      }, 320);
      return;
    }
    abrirCliente(b.dataset.cli === "editar" ? "form" : "buscar");
  });
  $id("btnUbic").addEventListener("click", tomarUbicacion);
  /* Enviar (un solo botón) y la ventana de después */
  $id("btnEnviarPedido").addEventListener("click", enviarPedido);
  $id("listoVend").addEventListener("click", (e) => { const b = e.target.closest("[data-wa]"); if (b) enviarWhatsappA(Number(b.dataset.wa)); });
  $id("btnListoCerrar").addEventListener("click", cerrarEnvio);
  $id("listoModal").addEventListener("click", (e) => { if (e.target.id === "listoModal") cerrarEnvio(); });

  /* Papelera: borrar toda la selección */
  $id("btnClear").addEventListener("click", vaciarPedido);

  /* Link de WhatsApp de la sección contacto */
  const cw = $id("contactWhatsapp");
  if (cw) cw.href = `https://wa.me/${WHATSAPP_NUMBER}`;

  applyQty();
  updateBar();
});
