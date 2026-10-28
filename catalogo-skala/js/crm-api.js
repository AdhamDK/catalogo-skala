/* ============================================================
   Skala — conexión con el CRM (Google Sheets vía Apps Script)
   Sesión, llamadas a la API y cola de pedidos sin señal.
   La usan el catálogo (js/crm.js) y el panel del equipo (js/panel.js).
   ============================================================ */

/* ⚠️ URL de la App web de Apps Script (termina en /exec). */
const CRM_API_URL = "https://script.google.com/macros/s/AKfycbzEr3zjJi1dZwHjr2TP7_XAkAIltSlcm5QIg58UCNIrSgaqPWLCRXfl8qNZMni35rhIJA/exec";

/* Página pública de productos (Netlify). La app Android la abre en el navegador;
   vacío = el logo del panel no lleva a ningún lado dentro de la app. Ej.: "https://skala-venezuela.netlify.app/" */
const CATALOGO_URL = "";

const SkalaAPI = (function () {
  const API = (typeof window !== "undefined" && window.SKALA_CRM_URL) || CRM_API_URL;
  const K_SESION = "skala_sesion_v2";
  const K_COLA = "skala_cola_v1";

  const leerLS = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch (e) { return def; } };
  const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const borrarLS = (k) => { try { localStorage.removeItem(k); } catch (e) {} };

  function sesion() {
    const s = leerLS(K_SESION, null);
    if (!s || !s.token || !s.usuario || expiracionToken(s.token) < Date.now()) return null;
    return s;
  }
  /* App Android: el puente nativo (window.SkalaApp) guarda el token para actualizar los datos en segundo plano */
  const app = () => (typeof window !== "undefined" && window.SkalaApp) || null;
  function guardarSesion(token, usuario) {
    const previo = leerLS(K_LOCAL, null);
    if (previo && previo.usuario && previo.usuario.id !== usuario.id) borrarLS(K_LOCAL); // otro usuario: datos fuera
    guardarLS(K_SESION, { token, usuario });
    try { if (app()) app().guardarToken(token); } catch (e) {}
  }
  function cerrarSesion() {
    borrarLS(K_SESION);
    borrarLS(K_LOCAL);
    try { if (app()) { app().guardarToken(""); app().guardarDatos(""); } } catch (e) {}
  }

  class ErrorRed extends Error {}

  /* ---------- Datos en el teléfono: copia que se actualiza 8 am, 1 pm y 4 pm ---------- */
  const K_LOCAL = "skala_local_v1";
  const LECTURAS = ["catalogo", "clientes", "pedidos", "pedido", "pedidosWeb", "despachadores"];
  function datosLocales() {
    let d = leerLS(K_LOCAL, null);
    // La app pudo actualizarlos sola (con la app cerrada): usar la copia más nueva
    try {
      const nativo = app() && app().leerDatos ? JSON.parse(app().leerDatos() || "null") : null;
      if (nativo && nativo.fecha && (!d || nativo.fecha > d.fecha)) { d = nativo; guardarLS(K_LOCAL, d); }
    } catch (e) {}
    const s = sesion();
    if (d && s && d.usuario && d.usuario.id !== s.usuario.id) return null;
    return d;
  }
  let sincronizando = null;
  function sincronizar() {
    if (sincronizando) return sincronizando;
    sincronizando = (async () => {
      const r = await api("sincronizar", {}, { sinCopia: true });
      const { ok, ...datos } = r;
      guardarLS(K_LOCAL, datos);
      guardarLS(K_CATALOGO, { t: Date.now(), s: true, d: datos.catalogo });
      try { if (app()) app().guardarDatos(JSON.stringify(datos)); } catch (e) {}
      return datos;
    })().finally(() => { sincronizando = null; });
    return sincronizando;
  }

  async function api(action, datos = {}, opciones = {}) {
    try {
      return await apiRed(action, datos);
    } catch (e) {
      // Sin señal: las consultas se responden con los datos guardados en el teléfono
      if (e instanceof ErrorRed && !opciones.sinCopia && LECTURAS.includes(action) && typeof respuestaLocal === "function") {
        const r = respuestaLocal(action, datos, datosLocales());
        if (r) return r;
      }
      throw e;
    }
  }

  async function apiRed(action, datos = {}) {
    if (!API) throw new Error("El CRM no está configurado (falta CRM_API_URL en js/crm-api.js).");
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
      if (j.code === "auth") cerrarSesion();
      const err = new Error(j.error || "Error del servidor");
      err.code = j.code;
      throw err;
    }
    return j;
  }

  /* ---------- Cola de pedidos sin señal ---------- */
  const cola = () => leerLS(K_COLA, []);
  function encolar(datos) {
    const c = cola();
    c.push({ ...datos, guardado: new Date().toISOString() });
    guardarLS(K_COLA, c);
  }
  let subiendo = false;
  async function subirCola() {
    if (!cola().length || subiendo || !sesion()) return [];
    subiendo = true;
    const subidos = [];
    try {
      for (const p of cola()) {
        try {
          const { guardado, vendedor, ...datos } = p;
          subidos.push(await api("guardarPedido", datos));
          guardarLS(K_COLA, cola().filter((x) => x.client_ref !== p.client_ref));
        } catch (e) {
          if (e instanceof ErrorRed || e.code === "auth") break;
        }
      }
    } finally {
      subiendo = false;
    }
    return subidos;
  }

  /* ---------- Precios y existencias (acción "catalogo"), guardados en el teléfono ---------- */
  const K_CATALOGO = "skala_catalogo_v1";
  const catalogoGuardado = () => (leerLS(K_CATALOGO, null) || {}).d || null;
  async function catalogo(forzar) {
    const c = leerLS(K_CATALOGO, null);
    const conSesion = !!sesion();
    // con sesión se pide de nuevo si lo guardado era público (sin existencias)
    if (!forzar && c && Date.now() - c.t < 10 * 60000 && (!conSesion || c.s)) return c.d;
    try {
      const d = await api("catalogo");
      guardarLS(K_CATALOGO, { t: Date.now(), s: conSesion, d });
      return d;
    } catch (e) {
      if (c) return c.d;
      throw e;
    }
  }
  /* { code: {menor, mayor, ..., disponible} } */
  const preciosMapa = (d) => Object.fromEntries(((d && d.productos) || []).map((p) => [p.code, p]));

  /* Envío que no espera respuesta y sobrevive a que se abra WhatsApp (pedido web del cliente) */
  function enviarSinEsperar(action, datos = {}) {
    if (!API) return false;
    const body = JSON.stringify({ action, ...datos });
    try {
      fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body, keepalive: true, redirect: "follow" }).catch(() => {});
      return true;
    } catch (e) {
      try { return navigator.sendBeacon(API, new Blob([body], { type: "text/plain;charset=utf-8" })); } catch (e2) { return false; }
    }
  }

  return { app, datosLocales, sincronizar, enviarSinEsperar, catalogo, catalogoGuardado, preciosMapa, api, sesion, guardarSesion, cerrarSesion, ErrorRed, cola, encolar, subirCola, leerLS, guardarLS, borrarLS };
})();
