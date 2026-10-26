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
  assert.match(core.mensajeGrupo({ ...PEDIDO, estado: "cancelado", motivo: "Cerrado" }, CLIENTE), /^\*PEDIDO SKL-261025-007 — CANCELADO\*/);
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
    assert.deepEqual(core.accionesPedido(rol, "U2", P("entregado")), ["reabrir"]);
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
  assert.deepEqual(ids("vendedor"), ["pendiente", "curso", "entregado", "cancelado", "resumen"]);
  assert.deepEqual(ids("admin"), ["pendiente", "curso", "entregado", "cancelado", "resumen"]);
  assert.deepEqual(ids("master"), ["pendiente", "curso", "entregado", "cancelado", "resumen", "usuarios"]);
  assert.deepEqual(ids("despachador"), ["curso", "entregado"]);
  assert.equal(core.pestanasPanel("admin")[0].nombre, "Por confirmar");
  assert.equal(core.pestanasPanel("despachador")[0].nombre, "Por entregar");
  assert.deepEqual(core.pestanasPanel("admin")[1].estados, ["confirmado", "en_ruta"]);
});

test("puedeTomarPedidos y nombre de estado", () => {
  assert.equal(core.puedeTomarPedidos("vendedor"), true);
  assert.equal(core.puedeTomarPedidos("master"), true);
  assert.equal(core.puedeTomarPedidos("despachador"), false);
  assert.equal(core.nombreEstado("en_ruta"), "En ruta");
  assert.match(core.mensajeGrupo({ ...PEDIDO, estado: "en_ruta" }, CLIENTE), /^\*PEDIDO SKL-261025-007 — EN RUTA\*/);
});
