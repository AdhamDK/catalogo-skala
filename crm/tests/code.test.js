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
  g.post({ action: "guardarPedido", token, client_ref: "ref-" + ++n, cliente: CLIENTE, items: ITEMS, documento: "Nota de entrega", ...extra });
const idDe = (g, usuario) => g.tabla("Usuarios").find((u) => u.usuario === usuario).id;

/* ---------- Hojas, usuarios, login ---------- */
test("crea 9 hojas; Clientes empieza con las columnas de GPS_CLIENTES; Precios y Config precargadas", () => {
  const g = preparar();
  assert.deepEqual(Object.keys(g.hojas).sort(), ["Clientes", "Config", "Historial", "Inventario", "PedidoItems", "Pedidos", "PedidosWeb", "Precios", "Usuarios"]);
  assert.deepEqual(g.tabla("Config").map((x) => x.clave), ["version_apk", "url_apk", "minima_apk", "version_pantallas", "url_pantallas", "notas"]);
  assert.equal(g.tabla("Precios").length, 19);
  assert.deepEqual(g.tabla("Precios")[0], { code: "BC-01", producto: "Babosa", menor: "", mayor: "", pronto: "", efectivo_credito: "", efectivo_pronto: "", updated_at: "", updated_por: "",
    tipo: "", linea: "", beneficio: "", cabello: "", unidades_caja: "", imagen: "" });
  g.ctx.prepararHojas(); // no duplica
  assert.equal(g.tabla("Precios").length, 19);
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
  assert.deepEqual(r.usuario, { id: idDe(g, "oscar"), usuario: "oscar", nombre: "Óscar", rol: "vendedor", roles: ["vendedor"], rol_nombre: "Vendedor" });
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
  const body = { action: "guardarPedido", token: t, client_ref: "mismo", cliente: CLIENTE, items: ITEMS, documento: "Factura" };
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
  assert.deepEqual(g.get({}), { ok: true, app: "skala-crm", version: 3, claves: true, precios: true });
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

test("añadir cliente sin pedido: teléfono opcional, sin duplicar, editar", () => {
  const g = preparar();
  const t = login(g);
  const a = g.post({ action: "guardarCliente", token: t, cliente: { negocio: "Salón Luz", contacto: "Luz", direccion: "El Vigía", latitud: "8.6", longitud: "-71.6" } });
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(a.existia, false);
  assert.equal(g.tabla("Pedidos").length, 0);
  // mismo negocio sin teléfono ni RIF -> no duplica
  const b = g.post({ action: "guardarCliente", token: t, cliente: { negocio: "salón luz", telefono2: "0275-1111111" } });
  assert.equal(b.existia, true);
  assert.equal(g.tabla("Clientes").length, 1);
  assert.equal(g.tabla("Clientes")[0].contacto, "Luz");
  // con teléfono que ya existe -> es el mismo
  g.post({ action: "guardarCliente", token: t, cliente: { negocio: "Bella", telefono: "0412-1234567" } });
  assert.equal(g.post({ action: "guardarCliente", token: t, cliente: { negocio: "Bella SA", telefono: "04121234567" } }).existia, true);
  assert.equal(g.tabla("Clientes").length, 2);
  // validaciones
  assert.equal(g.post({ action: "guardarCliente", token: t, cliente: { contacto: "" } }).code, "cliente");
  assert.equal(g.post({ action: "guardarCliente", token: t, cliente: { negocio: "X", telefono: "123" } }).code, "cliente");
  assert.equal(g.post({ action: "guardarCliente", token: t, cliente: { id: "no-existe", negocio: "X" } }).code, "not_found");
  // editar: puede vaciar campos (tel 2) y mantiene el id
  const id = a.cliente.id;
  const e = g.post({ action: "guardarCliente", token: t, cliente: { id, negocio: "Salón Luz", contacto: "Luz M.", telefono2: "", direccion: "Nueva", latitud: 8.6, longitud: -71.6 } });
  assert.equal(e.cliente.id, id);
  assert.equal(e.cliente.telefono2, "");
  assert.equal(e.cliente.contacto, "Luz M.");
  // despachador no puede
  assert.equal(g.post({ action: "guardarCliente", token: login(g, "luis", "Luis5555"), cliente: { negocio: "Y" } }).code, "forbidden");
});

test("un pedido sigue exigiendo teléfono del cliente", () => {
  const g = preparar();
  assert.equal(pedir(g, login(g), { cliente: { negocio: "Sin tel" } }).code, "cliente");
});

test("documento: nota de entrega o factura es obligatorio; factura exige RIF", () => {
  const g = preparar();
  const t = login(g);
  assert.equal(pedir(g, t, { documento: "" }).code, "documento");
  assert.equal(pedir(g, t, { documento: "Boleta" }).code, "documento");
  const sinRif = { negocio: "Sin RIF", telefono: "0414-2223344" };
  assert.equal(pedir(g, t, { documento: "Factura", cliente: sinRif }).code, "rif");
  const n1 = pedir(g, t, { documento: "Nota de entrega", cliente: sinRif });
  assert.equal(n1.ok, true);
  assert.equal(n1.pedido.documento, "Nota de entrega");
  // cliente ya guardado con RIF: basta con su id
  const conRif = pedir(g, t, { documento: "Factura" });
  assert.equal(conRif.pedido.documento, "Factura");
  const r = pedir(g, t, { documento: "Factura", cliente: { id: conRif.cliente_id, negocio: "Peluquería Bella", telefono: "0412-1234567" } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(g.tabla("Pedidos").at(-1).documento, "Factura");
  assert.equal(g.post({ action: "pedido", token: t, pedido_id: r.pedido.id }).pedido.documento, "Factura");
});

test("crédito: días obligatorios si el pago es a crédito", () => {
  const g = preparar();
  const t = login(g);
  assert.equal(pedir(g, t, { pago: "Divisas · Crédito" }).code, "credito");
  assert.equal(pedir(g, t, { pago: "Divisas · Crédito", dias_credito: 0 }).code, "credito");
  assert.equal(pedir(g, t, { pago: "Divisas · Crédito", dias_credito: 500 }).code, "credito");
  const r = pedir(g, t, { pago: "Bolívares · Crédito", dias_credito: 15 });
  assert.equal(r.pedido.dias_credito, 15);
  assert.equal(pedir(g, t, { pago: "Divisas · Contado", dias_credito: 15 }).pedido.dias_credito, 0);
});

test("cobro: vendedor marca cancelado; administración concilia o rechaza", () => {
  const g = preparar();
  const tv = login(g), ta = login(g, "ana", "Ana*2222"), tl = login(g, "luis", "Luis5555"), tk = login(g, "kevin", "Kevin9876");
  const id = pedir(g, tv, { pago: "Divisas · Crédito", dias_credito: 15 }).pedido.id;
  const cobro = (token, accion, extra = {}) => g.post({ action: "cobro", token, pedido_id: id, accion, ...extra });
  assert.equal(cobro(tv, "cancelar").code, "estado"); // aún no entregado
  g.post({ action: "estado", token: ta, pedido_id: id, estado: "confirmado", despachador_id: idDe(g, "luis") });
  g.post({ action: "estado", token: tl, pedido_id: id, estado: "entregado" });
  assert.equal(cobro(tl, "cancelar").code, "forbidden");   // despachador no
  assert.equal(cobro(tk, "cancelar").code, "not_found");   // otro vendedor no
  assert.equal(cobro(tv, "cancelar").code, "monto");
  assert.equal(cobro(tv, "cancelar", { monto: "120", moneda: "EUR" }).code, "monto");
  const c = cobro(tv, "cancelar", { monto: "120,50", moneda: "USD" });
  assert.equal(c.pedido.cobro, "cancelado");
  assert.equal(c.pedido.monto, 120.5);
  assert.equal(c.pedido.cobrado_por, "Óscar");
  assert.equal(cobro(tv, "cancelar", { monto: 1, moneda: "USD" }).code, "repetido");
  assert.equal(cobro(tv, "conciliar").code, "forbidden");  // el vendedor no concilia
  // por conciliar (Administración)
  assert.deepEqual(g.post({ action: "pedidos", token: ta, por_conciliar: true }).pedidos.map((p) => p.id), [id]);
  assert.equal(cobro(ta, "rechazar").code, "motivo");
  const rr = cobro(ta, "rechazar", { motivo: "No llegó la transferencia" });
  assert.equal(rr.pedido.cobro, "");
  assert.equal(rr.pedido.monto, "");
  cobro(tv, "cancelar", { monto: 100, moneda: "USD" });
  const k = cobro(ta, "conciliar", { monto: 98, moneda: "USD" }); // Administración corrige lo recibido
  assert.equal(k.pedido.cobro, "conciliado");
  assert.equal(k.pedido.conciliado_por, "Ana");
  assert.equal(k.pedido.monto, 98);
  assert.equal(g.post({ action: "pedidos", token: ta, por_conciliar: true }).pedidos.length, 0);
  assert.equal(cobro(ta, "desconciliar").pedido.cobro, "cancelado");
  assert.deepEqual(g.tabla("Historial").map((h) => h.accion).slice(-5), ["cobrado", "pago_rechazado", "cobrado", "conciliado", "conciliacion_deshecha"]);
  assert.equal(g.tabla("Historial").find((h) => h.accion === "pago_rechazado").detalle, "No llegó la transferencia");
});

test("administración puede conciliar directo un pago que recibió", () => {
  const g = preparar();
  const tv = login(g), ta = login(g, "ana", "Ana*2222"), tl = login(g, "luis", "Luis5555");
  const id = pedir(g, tv).pedido.id;
  g.post({ action: "estado", token: ta, pedido_id: id, estado: "confirmado", despachador_id: idDe(g, "luis") });
  g.post({ action: "estado", token: tl, pedido_id: id, estado: "entregado" });
  assert.equal(g.post({ action: "cobro", token: ta, pedido_id: id, accion: "conciliar" }).code, "monto");
  const r = g.post({ action: "cobro", token: ta, pedido_id: id, accion: "conciliar", monto: 5000, moneda: "Bs" });
  assert.equal(r.pedido.cobro, "conciliado");
  assert.equal(r.pedido.moneda, "Bs");
  assert.equal(r.pedido.cobrado_por, "Ana");
});

test("por cobrar: crédito sin pagar (cualquier estado) y contado entregado sin pagar", () => {
  const g = preparar();
  const tv = login(g), ta = login(g, "ana", "Ana*2222"), tl = login(g, "luis", "Luis5555");
  const cred = pedir(g, tv, { pago: "Divisas · Crédito", dias_credito: 7 }).pedido.id;
  const cont = pedir(g, tv, { pago: "Divisas · Contado" }).pedido.id;
  const anul = pedir(g, tv, { pago: "Divisas · Crédito", dias_credito: 7 }).pedido.id;
  g.post({ action: "estado", token: ta, pedido_id: anul, estado: "cancelado", motivo: "x" });
  const ids = () => g.post({ action: "pedidos", token: tv, por_cobrar: true }).pedidos.map((p) => p.id).sort();
  assert.deepEqual(ids(), [cred]);
  g.post({ action: "estado", token: ta, pedido_id: cont, estado: "confirmado", despachador_id: idDe(g, "luis") });
  g.post({ action: "estado", token: tl, pedido_id: cont, estado: "entregado" });
  assert.deepEqual(ids(), [cred, cont].sort());
  g.post({ action: "cobro", token: tv, pedido_id: cont, accion: "cancelar", monto: 50, moneda: "USD" });
  assert.deepEqual(ids(), [cred]); // cancelado: ya no está por cobrar (queda por conciliar)
});

test("conciliados del período: solo cobros conciliados, cada rol ve lo suyo", () => {
  const g = preparar();
  const tv = login(g), tk = login(g, "kevin", "Kevin9876"), ta = login(g, "ana", "Ana*2222"), tl = login(g, "luis", "Luis5555");
  const entregar = (token, pago = "Divisas · Contado") => {
    const id = pedir(g, token, { pago }).pedido.id;
    g.post({ action: "estado", token: ta, pedido_id: id, estado: "confirmado", despachador_id: idDe(g, "luis") });
    g.post({ action: "estado", token: tl, pedido_id: id, estado: "entregado" });
    return id;
  };
  const a = entregar(tv), b = entregar(tk, "Bolívares · Contado"), c = entregar(tv);
  g.post({ action: "cobro", token: tv, pedido_id: a, accion: "cancelar", monto: 100, moneda: "USD" });
  g.post({ action: "cobro", token: ta, pedido_id: a, accion: "conciliar" });
  g.post({ action: "cobro", token: ta, pedido_id: b, accion: "conciliar", monto: 3600, moneda: "Bs" });
  g.post({ action: "cobro", token: tv, pedido_id: c, accion: "cancelar", monto: 40, moneda: "USD" }); // sin conciliar
  const ids = (t, dias) => g.post({ action: "pedidos", token: t, conciliados: true, dias }).pedidos.map((p) => p.id).sort();
  assert.deepEqual(ids(ta, 30), [a, b].sort());
  assert.deepEqual(ids(tv, 30), [a]);
  g.setAhora("2026-12-20T12:00:00Z");
  assert.deepEqual(ids(login(g, "ana", "Ana*2222"), 7), []); // fuera del período
});

/* ---------- Precios e inventario (v3) ---------- */
function conPrecios(g) {
  const tk = login(g, "ana", "Ana*2222");
  // Precios FINALES · Babosa: normal 10, mayor 8, pronto 9, efectivo crédito 7, efectivo pronto 6 (rebajas 1 / 3 / 4)
  // Kit: normal 20, mayor 18, pronto 18, efectivo crédito 14, efectivo pronto 12 (rebajas 2 / 6 / 8)
  assert.equal(g.post({ action: "guardarPrecio", token: tk, code: "BC-01", menor: "10", mayor: "8", pronto: 9, efectivo_credito: 7, efectivo_pronto: 6 }).ok, true);
  assert.equal(g.post({ action: "guardarPrecio", token: tk, code: "KT-01", menor: 20, mayor: "18,00", pronto: 18, efectivo_credito: "14", efectivo_pronto: 12 }).ok, true);
  return tk;
}

test("precios: solo gestión los edita; validaciones; catálogo público con precios", () => {
  const g = preparar();
  const tv = login(g);
  assert.equal(g.post({ action: "guardarPrecio", token: tv, code: "BC-01", menor: 10 }).code, "forbidden");
  const ta = conPrecios(g);
  assert.match(g.post({ action: "guardarPrecio", token: ta, code: "BC-02", menor: 5, mayor: 6 }).error, /mayor no puede/);
  assert.match(g.post({ action: "guardarPrecio", token: ta, code: "BC-02", menor: "" }).error, /por menor/);
  assert.match(g.post({ action: "guardarPrecio", token: ta, code: "BC-02", menor: 5, pronto: -1 }).error, /Revisá/);
  assert.match(g.post({ action: "guardarPrecio", token: ta, code: "BC-02", menor: 5, efectivo_pronto: 6 }).error, /efectivo pronto pago no puede ser más alto/);
  const fila = g.tabla("Precios").find((x) => x.code === "BC-01");
  assert.equal(fila.menor, 10); assert.equal(fila.updated_por, "Ana");
  assert.equal(g.tabla("Precios").length, 19); // actualiza la fila, no agrega
  const pub = g.post({ action: "catalogo" });
  assert.equal(pub.ok, true);
  const b = pub.productos.find((x) => x.code === "BC-01");
  assert.deepEqual(b, { code: "BC-01", menor: 10, mayor: 8, desc_pronto: 1, desc_efectivo_credito: 3, desc_efectivo_pronto: 4, agotado: false });
  assert.equal(pub.cajas_mayor, 15);
  assert.deepEqual(pub.pagos.map((x) => x.id), ["credito", "pronto", "efectivo_credito", "efectivo_pronto"]);
  // con sesión trae existencias
  const conSes = g.post({ action: "catalogo", token: tv }).productos.find((x) => x.code === "BC-01");
  assert.equal(conSes.controlado, false); assert.equal(conSes.disponible, null);
});

test("pedido con precios: menor < 15 cajas, mayor desde 15, excepción del vendedor, total según pago", () => {
  const g = preparar();
  conPrecios(g);
  const tk = login(g);
  // 2 Babosa + 1 Kit = 3 cajas · menor: 2×10 + 20 = 40 · Crédito 8 días
  let r = pedir(g, tk, { tipo_pago: "credito", dias_credito: 8 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.pedido.nivel_precio, "menor");
  assert.equal(r.pedido.total, 40);
  assert.equal(r.pedido.pago, "Crédito");
  assert.deepEqual(r.pedido.items.map((it) => it.precio), [10, 20]);
  assert.equal(g.tabla("PedidoItems")[0].desc_efectivo_pronto, 4);
  // Efectivo pronto pago: 2×(10−4) + (20−8) = 24
  r = pedir(g, tk, { tipo_pago: "efectivo_pronto" });
  assert.equal(r.pedido.total, 24); assert.equal(r.pedido.dias_credito, 0);
  // Excepción: precio mayor con 3 cajas → 2×8 + 18 = 34
  r = pedir(g, tk, { tipo_pago: "credito", dias_credito: 15, precio_mayor: true });
  assert.equal(r.pedido.nivel_precio, "mayor"); assert.equal(r.pedido.excepcion_precio, true); assert.equal(r.pedido.total, 34);
  assert.match(g.tabla("Historial").at(-1).detalle, /precio mayor por excepción/);
  // 15 cajas → mayor sin excepción
  r = pedir(g, tk, { tipo_pago: "pronto", items: [{ code: "BC-01", producto: "Babosa", cajas: 15, unidades_caja: 6 }] });
  assert.equal(r.pedido.nivel_precio, "mayor"); assert.equal(r.pedido.excepcion_precio, false);
  assert.equal(r.pedido.total, 15 * (8 - 1));
  // Crédito exige días; tipo inválido cae al texto
  assert.equal(pedir(g, tk, { tipo_pago: "efectivo_credito" }).code, "credito");
  r = pedir(g, tk, { pago: "Divisas · Contado" });
  assert.equal(r.pedido.tipo_pago, "pronto"); assert.equal(r.pedido.pago, "Divisas · Contado");
});

test("producto sin precio cargado: total 0 y no falla", () => {
  const g = preparar();
  const tk = login(g);
  const r = pedir(g, tk, { tipo_pago: "pronto" });
  assert.equal(r.ok, true); assert.equal(r.pedido.total, 0);
});

test("inventario: entradas y ajustes; aprobar aparta stock; anular lo devuelve; no se pide más de lo que hay", () => {
  const g = preparar();
  const ta = conPrecios(g);
  const tv = login(g);
  assert.equal(g.post({ action: "movimiento", token: tv, code: "BC-01", cajas: 5 }).code, "forbidden");
  assert.match(g.post({ action: "movimiento", token: ta, code: "BC-01", cajas: -2 }).error, /Ajuste/);
  assert.match(g.post({ action: "movimiento", token: ta, code: "BC-01", cajas: -2, tipo: "ajuste" }).error, /motivo/);
  assert.equal(g.post({ action: "movimiento", token: ta, code: "bc-01", cajas: 5 }).disponible, 5);
  assert.equal(g.post({ action: "movimiento", token: ta, code: "BC-01", cajas: -1, tipo: "ajuste", nota: "rota" }).disponible, 4);
  assert.equal(g.tabla("Inventario")[0].producto, "Babosa");
  // Kit sin movimientos: no se controla
  const p1 = pedir(g, tv, { tipo_pago: "pronto", items: [{ code: "BC-01", producto: "Babosa", cajas: 3 }, { code: "KT-01", producto: "Kit", cajas: 50 }] });
  assert.equal(p1.ok, true, JSON.stringify(p1));
  const p2 = pedir(g, tv, { tipo_pago: "pronto", items: [{ code: "BC-01", producto: "Babosa", cajas: 3 }] });
  assert.equal(p2.ok, true); // en proceso no aparta
  let inv = g.post({ action: "inventario", token: ta });
  let b = inv.productos.find((x) => x.code === "BC-01");
  assert.deepEqual([b.cargado, b.aprobado, b.en_proceso, b.disponible, b.controlado], [4, 0, 6, 4, true]);
  assert.equal(inv.movimientos.length, 2);
  assert.match(pedir(g, tv, { tipo_pago: "pronto", items: [{ code: "BC-01", producto: "Babosa", cajas: 5 }] }).error, /Sin stock suficiente: Babosa \(BC-01\): pediste 5, hay 4/);
  const luis = idDe(g, "luis");
  assert.equal(g.post({ action: "estado", token: ta, pedido_id: p1.pedido.id, estado: "confirmado", despachador_id: luis }).ok, true);
  b = g.post({ action: "inventario", token: ta }).productos.find((x) => x.code === "BC-01");
  assert.deepEqual([b.aprobado, b.en_proceso, b.disponible], [3, 3, 1]);
  // El segundo ya no alcanza al aprobar
  const r = g.post({ action: "estado", token: ta, pedido_id: p2.pedido.id, estado: "confirmado", despachador_id: luis });
  assert.equal(r.code, "stock"); assert.match(r.error, /hay 1/);
  // Público: agotado cuando no queda
  g.post({ action: "movimiento", token: ta, code: "BC-01", cajas: -1, tipo: "ajuste", nota: "conteo" });
  assert.equal(g.post({ action: "catalogo" }).productos.find((x) => x.code === "BC-01").agotado, true);
  assert.equal(g.post({ action: "catalogo", token: tv }).productos.find((x) => x.code === "BC-01").disponible, 0);
  // Anular el aprobado devuelve el stock
  g.post({ action: "estado", token: ta, pedido_id: p1.pedido.id, estado: "cancelado", motivo: "prueba" });
  b = g.post({ action: "inventario", token: ta }).productos.find((x) => x.code === "BC-01");
  assert.equal(b.disponible, 3);
  assert.equal(g.post({ action: "estado", token: ta, pedido_id: p2.pedido.id, estado: "confirmado", despachador_id: luis }).ok, true);
});

test("cobro con otro método de pago: recalcula el total final con el descuento", () => {
  const g = preparar();
  const ta = conPrecios(g);
  const tv = login(g);
  const p = pedir(g, tv, { tipo_pago: "credito", dias_credito: 8 }).pedido; // total 40
  const luis = idDe(g, "luis");
  g.post({ action: "estado", token: ta, pedido_id: p.id, estado: "confirmado", despachador_id: luis });
  g.post({ action: "estado", token: login(g, "luis", "Luis5555"), pedido_id: p.id, estado: "entregado" });
  // Pagó en efectivo de contado: 2×(10−4) + (20−8) = 24
  let r = g.post({ action: "cobro", token: tv, pedido_id: p.id, accion: "cancelar", tipo_pago_real: "efectivo_pronto", monto: 24, moneda: "USD" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.pedido.tipo_pago_real, "efectivo_pronto"); assert.equal(r.pedido.total_final, 24);
  assert.equal(r.pedido.total, 40); // lo acordado queda
  assert.match(g.tabla("Historial").at(-1).detalle, /Pagó como Efectivo pronto pago \(total 24 \$\) · 24 USD/);
  // Rechazo limpia; conciliar directo sin método usa el acordado
  g.post({ action: "cobro", token: ta, pedido_id: p.id, accion: "rechazar", motivo: "no" });
  assert.equal(g.tabla("Pedidos")[0].total_final, "");
  r = g.post({ action: "cobro", token: ta, pedido_id: p.id, accion: "conciliar", monto: 40, moneda: "USD" });
  assert.equal(r.pedido.tipo_pago_real, "credito"); assert.equal(r.pedido.total_final, 40);
});

/* ---------- Pedidos web y borrar (v3) ---------- */
const WEB = { cliente: { negocio: "Salón Luz", contacto: "Luz", telefono: "0414-5551234", direccion: "Centro" },
  items: [{ code: "BC-01", producto: "Babosa", cajas: 3, unidades_caja: 6, unidad: "unidades" }], tipo_pago: "efectivo_pronto" };

test("pedido web: el cliente elige vendedor; validaciones; límite por teléfono; sin duplicar por ref", () => {
  const g = preparar();
  conPrecios(g);
  const vend = g.post({ action: "vendedores" });
  assert.deepEqual(vend.vendedores.map((v) => v.nombre), ["Kevin", "Óscar"]);
  const oscar = idDe(g, "oscar");
  assert.equal(g.post({ action: "pedidoWeb", ...WEB }).code, "vendedor");
  assert.equal(g.post({ action: "pedidoWeb", ...WEB, vendedor_id: idDe(g, "ana") }).code, "vendedor"); // solo vendedores
  assert.equal(g.post({ action: "pedidoWeb", ...WEB, vendedor_id: oscar, cliente: { negocio: "X", telefono: "12" } }).code, "telefono");
  assert.equal(g.post({ action: "pedidoWeb", ...WEB, vendedor_id: oscar, items: [] }).code, "empty");
  const r = g.post({ action: "pedidoWeb", ...WEB, vendedor_id: oscar, ref: "web-ab12cd" });
  assert.equal(r.ok, true); assert.equal(r.id, "WEB-AB12CD");
  assert.equal(g.post({ action: "pedidoWeb", ...WEB, vendedor_id: oscar, ref: "WEB-AB12CD" }).duplicado, true);
  const fila = g.tabla("PedidosWeb")[0];
  assert.equal(fila.vendedor, "Óscar"); assert.equal(fila.total, 3 * 6); assert.equal(fila.estado, "nuevo");
  assert.equal(g.tabla("Clientes").length, 0); // el cliente se guarda cuando el vendedor lo toma
  for (let i = 0; i < 4; i++) g.post({ action: "pedidoWeb", ...WEB, vendedor_id: oscar });
  assert.equal(g.post({ action: "pedidoWeb", ...WEB, vendedor_id: oscar }).code, "limite");
});

test("pedido web: lo ve su vendedor y Administración; lo toma su vendedor (o Master); queda enlazado", () => {
  const g = preparar();
  conPrecios(g);
  const oscar = idDe(g, "oscar");
  const id = g.post({ action: "pedidoWeb", ...WEB, vendedor_id: oscar }).id;
  const to = login(g), tk = login(g, "kevin", "Kevin9876"), ta = login(g, "ana", "Ana*2222");
  assert.equal(g.post({ action: "pedidosWeb", token: tk }).pedidos.length, 0);
  const deAna = g.post({ action: "pedidosWeb", token: ta }).pedidos;
  assert.equal(deAna.length, 1); assert.equal(deAna[0].puede_tomar, false);
  const mio = g.post({ action: "pedidosWeb", token: to }).pedidos[0];
  assert.equal(mio.puede_tomar, true); assert.equal(mio.items[0].precio, 10); assert.equal(mio.cliente.telefono, "0414-5551234");
  // Administración no lo toma; otro vendedor tampoco
  assert.equal(pedir(g, ta, { web_id: id, tipo_pago: "pronto" }).code, "forbidden");
  assert.equal(pedir(g, tk, { web_id: id, tipo_pago: "pronto" }).code, "forbidden");
  // Óscar lo edita (4 cajas) y lo envía
  const r = pedir(g, to, { web_id: id, tipo_pago: "pronto", cliente: { ...WEB.cliente, id: undefined }, items: [{ code: "BC-01", producto: "Babosa", cajas: 4 }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.pedido.web_id, id); assert.equal(r.pedido.estado, "pendiente"); assert.equal(r.pedido.total_cajas, 4);
  assert.match(g.tabla("Historial").at(-1).detalle, new RegExp("desde pedido web " + id));
  const w = g.tabla("PedidosWeb")[0];
  assert.equal(w.estado, "tomado"); assert.equal(w.pedido_id, r.pedido.id);
  assert.equal(g.post({ action: "pedidosWeb", token: to }).pedidos.length, 0);
  assert.equal(pedir(g, to, { web_id: id, tipo_pago: "pronto" }).code, "web"); // no se toma dos veces
  // Descartar con motivo
  const id2 = g.post({ action: "pedidoWeb", ...WEB, vendedor_id: oscar }).id;
  assert.equal(g.post({ action: "descartarWeb", token: to, id: id2 }).code, "motivo");
  assert.equal(g.post({ action: "descartarWeb", token: ta, id: id2, motivo: "x" }).code, "forbidden");
  assert.equal(g.post({ action: "descartarWeb", token: to, id: id2, motivo: "Repetido" }).ok, true);
  assert.equal(g.post({ action: "pedidosWeb", token: to, estado: "todos" }).pedidos.length, 2);
  // Master puede tomar
  const id3 = g.post({ action: "pedidoWeb", ...WEB, vendedor_id: oscar }).id;
  assert.equal(pedir(g, login(g, "jose", "Skala#2026"), { web_id: id3, tipo_pago: "pronto" }).ok, true);
});

test("borrar pedido: vendedor los suyos, Master todos; sale de listas, resumen y stock", () => {
  const g = preparar();
  const ta = conPrecios(g);
  g.post({ action: "movimiento", token: ta, code: "BC-01", cajas: 10 });
  const to = login(g), tk = login(g, "kevin", "Kevin9876"), tj = login(g, "jose", "Skala#2026");
  const p1 = pedir(g, to, { tipo_pago: "pronto" }).pedido;
  const p2 = pedir(g, tk, { tipo_pago: "pronto" }).pedido;
  g.post({ action: "estado", token: ta, pedido_id: p1.id, estado: "confirmado", despachador_id: idDe(g, "luis") });
  assert.equal(g.post({ action: "inventario", token: ta }).productos.find((x) => x.code === "BC-01").disponible, 8);
  assert.equal(g.post({ action: "borrarPedido", token: to, pedido_id: p1.id }).code, "motivo");
  assert.equal(g.post({ action: "borrarPedido", token: to, pedido_id: p2.id, motivo: "x" }).code, "not_found"); // no es suyo
  assert.equal(g.post({ action: "borrarPedido", token: ta, pedido_id: p2.id, motivo: "x" }).code, "forbidden"); // admin no
  assert.equal(g.post({ action: "borrarPedido", token: to, pedido_id: p1.id, motivo: "Era de prueba" }).ok, true);
  assert.equal(g.post({ action: "borrarPedido", token: tj, pedido_id: p2.id, motivo: "Prueba" }).ok, true);
  assert.equal(g.post({ action: "pedidos", token: ta }).pedidos.length, 0);
  assert.equal(g.post({ action: "pedido", token: ta, pedido_id: p1.id }).code, "not_found");
  assert.equal(g.post({ action: "resumen", token: ta, dias: 1 }).total_pedidos, 0);
  assert.equal(g.post({ action: "inventario", token: ta }).productos.find((x) => x.code === "BC-01").disponible, 10);
  assert.equal(g.tabla("Pedidos").length, 2); // siguen en la hoja
  assert.equal(g.tabla("Historial").filter((h) => h.accion === "borrado").length, 2);
});

/* ---------- App Android (v3): sesión larga, datos para el teléfono y ajustes ---------- */
test("login desde la app: sesión de 30 días; desde la web: 12 horas", () => {
  const g = preparar();
  const corta = g.post({ action: "login", usuario: "oscar", clave: "Oscar.1234" }).token;
  const larga = g.post({ action: "login", usuario: "oscar", clave: "Oscar.1234", dispositivo: true }).token;
  const dur = (t) => (Number(t.split(".")[1]) - Date.parse("2026-10-25T18:30:00Z")) / 3600000;
  assert.equal(Math.round(dur(corta)), 12);
  assert.equal(Math.round(dur(larga)), 30 * 24);
  g.setAhora("2026-11-10T12:00:00Z");
  assert.equal(g.post({ action: "yo", token: corta }).code, "auth");
  assert.equal(g.post({ action: "yo", token: larga }).ok, true);
});

test("sincronizar: precios, stock, clientes, pedidos del usuario y pedidos web; config pública", () => {
  const g = preparar();
  const ta = conPrecios(g);
  const to = login(g);
  pedir(g, to, { tipo_pago: "pronto" });
  pedir(g, login(g, "kevin", "Kevin9876"), { tipo_pago: "pronto", cliente: { ...CLIENTE, telefono: "0416-0000000", negocio: "Otro", rif_cedula: "" } });
  g.post({ action: "pedidoWeb", ...WEB, vendedor_id: idDe(g, "oscar") });
  const s = g.post({ action: "sincronizar", token: to });
  assert.equal(s.ok, true);
  assert.equal(s.pedidos.length, 1); // solo los suyos
  assert.equal(s.clientes.length, 2);
  assert.equal(s.pedidos_web.length, 1);
  assert.equal(s.catalogo.productos.find((x) => x.code === "BC-01").menor, 10);
  assert.equal(s.catalogo.productos.find((x) => x.code === "BC-01").controlado, false);
  assert.equal(s.config.version_apk, 1);
  assert.equal(g.post({ action: "sincronizar", token: ta }).pedidos.length, 2);
  const d = g.post({ action: "sincronizar", token: login(g, "luis", "Luis5555") });
  assert.deepEqual([d.pedidos.length, d.clientes.length, d.pedidos_web.length], [0, 0, 0]);
  // Config: se edita en la hoja
  const fila = g.tabla("Config").findIndex((x) => x.clave === "version_apk") + 2;
  g.hojas.Config.filas[fila - 1][1] = 3;
  g.hojas.Config.filas.find((f) => f[0] === "url_apk" || f[0] === "'url_apk")[1] = "'https://github.com/x/releases/download/v3/skala.apk";
  const c = g.post({ action: "config" }).config;
  assert.equal(c.version_apk, 3);
  assert.equal(c.url_apk, "https://github.com/x/releases/download/v3/skala.apk");
});

/* ---------- Varios roles por usuario ---------- */
test("un usuario con varios roles puede hacer todo lo de cada uno", () => {
  const g = preparar();
  g.ctx.crearUsuario("mixto", "Mixto", "despachador, vendedor", "Mixto1234");
  const u = g.tabla("Usuarios").find((x) => x.usuario === "mixto");
  assert.equal(u.rol, "vendedor, despachador"); // ordenado por rango
  const r = g.post({ action: "login", usuario: "mixto", clave: "Mixto1234" });
  assert.deepEqual([r.usuario.rol, r.usuario.roles, r.usuario.rol_nombre], ["vendedor", ["vendedor", "despachador"], "Vendedor · Despachador"]);
  const tm = r.token;
  // como vendedor: toma pedidos y busca clientes
  const p = pedir(g, tm, { tipo_pago: "pronto" });
  assert.equal(p.ok, true);
  assert.equal(g.post({ action: "clientes", token: tm }).ok, true);
  // aparece como despachador y como vendedor elegible
  const ta = login(g, "ana", "Ana*2222");
  assert.ok(g.post({ action: "despachadores", token: ta }).despachadores.some((d) => d.nombre === "Mixto"));
  assert.ok(g.post({ action: "vendedores" }).vendedores.some((d) => d.nombre === "Mixto"));
  // un pedido de otro vendedor asignado a él como despachador: lo ve y lo entrega
  const otro = pedir(g, login(g), { tipo_pago: "pronto", cliente: { ...CLIENTE, telefono: "0416-1112233", rif_cedula: "" } }).pedido;
  assert.equal(g.post({ action: "pedido", token: tm, pedido_id: otro.id }).code, "not_found");
  g.post({ action: "estado", token: ta, pedido_id: otro.id, estado: "confirmado", despachador_id: u.id });
  assert.equal(g.post({ action: "pedido", token: tm, pedido_id: otro.id }).ok, true);
  assert.equal(g.post({ action: "estado", token: tm, pedido_id: otro.id, estado: "entregado" }).ok, true);
  // su propio pedido: lo anula como vendedor (en proceso); el de otro no
  assert.equal(g.post({ action: "estado", token: tm, pedido_id: p.pedido.id, estado: "cancelado", motivo: "x" }).ok, true);
  assert.match(g.tabla("Historial").find((h) => h.accion === "entregado").usuario, /Mixto \(Vendedor · Despachador\)/);
  // no es gestión
  assert.equal(g.post({ action: "despachadores", token: tm }).code, "forbidden");
  assert.equal(g.post({ action: "pedidos", token: tm }).pedidos.length, 2); // el suyo y el asignado
});

test("Master puede asignar varios roles; validaciones de roles y del último Master", () => {
  const g = preparar();
  const tj = login(g, "jose", "Skala#2026");
  const luis = idDe(g, "luis");
  let r = g.post({ action: "guardarUsuario", token: tj, id: luis, usuario: "luis", nombre: "Luis", roles: ["despachador", "vendedor"], activo: true });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.usuario.roles, ["vendedor", "despachador"]);
  assert.equal(g.post({ action: "guardarUsuario", token: tj, id: luis, usuario: "luis", nombre: "Luis", roles: ["jefe"] }).code, "usuario");
  assert.deepEqual(g.post({ action: "usuarios", token: tj }).usuarios.find((x) => x.id === luis).roles, ["vendedor", "despachador"]);
  // el único Master puede sumar roles, pero no dejar de ser Master
  const jose = idDe(g, "jose");
  assert.equal(g.post({ action: "guardarUsuario", token: tj, id: jose, usuario: "jose", nombre: "José", roles: ["master", "vendedor"] }).ok, true);
  assert.match(g.post({ action: "guardarUsuario", token: tj, id: jose, usuario: "jose", nombre: "José", roles: ["admin", "vendedor"] }).error, /Master activo/);
  // sumar Master exige clave de 8
  assert.match(g.post({ action: "guardarUsuario", token: tj, id: luis, usuario: "luis", nombre: "Luis", roles: ["master", "despachador"] }).error, /clave nueva/);
});

test("precios finales: el de cada forma de pago es el que paga el cliente; varios productos a la vez", () => {
  const g = preparar();
  const ta = login(g, "ana", "Ana*2222");
  // ejemplo del dueño: 29,5 · 28,3 · 24 · 23,3
  let r = g.post({ action: "guardarPrecio", token: ta, codes: ["BC-02", "BC-03", "bc-04"], menor: "29,5", mayor: 27, pronto: "28,3", efectivo_credito: 24, efectivo_pronto: "23,3" });
  assert.equal(r.ok, true); assert.equal(r.guardados, 3);
  const p = g.tabla("Precios").find((x) => x.code === "BC-04");
  assert.deepEqual([p.menor, p.pronto, p.efectivo_credito, p.efectivo_pronto], [29.5, 28.3, 24, 23.3]);
  const cat = g.post({ action: "catalogo" }).productos.find((x) => x.code === "BC-03");
  assert.deepEqual([cat.desc_pronto, cat.desc_efectivo_credito, cat.desc_efectivo_pronto], [1.2, 5.5, 6.2]);
  const tv = login(g);
  const items = [{ code: "BC-02", producto: "Banana", cajas: 2 }];
  const t = (tipo, extra = {}) => pedir(g, tv, { tipo_pago: tipo, items, dias_credito: 8, ...extra }).pedido.total;
  assert.equal(t("credito"), 59); assert.equal(t("pronto"), 56.6); assert.equal(t("efectivo_credito"), 48); assert.equal(t("efectivo_pronto"), 46.6);
  // al mayor se aplica la misma rebaja: 27 − 6,2 = 20,8
  assert.equal(t("efectivo_pronto", { items: [{ code: "BC-02", producto: "Banana", cajas: 15 }] }), r2(15 * 20.8));
  // editar precios no borra los datos del producto
  r = g.post({ action: "guardarProducto", token: ta, nombre: "Coco", tipo: "banos", linea: "Nutrición" });
  g.post({ action: "guardarPrecio", token: ta, code: r.producto.code, menor: 12 });
  assert.equal(g.tabla("Precios").find((x) => x.code === r.producto.code).linea, "Nutrición");
});
const r2 = (n) => Math.round(n * 100) / 100;

test("producto nuevo: código automático, sale en el catálogo, empieza sin stock (gris) hasta cargar entrada", () => {
  const g = preparar();
  const ta = login(g, "ana", "Ana*2222");
  assert.equal(g.post({ action: "guardarProducto", token: login(g), nombre: "X" }).code, "forbidden");
  assert.match(g.post({ action: "guardarProducto", token: ta, nombre: "" }).error, /nombre/);
  assert.match(g.post({ action: "guardarProducto", token: ta, nombre: "X", imagen: "http://x" }).error, /https/);
  assert.match(g.post({ action: "guardarProducto", token: ta, nombre: "X", code: "BC-01" }).error, /de siempre/);
  let r = g.post({ action: "guardarProducto", token: ta, nombre: "Coco Power", tipo: "banos", linea: "Nutrición", beneficio: "Nutre", cabello: "2A–4C", unidades_caja: 6, menor: 30, pronto: 28 });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.producto.code, "BC-12");
  r = g.post({ action: "guardarProducto", token: ta, nombre: "Kit Coco", tipo: "kits" });
  assert.equal(r.producto.code, "KT-09");
  assert.match(g.post({ action: "guardarProducto", token: ta, nombre: "Otro", code: "BC-12" }).error, /Ya existe/);
  const cat = g.post({ action: "catalogo" }).productos;
  const coco = cat.find((x) => x.code === "BC-12");
  assert.deepEqual(coco.info, { nombre: "Coco Power", tipo: "banos", linea: "Nutrición", beneficio: "Nutre", cabello: "2A–4C", unidades: 6, imagen: "" });
  assert.equal(coco.agotado, true); assert.equal(coco.menor, 30); assert.equal(coco.desc_pronto, 2);
  assert.equal(cat.find((x) => x.code === "BC-01").info, undefined); // los de siempre no traen info
  // no se puede pedir hasta que haya stock
  const tv = login(g);
  assert.match(pedir(g, tv, { tipo_pago: "pronto", items: [{ code: "BC-12", producto: "Coco Power", cajas: 1 }] }).error, /hay 0/);
  g.post({ action: "movimiento", token: ta, code: "BC-12", cajas: 10 });
  assert.equal(g.post({ action: "catalogo" }).productos.find((x) => x.code === "BC-12").agotado, false);
  assert.equal(pedir(g, tv, { tipo_pago: "pronto", items: [{ code: "BC-12", producto: "Coco Power", cajas: 1 }] }).ok, true);
  // editar
  r = g.post({ action: "guardarProducto", token: ta, code: "BC-12", editar: true, nombre: "Coco Power 2", tipo: "banos" });
  assert.equal(r.ok, true);
  const inv = g.post({ action: "inventario", token: ta }).productos.find((x) => x.code === "BC-12");
  assert.equal(inv.producto, "Coco Power 2"); assert.equal(inv.nuevo, true); assert.equal(inv.disponible, 10); assert.equal(inv.en_proceso, 1); assert.equal(inv.menor, 30);
});
