/* Prueba de render en navegador (Playwright): escritorio + teléfonos.
   Correr: node tests/e2e.js  (requiere `npm i -D playwright` o playwright global)
   Opcional: SCREENSHOTS=carpeta para guardar capturas por pantalla. */
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const URL = "file://" + path.resolve(__dirname, "..", "index.html");
const PANTALLAS = [
  { nombre: "movil-320", viewport: { width: 320, height: 640 }, movil: true },
  { nombre: "movil-360", viewport: { width: 360, height: 740 }, movil: true },
  { nombre: "movil-390", viewport: { width: 390, height: 844 }, movil: true },
  { nombre: "tablet-768", viewport: { width: 768, height: 1024 }, movil: true },
  { nombre: "escritorio-1280", viewport: { width: 1280, height: 900 }, movil: false },
];

async function probar(browser, cfg) {
  const ctx = await browser.newContext({
    viewport: cfg.viewport,
    deviceScaleFactor: 2,
    isMobile: cfg.movil,
    hasTouch: cfg.movil,
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/net::ERR|Failed to load resource/.test(m.text())) errores.push(m.text()); });
  await page.goto(URL);
  await page.waitForSelector("#gridBanos .card");
  const ok = (msg) => console.log(`  ✔ ${msg}`);
  // Toca un elemento como un usuario: primero lo centra en pantalla (la barra superior es fija)
  const tocar = async (sel) => {
    const loc = page.locator(sel);
    await loc.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
    await loc.click();
  };
  console.log(`▶ ${cfg.nombre} (${cfg.viewport.width}px)`);

  assert.deepEqual(errores, [], "errores de JS: " + errores.join(" | "));
  ok("sin errores de JS");

  // --- Contenido ---
  assert.equal(await page.locator("#gridBanos .card").count(), 11);
  assert.equal(await page.locator("#gridKits .card").count(), 8);
  assert.equal(await page.locator(".card video").count(), 0);
  const bodies = await page.locator(".card .card-body").evaluateAll((els) => els.filter((e) => e.offsetHeight > 0).length);
  assert.equal(bodies, 19);
  ok("11 baños + 8 kits con contenido visible");

  const iconos = (code) =>
    page.locator(`.card:has(.qty-input[data-code="${code}"]) .hair-icon`).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label").split(" ")[0]));
  assert.deepEqual(await iconos("BC-01"), ["Liso", "Ondulado", "Cacheado", "Crespo"]);
  assert.deepEqual(await iconos("BC-04"), ["Liso", "Ondulado", "Cacheado"]);
  assert.deepEqual(await iconos("BC-06"), ["Cacheado", "Crespo"]);
  assert.deepEqual(await iconos("BC-08"), ["Crespo"]);
  assert.deepEqual(await iconos("BC-09"), ["Liso", "Ondulado"]);
  assert.deepEqual(await iconos("KT-06"), ["Cacheado", "Crespo"]);
  assert.match(await page.locator('.card:has([data-code="BC-01"]) .card-hair').innerText(), /1A–4C/);
  ok("iconos de curvatura + código");

  const units = await page.locator("#gridBanos .card-units").allInnerTexts();
  assert.ok(units.every((t) => t === "Caja x 6 unidades"), units.join(","));
  const kitUnits = await page.locator("#gridKits .card-units").allInnerTexts();
  assert.ok(kitUnits.every((t) => t === "Caja x 6 dúos"), kitUnits.join(","));
  ok("baños: caja x 6 unidades · kits: caja x 6 dúos");

  // --- Imágenes responsive ---
  const img = await page.locator('.card:has([data-code="BC-01"]) img').evaluate((i) => ({ src: i.currentSrc, w: i.naturalWidth, alt: i.alt }));
  assert.match(img.src, /\/web\/BC-01-(400|800)\.webp$/, img.src);
  assert.ok(img.w > 0 && img.alt === "Babosa");
  ok(`imagen WebP responsive (${img.src.split("/").pop()})`);

  // --- Layout móvil ---
  const lay = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    cols: getComputedStyle(document.getElementById("gridBanos")).gridTemplateColumns.split(" ").length,
    navVisible: document.querySelector(".nav").getBoundingClientRect().height > 0,
  }));
  assert.ok(lay.scrollW <= cfg.viewport.width, `scroll horizontal: ${lay.scrollW}px > ${cfg.viewport.width}px`);
  ok("sin scroll horizontal");
  assert.ok(lay.navVisible, "el menú no se ve");
  ok("menú visible");
  const colsEsperadas = cfg.viewport.width <= 560 ? 1 : cfg.viewport.width <= 900 ? 2 : 4;
  assert.equal(lay.cols, colsEsperadas);
  ok(`${lay.cols} columna(s) de productos`);

  if (cfg.movil) {
    // Objetivos táctiles >= 44px y texto de inputs >= 16px (iOS no hace zoom)
    const chicos = await page.evaluate(() =>
      [...document.querySelectorAll(".nav a, .filter, .qty-btn, .qty-input, .btn, .order-clear, .brand")]
        .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44); })
        .map((e) => `${e.className || e.tagName} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`)
    );
    assert.deepEqual(chicos, [], "botones < 44px: " + chicos.join(", "));
    ok("botones táctiles >= 44px");
  }

  // --- Filtro ---
  await tocar('#filterBanos .filter[data-filter="Definición"]');
  assert.equal(await page.locator("#gridBanos .card").count(), 3);
  assert.ok((await page.locator("#gridBanos .hair-icon").count()) > 0);
  await tocar('#filterBanos .filter[data-filter="all"]');
  ok("filtros funcionan (deslizables en móvil)");

  // --- Navegación: el título no queda tapado por la barra fija ---
  await page.locator('.nav a[href="#kits"]').click();
  await page.waitForTimeout(900);
  const tapado = await page.evaluate(() => {
    const bar = document.querySelector(".topbar").getBoundingClientRect().bottom;
    const h2 = document.querySelector("#kits h2").getBoundingClientRect().top;
    return { bar, h2 };
  });
  assert.ok(tapado.h2 >= tapado.bar - 1, `título tapado: h2=${tapado.h2} bar=${tapado.bar}`);
  ok("menú lleva a Kits sin tapar el título");

  // --- Pedido ---
  await tocar('.qty-btn[data-act="plus"][data-code="BC-01"]');
  await tocar('.qty-btn[data-act="plus"][data-code="BC-01"]');
  await tocar('.qty-btn[data-act="plus"][data-code="KT-01"]');
  await page.waitForTimeout(350);
  const barra = await page.locator("#orderBar").boundingBox();
  assert.ok(barra && barra.y + barra.height <= cfg.viewport.height + 1 && barra.y < cfg.viewport.height, "barra de pedido fuera de pantalla");
  const btnBarra = await page.locator("#btnArmarPedido").boundingBox();
  assert.ok(btnBarra.x + btnBarra.width <= cfg.viewport.width, "botón de la barra se sale");
  ok("barra de pedido visible y dentro de la pantalla");

  await tocar("#btnArmarPedido");
  assert.equal(await page.evaluate(() => document.body.classList.contains("modal-open")), true);
  const msg = await page.inputValue("#orderText");
  assert.match(msg, /Babosa \(BC-01\) — 2 cajas \(12 unidades\)/);
  assert.match(msg, /Kit 12 em 1 \(KT-01\) — 1 caja \(6 dúos\)$/m);
  assert.match(await page.getAttribute("#btnWhatsapp", "href"), /^https:\/\/wa\.me\/584247042169\?text=/);
  ok("mensaje de WhatsApp con unidades y dúos");

  // Modal: campos dentro del ancho, inputs >= 16px, botón WhatsApp siempre visible
  const modal = await page.evaluate(() => {
    const box = document.querySelector(".modal-box").getBoundingClientRect();
    const fuera = [...document.querySelectorAll(".modal-box input, .modal-box textarea")]
      .filter((e) => e.type !== "radio" && e.getBoundingClientRect().right > box.right + 1).map((e) => e.id);
    const fuentes = [...document.querySelectorAll(".modal-box input:not([type=radio]), .modal-box textarea")]
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.id);
    const wa = document.getElementById("btnWhatsapp").getBoundingClientRect();
    return { fuera, fuentes, waBottom: wa.bottom, waTop: wa.top, vh: innerHeight };
  });
  assert.deepEqual(modal.fuera, [], "campos se salen del modal");
  assert.deepEqual(modal.fuentes, [], "inputs con letra < 16px");
  assert.ok(modal.waTop >= 0 && modal.waBottom <= modal.vh, "botón WhatsApp no visible al abrir");
  ok("modal: campos caben, letra 16px, WhatsApp visible");

  if (process.env.SCREENSHOTS) {
    await page.screenshot({ path: path.join(process.env.SCREENSHOTS, `${cfg.nombre}-modal.png`) });
  }
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#orderModal").isHidden(), true);
  assert.equal(await page.evaluate(() => document.body.classList.contains("modal-open")), false);
  ok("Esc cierra el modal y libera el scroll");

  if (process.env.SCREENSHOTS) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(process.env.SCREENSHOTS, `${cfg.nombre}-inicio.png`) });
    await page.evaluate(() => document.getElementById("banos").scrollIntoView({ behavior: "instant" }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(process.env.SCREENSHOTS, `${cfg.nombre}-banos.png`) });
  }

  assert.deepEqual(errores, []);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const cfg of PANTALLAS) await probar(browser, cfg);
    console.log("E2E OK");
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("✘", e.message); process.exit(1); });
