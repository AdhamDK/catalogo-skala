/* ============================================================
   Skala — conexión con el CRM (Google Sheets vía Apps Script)
   Sesión, llamadas a la API y cola de pedidos sin señal.
   La usan el catálogo (js/crm.js) y el panel del equipo (js/panel.js).
   ============================================================ */

/* ⚠️ URL de la App web de Apps Script (termina en /exec). */
const CRM_API_URL = "https://script.google.com/macros/s/AKfycbzEr3zjJi1dZwHjr2TP7_XAkAIltSlcm5QIg58UCNIrSgaqPWLCRXfl8qNZMni35rhIJA/exec";

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
  function guardarSesion(token, usuario) { guardarLS(K_SESION, { token, usuario }); }
  function cerrarSesion() { borrarLS(K_SESION); }

  class ErrorRed extends Error {}

  async function api(action, datos = {}) {
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

  return { api, sesion, guardarSesion, cerrarSesion, ErrorRed, cola, encolar, subirCola, leerLS, guardarLS, borrarLS };
})();
