/* Tests de js/crm-core.js — node --test tests/crm-core.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../js/crm-core.js");

const PRODUCTOS = {
  "BC-01": { code: "BC-01", name: "Babosa", unidades: 6, unidad: "unidades" },
  "KT-01": { code: "KT-01", name: "Kit 12 em 1", unidades: 6, unidad: "dúos" },
};

test("itemsDePedido arma items ordenados y omite cantidades en 0", () => {
  const items = core.itemsDePedido({ "KT-01": 1, "BC-01": 2, "BC-99": 0 }, PRODUCTOS);
  assert.deepEqual(items, [
    { code: "BC-01", producto: "Babosa", cajas: 2, unidades_caja: 6, unidad: "unidades", total_unidades: 12 },
    { code: "KT-01", producto: "Kit 12 em 1", cajas: 1, unidades_caja: 6, unidad: "dúos", total_unidades: 6 },
  ]);
});

test("telefonoWhatsapp convierte números venezolanos", () => {
  assert.equal(core.telefonoWhatsapp("0412-1234567"), "584121234567");
  assert.equal(core.telefonoWhatsapp("+58 414 555 0000"), "584145550000");
  assert.equal(core.telefonoWhatsapp("4241112233"), "584241112233");
  assert.equal(core.telefonoWhatsapp("123"), "");
});

test("linkMapa con coordenadas; vacío sin ellas", () => {
  assert.equal(core.linkMapa(8.612346, -71.654322), "https://maps.google.com/?q=8.612346,-71.654322");
  assert.equal(core.linkMapa("", ""), "");
});

const PEDIDO = {
  id: "SKL-261025-007", fecha: "2026-10-25 14:32", vendedor: "Óscar", total_cajas: 3,
  detalle_unidades: "12 unidades + 6 dúos", pago: "Divisas · Contado", nota: "Entregar viernes",
  items: [
    { code: "BC-01", producto: "Babosa", cajas: 2, total_unidades: 12, unidad: "unidades" },
    { code: "KT-01", producto: "Kit 12 em 1", cajas: 1, total_unidades: 6, unidad: "dúos" },
  ],
};
const CLIENTE = {
  contacto: "María Pérez", nombre: "Peluquería Bella", rif_cedula: "J-12345678-9",
  telefono: "0412-1234567", telefono2: "0275-8812345", direccion: "Av. Bolívar, El Vigía",
  latitud: 8.612346, longitud: -71.654322,
};

test("mensajeGrupo: formato fácil de leer para la oficina", () => {
  const m = core.mensajeGrupo(PEDIDO, CLIENTE);
  assert.equal(m, [
    "*PEDIDO SKL-261025-007*",
    "25/10/2026 · 14:32 · Vendedor: Óscar",
    "",
    "*Cliente*",
    "Peluquería Bella · María Pérez",
    "RIF: J-12345678-9",
    "Tel: 0412-1234567 / 0275-8812345",
    "Dirección: Av. Bolívar, El Vigía",
    "Ubicación: https://maps.google.com/?q=8.612346,-71.654322",
    "",
    "*Productos*",
    "• 2 × Babosa (BC-01) = 12 unidades",
    "• 1 × Kit 12 em 1 (KT-01) = 6 dúos",
    "",
    "*Total: 3 cajas* · 12 unidades + 6 dúos",
    "Pago: Divisas · Contado",
    "Nota: Entregar viernes",
  ].join("\n"));
});

test("mensajeGrupo omite líneas vacías (sin RIF, tel2, GPS ni nota)", () => {
  const m = core.mensajeGrupo({ ...PEDIDO, nota: "", pago: "", total_cajas: 1, items: [PEDIDO.items[1]], detalle_unidades: "6 dúos" },
    { nombre: "Barbería Max", contacto: "", telefono: "0416-5550000" });
  assert.ok(!/RIF|Ubicación|Nota|Pago|Dirección/.test(m), m);
  assert.match(m, /Barbería Max\nTel: 0416-5550000\n/);
  assert.match(m, /\*Total: 1 caja\* · 6 dúos/);
});

test("mensajeGrupo marca el estado si no está pendiente", () => {
  assert.match(core.mensajeGrupo({ ...PEDIDO, estado: "cancelado", motivo: "Cerrado" }, CLIENTE), /^\*PEDIDO SKL-261025-007 — ANULADO\*/);
});

