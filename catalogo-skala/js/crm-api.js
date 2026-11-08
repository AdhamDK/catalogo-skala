/* ============================================================
   Skala — conexión con el CRM (Google Sheets o Supabase PostgreSQL)
   Sesión, llamadas a la API y cola de pedidos sin señal.
   La usan el catálogo (js/crm.js) y el panel del equipo (js/panel.js).
   ============================================================ */

/* ⚠️ URL de la App web de Apps Script (termina en /exec). Respaldo / origen actual. */
const CRM_API_URL = "https://script.google.com/macros/s/AKfycbzEr3zjJi1dZwHjr2TP7_XAkAIltSlcm5QIg58UCNIrSgaqPWLCRXfl8qNZMni35rhIJA/exec";

/* 🚀 Configuración de Supabase (dejar vacío "" para seguir usando Google Sheets,
   o pegar Project URL y la clave PÚBLICA una vez creada la base con supabase/schema.sql).
   Clave pública = "publishable" (sb_publishable_...) o la "anon public" legacy (eyJ...).
   ⛔ NUNCA pegues acá la clave secreta (sb_secret_... / service_role): este archivo se publica en Netlify. */
const SUPABASE_URL = "https://sntrykeefsacrzeygule.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MwSEYT3JH1ZAiMKyrIZovA_h8M-9C9-";

/* Página pública de productos (Netlify). La app Android la abre en el navegador;
   vacío = el logo del panel no lleva a ningún lado dentro de la app. Ej.: "https://skala-venezuela.netlify.app/" */
const CATALOGO_URL = "";

/* App GPS-Clientes (ruteo de visitas). Se abre con el Deep Link gpsclientes://mision?mision_id=...
   Si el teléfono no tiene la APK, se usa esta URL web (vacío = solo Deep Link). Ej.: "https://gps-clientes.netlify.app/" */
const GPS_CLIENTES_URL = "";

