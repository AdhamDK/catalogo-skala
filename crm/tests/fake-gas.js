/* Simulador mínimo de Google Apps Script para probar crm/Code.gs con Node.
   Carga Code.gs en un contexto aislado con SpreadsheetApp, Utilities, etc. en memoria. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

/* Como Google Sheets: el apóstrofo inicial fuerza texto y no se devuelve al leer;
   un texto sin apóstrofo que parece número o fecha se convierte (aquí: número / Date). */
function leerCelda(x) {
  if (x === undefined) return "";
  if (typeof x !== "string") return x;
  if (x.startsWith("'")) return x.slice(1);
  if (/^-?\d+(\.\d+)?$/.test(x)) return Number(x);
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(x)) return new Date(x);
  if (/^[=+@]/.test(x)) throw new Error("Sheets evaluaría una fórmula: " + x);
  return x;
}

function crearHoja(nombre) {
  const filas = []; // array de arrays
  const ancho = () => filas.reduce((m, f) => Math.max(m, f.length), 0);
  const hoja = {
    nombre,
    filas,
    getName: () => nombre,
    getLastRow: () => filas.length,
    getLastColumn: () => ancho(),
    setFrozenRows() {},
    appendRow(vals) { filas.push(vals.slice()); return hoja; },
    getRange(r, c, nr = 1, nc = 1) {
      return {
        getValues() {
          const out = [];
          for (let i = 0; i < nr; i++) {
            const fila = filas[r - 1 + i] || [];
            const v = [];
            for (let j = 0; j < nc; j++) { v.push(leerCelda(fila[c - 1 + j])); }
            out.push(v);
          }
          return out;
        },
        setValues(vals) {
          if (vals.length !== nr || vals.some((f) => f.length !== nc)) throw new Error("setValues: tamaño no coincide");
          for (let i = 0; i < nr; i++) {
            while (filas.length < r + i) filas.push([]);
            const fila = filas[r - 1 + i];
            for (let j = 0; j < nc; j++) fila[c - 1 + j] = vals[i][j];
          }
        },
      };
    },
  };
  return hoja;
}

function crearGas({ ahora } = {}) {
  const hojas = {};
  const libro = {
    getSheetByName: (n) => hojas[n] || null,
    insertSheet: (n) => (hojas[n] = crearHoja(n)),
  };
  const props = {};
  const cache = {};
  const toSigned = (buf) => [...buf].map((b) => (b > 127 ? b - 256 : b));
  let reloj = ahora || null;

  const ctx = {
    console,
    Date: class extends Date {
      constructor(...a) { if (a.length === 0 && reloj) super(reloj); else super(...a); }
      static now() { return reloj ? new Date(reloj).getTime() : Date.now(); }
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => libro,
      openById: () => libro,
      getUi: () => { throw new Error("sin UI"); },
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }),
    },
    CacheService: {
      getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; } }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (t) => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: "sha256" },
      Charset: { UTF_8: "utf8" },
      getUuid: () => crypto.randomUUID(),
      computeDigest: (alg, txt) => toSigned(crypto.createHash("sha256").update(txt, "utf8").digest()),
      computeHmacSha256Signature: (txt, key) => toSigned(crypto.createHmac("sha256", key).update(txt, "utf8").digest()),
      formatDate: (d, tz, fmt) => {
        const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
          .formatToParts(d).map((x) => [x.type, x.value]));
        return fmt.replace("yyyy", p.year).replace("yy", p.year.slice(2)).replace("MM", p.month).replace("dd", p.day).replace("HH", p.hour === "24" ? "00" : p.hour).replace("mm", p.minute);
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8"), ctx, { filename: "Code.gs" });

  const api = {
    ctx, hojas, props, cache,
    setAhora: (iso) => { reloj = iso; },
    post: (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent()),
    get: (params) => JSON.parse(ctx.doGet({ parameter: params }).getContent()),
    tabla: (n) => {
      const h = hojas[n];
      if (!h) return [];
      const [cab, ...resto] = h.filas;
      return resto.map((f) => Object.fromEntries(cab.map((c, i) => [leerCelda(c), leerCelda(f[i])])));
    },
  };
  return api;
}

module.exports = { crearGas };
