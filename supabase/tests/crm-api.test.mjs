/* Pruebas del cliente apiSupabase (catalogo-skala/js/crm-api.js) contra el motor real en PGlite.
   Cada "teléfono" es un contexto vm con su propio localStorage; fetch se enruta a public.skala_db. */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { crearBase, rpc, CLAVES, filas } from "./base.mjs";

const aqui = dirname(fileURLToPath(import.meta.url));
const JS = join(aqui, "..", "..", "catalogo-skala", "js");
const CORE = readFileSync(join(JS, "crm-core.js"), "utf8");
const API_FIJO = readFileSync(join(JS, "crm-api.js"), "utf8");
// Las pruebas usan el modo configurable (localStorage) para apuntar al motor PGlite: se vacían las
// constantes fijas del proyecto real. El modo fijo se prueba aparte (ver "constantes fijas").
const API = API_FIJO
  .replace(/const SUPABASE_URL = "[^"]*";/, 'const SUPABASE_URL = "";')
  .replace(/const SUPABASE_ANON_KEY = "[^"]*";/, 'const SUPABASE_ANON_KEY = "";');

function telefono(db, { nativo = null, fuente = API } = {}) {
  const mem = {};
  const llamadas = [];
  const ctx = {
    console, setTimeout, clearTimeout, AbortController, URL, Blob,
    crypto: globalThis.crypto,
    localStorage: {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; },
    },
    navigator: {},
    fetch: async (url, opts = {}) => {
      if (!String(url).endsWith("/rest/v1/rpc/skala_db")) return { ok: false, status: 404, json: async () => ({}) };
      const headers = opts.headers || {};
      llamadas.push({ headers, payload: JSON.parse(opts.body).payload });
      // cede el turno: permite que dos teléfonos intercalen lectura y escritura (carrera real)
      await new Promise((r) => setTimeout(r, 5));
      const r = await rpc(db, JSON.parse(opts.body).payload);
      return { ok: true, status: 200, json: async () => r };
    },
  };
  ctx.window = ctx;
  if (nativo) ctx.SkalaApp = nativo;
  vm.createContext(ctx);
  vm.runInContext(CORE + "\n" + fuente + "\n;globalThis.SkalaAPI = SkalaAPI;", ctx, { filename: "crm-api.js" });
  const S = ctx.SkalaAPI;
  S.configurarSupabase({ url: "https://demo.supabase.co", key: "sb_publishable_demo", activo: true });
  return { S, mem, llamadas, ctx };
}
async function entrar(tel, usuario) {
  const r = await tel.S.api("login", { usuario, clave: CLAVES[usuario] });
  tel.S.guardarSesion(r.token, r.usuario);
  return r;
}
const CLIENTE = { negocio: "Peluquería Bella", contacto: "María Pérez", telefono: "0412-1234567", direccion: "El Vigía", rif_cedula: "J-12345678-9" };
const ITEMS = [{ code: "BC-01", producto: "Babosa", cajas: 2, unidades_caja: 6, unidad: "unidades" }];

test("la clave secreta de Supabase se rechaza en el navegador", async () => {
  const db = await crearBase();
  const { S } = telefono(db);
  assert.throws(() => S.configurarSupabase({ url: "https://x.supabase.co", key: "sb_secret_abc", activo: true }), /SECRETA/);
  await assert.rejects(S.migrarDesdeSheetsASupabase("https://x.supabase.co", "sb_secret_abc"), /SECRETA/);
});

test("clave publishable: va solo en 'apikey' (no es JWT, no se manda como Bearer)", async () => {
  const db = await crearBase();
  const tel = telefono(db);
  await tel.S.api("vendedores");
  assert.equal(tel.llamadas[0].headers.apikey, "sb_publishable_demo");
  assert.equal(tel.llamadas[0].headers.Authorization, undefined);
});

test("constantes fijas de crm-api.js: proyecto real con clave publishable, priorizadas sobre localStorage", async () => {
  const m = API_FIJO.match(/const SUPABASE_URL = "([^"]*)";[\s\S]*?const SUPABASE_ANON_KEY = "([^"]*)";/);
  assert.ok(m, "constantes presentes");
  assert.match(m[1], /^https:\/\/[a-z0-9]+\.supabase\.co$/);
  assert.match(m[2], /^sb_publishable_/, "solo clave pública en el frontend");
  const db = await crearBase();
  const tel = telefono(db, { fuente: API_FIJO }); // el arnés intenta configurar demo.supabase.co
  const cfg = tel.S.configSupabase();
  assert.equal(cfg.fijo, true);
  assert.equal(cfg.url, m[1]);
  assert.equal(cfg.key, m[2]);
  assert.equal(cfg.activo, true);
});

