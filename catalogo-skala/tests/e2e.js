/* Prueba de render en navegador (Playwright).
   Correr: node tests/e2e.js  (requiere `npm i -D playwright` o playwright global)
   Opcional: SCREENSHOT=ruta.png para guardar una captura. */
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const url = "file://" + path.resolve(__dirname, "..", "index.html");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/net::ERR|Failed to load resource/.test(m.text())) errores.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector("#gridBanos .card");

  const ok = (msg) => console.log("✔ " + msg);

  assert.deepEqual(errores, [], "errores de JS: " + errores.join(" | "));
  ok("sin errores de JS");

  assert.equal(await page.locator("#gridBanos .card").count(), 11);
  assert.equal(await page.locator("#gridKits .card").count(), 8);
  ok("11 baños + 8 kits renderizados");

  assert.equal(await page.locator(".card video").count(), 0);
  const bodiesVisibles = await page.locator(".card .card-body").evaluateAll((els) => els.filter((e) => e.offsetHeight > 0).length);
  assert.equal(bodiesVisibles, 19);
  ok("todas las tarjetas muestran su contenido (sin <video>)");

  // Iconos según rango
  const iconos = async (code) =>
    page.locator(`.card:has(.qty-input[data-code="${code}"]) .hair-icon`).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label").split(" ")[0]));
  assert.deepEqual(await iconos("BC-01"), ["Liso", "Ondulado", "Cacheado", "Crespo"]); // 1A–4C
  assert.deepEqual(await iconos("BC-04"), ["Liso", "Ondulado", "Cacheado"]);           // 1A–3C
  assert.deepEqual(await iconos("BC-06"), ["Cacheado", "Crespo"]);                     // 3A–4C
  assert.deepEqual(await iconos("BC-08"), ["Crespo"]);                                 // 4A–4C
  assert.deepEqual(await iconos("BC-09"), ["Liso", "Ondulado"]);                       // 1A–2C
  assert.deepEqual(await iconos("KT-06"), ["Cacheado", "Crespo"]);                     // 3A–4C
  ok("iconos de curvatura correctos por producto");

  // El código (1A–4C) se sigue mostrando junto a los iconos
  assert.match(await page.locator('.card:has([data-code="BC-01"]) .card-hair').innerText(), /1A–4C/);
  ok("se mantiene el código de curvatura");

  // Unidades
  const units = await page.locator("#gridBanos .card-units").allInnerTexts();
  assert.ok(units.every((t) => t === "Caja x 6 unidades"), units.join(","));
  const kitUnits = await page.locator("#gridKits .card-units").allInnerTexts();
  assert.ok(kitUnits.every((t) => /información no disponible/.test(t)), kitUnits.join(","));
  ok("baños: caja x 6 unidades · kits: información no disponible");

  // Filtro re-renderiza y conserva iconos
  await page.click('#filterBanos .filter[data-filter="Definición"]');
  assert.equal(await page.locator("#gridBanos .card").count(), 3);
  assert.ok((await page.locator("#gridBanos .hair-icon").count()) > 0);
  ok("filtro conserva iconos y unidades");
  await page.click('#filterBanos .filter[data-filter="all"]');

  // Pedido: mensaje de WhatsApp incluye unidades
  await page.click('.qty-btn[data-act="plus"][data-code="BC-01"]');
  await page.click('.qty-btn[data-act="plus"][data-code="BC-01"]');
  await page.click('.qty-btn[data-act="plus"][data-code="KT-01"]');
  await page.click("#btnArmarPedido");
  const msg = await page.inputValue("#orderText");
  assert.match(msg, /Babosa \(BC-01\) — 2 cajas \(12 unidades\)/);
  assert.match(msg, /Kit 12 em 1 \(KT-01\) — 1 caja$/m);
  assert.match(await page.getAttribute("#btnWhatsapp", "href"), /^https:\/\/wa\.me\/584247042169\?text=/);
  ok("mensaje de WhatsApp con unidades");
  await page.click("#btnClose");

  if (process.env.SCREENSHOT) {
    await page.locator("#banos").screenshot({ path: process.env.SCREENSHOT });
  }
  assert.deepEqual(errores, []);
  await browser.close();
  console.log("E2E OK");
})().catch((e) => { console.error("✘", e.message); process.exit(1); });