test("validarCliente exige nombre/negocio y teléfono válido", () => {
  assert.deepEqual(core.validarCliente({ negocio: "X", telefono: "0412-1234567" }), []);
  assert.deepEqual(core.validarCliente({ telefono: "0412-1234567" }), ["Nombre del cliente o del negocio"]);
  assert.deepEqual(core.validarCliente({ contacto: "Ana", telefono: "12" }), ["Teléfono 1 (mínimo 7 números)"]);
});

test("expiracionToken lee la fecha del token", () => {
  assert.equal(core.expiracionToken("V1.1793000000000.abc"), 1793000000000);
  assert.equal(core.expiracionToken("malo"), 0);
});

test("nuevoRef genera ids únicos", () => {
  const a = core.nuevoRef(), b = core.nuevoRef();
  assert.match(a, /^[0-9a-f-]{20,}$/);
  assert.notEqual(a, b);
});

/* ---------- v2: roles ---------- */
const P = (estado, extra = {}) => ({ id: "SKL-1", estado, vendedor_id: "U3", despachador_id: "U5", ...extra });

test("acciones de gestión (master/admin) según estado", () => {
  for (const rol of ["master", "admin"]) {
    assert.deepEqual(core.accionesPedido(rol, "U2", P("pendiente")), ["confirmar", "cancelar"]);
    assert.deepEqual(core.accionesPedido(rol, "U2", P("confirmado")), ["en_ruta", "reasignar", "cancelar"]);
    assert.deepEqual(core.accionesPedido(rol, "U2", P("en_ruta")), ["entregado", "reasignar", "cancelar"]);
    assert.deepEqual(core.accionesPedido(rol, "U2", P("entregado")), ["conciliar", "reabrir"]);
    assert.deepEqual(core.accionesPedido(rol, "U2", P("cancelado")), ["reabrir"]);
  }
});

test("vendedor: solo cancelar sus pedidos pendientes", () => {
  assert.deepEqual(core.accionesPedido("vendedor", "U3", P("pendiente")), ["cancelar"]);
  assert.deepEqual(core.accionesPedido("vendedor", "U4", P("pendiente")), []);
  assert.deepEqual(core.accionesPedido("vendedor", "U3", P("confirmado")), []);
});

test("despachador: en ruta / entregado solo en los asignados", () => {
  assert.deepEqual(core.accionesPedido("despachador", "U5", P("confirmado")), ["en_ruta", "entregado"]);
  assert.deepEqual(core.accionesPedido("despachador", "U5", P("en_ruta")), ["entregado"]);
  assert.deepEqual(core.accionesPedido("despachador", "U6", P("en_ruta")), []);
  assert.deepEqual(core.accionesPedido("despachador", "U5", P("entregado")), []);
});

test("pestañas del panel por rol", () => {
  const ids = (rol) => core.pestanasPanel(rol).map((t) => t.id);
  assert.deepEqual(ids("vendedor"), ["pendiente", "web", "curso", "entregado", "cobrar", "conciliados", "cancelado", "resumen"]);
  assert.deepEqual(ids("admin"), ["pendiente", "web", "curso", "entregado", "cobrar", "conciliar", "conciliados", "cancelado", "resumen"]);
  assert.deepEqual(ids("master"), ["pendiente", "web", "curso", "entregado", "cobrar", "conciliar", "conciliados", "cancelado", "resumen", "usuarios"]);
  assert.deepEqual(ids("despachador"), ["curso", "entregado"]);
  assert.equal(core.pestanasPanel("admin")[0].nombre, "Por aprobar");
  assert.equal(core.pestanasPanel("vendedor")[0].nombre, "En proceso");
  assert.equal(core.pestanasPanel("admin").find((t) => t.id === "cancelado").nombre, "Anulados");
  assert.equal(core.pestanasPanel("despachador")[0].nombre, "Por entregar");
  assert.deepEqual(core.pestanasPanel("admin")[2].estados, ["confirmado", "en_ruta"]);
});

