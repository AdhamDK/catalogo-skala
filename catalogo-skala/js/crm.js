/* ============================================================
   Skala — CRM de pedidos (Google Sheets) con roles
   Master · Administración · Vendedor · Despachador
   Spec: docs/specs/modo-vendedor-crm.md · Backend: crm/Code.gs
   ============================================================ */

/* ⚠️ Pegar aquí la URL de la App web de Apps Script (termina en /exec). */
const CRM_API_URL = "";

(function () {
  const API = window.SKALA_CRM_URL || CRM_API_URL;
  const K_SESION = "skala_sesion_v2";
  const K_COLA = "skala_cola_v1";       // pedidos sin subir (sin señal)
  const K_CLIENTE = "skala_vcliente_v1"; // borrador del formulario
  const K_ULTIMO = "skala_ultimo_usuario";

  const $ = (id) => document.getElementById(id);
  const leerLS = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch (e) { return def; } };
  const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const borrarLS = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* -------------------- Sesión -------------------- */
  function sesion() {
    const s = leerLS(K_SESION, null);
    if (!s || !s.token || !s.usuario || expiracionToken(s.token) < Date.now()) return null;
    return s;
  }
  const rol = () => (sesion() || { usuario: {} }).usuario.rol;

  function cerrarSesion() {
    borrarLS(K_SESION);
    pintarSesion();
    cerrarTodo();
    toast("Sesión cerrada");
  }
  function pintarSesion() {
    const s = sesion();
    const btn = $("btnCuenta");
    btn.textContent = s ? s.usuario.nombre : "Ingresar";
    btn.classList.toggle("con-sesion", !!s);
    btn.setAttribute("aria-label", s ? `Panel de ${s.usuario.nombre} (${s.usuario.rol_nombre})` : "Ingresar");
    document.querySelectorAll(".js-quien").forEach((e) => {
      e.innerHTML = s ? `${esc(s.usuario.nombre)} · ${esc(s.usuario.rol_nombre)} · <button type="button" class="link-btn js-salir">Salir</button>` : "";
    });
  }

  /* -------------------- API -------------------- */
  class ErrorRed extends Error {}
  async function api(action, datos = {}) {
    if (!API) throw new Error("El CRM no está configurado (falta CRM_API_URL en js/crm.js).");
    const s = sesion();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    let r;
    try {
      // text/plain evita el "preflight" CORS que Apps Script no soporta
      r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, token: s && s.token, ...datos }),
        signal: ctrl.signal,
        redirect: "follow",
      });
    } catch (e) {
      throw new ErrorRed("Sin conexión con el servidor.");
    } finally {
      clearTimeout(t);
    }
    if (!r.ok) throw new ErrorRed("El servidor no respondió (" + r.status + ").");
    const j = await r.json();
    if (!j.ok) {
      if (j.code === "auth") { borrarLS(K_SESION); pintarSesion(); }
      const err = new Error(j.error || "Error del servidor");
      err.code = j.code;
      throw err;
    }
    return j;
  }

  /* -------------------- Modales -------------------- */
  const MODALES = ["modoModal", "loginModal", "vendModal", "panelModal", "asignarModal", "usuarioModal"];
  const SOBRE = ["asignarModal", "usuarioModal"]; // se abren encima del panel
  function abrir(id) {
    if (!SOBRE.includes(id)) MODALES.forEach((m) => { if (m !== id) $(m).hidden = true; });
    if (typeof closeModal === "function") closeModal();
    $(id).hidden = false;
    document.body.classList.add("modal-open");
    const box = $(id).querySelector(".modal-box");
    box.scrollTop = 0;
    box.focus({ preventScroll: true });
  }
  function cerrar(id) {
    $(id).hidden = true;
    if (MODALES.every((m) => $(m).hidden) && $("orderModal").hidden) document.body.classList.remove("modal-open");
  }
  function cerrarTodo() { MODALES.forEach(cerrar); }

  let toastT = null;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => (t.hidden = true), 3500);
  }
  function mostrarError(id, msg) {
    const el = $(id);
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  /* -------------------- Ingresar -------------------- */
  let alEntrar = null;
  function pedirLogin(despues) {
    alEntrar = despues || null;
    mostrarError("loginError", "");
    $("loginPin").value = "";
    $("loginUsuario").value = leerLS(K_ULTIMO, "");
    abrir("loginModal");
    ($("loginUsuario").value ? $("loginPin") : $("loginUsuario")).focus();
  }

  async function enviarLogin(ev) {
    ev.preventDefault();
    const usuario = $("loginUsuario").value.trim();
    const pin = $("loginPin").value.trim();
    if (!usuario) return mostrarError("loginError", "Escribí tu usuario.");
    if (!/^\d{4,6}$/.test(pin)) return mostrarError("loginError", "El PIN tiene de 4 a 6 números.");
    const btn = $("btnLogin");
    btn.disabled = true; btn.textContent = "Entrando…";
    try {
      const r = await api("login", { usuario, pin });
      guardarLS(K_SESION, { token: r.token, usuario: r.usuario });
      guardarLS(K_ULTIMO, r.usuario.usuario);
      pintarSesion();
      cerrar("loginModal");
      toast(`Hola, ${r.usuario.nombre} (${r.usuario.rol_nombre})`);
      subirCola();
      const f = alEntrar; alEntrar = null;
      (f || abrirPanel)();
    } catch (e) {
      mostrarError("loginError", e.message);
      $("loginPin").value = "";
    } finally {
      btn.disabled = false; btn.textContent = "Entrar";
    }
  }

  function conSesion(f) { return () => (sesion() ? f() : pedirLogin(f)); }

  /* -------------------- "Armar pedido" -------------------- */
  function elegirModo() {
    if (totalCajas() <= 0) return;
    const s = sesion();
    if (s && puedeTomarPedidos(s.usuario.rol)) return abrirPedido();
    abrir("modoModal");
  }

  /* -------------------- Nuevo pedido -------------------- */
  const abrirPedido = conSesion(() => {
    if (!puedeTomarPedidos(rol())) { cerrarTodo(); return toast("Tu usuario no toma pedidos."); }
    const items = itemsDePedido(pedido, allProductsMap());
    if (!items.length) { cerrarTodo(); return toast("Elegí los productos en el catálogo y tocá Armar pedido."); }
    $("vendPaso1").hidden = false;
    $("vendPaso2").hidden = true;
    $("btnGuardar").hidden = false;
    ["btnGrupo", "btnCopiaCliente", "btnIrPanel"].forEach((b) => ($(b).hidden = true));
    $("vendTitulo").textContent = "Nuevo pedido";
    mostrarError("vError", "");
    const total = items.reduce((a, it) => a + it.cajas, 0);
    $("vendResumen").textContent = `${total} caja${total === 1 ? "" : "s"} · ` + items.map((it) => `${it.cajas} × ${it.producto}`).join(", ");
    llenarCliente(leerLS(K_CLIENTE, {}));
    abrir("vendModal");
  });

  const CAMPOS = { vClienteId: "id", vContacto: "contacto", vNegocio: "negocio", vRif: "rif_cedula", vTel1: "telefono", vTel2: "telefono2", vDireccion: "direccion", vLat: "latitud", vLng: "longitud" };
  function leerCliente() {
    const c = {};
    Object.entries(CAMPOS).forEach(([id, k]) => (c[k] = $(id).value.trim()));
    return c;
  }
  function llenarCliente(c) {
    Object.entries(CAMPOS).forEach(([id, k]) => {
      const v = k === "negocio" ? (c.negocio ?? c.nombre) : c[k];
      $(id).value = v ?? "";
    });
    const sel = $("vClienteSel");
    sel.hidden = !c.id;
    if (c.id) sel.textContent = `Cliente existente: ${c.negocio || c.nombre || c.contacto}. Podés corregir sus datos.`;
    pintarGps();
  }
  function guardarBorrador() { guardarLS(K_CLIENTE, leerCliente()); }

  let buscarT = null, ultimaBusqueda = "";
  function buscar() {
    clearTimeout(buscarT);
    const q = $("vBuscar").value.trim();
    if (q.length < 2) { $("vResultados").hidden = true; return; }
    buscarT = setTimeout(async () => {
      ultimaBusqueda = q;
      try {
        const r = await api("clientes", { q });
        if (q !== ultimaBusqueda) return;
        const ul = $("vResultados");
        ul.innerHTML = r.clientes.length
          ? r.clientes.map((c, i) => `<li><button type="button" data-i="${i}"><strong>${esc(c.nombre)}</strong><span>${esc([c.contacto, c.telefono, c.direccion].filter(Boolean).join(" · "))}</span></button></li>`).join("")
          : '<li class="vacio">Sin resultados. Cargá los datos abajo como cliente nuevo.</li>';
        ul.hidden = false;
        ul.onclick = (e) => {
          const b = e.target.closest("button[data-i]");
          if (!b) return;
          llenarCliente(r.clientes[Number(b.dataset.i)]);
          guardarBorrador();
          ul.hidden = true;
          $("vBuscar").value = "";
        };
      } catch (e) { /* sin señal: se carga a mano */ }
    }, 350);
  }

  function pintarGps(precision) {
    const lat = $("vLat").value, lng = $("vLng").value;
    $("gpsEstado").innerHTML = lat && lng
      ? `Ubicación lista${precision ? ` (±${Math.round(precision)} m)` : ""} · <a href="${esc(linkMapa(lat, lng))}" target="_blank" rel="noopener">ver mapa</a>`
      : "Sin ubicación";
    $("btnGps").textContent = lat && lng ? "Volver a tomar ubicación" : "Tomar ubicación GPS del cliente";
  }
  function tomarGps() {
    if (!navigator.geolocation) return toast("Este teléfono no permite GPS en el navegador.");
    const btn = $("btnGps");
    btn.disabled = true; btn.textContent = "Buscando GPS…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        $("vLat").value = pos.coords.latitude.toFixed(6);
        $("vLng").value = pos.coords.longitude.toFixed(6);
        btn.disabled = false;
        pintarGps(pos.coords.accuracy);
        guardarBorrador();
      },
      (err) => {
        btn.disabled = false;
        pintarGps();
        toast(err.code === 1 ? "Permiso de ubicación negado. Activalo en el navegador." : "No se pudo obtener el GPS. Probá al aire libre.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
    );
  }

  const pagoElegido = () => (document.querySelector('input[name="vPago"]:checked') || {}).value || "";

  let ultimo = null; // { pedido, cliente, mensaje }
  async function guardarPedido(ev) {
    ev.preventDefault();
    const cliente = leerCliente();
    const faltan = validarCliente(cliente);
    if (faltan.length) return mostrarError("vError", "Falta: " + faltan.join(" · "));
    const items = itemsDePedido(pedido, allProductsMap());
    if (!items.length) return mostrarError("vError", "No hay productos en el pedido.");
    mostrarError("vError", "");

    const datos = { client_ref: nuevoRef(), cliente, items, pago: pagoElegido(), nota: $("vNota").value.trim() };
    const btn = $("btnGuardar");
    btn.disabled = true; btn.textContent = "Guardando…";
    try {
      const r = await api("guardarPedido", datos);
      terminado(r.pedido, r.cliente || cliente, false);
    } catch (e) {
      if (e instanceof ErrorRed) {
        const cola = leerLS(K_COLA, []);
        cola.push({ ...datos, guardado: new Date().toISOString() });
        guardarLS(K_COLA, cola);
        terminado(null, cliente, true);
      } else if (e.code === "auth") {
        pedirLogin(() => abrir("vendModal"));
      } else {
        mostrarError("vError", e.message);
      }
    } finally {
      btn.disabled = false; btn.textContent = "Guardar pedido";
    }
  }

  function terminado(ped, cliente, offline) {
    vaciarPedido();
    borrarLS(K_CLIENTE);
    $("vNota").value = "";
    document.querySelectorAll('input[name="vPago"]').forEach((r) => (r.checked = false));
    $("vendPaso1").hidden = true;
    $("vendPaso2").hidden = false;
    $("btnGuardar").hidden = true;
    $("btnIrPanel").hidden = false;
    $("vendResumen").textContent = "";
    if (offline) {
      $("vendTitulo").textContent = "Guardado en el teléfono";
      $("vendOk").textContent = "No hay señal. El pedido quedó guardado en este teléfono y se subirá solo cuando vuelva la conexión (o desde el panel → Subir ahora). Después podrás enviarlo al grupo.";
      $("vMensajeWrap").hidden = true;
      $("btnGrupo").hidden = true;
      $("btnCopiaCliente").hidden = true;
      return;
    }
    $("vMensajeWrap").hidden = false;
    const mensaje = mensajeGrupo(ped, cliente);
    ultimo = { pedido: ped, cliente, mensaje };
    $("vMensaje").value = mensaje;
    $("btnGrupo").hidden = false;
    const tel = telefonoWhatsapp(cliente.telefono);
    const copia = $("btnCopiaCliente");
    copia.hidden = !tel;
    if (tel) copia.href = `https://wa.me/${tel}?text=${encodeURIComponent("Hola! Te comparto el resumen de tu pedido Skala:\n\n" + mensaje)}`;
    $("vendTitulo").textContent = `Pedido ${ped.id} guardado`;
    $("vendOk").textContent = "Quedó registrado en la hoja de pedidos. Ahora envialo al grupo de la empresa.";
  }

  /* Menú de compartir del teléfono (se elige el grupo) o wa.me sin número */
  async function enviarAlGrupo(mensaje) {
    if (navigator.share) {
      try { await navigator.share({ text: mensaje }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener");
  }

  /* -------------------- Cola sin señal -------------------- */
  let subiendo = false;
  async function subirCola() {
    const cola = leerLS(K_COLA, []);
    if (!cola.length || subiendo || !sesion()) { pintarCola(); return []; }
    subiendo = true;
    const subidos = [];
    try {
      for (const p of cola.slice()) {
        try {
          const { guardado, vendedor, ...datos } = p;
          subidos.push(await api("guardarPedido", datos));
          guardarLS(K_COLA, leerLS(K_COLA, []).filter((x) => x.client_ref !== p.client_ref));
        } catch (e) {
          if (e instanceof ErrorRed || e.code === "auth") break;
        }
      }
    } finally {
      subiendo = false;
      pintarCola();
    }
    if (subidos.length) toast(`${subidos.length} pedido(s) subido(s). Envialos al grupo desde el panel.`);
    return subidos;
  }
  function pintarCola() {
    const n = leerLS(K_COLA, []).length;
    $("pendSubir").hidden = !n;
    $("pendSubirTxt").textContent = `${n} pedido${n === 1 ? "" : "s"} sin subir (sin señal)`;
  }

  /* -------------------- Panel -------------------- */
  let tabActual = null;
  let listaPedidos = [];
  let diasResumen = 30;

  const abrirPanel = conSesion(async () => {
    const r = rol();
    const tabs = pestanasPanel(r);
    if (!tabs.find((t) => t.id === tabActual)) tabActual = tabs[0].id;
    $("panelTitulo").textContent = { master: "Panel Master", admin: "Administración", vendedor: "Mis pedidos", despachador: "Mis entregas" }[r] || "Panel";
    $("panelTabs").innerHTML = tabs.map((t) =>
      `<button type="button" role="tab" class="tab${t.id === tabActual ? " active" : ""}" data-tab="${t.id}" aria-selected="${t.id === tabActual}">${esc(t.nombre)}</button>`).join("");
    $("btnNuevoPedido").hidden = !puedeTomarPedidos(r);
    abrir("panelModal");
    await subirCola();
    cargarTab();
  });

  function cargarTab() {
    const tab = pestanasPanel(rol()).find((t) => t.id === tabActual);
    if (!tab) return;
    if (tab.id === "resumen") return cargarResumen();
    if (tab.id === "usuarios") return cargarUsuarios();
    return cargarPedidos(tab.estados);
  }

  async function cargarPedidos(estados) {
    const cont = $("panelContenido");
    cont.innerHTML = '<p class="modal-sub">Cargando…</p>';
    try {
      const r = await api("pedidos", { estados, dias: 60 });
      listaPedidos = r.pedidos;
      cont.innerHTML = r.pedidos.length
        ? `<p class="modal-sub">${r.pedidos.length} pedido(s)</p><ul class="pedidos-lista">${r.pedidos.map(tarjetaPedido).join("")}</ul>`
        : '<p class="vacio-panel">No hay pedidos en esta lista.</p>';
    } catch (e) {
      cont.innerHTML = `<p class="form-warn">${esc(e.message)}</p>`;
      if (e.code === "auth") pedirLogin(abrirPanel);
    }
  }

  const ETIQUETAS = { confirmar: "Confirmar", en_ruta: "En ruta", entregado: "Entregado", reasignar: "Cambiar despachador", cancelar: "Cancelar", reabrir: "Reabrir" };
  function tarjetaPedido(p, i) {
    const s = sesion();
    const r = s.usuario.rol;
    const c = p.cliente_datos || {};
    const tel = String(c.telefono || "").replace(/[^\d+]/g, "");
    const mapa = linkMapa(c.latitud, c.longitud);
    const acciones = accionesPedido(r, s.usuario.id, p);
    const principal = ["confirmar", "en_ruta", "entregado"];
    const items = (p.items || []).map((it) => `<li>${esc(it.cajas)} × ${esc(it.producto)} <span>(${esc(it.code)})</span></li>`).join("");
    return `<li class="ped ped-${esc(p.estado)}">
      <div class="ped-top"><strong>${esc(p.id)}</strong><span class="ped-estado">${esc(nombreEstado(p.estado))}</span></div>
      <div class="ped-cli">${esc(p.negocio)}${p.cliente && p.cliente !== p.negocio ? " · " + esc(p.cliente) : ""}</div>
      <div class="ped-det">${esc(fechaLegible(p.fecha))} · ${esc(p.total_cajas)} caja(s)${p.detalle_unidades ? " · " + esc(p.detalle_unidades) : ""}</div>
      ${r !== "vendedor" ? `<div class="ped-det">Vendedor: ${esc(p.vendedor)}${p.despachador ? ` · Despacha: ${esc(p.despachador)}` : ""}</div>` : p.despachador ? `<div class="ped-det">Despacha: ${esc(p.despachador)}</div>` : ""}
      ${c.direccion ? `<div class="ped-det">${esc(c.direccion)}</div>` : ""}
      ${p.pago ? `<div class="ped-det">Pago: ${esc(p.pago)}</div>` : ""}
      ${p.nota ? `<div class="ped-det">Nota: ${esc(p.nota)}</div>` : ""}
      ${p.motivo ? `<div class="ped-det">Motivo: ${esc(p.motivo)}</div>` : ""}
      ${items ? `<details class="ped-items"><summary>Ver productos</summary><ul>${items}</ul></details>` : ""}
      <div class="ped-links">
        ${tel ? `<a href="tel:${esc(tel)}">Llamar</a>` : ""}
        ${mapa ? `<a href="${esc(mapa)}" target="_blank" rel="noopener">Mapa</a>` : ""}
        <button type="button" class="link-btn" data-acc="grupo" data-i="${i}">Reenviar al grupo</button>
      </div>
      ${acciones.length ? `<div class="ped-acciones">${acciones.map((a) =>
        `<button type="button" class="btn ${principal.includes(a) ? "btn-primary" : "btn-ghost"}" data-acc="${a}" data-i="${i}">${ETIQUETAS[a]}</button>`).join("")}</div>` : ""}
    </li>`;
  }

  async function cambiarEstado(p, estado, extra = {}) {
    await api("estado", { pedido_id: p.id, estado, ...extra });
    toast(`${p.id}: ${nombreEstado(estado)}`);
    cargarTab();
  }

  async function accionPedido(e) {
    const b = e.target.closest("[data-acc]");
    if (!b) return;
    const p = listaPedidos[Number(b.dataset.i)];
    if (!p) return;
    const acc = b.dataset.acc;
    if (acc === "grupo") return enviarAlGrupo(mensajeGrupo(p, p.cliente_datos));
    if (acc === "confirmar" || acc === "reasignar") return abrirAsignar(p, acc);
    try {
      b.disabled = true;
      if (acc === "cancelar") {
        const motivo = (window.prompt(`Motivo de cancelación de ${p.id}:`) || "").trim();
        if (!motivo) { b.disabled = false; return; }
        await cambiarEstado(p, "cancelado", { motivo });
      } else if (acc === "reabrir") {
        if (!window.confirm(`¿Volver ${p.id} a PENDIENTE?`)) { b.disabled = false; return; }
        await cambiarEstado(p, "pendiente");
      } else if (acc === "entregado") {
        if (!window.confirm(`¿Marcar ${p.id} como ENTREGADO?`)) { b.disabled = false; return; }
        await cambiarEstado(p, "entregado");
      } else if (acc === "en_ruta") {
        await cambiarEstado(p, "en_ruta");
      }
    } catch (err) {
      b.disabled = false;
      toast(err.message);
    }
  }

  /* Confirmar / cambiar despachador */
  let asignando = null;
  async function abrirAsignar(p, modo) {
    asignando = { p, modo };
    $("asignarTitulo").textContent = modo === "confirmar" ? `Confirmar ${p.id}` : `Cambiar despachador de ${p.id}`;
    $("asignarSub").textContent = `${p.negocio} · ${p.total_cajas} caja(s)`;
    $("btnAsignar").textContent = modo === "confirmar" ? "Confirmar" : "Guardar";
    mostrarError("asignarError", "");
    const sel = $("asignarDespachador");
    sel.innerHTML = '<option value="">Cargando…</option>';
    abrir("asignarModal");
    try {
      const r = await api("despachadores");
      sel.innerHTML = r.despachadores.length
        ? '<option value="">Elegí quién lo lleva</option>' + r.despachadores.map((d) =>
          `<option value="${esc(d.id)}"${d.id === p.despachador_id ? " selected" : ""}>${esc(d.nombre)}</option>`).join("")
        : '<option value="">No hay despachadores activos</option>';
    } catch (e) {
      mostrarError("asignarError", e.message);
    }
  }
  async function enviarAsignar(ev) {
    ev.preventDefault();
    if (!asignando) return;
    const despachador_id = $("asignarDespachador").value;
    if (!despachador_id) return mostrarError("asignarError", "Elegí un despachador.");
    const { p, modo } = asignando;
    const btn = $("btnAsignar");
    btn.disabled = true;
    try {
      await cambiarEstado(p, modo === "confirmar" ? "confirmado" : p.estado, { despachador_id });
      cerrar("asignarModal");
    } catch (e) {
      mostrarError("asignarError", e.message);
    } finally {
      btn.disabled = false;
    }
  }

  /* Resumen */
  async function cargarResumen() {
    const cont = $("panelContenido");
    const periodos = [[1, "Hoy"], [7, "7 días"], [30, "30 días"]];
    const chips = `<div class="periodos">${periodos.map(([d, t]) =>
      `<button type="button" class="tab${d === diasResumen ? " active" : ""}" data-dias="${d}">${t}</button>`).join("")}</div>`;
    cont.innerHTML = chips + '<p class="modal-sub">Cargando…</p>';
    try {
      const r = await api("resumen", { dias: diasResumen });
      const pe = r.por_estado;
      const tile = (n, t) => `<div class="stat"><strong>${esc(n)}</strong><span>${esc(t)}</span></div>`;
      const tabla = (filas, cols) => filas.length
        ? `<table class="tabla"><thead><tr>${cols.map((c) => `<th>${esc(c[0])}</th>`).join("")}</tr></thead><tbody>${filas.map((f) =>
          `<tr>${cols.map((c) => `<td>${esc(f[c[1]])}</td>`).join("")}</tr>`).join("")}</tbody></table>`
        : '<p class="modal-sub">Sin datos en este período.</p>';
      cont.innerHTML = chips +
        `<div class="stats">${tile(r.total_pedidos, "pedidos")}${tile(r.total_cajas, "cajas")}${tile(pe.entregado, "entregados")}${tile(pe.pendiente + pe.confirmado + pe.en_ruta, "en proceso")}</div>` +
        `<p class="modal-sub">Pendientes ${pe.pendiente} · Confirmados ${pe.confirmado} · En ruta ${pe.en_ruta} · Cancelados ${pe.cancelado}</p>` +
        (r.por_vendedor.length ? `<h4 class="sub-titulo">Por vendedor</h4>${tabla(r.por_vendedor, [["Vendedor", "vendedor"], ["Pedidos", "pedidos"], ["Cajas", "cajas"]])}` : "") +
        `<h4 class="sub-titulo">Productos más pedidos</h4>${tabla(r.por_producto, [["Producto", "producto"], ["Cajas", "cajas"]])}` +
        '<p class="nota-chica">Los cancelados no suman cajas.</p>';
    } catch (e) {
      cont.innerHTML = chips + `<p class="form-warn">${esc(e.message)}</p>`;
    }
  }

  /* Usuarios (solo Master) */
  let listaUsuarios = [];
  async function cargarUsuarios() {
    const cont = $("panelContenido");
    cont.innerHTML = '<p class="modal-sub">Cargando…</p>';
    try {
      const r = await api("usuarios");
      listaUsuarios = r.usuarios;
      const orden = { master: 0, admin: 1, vendedor: 2, despachador: 3 };
      const lista = r.usuarios.slice().sort((a, b) => orden[a.rol] - orden[b.rol] || a.nombre.localeCompare(b.nombre));
      cont.innerHTML = `<button type="button" class="btn btn-primary btn-bloque" id="btnNuevoUsuario">Nuevo usuario</button>
        <ul class="usuarios-lista">${lista.map((u) => `<li class="${u.activo ? "" : "inactivo"}">
          <div><strong>${esc(u.nombre)}</strong> <span class="ped-det">@${esc(u.usuario)}</span></div>
          <div class="ped-det"><span class="rol rol-${esc(u.rol)}">${esc(u.rol_nombre)}</span>${u.activo ? "" : " · Inactivo"}</div>
          <button type="button" class="btn btn-ghost" data-editar="${esc(u.id)}">Editar</button>
        </li>`).join("")}</ul>`;
    } catch (e) {
      cont.innerHTML = `<p class="form-warn">${esc(e.message)}</p>`;
    }
  }
  function abrirUsuario(u) {
    $("usuarioTitulo").textContent = u ? `Editar ${u.nombre}` : "Nuevo usuario";
    $("uId").value = u ? u.id : "";
    $("uUsuario").value = u ? u.usuario : "";
    $("uNombre").value = u ? u.nombre : "";
    $("uRol").value = u ? u.rol : "vendedor";
    $("uPin").value = "";
    $("uActivo").checked = u ? u.activo : true;
    $("uPinLabel").textContent = u ? "PIN nuevo (dejar vacío para no cambiarlo)" : "PIN (4 a 6 números; Master: 6)";
    mostrarError("usuarioError", "");
    abrir("usuarioModal");
  }
  async function guardarUsuario(ev) {
    ev.preventDefault();
    const datos = {
      id: $("uId").value || undefined, usuario: $("uUsuario").value.trim(), nombre: $("uNombre").value.trim(),
      rol: $("uRol").value, activo: $("uActivo").checked, pin: $("uPin").value.trim() || undefined,
    };
    const btn = $("btnGuardarUsuario");
    btn.disabled = true;
    try {
      const r = await api("guardarUsuario", datos);
      cerrar("usuarioModal");
      toast(`Usuario ${r.usuario.usuario} guardado`);
      if (r.usuario.id === sesion().usuario.id && (r.usuario.rol !== "master" || !r.usuario.activo)) return cerrarSesion();
      cargarUsuarios();
    } catch (e) {
      mostrarError("usuarioError", e.message);
    } finally {
      btn.disabled = false;
    }
  }

  /* -------------------- Eventos -------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    borrarLS("skala_vendedor_v1"); // sesión de la v1
    pintarSesion();
    pintarCola();

    $("btnCuenta").addEventListener("click", () => (sesion() ? abrirPanel() : pedirLogin()));
    $("footAcceso").addEventListener("click", (e) => { e.preventDefault(); sesion() ? abrirPanel() : pedirLogin(); });
    $("btnModoCliente").addEventListener("click", () => { cerrar("modoModal"); openModal(); });
    $("btnModoVendedor").addEventListener("click", abrirPedido);
    $("loginForm").addEventListener("submit", enviarLogin);
    $("vendForm").addEventListener("submit", guardarPedido);
    $("vendForm").addEventListener("input", (e) => { if (e.target.id !== "vBuscar" && e.target.name !== "vPago" && e.target.id !== "vNota") guardarBorrador(); });
    $("vBuscar").addEventListener("input", buscar);
    $("btnGps").addEventListener("click", tomarGps);
    $("btnGrupo").addEventListener("click", () => ultimo && enviarAlGrupo(ultimo.mensaje));
    $("btnIrPanel").addEventListener("click", abrirPanel);
    $("btnRecargar").addEventListener("click", cargarTab);
    $("btnSubirPend").addEventListener("click", async () => { await subirCola(); cargarTab(); });
    $("btnNuevoPedido").addEventListener("click", () => {
      cerrarTodo();
      if (totalCajas() > 0) return abrirPedido();
      document.getElementById("banos").scrollIntoView({ behavior: "smooth" });
      toast("Elegí los productos y tocá Armar pedido.");
    });
    $("asignarForm").addEventListener("submit", enviarAsignar);
    $("asignarDespachador").addEventListener("change", () => mostrarError("asignarError", ""));
    $("usuarioForm").addEventListener("submit", guardarUsuario);

    $("panelTabs").addEventListener("click", (e) => {
      const t = e.target.closest(".tab");
      if (!t) return;
      tabActual = t.dataset.tab;
      document.querySelectorAll("#panelTabs .tab").forEach((x) => { x.classList.toggle("active", x === t); x.setAttribute("aria-selected", String(x === t)); });
      t.scrollIntoView({ block: "nearest", inline: "center" });
      cargarTab();
    });
    $("panelContenido").addEventListener("click", (e) => {
      const d = e.target.closest("[data-dias]");
      if (d) { diasResumen = Number(d.dataset.dias); return cargarResumen(); }
      if (e.target.closest("#btnNuevoUsuario")) return abrirUsuario(null);
      const ed = e.target.closest("[data-editar]");
      if (ed) return abrirUsuario(listaUsuarios.find((u) => u.id === ed.dataset.editar));
      accionPedido(e);
    });
    document.addEventListener("click", (e) => { if (e.target.closest(".js-salir")) cerrarSesion(); });

    MODALES.forEach((id) => {
      $(id).addEventListener("click", (e) => {
        if (e.target.id === id || e.target.closest("[data-cerrar]")) cerrar(id);
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const abierto = [...SOBRE, ...MODALES].find((id) => !$(id).hidden);
      if (abierto) cerrar(abierto);
    });

    window.addEventListener("online", () => subirCola());
    if (navigator.onLine) subirCola();
  });

  window.SkalaCRM = { elegirModo, abrirPanel, subirCola, sesion };
})();
