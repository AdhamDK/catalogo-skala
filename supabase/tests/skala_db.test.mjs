/* Pruebas del motor PostgreSQL de Skala (supabase/schema.sql) — Fase B (seguridad, concurrencia, login).
   Correr (desde supabase/tests):  npm install  &&  node --test */
import test from "node:test";
import assert from "node:assert/strict";
import { crearBase, rpc, login, filas, CLAVES } from "./base.mjs";

const ahora = () => new Date().toISOString();
const pedidoNuevo = (id, ses, extra = {}) => ({
  id, fecha: "2026-11-07 10:00", vendedor_id: ses.id, vendedor: ses.nombre, cliente_id: "C1", cliente: "María", negocio: "Peluquería Bella",
  total_cajas: 2, detalle_unidades: "12 unidades", pago: "Crédito", tipo_pago: "credito", nivel_precio: "menor", excepcion_precio: false,
  total: "20", nota: "", documento: "Nota de entrega", dias_credito: 7, cobro: "", estado: "pendiente", estado_at: ahora(), estado_por: ses.nombre,
  motivo: "", client_ref: "ref-" + Math.random().toString(36).slice(2), created_at: ahora(), updated_at: ahora(), web_id: "", despachador_id: "", ...extra,
});
const itemsDe = (pid) => [{ pedido_id: pid, code: "BC-01", producto: "Babosa", cajas: 2, unidades_caja: "6", unidad: "unidades", total_unidades: "12", precio: 10 }];
const lotePedido = (pid, ses, extra = {}) => [
  { tabla: "Pedidos", modo: "nuevo", fila: pedidoNuevo(pid, ses, extra) },
  { tabla: "PedidoItems", modo: "reemplazar_pedido", pedido_id: pid, filas: itemsDe(pid) },
  { tabla: "Historial", fila: { pedido_id: pid, accion: "creado", detalle: "2 cajas", usuario: "FALSO (Master)" } },
];
const sesDe = async (db, token) => (await rpc(db, { op: "yo", token })).usuario;

/* ---------------- Permisos de funciones (PostgREST expone todo lo de public) ---------------- */
test("anon NO puede invocar helpers internos (skala_crear_token, skala_secreto, skala_firmar...)", async () => {
  const db = await crearBase();
  for (const sql of [
    "SELECT public.skala_crear_token('U1', true)",
    "SELECT public.skala_secreto()",
    "SELECT public.skala_firmar('U1.9999999999999')",
    "SELECT public.skala_hash_pin('U1', 'x')",
    "SELECT public.skala_verificar_token('a.b.c')",
    "SELECT public.skala_sumar_intento('x', interval '1 minute')",
  ]) {
    await db.exec("SET ROLE anon");
    await assert.rejects(db.query(sql), /permission denied/i, sql);
    await db.exec("RESET ROLE");
  }
});

test("anon NO puede leer tablas directo (RLS + REVOKE), pero sí llamar skala_db", async () => {
  const db = await crearBase();
  for (const t of ["usuarios", "clientes", "pedidos", "pagos", "skala_secretos", "skala_intentos"]) {
    await db.exec("SET ROLE anon");
    await assert.rejects(db.query(`SELECT * FROM public.${t}`), /permission denied/i, t);
    await db.exec("RESET ROLE");
  }
  const r = await rpc(db, { op: "vendedores_publico" });
  assert.equal(r.ok, true);
});

/* ---------------- Login ---------------- */
test("login correcto devuelve token compatible y 5 fallos bloquean 10 minutos (code: locked)", async () => {
  const db = await crearBase();
  const ok = await rpc(db, { op: "login", usuario: "Óscar", clave: CLAVES.oscar });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.match(ok.token, /^U3\.\d+\.[0-9a-f]{64}$/);
  for (let i = 0; i < 5; i++) {
    const r = await rpc(db, { op: "login", usuario: "oscar", clave: "mala" });
    assert.equal(r.code, "bad_pin");
  }
  const bloqueado = await rpc(db, { op: "login", usuario: "oscar", clave: CLAVES.oscar });
  assert.equal(bloqueado.code, "locked");
  // otro usuario no queda bloqueado
  assert.equal((await rpc(db, { op: "login", usuario: "kevin", clave: CLAVES.kevin })).ok, true);
  // pasada la ventana, vuelve a entrar
  await db.exec("UPDATE public.skala_intentos SET desde = now() - interval '11 minutes'");
  assert.equal((await rpc(db, { op: "login", usuario: "oscar", clave: CLAVES.oscar })).ok, true);
});