test("puedeTomarPedidos y nombre de estado", () => {
  assert.equal(core.puedeTomarPedidos("vendedor"), true);
  assert.equal(core.puedeTomarPedidos("master"), true);
  assert.equal(core.puedeTomarPedidos("despachador"), false);
  assert.equal(core.nombreEstado("en_ruta"), "En ruta");
  assert.equal(core.nombreEstado("pendiente"), "En proceso");
  assert.equal(core.nombreEstado("confirmado"), "Aprobado · Preparando despacho");
  assert.equal(core.nombreEstado("cancelado"), "Anulado");
  assert.match(core.mensajeGrupo({ ...PEDIDO, estado: "en_ruta" }, CLIENTE), /^\*PEDIDO SKL-261025-007 — EN RUTA\*/);
});

/* ---------- Ubicación pegada (traspaso de clientes) ---------- */
test("coordsDeTexto entiende coordenadas y enlaces de Google Maps", () => {
  const c = core.coordsDeTexto;
  assert.deepEqual(c("8.612346, -71.654322"), { lat: 8.612346, lng: -71.654322 });
  assert.deepEqual(c("8.6123,-71.6543"), { lat: 8.6123, lng: -71.6543 });
  assert.deepEqual(c("https://maps.google.com/?q=8.61,-71.65"), { lat: 8.61, lng: -71.65 });
  assert.deepEqual(c("https://www.google.com/maps/place/Bella/@8.6123456,-71.6543219,17z/data=x"), { lat: 8.612346, lng: -71.654322 });
  assert.deepEqual(c("https://www.google.com/maps/place/x/data=!3d8.61!4d-71.65"), { lat: 8.61, lng: -71.65 });
  assert.deepEqual(c("https://www.google.com/maps/search/?api=1&query=8.5,-71.2"), { lat: 8.5, lng: -71.2 });
  assert.equal(c("https://maps.app.goo.gl/abc123"), null);   // enlace corto: no trae coordenadas
  assert.equal(c("Av. Bolívar"), null);
  assert.equal(c("200, 300"), null);                          // fuera de rango
  assert.equal(c(""), null);
});

test("validarCliente para alta manual: teléfono opcional", () => {
  assert.deepEqual(core.validarCliente({ negocio: "X" }, { telefonoOpcional: true }), []);
  assert.deepEqual(core.validarCliente({ negocio: "X", telefono: "12" }, { telefonoOpcional: true }), ["Teléfono 1 (mínimo 7 números)"]);
  assert.deepEqual(core.validarCliente({}, { telefonoOpcional: true }), ["Nombre del cliente o del negocio"]);
});

test("mensajeGrupo incluye si es nota de entrega o factura", () => {
  assert.match(core.mensajeGrupo({ ...PEDIDO, documento: "Factura" }, CLIENTE), /Pago: Divisas · Contado\nDocumento: Factura\nNota:/);
});

/* ---------- Crédito: banderas por vencimiento ---------- */
test("estadoCredito: cuenta desde la entrega; verde, amarilla, roja y morada", () => {
  const ent = { estado: "entregado", dias_credito: 15, entregado_at: "2026-10-01T15:00:00Z", fecha: "2026-09-30 10:00" };
  const en = (hoy) => core.estadoCredito(ent, new Date(hoy));
  assert.deepEqual(en("2026-10-05T12:00:00"), { nivel: "al_dia", vence: "2026-10-16", dias: 11, texto: "Vence en 11 días" });
  assert.equal(en("2026-10-13T12:00:00").nivel, "proximo");              // faltan 3
  assert.equal(en("2026-10-16T12:00:00").texto, "Vence hoy");
  assert.equal(en("2026-10-17T12:00:00").nivel, "vencido");
  assert.equal(en("2026-10-17T12:00:00").texto, "Vencido hace 1 día");
  assert.equal(en("2026-10-31T12:00:00").nivel, "vencido");              // 15 días
  assert.equal(en("2026-11-01T12:00:00").nivel, "muy_vencido");          // 16 días
  assert.equal(en("2026-11-01T12:00:00").texto, "Vencido hace 16 días");
});

