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
  const tipo = ped.tipo_pago || tipoPagoDe(ped.pago);
  const conPrecio = (ped.items || []).some((it) => Number(it.precio) > 0);
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
      `• ${it.cajas} × ${it.producto} (${it.code})${it.total_unidades ? ` = ${it.total_unidades} ${it.unidad}` : ""}${conPrecio ? ` · ${dinero(precioUnitario(it, tipo))} c/u` : ""}`),
    "",
    `*Total: ${ped.total_cajas} caja${Number(ped.total_cajas) === 1 ? "" : "s"}*${ped.detalle_unidades ? ` · ${ped.detalle_unidades}` : ""}`,
    conPrecio ? `*Monto: ${dinero(totalPorPago(ped.items, tipo))}* · precio ${ped.nivel_precio === "mayor" ? "al mayor" : "al por menor"}${ped.excepcion_precio ? " (excepción)" : ""}` : null,
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

/* Un usuario puede tener varios roles: estas funciones aceptan un rol o una lista */
const listaRoles = (r) => (Array.isArray(r) ? r : [r]).filter(Boolean);
function puedeTomarPedidos(rol) { return listaRoles(rol).some((r) => r === "master" || r === "admin" || r === "vendedor"); }

/* Botones del pedido: la suma de lo que permite cada rol, sin repetir */
function accionesPedido(rol, uid, p) {
  const todas = [];
  listaRoles(rol).forEach((r) => accionesDeRol(r, uid, p).forEach((a) => { if (!todas.includes(a)) todas.push(a); }));
  return todas;
}
function accionesDeRol(rol, uid, p) {
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

/* Borrar (ej. pedidos de prueba): el vendedor los suyos, el Master cualquiera */
function puedeBorrar(rol, uid, p) {
  const rs = listaRoles(rol);
  return rs.includes("master") || (rs.includes("vendedor") && String(p.vendedor_id) === String(uid));
}

/* Pedido web: número de referencia y mensaje de WhatsApp del cliente */
function refWeb() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 6; i++) r += abc[Math.floor(Math.random() * abc.length)];
  return "WEB-" + r;
}
function mensajeWeb({ ref, cliente = {}, vendedor, items = [], tipo_pago, nota }) {
  const cajas = items.reduce((a, it) => a + (Number(it.cajas) || 0), 0);
  const conPrecio = items.some((it) => Number(it.precio) > 0);
  const pg = pagoPorId(tipo_pago);
  return [
    `Hola! Quiero hacer este pedido de Skala (${ref}):`,
    "",
    "*Mis datos*",
    `Negocio: ${cliente.negocio || "—"}`,
    cliente.contacto ? `Nombre: ${cliente.contacto}` : null,
    cliente.rif_cedula ? `RIF: ${cliente.rif_cedula}` : null,
    `Teléfono: ${cliente.telefono || "—"}`,
    cliente.direccion ? `Dirección: ${cliente.direccion}` : null,
    vendedor ? `Mi vendedor: ${vendedor}` : null,
    "",
    "*Pedido*",
    ...items.map((it) => `• ${it.cajas} × ${it.producto} (${it.code})${conPrecio && it.precio ? ` · ${dinero(precioUnitario(it, tipo_pago))} c/u` : ""}`),
    "",
    `Total: ${cajas} caja${cajas === 1 ? "" : "s"}`,
    conPrecio && pg ? `Monto: ${dinero(totalPorPago(items, tipo_pago))} (${pg.nombre})` : pg ? `Forma de pago: ${pg.nombre}` : null,
    nota ? `Nota: ${nota}` : null,
  ].filter((l) => l !== null).join("\n");
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
    { id: "web", nombre: "Web", web: true },
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

/* -------------------- Precios (v3) --------------------
   precios = { code: { menor, mayor, desc_pronto, desc_efectivo_credito, desc_efectivo_pronto } } (acción "catalogo").
   Nivel: Mayor desde 15 cajas o por excepción del vendedor. El descuento sale de cómo paga. */
const CAJAS_MAYOR = 15;
const PAGOS = [
  { id: "credito", nombre: "Crédito", credito: true, desc: "", ayuda: "Transferencia o pago móvil con días", estrellas: 0 },
  { id: "pronto", nombre: "Pronto pago", credito: false, desc: "desc_pronto", ayuda: "Paga hasta el día siguiente a la entrega", estrellas: 1 },
  { id: "efectivo_credito", nombre: "Efectivo a crédito", credito: true, desc: "desc_efectivo_credito", ayuda: "Dólares en efectivo con días", estrellas: 2 },
  { id: "efectivo_pronto", nombre: "Efectivo pronto pago", credito: false, desc: "desc_efectivo_pronto", ayuda: "Efectivo hasta el día siguiente a la entrega", estrellas: 3, premium: true },
];
const pagoPorId = (id) => PAGOS.find((x) => x.id === id) || null;
function tipoPagoDe(pago) {
  const t = String(pago || "").toLowerCase();
  const ef = /efectivo/.test(t), cred = /cr[eé]dito/.test(t);
  if (ef) return cred ? "efectivo_credito" : "efectivo_pronto";
  return cred ? "credito" : "pronto";
}
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
function nivelPrecio(totalCajas, excepcion) { return totalCajas >= CAJAS_MAYOR || excepcion ? "mayor" : "menor"; }

/* Agrega precio y descuentos a los items (copia), según nivel */
function conPrecios(items, precios, nivel) {
  return (items || []).map((it) => {
    const pr = (precios || {})[it.code] || {};
    const precio = nivel === "mayor" ? (Number(pr.mayor) || Number(pr.menor) || 0) : (Number(pr.menor) || 0);
    return { ...it, precio, desc_pronto: Number(pr.desc_pronto) || 0, desc_efectivo_credito: Number(pr.desc_efectivo_credito) || 0, desc_efectivo_pronto: Number(pr.desc_efectivo_pronto) || 0 };
  });
}
function precioUnitario(it, tipo) {
  const pg = pagoPorId(tipo) || PAGOS[0];
  return r2(Math.max(0, (Number(it.precio) || 0) - (pg.desc ? Number(it[pg.desc]) || 0 : 0)));
}
function totalPorPago(items, tipo) { return r2((items || []).reduce((a, it) => a + (Number(it.cajas) || 0) * precioUnitario(it, tipo), 0)); }
/* Lista para mostrar: total de cada forma de pago y cuánto ahorra frente a Crédito */
function totalesPorPago(items) {
  const base = totalPorPago(items, "credito");
  return PAGOS.map((pg) => { const total = totalPorPago(items, pg.id); return { ...pg, total, ahorro: r2(base - total) }; });
}
const sinPrecio = (items) => (items || []).filter((it) => !(Number(it.precio) > 0)).map((it) => it.code);
const dinero = (n) => formatoMonto(n, "$").replace(/^\$ (.*)$/, "$1 $");

/* Pronto pago: vale hasta el final del día siguiente a la entrega */
function limitePronto(entregadoAt) {
  if (!entregadoAt) return null;
  const d = new Date(entregadoAt);
  if (isNaN(d)) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 23, 59, 59);
}
function prontoVigente(entregadoAt, hoy = new Date()) {
  const l = limitePronto(entregadoAt);
  return !l || hoy <= l;
}