test("un login correcto limpia los intentos fallidos", async () => {
  const db = await crearBase();
  for (let i = 0; i < 4; i++) await rpc(db, { op: "login", usuario: "kevin", clave: "mala" });
  assert.equal((await rpc(db, { op: "login", usuario: "kevin", clave: CLAVES.kevin })).ok, true);
  for (let i = 0; i < 4; i++) await rpc(db, { op: "login", usuario: "kevin", clave: "mala" });
  assert.equal((await rpc(db, { op: "login", usuario: "kevin", clave: CLAVES.kevin })).ok, true);
});

test("token malformado o falsificado no rompe la llamada: responde auth", async () => {
  const db = await crearBase();
  for (const token of ["U1.abc.def", "U1.99999999999999.deadbeef", "x", "U1.1.2.3"]) {
    const r = await rpc(db, { op: "yo", token });
    assert.equal(r.code, "auth", token);
  }
});

/* ---------------- Lectura ---------------- */
test("sin sesión NO se leen tablas privadas aunque el cliente mande requiere_sesion:false", async () => {
  const db = await crearBase();
  const r = await rpc(db, { op: "leer", requiere_sesion: false, tablas: ["Usuarios", "Clientes", "Pedidos", "Pagos"] });
  assert.equal(r.ok, false);
  assert.equal(r.code, "auth");
  const pub = await rpc(db, { op: "leer", tablas: ["Precios", "Config"] });
  assert.equal(pub.ok, true);
  assert.equal(pub.datos.Precios.length, 19);
  // con sesión sí, y nunca sale pin_hash
  const t = await login(db, "oscar");
  const priv = await rpc(db, { op: "leer", token: t, tablas: ["Usuarios"] });
  assert.equal(priv.ok, true);
  assert.ok(priv.datos.Usuarios.every((u) => !("pin_hash" in u) && typeof u.tiene_pin === "boolean"));
});