test("catálogo público: usa catalogo_publico (nunca pide Pedidos/PedidoItems) y marca agotados", async () => {
  const db = await crearBase();
  await db.exec("INSERT INTO public.inventario (fecha, code, producto, cajas, tipo) VALUES ('x', 'BC-01', 'Babosa', 3, 'entrada')");
  await db.exec("INSERT INTO public.pedidos (id, estado) VALUES ('SKL-1', 'confirmado'); INSERT INTO public.pedido_items (pedido_id, code, cajas) VALUES ('SKL-1', 'BC-01', 3)");
  const tel = telefono(db);
  const c = await tel.S.api("catalogo");
  assert.equal(c.ok, true);
  assert.equal(c.productos.find((p) => p.code === "BC-01").agotado, true);
  assert.equal(c.productos.find((p) => p.code === "BC-02").agotado, false);
  assert.equal(c.productos.find((p) => p.code === "BC-01").disponible, undefined); // sin sesión no hay existencias
  assert.ok(tel.llamadas.every((l) => !(l.payload.tablas || []).some((t) => ["Pedidos", "PedidoItems", "Inventario", "Clientes", "Usuarios"].includes(t))));
});

test("catálogo público completo: vendedores, buscar cliente, pedido web (con duplicado) y asignar vendedor", async () => {
  const db = await crearBase();
  await db.exec(`INSERT INTO public.clientes (id, nombre, contacto, telefono, rif_cedula, updated_at) VALUES ('C1', 'Bella', 'María', '0412-1234567', 'J-12345678-9', '2026-11-01')`);
  const tel = telefono(db);
  const v = await tel.S.api("vendedores");
  assert.deepEqual(v.vendedores.map((x) => [x.id, x.whatsapp]), [["U4", "584247387202"], ["U3", "584121234567"]]);
  const b = await tel.S.api("buscarClienteWeb", { q: "+58 412 1234567" });
  assert.equal(b.cliente.id, "C1");
  const w = await tel.S.api("pedidoWeb", { ref: "WEB-TEST0001", cliente: { ...CLIENTE, cliente_id: "C1" }, items: ITEMS, tipo_pago: "pronto" });
  assert.deepEqual({ ...w }, { ok: true, id: "WEB-TEST0001" });
  const w2 = await tel.S.api("pedidoWeb", { ref: "WEB-TEST0001", cliente: CLIENTE, items: ITEMS });
  assert.equal(w2.duplicado, true);
  const a = await tel.S.api("asignarVendedorWeb", { id: "WEB-TEST0001", vendedor_id: "U3" });
  assert.equal(a.ok, true);
  const [fila] = await filas(db, "SELECT vendedor_id, estado, items FROM public.pedidos_web WHERE id = 'WEB-TEST0001'");
  assert.equal(fila.vendedor_id, "U3");
  assert.equal(fila.estado, "nuevo");
  assert.equal(JSON.parse(fila.items)[0].cajas, 2);
});

