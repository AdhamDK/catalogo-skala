/* ============================================================
   Skala — lógica pura del modo vendedor (sin DOM, testeable)
   Tests: node --test tests/crm-core.test.js
   ============================================================ */

/* pedido = { code: cajas }, productos = { code: {name, unidades, unidad} } */
function itemsDePedido(pedido, productos) {
  return Object.keys(pedido || {})
    .filter((code) => pedido[code] > 0 && productos[code])
    .sort()
    .map((code) => {
      const p = productos[code];
      const cajas = Math.floor(pedido[code]);
      const u = Number.isFinite(p.unidades) && p.unidades > 0 ? p.unidades : "";
      return {
        code, producto: p.name, cajas,
        unidades_caja: u, unidad: p.unidad || "unidades",
        total_unidades: u ? cajas * u : "",
      };
    });
}

/* "0412-1234567" -> "584121234567" (para wa.me). Vacío si no parece válido. */
function telefonoWhatsapp(tel) {
  let d = String(tel || "").replace(/\D/g, "");
  if (d.startsWith("58")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d.length === 10 ? "58" + d : "";
}

function linkMapa(lat, lng) {
  if (lat === "" || lng === "" || lat == null || lng == null) return "";
  const a = Number(lat), b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "";
  return `https://maps.google.com/?q=${a},${b}`;
}

function fechaLegible(fecha) {
  // "2026-10-25 14:32" -> "25/10/2026 · 14:32"
  const m = String(fecha || "").match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} · ${m[4]}` : String(fecha || "");
}

/* Mensaje para el grupo de la empresa. */
function mensajeGrupo(ped, c) {
  c = c || {};
  const estado = ped.estado && ped.estado !== "pendiente" ? ` — ${nombreEstado(ped.estado).toUpperCase()}` : "";
  const nombre = [...new Set([c.nombre, c.contacto].filter(Boolean))].join(" · ");
  const tels = [c.telefono, c.telefono2].filter(Boolean).join(" / ");
  const mapa = linkMapa(c.latitud, c.longitud);
  const lineas = [
    `*PEDIDO ${ped.id}${estado}*`,
    `${fechaLegible(ped.fecha)} · Vendedor: ${ped.vendedor}`,
    "",
    "*Cliente*",
    nombre,
    c.rif_cedula ? `RIF: ${c.rif_cedula}` : null,
    tels ? `Tel: ${tels}` : null,
    c.direccion ? `Dirección: ${c.direccion}` : null,
    mapa ? `Ubicación: ${mapa}` : null,
    "",
    "*Productos*",
    ...(ped.items || []).map((it) =>
      `• ${it.cajas} × ${it.producto} (${it.code})${it.total_unidades ? ` = ${it.total_unidades} ${it.unidad}` : ""}`),
    "",
    `*Total: ${ped.total_cajas} caja${Number(ped.total_cajas) === 1 ? "" : "s"}*${ped.detalle_unidades ? ` · ${ped.detalle_unidades}` : ""}`,
    ped.pago ? `Pago: ${ped.pago}${Number(ped.dias_credito) > 0 ? ` (${ped.dias_credito} días)` : ""}` : null,
    ped.documento ? `Documento: ${ped.documento}` : null,
    ped.nota ? `Nota: ${ped.nota}` : null,
    ped.estado === "cancelado" && ped.motivo ? `Motivo: ${ped.motivo}` : null,
  ];
  return lineas.filter((l) => l !== null).join("\n");
}

/* -------------------- Roles (v2) --------------------
   La interfaz usa esto para mostrar botones; el servidor (crm/Code.gs) vuelve a validar todo. */
/* Nombres que ve el equipo (las claves internas no cambian: la hoja sigue compatible) */
const NOMBRES_ESTADO = { pendiente: "En proceso", confirmado: "Aprobado · Preparando despacho", en_ruta: "En ruta", entregado: "Entregado", cancelado: "Anulado" };
function nombreEstado(e) { return NOMBRES_ESTADO[e] || String(e || ""); }

function puedeTomarPedidos(rol) { return rol === "master" || rol === "admin" || rol === "vendedor"; }

function accionesPedido(rol, uid, p) {
  const e = p.estado;
  const cobro = p.cobro || "";
  if (rol === "master" || rol === "admin") {
    if (e === "pendiente") return ["confirmar", "cancelar"];
    if (e === "confirmado") return ["en_ruta", "reasignar", "cancelar"];
    if (e === "en_ruta") return ["entregado", "reasignar", "cancelar"];
    if (e === "entregado") {
      if (cobro === "cancelado") return ["conciliar", "rechazar"];
      if (cobro === "conciliado") return ["desconciliar"];
      return ["conciliar", "reabrir"];
    }
    return ["reabrir"];
  }
  if (rol === "vendedor") {
    if (String(p.vendedor_id) !== String(uid)) return [];
    if (e === "pendiente") return ["cancelar"];
    if (e === "entregado" && !cobro) return ["cobrar"];
    return [];
  }
  if (rol === "despachador" && String(p.despachador_id) === String(uid)) {
    if (e === "confirmado") return ["en_ruta", "entregado"];
    if (e === "en_ruta") return ["entregado"];
  }
  return [];
}

function pestanasPanel(rol) {
  if (rol === "despachador") {
    return [
      { id: "curso", nombre: "Por entregar", estados: ["confirmado", "en_ruta"] },
      { id: "entregado", nombre: "Entregados", estados: ["entregado"] },
    ];
  }
  const tabs = [
    { id: "pendiente", nombre: rol === "vendedor" ? "En proceso" : "Por aprobar", estados: ["pendiente"] },
    { id: "curso", nombre: "En despacho", estados: ["confirmado", "en_ruta"] },
    { id: "entregado", nombre: "Entregados", estados: ["entregado"] },
    { id: "cobrar", nombre: "Por cobrar", filtro: "por_cobrar" },
    ...(rol === "vendedor" ? [] : [{ id: "conciliar", nombre: "Por conciliar", filtro: "por_conciliar" }]),
    { id: "conciliados", nombre: "Conciliados", filtro: "conciliados", periodo: true },
    { id: "cancelado", nombre: "Anulados", estados: ["cancelado"] },
    { id: "resumen", nombre: "Resumen" },
  ];
  if (rol === "master") tabs.push({ id: "usuarios", nombre: "Usuarios" });
  return tabs;
}

/* opciones.telefonoOpcional: alta manual de clientes (traspaso), el teléfono puede faltar */
/* -------------------- Crédito: banderas por vencimiento --------------------
   Los días se cuentan desde la entrega. Niveles: al_dia (verde) · proximo (amarilla, ≤ 3 días)
   · vencido (roja, hasta 15 días) · muy_vencido (morada, más de 15) · por_conciliar · pagado. */
const CREDITO_PROXIMO = 3, CREDITO_MUY_VENCIDO = 15;
const DIA = 86400000;
const soloFecha = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const isoDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function estadoCredito(p, hoy = new Date()) {
  const dias = Number(p.dias_credito) || 0;
  if (!dias || p.estado === "cancelado") return null;
  if (p.estado !== "entregado" || !p.entregado_at) return { nivel: "sin_entregar", vence: "", dias, texto: `Crédito ${dias} días · cuenta desde la entrega` };
  const vence = soloFecha(new Date(new Date(p.entregado_at).getTime() + dias * DIA));
  if (p.cobro === "cancelado") return { nivel: "por_conciliar", vence: isoDia(vence), dias: 0, texto: "Cancelado · por conciliar" };
  if (p.cobro === "conciliado") return { nivel: "pagado", vence: isoDia(vence), dias: 0, texto: "Conciliado" };
  const faltan = Math.round((vence - soloFecha(hoy)) / DIA);
  const s = (n) => `${n} día${n === 1 ? "" : "s"}`;
  if (faltan > CREDITO_PROXIMO) return { nivel: "al_dia", vence: isoDia(vence), dias: faltan, texto: `Vence en ${s(faltan)}` };
  if (faltan >= 0) return { nivel: "proximo", vence: isoDia(vence), dias: faltan, texto: faltan === 0 ? "Vence hoy" : `Vence en ${s(faltan)}` };
  const atraso = -faltan;
  return { nivel: atraso > CREDITO_MUY_VENCIDO ? "muy_vencido" : "vencido", vence: isoDia(vence), dias: atraso, texto: `Vencido hace ${s(atraso)}` };
}

/* -------------------- Total de carga (despachador) -------------------- */
function totalCarga(pedidos) {
  const prod = {};
  let cajas = 0;
  (pedidos || []).forEach((p) => {
    (p.items || []).forEach((it) => {
      const k = it.code;
      const x = prod[k] || (prod[k] = { code: k, producto: it.producto, cajas: 0, total_unidades: 0, unidad: it.unidad || "unidades" });
      x.cajas += Number(it.cajas) || 0;
      x.total_unidades += Number(it.total_unidades) || 0;
      cajas += Number(it.cajas) || 0;
    });
  });
  const productos = Object.values(prod).sort((a, b) => b.cajas - a.cajas || a.code.localeCompare(b.code));
  const porUnidad = {};
  productos.forEach((x) => { if (x.total_unidades) porUnidad[x.unidad] = (porUnidad[x.unidad] || 0) + x.total_unidades; });
  return { pedidos: (pedidos || []).length, cajas, productos, unidades: Object.entries(porUnidad).map(([u, n]) => `${n} ${u}`).join(" + ") };
}

/* -------------------- Conciliados: dinero recibido -------------------- */
function monedaDePago(pago) { return /bol[ií]var/i.test(String(pago || "")) ? "Bs" : "USD"; }
function formatoMonto(n, moneda) {
  const [ent, dec] = (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).split(".");
  return `${moneda} ${ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}
function resumenConciliados(pedidos) {
  const montos = { USD: 0, Bs: 0 };
  const grupo = (mapa, nombre) => mapa[nombre] || (mapa[nombre] = { nombre, pedidos: 0, cajas: 0, USD: 0, Bs: 0 });
  const vend = {}, pago = {};
  const r2 = (n) => Math.round(n * 100) / 100;
  (pedidos || []).forEach((p) => {
    const m = Number(p.monto) || 0, mon = p.moneda === "Bs" ? "Bs" : "USD", cajas = Number(p.total_cajas) || 0;
    montos[mon] = r2(montos[mon] + m);
    [grupo(vend, p.vendedor || "—"), grupo(pago, p.pago || "Sin indicar")].forEach((g) => { g.pedidos++; g.cajas += cajas; g[mon] = r2(g[mon] + m); });
  });
  const orden = (a, b) => b.USD - a.USD || b.Bs - a.Bs || b.pedidos - a.pedidos;
  const carga = totalCarga(pedidos);
  return { pedidos: carga.pedidos, cajas: carga.cajas, montos, por_vendedor: Object.values(vend).sort(orden), por_pago: Object.values(pago).sort(orden), productos: carga.productos };
}

function validarCliente(c, opciones = {}) {
  const faltan = [];
  if (!String(c.negocio || c.nombre || c.contacto || "").trim()) faltan.push("Nombre del cliente o del negocio");
  const digitos = String(c.telefono || "").replace(/\D/g, "").length;
  if ((!opciones.telefonoOpcional || digitos > 0) && digitos < 7) faltan.push("Teléfono 1 (mínimo 7 números)");
  return faltan;
}

/* Ubicación pegada: "8.61, -71.65" o un enlace de Google Maps (@lat,lng · q=lat,lng · !3dlat!4dlng).
   Los enlaces cortos (maps.app.goo.gl) no traen coordenadas: devuelve null. */
function coordsDeTexto(texto) {
  const t = String(texto || "").trim();
  if (!t) return null;
  const num = "(-?\\d{1,3}(?:\\.\\d+)?)";
  const patrones = [
    new RegExp("@" + num + "," + num),
    new RegExp("!3d" + num + "!4d" + num),
    new RegExp("[?&](?:q|query|ll|center)=" + num + ",\\s*" + num),
    new RegExp("^" + num + "\\s*,\\s*" + num + "$"),
  ];
  for (const re of patrones) {
    const m = t.match(re);
    if (!m) continue;
    const lat = Number(m[1]), lng = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
  }
  return null;
}

function expiracionToken(token) {
  const p = String(token || "").split(".");
  return p.length === 3 ? Number(p[1]) || 0 : 0;
}

function nuevoRef() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { itemsDePedido, telefonoWhatsapp, linkMapa, fechaLegible, mensajeGrupo, validarCliente, expiracionToken, nuevoRef,
    nombreEstado, puedeTomarPedidos, accionesPedido, pestanasPanel, coordsDeTexto, estadoCredito, totalCarga,
    monedaDePago, formatoMonto, resumenConciliados };
}