/* Existencias para el vendedor: texto y si se puede sumar más */
function textoStock(st) {
  if (!st || !st.controlado || st.disponible == null) return "";
  return st.disponible <= 0 ? "Agotado" : `Hay ${st.disponible}`;
}
function topeStock(st) { return st && st.controlado && st.disponible != null ? Math.max(0, st.disponible) : Infinity; }

/* -------------------- Datos en el teléfono (app y sin señal) --------------------
   Se actualizan solos a las 8 am, 1 pm y 4 pm (y con "Actualizar ahora"). */
const HORAS_SYNC = [8, 13, 16];
/* ¿Pasó algún horario de actualización desde la última vez? */
function debeSincronizar(fechaIso, ahora = new Date()) {
  if (!fechaIso) return true;
  const ult = new Date(fechaIso);
  if (isNaN(ult)) return true;
  if (ahora - ult > 24 * 3600000) return true;
  for (let d = 0; d <= 1; d++) {
    for (const h of HORAS_SYNC) {
      const t = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - d, h, 0, 0);
      if (t <= ahora && t > ult) return true;
    }
  }
  return false;
}
function proximaSync(ahora = new Date()) {
  for (let d = 0; d <= 1; d++) {
    for (const h of HORAS_SYNC) {
      const t = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + d, h, 0, 0);
      if (t > ahora) return t;
    }
  }
  return null;
}