test("estadoCredito: sin entregar todavía, pagado, contado o anulado", () => {
  const base = { dias_credito: 7, fecha: "2026-10-01 10:00" };
  assert.deepEqual(core.estadoCredito({ ...base, estado: "confirmado" }, new Date("2026-10-02")), { nivel: "sin_entregar", vence: "", dias: 7, texto: "Crédito 7 días · cuenta desde la entrega" });
  const pag = { ...base, estado: "entregado", entregado_at: "2026-10-02T10:00:00Z" };
  assert.deepEqual(core.estadoCredito({ ...pag, cobro: "cancelado" }, new Date("2026-12-01")), { nivel: "por_conciliar", vence: "2026-10-09", dias: 0, texto: "Cancelado · por conciliar" });
  assert.equal(core.estadoCredito({ ...pag, cobro: "conciliado" }, new Date("2026-12-01")).texto, "Conciliado");
  assert.equal(core.estadoCredito({ ...base, dias_credito: 0, estado: "entregado" }, new Date()), null);
  assert.equal(core.estadoCredito({ ...base, estado: "cancelado" }, new Date()), null);
});

/* ---------- Total de carga del despachador ---------- */
test("totalCarga suma cajas por producto de los pedidos elegidos", () => {
  const peds = [
    { id: "A", total_cajas: 3, items: [{ code: "BC-01", producto: "Babosa", cajas: 2, total_unidades: 12, unidad: "unidades" }, { code: "KT-01", producto: "Kit 12 em 1", cajas: 1, total_unidades: 6, unidad: "dúos" }] },
    { id: "B", total_cajas: 4, items: [{ code: "BC-01", producto: "Babosa", cajas: 4, total_unidades: 24, unidad: "unidades" }] },
  ];
  const t = core.totalCarga(peds);
  assert.equal(t.pedidos, 2);
  assert.equal(t.cajas, 7);
  assert.deepEqual(t.productos, [
    { code: "BC-01", producto: "Babosa", cajas: 6, total_unidades: 36, unidad: "unidades" },
    { code: "KT-01", producto: "Kit 12 em 1", cajas: 1, total_unidades: 6, unidad: "dúos" },
  ]);
  assert.equal(t.unidades, "36 unidades + 6 dúos");
  assert.equal(core.totalCarga([]).cajas, 0);
});

test("cobro: vendedor marca cancelado; administración concilia o rechaza", () => {
  const ent = { id: "X", estado: "entregado", vendedor_id: "U3", despachador_id: "U5", cobro: "" };
  assert.deepEqual(core.accionesPedido("vendedor", "U3", ent), ["cobrar"]);
  assert.deepEqual(core.accionesPedido("vendedor", "U4", ent), []);
  assert.deepEqual(core.accionesPedido("vendedor", "U3", { ...ent, cobro: "cancelado" }), []);
  assert.deepEqual(core.accionesPedido("admin", "U2", ent), ["conciliar", "reabrir"]);
  assert.deepEqual(core.accionesPedido("admin", "U2", { ...ent, cobro: "cancelado" }), ["conciliar", "rechazar"]);
  assert.deepEqual(core.accionesPedido("master", "U1", { ...ent, cobro: "conciliado" }), ["desconciliar"]);
  assert.deepEqual(core.accionesPedido("despachador", "U5", ent), []);
});

test("pestañas Por cobrar (todos los que venden) y Por conciliar (solo Administración y Master)", () => {
  const ids = (r) => core.pestanasPanel(r).map((t) => t.id);
  assert.ok(core.pestanasPanel("vendedor").some((t) => t.id === "cobrar" && t.filtro === "por_cobrar"));
  assert.ok(ids("admin").includes("cobrar") && ids("admin").includes("conciliar"));
  assert.ok(ids("master").includes("conciliar"));
  assert.ok(!ids("vendedor").includes("conciliar"));
  assert.ok(!ids("despachador").includes("cobrar"));
});