/* ---------------- Operaciones públicas acotadas ---------------- */
test("catalogo_publico: precios + agotados, sin exponer pedidos ni inventario", async () => {
  const db = await crearBase();
  await db.exec(`
    INSERT INTO public.inventario (fecha, code, producto, cajas, tipo) VALUES ('x', 'BC-01', 'Babosa', 5, 'entrada'), ('x', 'BC-02', 'Banana', 10, 'entrada'), ('x', 'KT-09', 'Nuevo', 0, 'alta');
    INSERT INTO public.pedidos (id, estado) VALUES ('SKL-261107-001', 'confirmado'), ('SKL-261107-002', 'pendiente'), ('SKL-261107-003', 'entregado');
    UPDATE public.pedidos SET borrado = true WHERE id = 'SKL-261107-003';
    INSERT INTO public.pedido_items (pedido_id, code, cajas) VALUES ('SKL-261107-001', 'BC-01', 5), ('SKL-261107-002', 'BC-02', 10), ('SKL-261107-003', 'BC-02', 10);
  `);
  const r = await rpc(db, { op: "catalogo_publico" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.agotados, ["BC-01", "KT-09"]); // BC-02: el pendiente no aparta y el borrado no cuenta
  assert.equal(r.precios.length, 19);
  assert.deepEqual(Object.keys(r).sort(), ["agotados", "ok", "precios"]);
});

test("vendedores_publico: solo vendedores activos con id, nombre y teléfono", async () => {
  const db = await crearBase();
  await db.exec("UPDATE public.usuarios SET activo = false WHERE id = 'U4'");
  const r = await rpc(db, { op: "vendedores_publico" });
  assert.deepEqual(r.vendedores, [{ id: "U3", nombre: "Óscar", telefono: "0412-1234567" }]);
});

test("buscar_cliente_web: por teléfono (cualquier formato) o RIF con dígito verificador; límite 30/min", async () => {
  const db = await crearBase();
  await db.exec(`INSERT INTO public.clientes (id, nombre, contacto, rif_cedula, direccion, telefono, latitud, longitud, updated_at)
                 VALUES ('C1', 'Peluquería Bella', 'María', 'V-28072542', 'El Vigía', '+58 424-7387202', '8.6', '-71.6', '2026-11-01')`);
  const porTel = await rpc(db, { op: "buscar_cliente_web", q: "04247387202" });
  assert.equal(porTel.cliente.id, "C1");
  assert.equal(porTel.cliente.telefono, "+58 424-7387202");
  assert.equal(porTel.cliente.ubicacion, true);
  const porRif = await rpc(db, { op: "buscar_cliente_web", q: "V-28072542-1" });
  assert.equal(porRif.cliente.id, "C1");
  assert.equal(porRif.cliente.telefono, ""); // por RIF no revela el teléfono
  assert.equal((await rpc(db, { op: "buscar_cliente_web", q: "99999999" })).cliente, null);
  assert.equal((await rpc(db, { op: "buscar_cliente_web", q: "123" })).code, "corto");
  for (let i = 0; i < 27; i++) await rpc(db, { op: "buscar_cliente_web", q: "11111111" });
  assert.equal((await rpc(db, { op: "buscar_cliente_web", q: "04247387202" })).code, "limite");
});

test("pedido_web: solo inserta, no pisa uno existente, valida vendedor y limita 5 por hora por teléfono", async () => {
  const db = await crearBase();
  const fila = { id: "WEB-ABCD1234", negocio: "Bella", contacto: "María", telefono: "0412-5550000", items: JSON.stringify([{ code: "BC-01", cajas: 2 }]), tipo_pago: "pronto", total_cajas: 2, total: 18, vendedor_id: "U3", vendedor: "OTRO NOMBRE" };
  const r = await rpc(db, { op: "pedido_web", fila });
  assert.deepEqual(r, { ok: true, id: "WEB-ABCD1234" });
  const [w] = await filas(db, "SELECT * FROM public.pedidos_web WHERE id = 'WEB-ABCD1234'");
  assert.equal(w.estado, "nuevo");
  assert.equal(w.vendedor, "Óscar"); // el nombre lo pone el servidor
  // intento de pisar estado / pedido_id de uno existente
  const pisar = await rpc(db, { op: "pedido_web", fila: { ...fila, estado: "tomado", pedido_id: "SKL-X", negocio: "HACK" } });
  assert.equal(pisar.duplicado, true);
  const [w2] = await filas(db, "SELECT * FROM public.pedidos_web WHERE id = 'WEB-ABCD1234'");
  assert.equal(w2.negocio, "Bella");
  assert.equal(w2.estado, "nuevo");
  assert.equal((await rpc(db, { op: "pedido_web", fila: { ...fila, id: "WEB-ZZZZ0001", vendedor_id: "U5" } })).code, "vendedor");
  assert.equal((await rpc(db, { op: "pedido_web", fila: { ...fila, id: "hack" } })).code, "ref");
  assert.equal((await rpc(db, { op: "pedido_web", fila: { ...fila, id: "WEB-ZZZZ0002", items: "no-json" } })).code, "empty");
  for (let i = 2; i <= 5; i++) assert.equal((await rpc(db, { op: "pedido_web", fila: { ...fila, id: "WEB-LIM0000" + i } })).ok, true);
  assert.equal((await rpc(db, { op: "pedido_web", fila: { ...fila, id: "WEB-LIM00006" } })).code, "limite");
});

test("asignar_vendedor_web: solo si sigue 'nuevo' y sin vendedor", async () => {
  const db = await crearBase();
  await db.exec("INSERT INTO public.pedidos_web (id, estado) VALUES ('WEB-AAAA1111', 'nuevo'), ('WEB-BBBB2222', 'tomado')");
  assert.deepEqual(await rpc(db, { op: "asignar_vendedor_web", id: "web-aaaa1111", vendedor_id: "U4" }), { ok: true });
  assert.equal((await rpc(db, { op: "asignar_vendedor_web", id: "WEB-AAAA1111", vendedor_id: "U3" })).sin_cambios, true);
  assert.equal((await rpc(db, { op: "asignar_vendedor_web", id: "WEB-BBBB2222", vendedor_id: "U3" })).sin_cambios, true);
  assert.equal((await rpc(db, { op: "asignar_vendedor_web", id: "WEB-AAAA1111", vendedor_id: "U1" })).code, "vendedor");
  const [w] = await filas(db, "SELECT vendedor_id, vendedor FROM public.pedidos_web WHERE id = 'WEB-AAAA1111'");
  assert.deepEqual(w, { vendedor_id: "U4", vendedor: "Kevin" });
});

/* ---------------- Escritura: RBAC ---------------- */
test("escribir sin sesión: rechazado (incluso con publica:true)", async () => {
  const db = await crearBase();
  const r = await rpc(db, { op: "escribir", publica: true, cambios: [{ tabla: "PedidosWeb", fila: { id: "WEB-X1234567", estado: "tomado" } }] });
  assert.equal(r.code, "auth");
});

test("vendedor no toca Precios/Inventario/Config y el lote entero se deshace", async () => {
  const db = await crearBase();
  const t = await login(db, "oscar");
  const r = await rpc(db, { op: "escribir", token: t, cambios: [
    { tabla: "Clientes", fila: { id: "C-NUEVO", nombre: "No debe quedar" } },
    { tabla: "Precios", fila: { code: "BC-01", producto: "Babosa", menor: 0.01 } },
  ] });
  assert.equal(r.code, "forbidden");
  assert.equal((await filas(db, "SELECT 1 FROM public.clientes WHERE id = 'C-NUEVO'")).length, 0);
  for (const tabla of ["Inventario", "Config"]) {
    const x = await rpc(db, { op: "escribir", token: t, cambios: [{ tabla, fila: { code: "BC-01", clave: "url_apk", cajas: 999 } }] });
    assert.equal(x.code, "forbidden", tabla);
  }
  const tAna = await login(db, "ana");
  assert.equal((await rpc(db, { op: "escribir", token: tAna, cambios: [{ tabla: "Precios", fila: { code: "BC-01", producto: "Babosa", menor: 12 } }] })).ok, true);
});

test("despachador no crea pedidos ni clientes; Usuarios solo Master (Administración solo el % de comisión)", async () => {
  const db = await crearBase();
  const tLuis = await login(db, "luis");
  const sLuis = await sesDe(db, tLuis);
  assert.equal((await rpc(db, { op: "escribir", token: tLuis, cambios: lotePedido("SKL-261107-001", sLuis) })).code, "forbidden");
  assert.equal((await rpc(db, { op: "escribir", token: tLuis, cambios: [{ tabla: "Clientes", fila: { id: "C9" } }] })).code, "forbidden");
  const tOscar = await login(db, "oscar");
  assert.equal((await rpc(db, { op: "escribir", token: tOscar, cambios: [{ tabla: "Usuarios", fila: { id: "U3", rol: "master" } }] })).code, "forbidden");
  const tAna = await login(db, "ana");
  const r = await rpc(db, { op: "escribir", token: tAna, cambios: [{ tabla: "Usuarios", fila: { id: "U3", usuario: "oscar", nombre: "Óscar", rol: "master", comision_pct: 5, pin_plano: "Hack1234" } }] });
  assert.equal(r.ok, true);
  const [u] = await filas(db, "SELECT rol, comision_pct, pin_hash = public.skala_hash_pin('U3', $1) AS misma_clave FROM public.usuarios WHERE id = 'U3'", [CLAVES.oscar]);
  assert.equal(u.rol, "vendedor");
  assert.equal(Number(u.comision_pct), 5);
  assert.equal(u.misma_clave, true);
});

test("vendedor solo modifica SUS pedidos; despachador solo los asignados y sin reasignarse", async () => {
  const db = await crearBase();
  const tOscar = await login(db, "oscar"), sOscar = await sesDe(db, tOscar);
  const tKevin = await login(db, "kevin");
  const tLuis = await login(db, "luis");
  assert.equal((await rpc(db, { op: "escribir", token: tOscar, cambios: lotePedido("SKL-261107-001", sOscar) })).ok, true);
  const [ped] = await filas(db, "SELECT * FROM public.pedidos WHERE id = 'SKL-261107-001'");
  // Kevin intenta anular / tocar ítems / historial del pedido de Óscar
  assert.equal((await rpc(db, { op: "escribir", token: tKevin, cambios: [{ tabla: "Pedidos", fila: { ...ped, estado: "cancelado" } }] })).code, "not_found");
  assert.equal((await rpc(db, { op: "escribir", token: tKevin, cambios: [{ tabla: "PedidoItems", modo: "reemplazar_pedido", pedido_id: ped.id, filas: [] }] })).code, "not_found");
  assert.equal((await rpc(db, { op: "escribir", token: tKevin, cambios: [{ tabla: "Historial", fila: { pedido_id: ped.id, accion: "x" } }] })).code, "not_found");
  // Kevin no puede crear un pedido a nombre de Óscar
  assert.equal((await rpc(db, { op: "escribir", token: tKevin, cambios: lotePedido("SKL-261107-009", sOscar) })).code, "forbidden");
  // Luis (despachador) aún no está asignado
  assert.equal((await rpc(db, { op: "escribir", token: tLuis, cambios: [{ tabla: "Pedidos", fila: { ...ped, estado: "en_ruta" } }] })).code, "not_found");
  await db.exec("UPDATE public.pedidos SET despachador_id = 'U5', estado = 'confirmado' WHERE id = 'SKL-261107-001'");
  const [ped2] = await filas(db, "SELECT * FROM public.pedidos WHERE id = 'SKL-261107-001'");
  assert.equal((await rpc(db, { op: "escribir", token: tLuis, cambios: [{ tabla: "Pedidos", fila: { ...ped2, estado: "en_ruta" } }] })).ok, true);
  assert.equal((await rpc(db, { op: "escribir", token: tLuis, cambios: [{ tabla: "Pedidos", fila: { ...ped2, despachador_id: "" } }] })).code, "forbidden");
  // Óscar sí puede anular el suyo
  assert.equal((await rpc(db, { op: "escribir", token: tOscar, cambios: [{ tabla: "Pedidos", fila: { ...ped2, estado: "cancelado", despachador_id: "U5" } }] })).ok, true);
});

test("un vendedor no puede crear un pedido ya aprobado/cobrado ni con despachador", async () => {
  const db = await crearBase();
  const t = await login(db, "oscar"), s = await sesDe(db, t);
  const r = await rpc(db, { op: "escribir", token: t, cambios: lotePedido("SKL-261107-001", s, { estado: "entregado", cobro: "conciliado", despachador_id: "U5" }) });
  assert.equal(r.ok, true);
  const [p] = await filas(db, "SELECT estado, cobro, despachador_id FROM public.pedidos WHERE id = 'SKL-261107-001'");
  assert.deepEqual(p, { estado: "pendiente", cobro: "", despachador_id: "" });
});

test("Historial: usuario y fecha los pone el servidor (no se puede falsificar la auditoría)", async () => {
  const db = await crearBase();
  const t = await login(db, "oscar"), s = await sesDe(db, t);
  await rpc(db, { op: "escribir", token: t, cambios: lotePedido("SKL-261107-001", s) });
  const [h] = await filas(db, "SELECT usuario, fecha FROM public.historial");
  assert.equal(h.usuario, "Óscar (Vendedor)");
  assert.match(h.fecha, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

/* ---------------- Concurrencia de correlativos ---------------- */
test("choque de correlativo SKL-AAMMDD-NNN: el servidor asigna el siguiente libre y remapea ítems, historial y pedido web", async () => {
  const db = await crearBase();
  const tOscar = await login(db, "oscar"), sOscar = await sesDe(db, tOscar);
  const tKevin = await login(db, "kevin"), sKevin = await sesDe(db, tKevin);
  await db.exec("INSERT INTO public.pedidos_web (id, estado, vendedor_id) VALUES ('WEB-KKKK0001', 'nuevo', '')");
  const a = await rpc(db, { op: "escribir", token: tOscar, cambios: lotePedido("SKL-261107-001", sOscar) });
  assert.deepEqual(a, { ok: true, ids: {} });
  // Kevin calculó el mismo número en su teléfono
  const loteKevin = lotePedido("SKL-261107-001", sKevin, { web_id: "WEB-KKKK0001" });
  loteKevin.splice(1, 0, { tabla: "PedidosWeb", fila: { id: "WEB-KKKK0001", estado: "tomado", pedido_id: "SKL-261107-001", vendedor_id: "", atendido_por: "Kevin" } });
  const b = await rpc(db, { op: "escribir", token: tKevin, cambios: loteKevin });
  assert.deepEqual(b, { ok: true, ids: { "SKL-261107-001": "SKL-261107-002" } });
  const peds = await filas(db, "SELECT id, vendedor_id FROM public.pedidos ORDER BY id");
  assert.deepEqual(peds, [{ id: "SKL-261107-001", vendedor_id: "U3" }, { id: "SKL-261107-002", vendedor_id: "U4" }]);
  const items = await filas(db, "SELECT pedido_id, count(*)::int AS n FROM public.pedido_items GROUP BY pedido_id ORDER BY pedido_id");
  assert.deepEqual(items, [{ pedido_id: "SKL-261107-001", n: 1 }, { pedido_id: "SKL-261107-002", n: 1 }]);
  const hist = await filas(db, "SELECT pedido_id, usuario FROM public.historial ORDER BY id");
  assert.deepEqual(hist.map((h) => h.pedido_id), ["SKL-261107-001", "SKL-261107-002"]);
  const [w] = await filas(db, "SELECT pedido_id FROM public.pedidos_web WHERE id = 'WEB-KKKK0001'");
  assert.equal(w.pedido_id, "SKL-261107-002");
});

test("mismo client_ref dos veces (reintento / cola sin señal): no duplica, responde duplicado con el id existente", async () => {
  const db = await crearBase();
  const t = await login(db, "oscar"), s = await sesDe(db, t);
  const lote1 = lotePedido("SKL-261107-001", s, { client_ref: "ref-fijo" });
  assert.equal((await rpc(db, { op: "escribir", token: t, cambios: lote1 })).ok, true);
  const r = await rpc(db, { op: "escribir", token: t, cambios: lotePedido("SKL-261107-002", s, { client_ref: "ref-fijo" }) });
  assert.deepEqual(r, { ok: true, duplicado: true, id: "SKL-261107-001" });
  assert.equal((await filas(db, "SELECT count(*)::int AS n FROM public.pedidos"))[0].n, 1);
});

/* ---------------- Pagos y tasas ---------------- */
test("Pagos: el vendedor solo reporta en sus pedidos; conciliar y comisiones son de Administración", async () => {
  const db = await crearBase();
  const tOscar = await login(db, "oscar"), sOscar = await sesDe(db, tOscar);
  const tKevin = await login(db, "kevin");
  await rpc(db, { op: "escribir", token: tOscar, cambios: lotePedido("SKL-261107-001", sOscar) });
  const pago = { id: "PAG-00000001", pedido_id: "SKL-261107-001", fecha_pago: "2026-11-07", moneda: "USD", monto: 20, monto_usd: 20, estado: "reportado" };
  assert.equal((await rpc(db, { op: "escribir", token: tOscar, cambios: [{ tabla: "Pagos", fila: { ...pago, estado: "conciliado" } }] })).code, "forbidden");
  assert.equal((await rpc(db, { op: "escribir", token: tOscar, cambios: [{ tabla: "Pagos", fila: { ...pago, comision_estado: "pagada" } }] })).code, "forbidden");
  assert.equal((await rpc(db, { op: "escribir", token: tKevin, cambios: [{ tabla: "Pagos", fila: pago }] })).code, "not_found");
  assert.equal((await rpc(db, { op: "escribir", token: tOscar, cambios: [{ tabla: "Pagos", fila: pago }] })).ok, true);
  const tAna = await login(db, "ana");
  assert.equal((await rpc(db, { op: "escribir", token: tAna, cambios: [{ tabla: "Pagos", fila: { ...pago, estado: "conciliado" } }] })).ok, true);
  // ya conciliado: el vendedor no lo puede volver a tocar
  assert.equal((await rpc(db, { op: "escribir", token: tOscar, cambios: [{ tabla: "Pagos", fila: pago }] })).code, "forbidden");
});

test("Tasas: el vendedor solo agrega días que faltan (nunca pisa ni carga 'manual')", async () => {
  const db = await crearBase();
  const t = await login(db, "oscar");
  await db.exec("INSERT INTO public.tasas (fecha, tasa, fuente) VALUES ('2026-11-06', 230.5, 'bcv')");
  const r = await rpc(db, { op: "escribir", token: t, cambios: [
    { tabla: "Tasas", fila: { fecha: "2026-11-06", tasa: 1, fuente: "manual" } },
    { tabla: "Tasas", fila: { fecha: "2026-11-07", tasa: 231.25, fuente: "manual" } },
  ] });
  assert.equal(r.ok, true);
  const ts = await filas(db, "SELECT fecha, tasa::float AS tasa, fuente FROM public.tasas ORDER BY fecha");
  assert.deepEqual(ts, [{ fecha: "2026-11-06", tasa: 230.5, fuente: "bcv" }, { fecha: "2026-11-07", tasa: 231.25, fuente: "bcv" }]);
  const tAna = await login(db, "ana");
  await rpc(db, { op: "escribir", token: tAna, cambios: [{ tabla: "Tasas", fila: { fecha: "2026-11-06", tasa: 229, fuente: "manual" } }] });
  assert.equal((await filas(db, "SELECT fuente FROM public.tasas WHERE fecha = '2026-11-06'"))[0].fuente, "manual");
});

test("tabla desconocida o error de datos: responde error sin dejar cambios a medias", async () => {
  const db = await crearBase();
  const t = await login(db, "jose");
  const r = await rpc(db, { op: "escribir", token: t, cambios: [{ tabla: "Clientes", fila: { id: "C-1" } }, { tabla: "skala_secretos", fila: {} }] });
  assert.equal(r.code, "tabla");
  const r2 = await rpc(db, { op: "escribir", token: t, cambios: [{ tabla: "Clientes", fila: { id: "C-2" } }, { tabla: "Precios", fila: { code: "BC-01", menor: "no-es-numero" } }] });
  assert.equal(r2.code, "internal");
  assert.equal((await filas(db, "SELECT count(*)::int AS n FROM public.clientes"))[0].n, 0);
});

/* ---------------- Importador ---------------- */
test("skala_importar: primera vez exige CRM_SECRET y un Master; luego solo Master o el mismo secreto; DELETE compatible", async () => {
  const db = await crearBase({ conUsuarios: false });
  await db.exec("SET safeupdate.enabled = 1").catch(() => {}); // si la extensión no está, no afecta
  const base = { Usuarios: [{ id: "U1", usuario: "jose", nombre: "José", rol: "master", pin_hash: "x", activo: "true" }],
    PedidoItems: [{ pedido_id: "SKL-1", code: "bc-01", cajas: "2" }], Inventario: [{ code: "BC-01", cajas: "5" }], Historial: [{ pedido_id: "SKL-1", accion: "creado" }] };
  assert.equal((await rpc(db, { ...base, crm_secret: "" }, { funcion: "skala_importar" })).code, "forbidden");
  assert.equal((await rpc(db, { ...base, crm_secret: "s3cr3t", Usuarios: [{ ...base.Usuarios[0], rol: "vendedor" }] }, { funcion: "skala_importar" })).code, "forbidden");
  const ok = await rpc(db, { ...base, crm_secret: "s3cr3t" }, { funcion: "skala_importar" });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(ok.importados.pedido_items, 1);
  // segunda vez: sin token ni secreto -> prohibido; con el mismo secreto -> reemplaza ítems sin duplicar
  assert.equal((await rpc(db, { ...base, crm_secret: "otro" }, { funcion: "skala_importar" })).code, "forbidden");
  assert.equal((await rpc(db, { ...base, crm_secret: "s3cr3t" }, { funcion: "skala_importar" })).ok, true);
  assert.equal((await filas(db, "SELECT count(*)::int AS n FROM public.pedido_items"))[0].n, 1);
  assert.equal((await filas(db, "SELECT valor FROM public.skala_secretos WHERE clave = 'CRM_SECRET'"))[0].valor, "s3cr3t");
});

test("el schema se puede volver a ejecutar sin errores (idempotente) y conserva los datos", async () => {
  const db = await crearBase();
  const { SCHEMA } = await import("./base.mjs");
  await db.exec(SCHEMA);
  assert.equal((await filas(db, "SELECT count(*)::int AS n FROM public.usuarios"))[0].n, 5);
  assert.equal((await login(db, "jose")).startsWith("U1."), true);
});
