/* ============================================================
   Skala — Panel del equipo (app con páginas)
   Rutas (#/...): ingresar · inicio · nuevo (1 cliente) · nuevo/productos (2) · nuevo/enviar (3) · nuevo/listo · pedidos ·
   pedido/ID · entregas · clientes · cliente/ID · resumen · usuarios · usuario/ID · mas
   Datos: Google Sheets vía js/crm-api.js. Permisos: el servidor valida cada acción.
   ============================================================ */
(function () {
  const { api, sesion, ErrorRed, leerLS, guardarLS, borrarLS } = SkalaAPI;
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const K_CARRITO = "skala_pedido_v1";   // compartido con el catálogo
  const K_CLIENTE = "skala_vcliente_v1"; // borrador del cliente del pedido
  const K_LISTO = "skala_ultimo_pedido";
  const K_DESTINO = "skala_destino";
  const K_ULTIMO_USUARIO = "skala_ultimo_usuario";
  const TODOS = ["master", "admin", "vendedor", "despachador"];
  const TOMAN = ["master", "admin", "vendedor"];
  const rol = () => (sesion() || { usuario: {} }).usuario.rol;
  const yo = () => (sesion() || { usuario: {} }).usuario;

  /* -------------------- Íconos (SVG simples) -------------------- */
  const ICON = {
    inicio: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    nuevo: '<path d="M12 5v14M5 12h14"/>',
    pedidos: '<path d="M7 3h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6"/>',
    entregas: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01"/>',
    clientes: '<path d="M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    mas: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  };
  const icono = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

  /* -------------------- Rutas -------------------- */
  const RUTAS = {
    ingresar: { titulo: "Ingresar", publica: true, render: vIngresar },
    inicio: { titulo: "Inicio", roles: TODOS, nav: "inicio", render: vInicio },
    nuevo: { titulo: "Nuevo pedido", roles: TOMAN, nav: "nuevo", render: vNuevoCliente },
    "nuevo/productos": { titulo: "Nuevo pedido", roles: TOMAN, nav: "nuevo", atras: "#/nuevo", render: vNuevoProductos },
    "nuevo/enviar": { titulo: "Nuevo pedido", roles: TOMAN, nav: "nuevo", atras: "#/nuevo/productos", render: vNuevoEnviar },
    "nuevo/cliente": { titulo: "Nuevo pedido", roles: TOMAN, nav: "nuevo", render: () => ir("#/nuevo") }, // enlace viejo
    "nuevo/listo": { titulo: "Pedido guardado", roles: TOMAN, nav: "nuevo", render: vNuevoListo },
    pedidos: { titulo: "Pedidos", roles: TOMAN, nav: "pedidos", render: vPedidos },
    entregas: { titulo: "Mis entregas", roles: ["despachador"], nav: "entregas", render: vPedidos },
    pedido: { titulo: "Pedido", roles: TODOS, atras: true, render: vPedido },
    clientes: { titulo: "Clientes", roles: TOMAN, nav: "clientes", render: vClientes },
    cliente: { titulo: "Cliente", roles: TOMAN, nav: "clientes", atras: "#/clientes", render: vCliente },
    resumen: { titulo: "Resumen", roles: TOMAN, nav: "mas", atras: "#/mas", render: vResumen },
    usuarios: { titulo: "Usuarios", roles: ["master"], nav: "mas", atras: "#/mas", render: vUsuarios },
    usuario: { titulo: "Usuario", roles: ["master"], nav: "mas", atras: "#/usuarios", render: vUsuario },
    mas: { titulo: "Más", roles: TODOS, nav: "mas", render: vMas },
  };

  function leerRuta() {
    const [ruta, query] = location.hash.replace(/^#\/?/, "").split("?");
    const segs = ruta.split("/").filter(Boolean);
    let clave = segs[0] || "inicio";
    let param = segs[1] ? decodeURIComponent(segs[1]) : "";
    if (clave === "nuevo" && param) { clave = "nuevo/" + param; param = ""; }
    return { clave, param, query: new URLSearchParams(query || "") };
  }
  const ir = (h) => { if (location.hash === h) render(); else location.hash = h; };

  let renderId = 0;
  async function render() {
    const id = ++renderId;
    delete document.body.dataset.lista; // marca de "página lista" (la usan las pruebas)
    const { clave, param, query } = leerRuta();
    let def = RUTAS[clave];
    const s = sesion();
    if (!def) return ir(s ? "#/inicio" : "#/ingresar");
    if (!def.publica && !s) { sessionStorage.setItem(K_DESTINO, location.hash); return ir("#/ingresar"); }
    if (def.roles && !def.roles.includes(s.usuario.rol)) return ir("#/inicio");
    if (clave === "ingresar" && s) return ir("#/inicio");

    document.title = `${def.titulo} · Skala Equipo`;
    $("appTitulo").textContent = def.titulo;
    $("btnAtras").hidden = !def.atras;
    $("btnAtras").dataset.destino = typeof def.atras === "string" ? def.atras : "";
    $("appQuien").textContent = s ? `${s.usuario.nombre} · ${s.usuario.rol_nombre}` : "";
    pintarNav(def.nav);
    pintarCola();
    const vista = $("vista");
    vista.innerHTML = '<p class="cargando">Cargando…</p>';
    window.scrollTo(0, 0);
    try {
      await def.render(vista, param, query, () => id === renderId);
    } catch (e) {
      if (id !== renderId) return;
      if (e.code === "auth") { sessionStorage.setItem(K_DESTINO, location.hash); return ir("#/ingresar"); }
      vista.innerHTML = `<div class="aviso-error"><p>${esc(e.message)}</p><button type="button" class="btn btn-ghost" data-reintentar>Reintentar</button></div>`;
    }
    if (id === renderId) { vista.focus({ preventScroll: true }); document.body.dataset.lista = location.hash; }
  }

  function pintarNav(activa) {
    const nav = $("appNav");
    const r = rol();
    if (!r) { nav.hidden = true; document.body.classList.remove("con-nav"); return; }
    const items = r === "despachador"
      ? [["inicio", "Inicio"], ["entregas", "Entregas"], ["mas", "Más"]]
      : [["inicio", "Inicio"], ["nuevo", "Nuevo"], ["pedidos", "Pedidos"], ["clientes", "Clientes"], ["mas", "Más"]];
    const n = cajasCarrito();
    nav.innerHTML = items.map(([k, t]) =>
      `<a href="#/${k}" class="${k === activa ? "activa" : ""}"${k === activa ? ' aria-current="page"' : ""}>${icono(k)}<span>${t}</span>${k === "nuevo" && n ? `<b class="badge">${n}</b>` : ""}</a>`).join("");
    nav.hidden = false;
    document.body.classList.add("con-nav");
  }

  /* -------------------- Utilidades de UI -------------------- */
  let toastT = null;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => (t.hidden = true), 3500);
  }

  /* Hoja modal: devuelve los valores del formulario o null si se cancela */
  function hoja({ titulo, cuerpo, ok = "Aceptar", validar }) {
    return new Promise((resolve) => {
      $("hojaTitulo").textContent = titulo;
      $("hojaCuerpo").innerHTML = cuerpo || "";
      $("hojaOk").textContent = ok;
      $("hojaError").hidden = true;
      const modal = $("hoja"), form = $("hojaForm");
      modal.hidden = false;
      document.body.classList.add("modal-open");
      (form.querySelector("select, textarea, input") || form).focus();
      const fin = (val) => {
        modal.hidden = true;
        document.body.classList.remove("modal-open");
        form.onsubmit = null; modal.onclick = null; document.removeEventListener("keydown", tecla);
        resolve(val);
      };
      const tecla = (e) => { if (e.key === "Escape") fin(null); };
      document.addEventListener("keydown", tecla);
      modal.onclick = (e) => { if (e.target === modal || e.target.closest("[data-cerrar]")) fin(null); };
      form.onsubmit = (e) => {
        e.preventDefault();
        const datos = Object.fromEntries(new FormData(form).entries());
        const err = validar ? validar(datos) : "";
        if (err) { $("hojaError").textContent = err; $("hojaError").hidden = false; return; }
        fin(datos);
      };
    });
  }

  function pintarCola() {
    const n = SkalaAPI.cola().length;
    $("pendSubir").hidden = !n || !sesion();
    $("pendSubirTxt").textContent = `${n} pedido${n === 1 ? "" : "s"} sin subir (sin señal)`;
  }
  async function subirCola(avisar) {
    const subidos = await SkalaAPI.subirCola();
    pintarCola();
    if (subidos.length) toast(`${subidos.length} pedido(s) subido(s). Envialos al grupo desde Pedidos.`);
    else if (avisar && SkalaAPI.cola().length) toast("Sigue sin señal. Se subirán solos al volver la conexión.");
    return subidos;
  }

  async function enviarAlGrupo(mensaje) {
    if (navigator.share) {
      try { await navigator.share({ text: mensaje }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener");
  }

  const telLink = (t) => String(t || "").replace(/[^\d+]/g, "");
  const chipEstado = (e) => `<span class="chip-estado est-${esc(e)}">${esc(nombreEstado(e))}</span>`;

  /* -------------------- Carrito (compartido con el catálogo) -------------------- */
  const carrito = () => leerLS(K_CARRITO, {}) || {};
  const guardarCarrito = (c) => guardarLS(K_CARRITO, c);
  const cajasCarrito = () => Object.values(carrito()).reduce((a, b) => a + (Number(b) || 0), 0);

  /* ==================== PÁGINAS ==================== */

  /* ---------- Ingresar ---------- */
  function vIngresar(v) {
    v.innerHTML = `
      <form class="tarjeta login" id="fLogin" novalidate>
        <img src="assets/img/web/logo-192.png" alt="Skala" width="72" height="72" class="login-logo" />
        <h2>Equipo Skala</h2>
        <p class="modal-sub">Ingresá con tu usuario y clave.</p>
        <label class="field field-full"><span>Usuario</span>
          <input id="lUsuario" name="usuario" type="text" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="ej. oscar" value="${esc(leerLS(K_ULTIMO_USUARIO, ""))}" />
        </label>
        <label class="field field-full"><span>Clave</span>
          <span class="clave-wrap">
            <input id="lClave" name="clave" type="password" maxlength="64" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="Tu clave" />
            <button type="button" class="ver-clave" data-ver="lClave" aria-label="Mostrar clave">Ver</button>
          </span>
        </label>
        <p class="form-warn" id="lError" hidden></p>
        <button type="submit" class="btn btn-primary btn-bloque" id="btnLogin">Entrar</button>
        <a class="btn btn-ghost btn-bloque" href="index.html">Volver al catálogo</a>
      </form>`;
    ($("lUsuario").value ? $("lClave") : $("lUsuario")).focus();
    $("fLogin").onsubmit = async (e) => {
      e.preventDefault();
      const usuario = $("lUsuario").value.trim();
      const clave = $("lClave").value;
      const err = !usuario ? "Escribí tu usuario." : !clave ? "Escribí tu clave." : "";
      if (err) { $("lError").textContent = err; $("lError").hidden = false; return; }
      const btn = $("btnLogin");
      btn.disabled = true; btn.textContent = "Entrando…";
      try {
        // "pin" también, por compatibilidad con un servidor publicado sin actualizar
        const r = await api("login", { usuario, clave, pin: clave });
        SkalaAPI.guardarSesion(r.token, r.usuario);
        guardarLS(K_ULTIMO_USUARIO, r.usuario.usuario);
        toast(`Hola, ${r.usuario.nombre}`);
        subirCola();
        const destino = sessionStorage.getItem(K_DESTINO);
        sessionStorage.removeItem(K_DESTINO);
        ir(destino && !destino.includes("ingresar") ? destino : "#/inicio");
      } catch (e2) {
        $("lError").textContent = e2.message; $("lError").hidden = false;
        $("lClave").value = "";
        btn.disabled = false; btn.textContent = "Entrar";
      }
    };
  }

  /* ---------- Inicio ---------- */
  async function vInicio(v, _p, _q, vigente) {
    const u = yo();
    const r = u.rol;
    const hora = new Date().getHours();
    const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
    const accesos = r === "despachador"
      ? [["#/entregas", "Mis entregas", "entregas"]]
      : [["#/nuevo", "Nuevo pedido", "nuevo"], ["#/pedidos", "Pedidos", "pedidos"], ["#/clientes", "Clientes", "clientes"]];
    v.innerHTML = `
      <section class="saludo"><h2>${saludo}, ${esc(u.nombre.split(" ")[0])}</h2><p>${esc(u.rol_nombre)}</p></section>
      <div class="stats" id="iStats"><div class="stat"><strong>…</strong><span>cargando</span></div></div>
      <div class="accesos">${accesos.map(([h, t, k]) => `<a class="acceso" href="${h}">${icono(k)}<span>${t}</span></a>`).join("")}</div>
      <h3 class="sub-titulo" id="iListaTit"></h3>
      <ul class="lista-ped" id="iLista"></ul>`;
    const abiertos = await api("pedidos", { estados: ["pendiente", "confirmado", "en_ruta"], dias: 60 });
    if (!vigente()) return;
    const c = { pendiente: 0, confirmado: 0, en_ruta: 0 };
    abiertos.pedidos.forEach((p) => (c[p.estado] = (c[p.estado] || 0) + 1));
    const tile = (n, t, h) => `<a class="stat" href="${h}"><strong>${n}</strong><span>${t}</span></a>`;
    let tiles;
    let destacados = [];
    if (r === "despachador") {
      tiles = tile(c.confirmado, "preparando despacho", "#/entregas") + tile(c.en_ruta, "en ruta", "#/entregas");
      destacados = abiertos.pedidos;
      $("iListaTit").textContent = destacados.length ? "Para entregar" : "";
    } else {
      const hoy = await api("resumen", { dias: 1 });
      if (!vigente()) return;
      tiles = tile(hoy.total_pedidos, "pedidos hoy", "#/pedidos") + tile(hoy.total_cajas, "cajas hoy", "#/resumen") +
        tile(c.pendiente, r === "vendedor" ? "en proceso" : "por aprobar", "#/pedidos?tab=pendiente") +
        tile(c.confirmado + c.en_ruta, "en despacho", "#/pedidos?tab=curso");
      destacados = abiertos.pedidos.filter((p) => p.estado === "pendiente").slice(0, 5);
      $("iListaTit").textContent = destacados.length ? (r === "vendedor" ? "Tus pedidos en proceso" : "Por aprobar") : "";
    }
    $("iStats").innerHTML = tiles;
    $("iLista").innerHTML = destacados.map(filaPedido).join("");
  }

  /* ---------- Nuevo pedido: 2) productos ---------- */
  let filtroNuevo = "todos", busquedaNuevo = "";
  function vNuevoProductos(v) {
    const cli = clienteElegido();
    if (!cli) return ir("#/nuevo");
    const productos = [...BANOS.map((p) => ({ ...p, tipo: "banos" })), ...KITS.map((p) => ({ ...p, tipo: "kits" }))];
    v.innerHTML = `${pasos(2)}
      <a class="cliente-elegido" href="#/nuevo"><span>Para</span><strong>${esc(cli.negocio || cli.contacto)}</strong><em>Cambiar</em></a>
      <div class="buscador"><input type="search" id="nBuscar" placeholder="Buscar producto o código" autocomplete="off" enterkeyhint="search" value="${esc(busquedaNuevo)}" /></div>
      <div class="periodos" id="nFiltros">${[["todos", "Todos"], ["banos", "Baños de crema"], ["kits", "Kits"], ["elegidos", "Elegidos"]].map(([k, t]) =>
        `<button type="button" class="tab${k === filtroNuevo ? " active" : ""}" data-f="${k}">${t}</button>`).join("")}</div>
      <ul class="lista-prod" id="nLista">${productos.map((p) => `
        <li class="prod" data-code="${p.code}" data-tipo="${p.tipo}" data-texto="${esc((p.name + " " + p.code + " " + p.line).toLowerCase())}">
          <picture><source type="image/webp" srcset="assets/img/web/${p.code}-400.webp" />
            <img src="assets/img/${p.code}.png" alt="" width="64" height="51" loading="lazy" decoding="async" /></picture>
          <div class="prod-info">
            <strong>${esc(p.name)}</strong>
            <span>${p.code} · ${esc(textoUnidades(p))}</span>
            <span class="hair-icons">${iconosCabelloHTML(p.hair)}</span>
          </div>
          <div class="qty">
            <button type="button" class="qty-btn" data-act="minus" aria-label="Restar una caja de ${esc(p.name)}">−</button>
            <input class="qty-input" type="number" min="0" step="1" inputmode="numeric" pattern="[0-9]*" aria-label="Cajas de ${esc(p.name)}" />
            <button type="button" class="qty-btn" data-act="plus" aria-label="Sumar una caja de ${esc(p.name)}">+</button>
          </div>
        </li>`).join("")}</ul>
      <p class="vacio-panel" id="nVacio" hidden>No hay productos con ese filtro.</p>
      <div class="barra-accion" id="nBarra">
        <div><strong id="nTotal">0 cajas</strong><span id="nDetalle"></span></div>
        <button type="button" class="btn btn-ghost" id="nVaciar">Vaciar</button>
        <a class="btn btn-primary" id="nSeguir" href="#/nuevo/enviar">Continuar</a>
      </div>`;
    const lista = $("nLista");
    const pintar = () => {
      const c = carrito();
      let total = 0, prods = 0;
      lista.querySelectorAll(".prod").forEach((li) => {
        const q = Number(c[li.dataset.code]) || 0;
        const inp = li.querySelector(".qty-input");
        if (document.activeElement !== inp) inp.value = q;
        li.classList.toggle("elegido", q > 0);
        total += q; if (q) prods++;
      });
      $("nTotal").textContent = `${total} caja${total === 1 ? "" : "s"}`;
      $("nDetalle").textContent = prods ? ` · ${prods} producto${prods === 1 ? "" : "s"}` : " · elegí productos";
      $("nSeguir").classList.toggle("is-disabled", !total);
      $("nSeguir").setAttribute("aria-disabled", String(!total));
      $("nVaciar").hidden = !total;
      pintarNav("nuevo");
      filtrar();
    };
    const filtrar = () => {
      const q = busquedaNuevo.trim().toLowerCase();
      const c = carrito();
      let visibles = 0;
      lista.querySelectorAll(".prod").forEach((li) => {
        const okF = filtroNuevo === "todos" || li.dataset.tipo === filtroNuevo || (filtroNuevo === "elegidos" && Number(c[li.dataset.code]) > 0);
        const ok = okF && (!q || li.dataset.texto.includes(q));
        li.hidden = !ok; if (ok) visibles++;
      });
      $("nVacio").hidden = !!visibles;
    };
    const fijar = (code, n) => {
      const c = carrito();
      n = Math.max(0, Math.min(9999, Math.floor(Number(n) || 0)));
      if (n) c[code] = n; else delete c[code];
      guardarCarrito(c);
      pintar();
    };
    lista.addEventListener("click", (e) => {
      const b = e.target.closest(".qty-btn");
      if (!b) return;
      const code = b.closest(".prod").dataset.code;
      const actual = Number(carrito()[code]) || 0;
      fijar(code, actual + (b.dataset.act === "plus" ? 1 : -1));
    });
    lista.addEventListener("input", (e) => {
      if (e.target.classList.contains("qty-input")) fijar(e.target.closest(".prod").dataset.code, e.target.value);
    });
    lista.addEventListener("focusout", (e) => { if (e.target.classList.contains("qty-input")) pintar(); });
    $("nBuscar").addEventListener("input", (e) => { busquedaNuevo = e.target.value; filtrar(); });
    $("nFiltros").addEventListener("click", (e) => {
      const t = e.target.closest("[data-f]");
      if (!t) return;
      filtroNuevo = t.dataset.f;
      $("nFiltros").querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
      filtrar();
    });
    $("nVaciar").addEventListener("click", async () => {
      if (await hoja({ titulo: "¿Vaciar el pedido?", cuerpo: '<p class="modal-sub">Se quitan todos los productos elegidos.</p>', ok: "Vaciar" })) { guardarCarrito({}); pintar(); }
    });
    $("nSeguir").addEventListener("click", (e) => { if (!cajasCarrito()) { e.preventDefault(); toast("Elegí al menos un producto."); } });
    pintar();
  }

  /* ---------- Nuevo pedido: pasos ---------- */
  function pasos(n) {
    const p = [["#/nuevo", "Cliente"], ["#/nuevo/productos", "Productos"], ["#/nuevo/enviar", "Enviar"]];
    return `<ol class="pasos">${p.map(([h, t], i) => `<li class="${i + 1 === n ? "actual" : i + 1 < n ? "hecho" : ""}">${i + 1 < n
      ? `<a href="${h}"><b>${i + 1}</b>${t}</a>` : `<span><b>${i + 1}</b>${t}</span>`}</li>`).join("")}</ol>`;
  }
  /* Cliente del pedido en curso (guardado en el teléfono). _listo = ya elegido/confirmado */
  const clienteElegido = () => { const c = leerLS(K_CLIENTE, null); return c && c._listo ? c : null; };
  const fijarCliente = (c) => guardarLS(K_CLIENTE, { ...c, _listo: true });

  function fichaCliente(c) {
    const mapa = linkMapa(c.latitud, c.longitud);
    return `<section class="tarjeta ficha-cli" id="fichaCli">
      <div class="fila-top">
        <div><h2 class="ped-titulo">${esc(c.negocio || c.contacto)}</h2>${c.negocio && c.contacto ? `<p class="ped-det">${esc(c.contacto)}</p>` : ""}</div>
        <button type="button" class="btn-lapiz" id="btnLapiz" aria-label="Editar datos del cliente" title="Editar datos">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" /></svg></button>
      </div>
      <dl class="datos">
        ${c.rif_cedula ? `<dt>RIF</dt><dd>${esc(c.rif_cedula)}</dd>` : ""}
        <dt>Teléfono</dt><dd>${esc([c.telefono, c.telefono2].filter(Boolean).join(" / ") || "—")}</dd>
        ${c.direccion ? `<dt>Dirección</dt><dd>${esc(c.direccion)}</dd>` : ""}
        <dt>Ubicación</dt><dd>${mapa ? `<a href="${esc(mapa)}" target="_blank" rel="noopener">Ver mapa</a>` : '<button type="button" class="link-btn" id="btnGpsFicha">Tomar ubicación ahora</button>'}</dd>
      </dl>
      ${c.id ? "" : '<p class="nota-chica">Cliente nuevo: se guarda junto con el pedido.</p>'}
    </section>`;
  }

  /* Formulario de cliente (nuevo o editar con el lápiz) */
  function formCliente(c) {
    const val = (k) => esc((c && c[k]) ?? "");
    return `<form class="tarjeta" id="fCli" novalidate>
      <h3 class="sub-titulo">${c && c.id ? "Editar datos del cliente" : "Cliente nuevo"}</h3>
      <div class="form-grid">
        <label class="field"><span>Nombre del negocio</span><input id="cNegocio" type="text" autocomplete="off" autocapitalize="words" enterkeyhint="next" placeholder="Peluquería / tienda" value="${val("negocio")}" /></label>
        <label class="field"><span>Nombre del cliente</span><input id="cContacto" type="text" autocomplete="off" autocapitalize="words" enterkeyhint="next" placeholder="Persona de contacto" value="${val("contacto")}" /></label>
        <label class="field"><span>RIF / Cédula</span><input id="cRif" type="text" autocomplete="off" autocapitalize="characters" enterkeyhint="next" placeholder="J-12345678-9" value="${val("rif_cedula")}" /></label>
        <label class="field"><span>Teléfono 1 *</span><input id="cTel1" type="tel" inputmode="tel" autocomplete="off" enterkeyhint="next" placeholder="0412-1234567" value="${val("telefono")}" /></label>
        <label class="field"><span>Teléfono 2</span><input id="cTel2" type="tel" inputmode="tel" autocomplete="off" enterkeyhint="next" placeholder="Opcional" value="${val("telefono2")}" /></label>
        <label class="field field-full"><span>Dirección</span><input id="cDireccion" type="text" autocomplete="off" enterkeyhint="done" placeholder="Dirección de entrega" value="${val("direccion")}" /></label>
      </div>
      <div class="gps-box">
        <button type="button" class="btn btn-ghost btn-gps" id="btnGps">Tomar ubicación GPS del cliente</button>
        <span class="gps-estado" id="gpsEstado">Sin ubicación</span>
        <input type="hidden" id="cLat" value="${val("latitud")}" /><input type="hidden" id="cLng" value="${val("longitud")}" />
      </div>
      <p class="form-warn" id="cError" hidden></p>
      <div class="fila-botones">
        <button type="button" class="btn btn-ghost" id="btnCliVolver">${c && (c.id || c._listo) ? "Cancelar" : "Volver a buscar"}</button>
        <button type="submit" class="btn btn-primary" id="btnCliUsar">${c && c.id ? "Guardar cambios" : "Usar este cliente"}</button>
      </div>
    </form>`;
  }

  function tomarGps(boton, alListo) {
    if (!navigator.geolocation) return toast("Este teléfono no permite GPS en el navegador.");
    const texto = boton.textContent;
    boton.disabled = true; boton.textContent = "Buscando GPS…";
    navigator.geolocation.getCurrentPosition(
      (pos) => { boton.disabled = false; boton.textContent = texto; alListo(pos.coords.latitude.toFixed(6), pos.coords.longitude.toFixed(6), pos.coords.accuracy); },
      (err) => { boton.disabled = false; boton.textContent = texto; toast(err.code === 1 ? "Permiso de ubicación negado. Activalo en el navegador." : "No se pudo obtener el GPS. Probá al aire libre."); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
  }

  /* ---------- Nuevo pedido: 1) cliente (buscar / nuevo) ---------- */
  function vNuevoCliente(v) {
    let modo = clienteElegido() ? "ficha" : "buscar"; // buscar · ficha · form
    let enEdicion = null;
    const pintar = () => {
      const cli = clienteElegido();
      if (modo === "ficha" && !cli) modo = "buscar";
      if (modo === "buscar") {
        v.innerHTML = `${pasos(1)}
          <div class="buscador"><input type="search" id="cBuscar" placeholder="Buscar cliente: nombre, negocio o teléfono" autocomplete="off" enterkeyhint="search" /></div>
          <ul class="lista-cli" id="cResultados"></ul>
          <p class="o-separador"><span>o</span></p>
          <button type="button" class="btn btn-primary btn-bloque" id="btnClienteNuevo">Cliente nuevo</button>`;
        let t = null, ultimaQ = "";
        $("cBuscar").addEventListener("input", () => {
          clearTimeout(t);
          const q = $("cBuscar").value.trim();
          if (q.length < 2) { $("cResultados").innerHTML = ""; return; }
          t = setTimeout(async () => {
            ultimaQ = q;
            try {
              const r = await api("clientes", { q });
              if (q !== ultimaQ || !$("cResultados")) return;
              $("cResultados").innerHTML = r.clientes.length
                ? r.clientes.map((c, i) => `<li><button type="button" class="res-cli" data-i="${i}"><strong>${esc(c.nombre)}</strong><span>${esc([c.contacto, c.telefono].filter(Boolean).join(" · "))}</span>${c.direccion ? `<span>${esc(c.direccion)}</span>` : ""}</button></li>`).join("")
                : '<li class="vacio-panel">No está registrado. Tocá <strong>Cliente nuevo</strong>.</li>';
              $("cResultados").onclick = (e) => {
                const b = e.target.closest("[data-i]");
                if (!b) return;
                const c = r.clientes[Number(b.dataset.i)];
                fijarCliente({ id: c.id, negocio: c.nombre, contacto: c.contacto, rif_cedula: c.rif_cedula, telefono: c.telefono, telefono2: c.telefono2, direccion: c.direccion, latitud: c.latitud, longitud: c.longitud });
                modo = "ficha"; pintar();
              };
            } catch (e) {
              if ($("cResultados")) $("cResultados").innerHTML = `<li class="vacio-panel">${esc(e instanceof ErrorRed ? "Sin señal para buscar. Podés cargarlo como Cliente nuevo." : e.message)}</li>`;
            }
          }, 350);
        });
        $("btnClienteNuevo").addEventListener("click", () => { enEdicion = null; modo = "form"; pintar(); });
        $("cBuscar").focus();
        return;
      }
      if (modo === "ficha") {
        v.innerHTML = `${pasos(1)}${fichaCliente(cli)}
          <div class="barra-accion">
            <button type="button" class="btn btn-ghost" id="btnCambiarCli">Cambiar cliente</button>
            <a class="btn btn-primary" href="#/nuevo/productos" id="btnAProductos">Continuar a productos</a>
          </div>`;
        $("btnLapiz").addEventListener("click", () => { enEdicion = cli; modo = "form"; pintar(); });
        $("btnCambiarCli").addEventListener("click", () => { borrarLS(K_CLIENTE); modo = "buscar"; pintar(); });
        const g = $("btnGpsFicha");
        if (g) g.addEventListener("click", () => tomarGps(g, (lat, lng) => {
          fijarCliente({ ...cli, latitud: lat, longitud: lng });
          if (cli.id) api("guardarCliente", { cliente: { ...cli, id: cli.id, latitud: lat, longitud: lng } }).catch(() => {});
          toast("Ubicación guardada"); pintar();
        }));
        return;
      }
      /* modo form: cliente nuevo o edición con el lápiz */
      v.innerHTML = pasos(1) + formCliente(enEdicion);
      const pintarGps = (prec) => {
        const lat = $("cLat").value, lng = $("cLng").value;
        $("gpsEstado").innerHTML = lat && lng
          ? `Ubicación lista${prec ? ` (±${Math.round(prec)} m)` : ""} · <a href="${esc(linkMapa(lat, lng))}" target="_blank" rel="noopener">ver mapa</a>`
          : "Sin ubicación";
        $("btnGps").textContent = lat && lng ? "Volver a tomar ubicación" : "Tomar ubicación GPS del cliente";
      };
      pintarGps();
      $("btnGps").addEventListener("click", () => tomarGps($("btnGps"), (lat, lng, prec) => { $("cLat").value = lat; $("cLng").value = lng; pintarGps(prec); }));
      $("btnCliVolver").addEventListener("click", () => { modo = enEdicion || clienteElegido() ? "ficha" : "buscar"; pintar(); });
      $("fCli").addEventListener("input", () => { $("cError").hidden = true; });
      $("cNegocio").focus();
      $("fCli").addEventListener("submit", async (e) => {
        e.preventDefault();
        const c = {
          id: enEdicion ? enEdicion.id : undefined,
          negocio: $("cNegocio").value.trim(), contacto: $("cContacto").value.trim(), rif_cedula: $("cRif").value.trim(),
          telefono: $("cTel1").value.trim(), telefono2: $("cTel2").value.trim(), direccion: $("cDireccion").value.trim(),
          latitud: $("cLat").value, longitud: $("cLng").value,
        };
        const faltan = validarCliente(c);
        if (faltan.length) { $("cError").textContent = "Falta: " + faltan.join(" · "); $("cError").hidden = false; return; }
        if (c.id) {
          // Cliente existente: el lápiz guarda los cambios en la hoja enseguida
          const b = $("btnCliUsar");
          b.disabled = true;
          try {
            const r = await api("guardarCliente", { cliente: c });
            fijarCliente({ ...c, negocio: r.cliente.nombre });
            toast("Datos del cliente actualizados");
          } catch (e2) {
            if (e2.code === "auth") throw e2;
            if (!(e2 instanceof ErrorRed)) { $("cError").textContent = e2.message; $("cError").hidden = false; b.disabled = false; return; }
            fijarCliente(c);
            toast("Sin señal: los cambios se guardan con el pedido.");
          }
        } else {
          fijarCliente(c);
        }
        modo = "ficha"; pintar();
      });
    };
    pintar();
  }

  /* ---------- Nuevo pedido: 3) enviar (pago, nota o factura) ---------- */
  function vNuevoEnviar(v) {
    const cli = clienteElegido();
    if (!cli) return ir("#/nuevo");
    const items = itemsDePedido(carrito(), allProductsMap());
    if (!items.length) return ir("#/nuevo/productos");
    const total = items.reduce((a, it) => a + it.cajas, 0);
    const unidades = {};
    items.forEach((it) => { if (it.total_unidades) unidades[it.unidad] = (unidades[it.unidad] || 0) + it.total_unidades; });
    v.innerHTML = `${pasos(3)}
      <a class="cliente-elegido" href="#/nuevo"><span>Para</span><strong>${esc(cli.negocio || cli.contacto)}</strong><em>Cambiar</em></a>
      <section class="tarjeta">
        <div class="fila-top"><h3 class="sub-titulo">Productos</h3><a class="link-btn" href="#/nuevo/productos">Cambiar</a></div>
        <ul class="resumen-items">${items.map((it) => `<li><span>${it.cajas} × ${esc(it.producto)}</span><em>${it.total_unidades ? `${it.total_unidades} ${esc(it.unidad)}` : ""}</em></li>`).join("")}</ul>
        <p class="total-ped"><strong>Total: ${total} caja${total === 1 ? "" : "s"}</strong> · ${Object.entries(unidades).map(([u, n]) => `${n} ${esc(u)}`).join(" + ")}</p>
      </section>
      <form id="fEnviar" novalidate>
        <fieldset class="pay documento" id="fsDoc"><legend>¿El cliente quiere nota de entrega o factura? *</legend>
          <label class="pay-opt"><input type="radio" name="eDoc" value="Nota de entrega" /> Nota de entrega</label>
          <label class="pay-opt"><input type="radio" name="eDoc" value="Factura" /> Factura</label>
          <label class="field field-full" id="eRifWrap" hidden><span>RIF o cédula para la factura *</span>
            <input id="eRif" type="text" autocomplete="off" autocapitalize="characters" placeholder="J-12345678-9" value="${esc(cli.rif_cedula || "")}" /></label>
        </fieldset>
        <fieldset class="pay"><legend>Método de pago</legend>
          ${["Bolívares · Contado", "Bolívares · Crédito", "Divisas · Contado", "Divisas · Crédito"].map((p) =>
            `<label class="pay-opt"><input type="radio" name="ePago" value="${p}" /> ${p}</label>`).join("")}
        </fieldset>
        <label class="field field-full"><span>Nota (entrega, descuento, etc.)</span><textarea id="eNota" rows="2" maxlength="300" placeholder="Opcional"></textarea></label>
        <p class="form-warn" id="eError" hidden></p>
        <div class="barra-accion">
          <a class="btn btn-ghost" href="#/nuevo/productos">Atrás</a>
          <button type="submit" class="btn btn-primary" id="btnEnviar">Enviar pedido</button>
        </div>
      </form>`;
    const doc = () => (document.querySelector('input[name="eDoc"]:checked') || {}).value || "";
    $("fEnviar").addEventListener("input", () => { $("eError").hidden = true; });
    $("fsDoc").addEventListener("change", () => {
      $("eRifWrap").hidden = doc() !== "Factura";
      $("fsDoc").classList.remove("falta");
      if (doc() === "Factura" && !$("eRif").value) $("eRif").focus();
    });
    $("fEnviar").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("eError");
      const d = doc();
      const rif = $("eRif").value.trim();
      const mostrar = (m, el) => { err.textContent = m; err.hidden = false; (el || err).scrollIntoView({ block: "center" }); };
      if (!d) { $("fsDoc").classList.add("falta"); return mostrar("Elegí si el cliente quiere nota de entrega o factura.", $("fsDoc")); }
      if (d === "Factura" && rif.replace(/\D/g, "").length < 6) return mostrar("Para factura hace falta el RIF o la cédula.", $("eRifWrap"));
      err.hidden = true;
      const { _listo, ...cliente } = cli;
      if (d === "Factura") cliente.rif_cedula = rif;
      const its = itemsDePedido(carrito(), allProductsMap());
      const datos = { client_ref: nuevoRef(), cliente, items: its, documento: d,
        pago: (document.querySelector('input[name="ePago"]:checked') || {}).value || "", nota: $("eNota").value.trim() };
      const btn = $("btnEnviar");
      btn.disabled = true; btn.textContent = "Enviando…";
      const terminar = (listo) => {
        guardarCarrito({});
        borrarLS(K_CLIENTE);
        sessionStorage.setItem(K_LISTO, JSON.stringify(listo));
        ir("#/nuevo/listo");
      };
      try {
        const r = await api("guardarPedido", datos);
        terminar({ pedido: r.pedido, cliente: r.cliente || cliente });
      } catch (e2) {
        btn.disabled = false; btn.textContent = "Enviar pedido";
        if (e2 instanceof ErrorRed) { SkalaAPI.encolar(datos); return terminar({ offline: true, cliente }); }
        if (e2.code === "auth") throw e2;
        mostrar(e2.message);
      }
    });
  }

  /* ---------- Nuevo pedido: 3) listo ---------- */
  function vNuevoListo(v) {
    let d = null;
    try { d = JSON.parse(sessionStorage.getItem(K_LISTO)); } catch (e) {}
    if (!d) return ir("#/pedidos");
    if (d.offline) {
      v.innerHTML = `<div class="tarjeta listo"><h2>Guardado en el teléfono</h2>
        <p class="vend-ok">No hay señal. El pedido quedó guardado en este teléfono y se subirá solo cuando vuelva la conexión (o con "Subir ahora", arriba). Después podés enviarlo al grupo desde Pedidos.</p>
        <a class="btn btn-primary btn-bloque" href="#/nuevo">Nuevo pedido</a></div>`;
      return;
    }
    const mensaje = mensajeGrupo(d.pedido, d.cliente);
    const tel = telefonoWhatsapp(d.cliente.telefono);
    v.innerHTML = `<div class="tarjeta listo">
      <h2>Pedido ${esc(d.pedido.id)} guardado</h2>
      <p class="vend-ok">Quedó registrado en la hoja de pedidos. Ahora envialo al grupo de la empresa.</p>
      <button type="button" class="btn btn-primary btn-bloque" id="btnGrupo">Enviar al grupo de WhatsApp</button>
      ${tel ? `<a class="btn btn-ghost btn-bloque" target="_blank" rel="noopener" id="btnCopia" href="https://wa.me/${tel}?text=${encodeURIComponent("Hola! Te comparto el resumen de tu pedido Skala:\n\n" + mensaje)}">Copia al cliente</a>` : ""}
      <label class="field field-full"><span>Mensaje para el grupo</span><textarea id="lMensaje" readonly rows="10">${esc(mensaje)}</textarea></label>
      <div class="fila-botones">
        <a class="btn btn-ghost" href="#/pedido/${encodeURIComponent(d.pedido.id)}">Ver pedido</a>
        <a class="btn btn-ghost" href="#/nuevo">Nuevo pedido</a>
      </div></div>`;
    $("btnGrupo").addEventListener("click", () => enviarAlGrupo(mensaje));
  }

  /* ---------- Pedidos / Entregas ---------- */
  function filaPedido(p) {
    const r = rol();
    const extra = r === "vendedor" ? (p.despachador ? `Despacha: ${p.despachador}` : "")
      : r === "despachador" ? ((p.cliente_datos || {}).direccion || "") : `Vendedor: ${p.vendedor}${p.despachador ? ` · Despacha: ${p.despachador}` : ""}`;
    return `<li><a class="fila-ped est-borde-${esc(p.estado)}" href="#/pedido/${encodeURIComponent(p.id)}">
      <div class="fila-top"><strong>${esc(p.negocio)}</strong>${chipEstado(p.estado)}</div>
      <div class="ped-det">${esc(p.id)} · ${esc(fechaLegible(p.fecha))}</div>
      <div class="ped-det">${esc(p.total_cajas)} caja(s)${p.detalle_unidades ? " · " + esc(p.detalle_unidades) : ""}</div>
      ${extra ? `<div class="ped-det">${esc(extra)}</div>` : ""}
    </a></li>`;
  }

  async function vPedidos(v, _p, query, vigente) {
    const tabs = pestanasPanel(rol()).filter((t) => t.estados);
    const tab = tabs.find((t) => t.id === query.get("tab")) || tabs[0];
    const base = rol() === "despachador" ? "#/entregas" : "#/pedidos";
    v.innerHTML = `
      <div class="periodos" role="tablist">${tabs.map((t) => `<a role="tab" class="tab${t.id === tab.id ? " active" : ""}" aria-selected="${t.id === tab.id}" href="${base}?tab=${t.id}">${esc(t.nombre)}</a>`).join("")}</div>
      <p class="modal-sub" id="pInfo">Cargando…</p>
      <ul class="lista-ped" id="pLista"></ul>`;
    const r = await api("pedidos", { estados: tab.estados, dias: 60 });
    if (!vigente()) return;
    $("pInfo").textContent = r.pedidos.length ? `${r.pedidos.length} pedido(s)` : "";
    $("pLista").innerHTML = r.pedidos.length ? r.pedidos.map(filaPedido).join("") : '<li class="vacio-panel">No hay pedidos en esta lista.</li>';
  }

  /* ---------- Detalle de pedido ---------- */
  const ETIQUETAS = { confirmar: "Aprobar", en_ruta: "Salió en ruta", entregado: "Entregado", reasignar: "Cambiar despachador", cancelar: "Anular pedido", reabrir: "Volver a En proceso" };
  async function vPedido(v, id, _q, vigente) {
    const { pedido: p } = await api("pedido", { pedido_id: id });
    if (!vigente()) return;
    $("appTitulo").textContent = p.id;
    const c = p.cliente_datos || {};
    const tel = telLink(c.telefono), tel2 = telLink(c.telefono2);
    const wa = telefonoWhatsapp(c.telefono);
    const mapa = linkMapa(c.latitud, c.longitud);
    const acciones = accionesPedido(rol(), yo().id, p);
    const principal = ["confirmar", "en_ruta", "entregado"];
    v.innerHTML = `
      <section class="tarjeta">
        <div class="fila-top"><h2 class="ped-titulo">${esc(p.negocio)}</h2>${chipEstado(p.estado)}</div>
        ${p.cliente && p.cliente !== p.negocio ? `<p class="ped-det">${esc(p.cliente)}</p>` : ""}
        ${c.direccion ? `<p class="ped-det">${esc(c.direccion)}</p>` : ""}
        <div class="botones-contacto">
          ${tel ? `<a class="btn btn-ghost" href="tel:${esc(tel)}">Llamar</a>` : ""}
          ${tel2 ? `<a class="btn btn-ghost" href="tel:${esc(tel2)}">Tel. 2</a>` : ""}
          ${wa ? `<a class="btn btn-ghost" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
          ${mapa ? `<a class="btn btn-ghost" href="${esc(mapa)}" target="_blank" rel="noopener">Mapa</a>` : ""}
        </div>
      </section>
      ${acciones.length ? `<div class="acciones-ped">${acciones.map((a) => `<button type="button" class="btn ${principal.includes(a) ? "btn-primary" : "btn-ghost"}" data-acc="${a}">${ETIQUETAS[a]}</button>`).join("")}</div>` : ""}
      <section class="tarjeta">
        <h3 class="sub-titulo">Productos</h3>
        <table class="tabla"><thead><tr><th>Producto</th><th>Cajas</th></tr></thead><tbody>
          ${p.items.map((it) => `<tr><td>${esc(it.producto)} <span class="ped-det">${esc(it.code)}${it.total_unidades ? ` · ${it.total_unidades} ${esc(it.unidad)}` : ""}</span></td><td>${it.cajas}</td></tr>`).join("")}
        </tbody></table>
        <p class="total-ped"><strong>Total: ${p.total_cajas} caja${p.total_cajas === 1 ? "" : "s"}</strong>${p.detalle_unidades ? ` · ${esc(p.detalle_unidades)}` : ""}</p>
        <dl class="datos">
          <dt>Fecha</dt><dd>${esc(fechaLegible(p.fecha))}</dd>
          <dt>Vendedor</dt><dd>${esc(p.vendedor)}</dd>
          ${p.despachador ? `<dt>Despachador</dt><dd>${esc(p.despachador)}</dd>` : ""}
          ${p.documento ? `<dt>Documento</dt><dd>${esc(p.documento)}</dd>` : ""}
          ${p.pago ? `<dt>Pago</dt><dd>${esc(p.pago)}</dd>` : ""}
          ${p.nota ? `<dt>Nota</dt><dd>${esc(p.nota)}</dd>` : ""}
          ${p.motivo ? `<dt>Motivo</dt><dd>${esc(p.motivo)}</dd>` : ""}
        </dl>
      </section>
      <button type="button" class="btn btn-ghost btn-bloque" id="btnReenviar">Reenviar al grupo de WhatsApp</button>
      ${p.historial && p.historial.length ? `<section class="tarjeta"><h3 class="sub-titulo">Historial</h3><ol class="historial">${p.historial.map((h) =>
        `<li><strong>${esc({ creado: "Enviado (en proceso)", reasignado: "Despachador cambiado", pendiente: "Vuelto a En proceso", confirmado: "Aprobado" }[h.accion] || nombreEstado(h.accion))}</strong> · ${esc(h.usuario)}<br><span class="ped-det">${esc(new Date(h.fecha).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" }))}${h.detalle ? " · " + esc(h.detalle) : ""}</span></li>`).join("")}</ol></section>` : ""}`;

    $("btnReenviar").addEventListener("click", () => enviarAlGrupo(mensajeGrupo(p, c)));
    v.querySelectorAll("[data-acc]").forEach((b) => b.addEventListener("click", () => accionPedido(p, b.dataset.acc)));
  }

  async function accionPedido(p, acc) {
    let estado = acc, extra = {};
    if (acc === "confirmar" || acc === "reasignar") {
      const { despachadores } = await api("despachadores");
      if (!despachadores.length) return toast("No hay despachadores activos. Crealos en Más → Usuarios.");
      const r = await hoja({
        titulo: acc === "confirmar" ? `Aprobar ${p.id}` : "Cambiar despachador",
        cuerpo: `<p class="modal-sub">${esc(p.negocio)} · ${p.total_cajas} caja(s)${acc === "confirmar" ? " · pasa a <strong>Aprobado · Preparando despacho</strong>" : ""}</p>
          <label class="field field-full"><span>¿Quién lo despacha?</span><select name="despachador_id" id="hDesp"><option value="">Elegí quién lo lleva</option>${despachadores.map((d) =>
            `<option value="${esc(d.id)}"${d.id === p.despachador_id ? " selected" : ""}>${esc(d.nombre)}</option>`).join("")}</select></label>`,
        ok: acc === "confirmar" ? "Aprobar" : "Guardar",
        validar: (d) => (d.despachador_id ? "" : "Elegí un despachador."),
      });
      if (!r) return;
      estado = acc === "confirmar" ? "confirmado" : p.estado;
      extra.despachador_id = r.despachador_id;
    } else if (acc === "cancelar") {
      const r = await hoja({
        titulo: `Anular ${p.id}`,
        cuerpo: '<label class="field field-full"><span>Motivo de la anulación</span><textarea name="motivo" rows="3" maxlength="200" placeholder="Ej. sin stock, cliente no confirmó el pago"></textarea></label>',
        ok: "Anular pedido",
        validar: (d) => (d.motivo.trim() ? "" : "Escribí el motivo."),
      });
      if (!r) return;
      estado = "cancelado"; extra.motivo = r.motivo.trim();
    } else if (acc === "entregado" || acc === "reabrir") {
      const r = await hoja({
        titulo: acc === "entregado" ? `¿Marcar ${p.id} como entregado?` : `¿Volver ${p.id} a En proceso?`,
        cuerpo: `<p class="modal-sub">${acc === "entregado" ? "Confirmá que el cliente recibió el pedido." : "Se quita el despachador y vuelve a Por aprobar."}</p>`,
        ok: acc === "entregado" ? "Sí, entregado" : "Volver a En proceso",
      });
      if (!r) return;
      estado = acc === "entregado" ? "entregado" : "pendiente";
    }
    try {
      await api("estado", { pedido_id: p.id, estado, ...extra });
      toast(`${p.id}: ${acc === "reasignar" ? "despachador cambiado" : nombreEstado(estado)}`);
      render();
    } catch (e) {
      toast(e.message);
    }
  }

  /* ---------- Clientes ---------- */
  let cacheClientes = [];
  async function vClientes(v, _p, _q, vigente) {
    v.innerHTML = `
      <a class="btn btn-primary btn-bloque" href="#/cliente/nuevo" id="btnAnadirCliente">Añadir cliente</a>
      <div class="buscador"><input type="search" id="kBuscar" placeholder="Buscar por nombre, negocio o teléfono" autocomplete="off" enterkeyhint="search" /></div>
      <p class="modal-sub" id="kInfo"></p>
      <ul class="lista-cli" id="kLista"><li class="cargando">Cargando…</li></ul>`;
    let t = null;
    const cargar = async (q) => {
      const r = await api("clientes", { q, limite: 100 });
      if (!vigente() || q !== $("kBuscar").value.trim()) return;
      cacheClientes = r.clientes;
      $("kInfo").textContent = r.clientes.length ? (q ? `${r.clientes.length} resultado(s)` : `${r.clientes.length} cliente(s) · los más recientes primero`) : "";
      $("kLista").innerHTML = r.clientes.length ? r.clientes.map((c) => `<li><a href="#/cliente/${encodeURIComponent(c.id)}">
          <strong>${esc(c.nombre)}</strong><span>${esc([c.contacto, c.telefono].filter(Boolean).join(" · "))}</span>
          ${c.direccion ? `<span>${esc(c.direccion)}</span>` : ""}</a></li>`).join("")
        : '<li class="vacio-panel">Sin clientes con esa búsqueda.</li>';
    };
    $("kBuscar").addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => cargar($("kBuscar").value.trim()).catch((e) => toast(e.message)), 350); });
    await cargar("");
  }

  async function vCliente(v, id, query, vigente) {
    if (id === "nuevo") return vClienteForm(v, null);
    let c = cacheClientes.find((x) => x.id === id);
    if (!c) { c = (await api("clientes", { q: "", limite: 200 })).clientes.find((x) => x.id === id); }
    if (!vigente()) return;
    if (!c) { v.innerHTML = '<p class="vacio-panel">Cliente no encontrado.</p>'; return; }
    if (query.get("editar")) return vClienteForm(v, c);
    $("appTitulo").textContent = c.nombre;
    const tel = telLink(c.telefono), tel2 = telLink(c.telefono2), wa = telefonoWhatsapp(c.telefono), mapa = linkMapa(c.latitud, c.longitud);
    v.innerHTML = `
      <section class="tarjeta">
        <h2 class="ped-titulo">${esc(c.nombre)}</h2>
        ${c.contacto ? `<p class="ped-det">${esc(c.contacto)}</p>` : ""}
        <dl class="datos">
          ${c.rif_cedula ? `<dt>RIF</dt><dd>${esc(c.rif_cedula)}</dd>` : ""}
          <dt>Teléfono</dt><dd>${esc([c.telefono, c.telefono2].filter(Boolean).join(" / ") || "—")}</dd>
          ${c.direccion ? `<dt>Dirección</dt><dd>${esc(c.direccion)}</dd>` : ""}
          <dt>GPS</dt><dd>${mapa ? "Registrada" : "Sin ubicación"}</dd>
        </dl>
        <div class="botones-contacto">
          ${tel ? `<a class="btn btn-ghost" href="tel:${esc(tel)}">Llamar</a>` : ""}
          ${tel2 ? `<a class="btn btn-ghost" href="tel:${esc(tel2)}">Tel. 2</a>` : ""}
          ${wa ? `<a class="btn btn-ghost" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
          ${mapa ? `<a class="btn btn-ghost" href="${esc(mapa)}" target="_blank" rel="noopener">Mapa</a>` : ""}
        </div>
        <button type="button" class="btn btn-primary btn-bloque" id="btnPedirCliente">Nuevo pedido para este cliente</button>
        <a class="btn btn-ghost btn-bloque" href="#/cliente/${encodeURIComponent(c.id)}?editar=1" id="btnEditarCliente">Editar datos</a>
      </section>
      <h3 class="sub-titulo">Pedidos</h3>
      <ul class="lista-ped" id="kPedidos"><li class="cargando">Cargando…</li></ul>`;
    $("btnPedirCliente").addEventListener("click", () => {
      fijarCliente({ id: c.id, contacto: c.contacto, negocio: c.nombre, rif_cedula: c.rif_cedula, telefono: c.telefono, telefono2: c.telefono2, direccion: c.direccion, latitud: c.latitud, longitud: c.longitud });
      ir("#/nuevo/productos");
    });
    const r = await api("pedidos", { cliente_id: c.id });
    if (!vigente()) return;
    $("kPedidos").innerHTML = r.pedidos.length ? r.pedidos.map(filaPedido).join("") : '<li class="vacio-panel">Todavía no tiene pedidos.</li>';
  }

  /* ---------- Añadir / editar cliente (sin pedido: traspaso de la base) ---------- */
  function vClienteForm(v, c) {
    const nuevo = !c;
    $("appTitulo").textContent = nuevo ? "Añadir cliente" : "Editar cliente";
    $("btnAtras").hidden = false;
    $("btnAtras").dataset.destino = nuevo ? "#/clientes" : `#/cliente/${encodeURIComponent(c.id)}`;
    const val = (k) => esc(c ? (k === "negocio" ? c.nombre : c[k]) ?? "" : "");
    v.innerHTML = `<form class="tarjeta" id="fNuevoCli" novalidate>
      ${nuevo ? '<p class="modal-sub">Para pasar tu base de clientes: no hace falta que tenga pedidos. Solo el nombre es obligatorio.</p>' : ""}
      <div class="form-grid">
        <label class="field"><span>Nombre del negocio</span><input id="fnNegocio" type="text" autocomplete="off" autocapitalize="words" enterkeyhint="next" placeholder="Peluquería / tienda" value="${val("negocio")}" /></label>
        <label class="field"><span>Nombre del cliente</span><input id="fnContacto" type="text" autocomplete="off" autocapitalize="words" enterkeyhint="next" placeholder="Persona de contacto" value="${val("contacto")}" /></label>
        <label class="field"><span>RIF / Cédula</span><input id="fnRif" type="text" autocomplete="off" autocapitalize="characters" enterkeyhint="next" placeholder="J-12345678-9" value="${val("rif_cedula")}" /></label>
        <label class="field"><span>Teléfono 1</span><input id="fnTel1" type="tel" inputmode="tel" autocomplete="off" enterkeyhint="next" placeholder="0412-1234567" value="${val("telefono")}" /></label>
        <label class="field"><span>Teléfono 2</span><input id="fnTel2" type="tel" inputmode="tel" autocomplete="off" enterkeyhint="next" placeholder="Opcional" value="${val("telefono2")}" /></label>
        <label class="field field-full"><span>Dirección</span><input id="fnDireccion" type="text" autocomplete="off" enterkeyhint="next" placeholder="Dirección" value="${val("direccion")}" /></label>
      </div>
      <fieldset class="pay ubicacion"><legend>Ubicación</legend>
        <label class="field field-full"><span>Pegar enlace de Google Maps o coordenadas</span>
          <input id="fnPegar" type="text" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="ej. 8.6123, -71.6543 o https://www.google.com/maps/…" /></label>
        <button type="button" class="btn btn-ghost btn-bloque" id="fnGps">Usar mi ubicación actual (estoy con el cliente)</button>
        <p class="gps-estado" id="fnGpsEstado"></p>
        <input type="hidden" id="fnLat" value="${val("latitud")}" /><input type="hidden" id="fnLng" value="${val("longitud")}" />
      </fieldset>
      <p class="form-warn" id="fnError" hidden></p>
      <div class="fila-botones">
        ${nuevo ? '<button type="button" class="btn btn-ghost" id="fnOtro">Guardar y añadir otro</button>' : `<a class="btn btn-ghost" href="#/cliente/${encodeURIComponent(c.id)}">Cancelar</a>`}
        <button type="submit" class="btn btn-primary" id="fnGuardar">Guardar cliente</button>
      </div>
    </form>`;
    const pintarUbic = (msg) => {
      const lat = $("fnLat").value, lng = $("fnLng").value;
      $("fnGpsEstado").innerHTML = msg ? esc(msg) : lat && lng
        ? `Ubicación lista (${esc(lat)}, ${esc(lng)}) · <a href="${esc(linkMapa(lat, lng))}" target="_blank" rel="noopener">ver mapa</a> · <button type="button" class="link-btn" id="fnQuitar">Quitar</button>`
        : "Sin ubicación (se puede agregar después).";
    };
    pintarUbic();
    $("fnPegar").addEventListener("input", () => {
      const t = $("fnPegar").value.trim();
      if (!t) return pintarUbic();
      const co = coordsDeTexto(t);
      if (co) { $("fnLat").value = co.lat; $("fnLng").value = co.lng; pintarUbic(); }
      else pintarUbic(/goo\.gl|maps\.app/.test(t)
        ? "Ese enlace corto no trae las coordenadas: abrilo, mantené presionado el punto en el mapa y copiá los números (ej. 8.6123, -71.6543)."
        : "No reconozco esa ubicación. Pegá coordenadas (8.6123, -71.6543) o un enlace largo de Google Maps.");
    });
    $("fnGpsEstado").addEventListener("click", (e) => {
      if (e.target.id === "fnQuitar") { $("fnLat").value = ""; $("fnLng").value = ""; $("fnPegar").value = ""; pintarUbic(); }
    });
    $("fnGps").addEventListener("click", () => {
      if (!navigator.geolocation) return toast("Este teléfono no permite GPS en el navegador.");
      const b = $("fnGps");
      b.disabled = true; b.textContent = "Buscando GPS…";
      navigator.geolocation.getCurrentPosition(
        (pos) => { $("fnLat").value = pos.coords.latitude.toFixed(6); $("fnLng").value = pos.coords.longitude.toFixed(6); b.disabled = false; b.textContent = "Usar mi ubicación actual (estoy con el cliente)"; pintarUbic(); },
        (err) => { b.disabled = false; b.textContent = "Usar mi ubicación actual (estoy con el cliente)"; toast(err.code === 1 ? "Permiso de ubicación negado." : "No se pudo obtener el GPS."); },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
    });
    const guardar = async (otro) => {
      const cliente = {
        id: c ? c.id : undefined, negocio: $("fnNegocio").value.trim(), contacto: $("fnContacto").value.trim(),
        rif_cedula: $("fnRif").value.trim(), telefono: $("fnTel1").value.trim(), telefono2: $("fnTel2").value.trim(),
        direccion: $("fnDireccion").value.trim(), latitud: $("fnLat").value, longitud: $("fnLng").value,
      };
      const faltan = validarCliente(cliente, { telefonoOpcional: true });
      const err = $("fnError");
      if (faltan.length) { err.textContent = "Falta: " + faltan.join(" · "); err.hidden = false; return; }
      err.hidden = true;
      const btns = v.querySelectorAll("#fnGuardar, #fnOtro");
      btns.forEach((b) => (b.disabled = true));
      try {
        const r = await api("guardarCliente", { cliente });
        cacheClientes = [r.cliente, ...cacheClientes.filter((x) => x.id !== r.cliente.id)];
        toast(r.existia ? `${r.cliente.nombre} ya existía: se actualizaron sus datos` : `Cliente ${r.cliente.nombre} guardado`);
        if (otro) { render(); return; }
        ir(`#/cliente/${encodeURIComponent(r.cliente.id)}`);
      } catch (e) {
        if (e.code === "auth") throw e;
        err.textContent = e instanceof ErrorRed ? "Sin señal: el cliente no se guardó. Probá de nuevo con conexión." : e.message;
        err.hidden = false;
        btns.forEach((b) => (b.disabled = false));
      }
    };
    $("fNuevoCli").addEventListener("submit", (e) => { e.preventDefault(); guardar(false); });
    const otro = $("fnOtro");
    if (otro) otro.addEventListener("click", () => guardar(true));
    $("fnNegocio").focus();
  }

  /* ---------- Resumen ---------- */
  let diasResumen = 30;
  async function vResumen(v, _p, _q, vigente) {
    const chips = `<div class="periodos">${[[1, "Hoy"], [7, "7 días"], [30, "30 días"], [90, "90 días"]].map(([d, t]) =>
      `<button type="button" class="tab${d === diasResumen ? " active" : ""}" data-dias="${d}">${t}</button>`).join("")}</div>`;
    v.innerHTML = chips + '<p class="cargando">Cargando…</p>';
    v.querySelector(".periodos").addEventListener("click", (e) => { const b = e.target.closest("[data-dias]"); if (b) { diasResumen = Number(b.dataset.dias); render(); } });
    const r = await api("resumen", { dias: diasResumen });
    if (!vigente()) return;
    const pe = r.por_estado;
    const tile = (n, t) => `<div class="stat"><strong>${esc(n)}</strong><span>${esc(t)}</span></div>`;
    const tabla = (filas, cols) => filas.length
      ? `<table class="tabla"><thead><tr>${cols.map((c) => `<th>${esc(c[0])}</th>`).join("")}</tr></thead><tbody>${filas.map((f) =>
        `<tr>${cols.map((c) => `<td>${esc(f[c[1]])}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      : '<p class="modal-sub">Sin datos en este período.</p>';
    v.innerHTML = chips +
      `<div class="stats">${tile(r.total_pedidos, "pedidos")}${tile(r.total_cajas, "cajas")}${tile(pe.entregado, "entregados")}${tile(pe.pendiente + pe.confirmado + pe.en_ruta, "en proceso")}</div>
      <p class="modal-sub">En proceso ${pe.pendiente} · Aprobados ${pe.confirmado} · En ruta ${pe.en_ruta} · Anulados ${pe.cancelado}</p>` +
      (r.por_vendedor.length ? `<section class="tarjeta"><h3 class="sub-titulo">Por vendedor</h3>${tabla(r.por_vendedor, [["Vendedor", "vendedor"], ["Pedidos", "pedidos"], ["Cajas", "cajas"]])}</section>` : "") +
      `<section class="tarjeta"><h3 class="sub-titulo">Productos más pedidos</h3>${tabla(r.por_producto, [["Producto", "producto"], ["Cajas", "cajas"]])}</section>
      <p class="nota-chica">Los anulados no suman cajas.</p>`;
    v.querySelector(".periodos").addEventListener("click", (e) => { const b = e.target.closest("[data-dias]"); if (b) { diasResumen = Number(b.dataset.dias); render(); } });
  }

  /* ---------- Usuarios (Master) ---------- */
  let cacheUsuarios = [];
  async function vUsuarios(v, _p, _q, vigente) {
    const r = await api("usuarios");
    if (!vigente()) return;
    cacheUsuarios = r.usuarios;
    const orden = { master: 0, admin: 1, vendedor: 2, despachador: 3 };
    const lista = r.usuarios.slice().sort((a, b) => orden[a.rol] - orden[b.rol] || a.nombre.localeCompare(b.nombre));
    v.innerHTML = `<a class="btn btn-primary btn-bloque" href="#/usuario/nuevo">Nuevo usuario</a>
      <ul class="usuarios-lista">${lista.map((u) => `<li class="${u.activo ? "" : "inactivo"}">
        <div><strong>${esc(u.nombre)}</strong> <span class="ped-det">@${esc(u.usuario)}</span></div>
        <div class="ped-det"><span class="rol rol-${esc(u.rol)}">${esc(u.rol_nombre)}</span>${u.activo ? "" : " · Inactivo"}</div>
        <a class="btn btn-ghost" href="#/usuario/${encodeURIComponent(u.id)}">Editar</a>
      </li>`).join("")}</ul>`;
  }

  async function vUsuario(v, id, _q, vigente) {
    const nuevo = id === "nuevo";
    let u = null;
    if (!nuevo) {
      u = cacheUsuarios.find((x) => x.id === id);
      if (!u) { cacheUsuarios = (await api("usuarios")).usuarios; u = cacheUsuarios.find((x) => x.id === id); }
      if (!vigente()) return;
      if (!u) { v.innerHTML = '<p class="vacio-panel">Usuario no encontrado.</p>'; return; }
    }
    $("appTitulo").textContent = nuevo ? "Nuevo usuario" : u.nombre;
    v.innerHTML = `<form class="tarjeta" id="fUsuario" novalidate>
      <label class="field field-full"><span>Usuario (para ingresar)</span><input id="uUsuario" type="text" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="off" placeholder="ej. kevin" value="${esc(u ? u.usuario : "")}" /></label>
      <label class="field field-full"><span>Nombre</span><input id="uNombre" type="text" autocapitalize="words" autocomplete="off" placeholder="ej. Kevin Pérez" value="${esc(u ? u.nombre : "")}" /></label>
      <label class="field field-full"><span>Rol</span><select id="uRol">${[["vendedor", "Vendedor"], ["despachador", "Despachador"], ["admin", "Administración"], ["master", "Master"]].map(([k, t]) =>
        `<option value="${k}"${(u ? u.rol : "vendedor") === k ? " selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="field field-full"><span>${nuevo ? "Clave" : "Clave nueva (dejar vacía para no cambiarla)"}</span>
        <span class="clave-wrap"><input id="uClave" type="password" maxlength="64" autocomplete="new-password" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Letras y números" />
        <button type="button" class="ver-clave" data-ver="uClave" aria-label="Mostrar clave">Ver</button></span></label>
      <p class="nota-chica">Mínimo 6 caracteres con letras y números (Master: 8). Puede llevar símbolos como * # @ !</p>
      <label class="check"><input type="checkbox" id="uActivo"${!u || u.activo ? " checked" : ""} /> Activo (puede ingresar)</label>
      <p class="form-warn" id="uError" hidden></p>
      <div class="fila-botones"><a class="btn btn-ghost" href="#/usuarios">Cancelar</a><button type="submit" class="btn btn-primary" id="btnGuardarUsuario">Guardar</button></div>
    </form>`;
    $("fUsuario").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("btnGuardarUsuario");
      btn.disabled = true;
      try {
        const r = await api("guardarUsuario", {
          id: u ? u.id : undefined, usuario: $("uUsuario").value.trim(), nombre: $("uNombre").value.trim(),
          rol: $("uRol").value, activo: $("uActivo").checked, clave: $("uClave").value || undefined,
        });
        toast(`Usuario ${r.usuario.usuario} guardado`);
        if (r.usuario.id === yo().id && (r.usuario.rol !== "master" || !r.usuario.activo)) { SkalaAPI.cerrarSesion(); return ir("#/ingresar"); }
        ir("#/usuarios");
      } catch (e2) {
        $("uError").textContent = e2.message; $("uError").hidden = false;
        btn.disabled = false;
      }
    });
  }

  /* ---------- Más ---------- */
  let eventoInstalar = null;
  function vMas(v) {
    const u = yo();
    const r = u.rol;
    const items = [];
    if (TOMAN.includes(r)) items.push(["#/resumen", "Resumen", "Pedidos, cajas y productos más pedidos"]);
    if (r === "master") items.push(["#/usuarios", "Usuarios", "Crear usuarios, claves, roles y activar"]);
    items.push(["index.html", "Ver catálogo", "La página que ven los clientes"]);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const instalada = window.matchMedia("(display-mode: standalone)").matches;
    v.innerHTML = `
      <section class="tarjeta perfil"><strong>${esc(u.nombre)}</strong><span>@${esc(u.usuario)} · ${esc(u.rol_nombre)}</span></section>
      <ul class="menu-mas">${items.map(([h, t, d]) => `<li><a href="${h}"><strong>${t}</strong><span>${d}</span></a></li>`).join("")}</ul>
      ${instalada ? "" : `<section class="tarjeta"><h3 class="sub-titulo">Instalar en el teléfono</h3>
        ${eventoInstalar ? '<button type="button" class="btn btn-primary btn-bloque" id="btnInstalar">Instalar app Skala Equipo</button>'
          : `<p class="modal-sub">${ios ? "En Safari: botón Compartir → <strong>Agregar a inicio</strong>." : "En Chrome: menú ⋮ → <strong>Instalar app</strong> o <strong>Agregar a pantalla principal</strong>."}</p>`}</section>`}
      <section class="tarjeta"><h3 class="sub-titulo">Tema</h3>
        <div class="selector-tema" role="group" aria-label="Tema de la app">${[["auto", "Automático"], ["claro", "Claro"], ["oscuro", "Oscuro"]].map(([k, t]) =>
          `<button type="button" data-tema="${k}" aria-pressed="${SkalaTema.pref() === k}">${t}</button>`).join("")}</div>
        <p class="nota-chica">Automático sigue el modo del teléfono.</p></section>
      <button type="button" class="btn btn-ghost btn-bloque" id="btnSalir">Cerrar sesión</button>`;
    v.querySelector(".selector-tema").addEventListener("click", (e) => {
      const b = e.target.closest("[data-tema]");
      if (!b) return;
      SkalaTema.fijar(b.dataset.tema);
      v.querySelectorAll(".selector-tema button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    });
    $("btnSalir").addEventListener("click", () => { SkalaAPI.cerrarSesion(); toast("Sesión cerrada"); ir("#/ingresar"); });
    const bi = $("btnInstalar");
    if (bi) bi.addEventListener("click", async () => { eventoInstalar.prompt(); await eventoInstalar.userChoice; eventoInstalar = null; render(); });
  }

  /* ==================== Arranque ==================== */
  document.addEventListener("DOMContentLoaded", () => {
    window.addEventListener("hashchange", render);
    $("btnAtras").addEventListener("click", () => {
      const d = $("btnAtras").dataset.destino;
      if (!d && history.length > 1) history.back(); else ir(d || "#/inicio");
    });
    $("btnSubirPend").addEventListener("click", () => subirCola(true));
    $("vista").addEventListener("click", (e) => {
      if (e.target.closest("[data-reintentar]")) render();
      const ver = e.target.closest(".ver-clave");
      if (ver) {
        const inp = $(ver.dataset.ver);
        const mostrar = inp.type === "password";
        inp.type = mostrar ? "text" : "password";
        ver.textContent = mostrar ? "Ocultar" : "Ver";
        ver.setAttribute("aria-label", mostrar ? "Ocultar clave" : "Mostrar clave");
        inp.focus();
      }
    });
    window.addEventListener("online", () => subirCola());
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); eventoInstalar = e; });
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
    if (!location.hash) location.replace("#/" + (sesion() ? "inicio" : "ingresar"));
    render();
    if (navigator.onLine) subirCola();
  });
})();