test("mensajeGrupo muestra los días de crédito", () => {
  assert.match(core.mensajeGrupo({ ...PEDIDO, pago: "Divisas · Crédito", dias_credito: 15 }, CLIENTE), /Pago: Divisas · Crédito \(15 días\)/);
});

/* ---------- Conciliados: totales ---------- */
test("monedaDePago y formatoMonto", () => {
  assert.equal(core.monedaDePago("Bolívares · Contado"), "Bs");
  assert.equal(core.monedaDePago("Divisas · Crédito"), "USD");
  assert.equal(core.formatoMonto(1234.5, "USD"), "USD 1.234,50");
  assert.equal(core.formatoMonto(3600, "Bs"), "Bs 3.600,00");
});

test("resumenConciliados suma dinero por moneda, por vendedor y por método de pago", () => {
  const peds = [
    { id: "A", vendedor: "Óscar", pago: "Divisas · Contado", monto: 100, moneda: "USD", total_cajas: 3, items: [{ code: "BC-01", producto: "Babosa", cajas: 3, total_unidades: 18, unidad: "unidades" }] },
    { id: "B", vendedor: "Kevin", pago: "Bolívares · Contado", monto: 3600, moneda: "Bs", total_cajas: 2, items: [{ code: "BC-01", producto: "Babosa", cajas: 2, total_unidades: 12, unidad: "unidades" }] },
    { id: "C", vendedor: "Óscar", pago: "Divisas · Crédito", monto: 50.5, moneda: "USD", total_cajas: 1, items: [{ code: "KT-01", producto: "Kit 12 em 1", cajas: 1, total_unidades: 6, unidad: "dúos" }] },
  ];
  const r = core.resumenConciliados(peds);
  assert.equal(r.pedidos, 3);
  assert.equal(r.cajas, 6);
  assert.deepEqual(r.montos, { USD: 150.5, Bs: 3600 });
  assert.deepEqual(r.por_vendedor, [
    { nombre: "Óscar", pedidos: 2, cajas: 4, USD: 150.5, Bs: 0 },
    { nombre: "Kevin", pedidos: 1, cajas: 2, USD: 0, Bs: 3600 },
  ]);
  assert.deepEqual(r.por_pago.map((x) => [x.nombre, x.pedidos]), [["Divisas · Contado", 1], ["Divisas · Crédito", 1], ["Bolívares · Contado", 1]]);
  assert.equal(r.productos[0].code, "BC-01");
  assert.equal(r.productos[0].cajas, 5);
  assert.deepEqual(core.resumenConciliados([]).montos, { USD: 0, Bs: 0 });
});

/* ---------- Precios (v3) ---------- */
const PRECIOS = {
  "BC-01": { menor: 10, mayor: 8, desc_pronto: 1, desc_efectivo_credito: 3, desc_efectivo_pronto: 4 },
  "KT-01": { menor: 20, mayor: 18, desc_pronto: 2, desc_efectivo_credito: 6, desc_efectivo_pronto: 8 },
};
const ITS = [{ code: "BC-01", producto: "Babosa", cajas: 2 }, { code: "KT-01", producto: "Kit", cajas: 1 }, { code: "BC-09", producto: "Lisos", cajas: 1 }];

test("nivel de precio: menor < 15 cajas, mayor desde 15 o por excepción", () => {
  assert.equal(core.nivelPrecio(14, false), "menor");
  assert.equal(core.nivelPrecio(15, false), "mayor");
  assert.equal(core.nivelPrecio(3, true), "mayor");
});

