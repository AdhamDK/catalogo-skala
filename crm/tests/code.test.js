/* Tests del backend crm/Code.gs con un Google Apps Script simulado.
   Correr: node --test crm/tests/code.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { crearGas } = require("./fake-gas.js");

function preparar() {
  const g = crearGas({ ahora: "2026-10-25T18:30:00Z" }); // 14:30 en Caracas
  g.ctx.prepararHojas();
  g.ctx.agregarVendedor("Óscar", "1234");
  g.ctx.agregarVendedor("Kevin", "9876");
  return g;
}
function login(g, id = "V1", pin = "1234") {
  const r = g.post({ action: "login", vendedor_id: id, pin });
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.token;
}
const ITEMS = [
  { code: "BC-01", producto: "Babosa", cajas: 2, unidades_caja: 6, unidad: "unidades" },
  { code: "KT-01", producto: "Kit 12 em 1", cajas: 1, unidades_caja: 6, unidad: "dúos" },
];
const CLIENTE = {
  contacto: "María Pérez", negocio: "Peluquería Bella", rif_cedula: "j-12345678-9",
  direccion: "Av. Bolívar, El Vigía", telefono: "0412-1234567", telefono2: "0275-8812345",
  latitud: 8.6123456789, longitud: -71.6543219,
};

test("crea las 4 hojas con las columnas de GPS_CLIENTES primero", () => {
  const g = preparar();
  assert.deepEqual(Object.keys(g.hojas).sort(), ["Clientes", "PedidoItems", "Pedidos", "Vendedores"]);
  assert.deepEqual(g.tabla("Clientes").length, 0);
  assert.deepEqual(g.hojas.Clientes.filas[0].slice(0, 10).map((x) => x.replace(/^'/, "")),
    ["id", "nombre", "rif_cedula", "direccion", "latitud", "longitud", "telefono", "updated_at", "sync_status", "deleted"]);
});

test("lista de vendedores sin exponer el PIN", () => {
  const g = preparar();
  const r = g.post({ action: "vendedores" });
  assert.deepEqual(r.vendedores, [{ id: "V1", nombre: "Óscar" }, { id: "V2", nombre: "Kevin" }]);
  assert.ok(!JSON.stringify(r).includes("pin"));
});

test("el PIN se guarda cifrado, nunca en texto plano", () => {
  const g = preparar();
  const v = g.tabla("Vendedores")[0];
  assert.match(v.pin_hash, /^[0-9a-f]{64}$/);
  assert.notEqual(v.pin_hash, "1234");
});

test("login correcto devuelve token; PIN incorrecto falla", () => {
  const g = preparar();
  assert.ok(login(g));
  const r = g.post({ action: "login", vendedor_id: "V1", pin: "0000" });
  assert.equal(r.ok, false);
  assert.equal(r.code, "bad_pin");
});

test("5 intentos fallidos bloquean al vendedor", () => {
  const g = preparar();
  for (let i = 0; i < 5; i++) g.post({ action: "login", vendedor_id: "V1", pin: "1111" });
  const r = g.post({ action: "login", vendedor_id: "V1", pin: "1234" });
  assert.equal(r.code, "locked");
});

test("vendedor inactivo no puede entrar", () => {
  const g = preparar();
  g.hojas.Vendedores.filas[1][3] = false;
  assert.equal(g.post({ action: "login", vendedor_id: "V1", pin: "1234" }).code, "bad_pin");
});

test("acciones privadas exigen token válido y vigente", () => {
  const g = preparar();
  assert.equal(g.post({ action: "pedidos" }).code, "auth");
  assert.equal(g.post({ action: "pedidos", token: "V1.9999999999999.falso" }).code, "auth");
  const token = login(g);
  g.setAhora("2026-10-26T07:00:00Z"); // 12.5 h después
  assert.equal(g.post({ action: "pedidos", token }).code, "auth");
});

test("guardar pedido: crea cliente, pedido SKL-AAMMDD-NNN e items", () => {
  const g = preparar();
  const token = login(g);
  const r = g.post({ action: "guardarPedido", token, client_ref: "ref-1", cliente: CLIENTE, items: ITEMS, pago: "Divisas · Contado", nota: "Entregar viernes" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.pedido.id, "SKL-261025-001");
  assert.equal(r.pedido.fecha, "2026-10-25 14:30");
  assert.equal(r.pedido.vendedor, "Óscar");
  assert.equal(r.pedido.total_cajas, 3);
  assert.equal(r.pedido.detalle_unidades, "12 unidades + 6 dúos");
  assert.equal(r.pedido.estado, "pendiente");
  assert.equal(r.pedido.items.length, 2);

  const [c] = g.tabla("Clientes");
  assert.equal(c.nombre, "Peluquería Bella");
  assert.equal(c.contacto, "María Pérez");
  assert.equal(c.rif_cedula, "J-12345678-9");
  assert.equal(c.telefono2, "0275-8812345");
  assert.equal(c.latitud, 8.612346);
  assert.equal(c.longitud, -71.654322);
  assert.equal(c.deleted, 0);
  assert.equal(c.vendedor_id, "V1");
  assert.equal(g.tabla("PedidoItems").length, 2);
  assert.equal(g.tabla("PedidoItems")[0].total_unidades, 12);
});

test("correlativo diario: 001, 002 y reinicia al día siguiente", () => {
  const g = preparar();
  const token = login(g);
  const pedir = (ref) => g.post({ action: "guardarPedido", token, client_ref: ref, cliente: CLIENTE, items: ITEMS });
  assert.equal(pedir("a").pedido.id, "SKL-261025-001");
  assert.equal(pedir("b").pedido.id, "SKL-261025-002");
  g.setAhora("2026-10-26T13:00:00Z");
  const t2 = login(g);
  assert.equal(g.post({ action: "guardarPedido", token: t2, client_ref: "c", cliente: CLIENTE, items: ITEMS }).pedido.id, "SKL-261026-001");
});

test("reintento con el mismo client_ref no duplica el pedido", () => {
  const g = preparar();
  const token = login(g);
  const body = { action: "guardarPedido", token, client_ref: "mismo", cliente: CLIENTE, items: ITEMS };
  const a = g.post(body);
  const b = g.post(body);
  assert.equal(b.duplicado, true);
  assert.equal(a.pedido.id, b.pedido.id);
  assert.equal(g.tabla("Pedidos").length, 1);
  assert.equal(g.tabla("PedidoItems").length, 2);
});

test("cliente existente se reconoce por teléfono y se actualiza sin borrar datos", () => {
  const g = preparar();
  const token = login(g);
  g.post({ action: "guardarPedido", token, client_ref: "1", cliente: CLIENTE, items: ITEMS });
  const r = g.post({ action: "guardarPedido", token, client_ref: "2", items: ITEMS,
    cliente: { negocio: "Peluquería Bella", telefono: "04121234567", direccion: "Nueva dirección" } });
  assert.equal(r.ok, true);
  const clientes = g.tabla("Clientes");
  assert.equal(clientes.length, 1);
  assert.equal(clientes[0].direccion, "Nueva dirección");
  assert.equal(clientes[0].contacto, "María Pérez"); // no se borró
  assert.equal(clientes[0].latitud, 8.612346);
});

test("validaciones: sin productos, sin teléfono, GPS fuera de rango", () => {
  const g = preparar();
  const token = login(g);
  assert.equal(g.post({ action: "guardarPedido", token, cliente: CLIENTE, items: [] }).code, "empty");
  assert.equal(g.post({ action: "guardarPedido", token, cliente: { negocio: "X" }, items: ITEMS }).code, "cliente");
  const r = g.post({ action: "guardarPedido", token, client_ref: "z", cliente: { ...CLIENTE, telefono: "0414-0000000", latitud: 200, longitud: "abc" }, items: ITEMS });
  assert.equal(r.ok, true);
  const c = g.tabla("Clientes")[0];
  assert.equal(c.latitud, "");
  assert.equal(c.longitud, "");
});

test("buscar clientes por nombre, negocio o teléfono", () => {
  const g = preparar();
  const token = login(g);
  g.post({ action: "guardarPedido", token, client_ref: "1", cliente: CLIENTE, items: ITEMS });
  g.post({ action: "guardarPedido", token, client_ref: "2", items: ITEMS, cliente: { negocio: "Barbería Max", contacto: "José", telefono: "0416-5550000" } });
  const q = (texto) => g.post({ action: "clientes", token, q: texto }).clientes.map((c) => c.nombre);
  assert.deepEqual(q("bella"), ["Peluquería Bella"]);
  assert.deepEqual(q("maría"), ["Peluquería Bella"]);
  assert.deepEqual(q("5550"), ["Barbería Max"]);
  assert.equal(q("").length, 2);
});

test("mis pedidos: solo los del vendedor, filtro por estado", () => {
  const g = preparar();
  const t1 = login(g, "V1", "1234");
  const t2 = login(g, "V2", "9876");
  g.post({ action: "guardarPedido", token: t1, client_ref: "1", cliente: CLIENTE, items: ITEMS });
  g.post({ action: "guardarPedido", token: t2, client_ref: "2", cliente: CLIENTE, items: ITEMS });
  const r = g.post({ action: "pedidos", token: t1 });
  assert.equal(r.pedidos.length, 1);
  assert.equal(r.pedidos[0].vendedor, "Óscar");
  assert.equal(r.pedidos[0].items.length, 2);
  assert.equal(r.pedidos[0].cliente_datos.telefono, "0412-1234567");
  assert.equal(g.post({ action: "pedidos", token: t1, estado: "entregado" }).pedidos.length, 0);
});

test("marcar entregado y cancelado (con motivo); no tocar pedidos ajenos", () => {
  const g = preparar();
  const t1 = login(g, "V1", "1234");
  const t2 = login(g, "V2", "9876");
  const id = g.post({ action: "guardarPedido", token: t1, client_ref: "1", cliente: CLIENTE, items: ITEMS }).pedido.id;

  assert.equal(g.post({ action: "estado", token: t2, pedido_id: id, estado: "entregado" }).code, "forbidden");
  assert.equal(g.post({ action: "estado", token: t1, pedido_id: id, estado: "cancelado" }).code, "motivo");
  assert.equal(g.post({ action: "estado", token: t1, pedido_id: id, estado: "volando" }).code, "estado");

  const e = g.post({ action: "estado", token: t1, pedido_id: id, estado: "entregado" });
  assert.equal(e.pedido.estado, "entregado");
  const c = g.post({ action: "estado", token: t1, pedido_id: id, estado: "cancelado", motivo: "Cliente cerró" });
  assert.equal(c.pedido.estado, "cancelado");
  assert.equal(g.tabla("Pedidos")[0].motivo, "Cliente cerró");
  assert.equal(g.tabla("Pedidos")[0].estado_por, "Óscar");
});

test("acción desconocida y JSON inválido responden error controlado", () => {
  const g = preparar();
  assert.equal(g.post({ action: "borrarTodo" }).code, "unknown_action");
  const r = JSON.parse(g.ctx.doPost({ postData: { contents: "{no es json" } }).getContent());
  assert.equal(r.code, "bad_json");
  assert.equal(g.get({}).app, "skala-crm");
});

test("GPS_CLIENTES puede sincronizar sobre la misma hoja sin borrar columnas extra", () => {
  const g = preparar();
  const token = login(g);
  g.post({ action: "guardarPedido", token, client_ref: "1", cliente: CLIENTE, items: ITEMS });
  // Simula handleSync de GPS_CLIENTES: escribe solo las 10 primeras columnas
  const fila = g.hojas.Clientes.filas[1];
  g.hojas.Clientes.getRange(2, 1, 1, 10).setValues([[fila[0], "Peluquería Bella (GPS)", fila[2], fila[3], 8.7, -71.7, fila[6], "2026-10-25T19:00:00Z", 1, 0]]);
  const c = g.tabla("Clientes")[0];
  assert.equal(c.nombre, "Peluquería Bella (GPS)");
  assert.equal(c.contacto, "María Pérez");
  assert.equal(c.telefono2, "0275-8812345");
});

test("texto que empieza con = + - @ se guarda como texto, no como fórmula", () => {
  const g = preparar();
  const token = login(g);
  const r = g.post({ action: "guardarPedido", token, client_ref: "f", items: ITEMS,
    cliente: { negocio: '=IMPORTXML("http://x","//a")', telefono: "0412-1234567" }, nota: "@SUMA(A1)" });
  assert.equal(r.ok, true);
  // En Sheets, el apóstrofo inicial fuerza texto (no se muestra en la celda)
  assert.equal(g.hojas.Clientes.filas[1][1], `'=IMPORTXML("http://x","//a")`);
  assert.equal(g.hojas.Pedidos.filas[1][10], "'@SUMA(A1)");
});

test("teléfono solo con números conserva el 0 y la fecha queda como texto", () => {
  const g = preparar();
  const token = login(g);
  const r = g.post({ action: "guardarPedido", token, client_ref: "t", items: ITEMS, cliente: { negocio: "Tienda", telefono: "04121234567" } });
  assert.equal(g.tabla("Clientes")[0].telefono, "04121234567");
  assert.equal(typeof g.tabla("Pedidos")[0].fecha, "string");
  assert.equal(g.post({ action: "pedidos", token }).pedidos[0].fecha, r.pedido.fecha);
});
