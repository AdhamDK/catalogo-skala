/* ============================================================
   Skala — Modo vendedor (mini CRM sobre Google Sheets)
   Spec: docs/specs/modo-vendedor-crm.md · Backend: crm/Code.gs
   ============================================================ */

/* ⚠️ Pegar aquí la URL de la App web de Apps Script (termina en /exec). */
const CRM_API_URL = "";

(function () {
  const API = window.SKALA_CRM_URL || CRM_API_URL;
  const K_SESION = "skala_vendedor_v1";
  const K_COLA = "skala_cola_v1";       // pedidos sin subir (sin señal)
  const K_CLIENTE = "skala_vcliente_v1"; // borrador del formulario

  const $ = (id) => document.getElementById(id);
  const leerLS = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch (e) { return def; } };
  const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* -------------------- Sesión -------------------- */
  function sesion() {
    const s = leerLS(K_SESION, null);
    if (!s || !s.token || expiracionToken(s.token) < Date.now()) return null;
    return s;
  }
  function cerrarSesion() {
    try { localStorage.removeItem(K_SESION); } catch (e) {}
    pintarSesion();
    cerrarTodo();
    toast("Sesión cerrada");
  }
  function pintarSesion() {
    const s = sesion();
    $("navMisPedidos").hidden = !s;
    const nombre = s ? s.vendedor.nombre : "";
    $("vendNombre").textContent = nombre;
    document.querySelectorAll(".js-vend-nombre").forEach((e) => (e.textContent = nombre));
    $("modoVendedorSub").textContent = s ? `Sesión de ${nombre} · registrar y enviar al grupo` : "Registrar el pedido y enviarlo al grupo";
  }

  /* -------------------- API -------------------- */
  class ErrorRed extends Error {}
  async function api(action, datos = {}) {
    if (!API) throw new Error("El CRM no está configurado (falta CRM_API_URL en js/vendedor.js).");
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
      if (j.code === "auth") { try { localStorage.removeItem(K_SESION); } catch (e) {} pintarSesion(); }
      const err = new Error(j.error || "Error del servidor");
      err.code = j.code;
      throw err;
    }
    return j;
  }

  /* -------------------- Modales -------------------- */
  const MODALES = ["modoModal", "loginModal", "vendModal", "pedidosModal"];
  let alVolver = null;
  function abrir(id) {
    MODALES.forEach((m) => { if (m !== id) $(m).hidden = true; });
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

  /* -------------------- 1. Elegir modo -------------------- */
  function elegirModo() {
    if (totalCajas() <= 0) return;
    abrir("modoModal");
  }

  /* -------------------- 2. Login -------------------- */
  async function pedirLogin(despues) {
    alVolver = despues;
    $("loginError").hidden = true;
    $("loginPin").value = "";
    abrir("loginModal");
    const sel = $("loginVendedor");
    sel.innerHTML = '<option value="">Cargando…</option>';
    try {
      const r = await api("vendedores");
      const ultimo = leerLS("skala_ultimo_vendedor", "");
      sel.innerHTML = '<option value="">Elegí tu nombre</option>' +
        r.vendedores.map((v) => `<option value="${esc(v.id)}"${v.id === ultimo ? " selected" : ""}>${esc(v.nombre)}</option>`).join("");
      (sel.value ? $("loginPin") : sel).focus();
    } catch (e) {
      sel.innerHTML = '<option value="">No disponible</option>';
      mostrarError("loginError", e.message);
    }
  }

  async function enviarLogin(ev) {
    ev.preventDefault();
    const id = $("loginVendedor").value;
    const pin = $("loginPin").value.trim();
    if (!id) return mostrarError("loginError", "Elegí tu nombre.");
    if (!/^\d{4,6}$/.test(pin)) return mostrarError("loginError", "El PIN tiene de 4 a 6 números.");
    const btn = $("btnLogin");
    btn.disabled = true; btn.textContent = "Entrando…";
    try {
      const r = await api("login", { vendedor_id: id, pin });
      guardarLS(K_SESION, { token: r.token, vendedor: r.vendedor });
      guardarLS("skala_ultimo_vendedor", id);
      pintarSesion();
      cerrar("loginModal");
      toast(`Hola, ${r.vendedor.nombre}`);
      subirCola();
      if (alVolver) { const f = alVolver; alVolver = null; f(); }
    } catch (e) {
      mostrarError("loginError", e.message);
      $("loginPin").value = "";
    } finally {
      btn.disabled = false; btn.textContent = "Entrar";
    }
  }

  function mostrarError(id, msg) {
    const el = $(id);
    el.textContent = msg;
    el.hidden = !msg;
  }

  /* -------------------- 3. Pedido del vendedor -------------------- */
  function conSesion(f) { return () => (sesion() ? f() : pedirLogin(f)); }

  const abrirPedido = conSesion(() => {
    const items = itemsDePedido(pedido, allProductsMap());
    if (!items.length) { cerrarTodo(); return; }
    $("vendPaso1").hidden = false;
    $("vendPaso2").hidden = true;
    $("btnGuardar").hidden = false;
    ["btnGrupo", "btnCopiaCliente", "btnVendMisPedidos"].forEach((b) => ($(b).hidden = true));
    $("vendTitulo").textContent = "Nuevo pedido";
    $("vError").hidden = true;
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
    if (c.id) { sel.textContent = `Cliente existente: ${c.negocio || c.nombre || c.contacto}. Podés corregir sus datos.`; sel.hidden = false; }
    else sel.hidden = true;
    pintarGps();
  }
  function guardarBorrador() { guardarLS(K_CLIENTE, leerCliente()); }

  /* Búsqueda de clientes existentes */
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

  /* GPS */
  function pintarGps(precision) {
    const lat = $("vLat").value, lng = $("vLng").value;
    $("gpsEstado").innerHTML = lat && lng
      ? `Ubicación lista${precision ? ` (±${Math.round(precision)} m)` : ""} · <a href="${linkMapa(lat, lng)}" target="_blank" rel="noopener">ver mapa</a>`
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

  function pagoElegido() { return (document.querySelector('input[name="vPago"]:checked') || {}).value || ""; }

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
        // Sin señal: se guarda en el teléfono y se sube después
        const cola = leerLS(K_COLA, []);
        cola.push({ ...datos, vendedor: sesion().vendedor.nombre, guardado: new Date().toISOString() });
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
    try { localStorage.removeItem(K_CLIENTE); } catch (e) {}
    $("vNota").value = "";
    document.querySelectorAll('input[name="vPago"]').forEach((r) => (r.checked = false));
    $("vendPaso1").hidden = true;
    $("vendPaso2").hidden = false;
    $("btnGuardar").hidden = true;
    $("btnVendMisPedidos").hidden = false;
    $("vendResumen").textContent = "";
    if (offline) {
      $("vendTitulo").textContent = "Guardado en el teléfono";
      $("vendOk").textContent = "No hay señal. El pedido quedó guardado en este teléfono y se subirá solo cuando vuelva la conexión (o desde Mis pedidos → Subir ahora). Después podrás enviarlo al grupo.";
      $("vMensaje").value = "";
      $("vMensaje").closest("label").hidden = true;
      $("btnGrupo").hidden = true;
      $("btnCopiaCliente").hidden = true;
      return;
    }
    $("vMensaje").closest("label").hidden = false;
    prepararEnvio(ped, cliente);
    $("vendTitulo").textContent = `Pedido ${ped.id} guardado`;
    $("vendOk").textContent = "Quedó registrado en la hoja de pedidos. Ahora envialo al grupo de la empresa.";
  }

  function prepararEnvio(ped, cliente) {
    const mensaje = mensajeGrupo(ped, cliente);
    ultimo = { pedido: ped, cliente, mensaje };
    $("vMensaje").value = mensaje;
    $("btnGrupo").hidden = false;
    const tel = telefonoWhatsapp(cliente.telefono);
    const copia = $("btnCopiaCliente");
    copia.hidden = !tel;
    if (tel) copia.href = `https://wa.me/${tel}?text=${encodeURIComponent("Hola! Te comparto el resumen de tu pedido Skala:\n\n" + mensaje)}`;
  }

  /* Enviar al grupo: menú de compartir del teléfono (eligís el grupo) o wa.me sin número */
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
          const { vendedor, guardado, ...datos } = p;
          const r = await api("guardarPedido", datos);
          subidos.push(r);
          const resto = leerLS(K_COLA, []).filter((x) => x.client_ref !== p.client_ref);
          guardarLS(K_COLA, resto);
        } catch (e) {
          if (e instanceof ErrorRed) break; // sigue sin señal
          if (e.code === "auth") break;
          // error de datos: se deja en la cola para revisarlo
        }
      }
    } finally {
      subiendo = false;
      pintarCola();
    }
    if (subidos.length) toast(`${subidos.length} pedido(s) subido(s). Envialos al grupo desde Mis pedidos.`);
    return subidos;
  }
  function pintarCola() {
    const n = leerLS(K_COLA, []).length;
    $("pendSubir").hidden = !n;
    $("pendSubirTxt").textContent = `${n} pedido${n === 1 ? "" : "s"} sin subir (sin señal)`;
  }

  /* -------------------- 4. Mis pedidos -------------------- */
  let estadoActual = "pendiente";
  let listaPedidos = [];
  const abrirMisPedidos = conSesion(async () => {
    abrir("pedidosModal");
    await subirCola();
    cargarPedidos();
  });

  async function cargarPedidos() {
    const ul = $("pedidosLista");
    $("pedidosInfo").textContent = "Cargando…";
    ul.innerHTML = "";
    try {
      const r = await api("pedidos", { estado: estadoActual, dias: 60 });
      listaPedidos = r.pedidos;
      $("pedidosInfo").textContent = r.pedidos.length ? `${r.pedidos.length} pedido(s) · últimos 60 días` : "No hay pedidos en esta lista.";
      ul.innerHTML = r.pedidos.map(tarjetaPedido).join("");
    } catch (e) {
      $("pedidosInfo").textContent = e.message;
      if (e.code === "auth") pedirLogin(abrirMisPedidos);
    }
  }

  function tarjetaPedido(p, i) {
    const c = p.cliente_datos || {};
    const tel = String(c.telefono || "").replace(/[^\d+]/g, "");
    const mapa = linkMapa(c.latitud, c.longitud);
    const acciones = p.estado === "pendiente"
      ? `<button type="button" class="btn btn-primary" data-acc="entregado" data-i="${i}">Entregado</button>
         <button type="button" class="btn btn-ghost" data-acc="cancelado" data-i="${i}">Cancelar</button>`
      : `<button type="button" class="btn btn-ghost" data-acc="pendiente" data-i="${i}">Volver a pendiente</button>`;
    return `<li class="ped ped-${esc(p.estado)}">
      <div class="ped-top"><strong>${esc(p.id)}</strong><span class="ped-estado">${esc(p.estado)}</span></div>
      <div class="ped-cli">${esc(p.negocio)}${p.cliente && p.cliente !== p.negocio ? " · " + esc(p.cliente) : ""}</div>
      <div class="ped-det">${esc(fechaLegible(p.fecha))} · ${esc(p.total_cajas)} caja(s)${p.detalle_unidades ? " · " + esc(p.detalle_unidades) : ""}</div>
      ${p.motivo ? `<div class="ped-det">Motivo: ${esc(p.motivo)}</div>` : ""}
      <div class="ped-links">
        ${tel ? `<a href="tel:${esc(tel)}">Llamar</a>` : ""}
        ${mapa ? `<a href="${esc(mapa)}" target="_blank" rel="noopener">Mapa</a>` : ""}
        <button type="button" class="link-btn" data-acc="grupo" data-i="${i}">Reenviar al grupo</button>
      </div>
      <div class="ped-acciones">${acciones}</div>
    </li>`;
  }

  async function accionPedido(e) {
    const b = e.target.closest("[data-acc]");
    if (!b) return;
    const p = listaPedidos[Number(b.dataset.i)];
    if (!p) return;
    const acc = b.dataset.acc;
    if (acc === "grupo") return enviarAlGrupo(mensajeGrupo(p, p.cliente_datos));
    let motivo = "";
    if (acc === "cancelado") {
      motivo = (window.prompt(`Motivo de cancelación de ${p.id}:`) || "").trim();
      if (!motivo) return;
    }
    if (acc === "entregado" && !window.confirm(`¿Marcar ${p.id} como ENTREGADO?`)) return;
    b.disabled = true;
    try {
      await api("estado", { pedido_id: p.id, estado: acc, motivo });
      toast(`${p.id}: ${acc}`);
      cargarPedidos();
    } catch (err) {
      b.disabled = false;
      toast(err.message);
    }
  }

  /* -------------------- Eventos -------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    pintarSesion();
    pintarCola();

    $("btnModoCliente").addEventListener("click", () => { cerrar("modoModal"); openModal(); });
    $("btnModoVendedor").addEventListener("click", abrirPedido);
    $("loginForm").addEventListener("submit", enviarLogin);
    $("vendForm").addEventListener("submit", guardarPedido);
    $("vendForm").addEventListener("input", (e) => { if (e.target.id !== "vBuscar" && e.target.name !== "vPago") guardarBorrador(); });
    $("vBuscar").addEventListener("input", buscar);
    $("btnGps").addEventListener("click", tomarGps);
    $("btnGrupo").addEventListener("click", () => ultimo && enviarAlGrupo(ultimo.mensaje));
    $("btnVendMisPedidos").addEventListener("click", abrirMisPedidos);
    $("btnSalir").addEventListener("click", cerrarSesion);
    document.querySelectorAll(".js-salir").forEach((b) => b.addEventListener("click", cerrarSesion));
    $("navMisPedidos").addEventListener("click", (e) => { e.preventDefault(); abrirMisPedidos(); });
    $("footVendedores").addEventListener("click", (e) => { e.preventDefault(); abrirMisPedidos(); });
    $("btnRecargar").addEventListener("click", cargarPedidos);
    $("btnSubirPend").addEventListener("click", async () => { await subirCola(); cargarPedidos(); });
    $("pedidosLista").addEventListener("click", accionPedido);
    $("pedidosTabs").addEventListener("click", (e) => {
      const t = e.target.closest(".tab");
      if (!t) return;
      document.querySelectorAll("#pedidosTabs .tab").forEach((x) => { x.classList.toggle("active", x === t); x.setAttribute("aria-selected", String(x === t)); });
      estadoActual = t.dataset.estado;
      cargarPedidos();
    });

    MODALES.forEach((id) => {
      $(id).addEventListener("click", (e) => {
        if (e.target.id === id || e.target.closest("[data-cerrar]")) cerrar(id);
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") MODALES.forEach((id) => { if (!$(id).hidden) cerrar(id); });
    });

    window.addEventListener("online", () => subirCola());
    if (navigator.onLine) subirCola();
  });

  window.SkalaVendedor = { elegirModo, abrirMisPedidos, subirCola, sesion };
})();