/* Mismos filtros que el servidor (crm/Code.gs → accionPedidos_), sobre la copia del teléfono */
function filtrarPedidosLocal(pedidos, p = {}, hoy = new Date()) {
  const dias = Math.min(Math.max(Number(p.dias) || 30, 1), 365);
  const desde = new Date(hoy.getTime() - dias * DIA).toISOString();
  const estados = Array.isArray(p.estados) ? p.estados : p.estado ? [p.estado] : [];
  return (pedidos || []).filter((x) => {
    if (p.cliente_id) return String(x.cliente_id) === String(p.cliente_id);
    if (p.por_cobrar) return x.estado !== "cancelado" && !x.cobro && (Number(x.dias_credito) > 0 || x.estado === "entregado");
    if (p.por_conciliar) return x.cobro === "cancelado";
    if (p.conciliados) return x.cobro === "conciliado" && String(x.conciliado_at) >= desde;
    if (estados.length && !estados.includes(x.estado)) return false;
    return ["pendiente", "confirmado", "en_ruta"].includes(x.estado) || String(x.created_at) >= desde;
  }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function buscarClientesLocal(clientes, q, limite = 20) {
  const t = String(q || "").trim().toLowerCase();
  const qd = t.replace(/\D/g, "");
  return (clientes || []).filter((c) => {
    if (!t) return true;
    if ([c.nombre, c.contacto, c.rif_cedula, c.direccion].join(" ").toLowerCase().includes(t)) return true;
    const dig = (v) => String(v || "").replace(/\D/g, "");
    return qd.length >= 4 && (dig(c.telefono).includes(qd) || dig(c.telefono2).includes(qd) || dig(c.rif_cedula).includes(qd));
  }).slice(0, Math.min(Math.max(Number(limite) || 20, 1), 200));
}

/* Respuesta armada con los datos del teléfono, o null si esa consulta necesita señal */
function respuestaLocal(accion, datos, local, hoy = new Date()) {
  if (!local) return null;
  const extra = { ok: true, local: true, fecha_local: local.fecha };
  switch (accion) {
    case "catalogo": return local.catalogo ? { ...local.catalogo, ...extra } : null;
    case "clientes": return { clientes: buscarClientesLocal(local.clientes, datos.q, datos.limite), ...extra };
    case "pedidos": return { pedidos: filtrarPedidosLocal(local.pedidos, datos, hoy), ...extra };
    case "pedido": {
      const p = (local.pedidos || []).find((x) => x.id === datos.pedido_id);
      return p ? { pedido: { historial: [], ...p }, ...extra } : null;
    }
    case "pedidosWeb": return { pedidos: (local.pedidos_web || []).filter((w) => datos.estado === "todos" || w.estado === "nuevo"), ...extra };
    case "despachadores": return { despachadores: local.despachadores || [], ...extra };
    default: return null;
  }
}

/* App Android: ¿hay versión nueva? ¿es obligatoria? */
function estadoApp(versionInstalada, config) {
  const v = Number(versionInstalada) || 0;
  const c = config || {};
  return { nueva: !!(c.url_apk && Number(c.version_apk) > v), obligatoria: !!(c.url_apk && Number(c.minima_apk) > v), version: Number(c.version_apk) || 0 };
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
    monedaDePago, formatoMonto, resumenConciliados,
    CAJAS_MAYOR, PAGOS, pagoPorId, tipoPagoDe, nivelPrecio, conPrecios, precioUnitario, totalPorPago, totalesPorPago, sinPrecio, dinero,
    limitePronto, prontoVigente, textoStock, topeStock, puedeBorrar, refWeb, mensajeWeb,
    HORAS_SYNC, debeSincronizar, proximaSync, filtrarPedidosLocal, buscarClientesLocal, respuestaLocal, estadoApp };
}
