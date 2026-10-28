/* ============================================================
   Skala — Panel del equipo (app con páginas)
   Rutas (#/...): ingresar · inicio · nuevo (1 cliente) · nuevo/productos (2) · nuevo/enviar (3) · nuevo/listo · pedidos ·
   pedido/ID · entregas · clientes · cliente/ID · resumen · usuarios · usuario/ID · mas
   Datos: Google Sheets vía js/crm-api.js. Permisos: el servidor valida cada acción.
   ============================================================ */
(function () {
  const { sesion, ErrorRed, leerLS, guardarLS, borrarLS } = SkalaAPI;
  /* Toda llamada al CRM muestra la barrita de carga arriba (si tarda más de 150 ms) */
  let enCurso = 0, tCarga = null;
  function cargando(mas) {
    enCurso = Math.max(0, enCurso + mas);
    const b = document.getElementById("barraCarga");
    if (!b) return;
    clearTimeout(tCarga);
    if (enCurso) tCarga = setTimeout(() => { b.hidden = false; }, 150);
    else b.hidden = true;
  }
  const api = (...a) => {
    cargando(1);
    return SkalaAPI.api(...a).then((r) => { pintarModoLocal(r); return r; }).finally(() => cargando(-1));
  };
  const APP = SkalaAPI.app(); // puente de la app Android (null en el navegador)
  const horaCorta = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const hoy = new Date(), ayer = new Date(Date.now() - 86400000);
    const dia = d.toDateString() === hoy.toDateString() ? "hoy" : d.toDateString() === ayer.toDateString() ? "ayer" : d.toLocaleDateString("es-VE");
    return `${dia} ${d.toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" })}`;
  };
  /* Sin señal: aviso de que se ven los datos guardados en el teléfono */
  function pintarModoLocal(r) {
    const el = document.getElementById("modoLocal");
    if (!el || !r || typeof r !== "object") return;
    if (r.local) { el.textContent = `Sin señal · mostrando los datos guardados (${horaCorta(r.fecha_local)})`; el.hidden = false; }
    else el.hidden = true;
  }
  /* Actualización automática 8 am, 1 pm y 4 pm (y al abrir si ya pasó la hora) */
  function autoSync() {
    if (!sesion()) return;
    const d = SkalaAPI.datosLocales();
    if (!debeSincronizar(d && d.fecha)) { pintarAvisoApp(d); return; }
    SkalaAPI.sincronizar().then((x) => { pintarAvisoApp(x); }).catch(() => {});
  }
  setInterval(autoSync, 10 * 60000);
  /* App Android: versión nueva disponible / obligatoria */
  function pintarAvisoApp(d) {
    const el = document.getElementById("avisoApp");
    if (!el || !APP || !d || !d.config) return;
    let ver = 0;
    try { ver = Number(APP.versionCode()); } catch (e) {}
    const e = estadoApp(ver, d.config);
    el.hidden = !e.nueva;
    if (!e.nueva) return;
    el.innerHTML = `<span>${e.obligatoria ? "<strong>Actualización obligatoria.</strong> " : ""}Hay una versión nueva de la app${d.config.notas ? `: ${esc(d.config.notas)}` : "."}</span>
      <button type="button" class="btn btn-primary" id="btnActualizarApp">Actualizar</button>`;
    el.classList.toggle("obligatoria", e.obligatoria);
    document.body.classList.toggle("app-bloqueada", e.obligatoria);
    $("btnActualizarApp").onclick = () => { try { APP.actualizarApp(d.config.url_apk); toast("Descargando la actualización…"); } catch (x) { toast("No se pudo descargar."); } };
  }
  const spin = (texto = "Cargando…") => `<div class="cargando" role="status"><span class="spinner" aria-hidden="true"></span><span>${texto}</span></div>`;
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /* "1.234,56" · "1234.56" · "120,5" → número con 2 decimales (0 si no es válido) */
  const montoNum = (t) => {
    let x = String(t ?? "").trim().replace(/\s|USD|Bs\.?|\$/gi, "");
    if (x.includes(",")) x = x.replace(/\./g, "").replace(",", ".");
    const n = Number(x);
    return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  };
  const K_CARRITO = "skala_pedido_v1";   // compartido con el catálogo
  const K_CLIENTE = "skala_vcliente_v1"; // borrador del cliente del pedido
  const K_LISTO = "skala_ultimo_pedido";
  const K_DESTINO = "skala_destino";
  const K_ULTIMO_USUARIO = "skala_ultimo_usuario";
  const K_CARGA = "skala_carga";          // pedidos elegidos para ver el total de carga
  const K_WEB = "skala_tomando_web";      // pedido web que se está tomando (id, cliente, forma de pago)
  const TODOS = ["master", "admin", "vendedor", "despachador"];
  const TOMAN = ["master", "admin", "vendedor"];
  const rol = () => (sesion() || { usuario: {} }).usuario.rol; // el de más rango
  /* Varios roles: el usuario puede hacer todo lo de cada uno */
  const roles = () => { const u = (sesion() || { usuario: {} }).usuario; return u.roles && u.roles.length ? u.roles : u.rol ? [u.rol] : []; };
  const tiene = (...rs) => rs.some((r) => roles().includes(r));
  const vende = () => tiene("master", "admin", "vendedor");     // toma pedidos, clientes, cobros
  const gestion = () => tiene("master", "admin");
  const soloDespacha = () => tiene("despachador") && !vende();
  const enEntregas = () => location.hash.startsWith("#/entregas");
  /* Rol con el que se arman las pestañas de Pedidos (el de más rango entre los que venden) */
  const rolPedidos = () => ["master", "admin", "vendedor"].find((r) => tiene(r)) || "despachador";
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
    web: { titulo: "Pedido web", roles: TOMAN, nav: "pedidos", atras: "#/pedidos?tab=web", render: vWeb },
    carga: { titulo: "Total de carga", roles: ["despachador", "master", "admin"], atras: true, render: vCarga },
    clientes: { titulo: "Clientes", roles: TOMAN, nav: "clientes", render: vClientes },
    cliente: { titulo: "Cliente", roles: TOMAN, nav: "clientes", atras: "#/clientes", render: vCliente },
    resumen: { titulo: "Resumen", roles: TOMAN, nav: "mas", atras: "#/mas", render: vResumen },
    inventario: { titulo: "Inventario y precios", roles: ["master", "admin"], nav: "mas", atras: "#/mas", render: vInventario },
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

  let renderId = 0, ultimaClave = "";
  async function render() {
    const id = ++renderId;
    delete document.body.dataset.lista; // marca de "página lista" (la usan las pruebas)
    const { clave, param, query } = leerRuta();
    let def = RUTAS[clave];
    const s = sesion();
    if (!def) return ir(s ? "#/inicio" : "#/ingresar");
    if (!def.publica && !s) { sessionStorage.setItem(K_DESTINO, location.hash); return ir("#/ingresar"); }
    if (def.roles && !def.roles.some((r) => roles().includes(r))) return ir("#/inicio");
    if (clave === "ingresar" && s) return ir("#/inicio");

    document.title = `${def.titulo} · Skala Equipo`;
    $("appTitulo").textContent = def.titulo;
    $("btnAtras").hidden = !def.atras;
    $("btnAtras").dataset.destino = typeof def.atras === "string" ? def.atras : "";
    $("appQuien").textContent = s ? `${s.usuario.nombre} · ${s.usuario.rol_nombre}` : "";
    $("btnMas").hidden = !s;
    $("btnMas").classList.toggle("activa", def.nav === "mas");
    if (def.nav === "mas") $("btnMas").setAttribute("aria-current", "page"); else $("btnMas").removeAttribute("aria-current");
    pintarNav(def.nav);
    pintarCola();
    const vista = $("vista");
    vista.classList.remove("entra");
    $("modoLocal").hidden = true;
    vista.innerHTML = spin();
    window.scrollTo(0, 0);
    try {
      await def.render(vista, param, query, () => id === renderId);
    } catch (e) {
      if (id !== renderId) return;
      if (e.code === "auth") { sessionStorage.setItem(K_DESTINO, location.hash); return ir("#/ingresar"); }
      vista.innerHTML = `<div class="aviso-error"><p>${esc(e.message)}</p><button type="button" class="btn btn-ghost" data-reintentar>Reintentar</button></div>`;
    }
    if (id === renderId) {
      // transición suave al cambiar de página
      if (clave !== ultimaClave) { void vista.offsetWidth; vista.classList.add("entra"); }
      ultimaClave = clave;
      vista.focus({ preventScroll: true });
      document.body.dataset.lista = location.hash;
    }
  }

  function pintarNav(activa) {
    const nav = $("appNav");
    if (!rol()) { nav.hidden = true; document.body.classList.remove("con-nav"); return; }
    const items = [["inicio", "Inicio"]];
    if (vende()) items.push(["nuevo", "Nuevo"], ["pedidos", "Pedidos"], ["clientes", "Clientes"]);
    if (tiene("despachador")) items.push(["entregas", "Entregas"]);
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
  function hoja({ titulo, cuerpo, ok = "Aceptar", validar, alAbrir }) {
    return new Promise((resolve) => {
      $("hojaTitulo").textContent = titulo;
      $("hojaCuerpo").innerHTML = cuerpo || "";
      $("hojaOk").textContent = ok;
      $("hojaError").hidden = true;
      const modal = $("hoja"), form = $("hojaForm");
      modal.hidden = false;
      document.body.classList.add("modal-open");
      if (alAbrir) alAbrir(form);
      (form.querySelector("select, textarea, input:not([type=radio])") || form).focus();
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
    if (APP) { try { APP.compartir(mensaje); return; } catch (e) {} }
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
        ${APP ? "" : '<a class="btn btn-ghost btn-bloque" href="index.html">Volver al catálogo</a>'}
      </form>`;
    ($("lUsuario").value ? $("lClave") : $("lUsuario")).focus();
    $("fLogin").onsubmit = async (e) => {
      e.preventDefault();
      const usuario = $("lUsuario").value.trim();
      const clave = $("lClave").value;
      const err = !usuario ? "Escribí tu usuario." : !clave ? "Escribí tu clave." : "";
      if (err) { $("lError").textContent = err; $("lError").hidden = false; return; }
      const btn = $("btnLogin");
      btn.disabled = true; btn.classList.add("ocupado"); btn.textContent = "Entrando…";
      try {
        // "pin" también, por compatibilidad con un servidor publicado sin actualizar
        const r = await api("login", { usuario, clave, pin: clave, dispositivo: !!APP });
        SkalaAPI.guardarSesion(r.token, r.usuario);
        guardarLS(K_ULTIMO_USUARIO, r.usuario.usuario);
        toast(`Hola, ${r.usuario.nombre}`);
        subirCola();
        // Primera vez en este teléfono: baja la base de datos de la nube
        SkalaAPI.sincronizar().then((x) => { toast("Datos descargados en el teléfono"); pintarAvisoApp(x); }).catch(() => {});
        const destino = sessionStorage.getItem(K_DESTINO);
        sessionStorage.removeItem(K_DESTINO);
        ir(destino && !destino.includes("ingresar") ? destino : "#/inicio");
      } catch (e2) {
        $("lError").textContent = e2.message; $("lError").hidden = false;
        $("lClave").value = "";
        btn.disabled = false; btn.classList.remove("ocupado"); btn.textContent = "Entrar";
      }
    };
  }

  /* ---------- Inicio ---------- */
  async function vInicio(v, _p, _q, vigente) {
    const u = yo();
    const r = rolPedidos();
    const hora = new Date().getHours();
    const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
    const accesos = [];
    if (vende()) accesos.push(["#/nuevo", "Nuevo pedido", "nuevo"], ["#/pedidos", "Pedidos", "pedidos"], ["#/clientes", "Clientes", "clientes"]);
    if (tiene("despachador")) accesos.push(["#/entregas", "Mis entregas", "entregas"]);
    v.innerHTML = `
      <section class="saludo"><h2>${saludo}, ${esc(u.nombre.split(" ")[0])}</h2><p>${esc(u.rol_nombre)}</p></section>
      <div class="stats" id="iStats"><div class="stat"><strong>…</strong><span>cargando</span></div></div>
      <div id="iDestacado"></div>
      <div class="accesos">${accesos.map(([h, t, k]) => `<a class="acceso" href="${h}">${icono(k)}<span>${t}</span></a>`).join("")}</div>
      <h3 class="sub-titulo" id="iListaTit"></h3>
      <ul class="lista-ped" id="iLista"></ul>`;
    const abiertos = await api("pedidos", { estados: ["pendiente", "confirmado", "en_ruta"], dias: 60 });
    if (!vigente()) return;
    const c = { pendiente: 0, confirmado: 0, en_ruta: 0 };
    abiertos.pedidos.forEach((p) => (c[p.estado] = (c[p.estado] || 0) + 1));
    const tile = (n, t, h) => `<a class="stat" href="${h}"><strong>${n}</strong><span>${t}</span></a>`;
    let tiles = "";
    let destacados = [];
    let destacadoHtml = "";
    if (tiene("despachador")) {
      // Sus entregas (con varios roles, solo las asignadas a él)
      const mias = abiertos.pedidos.filter((p) => String(p.despachador_id) === String(u.id) && ["confirmado", "en_ruta"].includes(p.estado));
      const carga = totalCarga(mias);
      if (carga.cajas) {
        destacadoHtml += `<section class="tarjeta carga-hoy"><p>Hoy tenés por entregar</p>
          <p class="carga-grande"><strong>${carga.cajas}</strong> cajas</p><p class="ped-det">${carga.pedidos} pedido(s)${carga.unidades ? " · " + esc(carga.unidades) : ""}</p>
          <button type="button" class="btn btn-primary btn-bloque" id="btnCargaTodo">Ver total de carga</button></section>`;
      }
      if (soloDespacha()) {
        tiles = tile(mias.filter((p) => p.estado === "confirmado").length, "preparando despacho", "#/entregas") + tile(mias.filter((p) => p.estado === "en_ruta").length, "en ruta", "#/entregas");
        destacados = mias;
        $("iListaTit").textContent = destacados.length ? "Para entregar" : "";
      }
    }
    if (vende()) {
      const gestion = r !== "vendedor";
      const [hoy, porCobrar, porConciliar, web] = await Promise.all([
        api("resumen", { dias: 1 }),
        api("pedidos", { por_cobrar: true }),
        gestion ? api("pedidos", { por_conciliar: true }) : Promise.resolve({ pedidos: [] }),
        api("pedidosWeb").catch(() => ({ pedidos: [] })),
      ]);
      if (!vigente()) return;
      if (web.pedidos.length) {
        const n = web.pedidos.length;
        destacadoHtml += `<a class="tarjeta aviso-web-inicio" href="#/pedidos?tab=web" id="iWeb"><strong>${n} pedido${n === 1 ? "" : "s"} web</strong><span>${r === "vendedor" ? "Tus clientes los armaron en el catálogo: revisalos y envialos a Administración." : "Armados por clientes en el catálogo, esperando a su vendedor."}</span></a>`;
      }
      const vencidos = porCobrar.pedidos.filter((p) => { const ec = estadoCredito(p); return ec && (ec.nivel === "vencido" || ec.nivel === "muy_vencido"); }).length;
      const proximos = porCobrar.pedidos.filter((p) => { const ec = estadoCredito(p); return ec && ec.nivel === "proximo"; }).length;
      tiles = tile(hoy.total_pedidos, "pedidos hoy", "#/pedidos") + tile(hoy.total_cajas, "cajas hoy", "#/resumen") +
        tile(c.pendiente, r === "vendedor" ? "en proceso" : "por aprobar", "#/pedidos?tab=pendiente") +
        tile(c.confirmado + c.en_ruta, "en despacho", "#/pedidos?tab=curso") +
        `<a class="stat${vencidos ? " stat-alerta" : ""}" href="#/pedidos?tab=cobrar"><strong>${vencidos}</strong><span>crédito vencido${proximos ? ` · ${proximos} por vencer` : ""}</span></a>` +
        (gestion ? tile(porConciliar.pedidos.length, "por conciliar", "#/pedidos?tab=conciliar") : tile(porCobrar.pedidos.length, "por cobrar", "#/pedidos?tab=cobrar"));
      destacados = abiertos.pedidos.filter((p) => p.estado === "pendiente").slice(0, 5);
      $("iListaTit").textContent = destacados.length ? (r === "vendedor" ? "Tus pedidos en proceso" : "Por aprobar") : "";
    }
    $("iDestacado").innerHTML = destacadoHtml;
    const bc = $("btnCargaTodo");
    if (bc) bc.addEventListener("click", () => { sessionStorage.removeItem(K_CARGA); ir("#/carga"); });
    $("iStats").innerHTML = tiles;
    $("iLista").innerHTML = destacados.map((p) => filaPedido(p)).join("");
  }

  /* ---------- Nuevo pedido: 2) productos (cuadrícula: tocar = sumar una caja) ---------- */
  let filtroNuevo = "todos", busquedaNuevo = "";
  const K_MAYOR = "skala_precio_mayor"; // excepción: precio al mayor con menos de 15 cajas
  const excepcionMayor = () => !!leerLS(K_MAYOR, false);
  /* Precios y existencias: lo guardado ya, y se actualiza por detrás */
  async function preciosYStock(alCambiar) {
    const guardado = SkalaAPI.catalogoGuardado();
    const mapa = SkalaAPI.preciosMapa(guardado);
    SkalaAPI.catalogo().then((d) => { if (d !== guardado && alCambiar) alCambiar(SkalaAPI.preciosMapa(d)); }).catch(() => {});
    return mapa;
  }
  function vNuevoProductos(v, _p, _q, vigente) {
    const cli = clienteElegido();
    if (!cli) return ir("#/nuevo");
    const productos = [...BANOS.map((p) => ({ ...p, tipo: "banos" })), ...KITS.map((p) => ({ ...p, tipo: "kits" }))];
    let precios = {};
    v.innerHTML = `${pasos(2)}${avisoWeb()}
      <a class="cliente-elegido" href="#/nuevo"><span>Para</span><strong>${esc(cli.negocio || cli.contacto)}</strong><em>Cambiar</em></a>
      <div class="buscador"><input type="search" id="nBuscar" placeholder="Buscar producto o código" autocomplete="off" enterkeyhint="search" value="${esc(busquedaNuevo)}" /></div>
      <div class="periodos" id="nFiltros">${[["todos", "Todos"], ["banos", "Baños de crema"], ["kits", "Kits"], ["elegidos", "Elegidos"]].map(([k, t]) =>
        `<button type="button" class="tab${k === filtroNuevo ? " active" : ""}" data-f="${k}">${t}</button>`).join("")}</div>
      <p class="nota-chica nivel-aviso" id="nNivel" aria-live="polite"></p>
      <ul class="grilla-prod" id="nLista">${productos.map((p) => `
        <li class="pcard" data-code="${p.code}" data-tipo="${p.tipo}" data-texto="${esc((p.name + " " + p.code + " " + p.line).toLowerCase())}">
          <button type="button" class="pcard-tap" data-act="plus" aria-label="Sumar una caja de ${esc(p.name)}">
            <picture><source type="image/webp" srcset="assets/img/web/${p.code}-400.webp" />
              <img src="assets/img/${p.code}.png" alt="" width="64" height="51" loading="lazy" decoding="async" /></picture>
            <strong>${esc(p.name)}</strong>
            <span class="pcard-sub">${p.code} · ${esc(textoUnidades(p))}</span>
            <span class="pcard-precio" data-precio></span>
            <span class="pcard-stock" data-stock></span>
          </button>
          <b class="pcard-n" aria-hidden="true"></b>
          <div class="pcard-qty">
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
      Object.values(c).forEach((n) => { total += Number(n) || 0; });
      const nivel = nivelPrecio(total, excepcionMayor());
      let monto = 0, faltaPrecio = false;
      lista.querySelectorAll(".pcard").forEach((li) => {
        const code = li.dataset.code;
        const q = Number(c[code]) || 0;
        const inp = li.querySelector(".qty-input");
        if (document.activeElement !== inp) inp.value = q;
        li.classList.toggle("elegido", q > 0);
        li.querySelector(".pcard-n").textContent = q ? String(q) : "";
        const pr = precios[code];
        const [it] = conPrecios([{ code, cajas: q }], precios, nivel);
        li.querySelector("[data-precio]").textContent = pr && it.precio ? `${dinero(it.precio)} / caja` : "";
        const st = textoStock(pr);
        const tope = topeStock(pr);
        const sp = li.querySelector("[data-stock]");
        sp.textContent = st; sp.classList.toggle("agotado", st === "Agotado");
        li.classList.toggle("sin-stock", tope <= 0 && !q);
        li.querySelectorAll('[data-act="plus"]').forEach((b) => { b.disabled = q >= tope; });
        if (q) { prods++; monto += q * it.precio; if (!it.precio) faltaPrecio = true; }
      });
      $("nTotal").textContent = `${total} caja${total === 1 ? "" : "s"}${monto ? " · " + dinero(monto) : ""}`;
      $("nDetalle").textContent = prods ? ` · ${prods} producto${prods === 1 ? "" : "s"}${faltaPrecio ? " · hay productos sin precio" : ""}` : " · tocá un producto para sumarlo";
      $("nNivel").textContent = !total ? `Precio al por menor; desde ${CAJAS_MAYOR} cajas, precio al mayor.`
        : nivel === "mayor" ? (total >= CAJAS_MAYOR ? `Precio al mayor (${total} cajas).` : "Precio al mayor por excepción.")
        : `Precio al por menor · faltan ${CAJAS_MAYOR - total} caja${CAJAS_MAYOR - total === 1 ? "" : "s"} para el precio al mayor.`;
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
      lista.querySelectorAll(".pcard").forEach((li) => {
        const okF = filtroNuevo === "todos" || li.dataset.tipo === filtroNuevo || (filtroNuevo === "elegidos" && Number(c[li.dataset.code]) > 0);
        const ok = okF && (!q || li.dataset.texto.includes(q));
        li.hidden = !ok; if (ok) visibles++;
      });
      $("nVacio").hidden = !!visibles;
    };
    const fijar = (code, n) => {
      const c = carrito();
      const tope = topeStock(precios[code]);
      n = Math.max(0, Math.min(9999, Math.floor(Number(n) || 0)));
      if (n > tope) { n = tope; toast(tope ? `Solo hay ${tope} caja${tope === 1 ? "" : "s"} de ${(allProductsMap()[code] || {}).name || code}.` : "Producto agotado."); }
      if (n) c[code] = n; else delete c[code];
      guardarCarrito(c);
      pintar();
    };
    lista.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b || b.disabled) return;
      const li = b.closest(".pcard");
      const code = li.dataset.code;
      const actual = Number(carrito()[code]) || 0;
      fijar(code, actual + (b.dataset.act === "plus" ? 1 : -1));
      if (b.dataset.act === "plus") { li.classList.remove("pulso"); void li.offsetWidth; li.classList.add("pulso"); }
    });
    lista.addEventListener("input", (e) => {
      if (e.target.classList.contains("qty-input")) fijar(e.target.closest(".pcard").dataset.code, e.target.value);
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
      if (await hoja({ titulo: "¿Vaciar el pedido?", cuerpo: '<p class="modal-sub">Se quitan todos los productos elegidos.</p>', ok: "Vaciar" })) { guardarCarrito({}); guardarLS(K_MAYOR, false); pintar(); }
    });
    $("nSeguir").addEventListener("click", (e) => { if (!cajasCarrito()) { e.preventDefault(); toast("Elegí al menos un producto."); } });
    enlazarAvisoWeb();
    return preciosYStock((m) => { if (vigente() && $("nLista") === lista) { precios = m; pintar(); } }).then((m) => { precios = m; pintar(); });
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
    boton.disabled = true; boton.classList.add("ocupado"); boton.textContent = "Buscando GPS…";
    navigator.geolocation.getCurrentPosition(
      (pos) => { boton.disabled = false; boton.classList.remove("ocupado"); boton.textContent = texto; alListo(pos.coords.latitude.toFixed(6), pos.coords.longitude.toFixed(6), pos.coords.accuracy); },
      (err) => { boton.disabled = false; boton.classList.remove("ocupado"); boton.textContent = texto; toast(err.code === 1 ? "Permiso de ubicación negado. Activalo en el navegador." : "No se pudo obtener el GPS. Probá al aire libre."); },
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
          $("cResultados").innerHTML = `<li>${spin("Buscando cliente…")}</li>`;
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
        v.innerHTML = `${pasos(1)}${avisoWeb()}${fichaCliente(cli)}
          <div class="barra-accion">
            <button type="button" class="btn btn-ghost" id="btnCambiarCli">Cambiar cliente</button>
            <a class="btn btn-primary" href="#/nuevo/productos" id="btnAProductos">Continuar a productos</a>
          </div>`;
        enlazarAvisoWeb();
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
  async function vNuevoEnviar(v) {
    const cli = clienteElegido();
    if (!cli) return ir("#/nuevo");
    const items = itemsDePedido(carrito(), allProductsMap());
    if (!items.length) return ir("#/nuevo/productos");
    const total = items.reduce((a, it) => a + it.cajas, 0);
    const unidades = {};
    items.forEach((it) => { if (it.total_unidades) unidades[it.unidad] = (unidades[it.unidad] || 0) + it.total_unidades; });
    let precios = await preciosYStock((m) => { precios = m; if ($("fEnviar")) pintarPrecios(); });
    const web = tomandoWeb();
    v.innerHTML = `${pasos(3)}${avisoWeb()}
      <a class="cliente-elegido" href="#/nuevo"><span>Para</span><strong>${esc(cli.negocio || cli.contacto)}</strong><em>Cambiar</em></a>
      <section class="tarjeta">
        <div class="fila-top"><h3 class="sub-titulo">Productos</h3><a class="link-btn" href="#/nuevo/productos">Cambiar</a></div>
        <ul class="resumen-items" id="eItems"></ul>
        <p class="total-ped"><strong>Total: ${total} caja${total === 1 ? "" : "s"}</strong> · ${Object.entries(unidades).map(([u, n]) => `${n} ${esc(u)}`).join(" + ")}</p>
        <p class="nota-chica" id="eNivel"></p>
        ${total < CAJAS_MAYOR ? `<label class="check excepcion"><input type="checkbox" id="eMayor"${excepcionMayor() ? " checked" : ""} /> Dar precio al mayor (excepción para este cliente)</label>` : ""}
      </section>
      <form id="fEnviar" novalidate>
        <fieldset class="pay documento" id="fsDoc"><legend>¿El cliente quiere nota de entrega o factura? *</legend>
          <label class="pay-opt"><input type="radio" name="eDoc" value="Nota de entrega" /> Nota de entrega</label>
          <label class="pay-opt"><input type="radio" name="eDoc" value="Factura" /> Factura</label>
          <label class="field field-full" id="eRifWrap" hidden><span>RIF o cédula para la factura *</span>
            <input id="eRif" type="text" autocomplete="off" autocapitalize="characters" placeholder="J-12345678-9" value="${esc(cli.rif_cedula || "")}" /></label>
        </fieldset>
        <fieldset class="pay pagos" id="fsPago"><legend>Forma de pago *</legend>
          <div id="ePagos"></div>
          <div id="eCredito" class="dias-credito" hidden>
            <p class="dias-tit">Días de crédito *</p>
            <div class="selector-tema">${[7, 15, 21, 30].map((d) => `<button type="button" data-dias="${d}" aria-pressed="false">${d} días</button>`).join("")}</div>
            <label class="field field-full"><span>Otro (días)</span><input id="eDias" type="number" inputmode="numeric" min="1" max="180" placeholder="ej. 45" /></label>
          </div>
        </fieldset>
        <label class="field field-full"><span>Nota (entrega, descuento, etc.)</span><textarea id="eNota" rows="2" maxlength="300" placeholder="Opcional"></textarea></label>
        <p class="form-warn" id="eError" hidden></p>
        <div class="barra-accion">
          <a class="btn btn-ghost" href="#/nuevo/productos">Atrás</a>
          <button type="submit" class="btn btn-primary" id="btnEnviar">Enviar pedido</button>
        </div>
      </form>`;
    const doc = () => (document.querySelector('input[name="eDoc"]:checked') || {}).value || "";
    const pagoSel = () => (document.querySelector('input[name="ePago"]:checked') || {}).value || "";
    const esCredito = () => !!(pagoPorId(pagoSel()) || {}).credito;
    const conPrecio = () => conPrecios(items, precios, nivelPrecio(total, excepcionMayor()));
    /* Montos de cada forma de pago (ej. Crédito 100 · Pronto pago 90 · Efectivo a crédito 70 · Efectivo pronto pago 60) */
    function pintarPrecios() {
      const its = conPrecio();
      const hayPrecio = its.some((it) => it.precio > 0);
      const tipo = pagoSel() || "credito";
      $("eItems").innerHTML = its.map((it) => `<li class="con-foto"><picture class="item-foto"><source type="image/webp" srcset="assets/img/web/${it.code}-400.webp" /><img src="assets/img/${it.code}.png" alt="" width="36" height="36" loading="lazy" decoding="async" /></picture><span>${it.cajas} × ${esc(it.producto)}${it.total_unidades ? ` <span class="ped-det">${it.total_unidades} ${esc(it.unidad)}</span>` : ""}</span><em>${it.precio ? `${dinero(precioUnitario(it, tipo))} c/u · <strong>${dinero(it.cajas * precioUnitario(it, tipo))}</strong>` : "sin precio"}</em></li>`).join("");
      const nivel = nivelPrecio(total, excepcionMayor());
      $("eNivel").textContent = nivel === "mayor" ? (total >= CAJAS_MAYOR ? "Precio al mayor." : "Precio al mayor por excepción.") : `Precio al por menor (menos de ${CAJAS_MAYOR} cajas).`;
      const sel = pagoSel();
      $("ePagos").innerHTML = totalesPorPago(its).map((pg) => `<label class="pay-opt pago-opt">
          <input type="radio" name="ePago" value="${pg.id}"${pg.id === sel ? " checked" : ""} />
          <span class="pago-txt"><strong>${esc(pg.nombre)}</strong><span>${esc(pg.ayuda)}</span></span>
          ${hayPrecio ? `<span class="pago-monto"><strong>${dinero(pg.total)}</strong>${pg.ahorro ? `<span>−${dinero(pg.ahorro)}</span>` : ""}</span>` : ""}
        </label>`).join("") + (hayPrecio && sinPrecio(its).length ? `<p class="nota-chica">Sin precio cargado: ${esc(sinPrecio(its).join(", "))}.</p>` : "")
        + (hayPrecio ? "" : '<p class="nota-chica">Todavía no hay precios cargados para estos productos.</p>');
    }
    enlazarAvisoWeb();
    pintarPrecios();
    if (web && web.tipo_pago && !pagoSel()) {
      const r0 = document.querySelector(`input[name="ePago"][value="${web.tipo_pago}"]`);
      if (r0) { r0.checked = true; $("eCredito").hidden = !esCredito(); pintarPrecios(); }
      if (web.nota && !$("eNota").value) $("eNota").value = `Pedido web ${web.id}: ${web.nota}`;
    }
    $("fsPago").addEventListener("change", (e) => { if (e.target.name === "ePago") { $("eCredito").hidden = !esCredito(); $("fsPago").classList.remove("falta"); pintarPrecios(); } });
    const may = $("eMayor");
    if (may) may.addEventListener("change", () => { guardarLS(K_MAYOR, may.checked); pintarPrecios(); });
    $("eCredito").addEventListener("click", (e) => {
      const b = e.target.closest("[data-dias]");
      if (!b) return;
      $("eDias").value = b.dataset.dias;
      $("eCredito").querySelectorAll("[data-dias]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    });
    $("eDias").addEventListener("input", () => $("eCredito").querySelectorAll("[data-dias]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.dias === $("eDias").value))));
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
      if (!pagoSel()) { $("fsPago").classList.add("falta"); return mostrar("Elegí la forma de pago.", $("fsPago")); }
      const dias = Math.floor(Number($("eDias").value));
      if (esCredito() && !(dias >= 1 && dias <= 180)) return mostrar("Indicá los días de crédito (1 a 180).", $("eCredito"));
      err.hidden = true;
      const { _listo, ...cliente } = cli;
      if (d === "Factura") cliente.rif_cedula = rif;
      const its = itemsDePedido(carrito(), allProductsMap());
      const datos = { client_ref: nuevoRef(), cliente, items: its, documento: d,
        tipo_pago: pagoSel(), pago: pagoPorId(pagoSel()).nombre, precio_mayor: total < CAJAS_MAYOR && excepcionMayor(),
        dias_credito: esCredito() ? dias : 0, nota: $("eNota").value.trim() };
      if (web) datos.web_id = web.id;
      const btn = $("btnEnviar");
      btn.disabled = true; btn.classList.add("ocupado"); btn.textContent = "Enviando…";
      const terminar = (listo) => {
        guardarCarrito({});
        guardarLS(K_MAYOR, false);
        borrarLS(K_WEB);
        borrarLS(K_CLIENTE);
        sessionStorage.setItem(K_LISTO, JSON.stringify(listo));
        ir("#/nuevo/listo");
      };
      try {
        const r = await api("guardarPedido", datos);
        terminar({ pedido: r.pedido, cliente: r.cliente || cliente });
      } catch (e2) {
        btn.disabled = false; btn.classList.remove("ocupado"); btn.textContent = "Enviar pedido";
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
  /* Bandera de cobro: crédito por vencimiento, o estado del pago de un pedido entregado */
  function bandera(p) {
    const ec = estadoCredito(p);
    if (ec) return { clase: ec.nivel, texto: ec.texto };
    if (p.estado !== "entregado") return null;
    if (p.cobro === "cancelado") return { clase: "por_conciliar", texto: "Cancelado · por conciliar" };
    if (p.cobro === "conciliado") return { clase: "pagado", texto: "Conciliado" };
    return { clase: "por_cobrar", texto: "Por cobrar" };
  }
  const chipBandera = (p) => {
    if (!vende()) return ""; // el cobro no le corresponde al despachador
    const b = bandera(p);
    return b ? `<span class="bandera b-${esc(b.clase)}"><i aria-hidden="true"></i>${esc(b.texto)}</span>` : "";
  };

  function filaPedido(p, elegible) {
    const r = enEntregas() ? "despachador" : rolPedidos();
    const extra = r === "vendedor" ? (p.despachador ? `Despacha: ${p.despachador}` : "")
      : r === "despachador" ? ((p.cliente_datos || {}).direccion || "") : `Vendedor: ${p.vendedor}${p.despachador ? ` · Despacha: ${p.despachador}` : ""}`;
    return `<li class="${elegible ? "con-check" : ""}">${elegible ? `<label class="check-ped"><input type="checkbox" value="${esc(p.id)}" aria-label="Elegir ${esc(p.negocio)} para la carga" /></label>` : ""}
      <a class="fila-ped est-borde-${esc(p.estado)}" href="#/pedido/${encodeURIComponent(p.id)}">
      <div class="fila-top"><strong>${esc(p.negocio)}</strong>${chipEstado(p.estado)}</div>
      <div class="ped-det">${esc(p.id)} · ${esc(fechaLegible(p.fecha))}</div>
      <div class="ped-det">${esc(p.total_cajas)} caja(s)${p.detalle_unidades ? " · " + esc(p.detalle_unidades) : ""}${p.monto && p.cobro ? ` · <strong>${esc(formatoMonto(p.monto, p.moneda))}</strong>` : ""}</div>
      ${extra ? `<div class="ped-det">${esc(extra)}</div>` : ""}
      ${chipBandera(p)}
    </a></li>`;
  }

  async function vPedidos(v, _p, query, vigente) {
    const entregas = enEntregas();
    const tabs = pestanasPanel(entregas ? "despachador" : rolPedidos()).filter((t) => t.estados || t.filtro || t.web);
    const tab = tabs.find((t) => t.id === query.get("tab")) || tabs[0];
    const base = entregas ? "#/entregas" : "#/pedidos";
    const conCarga = tab.id === "curso" && (entregas || gestion());
    const PERIODOS = [[1, "Hoy"], [7, "7 días"], [30, "30 días"], [90, "90 días"]];
    const dias = tab.periodo ? (PERIODOS.find(([d]) => d === Number(query.get("dias"))) || [30])[0] : 60;
    v.innerHTML = `
      <div class="periodos" role="tablist">${tabs.map((t) => `<a role="tab" class="tab${t.id === tab.id ? " active" : ""}" aria-selected="${t.id === tab.id}" href="${base}?tab=${t.id}">${esc(t.nombre)}</a>`).join("")}</div>
      ${tab.periodo ? `<div class="periodos periodos-chicos" aria-label="Período">${PERIODOS.map(([d, t]) => `<a class="tab${d === dias ? " active" : ""}"${d === dias ? ' aria-current="true"' : ""} href="${base}?tab=${tab.id}&dias=${d}">${t}</a>`).join("")}</div>
      <div id="pResumen"></div>` : ""}
      <div class="modal-sub" id="pInfo">${spin()}</div>
      ${conCarga ? '<div class="fila-elegir" id="pElegir" hidden><label class="check"><input type="checkbox" id="pTodos" /> Elegir todos</label></div>' : ""}
      <ul class="lista-ped" id="pLista"></ul>
      ${conCarga ? '<div class="barra-accion" id="pBarra" hidden><div><strong id="pSel">0 pedidos</strong><span id="pSelCajas"></span></div><button type="button" class="btn btn-primary" id="btnVerCarga">Ver total de carga</button></div>' : ""}`;
    if (tab.web) {
      const rw = await api("pedidosWeb");
      if (!vigente()) return;
      $("pInfo").textContent = rw.pedidos.length ? `${rw.pedidos.length} pedido(s) que armaron los clientes en el catálogo` : "";
      $("pLista").innerHTML = rw.pedidos.length ? rw.pedidos.map(filaWeb).join("") : '<li class="vacio-panel">No hay pedidos web esperando.</li>';
      return;
    }
    const filtro = tab.filtro ? { [tab.filtro]: true } : { estados: tab.estados };
    const r = await api("pedidos", { ...filtro, dias });
    if (!vigente()) return;
    let lista = r.pedidos;
    // Entregas: con varios roles, solo los pedidos asignados a este usuario
    if (entregas) lista = lista.filter((p) => String(p.despachador_id) === String(yo().id));
    if (tab.filtro === "conciliados") {
      lista = lista.slice().sort((a, b) => String(b.conciliado_at).localeCompare(String(a.conciliado_at)));
      $("pResumen").innerHTML = resumenConciliadosHtml(resumenConciliados(lista), dias);
    }
    if (tab.filtro === "por_cobrar") {
      // primero lo más atrasado
      const peso = (p) => { const ec = estadoCredito(p); return ec && ec.vence ? (ec.nivel === "al_dia" || ec.nivel === "proximo" ? ec.dias : -ec.dias) : 9999; };
      lista = lista.slice().sort((a, b) => peso(a) - peso(b));
    }
    const vencidos = lista.filter((p) => { const b = bandera(p); return b && (b.clase === "vencido" || b.clase === "muy_vencido"); }).length;
    $("pInfo").textContent = lista.length ? `${lista.length} pedido(s)${tab.filtro === "por_cobrar" && vencidos ? ` · ${vencidos} vencido(s)` : ""}${conCarga ? " · elegí pedidos para ver el total a cargar" : ""}` : "";
    $("pLista").innerHTML = lista.length ? lista.map((p) => filaPedido(p, conCarga)).join("") : '<li class="vacio-panel">No hay pedidos en esta lista.</li>';
    if (!conCarga || !lista.length) return;
    $("pElegir").hidden = false;
    const elegidos = () => [...v.querySelectorAll('.check-ped input:checked')].map((c) => c.value);
    const pintarSel = () => {
      const ids = elegidos();
      const t = totalCarga(lista.filter((p) => ids.includes(p.id)));
      $("pBarra").hidden = !ids.length;
      $("pSel").textContent = `${ids.length} pedido${ids.length === 1 ? "" : "s"}`;
      $("pSelCajas").textContent = ` · ${t.cajas} caja${t.cajas === 1 ? "" : "s"}`;
      $("pTodos").checked = ids.length === lista.length;
    };
    $("pLista").addEventListener("change", pintarSel);
    $("pTodos").addEventListener("change", () => { v.querySelectorAll(".check-ped input").forEach((c) => (c.checked = $("pTodos").checked)); pintarSel(); });
    $("btnVerCarga").addEventListener("click", () => { sessionStorage.setItem(K_CARGA, JSON.stringify(elegidos())); ir("#/carga"); });
  }

  /* Totales de lo conciliado en el período (dinero por moneda, pedidos, cajas, por vendedor y por pago) */
  function resumenConciliadosHtml(t, dias) {
    const periodo = dias === 1 ? "hoy" : `últimos ${dias} días`;
    const dinero = (g) => [g.USD ? formatoMonto(g.USD, "USD") : "", g.Bs ? formatoMonto(g.Bs, "Bs") : ""].filter(Boolean).join("<br>") || "—";
    const tabla = (filas, titulo) => `<table class="tabla"><thead><tr><th>${titulo}</th><th>Ped.</th><th>Cajas</th><th class="num">Monto</th></tr></thead><tbody>${filas.map((g) =>
      `<tr><td>${esc(g.nombre)}</td><td>${g.pedidos}</td><td>${g.cajas}</td><td class="num">${dinero(g)}</td></tr>`).join("")}</tbody></table>`;
    if (!t.pedidos) return `<section class="tarjeta conciliados-total vacio"><p class="modal-sub">Nada conciliado ${periodo}.</p></section>`;
    const verVendedor = gestion();
    return `<section class="tarjeta conciliados-total" id="concTotal">
        <p class="sub-titulo">Total conciliado · ${periodo}</p>
        <div class="montos">
          <div class="monto"><strong id="concUSD">${esc(formatoMonto(t.montos.USD, "USD"))}</strong><span>Dólares</span></div>
          <div class="monto"><strong id="concBs">${esc(formatoMonto(t.montos.Bs, "Bs"))}</strong><span>Bolívares</span></div>
        </div>
        <p class="ped-det" id="concCuenta">${t.pedidos} pedido${t.pedidos === 1 ? "" : "s"} · ${t.cajas} caja${t.cajas === 1 ? "" : "s"}</p>
      </section>
      ${verVendedor ? `<section class="tarjeta"><h3 class="sub-titulo">Por vendedor</h3>${tabla(t.por_vendedor, "Vendedor")}</section>` : ""}
      <section class="tarjeta"><h3 class="sub-titulo">Por método de pago</h3>${tabla(t.por_pago, "Pago")}</section>
      <details class="tarjeta"><summary class="sub-titulo">Productos conciliados (${t.cajas} cajas)</summary>
        <ul class="resumen-items">${t.productos.map((x) => `<li><span>${esc(x.producto)} <span class="ped-det">${esc(x.code)}</span></span><em>${x.cajas} caja(s)</em></li>`).join("")}</ul>
      </details>
      <h3 class="sub-titulo">Pedidos conciliados</h3>`;
  }

  /* ---------- Pedidos web (los arma el cliente en el catálogo) ---------- */
  function filaWeb(w) {
    const monto = totalPorPago(w.items, w.tipo_pago);
    return `<li><a class="fila-ped fila-web" href="#/web/${encodeURIComponent(w.id)}">
      <div class="fila-top"><strong>${esc(w.cliente.negocio)}</strong><span class="chip-estado est-web">Pedido web</span></div>
      <div class="ped-det">${esc(w.id)} · ${esc(fechaLegible(w.fecha))}</div>
      <div class="ped-det">${w.total_cajas} caja(s)${monto ? ` · <strong>${esc(dinero(monto))}</strong>` : ""} · ${esc((pagoPorId(w.tipo_pago) || {}).nombre || "")}</div>
      ${gestion() ? `<div class="ped-det">Para: ${esc(w.vendedor)}</div>` : ""}
    </a></li>`;
  }

  async function vWeb(v, id, _q, vigente) {
    const r = await api("pedidosWeb", { estado: "todos" });
    if (!vigente()) return;
    const w = r.pedidos.find((x) => x.id === id);
    if (!w) { v.innerHTML = '<p class="vacio-panel">Ese pedido web ya no está.</p>'; return; }
    $("appTitulo").textContent = w.id;
    const c = w.cliente;
    const tel = telLink(c.telefono), wa = telefonoWhatsapp(c.telefono);
    const conPrecio = w.items.some((it) => it.precio > 0);
    const estado = w.estado === "nuevo" ? "" : w.estado === "tomado" ? `Tomado por ${w.atendido_por} → <a href="#/pedido/${encodeURIComponent(w.pedido_id)}">${esc(w.pedido_id)}</a>` : `Descartado por ${esc(w.atendido_por)}: ${esc(w.motivo)}`;
    v.innerHTML = `
      <section class="tarjeta">
        <div class="fila-top"><h2 class="ped-titulo">${esc(c.negocio)}</h2><span class="chip-estado est-web">Pedido web</span></div>
        ${c.contacto && c.contacto !== c.negocio ? `<p class="ped-det">${esc(c.contacto)}</p>` : ""}
        ${c.direccion ? `<p class="ped-det">${esc(c.direccion)}</p>` : ""}
        <p class="ped-det">${esc(fechaLegible(w.fecha))} · eligió a <strong>${esc(w.vendedor)}</strong></p>
        <div class="botones-contacto">
          ${tel ? `<a class="btn btn-ghost" href="tel:${esc(tel)}">Llamar</a>` : ""}
          ${wa ? `<a class="btn btn-ghost" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        </div>
      </section>
      ${estado ? `<p class="aviso-chico">${estado}</p>` : w.puede_tomar
        ? `<div class="acciones-ped"><button type="button" class="btn btn-primary" id="btnTomarWeb">Tomar y revisar</button><button type="button" class="btn btn-ghost" id="btnDescartarWeb">Descartar</button></div>`
        : `<p class="aviso-chico">Esperando a que ${esc(w.vendedor)} lo tome. Administración lo ve, pero lo toma su vendedor.</p>`}
      <section class="tarjeta">
        <h3 class="sub-titulo">Productos</h3>
        <ul class="resumen-items">${w.items.map((it) => `<li><span>${it.cajas} × ${esc(it.producto)} <span class="ped-det">${esc(it.code)}</span></span><em>${it.precio ? dinero(it.cajas * precioUnitario(it, w.tipo_pago)) : ""}</em></li>`).join("")}</ul>
        <p class="total-ped"><strong>Total: ${w.total_cajas} caja${w.total_cajas === 1 ? "" : "s"}</strong></p>
        ${conPrecio ? `<p class="monto-ped"><strong>${dinero(totalPorPago(w.items, w.tipo_pago))}</strong> · ${esc((pagoPorId(w.tipo_pago) || {}).nombre || "")}</p>` : ""}
        <dl class="datos">
          ${c.rif_cedula ? `<dt>RIF</dt><dd>${esc(c.rif_cedula)}</dd>` : ""}
          <dt>Teléfono</dt><dd>${esc(c.telefono)}</dd>
          ${w.nota ? `<dt>Nota</dt><dd>${esc(w.nota)}</dd>` : ""}
        </dl>
      </section>`;
    const bt = $("btnTomarWeb");
    if (bt) bt.addEventListener("click", () => {
      // Pasa al pedido en curso: el vendedor revisa cliente, productos y pago antes de enviarlo a Administración
      const c2 = {};
      w.items.forEach((it) => { c2[it.code] = it.cajas; });
      guardarCarrito(c2);
      guardarLS(K_MAYOR, false);
      fijarCliente({ negocio: c.negocio, contacto: c.contacto, rif_cedula: c.rif_cedula, telefono: c.telefono, telefono2: "", direccion: c.direccion, latitud: "", longitud: "" });
      guardarLS(K_WEB, { id: w.id, tipo_pago: w.tipo_pago, nota: w.nota });
      toast(`Tomando ${w.id}: revisá y enviá`);
      ir("#/nuevo");
    });
    const bd = $("btnDescartarWeb");
    if (bd) bd.addEventListener("click", async () => {
      const d = await hoja({
        titulo: `Descartar ${w.id}`,
        cuerpo: '<label class="field field-full"><span>Motivo</span><textarea name="motivo" rows="3" maxlength="200" placeholder="Ej. repetido, el cliente no responde"></textarea></label>',
        ok: "Descartar", validar: (x) => (x.motivo.trim() ? "" : "Escribí el motivo."),
      });
      if (!d) return;
      try { await api("descartarWeb", { id: w.id, motivo: d.motivo.trim() }); toast(`${w.id} descartado`); ir("#/pedidos?tab=web"); }
      catch (e) { toast(e.message); }
    });
  }
  const tomandoWeb = () => leerLS(K_WEB, null);
  const avisoWeb = () => { const t = tomandoWeb(); return t ? `<p class="aviso-chico aviso-web" id="avisoWeb">Tomando el pedido web <strong>${esc(t.id)}</strong>. <button type="button" class="link-btn" id="btnSoltarWeb">Dejar de tomarlo</button></p>` : ""; };
  function enlazarAvisoWeb() {
    const b = $("btnSoltarWeb");
    if (b) b.addEventListener("click", () => { borrarLS(K_WEB); guardarCarrito({}); borrarLS(K_CLIENTE); toast("Pedido web liberado: sigue en la pestaña Web"); render(); });
  }

  /* ---------- Total de carga (despachador) ---------- */
  async function vCarga(v, _p, _q, vigente) {
    let ids = null;
    try { ids = JSON.parse(sessionStorage.getItem(K_CARGA)); } catch (e) {}
    const r = await api("pedidos", { estados: ["confirmado", "en_ruta"], dias: 60 });
    if (!vigente()) return;
    const peds = Array.isArray(ids) && ids.length ? r.pedidos.filter((p) => ids.includes(p.id)) : r.pedidos;
    const t = totalCarga(peds);
    if (!peds.length) { v.innerHTML = '<p class="vacio-panel">No hay pedidos por entregar.</p>'; return; }
    const texto = [`*CARGA ${yo().nombre.toUpperCase()}* · ${t.pedidos} pedido(s) · ${t.cajas} cajas`, "",
      ...t.productos.map((x) => `• ${x.cajas} × ${x.producto} (${x.code})`), "", "*Pedidos*",
      ...peds.map((p) => `• ${p.id} · ${p.negocio} · ${p.total_cajas} caja(s)`)].join("\n");
    v.innerHTML = `
      <section class="tarjeta carga-total">
        <p class="carga-grande"><strong>${t.cajas}</strong> cajas</p>
        <p class="ped-det">${t.pedidos} pedido(s)${t.unidades ? " · " + esc(t.unidades) : ""}</p>
      </section>
      <section class="tarjeta">
        <h3 class="sub-titulo">Cargar en el vehículo</h3>
        <ul class="lista-carga">${t.productos.map((x) => `<li><label class="check"><input type="checkbox" /> <span><strong>${x.cajas}</strong> × ${esc(x.producto)} <span class="ped-det">${esc(x.code)}${x.total_unidades ? ` · ${x.total_unidades} ${esc(x.unidad)}` : ""}</span></span></label></li>`).join("")}</ul>
        <p class="nota-chica">Marcá cada producto a medida que lo subís.</p>
      </section>
      <section class="tarjeta">
        <h3 class="sub-titulo">Pedidos incluidos</h3>
        <ul class="resumen-items">${peds.map((p) => `<li><a href="#/pedido/${encodeURIComponent(p.id)}">${esc(p.negocio)}</a><em>${p.total_cajas} caja(s)</em></li>`).join("")}</ul>
      </section>
      <button type="button" class="btn btn-ghost btn-bloque" id="btnCompartirCarga">Compartir lista de carga</button>`;
    $("btnCompartirCarga").addEventListener("click", () => enviarAlGrupo(texto));
  }

  /* ---------- Detalle de pedido ---------- */
  const ETIQUETAS = { confirmar: "Aprobar", en_ruta: "Salió en ruta", entregado: "Entregado", reasignar: "Cambiar despachador", cancelar: "Anular pedido", reabrir: "Volver a En proceso",
    cobrar: "Marcar cancelado (pagado)", conciliar: "Conciliar pago (recibido)", rechazar: "Pago no recibido", desconciliar: "Deshacer conciliación" };
  async function vPedido(v, id, _q, vigente) {
    const { pedido: p } = await api("pedido", { pedido_id: id });
    if (!vigente()) return;
    $("appTitulo").textContent = p.id;
    const c = p.cliente_datos || {};
    const tel = telLink(c.telefono), tel2 = telLink(c.telefono2);
    const wa = telefonoWhatsapp(c.telefono);
    const mapa = linkMapa(c.latitud, c.longitud);
    const acciones = accionesPedido(roles(), yo().id, p);
    const principal = ["confirmar", "en_ruta", "entregado", "cobrar", "conciliar"];
    const ec = estadoCredito(p);
    const conPrecio = vende() && p.items.some((it) => Number(it.precio) > 0);
    const tipoAcordado = p.tipo_pago || tipoPagoDe(p.pago);
    v.innerHTML = `
      <section class="tarjeta">
        <div class="fila-top"><h2 class="ped-titulo">${esc(p.negocio)}</h2>${chipEstado(p.estado)}</div>
        ${chipBandera(p)}
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
        <table class="tabla"><thead><tr><th>Producto</th><th>Cajas</th>${conPrecio ? '<th class="num">Precio</th>' : ""}</tr></thead><tbody>
          ${p.items.map((it) => `<tr><td>${esc(it.producto)} <span class="ped-det">${esc(it.code)}${it.total_unidades ? ` · ${it.total_unidades} ${esc(it.unidad)}` : ""}</span></td><td>${it.cajas}</td>${conPrecio ? `<td class="num">${it.precio ? dinero(precioUnitario(it, tipoAcordado)) : "—"}</td>` : ""}</tr>`).join("")}
        </tbody></table>
        <p class="total-ped"><strong>Total: ${p.total_cajas} caja${p.total_cajas === 1 ? "" : "s"}</strong>${p.detalle_unidades ? ` · ${esc(p.detalle_unidades)}` : ""}</p>
        ${conPrecio ? `<p class="monto-ped" id="dMonto"><strong>${dinero(totalPorPago(p.items, tipoAcordado))}</strong> · ${esc((pagoPorId(tipoAcordado) || {}).nombre || p.pago)} · precio ${p.nivel_precio === "mayor" ? "al mayor" : "al por menor"}${p.excepcion_precio ? " (excepción)" : ""}</p>` : ""}
        ${conPrecio && p.tipo_pago_real && p.tipo_pago_real !== tipoAcordado ? `<p class="monto-ped cambio" id="dMontoReal">Pagó como <strong>${esc(pagoPorId(p.tipo_pago_real).nombre)}</strong>: ${dinero(totalPorPago(p.items, p.tipo_pago_real))}</p>` : ""}
        <dl class="datos">
          <dt>Fecha</dt><dd>${esc(fechaLegible(p.fecha))}</dd>
          <dt>Vendedor</dt><dd>${esc(p.vendedor)}</dd>
          ${p.despachador ? `<dt>Despachador</dt><dd>${esc(p.despachador)}</dd>` : ""}
          ${p.documento ? `<dt>Documento</dt><dd>${esc(p.documento)}</dd>` : ""}
          ${p.pago ? `<dt>Pago</dt><dd>${esc(p.pago)}${p.dias_credito ? ` · ${p.dias_credito} días` : ""}</dd>` : ""}
          ${ec && ec.vence ? `<dt>Vence</dt><dd>${esc(ec.vence.split("-").reverse().join("/"))}</dd>` : ""}
          ${p.cobro ? `<dt>Cobro</dt><dd>${p.monto ? `<strong>${esc(formatoMonto(p.monto, p.moneda))}</strong> · ` : ""}${p.cobro === "conciliado" ? `Conciliado por ${esc(p.conciliado_por)}` : `Cancelado (reportó ${esc(p.cobrado_por)}) · por conciliar`}</dd>` : ""}
          ${p.nota ? `<dt>Nota</dt><dd>${esc(p.nota)}</dd>` : ""}
          ${p.motivo ? `<dt>Motivo</dt><dd>${esc(p.motivo)}</dd>` : ""}
        </dl>
      </section>
      <button type="button" class="btn btn-ghost btn-bloque" id="btnReenviar">Reenviar al grupo de WhatsApp</button>
      ${puedeBorrar(roles(), yo().id, p) ? '<button type="button" class="btn btn-ghost btn-bloque btn-peligro" id="btnBorrarPed">Borrar pedido</button>' : ""}
      ${p.historial && p.historial.length ? `<section class="tarjeta"><h3 class="sub-titulo">Historial</h3><ol class="historial">${p.historial.map((h) =>
        `<li><strong>${esc({ creado: "Enviado (en proceso)", reasignado: "Despachador cambiado", pendiente: "Vuelto a En proceso", confirmado: "Aprobado",
          cobrado: "Cancelado (pago reportado)", conciliado: "Pago conciliado", borrado: "Borrado", pago_rechazado: "Pago no recibido", conciliacion_deshecha: "Conciliación deshecha" }[h.accion] || nombreEstado(h.accion))}</strong> · ${esc(h.usuario)}<br><span class="ped-det">${esc(new Date(h.fecha).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" }))}${h.detalle ? " · " + esc(h.detalle) : ""}</span></li>`).join("")}</ol></section>` : ""}`;

    $("btnReenviar").addEventListener("click", () => enviarAlGrupo(mensajeGrupo(p, c)));
    const bb = $("btnBorrarPed");
    if (bb) bb.addEventListener("click", async () => {
      const d = await hoja({
        titulo: `¿Borrar ${p.id}?`,
        cuerpo: `<p class="modal-sub">Sale de las listas, los totales y el inventario. Queda guardado en la hoja y en el historial.</p>
          <label class="field field-full"><span>¿Por qué se borra?</span><textarea name="motivo" rows="2" maxlength="200" placeholder="Ej. era un pedido de prueba"></textarea></label>`,
        ok: "Borrar pedido", validar: (x) => (x.motivo.trim() ? "" : "Escribí el motivo."),
      });
      if (!d) return;
      try { await api("borrarPedido", { pedido_id: p.id, motivo: d.motivo.trim() }); toast(`${p.id} borrado`); ir("#/pedidos"); }
      catch (e) { toast(e.message); }
    });
    v.querySelectorAll("[data-acc]").forEach((b) => b.addEventListener("click", () => accionPedido(p, b.dataset.acc)));
  }

  async function accionPedido(p, acc) {
    if (["cobrar", "conciliar", "rechazar", "desconciliar"].includes(acc)) return accionCobro(p, acc);
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

  async function accionCobro(p, acc) {
    const textos = {
      cobrar: [`¿El cliente pagó ${p.id}?`, "Indicá cuánto cobraste. Queda como <strong>Cancelado</strong> hasta que Administración verifique el pago y lo concilie.", "Sí, cancelado"],
      conciliar: [`¿Recibiste el pago de ${p.id}?`, "Queda como <strong>Conciliado</strong> (pago verificado) y suma en Conciliados.", "Sí, conciliar"],
      desconciliar: [`¿Deshacer la conciliación de ${p.id}?`, "Vuelve a Cancelado · por conciliar.", "Deshacer"],
    };
    let extra = {};
    if (acc === "cobrar" || acc === "conciliar") {
      const [titulo, cuerpo, ok] = textos[acc];
      const mon = p.moneda || monedaDePago(p.pago);
      const previo = p.monto ? String(p.monto).replace(".", ",") : "";
      const conPrecio = p.items.some((it) => Number(it.precio) > 0);
      const acordado = p.tipo_pago || tipoPagoDe(p.pago);
      const elegido = p.tipo_pago_real || acordado;
      const vigente = prontoVigente(p.entregado_at);
      const limite = limitePronto(p.entregado_at);
      const r = await hoja({
        titulo,
        cuerpo: `<p class="modal-sub">${cuerpo}</p>
          ${acc === "conciliar" && p.monto ? `<p class="modal-sub">Reportado: <strong>${esc(formatoMonto(p.monto, p.moneda))}</strong>${p.cobrado_por ? ` por ${esc(p.cobrado_por)}` : ""}. Corregilo si recibiste otro monto.</p>` : ""}
          <fieldset class="pay pagos" id="hPagos"><legend>¿Cómo pagó? <span class="ped-det">(acordado: ${esc((pagoPorId(acordado) || {}).nombre || p.pago)})</span></legend>
            ${totalesPorPago(p.items).map((pg) => `<label class="pay-opt pago-opt"><input type="radio" name="tipo_pago_real" value="${pg.id}"${pg.id === elegido ? " checked" : ""} />
              <span class="pago-txt"><strong>${esc(pg.nombre)}</strong>${pg.id === acordado ? "<span>Lo acordado</span>" : ""}</span>
              ${conPrecio ? `<span class="pago-monto"><strong>${dinero(pg.total)}</strong></span>` : ""}</label>`).join("")}
            ${!vigente && limite ? `<p class="form-warn" id="hProntoAviso" hidden>El plazo de pronto pago venció el ${esc(limite.toLocaleDateString("es-VE"))}. Aplicalo solo si lo autorizaron.</p>` : ""}
          </fieldset>
          <fieldset class="pay moneda"><legend>Moneda</legend>
            ${["USD", "Bs"].map((m) => `<label class="pay-opt"><input type="radio" name="moneda" value="${m}"${m === mon ? " checked" : ""} /> ${m === "USD" ? "Dólares (USD)" : "Bolívares (Bs)"}</label>`).join("")}
          </fieldset>
          <label class="field field-full"><span>${acc === "cobrar" ? "Monto cobrado *" : "Monto recibido *"}</span>
            <input name="monto" id="hMonto" inputmode="decimal" autocomplete="off" placeholder="Ej. 120,50" value="${esc(previo)}" /></label>`,
        ok,
        validar: (d) => (montoNum(d.monto) > 0 ? "" : "Escribí el monto (mayor que 0)."),
        alAbrir: (form) => {
          // El monto sigue a la forma de pago (en dólares) mientras no lo escriban a mano
          let tocado = !!previo;
          const m = form.querySelector("#hMonto");
          const sync = () => {
            const tipo = (form.querySelector('input[name="tipo_pago_real"]:checked') || {}).value;
            const usd = (form.querySelector('input[name="moneda"]:checked') || {}).value !== "Bs";
            const aviso = form.querySelector("#hProntoAviso");
            if (aviso) aviso.hidden = !/pronto/.test(tipo || "");
            if (!tocado && conPrecio) m.value = usd ? String(totalPorPago(p.items, tipo)).replace(".", ",") : "";
          };
          m.addEventListener("input", () => { tocado = true; });
          form.addEventListener("change", (e) => { if (e.target.name === "tipo_pago_real" || e.target.name === "moneda") sync(); });
          sync();
        },
      });
      if (!r) return;
      extra = { monto: montoNum(r.monto), moneda: r.moneda === "Bs" ? "Bs" : "USD", tipo_pago_real: r.tipo_pago_real };
    } else if (acc === "rechazar") {
      const r = await hoja({
        titulo: `Pago no recibido · ${p.id}`,
        cuerpo: '<p class="modal-sub">El pedido vuelve a <strong>Por cobrar</strong>.</p><label class="field field-full"><span>¿Qué pasó?</span><textarea name="motivo" rows="3" maxlength="200" placeholder="Ej. no llegó la transferencia"></textarea></label>',
        ok: "Rechazar pago", validar: (d) => (d.motivo.trim() ? "" : "Escribí el motivo."),
      });
      if (!r) return;
      extra.motivo = r.motivo.trim();
    } else {
      const [titulo, cuerpo, ok] = textos[acc];
      if (!(await hoja({ titulo, cuerpo: `<p class="modal-sub">${cuerpo}</p>`, ok }))) return;
    }
    try {
      await api("cobro", { pedido_id: p.id, accion: { cobrar: "cancelar" }[acc] || acc, ...extra });
      toast({ cobrar: "Marcado como cancelado", conciliar: "Pago conciliado", rechazar: "Pago rechazado: vuelve a Por cobrar", desconciliar: "Conciliación deshecha" }[acc]);
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
      <ul class="lista-cli" id="kLista"><li>${spin()}</li></ul>`;
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
      <ul class="lista-ped" id="kPedidos"><li>${spin()}</li></ul>`;
    $("btnPedirCliente").addEventListener("click", () => {
      fijarCliente({ id: c.id, contacto: c.contacto, negocio: c.nombre, rif_cedula: c.rif_cedula, telefono: c.telefono, telefono2: c.telefono2, direccion: c.direccion, latitud: c.latitud, longitud: c.longitud });
      ir("#/nuevo/productos");
    });
    const r = await api("pedidos", { cliente_id: c.id });
    if (!vigente()) return;
    $("kPedidos").innerHTML = r.pedidos.length ? r.pedidos.map((p) => filaPedido(p)).join("") : '<li class="vacio-panel">Todavía no tiene pedidos.</li>';
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
    v.innerHTML = chips + spin();
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

  /* ---------- Inventario y precios (Administración / Master) ---------- */
  let busquedaInv = "";
  async function vInventario(v, _p, _q, vigente) {
    const r = await api("inventario");
    if (!vigente()) return;
    const nombre = (c) => (allProductsMap()[c] || {}).name;
    const prods = r.productos.map((x) => ({ ...x, producto: nombre(x.code) || x.producto }));
    const fila = (x) => `<li class="inv-fila" data-code="${esc(x.code)}" data-texto="${esc((x.producto + " " + x.code).toLowerCase())}">
        <div class="inv-top"><div><strong>${esc(x.producto)}</strong><span class="ped-det">${esc(x.code)}</span></div>
          <div class="inv-stock${x.controlado && x.disponible <= 0 ? " agotado" : ""}">${x.controlado ? `<strong>${x.disponible}</strong><span>disponibles</span>` : '<span>Sin cargar</span>'}</div></div>
        <p class="ped-det">${x.controlado ? `Cargado ${x.cargado} · aprobado ${x.aprobado}` : "No se controla hasta la primera entrada"}${x.en_proceso ? ` · en proceso ${x.en_proceso}` : ""}</p>
        <p class="ped-det inv-precios">${x.menor ? `Menor ${dinero(x.menor)} · Mayor ${dinero(x.mayor || x.menor)} · Pronto −${dinero(x.desc_pronto)} · Ef. créd. −${dinero(x.desc_efectivo_credito)} · Ef. pronto −${dinero(x.desc_efectivo_pronto)}` : "<em>Sin precio</em>"}</p>
        <div class="inv-botones"><button type="button" class="btn btn-ghost" data-inv="entrada">Entrada / ajuste</button><button type="button" class="btn btn-ghost" data-inv="precio">Precios</button></div>
      </li>`;
    const sinPrecio = prods.filter((x) => !x.menor).length;
    v.innerHTML = `
      <div class="buscador"><input type="search" id="invBuscar" placeholder="Buscar producto o código" autocomplete="off" value="${esc(busquedaInv)}" /></div>
      ${sinPrecio ? `<p class="aviso-chico">${sinPrecio} producto(s) sin precio. Cargalos con <strong>Precios</strong> o en la hoja <em>Precios</em>.</p>` : ""}
      <ul class="lista-inv" id="invLista">${prods.map(fila).join("")}</ul>
      <details class="tarjeta"><summary class="sub-titulo">Últimos movimientos</summary>
        ${r.movimientos.length ? `<ul class="resumen-items">${r.movimientos.slice(0, 30).map((m) => `<li><span>${esc(nombre(m.code) || m.producto)} <span class="ped-det">${esc(new Date(m.fecha).toLocaleDateString("es-VE"))} · ${esc(m.usuario)}${m.nota ? " · " + esc(m.nota) : ""}</span></span><em>${m.cajas > 0 ? "+" : ""}${m.cajas}</em></li>`).join("")}</ul>` : '<p class="modal-sub">Todavía no hay entradas.</p>'}
      </details>
      <p class="nota-chica">Disponible = entradas y ajustes − pedidos aprobados (aprobado, en ruta y entregado). Al anular un pedido aprobado la mercancía vuelve.</p>`;
    const filtrar = () => { const q = busquedaInv.trim().toLowerCase(); v.querySelectorAll(".inv-fila").forEach((li) => { li.hidden = !!q && !li.dataset.texto.includes(q); }); };
    filtrar();
    $("invBuscar").addEventListener("input", (e) => { busquedaInv = e.target.value; filtrar(); });
    $("invLista").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-inv]");
      if (!b) return;
      const x = prods.find((p) => p.code === b.closest(".inv-fila").dataset.code);
      const num = (t) => { const n = Number(String(t ?? "").trim().replace(",", ".")); return isFinite(n) ? n : NaN; };
      if (b.dataset.inv === "entrada") {
        const d = await hoja({
          titulo: `${x.producto} · inventario`,
          cuerpo: `<p class="modal-sub">${x.controlado ? `Disponible ahora: <strong>${x.disponible}</strong> cajas.` : "Primera carga: desde aquí se empieza a controlar el stock."}</p>
            <fieldset class="pay"><legend>Tipo</legend>
              <label class="pay-opt"><input type="radio" name="tipo" value="entrada" checked /> Entrada de mercancía</label>
              <label class="pay-opt"><input type="radio" name="tipo" value="ajuste" /> Ajuste (conteo, rotura…) — puede ser negativo</label></fieldset>
            <label class="field field-full"><span>Cajas *</span><input name="cajas" id="hCajas" inputmode="numeric" autocomplete="off" placeholder="ej. 20 (ajuste: -2)" /></label>
            <label class="field field-full"><span>Nota</span><input name="nota" maxlength="200" autocomplete="off" placeholder="Factura del proveedor, motivo del ajuste…" /></label>`,
          ok: "Guardar",
          validar: (d2) => {
            const n = Math.round(num(d2.cajas));
            if (!n) return "Indicá la cantidad de cajas.";
            if (d2.tipo === "entrada" && n < 0) return "Una entrada debe ser mayor que 0. Para restar elegí Ajuste.";
            if (d2.tipo === "ajuste" && !d2.nota.trim()) return "Escribí el motivo del ajuste.";
            return "";
          },
        });
        if (!d) return;
        try {
          const res = await api("movimiento", { code: x.code, producto: x.producto, cajas: Math.round(num(d.cajas)), tipo: d.tipo, nota: d.nota.trim() });
          toast(`${x.producto}: ${res.disponible} disponibles`);
          SkalaAPI.catalogo(true).catch(() => {});
          render();
        } catch (e2) { toast(e2.message); }
        return;
      }
      const val = (k) => (x[k] ? String(x[k]).replace(".", ",") : "");
      const campo = (k, t, ph) => `<label class="field"><span>${t}</span><input name="${k}" inputmode="decimal" autocomplete="off" placeholder="${ph}" value="${val(k)}" /></label>`;
      const d = await hoja({
        titulo: `Precios · ${x.producto}`,
        cuerpo: `<p class="modal-sub">En dólares por caja. Los descuentos se restan del precio menor o mayor según cómo pague.</p>
          <div class="form-grid">${campo("menor", "Al por menor *", "menos de 15 cajas")}${campo("mayor", "Al mayor", "15 cajas o más")}
          ${campo("desc_pronto", "Desc. pronto pago", "0")}${campo("desc_efectivo_credito", "Desc. efectivo a crédito", "0")}${campo("desc_efectivo_pronto", "Desc. efectivo pronto pago", "0")}</div>`,
        ok: "Guardar precios",
        validar: (d2) => {
          const n = Object.fromEntries(Object.entries(d2).map(([k, t]) => [k, t.trim() === "" ? 0 : num(t)]));
          if (Object.values(n).some((y) => !(y >= 0))) return "Revisá los montos: solo números (ej. 12,50).";
          if (!n.menor) return "Falta el precio al por menor.";
          if (n.mayor > n.menor) return "El precio al mayor no puede ser más alto que al por menor.";
          return "";
        },
      });
      if (!d) return;
      try {
        const datos = Object.fromEntries(Object.entries(d).map(([k, t]) => [k, t.trim() === "" ? 0 : num(t)]));
        await api("guardarPrecio", { code: x.code, producto: x.producto, ...datos });
        toast(`Precios de ${x.producto} guardados`);
        SkalaAPI.catalogo(true).catch(() => {});
        render();
      } catch (e2) { toast(e2.message); }
    });
  }

  /* ---------- Usuarios (Master) ---------- */
  let cacheUsuarios = [];
  async function vUsuarios(v, _p, _q, vigente) {
    const r = await api("usuarios");
    if (!vigente()) return;
    cacheUsuarios = r.usuarios;
    const orden = { master: 0, admin: 1, vendedor: 2, despachador: 3 };
    const lista = r.usuarios.slice().sort((a, b) => (orden[a.rol] ?? 9) - (orden[b.rol] ?? 9) || a.nombre.localeCompare(b.nombre));
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
      <fieldset class="pay roles-usuario" id="uRoles"><legend>Roles (puede tener varios)</legend>
        ${[["vendedor", "Vendedor", "toma pedidos, clientes y cobros"], ["despachador", "Despachador", "entrega los pedidos que le asignan"], ["admin", "Administración", "aprueba, concilia, inventario y precios"], ["master", "Master", "todo, incluido usuarios"]].map(([k, t, d]) =>
          `<label class="check rol-opt"><input type="checkbox" name="uRol" value="${k}"${(u ? u.roles || [u.rol] : ["vendedor"]).includes(k) ? " checked" : ""} /> <span><strong>${t}</strong> <span class="ped-det">${d}</span></span></label>`).join("")}
      </fieldset>
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
      const elegidos = [...document.querySelectorAll('input[name="uRol"]:checked')].map((x) => x.value);
      if (!elegidos.length) { $("uError").textContent = "Elegí al menos un rol."; $("uError").hidden = false; return; }
      btn.disabled = true;
      try {
        const r = await api("guardarUsuario", {
          id: u ? u.id : undefined, usuario: $("uUsuario").value.trim(), nombre: $("uNombre").value.trim(),
          roles: elegidos, activo: $("uActivo").checked, clave: $("uClave").value || undefined,
        });
        toast(`Usuario ${r.usuario.usuario} guardado`);
        if (r.usuario.id === yo().id) {
          // sus propios roles cambiaron: actualizar la sesión (o salir si ya no es Master o quedó inactivo)
          if (!r.usuario.roles.includes("master") || !r.usuario.activo) { SkalaAPI.cerrarSesion(); return ir("#/ingresar"); }
          SkalaAPI.guardarSesion(sesion().token, r.usuario);
        }
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
    if (vende()) items.push(["#/resumen", "Resumen", "Pedidos, cajas y productos más pedidos"]);
    if (gestion()) items.push(["#/inventario", "Inventario y precios", "Existencias, entradas de mercancía y los 5 precios"]);
    if (tiene("master")) items.push(["#/usuarios", "Usuarios", "Crear usuarios, claves, roles y activar"]);
    if (!APP) items.push(["index.html", "Ver catálogo", "La página que ven los clientes"]);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const instalada = !!APP || window.matchMedia("(display-mode: standalone)").matches;
    const local = SkalaAPI.datosLocales();
    const prox = proximaSync();
    let verApp = "", verPant = "";
    try { if (APP) { verApp = APP.versionName(); verPant = APP.versionPantallas(); } } catch (e) {}
    v.innerHTML = `
      <section class="tarjeta perfil"><strong>${esc(u.nombre)}</strong><span>@${esc(u.usuario)} · ${esc(u.rol_nombre)}</span></section>
      <ul class="menu-mas">${items.map(([h, t, d]) => `<li><a href="${h}"><strong>${t}</strong><span>${d}</span></a></li>`).join("")}</ul>
      ${instalada ? "" : `<section class="tarjeta"><h3 class="sub-titulo">Instalar en el teléfono</h3>
        ${eventoInstalar ? '<button type="button" class="btn btn-primary btn-bloque" id="btnInstalar">Instalar app Skala Equipo</button>'
          : `<p class="modal-sub">${ios ? "En Safari: botón Compartir → <strong>Agregar a inicio</strong>." : "En Chrome: menú ⋮ → <strong>Instalar app</strong> o <strong>Agregar a pantalla principal</strong>."}</p>`}</section>`}
      <section class="tarjeta" id="secDatos"><h3 class="sub-titulo">Datos en el teléfono</h3>
        <p class="modal-sub" id="datosEstado">${local && local.fecha ? `Actualizados ${esc(horaCorta(local.fecha))} · ${(local.pedidos || []).length} pedidos · ${(local.clientes || []).length} clientes` : "Todavía no hay datos guardados en este teléfono."}</p>
        <button type="button" class="btn btn-primary btn-bloque" id="btnSync">Actualizar ahora</button>
        <p class="nota-chica">Se actualizan solos a las 8 am, 1 pm y 4 pm${prox ? ` (próxima: ${esc(horaCorta(prox.toISOString()))})` : ""}. Sin señal, la app muestra lo guardado.</p>
        ${APP ? `<p class="nota-chica" id="verApp">App ${esc(verApp)}${verPant ? ` · pantallas ${esc(verPant)}` : ""}</p>` : ""}
      </section>
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
    $("btnSync").addEventListener("click", async () => {
      const b = $("btnSync");
      b.disabled = true; b.classList.add("ocupado"); b.textContent = "Actualizando…";
      cargando(1);
      try {
        const d = await SkalaAPI.sincronizar();
        toast("Datos actualizados");
        pintarAvisoApp(d);
        try { if (APP) APP.revisarActualizaciones(); } catch (e) {}
        if ($("datosEstado")) $("datosEstado").textContent = `Actualizados ${horaCorta(d.fecha)} · ${d.pedidos.length} pedidos · ${d.clientes.length} clientes`;
      } catch (e) {
        toast(e instanceof ErrorRed ? "Sin señal: probá de nuevo cuando haya conexión." : e.message);
      } finally {
        cargando(-1);
        if ($("btnSync")) { b.disabled = false; b.classList.remove("ocupado"); b.textContent = "Actualizar ahora"; }
      }
    });
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
    if (APP) {
      document.documentElement.classList.add("en-app");
      // En la app el catálogo no viene adentro: se abre la página pública en el navegador
      const lc = $("lnkCatalogo");
      if (CATALOGO_URL) { lc.href = CATALOGO_URL; lc.target = "_blank"; lc.rel = "noopener"; }
      else { lc.removeAttribute("href"); lc.removeAttribute("title"); lc.setAttribute("aria-hidden", "true"); lc.tabIndex = -1; }
      // la app nativa necesita la sesión para actualizar los datos con la app cerrada
      try { const s0 = sesion(); if (s0) APP.guardarToken(s0.token); } catch (e) {}
    }
    else if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
    if (!location.hash) location.replace("#/" + (sesion() ? "inicio" : "ingresar"));
    render();
    if (navigator.onLine) subirCola();
    autoSync();
  });
})();