test("totales por forma de pago con descuentos (ej. 100 → 90 / 70 / 60)", () => {
  const its = core.conPrecios(ITS, PRECIOS, "menor");
  assert.deepEqual(its.map((x) => x.precio), [10, 20, 0]);
  assert.deepEqual(core.sinPrecio(its), ["BC-09"]);
  const t = core.totalesPorPago(its);
  assert.deepEqual(t.map((x) => [x.id, x.total, x.ahorro]), [["credito", 40, 0], ["pronto", 36, 4], ["efectivo_credito", 28, 12], ["efectivo_pronto", 24, 16]]);
  const may = core.conPrecios(ITS, PRECIOS, "mayor");
  assert.equal(core.totalPorPago(may, "credito"), 34);
  assert.equal(core.precioUnitario({ precio: 2, desc_efectivo_pronto: 5 }, "efectivo_pronto"), 0); // nunca negativo
  // ejemplo del dueño: 10 cajas de 10 $ con descuentos 1 / 3 / 4 por caja
  const ej = core.conPrecios([{ code: "BC-01", cajas: 10 }], PRECIOS, "menor");
  assert.deepEqual(core.totalesPorPago(ej).map((x) => x.total), [100, 90, 70, 60]);
  assert.equal(core.dinero(1234.5), "1.234,50 $");
});

test("tipo de pago desde texto viejo y pronto pago hasta el día siguiente a la entrega", () => {
  assert.equal(core.tipoPagoDe("Divisas · Crédito"), "credito");
  assert.equal(core.tipoPagoDe("Bolívares · Contado"), "pronto");
  assert.equal(core.tipoPagoDe("Efectivo a crédito"), "efectivo_credito");
  assert.equal(core.tipoPagoDe("Efectivo pronto pago"), "efectivo_pronto");
  const ent = new Date(2026, 9, 25, 10, 0).toISOString();
  assert.equal(core.prontoVigente(ent, new Date(2026, 9, 26, 23, 0)), true);
  assert.equal(core.prontoVigente(ent, new Date(2026, 9, 27, 0, 1)), false);
  assert.equal(core.prontoVigente("", new Date()), true);
});

test("stock para el vendedor", () => {
  assert.equal(core.textoStock({ controlado: true, disponible: 4 }), "Hay 4");
  assert.equal(core.textoStock({ controlado: true, disponible: 0 }), "Agotado");
  assert.equal(core.textoStock({ controlado: false, disponible: null }), "");
  assert.equal(core.topeStock({ controlado: true, disponible: -2 }), 0);
  assert.equal(core.topeStock(undefined), Infinity);
});

test("mensaje al grupo con precios y monto", () => {
  const ped = { id: "SKL-1", fecha: "2026-10-25 10:00", vendedor: "Óscar", total_cajas: 3, tipo_pago: "efectivo_pronto", pago: "Efectivo pronto pago", nivel_precio: "menor",
    items: core.conPrecios(ITS.slice(0, 2), PRECIOS, "menor") };
  const m = core.mensajeGrupo(ped, { nombre: "Bella" });
  assert.match(m, /2 × Babosa \(BC-01\) · 6,00 \$ c\/u/);
  assert.match(m, /\*Monto: 24,00 \$\* · precio al por menor/);
});

test("borrar: vendedor sus pedidos (cualquier estado), Master todos; admin y despachador no", () => {
  const p = { vendedor_id: "U3", estado: "entregado", cobro: "conciliado" };
  assert.equal(core.puedeBorrar("vendedor", "U3", p), true);
  assert.equal(core.puedeBorrar("vendedor", "U4", p), false);
  assert.equal(core.puedeBorrar("master", "U1", p), true);
  assert.equal(core.puedeBorrar("admin", "U2", p), false);
  assert.equal(core.puedeBorrar("despachador", "U5", p), false);
});

test("pedido web: referencia y mensaje con precios y vendedor", () => {
  assert.match(core.refWeb(), /^WEB-[A-Z2-9]{6}$/);
  const items = core.conPrecios([{ code: "BC-01", producto: "Babosa", cajas: 10 }], PRECIOS, "menor");
  const m = core.mensajeWeb({ ref: "WEB-AAA111", cliente: { negocio: "Salón Luz", telefono: "0414" }, vendedor: "Óscar", items, tipo_pago: "pronto" });
  assert.match(m, /\(WEB-AAA111\)/);
  assert.match(m, /Mi vendedor: Óscar/);
  assert.match(m, /• 10 × Babosa \(BC-01\) · 9,00 \$ c\/u/);
  assert.match(m, /Monto: 90,00 \$ \(Pronto pago\)/);
});
