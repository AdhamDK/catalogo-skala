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
    conPrecio ? `*Monto: ${dinero(totalPorPago(ped.items, tipo))}* · precio ${ped.nivel_precio === "personalizado" ? "personalizado" : ped.nivel_precio === "mayor" ? "al mayor" : "al por menor"}${ped.excepcion_precio && ped.nivel_precio !== "personalizado" ? " (excepción)" : ""}` : null,
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
const NOMBRES_ESTADO = { pendiente: "En proceso", confirmado: "Aprobado · Por despachar", en_ruta: "En ruta", entregado: "Entregado", cancelado: "Anulado" };
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
    // sin depositario asignado, Administración despacha y entrega
    if (e === "confirmado") return ["en_ruta", "entregado", "cancelar"];
    if (e === "en_ruta") return ["entregado", "cancelar"];
    if (e === "entregado") {
      if (cobro === "cancelado" || Number(p.pagos_pend) > 0) return ["conciliar", "rechazar"];
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
    linkMapa(cliente.latitud, cliente.longitud) ? `Ubicación: ${linkMapa(cliente.latitud, cliente.longitud)}` : null,
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
/* Cajas que faltan entregar de un producto (entrega parcial: ya recibió una parte) */
function cajasPorEntregar(it) { return Math.max(0, (Number(it.cajas) || 0) - (Number(it.entregadas) || 0)); }
function cajasPendientes(p) { return (p.items || []).reduce((a, it) => a + cajasPorEntregar(it), 0); }
const esParcial = (p) => (p.items || []).some((it) => Number(it.entregadas) > 0) && cajasPendientes(p) > 0;
function totalCarga(pedidos) {
  const prod = {};
  let cajas = 0;
  (pedidos || []).forEach((p) => {
    (p.items || []).forEach((it) => {
      const k = it.code;
      const n = cajasPorEntregar(it);
      if (!n) return;
      const x = prod[k] || (prod[k] = { code: k, producto: it.producto, cajas: 0, total_unidades: 0, unidad: it.unidad || "unidades" });
      x.cajas += n;
      x.total_unidades += (Number(it.unidades_caja) || 0) * n || (n === Number(it.cajas) ? Number(it.total_unidades) || 0 : 0);
      cajas += n;
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

/* Agrega precio y descuentos a los items (copia), según nivel o precios personalizados por caja */
function conPrecios(items, precios, nivel, personalizados) {
  return (items || []).map((it) => {
    const manual = r2(Number((personalizados && personalizados[it.code]) ?? it.precio_manual) || 0);
    if (manual > 0) {
      return { ...it, precio: manual, precio_manual: manual, desc_pronto: 0, desc_efectivo_credito: 0, desc_efectivo_pronto: 0, personalizado: true };
    }
    const pr = (precios || {})[it.code] || {};
    const may = nivel === "mayor";
    const precio = may ? (Number(pr.mayor) || Number(pr.menor) || 0) : (Number(pr.menor) || 0);
    // al mayor, la rebaja de su propio precio (si no vino, la misma que al por menor)
    const d = (k) => Number(may && pr["mayor_" + k] !== undefined ? pr["mayor_" + k] : pr[k]) || 0;
    return { ...it, precio, desc_pronto: d("desc_pronto"), desc_efectivo_credito: d("desc_efectivo_credito"), desc_efectivo_pronto: d("desc_efectivo_pronto") };
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
/* "Hasta X% de descuento al nivel 3": cuánto se ahorra con la forma de pago de 3 estrellas */
function descuentoMaximo(items) {
  const base = totalPorPago(items, "credito");
  return base > 0 ? Math.round(((base - totalPorPago(items, "efectivo_pronto")) / base) * 100) : 0;
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

/* Evalúa si el monto ingresado cubre el saldo pendiente (Canceló completo) o si queda como Abono.
   Tolerancia: hasta 1% o $1 USD de diferencia para absorber redondeos de tasa. */
function evaluarCobro({ totalUsd, pagadoPrevioUsd = 0, monto = 0, moneda = "USD", tasa = 0 } = {}) {
  const tot = r2(Math.max(0, Number(totalUsd) || 0));
  const previo = r2(Math.max(0, Number(pagadoPrevioUsd) || 0));
  const saldoBaseUsd = r2(Math.max(0, tot - previo));
  const m = r2(Math.max(0, Number(monto) || 0));
  const t = Number(tasa) > 0 ? Math.round(Number(tasa) * 10000) / 10000 : 0;
  const esBs = String(moneda).toUpperCase() === "BS";
  const esperadoBs = t > 0 ? r2(saldoBaseUsd * t) : 0;
  const montoUsd = esBs ? (t > 0 ? r2(m / t) : 0) : m;
  const tolUsd = Math.max(1, r2(saldoBaseUsd * 0.01));
  const completo = montoUsd > 0 && (saldoBaseUsd <= 0 || montoUsd + tolUsd >= saldoBaseUsd);
  const restanteUsd = completo ? 0 : r2(Math.max(0, saldoBaseUsd - montoUsd));
  const restanteBs = t > 0 ? r2(restanteUsd * t) : 0;
  return { totalUsd: tot, pagadoPrevioUsd: previo, saldoBaseUsd, monto: m, moneda: esBs ? "Bs" : "USD", tasa: t, esperadoBs, montoUsd, tolUsd, completo, restanteUsd, restanteBs };
}

/* Detalle exacto de qué precios cambiaron en el pedido (de cuánto a cuánto por caja y en el total) */
function cambiosDePrecio(p) {
  if (!p || !p.ajuste_previo) return { cambios: [], totalAntes: 0, totalAhora: 0 };
  let prev = {};
  try { prev = typeof p.ajuste_previo === "string" ? JSON.parse(p.ajuste_previo) : p.ajuste_previo; } catch (_) {}
  const prevItems = Array.isArray(prev) ? prev : (Array.isArray(prev.items) ? prev.items : []);
  if (!prevItems.length) return { cambios: [], totalAntes: 0, totalAhora: 0 };
  const mapPrev = {};
  prevItems.forEach((x) => { if (x && x.code) mapPrev[String(x.code).toUpperCase()] = x; });
  const tipo = p.tipo_pago_real || p.tipo_pago || tipoPagoDe(p.pago);
  const cambios = [];
  let totalAntes = 0;
  let totalAhora = 0;
  (p.items || []).forEach((it) => {
    const code = String(it.code || "").toUpperCase();
    const cajas = Number(it.cajas) || 0;
    const ant = mapPrev[code];
    const uAntes = ant ? precioUnitario(ant, tipo) : precioUnitario(it, tipo);
    const uAhora = precioUnitario(it, tipo);
    totalAntes = r2(totalAntes + cajas * uAntes);
    totalAhora = r2(totalAhora + cajas * uAhora);
    if (ant && Math.abs(uAntes - uAhora) >= 0.01) {
      cambios.push({
        code: it.code,
        producto: it.producto,
        cajas,
        antes: uAntes,
        ahora: uAhora,
        subtotalAntes: r2(cajas * uAntes),
        subtotalAhora: r2(cajas * uAhora),
      });
    }
  });
  return { cambios, totalAntes, totalAhora };
}

/* Extrae la lista de pagos conciliados con su cálculo de comisión para cada vendedor */
function extraerComisiones(pedidos, cfg = {}) {
  const defPct = Number(cfg.porcentaje_default) > 0 ? Number(cfg.porcentaje_default) : 3;
  const mapaVend = cfg.por_vendedor || {};
  const pctDe = (p) => {
    const porId = Number(mapaVend[String(p.vendedor_id)]);
    if (porId > 0) return porId;
    const porNom = Number(mapaVend[String(p.vendedor || "").trim().toLowerCase()]);
    if (porNom > 0) return porNom;
    return defPct;
  };
  const items = [];
  (pedidos || []).forEach((p) => {
    if (p.estado === "cancelado") return;
    let pagos = Array.isArray(p.pagos) ? p.pagos.filter((x) => x.estado === "conciliado") : [];
    if (!pagos.length && p.cobro === "conciliado" && Number(p.monto) > 0) {
      const totU = Number(p.total_final || p.total) || (p.moneda === "Bs" ? 0 : Number(p.monto) || 0);
      pagos = [{
        id: "PED-" + p.id,
        pedido_id: p.id,
        fecha_pago: String(p.cobrado_at || p.conciliado_at || p.entregado_at || p.fecha || "").slice(0, 10),
        moneda: p.moneda === "Bs" ? "Bs" : "USD",
        monto: Number(p.monto) || 0,
        tasa: p.moneda === "Bs" && totU > 0 ? r2((Number(p.monto) || 0) / totU) : 0,
        monto_usd: totU,
        estado: "conciliado",
        conciliado_at: p.conciliado_at || "",
        conciliado_por: p.conciliado_por || "",
      }];
    }
    const pagadasLocal = cfg.pagadas_locales || {};
    pagos.forEach((pgOrig) => {
      const pid = String(pgOrig.id || ("PED-" + p.id));
      const loc = pagadasLocal[pid];
      const pg = loc
        ? (loc.comision_estado === "pendiente" ? { ...pgOrig, comision_estado: "" } : { ...pgOrig, ...loc })
        : pgOrig;
      const pct = Number(pg.comision_pct) > 0 ? Number(pg.comision_pct) : pctDe(p);
      const mon = pg.moneda === "Bs" ? "Bs" : "USD";
      const montoCobrado = Number(pg.monto) || 0;
      const tasaCobro = Number(pg.tasa) || 0;
      const montoUsd = Number(pg.monto_usd) || (mon === "Bs" ? (tasaCobro > 0 ? r2(montoCobrado / tasaCobro) : 0) : montoCobrado) || Number(p.total_final || p.total) || 0;
      const comisionUsd = Number(pg.comision_usd) > 0 ? Number(pg.comision_usd) : r2(montoUsd * pct / 100);
      const comisionBsOrigen = mon === "Bs" ? r2(montoCobrado * pct / 100) : 0;
      const pagada = pg.comision_estado === "pagada";
      items.push({
        pago_id: pid,
        pedido_id: String(p.id),
        negocio: String(p.negocio || ""),
        cliente: String(p.cliente || ""),
        vendedor_id: String(p.vendedor_id || ""),
        vendedor: String(p.vendedor || "—"),
        factura: String(p.factura || ""),
        fecha_pago: String(pg.fecha_pago || (p.conciliado_at || p.cobrado_at || p.fecha || "")).slice(0, 10),
        conciliado_at: String(pg.conciliado_at || p.conciliado_at || ""),
        moneda: mon,
        monto_cobrado: montoCobrado,
        tasa_cobro: tasaCobro,
        monto_usd: montoUsd,
        referencia_cobro: String(pg.referencia || ""),
        pct,
        comision_usd: comisionUsd,
        comision_bs_origen: comisionBsOrigen,
        pagada,
        comision_moneda: String(pg.comision_moneda || mon),
        comision_monto: pagada && Number(pg.comision_monto) > 0 ? Number(pg.comision_monto) : (mon === "Bs" ? comisionBsOrigen : comisionUsd),
        comision_tasa: Number(pg.comision_tasa) || tasaCobro || 0,
        comision_fecha: String(pg.comision_fecha || ""),
        comision_ref: String(pg.comision_ref || ""),
        comision_pagada_at: String(pg.comision_pagada_at || ""),
        comision_pagada_por: String(pg.comision_pagada_por || ""),
      });
    });
  });
  return items.sort((a, b) => String(b.conciliado_at || b.fecha_pago).localeCompare(String(a.conciliado_at || a.fecha_pago)));
}

/* Mismos filtros que el servidor (crm/Code.gs → accionPedidos_), sobre la copia del teléfono */
function filtrarPedidosLocal(pedidos, p = {}, hoy = new Date()) {
  const dias = Math.min(Math.max(Number(p.dias) || 30, 1), 365);
  const desde = new Date(hoy.getTime() - dias * DIA).toISOString();
  const estados = Array.isArray(p.estados) ? p.estados : p.estado ? [p.estado] : [];
  return (pedidos || []).filter((x) => {
    if (p.cliente_id) return String(x.cliente_id) === String(p.cliente_id);
    if (p.por_cobrar) return x.estado !== "cancelado" && !x.cobro && (Number(x.dias_credito) > 0 || x.estado === "entregado");
    if (p.por_conciliar) return x.cobro === "cancelado" || Number(x.pagos_pend) > 0;
    if (p.conciliados) {
      if (x.cobro === "conciliado" && String(x.conciliado_at) >= desde) return true;
      return Array.isArray(x.pagos) && x.pagos.some((pg) => pg.estado === "conciliado" && (String(pg.conciliado_at) >= desde || pg.comision_estado !== "pagada"));
    }
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
    const clave = (v) => { const d = dig(v); return d.length >= 10 ? d.slice(-10) : d; }; // +58 / 0 adelante da igual
    const enTel = (t) => dig(t).includes(qd) || clave(t).includes(clave(qd));
    return qd.length >= 4 && (enTel(c.telefono) || enTel(c.telefono2) || dig(c.rif_cedula).includes(qd));
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

/* -------------------- Pedidos: 4 pestañas (v4) --------------------
   Por hacer (lo que me toca a mí) · En curso · Cobros (por cobrar / por conciliar / conciliados)
   · Historial (entregados / anulados). Todo se arma con una sola lista de pedidos. */
function vistasPedidos(rol) {
  const gestion = rol === "master" || rol === "admin";
  return [
    { id: "hacer", nombre: "Por hacer" },
    { id: "curso", nombre: "En curso" },
    { id: "cobros", nombre: "Cobros", ver: [{ id: "cobrar", nombre: "Por cobrar" }, ...(gestion ? [{ id: "conciliar", nombre: "Por conciliar" }] : []), { id: "conciliados", nombre: "Conciliados" }, { id: "comisiones", nombre: "Comisiones" }] },
    { id: "historial", nombre: "Historial", ver: [{ id: "entregado", nombre: "Entregados" }, { id: "cancelado", nombre: "Anulados" }] },
  ];
}
/* Enlaces viejos (?tab=pendiente, ?tab=cobrar…) → pestaña nueva */
const ALIAS_VISTA = {
  pendiente: ["hacer"], web: ["hacer"], curso: ["curso"], cobrar: ["cobros", "cobrar"], conciliar: ["cobros", "conciliar"],
  conciliados: ["cobros", "conciliados"], comisiones: ["cobros", "comisiones"], entregado: ["historial", "entregado"], cancelado: ["historial", "cancelado"],
};
function resolverVista(rol, tab, ver) {
  const vistas = vistasPedidos(rol);
  const [t, v] = ALIAS_VISTA[tab] && !vistas.some((x) => x.id === tab && !ALIAS_VISTA[tab][1]) ? ALIAS_VISTA[tab] : [tab, ver];
  const vista = vistas.find((x) => x.id === t) || vistas[0];
  const sub = vista.ver ? (vista.ver.find((x) => x.id === (ver || v)) || vista.ver[0]) : null;
  return { vistas, vista, sub };
}

/* ¿Qué le toca hacer a cada rol con este pedido? (secciones de "Por hacer") */
function urgenciaCobro(p, hoy) {
  if (p.estado === "cancelado" || p.cobro) return false;
  const ec = estadoCredito(p, hoy);
  if (ec) return ["proximo", "vencido", "muy_vencido"].includes(ec.nivel);
  return p.estado === "entregado"; // contado entregado sin pagar
}
function porHacer(pedidos, rol, uid, hoy = new Date()) {
  const gestion = rol === "master" || rol === "admin";
  const L = pedidos || [];
  if (gestion) {
    return [
      { id: "aprobar", titulo: "Por aprobar", pedidos: L.filter((p) => p.estado === "pendiente") },
      { id: "conciliar", titulo: "Pagos por conciliar", pedidos: L.filter((p) => p.cobro === "cancelado" || Number(p.pagos_pend) > 0) },
    ];
  }
  return [
    { id: "cobrar", titulo: "Para cobrar (vencidos, por vencer o de contado)", pedidos: L.filter((p) => String(p.vendedor_id) === String(uid) && urgenciaCobro(p, hoy))
      // primero lo más vencido, después lo de contado, después lo que está por vencer
      .sort((a, b) => { const d = (p) => { const ec = estadoCredito(p, hoy); return !ec ? 0 : ec.nivel === "proximo" ? 1 + ec.dias : -1 - ec.dias; }; return d(a) - d(b); }) },
  ];
}

function pedidosDeVista(pedidos, vista, ver, { rol, uid, hoy = new Date(), dias = 30 } = {}) {
  const L = pedidos || [];
  switch (vista) {
    case "curso": return filtrarPedidosLocal(L, { estados: ["pendiente", "confirmado", "en_ruta"] }, hoy);
    case "cobros":
      if (ver === "conciliar") return filtrarPedidosLocal(L, { por_conciliar: true }, hoy);
      if (ver === "conciliados" || ver === "comisiones") return filtrarPedidosLocal(L, { conciliados: true, dias }, hoy).sort((a, b) => String(b.conciliado_at || b.created_at).localeCompare(String(a.conciliado_at || a.created_at)));
      return filtrarPedidosLocal(L, { por_cobrar: true }, hoy);
    case "historial": return filtrarPedidosLocal(L, { estados: [ver === "cancelado" ? "cancelado" : "entregado"], dias: 365 }, hoy);
    default: return [].concat(...porHacer(L, rol, uid, hoy).map((s) => s.pedidos));
  }
}

/* Buscar por cliente, número, teléfono o vendedor */
function buscarPedidos(pedidos, q) {
  const t = String(q || "").trim().toLowerCase();
  if (!t) return pedidos || [];
  const dig = t.replace(/\D/g, "");
  return (pedidos || []).filter((p) => {
    const c = p.cliente_datos || {};
    const texto = [p.id, p.negocio, p.cliente, p.vendedor, p.despachador, c.direccion, c.rif_cedula].join(" ").toLowerCase();
    if (texto.includes(t)) return true;
    return dig.length >= 4 && [c.telefono, c.telefono2].some((x) => String(x || "").replace(/\D/g, "").includes(dig));
  });
}

/* Agrupar por día: Hoy, Ayer, o la fecha */
function grupoDia(fecha, hoy = new Date()) {
  const m = String(fecha || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "Sin fecha";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const dif = Math.round((h - d) / DIA);
  if (dif === 0) return "Hoy";
  if (dif === 1) return "Ayer";
  if (dif > 1 && dif < 7) return ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][d.getDay()];
  return `${m[3]}/${m[2]}/${m[1]}`;
}
function agruparPorDia(pedidos, hoy = new Date()) {
  const grupos = [];
  (pedidos || []).forEach((p) => {
    const g = grupoDia(p.fecha, hoy);
    const ult = grupos[grupos.length - 1];
    if (ult && ult.titulo === g) ult.pedidos.push(p); else grupos.push({ titulo: g, pedidos: [p] });
  });
  return grupos;
}

/* Cantidades para los contadores de las pestañas */
function contadoresVistas(pedidos, rol, uid, hoy = new Date()) {
  return {
    hacer: porHacer(pedidos, rol, uid, hoy).reduce((a, s) => a + s.pedidos.length, 0),
    curso: pedidosDeVista(pedidos, "curso", null, { rol, uid, hoy }).length,
    cobros: pedidosDeVista(pedidos, "cobros", "cobrar", { rol, uid, hoy }).length + (rol === "master" || rol === "admin" ? pedidosDeVista(pedidos, "cobros", "conciliar", { rol, uid, hoy }).length : 0),
  };
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

/* ---------- Canal de atención: SOLO 2 opciones en todo el sistema (pedidos, cobros, altas y rutas GPS) ---------- */
const CANALES_ATENCION = [
  { id: "en_persona", nombre: "📍 En persona (Visitado)" },
  { id: "online_telefono", nombre: "📱 Online / Por teléfono" },
];
const RADIO_CERCANIA_M = 120; // cliente "en mi ubicación"
const canalValido = (c) => c === "en_persona" || c === "online_telefono";
const nombreCanal = (c) => (CANALES_ATENCION.find((x) => x.id === c) || { nombre: "" }).nombre;

/* Coordenada usable: número finito, en rango y NO el 0,0 (GPS vacío) */
function gpsValido(lat, lng) {
  if (lat === "" || lng === "" || lat === null || lng === null || lat === undefined || lng === undefined) return false;
  const a = Number(lat), b = Number(lng);
  if (!isFinite(a) || !isFinite(b)) return false;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return false;
  return !(a === 0 && b === 0);
}

/* Distancia en metros entre dos puntos (Haversine) */
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = (x) => (Number(x) * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* Clientes de la cartera a <= radio metros del vendedor. Primero los NO visitados hoy, luego el más cerca.
   fix = { lat, lng } · visitadosHoy = lista/Set de ids · devuelve [{ cliente, dist }] (máx. `max`) */
function clientesCercanos(clientes, fix, opciones = {}) {
  const radio = Number(opciones.radio) > 0 ? Number(opciones.radio) : RADIO_CERCANIA_M;
  const max = Number(opciones.max) > 0 ? Number(opciones.max) : 3;
  if (!fix || !gpsValido(fix.lat, fix.lng)) return [];
  const vistos = new Set(Array.from(opciones.visitadosHoy || []).map(String));
  return (clientes || [])
    .filter((c) => c && gpsValido(c.latitud, c.longitud))
    .map((c) => ({ cliente: c, dist: haversineM(fix.lat, fix.lng, Number(c.latitud), Number(c.longitud)), visto: vistos.has(String(c.id)) }))
    .filter((x) => x.dist <= radio)
    .sort((a, b) => (a.visto - b.visto) || (a.dist - b.dist))
    .slice(0, max)
    .map(({ cliente, dist }) => ({ cliente, dist }));
}

/* Canal que se pre-selecciona al enviar el pedido / cobro:
   - el cliente vino de la sugerencia GPS (o está a <= 120 m) → en persona
   - no hay NINGÚN cliente a <= 120 m (casa / oficina) → online / teléfono
   - hay clientes cerca pero no es este → sin preselección (que el vendedor elija) */
function canalSugerido(cli, fix, cartera) {
  if (cli && canalValido(cli._canal_atencion)) return cli._canal_atencion;
  if (!fix || !gpsValido(fix.lat, fix.lng)) return "";
  if (cli && gpsValido(cli.latitud, cli.longitud) && haversineM(fix.lat, fix.lng, cli.latitud, cli.longitud) <= RADIO_CERCANIA_M) return "en_persona";
  return clientesCercanos(cartera, fix, { max: 1 }).length ? "" : "online_telefono";
}

/* Auto-aprendizaje del GPS del cliente: SOLO si se atendió en persona, el cliente no tenía
   coordenadas y hay una lectura válida. Online / teléfono JAMÁS toca las coordenadas. */
function gpsAprendido(canal, cliente, fix) {
  if (canal !== "en_persona" || !fix || !gpsValido(fix.lat, fix.lng)) return null;
  if (cliente && gpsValido(cliente.latitud, cliente.longitud)) return null;
  return { latitud: Math.round(Number(fix.lat) * 1e6) / 1e6, longitud: Math.round(Number(fix.lng) * 1e6) / 1e6 };
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

/* -------------------- Resumen de Inicio del Vendedor (4 Recuadros + 4 Analytics en $) -------------------- */
function resumenInicioVendedor({ pedidos = [], porCobrar = [], visitasHoy = [], comisionesCfg = {}, uid = "", hoy = new Date(), tasaBcv = 0 } = {}) {
  const tasa = Number(tasaBcv) > 0 ? Number(tasaBcv) : 0;
  const h = hoy instanceof Date && !isNaN(hoy) ? hoy : new Date(hoy);
  const diaHoy = isoDia(h);
  const hDia = soloFecha(h);

  const esDeVend = (x) => !uid || !x || !x.vendedor_id || String(x.vendedor_id) === String(uid);
  const tipoDe = (p) => (p && (p.tipo_pago_real || p.tipo_pago || tipoPagoDe(p.pago))) || "pronto";
  const esBcv = (p) => { const t = tipoDe(p); return t === "credito" || t === "pronto"; };
  const esEfectivo = (p) => { const t = tipoDe(p); return t === "efectivo_credito" || t === "efectivo_pronto"; };
  const montoPedido = (p) => {
    if (!p) return 0;
    const raw = p.total_final !== "" && p.total_final != null ? p.total_final : p.total;
    if (raw !== "" && raw != null && Number.isFinite(Number(raw)) && Number(raw) > 0) return r2(Number(raw));
    if (Array.isArray(p.items) && p.items.length) return totalPorPago(p.items, tipoDe(p));
    return r2(Number(raw) || 0);
  };
  const saldoPedido = (p) => {
    if (!p) return 0;
    if (p.saldo !== "" && p.saldo != null && Number.isFinite(Number(p.saldo))) return r2(Math.max(0, Number(p.saldo)));
    return r2(Math.max(0, montoPedido(p) - (Number(p.pagado_usd) || 0)));
  };
  const clienteKey = (p) => String((p && (p.cliente_id || p.negocio || p.cliente)) || "").trim();
  const fechaObjDe = (p) => {
    if (!p) return null;
    if (p.created_at) {
      const d = new Date(p.created_at);
      if (!isNaN(d)) return d;
    }
    const m = String(p.fecha || p.created_at || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    return null;
  };
  const esDeHoy = (p) => {
    if (!p) return false;
    if (p.fecha && String(p.fecha).trim().slice(0, 10) === diaHoy) return true;
    if (p.created_at) {
      const d = new Date(p.created_at);
      if (!isNaN(d) && isoDia(d) === diaHoy) return true;
      if (String(p.created_at).trim().slice(0, 10) === diaHoy) return true;
    }
    return false;
  };

  const pedsVend = (pedidos || []).filter((p) => p && !p.borrado && esDeVend(p));
  const pedsValidos = pedsVend.filter((p) => p.estado !== "cancelado");

  // 1) Recuadro 1 — ventasHoy (Ventas Hoy en $)
  const pedsHoy = pedsValidos.filter(esDeHoy);
  let hoyBcvUsd = 0, hoyEfectivoUsd = 0;
  pedsHoy.forEach((p) => {
    const m = montoPedido(p);
    if (esEfectivo(p)) hoyEfectivoUsd = r2(hoyEfectivoUsd + m);
    else hoyBcvUsd = r2(hoyBcvUsd + m);
  });
  const ventasHoy = {
    bcvUsd: hoyBcvUsd,
    bcvBs: r2(hoyBcvUsd * tasa),
    efectivoUsd: hoyEfectivoUsd,
    totalUsd: r2(hoyBcvUsd + hoyEfectivoUsd),
  };

  // 2) Recuadro 2 — pedidosHoy (Pedidos Hoy)
  const pedidosHoy = {
    cantidad: pedsHoy.length,
    clientesUnicos: new Set(pedsHoy.map(clienteKey).filter(Boolean)).size,
    enProceso: pedsValidos.filter((p) => p.estado === "pendiente").length,
    enDespacho: pedsValidos.filter((p) => p.estado === "confirmado" || p.estado === "en_ruta").length,
  };

  // Base de cuentas por cobrar (usa porCobrar o filtra pedidos activos con saldo > 0)
  const mapaCobrar = {};
  const fuenteCobrar = Array.isArray(porCobrar) && porCobrar.length
    ? porCobrar
    : pedsValidos.filter((p) => Number(p.dias_credito) > 0 || p.estado === "entregado");
  fuenteCobrar.forEach((p) => {
    if (!p || p.borrado || !esDeVend(p)) return;
    if (p.estado === "cancelado" || p.cobro || !(saldoPedido(p) > 0)) return;
    mapaCobrar[p.id || Math.random()] = p;
  });
  const activosCobrar = Object.values(mapaCobrar);

  const esPedidoVencido = (p) => {
    const ec = estadoCredito(p, h);
    if (ec && (ec.nivel === "vencido" || ec.nivel === "muy_vencido")) return true;
    if (Number(p.dias_credito) === 0 && p.estado === "entregado" && !prontoVigente(p.entregado_at, h)) return true;
    return false;
  };

  const listaVencidos = [];
  const listaPorVencer = [];
  activosCobrar.forEach((p) => {
    if (esPedidoVencido(p)) listaVencidos.push(p);
    else listaPorVencer.push(p);
  });

  // 3) Recuadro 3 — cobrarVencido (Pendiente por cobrar · VENCIDO)
  let vencBcvUsd = 0, vencEfUsd = 0;
  listaVencidos.forEach((p) => {
    const s = saldoPedido(p);
    if (esEfectivo(p)) vencEfUsd = r2(vencEfUsd + s);
    else vencBcvUsd = r2(vencBcvUsd + s);
  });

  const infoVencido = (p) => {
    const ec = estadoCredito(p, h);
    let diasAtraso = 1, textoEstado = "Vencido";
    if (ec && (ec.nivel === "vencido" || ec.nivel === "muy_vencido")) {
      diasAtraso = Number(ec.dias) || 1;
      textoEstado = ec.texto;
    } else if (p.entregado_at) {
      const dEnt = new Date(p.entregado_at);
      if (!isNaN(dEnt)) {
        diasAtraso = Math.max(1, Math.round((hDia - soloFecha(dEnt)) / DIA));
        textoEstado = `Vencido hace ${diasAtraso} día${diasAtraso === 1 ? "" : "s"}`;
      }
    }
    const tel = String((p.cliente_datos && p.cliente_datos.telefono) || p.telefono || "").trim();
    return {
      id: String(p.id || ""),
      cliente_id: String(p.cliente_id || ""),
      negocio: String(p.negocio || p.cliente || "—"),
      telefono: tel,
      whatsapp: telefonoWhatsapp(tel),
      diasAtraso,
      textoEstado,
      saldoUsd: saldoPedido(p),
      modalidad: esEfectivo(p) ? "Efectivo" : "BCV",
    };
  };
  const topVencidos = listaVencidos
    .map(infoVencido)
    .sort((a, b) => b.diasAtraso - a.diasAtraso || b.saldoUsd - a.saldoUsd)
    .slice(0, 3);

  const cobrarVencido = {
    clientesUnicos: new Set(listaVencidos.map(clienteKey).filter(Boolean)).size,
    pedidosCount: listaVencidos.length,
    totalUsd: r2(vencBcvUsd + vencEfUsd),
    bcvUsd: vencBcvUsd,
    bcvBs: r2(vencBcvUsd * tasa),
    efectivoUsd: vencEfUsd,
    topVencidos,
  };

  // 4) Recuadro 4 — cobrarPorVencer (Pendiente por cobrar · AÚN NO VENCE)
  let pvBcvUsd = 0, pvEfUsd = 0, proximosCount = 0;
  listaPorVencer.forEach((p) => {
    const s = saldoPedido(p);
    if (esEfectivo(p)) pvEfUsd = r2(pvEfUsd + s);
    else pvBcvUsd = r2(pvBcvUsd + s);
    const ec = estadoCredito(p, h);
    if (ec && ec.nivel === "proximo") proximosCount++;
  });
  const cobrarPorVencer = {
    clientesUnicos: new Set(listaPorVencer.map(clienteKey).filter(Boolean)).size,
    pedidosCount: listaPorVencer.length,
    proximosCount,
    totalUsd: r2(pvBcvUsd + pvEfUsd),
    bcvUsd: pvBcvUsd,
    bcvBs: r2(pvBcvUsd * tasa),
    efectivoUsd: pvEfUsd,
  };

  // Analytics 1 — cobrosYComision (💵 Mi Comisión y Cobros del Día)
  const mapaTodosPeds = {};
  pedsValidos.concat(activosCobrar).forEach((p) => { if (p && p.id) mapaTodosPeds[p.id] = p; });
  const listaTodosPeds = Object.values(mapaTodosPeds).length ? Object.values(mapaTodosPeds) : pedsValidos;

  let cobHoyEfUsd = 0, cobHoyBs = 0, cobHoyEqUsd = 0, cobHoyPend = 0, cobHoyCant = 0;
  listaTodosPeds.forEach((p) => {
    const pagos = Array.isArray(p.pagos) && p.pagos.length
      ? p.pagos
      : (p.cobro && Number(p.monto) > 0
        ? [{
            fecha_pago: String(p.cobrado_at || p.conciliado_at || "").slice(0, 10),
            moneda: p.moneda === "Bs" ? "Bs" : "USD",
            monto: Number(p.monto) || 0,
            monto_usd: Number(p.total_final || p.total) || (p.moneda === "Bs" ? 0 : Number(p.monto) || 0),
            tasa: Number(p.tasa) || 0,
            estado: p.cobro === "conciliado" ? "conciliado" : "pendiente",
          }]
        : []);
    pagos.forEach((pg) => {
      if (!pg || pg.estado === "rechazado") return;
      const fp = String(pg.fecha_pago || pg.created_at || "").slice(0, 10);
      if (fp !== diaHoy) return;
      cobHoyCant++;
      if (pg.estado !== "conciliado") cobHoyPend++;
      if (pg.moneda === "Bs") {
        const mBs = Number(pg.monto) || 0;
        cobHoyBs = r2(cobHoyBs + mBs);
        const tPg = Number(pg.tasa) || tasa || 0;
        const eq = Number(pg.monto_usd) || (tPg > 0 ? r2(mBs / tPg) : 0);
        cobHoyEqUsd = r2(cobHoyEqUsd + eq);
      } else {
        const mUsd = Number(pg.monto_usd) || Number(pg.monto) || 0;
        cobHoyEfUsd = r2(cobHoyEfUsd + mUsd);
        cobHoyEqUsd = r2(cobHoyEqUsd + mUsd);
      }
    });
  });

  const comItems = extraerComisiones(listaTodosPeds, comisionesCfg).filter((it) => !it.pagada && (!uid || !it.vendedor_id || String(it.vendedor_id) === String(uid)));
  const comEfUsd = r2(comItems.filter((x) => x.moneda !== "Bs").reduce((a, x) => a + (Number(x.comision_usd) || 0), 0));
  const comBcvUsd = r2(comItems.filter((x) => x.moneda === "Bs").reduce((a, x) => a + (Number(x.comision_usd) || 0), 0));
  const comBcvBs = r2(comItems.filter((x) => x.moneda === "Bs").reduce((a, x) => a + (Number(x.comision_bs_origen) || 0), 0));

  const cobrosYComision = {
    cobrosHoy: {
      cantidad: cobHoyCant,
      efectivoUsd: cobHoyEfUsd,
      bs: cobHoyBs,
      equivalenteUsd: cobHoyEqUsd,
      pendientesConciliar: cobHoyPend,
    },
    comisiones: {
      pendientesCount: comItems.length,
      efectivoUsd: comEfUsd,
      bcvUsd: comBcvUsd,
      bcvBs: comBcvBs,
      totalUsd: r2(comEfUsd + comBcvUsd),
    },
  };

  // Analytics 3 — ritmo (📈 Ritmo Comercial 7 días / 30 días — Basado en Total de Ventas en $)
  const enRangoDias = (p, maxDias) => {
    if (esDeHoy(p)) return true;
    const d = fechaObjDe(p);
    if (!d) return false;
    const dif = Math.round((hDia - soloFecha(d)) / DIA);
    return dif >= 0 && dif <= maxDias;
  };
  const calcularRitmo = (dias) => {
    const pedsPer = pedsValidos.filter((p) => enRangoDias(p, dias));
    let bcvUsd = 0, efectivoUsd = 0;
    pedsPer.forEach((p) => {
      const m = montoPedido(p);
      if (esEfectivo(p)) efectivoUsd = r2(efectivoUsd + m);
      else bcvUsd = r2(bcvUsd + m);
    });
    const totalUsd = r2(bcvUsd + efectivoUsd);
    const pctBcv = totalUsd > 0 ? Math.round((bcvUsd / totalUsd) * 100) : 0;
    const pctEfectivo = totalUsd > 0 ? 100 - pctBcv : 0;
    const nPeds = pedsPer.length;
    return {
      dias,
      totalUsd,
      bcvUsd,
      efectivoUsd,
      pctBcv,
      pctEfectivo,
      pedidos: nPeds,
      ticketPromedioUsd: nPeds > 0 ? r2(totalUsd / nPeds) : 0,
    };
  };
  const r7 = calcularRitmo(7);
  const r30 = calcularRitmo(30);
  const ritmo = { d7: r7, d30: r30, 7: r7, 30: r30 };

  // Analytics 4 — topProductos y coberturaHoy
  const setPersona = new Set();
  const setOnline = new Set();
  pedsHoy.forEach((p) => {
    const k = clienteKey(p) || String(p.id || "");
    if (!k) return;
    const c = p.canal_pedido || p.canal || (p.cliente_datos && p.cliente_datos._canal_atencion) || "";
    if (c === "en_persona") setPersona.add(k);
    else if (c === "online_telefono") setOnline.add(k);
  });
  (visitasHoy || []).forEach((v) => {
    if (!v) return;
    if (typeof v === "string" || typeof v === "number") {
      setPersona.add(String(v));
      return;
    }
    if (v.anulada) return;
    if (uid && v.vendedor_id && String(v.vendedor_id) !== String(uid)) return;
    if (v.fecha && String(v.fecha).slice(0, 10) !== diaHoy) return;
    const k = String(v.cliente_id || v.negocio || v.id || "").trim();
    if (!k) return;
    if (v.canal === "online_telefono") setOnline.add(k);
    else setPersona.add(k);
  });
  const coberturaHoy = {
    en_persona: setPersona.size,
    online_telefono: setOnline.size,
    enPersona: setPersona.size,
    onlineTelefono: setOnline.size,
    totalClientes: new Set([...setPersona, ...setOnline]).size,
  };

  const mapaProd = {};
  pedsValidos.filter((p) => enRangoDias(p, 30)).forEach((p) => {
    const tipo = tipoDe(p);
    const totPed = montoPedido(p);
    const totCajas = Number(p.total_cajas) || (p.items || []).reduce((a, i) => a + (Number(i.cajas) || 0), 0) || 0;
    (p.items || []).forEach((it) => {
      const cajas = Number(it.cajas) || 0;
      if (!(cajas > 0) || !it.code) return;
      const k = String(it.code);
      const entry = mapaProd[k] || (mapaProd[k] = { code: k, producto: String(it.producto || k), totalUsd: 0, cajas: 0, pedidosSet: new Set() });
      const uPrecio = precioUnitario(it, tipo);
      const subUsd = Number(it.subtotal_usd) > 0
        ? Number(it.subtotal_usd)
        : uPrecio > 0
          ? r2(cajas * uPrecio)
          : (totPed > 0 && totCajas > 0 ? r2(totPed * (cajas / totCajas)) : 0);
      entry.totalUsd = r2(entry.totalUsd + subUsd);
      entry.cajas += cajas;
      entry.pedidosSet.add(String(p.id || Math.random()));
    });
  });
  const topProductos = Object.values(mapaProd)
    .map((x) => ({ code: x.code, producto: x.producto, totalUsd: r2(x.totalUsd), cajas: x.cajas, pedidos: x.pedidosSet.size }))
    .sort((a, b) => b.totalUsd - a.totalUsd || b.cajas - a.cajas || a.code.localeCompare(b.code))
    .slice(0, 3);

  return {
    ventasHoy,
    pedidosHoy,
    cobrarVencido,
    cobrarPorVencer,
    cobrosYComision,
    topVencidos,
    ritmo,
    topProductos,
    coberturaHoy,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { itemsDePedido, telefonoWhatsapp, linkMapa, fechaLegible, mensajeGrupo, validarCliente, expiracionToken, nuevoRef,
    nombreEstado, puedeTomarPedidos, accionesPedido, pestanasPanel, cajasPorEntregar, cajasPendientes, esParcial, coordsDeTexto, estadoCredito, totalCarga,
    monedaDePago, formatoMonto, resumenConciliados,
    CAJAS_MAYOR, PAGOS, pagoPorId, tipoPagoDe, nivelPrecio, conPrecios, precioUnitario, totalPorPago, totalesPorPago, descuentoMaximo, sinPrecio, dinero, evaluarCobro, cambiosDePrecio, extraerComisiones, resumenInicioVendedor,
    limitePronto, prontoVigente, textoStock, topeStock, puedeBorrar, refWeb, mensajeWeb,
    vistasPedidos, resolverVista, porHacer, urgenciaCobro, pedidosDeVista, buscarPedidos, grupoDia, agruparPorDia, contadoresVistas,
    HORAS_SYNC, debeSincronizar, proximaSync, filtrarPedidosLocal, buscarClientesLocal, respuestaLocal, estadoApp,
    CANALES_ATENCION, RADIO_CERCANIA_M, canalValido, nombreCanal, gpsValido, haversineM, clientesCercanos, canalSugerido, gpsAprendido };
}