const SkalaAPI = (function () {
  const API = (typeof window !== "undefined" && window.SKALA_CRM_URL) || CRM_API_URL;
  const K_SESION = "skala_sesion_v2";
  const K_COLA = "skala_cola_v1";
  const K_SUPA_CFG = "skala_supabase_cfg_v1"; // { url, key, activo }

  const leerLS = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch (e) { return def; } };
  const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const borrarLS = (k) => { try { localStorage.removeItem(k); } catch (e) {} };

  /* La clave secreta salta todas las protecciones: jamás debe usarse en el navegador ni en la app */
  const esClaveSecreta = (k) => /^sb_secret_|service_role/i.test(String(k || "").trim());

  function configSupabase() {
    if (typeof window !== "undefined" && window.SKALA_CRM_URL && !window.SKALA_USE_SUPABASE) {
      return { url: "", key: "", activo: false, fijo: false };
    }
    const ls = leerLS(K_SUPA_CFG, null);
    if (SUPABASE_URL && SUPABASE_ANON_KEY && !esClaveSecreta(SUPABASE_ANON_KEY)) {
      return { url: SUPABASE_URL.replace(/\/+$/, ""), key: SUPABASE_ANON_KEY.trim(), activo: ls ? ls.activo !== false : true, fijo: true };
    }
    if (ls && ls.url && ls.key && !esClaveSecreta(ls.key)) {
      return { url: String(ls.url).replace(/\/+$/, ""), key: String(ls.key).trim(), activo: !!ls.activo, fijo: false };
    }
    return { url: "", key: "", activo: false, fijo: false };
  }
  const usaSupabase = () => { const s = configSupabase(); return !!(s.activo && s.url && s.key); };

  function configurarSupabase({ url = "", key = "", activo = false } = {}) {
    if (esClaveSecreta(key)) throw new Error("Esa es la clave SECRETA de Supabase. Usá la clave pública (publishable / anon).");
    guardarLS(K_SUPA_CFG, { url: String(url || "").trim().replace(/\/+$/, ""), key: String(key || "").trim(), activo: !!activo });
    return configSupabase();
  }

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
    // La app pudo actualizarlos sola (con la app cerrada): usar la copia más nueva.
    // Con Supabase activo, Sincronizador.java (8/13/16 h) sigue bajando de Google Sheets: esa copia
    // quedaría vieja y pisaría la buena, así que solo se acepta si la guardó la propia app desde Supabase.
    try {
      const nativo = app() && app().leerDatos ? JSON.parse(app().leerDatos() || "null") : null;
      const sirve = nativo && nativo.fecha && (!usaSupabase() || nativo._fuente === "supabase");
      if (sirve && (!d || nativo.fecha > d.fecha)) { d = nativo; guardarLS(K_LOCAL, d); }
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
      if (usaSupabase()) datos._fuente = "supabase"; // marca para datosLocales()
      guardarLS(K_LOCAL, datos);
      guardarLS(K_CATALOGO, { t: Date.now(), s: true, d: datos.catalogo });
      try { if (app()) app().guardarDatos(JSON.stringify(datos)); } catch (e) {}
      return datos;
    })().finally(() => { sincronizando = null; });
    return sincronizando;
  }

  async function api(action, datos = {}, opciones = {}) {
    try {
      const supa = configSupabase();
      if (supa.activo && supa.url && supa.key && action !== "exportarBackup") {
        return await apiSupabase(supa, action, datos);
      }
      return await apiSheets(action, datos);
    } catch (e) {
      // Sin señal: las consultas se responden con los datos guardados en el teléfono
      if (e instanceof ErrorRed && !opciones.sinCopia && LECTURAS.includes(action) && typeof respuestaLocal === "function") {
        const r = respuestaLocal(action, datos, datosLocales());
        if (r) return r;
      }
      throw e;
    }
  }

  async function apiSheets(action, datos = {}) {
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

  /* ==========================================================================
     MOTOR SUPABASE (mismas reglas y respuestas que crm/Code.gs en milisegundos)
     ========================================================================== */
  async function rpcSupabase(supa, payload) {
    if (esClaveSecreta(supa.key)) throw new Error("Configuración insegura: se está usando la clave secreta de Supabase en el navegador.");
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    // Las claves nuevas (sb_publishable_...) NO son JWT: van solo en "apikey".
    // La anon legacy (eyJ...) también se manda como Bearer por compatibilidad.
    const headers = { "Content-Type": "application/json", apikey: supa.key };
    if (/^eyJ/.test(supa.key)) headers.Authorization = `Bearer ${supa.key}`;
    let r;
    try {
      r = await fetch(`${supa.url}/rest/v1/rpc/skala_db`, {
        method: "POST",
        headers,
        body: JSON.stringify({ payload }),
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new ErrorRed("Sin conexión con Supabase.");
    } finally {
      clearTimeout(t);
    }
    if (!r.ok) {
      let msg = `Supabase no respondió (${r.status}).`;
      try { const ej = await r.json(); if (ej && (ej.message || ej.error)) msg = ej.message || ej.error; } catch (_) {}
      throw new ErrorRed(msg);
    }
    const j = await r.json();
    if (!j || !j.ok) {
      if (j && j.code === "auth") cerrarSesion();
      const err = new Error((j && j.error) || "Error en Supabase");
      err.code = j && j.code;
      throw err;
    }
    return j;
  }

  /* Constantes y helpers idénticos a crm/Code.gs */
  const ROLES_S = ["master", "admin", "vendedor", "despachador"];
  const NOMBRE_ROL_S = { master: "Master", admin: "Administración", vendedor: "Vendedor", despachador: "Despachador" };
  const ESTADOS_S = ["pendiente", "confirmado", "en_ruta", "entregado", "cancelado"];
  const ESTADOS_CON_STOCK_S = ["confirmado", "en_ruta", "entregado"];
  const GESTION_S = ["master", "admin"];
  const TOMAN_S = ["master", "admin", "vendedor"];
  const DOCUMENTOS_S = ["Nota de entrega", "Factura"];
  const MONEDAS_S = ["USD", "Bs"];
  const CAJAS_MAYOR_S = 15;
  const MAX_DIAS_CREDITO_S = 180;
  const PAGOS_S = [
    { id: "credito", nombre: "Crédito", credito: true, desc: "" },
    { id: "pronto", nombre: "Pronto pago", credito: false, desc: "desc_pronto" },
    { id: "efectivo_credito", nombre: "Efectivo a crédito", credito: true, desc: "desc_efectivo_credito" },
    { id: "efectivo_pronto", nombre: "Efectivo pronto pago", credito: false, desc: "desc_efectivo_pronto" },
  ];
  const PRODUCTOS_BASE_S = [
    // Skala Brasil — Baños de Crema 1 kg (6 und/caja) y Kits Dúo (6 dúos/caja)
    ["BC-01", "Babosa", 25.5, 24.0, 6, "Cuidado Personal", "Skala"],
    ["BC-02", "Banana e Macuri", 25.5, 24.0, 6, "Cuidado Personal", "Skala"],
    ["BC-03", "Divino Potao", 25.5, 24.0, 6, "Cuidado Personal", "Skala"],
    ["BC-04", "Divino Potinho Kids", 25.5, 24.0, 6, "Cuidado Personal", "Skala"],
    ["BC-05", "Dona Skala", 25.5, 24.0, 6, "Cuidado Personal", "Skala"],
    ["BC-06", "Mais Cachos", 25.5, 24.0, 6, "Cuidado Personal", "Skala"],
    ["BC-07", "Mais Crespinhos", 25.5, 24.0, 6, "Cuidado Personal", "Skala"],
    ["BC-08", "Mais Crespos", 25.5, 24.0, 6, "Cuidado Personal", "Skala"],
    ["BC-09", "Mais Lisos", 25.5, 24.0, 6, "Cuidado Personal", "Skala"],
    ["BC-10", "Potao de Amor", 25.5, 24.0, 6, "Cuidado Personal", "Skala"],
    ["BC-11", "Potao Despaiado", 25.5, 24.0, 6, "Cuidado Personal", "Skala"],
    ["BC-12", "Mais Cachinhos", 25.5, 24.0, 6, "Cuidado Personal", "Skala"],
    ["BC-13", "Ceramidas G3", 25.5, 24.0, 6, "Cuidado Personal", "Skala"],
    ["BC-14", "Amido de Milho", 25.5, 24.0, 6, "Cuidado Personal", "Skala"],
    ["BC-15", "Keratina Vegetal", 25.5, 24.0, 6, "Cuidado Personal", "Skala"],
    ["BC-16", "Bomba de Vitaminas", 25.5, 24.0, 6, "Cuidado Personal", "Skala"],
    ["KT-01", "Kit 12 em 1", 29.0, 27.5, 6, "Cuidado Personal", "Skala"],
    ["KT-02", "Kit Aguacate", 29.0, 27.5, 6, "Cuidado Personal", "Skala"],
    ["KT-03", "Kit Babosa", 29.0, 27.5, 6, "Cuidado Personal", "Skala"],
    ["KT-04", "Kit Bomba de Vitaminas S.O.S", 29.0, 27.5, 6, "Cuidado Personal", "Skala"],
    ["KT-05", "Kit Ceramidas", 29.0, 27.5, 6, "Cuidado Personal", "Skala"],
    ["KT-06", "Kit Crespo Divino", 29.0, 27.5, 6, "Cuidado Personal", "Skala"],
    ["KT-07", "Kit Mais Crespinhos", 29.0, 27.5, 6, "Cuidado Personal", "Skala"],
    ["KT-08", "Kit Mais Cachos", 29.0, 27.5, 6, "Cuidado Personal", "Skala"],
    // Distribuidora Ontiveros — Detergentes Alive, AZ, Panela y Lavaplatos
    ["ALV-DET1K-01", "Blanco Perla Blanqueador 1 kg", 16.8, 15.6, 12, "Detergentes", "Alive"],
    ["ALV-DET1K-02", "Morado Floral 1 kg", 16.8, 15.6, 12, "Detergentes", "Alive"],
    ["ALV-DET1K-03", "Rosado con Suavizante 1 kg", 16.8, 15.6, 12, "Detergentes", "Alive"],
    ["ALV-DET1K-04", "Verde Limón 1 kg", 16.8, 15.6, 12, "Detergentes", "Alive"],
    ["ALV-DET1K-05", "Azul Todo Tipo de Ropa 1 kg", 16.8, 15.6, 12, "Detergentes", "Alive"],
    ["ALV-DET1K-06", "Rosa Fragancia Bebé 1 kg", 16.8, 15.6, 12, "Detergentes", "Alive"],
    ["ALV-DET1K-07", "Azul Fragancia Bebé 1 kg", 16.8, 15.6, 12, "Detergentes", "Alive"],
    ["AZ-DET-01", "A-Z Azul Naranja Todo Tipo de Ropa 1 kg", 15.6, 14.4, 12, "Detergentes", "AZ"],
    ["AZ-DET-02", "A-Z Rosado Ultra Floral 1 kg", 15.6, 14.4, 12, "Detergentes", "AZ"],
    ["ALV-DET500-01", "Blanco Perla Blanqueador 500 g", 17.5, 16.2, 24, "Detergentes", "Alive"],
    ["ALV-DET500-02", "Morado Floral 500 g", 17.5, 16.2, 24, "Detergentes", "Alive"],
    ["ALV-DET500-03", "Rosado con Suavizante 500 g", 17.5, 16.2, 24, "Detergentes", "Alive"],
    ["ALV-DET500-04", "Verde Limón 500 g", 17.5, 16.2, 24, "Detergentes", "Alive"],
    ["ALV-DET500-05", "Azul Todo Tipo de Ropa 500 g", 17.5, 16.2, 24, "Detergentes", "Alive"],
    ["ALV-DET500-06", "Rosa Fragancia Bebé 400 g", 17.5, 16.2, 24, "Detergentes", "Alive"],
    ["ALV-DET500-07", "Rosado con Suavizante 200 g", 17.5, 16.2, 24, "Detergentes", "Alive"],
    ["ALV-PAN-01", "Panela Alive Lavanda 150 g", 14.4, 13.5, 36, "Detergentes", "Alive"],
    ["ALV-PAN-02", "Panela Alive Limón 150 g", 14.4, 13.5, 36, "Detergentes", "Alive"],
    ["ALV-PAN-03", "Panela Alive con Suavizante 150 g", 14.4, 13.5, 36, "Detergentes", "Alive"],
    ["JAB-POP-01", "Jabón Popular en Barra", 14.0, 13.0, 36, "Detergentes", "Jabón Popular"],
    ["ALV-LAV-01", "Aliclean Azul Limón Amarillo 350 ml", 19.2, 18.0, 24, "Detergentes", "Alive"],
    ["ALV-LAV-02", "Aliclean Naranja Mandarina 350 ml", 19.2, 18.0, 24, "Detergentes", "Alive"],
    ["ALV-LAV-03", "Aliclean Verde Limón 350 ml", 19.2, 18.0, 24, "Detergentes", "Alive"],
    ["ALV-LAV-04", "Aliclean Azul Limón Amarillo 750 ml", 22.8, 21.0, 12, "Detergentes", "Alive"],
    ["ALV-LAV-05", "Aliclean Verde Limón 750 ml", 22.8, 21.0, 12, "Detergentes", "Alive"],
    // Suavizantes Alive
    ["ALV-SUA-01", "Suavizante Alive Celeste Fresca Primavera", 18.0, 16.8, 12, "Suavizantes", "Alive"],
    ["ALV-SUA-02", "Suavizante Alive Verde Manzana", 18.0, 16.8, 12, "Suavizantes", "Alive"],
    ["ALV-SUA-03", "Suavizante Alive Rosado Floral", 18.0, 16.8, 12, "Suavizantes", "Alive"],
    ["ALV-SUA-04", "Suavizante Alive Celeste Bebé", 18.0, 16.8, 12, "Suavizantes", "Alive"],
    ["ALV-SUA-05", "Suavizante Alive Morado Lavanda", 18.0, 16.8, 12, "Suavizantes", "Alive"],
    ["ALV-SUA-06", "Suavizante Alive Rojo Fresa y Chocolate", 18.0, 16.8, 12, "Suavizantes", "Alive"],
    // Cuidado Personal Alive, Anita, Harmony
    ["ALV-CAP-01", "Baño de Crema Alive Aceite de Oliva 400 g", 20.4, 18.9, 12, "Cuidado Personal", "Alive"],
    ["ALV-CAP-02", "Baño de Crema Alive Aceite de Argán 400 g", 20.4, 18.9, 12, "Cuidado Personal", "Alive"],
    ["ALV-CAP-03", "Baño de Crema Alive Antifrizz Keratina 400 g", 20.4, 18.9, 12, "Cuidado Personal", "Alive"],
    ["ALV-LOC-01", "Loción Alive Lila Beso Granada 400 ml", 22.8, 21.0, 12, "Cuidado Personal", "Alive"],
    ["ALV-LOC-02", "Loción Alive Rojo Flor de la Pasión 400 ml", 22.8, 21.0, 12, "Cuidado Personal", "Alive"],
    ["ALV-LOC-03", "Loción Alive Verde Coco Tropical 400 ml", 22.8, 21.0, 12, "Cuidado Personal", "Alive"],
    ["ALV-LOC-04", "Loción Alive Dorado Flor de Vainilla 400 ml", 22.8, 21.0, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA413-01", "Shampoo Alive Coco Tropical 413 ml", 21.6, 19.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA413-02", "Shampoo Alive Flor de Manzana 413 ml", 21.6, 19.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA413-03", "Shampoo Alive Beso de Granada 413 ml", 21.6, 19.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA413-04", "Shampoo Alive Flor de la Pasión 413 ml", 21.6, 19.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-ACO413-01", "Acondicionador Alive Coco Tropical 413 ml", 21.6, 19.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-ACO413-02", "Acondicionador Alive Flor de Manzana 413 ml", 21.6, 19.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-ACO413-03", "Acondicionador Alive Beso de Granada 413 ml", 21.6, 19.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-ACO413-04", "Acondicionador Alive Flor de la Pasión 413 ml", 21.6, 19.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA400-08", "Shampoo Anticaspa Agua de Coco 400 ml", 21.6, 19.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA400-09", "Shampoo Anticaspa Dandruff Azul 400 ml", 21.6, 19.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA350-01", "Shampoo 2en1 Azul Todo Tipo de Cabello 350 ml", 19.2, 17.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA350-02", "Shampoo 2en1 Morado Cabello Graso 350 ml", 19.2, 17.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA350-03", "Shampoo 2en1 Rojo Cabello Seco 350 ml", 19.2, 17.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA350-04", "Shampoo 2en1 Fucsia Cabello Normal 350 ml", 19.2, 17.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA350-05", "Shampoo Gold Verde Refrescante 350 ml", 19.2, 17.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA350-06", "Shampoo Gold Amarillo Brillo 350 ml", 19.2, 17.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA350-07", "Shampoo Gold Azul Anticaspa 350 ml", 19.2, 17.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA250-01", "Shampoo Alive Verde Flor de Manzana 250 ml", 19.2, 17.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA250-02", "Shampoo Alive Naranja Coco Tropical 250 ml", 19.2, 17.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA250-03", "Shampoo Alive Rosado Beso de Granada 250 ml", 19.2, 17.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-SHA250-04", "Shampoo Alive Morado Flor de la Pasión 250 ml", 19.2, 17.8, 12, "Cuidado Personal", "Alive"],
    ["ALV-DEN-01", "Alident Ultra Fresh Roja 100 g", 28.8, 26.4, 8, "Cuidado Personal", "Alive"],
    ["ALV-DEN-02", "Alident Gel Verde Aliento Fresco 100 g", 28.8, 26.4, 8, "Cuidado Personal", "Alive"],
    ["ALV-DEN-03", "Alident Fresh Mint Menta Suave 100 g", 28.8, 26.4, 8, "Cuidado Personal", "Alive"],
    ["ALV-DEN-04", "Alident Gel Azul Ice Cool Mint 100 g", 28.8, 26.4, 8, "Cuidado Personal", "Alive"],
    ["ALV-DEN-05", "Alident Extra Blancura Triple Acción Verde 100 g", 28.8, 26.4, 8, "Cuidado Personal", "Alive"],
    ["ALV-DEN-06", "Alident Triple Action Roja 100 g", 28.8, 26.4, 8, "Cuidado Personal", "Alive"],
    ["ALV-DEN-07", "Alident Pro-White Blanqueador 100 g", 28.8, 26.4, 8, "Cuidado Personal", "Alive"],
    ["ALV-DEN-08", "Alident Sensitive Uso Diario 100 g", 28.8, 26.4, 8, "Cuidado Personal", "Alive"],
    ["ALV-DEN-09", "Alident Kids Niño 100 g", 28.8, 26.4, 8, "Cuidado Personal", "Alive"],
    ["ALV-DEN-10", "Alident Kids Niña 100 g", 28.8, 26.4, 8, "Cuidado Personal", "Alive"],
    ["ALV-DEN75-01", "Alident Ultra Fresh Roja 75 g", 25.0, 23.5, 10, "Cuidado Personal", "Alive"],
    ["ALV-DEN75-02", "Alident Gel Verde Aliento Fresco 75 g", 25.0, 23.5, 10, "Cuidado Personal", "Alive"],
    ["ALV-DEN75-03", "Alident Fresh Mint Menta Suave 75 g", 25.0, 23.5, 10, "Cuidado Personal", "Alive"],
    ["ALV-DEN75-04", "Alident Gel Azul Ice Cool Mint 75 g", 25.0, 23.5, 10, "Cuidado Personal", "Alive"],
    ["ALV-DEN75-05", "Alident Extra Blancura Triple Acción Verde 75 g", 25.0, 23.5, 10, "Cuidado Personal", "Alive"],
    ["ALV-DEN75-06", "Alident Triple Action Roja 75 g", 25.0, 23.5, 10, "Cuidado Personal", "Alive"],
    ["ALV-DEN75-07", "Alident Pro-White Blanqueador 75 g", 25.0, 23.5, 10, "Cuidado Personal", "Alive"],
    ["ALV-DEN75-08", "Alident Sensitive Uso Diario 75 g", 25.0, 23.5, 10, "Cuidado Personal", "Alive"],
    ["ALV-DEN75-09", "Alident Kids Niño 75 g", 25.0, 23.5, 10, "Cuidado Personal", "Alive"],
    ["ALV-DEN75-10", "Alident Kids Niña 75 g", 25.0, 23.5, 10, "Cuidado Personal", "Alive"],
    ["ALV-JAB-01", "Anita Dorado Avena (Oats) 125 g", 24.0, 22.5, 72, "Cuidado Personal", "Alive"],
    ["ALV-JAB-02", "Anita Rosado Extracto de Perla 125 g", 24.0, 22.5, 72, "Cuidado Personal", "Alive"],
    ["ALV-JAB-03", "Anita Celeste Extracto de Aguacate 125 g", 24.0, 22.5, 72, "Cuidado Personal", "Alive"],
    ["ALV-JAB-03B", "Anita Turquesa Aguacate Hoja 125 g", 24.0, 22.5, 72, "Cuidado Personal", "Alive"],
    ["ALV-JAB-04", "Anita Morado Extracto de Almendra 125 g", 24.0, 22.5, 72, "Cuidado Personal", "Alive"],
    ["ALV-JAB-05", "Anita Verde Extracto de Pepino 125 g", 24.0, 22.5, 72, "Cuidado Personal", "Alive"],
    ["HAR-MIL-01", "Harmony Milky Rosa Inglesa (English Rose) 135 g", 23.4, 21.6, 48, "Cuidado Personal", "Harmony"],
    ["HAR-MIL-02", "Harmony Milky Lavanda (Lavender) 135 g", 23.4, 21.6, 48, "Cuidado Personal", "Harmony"],
    ["HAR-MIL-03", "Harmony Milky Girasol (Sunflower) 135 g", 23.4, 21.6, 48, "Cuidado Personal", "Harmony"],
    ["HAR-FRU-01", "Harmony Fruity Fresa (Strawberry)", 22.8, 21.0, 72, "Cuidado Personal", "Harmony"],
    ["HAR-FRU-02", "Harmony Fruity Naranja (Orange)", 22.8, 21.0, 72, "Cuidado Personal", "Harmony"],
    ["HAR-FRU-03", "Harmony Fruity Limón (Lemon)", 22.8, 21.0, 72, "Cuidado Personal", "Harmony"],
    ["HAR-FRU-04", "Harmony Fruity Uva (Grape)", 22.8, 21.0, 72, "Cuidado Personal", "Harmony"],
    ["HAR-FRU-05", "Harmony Fruity Manzana (Apple)", 22.8, 21.0, 72, "Cuidado Personal", "Harmony"],
    ["HAR-FRU-06", "Harmony Fruity Melón (Melon)", 22.8, 21.0, 72, "Cuidado Personal", "Harmony"],
    ["ALV-TOAFEM-01", "Toallas Alive Regular Día con Alas 245 mm", 21.6, 20.0, 72, "Cuidado Personal", "Alive"],
    ["ALV-TOAFEM-02", "Toallas Alive Nocturna Noche 290 mm", 23.5, 22.0, 72, "Cuidado Personal", "Alive"],
    ["ALV-TOAFEM-03", "Toallas Alive Extra Larga 340 mm", 25.5, 24.0, 72, "Cuidado Personal", "Alive"],
    ["ALV-TOAFEM-04", "Protectores Diarios Alive × 20 Unidades", 19.5, 18.0, 72, "Cuidado Personal", "Alive"],
    // Bebé y Pañales Baby Finger & Alive (1 bulto = 12 paquetes)
    ["BF-PAN-P20", "Baby Finger Talla P · 20 Unidades", 26.4, 24.8, 12, "Bebé y Pañales", "Baby Finger"],
    ["BF-PAN-P10", "Baby Finger Talla P · 10 Unidades", 15.6, 14.4, 12, "Bebé y Pañales", "Baby Finger"],
    ["BF-PAN-M18", "Baby Finger Talla M · 18 Unidades", 26.4, 24.8, 12, "Bebé y Pañales", "Baby Finger"],
    ["BF-PAN-G18", "Baby Finger Talla G · 18 Unidades", 27.6, 26.0, 12, "Bebé y Pañales", "Baby Finger"],
    ["BF-PAN-XG16", "Baby Finger Talla XG · 16 Unidades", 27.6, 26.0, 12, "Bebé y Pañales", "Baby Finger"],
    ["BF-PAN-XXG16", "Baby Finger Talla XXG · 16 Unidades", 28.8, 27.0, 12, "Bebé y Pañales", "Baby Finger"],
    ["BF-PAN-XXXG", "Baby Finger Talla XXXG · 14 Unidades", 30.0, 28.2, 12, "Bebé y Pañales", "Baby Finger"],
    ["ALV-PAN-ADM", "Pañal Adulto Alive Talla M · 6 Unidades", 31.2, 29.4, 12, "Bebé y Pañales", "Baby Finger"],
    ["ALV-PAN-ADXG", "Pañal Adulto Alive Talla XG · 6 Unidades", 33.6, 31.8, 12, "Bebé y Pañales", "Baby Finger"],
    ["BF-THU-01", "Toallas Húmedas Baby Finger Rosado × 50 und", 21.6, 19.8, 24, "Bebé y Pañales", "Baby Finger"],
    ["BF-THU-02", "Toallas Húmedas Baby Finger Celeste × 50 und", 21.6, 19.8, 24, "Bebé y Pañales", "Baby Finger"],
    ["BF-THU-03", "Toallas Húmedas Baby Finger Verde Aloe × 50 und", 21.6, 19.8, 24, "Bebé y Pañales", "Baby Finger"],
    ["BF-CUI-01", "Shampoo para Niños Baby Finger", 19.2, 17.8, 12, "Bebé y Pañales", "Baby Finger"],
    ["BF-CUI-02", "Colonia para Niños Baby Finger", 19.2, 17.8, 12, "Bebé y Pañales", "Baby Finger"],
    ["BF-CUI-03", "Aceite para Bebé Baby Finger", 19.2, 17.8, 12, "Bebé y Pañales", "Baby Finger"],
    ["BF-CUI-04", "Jabón Líquido para Bebé Baby Finger", 19.2, 17.8, 12, "Bebé y Pañales", "Baby Finger"],
    ["BF-CUI-05", "Petroleum Jelly para Bebé Baby Finger", 19.2, 17.8, 12, "Bebé y Pañales", "Baby Finger"],
    ["BF-CUI-06", "Loción Hidratante para Bebé Baby Finger", 19.2, 17.8, 12, "Bebé y Pañales", "Baby Finger"],
    ["BF-CUI-07", "Talco para Bebé Baby Finger 200 g", 19.2, 17.8, 12, "Bebé y Pañales", "Baby Finger"],
    ["BF-CUI-08", "Talco para Bebé Baby Finger 100 g", 19.2, 17.8, 12, "Bebé y Pañales", "Baby Finger"],
    // Hogar y Papel Alisoft, Dorco, Bernice
    ["ALV-PAP-01", "Alisoft Rosado 215 Hojas × 4 Rollos", 18.0, 16.8, 12, "Hogar y Papel", "Alisoft"],
    ["ALV-PAP-02", "Alisoft Dorado Comfort Plus 300 Hojas × 4 Rollos", 21.0, 19.5, 12, "Hogar y Papel", "Alisoft"],
    ["ALV-PAP-03", "Alisoft Azul Premium Max 400 Hojas × 4 Rollos", 24.0, 22.5, 12, "Hogar y Papel", "Alisoft"],
    ["ALV-PAP-04", "Alisoft Negro Premium Jumbo 600 Hojas × 4 Rollos", 28.5, 26.8, 12, "Hogar y Papel", "Alisoft"],
    ["ALV-TOAABS-01", "Toallín Alisoft Azul 80 Hojas", 18.6, 17.4, 12, "Hogar y Papel", "Alisoft"],
    ["ALV-TOAABS-02", "Toallín Alisoft Naranja Doble Hoja", 20.4, 19.2, 12, "Hogar y Papel", "Alisoft"],
    ["DOR-PACE3-01", "Afeitadora Dorco Pace 3 Blíster", 22.0, 20.4, 12, "Hogar y Papel", "Dorco / Bernice"],
    ["BER-ESP-60", "Espiral Antimosquitos Bernice × 60 Unidades", 22.0, 20.4, 24, "Hogar y Papel", "Dorco / Bernice"],
  ];
  const CONFIG_BASE_S = [
    ["version_apk", 1], ["url_apk", ""], ["minima_apk", 1], ["version_pantallas", ""], ["url_pantallas", ""], ["notas", ""],
  ];
  const CAMPOS_PRECIO_S = ["menor", "pronto", "efectivo_credito", "efectivo_pronto", "mayor", "mayor_pronto", "mayor_efectivo_credito", "mayor_efectivo_pronto"];

  const r2S = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const txtS = (v, max = 200) => String(v ?? "").trim().slice(0, max);
  const ahoraS = () => new Date().toISOString();
  const hoyCaracasS = () => {
    const d = new Date(Date.now() - 4 * 3600000);
    return d.toISOString().slice(0, 10);
  };
  const fechaHoraCaracasS = () => {
    const d = new Date(Date.now() - 4 * 3600000);
    return d.toISOString().slice(0, 16).replace("T", " ");
  };
  const diaCortoCaracasS = () => {
    const d = new Date(Date.now() - 4 * 3600000);
    return d.toISOString().slice(2, 10).replace(/-/g, "");
  };
  const uuidS = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); }));
  const numPrecioS = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return isFinite(n) && n > 0 ? r2S(n) : 0; };
  const montoValidoS = (v) => {
    let x = String(v ?? "").trim().replace(/\s|USD|Bs\.?|\$/gi, "");
    if (x.includes(",")) x = x.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(x)) x = x.replace(/\./g, "");
    const n = Number(x);
    return isFinite(n) && n > 0 && n < 1e12 ? Math.round(n * 100) / 100 : 0;
  };
  const numTasaS = (v) => {
    let x = String(v ?? "").trim().replace(/\s/g, "");
    if (x.includes(",")) x = x.replace(/\./g, "").replace(",", ".");
    const n = Number(x);
    return isFinite(n) && n > 0 ? Math.round(n * 10000) / 10000 : 0;
  };
  const fechaIsoS = (v) => { const m = String(v ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : ""; };
  const rolesDeS = (v) => {
    const lista = Array.isArray(v) ? v : String(v ?? "").split(/[,;/+]| y /);
    const set = {};
    lista.forEach((r) => {
      const k = String(r).trim().toLowerCase().replace(/administraci[oó]n/, "admin");
      if (ROLES_S.includes(k)) set[k] = 1;
    });
    return ROLES_S.filter((r) => set[r]);
  };
  const tieneS = (ses, rol) => !!ses && (ses.roles || rolesDeS(ses.rol)).includes(rol);
  const tieneAlgunoS = (ses, lista) => lista.some((r) => tieneS(ses, r));
  const esGestionS = (ses) => tieneAlgunoS(ses, GESTION_S);
  const nombreRolesS = (roles) => (roles || []).map((r) => NOMBRE_ROL_S[r] || r).join(" · ");
  const CATALOGOS_S = ["ambos", "skala", "distribuidora"];
  const catalogoUsuarioS = (c) => {
    const v = String(c || "").trim().toLowerCase();
    return CATALOGOS_S.includes(v) ? v : "ambos";
  };
  const RUTAS_CARTERA_S = ["Chivo", "Vigía", "Mérida", "Mocotíes", "Caja Seca", "Táchira"];
  const RUTAS_BASE_POR_ID_S = {
    "772da44b-3153-4bde-ab19-b48715b00cdf": "Chivo",
    "465b0ad1-9738-4dc3-b958-40681ba5db89": "Chivo",
    "2eb9404b-5622-4dc4-99f3-08684dc2c63c": "Chivo",
    "4f55f5fa-a0e6-47ef-89eb-311ec9ac62c6": "Chivo",
    "da43b6ca-fa36-4b37-9160-f4bcd0b39048": "Caja Seca",
    "75c4e1ae-4c39-43c1-8302-a2554556ce7a": "Caja Seca",
    "d0216c35-935b-4d56-be36-f0ace7e1c9a4": "Caja Seca",
    "6002e33d-09d4-40aa-bd29-02e32bdbe8e3": "Mocotíes",
    "96ef523e-d0c1-4961-8cfd-9829a7f2edb7": "Mocotíes",
    "528e785f-b85c-4859-98f0-85464485865a": "Mocotíes",
    "8cc62278-c92a-4bfa-8770-34d1b15d2903": "Táchira",
    "4ca6e254-eb17-4d01-9b3c-77857a87dabf": "Táchira",
  };
  const rutaCanonS = (raw) => {
    const k = String(raw || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!k) return "";
    if (k === "chivo") return "Chivo";
    if (k === "vigia" || k === "el vigia") return "Vigía";
    if (k === "merida") return "Mérida";
    if (k === "mocoties") return "Mocotíes";
    if (k === "caja seca" || k === "caja-seca") return "Caja Seca";
    if (k === "tachira") return "Táchira";
    return "";
  };
  const normalizarRutaS = (r, nombre = "", direccion = "", id = "") => {
    const dir = rutaCanonS(r);
    if (dir) return dir;
    const mTag = String(direccion || "").match(/\[Ruta:\s*([^\]]+)\]/i);
    if (mTag && mTag[1]) {
      const tagR = rutaCanonS(mTag[1]);
      if (tagR) return tagR;
    }
    if (id && RUTAS_BASE_POR_ID_S[String(id)]) return RUTAS_BASE_POR_ID_S[String(id)];
    const txt = `${nombre || ""} ${direccion || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (/tachira|san\s*cristobal|la\s*fria|coloncito|pinal|rubio|tariba/.test(txt)) return "Táchira";
    if (/caja\s*seca|panamericana|nueva\s*bolivia|arenales|zancudo|bobures|arapuey/.test(txt)) return "Caja Seca";
    if (/mocoties|santa\s*cruz\s*de\s*mora|tovar|bailadores|zea/.test(txt)) return "Mocotíes";
    if (/chivo|pueblo\s*nuevo|rurale|cuatro\s*esquinas/.test(txt)) return "Chivo";
    if (/vigia|cano\s*seco/.test(txt)) return "Vigía";
    if (/merida|llano|milla|lora|independencia|pinto\s*salina|ejido/.test(txt)) return "Mérida";
    return "Vigía";
  };
  const rutasUsuarioS = (raw) => {
    const arr = Array.isArray(raw) ? raw : String(raw || "").split(/[,;|/]+/);
    const vistas = {};
    arr.forEach((x) => {
      const c = rutaCanonS(x);
      if (c) vistas[c] = 1;
    });
    return RUTAS_CARTERA_S.filter((r) => vistas[r]);
  };
  const activoS = (u) => u && (u.activo === true || ["true", "1", "si", "sí"].includes(String(u.activo).toLowerCase()));
  const borradoS = (x) => x && (x.borrado === true || String(x.borrado) === "true");
  const soloDigitosS = (s) => String(s || "").replace(/\D/g, "");
  const telClaveS = (s) => { const d = soloDigitosS(s); return d.length >= 10 ? d.slice(-10) : d; };
  const mismoTelS = (a, b) => { const x = telClaveS(a), y = telClaveS(b); return x.length >= 7 && x === y; };
  const mismoRifS = (a, b) => {
    const x = soloDigitosS(a), y = soloDigitosS(b);
    if (x.length < 6 || y.length < 6) return false;
    if (x === y) return true;
    const largo = x.length > y.length ? x : y, corto = x.length > y.length ? y : x;
    return largo.length - corto.length === 1 && corto.length >= 7 && largo.slice(0, -1) === corto;
  };
  const pagoPorIdS = (id) => PAGOS_S.find((x) => x.id === id) || null;
  const tipoPagoDeS = (pago) => {
    const t = String(pago || "").toLowerCase();
    const ef = /efectivo/.test(t), cred = /cr[eé]dito/.test(t);
    if (ef) return cred ? "efectivo_credito" : "efectivo_pronto";
    return cred ? "credito" : "pronto";
  };
  const normalizarCodigoS = (code) => String(code || "").trim().toUpperCase().replace(/^DIST-(BC|KT)-/, "$1-");
  const esBaseS = (code) => {
    const c = normalizarCodigoS(code);
    return PRODUCTOS_BASE_S.some((b) => b[0] === c) || (typeof allProductsMap === "function" && !!(allProductsMap()[c] || allProductsMap()[code]));
  };
  const infoProductoS = (pr) => ({
    nombre: pr.producto, tipo: pr.tipo === "kits" ? "kits" : "banos", linea: pr.linea, beneficio: pr.beneficio,
    cabello: pr.cabello || "1A–4C", unidades: pr.unidades_caja || 6, imagen: /^https:\/\//.test(pr.imagen) ? pr.imagen : "",
  });
  const clientePublicoS = (c) => ({
    id: String(c.id), nombre: String(c.nombre), contacto: String(c.contacto || ""),
    rif_cedula: String(c.rif_cedula || ""), direccion: String(c.direccion || ""),
    telefono: String(c.telefono || ""), telefono2: String(c.telefono2 || ""),
    ruta: normalizarRutaS(c.ruta || c.zona, c.nombre, c.direccion, c.id),
    vendedor_id: String(c.vendedor_id || ""),
    latitud: c.latitud === "" || c.latitud === null || c.latitud === undefined ? "" : Number(c.latitud),
    longitud: c.longitud === "" || c.longitud === null || c.longitud === undefined ? "" : Number(c.longitud),
  });
  const pagoPublicoS = (x) => ({
    id: String(x.id), pedido_id: String(x.pedido_id || ""), fecha_pago: fechaIsoS(x.fecha_pago), created_at: String(x.created_at || ""), registrado_por: String(x.registrado_por || ""),
    moneda: String(x.moneda || "USD"), monto: Number(x.monto) || 0, tasa: Number(x.tasa) || 0, monto_usd: Number(x.monto_usd) || 0,
    referencia: String(x.referencia || ""), tipo_pago_real: String(x.tipo_pago_real || ""), estado: String(x.estado || ""),
    conciliado_at: String(x.conciliado_at || ""), conciliado_por: String(x.conciliado_por || ""), motivo: String(x.motivo || ""),
    comision_estado: String(x.comision_estado || ""), comision_pct: Number(x.comision_pct) || 0, comision_usd: Number(x.comision_usd) || 0,
    comision_moneda: String(x.comision_moneda || ""), comision_monto: Number(x.comision_monto) || 0, comision_tasa: Number(x.comision_tasa) || 0,
    comision_fecha: fechaIsoS(x.comision_fecha), comision_ref: String(x.comision_ref || ""),
    comision_pagada_at: String(x.comision_pagada_at || ""), comision_pagada_por: String(x.comision_pagada_por || ""),
    canal_cobro: String(x.canal_cobro || ""),
  });
  const totalCobrarS = (ped) => {
    const tf = ped.total_final;
    return r2S(tf !== "" && tf !== undefined && tf !== null ? Number(tf) : Number(ped.total) || 0);
  };
  const toleranciaCobroS = (total) => Math.max(1, (Number(total) || 0) * 0.01);
  const pagosDeS = (pagos, pedidoId) => (pagos || []).filter((x) => String(x.pedido_id) === String(pedidoId));
  const recalcularCobroS = (ped, pagos) => {
    const activos = pagosDeS(pagos, ped.id).filter((x) => String(x.estado) !== "rechazado");
    ped.pagado_usd = r2S(activos.reduce((a, x) => a + (Number(x.monto_usd) || 0), 0));
    ped.saldo = String(r2S(Math.max(0, totalCobrarS(ped) - ped.pagado_usd)));
    ped.pagos_pend = activos.filter((x) => String(x.estado) === "reportado").length;
    return ped;
  };
  const pedidoConItemsS = (ped, items, pagos) => {
    const o = { ...ped };
    o.total_cajas = Number(o.total_cajas) || 0;
    o.dias_credito = Number(o.dias_credito) || 0;
    o.monto = o.monto === "" || o.monto === undefined || o.monto === null ? "" : Number(o.monto);
    o.total = o.total === "" || o.total === undefined || o.total === null ? "" : Number(o.total);
    o.total_final = o.total_final === "" || o.total_final === undefined || o.total_final === null ? "" : Number(o.total_final);
    o.tipo_pago = String(o.tipo_pago || "") || tipoPagoDeS(o.pago);
    o.excepcion_precio = o.excepcion_precio === true || String(o.excepcion_precio) === "true";
    o.factura = String(o.factura || "");
    o.nota_credito = o.nota_credito === "" || o.nota_credito === undefined || o.nota_credito === null ? "" : Number(o.nota_credito);
    o.pagado_usd = Number(o.pagado_usd) || 0;
    o.saldo = o.saldo === "" || o.saldo === undefined || o.saldo === null ? "" : Number(o.saldo);
    o.pagos_pend = Number(o.pagos_pend) || 0;
    o.ajuste_estado = String(o.ajuste_estado || "");
    o.ajuste_motivo = String(o.ajuste_motivo || "");
    o.ajuste_por = String(o.ajuste_por || "");
    o.ajuste_at = String(o.ajuste_at || "");
    o.ajuste_previo = String(o.ajuste_previo || "");
    o.items = (items || []).filter((it) => String(it.pedido_id) === String(ped.id)).map((it) => ({
      code: it.code, producto: it.producto, cajas: Number(it.cajas) || 0,
      unidades_caja: it.unidades_caja === "" || it.unidades_caja === null || it.unidades_caja === undefined ? "" : Number(it.unidades_caja),
      unidad: it.unidad || "unidades",
      total_unidades: it.total_unidades === "" || it.total_unidades === null || it.total_unidades === undefined ? "" : Number(it.total_unidades),
      precio: Number(it.precio) || 0, desc_pronto: Number(it.desc_pronto) || 0,
      desc_efectivo_credito: Number(it.desc_efectivo_credito) || 0, desc_efectivo_pronto: Number(it.desc_efectivo_pronto) || 0,
      entregadas: Number(it.entregadas) || 0, devueltas: Number(it.devueltas) || 0,
    }));
    if (pagos) {
      let listaPagos = pagosDeS(pagos, ped.id).map(pagoPublicoS);
      if (!listaPagos.length && (o.cobro === "conciliado" || o.cobro === "cancelado") && Number(o.monto) > 0) {
        const totUsd = totalCobrarS(ped) || (o.moneda === "Bs" ? 0 : Number(o.monto) || 0);
        listaPagos = [pagoPublicoS({
          id: "PED-" + o.id, pedido_id: o.id,
          fecha_pago: fechaIsoS(o.cobrado_at || o.conciliado_at || o.entregado_at || o.fecha),
          created_at: String(o.cobrado_at || o.conciliado_at || o.created_at || ""),
          registrado_por: String(o.cobrado_por || o.vendedor || ""),
          moneda: String(o.moneda || "USD"), monto: Number(o.monto) || 0,
          tasa: o.moneda === "Bs" && totUsd > 0 ? r2S((Number(o.monto) || 0) / totUsd) : 0,
          monto_usd: totUsd, referencia: "", tipo_pago_real: String(o.tipo_pago_real || o.tipo_pago || ""),
          estado: o.cobro === "conciliado" ? "conciliado" : "reportado",
          conciliado_at: String(o.conciliado_at || ""), conciliado_por: String(o.conciliado_por || ""),
        })];
      }
      o.pagos = listaPagos;
    }
    return o;
  };
  const tablaPreciosS = (filasPrecios) => {
    const m = {};
    const rebaja = (v, base) => { const n = numPrecioS(v); return n && base && n < base ? r2S(base - n) : 0; };
    PRODUCTOS_BASE_S.forEach((b) => {
      const code = b[0];
      const menor = numPrecioS(b[2]);
      const mayor = numPrecioS(b[3]) || menor;
      if (!menor) return;
      const pronto = r2S(menor * 0.97), efCred = r2S(menor * 0.96), efPronto = r2S(menor * 0.94);
      const mayPronto = r2S(mayor * 0.97), mayEfCred = r2S(mayor * 0.96), mayEfPronto = r2S(mayor * 0.94);
      m[code] = {
        code, producto: String(b[1] || code), menor, mayor,
        pronto, efectivo_credito: efCred, efectivo_pronto: efPronto,
        mayor_pronto: mayPronto, mayor_efectivo_credito: mayEfCred, mayor_efectivo_pronto: mayEfPronto,
        desc_pronto: rebaja(pronto, menor), desc_efectivo_credito: rebaja(efCred, menor), desc_efectivo_pronto: rebaja(efPronto, menor),
        mayor_desc_pronto: rebaja(mayPronto, mayor), mayor_desc_efectivo_credito: rebaja(mayEfCred, mayor), mayor_desc_efectivo_pronto: rebaja(mayEfPronto, mayor),
        tipo: code.startsWith("KT-") ? "kits" : "banos",
        linea: String(b[5] || ""), beneficio: "", cabello: "1A–4C",
        unidades_caja: Number(b[4]) || 6, imagen: "", _crudo: {},
      };
    });
    (filasPrecios || []).forEach((x) => {
      const code = normalizarCodigoS(x.code);
      if (!code) return;
      const baseItem = m[code] || {};
      const menor = numPrecioS(x.menor) || baseItem.menor || 0;
      const mayor = numPrecioS(x.mayor) || baseItem.mayor || menor;
      const baseMay = mayor || menor;
      const tienePrecioDb = numPrecioS(x.menor) > 0;
      const dp = tienePrecioDb ? rebaja(x.pronto, menor) : (baseItem.desc_pronto || 0);
      const dc = tienePrecioDb ? rebaja(x.efectivo_credito, menor) : (baseItem.desc_efectivo_credito || 0);
      const de = tienePrecioDb ? rebaja(x.efectivo_pronto, menor) : (baseItem.desc_efectivo_pronto || 0);
      const dm = (v, d) => (numPrecioS(v) ? rebaja(v, baseMay) : d);
      m[code] = {
        code,
        producto: String(x.producto || baseItem.producto || ""),
        menor,
        mayor,
        pronto: tienePrecioDb ? numPrecioS(x.pronto) : (baseItem.pronto || 0),
        efectivo_credito: tienePrecioDb ? numPrecioS(x.efectivo_credito) : (baseItem.efectivo_credito || 0),
        efectivo_pronto: tienePrecioDb ? numPrecioS(x.efectivo_pronto) : (baseItem.efectivo_pronto || 0),
        mayor_pronto: tienePrecioDb ? numPrecioS(x.mayor_pronto) : (baseItem.mayor_pronto || 0),
        mayor_efectivo_credito: tienePrecioDb ? numPrecioS(x.mayor_efectivo_credito) : (baseItem.mayor_efectivo_credito || 0),
        mayor_efectivo_pronto: tienePrecioDb ? numPrecioS(x.mayor_efectivo_pronto) : (baseItem.mayor_efectivo_pronto || 0),
        desc_pronto: dp, desc_efectivo_credito: dc, desc_efectivo_pronto: de,
        mayor_desc_pronto: tienePrecioDb ? dm(x.mayor_pronto, dp) : (baseItem.mayor_desc_pronto || dp),
        mayor_desc_efectivo_credito: tienePrecioDb ? dm(x.mayor_efectivo_credito, dc) : (baseItem.mayor_desc_efectivo_credito || dc),
        mayor_desc_efectivo_pronto: tienePrecioDb ? dm(x.mayor_efectivo_pronto, de) : (baseItem.mayor_desc_efectivo_pronto || de),
        tipo: String(x.tipo || baseItem.tipo || ""),
        linea: String(x.linea || baseItem.linea || ""),
        beneficio: String(x.beneficio || baseItem.beneficio || ""),
        cabello: String(x.cabello || baseItem.cabello || ""),
        unidades_caja: Number(x.unidades_caja) || baseItem.unidades_caja || 0,
        imagen: String(x.imagen || baseItem.imagen || ""),
        _crudo: x,
      };
    });
    return m;
  };
  const ponerPreciosS = (items, precios, mayor) => {
    items.forEach((it) => {
      if (Number(it.precio_manual) > 0) {
        it.precio = r2S(Number(it.precio_manual));
        it.desc_pronto = 0; it.desc_efectivo_credito = 0; it.desc_efectivo_pronto = 0;
        return;
      }
      const pr = precios[it.code] || {};
      it.precio = mayor ? (pr.mayor || pr.menor || 0) : (pr.menor || 0);
      const pre = mayor ? "mayor_desc_" : "desc_";
      it.desc_pronto = pr[pre + "pronto"] || 0;
      it.desc_efectivo_credito = pr[pre + "efectivo_credito"] || 0;
      it.desc_efectivo_pronto = pr[pre + "efectivo_pronto"] || 0;
    });
    return items;
  };
  const precioUnitarioS = (it, tipo) => {
    const pg = pagoPorIdS(tipo) || PAGOS_S[0];
    const unit = Number(it.precio) || 0;
    const d = pg.desc ? Number(it[pg.desc]) || 0 : 0;
    return r2S(Math.max(0, unit - d));
  };
  const totalPorPagoS = (items, tipo) => r2S(items.reduce((a, it) => a + (Number(it.cajas) || 0) * precioUnitarioS(it, tipo), 0));
  const existenciasS = (inv, pedidos, items) => {
    const st = {};
    const de = (code) => st[code] || (st[code] = { code, cargado: 0, aprobado: 0, salido: 0, en_proceso: 0, controlado: false });
    (inv || []).forEach((m) => {
      const code = normalizarCodigoS(m.code);
      if (!code) return;
      const x = de(code); x.cargado += Math.round(Number(m.cajas) || 0); x.controlado = true;
    });
    const estado = {};
    (pedidos || []).forEach((p) => { if (!borradoS(p)) estado[String(p.id)] = String(p.estado); });
    (items || []).forEach((it) => {
      const e = estado[String(it.pedido_id)];
      if (!e) return;
      const x = de(normalizarCodigoS(it.code));
      if (ESTADOS_CON_STOCK_S.includes(e)) x.aprobado += Number(it.cajas) || 0;
      if (e === "en_ruta" || e === "entregado") x.salido += Number(it.cajas) || 0;
      else if (e === "confirmado") x.salido += Number(it.entregadas) || 0;
      else if (e === "pendiente") x.en_proceso += Number(it.cajas) || 0;
    });
    Object.keys(st).forEach((k) => { st[k].disponible = st[k].cargado - st[k].aprobado; st[k].fisico = st[k].cargado - st[k].salido; });
    return st;
  };
  const faltaStockS = (items, stock) => {
    const faltan = [];
    items.forEach((it) => {
      const s = stock[normalizarCodigoS(it.code)];
      if (s && s.controlado && Number(it.cajas) > s.disponible) faltan.push(`${it.producto} (${it.code}): pediste ${it.cajas}, hay ${Math.max(0, s.disponible)}`);
    });
    return faltan.length ? "Sin stock suficiente: " + faltan.join(" · ") : "";
  };
  const limpiarItemsS = (items) => {
    if (!Array.isArray(items)) return [];
    return items.map((it) => {
      const cajas = Math.floor(Number(it.cajas));
      const u = Math.floor(Number(it.unidades_caja));
      const pm = numPrecioS(it.precio_manual);
      const o = {
        code: normalizarCodigoS(txtS(it.code, 20)),
        producto: txtS(it.producto, 120),
        cajas,
        unidades_caja: isFinite(u) && u > 0 ? String(u) : "",
        unidad: txtS(it.unidad || "unidades", 20),
        total_unidades: isFinite(u) && u > 0 ? String(cajas * u) : "",
      };
      if (pm > 0) o.precio_manual = pm;
      return o;
    }).filter((it) => it.code && isFinite(it.cajas) && it.cajas > 0 && it.cajas <= 10000);
  };
  const detalleUnidadesS = (items) => {
    const porUnidad = {};
    items.forEach((it) => { if (it.total_unidades) porUnidad[it.unidad] = (porUnidad[it.unidad] || 0) + Number(it.total_unidades); });
    return Object.keys(porUnidad).map((k) => `${porUnidad[k]} ${k}`).join(" + ");
  };
  const puedeVerS = (ses, x) => {
    if (borradoS(x)) return false;
    if (esGestionS(ses)) return true;
    if (tieneS(ses, "vendedor") && String(x.vendedor_id) === String(ses.id)) return true;
    if (tieneS(ses, "despachador") && String(x.despachador_id) === String(ses.id) && ["confirmado", "en_ruta", "entregado"].includes(String(x.estado))) return true;
    return false;
  };
  const buscarTasaLocalS = (filas, fecha) => {
    let mejor = null;
    (filas || []).forEach((x) => {
      const f = fechaIsoS(x.fecha), t = numTasaS(x.tasa);
      if (!f || !t || f > fecha) return;
      if (!mejor || f > mejor.fecha || (f === mejor.fecha && String(x.fuente) === "manual")) mejor = { fecha: f, tasa: t, fuente: String(x.fuente || "") };
    });
    return mejor;
  };
  const obtenerTasaBcvS = async (supa, filasTasas, fecha) => {
    const f = fechaIsoS(fecha) || hoyCaracasS();
    let t = buscarTasaLocalS(filasTasas, f);
    const ultima = (filasTasas || []).reduce((a, x) => { const fx = fechaIsoS(x.fecha); return fx > a ? fx : a; }, "");
    if (!t || (t.fecha !== f && f > ultima)) {
      try {
        const resp = await fetch("https://ve.dolarapi.com/v1/historicos/dolares/oficial");
        if (resp.ok) {
          const lista = await resp.json();
          if (Array.isArray(lista)) {
            const tiene = {};
            (filasTasas || []).forEach((x) => { const fx = fechaIsoS(x.fecha); if (fx) tiene[fx] = true; });
            const ahora = ahoraS();
            const nuevas = lista
              .map((x) => ({ fecha: fechaIsoS(x.fecha), tasa: numTasaS(x.promedio || x.venta || x.compra), fuente: "bcv", updated_at: ahora }))
              .filter((x) => x.fecha && x.tasa && !tiene[x.fecha]);
            if (nuevas.length) {
              nuevas.forEach((n) => filasTasas.push(n));
              // con sesión: el servidor solo deja agregar días que falten (nunca pisa una tasa guardada)
              const ses = sesion();
              if (ses) rpcSupabase(supa, { op: "escribir", token: ses.token, cambios: nuevas.slice(-60).map((n) => ({ tabla: "Tasas", fila: n })) }).catch(() => {});
            }
            t = buscarTasaLocalS(filasTasas, f) || t;
          }
        }
      } catch (_) {}
    }
    return t;
  };

  const telWhatsappS = (t) => {
    let d = soloDigitosS(t);
    if (d.startsWith("58") && d.length >= 12) d = d.slice(2);
    if (d.startsWith("0")) d = d.slice(1);
    return d.length === 10 ? "58" + d : "";
  };
  const numeroGpsS = (v, min, max) => {
    if (v === "" || v === null || v === undefined) return "";
    const n = Number(v);
    return isFinite(n) && n >= min && n <= max ? String(Math.round(n * 1e6) / 1e6) : "";
  };
  /* Respuesta de "catalogo". Con sesión: stock calculado de las tablas. Sin sesión: solo los códigos agotados
     que calcula el servidor (el visitante nunca recibe pedidos ni inventario). */
  const armarCatalogoS = (filasPrecios, stock, agotados, ses) => {
    const precios = tablaPreciosS(filasPrecios);
    const codes = {};
    PRODUCTOS_BASE_S.forEach((b) => { codes[b[0]] = b[1]; });
    Object.keys(precios).forEach((k) => { codes[k] = codes[k] || precios[k].producto; });
    const productos = Object.keys(codes).sort().map((code) => {
      const pr = precios[code] || {}, sSt = stock ? stock[code] : null;
      const o = {
        code, menor: pr.menor || 0, mayor: pr.mayor || pr.menor || 0, desc_pronto: pr.desc_pronto || 0,
        desc_efectivo_credito: pr.desc_efectivo_credito || 0, desc_efectivo_pronto: pr.desc_efectivo_pronto || 0,
        mayor_desc_pronto: pr.mayor_desc_pronto || 0, mayor_desc_efectivo_credito: pr.mayor_desc_efectivo_credito || 0, mayor_desc_efectivo_pronto: pr.mayor_desc_efectivo_pronto || 0,
        agotado: stock ? !!(sSt && sSt.controlado && sSt.disponible <= 0) : !!(agotados && agotados.has(code)),
      };
      if (!esBaseS(code) && pr.tipo) o.info = infoProductoS(pr);
      if (ses && stock) { o.controlado = !!(sSt && sSt.controlado); o.disponible = sSt && sSt.controlado ? Math.max(0, sSt.disponible) : null; o.en_proceso = sSt ? sSt.en_proceso : 0; }
      return o;
    });
    return { ok: true, actualizado: ahoraS(), cajas_mayor: CAJAS_MAYOR_S, pagos: PAGOS_S.map((x) => ({ id: x.id, nombre: x.nombre, credito: x.credito, desc: x.desc })), productos };
  };

  async function apiSupabase(supa, action, p = {}) {
    const s = sesion();
    const token = p.token || (s && s.token) || "";
    const fail = (error, code = "error") => { const err = new Error(error); err.code = code; throw err; };

    if (action === "login") {
      return await rpcSupabase(supa, { op: "login", usuario: p.usuario, clave: p.clave ?? p.pin, dispositivo: p.dispositivo === true });
    }
    if (action === "yo") {
      return await rpcSupabase(supa, { op: "yo", token });
    }

    /* ---------- Acciones públicas del catálogo: operaciones acotadas del servidor ---------- */
    if (action === "catalogo" && !token) {
      const r = await rpcSupabase(supa, { op: "catalogo_publico" });
      return armarCatalogoS(r.precios, null, new Set(r.agotados || []), null);
    }
    if (action === "vendedores") {
      const catFiltro = String(p.catalogo || "").trim().toLowerCase();
      const rutaFiltro = rutaCanonS(p.ruta || p.zona);
      const r = await rpcSupabase(supa, { op: "vendedores_publico", ...(catFiltro ? { catalogo: catFiltro } : {}) });
      const lista = (r.vendedores || [])
        .map((u) => ({
          id: String(u.id),
          usuario: String(u.usuario || ""),
          nombre: String(u.nombre),
          whatsapp: telWhatsappS(u.telefono),
          catalogo: catalogoUsuarioS(u.catalogo),
          rutas: rutasUsuarioS(u.rutas),
        }))
        .filter((u) => !["skala", "distribuidora"].includes(catFiltro) || u.catalogo === catFiltro || u.catalogo === "ambos")
        .filter((u) => !rutaFiltro || !u.rutas.length || u.rutas.includes(rutaFiltro))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      return { ok: true, vendedores: lista };
    }
    if (action === "buscarClienteWeb") {
      if (soloDigitosS(p.q).length < 6) fail("Escribí tu teléfono o RIF completo.", "corto");
      const r = await rpcSupabase(supa, { op: "buscar_cliente_web", q: soloDigitosS(p.q) });
      return {
        ok: true,
        cliente: r.cliente
          ? {
              ...r.cliente,
              ruta: normalizarRutaS(r.cliente.ruta, r.cliente.negocio, r.cliente.direccion, r.cliente.id),
              vendedor_id: String(r.cliente.vendedor_id || ""),
            }
          : null,
      };
    }
    if (action === "asignarVendedorWeb") {
      const r = await rpcSupabase(supa, { op: "asignar_vendedor_web", id: String(p.id || "").toUpperCase(), vendedor_id: String(p.vendedor_id || "") });
      return r.sin_cambios ? { ok: true, sin_cambios: true } : { ok: true };
    }
    if (action === "pedidoWeb") {
      const c = p.cliente || {};
      const datos = {
        negocio: txtS(c.negocio, 120), contacto: txtS(c.contacto, 120), rif_cedula: txtS(c.rif_cedula || c.rif, 30).toUpperCase(),
        telefono: txtS(c.telefono, 30), direccion: txtS(c.direccion, 250),
      };
      if (!datos.negocio && !datos.contacto) fail("Escribí tu nombre o el de tu negocio.", "cliente");
      if (soloDigitosS(datos.telefono).length < 7) fail("Escribí tu teléfono (para que el vendedor te contacte).", "telefono");
      const items = limpiarItemsS(p.items);
      if (!items.length) fail("El pedido no tiene productos.", "empty");
      let ref = txtS(p.ref, 40).toUpperCase().replace(/[^A-Z0-9-]/g, "");
      if (!/^WEB-[A-Z0-9]{4,12}$/.test(ref)) ref = "WEB-" + uuidS().replace(/-/g, "").slice(0, 8).toUpperCase();
      // Precios es tabla pública: el total es solo una estimación para el vendedor
      const lp = await rpcSupabase(supa, { op: "leer", tablas: ["Precios"] });
      const totalCajas = items.reduce((a, it) => a + it.cajas, 0);
      ponerPreciosS(items, tablaPreciosS((lp.datos || {}).Precios), totalCajas >= CAJAS_MAYOR_S);
      const tipo = pagoPorIdS(String(p.tipo_pago || "")) ? String(p.tipo_pago) : "credito";
      const r = await rpcSupabase(supa, {
        op: "pedido_web",
        fila: {
          id: ref, fecha: fechaHoraCaracasS(), vendedor_id: txtS(p.vendedor_id, 20),
          negocio: datos.negocio || datos.contacto, contacto: datos.contacto,
          rif_cedula: datos.rif_cedula, telefono: datos.telefono, direccion: datos.direccion,
          items: JSON.stringify(items.map((it) => ({ code: it.code, producto: it.producto, cajas: it.cajas, unidades_caja: it.unidades_caja, unidad: it.unidad }))),
          tipo_pago: tipo, total_cajas: totalCajas, total: totalPorPagoS(items, tipo), nota: txtS(p.nota, 300),
          cliente_id: txtS(c.cliente_id || c.id, 60), latitud: numeroGpsS(c.latitud, -90, 90), longitud: numeroGpsS(c.longitud, -180, 180),
        },
      });
      return r.duplicado ? { ok: true, duplicado: true, id: r.id || ref } : { ok: true, id: r.id || ref };
    }

    // Determinar qué tablas necesita cada acción (todas con sesión, salvo "config": Config es pública)
    const mapaTablas = {
      catalogo: ["Precios", "Inventario", "Pedidos", "PedidoItems"],
      despachadores: ["Usuarios"],
      config: ["Config"],
      clientes: ["Clientes"],
      guardarCliente: ["Clientes"],
      pedidosWeb: ["PedidosWeb", "Precios"],
      descartarWeb: ["PedidosWeb"],
      pedidos: ["Pedidos", "PedidoItems", "Pagos", "Clientes"],
      pedido: ["Pedidos", "PedidoItems", "Pagos", "Clientes", "Historial"],
      guardarPedido: ["Pedidos", "PedidoItems", "Precios", "Inventario", "Clientes", "PedidosWeb"],
      estado: ["Pedidos", "PedidoItems", "Inventario", "Usuarios"],
      editarPedido: ["Pedidos", "PedidoItems", "Precios", "Inventario", "Clientes"],
      borrarPedido: ["Pedidos"],
      cobro: ["Pedidos", "PedidoItems", "Pagos", "Tasas", "Clientes"],
      tasa: ["Tasas"],
      comisiones: ["Config", "Usuarios"],
      guardarComisionConfig: ["Config", "Usuarios"],
      pagarComision: ["Pedidos", "Pagos", "Config", "Usuarios", "Tasas"],
      inventario: ["Precios", "Inventario", "Pedidos", "PedidoItems"],
      movimiento: ["Precios", "Inventario", "Pedidos", "PedidoItems"],
      cargarInventario: ["Precios", "Inventario", "Pedidos", "PedidoItems"],
      guardarPrecio: ["Precios"],
      guardarProducto: ["Precios", "Inventario"],
      sincronizar: ["Precios", "Inventario", "Pedidos", "PedidoItems", "Pagos", "Clientes", "PedidosWeb", "Usuarios", "Config", "Visitas"],
      resumen: ["Pedidos", "PedidoItems", "Visitas"],
      registrarVisita: ["Clientes", "Visitas"],
      visitas: ["Visitas"],
      cambiarClientePedido: ["Pedidos", "PedidoItems", "Pagos", "Clientes", "Visitas"],
      usuarios: ["Usuarios"],
      guardarUsuario: ["Usuarios"],
      guardarMisRutas: ["Usuarios"],
    };
    const publicas = ["config"]; // el servidor rechaza igual cualquier tabla privada sin sesión
    const tablas = mapaTablas[action];
    if (!tablas) fail("Acción desconocida: " + action, "unknown_action");

    const lectura = await rpcSupabase(supa, {
      op: "leer",
      token,
      requiere_sesion: !publicas.includes(action),
      tablas,
    });
    const ses = lectura.sesion;
    const db = lectura.datos || {};

    // Validar permisos de rol (el servidor vuelve a validar al escribir)
    const permRol = {
      catalogo: ROLES_S,
      clientes: TOMAN_S, guardarCliente: TOMAN_S, guardarPedido: TOMAN_S, pedidos: ROLES_S, pedido: ROLES_S,
      estado: ROLES_S, cobro: TOMAN_S, tasa: TOMAN_S, comisiones: TOMAN_S, guardarComisionConfig: GESTION_S,
      pagarComision: GESTION_S, pedidosWeb: TOMAN_S, descartarWeb: TOMAN_S, borrarPedido: TOMAN_S,
      sincronizar: ROLES_S, inventario: GESTION_S, movimiento: GESTION_S, cargarInventario: GESTION_S,
      editarPedido: GESTION_S, guardarPrecio: GESTION_S, guardarProducto: GESTION_S, despachadores: GESTION_S,
      resumen: TOMAN_S, usuarios: ["master"], guardarUsuario: ["master"], guardarMisRutas: TOMAN_S,
      registrarVisita: TOMAN_S, visitas: TOMAN_S, cambiarClientePedido: TOMAN_S,
    };
    if (permRol[action] && !tieneAlgunoS(ses, permRol[action])) {
      fail("Tu usuario no tiene permiso para esto.", "forbidden");
    }

    const cambios = [];
    // Devuelve la respuesta del servidor: { ok, ids } o { ok, duplicado, id } (correlativo reasignado / pedido repetido)
    const guardarCambios = async () => {
      if (!cambios.length) return { ok: true, ids: {} };
      try {
        return await rpcSupabase(supa, { op: "escribir", token, cambios });
      } catch (e) {
        // Base todavía sin la tabla "visitas" (schema.sql sin actualizar): se guarda igual el pedido / cobro sin la visita
        if (e && e.code === "tabla" && /visitas/i.test(String(e.message)) && cambios.some((ch) => ch.tabla === "Visitas")) {
          const sinVisitas = cambios.filter((ch) => ch.tabla !== "Visitas");
          cambios.length = 0;
          cambios.push(...sinVisitas);
          if (!cambios.length) return { ok: true, ids: {}, sin_visitas: true };
          return await rpcSupabase(supa, { op: "escribir", token, cambios });
        }
        throw e;
      }
    };
    const addHist = (pedidoId, accionH, detalleH) => {
      cambios.push({
        tabla: "Historial",
        fila: {
          fecha: ahoraS(),
          pedido_id: String(pedidoId),
          usuario: ses ? `${ses.nombre} (${nombreRolesS(ses.roles || [ses.rol])})` : "",
          accion: accionH,
          detalle: detalleH || "",
        },
      });
    };

    // --- catalogo (con sesión: incluye existencias) ---
    if (action === "catalogo") {
      return armarCatalogoS(db.Precios, existenciasS(db.Inventario, db.Pedidos, db.PedidoItems), null, ses);
    }

    // --- config ---
    const leerConfigLocal = () => {
      const o = {};
      CONFIG_BASE_S.forEach((c) => { o[c[0]] = c[1]; });
      (db.Config || []).forEach((x) => { const k = String(x.clave || "").trim(); if (k) o[k] = x.valor; });
      return {
        version_apk: Number(o.version_apk) || 0, url_apk: String(o.url_apk || ""), minima_apk: Number(o.minima_apk) || 0,
        version_pantallas: String(o.version_pantallas || ""), url_pantallas: String(o.url_pantallas || ""), notas: String(o.notas || ""),
      };
    };
    if (action === "config") return { ok: true, config: leerConfigLocal() };

    // --- despachadores (vendedores es pública y se resuelve arriba) ---
    if (action === "despachadores") {
      const lista = (db.Usuarios || []).filter((u) => rolesDeS(u.rol).includes("despachador") && activoS(u))
        .map((u) => ({ id: String(u.id), nombre: String(u.nombre) }));
      return { ok: true, despachadores: lista };
    }

    // --- clientes / guardarCliente / buscarClienteWeb ---
    if (action === "clientes") {
      const q = txtS(p.q, 60).toLowerCase();
      const qd = soloDigitosS(q);
      const rutaFiltro = rutaCanonS(p.ruta || p.zona);
      const lista = (db.Clientes || []).filter((c) => {
        if (String(c.deleted) === "1" || c.deleted === true) return false;
        const rutaC = normalizarRutaS(c.ruta || c.zona, c.nombre, c.direccion, c.id);
        if (rutaFiltro && rutaC !== rutaFiltro) return false;
        if (!q) return true;
        const texto = [c.nombre, c.contacto, c.rif_cedula, c.direccion, rutaC].join(" ").toLowerCase();
        if (texto.includes(q)) return true;
        if (qd.length >= 4) {
          const qt = telClaveS(qd);
          const enTel = (t) => soloDigitosS(t).includes(qd) || telClaveS(t).includes(qt);
          return enTel(c.telefono) || enTel(c.telefono2) || soloDigitosS(c.rif_cedula).includes(qd);
        }
        return false;
      });
      lista.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
      const limite = Math.min(Math.max(Number(p.limite) || 20, 1), 200);
      return { ok: true, clientes: lista.slice(0, limite).map(clientePublicoS) };
    }

    const guardarClienteInterno = (c, opciones = {}) => {
      const exigirTelefono = opciones.exigirTelefono !== false;
      const rutaExplicit = rutaCanonS(c.ruta || c.zona);
      const datos = {
        nombre: txtS(c.negocio || c.nombre, 120),
        contacto: txtS(c.contacto, 120),
        rif_cedula: txtS(c.rif_cedula, 30).toUpperCase(),
        direccion: txtS(c.direccion, 250),
        telefono: txtS(c.telefono, 30),
        telefono2: txtS(c.telefono2, 30),
        latitud: numeroGpsS(c.latitud, -90, 90),
        longitud: numeroGpsS(c.longitud, -180, 180),
        ruta: rutaExplicit,
      };
      if (!datos.nombre && datos.contacto) datos.nombre = datos.contacto;
      if (!datos.nombre) fail("Falta el nombre del cliente o del negocio.", "cliente");
      if (exigirTelefono && !datos.telefono) fail("Falta el teléfono del cliente.", "cliente");
      if (datos.telefono && soloDigitosS(datos.telefono).length < 7) fail("El teléfono 1 debe tener al menos 7 números.", "cliente");

      const todos = db.Clientes || [];
      const tel = soloDigitosS(datos.telefono);
      const rif = soloDigitosS(datos.rif_cedula);
      let existente = null;
      if (c.id) existente = todos.find((x) => String(x.id) === String(c.id));
      if (!existente && tel.length >= 7) existente = todos.find((x) => mismoTelS(x.telefono, tel) || mismoTelS(x.telefono2, tel));
      if (!existente && rif.length >= 6) existente = todos.find((x) => mismoRifS(x.rif_cedula, rif));
      if (!existente && tel.length < 7 && rif.length < 6) {
        const n = datos.nombre.toLowerCase();
        existente = todos.find((x) => String(x.nombre).trim().toLowerCase() === n && String(x.deleted) !== "1");
      }
      const t = ahoraS();
      if (existente) {
        const actualizado = { ...existente };
        if (!opciones.reemplazar && datos.telefono && String(existente.telefono || "").trim()) {
          const nuevoTel = datos.telefono;
          datos.telefono = "";
          if (!mismoTelS(existente.telefono, nuevoTel) && !mismoTelS(existente.telefono2, nuevoTel)) datos.telefono2 = nuevoTel;
          else if (datos.telefono2 && (mismoTelS(existente.telefono, datos.telefono2) || mismoTelS(existente.telefono2, datos.telefono2))) datos.telefono2 = "";
        }
        Object.keys(datos).forEach((k) => { if (opciones.reemplazar || datos[k] !== "") actualizado[k] = datos[k]; });
        actualizado.ruta = rutaExplicit || normalizarRutaS(existente.ruta, actualizado.nombre, actualizado.direccion, existente.id);
        if (esGestionS(ses) && c.vendedor_id !== undefined) actualizado.vendedor_id = txtS(c.vendedor_id, 40);
        actualizado.updated_at = t;
        actualizado.sync_status = 1;
        cambios.push({ tabla: "Clientes", fila: actualizado });
        actualizado._existia = true;
        return actualizado;
      }
      const vendIdNuevo = esGestionS(ses) && c.vendedor_id !== undefined ? txtS(c.vendedor_id, 40) : (ses ? ses.id : "");
      const nuevoId = uuidS();
      datos.ruta = rutaExplicit || normalizarRutaS("", datos.nombre, datos.direccion, nuevoId);
      const nuevo = { id: nuevoId, updated_at: t, created_at: t, sync_status: 1, deleted: "0", vendedor_id: vendIdNuevo, ...datos };
      cambios.push({ tabla: "Clientes", fila: nuevo });
      todos.unshift(nuevo);
      return nuevo;
    };

    if (action === "guardarCliente") {
      const c = p.cliente || {};
      if (c.id && !(db.Clientes || []).some((x) => String(x.id) === String(c.id))) fail("Cliente no encontrado.", "not_found");
      const r = guardarClienteInterno(c, { exigirTelefono: false, reemplazar: !!c.id });
      await guardarCambios();
      return { ok: true, cliente: clientePublicoS(r), existia: !!r._existia && !c.id };
    }

    // --- Canal de atención (solo 2: en_persona · online_telefono), GPS aprendido y visitas (idéntico a Code.gs) ---
    const CANALES_S = ["en_persona", "online_telefono"];
    const TIPOS_VISITA_S = ["pedido", "cobro", "visita_ruta", "no_disponible", "no_visitado", "alta_cliente"];
    const canalValidoS = (c) => CANALES_S.includes(String(c || ""));
    const gpsValidoS = (lat, lng) => {
      if (lat === "" || lng === "" || lat === null || lng === null || lat === undefined || lng === undefined) return false;
      const a = Number(lat), b = Number(lng);
      if (!isFinite(a) || !isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return false;
      return !(a === 0 && b === 0);
    };
    const mismaCoordS = (lat1, lng1, lat2, lng2) => gpsValidoS(lat1, lng1) && gpsValidoS(lat2, lng2)
      && Math.abs(Number(lat1) - Number(lat2)) < 1e-5 && Math.abs(Number(lng1) - Number(lng2)) < 1e-5;
    const fixDeS = (lat, lng) => (gpsValidoS(lat, lng) ? { lat: numeroGpsS(lat, -90, 90), lng: numeroGpsS(lng, -180, 180) } : null);
    /* Las coordenadas del cliente iguales a la lectura del vendedor se quitan: el servidor decide si se aprenden */
    const prepararAtencionS = (canalRaw, lat, lng, c) => {
      const canal = canalValidoS(canalRaw) ? String(canalRaw) : "";
      const fix = canal ? fixDeS(lat, lng) : null;
      const copia = { ...(c || {}) };
      if (fix && mismaCoordS(copia.latitud, copia.longitud, fix.lat, fix.lng)) { copia.latitud = ""; copia.longitud = ""; }
      return { canal, fix, cliente: copia };
    };
    /* Primera ubicación del cliente (solo si no tenía). true = la aprendió */
    const aprenderGpsClienteS = (cliente, fix) => {
      if (!cliente || !cliente.id || !fix || !gpsValidoS(fix.lat, fix.lng)) return false;
      const pend = cambios.find((ch) => ch.tabla === "Clientes" && ch.fila && String(ch.fila.id) === String(cliente.id));
      const base = pend ? pend.fila : (db.Clientes || []).find((y) => String(y.id) === String(cliente.id));
      if (!base || gpsValidoS(base.latitud, base.longitud)) return false;
      const fila = pend ? base : { ...base };
      fila.latitud = fix.lat; fila.longitud = fix.lng; fila.updated_at = ahoraS(); fila.sync_status = 1;
      if (!pend) cambios.push({ tabla: "Clientes", fila });
      cliente.latitud = fix.lat; cliente.longitud = fix.lng;
      return true;
    };
    const agregarVisitaS = (d) => {
      const t = ahoraS();
      const dist = d.distancia_m === "" || d.distancia_m === undefined || d.distancia_m === null ? "" : String(Math.round(Number(d.distancia_m)) || 0);
      const v = {
        id: "VIS-" + uuidS().replace(/-/g, "").slice(0, 10).toUpperCase(),
        fecha: hoyCaracasS(), cliente_id: String(d.cliente.id || ""), negocio: String(d.cliente.nombre || d.cliente.negocio || ""),
        vendedor_id: ses ? String(ses.id) : "", vendedor: ses ? String(ses.nombre) : "",
        canal: d.canal, tipo: TIPOS_VISITA_S.includes(d.tipo) ? d.tipo : "visita_ruta",
        submotivo: txtS(d.submotivo, 60), nota: txtS(d.nota, 300),
        pedido_id: String(d.pedido_id || ""), pago_id: String(d.pago_id || ""), mision_id: txtS(d.mision_id, 60),
        latitud: d.fix ? String(d.fix.lat) : "", longitud: d.fix ? String(d.fix.lng) : "", distancia_m: dist,
        en_sitio: d.canal === "en_persona", gps_aprendido: !!d.gps_aprendido,
        anulada: false, anulada_motivo: "", created_at: t, updated_at: t,
      };
      cambios.push({ tabla: "Visitas", fila: v });
      return v;
    };
    /* Cobro con canal: visita de cobro; en persona aprende el GPS si el cliente no tenía, online no lo toca */
    const visitaDeCobroS = (ped, pago) => {
      if (!canalValidoS(pago.canal_cobro)) return null;
      const c = (db.Clientes || []).find((x) => String(x.id) === String(ped.cliente_id));
      if (!c) return null;
      const enPersona = pago.canal_cobro === "en_persona";
      const fix = enPersona ? fixDeS(p.gps_lat, p.gps_lng) : null;
      const aprendio = fix ? aprenderGpsClienteS(c, fix) : false;
      return agregarVisitaS({ cliente: c, canal: pago.canal_cobro, tipo: "cobro", pedido_id: ped.id, pago_id: pago.id,
        fix, distancia_m: enPersona ? p.gps_dist_m : "", gps_aprendido: aprendio });
    };
    const visitaPublicaS = (v) => ({
      ...v,
      en_sitio: v.en_sitio === true || String(v.en_sitio) === "true",
      gps_aprendido: v.gps_aprendido === true || String(v.gps_aprendido) === "true",
      anulada: v.anulada === true || String(v.anulada) === "true",
    });
    const visitasDelPeriodoS = (dias, clienteId, incluirAnuladas) => {
      const desde = new Date(Date.now() - 4 * 3600000 - (Math.max(1, dias) - 1) * 86400000).toISOString().slice(0, 10);
      return (db.Visitas || []).map(visitaPublicaS).filter((v) => {
        if (String(v.fecha) < desde) return false;
        if (clienteId && String(v.cliente_id) !== String(clienteId)) return false;
        if (!incluirAnuladas && v.anulada) return false;
        return esGestionS(ses) || String(v.vendedor_id) === String(ses.id);
      }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    };

    if (action === "registrarVisita") {
      const canal = String(p.canal || "");
      if (!canalValidoS(canal)) fail("Indicá cómo atendiste al cliente: en persona u online / por teléfono.", "canal");
      const tipo = TIPOS_VISITA_S.includes(String(p.tipo)) ? String(p.tipo) : "visita_ruta";
      const c = (db.Clientes || []).find((x) => String(x.id) === String(p.cliente_id));
      if (!c) fail("Cliente no encontrado.", "not_found");
      const fix = fixDeS(p.latitud, p.longitud);
      const aprendio = canal === "en_persona" && fix && tipo !== "no_visitado" ? aprenderGpsClienteS(c, fix) : false;
      const v = agregarVisitaS({ cliente: c, canal, tipo, fix: canal === "en_persona" ? fix : null, distancia_m: p.distancia_m,
        gps_aprendido: aprendio, submotivo: p.submotivo, nota: p.nota, mision_id: p.mision_id, pedido_id: txtS(p.pedido_id, 40), pago_id: txtS(p.pago_id, 40) });
      await guardarCambios();
      return { ok: true, visita: visitaPublicaS(v), gps_aprendido: aprendio, cliente: clientePublicoS(c) };
    }

    if (action === "visitas") {
      const dias = Math.min(Math.max(Number(p.dias) || 1, 1), 365);
      return { ok: true, visitas: visitasDelPeriodoS(dias, p.cliente_id, !!p.incluir_anuladas).slice(0, 500) };
    }

    if (action === "cambiarClientePedido") {
      const ped = (db.Pedidos || []).find((x) => String(x.id) === String(p.pedido_id));
      if (!ped || !puedeVerS(ses, ped)) fail("Pedido no encontrado.", "not_found");
      if (!esGestionS(ses) && String(ped.vendedor_id) !== String(ses.id)) fail("Solo su vendedor (o Administración) puede cambiar el cliente.", "forbidden");
      if (String(ped.estado) !== "pendiente") fail("Solo se cambia el cliente de un pedido pendiente.", "estado");
      const nuevo = (db.Clientes || []).find((x) => String(x.id) === String(p.cliente_id));
      if (!nuevo || String(nuevo.deleted) === "1") fail("Cliente no encontrado.", "not_found");
      const anteriorId = String(ped.cliente_id);
      if (anteriorId === String(nuevo.id)) fail("El pedido ya es de ese cliente.", "mismo");
      const anterior = (db.Clientes || []).find((x) => String(x.id) === anteriorId) || null;
      const t = ahoraS();
      let revertidas = 0, gpsRevertido = false;
      (db.Visitas || []).forEach((v) => {
        if (String(v.pedido_id) !== String(ped.id) || String(v.tipo) !== "pedido" || v.anulada === true || String(v.anulada) === "true") return;
        const fila = { ...v, anulada: true, anulada_motivo: "cliente_equivocado", updated_at: t };
        cambios.push({ tabla: "Visitas", fila });
        revertidas++;
        const aprend = v.gps_aprendido === true || String(v.gps_aprendido) === "true";
        if (aprend && anterior && String(v.cliente_id) === anteriorId && mismaCoordS(anterior.latitud, anterior.longitud, v.latitud, v.longitud)) {
          cambios.push({ tabla: "Clientes", fila: { ...anterior, latitud: "", longitud: "", updated_at: t, sync_status: 1 } });
          gpsRevertido = true;
        }
      });
      ped.cliente_id = String(nuevo.id); ped.cliente = nuevo.contacto || nuevo.nombre; ped.negocio = nuevo.nombre; ped.updated_at = t;
      cambios.push({ tabla: "Pedidos", fila: ped });
      let visita = null, aprendio = false;
      if (canalValidoS(ped.canal_pedido)) {
        const fix = fixDeS(ped.gps_lat, ped.gps_lng);
        if (ped.canal_pedido === "en_persona" && fix) aprendio = aprenderGpsClienteS(nuevo, fix);
        visita = visitaPublicaS(agregarVisitaS({ cliente: nuevo, canal: String(ped.canal_pedido), tipo: "pedido", pedido_id: ped.id,
          fix: ped.canal_pedido === "en_persona" ? fix : null, distancia_m: ped.gps_dist_m, gps_aprendido: aprendio }));
      }
      addHist(ped.id, "cliente_cambiado", `De ${anterior ? anterior.nombre : anteriorId} a ${nuevo.nombre}${revertidas ? " · visita anulada en el cliente equivocado" : ""}${gpsRevertido ? " · GPS aprendido revertido" : ""}`);
      await guardarCambios();
      return { ok: true, pedido: pedidoConItemsS(ped, db.PedidoItems, db.Pagos), cliente: clientePublicoS(nuevo),
        visitas_anuladas: revertidas, gps_revertido: gpsRevertido, gps_aprendido: aprendio, visita };
    }

    // --- PedidosWeb ---
    const puedeTomarWebS = (w) => tieneS(ses, "master") || (tieneS(ses, "vendedor") && (String(w.vendedor_id) === String(ses.id) || !String(w.vendedor_id || "")));
    const webPublicoS = (w, precios) => {
      let items = [];
      try { items = JSON.parse(String(w.items || "[]")); } catch (_) { items = []; }
      items = limpiarItemsS(items);
      const cajas = items.reduce((a, it) => a + it.cajas, 0);
      ponerPreciosS(items, precios, cajas >= CAJAS_MAYOR_S);
      return {
        id: String(w.id), fecha: String(w.fecha), created_at: String(w.created_at), vendedor_id: String(w.vendedor_id || ""), vendedor: String(w.vendedor || ""),
        cliente: {
          id: String(w.cliente_id || ""), negocio: String(w.negocio || ""), contacto: String(w.contacto || ""), rif_cedula: String(w.rif_cedula || ""),
          telefono: String(w.telefono || ""), direccion: String(w.direccion || ""),
          latitud: w.latitud === "" || w.latitud === undefined ? "" : Number(w.latitud),
          longitud: w.longitud === "" || w.longitud === undefined ? "" : Number(w.longitud),
        },
        items, tipo_pago: String(w.tipo_pago || "credito"), total_cajas: cajas, nota: String(w.nota || ""), estado: String(w.estado || "nuevo"),
        pedido_id: String(w.pedido_id || ""), atendido_por: String(w.atendido_por || ""), motivo: String(w.motivo || ""),
      };
    };

    if (action === "pedidosWeb") {
      const precios = tablaPreciosS(db.Precios);
      const estado = p.estado === "todos" ? "" : "nuevo";
      const lista = (db.PedidosWeb || []).filter((w) => {
        if (estado && String(w.estado) !== estado) return false;
        return esGestionS(ses) || String(w.vendedor_id) === String(ses.id) || (tieneS(ses, "vendedor") && !String(w.vendedor_id || ""));
      }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return { ok: true, pedidos: lista.slice(0, 200).map((w) => ({ ...webPublicoS(w, precios), puede_tomar: puedeTomarWebS(w) })) };
    }

    if (action === "descartarWeb") {
      const motivo = txtS(p.motivo, 200);
      if (!motivo) fail("Indicá el motivo.", "motivo");
      const w = (db.PedidosWeb || []).find((x) => String(x.id) === String(p.id));
      if (!w || (!esGestionS(ses) && String(w.vendedor_id) !== String(ses.id))) fail("Pedido web no encontrado.", "not_found");
      if (!puedeTomarWebS(w)) fail("Solo su vendedor (o el Master) lo puede descartar.", "forbidden");
      if (String(w.estado) !== "nuevo") fail("Ese pedido web ya fue atendido.", "web");
      w.estado = "descartado"; w.motivo = motivo; w.atendido_por = ses.nombre; w.atendido_at = ahoraS();
      cambios.push({ tabla: "PedidosWeb", fila: w });
      await guardarCambios();
      return { ok: true };
    }

    // --- guardarPedido ---
    if (action === "guardarPedido") {
      const items = limpiarItemsS(p.items);
      if (!items.length) fail("El pedido no tiene productos.", "empty");
      const documento = txtS(p.documento, 30);
      if (!DOCUMENTOS_S.includes(documento)) fail("Indicá si el cliente quiere nota de entrega o factura.", "documento");
      const tipoPago = pagoPorIdS(String(p.tipo_pago || "")) ? String(p.tipo_pago) : tipoPagoDeS(p.pago);
      const pagoDef = pagoPorIdS(tipoPago);
      const pagoTexto = p.tipo_pago ? pagoDef.nombre : (txtS(p.pago, 40) || pagoDef.nombre);
      let diasCredito = 0;
      if (pagoDef.credito) {
        diasCredito = Math.floor(Number(p.dias_credito));
        if (!isFinite(diasCredito) || diasCredito < 1 || diasCredito > MAX_DIAS_CREDITO_S) fail(`Indicá los días de crédito (1 a ${MAX_DIAS_CREDITO_S}).`, "credito");
      }
      const ref = txtS(p.client_ref, 60);
      const pedidos = db.Pedidos || [];
      if (ref) {
        const repetido = pedidos.find((x) => String(x.client_ref) === ref);
        if (repetido) return { ok: true, duplicado: true, pedido: pedidoConItemsS(repetido, db.PedidoItems), cliente_id: String(repetido.cliente_id) };
      }
      if (documento === "Factura") {
        const cc = p.cliente || {};
        let rifCliente = txtS(cc.rif_cedula, 30);
        if (!rifCliente && cc.id) {
          const previo = (db.Clientes || []).find((x) => String(x.id) === String(cc.id));
          rifCliente = previo ? String(previo.rif_cedula || "") : "";
        }
        if (soloDigitosS(rifCliente).length < 6) fail("Para factura hace falta el RIF o la cédula del cliente.", "rif");
      }
      let web = null;
      if (p.web_id) {
        web = (db.PedidosWeb || []).find((w) => String(w.id) === String(p.web_id));
        if (!web) fail("Ese pedido web no existe.", "not_found");
        if (String(web.estado) !== "nuevo") fail(`Ese pedido web ya fue ${String(web.estado) === "tomado" ? `tomado (${web.pedido_id})` : "descartado"}.`, "web");
        if (!puedeTomarWebS(web)) fail(`Este pedido web es de ${web.vendedor}. Solo su vendedor (o el Master) lo puede tomar.`, "forbidden");
      }
      const sinStock = faltaStockS(items, existenciasS(db.Inventario, pedidos, db.PedidoItems));
      if (sinStock) fail(sinStock, "stock");
      const atencion = prepararAtencionS(p.canal_pedido, p.gps_lat, p.gps_lng, p.cliente || {});
      const cliente = guardarClienteInterno(atencion.cliente);
      const gpsAprendidoPed = atencion.canal === "en_persona" && atencion.fix ? aprenderGpsClienteS(cliente, atencion.fix) : false;

      const totalCajas = items.reduce((a, it) => a + it.cajas, 0);
      const personalizado = items.some((it) => Number(it.precio_manual) > 0);
      const excepcion = p.precio_mayor === true && totalCajas < CAJAS_MAYOR_S;
      const mayor = totalCajas >= CAJAS_MAYOR_S || excepcion;
      ponerPreciosS(items, tablaPreciosS(db.Precios), mayor);

      const prefijo = `SKL-${diaCortoCaracasS()}-`;
      let maxId = 0;
      pedidos.forEach((x) => {
        const id = String(x.id);
        if (id.startsWith(prefijo)) maxId = Math.max(maxId, Number(id.slice(prefijo.length)) || 0);
      });
      const nuevoId = prefijo + String(maxId + 1).padStart(3, "0");
      const t = ahoraS();
      const ped = {
        id: nuevoId, fecha: fechaHoraCaracasS(),
        vendedor_id: ses.id, vendedor: ses.nombre,
        cliente_id: cliente.id, cliente: cliente.contacto || cliente.nombre, negocio: cliente.nombre,
        total_cajas: totalCajas, detalle_unidades: detalleUnidadesS(items),
        pago: pagoTexto, tipo_pago: tipoPago, nivel_precio: personalizado ? "personalizado" : (mayor ? "mayor" : "menor"), excepcion_precio: excepcion,
        total: String(totalPorPagoS(items, tipoPago)),
        nota: txtS(p.nota, 300), documento, dias_credito: diasCredito, cobro: "",
        estado: "pendiente", estado_at: t, estado_por: ses.nombre, motivo: "",
        client_ref: ref, created_at: t, updated_at: t, web_id: web ? String(web.id) : "",
        canal_pedido: atencion.canal, gps_lat: atencion.fix ? String(atencion.fix.lat) : "", gps_lng: atencion.fix ? String(atencion.fix.lng) : "",
        gps_dist_m: atencion.canal && numeroGpsS(p.gps_dist_m, 0, 1e7) !== "" ? String(Math.round(Number(p.gps_dist_m))) : "",
      };
      // modo "nuevo": si otro vendedor tomó este correlativo al mismo tiempo, el servidor asigna el siguiente libre
      cambios.push({ tabla: "Pedidos", modo: "nuevo", fila: ped });
      if (atencion.canal) {
        agregarVisitaS({ cliente, canal: atencion.canal, tipo: "pedido", pedido_id: ped.id,
          fix: atencion.canal === "en_persona" ? atencion.fix : null, distancia_m: ped.gps_dist_m, gps_aprendido: gpsAprendidoPed });
      }
      if (web) {
        web.estado = "tomado"; web.pedido_id = ped.id; web.atendido_por = ses.nombre; web.atendido_at = t;
        cambios.push({ tabla: "PedidosWeb", fila: web });
      }
      const filasItems = items.map((it) => ({ ...it, pedido_id: ped.id, entregadas: 0, devueltas: 0 }));
      cambios.push({ tabla: "PedidoItems", modo: "reemplazar_pedido", pedido_id: ped.id, filas: filasItems });
      addHist(ped.id, "creado", `${ped.total_cajas} cajas · ${ped.negocio}${ped.total ? ` · ${ped.total} $ (${pagoTexto})` : ""}${personalizado ? " · precio personalizado" : (excepcion ? " · precio mayor por excepción" : "")}${web ? ` · desde pedido web ${web.id}` : ""}`);
      const rw = await guardarCambios();
      // El mismo client_ref ya estaba guardado (reintento simultáneo / cola sin señal): devolver el existente
      if (rw && rw.duplicado && rw.id) {
        const prev = await apiSupabase(supa, "pedido", { token, pedido_id: rw.id });
        return { ok: true, duplicado: true, pedido: prev.pedido, cliente_id: String(prev.pedido.cliente_id || cliente.id) };
      }
      // Correlativo reasignado en el servidor por choque con otro vendedor
      const idFinal = (rw && rw.ids && rw.ids[ped.id]) || ped.id;
      if (idFinal !== ped.id) {
        ped.id = idFinal;
        filasItems.forEach((f) => { f.pedido_id = idFinal; });
      }
      return { ok: true, pedido: pedidoConItemsS(ped, filasItems), cliente_id: cliente.id, cliente: clientePublicoS(cliente) };
    }

    // --- pedidos / pedido ---
    if (action === "pedidos") {
      const dias = Math.min(Math.max(Number(p.dias) || 30, 1), 365);
      const desde = new Date(Date.now() - dias * 86400000).toISOString();
      const estados = (Array.isArray(p.estados) ? p.estados : (p.estado ? [p.estado] : [])).filter((e) => ESTADOS_S.includes(e));
      const clienteId = txtS(p.cliente_id, 60);
      const items = db.PedidoItems || [];
      const pagos = db.Pagos || [];
      const lista = (db.Pedidos || []).filter((x) => {
        if (!puedeVerS(ses, x)) return false;
        if (clienteId) return String(x.cliente_id) === clienteId;
        if (p.por_cobrar) {
          if (String(x.estado) === "cancelado" || String(x.cobro)) return false;
          return Number(x.dias_credito) > 0 || String(x.estado) === "entregado";
        }
        if (p.por_conciliar) return String(x.cobro) === "cancelado" || Number(x.pagos_pend) > 0;
        if (p.conciliados) {
          if (String(x.cobro) === "conciliado" && String(x.conciliado_at) >= desde) return true;
          return pagos.some((pg) => String(pg.pedido_id) === String(x.id) && String(pg.estado) === "conciliado" && (String(pg.conciliado_at) >= desde || (dias >= 180 && String(pg.comision_estado) !== "pagada")));
        }
        if (estados.length && !estados.includes(String(x.estado))) return false;
        const abierto = ["pendiente", "confirmado", "en_ruta"].includes(String(x.estado));
        return abierto || String(x.created_at) >= desde;
      }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      const clientes = {};
      (db.Clientes || []).forEach((c) => { clientes[String(c.id)] = c; });
      return {
        ok: true,
        pedidos: lista.slice(0, 300).map((x) => {
          const o = pedidoConItemsS(x, items, pagos);
          const c = clientes[String(x.cliente_id)];
          if (c) o.cliente_datos = clientePublicoS(c);
          return o;
        }),
      };
    }

    if (action === "pedido") {
      const x = (db.Pedidos || []).find((y) => String(y.id) === String(p.pedido_id));
      if (!x || !puedeVerS(ses, x)) fail("Pedido no encontrado.", "not_found");
      const o = pedidoConItemsS(x, db.PedidoItems, db.Pagos);
      const c = (db.Clientes || []).find((y) => String(y.id) === String(x.cliente_id));
      if (c) o.cliente_datos = clientePublicoS(c);
      o.historial = (db.Historial || []).filter((h) => String(h.pedido_id) === String(x.id))
        .map((h) => ({ fecha: String(h.fecha), usuario: String(h.usuario), accion: String(h.accion), detalle: String(h.detalle) }));
      return { ok: true, pedido: o };
    }

    // --- tasa ---
    if (action === "tasa") {
      const fecha = fechaIsoS(p.fecha) || hoyCaracasS();
      if (fecha > hoyCaracasS()) fail("La fecha del pago no puede ser futura.", "fecha");
      const t = await obtenerTasaBcvS(supa, db.Tasas || [], fecha);
      if (!t) fail(`No hay tasa BCV para el ${fecha}.`, "tasa");
      return { ok: true, fecha, fecha_tasa: t.fecha, fecha_efectiva: t.fecha, tasa: t.tasa, fuente: t.fuente };
    }

    // --- cobro ---
    if (action === "cobro") {
      const accion = String(p.accion || "cancelar");
      const gestion = esGestionS(ses);
      const ped = (db.Pedidos || []).find((x) => String(x.id) === String(p.pedido_id));
      if (!ped || !puedeVerS(ses, ped)) fail("Pedido no encontrado.", "not_found");
      if (String(ped.estado) !== "entregado") fail("El cobro se registra cuando el pedido ya fue entregado.", "estado");
      const cobro = String(ped.cobro || "");
      const t = ahoraS();
      let detalle = "";
      const todosItems = db.PedidoItems || [];
      const filasIt = todosItems.filter((it) => String(it.pedido_id) === String(ped.id));
      const todosPagos = db.Pagos || [];

      if (accion === "revertir_ajuste") {
        if (!gestion) fail("Solo Administración puede revertir el cambio de precios.", "forbidden");
        if (!String(ped.ajuste_previo || "")) fail("No hay precios anteriores guardados para revertir.", "sin_ajuste");
        let prev = {};
        try { prev = JSON.parse(String(ped.ajuste_previo)); } catch (_) {}
        const mapPrev = {};
        (prev.items || []).forEach((x) => { mapPrev[String(x.code).toUpperCase()] = x; });
        filasIt.forEach((f) => {
          const ant = mapPrev[String(f.code).toUpperCase()];
          if (!ant) return;
          f.precio = Number(ant.precio) || 0;
          f.desc_pronto = Number(ant.desc_pronto) || 0;
          f.desc_efectivo_credito = Number(ant.desc_efectivo_credito) || 0;
          f.desc_efectivo_pronto = Number(ant.desc_efectivo_pronto) || 0;
        });
        cambios.push({ tabla: "PedidoItems", modo: "reemplazar_pedido", pedido_id: ped.id, filas: filasIt });
        if (prev.nivel_precio) ped.nivel_precio = prev.nivel_precio;
        ped.excepcion_precio = !!prev.excepcion_precio;
        const tipoAc = String(ped.tipo_pago || "") || tipoPagoDeS(ped.pago);
        ped.total = filasIt.some((it) => Number(it.precio) > 0) ? String(totalPorPagoS(filasIt, tipoAc)) : "";
        const tipoRe = String(ped.tipo_pago_real || "") || tipoAc;
        ped.total_final = filasIt.some((it) => Number(it.precio) > 0) ? String(totalPorPagoS(filasIt, tipoRe)) : "";
        ped.ajuste_estado = "revertido";
        recalcularCobroS(ped, todosPagos);
        if (cobro === "cancelado" && Number(ped.saldo) > toleranciaCobroS(totalCobrarS(ped))) ped.cobro = "";
        ped.updated_at = t;
        cambios.push({ tabla: "Pedidos", fila: ped });
        addHist(ped.id, "ajuste_revertido", `Se restauraron los precios originales (total ${ped.total_final || ped.total} $)`);
        await guardarCambios();
        return { ok: true, pedido: pedidoConItemsS(ped, todosItems, todosPagos) };
      }

      let ajusteTxt = "";
      if (p.ajuste_precios && typeof p.ajuste_precios === "object") {
        const codsAjuste = Object.keys(p.ajuste_precios).filter((k) => numPrecioS(p.ajuste_precios[k]) > 0);
        if (codsAjuste.length) {
          const motAjuste = txtS(p.ajuste_motivo, 200);
          if (!motAjuste) fail("Indicá el motivo del cambio de precios por error de facturación.", "motivo_ajuste");
          if (!String(ped.ajuste_previo || "")) {
            ped.ajuste_previo = JSON.stringify({
              nivel_precio: String(ped.nivel_precio || ""),
              excepcion_precio: ped.excepcion_precio === true || String(ped.excepcion_precio) === "true",
              total: ped.total,
              items: filasIt.map((f) => ({ code: String(f.code), precio: Number(f.precio) || 0, desc_pronto: Number(f.desc_pronto) || 0, desc_efectivo_credito: Number(f.desc_efectivo_credito) || 0, desc_efectivo_pronto: Number(f.desc_efectivo_pronto) || 0 })),
            });
          }
          const cambiosPr = [];
          filasIt.forEach((f) => {
            const code = String(f.code).toUpperCase();
            const nuevoP = numPrecioS(p.ajuste_precios[code]);
            if (!(nuevoP > 0)) return;
            const antesP = precioUnitarioS(f, String(ped.tipo_pago_real || ped.tipo_pago || "") || tipoPagoDeS(ped.pago));
            f.precio = nuevoP; f.desc_pronto = 0; f.desc_efectivo_credito = 0; f.desc_efectivo_pronto = 0;
            if (antesP !== nuevoP) cambiosPr.push(`${code}: ${antesP} → ${nuevoP} $`);
          });
          cambios.push({ tabla: "PedidoItems", modo: "reemplazar_pedido", pedido_id: ped.id, filas: filasIt });
          ped.nivel_precio = "personalizado";
          const tipoBase = String(ped.tipo_pago || "") || tipoPagoDeS(ped.pago);
          ped.total = String(totalPorPagoS(filasIt, tipoBase));
          ped.ajuste_estado = gestion ? "aprobado" : "propuesto";
          ped.ajuste_motivo = motAjuste;
          ped.ajuste_por = ses.nombre;
          ped.ajuste_at = t;
          ajusteTxt = `Ajuste de precio (${cambiosPr.join(", ") || `nuevo total ${ped.total} $`} · motivo: ${motAjuste}) · `;
        }
      }

      const monto = montoValidoS(p.monto);
      const moneda = MONEDAS_S.includes(String(p.moneda)) ? String(p.moneda) : "";
      const fechaPago = fechaIsoS(p.fecha_pago) || hoyCaracasS();
      const referencia = txtS(p.referencia, 60);
      const real = pagoPorIdS(String(p.tipo_pago_real || ""));
      const ponerReal = () => {
        const tipo = real ? real.id : (String(ped.tipo_pago_real || "") || String(ped.tipo_pago || "") || tipoPagoDeS(ped.pago));
        const its = pedidoConItemsS(ped, filasIt).items;
        const antes = String(ped.tipo_pago_real || ped.tipo_pago || tipoPagoDeS(ped.pago));
        ped.tipo_pago_real = tipo;
        ped.total_final = its.some((it) => it.precio) ? String(totalPorPagoS(its, tipo)) : "";
        return tipo !== antes ? `Pagó como ${pagoPorIdS(tipo).nombre}${ped.total_final !== "" ? ` (total ${ped.total_final} $)` : ""} · ` : "";
      };

      const resolverMontoUsd = async (mVal, monVal, fPago) => {
        if (monVal !== "Bs") return { usd: mVal, tasa: 0 };
        const tManual = numTasaS(p.tasa);
        const tObj = await obtenerTasaBcvS(supa, db.Tasas || [], fPago);
        const tasa = (tObj && tObj.tasa) || tManual;
        if (!tasa) fail(`No se encontró la tasa BCV para el ${fPago}. Indicala manualmente.`, "tasa");
        return { usd: r2S(mVal / tasa), tasa };
      };

      if (accion === "cancelar") {
        if (cobro === "conciliado" || cobro === "cancelado") fail(`Ese pedido ya figura como ${cobro === "conciliado" ? "conciliado" : "cancelado"}.`, "repetido");
        if (!monto || !moneda) fail("Indicá cuánto cobraste y en qué moneda.", "monto");
        const cambioModo = ponerReal();
        const conv = await resolverMontoUsd(monto, moneda, fechaPago);
        const nuevoPago = {
          id: "PAG-" + uuidS().replace(/-/g, "").slice(0, 8).toUpperCase(),
          pedido_id: ped.id, fecha_pago: fechaPago, created_at: t,
          registrado_por: ses.nombre, registrado_por_id: ses.id,
          moneda, monto, tasa: conv.tasa || 0, monto_usd: conv.usd,
          referencia, tipo_pago_real: String(ped.tipo_pago_real || ""),
          estado: "reportado", conciliado_at: "", conciliado_por: "", motivo: "",
          canal_cobro: canalValidoS(p.canal_cobro) ? String(p.canal_cobro) : "",
        };
        cambios.push({ tabla: "Pagos", fila: nuevoPago });
        todosPagos.push(nuevoPago);
        visitaDeCobroS(ped, nuevoPago);
        recalcularCobroS(ped, todosPagos);
        const totalReq = totalCobrarS(ped);
        const completo = totalReq <= 0 || (ped.pagado_usd + toleranciaCobroS(totalReq) >= totalReq);
        ped.cobrado_at = t; ped.cobrado_por = ses.nombre;
        ped.monto = String(monto); ped.moneda = moneda;
        if (completo) { ped.cobro = "cancelado"; ped.saldo = "0"; }
        else ped.cobro = "";
        const txtMon = `${monto} ${moneda}${moneda === "Bs" ? ` (fecha ${fechaPago} · BCV ${conv.tasa} = ${conv.usd} $)` : ""}${referencia ? ` · ref ${referencia}` : ""}`;
        detalle = ajusteTxt + cambioModo + (completo ? "Canceló completo: " : "Abono: ") + txtMon + (!completo ? ` · resta ${ped.saldo} $` : "");
      } else if (!gestion) {
        fail("Solo Administración verifica y concilia los pagos.", "forbidden");
      } else if (accion === "conciliar") {
        if (cobro === "conciliado") fail("Ese pago ya está conciliado.", "repetido");
        const cambio = (real || !cobro) ? ponerReal() : "";
        const pends = todosPagos.filter((x) => String(x.pedido_id) === String(ped.id) && String(x.estado) === "reportado");
        if (pends.length && !p.nuevo_abono) {
          if (monto && moneda && pends.length === 1) {
            const u = pends[0];
            const convC = await resolverMontoUsd(monto, moneda, fechaIsoS(p.fecha_pago) || fechaIsoS(u.fecha_pago) || hoyCaracasS());
            u.monto = monto; u.moneda = moneda; u.tasa = convC.tasa || 0; u.monto_usd = convC.usd;
            if (p.fecha_pago) u.fecha_pago = fechaIsoS(p.fecha_pago);
            if (referencia) u.referencia = referencia;
            ped.monto = String(monto); ped.moneda = moneda;
          }
          pends.forEach((u) => {
            u.estado = "conciliado"; u.conciliado_at = t; u.conciliado_por = ses.nombre;
            cambios.push({ tabla: "Pagos", fila: u });
          });
        } else {
          if (monto && moneda) { ped.monto = String(monto); ped.moneda = moneda; }
          if (!montoValidoS(ped.monto) || !MONEDAS_S.includes(String(ped.moneda))) fail("Indicá el monto recibido y la moneda.", "monto");
          const convD = await resolverMontoUsd(Number(ped.monto), String(ped.moneda), fechaPago);
          const pagoDir = {
            id: "PAG-" + uuidS().replace(/-/g, "").slice(0, 8).toUpperCase(),
            pedido_id: ped.id, fecha_pago: fechaPago, created_at: t,
            registrado_por: ped.cobrado_por || ses.nombre, registrado_por_id: ses.id,
            moneda: String(ped.moneda), monto: Number(ped.monto), tasa: convD.tasa || 0, monto_usd: convD.usd,
            referencia, tipo_pago_real: String(ped.tipo_pago_real || ""),
            estado: "conciliado", conciliado_at: t, conciliado_por: ses.nombre, motivo: "",
            canal_cobro: canalValidoS(p.canal_cobro) ? String(p.canal_cobro) : "",
          };
          cambios.push({ tabla: "Pagos", fila: pagoDir });
          todosPagos.push(pagoDir);
          visitaDeCobroS(ped, pagoDir);
          if (!cobro) { ped.cobrado_at = t; ped.cobrado_por = ses.nombre; }
        }
        if (String(ped.ajuste_estado) === "propuesto") ped.ajuste_estado = "aprobado";
        recalcularCobroS(ped, todosPagos);
        const totalReqC = totalCobrarS(ped);
        const completoC = totalReqC <= 0 || (ped.pagado_usd + toleranciaCobroS(totalReqC) >= totalReqC);
        if (completoC && ped.pagos_pend === 0) {
          ped.cobro = "conciliado"; ped.conciliado_at = t; ped.conciliado_por = ses.nombre; ped.saldo = "0";
          detalle = `${ajusteTxt}${cambio}Conciliado total: ${ped.pagado_usd} $`;
        } else {
          ped.cobro = "";
          detalle = `${ajusteTxt}${cambio}Abono conciliado (pagado ${ped.pagado_usd} $ · resta ${ped.saldo} $)`;
        }
      } else if (accion === "rechazar") {
        const pendsR = todosPagos.filter((x) => String(x.pedido_id) === String(ped.id) && String(x.estado) === "reportado");
        if (cobro !== "cancelado" && !pendsR.length) fail("Solo se rechaza un pago o abono reportado.", "estado");
        detalle = txtS(p.motivo, 200);
        if (!detalle) fail("Indicá por qué no se recibió el pago.", "motivo");
        pendsR.forEach((u) => {
          u.estado = "rechazado"; u.motivo = detalle; u.conciliado_at = t; u.conciliado_por = ses.nombre;
          cambios.push({ tabla: "Pagos", fila: u });
        });
        recalcularCobroS(ped, todosPagos);
        ped.cobro = "";
        if (!ped.pagado_usd) { ped.cobrado_at = ""; ped.cobrado_por = ""; ped.monto = ""; ped.moneda = ""; ped.tipo_pago_real = ""; ped.total_final = ""; }
      } else if (accion === "desconciliar") {
        if (cobro !== "conciliado") fail("Ese pago no está conciliado.", "estado");
        todosPagos.filter((x) => String(x.pedido_id) === String(ped.id) && String(x.estado) === "conciliado").forEach((u) => {
          u.estado = "reportado"; u.conciliado_at = ""; u.conciliado_por = "";
          cambios.push({ tabla: "Pagos", fila: u });
        });
        recalcularCobroS(ped, todosPagos);
        ped.cobro = "cancelado"; ped.conciliado_at = ""; ped.conciliado_por = "";
      } else {
        fail("Acción de cobro inválida.", "accion");
      }
      ped.updated_at = t;
      cambios.push({ tabla: "Pedidos", fila: ped });
      addHist(ped.id, { cancelar: ped.cobro === "cancelado" ? "cobrado" : "abono", conciliar: ped.cobro === "conciliado" ? "conciliado" : "abono_conciliado", rechazar: "pago_rechazado", desconciliar: "conciliacion_deshecha" }[accion], detalle);
      await guardarCambios();
      return { ok: true, pedido: pedidoConItemsS(ped, todosItems, todosPagos), es_abono: accion === "cancelar" ? ped.cobro !== "cancelado" : (accion === "conciliar" ? ped.cobro !== "conciliado" : false) };
    }

    // --- comisiones / guardarComisionConfig / pagarComision ---
    const configComisionesLocal = () => {
      let defPct = 3;
      (db.Config || []).forEach((x) => {
        if (String(x.clave || "").trim() === "comision_pct_default" && numPrecioS(x.valor) > 0) defPct = numPrecioS(x.valor);
      });
      const porVendedor = {};
      const vendedores = [];
      (db.Usuarios || []).forEach((u) => {
        if (!activoS(u)) return;
        const rs = rolesDeS(u.rol);
        if (!tieneAlgunoS({ roles: rs }, TOMAN_S)) return;
        const pct = numPrecioS(u.comision_pct) > 0 ? numPrecioS(u.comision_pct) : defPct;
        porVendedor[String(u.id)] = pct;
        porVendedor[String(u.nombre || "").trim().toLowerCase()] = pct;
        vendedores.push({ id: String(u.id), usuario: String(u.usuario), nombre: String(u.nombre), telefono: String(u.telefono || ""), comision_pct: pct });
      });
      return { porcentaje_default: defPct, por_vendedor: porVendedor, vendedores };
    };

    if (action === "comisiones") return { ok: true, config: configComisionesLocal() };

    if (action === "guardarComisionConfig") {
      let defPct = numPrecioS(p.porcentaje_default);
      if (!(defPct > 0 && defPct <= 100)) defPct = 3;
      cambios.push({ tabla: "Config", fila: { clave: "comision_pct_default", valor: String(defPct), nota: "Porcentaje de comisión por defecto para vendedores (%)" } });
      const exCfg = (db.Config || []).find((x) => String(x.clave).trim() === "comision_pct_default");
      if (exCfg) exCfg.valor = String(defPct); else (db.Config = db.Config || []).push({ clave: "comision_pct_default", valor: String(defPct) });
      const mapa = (p.porcentajes && typeof p.porcentajes === "object") ? p.porcentajes : {};
      (db.Usuarios || []).forEach((u) => {
        const k = String(u.id);
        if (mapa[k] !== undefined) {
          const v = numPrecioS(mapa[k]);
          u.comision_pct = (v > 0 && v <= 100) ? v : defPct;
          cambios.push({ tabla: "Usuarios", fila: u });
        }
      });
      await guardarCambios();
      return { ok: true, config: configComisionesLocal() };
    }

    if (action === "pagarComision") {
      const modo = String(p.modo || "pagar");
      const listaReq = Array.isArray(p.items) ? p.items : [];
      if (!listaReq.length) fail("Elegí al menos un pago conciliado para liquidar su comisión.", "empty");
      const mapPed = {};
      (db.Pedidos || []).forEach((x) => { mapPed[String(x.id)] = x; });
      const todosPagos = db.Pagos || [];
      const cfg = configComisionesLocal();
      const t = ahoraS();

      if (modo === "deshacer") {
        let deshechos = 0;
        listaReq.forEach((it) => {
          const pg = todosPagos.find((x) => String(x.id) === String(it.pago_id));
          if (!pg || String(pg.comision_estado) !== "pagada") return;
          pg.comision_estado = ""; pg.comision_monto = 0; pg.comision_tasa = 0; pg.comision_fecha = ""; pg.comision_ref = ""; pg.comision_pagada_at = ""; pg.comision_pagada_por = "";
          cambios.push({ tabla: "Pagos", fila: pg });
          deshechos++;
          if (pg.pedido_id) addHist(String(pg.pedido_id), "comision_deshecha", `Se revirtió el pago de comisión (${pg.id})`);
        });
        await guardarCambios();
        return { ok: true, deshechos };
      }

      const fechaCom = fechaIsoS(p.fecha_comision) || hoyCaracasS();
      const tasaManual = numTasaS(p.tasa);
      const ref = txtS(p.referencia, 80);
      let tasaObj = null;
      const obtenerTasaCom = async () => {
        if (tasaManual > 0) return tasaManual;
        if (!tasaObj) tasaObj = await obtenerTasaBcvS(supa, db.Tasas || [], fechaCom);
        return (tasaObj && tasaObj.tasa) || 0;
      };

      let pagados = 0;
      for (const it of listaReq) {
        const pedId = String(it.pedido_id || "");
        const pagoId = String(it.pago_id || "");
        const ped = mapPed[pedId];
        if (!ped) continue;
        let pg = todosPagos.find((x) => String(x.id) === pagoId);
        if (!pg && pagoId === "PED-" + ped.id && String(ped.cobro) === "conciliado") {
          const totUsd = totalCobrarS(ped) || (String(ped.moneda) === "Bs" ? 0 : Number(ped.monto) || 0);
          pg = {
            id: "PAG-" + uuidS().replace(/-/g, "").slice(0, 8).toUpperCase(),
            pedido_id: ped.id,
            fecha_pago: fechaIsoS(ped.cobrado_at || ped.conciliado_at || ped.entregado_at || ped.fecha) || fechaCom,
            created_at: String(ped.cobrado_at || ped.conciliado_at || t),
            registrado_por: String(ped.cobrado_por || ped.vendedor || ""),
            registrado_por_id: String(ped.vendedor_id || ""),
            moneda: String(ped.moneda || "USD"),
            monto: Number(ped.monto) || 0,
            tasa: String(ped.moneda) === "Bs" && totUsd > 0 ? r2S((Number(ped.monto) || 0) / totUsd) : 0,
            monto_usd: totUsd,
            referencia: "",
            tipo_pago_real: String(ped.tipo_pago_real || ped.tipo_pago || ""),
            estado: "conciliado",
            conciliado_at: String(ped.conciliado_at || t),
            conciliado_por: String(ped.conciliado_por || ses.nombre),
            motivo: "",
          };
          todosPagos.push(pg);
        }
        if (!pg || String(pg.estado) !== "conciliado") continue;
        const pct = numPrecioS(it.pct) > 0 ? numPrecioS(it.pct) : (cfg.por_vendedor[String(ped.vendedor_id)] || cfg.por_vendedor[String(ped.vendedor || "").trim().toLowerCase()] || cfg.porcentaje_default || 3);
        const baseUsd = Number(pg.monto_usd) || (String(pg.moneda) !== "Bs" ? Number(pg.monto) || 0 : 0);
        const comUsd = r2S(baseUsd * pct / 100);
        const esBs = String(pg.moneda) === "Bs";
        const comMon = esBs ? "Bs" : "USD";
        let comTasa = 0;
        let comMonto = comUsd;
        if (esBs) {
          const fOrig = fechaIsoS(pg.fecha_pago);
          if (fOrig && fOrig === fechaCom && Number(pg.tasa) > 0 && !tasaManual) {
            comTasa = Number(pg.tasa);
            comMonto = r2S((Number(pg.monto) || 0) * pct / 100);
          } else {
            comTasa = (await obtenerTasaCom()) || Number(pg.tasa) || 0;
            if (!comTasa) fail(`No se encontró la tasa BCV para el día de pago de comisión (${fechaCom}).`, "tasa");
            comMonto = r2S(comUsd * comTasa);
          }
        }
        pg.comision_estado = "pagada";
        pg.comision_pct = pct;
        pg.comision_usd = comUsd;
        pg.comision_moneda = comMon;
        pg.comision_monto = comMonto;
        pg.comision_tasa = comTasa || 0;
        pg.comision_fecha = fechaCom;
        pg.comision_ref = ref;
        pg.comision_pagada_at = t;
        pg.comision_pagada_por = ses.nombre;
        cambios.push({ tabla: "Pagos", fila: pg });
        pagados++;
        addHist(ped.id, "comision_pagada", `Comisión ${pct}% (${ped.vendedor}): ${comMonto} ${comMon}${esBs ? ` (fecha ${fechaCom} · BCV ${comTasa} = ${comUsd} $)` : ""}${ref ? ` · ref ${ref}` : ""}`);
      }
      await guardarCambios();
      return { ok: true, pagados };
    }

    // --- estado ---
    if (action === "estado") {
      const nuevo = String(p.estado || "");
      if (!ESTADOS_S.includes(nuevo)) fail("Estado inválido.", "estado");
      const motivo = txtS(p.motivo, 200);
      if (nuevo === "cancelado" && !motivo) fail("Indicá el motivo de la anulación.", "motivo");
      const ped = (db.Pedidos || []).find((x) => String(x.id) === String(p.pedido_id));
      if (!ped) fail("Pedido no encontrado.", "not_found");
      if (!puedeVerS(ses, ped)) fail("No tenés acceso a este pedido.", "forbidden");

      const reasignar = esGestionS(ses) && p.despachador_id && nuevo === String(ped.estado);
      if (!reasignar) {
        if (String(ped.estado) === nuevo) fail("El pedido ya está en ese estado.", "forbidden");
        const roles = ses.roles || rolesDeS(ses.rol);
        const reglaRol = (r) => {
          const actual = String(ped.estado);
          if (GESTION_S.includes(r)) {
            if (nuevo === "confirmado" && actual !== "pendiente" && actual !== "en_ruta") return "Solo se aprueba un pedido en proceso.";
            return "";
          }
          if (r === "vendedor") {
            if (String(ped.vendedor_id) !== String(ses.id)) return "Este pedido es de otro vendedor.";
            if (nuevo === "cancelado" && actual === "pendiente") return "";
            return "Como vendedor solo podés anular tus pedidos en proceso.";
          }
          if (r === "despachador") {
            if (String(ped.despachador_id) !== String(ses.id)) return "Este pedido no está asignado a vos.";
            if (nuevo === "en_ruta" && actual === "confirmado") return "";
            if (nuevo === "entregado" && (actual === "confirmado" || actual === "en_ruta")) return "";
            return "Como despachador solo podés marcar en ruta o entregado.";
          }
          return "Sin permiso.";
        };
        let rechazo = "Sin permiso.";
        for (let i = 0; i < roles.length; i++) {
          const m = reglaRol(roles[i]);
          if (!m) { rechazo = ""; break; }
          if (i === 0) rechazo = m;
        }
        if (rechazo) fail(rechazo, "forbidden");
      }

      const t = ahoraS();
      let detalle = "";
      let fechaEntrega = "";
      if (nuevo === "entregado" && p.fecha_entrega) {
        const fe = String(p.fecha_entrega).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!fe) fail("Fecha de entrega inválida.", "fecha");
        const hoyTxt = hoyCaracasS();
        const pedTxt = String(ped.created_at || "").slice(0, 10);
        const dia = fe[0];
        if (dia > hoyTxt) fail("La fecha de entrega no puede ser futura.", "fecha");
        if (pedTxt && dia < pedTxt) fail("La fecha de entrega no puede ser anterior al pedido.", "fecha");
        fechaEntrega = dia === hoyTxt ? "" : new Date(dia + "T16:00:00Z").toISOString();
      }
      if (nuevo === "confirmado" && !reasignar && String(ped.estado) === "pendiente") {
        const mios = (db.PedidoItems || []).filter((it) => String(it.pedido_id) === String(ped.id)).map((it) => ({ code: String(it.code), producto: String(it.producto), cajas: Number(it.cajas) }));
        const falta = faltaStockS(mios, existenciasS(db.Inventario, db.Pedidos, db.PedidoItems));
        if (falta) fail(falta, "stock");
      }
      const aprobar = nuevo === "confirmado" && !reasignar && String(ped.estado) === "pendiente";
      if (reasignar || (nuevo === "confirmado" && p.despachador_id)) {
        const dId = txtS(p.despachador_id || ped.despachador_id, 40);
        const d = (db.Usuarios || []).find((u) => String(u.id) === dId && rolesDeS(u.rol).includes("despachador") && activoS(u));
        if (!d) fail("Elegí un despachador activo.", "despachador");
        ped.despachador_id = String(d.id);
        ped.despachador = String(d.nombre);
        detalle = "Despachador: " + d.nombre;
      }
      if (aprobar) {
        ped.confirmado_por = ses.nombre; ped.confirmado_at = t;
        ped.factura = txtS(p.factura, 40);
        detalle = [ped.factura ? "Factura " + ped.factura : "Facturado", detalle].filter(Boolean).join(" · ");
      }
      let parcial = false;
      if (nuevo === "entregado") {
        const difs = Array.isArray(p.diferencias) ? p.diferencias : [];
        const motivoEnt = txtS(p.motivo_entrega, 200);
        const filas = (db.PedidoItems || []).filter((it) => String(it.pedido_id) === String(ped.id));
        const porCode = {};
        for (const df of difs) {
          const code = txtS(df && df.code, 20).toUpperCase();
          const n = Math.round(Number(df && df.entregadas));
          const destino = df && df.destino === "devuelve" ? "devuelve" : "despues";
          if (!filas.some((f) => String(f.code).toUpperCase() === code)) fail(`El producto ${code} no está en el pedido.`, "diferencias");
          if (!isFinite(n) || n < 0) fail(`Revisá las cajas entregadas de ${code}.`, "diferencias");
          porCode[code] = { n, destino };
        }
        if (difs.length && !motivoEnt) fail("Indicá qué pasó (motivo de la diferencia).", "diferencias");
        let quedan = 0, devueltas = 0, entregadasHoy = 0;
        const partes = [];
        const totalAntes = Number(ped.total) || 0;
        filas.forEach((f) => {
          const cajas = Number(f.cajas) || 0, ya = Number(f.entregadas) || 0;
          const falta = Math.max(0, cajas - ya);
          const d = porCode[String(f.code).toUpperCase()];
          const hoy = d ? Math.min(d.n, falta) : falta;
          const resto = falta - hoy;
          f.entregadas = ya + hoy;
          entregadasHoy += hoy;
          if (resto && d && d.destino === "devuelve") {
            f.devueltas = (Number(f.devueltas) || 0) + resto;
            f.cajas = cajas - resto;
            f.total_unidades = f.unidades_caja === "" ? f.total_unidades : String(f.cajas * (Number(f.unidades_caja) || 0));
            devueltas += resto;
            partes.push(`${resto} de ${f.producto} vuelve(n) al depósito`);
          } else if (resto) {
            quedan += resto;
            partes.push(`${resto} de ${f.producto} se entrega(n) después`);
          }
        });
        cambios.push({ tabla: "PedidoItems", modo: "reemplazar_pedido", pedido_id: ped.id, filas });
        if (devueltas) {
          ped.total_cajas = filas.reduce((a, it) => a + (Number(it.cajas) || 0), 0);
          ped.detalle_unidades = detalleUnidadesS(filas);
          const tipo = String(ped.tipo_pago || "") || tipoPagoDeS(ped.pago);
          if (ped.total !== "" && ped.total !== undefined) {
            ped.total = String(totalPorPagoS(filas, tipo));
            ped.nota_credito = String(r2S((Number(ped.nota_credito) || 0) + Math.max(0, totalAntes - Number(ped.total))));
          }
        }
        parcial = quedan > 0;
        if (difs.length) detalle = `Entregó ${entregadasHoy} caja(s) · ${partes.join(" · ")} · ${motivoEnt}${devueltas && ped.nota_credito ? ` · nota de crédito ${ped.nota_credito} $` : ""}`;
      }
      if (!reasignar) {
        ped.estado = nuevo; ped.estado_at = t; ped.estado_por = ses.nombre; ped.motivo = nuevo === "cancelado" ? motivo : "";
        if (nuevo === "entregado" && parcial) ped.estado = "confirmado";
        else if (nuevo === "entregado") {
          ped.entregado_por = ses.nombre;
          ped.entregado_at = fechaEntrega || t;
        }
        if (nuevo === "pendiente") { ped.despachador_id = ""; ped.despachador = ""; ped.confirmado_por = ""; ped.confirmado_at = ""; }
        if (nuevo === "cancelado") detalle = motivo;
      }
      ped.updated_at = t;
      cambios.push({ tabla: "Pedidos", fila: ped });
      addHist(ped.id, reasignar ? "reasignado" : parcial ? "entrega_parcial" : nuevo, detalle);
      await guardarCambios();
      return { ok: true, pedido: pedidoConItemsS(ped, db.PedidoItems) };
    }

    // --- editarPedido ---
    if (action === "editarPedido") {
      const items = limpiarItemsS(p.items);
      if (!items.length) fail("El pedido no tiene productos.", "empty");
      const vistos = {};
      for (const it of items) {
        if (vistos[it.code]) fail(`${it.code} está repetido.`, "items");
        vistos[it.code] = true;
      }
      const documento = txtS(p.documento, 30);
      if (!DOCUMENTOS_S.includes(documento)) fail("Indicá nota de entrega o factura.", "documento");
      const tipoPago = String(p.tipo_pago || "");
      const pagoDef = pagoPorIdS(tipoPago);
      if (!pagoDef) fail("Elegí la forma de pago.", "pago");
      let diasCredito = 0;
      if (pagoDef.credito) {
        diasCredito = Math.floor(Number(p.dias_credito));
        if (!isFinite(diasCredito) || diasCredito < 1 || diasCredito > MAX_DIAS_CREDITO_S) fail(`Indicá los días de crédito (1 a ${MAX_DIAS_CREDITO_S}).`, "credito");
      }
      const pedidos = db.Pedidos || [];
      const ped = pedidos.find((x) => String(x.id) === String(p.pedido_id) && !borradoS(x));
      if (!ped) fail("Pedido no encontrado.", "not_found");
      const estado = String(ped.estado);
      if (estado === "entregado") fail("Ya está en cuentas por cobrar: no se puede editar.", "estado");
      if (estado === "cancelado") fail("El pedido está anulado.", "estado");
      const pItems = db.PedidoItems || [];
      const filas = pItems.filter((it) => String(it.pedido_id) === String(ped.id));
      if (documento === "Factura") {
        const cli = (db.Clientes || []).find((x) => String(x.id) === String(ped.cliente_id));
        if (!cli || soloDigitosS(cli.rif_cedula).length < 6) fail("Para factura hace falta el RIF o la cédula del cliente (editalo en Clientes).", "rif");
      }
      if (estado === "pendiente" || estado === "confirmado") {
        const otros = pItems.filter((it) => String(it.pedido_id) !== String(ped.id));
        const sinStock = faltaStockS(items, existenciasS(db.Inventario, pedidos, otros));
        if (sinStock) fail(sinStock, "stock");
      }
      const totalCajas = items.reduce((a, it) => a + it.cajas, 0);
      const personalizado = items.some((it) => Number(it.precio_manual) > 0);
      const excepcion = p.precio_mayor === true && totalCajas < CAJAS_MAYOR_S;
      const mayor = totalCajas >= CAJAS_MAYOR_S || excepcion;
      const tabla = tablaPreciosS(db.Precios);
      ponerPreciosS(items, tabla, mayor);
      const nombreProd = (code) => (tabla[code] && tabla[code].producto) || (PRODUCTOS_BASE_S.find((b) => b[0] === code) || [])[1] || code;
      if (!personalizado && mayor === (String(ped.nivel_precio) === "mayor")) {
        const previo = {};
        filas.forEach((f) => { previo[String(f.code).toUpperCase()] = f; });
        items.forEach((it) => {
          const f = previo[it.code];
          if (f && Number(f.precio) > 0) {
            it.precio = Number(f.precio); it.desc_pronto = Number(f.desc_pronto) || 0;
            it.desc_efectivo_credito = Number(f.desc_efectivo_credito) || 0; it.desc_efectivo_pronto = Number(f.desc_efectivo_pronto) || 0;
          }
          if (!it.producto) it.producto = f ? String(f.producto) : nombreProd(it.code);
        });
      } else items.forEach((it) => { if (!it.producto) it.producto = nombreProd(it.code); });

      const antes = { cajas: Number(ped.total_cajas) || 0, total: ped.total, pago: String(ped.pago), doc: String(ped.documento), factura: String(ped.factura || "") };
      const t = ahoraS();
      ped.total_cajas = totalCajas; ped.detalle_unidades = detalleUnidadesS(items);
      ped.tipo_pago = tipoPago; ped.pago = pagoDef.nombre; ped.dias_credito = diasCredito;
      ped.documento = documento; ped.nota = txtS(p.nota, 300);
      ped.nivel_precio = personalizado ? "personalizado" : (mayor ? "mayor" : "menor"); ped.excepcion_precio = excepcion;
      ped.total = items.some((it) => it.precio) ? String(totalPorPagoS(items, tipoPago)) : "";
      if (estado !== "pendiente" && p.factura !== undefined) ped.factura = txtS(p.factura, 40);
      ped.updated_at = t;
      cambios.push({ tabla: "Pedidos", fila: ped });

      const previoFila = {};
      filas.forEach((f) => { previoFila[String(f.code).toUpperCase()] = f; });
      const nuevasFilas = items.map((it) => {
        const pf = previoFila[it.code];
        return {
          ...it, pedido_id: ped.id,
          entregadas: Math.min(it.cajas, pf ? Number(pf.entregadas) || 0 : 0),
          devueltas: pf ? Number(pf.devueltas) || 0 : 0,
        };
      });
      cambios.push({ tabla: "PedidoItems", modo: "reemplazar_pedido", pedido_id: ped.id, filas: nuevasFilas });
      const chg = [];
      if (antes.cajas !== totalCajas) chg.push(`cajas ${antes.cajas} → ${totalCajas}`);
      if (String(antes.total) !== String(ped.total)) chg.push(`total ${antes.total === "" ? "—" : antes.total + " $"} → ${ped.total === "" ? "—" : ped.total + " $"}`);
      if (antes.pago !== ped.pago) chg.push(`pago ${antes.pago} → ${ped.pago}`);
      if (antes.doc !== documento) chg.push(`${antes.doc} → ${documento}`);
      if (antes.factura !== String(ped.factura || "")) chg.push(`factura ${ped.factura || "(sin número)"}`);
      addHist(ped.id, "editado", chg.join(" · ") || "productos o nota");
      await guardarCambios();
      return { ok: true, pedido: pedidoConItemsS(ped, nuevasFilas), facturado: estado !== "pendiente" };
    }

    // --- borrarPedido ---
    if (action === "borrarPedido") {
      const motivo = txtS(p.motivo, 200);
      if (!motivo) fail("Indicá por qué se borra.", "motivo");
      const ped = (db.Pedidos || []).find((x) => String(x.id) === String(p.pedido_id));
      if (!ped || !puedeVerS(ses, ped)) fail("Pedido no encontrado.", "not_found");
      const propio = tieneS(ses, "vendedor") && String(ped.vendedor_id) === String(ses.id);
      if (!propio && !tieneS(ses, "master")) fail("Solo el vendedor del pedido o el Master pueden borrarlo.", "forbidden");
      const t = ahoraS();
      ped.borrado = true; ped.borrado_motivo = motivo; ped.borrado_por = ses.nombre; ped.borrado_at = t; ped.updated_at = t;
      cambios.push({ tabla: "Pedidos", fila: ped });
      addHist(ped.id, "borrado", motivo);
      await guardarCambios();
      return { ok: true };
    }

    // --- inventario / movimiento / cargarInventario / guardarPrecio / guardarProducto ---
    if (action === "inventario") {
      const precios = tablaPreciosS(db.Precios);
      const stock = existenciasS(db.Inventario, db.Pedidos, db.PedidoItems);
      const movs = (db.Inventario || []).map((m) => ({ fecha: String(m.fecha), code: String(m.code), producto: String(m.producto), cajas: Number(m.cajas) || 0, tipo: String(m.tipo), nota: String(m.nota || ""), usuario: String(m.usuario || "") }))
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
      const codes = {};
      PRODUCTOS_BASE_S.forEach((b) => { codes[b[0]] = b[1]; });
      Object.keys(precios).forEach((k) => { codes[k] = codes[k] || precios[k].producto; });
      Object.keys(stock).forEach((k) => { codes[k] = codes[k] || k; });
      return {
        ok: true,
        productos: Object.keys(codes).sort().map((code) => {
          const sSt = stock[code] || { cargado: 0, aprobado: 0, salido: 0, en_proceso: 0, disponible: 0, fisico: 0, controlado: false };
          const pr = precios[code] || {};
          return {
            code, producto: (precios[code] && precios[code].producto) || codes[code],
            cargado: sSt.cargado, aprobado: sSt.aprobado, en_proceso: sSt.en_proceso, disponible: sSt.disponible,
            fisico: sSt.fisico, por_salir: sSt.aprobado - sSt.salido, controlado: sSt.controlado,
            menor: pr.menor || 0, mayor: pr.mayor || 0, pronto: pr.pronto || 0, efectivo_credito: pr.efectivo_credito || 0, efectivo_pronto: pr.efectivo_pronto || 0,
            mayor_pronto: pr.mayor_pronto || 0, mayor_efectivo_credito: pr.mayor_efectivo_credito || 0, mayor_efectivo_pronto: pr.mayor_efectivo_pronto || 0,
            nuevo: !esBaseS(code), info: !esBaseS(code) && pr.tipo ? infoProductoS(pr) : null,
          };
        }),
        movimientos: movs.slice(0, Math.min(Math.max(Number(p.limite) || 50, 1), 500)),
      };
    }

    const asegurarPrecioEnDb = (code, precios, filasPreciosSet, fecha) => {
      if (filasPreciosSet.has(code)) return;
      const bm = PRODUCTOS_BASE_S.find((b) => b[0] === code) || null;
      const loc = (typeof allProductsMap === "function" ? allProductsMap()[code] : null) || null;
      const pr = precios[code] || {};
      const menor = pr.menor || (bm && numPrecioS(bm[2])) || (loc && numPrecioS(loc.precioMenor)) || 0;
      if (!menor) return;
      const mayor = pr.mayor || (bm && numPrecioS(bm[3])) || (loc && numPrecioS(loc.precioMayor)) || menor;
      const filaPrecio = {
        code,
        producto: pr.producto || (bm && bm[1]) || (loc && loc.name) || code,
        menor,
        mayor,
        pronto: pr.pronto || r2S(menor * 0.97),
        efectivo_credito: pr.efectivo_credito || r2S(menor * 0.96),
        efectivo_pronto: pr.efectivo_pronto || r2S(menor * 0.94),
        mayor_pronto: pr.mayor_pronto || r2S(mayor * 0.97),
        mayor_efectivo_credito: pr.mayor_efectivo_credito || r2S(mayor * 0.96),
        mayor_efectivo_pronto: pr.mayor_efectivo_pronto || r2S(mayor * 0.94),
        tipo: code.startsWith("KT-") ? "kits" : "banos",
        linea: pr.linea || (bm && bm[5]) || (loc && loc.line) || "",
        beneficio: pr.beneficio || (loc && loc.benefit) || "",
        cabello: pr.cabello || "1A–4C",
        unidades_caja: pr.unidades_caja || (bm && Number(bm[4])) || (loc && Number(loc.unidades)) || 6,
        imagen: pr.imagen || "",
        updated_at: fecha,
        updated_por: ses.nombre,
      };
      cambios.push({ tabla: "Precios", fila: filaPrecio });
      (db.Precios = db.Precios || []).push(filaPrecio);
      filasPreciosSet.add(code);
    };

    const ejecutarCargarInventario = async (argP) => {
      const tipo = argP.tipo === "conteo" ? "conteo" : "entrada";
      const items = Array.isArray(argP.items) ? argP.items : [];
      const nota = txtS(argP.nota, 200);
      if (!items.length) fail("Elegí al menos un producto.", "producto");
      if (items.length > 300) fail("Demasiados productos de una vez.", "cajas");
      const precios = tablaPreciosS(db.Precios);
      const filasPreciosSet = new Set((db.Precios || []).map((x) => normalizarCodigoS(x.code)).filter(Boolean));
      const infoLocal = (code) => (typeof allProductsMap === "function" ? allProductsMap()[code] : null) || null;
      const nombreProd = (code) => (precios[code] && precios[code].producto) || (PRODUCTOS_BASE_S.find((b) => b[0] === code) || [])[1] || (infoLocal(code) && infoLocal(code).name) || code;
      const vistos = {}, limpios = [];
      for (const item of items) {
        const code = normalizarCodigoS(txtS(item && item.code, 20));
        const cajas = Math.round(Number(item && item.cajas));
        if (!code) fail("Elegí el producto.", "producto");
        if (!esBaseS(code) && !precios[code]) fail("Producto desconocido: " + code, "producto");
        if (vistos[code]) fail(code + " está repetido.", "producto");
        vistos[code] = true;
        if (!isFinite(cajas) || cajas > 100000) fail("Revisá las cajas de " + code + ".", "cajas");
        if (tipo === "entrada" && cajas <= 0) fail(`Una entrada debe ser mayor que 0 (${code}).`, "cajas");
        if (tipo === "conteo" && cajas < 0) fail(`El conteo no puede ser negativo (${code}).`, "cajas");
        limpios.push({ code, cajas });
      }
      const antes = existenciasS(db.Inventario, db.Pedidos, db.PedidoItems);
      const fecha = ahoraS();
      const res = limpios.map((it) => {
        asegurarPrecioEnDb(it.code, precios, filasPreciosSet, fecha);
        const sSt = antes[it.code] || { fisico: 0, controlado: false };
        const mov = tipo === "entrada" ? it.cajas : it.cajas - sSt.fisico;
        const texto = tipo === "entrada" ? nota : `Conteo: ${it.cajas} cajas en depósito (sistema: ${sSt.controlado ? sSt.fisico : "sin cargar"})${nota ? ` · ${nota}` : ""}`;
        const nuevoMov = { fecha, code: it.code, producto: nombreProd(it.code), cajas: mov, tipo, nota: txtS(texto, 300), usuario: ses.nombre };
        cambios.push({ tabla: "Inventario", fila: nuevoMov });
        (db.Inventario = db.Inventario || []).push(nuevoMov);
        return { code: it.code, diferencia: mov };
      });
      await guardarCambios();
      const desp = existenciasS(db.Inventario, db.Pedidos, db.PedidoItems);
      res.forEach((r) => { const sSt = desp[r.code] || {}; r.disponible = sSt.disponible || 0; r.fisico = sSt.fisico || 0; });
      return { ok: true, guardados: res.length, productos: res };
    };

    if (action === "cargarInventario") return await ejecutarCargarInventario(p);

    if (action === "movimiento") {
      const precios = tablaPreciosS(db.Precios);
      const filasPreciosSet = new Set((db.Precios || []).map((x) => normalizarCodigoS(x.code)).filter(Boolean));
      const infoLocal = (code) => (typeof allProductsMap === "function" ? allProductsMap()[code] : null) || null;
      const nombreProd = (code, alt) => (precios[code] && precios[code].producto) || (PRODUCTOS_BASE_S.find((b) => b[0] === code) || [])[1] || (infoLocal(code) && infoLocal(code).name) || txtS(alt, 120) || code;
      if (p.tipo === "sobrante") {
        const code = normalizarCodigoS(txtS(p.code, 20));
        const cajas = Math.round(Number(p.cajas));
        if (!code) fail("Elegí el producto.", "producto");
        if (!isFinite(cajas) || cajas <= 0 || cajas > 10000) fail("Indicá cuántas cajas volvieron.", "cajas");
        const nota = `Volvieron ${cajas} caja(s) de más en el camión (no cambia el stock)${txtS(p.nota, 200) ? ` · ${txtS(p.nota, 200)}` : ""}`;
        cambios.push({ tabla: "Inventario", fila: { fecha: ahoraS(), code, producto: nombreProd(code, p.producto), cajas: 0, tipo: "sobrante", nota, usuario: ses.nombre } });
        await guardarCambios();
        return { ok: true };
      }
      const tipo = p.tipo === "ajuste" || p.tipo === "conteo" ? p.tipo : "entrada";
      if (tipo !== "ajuste") {
        const r = await ejecutarCargarInventario({ tipo, nota: p.nota, items: [{ code: p.code, cajas: p.cajas }] });
        return { ok: true, disponible: r.productos[0].disponible, fisico: r.productos[0].fisico, diferencia: r.productos[0].diferencia };
      }
      const code = normalizarCodigoS(txtS(p.code, 20));
      const cajas = Math.round(Number(p.cajas));
      const nota = txtS(p.nota, 200);
      if (!code) fail("Elegí el producto.", "producto");
      if (!isFinite(cajas) || cajas === 0 || Math.abs(cajas) > 100000) fail("Indicá la cantidad de cajas.", "cajas");
      if (!nota) fail("Indicá el motivo del ajuste.", "nota");
      const fecha = ahoraS();
      asegurarPrecioEnDb(code, precios, filasPreciosSet, fecha);
      const mov = { fecha, code, producto: nombreProd(code, p.producto), cajas, tipo: "ajuste", nota, usuario: ses.nombre };
      cambios.push({ tabla: "Inventario", fila: mov });
      (db.Inventario = db.Inventario || []).push(mov);
      await guardarCambios();
      const sSt = existenciasS(db.Inventario, db.Pedidos, db.PedidoItems)[code];
      return { ok: true, disponible: sSt ? sSt.disponible : cajas };
    }

    const preciosValidosS = (argP) => {
      const vals = {};
      for (const k of CAMPOS_PRECIO_S) {
        const v = argP[k];
        const n = v === "" || v === undefined || v === null ? 0 : Number(String(v).replace(",", "."));
        if (!isFinite(n) || n < 0 || n > 1e7) return { error: "Revisá los montos (números de 0 en adelante)." };
        vals[k] = r2S(n);
      }
      if (!vals.menor) return { error: "Falta el precio normal (al por menor)." };
      if (vals.mayor > vals.menor) return { error: "El precio al mayor no puede ser más alto que el normal." };
      const nombres = { pronto: "pronto pago", efectivo_credito: "efectivo a crédito", efectivo_pronto: "efectivo pronto pago" };
      for (const k in nombres) if (vals[k] > vals.menor) return { error: `El precio de ${nombres[k]} no puede ser más alto que el normal.` };
      const baseMay = vals.mayor || vals.menor;
      for (const k2 in nombres) if (vals["mayor_" + k2] > baseMay) return { error: `Al mayor, el precio de ${nombres[k2]} no puede ser más alto que el normal al mayor.` };
      return { vals };
    };

    if (action === "guardarPrecio") {
      const codes = (Array.isArray(p.codes) ? p.codes : [p.code]).map((c) => normalizarCodigoS(txtS(c, 20))).filter(Boolean);
      if (!codes.length) fail("Elegí el producto.", "producto");
      const v = preciosValidosS(p);
      if (v.error) fail(v.error, "precio");
      const tabla = tablaPreciosS(db.Precios);
      const base = {}; PRODUCTOS_BASE_S.forEach((b) => { base[b[0]] = b[1]; });
      const guardados = codes.map((code) => {
        const previa = tabla[code] ? tabla[code]._crudo : {};
        const fila = { ...previa, code, producto: (tabla[code] && tabla[code].producto) || base[code] || txtS(p.producto, 120) || code, ...v.vals, updated_at: ahoraS(), updated_por: ses.nombre };
        cambios.push({ tabla: "Precios", fila });
        return fila;
      });
      await guardarCambios();
      return { ok: true, precio: guardados[0], guardados: guardados.length };
    }

    if (action === "guardarProducto") {
      const tipo = p.tipo === "kits" ? "kits" : "banos";
      const nombre = txtS(p.nombre, 80);
      if (!nombre) fail("Falta el nombre del producto.", "producto");
      const unidades = Math.floor(Number(p.unidades_caja) || 6);
      if (unidades < 1 || unidades > 200) fail("Revisá las unidades por caja.", "producto");
      const imagen = txtS(p.imagen, 400);
      if (imagen && !/^https:\/\//.test(imagen)) fail("La imagen debe ser un enlace que empiece con https://", "producto");
      let v = null;
      if (p.menor !== undefined && p.menor !== "" && p.menor !== null) {
        v = preciosValidosS(p);
        if (v.error) fail(v.error, "precio");
      }
      const tabla = tablaPreciosS(db.Precios);
      let code = txtS(p.code, 20).toUpperCase().replace(/[^A-Z0-9-]/g, "");
      if (code && esBaseS(code)) fail("Ese código es de un producto de siempre: elegí otro.", "producto");
      const editar = !!(code && tabla[code] && p.editar);
      if (code && tabla[code] && !p.editar) fail("Ya existe un producto con el código " + code + ".", "producto");
      if (!code) {
        const pref = tipo === "kits" ? "KT-" : "BC-";
        let max = 0;
        PRODUCTOS_BASE_S.map((b) => b[0]).concat(Object.keys(tabla)).forEach((c) => {
          if (c.startsWith(pref)) max = Math.max(max, Number(c.slice(3)) || 0);
        });
        code = pref + String(max + 1).padStart(2, "0");
      }
      const previa = editar ? tabla[code]._crudo : {};
      const fila = {
        ...previa, code, producto: nombre, tipo, linea: txtS(p.linea, 40), beneficio: txtS(p.beneficio, 200),
        cabello: txtS(p.cabello, 20) || "1A–4C", unidades_caja: unidades, imagen,
        ...(v ? v.vals : {}), updated_at: ahoraS(), updated_por: ses.nombre,
      };
      cambios.push({ tabla: "Precios", fila });
      if (!editar) cambios.push({ tabla: "Inventario", fila: { fecha: ahoraS(), code, producto: nombre, cajas: 0, tipo: "alta", nota: "Producto nuevo", usuario: ses.nombre } });
      await guardarCambios();
      return { ok: true, producto: { code, info: infoProductoS(fila) } };
    }

    // --- sincronizar ---
    if (action === "sincronizar") {
      const toma = tieneAlgunoS(ses, TOMAN_S);
      const cat = await apiSupabase(supa, "catalogo", { token });
      const peds60 = (await apiSupabase(supa, "pedidos", { token, dias: 60 })).pedidos;
      const porCobrar = toma ? (await apiSupabase(supa, "pedidos", { token, por_cobrar: true })).pedidos : [];
      const vistos = {};
      const lista = [];
      peds60.concat(porCobrar).forEach((x) => { if (!vistos[x.id]) { vistos[x.id] = 1; lista.push(x); } });
      let clientes = [];
      if (toma) {
        clientes = (db.Clientes || []).filter((c) => !(String(c.deleted) === "1" || c.deleted === true))
          .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
          .slice(0, 3000).map(clientePublicoS);
      }
      const pedsWeb = toma ? (await apiSupabase(supa, "pedidosWeb", { token })).pedidos : [];
      const desps = esGestionS(ses) ? (await apiSupabase(supa, "despachadores", { token })).despachadores : [];
      const vends = (db.Usuarios || []).filter((u) => rolesDeS(u.rol).includes("vendedor") && activoS(u))
        .map((u) => ({
          id: String(u.id),
          usuario: String(u.usuario || ""),
          nombre: String(u.nombre),
          telefono: String(u.telefono || ""),
          whatsapp: telWhatsappS(u.telefono),
          catalogo: catalogoUsuarioS(u.catalogo),
          rutas: rutasUsuarioS(u.rutas),
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      return {
        ok: true, fecha: ahoraS(), usuario: ses,
        catalogo: { productos: cat.productos, pagos: cat.pagos, cajas_mayor: cat.cajas_mayor, actualizado: cat.actualizado },
        clientes, pedidos: lista, pedidos_web: pedsWeb, despachadores: desps, vendedores: vends, config: leerConfigLocal(),
        visitas: toma ? visitasDelPeriodoS(7, "", false) : [],
      };
    }

    // --- resumen ---
    if (action === "resumen") {
      const dias = Math.min(Math.max(Number(p.dias) || 30, 1), 365);
      const desde = new Date(Date.now() - dias * 86400000).toISOString();
      const pedidos = (db.Pedidos || []).filter((x) => !borradoS(x) && String(x.created_at) >= desde && (esGestionS(ses) || String(x.vendedor_id) === String(ses.id)));
      const ids = {};
      pedidos.forEach((x) => { ids[String(x.id)] = x; });
      const porEstado = {}; ESTADOS_S.forEach((e) => { porEstado[e] = 0; });
      const porVendedor = {};
      let cajas = 0;
      pedidos.forEach((x) => {
        porEstado[x.estado] = (porEstado[x.estado] || 0) + 1;
        if (x.estado === "cancelado") return;
        cajas += Number(x.total_cajas) || 0;
        const v = porVendedor[x.vendedor] || (porVendedor[x.vendedor] = { vendedor: String(x.vendedor), pedidos: 0, cajas: 0 });
        v.pedidos++; v.cajas += Number(x.total_cajas) || 0;
      });
      const porProducto = {};
      (db.PedidoItems || []).forEach((it) => {
        const ped = ids[String(it.pedido_id)];
        if (!ped || ped.estado === "cancelado") return;
        const k = String(it.code);
        const pr = porProducto[k] || (porProducto[k] = { code: k, producto: String(it.producto), cajas: 0 });
        pr.cajas += Number(it.cajas) || 0;
      });
      const orden = (a, b) => b.cajas - a.cajas;
      const porCanal = { en_persona: 0, online_telefono: 0 };
      visitasDelPeriodoS(dias + 1, "", false).forEach((v) => {
        if (String(v.fecha) >= desde.slice(0, 10) && porCanal[v.canal] !== undefined) porCanal[v.canal]++;
      });
      return {
        ok: true, dias, total_pedidos: pedidos.length, total_cajas: cajas, por_estado: porEstado,
        visitas_por_canal: porCanal,
        por_vendedor: esGestionS(ses) ? Object.values(porVendedor).sort(orden) : [],
        por_producto: Object.values(porProducto).sort(orden).slice(0, 10),
      };
    }

    // --- usuarios / guardarUsuario ---
    const usuarioPubS = (u) => {
      const roles = rolesDeS(u.rol);
      return {
        id: String(u.id),
        usuario: String(u.usuario),
        nombre: String(u.nombre),
        rol: roles[0] || String(u.rol),
        roles,
        rol_nombre: nombreRolesS(roles) || String(u.rol),
        catalogo: catalogoUsuarioS(u.catalogo),
        rutas: rutasUsuarioS(u.rutas),
      };
    };
    if (action === "usuarios") {
      const lista = (db.Usuarios || []).map((u) => ({
        ...usuarioPubS(u),
        activo: activoS(u),
        tiene_pin: !!u.tiene_pin,
        telefono: String(u.telefono || ""),
      }));
      return { ok: true, usuarios: lista };
    }
    if (action === "guardarUsuario") {
      const usuarios = db.Usuarios || [];
      const roles = rolesDeS(p.roles !== undefined ? p.roles : p.rol);
      if (!roles.length) fail("Rol inválido.", "usuario");
      const rol = roles[0];
      const esMaster = roles.includes("master");
      const eraMaster = (u) => rolesDeS(u.rol).includes("master");
      const usuario = String(p.usuario || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9._-]/g, "").slice(0, 30);
      if (usuario.length < 3) fail("El usuario debe tener al menos 3 letras o números (sin espacios).", "usuario");
      const nombre = txtS(p.nombre, 60);
      if (!nombre) fail("Falta el nombre.", "usuario");
      const activo = p.activo === undefined ? true : (p.activo === true || String(p.activo) === "true");
      const existente = p.id ? usuarios.find((u) => String(u.id) === String(p.id)) : null;
      if (p.id && !existente) fail("Usuario no encontrado.", "usuario");
      if (usuarios.some((u) => String(u.usuario).toLowerCase() === usuario && (!existente || String(u.id) !== String(existente.id)))) fail("Ese usuario ya existe.", "usuario");
      if (existente && eraMaster(existente) && activoS(existente) && (!esMaster || !activo)) {
        const otros = usuarios.filter((u) => eraMaster(u) && activoS(u) && String(u.id) !== String(existente.id));
        if (!otros.length) fail("Debe quedar al menos un Master activo.", "usuario");
      }
      const nueva = String(p.clave !== undefined ? p.clave : (p.pin || ""));
      if (nueva) {
        const min = rol === "master" ? 8 : 6;
        if (nueva.length < min || nueva.length > 64 || !/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(nueva) || !/\d/.test(nueva) || /^\s|\s$/.test(nueva)) {
          fail(`La clave${rol === "master" ? " del Master" : ""} debe tener al menos ${min} caracteres, con letras y números.`, "usuario");
        }
      }
      if (!existente && !nueva) fail("Asigná una clave al usuario nuevo.", "usuario");
      if (existente && esMaster && !eraMaster(existente) && !nueva) fail("Para pasar a Master asigná una clave nueva de al menos 8 caracteres.", "usuario");
      const maxNum = usuarios.reduce((m, x) => Math.max(m, Number(String(x.id).replace(/\D/g, "")) || 0), 0);
      const u = existente ? { ...existente } : { id: "U" + String(maxNum + 1), created_at: ahoraS(), comision_pct: 3, catalogo: "ambos", rutas: "" };
      u.usuario = usuario; u.nombre = nombre; u.rol = roles.join(", "); u.activo = activo;
      u.catalogo = p.catalogo !== undefined ? catalogoUsuarioS(p.catalogo) : catalogoUsuarioS(u.catalogo);
      u.rutas = rutasUsuarioS(p.rutas !== undefined ? p.rutas : u.rutas).join(", ");
      if (p.telefono !== undefined) {
        const telU = txtS(p.telefono, 30);
        if (telU && soloDigitosS(telU).length < 7) fail("Revisá el teléfono (WhatsApp) del usuario.", "usuario");
        u.telefono = telU;
      }
      if (nueva) u.pin_plano = nueva;
      cambios.push({ tabla: "Usuarios", fila: u });
      await guardarCambios();
      return { ok: true, usuario: { ...usuarioPubS(u), activo } };
    }
    if (action === "guardarMisRutas") {
      const rutas = rutasUsuarioS(p.rutas);
      if (!rutas.length) fail("Marcá al menos una ruta que atendés.", "rutas");
      const targetId = esGestionS(ses) && p.id ? String(p.id) : String(ses.id);
      const u = (db.Usuarios || []).find((x) => String(x.id) === targetId) || { ...ses, id: targetId };
      u.rutas = rutas.join(", ");
      cambios.push({ tabla: "Usuarios", fila: { id: targetId, rutas: u.rutas } });
      await guardarCambios();
      return { ok: true, rutas, usuario: usuarioPubS(u) };
    }

    fail("Acción no implementada: " + action);
  }

  /* Migra en 1 clic todos los datos actuales de Google Sheets a Supabase sin borrar nada de Google Sheets */
  async function migrarDesdeSheetsASupabase(url, key) {
    const cleanUrl = String(url || "").trim().replace(/\/+$/, "");
    const cleanKey = String(key || "").trim();
    if (!cleanUrl || !cleanKey) throw new Error("Ingresá la URL y la clave pública de Supabase.");
    if (esClaveSecreta(cleanKey)) throw new Error("Esa es la clave SECRETA de Supabase. Usá la clave pública (publishable / anon).");
    // 1) Leer backup completo de Google Sheets (solo lectura, no modifica nada en Sheets)
    const rBackup = await apiSheets("exportarBackup", {});
    if (!rBackup || !rBackup.backup) throw new Error("Subí primero el archivo crm/Code.gs actualizado a Apps Script para habilitar exportarBackup.");
    const s = sesion();
    // 2) Enviar todo el snapshot a Supabase
    const res = await rpcSupabase(
      { url: cleanUrl, key: cleanKey },
      { op: "importar", token: s ? s.token : "", ...rBackup.backup }
    );
    return res;
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
  /* { code: {menor, mayor, ..., disponible} } — incluye precios base de datos-distribuidora.js */
  const preciosMapa = (d) => {
    const base = {};
    PRODUCTOS_BASE_S.forEach((b) => {
      const code = b[0];
      const menor = Number(b[2]) || 0;
      const mayor = Number(b[3]) || menor;
      if (!menor) return;
      base[code] = {
        code,
        menor,
        mayor,
        desc_pronto: Math.round(menor * 0.03 * 100) / 100,
        desc_efectivo_credito: Math.round(menor * 0.04 * 100) / 100,
        desc_efectivo_pronto: Math.round(menor * 0.06 * 100) / 100,
        mayor_desc_pronto: Math.round(mayor * 0.03 * 100) / 100,
        mayor_desc_efectivo_credito: Math.round(mayor * 0.04 * 100) / 100,
        mayor_desc_efectivo_pronto: Math.round(mayor * 0.06 * 100) / 100,
        controlado: false,
        disponible: null,
      };
    });
    if (typeof BANOS !== "undefined" && Array.isArray(BANOS)) {
      BANOS.forEach((p) => {
        const menor = Number(p.precioMenor || p.precioMenorDefault) || (base[p.code] && base[p.code].menor) || 0;
        const mayor = Number(p.precioMayor || p.precioMayorDefault) || (base[p.code] && base[p.code].mayor) || menor;
        if (!menor) return;
        base[p.code] = {
          ...(base[p.code] || {}),
          code: p.code,
          menor,
          mayor,
          precio_unidad: Number(p.precioUnidad || p.precioUnidadDefault) || 0,
          permite_unidad: p.permiteUnidad !== false && p.permiteUnidadDefault !== false,
          desc_pronto: Math.round(menor * 0.03 * 100) / 100,
          desc_efectivo_credito: Math.round(menor * 0.04 * 100) / 100,
          desc_efectivo_pronto: Math.round(menor * 0.06 * 100) / 100,
          mayor_desc_pronto: Math.round(mayor * 0.03 * 100) / 100,
          mayor_desc_efectivo_credito: Math.round(mayor * 0.04 * 100) / 100,
          mayor_desc_efectivo_pronto: Math.round(mayor * 0.06 * 100) / 100,
          controlado: false,
          disponible: null,
        };
      });
    }
    ((d && d.productos) || []).forEach((p) => {
      const prev = base[p.code] || {};
      const tienePrecio = Number(p.menor) > 0;
      base[p.code] = {
        ...prev,
        ...p,
        menor: tienePrecio ? Number(p.menor) : (prev.menor || 0),
        mayor: tienePrecio ? (Number(p.mayor) || Number(p.menor)) : (prev.mayor || prev.menor || 0),
        desc_pronto: tienePrecio ? (Number(p.desc_pronto) || 0) : (prev.desc_pronto || 0),
        desc_efectivo_credito: tienePrecio ? (Number(p.desc_efectivo_credito) || 0) : (prev.desc_efectivo_credito || 0),
        desc_efectivo_pronto: tienePrecio ? (Number(p.desc_efectivo_pronto) || 0) : (prev.desc_efectivo_pronto || 0),
        mayor_desc_pronto: tienePrecio ? (Number(p.mayor_desc_pronto) || 0) : (prev.mayor_desc_pronto || 0),
        mayor_desc_efectivo_credito: tienePrecio ? (Number(p.mayor_desc_efectivo_credito) || 0) : (prev.mayor_desc_efectivo_credito || 0),
        mayor_desc_efectivo_pronto: tienePrecio ? (Number(p.mayor_desc_efectivo_pronto) || 0) : (prev.mayor_desc_efectivo_pronto || 0),
      };
    });
    return base;
  };

  /* Envío que no espera respuesta y sobrevive a que se abra WhatsApp (pedido web del cliente) */
  function enviarSinEsperar(action, datos = {}) {
    const supa = configSupabase();
    if (supa.activo && supa.url && supa.key) {
      apiSupabase(supa, action, datos).catch(() => {});
      return true;
    }
    if (!API) return false;
    const body = JSON.stringify({ action, ...datos });
    try {
      fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body, keepalive: true, redirect: "follow" }).catch(() => {});
      return true;
    } catch (e) {
      try { return navigator.sendBeacon(API, new Blob([body], { type: "text/plain;charset=utf-8" })); } catch (e2) { return false; }
    }
  }

  /* ---------- Extensión GPS-Clientes (misiones de ruta y visitas en tiempo real) vía RPC gps_db ----------
     Usa la misma base Supabase y la clave pública. Sin Supabase activo → ErrorRed (el panel sigue sin GPS-Clientes). */
  async function gpsDb(payload) {
    const supa = configSupabase();
    if (!(supa.activo && supa.url && supa.key)) throw new ErrorRed("GPS-Clientes necesita Supabase activo.");
    if (esClaveSecreta(supa.key)) throw new Error("Configuración insegura: clave secreta de Supabase en el navegador.");
    const headers = { "Content-Type": "application/json", apikey: supa.key };
    if (/^eyJ/.test(supa.key)) headers.Authorization = `Bearer ${supa.key}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    let r;
    try {
      r = await fetch(`${supa.url}/rest/v1/rpc/gps_db`, { method: "POST", headers, body: JSON.stringify({ payload }), signal: ctrl.signal });
    } catch (e) {
      throw new ErrorRed("Sin conexión con GPS-Clientes.");
    } finally {
      clearTimeout(t);
    }
    if (!r.ok) throw new ErrorRed(`GPS-Clientes no respondió (${r.status}).`);
    const j = await r.json();
    if (!j || !j.ok) { const err = new Error((j && j.error) || "Error en GPS-Clientes"); err.code = j && j.code; throw err; }
    return j;
  }
  const gpsClientesUrl = () => GPS_CLIENTES_URL;

  return {
    app, datosLocales, sincronizar, enviarSinEsperar, catalogo, catalogoGuardado, preciosMapa,
    api, sesion, guardarSesion, cerrarSesion, ErrorRed, cola, encolar, subirCola,
    leerLS, guardarLS, borrarLS, configSupabase, configurarSupabase, migrarDesdeSheetsASupabase,
    gpsDb, gpsClientesUrl,
  };
})();
