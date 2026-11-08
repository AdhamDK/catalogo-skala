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
  /* "1.234,56" · "12.500" · "120,5" → número con 2 decimales (0 si no es válido) */
  const montoNum = (t) => {
    let x = String(t ?? "").trim().replace(/\s|USD|Bs\.?|\$/gi, "");
    if (x.includes(",")) x = x.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(x)) x = x.replace(/\./g, "");
    const n = Number(x);
    return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  };
  /* Formatea en vivo con puntos de miles y coma decimal ("54.200,50").
     Si en el teclado del móvil tocan "." al final para abrir decimales, se convierte en ",". */
  function formatoMilesInput(raw, maxDec = 2) {
    let s = String(raw ?? "").replace(/[^\d.,]/g, "");
    if (!s) return "";
    if (s.endsWith(".") && !s.includes(",")) s = s.slice(0, -1) + ",";
    const tieneComa = s.includes(",");
    const partes = s.split(",");
    const ent = partes[0].replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    const entFmt = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (!tieneComa) return entFmt;
    const dec = partes.slice(1).join("").replace(/\D/g, "").slice(0, maxDec);
    return `${entFmt || "0"},${dec}`;
  }
  function formatoNumInput(n, siempreDecimales = false) {
    const num = Math.round((Number(n) || 0) * 100) / 100;
    if (!(num > 0)) return "";
    const [ent, dec] = num.toFixed(2).split(".");
    const entFmt = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return !siempreDecimales && dec === "00" ? entFmt : `${entFmt},${dec}`;
  }
  const K_CARRITO = "skala_pedido_v1";   // compartido con el catálogo
  const K_CLIENTE = "skala_vcliente_v1"; // borrador del cliente del pedido
  const K_LISTO = "skala_ultimo_pedido";
  const K_DESTINO = "skala_destino";
  const K_ULTIMO_USUARIO = "skala_ultimo_usuario";
  const K_CARGA = "skala_carga";          // pedidos elegidos para ver el total de carga
  const K_WEB = "skala_tomando_web";      // pedido web que se está tomando (id, cliente, forma de pago)
  const K_INV = "skala_inv_borrador";     // carga de inventario a medias: { entrada: {code: n}, conteo: {code: n} }
  const K_ENLACE = "skala_enlace_wa";     // pedido que llegó por WhatsApp con "Código de pedido para vendedor": { ref, tipo_pago, tel }
  const K_PRECIOS_MANUAL = "skala_precios_manual"; // precios personalizados por caja { code: precio } en el pedido en curso
  const K_TASAS_BCV = "skala_tasas_bcv_v1"; // caché local de tasas históricas del BCV { ts, mapa: { "YYYY-MM-DD": tasa } }
  const K_COMISION_CFG = "skala_comision_cfg_v1"; // configuración de % de comisiones { porcentaje_default: 3, por_vendedor: {}, vendedores: [] }
  const K_COMISION_PAGADAS = "skala_comisiones_pagadas_v1"; // respaldo local de comisiones marcadas como pagadas { [pago_id]: { comision_estado, ... } }

  /* Consulta la tasa oficial del BCV para una fecha (YYYY-MM-DD).
     Primero intenta el servidor CRM (que incluye tasas manuales de la hoja 'Tasas' y DolarApi)
     y respalda con consulta directa a ve.dolarapi.com + caché en el teléfono. */
  const hoyIso = () => new Date().toISOString().slice(0, 10);
  async function obtenerTasaBcv(fecha) {
    const f = String(fecha || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return { tasa: 0, fechaEfectiva: f, fuente: "" };
    const buscarEnMapa = (mapa) => {
      if (!mapa || typeof mapa !== "object") return null;
      if (Number(mapa[f]) > 0) return { tasa: Number(mapa[f]), fechaEfectiva: f };
      const previas = Object.keys(mapa).filter((d) => d <= f && Number(mapa[d]) > 0).sort();
      if (previas.length) {
        const ult = previas[previas.length - 1];
        return { tasa: Number(mapa[ult]), fechaEfectiva: ult };
      }
      return null;
    };
    // 1) Intentar acción 'tasa' del CRM (sin bloquear si aún no está desplegada o no hay señal)
    try {
      const r = await SkalaAPI.api("tasa", { fecha: f });
      if (r && Number(r.tasa) > 0) {
        const cache = leerLS(K_TASAS_BCV, { ts: 0, mapa: {} });
        cache.mapa = cache.mapa || {};
        cache.mapa[r.fecha_efectiva || f] = Number(r.tasa);
        guardarLS(K_TASAS_BCV, cache);
        return { tasa: Math.round(Number(r.tasa) * 10000) / 10000, fechaEfectiva: r.fecha_efectiva || f, fuente: r.fuente || "BCV" };
      }
    } catch (_) {}
    // 2) Caché local reciente (< 6 horas) si ya contiene la fecha
    const cache = leerLS(K_TASAS_BCV, { ts: 0, mapa: {} });
    const diaHoyIso = hoyIso();
    if (cache && cache.mapa && Date.now() - (Number(cache.ts) || 0) < 6 * 3600000) {
      const enc = buscarEnMapa(cache.mapa);
      if (enc && (enc.fechaEfectiva === f || f < diaHoyIso)) return { ...enc, fuente: "BCV" };
    }
    // 3) Consultar histórico oficial de BCV en DolarApi directamente
    try {
      const resp = await fetch("https://ve.dolarapi.com/v1/historicos/dolares/oficial");
      if (resp.ok) {
        const lista = await resp.json();
        if (Array.isArray(lista)) {
          const mapa = { ...(cache && cache.mapa ? cache.mapa : {}) };
          lista.forEach((x) => {
            const fd = String(x.fecha || "").slice(0, 10);
            const prom = Math.round((Number(x.promedio) || 0) * 10000) / 10000;
            if (/^\d{4}-\d{2}-\d{2}$/.test(fd) && prom > 0) mapa[fd] = prom;
          });
          guardarLS(K_TASAS_BCV, { ts: Date.now(), mapa });
          const enc = buscarEnMapa(mapa);
          if (enc) return { ...enc, fuente: "BCV" };
        }
      }
    } catch (_) {}
    const encFinal = buscarEnMapa(cache && cache.mapa);
    return encFinal ? { ...encFinal, fuente: "BCV (guardada)" } : { tasa: 0, fechaEfectiva: f, fuente: "" };
  }
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
    nuevo: { titulo: "Catálogo · Nuevo pedido", roles: TOMAN, nav: "nuevo", render: vNuevoProductos },
    "nuevo/productos": { titulo: "Catálogo · Nuevo pedido", roles: TOMAN, nav: "nuevo", render: vNuevoProductos },
    "nuevo/cliente": { titulo: "Seleccionar cliente", roles: TOMAN, nav: "nuevo", atras: "#/nuevo", render: vNuevoCliente },
    "nuevo/enviar": { titulo: "Enviar pedido", roles: TOMAN, nav: "nuevo", atras: "#/nuevo/cliente", render: vNuevoEnviar },
    "nuevo/listo": { titulo: "Pedido guardado", roles: TOMAN, nav: "nuevo", render: vNuevoListo },
    pedidos: { titulo: "Pedidos", roles: TOMAN, nav: "pedidos", render: vPedidos },
    entregas: { titulo: "Mis entregas", roles: ["despachador", "master", "admin"], nav: "entregas", render: vPedidos }, // Administración: "Despacho"
    pedido: { titulo: "Pedido", roles: TODOS, atras: true, render: vPedido },
    editar: { titulo: "Editar pedido", roles: ["master", "admin"], atras: true, render: vEditarPedido },
    web: { titulo: "Pedido web", roles: TOMAN, nav: "pedidos", atras: "#/pedidos?tab=hacer", render: vWeb },
    carga: { titulo: "Total de carga", roles: ["despachador", "master", "admin"], atras: true, render: vCarga },
    clientes: { titulo: "Clientes", roles: TOMAN, nav: "clientes", render: vClientes },
    cliente: { titulo: "Cliente", roles: TOMAN, nav: "clientes", atras: "#/clientes", render: vCliente },
    resumen: { titulo: "Resumen", roles: TOMAN, nav: "mas", atras: "#/mas", render: vResumen },
    inventario: { titulo: "Inventario", roles: ["master", "admin"], nav: "mas", atras: "#/mas", render: vInventario },
    "inventario/cargar": { titulo: "Cargar inventario", roles: ["master", "admin"], nav: "mas", atras: "#/inventario", render: vCargarInventario },
    precios: { titulo: "Precios", roles: ["master", "admin"], nav: "mas", atras: "#/mas", render: vPrecios },
    usuarios: { titulo: "Usuarios", roles: ["master"], nav: "mas", atras: "#/mas", render: vUsuarios },
    usuario: { titulo: "Usuario", roles: ["master"], nav: "mas", atras: "#/usuarios", render: vUsuario },
    mas: { titulo: "Más", roles: TODOS, nav: "mas", render: vMas },
  };

  function leerRuta() {
    const [ruta, query] = location.hash.replace(/^#\/?/, "").split("?");
    const segs = ruta.split("/").filter(Boolean);
    let clave = segs[0] || "inicio";
    let param = segs[1] ? decodeURIComponent(segs[1]) : "";
    if ((clave === "nuevo" || clave === "inventario") && param) { clave = clave + "/" + param; param = ""; }
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

    document.title = `${def.titulo} · Ontiveros Equipo`;
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
    if (gestion()) items.push(["entregas", "Despacho"]); // sin depositario, Administración despacha
    else if (tiene("despachador")) items.push(["entregas", "Entregas"]);
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
  const textoNivelPrecio = (p) => p.nivel_precio === "personalizado" ? "precio personalizado" : `precio ${p.nivel_precio === "mayor" ? "al mayor" : "al por menor"}${p.excepcion_precio ? " (excepción)" : ""}`;

  /* -------------------- Carrito (compartido con el catálogo) -------------------- */
  const carrito = () => leerLS(K_CARRITO, {}) || {};
  const guardarCarrito = (c) => guardarLS(K_CARRITO, c);
  const cajasCarrito = () => Object.values(carrito()).reduce((a, b) => a + (Number(b) || 0), 0);
  const preciosManuales = () => leerLS(K_PRECIOS_MANUAL, {}) || {};
  const guardarPreciosManuales = (m) => guardarLS(K_PRECIOS_MANUAL, m || {});

  /* -------------------- Vista Catálogo (Cuadrícula vs. Lista rápida) y GPS Slots -------------------- */
  const K_VISTA_CAT = "skala_vista_cat";
  const K_CFG_GRUPOS = "skala_config_grupos_v1";
  const leerConfigGrupos = () => leerLS(K_CFG_GRUPOS, {}) || {};
  const guardarConfigGrupos = (cfg) => guardarLS(K_CFG_GRUPOS, cfg || {});
  function vistaCatActual() {
    try {
      const raw = localStorage.getItem(K_VISTA_CAT);
      if (raw === "matriz" || raw === '"matriz"') return "matriz";
    } catch (e) {}
    return "cuadricula";
  }
  function selectorVistaCatHTML() {
    const m = vistaCatActual();
    return `<div class="selector-vista-cat" role="group" aria-label="Cambiar vista de productos">
      <button type="button" class="vista-cat-btn${m === "cuadricula" ? " activo" : ""}" data-vista-modo="cuadricula" title="Vista cuadrícula" aria-label="Vista cuadrícula">⊞ Cuadrícula</button>
      <button type="button" class="vista-cat-btn${m === "matriz" ? " activo" : ""}" data-vista-modo="matriz" title="Lista rápida" aria-label="Lista rápida">☰ Lista rápida</button>
    </div>`;
  }
  function enlazarSelectorVistaCat(raiz, listaEl) {
    if (!raiz || !listaEl) return;
    const aplicar = (modo) => {
      const m = modo === "matriz" ? "matriz" : "cuadricula";
      try { localStorage.setItem(K_VISTA_CAT, m); } catch (e) {}
      listaEl.classList.toggle("modo-matriz", m === "matriz");
      raiz.querySelectorAll(".selector-vista-cat [data-vista-modo]").forEach((b) => {
        b.classList.toggle("activo", b.dataset.vistaModo === m);
      });
    };
    aplicar(vistaCatActual());
    raiz.querySelectorAll(".selector-vista-cat [data-vista-modo]").forEach((btn) => {
      btn.addEventListener("click", () => aplicar(btn.dataset.vistaModo));
    });
  }
  /* -------------------- Rutas diversificadas de Cartera y Mapa Preview -------------------- */
  const RUTAS_CARTERA = ["Chivo", "Vigía", "Mérida", "Mocotíes", "Caja Seca", "Táchira"];
  const K_RUTAS_CLI = "skala_rutas_clientes_v1";
  const RUTAS_BASE_POR_ID = {
    "772da44b-3153-4bde-ab19-b48715b00cdf": "Chivo",      // SUPERMERCADO EL JIRETH, C. A.
    "465b0ad1-9738-4dc3-b958-40681ba5db89": "Chivo",      // CORPORACION MI ANGEL C.A
    "2eb9404b-5622-4dc4-99f3-08684dc2c63c": "Chivo",      // VIVERES EL HEREDERO CONTRERAS, F.P.
    "4f55f5fa-a0e6-47ef-89eb-311ec9ac62c6": "Chivo",      // Comercializadora Sur Del Lago Parra
    "da43b6ca-fa36-4b37-9160-f4bcd0b39048": "Caja Seca",  // Cimercializadora Glaymar C.A (Panamericana)
    "75c4e1ae-4c39-43c1-8302-a2554556ce7a": "Caja Seca",  // INVERSIONES S & S YSMARI SERRUDO QUINTERO
    "d0216c35-935b-4d56-be36-f0ace7e1c9a4": "Caja Seca",  // Agencia de Festejos Guillermo
    "6002e33d-09d4-40aa-bd29-02e32bdbe8e3": "Mocotíes",   // La Casa De La Mercaderia (Santa Cruz de Mora)
    "96ef523e-d0c1-4961-8cfd-9829a7f2edb7": "Mocotíes",   // Automercado La Suerte Huimei Zheng (Santa Cruz de Mora)
    "528e785f-b85c-4859-98f0-85464485865a": "Mocotíes",   // Automercado Lucky (Tovar)
    "8cc62278-c92a-4bfa-8770-34d1b15d2903": "Táchira",    // Xuemei Zheng (Eje Frontera / Bailadores)
    "4ca6e254-eb17-4d01-9b3c-77857a87dabf": "Táchira",    // Abastos Hong Kong II (Eje Frontera / Bailadores)
  };
  function slugRuta(r) {
    return String(r || "vigia").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  }
  function guardarRutaCliente(id, ruta) {
    if (!id || !ruta) return;
    const m = leerLS(K_RUTAS_CLI, {}) || {};
    m[id] = ruta;
    guardarLS(K_RUTAS_CLI, m);
  }
  function rutaDeCliente(c) {
    if (!c) return "Vigía";
    if (c.ruta && RUTAS_CARTERA.includes(c.ruta)) return c.ruta;
    const guardadas = leerLS(K_RUTAS_CLI, {}) || {};
    if (c.id && guardadas[c.id]) return guardadas[c.id];
    const mTag = String(c.direccion || "").match(/\[Ruta:\s*([^\]]+)\]/i);
    if (mTag && mTag[1]) return mTag[1].trim();
    if (c.id && RUTAS_BASE_POR_ID[c.id]) return RUTAS_BASE_POR_ID[c.id];
    const txt = `${c.nombre || ""} ${c.negocio || ""} ${c.direccion || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (/tachira|san\s*cristobal|la\s*fria|coloncito|pinal|rubio|tariba/.test(txt)) return "Táchira";
    if (/caja\s*seca|panamericana|nueva\s*bolivia|arenales|zancudo|bobures|arapuey/.test(txt)) return "Caja Seca";
    if (/mocoties|santa\s*cruz\s*de\s*mora|tovar|bailadores|zea/.test(txt)) return "Mocotíes";
    if (/chivo|pueblo\s*nuevo|rurale|cuatro\s*esquinas/.test(txt)) return "Chivo";
    if (/vigia|cano\s*seco/.test(txt)) return "Vigía";
    if (/merida|llano|milla|lora|independencia|pinto\s*salina|ejido/.test(txt)) return "Mérida";
    return "Vigía";
  }

  function abrirAdelantoGps() {
    return hoja({
      titulo: "🗺️ Nuevas Funciones de Mapa y Rutas GPS",
      cuerpo: `<div class="adelanto-gps-box">
        <p class="modal-sub">Próxima integración nativa con el motor de inteligencia territorial de campo (inspirado en <strong>SPOTIO</strong>):</p>
        <div class="periodos periodos-chicos" aria-label="Rutas de cobertura" style="margin-bottom:8px">
          ${RUTAS_CARTERA.map((r, i) => `<span class="tab${i === 0 ? " active" : ""}">📍 ${esc(r)}</span>`).join("")}
        </div>
        <div class="lienzo-mapa-simulado" aria-hidden="true" style="margin-bottom:10px">
          <span class="pin-sim p-rojo" style="top:26%;left:28%" title="Chivo / Sur del Lago">🔴</span>
          <span class="pin-sim p-morado" style="top:46%;left:52%" title="El Vigía">🟣</span>
          <span class="pin-sim p-verde" style="top:34%;left:76%" title="Mérida">🟢</span>
          <span class="pin-sim p-naranja" style="top:68%;left:38%" title="Mocotíes / Táchira">🟠</span>
        </div>
        <ul class="leyenda-pines-skala" style="margin-bottom:10px">
          <li><span>🔴 Crédito vencido</span></li>
          <li><span>🟣 Pedido en ruta</span></li>
          <li><span>🟢 Visitado hoy</span></li>
          <li><span>🟠 Sin compras &gt;30 días</span></li>
        </ul>
        <ul class="resumen-items">
          <li><span><strong>🗺️ Mapa Interactivo por Rutas</strong><br><span class="ped-det">Visualización en vivo de tus clientes por ruta: Chivo, Vigía, Mérida, Mocotíes, Caja Seca y Táchira.</span></span></li>
          <li><span><strong>🚚 Ruteo Óptimo VROOM / 2-Opt</strong><br><span class="ped-det">Secuencia automática de paradas de camión (1 → N) para ahorrar tiempo y combustible.</span></span></li>
          <li><span><strong>📍 Check-in GPS y Geocerca</strong><br><span class="ped-det">Registro automático de visita en sitio, radar de clientes cercanos y frecuencia de atención.</span></span></li>
        </ul>
      </div>`,
      ok: "Entendido",
    });
  }

  /* ==================== PÁGINAS ==================== */

  /* ---------- Ingresar ---------- */
  function vIngresar(v) {
    v.innerHTML = `
      <form class="tarjeta login" id="fLogin" novalidate>
        <img src="assets/img/web/icono-do-transparente.png?v=3" alt="Distribuciones Ontiveros" width="120" height="64" class="login-logo" />
        <h2>Equipo Distribuciones Ontiveros</h2>
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
  const K_INICIO_MODO = "skala_inicio_modo";
  const K_INICIO_ALCANCE = "skala_inicio_alcance";
  let periodoRitmoInicio = 7;

  async function vInicio(v, _p, _q, vigente) {
    const u = yo();
    const r = rolPedidos();
    const esMultiRol = gestion() && vende();
    const leerModoInicio = () => {
      if (!vende()) return "general";
      try {
        const m = sessionStorage.getItem(K_INICIO_MODO);
        if (m === "general" || m === "vendedor") return m;
      } catch (_) {}
      return "vendedor";
    };
    const leerAlcanceInicio = () => {
      if (!esMultiRol) return "mios";
      try {
        const a = sessionStorage.getItem(K_INICIO_ALCANCE);
        if (a === "mios" || a === "todos") return a;
      } catch (_) {}
      return tiene("vendedor") ? "mios" : "todos";
    };

    const hora = new Date().getHours();
    const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
    const accesos = [];
    if (vende()) accesos.push(["#/nuevo", "Nuevo pedido", "nuevo"], ["#/pedidos", "Pedidos", "pedidos"], ["#/clientes", "Clientes", "clientes"]);
    if (gestion()) accesos.push(["#/entregas", "Despacho", "entregas"]);
    else if (tiene("despachador")) accesos.push(["#/entregas", "Mis entregas", "entregas"]);

    const cacheTasa = leerLS(K_TASAS_BCV, { ts: 0, mapa: {} });
    let tasaActiva = 0;
    if (cacheTasa && cacheTasa.mapa) {
      const fHoy = hoyIso();
      if (Number(cacheTasa.mapa[fHoy]) > 0) tasaActiva = Number(cacheTasa.mapa[fHoy]);
      else {
        const prev = Object.keys(cacheTasa.mapa).filter((d) => d <= fHoy && Number(cacheTasa.mapa[d]) > 0).sort();
        if (prev.length) tasaActiva = Number(cacheTasa.mapa[prev[prev.length - 1]]);
      }
    }

    v.innerHTML = `
      <section class="saludo">
        <div class="saludo-fila">
          <div><h2>${saludo}, ${esc(u.nombre.split(" ")[0])}</h2><p>${esc(u.rol_nombre)}</p></div>
          <span class="chip-bcv-inicio" id="chipTasaBcv">${tasaActiva > 0 ? `BCV: Bs ${formatoNumInput(tasaActiva, true)} / $` : "BCV del día"}</span>
        </div>
      </section>
      ${esMultiRol ? `<div class="inicio-switch-bar" id="iSwitchRol">
        <div class="iv-modo-tabs" id="iModoTabs" data-pos="0" role="group" aria-label="Modo de vista de inicio">
          <span class="iv-seg-slider" aria-hidden="true"></span>
          <button type="button" class="iv-switch-btn" data-inicio-modo="vendedor">
            <span class="iv-dot-ind" aria-hidden="true"></span>
            <span class="iv-btn-txt">Vista Vendedor</span>
          </button>
          <button type="button" class="iv-switch-btn" data-inicio-modo="general">
            <span class="iv-dot-ind" aria-hidden="true"></span>
            <span class="iv-btn-txt">Resumen general</span>
          </button>
        </div>
        <div class="iv-alcance-tabs" id="iAlcanceWrap" data-pos="0" role="group" aria-label="Filtro de cartera en inicio">
          <span class="iv-seg-slider es-alcance" aria-hidden="true"></span>
          <button type="button" class="iv-alcance-btn" data-inicio-alcance="mios">
            <span class="iv-btn-fila-top"><span class="iv-dot-ind" aria-hidden="true"></span><span>Mis ventas</span></span>
            <span class="iv-btn-pill-meta" id="ivMetaMios">Cargando…</span>
          </button>
          <button type="button" class="iv-alcance-btn" data-inicio-alcance="todos">
            <span class="iv-btn-fila-top"><span class="iv-dot-ind" aria-hidden="true"></span><span>Todos los vendedores</span></span>
            <span class="iv-btn-pill-meta" id="ivMetaTodos">Cargando…</span>
          </button>
        </div>
        <div class="iv-estado-banner" id="iEstadoVistaBanner" role="status" aria-live="polite"></div>
      </div>` : ""}
      <div id="iDestacado"></div>
      <div id="iVendedorWrap" ${vende() ? "" : "hidden"}>
        <div class="iv-resumen-grid" id="iResumenVendedor"></div>
        <div class="iv-analytics-grid" id="iAnalyticsVendedor"></div>
      </div>
      <div class="stats" id="iStats"><div class="stat"><strong>…</strong><span>cargando</span></div></div>
      <div class="accesos">${accesos.map(([h, t, k]) => `<a class="acceso" href="${h}">${icono(k)}<span>${t}</span></a>`).join("")}</div>
      <section class="tarjeta tarjeta-prox-gps" id="cardProxRuta" data-gps-slot="inicio-ruta">
        <div class="prox-gps-cab">
          <div>
            <span class="chip-prox">Próximamente</span>
            <h3 class="prox-gps-tit">Rutero Inteligente y Mapa GPS</h3>
          </div>
          <button type="button" class="btn btn-ghost" id="btnVerAdelantoGps">Ver adelanto</button>
        </div>
        <p class="ped-det">Ruteo óptimo diario (VROOM / 2-Opt), mapa de clientes con semáforo de deuda y entregas en vivo.</p>
      </section>
      <h3 class="sub-titulo" id="iListaTit"></h3>
      <ul class="lista-ped" id="iLista"></ul>
      <div id="iCargaFondo"></div>`;

    const btnAdelanto = $("btnVerAdelantoGps");
    if (btnAdelanto) btnAdelanto.addEventListener("click", abrirAdelantoGps);

    let datosListos = false;
    let todosPedidos = [];
    let listaPorCobrar = [];
    let cfgComActual = leerLS(K_COMISION_CFG, { porcentaje_default: 3, por_vendedor: {}, vendedores: [] }) || { porcentaje_default: 3, por_vendedor: {}, vendedores: [] };

    const dispararAnim = (el, cls) => {
      if (!el) return;
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
    };

    const pintarVistaVendedor = (tipoAnim = "") => {
      if (!vende() || !datosListos) return;
      const modo = leerModoInicio();
      const alcance = leerAlcanceInicio();
      const wrapVendedor = $("iVendedorWrap");
      const wrapAlcance = $("iAlcanceWrap");
      const modoTabs = $("iModoTabs");
      const switchBar = $("iSwitchRol");
      const statsEl = $("iStats");

      const vLoc = leerLS(K_VISITADOS_HOY, null);
      const idsLoc = vLoc && vLoc.fecha === hoyCaracas() && Array.isArray(vLoc.ids) ? vLoc.ids : [];
      const dLoc = SkalaAPI.datosLocales();
      const visitasHoy = [
        ...idsLoc.map((cid) => ({ cliente_id: cid, canal: "en_persona", vendedor_id: u.id })),
        ...(((dLoc && dLoc.visitas) || []).filter((x) => x.fecha === hoyCaracas() && !x.anulada)),
      ];
      const pagadasLocal = leerLS(K_COMISION_PAGADAS, {}) || {};
      const comCfg = { ...cfgComActual, pagadas_locales: pagadasLocal };

      const uidMio = String(u.id || "");
      const uidFiltro = !esMultiRol || alcance === "mios" ? uidMio : "";
      const rv = resumenInicioVendedor({
        pedidos: todosPedidos,
        porCobrar: listaPorCobrar,
        visitasHoy,
        comisionesCfg: comCfg,
        uid: uidFiltro,
        hoy: new Date(),
        tasaBcv: tasaActiva,
      });

      if (switchBar) {
        if (modoTabs) modoTabs.dataset.pos = modo === "general" ? "1" : "0";
        switchBar.querySelectorAll("[data-inicio-modo]").forEach((b) => {
          const act = b.dataset.inicioModo === modo;
          b.classList.toggle("active", act);
          b.setAttribute("aria-pressed", String(act));
        });
        if (wrapAlcance) {
          wrapAlcance.hidden = modo !== "vendedor";
          wrapAlcance.dataset.pos = alcance === "todos" ? "1" : "0";
          wrapAlcance.querySelectorAll("[data-inicio-alcance]").forEach((b) => {
            const act = b.dataset.inicioAlcance === alcance;
            b.classList.toggle("active", act);
            b.setAttribute("aria-pressed", String(act));
          });
        }
        // Actualizar contadores en vivo dentro de cada botón para que se vea qué contiene cada opción
        const rvMios = alcance === "mios" ? rv : resumenInicioVendedor({
          pedidos: todosPedidos, porCobrar: listaPorCobrar, visitasHoy, comisionesCfg: comCfg, uid: uidMio, hoy: new Date(), tasaBcv: tasaActiva,
        });
        const rvTodos = alcance === "todos" ? rv : resumenInicioVendedor({
          pedidos: todosPedidos, porCobrar: listaPorCobrar, visitasHoy, comisionesCfg: comCfg, uid: "", hoy: new Date(), tasaBcv: tasaActiva,
        });
        const metaMios = $("ivMetaMios");
        const metaTodos = $("ivMetaTodos");
        if (metaMios) metaMios.textContent = `${rvMios.pedidosHoy.cantidad} hoy · ${formatoMonto(rvMios.ventasHoy.totalUsd, "$")}`;
        if (metaTodos) metaTodos.textContent = `${rvTodos.pedidosHoy.cantidad} hoy · ${formatoMonto(rvTodos.ventasHoy.totalUsd, "$")}`;

        const bannerEl = $("iEstadoVistaBanner");
        if (bannerEl) {
          if (modo === "general") {
            bannerEl.className = "iv-estado-banner es-general";
            bannerEl.innerHTML = `<span class="iv-banner-dot" aria-hidden="true"></span><span>Mostrando: <strong>Resumen general de Administración y Despacho</strong></span>`;
          } else if (alcance === "mios") {
            bannerEl.className = "iv-estado-banner es-mios";
            bannerEl.innerHTML = `<span class="iv-banner-dot" aria-hidden="true"></span><span>Mostrando: <strong>Mis ventas (${esc(u.nombre.split(" ")[0])})</strong> · Hoy ${esc(formatoMonto(rv.ventasHoy.totalUsd, "$"))} (${rv.pedidosHoy.cantidad} ped.)</span>`;
          } else {
            bannerEl.className = "iv-estado-banner es-todos";
            bannerEl.innerHTML = `<span class="iv-banner-dot" aria-hidden="true"></span><span>Mostrando: <strong>Todos los vendedores (Equipo completo)</strong> · Hoy ${esc(formatoMonto(rv.ventasHoy.totalUsd, "$"))} (${rv.pedidosHoy.cantidad} ped.)</span>`;
          }
          if (tipoAnim === "modo" || tipoAnim === "alcance") dispararAnim(bannerEl, "iv-banner-pulso");
        }
      }

      if (wrapVendedor) wrapVendedor.hidden = modo !== "vendedor";
      if (statsEl) {
        if (esMultiRol) statsEl.hidden = modo === "vendedor";
        else statsEl.classList.toggle("stats-secundario", modo === "vendedor");
      }

      const txtBs = (montoBs, montoUsd) => {
        if (tasaActiva > 0) return formatoMonto(montoBs, "Bs");
        return montoUsd > 0 ? "Bs (según BCV)" : "Bs 0,00";
      };

      const resEl = $("iResumenVendedor");
      if (resEl) {
        const vh = rv.ventasHoy;
        const ph = rv.pedidosHoy;
        const cv = rv.cobrarVencido;
        const cpv = rv.cobrarPorVencer;
        resEl.innerHTML = `
          <article class="iv-card iv-card-ventas iv-card-ventas-pedidos" id="ivCardVentasHoy">
            <div class="iv-vp-top">
              <div class="iv-vp-ventas-col">
                <span class="iv-card-kicker">Ventas hoy</span>
                <strong class="iv-card-total">${esc(formatoMonto(vh.totalUsd, "$"))}</strong>
              </div>
              <a class="iv-vp-pedidos-box" id="ivCardPedidosHoy" href="#/pedidos">
                <span class="iv-vp-ped-lbl">Pedidos hoy</span>
                <div class="iv-vp-ped-fila">
                  <strong class="iv-vp-ped-num">${ph.cantidad}</strong>
                  <span class="iv-vp-ped-cli">${ph.clientesUnicos} cliente${ph.clientesUnicos === 1 ? " hoy" : "s hoy"}</span>
                </div>
              </a>
            </div>
            <div class="iv-desglose-grid">
              <div class="iv-sub-box es-bcv">
                <span class="iv-sub-lbl">Divisas BCV</span>
                <strong class="iv-sub-val">${esc(formatoMonto(vh.bcvUsd, "$"))}</strong>
                <span class="iv-sub-bs">${esc(txtBs(vh.bcvBs, vh.bcvUsd))}</span>
              </div>
              <div class="iv-sub-box es-efectivo">
                <span class="iv-sub-lbl">Efectivo ($)</span>
                <strong class="iv-sub-val">${esc(formatoMonto(vh.efectivoUsd, "$"))}</strong>
                <span class="iv-sub-bs">Dólares efectivo</span>
              </div>
            </div>
            <a class="iv-vp-footer" href="#/pedidos">
              <div class="iv-chips-fila">
                <span class="iv-mini-chip">${ph.enProceso} en proceso</span>
                <span class="iv-mini-chip">${ph.enDespacho} en despacho</span>
              </div>
              <span class="iv-vp-ir">Ver pedidos</span>
            </a>
          </article>

          <a class="iv-card card-vencido${cv.pedidosCount > 0 ? " stat-alerta" : ""}" id="ivCardCobrarVencido" href="#/pedidos?tab=cobros&ver=cobrar">
            <div class="iv-card-head">
              <span class="iv-card-kicker">Por cobrar · Vencido</span>
              <span class="iv-card-badge es-rojo">${cv.pedidosCount} fact.</span>
            </div>
            <div class="iv-cobro-top">
              <strong class="iv-clientes-grande">${cv.clientesUnicos} cliente${cv.clientesUnicos === 1 ? "" : "s"} <span class="iv-ped-sec">· ${cv.pedidosCount} pedido${cv.pedidosCount === 1 ? "" : "s"}</span></strong>
              <strong class="iv-cobro-monto">${esc(formatoMonto(cv.totalUsd, "$"))}</strong>
            </div>
            <div class="iv-desglose-grid">
              <div class="iv-sub-box es-bcv">
                <span class="iv-sub-lbl">Dólares BCV</span>
                <strong class="iv-sub-val">${esc(formatoMonto(cv.bcvUsd, "$"))}</strong>
                <span class="iv-sub-bs">${esc(txtBs(cv.bcvBs, cv.bcvUsd))}</span>
              </div>
              <div class="iv-sub-box es-efectivo">
                <span class="iv-sub-lbl">Efectivo ($)</span>
                <strong class="iv-sub-val">${esc(formatoMonto(cv.efectivoUsd, "$"))}</strong>
                <span class="iv-sub-bs">Cobro en efectivo</span>
              </div>
            </div>
          </a>

          <a class="iv-card card-por-vencer${cpv.proximosCount > 0 ? " con-proximo" : ""}" id="ivCardCobrarPorVencer" href="#/pedidos?tab=cobros&ver=cobrar">
            <div class="iv-card-head">
              <span class="iv-card-kicker">Por cobrar · Por vencer</span>
              <span class="iv-card-badge ${cpv.proximosCount > 0 ? "es-ambar" : "es-verde"}">${cpv.proximosCount > 0 ? `${cpv.proximosCount} ≤ 3 días` : "Al día"}</span>
            </div>
            <div class="iv-cobro-top">
              <strong class="iv-clientes-grande">${cpv.clientesUnicos} cliente${cpv.clientesUnicos === 1 ? "" : "s"} <span class="iv-ped-sec">· ${cpv.pedidosCount} pedido${cpv.pedidosCount === 1 ? "" : "s"}</span></strong>
              <strong class="iv-cobro-monto">${esc(formatoMonto(cpv.totalUsd, "$"))}</strong>
            </div>
            <div class="iv-desglose-grid">
              <div class="iv-sub-box es-bcv">
                <span class="iv-sub-lbl">Dólares BCV</span>
                <strong class="iv-sub-val">${esc(formatoMonto(cpv.bcvUsd, "$"))}</strong>
                <span class="iv-sub-bs">${esc(txtBs(cpv.bcvBs, cpv.bcvUsd))}</span>
              </div>
              <div class="iv-sub-box es-efectivo">
                <span class="iv-sub-lbl">Efectivo ($)</span>
                <strong class="iv-sub-val">${esc(formatoMonto(cpv.efectivoUsd, "$"))}</strong>
                <span class="iv-sub-bs">Cobro en efectivo</span>
              </div>
            </div>
          </a>`;
      }

      const anaEl = $("iAnalyticsVendedor");
      if (anaEl) {
        const cyc = rv.cobrosYComision;
        const ch = cyc.cobrosHoy;
        const com = cyc.comisiones;
        const ritmoAct = periodoRitmoInicio === 30 ? rv.ritmo.d30 : rv.ritmo.d7;
        const cob = rv.coberturaHoy;
        const topP = rv.topProductos;

        anaEl.innerHTML = `
          <section class="tarjeta iv-ana-card" id="ivAnaComision">
            <div class="iv-ana-head">
              <div>
                <h3 class="iv-ana-tit">Mi Comisión y Cobros de Hoy</h3>
                <p class="ped-det">${com.pendientesCount} comisión(es) por cobrar · ${ch.cantidad} cobro(s) hoy</p>
              </div>
              <a class="btn btn-ghost iv-btn-link" href="#/pedidos?tab=cobros&ver=comisiones">Comisiones</a>
            </div>
            <div class="iv-desglose-grid">
              <div class="iv-sub-box es-com-ef">
                <span class="iv-sub-lbl">Comisión · Efectivo ($)</span>
                <strong class="iv-sub-val">${esc(formatoMonto(com.efectivoUsd, "$"))}</strong>
                <span class="iv-sub-bs">Por liquidar en $</span>
              </div>
              <div class="iv-sub-box es-com-bs">
                <span class="iv-sub-lbl">Comisión · BCV (Bs)</span>
                <strong class="iv-sub-val">${esc(formatoMonto(com.bcvBs, "Bs"))}</strong>
                <span class="iv-sub-bs">Equiv. ${esc(formatoMonto(com.bcvUsd, "$"))}</span>
              </div>
            </div>
            <div class="iv-cobros-hoy-linea">
              <span>Cobrado hoy: <strong>${esc(formatoMonto(ch.efectivoUsd, "$"))}</strong> efec. + <strong>${esc(formatoMonto(ch.bs, "Bs"))}</strong></span>
              ${ch.pendientesConciliar > 0 ? `<span class="iv-chip-conc">${ch.pendientesConciliar} por conciliar</span>` : ""}
            </div>
          </section>

          <section class="tarjeta iv-ana-card" id="ivAnaRadar">
            <div class="iv-ana-head">
              <div>
                <h3 class="iv-ana-tit">Radar de Cobranza Urgente</h3>
                <p class="ped-det">Top clientes con saldo vencido</p>
              </div>
              <a class="btn btn-ghost iv-btn-link" href="#/pedidos?tab=cobros&ver=cobrar">Ver todos</a>
            </div>
            ${rv.topVencidos.length
              ? `<ul class="iv-radar-lista">${rv.topVencidos.map((it) => `
                <li class="iv-radar-item">
                  <div class="iv-radar-info">
                    <strong>${esc(it.negocio)}</strong>
                    <span class="ped-det">${esc(it.id)} · <span class="iv-mod-tag ${it.modalidad === "Efectivo" ? "es-ef" : "es-bcv"}">${esc(it.modalidad)}</span> · ${esc(it.textoEstado)}</span>
                    <strong class="iv-radar-saldo">${esc(formatoMonto(it.saldoUsd, "$"))}</strong>
                  </div>
                  <div class="iv-radar-acciones">
                    <a class="btn btn-primary iv-radar-btn" href="#/pedido/${encodeURIComponent(it.id)}">Cobrar</a>
                    ${it.telefonoWhatsapp ? `<a class="btn btn-ghost iv-radar-btn" href="https://wa.me/${esc(it.telefonoWhatsapp)}" target="_blank" rel="noopener" aria-label="WhatsApp a ${esc(it.negocio)}">WA</a>` : ""}
                  </div>
                </li>`).join("")}</ul>`
              : `<p class="iv-vacio-ok">Sin facturas vencidas pendientes de cobro.</p>`}
          </section>

          <section class="tarjeta iv-ana-card" id="ivAnaRitmo">
            <div class="iv-ana-head">
              <div>
                <h3 class="iv-ana-tit">Ritmo Comercial ($)</h3>
                <p class="ped-det">Mostrando: <strong>Últimos ${periodoRitmoInicio} días</strong> (${ritmoAct.pedidos} ped.)</p>
              </div>
              <div class="iv-ritmo-tabs" data-pos="${periodoRitmoInicio === 30 ? "1" : "0"}" role="group" aria-label="Período de ritmo comercial">
                <span class="iv-seg-slider es-ritmo" aria-hidden="true"></span>
                <button type="button" class="iv-ritmo-btn${periodoRitmoInicio === 7 ? " active" : ""}" data-iv-ritmo="7" aria-pressed="${periodoRitmoInicio === 7}">
                  <span class="iv-dot-ind" aria-hidden="true"></span><span>7d (${rv.ritmo.d7.pedidos})</span>
                </button>
                <button type="button" class="iv-ritmo-btn${periodoRitmoInicio === 30 ? " active" : ""}" data-iv-ritmo="30" aria-pressed="${periodoRitmoInicio === 30}">
                  <span class="iv-dot-ind" aria-hidden="true"></span><span>30d (${rv.ritmo.d30.pedidos})</span>
                </button>
              </div>
            </div>
            <div class="iv-ritmo-cuerpo" id="ivRitmoCuerpo">
              <div class="iv-ritmo-hero">
                <div>
                  <span class="iv-sub-lbl">Total ventas (${periodoRitmoInicio} días)</span>
                  <strong class="iv-ritmo-total">${esc(formatoMonto(ritmoAct.totalUsd, "$"))}</strong>
                </div>
                <div class="iv-ritmo-ticket">
                  <span class="iv-sub-lbl">Ticket prom.</span>
                  <strong>${esc(formatoMonto(ritmoAct.ticketPromedioUsd, "$"))}</strong>
                </div>
              </div>
              <div class="iv-barra-bicolor" aria-label="Proporción BCV vs Efectivo">
                <div class="iv-barra-bcv" style="width:${ritmoAct.totalUsd > 0 ? ritmoAct.pctBcv : 50}%"></div>
                <div class="iv-barra-ef" style="width:${ritmoAct.totalUsd > 0 ? ritmoAct.pctEfectivo : 50}%"></div>
              </div>
              <div class="iv-desglose-grid">
                <div class="iv-sub-box es-bcv">
                  <span class="iv-sub-lbl">Divisas BCV (${ritmoAct.pctBcv}%)</span>
                  <strong class="iv-sub-val">${esc(formatoMonto(ritmoAct.bcvUsd, "$"))}</strong>
                </div>
                <div class="iv-sub-box es-efectivo">
                  <span class="iv-sub-lbl">Efectivo (${ritmoAct.pctEfectivo}%)</span>
                  <strong class="iv-sub-val">${esc(formatoMonto(ritmoAct.efectivoUsd, "$"))}</strong>
                </div>
              </div>
            </div>
          </section>

          <section class="tarjeta iv-ana-card" id="ivAnaTopCobertura">
            <div class="iv-ana-head">
              <div>
                <h3 class="iv-ana-tit">Top 3 Productos y Cobertura</h3>
                <p class="ped-det">Últimos 30 días en $ · Clientes atendidos hoy</p>
              </div>
            </div>
            <div class="iv-cobertura-grid">
              <div class="iv-cob-pill">
                <span>En persona hoy</span>
                <strong>${cob.en_persona}</strong>
              </div>
              <div class="iv-cob-pill">
                <span>Online / Tel. hoy</span>
                <strong>${cob.online_telefono}</strong>
              </div>
            </div>
            ${topP.length
              ? `<ul class="iv-top-prods">${topP.map((pr, idx) => `
                <li class="iv-top-prod-item">
                  <span class="iv-top-rank">${idx + 1}</span>
                  <div class="iv-top-prod-info">
                    <strong>${esc(pr.producto)}</strong>
                    <span class="ped-det">${pr.cajas} caja${pr.cajas === 1 ? "" : "s"} · ${pr.pedidos} ped.</span>
                  </div>
                  <strong class="iv-top-prod-usd">${esc(formatoMonto(pr.totalUsd, "$"))}</strong>
                </li>`).join("")}</ul>`
              : `<p class="ped-det iv-vacio-chico">Sin ventas registradas en los últimos 30 días.</p>`}
          </section>`;
      }

      if (tipoAnim === "modo" || tipoAnim === "alcance") {
        dispararAnim(modo === "vendedor" ? wrapVendedor : statsEl, "iv-vista-animando");
      } else if (tipoAnim === "ritmo") {
        dispararAnim($("ivRitmoCuerpo"), "iv-ritmo-animando");
      }

      // Actualizar lista inferior según alcance activo
      const todosPend = todosPedidos.filter((p) => p.estado === "pendiente");
      const misPend = uidFiltro ? todosPend.filter((p) => String(p.vendedor_id) === uidFiltro) : todosPend;
      const usarMios = r === "vendedor" || (modo === "vendedor" && alcance === "mios" && misPend.length > 0);
      const listaDest = (usarMios ? misPend : todosPend).slice(0, 5);
      const titEl = $("iListaTit");
      const ulEl = $("iLista");
      if (titEl && ulEl && !soloDespacha()) {
        titEl.textContent = listaDest.length ? (usarMios ? "Tus pedidos en proceso" : "Por aprobar") : "";
        ulEl.innerHTML = listaDest.map((p) => filaPedido(p)).join("");
      }
    };

    const switchEl = $("iSwitchRol");
    if (switchEl) {
      switchEl.addEventListener("click", (e) => {
        const bModo = e.target.closest("[data-inicio-modo]");
        if (bModo) {
          if (bModo.dataset.inicioModo === leerModoInicio()) {
            dispararAnim($("iEstadoVistaBanner"), "iv-banner-pulso");
            return;
          }
          try { sessionStorage.setItem(K_INICIO_MODO, bModo.dataset.inicioModo); } catch (_) {}
          pintarVistaVendedor("modo");
          return;
        }
        const bAlc = e.target.closest("[data-inicio-alcance]");
        if (bAlc) {
          if (bAlc.dataset.inicioAlcance === leerAlcanceInicio()) {
            dispararAnim($("iEstadoVistaBanner"), "iv-banner-pulso");
            return;
          }
          try { sessionStorage.setItem(K_INICIO_ALCANCE, bAlc.dataset.inicioAlcance); } catch (_) {}
          pintarVistaVendedor("alcance");
        }
      });
    }

    const wrapVendEl = $("iVendedorWrap");
    if (wrapVendEl) {
      wrapVendEl.addEventListener("click", (e) => {
        const bRitmo = e.target.closest("[data-iv-ritmo]");
        if (!bRitmo) return;
        const nuevoPer = Number(bRitmo.dataset.ivRitmo) === 30 ? 30 : 7;
        periodoRitmoInicio = nuevoPer;
        pintarVistaVendedor("ritmo");
      });
    }

    obtenerTasaBcv(hoyIso()).then((info) => {
      const el = $("chipTasaBcv");
      if (info && info.tasa > 0) {
        tasaActiva = info.tasa;
        if (el) el.textContent = `BCV: Bs ${formatoNumInput(info.tasa, true)} / $`;
        if (vigente() && datosListos) pintarVistaVendedor();
      }
    }).catch(() => {});

    if (vende() && !leerLS(K_COMISION_CFG, null)) {
      obtenerConfigComisiones(false).then((cfg) => {
        if (cfg && vigente()) {
          cfgComActual = cfg;
          if (datosListos) pintarVistaVendedor();
        }
      }).catch(() => {});
    }

    const abiertos = await api("pedidos", { dias: 60 });
    if (!vigente()) return;
    const c = { pendiente: 0, confirmado: 0, en_ruta: 0 };
    abiertos.pedidos.forEach((p) => { if (c[p.estado] !== undefined) c[p.estado] = (c[p.estado] || 0) + 1; });
    const tile = (n, t, h) => `<a class="stat" href="${h}"><strong>${n}</strong><span>${t}</span></a>`;
    let tiles = "";
    let destacados = [];
    let destacadoHtml = "";
    let cargaHtml = "";
    if (tiene("despachador")) {
      // Sus entregas (con varios roles, solo las asignadas a él)
      const mias = abiertos.pedidos.filter((p) => String(p.despachador_id) === String(u.id) && ["confirmado", "en_ruta"].includes(p.estado));
      const carga = totalCarga(mias);
      if (carga.cajas) {
        cargaHtml += `<section class="tarjeta carga-hoy"><p>Hoy tenés por entregar</p>
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
      const esGestion = r !== "vendedor";
      const [hoy, porCobrar, porConciliar, web] = await Promise.all([
        api("resumen", { dias: 1 }),
        api("pedidos", { por_cobrar: true }),
        esGestion ? api("pedidos", { por_conciliar: true }) : Promise.resolve({ pedidos: [] }),
        api("pedidosWeb").catch(() => ({ pedidos: [] })),
      ]);
      if (!vigente()) return;
      if (web.pedidos.length) {
        const n = web.pedidos.length;
        destacadoHtml += `<a class="tarjeta aviso-web-inicio" href="#/pedidos?tab=hacer" id="iWeb"><strong>${n} pedido${n === 1 ? "" : "s"} web</strong><span>${r === "vendedor" ? "Tus clientes los armaron en el catálogo: revisalos y envialos a Administración." : "Armados por clientes en el catálogo, esperando a su vendedor."}</span></a>`;
      }
      const vencidos = porCobrar.pedidos.filter((p) => { const ec = estadoCredito(p); return ec && (ec.nivel === "vencido" || ec.nivel === "muy_vencido"); }).length;
      const proximos = porCobrar.pedidos.filter((p) => { const ec = estadoCredito(p); return ec && ec.nivel === "proximo"; }).length;
      tiles = tile(hoy.total_pedidos, "pedidos hoy", "#/pedidos") + tile(hoy.total_cajas, "cajas hoy", "#/resumen") +
        tile(c.pendiente, r === "vendedor" ? "en proceso" : "por aprobar", r === "vendedor" ? "#/pedidos?tab=curso" : "#/pedidos?tab=hacer") +
        tile(c.confirmado + c.en_ruta, "en despacho", "#/pedidos?tab=curso") +
        `<a class="stat${vencidos ? " stat-alerta" : ""}" href="#/pedidos?tab=cobros&ver=cobrar"><strong>${vencidos}</strong><span>crédito vencido${proximos ? ` · ${proximos} por vencer` : ""}</span></a>` +
        (esGestion ? tile(porConciliar.pedidos.length, "por conciliar", "#/pedidos?tab=cobros&ver=conciliar") : tile(porCobrar.pedidos.length, "por cobrar", "#/pedidos?tab=cobros&ver=cobrar"));
      destacados = abiertos.pedidos.filter((p) => p.estado === "pendiente").slice(0, 5);
      $("iListaTit").textContent = destacados.length ? (r === "vendedor" ? "Tus pedidos en proceso" : "Por aprobar") : "";

      const mapaPed = {};
      abiertos.pedidos.concat(porCobrar.pedidos || []).forEach((p) => { if (p && p.id) mapaPed[p.id] = p; });
      todosPedidos = Object.values(mapaPed);
      listaPorCobrar = porCobrar.pedidos || [];
      datosListos = true;
    }
    $("iDestacado").innerHTML = destacadoHtml;
    const cargaFondoEl = $("iCargaFondo");
    if (cargaFondoEl) cargaFondoEl.innerHTML = cargaHtml;
    const bc = $("btnCargaTodo");
    if (bc) bc.addEventListener("click", () => { sessionStorage.removeItem(K_CARGA); ir("#/carga"); });
    $("iStats").innerHTML = tiles;
    $("iLista").innerHTML = destacados.map((p) => filaPedido(p)).join("");
    if (datosListos) pintarVistaVendedor();
  }

  /* ---------- Nuevo pedido: 2) productos (cuadrícula: tocar = sumar una caja) ---------- */
  let filtroNuevo = "todos", busquedaNuevo = "";
  const K_MAYOR = "skala_precio_mayor"; // excepción: precio al mayor con menos de 15 cajas
  const excepcionMayor = () => !!leerLS(K_MAYOR, false);
  /* Precios y existencias: lo guardado ya, y se actualiza por detrás */
  async function preciosYStock(alCambiar, alSumarProductos) {
    const guardado = SkalaAPI.catalogoGuardado();
    if (guardado) sumarProductosNuevos(guardado.productos);
    const mapa = SkalaAPI.preciosMapa(guardado);
    SkalaAPI.catalogo().then((d) => {
      if (d === guardado) return;
      // productos nuevos cargados en Inventario: se vuelve a dibujar la página
      if (sumarProductosNuevos(d.productos) && alSumarProductos) return alSumarProductos();
      if (alCambiar) alCambiar(SkalaAPI.preciosMapa(d));
    }).catch(() => {});
    return mapa;
  }
  let modoVentaNuevo = "caja"; // "caja" (por defecto) o "unidad" (cuando el grupo permite venta por unidad, arranca en 6 unidades)
  function vNuevoProductos(v, _p, q, vigente) {
    if (q && q.has("p")) return importarEnlace(q);
    iniciarCapturaGpsSilenciosa(); // calibra el GPS mientras elige productos (sugerencia de cliente cercano)
    const cli = clienteElegido(); // el cliente se selecciona después de elegir los productos (o antes desde Clientes)
    const g0 = SkalaAPI.catalogoGuardado();
    if (g0) sumarProductosNuevos(g0.productos);
    const esDist = typeof GRUPOS_DISTRIBUIDORA !== "undefined" && Array.isArray(GRUPOS_DISTRIBUIDORA);
    const productos = [...BANOS.map((p) => ({ ...p, tipo: p.tipo || "banos", grupo: p.grupoNombre || "Baño de crema 1 kg" })), ...KITS.map((p) => ({ ...p, tipo: "kits", grupo: "Kit shampoo + acond." }))];
    const cfgGrupos = leerConfigGrupos();
    const permiteUnidades = Object.values(cfgGrupos).some((g) => g && g.permite_unidad) || Object.values(leerModalidadVentaMap()).some((m) => m === "unidad" || m === "ambos");
    if (!permiteUnidades) modoVentaNuevo = "caja";
    let precios = {};
    const pestanasFiltroNuevo = esDist
      ? [
          ["todos", "Todos"],
          ["Detergentes", "Detergentes"],
          ["Suavizantes", "Suavizantes"],
          ["Cuidado Personal", "Cuidado Personal"],
          ["Bebé y Pañales", "Bebé y Pañales"],
          ["Hogar y Papel", "Hogar y Papel"],
          ["Skala", "Skala"],
          ["elegidos", "Elegidos"],
        ]
      : [
          ["todos", "Todos"],
          ["banos", "Baños 1 kg"],
          ["kits", "Kits Dúo"],
          ["Hidratación", "Hidratación"],
          ["Nutrición", "Nutrición"],
          ["Reconstrucción", "Reconstrucción"],
          ["Definición", "Definición"],
          ["elegidos", "Elegidos"],
        ];
    v.innerHTML = `${pasos(1)}${avisoWeb()}
      <div class="cat-hero-panel">
        <div class="cat-hero-txt">
          <span class="cat-eyebrow">Distribuciones Ontiveros · ${esDist ? "Catálogo General" : "División Skala Brasil"}</span>
          <h3>Elegí los productos del pedido</h3>
          <p>Tocá cualquier tarjeta o usá <strong>+</strong> para sumar cajas. Después seleccionás el cliente.</p>
        </div>
        ${cli ? `<a class="cliente-elegido" href="#/nuevo/cliente"><span>Cliente</span><strong>${esc(cli.negocio || cli.contacto)}</strong><em>Cambiar</em></a>`
          : '<a class="cliente-elegido sin-cliente" href="#/nuevo/cliente"><span>Paso siguiente</span><strong>Seleccionar cliente después de elegir productos</strong><em>Elegir ya</em></a>'}
      </div>
      <div class="barra-buscador-vista">
        <div class="buscador"><input type="search" id="nBuscar" placeholder="🔍 Buscar producto, código, línea o beneficio…" autocomplete="off" enterkeyhint="search" value="${esc(busquedaNuevo)}" /></div>
        ${selectorVistaCatHTML()}
      </div>
      ${permiteUnidades ? `<div class="periodos periodos-chicos" id="nModoUnidad" role="group" aria-label="Modo de venta">
        <button type="button" class="tab${modoVentaNuevo === "caja" ? " active" : ""}" data-modo-u="caja">📦 Por Caja</button>
        <button type="button" class="tab${modoVentaNuevo === "unidad" ? " active" : ""}" data-modo-u="unidad">🧴 Por Unidad (mín. 6)</button>
      </div>` : ""}
      <div class="periodos" id="nFiltros">${pestanasFiltroNuevo.map(([k, t]) =>
        `<button type="button" class="tab${k === filtroNuevo ? " active" : ""}" data-f="${k}">${t}</button>`).join("")}</div>
      <p class="nota-chica nivel-aviso" id="nNivel" aria-live="polite"></p>
      <div class="progreso-mayor" id="nProgresoMayor"><div class="progreso-mayor-fill" id="nProgresoFill"></div></div>
      <ul class="grilla-prod grilla-catalogo-principal" id="nLista">${productos.map((p) => `
        <li class="pcard pcard-catalogo" data-code="${p.code}" data-tipo="${p.tipo}" data-linea="${esc(p.line || "")}" data-marca="${esc(p.marca || "")}" data-texto="${esc((p.name + " " + p.code + " " + (p.line || "") + " " + (p.marca || "") + " " + (p.benefit || "")).toLowerCase())}">
          <button type="button" class="pcard-tap" data-act="plus" aria-label="Sumar una caja de ${esc(p.name)}">
            <div class="pcard-img-wrap">
              ${fotoHTML(p.code, { ancho: 260, alto: 206 })}
              <span class="pcard-stock" data-stock></span>
            </div>
            <span class="pcard-line">${esc(p.line || p.grupo)}</span>
            <strong>${esc(p.name)}</strong>
            ${p.benefit ? `<span class="pcard-benefit">${esc(p.benefit)}</span>` : ""}
            <span class="pcard-meta">${!esDist && p.hair ? `<span class="pcard-hair">${esc(p.hair)} ${iconosCabelloHTML(p.hair)}</span> · ` : ""}${esc(textoUnidades(p))}</span>
            <span class="pcard-sub">Ref. ${p.code} · ${esc(textoUnidades(p))}</span>
            <span class="pcard-precio" data-precio></span>
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
        <a class="btn btn-primary" id="nSeguir" href="${cli ? "#/nuevo/enviar" : "#/nuevo/cliente"}">${cli ? "Continuar" : "Elegir cliente →"}</a>
      </div>`;
    const lista = $("nLista");
    enlazarSelectorVistaCat(v, lista);
    const pintar = () => {
      const c = carrito();
      const cliAct = clienteElegido();
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
      const progEl = $("nProgresoMayor");
      const fillEl = $("nProgresoFill");
      if (progEl && fillEl) {
        const pct = nivel === "mayor" ? 100 : Math.min(100, Math.round((total / CAJAS_MAYOR) * 100));
        fillEl.style.width = `${pct}%`;
        progEl.classList.toggle("completo", nivel === "mayor" || total >= CAJAS_MAYOR);
      }
      const btnSeguir = $("nSeguir");
      btnSeguir.classList.toggle("is-disabled", !total);
      btnSeguir.setAttribute("aria-disabled", String(!total));
      btnSeguir.textContent = cliAct ? "Continuar" : "Elegir cliente →";
      btnSeguir.setAttribute("href", cliAct ? "#/nuevo/enviar" : "#/nuevo/cliente");
      $("nVaciar").hidden = !total;
      pintarNav("nuevo");
      filtrar();
    };
    const filtrar = () => {
      const q = busquedaNuevo.trim().toLowerCase();
      const c = carrito();
      let visibles = 0;
      lista.querySelectorAll(".pcard").forEach((li) => {
        const okF = filtroNuevo === "todos"
          || li.dataset.tipo === filtroNuevo
          || li.dataset.linea === filtroNuevo
          || li.dataset.marca === filtroNuevo
          || (filtroNuevo === "elegidos" && Number(c[li.dataset.code]) > 0);
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
      const mv = modoVentaProducto(code);
      const usaUnidad = mv === "unidad" || (mv === "ambos" && modoVentaNuevo === "unidad");
      const salto = b.dataset.act === "plus" ? (usaUnidad && actual === 0 ? 6 : 1) : -1;
      fijar(code, actual + salto);
      if (b.dataset.act === "plus") { li.classList.remove("pulso"); void li.offsetWidth; li.classList.add("pulso"); }
    });
    lista.addEventListener("focusin", (e) => {
      if (e.target.classList.contains("qty-input") && modoVentaNuevo === "unidad") {
        const li = e.target.closest(".pcard");
        const code = li && li.dataset.code;
        if (code && !(Number(carrito()[code]) > 0)) {
          e.target.value = "6";
          fijar(code, 6);
          setTimeout(() => { try { e.target.select(); } catch (_) {} }, 0);
        }
      }
    });
    const elModoU = $("nModoUnidad");
    if (elModoU) {
      elModoU.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-modo-u]");
        if (!btn) return;
        modoVentaNuevo = btn.dataset.modoU === "unidad" ? "unidad" : "caja";
        elModoU.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === btn));
        toast(modoVentaNuevo === "unidad" ? "Modo Por Unidad activo: empieza en 6 unidades por defecto" : "Modo Por Caja activo");
      });
    }
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
      if (await hoja({ titulo: "¿Vaciar el pedido?", cuerpo: '<p class="modal-sub">Se quitan todos los productos elegidos.</p>', ok: "Vaciar" })) { guardarCarrito({}); guardarLS(K_MAYOR, false); borrarLS(K_PRECIOS_MANUAL); pintar(); }
    });
    $("nSeguir").addEventListener("click", (e) => {
      e.preventDefault();
      if (!cajasCarrito()) {
        toast("Elegí al menos un producto del catálogo para continuar.");
        return;
      }
      if (!clienteElegido()) {
        ir("#/nuevo/cliente");
        return;
      }
      ir("#/nuevo/enviar");
    });
    enlazarAvisoWeb();
    return preciosYStock((m) => { if (vigente() && $("nLista") === lista) { precios = m; pintar(); } }, () => { if (vigente() && $("nLista") === lista) render(); })
      .then((m) => { precios = m; pintar(); });
  }

  /* ---------- Nuevo pedido: pasos ---------- */
  /* Pasos: 1 Productos (Catálogo) → 2 Cliente → 3 Enviar */
  function pasos(n) {
    const listo = [cajasCarrito() > 0, !!clienteElegido()];
    const p = [["#/nuevo", "Productos"], ["#/nuevo/cliente", "Cliente"], ["#/nuevo/enviar", "Enviar"]];
    return `<ol class="pasos">${p.map(([h, t], i) => {
      const cls = [i + 1 === n ? "actual" : "", i < 2 && listo[i] ? "hecho" : ""].filter(Boolean).join(" ");
      return `<li class="${cls}" data-paso="${i + 1}"><a href="${h}"${i === 2 ? " data-enviar" : ""}${i + 1 === n ? ' aria-current="step"' : ""}><b>${i < 2 && listo[i] && i + 1 !== n ? "✓" : i + 1}</b>${t}</a></li>`;
    }).join("")}</ol>`;
  }
  /* Ir a Enviar: si falta los productos o el cliente, se marca en rojo lo que falta y en verde lo que está */
  function irAEnviar() {
    const falta = [];
    if (!cajasCarrito()) falta.push(1);
    if (!clienteElegido()) falta.push(2);
    if (!falta.length) return ir("#/nuevo/enviar");
    document.querySelectorAll(".pasos li[data-paso]").forEach((li) => {
      const k = Number(li.dataset.paso);
      if (k === 3) return;
      li.classList.remove("falta-anim", "ok-anim");
      void li.offsetWidth;
      li.classList.add(falta.includes(k) ? "falta-anim" : "ok-anim");
    });
    toast(falta.length === 2 ? "Falta elegir los productos y el cliente." : falta[0] === 1 ? "Falta elegir los productos." : "Falta elegir el cliente.");
    if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) {}
  }
  /* Cliente del pedido en curso (guardado en el teléfono). _listo = ya elegido/confirmado */
  const clienteElegido = () => { const c = leerLS(K_CLIENTE, null); return c && c._listo ? c : null; };
  const fijarCliente = (c) => guardarLS(K_CLIENTE, { ...c, _listo: true });

  function fichaCliente(c) {
    const mapa = linkMapa(c.latitud, c.longitud);
    const ruta = rutaDeCliente(c);
    return `<section class="tarjeta ficha-cli" id="fichaCli">
      <div class="fila-top">
        <div>
          <h2 class="ped-titulo">${esc(c.negocio || c.contacto)}</h2>
          ${c.negocio && c.contacto ? `<p class="ped-det">${esc(c.contacto)}</p>` : ""}
          <span class="chip-ruta-cli ruta-${slugRuta(ruta)}" style="margin-top:4px">📍 Ruta: ${esc(ruta)}</span>
        </div>
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
  const TEXTOS_CANAL_ALTA = {
    en_persona: "📍 En persona (Estoy en el local · Guardar GPS automático)",
    online_telefono: "📱 Online / Por teléfono (Sin ubicación GPS)",
  };
  /* Alta de cliente: "en persona" rellena latitud/longitud con la lectura GPS (o la toma al instante);
     "online" las limpia para no guardar jamás la ubicación de la casa/oficina del vendedor. */
  function enlazarCanalAlta(nombreRadio, latEl, lngEl, botonGps, pintar) {
    const radios = document.querySelectorAll(`input[name="${nombreRadio}"]`);
    radios.forEach((rd) => rd.addEventListener("change", () => {
      if (!rd.checked) return;
      if (rd.value === "online_telefono") { latEl.value = ""; lngEl.value = ""; pintar(); return; }
      const f = fixVigente();
      if (f) { latEl.value = r6(f.lat).toFixed(6); lngEl.value = r6(f.lng).toFixed(6); pintar(f.accuracy); }
      else if (botonGps) tomarGps(botonGps, (lat, lng, prec) => { latEl.value = lat; lngEl.value = lng; pintar(prec); });
    }));
    const marcarListo = () => {
      const el = document.querySelector("[data-canal-gps]");
      if (el && fixVigente()) el.textContent = `📡 GPS listo (±${Math.round(fixVigente().accuracy || 0)} m)`;
      const sel = document.querySelector(`input[name="${nombreRadio}"]:checked`);
      if (sel && sel.value === "en_persona" && !latEl.value && fixVigente()) {
        latEl.value = r6(fixVigente().lat).toFixed(6); lngEl.value = r6(fixVigente().lng).toFixed(6); pintar(fixVigente().accuracy);
      }
    };
    document.addEventListener("skala:gps", marcarListo);
    window.addEventListener("hashchange", () => document.removeEventListener("skala:gps", marcarListo), { once: true });
  }
  function formCliente(c) {
    const val = (k) => esc((c && c[k]) ?? "");
    const rutaAct = c ? rutaDeCliente(c) : "Vigía";
    return `<form class="tarjeta" id="fCli" novalidate>
      <h3 class="sub-titulo">${c && c.id ? "Editar datos del cliente" : "Cliente nuevo"}</h3>
      <div class="form-grid">
        <label class="field"><span>Nombre del negocio</span><input id="cNegocio" type="text" autocomplete="off" autocapitalize="words" enterkeyhint="next" placeholder="Peluquería / tienda" value="${val("negocio")}" /></label>
        <label class="field"><span>Nombre del cliente</span><input id="cContacto" type="text" autocomplete="off" autocapitalize="words" enterkeyhint="next" placeholder="Persona de contacto" value="${val("contacto")}" /></label>
        <label class="field"><span>Ruta asignada</span>
          <select id="cRuta">${RUTAS_CARTERA.map((r) => `<option value="${esc(r)}"${r === rutaAct ? " selected" : ""}>📍 ${esc(r)}</option>`).join("")}</select>
        </label>
        <label class="field"><span>RIF / Cédula</span><input id="cRif" type="text" autocomplete="off" autocapitalize="characters" enterkeyhint="next" placeholder="J-12345678-9" value="${val("rif_cedula")}" /></label>
        <label class="field"><span>Teléfono 1 *</span><input id="cTel1" type="tel" inputmode="tel" autocomplete="off" enterkeyhint="next" placeholder="0412-1234567" value="${val("telefono")}" /></label>
        <label class="field"><span>Teléfono 2</span><input id="cTel2" type="tel" inputmode="tel" autocomplete="off" enterkeyhint="next" placeholder="Opcional" value="${val("telefono2")}" /></label>
        <label class="field field-full"><span>Dirección</span><textarea id="cDireccion" class="dir-texto" rows="1" autocomplete="off" enterkeyhint="done" placeholder="Dirección de entrega">${val("direccion")}</textarea></label>
      </div>
      <div class="gps-box">
        ${c && c.id ? "" : fieldsetCanalHTML("cCanalAltaFs", "cCanalAlta", "¿Dónde estás registrando a este cliente? *", "online_telefono", TEXTOS_CANAL_ALTA)}
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

  /* -------------------- GPS silencioso (segundo plano) y canal de atención -------------------- */
  /* Lectura que NO bloquea la pantalla: al entrar a Nuevo pedido, Cliente, Alta de cliente o Cobrar.
     Solo se usa para sugerir clientes cercanos (<= 120 m), el canal "en persona" y aprender el GPS
     de un cliente que no lo tenía. Nunca se guarda como ubicación de un cliente atendido online. */
  let ultimoFixGps = null; // { lat, lng, accuracy, ts }
  let gpsLeyendo = false;
  const r6 = (n) => Math.round(Number(n) * 1e6) / 1e6;
  function iniciarCapturaGpsSilenciosa() {
    if (gpsLeyendo || !navigator.geolocation) return;
    if (ultimoFixGps && Date.now() - ultimoFixGps.ts < 20000) return;
    gpsLeyendo = true;
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          gpsLeyendo = false;
          const { latitude, longitude, accuracy } = pos.coords;
          if (!gpsValido(latitude, longitude)) return;
          ultimoFixGps = { lat: latitude, lng: longitude, accuracy: Number(accuracy) || 0, ts: Date.now() };
          document.dispatchEvent(new CustomEvent("skala:gps", { detail: ultimoFixGps }));
        },
        () => { gpsLeyendo = false; },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 20000 });
    } catch (e) { gpsLeyendo = false; }
  }
  /* Lectura todavía útil (10 min) */
  const fixVigente = () => (ultimoFixGps && Date.now() - ultimoFixGps.ts < 10 * 60000 ? ultimoFixGps : null);
  /* Campos gps_* para el servidor (y la distancia al cliente si tiene GPS) */
  function datosGpsEnvio(cli) {
    const c = cli || {};
    const f = gpsValido(c._gps_lat, c._gps_lng) ? { lat: Number(c._gps_lat), lng: Number(c._gps_lng) } : fixVigente();
    if (!f) return {};
    const out = { gps_lat: r6(f.lat), gps_lng: r6(f.lng) };
    if (Number(c._gps_dist_m) >= 0 && c._gps_dist_m !== undefined && c._gps_dist_m !== "") out.gps_dist_m = Math.round(Number(c._gps_dist_m));
    else if (gpsValido(c.latitud, c.longitud)) out.gps_dist_m = Math.round(haversineM(f.lat, f.lng, Number(c.latitud), Number(c.longitud)));
    return out;
  }
  /* Cartera con coordenadas para la cercanía: memoria → datos del teléfono */
  let carteraMem = [];
  const carteraGps = () => {
    if (carteraMem.length) return carteraMem;
    const d = SkalaAPI.datosLocales();
    return d && Array.isArray(d.clientes) ? d.clientes : [];
  };
  async function cargarCarteraGps() {
    try {
      const r = await api("clientes", { q: "", limite: 200 });
      if (Array.isArray(r.clientes) && r.clientes.length) carteraMem = r.clientes;
    } catch (e) {}
    return carteraGps();
  }
  /* Clientes ya atendidos en persona hoy (para no sugerirlos primero) */
  const K_VISITADOS_HOY = "skala_visitados_hoy_v1";
  const hoyCaracas = () => new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10); // mismo día que el servidor (Caracas)
  function visitadosHoy() {
    const v = leerLS(K_VISITADOS_HOY, null);
    const ids = v && v.fecha === hoyCaracas() && Array.isArray(v.ids) ? v.ids.slice() : [];
    const d = SkalaAPI.datosLocales();
    ((d && d.visitas) || []).forEach((x) => { if (x.fecha === hoyCaracas() && x.canal === "en_persona" && !x.anulada) ids.push(String(x.cliente_id)); });
    return ids;
  }
  function marcarVisitadoHoy(id) {
    if (!id) return;
    const ids = visitadosHoy();
    if (!ids.includes(String(id))) ids.push(String(id));
    guardarLS(K_VISITADOS_HOY, { fecha: hoyCaracas(), ids });
  }
  /* Selector binario de canal (las 2 únicas opciones del sistema) */
  function fieldsetCanalHTML(id, nombre, leyenda, preseleccion, textos = {}) {
    return `<fieldset class="pay canal-atencion" id="${id}"><legend>${esc(leyenda)}</legend>
      ${CANALES_ATENCION.map((c) => `<label class="pay-opt canal-opt canal-${c.id}"><input type="radio" name="${nombre}" value="${c.id}"${c.id === preseleccion ? " checked" : ""} /> ${esc(textos[c.id] || c.nombre)}</label>`).join("")}
      <p class="nota-chica canal-gps-estado" data-canal-gps>${fixVigente() ? `📡 GPS listo (±${Math.round(fixVigente().accuracy || 0)} m)` : "📡 Buscando tu ubicación en segundo plano…"}</p>
    </fieldset>`;
  }
  /* Si el cliente estaba en la ruta GPS de hoy (GPS-Clientes), se marca solo. Silencioso: sin señal o sin misión no pasa nada. */
  function avisarAtencion(clienteId, canal, tipo, extra = {}) {
    if (!clienteId || !canalValido(canal)) return;
    if (canal === "en_persona") marcarVisitadoHoy(clienteId);
    if (!SkalaAPI.gpsDb) return;
    const f = canal === "en_persona" ? fixVigente() : null;
    SkalaAPI.gpsDb({
      action: "registrar_visita", origen: "crm", cliente_id: String(clienteId), vendedor_id: yo().id, canal,
      motivo: `${tipo}_${canal === "en_persona" ? "en_persona" : "online"}`,
      ...(f ? { latitud: r6(f.lat), longitud: r6(f.lng) } : {}), ...extra,
    }).catch(() => {});
  }

  /* ---------- Nuevo pedido desde el "Código de pedido para vendedor" (WhatsApp) ----------
     #/nuevo?p=BC-01:3,KT-02:5&pago=credito&ref=WEB-AB12CD&tel=584121234567
     Carga las cantidades en el carrito y sigue con la selección del cliente. */
  async function importarEnlace(q) {
    const map = allProductsMap();
    const nuevo = {}, desconocidos = [];
    String(q.get("p") || "").split(",").forEach((par) => {
      const i = par.lastIndexOf(":");
      if (i < 1) return;
      const code = par.slice(0, i).trim().toUpperCase();
      const cajas = Math.floor(Number(par.slice(i + 1)));
      if (!(cajas > 0 && cajas <= 9999)) return;
      if (map[code]) nuevo[code] = (nuevo[code] || 0) + cajas; else desconocidos.push(code);
    });
    const seguir = () => location.replace("#/nuevo/cliente");
    if (!Object.keys(nuevo).length) { toast("El código de pedido no trae productos válidos."); return location.replace("#/nuevo"); }
    const aMedias = cajasCarrito() > 0 || clienteElegido() || tomandoWeb();
    if (aMedias) {
      const ok = await hoja({ titulo: "¿Reemplazar el pedido actual?", cuerpo: '<p class="modal-sub">Tenés un pedido a medias en este teléfono. ¿Querés reemplazarlo por el que llegó por WhatsApp?</p>', ok: "Reemplazar" });
      if (!ok) return seguir();
    }
    guardarCarrito(nuevo);
    guardarLS(K_MAYOR, false);
    borrarLS(K_PRECIOS_MANUAL);
    borrarLS(K_CLIENTE);
    borrarLS(K_WEB);
    const pago = q.get("pago") || "";
    const tel = String(q.get("tel") || "").replace(/\D/g, "").slice(0, 15);
    guardarLS(K_ENLACE, { ref: String(q.get("ref") || "").slice(0, 20), tipo_pago: pagoPorId(pago) ? pago : "", tel });
    // si el enlace también trae datos completos del cliente, dejarlo elegido de una vez
    const cEnlace = {
      id: q.get("cid") || undefined,
      negocio: (q.get("neg") || "").trim(),
      contacto: (q.get("con") || "").trim(),
      rif_cedula: (q.get("rif") || "").trim(),
      telefono: tel ? tel.replace(/^58/, "0") : "",
      direccion: (q.get("dir") || "").trim(),
      latitud: q.get("lat") || "",
      longitud: q.get("lng") || "",
    };
    if (!validarCliente(cEnlace).length) fijarCliente(cEnlace);
    const total = Object.values(nuevo).reduce((a, b) => a + b, 0);
    toast(`Pedido cargado: ${total} caja${total === 1 ? "" : "s"}` + (desconocidos.length ? ` · no existen: ${desconocidos.join(", ")}` : ""));
    seguir();
  }

  /* ---------- Nuevo pedido: 2) cliente (se elige después de los productos) ---------- */
  function vNuevoCliente(v, _p, q) {
    if (q && q.has("p")) return importarEnlace(q);
    iniciarCapturaGpsSilenciosa();
    let modo = clienteElegido() ? "ficha" : "buscar"; // buscar · ficha · form
    let enEdicion = null;
    /* Clientes detectados en mi ubicación (<= 120 m): 1 toque = cliente elegido + "en persona" */
    const pintarSugeridosGps = () => {
      const caja = $("cSugeridosGps");
      if (!caja) return;
      const f = fixVigente();
      const cerca = f ? clientesCercanos(carteraGps(), f, { radio: RADIO_CERCANIA_M, max: 3, visitadosHoy: visitadosHoy() }) : [];
      if (!cerca.length) { caja.innerHTML = ""; caja.hidden = true; return; }
      caja.hidden = false;
      caja.innerHTML = `<p class="sug-gps-tit">📍 Clientes detectados en tu ubicación (1 toque):</p>
        <div class="sug-gps-lista">${cerca.map((x, i) => `<button type="button" class="btn btn-ghost sug-gps-btn" data-sug="${i}">🎯 ${esc(x.cliente.nombre)} · a ${Math.round(x.dist)} m</button>`).join("")}</div>`;
      caja.onclick = (e) => {
        const b = e.target.closest("[data-sug]");
        if (!b) return;
        const { cliente: c, dist } = cerca[Number(b.dataset.sug)];
        const fx = fixVigente() || f;
        fijarCliente({ id: c.id, negocio: c.nombre, contacto: c.contacto, rif_cedula: c.rif_cedula, telefono: c.telefono, telefono2: c.telefono2,
          direccion: c.direccion, latitud: c.latitud, longitud: c.longitud, ruta: rutaDeCliente(c),
          _canal_atencion: "en_persona", _gps_en_sitio: true, _gps_lat: r6(fx.lat), _gps_lng: r6(fx.lng), _gps_dist_m: Math.round(dist) });
        // avanza solo: con productos → enviar; sin productos → catálogo
        if (cajasCarrito() > 0) ir("#/nuevo/enviar"); else { toast(`Cliente: ${c.nombre}. Ahora elegí los productos.`); ir("#/nuevo"); }
      };
    };
    const alGps = () => { if (modo === "buscar") pintarSugeridosGps(); };
    document.addEventListener("skala:gps", alGps);
    window.addEventListener("hashchange", () => document.removeEventListener("skala:gps", alGps), { once: true });
    const pintar = () => {
      const cli = clienteElegido();
      const nCajas = cajasCarrito();
      if (modo === "ficha" && !cli) modo = "buscar";
      if (modo === "buscar") {
        v.innerHTML = `${pasos(2)}
          ${nCajas > 0
            ? `<a class="cliente-elegido" href="#/nuevo"><span>Pedido</span><strong>${nCajas} caja${nCajas === 1 ? "" : "s"} seleccionada${nCajas === 1 ? "" : "s"}</strong><em>Ver productos</em></a>`
            : `<a class="cliente-elegido sin-cliente" href="#/nuevo"><span>Catálogo</span><strong>Todavía no elegiste productos</strong><em>Ir al catálogo</em></a>`}
          <div id="cSugeridosGps" class="sug-gps" data-gps-slot="clientes-cercanos" hidden></div>
          <div class="buscador"><input type="search" id="cBuscar" placeholder="Buscar cliente por nombre, ruta o teléfono" autocomplete="off" enterkeyhint="search" /></div>
          <ul class="lista-cli" id="cResultados"></ul>
          <p class="o-separador"><span>o</span></p>
          <button type="button" class="btn btn-primary btn-bloque" id="btnClienteNuevo">＋ Cliente nuevo</button>`;
        let t = null, ultimaQ = "";
        const pintarResultados = (listaCli, buscado) => {
          const ul = $("cResultados");
          if (!ul) return;
          if (!listaCli.length) {
            ul.innerHTML = buscado ? '<li class="vacio-panel">No está registrado. Tocá <strong>Cliente nuevo</strong>.</li>' : "";
            return;
          }
          ul.innerHTML = listaCli.map((c, i) => {
            const ruta = rutaDeCliente(c);
            return `<li><button type="button" class="res-cli res-cli-ruta" data-i="${i}">
              <div class="cli-fila-compacta">
                <strong class="cli-item-nombre">${esc(c.nombre)}</strong>
                <span class="chip-ruta-cli ruta-${slugRuta(ruta)}">📍 ${esc(ruta)}</span>
              </div>
            </button></li>`;
          }).join("");
          ul.onclick = (e) => {
            const b = e.target.closest("[data-i]");
            if (!b) return;
            const c = listaCli[Number(b.dataset.i)];
            fijarCliente({ id: c.id, negocio: c.nombre, contacto: c.contacto, rif_cedula: c.rif_cedula, telefono: c.telefono, telefono2: c.telefono2, direccion: c.direccion, latitud: c.latitud, longitud: c.longitud, ruta: rutaDeCliente(c) });
            modo = "ficha"; pintar();
          };
        };
        // Mostrar cartera inicial para selección rápida a 1 toque
        pintarSugeridosGps();
        cargarCarteraGps().then(() => { if (modo === "buscar") pintarSugeridosGps(); });
        api("clientes", { q: "", limite: 30 }).then((r0) => {
          if ($("cBuscar") && !$("cBuscar").value.trim()) pintarResultados(r0.clientes || [], false);
        }).catch(() => {});
        $("cBuscar").addEventListener("input", () => {
          clearTimeout(t);
          const q = $("cBuscar").value.trim();
          if (q.length < 1) {
            api("clientes", { q: "", limite: 30 }).then((r0) => pintarResultados(r0.clientes || [], false)).catch(() => {});
            return;
          }
          $("cResultados").innerHTML = `<li>${spin("Buscando cliente…")}</li>`;
          t = setTimeout(async () => {
            ultimaQ = q;
            try {
              const r = await api("clientes", { q: q.length >= 2 ? q : "", limite: 60 });
              if (q !== ultimaQ || !$("cResultados")) return;
              const qNorm = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const filtrados = (r.clientes || []).filter((c) => {
                const txt = `${c.nombre || ""} ${c.contacto || ""} ${c.telefono || ""} ${rutaDeCliente(c)}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return txt.includes(qNorm);
              });
              pintarResultados(filtrados, true);
            } catch (e) {
              if ($("cResultados")) $("cResultados").innerHTML = `<li class="vacio-panel">${esc(e instanceof ErrorRed ? "Sin señal para buscar. Podés cargarlo como Cliente nuevo." : e.message)}</li>`;
            }
          }, 250);
        });
        $("btnClienteNuevo").addEventListener("click", () => { enEdicion = null; modo = "form"; pintar(); });
        // pedido que llegó por WhatsApp con el teléfono del cliente: buscarlo una vez
        const enl = leerLS(K_ENLACE, null);
        if (enl && enl.tel && !enl.buscado) {
          guardarLS(K_ENLACE, { ...enl, buscado: true });
          $("cBuscar").value = enl.tel.replace(/^58/, "0");
          $("cBuscar").dispatchEvent(new Event("input"));
        }
        return;
      }
      if (modo === "ficha") {
        v.innerHTML = `${pasos(2)}${avisoWeb()}${fichaCliente(cli)}
          <div class="barra-accion">
            <button type="button" class="btn btn-ghost" id="btnCambiarCli">Cambiar cliente</button>
            <a class="btn ${nCajas > 0 ? "btn-ghost" : "btn-primary"}" href="#/nuevo" id="btnAProductos">${nCajas > 0 ? `Productos (${nCajas})` : "Elegir productos"}</a>
            ${nCajas > 0 ? '<a class="btn btn-primary" href="#/nuevo/enviar" id="btnAEnviar">Continuar a enviar →</a>' : ""}
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
      v.innerHTML = pasos(2) + formCliente(enEdicion);
      const pintarGps = (prec) => {
        const lat = $("cLat").value, lng = $("cLng").value;
        $("gpsEstado").innerHTML = lat && lng
          ? `Ubicación lista${prec ? ` (±${Math.round(prec)} m)` : ""} · <a href="${esc(linkMapa(lat, lng))}" target="_blank" rel="noopener">ver mapa</a>`
          : "Sin ubicación";
        $("btnGps").textContent = lat && lng ? "Volver a tomar ubicación" : "Tomar ubicación GPS del cliente";
      };
      pintarGps();
      $("btnGps").addEventListener("click", () => tomarGps($("btnGps"), (lat, lng, prec) => {
        $("cLat").value = lat; $("cLng").value = lng;
        const rd = document.querySelector('input[name="cCanalAlta"][value="en_persona"]');
        if (rd) rd.checked = true;
        pintarGps(prec);
      }));
      if (!(enEdicion && enEdicion.id)) enlazarCanalAlta("cCanalAlta", $("cLat"), $("cLng"), $("btnGps"), pintarGps);
      $("btnCliVolver").addEventListener("click", () => { modo = enEdicion || clienteElegido() ? "ficha" : "buscar"; pintar(); });
      $("fCli").addEventListener("input", () => { $("cError").hidden = true; });
      $("cNegocio").focus();
      $("fCli").addEventListener("submit", async (e) => {
        e.preventDefault();
        const rutaElegida = $("cRuta") ? $("cRuta").value : "Vigía";
        const c = {
          id: enEdicion ? enEdicion.id : undefined,
          negocio: $("cNegocio").value.trim(), contacto: $("cContacto").value.trim(), rif_cedula: $("cRif").value.trim(),
          telefono: $("cTel1").value.trim(), telefono2: $("cTel2").value.trim(), direccion: $("cDireccion").value.trim(),
          latitud: $("cLat").value, longitud: $("cLng").value, ruta: rutaElegida,
        };
        const faltan = validarCliente(c);
        const canalAlta = (document.querySelector('input[name="cCanalAlta"]:checked') || {}).value || "";
        if (!c.id && !canalValido(canalAlta)) faltan.push("indicá si estás en el local (en persona) u online / por teléfono");
        if (faltan.length) { $("cError").textContent = "Falta: " + faltan.join(" · "); $("cError").hidden = false; return; }
        if (!c.id) {
          c._canal_atencion = canalAlta; // se pre-selecciona al enviar el pedido
          if (canalAlta === "online_telefono") { c.latitud = ""; c.longitud = ""; }
          else if (fixVigente()) { c._gps_lat = r6(fixVigente().lat); c._gps_lng = r6(fixVigente().lng); }
        }
        if (c.id) {
          guardarRutaCliente(c.id, rutaElegida);
          const b = $("btnCliUsar");
          b.disabled = true;
          try {
            const r = await api("guardarCliente", { cliente: c });
            guardarRutaCliente(r.cliente.id, rutaElegida);
            fijarCliente({ ...c, negocio: r.cliente.nombre, ruta: rutaElegida });
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
    const items = itemsDePedido(carrito(), allProductsMap());
    if (!cli || !items.length) {
      // se entró directo sin completar: volver al paso que falta y marcarlo
      ir(!items.length ? "#/nuevo" : "#/nuevo/cliente");
      setTimeout(irAEnviar, 80);
      return;
    }
    const total = items.reduce((a, it) => a + it.cajas, 0);
    const unidades = {};
    items.forEach((it) => { if (it.total_unidades) unidades[it.unidad] = (unidades[it.unidad] || 0) + it.total_unidades; });
    let precios = await preciosYStock((m) => { precios = m; if ($("fEnviar")) pintarPrecios(true); });
    const web = tomandoWeb();
    let manuales = preciosManuales();
    let usarManual = Object.keys(manuales).some((k) => Number(manuales[k]) > 0);
    v.innerHTML = `${pasos(3)}${avisoWeb()}
      <a class="cliente-elegido" href="#/nuevo/cliente"><span>Para</span><strong>${esc(cli.negocio || cli.contacto)}</strong><em>Cambiar</em></a>
      <section class="tarjeta">
        <div class="fila-top"><h3 class="sub-titulo">Productos</h3><a class="link-btn" href="#/nuevo">Cambiar</a></div>
        <ul class="resumen-items" id="eItems"></ul>
        <p class="total-ped"><strong>Total: ${total} caja${total === 1 ? "" : "s"}</strong> · ${Object.entries(unidades).map(([u, n]) => `${n} ${esc(u)}`).join(" + ")}</p>
        <p class="nota-chica" id="eNivel"></p>
        ${total < CAJAS_MAYOR ? `<label class="check excepcion" id="eMayorWrap"${usarManual ? " hidden" : ""}><input type="checkbox" id="eMayor"${excepcionMayor() ? " checked" : ""} /> Dar precio al mayor (excepción para este cliente)</label>` : ""}
        <label class="check excepcion"><input type="checkbox" id="ePersonalizado"${usarManual ? " checked" : ""} /> Precio personalizado por caja (acuerdo con el cliente)</label>
        <div id="eBoxPersonalizado" class="box-personalizado"${usarManual ? "" : " hidden"}>
          <div class="fila-precio-global">
            <label class="field"><span>Mismo precio por caja ($)</span>
              <input id="ePrecioTodos" type="text" inputmode="decimal" autocomplete="off" placeholder="ej. 18,50" />
            </label>
            <button type="button" class="btn btn-ghost btn-chico" id="btnPrecioTodos">Aplicar a todo</button>
          </div>
          <p class="nota-chica">O escribí el precio ($/caja) en cada producto arriba. El monto acordado queda fijo sin rebajas adicionales por forma de pago.</p>
        </div>
      </section>
      <form id="fEnviar" novalidate>
        ${fieldsetCanalHTML("fsCanal", "eCanal", "¿Cómo atendiste al cliente en este pedido? *", canalSugerido(cli, fixVigente(), carteraGps()) || "online_telefono")}
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
    const canalSel = () => (document.querySelector('input[name="eCanal"]:checked') || {}).value || "";
    iniciarCapturaGpsSilenciosa();
    // la lectura GPS llegó después de pintar: si nadie eligió todavía, aplicar la preselección inteligente
    const alGpsEnviar = () => {
      const el = document.querySelector("#fsCanal [data-canal-gps]");
      if (!el) return;
      if (fixVigente()) el.textContent = `📡 GPS listo (±${Math.round(fixVigente().accuracy || 0)} m)`;
      if (!canalSel()) {
        const sug = canalSugerido(cli, fixVigente(), carteraGps());
        const rd = sug && document.querySelector(`input[name="eCanal"][value="${sug}"]`);
        if (rd) rd.checked = true;
      }
    };
    document.addEventListener("skala:gps", alGpsEnviar);
    window.addEventListener("hashchange", () => document.removeEventListener("skala:gps", alGpsEnviar), { once: true });
    if (!carteraMem.length) cargarCarteraGps().then(alGpsEnviar);
    const pagoSel = () => (document.querySelector('input[name="ePago"]:checked') || {}).value || "";
    const esCredito = () => !!(pagoPorId(pagoSel()) || {}).credito;
    const mapaManualActivo = () => (usarManual ? manuales : null);
    const conPrecio = () => conPrecios(items, precios, nivelPrecio(total, excepcionMayor()), mapaManualActivo());
    /* Montos de cada forma de pago (ej. Crédito 100 · Pronto pago 90 · Efectivo a crédito 70 · Efectivo pronto pago 60) */
    function pintarPrecios(rearmarLista = true) {
      const its = conPrecio();
      const baseIts = conPrecios(items, precios, nivelPrecio(total, excepcionMayor()));
      const hayPrecio = its.some((it) => it.precio > 0);
      const tipo = pagoSel() || "credito";
      if (rearmarLista) {
        $("eItems").innerHTML = its.map((it, idx) => {
          const u = precioUnitario(it, tipo);
          const baseU = precioUnitario(baseIts[idx] || it, tipo);
          const valManual = manuales[it.code] !== undefined && manuales[it.code] > 0 ? String(manuales[it.code]) : "";
          return `<li class="con-foto${usarManual ? " con-precio-manual" : ""}">
            <span class="item-foto">${fotoHTML(it.code, { ancho: 42, alto: 42 })}</span>
            <span class="item-prod-txt"><strong>${it.cajas} × ${esc(it.producto)}</strong>${it.total_unidades ? ` <span class="ped-det">${it.total_unidades} ${esc(it.unidad)}</span>` : ""}</span>
            ${usarManual
              ? `<span class="caja-precio-manual"><label class="lbl-precio-caja"><span>$</span><input type="text" inputmode="decimal" autocomplete="off" class="inp-precio-caja" data-precio-code="${esc(it.code)}" value="${esc(valManual)}" placeholder="${baseU ? baseU.toFixed(2) : "0.00"}" aria-label="Precio por caja de ${esc(it.producto)}" /></label><em data-sub-code="${esc(it.code)}">${u ? `<strong>${dinero(it.cajas * u)}</strong>` : "sin precio"}</em></span>`
              : `<em class="item-precio-fijo">${it.precio ? `<span class="ped-det">${dinero(u)} c/u</span><strong>${dinero(it.cajas * u)}</strong>` : "sin precio"}</em>`}
          </li>`;
        }).join("");
      } else {
        its.forEach((it) => {
          const u = precioUnitario(it, tipo);
          const elSub = $("eItems").querySelector(`[data-sub-code="${it.code}"]`);
          if (elSub) elSub.innerHTML = u ? `<strong>${dinero(it.cajas * u)}</strong>` : "sin precio";
        });
      }
      const tieneManual = usarManual && its.some((it) => it.personalizado);
      const nivel = nivelPrecio(total, excepcionMayor());
      $("eNivel").textContent = tieneManual
        ? "Precio personalizado acordado con el cliente."
        : nivel === "mayor" ? (total >= CAJAS_MAYOR ? "Precio al mayor." : "Precio al mayor por excepción.") : `Precio al por menor (menos de ${CAJAS_MAYOR} cajas).`;
      const sel = pagoSel();
      $("ePagos").innerHTML = totalesPorPago(its).map((pg) => `<label class="pay-opt pago-opt">
          <input type="radio" name="ePago" value="${pg.id}"${pg.id === sel ? " checked" : ""} />
          <span class="pago-txt"><strong>${esc(pg.nombre)}</strong><span>${esc(pg.ayuda)}</span></span>
          ${hayPrecio ? `<span class="pago-monto"><strong>${dinero(pg.total)}</strong>${pg.ahorro ? `<span>−${dinero(pg.ahorro)}</span>` : ""}</span>` : ""}
        </label>`).join("") + (hayPrecio && sinPrecio(its).length ? `<p class="nota-chica">Sin precio cargado: ${esc(sinPrecio(its).join(", "))}.</p>` : "")
        + (hayPrecio ? "" : '<p class="nota-chica">Todavía no hay precios cargados para estos productos.</p>');
    }
    enlazarAvisoWeb();
    pintarPrecios(true);
    if (web && web.tipo_pago && !pagoSel()) {
      const r0 = document.querySelector(`input[name="ePago"][value="${web.tipo_pago}"]`);
      if (r0) { r0.checked = true; $("eCredito").hidden = !esCredito(); pintarPrecios(true); }
      if (web.nota && !$("eNota").value) $("eNota").value = `Pedido web ${web.id}: ${web.nota}`;
    }
    // pedido que llegó por WhatsApp ("Código de pedido para vendedor"): forma de pago y referencia
    const enl = web ? null : leerLS(K_ENLACE, null);
    if (enl) {
      if (enl.tipo_pago && !pagoSel()) {
        const r1 = document.querySelector(`input[name="ePago"][value="${enl.tipo_pago}"]`);
        if (r1) { r1.checked = true; $("eCredito").hidden = !esCredito(); pintarPrecios(true); }
      }
      if (enl.ref && !$("eNota").value) $("eNota").value = `Pedido por WhatsApp ${enl.ref}`;
    }
    $("fsPago").addEventListener("change", (e) => { if (e.target.name === "ePago") { $("eCredito").hidden = !esCredito(); $("fsPago").classList.remove("falta"); pintarPrecios(true); } });
    const may = $("eMayor");
    if (may) may.addEventListener("change", () => { guardarLS(K_MAYOR, may.checked); pintarPrecios(true); });
    $("ePersonalizado").addEventListener("change", (e) => {
      usarManual = e.target.checked;
      $("eBoxPersonalizado").hidden = !usarManual;
      if ($("eMayorWrap")) $("eMayorWrap").hidden = usarManual;
      if (!usarManual) { manuales = {}; guardarPreciosManuales({}); $("ePrecioTodos").value = ""; }
      pintarPrecios(true);
    });
    $("btnPrecioTodos").addEventListener("click", () => {
      const n = montoNum($("ePrecioTodos").value);
      if (!(n > 0)) return toast("Escribí un precio por caja válido (ej. 18,50).");
      items.forEach((it) => { manuales[it.code] = n; });
      guardarPreciosManuales(manuales);
      pintarPrecios(true);
      toast(`Precio de ${dinero(n)} por caja aplicado a todos los productos`);
    });
    $("ePrecioTodos").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("btnPrecioTodos").click(); } });
    $("eItems").addEventListener("input", (e) => {
      const inp = e.target.closest("[data-precio-code]");
      if (!inp) return;
      const code = inp.dataset.precioCode;
      const n = montoNum(inp.value);
      if (n > 0) manuales[code] = n; else delete manuales[code];
      guardarPreciosManuales(manuales);
      pintarPrecios(false);
    });
    $("eCredito").addEventListener("click", (e) => {
      const b = e.target.closest("[data-dias]");
      if (!b) return;
      $("eDias").value = b.dataset.dias;
      $("eCredito").querySelectorAll("[data-dias]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    });
    $("eDias").addEventListener("input", () => $("eCredito").querySelectorAll("[data-dias]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.dias === $("eDias").value))));
    $("fEnviar").addEventListener("input", () => { $("eError").hidden = true; });
    $("fsCanal").addEventListener("change", () => $("fsCanal").classList.remove("falta"));
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
      const canal = canalSel();
      if (!canalValido(canal)) { $("fsCanal").classList.add("falta"); return mostrar("Indicá cómo atendiste al cliente: 📍 En persona o 📱 Online / Por teléfono.", $("fsCanal")); }
      if (!d) { $("fsDoc").classList.add("falta"); return mostrar("Elegí si el cliente quiere nota de entrega o factura.", $("fsDoc")); }
      if (d === "Factura" && rif.replace(/\D/g, "").length < 6) return mostrar("Para factura hace falta el RIF o la cédula.", $("eRifWrap"));
      if (!pagoSel()) { $("fsPago").classList.add("falta"); return mostrar("Elegí la forma de pago.", $("fsPago")); }
      const dias = Math.floor(Number($("eDias").value));
      if (esCredito() && !(dias >= 1 && dias <= 180)) return mostrar("Indicá los días de crédito (1 a 180).", $("eCredito"));
      err.hidden = true;
      const { _listo, _canal_atencion, _gps_en_sitio, _gps_lat, _gps_lng, _gps_dist_m, ...cliente } = cli;
      if (d === "Factura") cliente.rif_cedula = rif;
      // GPS: en persona aprende la ubicación si el cliente no tenía; online JAMÁS usa la del vendedor
      const gps = datosGpsEnvio(cli);
      if (canal === "en_persona") {
        const apr = gpsAprendido(canal, cliente, gps.gps_lat !== undefined ? { lat: gps.gps_lat, lng: gps.gps_lng } : null);
        if (apr) { cliente.latitud = apr.latitud; cliente.longitud = apr.longitud; }
      } else if (gps.gps_lat !== undefined && gpsValido(cliente.latitud, cliente.longitud)
        && Math.abs(Number(cliente.latitud) - gps.gps_lat) < 1e-5 && Math.abs(Number(cliente.longitud) - gps.gps_lng) < 1e-5) {
        cliente.latitud = ""; cliente.longitud = "";
      }
      const its = itemsDePedido(carrito(), allProductsMap()).map((it) => {
        const pm = usarManual ? montoNum(manuales[it.code]) : 0;
        return pm > 0 ? { ...it, precio_manual: pm } : it;
      });
      const datos = { client_ref: nuevoRef(), cliente, items: its, documento: d,
        tipo_pago: pagoSel(), pago: pagoPorId(pagoSel()).nombre, precio_mayor: !usarManual && total < CAJAS_MAYOR && excepcionMayor(),
        dias_credito: esCredito() ? dias : 0, nota: $("eNota").value.trim(),
        canal_pedido: canal, ...gps };
      if (web) datos.web_id = web.id;
      const btn = $("btnEnviar");
      btn.disabled = true; btn.classList.add("ocupado"); btn.textContent = "Enviando…";
      const terminar = (listo) => {
        memoria.t = 0;
        guardarCarrito({});
        guardarLS(K_MAYOR, false);
        borrarLS(K_PRECIOS_MANUAL);
        borrarLS(K_WEB);
        borrarLS(K_ENLACE);
        borrarLS(K_CLIENTE);
        sessionStorage.setItem(K_LISTO, JSON.stringify(listo));
        ir("#/nuevo/listo");
      };
      try {
        const r = await api("guardarPedido", datos);
        const cid = (r.cliente && r.cliente.id) || r.cliente_id || cliente.id;
        avisarAtencion(cid, canal, "pedido", { pedido_id: r.pedido && r.pedido.id });
        terminar({ pedido: r.pedido, cliente: r.cliente || cliente, canal });
      } catch (e2) {
        btn.disabled = false; btn.classList.remove("ocupado"); btn.textContent = "Enviar pedido";
        if (e2 instanceof ErrorRed) { SkalaAPI.encolar(datos); if (canal === "en_persona") marcarVisitadoHoy(cliente.id); return terminar({ offline: true, cliente }); }
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
      </div>
      <button type="button" class="btn btn-ghost btn-bloque btn-corregir-cli" id="btnCorregirClientePed">🔄 ¿Te equivocaste de cliente? Cambiar cliente</button></div>`;
    $("btnGrupo").addEventListener("click", () => enviarAlGrupo(mensaje));
    $("btnCorregirClientePed").addEventListener("click", async () => {
      const rc = await corregirClientePedido(d.pedido);
      if (!rc) return;
      sessionStorage.setItem(K_LISTO, JSON.stringify({ ...d, pedido: { ...d.pedido, ...rc.pedido }, cliente: rc.cliente }));
      render();
    });
  }

  /* ¿Se equivocó de cliente? Elegir el correcto: el servidor pasa el pedido, anula la visita (y el GPS aprendido)
     del cliente equivocado y, si fue en persona, registra la visita en el correcto. Devuelve la respuesta o null. */
  async function corregirClientePedido(ped) {
    let lista = [];
    const pintarLista = (ul, clientes) => {
      lista = clientes.filter((c) => String(c.id) !== String(ped.cliente_id));
      ul.innerHTML = lista.length
        ? lista.map((c, i) => `<label class="pay-opt cc-opt"><input type="radio" name="cc_i" value="${i}" /> <span><strong>${esc(c.nombre)}</strong>${c.contacto ? ` <span class="ped-det">${esc(c.contacto)}</span>` : ""} <span class="chip-ruta-cli ruta-${slugRuta(rutaDeCliente(c))}">📍 ${esc(rutaDeCliente(c))}</span></span></label>`).join("")
        : '<p class="vacio-panel">Sin resultados. Probá con otro nombre o teléfono.</p>';
    };
    const r = await hoja({
      titulo: "🔄 Cambiar el cliente del pedido",
      cuerpo: `<p class="modal-sub">Pedido <strong>${esc(ped.id)}</strong> · ahora es de <strong>${esc(ped.negocio || "")}</strong>.
          Elegí el cliente correcto: la visita registrada por error se anula${ped.canal_pedido === "en_persona" ? " y la visita en persona pasa al cliente correcto" : ""}.</p>
        <div class="buscador"><input type="search" id="ccBuscar" placeholder="Buscar cliente por nombre, ruta o teléfono" autocomplete="off" enterkeyhint="search" /></div>
        <div class="cc-lista" id="ccLista" role="radiogroup" aria-label="Cliente correcto">${spin("Cargando clientes…")}</div>`,
      ok: "Cambiar cliente",
      alAbrir: () => {
        const ul = $("ccLista"), inp = $("ccBuscar");
        let t = null;
        const buscar = () => {
          const q = inp.value.trim();
          api("clientes", { q: q.length >= 2 ? q : "", limite: 40 }).then((x) => { if ($("ccLista")) pintarLista(ul, x.clientes || []); })
            .catch((e) => { if ($("ccLista")) ul.innerHTML = `<p class="vacio-panel">${esc(e.message)}</p>`; });
        };
        inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(buscar, 250); });
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(t); buscar(); } });
        buscar();
      },
      validar: (x) => (x.cc_i !== undefined && lista[Number(x.cc_i)] ? "" : "Elegí el cliente correcto de la lista."),
    });
    if (!r) return null;
    const elegido = lista[Number(r.cc_i)];
    try {
      const rc = await api("cambiarClientePedido", { pedido_id: ped.id, cliente_id: elegido.id });
      guardarEnMemoria(rc.pedido);
      // la marca "visitado hoy" y la ruta GPS siguen al cliente correcto
      if (canalValido(ped.canal_pedido) && SkalaAPI.gpsDb) {
        SkalaAPI.gpsDb({ action: "corregir_cliente_visita", origen: "crm", pedido_id: ped.id, cliente_id_anterior: String(ped.cliente_id),
          cliente_id_nuevo: String(elegido.id), canal: ped.canal_pedido, vendedor_id: yo().id }).catch(() => {});
      }
      if (ped.canal_pedido === "en_persona") marcarVisitadoHoy(elegido.id);
      toast(`Pedido pasado a ${elegido.nombre}${rc.visitas_anuladas ? " · visita anulada en el cliente equivocado" : ""}${rc.gps_revertido ? " · GPS revertido" : ""}`);
      return rc;
    } catch (e) {
      toast(e instanceof ErrorRed ? "Sin señal: probá de nuevo cuando vuelva la conexión." : e.message);
      return null;
    }
  }

  /* ---------- Pedidos / Entregas ---------- */
  /* Bandera de cobro: crédito por vencimiento, o estado del pago de un pedido entregado */
  function bandera(p) {
    if (p.cobro === "cancelado") return { clase: "por_conciliar", texto: "Cancelado · por conciliar" };
    if (p.cobro === "conciliado") return { clase: "pagado", texto: "Conciliado" };
    if (Number(p.pagos_pend) > 0) {
      const rest = Number(p.saldo) > 0 ? ` · resta ${dinero(p.saldo)}` : "";
      return { clase: "por_conciliar", texto: `Abono por conciliar${rest}` };
    }
    const ec = estadoCredito(p);
    if (ec) {
      const ab = Number(p.pagado_usd) > 0 && Number(p.saldo) > 0 ? ` · resta ${dinero(p.saldo)}` : "";
      return { clase: ec.nivel, texto: ec.texto + ab };
    }
    if (p.estado !== "entregado") return null;
    if (Number(p.pagado_usd) > 0 && Number(p.saldo) > 0) {
      return { clase: "por_cobrar", texto: `Abonado ${dinero(p.pagado_usd)} · resta ${dinero(p.saldo)}` };
    }
    return { clase: "por_cobrar", texto: "Por cobrar" };
  }
  const chipBandera = (p) => {
    if (!vende()) return ""; // el cobro no le corresponde al despachador
    const b = bandera(p);
    return b ? `<span class="bandera b-${esc(b.clase)}"><i aria-hidden="true"></i>${esc(b.texto)}</span>` : "";
  };

  /* Monto del pedido en la fila (lo acordado, o lo final si pagó distinto) */
  const montoFila = (p) => {
    if (!vende()) return "";
    const n = p.total_final !== "" && p.total_final != null ? Number(p.total_final) : Number(p.total);
    return n > 0 ? `<strong class="fila-monto">${esc(dinero(n))}</strong>` : "";
  };
  function filaPedido(p, elegible) {
    const r = enEntregas() ? "despachador" : rolPedidos();
    const extra = r === "vendedor" ? "" : r === "despachador" ? ((p.cliente_datos || {}).direccion || "") : `Vendedor: ${p.vendedor}`;
    const infoCobro = p.monto && p.cobro
      ? ` · cobrado <strong>${esc(formatoMonto(p.monto, p.moneda))}</strong>`
      : Number(p.pagado_usd) > 0 && !p.cobro
        ? ` · abonado <strong>${esc(dinero(p.pagado_usd))}</strong> (resta <strong>${esc(dinero(p.saldo))}</strong>)`
        : "";
    const tieneAbonoParcial = vende() && Number(p.pagado_usd) > 0 && Number(p.saldo) > 0 && !p.cobro;
    const pctAbono = tieneAbonoParcial
      ? Math.max(5, Math.min(95, Math.round((Number(p.pagado_usd) / (Number(p.pagado_usd) + Number(p.saldo))) * 100)))
      : 0;
    return `<li class="${elegible ? "con-check" : ""}">${elegible ? `<label class="check-ped"><input type="checkbox" value="${esc(p.id)}" aria-label="Elegir ${esc(p.negocio)} para la carga" /></label>` : ""}
      <a class="fila-ped est-borde-${esc(p.estado)}" href="#/pedido/${encodeURIComponent(p.id)}">
      <div class="fila-top"><strong>${esc(p.negocio)}</strong>${chipEstado(p.estado)}</div>
      <div class="fila-linea"><span class="ped-det">${esc(p.id)} · ${esc(fechaLegible(p.fecha))}</span>${montoFila(p)}</div>
      <div class="ped-det">${esc(p.total_cajas)} caja(s)${p.detalle_unidades ? " · " + esc(p.detalle_unidades) : ""}${infoCobro}</div>
      ${extra ? `<div class="ped-det">${esc(extra)}</div>` : ""}
      ${tieneAbonoParcial ? `<div class="abono-barra-mini" aria-hidden="true"><i style="width:${pctAbono}%"></i></div>` : ""}
      ${chipBandera(p)}
    </a></li>`;
  }

  /* ---------- Lista de pedidos en memoria: se muestra al instante y se actualiza por detrás ---------- */
  const memoria = { pedidos: null, web: null, t: 0, uid: "" };
  function pedidosEnMemoria() {
    // otro usuario en el mismo teléfono: empezar de cero
    if (memoria.uid !== yo().id) { memoria.pedidos = null; memoria.web = null; memoria.t = 0; memoria.uid = yo().id; }
    if (memoria.pedidos) return memoria.pedidos;
    const d = SkalaAPI.datosLocales();
    return d && Array.isArray(d.pedidos) ? d.pedidos : null;
  }
  async function refrescarPedidos() {
    const [r, w] = await Promise.all([
      api("pedidos", { dias: 90 }),
      vende() ? api("pedidosWeb").catch(() => ({ pedidos: memoria.web || [] })) : Promise.resolve({ pedidos: [] }),
    ]);
    memoria.pedidos = r.pedidos; memoria.web = w.pedidos; memoria.t = r.local ? 0 : Date.now();
    return memoria;
  }
  /* Después de una acción: guardar el pedido que devolvió el servidor y pedir lista fresca la próxima vez */
  function guardarEnMemoria(p) {
    memoria.t = 0;
    if (!p || !memoria.pedidos) return;
    const i = memoria.pedidos.findIndex((x) => x.id === p.id);
    const { historial, ...sinHist } = p;
    if (i >= 0) memoria.pedidos[i] = { ...memoria.pedidos[i], ...sinHist };
  }

  let busquedaPed = "", vendedorPed = "";
  const abiertasAp = new Set(); // tarjetas por aprobar con los detalles abiertos (se recuerdan al volver)
  async function vPedidos(v, _p, query, vigente) {
    if (enEntregas()) return vEntregas(v, query, vigente);
    const rp = rolPedidos();
    const { vistas, vista, sub } = resolverVista(rp, query.get("tab"), query.get("ver"));
    if (sub && sub.id === "comisiones") return vComisiones(v, vistas, vista, sub, query, vigente);
    const PERIODOS = [[1, "Hoy"], [7, "7 días"], [30, "30 días"], [90, "90 días"]];
    const esConc = sub && sub.id === "conciliados";
    const dias = esConc ? (PERIODOS.find(([d]) => d === Number(query.get("dias"))) || [30])[0] : 30;
    const conCarga = vista.id === "curso" && gestion();
    const conAprobar = vista.id === "hacer" && gestion(); // aprobar varios a la vez, o uno desde sus detalles
    const url = (t, ver, d) => `#/pedidos?tab=${t}${ver ? `&ver=${ver}` : ""}${d ? `&dias=${d}` : ""}`;
    v.innerHTML = `
      <div class="buscador buscador-ped"><input type="search" id="pBuscar" placeholder="Buscar cliente, número o teléfono" autocomplete="off" enterkeyhint="search" value="${esc(busquedaPed)}" /></div>
      <div class="periodos tabs-ped" role="tablist">${vistas.map((t) => `<a role="tab" class="tab${t.id === vista.id ? " active" : ""}" aria-selected="${t.id === vista.id}" href="${url(t.id)}" data-vista="${t.id}">${esc(t.nombre)}<b class="cuenta" data-cuenta="${t.id}"></b></a>`).join("")}</div>
      ${vista.ver ? `<div class="periodos periodos-chicos" id="pVer">${vista.ver.map((x) => `<a class="tab${x.id === sub.id ? " active" : ""}"${x.id === sub.id ? ' aria-current="true"' : ""} href="${url(vista.id, x.id)}">${esc(x.nombre)}</a>`).join("")}</div>` : ""}
      ${esConc ? `<div class="periodos periodos-chicos" id="pPeriodo" aria-label="Período">${PERIODOS.map(([d, t]) => `<a class="tab${d === dias ? " active" : ""}"${d === dias ? ' aria-current="true"' : ""} href="${url(vista.id, sub.id, d)}">${t}</a>`).join("")}</div>
      <div id="pResumen"></div>` : ""}
      ${gestion() ? '<label class="filtro-vend"><span>Vendedor</span><select id="pVend"><option value="">Todos</option></select></label>' : ""}
      <div class="modal-sub" id="pInfo"></div>
      ${conCarga ? '<div class="fila-elegir" id="pElegir" hidden><label class="check"><input type="checkbox" id="pTodos" /> Elegir todos (en despacho)</label></div>' : ""}
      <ul class="lista-ped" id="pLista"></ul>
      ${conCarga ? '<div class="barra-accion" id="pBarra" hidden><div><strong id="pSel">0 pedidos</strong><span id="pSelCajas"></span></div><button type="button" class="btn btn-primary" id="btnVerCarga">Ver total de carga</button></div>' : ""}
      ${conAprobar ? '<div class="barra-accion" id="aBarra" hidden><div><strong id="aSel">0 pedidos</strong><span id="aSelCajas"></span></div><button type="button" class="btn btn-primary" id="btnAprobarVarios">Aprobar</button></div>' : ""}`;

    let conciliadosServidor = null; // la lista de conciliados del período la da el servidor (puede ser vieja)
    let visibles = [];
    const filtrar = (lista) => {
      let l = buscarPedidos(lista, busquedaPed);
      if (vendedorPed) l = l.filter((p) => p.vendedor === vendedorPed);
      return l;
    };
    const filasDe = (lista, conDias) => {
      const el = (p) => filaPedido(p, conCarga && ["confirmado", "en_ruta"].includes(p.estado));
      if (!conDias) return lista.map(el).join("");
      return agruparPorDia(lista).map((g) => `<li class="grupo-tit">${esc(g.titulo)}</li>${g.pedidos.map(el).join("")}`).join("");
    };
    const lista0 = $("pLista");
    const pintar = () => {
      if (!document.body.contains(lista0)) return; // ya se cambió de página
      const todos = memoria.pedidos || [];
      // contadores en las pestañas
      const c = contadoresVistas(todos, rp, yo().id);
      c.hacer += (memoria.web || []).filter((w) => w.estado === "nuevo").length;
      v.querySelectorAll("[data-cuenta]").forEach((b) => { const n = c[b.dataset.cuenta]; b.textContent = n ? String(n) : ""; });
      // filtro de vendedor (Administración)
      const sel = $("pVend");
      if (sel && sel.options.length === 1) {
        [...new Set(todos.map((p) => p.vendedor).filter(Boolean))].sort().forEach((n) => sel.add(new Option(n, n, false, n === vendedorPed)));
      }
      let html = "", info = "";
      if (vista.id === "hacer") {
        const web = (memoria.web || []).filter((w) => w.estado === "nuevo")
          .filter((w) => !busquedaPed || [w.id, w.cliente.negocio, w.cliente.contacto, w.cliente.telefono].join(" ").toLowerCase().includes(busquedaPed.trim().toLowerCase()))
          .filter((w) => !vendedorPed || w.vendedor === vendedorPed);
        const secciones = [{ id: "web", titulo: rp === "vendedor" ? "Pedidos web de tus clientes" : "Pedidos web (los toma su vendedor)", web: true, pedidos: web }]
          .concat(porHacer(todos, rp, yo().id).map((s) => ({ ...s, pedidos: filtrar(s.pedidos) })));
        visibles = [].concat(...secciones.filter((s) => !s.web).map((s) => s.pedidos));
        const total = secciones.reduce((a, s) => a + s.pedidos.length, 0);
        html = secciones.filter((s) => s.pedidos.length).map((s) => {
          const aprobar = conAprobar && s.id === "aprobar";
          const tit = `<li class="grupo-tit${aprobar ? " grupo-aprobar" : ""}" data-seccion="${s.id}"><span>${esc(s.titulo)} <b>${s.pedidos.length}</b></span>${aprobar ? '<button type="button" class="ent-todos" id="aTodos" aria-pressed="false">Elegir todos</button>' : ""}</li>`;
          const filas = s.web ? s.pedidos.map(filaWeb).join("")
            : aprobar ? `<li class="ent-ayuda-li">Abrí la flecha para ver los datos de la factura y aprobar. Tocá varios para aprobarlos juntos.</li>${s.pedidos.map((p) => tarjetaAprobar(p, abiertasAp.has(p.id))).join("")}`
            : filasDe(s.pedidos, false);
          return tit + filas;
        }).join("");
        porAprobar = conAprobar ? ((secciones.find((x) => x.id === "aprobar") || {}).pedidos || []) : [];
        info = total ? "" : "";
        if (!total) html = `<li class="vacio-panel">${busquedaPed || vendedorPed ? "Nada con ese filtro." : "Nada pendiente por ahora."}</li>`;
      } else {
        let lista = esConc && conciliadosServidor ? conciliadosServidor : pedidosDeVista(todos, vista.id, sub && sub.id, { rol: rp, uid: yo().id, dias });
        if (vista.id === "cobros" && sub.id === "cobrar") {
          const peso = (p) => { const ec = estadoCredito(p); return ec && ec.vence ? (ec.nivel === "al_dia" || ec.nivel === "proximo" ? ec.dias : -ec.dias) : 9999; };
          lista = lista.slice().sort((a, b) => peso(a) - peso(b));
        }
        lista = filtrar(lista);
        visibles = lista;
        if (esConc) $("pResumen").innerHTML = resumenConciliadosHtml(resumenConciliados(lista), dias);
        const vencidos = lista.filter((p) => { const b = bandera(p); return b && (b.clase === "vencido" || b.clase === "muy_vencido"); }).length;
        info = lista.length ? `${lista.length} pedido(s)${vista.id === "cobros" && sub.id === "cobrar" && vencidos ? ` · ${vencidos} vencido(s)` : ""}${conCarga ? " · elegí pedidos para ver el total a cargar" : ""}` : "";
        html = lista.length ? filasDe(lista, vista.id === "curso" || vista.id === "historial") : `<li class="vacio-panel">${busquedaPed || vendedorPed ? "Nada con ese filtro." : "No hay pedidos en esta lista."}</li>`;
      }
      $("pInfo").textContent = info;
      $("pLista").innerHTML = html;
      if (conAprobar) pintarAprobar();
      if (conCarga) { $("pElegir").hidden = !visibles.some((p) => ["confirmado", "en_ruta"].includes(p.estado)); pintarSel(); }
    };
    const elegidos = () => [...v.querySelectorAll(".check-ped input:checked")].map((x) => x.value);
    const pintarSel = () => {
      if (!conCarga) return;
      const ids = elegidos();
      const elegibles = visibles.filter((p) => ["confirmado", "en_ruta"].includes(p.estado));
      const t = totalCarga(elegibles.filter((p) => ids.includes(p.id)));
      $("pBarra").hidden = !ids.length;
      $("pSel").textContent = `${ids.length} pedido${ids.length === 1 ? "" : "s"}`;
      $("pSelCajas").textContent = ` · ${t.cajas} caja${t.cajas === 1 ? "" : "s"}`;
      $("pTodos").checked = !!ids.length && ids.length === elegibles.length;
    };
    if (conCarga) {
      $("pLista").addEventListener("change", pintarSel);
      $("pTodos").addEventListener("change", () => { v.querySelectorAll(".check-ped input").forEach((x) => (x.checked = $("pTodos").checked)); pintarSel(); });
      $("btnVerCarga").addEventListener("click", () => { sessionStorage.setItem(K_CARGA, JSON.stringify(elegidos())); ir("#/carga"); });
    }
    // Aprobar: tocar la tarjeta la elige; la flecha despliega los detalles (con su botón Aprobar)
    let porAprobar = [];
    const selAp = new Set();
    const elegidosAp = () => porAprobar.filter((p) => selAp.has(p.id));
    function pintarAprobar() {
      v.querySelectorAll(".apr-card").forEach((li) => {
        const on = selAp.has(li.dataset.id);
        li.classList.toggle("elegida", on);
        li.querySelector("[data-ap-tap]").setAttribute("aria-pressed", String(on));
      });
      const ps = elegidosAp();
      const cajas = ps.reduce((a, p) => a + (Number(p.total_cajas) || 0), 0);
      $("aBarra").hidden = !ps.length;
      $("aSel").textContent = `${ps.length} pedido${ps.length === 1 ? "" : "s"}`;
      $("aSelCajas").textContent = ` · ${cajas} caja${cajas === 1 ? "" : "s"}`;
      $("btnAprobarVarios").textContent = ps.length > 1 ? `Aprobar ${ps.length}` : "Aprobar";
      const t = $("aTodos");
      if (t) { const all = ps.length > 0 && ps.length === porAprobar.length; t.setAttribute("aria-pressed", String(all)); t.textContent = all ? "Quitar todos" : "Elegir todos"; }
    }
    if (conAprobar) {
      $("pLista").addEventListener("click", async (e) => {
        if (e.target.closest("#aTodos")) {
          const all = porAprobar.length && porAprobar.every((p) => selAp.has(p.id));
          porAprobar.forEach((p) => (all ? selAp.delete(p.id) : selAp.add(p.id)));
          return pintarAprobar();
        }
        const li = e.target.closest(".apr-card");
        if (!li) return;
        const id = li.dataset.id;
        if (e.target.closest("[data-ap-ver]")) {
          const on = !li.classList.contains("abierta");
          li.classList.toggle("abierta", on);
          li.querySelector(".ent-detalle").hidden = !on;
          li.querySelector("[data-ap-ver]").setAttribute("aria-expanded", String(on));
          if (on) abiertasAp.add(id); else abiertasAp.delete(id);
          return;
        }
        if (e.target.closest("[data-ap-tap]")) {
          if (selAp.has(id)) selAp.delete(id); else selAp.add(id);
          return pintarAprobar();
        }
        if (e.target.closest("[data-ap-copiar]")) {
          const px = porAprobar.find((x) => x.id === id);
          if (px) toast((await copiarTexto(textoFactura(px))) ? "Datos copiados: pegalos para hacer la factura" : "No se pudo copiar");
          return;
        }
        const b = e.target.closest("[data-ap]");
        const p = porAprobar.find((x) => x.id === id);
        if (b && p) { selAp.delete(id); await accionPedido(p, b.dataset.ap, b); }
      });
      $("btnAprobarVarios").addEventListener("click", async () => {
        const ps = elegidosAp();
        if (!ps.length) return;
        if (ps.length === 1) return accionPedido(ps[0], "confirmar", $("btnAprobarVarios"));
        const facturas = await hojaAprobar(ps);
        if (!facturas) return;
        const btn = $("btnAprobarVarios");
        btn.disabled = true; btn.classList.add("ocupado");
        let ok = 0; const fallos = [];
        for (const [i, p] of ps.entries()) {
          try { const r = await api("estado", { pedido_id: p.id, estado: "confirmado", factura: facturas[i] }); guardarEnMemoria(r.pedido); ok++; selAp.delete(p.id); }
          catch (e2) { fallos.push(`${p.negocio}: ${e2.message}`); }
        }
        btn.disabled = false; btn.classList.remove("ocupado");
        if (fallos.length) await hoja({ titulo: ok ? `${ok} aprobado${ok === 1 ? "" : "s"}, ${fallos.length} sin aprobar` : "No se aprobaron", cuerpo: `<ul class="resumen-items">${fallos.map((f) => `<li><span>${esc(f)}</span></li>`).join("")}</ul>`, ok: "Entendido" });
        else toast(`${ok} pedidos aprobados`);
        render();
      });
    }
    let tBus = null;
    $("pBuscar").addEventListener("input", (e) => { clearTimeout(tBus); tBus = setTimeout(() => { busquedaPed = e.target.value; pintar(); }, 120); });
    const sv = $("pVend");
    if (sv) sv.addEventListener("change", () => { vendedorPed = sv.value; pintar(); });

    // 1) al instante con lo que ya hay  2) lista fresca por detrás
    const guardado = pedidosEnMemoria();
    if (guardado) { memoria.pedidos = guardado; pintar(); }
    else $("pLista").innerHTML = `<li>${spin()}</li>`;
    const tareas = [];
    // siempre se trae la lista fresca por detrás (salvo que se haya traído recién, al ir y volver rápido)
    if (Date.now() - memoria.t > 4000) tareas.push(refrescarPedidos().catch((e) => { if (!guardado) throw e; }));
    if (esConc) tareas.push(api("pedidos", { conciliados: true, dias }).then((r) => { conciliadosServidor = r.pedidos.slice().sort((a, b) => String(b.conciliado_at).localeCompare(String(a.conciliado_at))); }));
    if (tareas.length) {
      cargando(1);
      try { await Promise.all(tareas); } finally { cargando(-1); }
      if (!vigente()) return;
      pintar();
    }
  }

  /* ---------- Mis entregas (despachador): tarjetas grandes con llamar / WhatsApp / mapa y la acción a mano ---------- */
  const ICO_ENT = {
    tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1-1.2 1.7.8c-.3 1-1.2 1.6-2.2 1.4-2.7-.5-5.1-2.9-5.6-5.6-.2-1 .4-1.9 1.4-2.2l.8 1.7z"/>',
    mapa: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
    ruta: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01"/>',
    ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    ver: '<path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
  };
  const diaLocal = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const icoEnt = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICO_ENT[n]}</svg>`;
  /* Tarjeta para aprobar (Administración): tocar la elige; la flecha despliega productos, cliente y el botón Aprobar */
  function tarjetaAprobar(p, abierta) {
    const c = p.cliente_datos || {};
    const cajas = Number(p.total_cajas) || 0;
    const items = Array.isArray(p.items) ? p.items : [];
    const acc = accionesPedido(roles(), yo().id, p);
    const tipo = p.tipo_pago || tipoPagoDe(p.pago);
    const pago = (pagoPorId(tipo) || {}).nombre || p.pago || "";
    return `<li class="ent-card apr-card est-borde-pendiente elegible${abierta ? " abierta" : ""}" data-id="${esc(p.id)}">
      <div class="ent-cab">
        <button type="button" class="ent-info" data-ap-tap aria-pressed="false" aria-label="Elegir ${esc(p.negocio)} para aprobar">
          <span class="ent-cajas"><strong>${cajas}</strong>caja${cajas === 1 ? "" : "s"}</span>
          <span class="ent-txt">
            <strong class="ent-neg">${esc(p.negocio)}</strong>
            <span class="ped-det">${esc(p.vendedor)} · ${esc(fechaLegible(p.fecha))}</span>
            <span class="ped-det">${esc(p.id)}${pago ? ` · ${esc(pago)}` : ""}</span>
            ${montoFila(p)}
          </span>
        </button>
        <button type="button" class="ent-flecha" data-ap-ver aria-expanded="${!!abierta}" aria-label="Ver detalles de ${esc(p.negocio)}" title="Detalles">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>
      </div>
      <div class="ent-detalle apr-factura"${abierta ? "" : " hidden"}>
        <dl class="datos datos-factura">
          <dt>Cliente</dt><dd><strong>${esc(p.negocio)}</strong>${p.cliente && p.cliente !== p.negocio ? ` · ${esc(p.cliente)}` : ""}</dd>
          <dt>RIF</dt><dd>${c.rif_cedula ? esc(c.rif_cedula) : '<span class="falta-dato">Sin RIF</span>'}</dd>
          <dt>Teléfono</dt><dd>${esc([c.telefono, c.telefono2].filter(Boolean).join(" / ") || "—")}</dd>
          <dt>Dirección</dt><dd>${esc(c.direccion || "—")}</dd>
          <dt>Documento</dt><dd>${esc(p.documento || "Nota de entrega")}</dd>
          <dt>Pago</dt><dd>${esc(pago)}${p.dias_credito ? ` · ${p.dias_credito} días` : ""} · ${textoNivelPrecio(p)}</dd>
          <dt>Vendedor</dt><dd>${esc(p.vendedor)}</dd>
          ${p.nota ? `<dt>Nota</dt><dd>${esc(p.nota)}</dd>` : ""}
        </dl>
        <table class="tabla tabla-factura"><thead><tr><th>Cajas</th><th>Producto</th><th class="num">Precio</th><th class="num">Subtotal</th></tr></thead><tbody>
          ${items.map((it) => { const u = precioUnitario(it, tipo); return `<tr><td>${Number(it.cajas) || 0}</td><td>${esc(it.producto)} <span class="ped-det">${esc(it.code)}</span></td><td class="num">${u ? dinero(u) : "—"}</td><td class="num">${u ? dinero(it.cajas * u) : "—"}</td></tr>`; }).join("")}
        </tbody><tfoot><tr><td>${cajas}</td><td><strong>Total</strong></td><td></td><td class="num"><strong>${items.some((it) => Number(it.precio) > 0) ? dinero(totalPorPago(items, tipo)) : "—"}</strong></td></tr></tfoot></table>
        <div class="ent-botones apr-botones">
          <button type="button" class="ent-ico" data-ap-copiar>${icoEnt("ver")}<span>Copiar datos</span></button>
          <a class="ent-ico" href="#/editar/${encodeURIComponent(p.id)}">${icoEnt("editar")}<span>Editar</span></a>
          <a class="ent-ico" href="#/pedido/${encodeURIComponent(p.id)}">${icoEnt("ver")}<span>Ver pedido</span></a>
          ${acc.includes("confirmar") ? `<button type="button" class="btn btn-primary ent-acc es-entregar" data-ap="confirmar">${icoEnt("ok")}Aprobado</button>` : ""}
        </div>
      </div>
    </li>`;
  }

  /* Tarjeta de entrega: en la vista solo el mapa y la acción; la flecha despliega productos y dirección,
     y "Más detalles" muestra el teléfono para llamar. En "Por cargar", tocar la tarjeta la elige. */
  function tarjetaEntrega(p, elegible, abierta) {
    const c = p.cliente_datos || {};
    const tel = telLink(c.telefono), tel2 = telLink(c.telefono2), mapa = linkMapa(c.latitud, c.longitud);
    const acc = accionesPedido(roles(), yo().id, p).find((a) => a === "en_ruta" || a === "entregado");
    const items = Array.isArray(p.items) ? p.items : [];
    const cajas = p.estado === "entregado" || !items.length ? Number(p.total_cajas) || 0 : cajasPendientes(p);
    const parcial = p.estado !== "entregado" && esParcial(p);
    return `<li class="ent-card est-borde-${esc(p.estado)}${elegible ? " elegible" : ""}${abierta ? " abierta" : ""}" data-id="${esc(p.id)}">
      <div class="ent-cab">
        <button type="button" class="ent-info" data-ent-tap aria-${elegible ? `pressed="false" aria-label="Elegir ${esc(p.negocio)} para la carga"` : `expanded="${!!abierta}"`}>
          <span class="ent-cajas"><strong>${cajas}</strong>caja${cajas === 1 ? "" : "s"}</span>
          <span class="ent-txt">
            <strong class="ent-neg">${esc(p.negocio)}</strong>
            ${c.direccion ? `<span class="ent-dir">${icoEnt("mapa")}${esc(c.direccion)}</span>` : '<span class="ent-dir sin">Sin dirección</span>'}
            <span class="ped-det">${esc(p.id)}${parcial ? "" : p.detalle_unidades ? " · " + esc(p.detalle_unidades) : ""}${p.factura ? ` · Fact. ${esc(p.factura)}` : ""}</span>
            ${parcial ? `<span class="chip-parcial">Entrega parcial · faltan ${cajas} de ${Number(p.total_cajas) || 0}</span>` : ""}
          </span>
        </button>
        <button type="button" class="ent-flecha" data-ent-ver aria-expanded="${!!abierta}" aria-label="Ver detalles de ${esc(p.negocio)}" title="Detalles">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>
      </div>
      <div class="ent-detalle"${abierta ? "" : " hidden"}>
        <ul class="ent-items">${items.filter((it) => p.estado === "entregado" || cajasPorEntregar(it) > 0).map((it) => { const n = p.estado === "entregado" ? Number(it.cajas) || 0 : cajasPorEntregar(it);
          return `<li><b>${n}</b><span>${esc(it.producto)} <span class="ped-det">${esc(it.code)}${n !== Number(it.cajas) ? ` · faltan ${n} de ${it.cajas}` : it.total_unidades ? ` · ${it.total_unidades} ${esc(it.unidad)}` : ""}</span></span></li>`; }).join("") || '<li class="ped-det">Abrí el pedido para ver los productos.</li>'}</ul>
        <p class="ent-dir-full"><span class="ped-det">Entregar en</span><br>${esc(c.direccion || "Sin dirección")}${p.cliente && p.cliente !== p.negocio ? `<br><span class="ped-det">Recibe: ${esc(p.cliente)}</span>` : ""}</p>
        <details class="ent-mas">
          <summary>Más detalles</summary>
          <div class="ent-mas-cuerpo">
            ${p.nota ? `<p class="ped-det">Nota: ${esc(p.nota)}</p>` : ""}
            <div class="ent-botones">
              ${tel ? `<a class="ent-ico" href="tel:${esc(tel)}" aria-label="Llamar a ${esc(p.negocio)}">${icoEnt("tel")}<span>Llamar</span></a>` : ""}
              ${tel2 ? `<a class="ent-ico" href="tel:${esc(tel2)}" aria-label="Llamar al teléfono 2 de ${esc(p.negocio)}">${icoEnt("tel")}<span>Tel. 2</span></a>` : ""}
              <a class="ent-ico" href="#/pedido/${encodeURIComponent(p.id)}">${icoEnt("ver")}<span>Ver pedido</span></a>
            </div>
          </div>
        </details>
      </div>
      ${p.estado === "entregado" || (!mapa && !acc) ? "" : `<div class="ent-botones">
        ${mapa ? `<a class="ent-ico ent-mapa" href="${esc(mapa)}" target="_blank" rel="noopener" aria-label="Ver en el mapa" title="Mapa">${icoEnt("mapa")}<span>Mapa</span></a>` : ""}
        ${acc ? `<button type="button" class="btn btn-primary ent-acc${acc === "entregado" ? " es-entregar" : ""}" data-ent="${acc}">${icoEnt(acc === "entregado" ? "ok" : "ruta")}${acc === "entregado" ? "Entregado" : "Salió en ruta"}</button>` : ""}
      </div>`}
    </li>`;
  }

  const sobranteHtml = '<p class="ent-sobrante"><button type="button" class="link-btn" id="btnSobrante">¿Volvieron cajas de más en el camión?</button></p>';
  /* Se cargó de más por error y volvió: solo queda la constancia (el stock no cambia) */
  async function registrarSobrante() {
    const prods = [...BANOS, ...KITS];
    const d = await hoja({
      titulo: "Volvieron cajas de más",
      cuerpo: `<p class="modal-sub">Cajas que se cargaron por error y no eran de ningún pedido. <strong>No cambia el inventario</strong> (nunca se descontaron); queda anotado en Inventario → Últimos movimientos.</p>
        <label class="field field-full"><span>Producto</span><select name="code"><option value="">Elegí el producto</option>${prods.map((x) => `<option value="${esc(x.code)}">${esc(x.name)} · ${esc(x.code)}</option>`).join("")}</select></label>
        <label class="field field-full"><span>Cajas</span><input name="cajas" inputmode="numeric" autocomplete="off" placeholder="ej. 1" /></label>
        <label class="field field-full"><span>Nota</span><input name="nota" maxlength="200" autocomplete="off" placeholder="ej. viaje de la tarde a El Vigía" /></label>`,
      ok: "Guardar",
      validar: (x) => (!x.code ? "Elegí el producto." : !(Math.round(Number(x.cajas)) > 0) ? "Indicá cuántas cajas volvieron." : ""),
    });
    if (!d) return;
    try { await api("movimiento", { tipo: "sobrante", code: d.code, cajas: Math.round(Number(d.cajas)), nota: d.nota.trim() }); toast("Anotado: volvieron cajas de más"); }
    catch (e) { toast(e.message); }
  }

  async function vEntregas(v, query, vigente) {
    const tab = query.get("tab") === "entregado" ? "entregado" : "curso";
    const admin = gestion(); // sin depositario: Administración despacha todos los pedidos aprobados
    if (admin) { $("appTitulo").textContent = "Despacho"; document.title = "Despacho · Ontiveros Equipo"; }
    v.innerHTML = `
      <div class="periodos tabs-ped tabs-ent" role="tablist">
        <a role="tab" class="tab${tab === "curso" ? " active" : ""}" aria-selected="${tab === "curso"}" href="#/entregas?tab=curso">Por entregar<b class="cuenta" data-cuenta="curso"></b></a>
        <a role="tab" class="tab${tab === "entregado" ? " active" : ""}" aria-selected="${tab === "entregado"}" href="#/entregas?tab=entregado">Entregados</a>
      </div>
      <div class="banner-prox-ruteo" data-gps-slot="despacho-ruteo"><span class="chip-prox">Próximamente</span><span>🚚 Secuencia óptima de paradas de camión (1 → N) y navegación giro a giro</span></div>
      <div id="eResumen"></div>
      <div id="pLista" class="ent-lista">${spin()}</div>
      ${tab === "curso" ? '<div class="barra-accion" id="pBarra" hidden><div><strong id="pSel">0 pedidos</strong><span id="pSelCajas"></span></div><button type="button" class="btn btn-primary" id="btnVerCarga">Ver total de carga</button></div>' : ""}`;
    const lista0 = $("pLista");
    let mias = [];
    const sel = new Set(), abiertas = new Set();
    const elegidos = () => mias.filter((p) => sel.has(p.id) && p.estado === "confirmado").map((p) => p.id);
    const pintarSel = () => {
      v.querySelectorAll(".ent-card.elegible").forEach((li) => {
        const on = sel.has(li.dataset.id);
        li.classList.toggle("elegida", on);
        li.querySelector("[data-ent-tap]").setAttribute("aria-pressed", String(on));
      });
      const b = $("pBarra"); if (!b) return;
      const ids = elegidos();
      const t = totalCarga(mias.filter((p) => ids.includes(p.id)));
      b.hidden = !ids.length;
      $("pSel").textContent = `${ids.length} pedido${ids.length === 1 ? "" : "s"}`;
      $("pSelCajas").textContent = ` · ${t.cajas} caja${t.cajas === 1 ? "" : "s"}`;
      const todos = $("pTodos");
      if (todos) { const all = ids.length > 0 && ids.length === v.querySelectorAll(".ent-card.elegible").length; todos.setAttribute("aria-pressed", String(all)); todos.textContent = all ? "Quitar todos" : "Elegir todos"; }
    };
    const pintar = (todos) => {
      if (!document.body.contains(lista0)) return;
      const propios = (todos || []).filter((p) => admin || String(p.despachador_id) === String(yo().id));
      const porCargar = propios.filter((p) => p.estado === "confirmado");
      const enRuta = propios.filter((p) => p.estado === "en_ruta");
      const cuenta = v.querySelector('[data-cuenta="curso"]');
      if (cuenta) cuenta.textContent = porCargar.length + enRuta.length ? String(porCargar.length + enRuta.length) : "";
      const sumaCajas = (l) => l.reduce((a, p) => a + (p.estado === "entregado" || !(p.items || []).length ? Number(p.total_cajas) || 0 : cajasPendientes(p)), 0);
      if (tab === "curso") {
        mias = porCargar.concat(enRuta);
        $("eResumen").innerHTML = mias.length ? `<section class="ent-resumen">
            <div><strong>${sumaCajas(mias)}</strong><span>cajas por entregar</span></div>
            <div><strong>${porCargar.length}</strong><span>por cargar</span></div>
            <div><strong>${enRuta.length}</strong><span>en ruta</span></div>
          </section>` : "";
        if (!mias.length) { lista0.innerHTML = `<p class="vacio-panel ent-vacio">${admin ? "No hay pedidos aprobados por despachar." : "No tenés entregas pendientes."}</p>${admin ? sobranteHtml : ""}`; pintarSel(); return; }
        lista0.innerHTML = `
          ${porCargar.length ? `<div class="ent-grupo"><h3 class="ent-tit">Por cargar <b>${porCargar.length}</b></h3>
            <button type="button" class="ent-todos" id="pTodos" aria-pressed="false">Elegir todos</button></div>
            <p class="ent-ayuda">Tocá los pedidos que vas a llevar y luego <strong>Ver total de carga</strong>.</p>
            <ul class="lista-ped">${porCargar.map((p) => tarjetaEntrega(p, true, abiertas.has(p.id))).join("")}</ul>` : ""}
          ${enRuta.length ? `<div class="ent-grupo"><h3 class="ent-tit">En ruta <b>${enRuta.length}</b></h3></div>
            <ul class="lista-ped">${enRuta.map((p) => tarjetaEntrega(p, false, abiertas.has(p.id))).join("")}</ul>` : ""}
          ${admin ? sobranteHtml : ""}`;
        pintarSel();
      } else {
        const hechos = propios.filter((p) => p.estado === "entregado")
          .sort((a, b) => String(b.entregado_at || b.fecha).localeCompare(String(a.entregado_at || a.fecha)))
          .map((p) => ({ ...p, _dia: diaLocal(p.entregado_at || p.created_at) }));
        $("eResumen").innerHTML = "";
        if (!hechos.length) { lista0.innerHTML = '<p class="vacio-panel ent-vacio">Todavía no hay entregas registradas.</p>'; return; }
        const grupos = agruparPorDia(hechos.map((p) => ({ ...p, fecha: p._dia })));
        lista0.innerHTML = grupos.map((g) => `<div class="ent-grupo"><h3 class="ent-tit">${esc(g.titulo)} <b>${g.pedidos.length}</b></h3><span class="ent-suma">${sumaCajas(g.pedidos)} cajas</span></div>
          <ul class="lista-ped">${g.pedidos.map((p) => tarjetaEntrega(p, false, abiertas.has(p.id))).join("")}</ul>`).join("");
      }
    };
    const abrir = (li) => {
      if (!li.querySelector(".ent-detalle")) return;
      const on = !li.classList.contains("abierta");
      li.classList.toggle("abierta", on);
      li.querySelector(".ent-detalle").hidden = !on;
      li.querySelector("[data-ent-ver]").setAttribute("aria-expanded", String(on));
      if (!li.classList.contains("elegible")) li.querySelector("[data-ent-tap]").setAttribute("aria-expanded", String(on));
      if (on) abiertas.add(li.dataset.id); else abiertas.delete(li.dataset.id);
    };
    lista0.addEventListener("click", async (e) => {
      if (e.target.closest("#btnSobrante")) return registrarSobrante();
      if (e.target.closest("#pTodos")) {
        const todasIds = [...v.querySelectorAll(".ent-card.elegible")].map((li) => li.dataset.id);
        const todas = todasIds.every((id) => sel.has(id));
        todasIds.forEach((id) => (todas ? sel.delete(id) : sel.add(id)));
        return pintarSel();
      }
      const li = e.target.closest(".ent-card");
      if (!li) return;
      if (e.target.closest("[data-ent-ver]")) return abrir(li);
      if (e.target.closest("[data-ent-tap]")) {
        if (!li.classList.contains("elegible")) return abrir(li);
        if (sel.has(li.dataset.id)) sel.delete(li.dataset.id); else sel.add(li.dataset.id);
        return pintarSel();
      }
      const b = e.target.closest("[data-ent]");
      if (!b) return;
      const p = mias.find((x) => x.id === li.dataset.id);
      if (p) await accionPedido(p, b.dataset.ent, b);
    });
    const bc = $("btnVerCarga");
    if (bc) bc.addEventListener("click", () => { sessionStorage.setItem(K_CARGA, JSON.stringify(elegidos())); ir("#/carga"); });
    const enMem = pedidosEnMemoria();
    if (enMem) pintar(enMem);
    if (enMem && Date.now() - memoria.t < 20000) return;
    try {
      const m = await refrescarPedidos();
      if (vigente()) pintar(m.pedidos);
    } catch (e) {
      if (!enMem && vigente()) lista0.innerHTML = `<p class="aviso-error">${esc(e.message)}</p>`;
    }
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

  /* ---------- Comisiones de vendedores (sobre pagos conciliados) ---------- */
  let estadoFiltroCom = "pendientes";
  let periodoCom = 0; // 0 = Todo, 7 = Esta semana, 14 = Últimas 2 semanas, 30 = Últimos 30 días
  async function obtenerConfigComisiones(forzar = false) {
    const local = leerLS(K_COMISION_CFG, null);
    if (!forzar && local && typeof local === "object" && Number(local.porcentaje_default) > 0) {
      SkalaAPI.api("comisiones").then((r) => { if (r && r.config) guardarLS(K_COMISION_CFG, r.config); }).catch(() => {});
      return local;
    }
    try {
      const r = await SkalaAPI.api("comisiones");
      if (r && r.config) {
        guardarLS(K_COMISION_CFG, r.config);
        return r.config;
      }
    } catch (_) {}
    return local || { porcentaje_default: 3, por_vendedor: {}, vendedores: [] };
  }

  async function vComisiones(v, vistas, vista, sub, query, vigente) {
    const rp = rolPedidos();
    const esAdmin = gestion();
    const url = (t, ver) => `#/pedidos?tab=${t}${ver ? `&ver=${ver}` : ""}`;
    v.innerHTML = `
      <div class="buscador buscador-ped"><input type="search" id="pBuscar" placeholder="Buscar cliente, pedido o vendedor" autocomplete="off" enterkeyhint="search" value="${esc(busquedaPed)}" /></div>
      <div class="periodos tabs-ped" role="tablist">${vistas.map((t) => `<a role="tab" class="tab${t.id === vista.id ? " active" : ""}" aria-selected="${t.id === vista.id}" href="${url(t.id)}" data-vista="${t.id}">${esc(t.nombre)}<b class="cuenta" data-cuenta="${t.id}"></b></a>`).join("")}</div>
      ${vista.ver ? `<div class="periodos periodos-chicos" id="pVer">${vista.ver.map((x) => `<a class="tab${x.id === sub.id ? " active" : ""}"${x.id === sub.id ? ' aria-current="true"' : ""} href="${url(vista.id, x.id)}">${esc(x.nombre)}</a>`).join("")}</div>` : ""}
      <div class="com-barra-top">
        <div class="periodos periodos-chicos" id="cEstadoTabs">
          ${[["pendientes", "Por pagar"], ["pagadas", "Pagadas"], ["todas", "Todas"]].map(([k, t]) => `<button type="button" class="tab${estadoFiltroCom === k ? " active" : ""}" data-cest="${k}">${t}</button>`).join("")}
        </div>
        ${esAdmin
          ? `<button type="button" class="btn btn-ghost btn-engranaje" id="btnConfigComision" title="Configurar porcentaje de comisión">⚙️ <span id="lblPctCom">3%</span></button>`
          : `<span class="chip chip-pct" id="lblPctCom">Comisión: 3%</span>`}
      </div>
      <div class="periodos periodos-chicos com-periodos-fecha" id="cPeriodoTabs" ${estadoFiltroCom === "pendientes" ? "hidden" : ""}>
        ${[[7, "Esta semana"], [14, "Últimas 2 semanas"], [30, "Últimos 30 días"], [0, "Todo"]].map(([d, t]) => `<button type="button" class="tab${periodoCom === d ? " active" : ""}" data-cper="${d}">${t}</button>`).join("")}
      </div>
      ${esAdmin ? '<label class="filtro-vend"><span>Vendedor</span><select id="pVend"><option value="">Todos</option></select></label>' : ""}
      <div id="comResumen"></div>
      ${esAdmin ? '<div class="fila-elegir" id="cElegirWrap" hidden><label class="check"><input type="checkbox" id="cTodos" /> Elegir todas las comisiones pendientes visibles</label></div>' : ""}
      <ul class="lista-ped lista-comisiones" id="pLista"><li>${spin()}</li></ul>
      ${esAdmin ? '<div class="barra-accion" id="cBarra" hidden><div><strong id="cSel">0 comisiones</strong><span id="cSelMonto"></span></div><button type="button" class="btn btn-primary" id="btnPagarLote">Cancelar comisión</button></div>' : ""}`;

    let cfgCom = await obtenerConfigComisiones(false);
    let pedidosConc = null;
    const selCom = new Set();
    let comisionesVisibles = [];

    const textoWhastappComision = (items, fechaPago, tasaUsada, ref) => {
      const vend = items[0] ? items[0].vendedor : "Vendedor";
      const enUsd = items.filter((x) => x.moneda !== "Bs");
      const enBs = items.filter((x) => x.moneda === "Bs");
      const totUsdEf = Math.round(enUsd.reduce((a, x) => a + x.comision_usd, 0) * 100) / 100;
      const totBs = Math.round(enBs.reduce((a, x) => {
        const m = x.pagada && x.comision_monto ? x.comision_monto : (tasaUsada > 0 ? Math.round(x.comision_usd * tasaUsada * 100) / 100 : x.comision_bs_origen);
        return a + m;
      }, 0) * 100) / 100;
      return [
        `*COMISIONES SKALA — ${vend}*`,
        `Fecha de liquidación: ${fechaLegible(fechaPago || new Date().toISOString().slice(0, 10))}`,
        "",
        ...items.map((x) => {
          const montoItem = x.moneda === "Bs"
            ? formatoMonto(x.pagada && x.comision_monto ? x.comision_monto : (tasaUsada > 0 ? Math.round(x.comision_usd * tasaUsada * 100) / 100 : x.comision_bs_origen), "Bs")
            : dinero(x.comision_usd);
          return `• *${x.negocio}* (${x.pedido_id}) · Cobro: ${formatoMonto(x.monto_cobrado, x.moneda)} → Comisión (${x.pct}%): *${montoItem}*`;
        }),
        "",
        totUsdEf > 0 ? `*Total Efectivo ($): ${dinero(totUsdEf)}*` : null,
        totBs > 0 ? `*Total Bolívares (Bs): ${formatoMonto(totBs, "Bs")}*${tasaUsada > 0 ? ` (Tasa BCV: ${formatoNumInput(tasaUsada, true)})` : ""}` : null,
        ref ? `Referencia: ${ref}` : null,
      ].filter(Boolean).join("\n");
    };

    const pintarBarraSel = () => {
      if (!esAdmin) return;
      const b = $("cBarra");
      if (!b) return;
      const pendVisibles = comisionesVisibles.filter((x) => !x.pagada);
      const elegidas = pendVisibles.filter((x) => selCom.has(x.pago_id));
      b.hidden = !elegidas.length;
      $("cSel").textContent = `${elegidas.length} factura${elegidas.length === 1 ? "" : "s"}`;
      const usd = Math.round(elegidas.filter((x) => x.moneda !== "Bs").reduce((a, x) => a + x.comision_usd, 0) * 100) / 100;
      const bs = Math.round(elegidas.filter((x) => x.moneda === "Bs").reduce((a, x) => a + x.comision_bs_origen, 0) * 100) / 100;
      const partes = [usd > 0 ? dinero(usd) : "", bs > 0 ? formatoMonto(bs, "Bs") : ""].filter(Boolean);
      $("cSelMonto").textContent = partes.length ? ` · ${partes.join(" + ")}` : "";
      const chkTodos = $("cTodos");
      if (chkTodos) chkTodos.checked = pendVisibles.length > 0 && elegidas.length === pendVisibles.length;
    };

    const pintar = () => {
      if (!document.body.contains($("pLista"))) return;
      const todos = memoria.pedidos || [];
      const c = contadoresVistas(todos, rp, yo().id);
      c.hacer += (memoria.web || []).filter((w) => w.estado === "nuevo").length;
      v.querySelectorAll("[data-cuenta]").forEach((b) => { const n = c[b.dataset.cuenta]; b.textContent = n ? String(n) : ""; });

      const pctDef = Number(cfgCom && cfgCom.porcentaje_default) || 3;
      const lblPct = $("lblPctCom");
      if (lblPct) {
        if (esAdmin) lblPct.textContent = `${formatoNumInput(pctDef)}%`;
        else {
          const miPct = (cfgCom && cfgCom.por_vendedor && (cfgCom.por_vendedor[yo().id] || cfgCom.por_vendedor[String(yo().nombre || "").toLowerCase()])) || pctDef;
          lblPct.textContent = `Comisión: ${formatoNumInput(miPct)}%`;
        }
      }

      // Combinar pedidos en memoria y conciliados traídos del servidor
      const mapaPed = {};
      todos.concat(pedidosConc || []).forEach((p) => { if (p && p.id) mapaPed[p.id] = p; });
      const basePedidos = Object.values(mapaPed).filter((p) => esAdmin || String(p.vendedor_id) === String(yo().id));
      const pagadasLocal = leerLS(K_COMISION_PAGADAS, {});
      const todasCom = extraerComisiones(basePedidos, { ...cfgCom, pagadas_locales: pagadasLocal });

      const sel = $("pVend");
      if (sel && sel.options.length === 1) {
        [...new Set(todasCom.map((x) => x.vendedor).filter(Boolean))].sort().forEach((n) => sel.add(new Option(n, n, false, n === vendedorPed)));
      }

      const q = busquedaPed.trim().toLowerCase();
      const filtradasVendedor = todasCom.filter((x) => {
        if (vendedorPed && x.vendedor !== vendedorPed) return false;
        if (q && ![x.pedido_id, x.negocio, x.cliente, x.vendedor, x.factura, x.referencia_cobro].join(" ").toLowerCase().includes(q)) return false;
        return true;
      });

      // Mostrar/ocultar barra de períodos para Pagadas y Todas
      const barraPer = $("cPeriodoTabs");
      if (barraPer) barraPer.hidden = estadoFiltroCom === "pendientes";

      const diasDesdeHoy = (fechaIso) => {
        const f = String(fechaIso || "").slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return 0;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const [y, m, d] = f.split("-").map(Number);
        const dt = new Date(y, m - 1, d);
        return Math.max(0, Math.floor((hoy.getTime() - dt.getTime()) / 86400000));
      };
      const fechaDePagada = (x) => x.comision_fecha || x.fecha_pago || String(x.conciliado_at || "").slice(0, 10);

      // Resumen de pendientes (Por pagar) y pagadas (sobre el vendedor filtrado y período elegido)
      const pend = filtradasVendedor.filter((x) => !x.pagada);
      const pagTodas = filtradasVendedor.filter((x) => x.pagada);
      const pag = periodoCom > 0
        ? pagTodas.filter((x) => diasDesdeHoy(fechaDePagada(x)) <= periodoCom)
        : pagTodas;

      const pendUsdEf = Math.round(pend.filter((x) => x.moneda !== "Bs").reduce((a, x) => a + x.comision_usd, 0) * 100) / 100;
      const pendBs = Math.round(pend.filter((x) => x.moneda === "Bs").reduce((a, x) => a + x.comision_bs_origen, 0) * 100) / 100;
      const pendBsUsd = Math.round(pend.filter((x) => x.moneda === "Bs").reduce((a, x) => a + x.comision_usd, 0) * 100) / 100;
      const pagUsdEf = Math.round(pag.filter((x) => x.comision_moneda !== "Bs").reduce((a, x) => a + x.comision_usd, 0) * 100) / 100;
      const pagBsUsd = Math.round(pag.filter((x) => x.comision_moneda === "Bs").reduce((a, x) => a + x.comision_usd, 0) * 100) / 100;
      const pagTotalUsd = Math.round((pagUsdEf + pagBsUsd) * 100) / 100;

      // Actualizar contadores en las pestañas (Por pagar / Pagadas / Todas)
      const tabsEst = $("cEstadoTabs");
      if (tabsEst) {
        const conts = { pendientes: pend.length, pagadas: pagTodas.length, todas: pend.length + pagTodas.length };
        const nombres = { pendientes: "Por pagar", pagadas: "Pagadas", todas: "Todas" };
        tabsEst.querySelectorAll("[data-cest]").forEach((btn) => {
          const k = btn.dataset.cest;
          const n = conts[k] || 0;
          btn.innerHTML = `${nombres[k] || k}${n ? ` <b class="cuenta">${n}</b>` : ""}`;
        });
      }

      const nomPeriodo = periodoCom === 7 ? " · Esta semana" : periodoCom === 14 ? " · Últimas 2 semanas" : periodoCom === 30 ? " · Últimos 30 días" : "";

      const htmlResumenPorPagar = `
        <div class="com-resumen-grid">
          <div class="com-stat">
            <span class="ped-det">Por pagar · Efectivo ($)</span>
            <strong>${esc(dinero(pendUsdEf))}</strong>
            <span class="ped-det">${pend.filter((x) => x.moneda !== "Bs").length} cobro(s) en $</span>
          </div>
          <div class="com-stat">
            <span class="ped-det">Por pagar · Bolívares (Bs)</span>
            <strong>${esc(formatoMonto(pendBs, "Bs"))}</strong>
            <span class="ped-det">${pend.filter((x) => x.moneda === "Bs").length} cobro(s) en Bs · equiv. ${esc(dinero(pendBsUsd))}</span>
          </div>
        </div>`;

      const htmlResumenPagadas = `
        <div class="com-resumen-pagadas-hero">
          <span class="ped-det">Comisiones pagadas · Equivalente en dólares ($)${esc(nomPeriodo)}</span>
          <strong class="com-hero-usd">${esc(dinero(pagTotalUsd))}</strong>
          <span class="ped-det">${pag.length} comisión(es) liquidada(s)</span>
        </div>
        <div class="com-resumen-grid">
          <div class="com-stat es-pagada">
            <span class="ped-det">Pagadas · Efectivo ($)</span>
            <strong>${esc(dinero(pagUsdEf))}</strong>
            <span class="ped-det">${pag.filter((x) => x.comision_moneda !== "Bs").length} comisión(es) en efectivo</span>
          </div>
          <div class="com-stat es-pagada">
            <span class="ped-det">Pagadas en Bs · Equiv. ($)</span>
            <strong>${esc(dinero(pagBsUsd))}</strong>
            <span class="ped-det">${pag.filter((x) => x.comision_moneda === "Bs").length} comisión(es) transferida(s) en Bs</span>
          </div>
        </div>`;

      if (estadoFiltroCom === "pagadas") {
        $("comResumen").innerHTML = `
          <section class="tarjeta com-resumen-card">
            ${htmlResumenPagadas}
            ${pend.length ? `<p class="ped-det com-pagado-linea">Por pagar: <strong>${esc(dinero(pendUsdEf))}</strong> en efectivo · <strong>${esc(formatoMonto(pendBs, "Bs"))}</strong> en Bs (${pend.length} pendiente${pend.length === 1 ? "" : "s"})</p>` : ""}
          </section>`;
      } else if (estadoFiltroCom === "todas") {
        $("comResumen").innerHTML = `
          <section class="tarjeta com-resumen-card com-resumen-ambas">
            ${htmlResumenPorPagar}
            ${htmlResumenPagadas}
          </section>`;
      } else {
        $("comResumen").innerHTML = `
          <section class="tarjeta com-resumen-card">
            ${htmlResumenPorPagar}
            ${pagTodas.length ? `<p class="ped-det com-pagado-linea">Pagadas (equiv. en $): <strong>${esc(dinero(Math.round(pagTodas.reduce((a, x) => a + x.comision_usd, 0) * 100) / 100))}</strong> (${pagTodas.length} pago${pagTodas.length === 1 ? "" : "s"})</p>` : ""}
          </section>`;
      }

      comisionesVisibles = estadoFiltroCom === "pendientes"
        ? pend
        : estadoFiltroCom === "pagadas"
          ? pag
          : pend.concat(pag);

      const elegirWrap = $("cElegirWrap");
      if (elegirWrap) elegirWrap.hidden = !comisionesVisibles.some((x) => !x.pagada);

      if (!comisionesVisibles.length) {
        const msgVacio = estadoFiltroCom === "pendientes"
          ? "No hay comisiones pendientes por pagar."
          : estadoFiltroCom === "pagadas"
            ? `No hay comisiones pagadas registradas${nomPeriodo ? ` (${nomPeriodo.slice(3).toLowerCase()})` : ""}.`
            : "No hay comisiones registradas.";
        $("pLista").innerHTML = `<li class="vacio-panel">${msgVacio}</li>`;
        pintarBarraSel();
        return;
      }

      const htmlItemCom = (it) => {
        const esBs = it.moneda === "Bs";
        const chk = esAdmin && !it.pagada
          ? `<label class="check-ped"><input type="checkbox" data-com-check="${esc(it.pago_id)}" ${selCom.has(it.pago_id) ? "checked" : ""} aria-label="Elegir comisión de ${esc(it.negocio)}" /></label>`
          : "";
        return `<li class="com-item${chk ? " con-check" : ""}">
          ${chk}
          <div class="fila-ped com-card ${it.pagada ? "es-pagada" : "es-pendiente"}">
            <div class="fila-top">
              <a class="com-negocio-link" href="#/pedido/${encodeURIComponent(it.pedido_id)}"><strong>${esc(it.negocio)}</strong></a>
              <span class="chip ${it.pagada ? "chip-ok" : "chip-pend"}">${it.pagada ? "✓ Comisión pagada" : `Por pagar (${formatoNumInput(it.pct)}%)`}</span>
            </div>
            <div class="ped-det">${esc(it.pedido_id)}${it.factura ? ` · Fact. ${esc(it.factura)}` : ""} · Vendedor: <strong>${esc(it.vendedor)}</strong></div>
            <div class="ped-det com-cobro-origen">
              Cliente canceló en <strong>${esBs ? "Bolívares (Bs)" : "Efectivo ($)"}</strong>:
              <strong>${esc(formatoMonto(it.monto_cobrado, it.moneda))}</strong>
              ${it.fecha_pago ? ` el ${esc(fechaLegible(it.fecha_pago))}` : ""}
              ${esBs && it.tasa_cobro ? ` · Tasa BCV: ${esc(formatoNumInput(it.tasa_cobro, true))} (= ${esc(dinero(it.monto_usd))})` : ""}
              ${it.referencia_cobro ? ` · Ref: ${esc(it.referencia_cobro)}` : ""}
            </div>
            <div class="com-monto-box">
              ${!it.pagada
                ? `<div class="com-monto-info">
                    <span class="ped-det">Comisión (${formatoNumInput(it.pct)}%) en ${esBs ? "Bolívares (Bs)" : "Efectivo ($)"}:</span>
                    <strong class="com-monto-principal">${esBs ? esc(formatoMonto(it.comision_bs_origen, "Bs")) : esc(dinero(it.comision_usd))}</strong>
                    ${esBs ? `<span class="ped-det">Base: ${esc(dinero(it.comision_usd))} (se ajusta según el día en que se transfiera la comisión)</span>` : ""}
                  </div>
                  ${esAdmin ? `<button type="button" class="btn btn-primary btn-chico" data-com-pagar="${esc(it.pago_id)}">Cancelar comisión</button>` : ""}`
                : `<div class="com-monto-info">
                    <span class="ped-det">Comisión cancelada (${formatoNumInput(it.pct)}%) · Equivalente en $:</span>
                    <strong class="com-monto-principal com-monto-usd-grande">${esc(dinero(it.comision_usd))}</strong>
                    <span class="ped-det">
                      ${it.comision_fecha ? `Día de pago: ${esc(fechaLegible(it.comision_fecha))}` : ""}
                      ${it.comision_moneda === "Bs"
                        ? ` · Pagada en Bs (${esc(formatoMonto(it.comision_monto, "Bs"))}${it.comision_tasa ? ` · BCV ${esc(formatoNumInput(it.comision_tasa, true))}` : ""})`
                        : " · Pagada en Efectivo ($)"}
                      ${it.comision_ref ? ` · Ref: ${esc(it.comision_ref)}` : ""}
                      ${it.comision_pagada_por ? ` · Por: ${esc(it.comision_pagada_por)}` : ""}
                    </span>
                  </div>
                  <div class="com-acciones-pagada">
                    <button type="button" class="btn btn-ghost btn-chico" data-com-wa="${esc(it.pago_id)}">WhatsApp</button>
                    ${esAdmin ? `<button type="button" class="btn btn-ghost btn-chico" data-com-deshacer="${esc(it.pago_id)}">Deshacer</button>` : ""}
                  </div>`}
            </div>
          </div>
        </li>`;
      };

      // Agrupar comisiones pagadas por secciones de fecha (Esta semana · Últimas 2 semanas · Últimos 30 días · Anteriores)
      const renderPagadasPorSecciones = (listaPag) => {
        if (!listaPag.length) return [`<li class="vacio-panel com-vacio-chico">No hay comisiones pagadas registradas.</li>`];
        const grupos = [
          { titulo: "Esta semana", items: [] },
          { titulo: "Últimas 2 semanas", items: [] },
          { titulo: "Últimos 30 días", items: [] },
          { titulo: "Más de 30 días", items: [] },
        ];
        listaPag.forEach((it) => {
          const d = diasDesdeHoy(fechaDePagada(it));
          if (d <= 7) grupos[0].items.push(it);
          else if (d <= 14) grupos[1].items.push(it);
          else if (d <= 30) grupos[2].items.push(it);
          else grupos[3].items.push(it);
        });
        const salida = [];
        grupos.forEach((g) => {
          if (!g.items.length) return;
          const subUsd = Math.round(g.items.reduce((a, x) => a + x.comision_usd, 0) * 100) / 100;
          salida.push(`<li class="com-seccion-fecha">
            <span>${esc(g.titulo)} <span class="ped-det">(${g.items.length})</span></span>
            <strong>${esc(dinero(subUsd))}</strong>
          </li>`);
          g.items.forEach((it) => salida.push(htmlItemCom(it)));
        });
        return salida;
      };

      if (estadoFiltroCom === "todas") {
        $("pLista").innerHTML = [
          `<li class="com-grupo-header"><span class="chip chip-pend">Por pagar (${pend.length})</span></li>`,
          ...(pend.length ? pend.map(htmlItemCom) : [`<li class="vacio-panel com-vacio-chico">No hay comisiones pendientes por pagar.</li>`]),
          `<li class="com-grupo-header"><span class="chip chip-ok">Pagadas (${pag.length})</span></li>`,
          ...renderPagadasPorSecciones(pag),
        ].join("");
      } else if (estadoFiltroCom === "pagadas") {
        $("pLista").innerHTML = renderPagadasPorSecciones(pag).join("");
      } else {
        $("pLista").innerHTML = comisionesVisibles.map(htmlItemCom).join("");
      }
      pintarBarraSel();
    };

    // Modal de engranaje ⚙️: configurar porcentaje por defecto (3%) y por vendedor
    const abrirConfigComision = async () => {
      cfgCom = await obtenerConfigComisiones(true);
      const pctDef = Number(cfgCom.porcentaje_default) || 3;
      const vends = Array.isArray(cfgCom.vendedores) && cfgCom.vendedores.length
        ? cfgCom.vendedores
        : [...new Set((memoria.pedidos || []).map((p) => p.vendedor).filter(Boolean))].map((n) => ({
            id: n.toLowerCase(),
            nombre: n,
            comision_pct: (cfgCom.por_vendedor && cfgCom.por_vendedor[n.toLowerCase()]) || pctDef,
          }));
      const d = await hoja({
        titulo: "⚙️ Porcentaje de comisiones",
        cuerpo: `<p class="modal-sub">Definí el porcentaje de comisión sobre los pagos conciliados (por defecto <strong>3%</strong>).</p>
          <label class="field field-full"><span>Porcentaje por defecto (%) *</span>
            <input name="pct_default" inputmode="decimal" autocomplete="off" value="${esc(formatoNumInput(pctDef))}" placeholder="3" />
          </label>
          ${vends.length ? `<fieldset class="pay"><legend>Porcentaje por vendedor</legend>
            ${vends.map((u) => `<div class="fila-manual-item">
              <div class="fila-manual-info"><strong>${esc(u.nombre)}</strong></div>
              <label class="fila-manual-inp"><input type="text" class="inp-precio-caja" name="vend_${esc(u.id)}" inputmode="decimal" value="${esc(formatoNumInput(u.comision_pct || pctDef))}" /><span>%</span></label>
            </div>`).join("")}
          </fieldset>` : ""}`,
        ok: "Guardar porcentajes",
        validar: (x) => {
          const p = montoNum(x.pct_default);
          return p > 0 && p <= 100 ? "" : "Indicá un porcentaje válido entre 0,1 y 100.";
        },
      });
      if (!d) return;
      const nuevoDef = montoNum(d.pct_default) || 3;
      const porcentajes = {};
      const nuevoMapa = {};
      vends.forEach((u) => {
        const val = montoNum(d[`vend_${u.id}`]) || nuevoDef;
        porcentajes[u.id] = val;
        nuevoMapa[u.id] = val;
        nuevoMapa[String(u.nombre || "").trim().toLowerCase()] = val;
        u.comision_pct = val;
      });
      cfgCom = { porcentaje_default: nuevoDef, por_vendedor: nuevoMapa, vendedores: vends };
      guardarLS(K_COMISION_CFG, cfgCom);
      pintar();
      try {
        const res = await api("guardarComisionConfig", { porcentaje_default: nuevoDef, porcentajes });
        if (res && res.config) { cfgCom = res.config; guardarLS(K_COMISION_CFG, cfgCom); pintar(); }
        toast("Porcentajes de comisión actualizados");
      } catch (e) {
        toast("Guardado en el teléfono · subí el nuevo Code.gs para sincronizar en la hoja");
      }
    };

    // Modal para cancelar (liquidar) una o varias comisiones al vendedor
    const liquidarComisiones = async (itemsElegidos) => {
      if (!itemsElegidos.length) return;
      const diaFmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const diaHoy = diaFmt(new Date());
      const enUsd = itemsElegidos.filter((x) => x.moneda !== "Bs");
      const enBs = itemsElegidos.filter((x) => x.moneda === "Bs");
      const totalUsdEfectivo = Math.round(enUsd.reduce((a, x) => a + x.comision_usd, 0) * 100) / 100;
      const totalBaseUsdBs = Math.round(enBs.reduce((a, x) => a + x.comision_usd, 0) * 100) / 100;
      const totalBsOrigen = Math.round(enBs.reduce((a, x) => a + x.comision_bs_origen, 0) * 100) / 100;
      // Si todos los cobros en Bs son del mismo día, por defecto seleccionamos ese día (normalmente se cancela el mismo día)
      const fechasBs = [...new Set(enBs.map((x) => x.fecha_pago).filter(Boolean))];
      const fechaCobroUnica = fechasBs.length === 1 ? fechasBs[0] : "";
      const tasaCobroUnica = fechaCobroUnica && enBs.every((x) => x.tasa_cobro === enBs[0].tasa_cobro) ? enBs[0].tasa_cobro : 0;
      const fechaInicial = fechaCobroUnica || diaHoy;
      const vendsNombres = [...new Set(itemsElegidos.map((x) => x.vendedor))].join(", ");

      let tasaComActual = fechaInicial === fechaCobroUnica && tasaCobroUnica > 0 ? tasaCobroUnica : 0;
      let montoBsTransferir = fechaInicial === fechaCobroUnica ? totalBsOrigen : 0;

      const d = await hoja({
        titulo: itemsElegidos.length === 1 ? `Cancelar comisión · ${itemsElegidos[0].pedido_id}` : `Cancelar ${itemsElegidos.length} comisiones`,
        cuerpo: `<p class="modal-sub">Vendedor: <strong>${esc(vendsNombres)}</strong> · ${itemsElegidos.length === 1 ? `Comisión del ${formatoNumInput(itemsElegidos[0].pct)}% sobre pago conciliado` : `${itemsElegidos.length} pagos conciliados seleccionados`}.</p>
          <ul class="resumen-items com-modal-lista">
            ${itemsElegidos.map((x) => `<li>
              <span><strong>${esc(x.negocio)}</strong> <span class="ped-det">${esc(x.pedido_id)} · cobrado ${esc(formatoMonto(x.monto_cobrado, x.moneda))}</span></span>
              <em>${x.moneda === "Bs" ? `${esc(dinero(x.comision_usd))} (${formatoNumInput(x.pct)}%)` : esc(dinero(x.comision_usd))}</em>
            </li>`).join("")}
          </ul>

          ${enUsd.length ? `<div class="com-liquidar-box es-usd">
            <span class="ped-det">Pago(s) recibido(s) en Efectivo → Comisión en Efectivo ($):</span>
            <strong class="com-liquidar-monto">${esc(dinero(totalUsdEfectivo))}</strong>
          </div>` : ""}

          ${enBs.length ? `<div class="com-liquidar-box es-bs">
            <span class="ped-det">Pago(s) recibido(s) en Bolívares → Comisión en Bolívares (Bs):</span>
            <fieldset class="pay com-dias-fieldset">
              <legend>¿Qué día se canceló la comisión?</legend>
              <div class="selector-tema com-dias-sel">
                ${fechaCobroUnica ? `<button type="button" data-cdia="${esc(fechaCobroUnica)}" aria-pressed="true">Mismo día del cobro (${esc(fechaLegible(fechaCobroUnica))})</button>` : ""}
                ${fechaCobroUnica !== diaHoy ? `<button type="button" data-cdia="${diaHoy}" aria-pressed="${!fechaCobroUnica}">Hoy (${esc(fechaLegible(diaHoy))})</button>` : ""}
                <button type="button" data-cdia="otro" aria-pressed="false">Otro día</button>
              </div>
              <label class="field field-full" id="cFechaWrap" hidden>
                <span>Seleccionar fecha de pago de comisión</span>
                <input type="date" id="cFechaInput" max="${diaHoy}" value="${esc(fechaInicial)}" />
              </label>
            </fieldset>
            <div class="tasa-bcv-box">
              <div class="tasa-bcv-linea">
                <span id="cTasaTexto">Consultando tasa BCV…</span>
                <button type="button" class="btn-link-chico" id="btnCEditarTasa">Editar tasa</button>
              </div>
              <label class="field field-full" id="cTasaManualWrap" hidden>
                <span>Tasa BCV (Bs por $)</span>
                <input type="text" name="tasa" id="cTasaInput" inputmode="decimal" autocomplete="off" value="${tasaComActual ? esc(formatoNumInput(tasaComActual, true)) : ""}" />
              </label>
              <div class="tasa-esperado-linea">
                <div>
                  <span class="ped-det">Monto a transferir al vendedor en Bs:</span>
                  <strong class="tasa-esperado-monto" id="cMontoBsTxt">${esc(formatoMonto(totalBsOrigen, "Bs"))}</strong>
                  <span class="ped-det" id="cDetalleBsTxt"></span>
                </div>
                <button type="button" class="btn btn-ghost btn-chico" id="btnCopiarComBs">Copiar Bs</button>
              </div>
            </div>
          </div>` : `<input type="hidden" id="cFechaInput" value="${diaHoy}" />`}

          <input type="hidden" name="fecha_comision" id="cFechaElegida" value="${esc(fechaInicial)}" />
          <label class="field field-full"><span>Referencia o nota <span class="ped-det">(opcional · pago móvil / transferencia / efectivo)</span></span>
            <input name="referencia" maxlength="80" autocomplete="off" placeholder="Ej. Ref 987654" />
          </label>`,
        ok: "Confirmar comisión pagada",
        validar: (x) => {
          if (enBs.length && !(tasaComActual > 0 || montoNum(x.tasa) > 0)) {
            return "No se encontró la tasa BCV para esa fecha. Tocá 'Editar tasa' e ingresala.";
          }
          return "";
        },
        alAbrir: (form) => {
          if (!enBs.length) return;
          let reqId = 0;
          const fElegida = form.querySelector("#cFechaElegida");
          const fWrap = form.querySelector("#cFechaWrap");
          const fInp = form.querySelector("#cFechaInput");
          const tasaTxt = form.querySelector("#cTasaTexto");
          const tasaWrap = form.querySelector("#cTasaManualWrap");
          const tasaInp = form.querySelector("#cTasaInput");
          const montoTxt = form.querySelector("#cMontoBsTxt");
          const detTxt = form.querySelector("#cDetalleBsTxt");

          const recalcularBs = () => {
            const f = fElegida.value;
            if (f === fechaCobroUnica && tasaCobroUnica > 0 && (!tasaInp.dataset.manual)) {
              tasaComActual = tasaCobroUnica;
              montoBsTransferir = totalBsOrigen;
              tasaTxt.innerHTML = `Tasa BCV del día del cobro (${esc(fechaLegible(f))}): <strong>Bs ${esc(formatoNumInput(tasaComActual, true))} / $</strong>`;
              montoTxt.textContent = formatoMonto(montoBsTransferir, "Bs");
              detTxt.textContent = `Equivale a ${dinero(totalBaseUsdBs)} (mismo día en que canceló el cliente).`;
              return;
            }
            if (tasaComActual > 0) {
              montoBsTransferir = Math.round(totalBaseUsdBs * tasaComActual * 100) / 100;
              montoTxt.textContent = formatoMonto(montoBsTransferir, "Bs");
              detTxt.textContent = `Base ${dinero(totalBaseUsdBs)} × BCV ${formatoNumInput(tasaComActual, true)} (el día del cobro eran ${formatoMonto(totalBsOrigen, "Bs")}).`;
            }
          };

          const buscarTasa = async (f) => {
            const id = ++reqId;
            if (f === fechaCobroUnica && tasaCobroUnica > 0 && !tasaInp.dataset.manual) {
              recalcularBs();
              return;
            }
            tasaTxt.textContent = "Consultando tasa BCV…";
            const info = await obtenerTasaBcv(f);
            if (id !== reqId) return;
            if (info.tasa > 0) {
              tasaComActual = info.tasa;
              tasaInp.value = formatoNumInput(info.tasa, true);
              tasaTxt.innerHTML = `Tasa BCV (${esc(fechaLegible(info.fechaEfectiva || f))}): <strong>Bs ${esc(formatoNumInput(info.tasa, true))} / $</strong>`;
              recalcularBs();
            } else {
              tasaTxt.innerHTML = `<span class="ped-det">Ingresá la tasa BCV manualmente:</span>`;
              tasaWrap.hidden = false;
            }
          };

          form.querySelector(".com-dias-sel").addEventListener("click", (e) => {
            const b = e.target.closest("[data-cdia]");
            if (!b) return;
            form.querySelectorAll(".com-dias-sel [data-cdia]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
            const otro = b.dataset.cdia === "otro";
            fWrap.hidden = !otro;
            delete tasaInp.dataset.manual;
            fElegida.value = otro ? fInp.value : b.dataset.cdia;
            buscarTasa(fElegida.value);
          });
          fInp.addEventListener("change", () => {
            if (fInp.value) {
              delete tasaInp.dataset.manual;
              fElegida.value = fInp.value;
              buscarTasa(fInp.value);
            }
          });
          form.querySelector("#btnCEditarTasa").addEventListener("click", () => {
            tasaWrap.hidden = !tasaWrap.hidden;
            if (!tasaWrap.hidden) tasaInp.focus();
          });
          tasaInp.addEventListener("input", () => {
            tasaInp.dataset.manual = "1";
            tasaComActual = montoNum(tasaInp.value);
            if (tasaComActual > 0) tasaTxt.innerHTML = `Tasa BCV aplicada: <strong>Bs ${esc(formatoNumInput(tasaComActual, true))} / $</strong>`;
            recalcularBs();
          });
          form.querySelector("#btnCopiarComBs").addEventListener("click", async () => {
            const numStr = formatoNumInput(montoBsTransferir, true);
            if (await copiarTexto(numStr)) toast(`Copiado: ${numStr}`);
          });

          buscarTasa(fechaInicial);
        },
      });
      if (!d) return;

      const fechaFinal = d.fecha_comision || fechaInicial;
      const tasaFinal = montoNum(d.tasa) || tasaComActual || 0;
      const refFinal = String(d.referencia || "").trim();

      // Guardar en respaldo local y actualizar en memoria inmediatamente
      const pagadasLocal = leerLS(K_COMISION_PAGADAS, {});
      itemsElegidos.forEach((match) => {
        const montoLiq = match.moneda === "Bs"
          ? (fechaFinal === fechaCobroUnica ? match.comision_bs_origen : Math.round(match.comision_usd * tasaFinal * 100) / 100)
          : match.comision_usd;
        pagadasLocal[match.pago_id] = {
          comision_estado: "pagada",
          comision_pct: match.pct,
          comision_usd: match.comision_usd,
          comision_moneda: match.moneda,
          comision_tasa: match.moneda === "Bs" ? tasaFinal : 0,
          comision_monto: montoLiq,
          comision_fecha: fechaFinal,
          comision_ref: refFinal,
          comision_pagada_por: yo().nombre,
        };
      });
      guardarLS(K_COMISION_PAGADAS, pagadasLocal);

      const aplicarEnLista = (listaPeds) => {
        (listaPeds || []).forEach((ped) => {
          const matchesPed = itemsElegidos.filter((x) => x.pedido_id === ped.id);
          if (!matchesPed.length) return;
          if (!Array.isArray(ped.pagos) || !ped.pagos.length) {
            ped.pagos = matchesPed.map((m) => ({
              id: m.pago_id,
              pedido_id: ped.id,
              fecha_pago: m.fecha_pago,
              moneda: m.moneda,
              monto: m.monto_cobrado,
              tasa: m.tasa_cobro,
              monto_usd: m.monto_usd,
              referencia: m.referencia_cobro,
              estado: "conciliado",
              conciliado_at: m.conciliado_at,
            }));
          }
          ped.pagos.forEach((pg) => {
            const match = matchesPed.find((x) => x.pago_id === pg.id);
            if (!match) return;
            Object.assign(pg, pagadasLocal[match.pago_id]);
          });
        });
      };
      aplicarEnLista(memoria.pedidos);
      aplicarEnLista(pedidosConc);
      itemsElegidos.forEach((x) => selCom.delete(x.pago_id));
      pintar();

      try {
        await api("pagarComision", {
          modo: "pagar",
          fecha_comision: fechaFinal,
          tasa: tasaFinal,
          referencia: refFinal,
          items: itemsElegidos.map((x) => ({ pago_id: x.pago_id, pedido_id: x.pedido_id, pct: x.pct })),
        });
        toast(itemsElegidos.length === 1 ? "Comisión marcada como pagada" : `${itemsElegidos.length} comisiones marcadas como pagadas`);
      } catch (e) {
        toast("Comisión marcada como pagada en el teléfono");
      }
    };

    // Eventos de la vista de Comisiones
    $("cEstadoTabs").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cest]");
      if (!b) return;
      estadoFiltroCom = b.dataset.cest;
      $("cEstadoTabs").querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === b));
      pintar();
    });
    const perTabs = $("cPeriodoTabs");
    if (perTabs) perTabs.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cper]");
      if (!b) return;
      periodoCom = Number(b.dataset.cper) || 0;
      perTabs.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === b));
      pintar();
    });
    const btnCfg = $("btnConfigComision");
    if (btnCfg) btnCfg.addEventListener("click", abrirConfigComision);
    const sv = $("pVend");
    if (sv) sv.addEventListener("change", () => { vendedorPed = sv.value; pintar(); });
    let tBus = null;
    $("pBuscar").addEventListener("input", (e) => { clearTimeout(tBus); tBus = setTimeout(() => { busquedaPed = e.target.value; pintar(); }, 120); });
    const chkTodos = $("cTodos");
    if (chkTodos) chkTodos.addEventListener("change", () => {
      comisionesVisibles.filter((x) => !x.pagada).forEach((x) => {
        if (chkTodos.checked) selCom.add(x.pago_id);
        else selCom.delete(x.pago_id);
      });
      pintar();
    });
    const btnLote = $("btnPagarLote");
    if (btnLote) btnLote.addEventListener("click", () => {
      const elegidas = comisionesVisibles.filter((x) => !x.pagada && selCom.has(x.pago_id));
      liquidarComisiones(elegidas);
    });
    $("pLista").addEventListener("change", (e) => {
      const chk = e.target.closest("[data-com-check]");
      if (!chk) return;
      if (chk.checked) selCom.add(chk.dataset.comCheck);
      else selCom.delete(chk.dataset.comCheck);
      pintarBarraSel();
    });
    $("pLista").addEventListener("click", async (e) => {
      const bPagar = e.target.closest("[data-com-pagar]");
      if (bPagar) {
        const it = comisionesVisibles.find((x) => x.pago_id === bPagar.dataset.comPagar);
        if (it) await liquidarComisiones([it]);
        return;
      }
      const bWa = e.target.closest("[data-com-wa]");
      if (bWa) {
        const it = comisionesVisibles.find((x) => x.pago_id === bWa.dataset.comWa);
        if (!it) return;
        const msg = textoWhastappComision([it], it.comision_fecha || it.fecha_pago, it.comision_tasa, it.comision_ref);
        const vendObj = (cfgCom && cfgCom.vendedores || []).find((u) => u.id === it.vendedor_id || u.nombre === it.vendedor);
        const tel = vendObj ? telefonoWhatsapp(vendObj.telefono) : "";
        window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
        return;
      }
      const bDes = e.target.closest("[data-com-deshacer]");
      if (bDes) {
        const it = comisionesVisibles.find((x) => x.pago_id === bDes.dataset.comDeshacer);
        if (!it) return;
        const ok = await hoja({
          titulo: "¿Volver comisión a Por pagar?",
          cuerpo: `<p class="modal-sub">La comisión de <strong>${esc(it.negocio)}</strong> (${esc(it.pedido_id)}) volverá a figurar como pendiente por pagar.</p>`,
          ok: "Sí, deshacer pago",
        });
        if (!ok) return;
        const pagadasLocal = leerLS(K_COMISION_PAGADAS, {});
        pagadasLocal[it.pago_id] = { comision_estado: "pendiente" };
        guardarLS(K_COMISION_PAGADAS, pagadasLocal);
        [memoria.pedidos, pedidosConc].forEach((l) => (l || []).forEach((ped) => (ped.pagos || []).forEach((pg) => {
          if (pg.id === it.pago_id) pg.comision_estado = "";
        })));
        pintar();
        try {
          await api("pagarComision", { modo: "deshacer", items: [{ pago_id: it.pago_id, pedido_id: it.pedido_id }] });
        } catch (_) {}
        toast("Comisión devuelta a Por pagar");
      }
    });

    const guardado = pedidosEnMemoria();
    if (guardado) { memoria.pedidos = guardado; pintar(); }
    try {
      const [_, rConc] = await Promise.all([
        Date.now() - memoria.t > 4000 ? refrescarPedidos().catch(() => {}) : Promise.resolve(),
        api("pedidos", { conciliados: true, dias: 180 }).catch(() => ({ pedidos: [] })),
      ]);
      if (!vigente()) return;
      pedidosConc = rConc.pedidos || [];
      pintar();
    } catch (_) {}
  }

  /* ---------- Pedidos web (los arma el cliente en el catálogo) ---------- */
  function filaWeb(w) {
    const monto = totalPorPago(w.items, w.tipo_pago);
    return `<li><a class="fila-ped fila-web" href="#/web/${encodeURIComponent(w.id)}">
      <div class="fila-top"><strong>${esc(w.cliente.negocio)}</strong><span class="chip-estado est-web">Pedido web</span></div>
      <div class="ped-det">${esc(w.id)} · ${esc(fechaLegible(w.fecha))}</div>
      <div class="ped-det">${w.total_cajas} caja(s)${monto ? ` · <strong>${esc(dinero(monto))}</strong>` : ""} · ${esc((pagoPorId(w.tipo_pago) || {}).nombre || "")}</div>
      ${w.vendedor ? (gestion() ? `<div class="ped-det">Para: ${esc(w.vendedor)}</div>` : "") : '<div class="ped-det"><strong>Sin vendedor</strong> · cualquier vendedor lo puede tomar</div>'}
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
        <p class="ped-det">${esc(fechaLegible(w.fecha))} · ${w.vendedor ? `eligió a <strong>${esc(w.vendedor)}</strong>` : "<strong>sin vendedor</strong>"}${c.id ? " · cliente ya registrado" : " · cliente nuevo"}</p>
        <div class="botones-contacto">
          ${tel ? `<a class="btn btn-ghost" href="tel:${esc(tel)}">Llamar</a>` : ""}
          ${wa ? `<a class="btn btn-ghost" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
          ${linkMapa(c.latitud, c.longitud) ? `<a class="btn btn-ghost" href="${esc(linkMapa(c.latitud, c.longitud))}" target="_blank" rel="noopener">Mapa</a>` : ""}
        </div>
      </section>
      ${estado ? `<p class="aviso-chico">${estado}</p>` : w.puede_tomar
        ? `<div class="acciones-ped"><button type="button" class="btn btn-primary" id="btnTomarWeb">Tomar y revisar</button><button type="button" class="btn btn-ghost" id="btnDescartarWeb">Descartar</button></div>`
        : `<p class="aviso-chico">${w.vendedor ? `Esperando a que ${esc(w.vendedor)} lo tome.` : "Sin vendedor: lo puede tomar cualquier vendedor."} Administración lo ve, pero lo toma un vendedor.</p>`}
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
      // si el cliente se buscó en el catálogo, ya viene con su id (no se duplica); y con su ubicación si la tomó
      fijarCliente({ ...(c.id ? { id: c.id } : {}), negocio: c.negocio, contacto: c.contacto, rif_cedula: c.rif_cedula, telefono: c.telefono, telefono2: "", direccion: c.direccion, latitud: c.latitud ?? "", longitud: c.longitud ?? "" });
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
      try { await api("descartarWeb", { id: w.id, motivo: d.motivo.trim() }); memoria.t = 0; toast(`${w.id} descartado`); ir("#/pedidos?tab=hacer"); }
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
    const salen = peds.filter((p) => p.estado === "confirmado" && accionesPedido(roles(), yo().id, p).includes("en_ruta"));
    const texto = [`*CARGA ${yo().nombre.toUpperCase()}* · ${t.pedidos} pedido(s) · ${t.cajas} cajas`, "",
      ...t.productos.map((x) => `• ${x.cajas} × ${x.producto} (${x.code})`), "", "*Pedidos*",
      ...peds.map((p) => `• ${p.id} · ${p.negocio} · ${cajasPendientes(p) || p.total_cajas} caja(s)`)].join("\n");
    v.innerHTML = `
      <div class="banner-prox-ruteo" data-gps-slot="despacho-ruteo"><span class="chip-prox">Próximamente</span><span>🚚 Secuencia óptima de paradas de camión (1 → N) y navegación giro a giro</span></div>
      <section class="tarjeta carga-total">
        <p class="carga-grande"><strong>${t.cajas}</strong> cajas</p>
        <p class="ped-det">${t.pedidos} pedido(s)${t.unidades ? " · " + esc(t.unidades) : ""}</p>
      </section>
      <section class="tarjeta">
        <h3 class="sub-titulo">Cargar en el vehículo</h3>
        <ul class="lista-carga">${t.productos.map((x) => `<li><label class="check"><input type="checkbox" /> <span><strong>${x.cajas}</strong> × ${esc(x.producto)} <span class="ped-det">${esc(x.code)}${x.total_unidades ? ` · ${x.total_unidades} ${esc(x.unidad)}` : ""}</span></span></label></li>`).join("")}</ul>
        <p class="nota-chica" id="cargaProg">Marcá cada producto a medida que lo subís.</p>
      </section>
      <section class="carga-lista" id="cargaListo" hidden aria-live="polite">
        <p class="carga-listo-tit">¡Completo!</p>
        ${salen.length ? `<button type="button" class="btn btn-primary btn-bloque" id="btnSalirDespacho">${icoEnt("ruta")}¡Saliendo a despachar!</button>
        <p class="nota-chica">Marca ${salen.length === 1 ? "el pedido" : `los ${salen.length} pedidos`} como <strong>Salió en ruta</strong>.</p>` : '<p class="nota-chica">Todo cargado.</p>'}
      </section>
      <section class="tarjeta">
        <h3 class="sub-titulo">Pedidos incluidos</h3>
        <ul class="resumen-items">${peds.map((p) => `<li><a href="#/pedido/${encodeURIComponent(p.id)}">${esc(p.negocio)}</a><em>${cajasPendientes(p) || p.total_cajas} caja(s)${esParcial(p) ? " · faltaban" : ""}</em></li>`).join("")}</ul>
      </section>
      <button type="button" class="btn btn-ghost btn-bloque" id="btnCompartirCarga">Compartir lista de carga</button>`;
    $("btnCompartirCarga").addEventListener("click", () => enviarAlGrupo(texto));
    // Todo marcado: ¡Completo! → salen a despachar (pasan a En ruta)
    const checks = [...v.querySelectorAll(".lista-carga input")];
    v.querySelector(".lista-carga").addEventListener("change", () => {
      const n = checks.filter((c) => c.checked).length;
      $("cargaProg").textContent = n ? `Cargado ${n} de ${checks.length}` : "Marcá cada producto a medida que lo subís.";
      const listo = n === checks.length;
      const caja = $("cargaListo");
      if (listo && caja.hidden) { caja.hidden = false; caja.classList.remove("ok-anim"); void caja.offsetWidth; caja.classList.add("ok-anim"); caja.scrollIntoView({ block: "center", behavior: "smooth" }); }
      if (!listo) caja.hidden = true;
    });
    const bs = $("btnSalirDespacho");
    if (bs) bs.addEventListener("click", async () => {
      bs.disabled = true; bs.classList.add("ocupado");
      let ok = 0;
      for (const p of salen) {
        try { const r2 = await api("estado", { pedido_id: p.id, estado: "en_ruta" }); guardarEnMemoria(r2.pedido); ok++; }
        catch (e) { toast(`${p.id}: ${e.message}`); }
      }
      if (ok) { sessionStorage.removeItem(K_CARGA); toast(ok === 1 ? "¡En ruta! Buen viaje" : `¡${ok} pedidos en ruta! Buen viaje`); ir("#/entregas"); }
      else { bs.disabled = false; bs.classList.remove("ocupado"); }
    });
  }

  /* ---------- Editar pedido (Administración): en cualquier momento hasta que pasa a cuentas por cobrar ---------- */
  const puedeEditar = (p) => gestion() && !borradoPed(p) && ["pendiente", "confirmado", "en_ruta"].includes(p.estado);
  const borradoPed = (p) => p.borrado === true || String(p.borrado) === "true";
  let filtroEditar = "elegidos";
  async function vEditarPedido(v, id, _q, vigente) {
    let p = (pedidosEnMemoria() || []).find((x) => x.id === id);
    if (!p || !p.items) p = (await api("pedido", { pedido_id: id })).pedido;
    if (!vigente()) return;
    if (!puedeEditar(p)) { v.innerHTML = `<p class="vacio-panel">Este pedido ya no se puede editar (${esc(nombreEstado(p.estado))}${p.estado === "entregado" ? ": está en cuentas por cobrar" : ""}).</p><a class="btn btn-ghost btn-bloque" href="#/pedido/${encodeURIComponent(id)}">Ver pedido</a>`; return; }
    $("appTitulo").textContent = `Editar ${p.id}`;
    const g0 = SkalaAPI.catalogoGuardado();
    if (g0) sumarProductosNuevos(g0.productos);
    const productos = [...BANOS.map((x) => ({ ...x, tipo: "banos" })), ...KITS.map((x) => ({ ...x, tipo: "kits" }))];
    const cant = {};
    (p.items || []).forEach((it) => { cant[it.code] = Number(it.cajas) || 0; });
    // los que estaban en el pedido salen primero
    productos.sort((a, b) => (cant[b.code] ? 1 : 0) - (cant[a.code] ? 1 : 0));
    let precios = {};
    const facturado = p.estado !== "pendiente";
    const avisoEstado = p.estado === "en_ruta" ? " El pedido <strong>ya salió</strong>: avisá al que lo lleva si cambian las cajas." : "";
    const tipo0 = p.tipo_pago || tipoPagoDe(p.pago);
    v.innerHTML = `
      <section class="tarjeta edit-cab">
        <div class="fila-top"><h2 class="ped-titulo">${esc(p.negocio)}</h2>${chipEstado(p.estado)}</div>
        <p class="ped-det">${esc(p.id)} · ${esc(p.vendedor)} · ${esc(fechaLegible(p.fecha))}</p>
        ${facturado ? `<p class="aviso-chico">Ya está <strong>facturado</strong>${p.factura ? ` (factura ${esc(p.factura)})` : ""}. Si cambiás productos o precios, corregí también la factura.${avisoEstado}</p>` : ""}
        <p class="nota-chica">Los datos del cliente (RIF, teléfono, dirección) se corrigen en <a href="#/cliente/${encodeURIComponent(p.cliente_id)}">su ficha</a>.</p>
      </section>
      <div class="barra-buscador-vista">
        <div class="buscador"><input type="search" id="xBuscar" placeholder="Buscar producto o código" autocomplete="off" enterkeyhint="search" /></div>
        ${selectorVistaCatHTML()}
      </div>
      <div class="periodos" id="xFiltros">${[["elegidos", "En el pedido"], ["todos", "Agregar"], ["banos", "Baños"], ["kits", "Kits"]].map(([k, t]) =>
        `<button type="button" class="tab${k === filtroEditar ? " active" : ""}" data-f="${k}">${t}</button>`).join("")}</div>
      <ul class="grilla-prod" id="xLista">${productos.map((x) => `
        <li class="pcard" data-code="${x.code}" data-tipo="${x.tipo}" data-texto="${esc((x.name + " " + x.code + " " + x.line).toLowerCase())}">
          <button type="button" class="pcard-tap" data-act="plus" aria-label="Sumar una caja de ${esc(x.name)}">
            ${fotoHTML(x.code, { ancho: 64, alto: 51 })}
            <strong>${esc(x.name)}</strong>
            <span class="pcard-sub">${x.code} · ${esc(textoUnidades(x))}</span>
            <span class="pcard-precio" data-precio></span>
          </button>
          <b class="pcard-n" aria-hidden="true"></b>
          <div class="pcard-qty">
            <button type="button" class="qty-btn" data-act="minus" aria-label="Restar una caja de ${esc(x.name)}">−</button>
            <input class="qty-input" type="number" min="0" step="1" inputmode="numeric" pattern="[0-9]*" aria-label="Cajas de ${esc(x.name)}" />
            <button type="button" class="qty-btn" data-act="plus" aria-label="Sumar una caja de ${esc(x.name)}">+</button>
          </div>
        </li>`).join("")}</ul>
      <p class="vacio-panel" id="xVacio" hidden>No hay productos con ese filtro.</p>
      <form id="fEditar" class="tarjeta" novalidate>
        <p class="nota-chica" id="xNivel"></p>
        <label class="check excepcion" id="xMayorWrap"><input type="checkbox" id="xMayor"${p.excepcion_precio ? " checked" : ""} /> Precio al mayor (excepción para este cliente)</label>
        <label class="check excepcion"><input type="checkbox" id="xPersonalizado"${p.nivel_precio === "personalizado" ? " checked" : ""} /> Precio personalizado por caja (acuerdo con el cliente)</label>
        <div id="xBoxPersonalizado" class="box-personalizado"${p.nivel_precio === "personalizado" ? "" : " hidden"}>
          <div class="fila-precio-global">
            <label class="field"><span>Mismo precio por caja ($)</span>
              <input id="xPrecioTodos" type="text" inputmode="decimal" autocomplete="off" placeholder="ej. 18,50" />
            </label>
            <button type="button" class="btn btn-ghost btn-chico" id="btnXPrecioTodos">Aplicar a todo</button>
          </div>
          <ul class="resumen-items" id="xItemsManual"></ul>
        </div>
        <fieldset class="pay"><legend>Documento</legend>
          ${["Nota de entrega", "Factura"].map((d) => `<label class="pay-opt"><input type="radio" name="xDoc" value="${d}"${(p.documento || "Nota de entrega") === d ? " checked" : ""} /> ${d}</label>`).join("")}
        </fieldset>
        <label class="field field-full"><span>Forma de pago</span><select id="xPago">${PAGOS.map((x) => `<option value="${x.id}"${x.id === tipo0 ? " selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select></label>
        <label class="field field-full" id="xDiasWrap"><span>Días de crédito</span><input id="xDias" type="number" inputmode="numeric" min="1" max="180" value="${p.dias_credito || ""}" placeholder="ej. 30" /></label>
        ${facturado ? `<label class="field field-full"><span>N° de factura</span><input id="xFactura" maxlength="40" autocomplete="off" value="${esc(p.factura || "")}" placeholder="ej. 000123" /></label>` : ""}
        <label class="field field-full"><span>Nota</span><textarea id="xNota" rows="2" maxlength="300" placeholder="Opcional">${esc(p.nota || "")}</textarea></label>
        <p class="form-warn" id="xError" hidden></p>
      </form>
      <div class="barra-accion" id="xBarra">
        <div><strong id="xTotal">0 cajas</strong><span id="xDetalle"></span></div>
        <a class="btn btn-ghost" href="#/pedido/${encodeURIComponent(p.id)}">Cancelar</a>
        <button type="button" class="btn btn-primary" id="btnGuardarEdicion">Guardar</button>
      </div>`;
    const lista = $("xLista");
    enlazarSelectorVistaCat(v, lista);
    const manualesEdit = {};
    if (p.nivel_precio === "personalizado") {
      (p.items || []).forEach((it) => { if (Number(it.precio) > 0) manualesEdit[it.code] = Number(it.precio); });
    }
    const total = () => Object.values(cant).reduce((a, n) => a + n, 0);
    const pagoSel = () => $("xPago").value;
    const pintar = (rearmarManual = true) => {
      const t = total();
      const usarManual = $("xPersonalizado").checked;
      $("xBoxPersonalizado").hidden = !usarManual;
      const nivel = nivelPrecio(t, $("xMayor").checked);
      // si no cambia el nivel (mayor/menor), se mantiene el precio con que se tomó el pedido
      const fijo = (code) => {
        if (usarManual && Number(manualesEdit[code]) > 0) return { code, precio: Number(manualesEdit[code]), desc_pronto: 0, desc_efectivo_credito: 0, desc_efectivo_pronto: 0 };
        const v0 = (p.items || []).find((it) => it.code === code);
        return v0 && Number(v0.precio) > 0 && nivel === (p.nivel_precio || "menor") ? v0 : null;
      };
      const conPrecio = Object.entries(cant).filter(([, n]) => n > 0).map(([code, cajas]) => { const f = fijo(code); return f ? { ...f, cajas } : conPrecios([{ code, cajas }], precios, nivel)[0]; });
      const monto = totalPorPago(conPrecio, pagoSel());
      const prodMap = allProductsMap();
      if (usarManual && rearmarManual) {
        $("xItemsManual").innerHTML = Object.entries(cant).filter(([, n]) => n > 0).map(([code, cajas]) => {
          const x = prodMap[code] || {};
          const itCat = conPrecios([{ code, cajas: 1 }], precios, nivel)[0];
          const baseU = precioUnitario(itCat, pagoSel());
          const val = manualesEdit[code] !== undefined && manualesEdit[code] > 0 ? String(manualesEdit[code]) : "";
          const u = Number(manualesEdit[code]) > 0 ? Number(manualesEdit[code]) : baseU;
          return `<li class="con-precio-manual">
            <span>${cajas} × ${esc(x.name || code)}</span>
            <span class="caja-precio-manual"><label class="lbl-precio-caja"><span>$</span><input type="text" inputmode="decimal" autocomplete="off" class="inp-precio-caja" data-xprecio-code="${esc(code)}" value="${esc(val)}" placeholder="${baseU ? baseU.toFixed(2) : "0.00"}" aria-label="Precio por caja de ${esc(x.name || code)}" /></label><em data-xsub-code="${esc(code)}">${u ? `<strong>${dinero(cajas * u)}</strong>` : "—"}</em></span>
          </li>`;
        }).join("");
      } else if (usarManual) {
        Object.entries(cant).filter(([, n]) => n > 0).forEach(([code, cajas]) => {
          const f = fijo(code);
          const it = f ? { ...f, cajas: 1 } : conPrecios([{ code, cajas: 1 }], precios, nivel)[0];
          const u = precioUnitario(it, pagoSel());
          const elSub = $("xItemsManual").querySelector(`[data-xsub-code="${code}"]`);
          if (elSub) elSub.innerHTML = u ? `<strong>${dinero(cajas * u)}</strong>` : "—";
        });
      }
      lista.querySelectorAll(".pcard").forEach((li) => {
        const code = li.dataset.code, q = cant[code] || 0;
        const inp = li.querySelector(".qty-input");
        if (document.activeElement !== inp) inp.value = q;
        li.classList.toggle("elegido", q > 0);
        li.querySelector(".pcard-n").textContent = q ? String(q) : "";
        const f = fijo(code);
        const it = f ? { ...f, cajas: 1 } : conPrecios([{ code, cajas: 1 }], precios, nivel)[0];
        const u = precioUnitario(it, pagoSel());
        li.querySelector("[data-precio]").textContent = u ? `${dinero(u)} / caja` : "";
      });
      const n = Object.values(cant).filter((x) => x > 0).length;
      $("xTotal").textContent = `${t} caja${t === 1 ? "" : "s"}${monto ? " · " + dinero(monto) : ""}`;
      $("xDetalle").textContent = ` · ${n} producto${n === 1 ? "" : "s"}`;
      $("xNivel").textContent = usarManual ? "Precio personalizado acordado con el cliente." : nivel === "mayor" ? (t >= CAJAS_MAYOR ? `Precio al mayor (${t} cajas).` : "Precio al mayor por excepción.") : `Precio al por menor · desde ${CAJAS_MAYOR} cajas, al mayor.`;
      $("xMayorWrap").hidden = usarManual || t >= CAJAS_MAYOR;
      $("xDiasWrap").hidden = !(pagoPorId(pagoSel()) || {}).credito;
      $("btnGuardarEdicion").disabled = !t;
      filtrar();
    };
    const filtrar = () => {
      const q = $("xBuscar").value.trim().toLowerCase();
      let vis = 0;
      lista.querySelectorAll(".pcard").forEach((li) => {
        const okF = filtroEditar === "todos" || li.dataset.tipo === filtroEditar || (filtroEditar === "elegidos" && (cant[li.dataset.code] || 0) > 0);
        const ok = okF && (!q || li.dataset.texto.includes(q));
        li.hidden = !ok; if (ok) vis++;
      });
      $("xVacio").hidden = !!vis;
    };
    const fijar = (code, n) => { n = Math.max(0, Math.min(9999, Math.floor(Number(n) || 0))); if (n) cant[code] = n; else delete cant[code]; pintar(); };
    lista.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const li = b.closest(".pcard");
      fijar(li.dataset.code, (cant[li.dataset.code] || 0) + (b.dataset.act === "plus" ? 1 : -1));
      if (b.dataset.act === "plus") { li.classList.remove("pulso"); void li.offsetWidth; li.classList.add("pulso"); }
    });
    lista.addEventListener("input", (e) => { if (e.target.classList.contains("qty-input")) fijar(e.target.closest(".pcard").dataset.code, e.target.value); });
    lista.addEventListener("focusout", (e) => { if (e.target.classList.contains("qty-input")) pintar(); });
    $("xBuscar").addEventListener("input", filtrar);
    $("xFiltros").addEventListener("click", (e) => {
      const t = e.target.closest("[data-f]");
      if (!t) return;
      filtroEditar = t.dataset.f;
      $("xFiltros").querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
      filtrar();
    });
    $("xPago").addEventListener("change", () => pintar(true));
    $("xMayor").addEventListener("change", () => pintar(true));
    $("xPersonalizado").addEventListener("change", () => pintar(true));
    $("btnXPrecioTodos").addEventListener("click", () => {
      const n = montoNum($("xPrecioTodos").value);
      if (!(n > 0)) return toast("Escribí un precio por caja válido (ej. 18,50).");
      Object.keys(cant).forEach((code) => { if (cant[code] > 0) manualesEdit[code] = n; });
      pintar(true);
      toast(`Precio de ${dinero(n)} por caja aplicado a todos los productos`);
    });
    $("xPrecioTodos").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("btnXPrecioTodos").click(); } });
    $("xItemsManual").addEventListener("input", (e) => {
      const inp = e.target.closest("[data-xprecio-code]");
      if (!inp) return;
      const code = inp.dataset.xprecioCode;
      const n = montoNum(inp.value);
      if (n > 0) manualesEdit[code] = n; else delete manualesEdit[code];
      pintar(false);
    });
    $("btnGuardarEdicion").addEventListener("click", async () => {
      const err = $("xError");
      const credito = !!(pagoPorId(pagoSel()) || {}).credito;
      const dias = Math.floor(Number($("xDias").value));
      const doc = (document.querySelector('input[name="xDoc"]:checked') || {}).value;
      const falla = !total() ? "El pedido necesita al menos un producto." : credito && !(dias >= 1 && dias <= 180) ? "Indicá los días de crédito (1 a 180)." : "";
      if (falla) { err.textContent = falla; err.hidden = false; err.scrollIntoView({ block: "center" }); return; }
      err.hidden = true;
      const prodMap = allProductsMap();
      const usarManual = $("xPersonalizado").checked;
      const items = Object.entries(cant).filter(([, n]) => n > 0).map(([code, cajas]) => {
        const x = prodMap[code] || {};
        const pm = usarManual ? montoNum(manualesEdit[code]) : 0;
        return { code, producto: x.name || code, cajas, unidades_caja: x.unidades || "", unidad: x.unidad || "unidades", ...(pm > 0 ? { precio_manual: pm } : {}) };
      });
      const btn = $("btnGuardarEdicion");
      btn.disabled = true; btn.classList.add("ocupado");
      try {
        const r = await api("editarPedido", { pedido_id: p.id, items, documento: doc, tipo_pago: pagoSel(), dias_credito: credito ? dias : 0,
          nota: $("xNota").value.trim(), precio_mayor: !usarManual && $("xMayor").checked, ...(facturado ? { factura: $("xFactura").value.trim() } : {}) });
        guardarEnMemoria(r.pedido);
        toast(r.facturado ? `${p.id} editado · recordá corregir la factura` : `${p.id} editado`);
        ir(`#/pedido/${encodeURIComponent(p.id)}`);
      } catch (e2) {
        err.textContent = e2.message; err.hidden = false; err.scrollIntoView({ block: "center" });
        btn.disabled = false; btn.classList.remove("ocupado");
      }
    });
    pintar();
    return preciosYStock((m) => { if (vigente() && $("xLista") === lista) { precios = m; pintar(); } }, null).then((m) => { if (vigente() && $("xLista") === lista) { precios = m; pintar(); } });
  }

  /* ---------- Detalle de pedido ---------- */
  const ETIQUETAS = { confirmar: "Aprobar", en_ruta: "Salió en ruta", entregado: "Entregado", cancelar: "Anular pedido", reabrir: "Volver a En proceso",
    cobrar: "Marcar cancelado (pagado)", conciliar: "Conciliar pago (recibido)", rechazar: "Pago no recibido", desconciliar: "Deshacer conciliación" };
  async function vPedido(v, id, _q, vigente) {
    // Al instante con lo que ya está en la lista; el historial llega después
    const enLista = (pedidosEnMemoria() || []).find((x) => x.id === id);
    if (enLista) dibujarPedido(v, { ...enLista, historial: null }); // el historial siempre llega fresco
    let p;
    try {
      p = (await api("pedido", { pedido_id: id })).pedido;
    } catch (e) {
      if (enLista && e instanceof ErrorRed) return;
      throw e;
    }
    if (!vigente()) return;
    guardarEnMemoria(p);
    dibujarPedido(v, p);
  }
  function dibujarPedido(v, p) {
    $("appTitulo").textContent = p.id;
    const c = p.cliente_datos || {};
    const tel = telLink(c.telefono), tel2 = telLink(c.telefono2);
    const wa = soloDespacha() ? "" : telefonoWhatsapp(c.telefono); // el despachador llama, no escribe
    const mapa = linkMapa(c.latitud, c.longitud);
    const acciones = accionesPedido(roles(), yo().id, p);
    const principal = ["confirmar", "en_ruta", "entregado", "cobrar", "conciliar"];
    const ec = estadoCredito(p);
    const conPrecio = vende() && p.items.some((it) => Number(it.precio) > 0);
    const tipoAcordado = p.tipo_pago || tipoPagoDe(p.pago);
    const pagosLista = Array.isArray(p.pagos) ? p.pagos : [];
    const tieneAjuste = p.ajuste_motivo && p.ajuste_estado !== "revertido";
    const infoCambios = tieneAjuste ? cambiosDePrecio(p) : { cambios: [], totalAntes: 0, totalAhora: 0 };
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
      ${vende() && tieneAjuste ? `<section class="tarjeta aviso-ajuste-card">
        <div class="fila-top"><strong>Cambio de precios por facturación</strong><span class="chip chip-ajuste">${p.ajuste_estado === "aprobado" || p.cobro === "conciliado" ? "Verificado" : "Reportado"}</span></div>
        ${infoCambios.cambios.length ? `<ul class="lista-cambios-precio">
          ${infoCambios.cambios.map((ch) => `<li><strong>${esc(ch.producto)}</strong> <span class="ped-det">(${esc(ch.code)} · ${ch.cajas} cj.)</span>: de <s>${esc(dinero(ch.antes))}</s> a <strong>${esc(dinero(ch.ahora))}</strong> / caja</li>`).join("")}
        </ul>
        <p class="ped-det">Total del pedido: de <s>${esc(dinero(infoCambios.totalAntes))}</s> a <strong>${esc(dinero(infoCambios.totalAhora))}</strong></p>` : ""}
        <p class="ped-det">Motivo: <strong>${esc(p.ajuste_motivo)}</strong>${p.ajuste_por ? ` · por ${esc(p.ajuste_por)}` : ""}</p>
        ${gestion() && p.ajuste_previo ? `<button type="button" class="btn btn-ghost btn-chico" id="btnRevertirAjuste">Revertir a precios originales</button>` : ""}
      </section>` : ""}
      ${vende() && (pagosLista.length > 0 || Number(p.pagado_usd) > 0) ? `<section class="tarjeta">
        <h3 class="sub-titulo">Pagos y abonos registrados</h3>
        <ul class="lista-abonos">
          ${pagosLista.map((pg) => `<li class="abono-item">
            <div class="abono-top">
              <strong>${esc(formatoMonto(pg.monto, pg.moneda))}${pg.moneda === "Bs" && pg.monto_usd ? ` <span class="ped-det">(${esc(dinero(pg.monto_usd))} a tasa BCV ${esc(String(pg.tasa).replace(".", ","))})</span>` : ""}</strong>
              <span class="chip ${pg.estado === "conciliado" ? "chip-ok" : "chip-pend"}">${pg.estado === "conciliado" ? "Conciliado" : "Por conciliar"}</span>
            </div>
            <div class="ped-det">
              ${pg.fecha_pago ? `Fecha pago: ${esc(fechaLegible(pg.fecha_pago))} · ` : ""}Reportó: ${esc(pg.registrado_por || "—")}${pg.referencia ? ` · Ref: ${esc(pg.referencia)}` : ""}${pg.conciliado_por ? ` · Concilió: ${esc(pg.conciliado_por)}` : ""}
            </div>
          </li>`).join("")}
        </ul>
        <div class="abonos-resumen">
          <span>Abonado: <strong>${esc(dinero(p.pagado_usd || 0))}</strong></span>
          <span>Saldo pendiente: <strong>${esc(dinero(p.saldo != null ? p.saldo : Math.max(0, (Number(p.total_final || p.total) || 0) - (Number(p.pagado_usd) || 0))))}</strong></span>
        </div>
      </section>` : ""}
      <section class="tarjeta">
        <h3 class="sub-titulo">Productos</h3>
        <table class="tabla"><thead><tr><th>Producto</th><th>Cajas</th>${conPrecio ? '<th class="num">Precio</th>' : ""}</tr></thead><tbody>
          ${p.items.map((it) => `<tr><td>${esc(it.producto)} <span class="ped-det">${esc(it.code)}${it.total_unidades ? ` · ${it.total_unidades} ${esc(it.unidad)}` : ""}</span></td><td>${it.cajas}</td>${conPrecio ? `<td class="num">${it.precio ? dinero(precioUnitario(it, tipoAcordado)) : "—"}</td>` : ""}</tr>`).join("")}
        </tbody></table>
        <p class="total-ped"><strong>Total: ${p.total_cajas} caja${p.total_cajas === 1 ? "" : "s"}</strong>${p.detalle_unidades ? ` · ${esc(p.detalle_unidades)}` : ""}</p>
        ${conPrecio ? `<p class="monto-ped" id="dMonto"><strong>${dinero(totalPorPago(p.items, tipoAcordado))}</strong> · ${esc((pagoPorId(tipoAcordado) || {}).nombre || p.pago)} · ${textoNivelPrecio(p)}</p>` : ""}
        ${conPrecio && p.tipo_pago_real && p.tipo_pago_real !== tipoAcordado ? `<p class="monto-ped cambio" id="dMontoReal">Pagó como <strong>${esc(pagoPorId(p.tipo_pago_real).nombre)}</strong>: ${dinero(totalPorPago(p.items, p.tipo_pago_real))}</p>` : ""}
        <dl class="datos">
          <dt>Fecha</dt><dd>${esc(fechaLegible(p.fecha))}</dd>
          ${p.estado === "entregado" && p.entregado_at ? `<dt>Entregado</dt><dd>${esc(new Date(p.entregado_at).toLocaleDateString("es-VE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }))}${p.entregado_por ? ` · ${esc(p.entregado_por)}` : ""}</dd>` : ""}
          <dt>Vendedor</dt><dd>${esc(p.vendedor)}</dd>
          ${gestion() ? `<dt>RIF</dt><dd>${esc(c.rif_cedula || "—")}</dd><dt>Teléfono</dt><dd>${esc([c.telefono, c.telefono2].filter(Boolean).join(" / ") || "—")}</dd>` : ""}
          ${p.factura ? `<dt>Factura</dt><dd>${esc(p.factura)}</dd>` : ""}
          ${p.nota_credito ? `<dt>Nota de crédito</dt><dd><strong>${esc(dinero(p.nota_credito))}</strong> · por cajas que volvieron al depósito</dd>` : ""}
          ${p.estado !== "entregado" && esParcial(p) ? `<dt>Entrega</dt><dd>Parcial · faltan ${cajasPendientes(p)} caja(s)</dd>` : ""}
          ${p.documento ? `<dt>Documento</dt><dd>${esc(p.documento)}</dd>` : ""}
          ${p.pago ? `<dt>Pago</dt><dd>${esc(p.pago)}${p.dias_credito ? ` · ${p.dias_credito} días` : ""}</dd>` : ""}
          ${ec && ec.vence ? `<dt>Vence</dt><dd>${esc(ec.vence.split("-").reverse().join("/"))}</dd>` : ""}
          ${p.cobro ? `<dt>Cobro</dt><dd>${p.monto ? `<strong>${esc(formatoMonto(p.monto, p.moneda))}</strong> · ` : ""}${p.cobro === "conciliado" ? `Conciliado por ${esc(p.conciliado_por)}` : `Cancelado (reportó ${esc(p.cobrado_por)}) · por conciliar`}</dd>` : ""}
          ${p.nota ? `<dt>Nota</dt><dd>${esc(p.nota)}</dd>` : ""}
          ${p.motivo ? `<dt>Motivo</dt><dd>${esc(p.motivo)}</dd>` : ""}
        </dl>
      </section>
      ${puedeEditar(p) ? `<a class="btn btn-ghost btn-bloque" id="btnEditarPed" href="#/editar/${encodeURIComponent(p.id)}">Editar pedido</a>` : ""}
      ${p.estado === "pendiente" && (gestion() || String(p.vendedor_id) === String(yo().id)) ? '<button type="button" class="btn btn-ghost btn-bloque btn-corregir-cli" id="btnCorregirClientePed">🔄 ¿Te equivocaste de cliente? Cambiar cliente</button>' : ""}
      <button type="button" class="btn btn-ghost btn-bloque" id="btnReenviar">Reenviar al grupo de WhatsApp</button>
      ${puedeBorrar(roles(), yo().id, p) ? '<button type="button" class="btn btn-ghost btn-bloque btn-peligro" id="btnBorrarPed">Borrar pedido</button>' : ""}
      ${p.historial === null ? `<section class="tarjeta"><h3 class="sub-titulo">Historial</h3>${spin("Cargando historial…")}</section>` : ""}
      ${p.historial && p.historial.length ? `<section class="tarjeta"><h3 class="sub-titulo">Historial</h3><ol class="historial">${p.historial.map((h) =>
        `<li><strong>${esc({ creado: "Enviado (en proceso)", reasignado: "Despachador cambiado", pendiente: "Vuelto a En proceso", confirmado: "Aprobado",
          cobrado: "Cancelado (pago reportado)", abono: "Abono reportado", conciliado: "Pago conciliado", abono_conciliado: "Abono conciliado",
          ajuste_precio: "Ajuste de precios por facturación", ajuste_revertido: "Precios originales restaurados",
          comision_pagada: "Comisión pagada al vendedor", comision_deshecha: "Pago de comisión revertido",
          cliente_cambiado: "Cliente del pedido corregido",
          borrado: "Borrado", entregado: "Entregado", entrega_parcial: "Entrega parcial", editado: "Editado", pago_rechazado: "Pago no recibido", conciliacion_deshecha: "Conciliación deshecha" }[h.accion] || nombreEstado(h.accion))}</strong> · ${esc(h.usuario)}<br><span class="ped-det">${esc(new Date(h.fecha).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" }))}${h.detalle ? " · " + esc(h.detalle) : ""}</span></li>`).join("")}</ol></section>` : ""}`;

    $("btnReenviar").addEventListener("click", () => enviarAlGrupo(mensajeGrupo(p, c)));
    const btnCorrCli = $("btnCorregirClientePed");
    if (btnCorrCli) btnCorrCli.addEventListener("click", async () => {
      const rc = await corregirClientePedido(p);
      if (rc) render();
    });
    const btnRev = $("btnRevertirAjuste");
    if (btnRev) btnRev.addEventListener("click", async () => {
      const ok = await hoja({
        titulo: `¿Revertir cambio de precios en ${p.id}?`,
        cuerpo: `<p class="modal-sub">Se restaurarán los precios originales que tenía el pedido antes del ajuste de <strong>${esc(p.ajuste_por || "vendedor")}</strong> (${esc(p.ajuste_motivo)}).</p>`,
        ok: "Sí, restaurar precios",
      });
      if (!ok) return;
      try {
        const rc = await api("cobro", { pedido_id: p.id, accion: "revertir_ajuste" });
        guardarEnMemoria(rc.pedido);
        toast("Precios originales restaurados");
        render();
      } catch (e) { toast(e.message); }
    });
    const bb = $("btnBorrarPed");
    if (bb) bb.addEventListener("click", async () => {
      const d = await hoja({
        titulo: `¿Borrar ${p.id}?`,
        cuerpo: `<p class="modal-sub">Sale de las listas, los totales y el inventario. Queda guardado en la hoja y en el historial.</p>
          <label class="field field-full"><span>¿Por qué se borra?</span><textarea name="motivo" rows="2" maxlength="200" placeholder="Ej. era un pedido de prueba"></textarea></label>`,
        ok: "Borrar pedido", validar: (x) => (x.motivo.trim() ? "" : "Escribí el motivo."),
      });
      if (!d) return;
      try {
        await api("borrarPedido", { pedido_id: p.id, motivo: d.motivo.trim() });
        if (memoria.pedidos) memoria.pedidos = memoria.pedidos.filter((x) => x.id !== p.id);
        memoria.t = 0;
        toast(`${p.id} borrado`); ir("#/pedidos");
      }
      catch (e) { toast(e.message); }
    });
    v.querySelectorAll("[data-acc]").forEach((b) => b.addEventListener("click", () => accionPedido(p, b.dataset.acc)));
  }

  /* Aprobar = ya se hizo la factura. N° de factura opcional (uno por pedido). Devuelve la lista de números o null. */
  async function hojaAprobar(ps) {
    const uno = ps.length === 1;
    const cajas = ps.reduce((a, p) => a + (Number(p.total_cajas) || 0), 0);
    const r = await hoja({
      titulo: uno ? `Aprobar ${ps[0].id}` : `Aprobar ${ps.length} pedidos`,
      cuerpo: `<p class="modal-sub">${uno ? `${esc(ps[0].negocio)} · ${cajas} caja(s)` : `${ps.length} pedidos · ${cajas} cajas`}.
          Aprobar = <strong>ya se hizo la factura</strong>; pasa a <strong>Aprobado · Por despachar</strong>.</p>
        ${ps.map((p, i) => `<label class="field field-full"><span>N° de factura${uno ? "" : ` · ${esc(p.negocio)} <span class="ped-det">${esc(p.id)}</span>`} <span class="ped-det">(opcional)</span></span>
          <input name="factura_${i}" maxlength="40" autocomplete="off" placeholder="ej. 000123" /></label>`).join("")}`,
      ok: uno ? "Aprobado" : `Aprobar ${ps.length}`,
    });
    return r ? ps.map((_, i) => String(r[`factura_${i}`] || "").trim()) : null;
  }

  /* Entrega con diferencias: por producto, cuántas recibió el cliente y qué pasa con lo que falta */
  function difsHtml(p) {
    const pend = (p.items || []).filter((it) => cajasPorEntregar(it) > 0);
    if (!pend.length) return "";
    return `<fieldset class="pay"><legend>¿Se entregó todo?</legend>
        <div class="selector-tema entrega-tipo">
          <button type="button" data-ent-tipo="0" aria-pressed="true">Sí, completo</button>
          <button type="button" data-ent-tipo="1" aria-pressed="false">Con diferencias</button>
        </div>
        <div id="hDifs" class="difs" hidden>
          <p class="nota-chica">¿Cuántas cajas recibió el cliente de cada producto?</p>
          ${pend.map((it) => { const max = cajasPorEntregar(it); return `<div class="dif-fila" data-code="${esc(it.code)}" data-max="${max}">
            <span class="dif-prod"><strong>${esc(it.producto)}</strong><span class="ped-det">${esc(it.code)} · ${Number(it.entregadas) ? "faltaban" : "pedidas"} ${max}</span></span>
            <input type="number" class="dif-n" min="0" max="${max}" step="1" inputmode="numeric" value="${max}" aria-label="Cajas de ${esc(it.producto)} que recibió" />
            <span class="dif-falta ped-det" hidden></span>
            <select class="dif-destino" hidden aria-label="Qué pasa con lo que falta de ${esc(it.producto)}">
              <option value="despues">Se entrega después</option>
              <option value="devuelve">No se entrega · vuelve al depósito</option>
            </select>
          </div>`; }).join("")}
          <label class="field field-full"><span>¿Qué pasó?</span><input name="motivo_entrega" maxlength="200" autocomplete="off" placeholder="ej. faltó cargar una caja · no la quiso · llegó dañada" /></label>
          <p class="nota-chica"><strong>Se entrega después</strong>: queda pendiente en el mismo pedido y factura (vuelve a Por despachar).
            <strong>No se entrega</strong>: vuelve al depósito y baja el monto; hace falta una nota de crédito.</p>
        </div>
        <input type="hidden" name="con_difs" value="0" />
        <input type="hidden" name="diferencias" value="[]" />
      </fieldset>`;
  }
  function enlazarDifs(form) {
    const caja = form.querySelector("#hDifs");
    if (!caja) return;
    const conDifs = form.querySelector('[name="con_difs"]'), json = form.querySelector('[name="diferencias"]');
    const leer = () => {
      const difs = [];
      caja.querySelectorAll(".dif-fila").forEach((f) => {
        const max = Number(f.dataset.max), inp = f.querySelector(".dif-n");
        let n = Math.round(Number(inp.value));
        if (!isFinite(n) || inp.value === "") n = max;
        n = Math.max(0, Math.min(max, n));
        const falta = max - n, sel = f.querySelector(".dif-destino"), txt = f.querySelector(".dif-falta");
        sel.hidden = !falta; txt.hidden = !falta;
        txt.textContent = falta === 1 ? "Falta 1 caja. ¿Qué pasa con ella?" : falta ? `Faltan ${falta} cajas. ¿Qué pasa con ellas?` : "";
        f.classList.toggle("con-falta", !!falta);
        if (falta) difs.push({ code: f.dataset.code, entregadas: n, destino: sel.value });
      });
      json.value = JSON.stringify(difs);
    };
    form.querySelector(".entrega-tipo").addEventListener("click", (e) => {
      const b = e.target.closest("[data-ent-tipo]");
      if (!b) return;
      form.querySelectorAll("[data-ent-tipo]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      conDifs.value = b.dataset.entTipo;
      caja.hidden = b.dataset.entTipo !== "1";
      $("hojaOk").textContent = b.dataset.entTipo === "1" ? "Guardar entrega" : "Sí, entregado";
      leer();
    });
    caja.addEventListener("input", leer);
    caja.addEventListener("change", leer);
  }
  function validarDifs(d) {
    if (d.con_difs !== "1") return "";
    if (!JSON.parse(d.diferencias || "[]").length) return "Indicá qué producto llegó incompleto (o elegí Sí, completo).";
    if (!String(d.motivo_entrega || "").trim()) return "Escribí qué pasó.";
    return "";
  }

  /* Datos para hacer la factura (se copian de una vez) */
  function textoFactura(p) {
    const c = p.cliente_datos || {};
    const tipo = p.tipo_pago || tipoPagoDe(p.pago);
    const items = p.items || [];
    const conPrecio = items.some((it) => Number(it.precio) > 0);
    return [`PEDIDO ${p.id} · ${p.documento || "Nota de entrega"}`,
      `Cliente: ${p.negocio}${p.cliente && p.cliente !== p.negocio ? ` (${p.cliente})` : ""}`,
      c.rif_cedula ? `RIF/Cédula: ${c.rif_cedula}` : "RIF/Cédula: —",
      `Teléfono: ${[c.telefono, c.telefono2].filter(Boolean).join(" / ") || "—"}`,
      `Dirección: ${c.direccion || "—"}`,
      `Pago: ${(pagoPorId(tipo) || {}).nombre || p.pago || ""}${p.dias_credito ? ` · ${p.dias_credito} días` : ""} · ${textoNivelPrecio(p)}`,
      "",
      ...items.map((it) => `${it.cajas} × ${it.producto} (${it.code})${conPrecio ? ` · ${dinero(precioUnitario(it, tipo))} c/u = ${dinero(it.cajas * precioUnitario(it, tipo))}` : ""}`),
      "",
      `Total: ${p.total_cajas} cajas${conPrecio ? ` · ${dinero(totalPorPago(items, tipo))}` : ""}`,
      `Vendedor: ${p.vendedor}`,
      p.nota ? `Nota: ${p.nota}` : ""].filter((l, i, a) => l !== "" || (a[i - 1] !== "" && i < a.length - 1)).join("\n").trim();
  }
  async function copiarTexto(t) {
    try { await navigator.clipboard.writeText(t); return true; }
    catch (e) {
      const a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.position = "fixed"; a.style.opacity = "0";
      document.body.appendChild(a); a.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch (_) {}
      a.remove(); return ok;
    }
  }

  async function accionPedido(p, acc, boton) {
    if (["cobrar", "conciliar", "rechazar", "desconciliar"].includes(acc)) return accionCobro(p, acc);
    let estado = acc, extra = {};
    if (acc === "confirmar") {
      const facturas = await hojaAprobar([p]);
      if (!facturas) return;
      estado = "confirmado";
      extra.factura = facturas[0];
    } else if (acc === "cancelar") {
      const r = await hoja({
        titulo: `Anular ${p.id}`,
        cuerpo: '<label class="field field-full"><span>Motivo de la anulación</span><textarea name="motivo" rows="3" maxlength="200" placeholder="Ej. sin stock, cliente no confirmó el pago"></textarea></label>',
        ok: "Anular pedido",
        validar: (d) => (d.motivo.trim() ? "" : "Escribí el motivo."),
      });
      if (!r) return;
      estado = "cancelado"; extra.motivo = r.motivo.trim();
    } else if (acc === "entregado") {
      // fecha de entrega: hoy, o un día anterior si se olvidó registrarlo
      const dia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const hoy = dia(new Date()), ayer = dia(new Date(Date.now() - 86400000));
      const desde = p.created_at ? dia(new Date(p.created_at)) : "";
      const r = await hoja({
        titulo: `¿Marcar ${p.id} como entregado?`,
        cuerpo: `<p class="modal-sub">Confirmá que el cliente recibió el pedido.</p>
          ${difsHtml(p)}
          <fieldset class="pay"><legend>¿Cuándo se entregó?</legend>
            <div class="selector-tema dias-entrega">
              <button type="button" data-dia="${hoy}" aria-pressed="true">Hoy</button>
              ${!desde || ayer >= desde ? `<button type="button" data-dia="${ayer}" aria-pressed="false">Ayer</button>` : ""}
              <button type="button" data-dia="otro" aria-pressed="false">Otro día</button>
            </div>
            <label class="field field-full" id="hFechaWrap" hidden><span>Fecha de entrega</span>
              <input type="date" id="hFecha" max="${hoy}"${desde ? ` min="${desde}"` : ""} value="${hoy}" /></label>
          </fieldset>
          <input type="hidden" name="fecha_entrega" id="hFechaElegida" value="${hoy}" />`,
        ok: "Sí, entregado",
        alAbrir: (form) => {
          const elegida = form.querySelector("#hFechaElegida"), fecha = form.querySelector("#hFecha");
          form.querySelector(".dias-entrega").addEventListener("click", (e) => {
            const b = e.target.closest("[data-dia]");
            if (!b) return;
            form.querySelectorAll(".dias-entrega [data-dia]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
            const otro = b.dataset.dia === "otro";
            form.querySelector("#hFechaWrap").hidden = !otro;
            elegida.value = otro ? fecha.value : b.dataset.dia;
            if (otro) fecha.focus();
          });
          fecha.addEventListener("input", () => { elegida.value = fecha.value; });
          enlazarDifs(form);
        },
        validar: (d) => {
          const err = validarDifs(d);
          if (err) return err;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha_entrega || "")) return "Elegí la fecha de entrega.";
          if (d.fecha_entrega > hoy) return "La fecha no puede ser futura.";
          if (desde && d.fecha_entrega < desde) return "La fecha no puede ser anterior al pedido.";
          return "";
        },
      });
      if (!r) return;
      estado = "entregado";
      extra.fecha_entrega = r.fecha_entrega;
      if (r.con_difs === "1") { extra.diferencias = JSON.parse(r.diferencias || "[]"); extra.motivo_entrega = (r.motivo_entrega || "").trim(); }
    } else if (acc === "reabrir") {
      const r = await hoja({
        titulo: `¿Volver ${p.id} a En proceso?`,
        cuerpo: '<p class="modal-sub">Vuelve a Por aprobar.</p>',
        ok: "Volver a En proceso",
      });
      if (!r) return;
      estado = "pendiente";
    }
    const btn = boton || document.querySelector(`[data-acc="${acc}"]`);
    if (btn) { btn.disabled = true; btn.classList.add("ocupado"); }
    try {
      const r = await api("estado", { pedido_id: p.id, estado, ...extra });
      guardarEnMemoria(r.pedido);
      const quedan = acc === "entregado" && r.pedido.estado !== "entregado" ? cajasPendientes(r.pedido) : 0;
      toast(quedan ? `${p.id}: entrega parcial · quedan ${quedan} caja${quedan === 1 ? "" : "s"} por entregar`
        : r.pedido.nota_credito && acc === "entregado" ? `${p.id}: entregado · nota de crédito ${dinero(r.pedido.nota_credito)}`
        : `${p.id}: ${nombreEstado(estado)}`);
      render();
    } catch (e) {
      toast(e.message);
    }
  }

  async function accionCobro(p, acc) {
    if (acc === "cobrar") iniciarCapturaGpsSilenciosa(); // lectura GPS en segundo plano para el canal "en persona"
    const textos = {
      cobrar: [`¿Cómo cancelaron ${p.id}?`, "Indicá si fue en efectivo ($) o en Bs, la fecha del pago y el monto recibido. Si cubre el total queda como <strong>Cancelado completo</strong>; si es menor, se registrará como un <strong>Abono</strong>.", "Sí, canceló completo"],
      conciliar: [`Conciliar pago · ${p.id}`, "Verificá los datos del pago reportado por el vendedor. Si todo está correcto, tocá <strong>Es correcto · Conciliar</strong>.", "✓ Es correcto · Conciliar"],
      desconciliar: [`¿Deshacer la conciliación de ${p.id}?`, "Vuelve a Cancelado · por conciliar.", "Deshacer"],
    };
    let extra = {};
    if (acc === "cobrar" || acc === "conciliar") {
      const [titulo, cuerpo, ok] = textos[acc];
      const diaFmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const diaHoy = diaFmt(new Date());
      const pagosLista = Array.isArray(p.pagos) ? p.pagos : [];
      const pagosRep = pagosLista.filter((x) => x.estado === "reportado");
      const ultRep = acc === "conciliar" && pagosRep.length ? pagosRep[pagosRep.length - 1] : null;
      const pagadoPrevioUsd = acc === "conciliar"
        ? Math.round(pagosLista.filter((x) => x.estado === "conciliado").reduce((a, x) => a + (Number(x.monto_usd) || 0), 0) * 100) / 100
        : Math.round((pagosLista.length ? pagosLista.filter((x) => x.estado !== "rechazado").reduce((a, x) => a + (Number(x.monto_usd) || 0), 0) : (Number(p.pagado_usd) || 0)) * 100) / 100;
      const mon = (ultRep && ultRep.moneda) || p.moneda || monedaDePago(p.pago);
      const montoRepNum = Number((ultRep && ultRep.monto) || p.monto) || 0;
      const previo = acc === "conciliar" && montoRepNum > 0 ? formatoNumInput(montoRepNum, mon === "Bs") : "";
      const fechaIni = (ultRep && ultRep.fecha_pago) || diaHoy;
      const tasaIni = ultRep && Number(ultRep.tasa) > 0 ? Number(ultRep.tasa) : 0;
      const refIni = (ultRep && ultRep.referencia) || "";
      const conPrecio = p.items.some((it) => Number(it.precio) > 0);
      const acordado = p.tipo_pago || tipoPagoDe(p.pago);
      const elegido = (ultRep && ultRep.tipo_pago_real) || p.tipo_pago_real || acordado;
      const vigente = prontoVigente(p.entregado_at);
      const limite = limitePronto(p.entregado_at);
      const preciosAjustados = {}; // { code: nuevoPrecio } si el vendedor corrige precios por error en facturación

      // En Conciliar: si ya hay un monto reportado por el vendedor, mostrar la ventana emergente directa de confirmación
      const vistaDirectaConciliar = acc === "conciliar" && montoRepNum > 0;
      const tieneAjustePrev = p.ajuste_motivo && p.ajuste_estado !== "revertido";
      const infoCambios = tieneAjustePrev ? cambiosDePrecio(p) : { cambios: [], totalAntes: 0, totalAhora: 0 };
      const totActualPed = totalPorPago(p.items || [], elegido);
      const evInicial = evaluarCobro({ totalUsd: totActualPed, pagadoPrevioUsd, monto: montoRepNum, moneda: mon, tasa: tasaIni });

      const itemsConAjuste = () => (p.items || []).map((it) => {
        const nuevo = preciosAjustados[it.code];
        if (nuevo > 0) return { ...it, precio: nuevo, desc_pronto: 0, desc_efectivo_credito: 0, desc_efectivo_pronto: 0 };
        return it;
      });
      const hayAjustePrecios = () => Object.keys(preciosAjustados).length > 0;

      const r = await hoja({
        titulo,
        cuerpo: `<p class="modal-sub">${cuerpo}</p>
          ${pagadoPrevioUsd > 0 ? `<div class="aviso-abono-previo">Abonado anteriormente: <strong>${esc(dinero(pagadoPrevioUsd))}</strong></div>` : ""}

          ${vistaDirectaConciliar ? `<div class="conciliar-resumen-card" id="hVistaResumenConciliar">
            <div class="conciliar-monto-principal">
              <span class="ped-det">El vendedor <strong>${esc((ultRep && ultRep.registrado_por) || p.cobrado_por || p.vendedor || "")}</strong> indicó que el cliente canceló:</span>
              <strong>${esc(formatoMonto(montoRepNum, mon))}</strong>
              <span class="chip ${evInicial.completo ? "chip-ok" : "chip-pend"}" id="hConcChipEstado">${evInicial.completo ? "✓ Canceló completo" : "⚠️ Abono parcial"}</span>
            </div>
            <dl class="datos conciliar-datos-lista">
              <dt>Modalidad</dt><dd><strong>${mon === "Bs" ? "Bolívares (Bs)" : "Efectivo / Dólares ($)"}</strong> · ${esc((pagoPorId(elegido) || {}).nombre || p.pago)}</dd>
              ${mon === "Bs" ? `
                <dt>Fecha pago</dt><dd><strong>${esc(fechaLegible(fechaIni))}</strong></dd>
                <dt>Tasa BCV</dt><dd id="hConcTasaVal">${tasaIni > 0 ? `<strong>Bs ${esc(formatoNumInput(tasaIni, true))} / $</strong>` : "Consultando…"}</dd>
                <dt>Al cambio</dt><dd id="hConcUsdVal"><strong>${evInicial.montoUsd > 0 ? esc(dinero(evInicial.montoUsd)) : "—"}</strong> <span class="ped-det">(de ${esc(dinero(evInicial.saldoBaseUsd))} del pedido)</span></dd>
                <dt>Referencia</dt><dd>${refIni ? `<strong>${esc(refIni)}</strong>` : '<span class="ped-det">No indicada</span>'}</dd>
              ` : `
                <dt>Total pedido</dt><dd><strong>${esc(dinero(evInicial.saldoBaseUsd))}</strong>${!evInicial.completo ? ` · restan <strong>${esc(dinero(evInicial.restanteUsd))}</strong>` : ""}</dd>
              `}
            </dl>
            ${tieneAjustePrev ? `<div class="aviso-ajuste-modal">
              <strong>⚠️ Cambio de precios por facturación${p.ajuste_por ? ` (${esc(p.ajuste_por)})` : ""}:</strong>
              ${infoCambios.cambios.length ? `<ul class="lista-cambios-precio">
                ${infoCambios.cambios.map((ch) => `<li><strong>${esc(ch.producto)}</strong> (${esc(ch.code)} · ${ch.cajas} cj.): de <s>${esc(dinero(ch.antes))}</s> a <strong>${esc(dinero(ch.ahora))}</strong> / caja</li>`).join("")}
              </ul>
              <span class="ped-det">Total factura: de <s>${esc(dinero(infoCambios.totalAntes))}</s> a <strong>${esc(dinero(infoCambios.totalAhora))}</strong></span>` : ""}
              <span>Motivo: <strong>«${esc(p.ajuste_motivo)}»</strong></span>
            </div>` : ""}
            <div class="conciliar-corregir-bar">
              <button type="button" class="btn-link-chico" id="btnAbrirEdicionConciliar">¿Recibiste un monto distinto? Corregir datos</button>
            </div>
          </div>` : ""}

          <div id="hFormCompletoCobro" ${vistaDirectaConciliar ? "hidden" : ""}>
            <fieldset class="pay pagos" id="hPagos"><legend>Condición de pago <span class="ped-det">(acordado: ${esc((pagoPorId(acordado) || {}).nombre || p.pago)})</span></legend>
              ${totalesPorPago(p.items).map((pg) => `<label class="pay-opt pago-opt"><input type="radio" name="tipo_pago_real" value="${pg.id}"${pg.id === elegido ? " checked" : ""} />
                <span class="pago-txt"><strong>${esc(pg.nombre)}</strong>${pg.id === acordado ? "<span>Lo acordado</span>" : ""}</span>
                ${conPrecio ? `<span class="pago-monto" data-pago-monto="${pg.id}"><strong>${dinero(pg.total)}</strong></span>` : ""}</label>`).join("")}
              ${!vigente && limite ? `<p class="form-warn" id="hProntoAviso" hidden>El plazo de pronto pago venció el ${esc(limite.toLocaleDateString("es-VE"))}. Aplicalo solo si lo autorizaron.</p>` : ""}
            </fieldset>

            ${acc === "cobrar" ? `<div class="ajuste-cobro-wrap">
              <button type="button" class="btn btn-ghost btn-bloque btn-ajuste-toggle" id="btnToggleAjuste" aria-expanded="false">✏️ Cambiar precios por error en facturación</button>
              <div class="box-ajuste-cobro" id="hBoxAjuste" hidden>
                <p class="nota-chica">Modificá el precio por caja de los productos con diferencia en la factura e indicá el motivo obligatorio.</p>
                <div class="manual-todos-bar">
                  <input type="text" id="hPrecioTodos" inputmode="decimal" autocomplete="off" placeholder="Mismo precio por caja ($)" />
                  <button type="button" class="btn btn-ghost" id="btnHPrecioTodos">Aplicar a todos</button>
                </div>
                <div class="lista-manual-items" id="hItemsAjuste">
                  ${(p.items || []).map((it) => {
                    const u = precioUnitario(it, elegido);
                    return `<div class="fila-manual-item">
                      <div class="fila-manual-info">
                        <strong>${esc(it.producto)}</strong>
                        <span class="ped-det">${esc(it.code)} · ${it.cajas} caja${it.cajas === 1 ? "" : "s"} · orig. ${esc(dinero(u))}</span>
                      </div>
                      <label class="fila-manual-inp">
                        <span>$ / caja</span>
                        <input type="text" class="inp-precio-caja" data-cprecio-code="${esc(it.code)}" data-orig="${u}" inputmode="decimal" autocomplete="off" value="${esc(formatoNumInput(u))}" />
                      </label>
                    </div>`;
                  }).join("")}
                </div>
                <div class="resumen-cambios-vivo" id="hResumenCambiosVivo" hidden></div>
                <label class="field field-full"><span>Motivo del cambio de precios *</span>
                  <textarea name="ajuste_motivo" id="hAjusteMotivo" rows="2" maxlength="250" placeholder="Ej. Error en facturación: se facturó a precio distinto"></textarea>
                </label>
                <button type="button" class="btn btn-ghost btn-chico" id="btnResetAjuste" hidden>Restaurar precios sin cambios</button>
              </div>
            </div>` : ""}

            ${acc === "cobrar" ? fieldsetCanalHTML("hCanalCobro", "canal_cobro", "¿Cómo recibiste o gestionaste este pago? *", canalSugerido(p.cliente_datos || {}, fixVigente(), carteraGps())) : ""}

            <fieldset class="pay moneda"><legend>¿Cómo cancelaron?</legend>
              <label class="pay-opt"><input type="radio" name="moneda" value="USD"${mon !== "Bs" ? " checked" : ""} /> Efectivo / Dólares ($)</label>
              <label class="pay-opt"><input type="radio" name="moneda" value="Bs"${mon === "Bs" ? " checked" : ""} /> Bolívares (Bs)</label>
            </fieldset>

            <div class="box-bs" id="hBoxBs" ${mon === "Bs" ? "" : "hidden"}>
              <label class="field field-full"><span>Fecha del pago en Bs *</span>
                <input type="date" name="fecha_pago" id="hFechaPago" max="${diaHoy}" value="${esc(fechaIni)}" />
              </label>
              <div class="tasa-bcv-box" id="hTasaBox">
                <div class="tasa-bcv-linea">
                  <span id="hTasaTexto">Consultando tasa BCV…</span>
                  <button type="button" class="btn-link-chico" id="btnEditarTasa" title="Corregir tasa BCV manualmente">Editar tasa</button>
                </div>
                <label class="field field-full" id="hTasaManualWrap" hidden>
                  <span>Tasa BCV del día (Bs por $)</span>
                  <input type="text" name="tasa" id="hTasaInput" inputmode="decimal" autocomplete="off" placeholder="Ej. 450,25" value="${tasaIni ? esc(formatoNumInput(tasaIni, true)) : ""}" />
                </label>
                <div class="tasa-esperado-linea" id="hEsperadoWrap" hidden>
                  <div>
                    <span class="ped-det">Monto que debe recibirse en Bs:</span>
                    <strong class="tasa-esperado-monto" id="hEsperadoBs">Bs 0,00</strong>
                  </div>
                  <button type="button" class="btn btn-ghost btn-chico" id="btnUsarEsperado">Usar monto</button>
                </div>
              </div>
              <label class="field field-full"><span>Referencia <span class="ped-det">(opcional · pago móvil / transferencia)</span></span>
                <input name="referencia" id="hRef" maxlength="60" autocomplete="off" placeholder="Ej. 001234" value="${esc(refIni)}" />
              </label>
            </div>

            <label class="field field-full"><span id="hMontoLabel">${mon === "Bs" ? "Monto recibido en Bs *" : (acc === "cobrar" ? "Monto cobrado en $ *" : "Monto recibido en $ *")}</span>
              <input name="monto" id="hMonto" inputmode="decimal" autocomplete="off" placeholder="${mon === "Bs" ? "Ej. 54.200,00" : "Ej. 120,50"}" value="${esc(previo)}" />
            </label>
            <div class="estado-cobro-aviso" id="hEstadoCobro" hidden></div>
          </div>`,
        ok,
        validar: (d) => {
          if (acc === "cobrar" && !canalValido(d.canal_cobro)) return "Indicá cómo recibiste el pago: 📍 En persona o 📱 Online / Por teléfono.";
          if (!(montoNum(d.monto) > 0)) return "Escribí el monto recibido (mayor que 0).";
          if (d.moneda === "Bs") {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha_pago || "")) return "Indicá la fecha en que realizaron el pago en Bs.";
            if (d.fecha_pago > diaHoy) return "La fecha del pago no puede ser futura.";
            if (!(montoNum(d.tasa) > 0)) return "No se pudo obtener la tasa BCV para esa fecha. Tocá 'Editar tasa' e ingresala.";
          }
          if (hayAjustePrecios() && !String(d.ajuste_motivo || "").trim()) {
            return "Escribí el motivo del cambio de precios por error en facturación.";
          }
          return "";
        },
        alAbrir: (form) => {
          let tocado = !!previo;
          let tasaActual = tasaIni || 0;
          let reqId = 0;
          let enModoDirecto = vistaDirectaConciliar;
          const m = form.querySelector("#hMonto");
          const mLabel = form.querySelector("#hMontoLabel");
          const boxBs = form.querySelector("#hBoxBs");
          const fechaInp = form.querySelector("#hFechaPago");
          const tasaTxt = form.querySelector("#hTasaTexto");
          const tasaWrap = form.querySelector("#hTasaManualWrap");
          const tasaInp = form.querySelector("#hTasaInput");
          const espWrap = form.querySelector("#hEsperadoWrap");
          const espBs = form.querySelector("#hEsperadoBs");
          const estadoBox = form.querySelector("#hEstadoCobro");
          const btnOk = $("hojaOk");
          const boxAjuste = form.querySelector("#hBoxAjuste");
          const btnToggleAjuste = form.querySelector("#btnToggleAjuste");
          const btnResetAjuste = form.querySelector("#btnResetAjuste");
          const resumenVivo = form.querySelector("#hResumenCambiosVivo");

          const btnAbrirEd = form.querySelector("#btnAbrirEdicionConciliar");
          if (btnAbrirEd) {
            btnAbrirEd.addEventListener("click", () => {
              enModoDirecto = false;
              const cardRes = form.querySelector("#hVistaResumenConciliar");
              if (cardRes) cardRes.hidden = true;
              form.querySelector("#hFormCompletoCobro").hidden = false;
              evaluarYMostrar();
              m.focus();
            });
          }

          const tipoActual = () => (form.querySelector('input[name="tipo_pago_real"]:checked') || {}).value || elegido;
          const esBsActual = () => (form.querySelector('input[name="moneda"]:checked') || {}).value === "Bs";
          const totalPedidoUsd = () => {
            const its = itemsConAjuste();
            return totalPorPago(its, tipoActual());
          };

          const evaluarYMostrar = () => {
            const tipo = tipoActual();
            const esBs = esBsActual();
            const totUsd = totalPedidoUsd();
            if (conPrecio || hayAjustePrecios()) {
              totalesPorPago(itemsConAjuste()).forEach((pg) => {
                const sp = form.querySelector(`[data-pago-monto="${pg.id}"] strong`);
                if (sp) sp.textContent = dinero(pg.total);
              });
            }
            // Mostrar qué precios cambiaron exactamente de cuánto a cuánto mientras edita el vendedor
            if (resumenVivo) {
              const cods = Object.keys(preciosAjustados);
              if (cods.length) {
                const totOrig = totalPorPago(p.items || [], tipo);
                resumenVivo.hidden = false;
                resumenVivo.innerHTML = `<strong>Cambios aplicados:</strong><ul>${cods.map((c) => {
                  const itO = (p.items || []).find((x) => x.code === c) || {};
                  const ant = precioUnitario(itO, tipo);
                  const nvo = preciosAjustados[c];
                  return `<li>${esc(itO.producto || c)} (${esc(c)}): de <s>${esc(dinero(ant))}</s> a <strong>${esc(dinero(nvo))}</strong> / caja</li>`;
                }).join("")}</ul><span>Total: de <s>${esc(dinero(totOrig))}</s> a <strong>${esc(dinero(totUsd))}</strong></span>`;
              } else {
                resumenVivo.hidden = true;
              }
            }

            const aviso = form.querySelector("#hProntoAviso");
            if (aviso) aviso.hidden = !/pronto/.test(tipo || "");
            boxBs.hidden = !esBs;
            mLabel.textContent = esBs ? "Monto recibido en Bs *" : (acc === "cobrar" ? "Monto cobrado en $ *" : "Monto recibido en $ *");
            m.placeholder = esBs ? "Ej. 54.200,00" : "Ej. 120,50";

            const saldoUsd = Math.max(0, Math.round((totUsd - pagadoPrevioUsd) * 100) / 100);
            if (!tocado && (conPrecio || hayAjustePrecios())) {
              m.value = !esBs && saldoUsd > 0 ? formatoNumInput(saldoUsd) : "";
            }

            if (esBs && tasaActual > 0 && saldoUsd > 0) {
              const esp = Math.round(saldoUsd * tasaActual * 100) / 100;
              espWrap.hidden = false;
              espBs.textContent = formatoMonto(esp, "Bs");
              espBs.dataset.valor = formatoNumInput(esp, true);
            } else {
              espWrap.hidden = true;
            }

            const montoVal = montoNum(m.value);
            if (!(montoVal > 0) || (esBs && !(tasaActual > 0))) {
              estadoBox.hidden = true;
              if (btnOk && !enModoDirecto) btnOk.textContent = ok;
              return;
            }
            const ev = evaluarCobro({ totalUsd: totUsd, pagadoPrevioUsd, monto: montoVal, moneda: esBs ? "Bs" : "USD", tasa: tasaActual });
            // Si está en vista directa de Conciliar, actualizar tasa/equivalente en la tarjeta resumen si se consultó en vivo
            const concTasaEl = form.querySelector("#hConcTasaVal");
            const concUsdEl = form.querySelector("#hConcUsdVal");
            const concChipEl = form.querySelector("#hConcChipEstado");
            if (concTasaEl && tasaActual > 0) concTasaEl.innerHTML = `<strong>Bs ${esc(formatoNumInput(tasaActual, true))} / $</strong>`;
            if (concUsdEl && ev.montoUsd > 0) concUsdEl.innerHTML = `<strong>${esc(dinero(ev.montoUsd))}</strong> <span class="ped-det">(de ${esc(dinero(ev.saldoBaseUsd))} del pedido)</span>`;
            if (concChipEl) {
              concChipEl.className = `chip ${ev.completo ? "chip-ok" : "chip-pend"}`;
              concChipEl.textContent = ev.completo ? "✓ Canceló completo" : `⚠️ Abono parcial (resta ${dinero(ev.restanteUsd)})`;
            }

            estadoBox.hidden = false;
            if (ev.completo) {
              estadoBox.className = "estado-cobro-aviso es-completo";
              estadoBox.innerHTML = `<strong>✓ Canceló completo</strong><span>${esBs ? `Equivale a <strong>${esc(dinero(ev.montoUsd))}</strong> a tasa BCV y cubre el saldo de ${esc(dinero(ev.saldoBaseUsd))}.` : `Cubre el saldo total de <strong>${esc(dinero(ev.saldoBaseUsd))}</strong>.`}</span>`;
              if (btnOk) btnOk.textContent = enModoDirecto ? "✓ Es correcto · Conciliar" : (acc === "cobrar" ? "Sí, canceló completo" : "Sí, conciliar completo");
            } else {
              estadoBox.className = "estado-cobro-aviso es-abono";
              estadoBox.innerHTML = `<strong>⚠️ Se marcará como un ABONO</strong><span>${esBs
                ? `El monto indicado equivale a <strong>${esc(dinero(ev.montoUsd))}</strong> (de ${esc(formatoMonto(ev.esperadoBs, "Bs"))} esperados). Quedarán pendientes <strong>${esc(dinero(ev.restanteUsd))}</strong> (${esc(formatoMonto(ev.restanteBs, "Bs"))}).`
                : `Abona <strong>${esc(dinero(ev.montoUsd))}</strong> de ${esc(dinero(ev.saldoBaseUsd))}. Quedarán pendientes <strong>${esc(dinero(ev.restanteUsd))}</strong>.`}</span>`;
              if (btnOk) btnOk.textContent = enModoDirecto ? "✓ Es correcto · Conciliar abono" : (acc === "cobrar" ? "Registrar como abono" : "Conciliar como abono");
            }
          };

          const consultarTasaFecha = async (f) => {
            const id = ++reqId;
            tasaTxt.textContent = "Consultando tasa BCV del día…";
            const info = await obtenerTasaBcv(f);
            if (id !== reqId) return;
            if (info.tasa > 0) {
              tasaActual = info.tasa;
              tasaInp.value = formatoNumInput(info.tasa, true);
              const fMostrar = fechaLegible(info.fechaEfectiva || f);
              tasaTxt.innerHTML = `Tasa BCV (${esc(fMostrar)}): <strong>Bs ${esc(formatoNumInput(info.tasa, true))} / $</strong>`;
            } else {
              tasaActual = montoNum(tasaInp.value);
              tasaTxt.innerHTML = `<span class="ped-det">Sin tasa automática para esa fecha. Ingresala abajo:</span>`;
              tasaWrap.hidden = false;
            }
            evaluarYMostrar();
          };

          // Eventos de cambio de precios por error en facturación (solo en cobrar)
          if (btnToggleAjuste) {
            btnToggleAjuste.addEventListener("click", () => {
              const abrir = boxAjuste.hidden;
              boxAjuste.hidden = !abrir;
              btnToggleAjuste.setAttribute("aria-expanded", String(abrir));
            });
            const leerPreciosInputs = () => {
              const tipo = tipoActual();
              form.querySelectorAll("[data-cprecio-code]").forEach((inp) => {
                const code = inp.dataset.cprecioCode;
                const itOrig = (p.items || []).find((x) => x.code === code);
                const base = itOrig ? precioUnitario(itOrig, tipo) : 0;
                const val = montoNum(inp.value);
                if (val > 0 && Math.abs(val - base) >= 0.01) preciosAjustados[code] = val;
                else delete preciosAjustados[code];
              });
              btnResetAjuste.hidden = !hayAjustePrecios();
              evaluarYMostrar();
            };
            form.querySelector("#hItemsAjuste").addEventListener("input", (e) => {
              const inp = e.target.closest("[data-cprecio-code]");
              if (inp) inp.value = formatoMilesInput(inp.value, 2);
              leerPreciosInputs();
            });
            const inpTodos = form.querySelector("#hPrecioTodos");
            inpTodos.addEventListener("input", () => { inpTodos.value = formatoMilesInput(inpTodos.value, 2); });
            form.querySelector("#btnHPrecioTodos").addEventListener("click", () => {
              const n = montoNum(inpTodos.value);
              if (!(n > 0)) return toast("Escribí un precio por caja válido.");
              const fmt = formatoNumInput(n);
              form.querySelectorAll("[data-cprecio-code]").forEach((inp) => { inp.value = fmt; });
              leerPreciosInputs();
            });
            btnResetAjuste.addEventListener("click", () => {
              const tipo = tipoActual();
              Object.keys(preciosAjustados).forEach((k) => delete preciosAjustados[k]);
              form.querySelectorAll("[data-cprecio-code]").forEach((inp) => {
                const itOrig = (p.items || []).find((x) => x.code === inp.dataset.cprecioCode);
                const u = itOrig ? precioUnitario(itOrig, tipo) : 0;
                inp.value = formatoNumInput(u);
              });
              btnResetAjuste.hidden = true;
              evaluarYMostrar();
            });
          }

          // Eventos de fecha, tasa BCV y moneda
          form.querySelector("#btnEditarTasa").addEventListener("click", () => {
            tasaWrap.hidden = !tasaWrap.hidden;
            if (!tasaWrap.hidden) tasaInp.focus();
          });
          tasaInp.addEventListener("input", () => {
            tasaInp.value = formatoMilesInput(tasaInp.value, 4);
            tasaActual = montoNum(tasaInp.value);
            if (tasaActual > 0) tasaTxt.innerHTML = `Tasa BCV aplicada: <strong>Bs ${esc(formatoNumInput(tasaActual, true))} / $</strong>`;
            evaluarYMostrar();
          });
          fechaInp.addEventListener("change", () => {
            if (fechaInp.value) consultarTasaFecha(fechaInp.value);
          });
          form.querySelector("#btnUsarEsperado").addEventListener("click", () => {
            if (espBs.dataset.valor) {
              m.value = espBs.dataset.valor;
              tocado = true;
              evaluarYMostrar();
            }
          });
          m.addEventListener("input", () => {
            tocado = true;
            m.value = formatoMilesInput(m.value, 2);
            evaluarYMostrar();
          });
          form.addEventListener("change", (e) => {
            if (e.target.name === "tipo_pago_real") {
              if (!hayAjustePrecios()) {
                const tipo = tipoActual();
                form.querySelectorAll("[data-cprecio-code]").forEach((inp) => {
                  const itOrig = (p.items || []).find((x) => x.code === inp.dataset.cprecioCode);
                  const u = itOrig ? precioUnitario(itOrig, tipo) : 0;
                  inp.value = formatoNumInput(u);
                });
              }
              evaluarYMostrar();
            } else if (e.target.name === "moneda") {
              if (esBsActual()) {
                if (!previo) { m.value = ""; tocado = false; }
                if (!(tasaActual > 0)) consultarTasaFecha(fechaInp.value || diaHoy);
              } else if (!previo) {
                tocado = false;
              }
              evaluarYMostrar();
            }
          });

          if (esBsActual()) {
            if (tasaIni > 0) {
              tasaActual = tasaIni;
              tasaTxt.innerHTML = `Tasa BCV (${esc(fechaLegible(fechaIni))}): <strong>Bs ${esc(formatoNumInput(tasaIni, true))} / $</strong>`;
              evaluarYMostrar();
            } else {
              consultarTasaFecha(fechaIni);
            }
          } else {
            evaluarYMostrar();
          }
        },
      });
      if (!r) return;
      const esBs = r.moneda === "Bs";
      extra = {
        monto: montoNum(r.monto),
        moneda: esBs ? "Bs" : "USD",
        tipo_pago_real: r.tipo_pago_real,
        ...(esBs ? { fecha_pago: r.fecha_pago, tasa: montoNum(r.tasa), referencia: String(r.referencia || "").trim() } : {}),
        ...(hayAjustePrecios() ? { ajuste_precios: preciosAjustados, ajuste_motivo: String(r.ajuste_motivo || "").trim() } : {}),
        // canal de atención del cobro: en persona manda la lectura GPS (el servidor aprende el GPS solo si el cliente no tenía)
        ...(acc === "cobrar" && canalValido(r.canal_cobro)
          ? { canal_cobro: r.canal_cobro, ...(r.canal_cobro === "en_persona" ? datosGpsEnvio(p.cliente_datos) : {}) }
          : {}),
      };
    } else if (acc === "rechazar") {
      const r = await hoja({
        titulo: `Pago no recibido · ${p.id}`,
        cuerpo: '<p class="modal-sub">El pago reportado se marcará como rechazado y el pedido seguirá en <strong>Por cobrar</strong>.</p><label class="field field-full"><span>¿Qué pasó?</span><textarea name="motivo" rows="3" maxlength="200" placeholder="Ej. no llegó la transferencia"></textarea></label>',
        ok: "Rechazar pago", validar: (d) => (d.motivo.trim() ? "" : "Escribí el motivo."),
      });
      if (!r) return;
      extra.motivo = r.motivo.trim();
    } else {
      const [titulo, cuerpo, ok] = textos[acc];
      if (!(await hoja({ titulo, cuerpo: `<p class="modal-sub">${cuerpo}</p>`, ok }))) return;
    }
    try {
      const rc = await api("cobro", { pedido_id: p.id, accion: { cobrar: "cancelar" }[acc] || acc, ...extra });
      guardarEnMemoria(rc.pedido);
      if (extra.canal_cobro) avisarAtencion(p.cliente_id, extra.canal_cobro, "cobro", { pedido_id: p.id });
      const fueAbono = rc.es_abono || (rc.pedido && !rc.pedido.cobro && Number(rc.pedido.pagado_usd) > 0);
      toast(acc === "cobrar"
        ? (fueAbono ? `Abono registrado · restan ${dinero(rc.pedido.saldo)}` : "Marcado como cancelado completo")
        : acc === "conciliar"
          ? (fueAbono ? `Abono conciliado · restan ${dinero(rc.pedido.saldo)}` : "Pago conciliado completo")
          : { rechazar: "Pago rechazado: vuelve a Por cobrar", desconciliar: "Conciliación deshecha" }[acc]);
      render();
    } catch (e) {
      toast(e.message);
    }
  }

  /* ---------- Clientes ---------- */
  let cacheClientes = [];
  let rutaFiltroCli = "todas";
  let modoRutaGps = false;
  const seleccionadosRutaGps = new Set();
  async function abrirMisRutasVendedor() {
    const u = yo() || {};
    const actuales = Array.isArray(u.rutas) ? u.rutas : [];
    const ok = await hoja({
      titulo: "📍 Marcar las rutas que atiendo",
      cuerpo: `<p class="modal-sub">Seleccioná las rutas o zonas comerciales que atendés. Cuando un cliente elija vendedor en el catálogo, verá tu nombre junto a estas rutas:</p>
        <div class="roles-usuario" id="modalMisRutas">
          ${RUTAS_CARTERA.map((r) => `<label class="check rol-opt"><input type="checkbox" name="miRutaChk" value="${esc(r)}"${actuales.includes(r) ? " checked" : ""} /> <span><strong>📍 ${esc(r)}</strong></span></label>`).join("")}
        </div>
        <p class="form-warn" id="errMisRutas" hidden></p>`,
      ok: "Guardar mis rutas",
      cancelar: "Cancelar",
      validar: async () => {
        const marcadas = [...document.querySelectorAll('input[name="miRutaChk"]:checked')].map((x) => x.value);
        const err = $("errMisRutas");
        if (!marcadas.length) {
          if (err) { err.textContent = "Marcá al menos una ruta que atendés."; err.hidden = false; }
          return false;
        }
        try {
          const r = await api("guardarMisRutas", { rutas: marcadas });
          const s = sesion();
          if (s) SkalaAPI.guardarSesion(s.token, { ...s.usuario, rutas: r.rutas || marcadas });
          const btn = $("btnMisRutasVend");
          if (btn) btn.textContent = `📍 Mis rutas (${(r.rutas || marcadas).join(", ")})`;
          toast("Rutas actualizadas");
          return true;
        } catch (e) {
          if (err) { err.textContent = e.message; err.hidden = false; }
          return false;
        }
      },
    });
    return ok;
  }
  async function vClientes(v, _p, _q, vigente) {
    const misRutasActuales = Array.isArray((yo() || {}).rutas) ? yo().rutas : [];
    v.innerHTML = `
      <div class="cli-top-acciones">
        <div class="buscador cli-buscador-top"><input type="search" id="kBuscar" placeholder="Buscar cliente o ruta…" autocomplete="off" enterkeyhint="search" /></div>
        <a class="btn btn-primary btn-cli-nuevo" href="#/cliente/nuevo" id="btnAnadirCliente" aria-label="Añadir nuevo cliente"><span class="simbolo-mas" aria-hidden="true">＋</span> Nuevo</a>
        <button type="button" class="btn btn-ghost btn-cli-mapa" id="btnMapaNew" data-gps-slot="clientes-mapa" aria-label="Mapa y futuras funciones nuevas" title="Mapa y futuras funciones">
          <span class="badge-new-mapa">New</span>
          <svg viewBox="0 0 24 24" aria-hidden="true" class="ico-mapa-svg"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6zm6-3v15m6-12v15"/></svg>
        </button>
      </div>
      <div class="periodos periodos-chicos cli-rutas-tabs" id="kRutasFiltro" role="group" aria-label="Filtrar por ruta">
        <button type="button" class="tab${rutaFiltroCli === "todas" ? " active" : ""}" data-ruta-f="todas">Todas</button>
        ${RUTAS_CARTERA.map((r) => `<button type="button" class="tab${rutaFiltroCli === r ? " active" : ""}" data-ruta-f="${esc(r)}">📍 ${esc(r)}</button>`).join("")}
      </div>
      <div class="cli-mision-bar">
        <button type="button" class="btn ${modoRutaGps ? "btn-primary" : "btn-ghost"} btn-chico" id="btnModoRutaGps" aria-pressed="${modoRutaGps}">
          ${modoRutaGps ? "✕ Salir de selección de ruta" : "🗺️ Armar ruta de visita"}
        </button>
        <button type="button" class="btn btn-ghost btn-chico" id="btnMisRutasVend">
          📍 Mis rutas (${misRutasActuales.length ? esc(misRutasActuales.join(", ")) : "Marcar rutas"})
        </button>
        <button type="button" class="btn btn-ghost btn-chico" id="btnSelTodaRuta" ${modoRutaGps ? "" : "hidden"}>Elegir visibles</button>
      </div>
      <div id="kVistaListaWrap">
        <p class="modal-sub" id="kInfo"></p>
        <ul class="lista-cli lista-cli-rutas" id="kLista"><li>${spin()}</li></ul>
      </div>
      <div class="barra-fija" id="barraMisionGps" ${modoRutaGps && seleccionadosRutaGps.size ? "" : "hidden"}>
        <div class="barra-total"><strong id="misionGpsConteo">${seleccionadosRutaGps.size} cliente(s) en ruta</strong><span class="ped-det">Se optimizará en GPS-Clientes</span></div>
        <button type="button" class="btn btn-primary" id="btnLanzarMisionGps">🚀 Abrir en GPS-Clientes</button>
      </div>`;
    const btnMapa = $("btnMapaNew");
    if (btnMapa) btnMapa.addEventListener("click", abrirAdelantoGps);
    const btnMisRutas = $("btnMisRutasVend");
    if (btnMisRutas) btnMisRutas.addEventListener("click", abrirMisRutasVendedor);
    let ultimosFiltrados = [];
    const actualizarBarraMision = () => {
      const b = $("barraMisionGps"), c = $("misionGpsConteo");
      if (!b || !c) return;
      const n = seleccionadosRutaGps.size;
      b.hidden = !(modoRutaGps && n > 0);
      c.textContent = `${n} cliente${n === 1 ? "" : "s"} para visitar hoy`;
    };
    const pintarListaCli = () => {
      const q = ($("kBuscar") ? $("kBuscar").value : "").trim();
      const qNorm = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const filtrados = (cacheClientes || []).filter((c) => {
        const ruta = rutaDeCliente(c);
        if (rutaFiltroCli !== "todas" && ruta !== rutaFiltroCli) return false;
        if (!qNorm) return true;
        const txt = `${c.nombre || ""} ${c.contacto || ""} ${c.telefono || ""} ${ruta}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return txt.includes(qNorm);
      });
      ultimosFiltrados = filtrados;
      const infoEl = $("kInfo");
      if (infoEl) {
        infoEl.textContent = filtrados.length
          ? `${filtrados.length} cliente(s)${rutaFiltroCli !== "todas" ? ` · Ruta ${rutaFiltroCli}` : " · por ruta comercial"}${modoRutaGps ? " · marcá los que visitarás hoy" : ""}`
          : "";
      }
      const listaEl = $("kLista");
      if (listaEl) {
        listaEl.innerHTML = filtrados.length
          ? filtrados.map((c) => {
              const ruta = rutaDeCliente(c);
              if (modoRutaGps) {
                const sel = seleccionadosRutaGps.has(String(c.id));
                return `<li><label class="cli-card-compacta cli-card-check${sel ? " seleccionada" : ""}">
                  <input type="checkbox" class="chk-ruta-gps" data-cli-ruta-id="${esc(c.id)}"${sel ? " checked" : ""} />
                  <strong class="cli-nombre-solo">${esc(c.nombre)}</strong>
                  <span class="chip-ruta-cli ruta-${slugRuta(ruta)}">📍 ${esc(ruta)}</span>
                </label></li>`;
              }
              return `<li><a class="cli-card-compacta" href="#/cliente/${encodeURIComponent(c.id)}">
                <strong class="cli-nombre-solo">${esc(c.nombre)}</strong>
                <span class="chip-ruta-cli ruta-${slugRuta(ruta)}">📍 ${esc(ruta)}</span>
              </a></li>`;
            }).join("")
          : '<li class="vacio-panel">Sin clientes en esa ruta o búsqueda.</li>';
      }
      actualizarBarraMision();
    };
    $("btnModoRutaGps").addEventListener("click", () => {
      modoRutaGps = !modoRutaGps;
      if (modoRutaGps) iniciarCapturaGpsSilenciosa();
      $("btnModoRutaGps").className = `btn ${modoRutaGps ? "btn-primary" : "btn-ghost"} btn-chico`;
      $("btnModoRutaGps").setAttribute("aria-pressed", String(modoRutaGps));
      $("btnModoRutaGps").textContent = modoRutaGps ? "✕ Salir de selección de ruta" : "🗺️ Armar ruta de visita";
      $("btnSelTodaRuta").hidden = !modoRutaGps;
      pintarListaCli();
    });
    $("btnSelTodaRuta").addEventListener("click", () => {
      const todosMarcados = ultimosFiltrados.length > 0 && ultimosFiltrados.every((c) => seleccionadosRutaGps.has(String(c.id)));
      ultimosFiltrados.forEach((c) => {
        if (todosMarcados) seleccionadosRutaGps.delete(String(c.id));
        else seleccionadosRutaGps.add(String(c.id));
      });
      pintarListaCli();
    });
    $("kLista").addEventListener("change", (e) => {
      const chk = e.target.closest("[data-cli-ruta-id]");
      if (!chk) return;
      const id = String(chk.dataset.cliRutaId);
      if (chk.checked) seleccionadosRutaGps.add(id); else seleccionadosRutaGps.delete(id);
      const lbl = chk.closest(".cli-card-check");
      if (lbl) lbl.classList.toggle("seleccionada", chk.checked);
      actualizarBarraMision();
    });
    $("btnLanzarMisionGps").addEventListener("click", async () => {
      const elegidos = (cacheClientes || []).filter((c) => seleccionadosRutaGps.has(String(c.id)));
      if (!elegidos.length) return toast("Elegí al menos un cliente para armar la ruta.");
      const btn = $("btnLanzarMisionGps");
      btn.disabled = true; btn.textContent = "Creando misión…";
      const f = fixVigente();
      const paradas = elegidos.map((c, idx) => ({
        orden: idx + 1,
        cliente_id: String(c.id),
        fuente: "crm",
        negocio: String(c.nombre || ""),
        direccion: String(c.direccion || ""),
        zona: rutaDeCliente(c),
        latitud: gpsValido(c.latitud, c.longitud) ? Number(c.latitud) : null,
        longitud: gpsValido(c.latitud, c.longitud) ? Number(c.longitud) : null,
      }));
      let misionId = `MIS-${hoyCaracas().replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      try {
        if (SkalaAPI.gpsDb) {
          const r = await SkalaAPI.gpsDb({
            action: "crear_mision",
            mision: {
              id: misionId,
              vendedor_id: String(yo().id || ""),
              vendedor: String(yo().nombre || ""),
              fecha: hoyCaracas(),
              origen: "crm",
              ...(f ? { start_lat: r6(f.lat), start_lng: r6(f.lng) } : {}),
            },
            paradas,
          });
          if (r && r.mision_id) misionId = String(r.mision_id);
        }
      } catch (_) {}
      guardarLS("skala_ultima_mision_gps", { mision_id: misionId, fecha: hoyCaracas(), paradas });
      btn.disabled = false; btn.textContent = "🚀 Abrir en GPS-Clientes";
      const deepLink = `gpsclientes://mision?mision_id=${encodeURIComponent(misionId)}`;
      const webUrl = SkalaAPI.gpsClientesUrl && SkalaAPI.gpsClientesUrl()
        ? `${SkalaAPI.gpsClientesUrl().replace(/\/+$/, "")}/?mision_id=${encodeURIComponent(misionId)}`
        : "";
      await hoja({
        titulo: `🗺️ Misión ${misionId} lista`,
        cuerpo: `<p class="modal-sub">Se preparó la ruta con <strong>${paradas.length} cliente(s)</strong> para hoy.</p>
          <a class="btn btn-primary btn-bloque" href="${esc(deepLink)}" id="lnkAbrirApkGps">📱 Abrir en App GPS-Clientes</a>
          ${webUrl ? `<a class="btn btn-ghost btn-bloque" href="${esc(webUrl)}" target="_blank" rel="noopener">🌐 Abrir en navegador</a>` : ""}`,
        ok: "Listo",
      });
    });
    $("kRutasFiltro").addEventListener("click", (e) => {
      const b = e.target.closest("[data-ruta-f]");
      if (!b) return;
      rutaFiltroCli = b.dataset.rutaF;
      $("kRutasFiltro").querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === b));
      pintarListaCli();
    });
    let t = null;
    const cargar = async (q) => {
      const r = await api("clientes", { q: "", limite: 200 });
      if (!vigente()) return;
      cacheClientes = r.clientes || [];
      pintarListaCli();
    };
    $("kBuscar").addEventListener("input", () => {
      clearTimeout(t);
      if (cacheClientes.length) { pintarListaCli(); return; }
      t = setTimeout(() => cargar($("kBuscar").value.trim()).catch((e) => toast(e.message)), 250);
    });
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
    const ruta = rutaDeCliente(c);
    v.innerHTML = `
      <section class="tarjeta">
        <div class="fila-top">
          <div>
            <h2 class="ped-titulo">${esc(c.nombre)}</h2>
            ${c.contacto ? `<p class="ped-det">${esc(c.contacto)}</p>` : ""}
          </div>
          <span class="chip-ruta-cli ruta-${slugRuta(ruta)}">📍 ${esc(ruta)}</span>
        </div>
        <dl class="datos">
          <dt>Ruta / Zona</dt><dd><strong>${esc(ruta)}</strong> · <span class="ped-det">Base compartida</span></dd>
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
      <section class="tarjeta tarjeta-prox-gps" data-gps-slot="ficha-cliente-gps">
        <div class="prox-gps-cab">
          <div>
            <span class="chip-prox">Próximamente</span>
            <h3 class="prox-gps-tit">📍 Inteligencia de Visita en Sitio</h3>
          </div>
        </div>
        <p class="ped-det">📍 Check-in de visita en sitio · Geocerca automática · Historial de rutas y frecuencia de visita</p>
      </section>
      <h3 class="sub-titulo">Pedidos</h3>
      <ul class="lista-ped" id="kPedidos"><li>${spin()}</li></ul>`;
    $("btnPedirCliente").addEventListener("click", () => {
      fijarCliente({ id: c.id, contacto: c.contacto, negocio: c.nombre, rif_cedula: c.rif_cedula, telefono: c.telefono, telefono2: c.telefono2, direccion: c.direccion, latitud: c.latitud, longitud: c.longitud, ruta });
      ir("#/nuevo");
    });
    const r = await api("pedidos", { cliente_id: c.id });
    if (!vigente()) return;
    $("kPedidos").innerHTML = r.pedidos.length ? r.pedidos.map((p) => filaPedido(p)).join("") : '<li class="vacio-panel">Todavía no tiene pedidos.</li>';
  }

  /* ---------- Añadir / editar cliente (sin pedido: traspaso de la base) ---------- */
  function vClienteForm(v, c) {
    const nuevo = !c;
    if (nuevo) iniciarCapturaGpsSilenciosa();
    $("appTitulo").textContent = nuevo ? "Añadir cliente" : "Editar cliente";
    $("btnAtras").hidden = false;
    $("btnAtras").dataset.destino = nuevo ? "#/clientes" : `#/cliente/${encodeURIComponent(c.id)}`;
    const val = (k) => esc(c ? (k === "negocio" ? c.nombre : c[k]) ?? "" : "");
    const rutaAct = c ? rutaDeCliente(c) : "Vigía";
    v.innerHTML = `<form class="tarjeta" id="fNuevoCli" novalidate>
      ${nuevo ? '<p class="modal-sub">Para pasar tu base de clientes: no hace falta que tenga pedidos. Solo el nombre es obligatorio.</p>' : ""}
      <div class="form-grid">
        <label class="field"><span>Nombre del negocio</span><input id="fnNegocio" type="text" autocomplete="off" autocapitalize="words" enterkeyhint="next" placeholder="Peluquería / tienda" value="${val("negocio")}" /></label>
        <label class="field"><span>Nombre del cliente</span><input id="fnContacto" type="text" autocomplete="off" autocapitalize="words" enterkeyhint="next" placeholder="Persona de contacto" value="${val("contacto")}" /></label>
        <label class="field"><span>Ruta / Zona asignada</span>
          <select id="fnRuta">${RUTAS_CARTERA.map((r) => `<option value="${esc(r)}"${r === rutaAct ? " selected" : ""}>📍 ${esc(r)}</option>`).join("")}</select>
        </label>
        <label class="field"><span>RIF / Cédula</span><input id="fnRif" type="text" autocomplete="off" autocapitalize="characters" enterkeyhint="next" placeholder="J-12345678-9" value="${val("rif_cedula")}" /></label>
        <label class="field"><span>Teléfono 1</span><input id="fnTel1" type="tel" inputmode="tel" autocomplete="off" enterkeyhint="next" placeholder="0412-1234567" value="${val("telefono")}" /></label>
        <label class="field"><span>Teléfono 2</span><input id="fnTel2" type="tel" inputmode="tel" autocomplete="off" enterkeyhint="next" placeholder="Opcional" value="${val("telefono2")}" /></label>
        <label class="field field-full"><span>Dirección</span><input id="fnDireccion" type="text" autocomplete="off" enterkeyhint="next" placeholder="Dirección" value="${val("direccion")}" /></label>
      </div>
      <fieldset class="pay ubicacion"><legend>Ubicación</legend>
        ${nuevo ? fieldsetCanalHTML("fnCanalAltaFs", "fnCanalAlta", "¿Dónde estás registrando a este cliente? *", "online_telefono", TEXTOS_CANAL_ALTA) : ""}
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
      $("fnGpsEstado").innerHTML = msg && typeof msg === "string" ? esc(msg) : lat && lng
        ? `Ubicación lista (${esc(lat)}, ${esc(lng)}) · <a href="${esc(linkMapa(lat, lng))}" target="_blank" rel="noopener">ver mapa</a> · <button type="button" class="link-btn" id="fnQuitar">Quitar</button>`
        : "Sin ubicación (se puede agregar después).";
    };
    pintarUbic();
    if (nuevo) enlazarCanalAlta("fnCanalAlta", $("fnLat"), $("fnLng"), $("fnGps"), () => pintarUbic());
    $("fnPegar").addEventListener("input", () => {
      const t = $("fnPegar").value.trim();
      if (!t) return pintarUbic();
      const co = coordsDeTexto(t);
      if (co) {
        $("fnLat").value = co.lat; $("fnLng").value = co.lng;
        const rd = document.querySelector('input[name="fnCanalAlta"][value="en_persona"]');
        if (rd) rd.checked = true;
        pintarUbic();
      }
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
        (pos) => {
          $("fnLat").value = pos.coords.latitude.toFixed(6); $("fnLng").value = pos.coords.longitude.toFixed(6);
          const rd = document.querySelector('input[name="fnCanalAlta"][value="en_persona"]');
          if (rd) rd.checked = true;
          b.disabled = false; b.textContent = "Usar mi ubicación actual (estoy con el cliente)"; pintarUbic();
        },
        (err) => { b.disabled = false; b.textContent = "Usar mi ubicación actual (estoy con el cliente)"; toast(err.code === 1 ? "Permiso de ubicación negado." : "No se pudo obtener el GPS."); },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
    });
    const guardar = async (otro) => {
      const rutaElegida = $("fnRuta") ? $("fnRuta").value : "Vigía";
      const canalAlta = nuevo ? ((document.querySelector('input[name="fnCanalAlta"]:checked') || {}).value || "online_telefono") : "";
      const cliente = {
        id: c ? c.id : undefined, negocio: $("fnNegocio").value.trim(), contacto: $("fnContacto").value.trim(),
        rif_cedula: $("fnRif").value.trim(), telefono: $("fnTel1").value.trim(), telefono2: $("fnTel2").value.trim(),
        direccion: $("fnDireccion").value.trim(),
        latitud: nuevo && canalAlta === "online_telefono" && !$("fnPegar").value.trim() ? "" : $("fnLat").value,
        longitud: nuevo && canalAlta === "online_telefono" && !$("fnPegar").value.trim() ? "" : $("fnLng").value,
        ruta: rutaElegida,
      };
      const faltan = validarCliente(cliente, { telefonoOpcional: true });
      const err = $("fnError");
      if (faltan.length) { err.textContent = "Falta: " + faltan.join(" · "); err.hidden = false; return; }
      err.hidden = true;
      const btns = v.querySelectorAll("#fnGuardar, #fnOtro");
      btns.forEach((b) => (b.disabled = true));
      try {
        const r = await api("guardarCliente", { cliente });
        guardarRutaCliente(r.cliente.id, rutaElegida);
        if (nuevo && canalAlta === "en_persona") {
          api("registrarVisita", { cliente_id: r.cliente.id, canal: "en_persona", tipo: "alta_cliente", latitud: cliente.latitud, longitud: cliente.longitud }).catch(() => {});
          avisarAtencion(r.cliente.id, "en_persona", "alta_cliente");
        }
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
  const numTxt = (t) => { const n = Number(String(t ?? "").trim().replace(",", ".")); return isFinite(n) ? n : NaN; };
  /* Formulario de los 8 precios FINALES: cada forma de pago al por menor y al mayor */
  const CAMPOS_P = ["menor", "pronto", "efectivo_credito", "efectivo_pronto", "mayor", "mayor_pronto", "mayor_efectivo_credito", "mayor_efectivo_pronto"];
  const FORMAS = [["", "Normal (crédito)", 0], ["pronto", "Pronto pago", 1], ["efectivo_credito", "Efectivo a crédito", 2], ["efectivo_pronto", "Efectivo pronto pago", 3]];
  function camposPrecios(x) {
    const val = (k) => (x && x[k] ? String(x[k]).replace(".", ",") : "");
    const campo = (k, t, est, req) => `<label class="field"><span>${t}${req ? " *" : ""}${est ? ` <span class="mini-est">${"★".repeat(est)}${"☆".repeat(3 - est)}</span>` : ""}</span><input name="${k}" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${val(k)}" /></label>`;
    const grupo = (pre, tit, nota) => `<fieldset class="pay grupo-precios"><legend>${tit}</legend>${nota ? `<p class="nota-chica">${nota}</p>` : ""}<div class="form-grid">${FORMAS.map(([k, t, e]) => {
      const nombre = pre ? (k ? `mayor_${k}` : "mayor") : (k || "menor");
      return campo(nombre, t, e, !pre && !k);
    }).join("")}</div></fieldset>`;
    return `<p class="modal-sub">Precio <strong>final</strong> por caja en dólares, el que paga el cliente en cada forma de pago.</p>
      ${grupo(false, "Al por menor (menos de 15 cajas)")}
      ${grupo(true, "Al mayor (15 cajas o más)", "Si dejás uno vacío, se le aplica la misma rebaja que al por menor.")}`;
  }
  function validarPrecios(d) {
    const n = {};
    for (const k of CAMPOS_P) { n[k] = String(d[k] || "").trim() === "" ? 0 : numTxt(d[k]); if (!(n[k] >= 0)) return "Revisá los montos: solo números (ej. 29,5)."; }
    if (!n.menor) return "Falta el precio normal al por menor.";
    if (n.mayor > n.menor) return "El precio normal al mayor no puede ser más alto que al por menor.";
    if (["pronto", "efectivo_credito", "efectivo_pronto"].some((k) => n[k] > n.menor)) return "Al por menor, ningún precio puede ser más alto que el normal.";
    const bm = n.mayor || n.menor;
    if (["mayor_pronto", "mayor_efectivo_credito", "mayor_efectivo_pronto"].some((k) => n[k] > bm)) return "Al mayor, ningún precio puede ser más alto que el normal al mayor.";
    return "";
  }
  const preciosDe = (d) => Object.fromEntries(CAMPOS_P.map((k) => [k, String(d[k] || "").trim() === "" ? 0 : numTxt(d[k])]));
  const esProductoSkala = (code) => /^(BC|KT)-/i.test(String(code || ""));
  let filtroCatInv = "todos";
  let catPreciosActual = "";
  let busquedaPre = "";

  function gruposDeCatalogoParaPrecios(cat) {
    const mapa = allProductsMap();
    const codesSkalaBanos = Object.keys(mapa).filter((c) => /^BC-/i.test(c));
    const codesSkalaKits = Object.keys(mapa).filter((c) => /^KT-/i.test(c));
    if (cat === "skala") {
      return [
        { id: "GRP-SKALA-1KG", aliasId: "GRP-SKL-BANOS-DIST", nombre: `Baño de Crema Skala 1 kg (${codesSkalaBanos.length || 16} var. · 1 cja = 6 und)`, codes: codesSkalaBanos },
        { id: "GRP-SKALA-KIT", aliasId: "GRP-SKL-KITS-DIST", nombre: `Kits Skala Shampoo + Acondicionador (${codesSkalaKits.length || 8} var. · 1 cja = 6 dúos)`, codes: codesSkalaKits },
      ];
    }
    const DEFINICION_GRUPOS_ONTIVEROS = [
      // Grupos con mismo precio entre sus fragancias
      { id: "GRP-ALV-DET-1KG", nom: "Detergente Alive 1kg", rx: /^ALV-DET1K-/i, empaque: "1 cja = 12 bolsas de 1 kg" },
      { id: "GRP-AZ-DET", nom: "Detergente A-Z 1kg", rx: /^AZ-DET-/i, empaque: "1 cja = 12 bolsas de 1 kg" },
      { id: "GRP-ALV-DET-500G", nom: "Detergente Alive 500g", rx: /^ALV-DET500-/i, empaque: "1 cja = 24 bolsas de 500 g" },
      { id: "GRP-ALV-PAN-150G", nom: "Jabón Panela Alive 150g", rx: /^ALV-PAN-\d/i, empaque: "1 cja = 36 panelas de 150 g" },
      { id: "GRP-JAB-POPULAR", nom: "Jabón Popular Barra", rx: /^JAB-POP-/i, empaque: "1 cja = 36 barras" },
      { id: "GRP-ALV-SUA-1L", nom: "Suavizante Alive 1L", rx: /^ALV-SUA-/i, empaque: "1 cja = 12 botellas de 1 L" },
      { id: "GRP-ALV-LAV", nom: "Lavaplatos Aliclean 350ml", rx: /^ALV-LAV-0[123]$/i, empaque: "1 cja = 24 envases de 350 ml" },
      { id: "GRP-ALV-LAV-750", nom: "Lavaplatos Aliclean 750ml", rx: /^ALV-LAV-0[45]$/i, empaque: "1 cja = 12 envases de 750 ml" },
      { id: "GRP-BER-ESP", nom: "Espirales Bernice x60", rx: /^BER-ESP-/i, empaque: "1 cja = 24 cajas × 60 espirales" },
      { id: "GRP-DOR-PACE3", nom: "Afeitadora Dorco Pace 3", rx: /^DOR-PACE3-/i, empaque: "1 cja = 12 blísters · 1 blíster = 12 pqts de 3 afeitadoras", sinConteoVar: true },
      { id: "GRP-ALV-CAP", nom: "Baño de Crema Alive 400g", rx: /^ALV-CAP-/i, empaque: "1 cja = 12 potes de 400 g" },
      { id: "GRP-ALV-LOC", nom: "Loción Corporal Alive 400ml", rx: /^ALV-LOC-/i, empaque: "1 cja = 12 frascos de 400 ml" },
      { id: "GRP-ALV-SHA-413", nom: "Shampoo Alive 413ml", rx: /^ALV-SHA413-/i, empaque: "1 cja = 12 envases de 413 ml" },
      { id: "GRP-ALV-ACO-413", nom: "Acondicionador Alive 413ml", rx: /^ALV-ACO413-/i, empaque: "1 cja = 12 envases de 413 ml" },
      { id: "GRP-ALV-SHA-400", nom: "Shampoo Anticaspa Alive 400ml", rx: /^ALV-SHA400-/i, empaque: "1 cja = 12 envases de 400 ml" },
      { id: "GRP-ALV-SHA-350", nom: "Shampoo 2en1 y Gold Alive 350ml", rx: /^ALV-SHA350-/i, empaque: "1 cja = 12 envases de 350 ml" },
      { id: "GRP-ALV-SHA-250", nom: "Shampoo Alive 250ml", rx: /^ALV-SHA250-/i, empaque: "4 disp. de 8 variaciones · 1 cja = 12 envases de 250 ml", sinConteoVar: true },
      { id: "GRP-ALV-DEN", nom: "Crema Dental Alident 100g", rx: /^ALV-DEN-\d/i, empaque: "1 cja = 8 blísters × 12 und" },
      { id: "GRP-ALV-DEN-75G", nom: "Crema Dental Alident 75g", rx: /^ALV-DEN75-/i, empaque: "1 cja = 10 blísters × 12 und" },
      { id: "GRP-ALV-JAB-ANITA", nom: "Jabón de Tocador Anita 125g", rx: /^ALV-JAB-/i, empaque: "1 cja = 72 pastillas de 125 g" },
      { id: "GRP-HAR-MILKY", nom: "Jabón Harmony 135g (Milky)", rx: /^HAR-MIL-/i, empaque: "1 cja = 48 und de 135 g" },
      { id: "GRP-HAR-FRUITY", nom: "Jabón Harmony Pequeño (Fruit)", rx: /^HAR-FRU-/i, empaque: "1 cja = 72 und" },
      { id: "GRP-BF-THU", nom: "Toallas Húmedas Baby Finger", rx: /^BF-THU-/i, empaque: "1 cja = 24 pqts × 50 und" },
      { id: "GRP-BF-CUI", nom: "Cuidado Bebé Baby Finger", rx: /^BF-CUI-/i, empaque: "1 cja = 12 und" },
      // Papel Alisoft (cada presentación maneja distinto precio)
      { id: "ALV-PAP-01", groupId: "GRP-ALV-PAP", familia: "🧻 Papel Higiénico Alisoft (precios distintos por presentación · 1 bulto = 12 pqts)", nom: "Alisoft Rosado 215 Hojas × 4 Rollos", rx: /^ALV-PAP-01$/i, empaque: "1 bulto = 12 pqts", sinConteoVar: true },
      { id: "ALV-PAP-02", groupId: "GRP-ALV-PAP", familia: "🧻 Papel Higiénico Alisoft (precios distintos por presentación · 1 bulto = 12 pqts)", nom: "Alisoft Dorado Comfort Plus 300 Hojas × 4 Rollos", rx: /^ALV-PAP-02$/i, empaque: "1 bulto = 12 pqts", sinConteoVar: true },
      { id: "ALV-PAP-03", groupId: "GRP-ALV-PAP", familia: "🧻 Papel Higiénico Alisoft (precios distintos por presentación · 1 bulto = 12 pqts)", nom: "Alisoft Azul Premium Max 400 Hojas × 4 Rollos", rx: /^ALV-PAP-03$/i, empaque: "1 bulto = 12 pqts", sinConteoVar: true },
      { id: "ALV-PAP-04", groupId: "GRP-ALV-PAP", familia: "🧻 Papel Higiénico Alisoft (precios distintos por presentación · 1 bulto = 12 pqts)", nom: "Alisoft Negro Premium Jumbo 600 Hojas × 4 Rollos", rx: /^ALV-PAP-04$/i, empaque: "1 bulto = 12 pqts", sinConteoVar: true },
      // Toallín Alisoft (cada presentación maneja distinto precio)
      { id: "ALV-TOAABS-01", groupId: "GRP-ALV-TOA-ABS", familia: "🧻 Toallín Absorbente Alisoft (precios distintos por presentación · 1 bulto = 12 rollos)", nom: "Toallín Alisoft Azul 80 Hojas", rx: /^ALV-TOAABS-01$/i, empaque: "1 bulto = 12 rollos", sinConteoVar: true },
      { id: "ALV-TOAABS-02", groupId: "GRP-ALV-TOA-ABS", familia: "🧻 Toallín Absorbente Alisoft (precios distintos por presentación · 1 bulto = 12 rollos)", nom: "Toallín Alisoft Naranja Doble Hoja", rx: /^ALV-TOAABS-02$/i, empaque: "1 bulto = 12 rollos", sinConteoVar: true },
      // Toallas Femeninas y Protectores Alive (todas las cajas traen 72 pqts · precios distintos)
      { id: "ALV-TOAFEM-01", groupId: "GRP-ALV-TOA-FEM", familia: "🌸 Toallas Femeninas y Protectores Alive (precios distintos · 1 cja = 72 pqts)", nom: "Toallas Alive Regular Día con Alas 245mm", rx: /^ALV-TOAFEM-01$/i, empaque: "1 cja = 72 pqts", sinConteoVar: true },
      { id: "ALV-TOAFEM-02", groupId: "GRP-ALV-TOA-FEM", familia: "🌸 Toallas Femeninas y Protectores Alive (precios distintos · 1 cja = 72 pqts)", nom: "Toallas Alive Nocturna Noche 290mm", rx: /^ALV-TOAFEM-02$/i, empaque: "1 cja = 72 pqts", sinConteoVar: true },
      { id: "ALV-TOAFEM-03", groupId: "GRP-ALV-TOA-FEM", familia: "🌸 Toallas Femeninas y Protectores Alive (precios distintos · 1 cja = 72 pqts)", nom: "Toallas Alive Extra Larga 340mm", rx: /^ALV-TOAFEM-03$/i, empaque: "1 cja = 72 pqts", sinConteoVar: true },
      { id: "ALV-TOAFEM-04", groupId: "GRP-ALV-TOA-FEM", familia: "🌸 Toallas Femeninas y Protectores Alive (precios distintos · 1 cja = 72 pqts)", nom: "Protectores Diarios Alive × 20 und", rx: /^ALV-TOAFEM-04$/i, empaque: "1 cja = 72 pqts", sinConteoVar: true },
      // Pañales Baby Finger y Adulto (todos los bultos llevan 12 pqts · precios distintos por talla)
      { id: "BF-PAN-P20", groupId: "GRP-BF-PAN", familia: "👶 Pañales Baby Finger y Adulto (precios distintos por talla · 1 bulto = 12 pqts)", nom: "Pañal Baby Finger Talla P · 20 und", rx: /^BF-PAN-P20$/i, empaque: "1 bulto = 12 pqts", sinConteoVar: true },
      { id: "BF-PAN-P10", groupId: "GRP-BF-PAN", familia: "👶 Pañales Baby Finger y Adulto (precios distintos por talla · 1 bulto = 12 pqts)", nom: "Pañal Baby Finger Talla P · 10 und", rx: /^BF-PAN-P10$/i, empaque: "1 bulto = 12 pqts", sinConteoVar: true },
      { id: "BF-PAN-M18", groupId: "GRP-BF-PAN", familia: "👶 Pañales Baby Finger y Adulto (precios distintos por talla · 1 bulto = 12 pqts)", nom: "Pañal Baby Finger Talla M · 18 und", rx: /^BF-PAN-M18$/i, empaque: "1 bulto = 12 pqts", sinConteoVar: true },
      { id: "BF-PAN-G18", groupId: "GRP-BF-PAN", familia: "👶 Pañales Baby Finger y Adulto (precios distintos por talla · 1 bulto = 12 pqts)", nom: "Pañal Baby Finger Talla G · 18 und", rx: /^BF-PAN-G18$/i, empaque: "1 bulto = 12 pqts", sinConteoVar: true },
      { id: "BF-PAN-XG16", groupId: "GRP-BF-PAN", familia: "👶 Pañales Baby Finger y Adulto (precios distintos por talla · 1 bulto = 12 pqts)", nom: "Pañal Baby Finger Talla XG · 16 und", rx: /^BF-PAN-XG16$/i, empaque: "1 bulto = 12 pqts", sinConteoVar: true },
      { id: "BF-PAN-XXG16", groupId: "GRP-BF-PAN", familia: "👶 Pañales Baby Finger y Adulto (precios distintos por talla · 1 bulto = 12 pqts)", nom: "Pañal Baby Finger Talla XXG · 16 und", rx: /^BF-PAN-XXG16$/i, empaque: "1 bulto = 12 pqts", sinConteoVar: true },
      { id: "BF-PAN-XXXG", groupId: "GRP-BF-PAN", familia: "👶 Pañales Baby Finger y Adulto (precios distintos por talla · 1 bulto = 12 pqts)", nom: "Pañal Baby Finger Talla XXXG · 14 und", rx: /^BF-PAN-XXXG$/i, empaque: "1 bulto = 12 pqts", sinConteoVar: true },
      { id: "ALV-PAN-ADM", groupId: "GRP-BF-PAN", familia: "👶 Pañales Baby Finger y Adulto (precios distintos por talla · 1 bulto = 12 pqts)", nom: "Pañal Adulto Alive Talla M · 6 und", rx: /^ALV-PAN-ADM$/i, empaque: "1 bulto = 12 pqts", sinConteoVar: true },
      { id: "ALV-PAN-ADXG", groupId: "GRP-BF-PAN", familia: "👶 Pañales Baby Finger y Adulto (precios distintos por talla · 1 bulto = 12 pqts)", nom: "Pañal Adulto Alive Talla XG · 6 und", rx: /^ALV-PAN-ADXG$/i, empaque: "1 bulto = 12 pqts", sinConteoVar: true },
    ];
    const todosCodes = Object.keys(mapa).filter((c) => !esProductoSkala(c));
    return DEFINICION_GRUPOS_ONTIVEROS.map((def) => {
      const codes = todosCodes.filter((c) => def.rx.test(c));
      const sufijo = def.sinConteoVar ? `(${def.empaque})` : `(${codes.length} var. · ${def.empaque})`;
      return {
        id: def.id,
        aliasId: def.groupId || "",
        familia: def.familia || "",
        nombre: `${def.nom} ${sufijo}`,
        codes,
      };
    }).filter((g) => g.codes.length > 0);
  }

  /* Modalidad de venta por producto ("caja" = Caja/Bulto · "unidad" = Unidad/Blíster · "ambos" = Caja/Bulto y Unidad/Blíster) */
  const K_MODO_VENTA_PROD = "skala_modalidad_venta_v1";
  const K_CFG_GRUPOS_DIST = "dist_ontiveros_config_grupos_v1";
  const leerModalidadVentaMap = () => leerLS(K_MODO_VENTA_PROD, {}) || {};
  function todosLosGruposConCodigos() {
    return [...gruposDeCatalogoParaPrecios("skala"), ...gruposDeCatalogoParaPrecios("distribuidora")];
  }
  function grupoDeProductoCode(code) {
    const c = String(code || "").toUpperCase();
    return todosLosGruposConCodigos().find((g) => g.codes.some((x) => String(x).toUpperCase() === c)) || null;
  }
  function modoVentaProducto(code) {
    const c = String(code || "").toUpperCase();
    const mapa = leerModalidadVentaMap();
    if (mapa[c] === "caja" || mapa[c] === "unidad" || mapa[c] === "ambos") return mapa[c];
    const grp = grupoDeProductoCode(c);
    if (grp) {
      const cfg = leerConfigGrupos();
      const cg = cfg[grp.id] || (grp.aliasId && cfg[grp.aliasId]);
      if (cg && cg.modo_venta) return cg.modo_venta;
      if (cg && typeof cg.permite_unidad === "boolean") return cg.permite_unidad ? "ambos" : "caja";
    }
    return esProductoSkala(c) ? "caja" : "ambos";
  }
  function fijarModalidadVentaProducto(code, modo) {
    const c = String(code || "").toUpperCase();
    const m = modo === "unidad" || modo === "ambos" ? modo : "caja";
    const mapa = leerModalidadVentaMap();
    mapa[c] = m;
    guardarLS(K_MODO_VENTA_PROD, mapa);

    const grp = grupoDeProductoCode(c);
    if (grp) {
      const permiteUnd = grp.codes.some((cod) => {
        const mc = String(cod).toUpperCase() === c ? m : modoVentaProducto(cod);
        return mc === "unidad" || mc === "ambos";
      });
      const cfg = leerConfigGrupos();
      const prev = cfg[grp.id] || (grp.aliasId && cfg[grp.aliasId]) || {};
      const act = { ...prev, permite_unidad: permiteUnd, modo_venta: m };
      cfg[grp.id] = act;
      if (grp.aliasId) cfg[grp.aliasId] = act;
      guardarConfigGrupos(cfg);
      try {
        const rawDist = localStorage.getItem(K_CFG_GRUPOS_DIST);
        const cfgDist = rawDist ? JSON.parse(rawDist) : {};
        const prevDist = cfgDist[grp.id] || (grp.aliasId && cfgDist[grp.aliasId]) || {};
        const actDist = { ...prevDist, permiteUnidad: permiteUnd, modoVenta: m };
        cfgDist[grp.id] = actDist;
        if (grp.aliasId) cfgDist[grp.aliasId] = actDist;
        localStorage.setItem(K_CFG_GRUPOS_DIST, JSON.stringify(cfgDist));
      } catch (_) {}
    }
    return m;
  }
  function etiquetaModoVenta(modo) {
    if (modo === "unidad") return "Unidad / Blíster";
    if (modo === "ambos") return "Caja/Bulto y Unidad/Blíster";
    return "Caja / Bulto";
  }

  /* ---------- Inventario (Ajustar existencias y si se vende por Caja/Bulto o Unidad/Blíster) ---------- */
  async function vInventario(v, _p, _q, vigente) {
    const r = await api("inventario");
    if (!vigente()) return;
    const nombre = (c) => (allProductsMap()[c] || {}).name;
    const prods = r.productos.map((x) => ({ ...x, producto: nombre(x.code) || x.producto }));
    const fila = (x) => {
      const catItem = esProductoSkala(x.code) ? "skala" : "distribuidora";
      const modoV = modoVentaProducto(x.code);
      return `<li class="inv-fila${x.controlado && x.disponible <= 0 ? " sin-stock" : ""}" data-code="${esc(x.code)}" data-cat="${catItem}" data-texto="${esc((x.producto + " " + x.code).toLowerCase())}">
        <div class="inv-top">
          <div class="inv-nombre"><strong>${esc(x.producto)}</strong><span class="ped-det">${esc(x.code)}${x.nuevo ? ' · <span class="etq-nuevo">Nuevo</span>' : ""}</span></div>
          <div class="inv-stock${x.controlado && x.disponible <= 0 ? " agotado" : ""}">${x.controlado ? `<strong>${x.disponible}</strong><span>${x.disponible <= 0 ? "sin stock" : "disponibles"}</span>` : '<span>Sin cargar</span>'}</div></div>
        <p class="ped-det">${x.controlado ? `En depósito ${x.fisico}${x.por_salir ? ` · ${x.por_salir} aprobadas por salir` : ""}` : "No se controla hasta la primera entrada o conteo"}${x.en_proceso ? ` · en proceso ${x.en_proceso}` : ""}</p>
        <div class="inv-modo-venta" role="group" aria-label="Modalidad de venta de ${esc(x.producto)}">
          <span class="inv-modo-lbl">Se vende por:</span>
          <div class="inv-modo-pills">
            <button type="button" class="btn-modo-venta${modoV === "caja" ? " active" : ""}" data-modo-venta="caja" data-code="${esc(x.code)}">📦 Caja / Bulto</button>
            <button type="button" class="btn-modo-venta${modoV === "unidad" ? " active" : ""}" data-modo-venta="unidad" data-code="${esc(x.code)}">🧴 Unidad / Blíster</button>
            <button type="button" class="btn-modo-venta${modoV === "ambos" ? " active" : ""}" data-modo-venta="ambos" data-code="${esc(x.code)}">📦+🧴 Ambos</button>
          </div>
        </div>
        <div class="inv-botones"><button type="button" class="btn btn-ghost" data-inv="entrada">Ajustar stock</button>${x.nuevo ? '<button type="button" class="btn btn-ghost" data-inv="editar">Editar</button>' : ""}</div>
      </li>`;
    };
    v.innerHTML = `
      <div class="inv-acciones">
        <a class="inv-accion" href="#/inventario/cargar?modo=entrada" id="lnkEntrada"><b>+</b><span><strong>Cargar mercancía</strong><em>Sumar las cajas que llegaron</em></span></a>
        <a class="inv-accion" href="#/inventario/cargar?modo=conteo" id="lnkConteo"><b>#</b><span><strong>Conteo total</strong><em>Escribir cuántas hay en el depósito</em></span></a>
      </div>
      <button type="button" class="btn btn-ghost btn-bloque" id="btnNuevoProd">Nuevo producto</button>
      <div class="periodos" id="invCatTabs" role="tablist" aria-label="Filtrar existencias por catálogo">
        <button type="button" class="tab${filtroCatInv === "todos" ? " active" : ""}" data-cat-inv="todos">Todos</button>
        <button type="button" class="tab${filtroCatInv === "skala" ? " active" : ""}" data-cat-inv="skala">Skala Venezuela</button>
        <button type="button" class="tab${filtroCatInv === "distribuidora" ? " active" : ""}" data-cat-inv="distribuidora">Dist. Ontiveros</button>
      </div>
      <div class="buscador"><input type="search" id="invBuscar" placeholder="Buscar producto o código para ajustar existencias" autocomplete="off" value="${esc(busquedaInv)}" /></div>
      <ul class="lista-inv" id="invLista">${prods.map(fila).join("")}</ul>
      <details class="tarjeta"><summary class="sub-titulo">Últimos movimientos</summary>
        ${r.movimientos.length ? `<ul class="resumen-items">${r.movimientos.slice(0, 30).map((m) => `<li><span>${esc(nombre(m.code) || m.producto)} <span class="ped-det">${esc(new Date(m.fecha).toLocaleDateString("es-VE"))} · ${esc(m.usuario)}${m.nota ? " · " + esc(m.nota) : ""}</span></span><em>${m.tipo === "alta" ? "alta" : `${m.tipo === "conteo" ? "conteo " : ""}${m.cajas > 0 ? "+" : ""}${m.cajas}`}</em></li>`).join("")}</ul>` : '<p class="modal-sub">Todavía no hay entradas.</p>'}
      </details>
      <p class="nota-chica">En depósito = entradas, conteos y ajustes − lo que ya salió (en ruta o entregado). Disponible = en depósito − aprobados que todavía no salieron. Los productos sin stock salen en gris en el catálogo y no se pueden pedir. Un producto nuevo empieza sin stock hasta su primera entrada.</p>`;
    const filtrar = () => {
      const q = busquedaInv.trim().toLowerCase();
      v.querySelectorAll(".inv-fila").forEach((li) => {
        const okCat = filtroCatInv === "todos" || li.dataset.cat === filtroCatInv;
        const okQ = !q || li.dataset.texto.includes(q);
        li.hidden = !(okCat && okQ);
      });
    };
    filtrar();
    $("invBuscar").addEventListener("input", (e) => { busquedaInv = e.target.value; filtrar(); });
    $("invCatTabs").addEventListener("click", (e) => {
      const t = e.target.closest("[data-cat-inv]");
      if (!t) return;
      filtroCatInv = t.dataset.catInv;
      $("invCatTabs").querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === t));
      filtrar();
    });
    $("btnNuevoProd").addEventListener("click", () => formProducto(null));
    $("invLista").addEventListener("click", async (e) => {
      const btnModo = e.target.closest("[data-modo-venta]");
      if (btnModo) {
        const code = btnModo.dataset.code;
        const nuevoModo = fijarModalidadVentaProducto(code, btnModo.dataset.modoVenta);
        const li = btnModo.closest(".inv-fila");
        if (li) {
          li.querySelectorAll("[data-modo-venta]").forEach((b) => b.classList.toggle("active", b.dataset.modoVenta === nuevoModo));
        }
        const prod = prods.find((p) => p.code === code);
        toast(`${prod ? prod.producto : code}: se vende por ${etiquetaModoVenta(nuevoModo)}`);
        return;
      }
      const b = e.target.closest("[data-inv]");
      if (!b) return;
      const x = prods.find((p) => p.code === b.closest(".inv-fila").dataset.code);
      if (b.dataset.inv === "editar") return formProducto(x);
      const modoActual = modoVentaProducto(x.code);
      const d = await hoja({
        titulo: `${x.producto} · inventario`,
        cuerpo: `<p class="modal-sub">${x.controlado ? `En depósito: <strong>${x.fisico}</strong> cajas · disponibles: <strong>${x.disponible}</strong>.` : "Primera carga: desde aquí se empieza a controlar el stock."}</p>
          <fieldset class="pay"><legend>Se vende por (Modalidad)</legend>
            <label class="pay-opt"><input type="radio" name="modo_venta" value="caja"${modoActual === "caja" ? " checked" : ""} /> 📦 Caja / Bulto</label>
            <label class="pay-opt"><input type="radio" name="modo_venta" value="unidad"${modoActual === "unidad" ? " checked" : ""} /> 🧴 Unidad / Blíster</label>
            <label class="pay-opt"><input type="radio" name="modo_venta" value="ambos"${modoActual === "ambos" ? " checked" : ""} /> 📦+🧴 Ambos (Caja/Bulto y Unidad/Blíster)</label></fieldset>
          <fieldset class="pay"><legend>Tipo de movimiento de stock</legend>
            <label class="pay-opt"><input type="radio" name="tipo" value="entrada" checked /> Entrada de mercancía (sumar)</label>
            <label class="pay-opt"><input type="radio" name="tipo" value="conteo" /> Conteo total (cuántas hay en el depósito)</label>
            <label class="pay-opt"><input type="radio" name="tipo" value="ajuste" /> Ajuste (rotura, pérdida…) — puede ser negativo</label></fieldset>
          <label class="field field-full"><span id="hCajasTxt">Cajas (opcional si solo cambiás modalidad)</span><input name="cajas" id="hCajas" inputmode="numeric" autocomplete="off" placeholder="ej. 20 (ajuste: -2)" /></label>
          <label class="field field-full"><span>Nota</span><input name="nota" maxlength="200" autocomplete="off" placeholder="Factura del proveedor, motivo del ajuste…" /></label>`,
        ok: "Guardar",
        alAbrir: (form) => form.addEventListener("change", (e) => {
          if (e.target.name !== "tipo") return;
          form.querySelector("#hCajasTxt").textContent = e.target.value === "conteo" ? "Total de cajas en el depósito *" : "Cajas (opcional si solo cambiás modalidad)";
        }),
        validar: (d2) => {
          const rawCajas = String(d2.cajas || "").trim();
          if (!rawCajas && d2.modo_venta && d2.modo_venta !== modoActual) return "";
          const n = Math.round(numTxt(d2.cajas));
          if (d2.tipo === "conteo") return rawCajas !== "" && n >= 0 ? "" : "Escribí cuántas cajas contaste (0 si no hay).";
          if (!n) return "Indicá la cantidad de cajas.";
          if (d2.tipo === "entrada" && n < 0) return "Una entrada debe ser mayor que 0. Para restar elegí Ajuste.";
          if (d2.tipo === "ajuste" && !d2.nota.trim()) return "Escribí el motivo del ajuste.";
          return "";
        },
      });
      if (!d) return;
      if (d.modo_venta) fijarModalidadVentaProducto(x.code, d.modo_venta);
      if (String(d.cajas || "").trim() === "") {
        toast(`${x.producto}: se vende por ${etiquetaModoVenta(d.modo_venta || modoActual)}`);
        render();
        return;
      }
      try {
        const res = await api("movimiento", { code: x.code, producto: x.producto, cajas: Math.round(numTxt(d.cajas)), tipo: d.tipo, nota: d.nota.trim() });
        toast(d.tipo === "conteo" ? `${x.producto}: ${res.fisico} en depósito${res.diferencia ? ` (${res.diferencia > 0 ? "+" : ""}${res.diferencia})` : ", coincide"}` : `${x.producto}: ${res.disponible} disponibles`);
        SkalaAPI.catalogo(true).catch(() => {});
        render();
      } catch (e2) { toast(e2.message); }
    });
  }

  /* ---------- Precios (SOLO para ajustar precios · selector Skala Venezuela o Dist. Ontiveros) ---------- */
  async function vPrecios(v, _p, query, vigente) {
    const esDistDefault = typeof GRUPOS_DISTRIBUIDORA !== "undefined" && Array.isArray(GRUPOS_DISTRIBUIDORA);
    const qCat = query && query.get ? query.get("cat") : "";
    if (qCat === "skala" || qCat === "distribuidora") catPreciosActual = qCat;
    else if (!catPreciosActual) catPreciosActual = esDistDefault ? "distribuidora" : "skala";

    const r = await api("inventario");
    if (!vigente()) return;
    const nombre = (c) => (allProductsMap()[c] || {}).name;
    const todosProds = r.productos.map((x) => ({ ...x, producto: nombre(x.code) || x.producto }));
    const linea = (pre, tit, x) => {
      const v = (k) => x[pre ? (k ? `mayor_${k}` : "mayor") : (k || "menor")];
      const partes = FORMAS.map(([k, t]) => (v(k) ? `${k ? t.replace("Efectivo", "Ef.").replace(" pago", "") : "Normal"} ${dinero(v(k))}` : "")).filter(Boolean);
      return partes.length ? `<span class="inv-nivel"><b>${tit}</b> ${partes.join(" · ")}</span>` : "";
    };
    const precioTxt = (x) => x.menor ? `${linea(false, "Menor:", x)}${linea(true, "Mayor:", x)}` : "<em>Sin precio</em>";

    const pintarVistaPrecios = () => {
      const esSkalaSel = catPreciosActual === "skala";
      const prodsCat = todosProds.filter((x) => (esSkalaSel ? esProductoSkala(x.code) : !esProductoSkala(x.code)));
      const GRUPOS_PANEL = gruposDeCatalogoParaPrecios(catPreciosActual);
      const cfgG = leerConfigGrupos();
      const sinPrecio = prodsCat.filter((x) => !x.menor).length;

      const filaPrecio = (x) => `<li class="inv-fila" data-code="${esc(x.code)}" data-texto="${esc((x.producto + " " + x.code).toLowerCase())}">
        <div class="inv-top">
          <label class="inv-check"><input type="checkbox" value="${esc(x.code)}" aria-label="Elegir ${esc(x.producto)}" /></label>
          <div class="inv-nombre"><strong>${esc(x.producto)}</strong><span class="ped-det">${esc(x.code)}</span></div>
        </div>
        <p class="ped-det inv-precios">${precioTxt(x)}</p>
        <div class="inv-botones"><button type="button" class="btn btn-ghost" data-pre="precio">Ajustar precio</button></div>
      </li>`;

      v.innerHTML = `
        <section class="tarjeta" style="margin-bottom:12px">
          <h3 class="sub-titulo" style="margin-bottom:6px">Elegí el catálogo para ajustar precios</h3>
          <div class="periodos" id="preCatalogoTabs" role="tablist" aria-label="Catálogo para ajustar precios">
            <button type="button" role="tab" class="tab${esSkalaSel ? " active" : ""}" aria-selected="${esSkalaSel}" data-cat-precios="skala">🌸 Skala Venezuela</button>
            <button type="button" role="tab" class="tab${!esSkalaSel ? " active" : ""}" aria-selected="${!esSkalaSel}" data-cat-precios="distribuidora">🏢 Dist. Ontiveros</button>
          </div>
          <p class="nota-chica" style="margin-top:8px">${esSkalaSel
            ? "Ajustando precios de <strong>Skala Venezuela</strong> (Baños de Crema 1 kg y Kits Dúo Shampoo + Acondicionador)."
            : "Ajustando precios de <strong>Dist. Ontiveros</strong> (Detergentes, Suavizantes, Cuidado Personal, Bebé y Hogar)."}</p>
        </section>
        <details class="tarjeta inv-grupos-card" id="secPreciosGrupo" open>
          <summary class="sub-titulo">📦 Precios por Grupo y Presentación · ${esSkalaSel ? "Skala Venezuela" : "Dist. Ontiveros"}</summary>
          <p class="nota-chica">Configurá precios en 1 clic por grupo (mismo precio para sus fragancias) o por presentación/talla individual (Alisoft, Toallín, Toallas y Pañales). La modalidad de venta (Caja/Bulto o Unidad/Blíster) se ajusta en <strong>Inventario</strong>.</p>
          <ul class="resumen-items lista-grupos-inv">
            ${(() => {
              let famAnt = "";
              return GRUPOS_PANEL.map((g) => {
                const cg = cfgG[g.id] || {};
                const refP = todosProds.find((p) => p.code === g.codes[0]) || {};
                const pMenor = Number(cg.menor) || Number(refP.menor) || 0;
                const pMayor = Number(cg.mayor) || Number(refP.mayor) || 0;
                const pUnd = Number(cg.precio_unidad) || 0;
                const etqUnd = g.id === "GRP-DOR-PACE3" ? "Blíster" : "Und";
                const resPrecio = pMenor > 0
                  ? `Menor: <strong>${dinero(pMenor)}</strong> · Mayor: <strong>${dinero(pMayor || pMenor)}</strong>${pUnd > 0 ? ` · ${etqUnd}: <strong>${dinero(pUnd)}</strong>` : ""}`
                  : "<em>Sin precio configurado</em>";
                let sepFam = "";
                if (g.familia && g.familia !== famAnt) {
                  famAnt = g.familia;
                  sepFam = `<li class="item-familia-sep" style="padding:10px 4px 4px;border-top:1px solid var(--borde,#e2e8f0);margin-top:6px"><strong style="font-size:0.86rem;color:var(--verde-osc,#0f5132)">${esc(g.familia)}</strong></li>`;
                }
                return `${sepFam}<li class="item-grupo-inv" data-grupo-id="${esc(g.id)}">
                  <div class="grupo-inv-info">
                    <strong>${esc(g.nombre)}</strong>
                    <span class="ped-det" data-grp-resumen="${esc(g.id)}">${resPrecio}</span>
                  </div>
                  <button type="button" class="btn btn-ghost" data-grp-precio="${esc(g.id)}">Precios</button>
                </li>`;
              }).join("");
            })()}
          </ul>
        </details>
        <div class="buscador"><input type="search" id="preBuscar" placeholder="Buscar producto o código en ${esSkalaSel ? "Skala Venezuela" : "Dist. Ontiveros"}" autocomplete="off" value="${esc(busquedaPre)}" /></div>
        ${sinPrecio ? `<p class="aviso-chico">${sinPrecio} producto(s) sin precio en ${esSkalaSel ? "Skala Venezuela" : "Dist. Ontiveros"}. Elegí varios con la casilla y tocá <strong>Poner precios</strong>.</p>` : ""}
        <div class="fila-elegir"><label class="check"><input type="checkbox" id="preTodos" /> Elegir todos los que se ven</label></div>
        <ul class="lista-inv" id="preLista">${prodsCat.map(filaPrecio).join("")}</ul>
        <div class="barra-accion" id="preBarra" hidden><div><strong id="preSel">0 elegidos</strong><span> · mismo precio para todos</span></div><button type="button" class="btn btn-primary" id="btnPreciosVarios">Poner precios</button></div>`;

      const filtrar = () => {
        const q = busquedaPre.trim().toLowerCase();
        v.querySelectorAll("#preLista .inv-fila").forEach((li) => {
          li.hidden = !!q && !li.dataset.texto.includes(q);
        });
      };
      filtrar();

      const elegidos = () => [...v.querySelectorAll("#preLista .inv-check input:checked")].map((c) => c.value);
      const pintarSel = () => {
        const n = elegidos().length;
        $("preBarra").hidden = !n;
        $("preSel").textContent = `${n} elegido${n === 1 ? "" : "s"}`;
        v.querySelectorAll("#preLista .inv-fila").forEach((li) => li.classList.toggle("elegida", li.querySelector(".inv-check input").checked));
      };

      $("preCatalogoTabs").addEventListener("click", (e) => {
        const b = e.target.closest("[data-cat-precios]");
        if (!b) return;
        catPreciosActual = b.dataset.catPrecios;
        pintarVistaPrecios();
      });
      $("preBuscar").addEventListener("input", (e) => { busquedaPre = e.target.value; filtrar(); });
      $("preLista").addEventListener("change", pintarSel);
      $("preTodos").addEventListener("change", (e) => {
        v.querySelectorAll("#preLista .inv-fila:not([hidden]) .inv-check input").forEach((c) => (c.checked = e.target.checked));
        pintarSel();
      });

      const sincronizarPreciosConCatalogoPublico = (idsOCodes, pObj, pUnd = 0) => {
        try {
          const rawDist = localStorage.getItem(K_CFG_GRUPOS_DIST);
          const cfgDist = rawDist ? JSON.parse(rawDist) : {};
          idsOCodes.filter(Boolean).forEach((key) => {
            const prev = cfgDist[key] || {};
            cfgDist[key] = {
              ...prev,
              precioMenor: Number(pObj.menor) || prev.precioMenor || 0,
              precioMayor: Number(pObj.mayor) || Number(pObj.menor) || prev.precioMayor || 0,
              ...(pUnd > 0 ? { precioUnidad: pUnd } : {}),
            };
          });
          localStorage.setItem(K_CFG_GRUPOS_DIST, JSON.stringify(cfgDist));
        } catch (_) {}
      };

      const guardarPrecios = async (codes, titulo, previo) => {
        const d = await hoja({ titulo, cuerpo: camposPrecios(previo), ok: "Guardar precios", validar: validarPrecios });
        if (!d) return false;
        const pObj = preciosDe(d);
        try {
          const res = await api("guardarPrecio", { codes, ...pObj });
          sincronizarPreciosConCatalogoPublico(codes, pObj);
          toast(res.guardados > 1 ? `Precios guardados en ${res.guardados} productos` : "Precios guardados");
          SkalaAPI.catalogo(true).catch(() => {});
          render();
          return true;
        } catch (e2) { toast(e2.message); return false; }
      };

      $("btnPreciosVarios").addEventListener("click", () => {
        const codes = elegidos();
        if (codes.length) guardarPrecios(codes, `Precios para ${codes.length} producto${codes.length === 1 ? "" : "s"}`);
      });

      const secG = $("secPreciosGrupo");
      if (secG) {
        secG.addEventListener("click", async (e) => {
          const btn = e.target.closest("[data-grp-precio]");
          if (!btn) return;
          const gid = btn.dataset.grpPrecio;
          const grp = GRUPOS_PANEL.find((g) => g.id === gid);
          if (!grp) return;
          const cfg = leerConfigGrupos();
          const cg = cfg[gid] || {};
          const refP = todosProds.find((p) => p.code === grp.codes[0]) || {};
          const previo = { ...refP, ...cg };
          const esDorco = gid === "GRP-DOR-PACE3";
          const d = await hoja({
            titulo: `Precios · ${grp.nombre}`,
            cuerpo: `${camposPrecios(previo)}
              <fieldset class="pay grupo-precios">
                <legend>${esDorco ? "Precio por Blíster (1 blíster = ×12 pqts de 3 afeitadoras)" : "Precio por Unidad / Blíster (opcional)"}</legend>
                <label class="field field-full"><span>${esDorco ? "Precio por blíster ($)" : "Precio por unidad suelta ($)"}</span><input name="precio_unidad" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${cg.precio_unidad ? String(cg.precio_unidad).replace(".", ",") : ""}" /></label>
              </fieldset>`,
            ok: "Guardar precios",
            validar: validarPrecios,
          });
          if (!d) return;
          const pObj = preciosDe(d);
          const pUnd = String(d.precio_unidad || "").trim() === "" ? 0 : numTxt(d.precio_unidad);
          const pUndFinal = isFinite(pUnd) && pUnd > 0 ? pUnd : 0;
          const nuevoCfg = {
            ...cg,
            ...pObj,
            precio_unidad: pUndFinal,
          };
          cfg[gid] = nuevoCfg;
          if (grp.aliasId && !grp.familia) cfg[grp.aliasId] = nuevoCfg;
          guardarConfigGrupos(cfg);
          sincronizarPreciosConCatalogoPublico([gid, !grp.familia ? grp.aliasId : "", ...grp.codes], pObj, pUndFinal);
          try {
            await api("guardarPrecio", { codes: grp.codes, ...pObj });
            toast(grp.codes.length > 1 ? `Precios aplicados a las ${grp.codes.length} variedades` : `Precio actualizado: ${grp.nombre}`);
            SkalaAPI.catalogo(true).catch(() => {});
            render();
          } catch (e2) { toast(e2.message); }
        });
      }

      $("preLista").addEventListener("click", (e) => {
        const b = e.target.closest("[data-pre]");
        if (!b) return;
        const x = prodsCat.find((p) => p.code === b.closest(".inv-fila").dataset.code);
        if (x && b.dataset.pre === "precio") guardarPrecios([x.code], `Precios · ${x.producto}`, x);
      });
    };

    pintarVistaPrecios();
  }

  /* ---------- Cargar inventario: grilla con fotos, como al tomar un pedido ----------
     modo entrada: cajas que llegaron (se suman) · modo conteo: total que hay en el depósito */
  let busquedaInvC = "", filtroInvC = "todos";
  async function vCargarInventario(v, _p, query, vigente) {
    const modo = query.get("modo") === "conteo" ? "conteo" : "entrada";
    const conteo = modo === "conteo";
    const leerBorrador = () => { const b = leerLS(K_INV, {}) || {}; return b[modo] && typeof b[modo] === "object" ? b[modo] : {}; };
    const guardarBorrador = (m) => { const b = leerLS(K_INV, {}) || {}; b[modo] = m; guardarLS(K_INV, b); };
    if (filtroInvC === "elegidos" && !Object.keys(leerBorrador()).length) filtroInvC = "todos"; // nada elegido: mostrar todo
    const esDistInv = typeof GRUPOS_DISTRIBUIDORA !== "undefined" && Array.isArray(GRUPOS_DISTRIBUIDORA);
    const pestanasFiltroInv = esDistInv
      ? [
          ["todos", "Todos"],
          ["Detergentes", "Detergentes"],
          ["Suavizantes", "Suavizantes"],
          ["Cuidado Personal", "Cuidado Personal"],
          ["Bebé y Pañales", "Bebé y Pañales"],
          ["Hogar y Papel", "Hogar y Papel"],
          ["Skala", "Skala"],
          ["elegidos", conteo ? "Contados" : "Elegidos"],
        ]
      : [
          ["todos", "Todos"],
          ["banos", "Baños de crema"],
          ["kits", "Kits"],
          ["elegidos", conteo ? "Contados" : "Elegidos"],
        ];
    v.innerHTML = `
      <div class="periodos tabs-ped tabs-ent" role="tablist">
        <a role="tab" class="tab${!conteo ? " active" : ""}" aria-selected="${!conteo}" href="#/inventario/cargar?modo=entrada">Entrada</a>
        <a role="tab" class="tab${conteo ? " active" : ""}" aria-selected="${conteo}" href="#/inventario/cargar?modo=conteo">Conteo total</a>
      </div>
      <p class="aviso-chico inv-explica">${conteo
        ? "Escribí <strong>cuántas cajas hay</strong> de cada producto en el depósito. Se guarda la diferencia con el sistema. Solo cuentan los productos que llenes."
        : "Tocá un producto para sumar las cajas que <strong>llegaron</strong>. Se suman a lo que ya hay."}</p>
      <div class="barra-buscador-vista">
        <div class="buscador"><input type="search" id="icBuscar" placeholder="Buscar producto o código" autocomplete="off" enterkeyhint="search" value="${esc(busquedaInvC)}" /></div>
        ${selectorVistaCatHTML()}
      </div>
      <div class="periodos" id="icFiltros">${pestanasFiltroInv.map(([k, t]) =>
        `<button type="button" class="tab${k === filtroInvC ? " active" : ""}" data-f="${k}">${t}</button>`).join("")}</div>
      <ul class="grilla-prod grilla-inv${conteo ? " modo-conteo" : ""}" id="icLista">${spin()}</ul>
      <p class="vacio-panel" id="icVacio" hidden>No hay productos con ese filtro.</p>
      <div class="barra-accion" id="icBarra">
        <div><strong id="icTotal">0 productos</strong><span id="icDetalle"></span></div>
        <button type="button" class="btn btn-ghost" id="icVaciar" hidden>Vaciar</button>
        <button type="button" class="btn btn-primary" id="icGuardar" disabled>${conteo ? "Guardar conteo" : "Cargar"}</button>
      </div>`;
    const r = await api("inventario");
    if (!vigente()) return;
    sumarProductosNuevos(r.productos.filter((x) => x.info).map((x) => ({ code: x.code, info: x.info }))); // quedan en BANOS / KITS
    const stock = Object.fromEntries(r.productos.map((x) => [x.code, x]));
    const productos = [...BANOS.map((p) => ({ ...p, tipo: p.tipo || "banos" })), ...KITS.map((p) => ({ ...p, tipo: "kits" }))];
    const lista = $("icLista");
    enlazarSelectorVistaCat(v, lista);
    lista.innerHTML = productos.map((p) => {
      const st = stock[p.code] || {};
      return `<li class="pcard" data-code="${p.code}" data-tipo="${p.tipo}" data-linea="${esc(p.line || "")}" data-marca="${esc(p.marca || "")}" data-texto="${esc((p.name + " " + p.code + " " + (p.line || "") + " " + (p.marca || "")).toLowerCase())}">
        <button type="button" class="pcard-tap" data-act="${conteo ? "contar" : "plus"}" aria-label="${conteo ? `Contar ${esc(p.name)}` : `Sumar una caja de ${esc(p.name)}`}">
          ${fotoHTML(p.code, { ancho: 64, alto: 51 })}
          <strong>${esc(p.name)}</strong>
          <span class="pcard-sub">${p.code} · ${esc(textoUnidades(p))}</span>
          <span class="pcard-stock">${st.controlado ? `En depósito: <b>${st.fisico}</b>` : "Sin cargar"}</span>
          <span class="pcard-dif" data-dif></span>
        </button>
        <b class="pcard-n" aria-hidden="true"></b>
        <div class="pcard-qty">
          <button type="button" class="qty-btn" data-act="minus" aria-label="Restar una caja de ${esc(p.name)}">−</button>
          <input class="qty-input" type="number" min="0" step="1" inputmode="numeric" pattern="[0-9]*" placeholder="${conteo ? "¿Cuántas?" : "0"}" aria-label="${conteo ? "Cajas contadas" : "Cajas que llegaron"} de ${esc(p.name)}" />
          <button type="button" class="qty-btn" data-act="plus" aria-label="Sumar una caja de ${esc(p.name)}">+</button>
        </div>
      </li>`;
    }).join("");
    const actual = (code) => { const n = leerBorrador()[code]; return n === undefined || n === null || n === "" ? null : Number(n); };
    const base = (code) => { const st = stock[code]; return st && st.controlado ? st.fisico : 0; };
    const signo = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
    const pintar = () => {
      let prods = 0, cajas = 0, dif = 0;
      lista.querySelectorAll(".pcard").forEach((li) => {
        const code = li.dataset.code;
        const q = actual(code);
        const inp = li.querySelector(".qty-input");
        if (document.activeElement !== inp) inp.value = q === null ? "" : q;
        const tiene = q !== null && (conteo || q > 0);
        li.classList.toggle("elegido", tiene);
        const d = conteo && tiene ? q - base(code) : 0;
        li.querySelector(".pcard-n").textContent = tiene ? (conteo ? (d ? signo(d) : "✓") : `+${q}`) : "";
        li.classList.toggle("dif-menos", conteo && tiene && d < 0);
        li.classList.toggle("dif-mas", conteo && tiene && d > 0);
        li.querySelector("[data-dif]").textContent = conteo && tiene ? (d ? `Contaste ${q} (${signo(d)})` : `Contaste ${q} · coincide`) : "";
        if (tiene) { prods++; cajas += q; dif += d; }
      });
      $("icTotal").textContent = `${prods} producto${prods === 1 ? "" : "s"}`;
      $("icDetalle").textContent = !prods ? (conteo ? " · escribí lo que contaste" : " · tocá un producto para sumarlo")
        : conteo ? ` · dif. ${signo(dif)}` : ` · +${cajas} caja${cajas === 1 ? "" : "s"}`;
      $("icGuardar").disabled = !prods;
      $("icVaciar").hidden = !prods;
      filtrar();
    };
    const filtrar = () => {
      const q = busquedaInvC.trim().toLowerCase();
      let visibles = 0;
      lista.querySelectorAll(".pcard").forEach((li) => {
        const okF = filtroInvC === "todos"
          || li.dataset.tipo === filtroInvC
          || li.dataset.linea === filtroInvC
          || li.dataset.marca === filtroInvC
          || (filtroInvC === "elegidos" && li.classList.contains("elegido"));
        const ok = okF && (!q || li.dataset.texto.includes(q));
        li.hidden = !ok; if (ok) visibles++;
      });
      $("icVacio").hidden = !!visibles;
    };
    const fijar = (code, n) => {
      const m = leerBorrador();
      if (n === null || n === "" || (!conteo && !(Number(n) > 0))) delete m[code];
      else m[code] = Math.max(0, Math.min(99999, Math.floor(Number(n) || 0)));
      guardarBorrador(m);
      pintar();
    };
    lista.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const li = b.closest(".pcard"), code = li.dataset.code;
      const q = actual(code);
      if (b.dataset.act === "contar") {
        // conteo: tocar la tarjeta abre el número; si no se contó, arranca con lo que dice el sistema
        if (q === null) fijar(code, base(code));
        const inp = li.querySelector(".qty-input"); inp.focus(); inp.select();
        return;
      }
      const desde = q === null ? (conteo ? base(code) : 0) : q;
      fijar(code, Math.max(0, desde + (b.dataset.act === "plus" ? 1 : -1)));
      if (b.dataset.act === "plus") { li.classList.remove("pulso"); void li.offsetWidth; li.classList.add("pulso"); }
    });
    lista.addEventListener("input", (e) => {
      if (!e.target.classList.contains("qty-input")) return;
      const t = e.target.value.trim();
      fijar(e.target.closest(".pcard").dataset.code, t === "" ? null : t);
    });
    lista.addEventListener("focusout", (e) => { if (e.target.classList.contains("qty-input")) pintar(); });
    $("icBuscar").addEventListener("input", (e) => { busquedaInvC = e.target.value; filtrar(); });
    $("icFiltros").addEventListener("click", (e) => {
      const t = e.target.closest("[data-f]");
      if (!t) return;
      filtroInvC = t.dataset.f;
      $("icFiltros").querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
      filtrar();
    });
    $("icVaciar").addEventListener("click", async () => {
      if (await hoja({ titulo: conteo ? "¿Borrar el conteo?" : "¿Vaciar la carga?", cuerpo: '<p class="modal-sub">Se borra lo que escribiste en esta pantalla. No cambia el inventario.</p>', ok: "Borrar" })) { guardarBorrador({}); pintar(); }
    });
    $("icGuardar").addEventListener("click", async () => {
      const m = leerBorrador();
      const items = Object.keys(m).filter((c) => stock[c] || allProductsMap()[c]).map((code) => ({ code, cajas: Number(m[code]) }));
      if (!items.length) return;
      const nombre = (c) => (allProductsMap()[c] || {}).name || c;
      const filas = items.map((it) => {
        const d = it.cajas - base(it.code);
        return `<li><span>${esc(nombre(it.code))} <span class="ped-det">${esc(it.code)}</span></span><em>${conteo ? `${it.cajas} <span class="ped-det">(${d ? signo(d) : "coincide"})</span>` : `+${it.cajas}`}</em></li>`;
      }).join("");
      const d = await hoja({
        titulo: conteo ? `Guardar conteo de ${items.length} producto${items.length === 1 ? "" : "s"}` : `Cargar ${items.length} producto${items.length === 1 ? "" : "s"}`,
        cuerpo: `<ul class="resumen-items hoja-lista">${filas}</ul>
          <label class="field field-full"><span>Nota</span><input name="nota" maxlength="200" autocomplete="off" placeholder="${conteo ? "ej. Conteo de fin de mes" : "ej. Factura del proveedor 1234"}" /></label>`,
        ok: conteo ? "Guardar conteo" : "Cargar",
      });
      if (!d) return;
      const btn = $("icGuardar");
      btn.disabled = true; btn.classList.add("ocupado");
      try {
        const res = await api("cargarInventario", { tipo: modo, items, nota: d.nota.trim() });
        guardarBorrador({});
        toast(conteo ? `Conteo guardado: ${res.guardados} producto${res.guardados === 1 ? "" : "s"}` : `Cargadas: ${res.guardados} producto${res.guardados === 1 ? "" : "s"}`);
        SkalaAPI.catalogo(true).catch(() => {});
        ir("#/inventario");
      } catch (e2) { toast(e2.message); btn.disabled = false; btn.classList.remove("ocupado"); }
    });
    pintar();
  }

  /* Producto nuevo (o editar uno nuevo): sale en el catálogo y en el panel */
  async function formProducto(x) {
    const i = (x && x.info) || {};
    const val = (k) => esc(i[k] ?? "");
    const lineas = [...new Set([...BANOS, ...KITS].map((p) => p.line))].sort();
    const d = await hoja({
      titulo: x ? `Editar ${x.producto}` : "Nuevo producto",
      cuerpo: `<fieldset class="pay"><legend>Tipo</legend>
          <label class="pay-opt"><input type="radio" name="tipo" value="banos"${i.tipo !== "kits" ? " checked" : ""} /> Baño de crema (caja x unidades)</label>
          <label class="pay-opt"><input type="radio" name="tipo" value="kits"${i.tipo === "kits" ? " checked" : ""} /> Kit shampoo + acondicionador (caja x dúos)</label></fieldset>
        <div class="form-grid">
          <label class="field field-full"><span>Nombre *</span><input name="nombre" maxlength="80" autocomplete="off" placeholder="ej. Coco Power" value="${val("nombre")}" /></label>
          <label class="field"><span>Línea</span><input name="linea" maxlength="40" autocomplete="off" list="lineasProd" placeholder="ej. Nutrición" value="${val("linea")}" /></label>
          <datalist id="lineasProd">${lineas.map((l) => `<option value="${esc(l)}">`).join("")}</datalist>
          <label class="field"><span>Tipo de cabello</span><input name="cabello" maxlength="20" autocomplete="off" placeholder="1A–4C" value="${val("cabello")}" /></label>
          <label class="field"><span>Unidades por caja</span><input name="unidades_caja" inputmode="numeric" autocomplete="off" placeholder="6" value="${val("unidades")}" /></label>
          <label class="field"><span>Código (opcional)</span><input name="code" maxlength="20" autocomplete="off" autocapitalize="characters" placeholder="automático" value="${esc(x ? x.code : "")}"${x ? " readonly" : ""} /></label>
          <label class="field field-full"><span>Beneficio (texto del catálogo)</span><input name="beneficio" maxlength="200" autocomplete="off" placeholder="ej. Nutrición intensa con coco" value="${val("beneficio")}" /></label>
          <label class="field field-full"><span>Foto (enlace https, opcional)</span><input name="imagen" maxlength="400" inputmode="url" autocomplete="off" placeholder="https://…" value="${val("imagen")}" /></label>
        </div>
        ${x ? "" : `<details class="precios-nuevo"><summary>Precios (opcional, se pueden poner después)</summary>${camposPrecios(null)}</details>`}
        <p class="nota-chica">${x ? "" : "Empieza <strong>sin stock</strong>: en el catálogo sale en gris hasta cargar su primera entrada. "}Sin foto se muestra un dibujo con el nombre.</p>`,
      ok: x ? "Guardar cambios" : "Crear producto",
      validar: (d2) => {
        if (!d2.nombre.trim()) return "Escribí el nombre del producto.";
        if (d2.imagen.trim() && !/^https:\/\//.test(d2.imagen.trim())) return "La foto debe ser un enlace que empiece con https://";
        if (d2.unidades_caja.trim() && !(Number(d2.unidades_caja) >= 1)) return "Revisá las unidades por caja.";
        if (!x && String(d2.menor || "").trim()) return validarPrecios(d2);
        return "";
      },
    });
    if (!d) return;
    try {
      const datos = { code: d.code.trim(), editar: !!x, nombre: d.nombre.trim(), tipo: d.tipo, linea: d.linea.trim(), cabello: d.cabello.trim(),
        unidades_caja: d.unidades_caja.trim() || 6, beneficio: d.beneficio.trim(), imagen: d.imagen.trim() };
      if (!x && String(d.menor || "").trim()) Object.assign(datos, preciosDe(d));
      const res = await api("guardarProducto", datos);
      toast(x ? "Producto actualizado" : `Producto ${res.producto.code} creado (sin stock)`);
      const cat = await SkalaAPI.catalogo(true).catch(() => null);
      if (cat) sumarProductosNuevos(cat.productos);
      render();
    } catch (e2) { toast(e2.message); }
  }

  /* ---------- Usuarios (Master) y Catálogo + Rutas asignadas por vendedor ---------- */
  const CATALOGOS_VENDEDOR = [
    ["ambos", "Ambos catálogos", "Skala Venezuela y Distribuciones Ontiveros (Alive · Baby Finger · DO)"],
    ["skala", "Solo Catálogo Skala", "Recibe pedidos del catálogo de Skala Venezuela"],
    ["distribuidora", "Solo Catálogo Distribuciones Ontiveros", "Recibe pedidos del catálogo Alive · Baby Finger · DO"],
  ];
  const etiquetaCatalogo = (c) => {
    const v = String(c || "").trim().toLowerCase();
    if (v === "skala") return "Catálogo Skala";
    if (v === "distribuidora") return "Catálogo Distribuidora";
    return "Ambos catálogos";
  };
  const etiquetaRutasVendedor = (rutas) => {
    if (Array.isArray(rutas) && rutas.length) return "📍 " + rutas.join(", ");
    return "📍 Sin rutas marcadas";
  };
  let cacheUsuarios = [];

  async function vUsuarios(v, _p, _q, vigente) {
    const r = await api("usuarios");
    if (!vigente()) return;
    cacheUsuarios = r.usuarios;
    const orden = { master: 0, admin: 1, vendedor: 2, despachador: 3 };
    const lista = r.usuarios.slice().sort((a, b) => (orden[a.rol] ?? 9) - (orden[b.rol] ?? 9) || a.nombre.localeCompare(b.nombre));
    v.innerHTML = `<a class="btn btn-primary btn-bloque" href="#/usuario/nuevo">Nuevo usuario</a>
      <ul class="usuarios-lista">${lista.map((u) => {
        const esVend = (u.roles || [u.rol]).includes("vendedor");
        return `<li class="${u.activo ? "" : "inactivo"}">
          <div><strong>${esc(u.nombre)}</strong> <span class="ped-det">@${esc(u.usuario)}</span></div>
          <div class="ped-det"><span class="rol rol-${esc(u.rol)}">${esc(u.rol_nombre)}</span>${esVend ? ` · <span class="chip-cat-vend">${esc(etiquetaCatalogo(u.catalogo))}</span> · <span class="ped-det">${esc(etiquetaRutasVendedor(u.rutas))}</span>` : ""}${u.activo ? "" : " · Inactivo"}</div>
          <a class="btn btn-ghost" href="#/usuario/${encodeURIComponent(u.id)}">Editar</a>
        </li>`;
      }).join("")}</ul>`;
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
    const catActual = u && ["skala", "distribuidora", "ambos"].includes(String(u.catalogo || "").toLowerCase())
      ? String(u.catalogo).toLowerCase()
      : "ambos";
    const rutasActuales = u && Array.isArray(u.rutas) ? u.rutas : [];
    v.innerHTML = `<form class="tarjeta" id="fUsuario" novalidate>
      <label class="field field-full"><span>Usuario (para ingresar)</span><input id="uUsuario" type="text" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="off" placeholder="ej. kevin" value="${esc(u ? u.usuario : "")}" /></label>
      <label class="field field-full"><span>Nombre</span><input id="uNombre" type="text" autocapitalize="words" autocomplete="off" placeholder="ej. Kevin Pérez" value="${esc(u ? u.nombre : "")}" /></label>
      <fieldset class="pay roles-usuario" id="uRoles"><legend>Roles (puede tener varios)</legend>
        ${[["vendedor", "Vendedor", "toma pedidos, clientes y cobros"], ["despachador", "Despachador", "por ahora desactivado: despacha Administración"], ["admin", "Administración", "aprueba (factura), despacha, entrega e inventario"], ["master", "Master", "todo, incluido usuarios"]]
          .filter(([k]) => k !== "despachador" || (u && (u.roles || [u.rol]).includes("despachador"))).map(([k, t, d]) =>
          `<label class="check rol-opt"><input type="checkbox" name="uRol" value="${k}"${(u ? u.roles || [u.rol] : ["vendedor"]).includes(k) ? " checked" : ""} /> <span><strong>${t}</strong> <span class="ped-det">${d}</span></span></label>`).join("")}
      </fieldset>
      <fieldset class="pay" id="uCatalogoWrap"><legend>Catálogo que maneja (para vendedores)</legend>
        ${CATALOGOS_VENDEDOR.map(([k, t, d]) =>
          `<label class="pay-opt"><input type="radio" name="uCatalogo" value="${k}"${catActual === k ? " checked" : ""} /> <span><strong>${t}</strong> <span class="ped-det">· ${d}</span></span></label>`
        ).join("")}
      </fieldset>
      <fieldset class="pay roles-usuario" id="uRutasWrap"><legend>Rutas / Zonas que atiende (obligatorio para vendedores)</legend>
        ${RUTAS_CARTERA.map((r) =>
          `<label class="check rol-opt"><input type="checkbox" name="uRuta" value="${esc(r)}"${rutasActuales.includes(r) ? " checked" : ""} /> <span><strong>📍 ${esc(r)}</strong></span></label>`
        ).join("")}
        <p class="nota-chica">Marcá las rutas que atiende este vendedor. Los clientes nuevos verán estas rutas al seleccionar su vendedor.</p>
      </fieldset>
      <label class="field field-full"><span>${nuevo ? "Clave" : "Clave nueva (dejar vacía para no cambiarla)"}</span>
        <span class="clave-wrap"><input id="uClave" type="password" maxlength="64" autocomplete="new-password" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Letras y números" />
        <button type="button" class="ver-clave" data-ver="uClave" aria-label="Mostrar clave">Ver</button></span></label>
      <p class="nota-chica">Mínimo 6 caracteres con letras y números (Master: 8). Puede llevar símbolos como * # @ !</p>
      <label class="field field-full"><span>WhatsApp (para vendedores)</span><input id="uTelefono" type="tel" inputmode="tel" autocomplete="off" placeholder="0424-1234567" value="${esc(u ? u.telefono || "" : "")}" />
        <span class="nota-chica">Los clientes de su ruta le mandan el pedido a este número desde el catálogo asignado.</span></label>
      <label class="check"><input type="checkbox" id="uActivo"${!u || u.activo ? " checked" : ""} /> Activo (puede ingresar)</label>
      <p class="form-warn" id="uError" hidden></p>
      <div class="fila-botones"><a class="btn btn-ghost" href="#/usuarios">Cancelar</a><button type="submit" class="btn btn-primary" id="btnGuardarUsuario">Guardar</button></div>
    </form>`;
    $("fUsuario").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("btnGuardarUsuario");
      const elegidos = [...document.querySelectorAll('input[name="uRol"]:checked')].map((x) => x.value);
      if (!elegidos.length) { $("uError").textContent = "Elegí al menos un rol."; $("uError").hidden = false; return; }
      const catElegido = (document.querySelector('input[name="uCatalogo"]:checked') || {}).value || "ambos";
      const rutasElegidas = [...document.querySelectorAll('input[name="uRuta"]:checked')].map((x) => x.value);
      if (elegidos.includes("vendedor") && !rutasElegidas.length) {
        $("uError").textContent = "Marcá al menos una ruta que atiende el vendedor.";
        $("uError").hidden = false;
        return;
      }
      btn.disabled = true;
      try {
        const r = await api("guardarUsuario", {
          id: u ? u.id : undefined, usuario: $("uUsuario").value.trim(), nombre: $("uNombre").value.trim(),
          roles: elegidos, activo: $("uActivo").checked, clave: $("uClave").value || undefined,
          telefono: $("uTelefono").value.trim(), catalogo: catElegido, rutas: rutasElegidas,
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
    if (vende()) items.push(["#/pedidos?tab=comisiones", "Comisiones", "Comisiones por pagar y pagadas sobre cobros conciliados"]);
    if (vende()) items.push(["#/resumen", "Resumen", "Pedidos, cajas y productos más pedidos"]);
    if (gestion()) items.push(["#/inventario", "Inventario", "Ajustar existencias, entradas de mercancía y conteo total"]);
    if (gestion()) items.push(["#/precios", "Precios", "Ajustar precios de Skala Venezuela o Dist. Ontiveros"]);
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
        ${eventoInstalar ? '<button type="button" class="btn btn-primary btn-bloque" id="btnInstalar">Instalar app Ontiveros Equipo</button>'
          : `<p class="modal-sub">${ios ? "En Safari: botón Compartir → <strong>Agregar a inicio</strong>." : "En Chrome: menú ⋮ → <strong>Instalar app</strong> o <strong>Agregar a pantalla principal</strong>."}</p>`}</section>`}
      <section class="tarjeta" id="secDatos"><h3 class="sub-titulo">Datos en el teléfono</h3>
        <p class="modal-sub" id="datosEstado">${local && local.fecha ? `Actualizados ${esc(horaCorta(local.fecha))} · ${(local.pedidos || []).length} pedidos · ${(local.clientes || []).length} clientes` : "Todavía no hay datos guardados en este teléfono."}</p>
        <button type="button" class="btn btn-primary btn-bloque" id="btnSync">Actualizar ahora</button>
        <p class="nota-chica">Se actualizan solos a las 8 am, 1 pm y 4 pm${prox ? ` (próxima: ${esc(horaCorta(prox.toISOString()))})` : ""}. Sin señal, la app muestra lo guardado.</p>
        ${APP ? `<p class="nota-chica" id="verApp">App ${esc(verApp)}${verPant ? ` · pantallas ${esc(verPant)}` : ""}</p>` : ""}
      </section>
      ${tiene("master") ? (() => {
        const supa = SkalaAPI.configSupabase ? SkalaAPI.configSupabase() : { url: "", key: "", activo: false };
        return `<section class="tarjeta" id="secSupabase">
          <div class="fila-top">
            <h3 class="sub-titulo">Base de datos · Supabase</h3>
            <span class="chip ${supa.activo ? "chip-ok" : "chip-pend"}">${supa.activo ? "Usando Supabase" : "Usando Google Sheets"}</span>
          </div>
          <p class="modal-sub">Copiá todos los datos de Google Sheets a Supabase sin modificar ni borrar nada de la hoja original.</p>
          <button type="button" class="btn btn-ghost btn-bloque" id="btnConfigSupabase">⚙️ Configurar / Migrar a Supabase</button>
        </section>`;
      })() : ""}
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
    $("btnSalir").addEventListener("click", () => { SkalaAPI.cerrarSesion(); borrarLS(K_INV); memoria.pedidos = null; memoria.web = null; memoria.t = 0; memoria.uid = ""; toast("Sesión cerrada"); ir("#/ingresar"); });
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
    const btnSupa = $("btnConfigSupabase");
    if (btnSupa) btnSupa.addEventListener("click", async () => {
      const actual = SkalaAPI.configSupabase ? SkalaAPI.configSupabase() : { url: "", key: "", activo: false };
      const d = await hoja({
        titulo: "Base de datos · Supabase",
        cuerpo: `<p class="modal-sub">1. Ejecutá primero <code>supabase/schema.sql</code> en el SQL Editor de tu proyecto Supabase.<br/>2. Pegá acá tu <strong>Project URL</strong> y tu clave <strong>pública</strong> (publishable <code>sb_publishable_…</code> o anon <code>eyJ…</code>). Nunca la clave secreta.</p>
          <label class="field field-full"><span>Project URL *</span>
            <input name="url" type="url" autocomplete="off" placeholder="https://xxxx.supabase.co" value="${esc(actual.url)}" />
          </label>
          <label class="field field-full"><span>Clave pública (publishable / anon) *</span>
            <input name="key" type="text" autocomplete="off" placeholder="sb_publishable_…" value="${esc(actual.key)}" />
          </label>
          <button type="button" class="btn btn-ghost btn-bloque" id="btnMigrarDatos" style="margin:8px 0">📥 1. Copiar datos de Google Sheets a Supabase</button>
          <div class="aviso-cobro" id="supaResultado" hidden></div>
          <label class="check" style="margin-top:8px">
            <input type="checkbox" name="activo" value="1" ${actual.activo ? "checked" : ""} />
            <span>Usar Supabase como base de datos activa en este dispositivo</span>
          </label>`,
        ok: "Guardar configuración",
        alAbrir: (form) => {
          const btnM = form.querySelector("#btnMigrarDatos");
          const boxR = form.querySelector("#supaResultado");
          btnM.addEventListener("click", async () => {
            const uVal = form.elements.url.value.trim();
            const kVal = form.elements.key.value.trim();
            if (!uVal || !kVal) {
              boxR.hidden = false;
              boxR.className = "aviso-cobro es-abono";
              boxR.textContent = "Pegá primero la URL y la clave pública de Supabase.";
              return;
            }
            btnM.disabled = true;
            btnM.textContent = "Copiando todas las hojas a Supabase…";
            boxR.hidden = true;
            try {
              const res = await SkalaAPI.migrarDesdeSheetsASupabase(uVal, kVal);
              const imp = (res && res.importados) || {};
              boxR.hidden = false;
              boxR.className = "aviso-cobro es-completo";
              boxR.innerHTML = `<strong>✓ Datos copiados con éxito (Google Sheets intacto)</strong>
                <span>Usuarios: ${imp.usuarios || 0} · Clientes: ${imp.clientes || 0} · Pedidos: ${imp.pedidos || 0} · Ítems: ${imp.pedido_items || 0} · Pagos: ${imp.pagos || 0} · Precios: ${imp.precios || 0} · Inventario: ${imp.inventario || 0}</span>`;
            } catch (err) {
              boxR.hidden = false;
              boxR.className = "aviso-cobro es-abono";
              boxR.textContent = err.message;
            } finally {
              btnM.disabled = false;
              btnM.textContent = "📥 1. Copiar datos de Google Sheets a Supabase";
            }
          });
        },
      });
      if (!d) return;
      try {
        SkalaAPI.configurarSupabase({ url: d.url, key: d.key, activo: !!d.activo });
      } catch (err) {
        toast(err.message); // p. ej. se pegó la clave secreta
        return;
      }
      memoria.pedidos = null; memoria.t = 0;
      toast(d.activo ? "Conectado a Supabase" : "Usando Google Sheets");
      render();
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
      const env = e.target.closest("[data-enviar]");
      if (env) { e.preventDefault(); irAEnviar(); return; }
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