test("con sesión: login, guardarPedido y vista del pedido funcionan sobre el motor endurecido", async () => {
  const db = await crearBase();
  const tel = telefono(db);
  await entrar(tel, "oscar");
  const r = await tel.S.api("guardarPedido", { client_ref: "ref-1", cliente: CLIENTE, items: ITEMS, documento: "Nota de entrega", tipo_pago: "pronto" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.pedido.id, /^SKL-\d{6}-001$/);
  const p = await tel.S.api("pedido", { pedido_id: r.pedido.id });
  assert.equal(p.pedido.items.length, 1);
  assert.equal(p.pedido.historial[0].usuario, "Óscar (Vendedor)");
  // mismo client_ref otra vez (cola sin señal): no duplica
  const r2 = await tel.S.api("guardarPedido", { client_ref: "ref-1", cliente: CLIENTE, items: ITEMS, documento: "Nota de entrega", tipo_pago: "pronto" });
  assert.equal(r2.duplicado, true);
  assert.equal(r2.pedido.id, r.pedido.id);
});

test("dos vendedores guardan a la vez: correlativos distintos, cada uno con sus ítems (sin pisarse)", async () => {
  const db = await crearBase();
  const a = telefono(db), b = telefono(db);
  await entrar(a, "oscar");
  await entrar(b, "kevin");
  const [ra, rb] = await Promise.all([
    a.S.api("guardarPedido", { client_ref: "ref-a", cliente: CLIENTE, items: ITEMS, documento: "Nota de entrega", tipo_pago: "pronto" }),
    b.S.api("guardarPedido", { client_ref: "ref-b", cliente: { ...CLIENTE, telefono: "0414-7654321", rif_cedula: "" }, items: [{ ...ITEMS[0], cajas: 5 }], documento: "Nota de entrega", tipo_pago: "pronto" }),
  ]);
  assert.notEqual(ra.pedido.id, rb.pedido.id);
  const peds = await filas(db, "SELECT p.id, p.vendedor_id, sum(i.cajas)::int AS cajas FROM public.pedidos p JOIN public.pedido_items i ON i.pedido_id = p.id GROUP BY p.id, p.vendedor_id ORDER BY p.id");
  assert.equal(peds.length, 2);
  const porVend = Object.fromEntries(peds.map((x) => [x.vendedor_id, x]));
  assert.equal(porVend.U3.cajas, 2);
  assert.equal(porVend.U4.cajas, 5);
  // la respuesta al teléfono trae el número que realmente quedó guardado
  assert.equal(porVend.U3.id, ra.pedido.id);
  assert.equal(porVend.U4.id, rb.pedido.id);
});

test("Android: con Supabase activo, la copia de Sincronizador.java (Google Sheets) no pisa los datos locales", async () => {
  const db = await crearBase();
  let guardado = "";
  const copiaSheets = { fecha: "2099-01-01T00:00:00.000Z", usuario: null, pedidos: [{ id: "VIEJO" }] };
  const nativo = {
    leerDatos: () => guardado || JSON.stringify(copiaSheets),
    guardarDatos: (s) => { guardado = s; },
    guardarToken: () => {},
  };
  const tel = telefono(db, { nativo });
  tel.S.guardarLS("skala_local_v1", { fecha: "2026-11-07T10:00:00.000Z", pedidos: [{ id: "BUENO" }] });
  assert.equal(tel.S.datosLocales().pedidos[0].id, "BUENO");
  // la copia que guarda la propia app desde Supabase sí se acepta
  await entrar(tel, "oscar");
  const d = await tel.S.sincronizar();
  assert.equal(d._fuente, "supabase");
  assert.equal(JSON.parse(guardado)._fuente, "supabase");
  assert.equal(tel.S.datosLocales()._fuente, "supabase");
});

test("Supabase: canal de atención (en_persona vs online_telefono), GPS aprendido y cambiarClientePedido", async () => {
  const db = await crearBase();
  const tel = telefono(db);
  await entrar(tel, "oscar");
  const sinGps = { contacto: "Rosa", negocio: "Bodega Rosa", telefono: "0414-8889900", direccion: "El Vigía" };
  const correcto = (await tel.S.api("guardarCliente", { cliente: { contacto: "Pedro", negocio: "Abasto Pedro", telefono: "0414-8889911", direccion: "El Vigía" } })).cliente;
  const r = await tel.S.api("guardarPedido", {
    client_ref: "ref-canal-1",
    cliente: sinGps,
    items: ITEMS,
    documento: "Nota de entrega",
    tipo_pago: "pronto",
    canal_pedido: "en_persona",
    gps_lat: 8.620123,
    gps_lng: -71.650988,
    gps_dist_m: 12,
  });
  assert.equal(r.ok, true);
  assert.equal(r.pedido.canal_pedido, "en_persona");
  assert.equal(r.cliente.latitud, 8.620123);
  const ch = await tel.S.api("cambiarClientePedido", { pedido_id: r.pedido.id, cliente_id: correcto.id });
  assert.equal(ch.ok, true);
  assert.equal(ch.gps_revertido, true);
  assert.equal(ch.gps_aprendido, true);
  assert.equal(ch.cliente.latitud, 8.620123);
  const vis = await tel.S.api("visitas", { dias: 1 });
  assert.equal(vis.visitas.length, 1);
  assert.equal(vis.visitas[0].cliente_id, correcto.id);
  assert.equal(vis.visitas[0].canal, "en_persona");
});
