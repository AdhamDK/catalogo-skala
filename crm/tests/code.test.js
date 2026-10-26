/* Tests del backend crm/Code.gs (v2, con roles) sobre un Apps Script simulado.
   Correr: node --test crm/tests/code.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { crearGas } = require("./fake-gas.js");

function preparar() {
  const g = crearGas({ ahora: "2026-10-25T18:30:00Z" }); // 14:30 en Caracas
  g.ctx.prepararHojas();
  g.ctx.crearUsuario("jose", "José Montiel", "master", "Skala#2026");
  g.ctx.crearUsuario("ana", "Ana", "admin", "Ana*2222");
  g.ctx.crearUsuario("oscar", "Óscar", "vendedor", "Oscar.1234");
  g.ctx.crearUsuario("kevin", "Kevin", "vendedor", "Kevin9876");
  g.ctx.crearUsuario("luis", "Luis", "despachador", "Luis5555");
  g.ctx.crearUsuario("pedro", "Pedro", "despachador", "Pedro6666");
  return g;
}
function login(g, usuario = "oscar", pin = "Oscar.1234") {
  const r = g.post({ action: "login", usuario, pin });
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
let n = 0;
const pedir = (g, token, extra = {}) =>
  g.post({ action: "guardarPedido", token, client_ref: "ref-" + ++n, cliente: CLIENTE, items: ITEMS, ...extra });
const idDe = (g, usuario) => g.tabla("Usuarios").find((u) => u.usuario === usuario).id;

/* ---------- Hojas, usuarios, login ---------- */
test("crea 5 hojas; Clientes empieza con las columnas de GPS_CLIENTES", () => {
  const g = preparar();
  assert.deepEqual(Object.keys(g.hojas).sort(), ["Clientes", "Historial", "PedidoItems", "Pedidos", "Usuarios"]);
  assert.deepEqual(g.tabla("Clientes").length, 0);
  assert.deepEqual(g.hojas.Clientes.filas[0].slice(0, 10),
    ["id", "nombre", "rif_cedula", "direccion", "latitud", "longitud", "telefono", "updated_at", "sync_status", "deleted"]);
});

test("clave cifrada; reglas de clave; usuario único y normalizado", () => {
  const g = preparar();
  const u = g.tabla("Usuarios").find((x) => x.usuario === "oscar");
  assert.match(u.pin_hash, /^[0-9a-f]{64}$/);
  assert.throws(() => g.ctx.crearUsuario("otro", "Otro", "master", "Abc1234"), /al menos 8/);
  assert.throws(() => g.ctx.crearUsuario("otro", "Otro", "vendedor", "123456"), /letras y números/);
  assert.throws(() => g.ctx.crearUsuario("otro", "Otro", "vendedor", "abcdef"), /letras y números/);
  assert.throws(() => g.ctx.crearUsuario("otro", "Otro", "vendedor", "Ab1"), /al menos 6/);
  assert.ok(g.ctx.crearUsuario("otro", "Otro", "vendedor", "Ñandú#7 ok"));
  assert.throws(() => g.ctx.crearUsuario("OSCAR", "Dup", "vendedor", "Oscar.1234"), /ya existe/);
  assert.throws(() => g.ctx.crearUsuario("x", "X", "vendedor", "Oscar.1234"), /al menos 3/);
  assert.throws(() => g.ctx.crearUsuario("nuevo", "N", "jefe", "Oscar.1234"), /Rol inválido/);
  g.ctx.crearUsuario("María José", "MJ", "vendedor", "Mj$2026");
  assert.ok(g.tabla("Usuarios").some((x) => x.usuario === "mariajose"));
});

