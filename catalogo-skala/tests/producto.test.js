/* Tests unitarios de js/producto.js — correr con: node --test tests/ */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  tiposDeCabello,
  iconosCabelloHTML,
  textoUnidades,
  textoUnidadesPedido,
  UNIDADES_POR_CAJA_BANO,
  DUOS_POR_CAJA_KIT,
} = require("../js/producto.js");

const clases = (hair) => tiposDeCabello(hair).map((t) => t.clase);

test("1A–4C cubre las 4 curvaturas", () => {
  assert.deepEqual(clases("1A–4C"), ["liso", "ondulado", "cacheado", "crespo"]);
});

test("3A–4C es cacheado + crespo (no liso)", () => {
  assert.deepEqual(clases("3A–4C"), ["cacheado", "crespo"]);
});

test("1A–2C es liso + ondulado", () => {
  assert.deepEqual(clases("1A–2C"), ["liso", "ondulado"]);
});

test("1A–3C es liso + ondulado + cacheado", () => {
  assert.deepEqual(clases("1A–3C"), ["liso", "ondulado", "cacheado"]);
});

test("4A–4C es solo crespo", () => {
  assert.deepEqual(clases("4A–4C"), ["crespo"]);
});

test("acepta guion normal y valor único", () => {
  assert.deepEqual(clases("2A-3B"), ["ondulado", "cacheado"]);
  assert.deepEqual(clases("3B"), ["cacheado"]);
});

test("valor vacío o inválido no devuelve iconos", () => {
  assert.deepEqual(clases(""), []);
  assert.deepEqual(clases(undefined), []);
  assert.deepEqual(clases("todo tipo"), []);
});

test("los nombres coinciden con la guía de curvatura", () => {
  assert.deepEqual(
    tiposDeCabello("1A–4C").map((t) => t.nombre),
    ["Liso", "Ondulado", "Cacheado", "Crespo"]
  );
});

test("iconosCabelloHTML genera un icono accesible por curvatura", () => {
  const html = iconosCabelloHTML("3A–4C");
  assert.equal((html.match(/class="hair-icon /g) || []).length, 2);
  assert.match(html, /hair-cacheado/);
  assert.match(html, /hair-crespo/);
  assert.match(html, /title="Cacheado \(3A · 3B · 3C\)"/);
  assert.match(html, /role="img"/);
});

test("iconosCabelloHTML vacío si no hay curvatura", () => {
  assert.equal(iconosCabelloHTML(""), "");
});

test("caja de baño de crema trae 6 unidades", () => {
  assert.equal(UNIDADES_POR_CAJA_BANO, 6);
  assert.equal(textoUnidades({ unidades: 6 }), "Caja x 6 unidades");
});

test("caja de kit trae 6 dúos (shampoo + acondicionador)", () => {
  assert.equal(DUOS_POR_CAJA_KIT, 6);
  assert.equal(textoUnidades({ unidades: 6, unidad: "dúos" }), "Caja x 6 dúos");
});

test("producto sin dato de unidades muestra información no disponible", () => {
  assert.equal(textoUnidades({ unidades: null }), "Unidades por caja: información no disponible");
  assert.equal(textoUnidades({}), "Unidades por caja: información no disponible");
});

test("unidades del pedido: cajas x unidades, con su nombre", () => {
  assert.equal(textoUnidadesPedido({ unidades: 6 }, 2), " (12 unidades)");
  assert.equal(textoUnidadesPedido({ unidades: 6, unidad: "dúos" }, 1), " (6 dúos)");
  assert.equal(textoUnidadesPedido({ unidades: null }, 3), "");
});