test("login con usuario + PIN (sin importar mayúsculas); error genérico", () => {
  const g = preparar();
  const r = g.post({ action: "login", usuario: " Oscar ", pin: "Oscar.1234" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.usuario, { id: idDe(g, "oscar"), usuario: "oscar", nombre: "Óscar", rol: "vendedor", rol_nombre: "Vendedor" });
  assert.equal(g.post({ action: "login", usuario: "oscar", pin: "0000" }).code, "bad_pin");
  assert.equal(g.post({ action: "login", usuario: "nadie", pin: "Oscar.1234" }).code, "bad_pin");
  assert.equal(g.post({ action: "yo", token: r.token }).usuario.rol, "vendedor");
});

test("5 intentos fallidos bloquean; usuario inactivo no entra", () => {
  const g = preparar();
  for (let i = 0; i < 5; i++) g.post({ action: "login", usuario: "oscar", pin: "1111" });
  assert.equal(g.post({ action: "login", usuario: "oscar", pin: "Oscar.1234" }).code, "locked");
  const fila = g.tabla("Usuarios").findIndex((x) => x.usuario === "kevin") + 2;
  g.hojas.Usuarios.filas[fila - 1][5] = false;
  assert.equal(g.post({ action: "login", usuario: "kevin", pin: "Kevin9876" }).code, "bad_pin");
});

test("token: inválido, vencido o de usuario desactivado → auth", () => {
  const g = preparar();
  assert.equal(g.post({ action: "pedidos" }).code, "auth");
  assert.equal(g.post({ action: "pedidos", token: "U1.9999999999999.falso" }).code, "auth");
  const t = login(g);
  const fila = g.tabla("Usuarios").findIndex((x) => x.usuario === "oscar") + 1;
  g.hojas.Usuarios.filas[fila][5] = false;
  assert.equal(g.post({ action: "pedidos", token: t }).code, "auth");
  g.hojas.Usuarios.filas[fila][5] = true;
  g.setAhora("2026-10-26T07:00:00Z");
  assert.equal(g.post({ action: "pedidos", token: t }).code, "auth");
});

test("migra la hoja Vendedores de la v1 conservando el PIN", () => {
  const g = crearGas({ ahora: "2026-10-25T18:30:00Z" });
  // v1: hoja Vendedores con un PIN generado con el mismo secreto
  g.props.CRM_SECRET = "secreto-fijo";
  const hash = require("crypto").createHash("sha256").update("secreto-fijo|V1|1234", "utf8").digest("hex");
  const v = g.ctx.SpreadsheetApp.getActiveSpreadsheet().insertSheet("Vendedores");
  v.appendRow(["id", "nombre", "pin_hash", "activo"]);
  v.appendRow(["V1", "Óscar", "'" + hash, true]);
  g.ctx.prepararHojas();
  const u = g.tabla("Usuarios")[0];
  assert.equal(u.rol, "vendedor");
  assert.equal(u.usuario, "oscar");
  assert.equal(g.post({ action: "login", usuario: "oscar", pin: "1234" }).ok, true);
});

/* ---------- Pedidos ---------- */
test("guardar pedido: cliente, pedido SKL-AAMMDD-NNN, items e historial", () => {
  const g = preparar();
  const r = pedir(g, login(g), { pago: "Divisas · Contado", nota: "Entregar viernes" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.pedido.id, "SKL-261025-001");
  assert.equal(r.pedido.fecha, "2026-10-25 14:30");
  assert.equal(r.pedido.vendedor, "Óscar");
  assert.equal(r.pedido.total_cajas, 3);
  assert.equal(r.pedido.detalle_unidades, "12 unidades + 6 dúos");
  assert.equal(r.pedido.estado, "pendiente");
  const [c] = g.tabla("Clientes");
  assert.equal(c.nombre, "Peluquería Bella");
  assert.equal(c.contacto, "María Pérez");
  assert.equal(c.rif_cedula, "J-12345678-9");
  assert.equal(c.latitud, 8.612346);
  assert.equal(g.tabla("PedidoItems").length, 2);
  assert.deepEqual(g.tabla("Historial").map((h) => h.accion), ["creado"]);
  assert.match(g.tabla("Historial")[0].usuario, /Óscar \(Vendedor\)/);
});

test("despachador no puede tomar pedidos ni buscar clientes; admin y master sí", () => {
  const g = preparar();
  const tl = login(g, "luis", "Luis5555");
  assert.equal(pedir(g, tl).code, "forbidden");
  assert.equal(g.post({ action: "clientes", token: tl, q: "x" }).code, "forbidden");
  assert.equal(pedir(g, login(g, "ana", "Ana*2222")).ok, true);
  assert.equal(pedir(g, login(g, "jose", "Skala#2026")).ok, true);
});

test("correlativo diario y reintento sin duplicar", () => {
  const g = preparar();
  const t = login(g);
  assert.equal(pedir(g, t).pedido.id, "SKL-261025-001");
  const body = { action: "guardarPedido", token: t, client_ref: "mismo", cliente: CLIENTE, items: ITEMS };
  assert.equal(g.post(body).pedido.id, "SKL-261025-002");
  assert.equal(g.post(body).duplicado, true);
  assert.equal(g.tabla("Pedidos").length, 2);
  g.setAhora("2026-10-26T13:00:00Z");
  assert.equal(pedir(g, login(g)).pedido.id, "SKL-261026-001");
});

test("cliente existente por teléfono: se actualiza sin borrar datos", () => {
  const g = preparar();
  const t = login(g);
  pedir(g, t);
  pedir(g, t, { cliente: { negocio: "Peluquería Bella", telefono: "04121234567", direccion: "Nueva dirección" } });
  const cs = g.tabla("Clientes");
  assert.equal(cs.length, 1);
  assert.equal(cs[0].direccion, "Nueva dirección");
  assert.equal(cs[0].contacto, "María Pérez");
});

test("validaciones del pedido", () => {
  const g = preparar();
  const t = login(g);
  assert.equal(pedir(g, t, { items: [] }).code, "empty");
  assert.equal(pedir(g, t, { cliente: { negocio: "X" } }).code, "cliente");
  pedir(g, t, { cliente: { ...CLIENTE, telefono: "0414-0000000", latitud: 200, longitud: "abc" } });
  assert.equal(g.tabla("Clientes")[0].latitud, "");
});

test("buscar clientes por nombre, contacto o teléfono", () => {
  const g = preparar();
  const t = login(g);
  pedir(g, t);
  pedir(g, t, { cliente: { negocio: "Barbería Max", contacto: "José", telefono: "0416-5550000" } });
  const q = (texto) => g.post({ action: "clientes", token: t, q: texto }).clientes.map((c) => c.nombre);
  assert.deepEqual(q("bella"), ["Peluquería Bella"]);
  assert.deepEqual(q("maría"), ["Peluquería Bella"]);
  assert.deepEqual(q("5550"), ["Barbería Max"]);
});

/* ---------- Visibilidad por rol ---------- */
test("vendedor ve solo los suyos; admin y master ven todos", () => {
  const g = preparar();
  pedir(g, login(g, "oscar", "Oscar.1234"));
  pedir(g, login(g, "kevin", "Kevin9876"));
  const ver = (u, p) => g.post({ action: "pedidos", token: login(g, u, p) }).pedidos.map((x) => x.vendedor);
  assert.deepEqual(ver("oscar", "Oscar.1234"), ["Óscar"]);
  assert.equal(ver("ana", "Ana*2222").length, 2);
  assert.equal(ver("jose", "Skala#2026").length, 2);
});

/* ---------- Flujo completo ---------- */
test("flujo: pendiente → confirmado (asigna despachador) → en ruta → entregado", () => {
  const g = preparar();
  const tv = login(g), ta = login(g, "ana", "Ana*2222"), tl = login(g, "luis", "Luis5555"), tp = login(g, "pedro", "Pedro6666");
  const id = pedir(g, tv).pedido.id;
  const luis = idDe(g, "luis");

  // el despachador no ve pendientes
  assert.equal(g.post({ action: "pedidos", token: tl }).pedidos.length, 0);
  // vendedor y despachador no confirman
  assert.equal(g.post({ action: "estado", token: tv, pedido_id: id, estado: "confirmado", despachador_id: luis }).code, "forbidden");
  // confirmar sin despachador falla; con despachador inválido (un vendedor) también
  assert.equal(g.post({ action: "estado", token: ta, pedido_id: id, estado: "confirmado" }).code, "despachador");
  assert.equal(g.post({ action: "estado", token: ta, pedido_id: id, estado: "confirmado", despachador_id: idDe(g, "oscar") }).code, "despachador");

  const c = g.post({ action: "estado", token: ta, pedido_id: id, estado: "confirmado", despachador_id: luis });
  assert.equal(c.pedido.estado, "confirmado");
  assert.equal(c.pedido.despachador, "Luis");
  assert.equal(c.pedido.confirmado_por, "Ana");

  // Luis lo ve; Pedro no
  assert.equal(g.post({ action: "pedidos", token: tl }).pedidos.length, 1);
  assert.equal(g.post({ action: "pedidos", token: tp }).pedidos.length, 0);
  assert.equal(g.post({ action: "estado", token: tp, pedido_id: id, estado: "en_ruta" }).code, "forbidden");
  // despachador no puede cancelar
  assert.equal(g.post({ action: "estado", token: tl, pedido_id: id, estado: "cancelado", motivo: "x" }).code, "forbidden");

  assert.equal(g.post({ action: "estado", token: tl, pedido_id: id, estado: "en_ruta" }).pedido.estado, "en_ruta");
  const e = g.post({ action: "estado", token: tl, pedido_id: id, estado: "entregado" });
  assert.equal(e.pedido.estado, "entregado");
  assert.equal(e.pedido.entregado_por, "Luis");
  // despachador no puede reabrir
  assert.equal(g.post({ action: "estado", token: tl, pedido_id: id, estado: "pendiente" }).code, "forbidden");

  assert.deepEqual(g.tabla("Historial").map((h) => h.accion), ["creado", "confirmado", "en_ruta", "entregado"]);
  assert.equal(g.tabla("Historial")[1].detalle, "Despachador: Luis");
});

test("reasignar despachador y reabrir (solo gestión)", () => {
  const g = preparar();
  const ta = login(g, "ana", "Ana*2222"), tp = login(g, "pedro", "Pedro6666");
  const id = pedir(g, login(g)).pedido.id;
  g.post({ action: "estado", token: ta, pedido_id: id, estado: "confirmado", despachador_id: idDe(g, "luis") });
  const r = g.post({ action: "estado", token: ta, pedido_id: id, estado: "confirmado", despachador_id: idDe(g, "pedro") });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.pedido.despachador, "Pedro");
  assert.equal(g.post({ action: "pedidos", token: tp }).pedidos.length, 1);
  const p = g.post({ action: "estado", token: ta, pedido_id: id, estado: "pendiente" });
  assert.equal(p.pedido.estado, "pendiente");
  assert.equal(p.pedido.despachador, "");
  assert.equal(g.tabla("Historial").at(-2).accion, "reasignado");
});

test("cancelar: vendedor solo los suyos pendientes; motivo obligatorio", () => {
  const g = preparar();
  const tv = login(g), tk = login(g, "kevin", "Kevin9876"), ta = login(g, "ana", "Ana*2222");
  const id1 = pedir(g, tv).pedido.id;
  const id2 = pedir(g, tv).pedido.id;
  assert.equal(g.post({ action: "estado", token: tv, pedido_id: id1, estado: "cancelado" }).code, "motivo");
  assert.equal(g.post({ action: "estado", token: tk, pedido_id: id1, estado: "cancelado", motivo: "x" }).code, "forbidden");
  const c = g.post({ action: "estado", token: tv, pedido_id: id1, estado: "cancelado", motivo: "Cliente cerró" });
  assert.equal(c.pedido.motivo, "Cliente cerró");
  g.post({ action: "estado", token: ta, pedido_id: id2, estado: "confirmado", despachador_id: idDe(g, "luis") });
  assert.equal(g.post({ action: "estado", token: tv, pedido_id: id2, estado: "cancelado", motivo: "x" }).code, "forbidden");
  assert.equal(g.post({ action: "estado", token: ta, pedido_id: id2, estado: "cancelado", motivo: "Sin stock" }).pedido.estado, "cancelado");
  assert.equal(g.post({ action: "estado", token: ta, pedido_id: id2, estado: "volando" }).code, "estado");
});

test("filtro por varios estados y lista de despachadores (solo gestión)", () => {
  const g = preparar();
  const ta = login(g, "ana", "Ana*2222");
  const id = pedir(g, login(g)).pedido.id;
  pedir(g, login(g));
  g.post({ action: "estado", token: ta, pedido_id: id, estado: "confirmado", despachador_id: idDe(g, "luis") });
  assert.equal(g.post({ action: "pedidos", token: ta, estados: ["confirmado", "en_ruta"] }).pedidos.length, 1);
  assert.equal(g.post({ action: "pedidos", token: ta, estados: ["pendiente"] }).pedidos.length, 1);
  assert.deepEqual(g.post({ action: "despachadores", token: ta }).despachadores.map((d) => d.nombre), ["Luis", "Pedro"]);
  assert.equal(g.post({ action: "despachadores", token: login(g) }).code, "forbidden");
});

/* ---------- Resumen ---------- */
test("resumen: gestión ve todo con vendedores; vendedor solo lo suyo", () => {
  const g = preparar();
  const to = login(g), tk = login(g, "kevin", "Kevin9876"), ta = login(g, "ana", "Ana*2222");
  pedir(g, to);
  pedir(g, to);
  const idk = pedir(g, tk).pedido.id;
  g.post({ action: "estado", token: ta, pedido_id: idk, estado: "cancelado", motivo: "x" });
  const r = g.post({ action: "resumen", token: ta, dias: 30 });
  assert.equal(r.total_pedidos, 3);
  assert.equal(r.total_cajas, 6); // el cancelado no suma
  assert.equal(r.por_estado.pendiente, 2);
  assert.equal(r.por_estado.cancelado, 1);
  assert.deepEqual(r.por_vendedor, [{ vendedor: "Óscar", pedidos: 2, cajas: 6 }]);
  assert.deepEqual(r.por_producto[0], { code: "BC-01", producto: "Babosa", cajas: 4 });
  const rv = g.post({ action: "resumen", token: tk });
  assert.equal(rv.total_pedidos, 1);
  assert.deepEqual(rv.por_vendedor, []);
  assert.equal(g.post({ action: "resumen", token: login(g, "luis", "Luis5555") }).code, "forbidden");
});

/* ---------- Usuarios (Master) ---------- */
test("solo el Master administra usuarios", () => {
  const g = preparar();
  const tm = login(g, "jose", "Skala#2026");
  assert.equal(g.post({ action: "usuarios", token: login(g, "ana", "Ana*2222") }).code, "forbidden");
  const lista = g.post({ action: "usuarios", token: tm }).usuarios;
  assert.equal(lista.length, 6);
  assert.ok(!JSON.stringify(lista).includes("pin_hash"));

  const r = g.post({ action: "guardarUsuario", token: tm, usuario: "carla", nombre: "Carla", rol: "admin", pin: "Carla4444" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(login(g, "carla", "Carla4444").length > 10, true);
  assert.equal(g.post({ action: "guardarUsuario", token: tm, usuario: "sinpin", nombre: "S", rol: "vendedor" }).code, "usuario");

  // cambiar rol, desactivar, cambiar PIN
  const kevin = idDe(g, "kevin");
  g.post({ action: "guardarUsuario", token: tm, id: kevin, usuario: "kevin", nombre: "Kevin", rol: "despachador", activo: true });
  assert.equal(g.post({ action: "yo", token: login(g, "kevin", "Kevin9876") }).usuario.rol, "despachador");
  g.post({ action: "guardarUsuario", token: tm, id: kevin, usuario: "kevin", nombre: "Kevin", rol: "despachador", activo: false, pin: "Nueva1111" });
  assert.equal(g.post({ action: "login", usuario: "kevin", pin: "Nueva1111" }).code, "bad_pin");
});

test("no se puede dejar la empresa sin Master activo", () => {
  const g = preparar();
  const tm = login(g, "jose", "Skala#2026");
  const jose = idDe(g, "jose");
  const r = g.post({ action: "guardarUsuario", token: tm, id: jose, usuario: "jose", nombre: "José", rol: "admin" });
  assert.match(r.error, /al menos un Master/);
  assert.match(g.post({ action: "guardarUsuario", token: tm, id: jose, usuario: "jose", nombre: "José", rol: "master", activo: false }).error, /al menos un Master/);
});

/* ---------- Robustez ---------- */
test("texto peligroso o con forma de número/fecha se guarda como texto", () => {
  const g = preparar();
  const t = login(g);
  const r = pedir(g, t, { cliente: { negocio: '=IMPORTXML("http://x","//a")', telefono: "04121234567" }, nota: "@SUMA(A1)" });
  assert.equal(r.ok, true);
  assert.equal(g.hojas.Clientes.filas[1][1], `'=IMPORTXML("http://x","//a")`);
  assert.equal(g.tabla("Clientes")[0].telefono, "04121234567");
  assert.equal(typeof g.tabla("Pedidos")[0].fecha, "string");
});

test("acción desconocida, JSON inválido y GET de salud", () => {
  const g = preparar();
  assert.equal(g.post({ action: "borrarTodo" }).code, "unknown_action");
  assert.equal(JSON.parse(g.ctx.doPost({ postData: { contents: "{no" } }).getContent()).code, "bad_json");
  assert.deepEqual(g.get({}), { ok: true, app: "skala-crm", version: 2, claves: true });
});

test("GPS_CLIENTES puede escribir las 10 primeras columnas sin borrar las extra", () => {
  const g = preparar();
  pedir(g, login(g));
  const fila = g.hojas.Clientes.filas[1];
  g.hojas.Clientes.getRange(2, 1, 1, 10).setValues([[fila[0], "'Peluquería Bella (GPS)", fila[2], fila[3], 8.7, -71.7, fila[6], "'2026-10-25T19:00:00Z", 1, 0]]);
  const c = g.tabla("Clientes")[0];
  assert.equal(c.nombre, "Peluquería Bella (GPS)");
  assert.equal(c.contacto, "María Pérez");
  assert.equal(c.telefono2, "0275-8812345");
});

test("login con clave con símbolos y espacios internos; acepta campo clave", () => {
  const g = preparar();
  g.ctx.crearUsuario("rosa", "Rosa", "vendedor", "Ro sa#2026!");
  assert.equal(g.post({ action: "login", usuario: "rosa", clave: "Ro sa#2026!" }).ok, true);
  assert.equal(g.post({ action: "login", usuario: "rosa", clave: "ro sa#2026!" }).code, "bad_pin"); // distingue mayúsculas
});

test("un PIN numérico viejo (v1) sigue sirviendo para entrar", () => {
  const g = preparar();
  const lista = g.tabla("Usuarios");
  const u = lista.find((x) => x.usuario === "oscar");
  const fila = lista.indexOf(u) + 1;
  g.hojas.Usuarios.filas[fila][4] = "'" + g.ctx.hashPin_(u.id, "1234");
  assert.equal(g.post({ action: "login", usuario: "oscar", pin: "1234" }).ok, true);
});

test("detalle de pedido con historial; respeta lo que cada rol puede ver", () => {
  const g = preparar();
  const ta = login(g, "ana", "Ana*2222");
  const id = pedir(g, login(g)).pedido.id;
  g.post({ action: "estado", token: ta, pedido_id: id, estado: "confirmado", despachador_id: idDe(g, "luis") });
  const d = g.post({ action: "pedido", token: ta, pedido_id: id });
  assert.equal(d.pedido.id, id);
  assert.equal(d.pedido.items.length, 2);
  assert.equal(d.pedido.cliente_datos.telefono, "0412-1234567");
  assert.deepEqual(d.pedido.historial.map((h) => h.accion), ["creado", "confirmado"]);
  assert.equal(g.post({ action: "pedido", token: login(g, "kevin", "Kevin9876"), pedido_id: id }).code, "not_found");
  assert.equal(g.post({ action: "pedido", token: login(g, "pedro", "Pedro6666"), pedido_id: id }).code, "not_found");
  assert.equal(g.post({ action: "pedido", token: login(g, "luis", "Luis5555"), pedido_id: id }).ok, true);
});

test("pedidos de un cliente (ficha) y límite en la lista de clientes", () => {
  const g = preparar();
  const to = login(g), tk = login(g, "kevin", "Kevin9876"), ta = login(g, "ana", "Ana*2222");
  const r = pedir(g, to);
  pedir(g, to, { cliente: { negocio: "Otro", telefono: "0416-1112233" } });
  pedir(g, tk); // mismo cliente, otro vendedor
  const cid = r.cliente_id;
  assert.equal(g.post({ action: "pedidos", token: ta, cliente_id: cid }).pedidos.length, 2);
  assert.equal(g.post({ action: "pedidos", token: to, cliente_id: cid }).pedidos.length, 1); // solo los suyos
  assert.equal(g.post({ action: "clientes", token: ta, q: "", limite: 1 }).clientes.length, 1);
  assert.equal(g.post({ action: "clientes", token: ta, q: "", limite: 100 }).clientes.length, 2);
});
