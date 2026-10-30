/* Prueba de render en navegador (Playwright): escritorio + teléfonos.
   Correr: node tests/e2e.js  (requiere `npm i -D playwright` o playwright global)
   Opcional: SCREENSHOTS=carpeta para guardar capturas por pantalla. */
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { crearGas } = require("../../crm/tests/fake-gas.js");
const API = "https://crm.test/exec";

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
    geolocation: { latitude: 8.6123456, longitude: -71.6543219, accuracy: 12 }, permissions: ["geolocation"],
  });
  // CRM simulado: precios, un agotado y dos vendedores
  const gas = crearGas();
  gas.ctx.prepararHojas();
  gas.ctx.crearUsuario("oscar", "Óscar", "vendedor", "Oscar.1234");
  gas.ctx.crearUsuario("kevin", "Kevin", "vendedor", "Kevin9876");
  // precios FINALES (normal, mayor, pronto, efectivo crédito, efectivo pronto); a/b/c = rebaja de cada forma de pago
  const precio = (code, menor, mayor, a, b, c) => gas.ctx.accionGuardarPrecio_({ code, menor, mayor, pronto: menor - a, efectivo_credito: menor - b, efectivo_pronto: menor - c }, { nombre: "Prueba" });
  precio("BC-01", 10, 8, 1, 3, 4); precio("KT-01", 20, 18, 2, 6, 8);
  gas.ctx.accionMovimiento_({ code: "BC-08", cajas: 1 }, { nombre: "Prueba" });
  gas.ctx.guardarUsuario_({ id: gas.tabla("Usuarios").find((u) => u.usuario === "oscar").id, usuario: "oscar", nombre: "Óscar", roles: ["vendedor"], telefono: "0424-7387202" });
  gas.ctx.guardarCliente_({ negocio: "Barbería Max", contacto: "Max", telefono: "0416-7778899", direccion: "Calle 5" }, { id: "U9" }, { exigirTelefono: true });
  gas.ctx.accionMovimiento_({ code: "BC-08", cajas: -1, tipo: "ajuste", nota: "vendido" }, { nombre: "Prueba" });
  await ctx.route(API, async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(gas.post(body)) });
  });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.addInitScript((api) => {
    window.SKALA_CRM_URL = api;
    window.__abiertos = [];
    window.open = (u) => { window.__abiertos.push(u); return null; }; // WhatsApp: se registra el enlace
  }, API);
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
  assert.match(await page.locator('.card:has([data-code="BC-01"]) .card-hair').textContent(), /1A–4C/);
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
  const colsEsperadas = cfg.viewport.width <= 560 ? 2 : cfg.viewport.width <= 900 ? 3 : 4;
  assert.equal(lay.cols, colsEsperadas);
  ok(`${lay.cols} columna(s) de productos`);

  if (cfg.movil) {
    // Objetivos táctiles >= 44px y texto de inputs >= 16px (iOS no hace zoom)
    const chicos = await page.evaluate(() =>
      [...document.querySelectorAll(".nav a, .filter, .qty-btn, .qty-input, .btn, .order-clear, .brand, .card-zoom, .cart-quitar, .btn-desplegar, .btn-mas-lista, .vend-opt")]
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

  // --- Precios del CRM y "Agotado" ---
  await page.waitForFunction(() => /10,00 \$/.test(document.querySelector('.card[data-card="BC-01"] [data-precio]')?.textContent || ""));
  assert.match(await page.innerText('.card[data-card="BC-01"] [data-precio]'), /10,00 \$\s*\/ caja/);
  assert.equal(await page.innerText('.card[data-card="BC-08"] [data-badge]'), "Sin stock");
  assert.ok(await page.locator('.card[data-card="BC-08"].agotado').count()); // en gris
  assert.equal(await page.locator('.card[data-card="BC-08"] .qty-btn[data-act="plus"]').isDisabled(), true);
  if (cfg.viewport.width <= 560) {
    // al menos 4 productos a la vista en un teléfono
    const vistos = await page.evaluate(() => {
      const bar = () => document.querySelector(".topbar").getBoundingClientRect().bottom;
      const g = document.getElementById("gridBanos");
      window.scrollTo({ top: g.getBoundingClientRect().top + scrollY - bar() - 4, behavior: "instant" });
      return [...g.querySelectorAll(".card")].filter((c) => { const r = c.getBoundingClientRect(); return r.top >= bar() - 1 && r.bottom <= innerHeight + 1; }).length;
    });
    assert.ok(vistos >= 4, `solo ${vistos} productos a la vista`);
    ok(`${vistos} productos a la vista en la pantalla`);
  }

  // --- Imagen centrada y completa; botón para ampliar (no suma al pedido) ---
  const enCaja = await page.evaluate(() => [...document.querySelectorAll(".card-img")].filter((c) => c.offsetHeight).every((c) => {
    const i = c.querySelector("img").getBoundingClientRect(), b = c.getBoundingClientRect();
    return i.top >= b.top - 1 && i.bottom <= b.bottom + 1 && Math.abs((i.left + i.right) / 2 - (b.left + b.right) / 2) < 1;
  }));
  assert.ok(enCaja, "imagen fuera del recuadro o no centrada");
  await tocar('.card[data-card="BC-02"] .card-zoom');
  await page.waitForSelector("#zoomModal:not([hidden])");
  assert.equal(await page.innerText("#zoomTitulo"), "Banana e Macuri");
  await page.waitForFunction(() => document.getElementById("zoomImg").naturalWidth > 0);
  assert.match(await page.getAttribute("#zoomImg", "src"), /BC-02-800\.webp$/);
  assert.equal(await page.locator('.card[data-card="BC-02"].elegido').count(), 0);
  if (process.env.SCREENSHOTS) await page.screenshot({ path: path.join(process.env.SCREENSHOTS, `${cfg.nombre}-zoom.png`) });
  assert.ok(await page.locator("#zoomModal.abierto").count()); // aparece con animación
  await page.keyboard.press("Escape");
  assert.ok(await page.locator("#zoomModal.cerrando").count()); // y se cierra con animación
  await page.waitForSelector("#zoomModal", { state: "hidden" });
  assert.equal(await page.evaluate(() => document.body.classList.contains("modal-open")), false);
  await tocar('.card[data-card="BC-02"] .card-zoom');
  await page.locator("#zoomCerrar").click();
  await page.waitForSelector("#zoomModal", { state: "hidden" });
  ok("imágenes centradas y completas; botón Ampliar abre y cierra");

  // --- Pedido: tocar la tarjeta suma una caja ---
  await tocar('.card[data-card="BC-01"] .card-name');
  await tocar('.card[data-card="BC-01"] .card-img');
  assert.equal(await page.innerText('.card[data-card="BC-01"] .card-n'), "2");
  await tocar('.card[data-card="BC-08"] .card-name'); // agotado: no suma
  assert.equal(await page.locator('.card[data-card="BC-08"].elegido').count(), 0);
  await tocar('.card[data-card="KT-01"] .card-name');
  await page.waitForTimeout(350);
  const barra = await page.locator("#orderBar").boundingBox();
  assert.ok(barra && barra.y + barra.height <= cfg.viewport.height + 1 && barra.y < cfg.viewport.height, "barra de pedido fuera de pantalla");
  const btnBarra = await page.locator("#btnArmarPedido").boundingBox();
  assert.ok(btnBarra.x + btnBarra.width <= cfg.viewport.width, "botón de la barra se sale");
  ok("barra de pedido visible y dentro de la pantalla");

  await tocar("#btnArmarPedido");
  // Primero se elige quién arma el pedido
  assert.equal(await page.locator("#modoModal").isVisible(), true);
  assert.equal(await page.locator("#modoModal .modo-btn").count(), 2);
  await page.locator("#btnModoCliente").click();
  assert.equal(await page.locator("#modoModal").isHidden(), true);
  assert.equal(await page.evaluate(() => document.body.classList.contains("modal-open")), true);
  // "Tu pedido": revisar, sumar / quitar, montos por forma de pago
  assert.equal(await page.locator("#cartList .cart-item").count(), 2);
  // foto chica de cada producto al lado
  await page.waitForFunction(() => [...document.querySelectorAll("#cartList .cart-foto img")].every((i) => i.complete && i.naturalWidth > 0));
  assert.match(await page.locator("#cartList .cart-foto img").first().evaluate((i) => i.currentSrc), /BC-01-400\.webp$/);
  assert.match(await page.innerText("#cartTotal"), /3 cajas · 40,00 \$/);
  // renglón: nombre, "Caja x 6 und" y precio (×cajas = monto) al lado del +
  assert.equal(await page.innerText('#cartList [data-item="BC-01"] .cart-info span'), "Caja x 6 und");
  assert.match(await page.innerText('#cartList [data-item="BC-01"] .cart-precio'), /10,00 \$ ×2\s*20,00 \$/);
  assert.equal(await page.innerText('#cartList [data-item="KT-01"] .cart-precio'), "20,00 $");
  assert.equal(await page.innerText('#cartList [data-item="KT-01"] .cart-info span'), "Caja x 6 dúos");
  // formas de pago cerradas: botón para desplegar; 3 estrellas en triángulo, la 4ª con Premium
  assert.ok(await page.locator("#pagosWeb").isHidden());
  // de inicio el pago normal, y al lado cuánto puede ahorrar: 40 → 24 = 40%
  assert.match(await page.innerText("#pagoElegido"), /Crédito[\s\S]*40,00 \$/);
  assert.match(await page.innerText("#pagoElegido .hasta-desc"), /Hasta 40% de descuento al nivel 3/);
  await page.locator("#btnPagos").click();
  assert.deepEqual(await page.locator("#pagosWeb .pago-monto strong").allInnerTexts(), ["40,00 $", "36,00 $", "28,00 $", "24,00 $"]);
  assert.deepEqual(await page.locator("#pagosWeb .estrellas").evaluateAll((els) => els.map((e) => e.querySelectorAll(".estrella.on").length + "/" + e.querySelectorAll(".estrella").length)), ["0/3", "1/3", "2/3", "3/3"]);
  assert.deepEqual(await page.locator("#pagosWeb .premium").allInnerTexts(), ["PREMIUM"]);
  await page.locator("#btnPagos").click();
  assert.ok(await page.locator("#pagosWeb").isHidden());
  await page.locator('#cartList .qty-btn[data-act="plus"][data-code="KT-01"]').click();
  assert.match(await page.innerText("#cartTotal"), /4 cajas · 60,00 \$/);
  assert.equal(await page.inputValue('.card[data-card="KT-01"] .qty-input'), "2");
  // tocar el número lo selecciona entero: lo que se escribe lo reemplaza (no queda "23")
  const qKT = '#cartList .qty-input[data-code="KT-01"]';
  if (cfg.movil) await page.locator(qKT).tap(); else await page.locator(qKT).click();
  await page.waitForTimeout(50);
  assert.ok(await page.locator(qKT).evaluate((e) => document.activeElement === e));
  await page.keyboard.type("3");
  assert.equal(await page.inputValue(qKT), "3");
  assert.match(await page.innerText("#cartTotal"), /5 cajas/);
  await page.locator(qKT).fill("2");
  // papelera: animación y se quita
  await page.locator('#cartList [data-quitar="KT-01"]').click();
  assert.ok(await page.locator('#cartList [data-item="KT-01"].saliendo').count());
  await page.waitForFunction(() => document.querySelectorAll("#cartList .cart-item").length === 1);
  await page.locator('#cartList .qty-btn[data-act="plus"][data-code="BC-01"]').click();
  assert.match(await page.innerText("#cartTotal"), /3 cajas · 30,00 \$/);
  // Un solo botón: Enviar pedido
  assert.deepEqual(await page.locator("#orderModal .modal-actions .btn").allInnerTexts(), ["Enviar pedido"]);
  assert.match(await page.innerText("#cliTit"), /opcional/);
  if (cfg.movil) {
    await page.locator("#btnPagos").click();
    await page.locator("#btnCliente").click();
    const chicosModal = await page.evaluate(() => [...document.querySelectorAll("#orderModal button, #orderModal .btn")]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 43.5 || r.width < 43.5); })
      .map((e) => `${e.className || e.id} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
    assert.deepEqual(chicosModal, [], "botones del pedido < 44px");
    const anchoModal = await page.evaluate(() => { const b = document.querySelector("#orderModal .modal-box"); return b.scrollWidth <= b.clientWidth + 1; });
    assert.ok(anchoModal, "Tu pedido tiene scroll horizontal");
    if (process.env.SCREENSHOTS) {
      await page.locator("#orderModal .modal-box").evaluate((b) => { b.scrollTop = 0; });
      await page.screenshot({ path: path.join(process.env.SCREENSHOTS, `${cfg.nombre}-pedido-abierto.png`) });
    }
    await page.locator("#btnPagos").click();
    await page.locator("#btnCliente").click();
    ok("Tu pedido: botones de 44px y sin scroll horizontal");
  }
  const modal = await page.evaluate(() => {
    const box = document.querySelector("#orderModal .modal-box").getBoundingClientRect();
    const fuentes = [...document.querySelectorAll("#orderModal input:not([type=radio]):not([type=hidden])")]
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.id);
    const b = document.getElementById("btnEnviarPedido").getBoundingClientRect();
    return { fuentes, bTop: b.top, bBottom: b.bottom, vh: innerHeight, box: box.width };
  });
  assert.deepEqual(modal.fuentes, [], "inputs con letra < 16px");
  assert.ok(modal.bTop >= 0 && modal.bBottom <= modal.vh, "botón Enviar no visible al abrir");
  ok("modal: letra 16px y Enviar siempre visible");

  // 1) Sin datos del cliente: ventana para mandarlo al vendedor por WhatsApp
  await page.locator("#btnEnviarPedido").click();
  await page.waitForSelector("#listoModal.es-wa:not([hidden])");
  assert.ok(await page.locator("#orderModal").isHidden());
  assert.equal(await page.innerText("#listoTit"), "Enviar al vendedor por WhatsApp");
  assert.match(await page.innerText("#listoSub"), /Coordiná los datos necesarios con tu vendedor de confianza/);
  await page.waitForFunction(() => document.querySelectorAll("#listoVend [data-wa]").length === 3);
  assert.deepEqual(await page.locator("#listoVend .vend-wa strong").allInnerTexts(), ["Kevin", "Óscar", "No tengo vendedor · escribir a Skala"]);
  assert.ok(await page.evaluate(() => { const b = document.querySelector("#listoModal .modal-box"); return b.scrollWidth <= b.clientWidth + 1; }), "ventana de envío con scroll horizontal");
  if (process.env.SCREENSHOTS) await page.screenshot({ path: path.join(process.env.SCREENSHOTS, `${cfg.nombre}-enviar-wa.png`) });
  await page.locator("#listoVend .vend-wa", { hasText: "Óscar" }).click(); // la flechita
  let abiertos = await page.evaluate(() => window.__abiertos);
  assert.match(abiertos.at(-1), /^https:\/\/wa\.me\/584247387202\?text=/); // al WhatsApp de Óscar
  const msg1 = decodeURIComponent(abiertos.at(-1).split("text=")[1]);
  assert.match(msg1, /• 3 × Babosa \(BC-01\) · 10,00 \$ c\/u/);
  assert.match(msg1, /Mi vendedor: Óscar/);
  assert.ok(await page.locator("#listoVend .vend-wa.enviado").count());
  await page.locator("#listoVend .vend-wa", { hasText: "No tengo vendedor" }).click();
  abiertos = await page.evaluate(() => window.__abiertos);
  assert.match(abiertos.at(-1), /^https:\/\/wa\.me\/584247042169\?text=/); // a Skala
  assert.equal(gas.tabla("PedidosWeb").length, 0); // sin datos no se guarda en el sistema
  await page.click("#btnListoCerrar");
  assert.ok(await page.locator("#listoModal").isHidden());
  assert.equal(await page.evaluate(() => document.body.classList.contains("modal-open")), false);
  assert.match(await page.innerText("#orderTotal"), /^3$/); // el pedido sigue armado
  ok("sin datos: Enviar → mandarlo por WhatsApp al vendedor elegido (o a Skala)");

  // 2) Con datos del cliente: ¡Listo! con confeti; y opcional por WhatsApp a su vendedor
  await page.click("#btnArmarPedido");
  await page.click("#btnModoCliente");
  await page.locator("#btnCliente").click();
  await page.fill("#cliBuscar", "0414-5551234");
  await page.click("#btnCliBuscar");
  await page.waitForFunction(() => /No te encontramos/.test(document.getElementById("cliRes").textContent));
  await page.click("#btnCliNuevo");
  assert.ok(await page.locator("#cliForm").isVisible());
  await page.fill("#fNegocio", "Salón Luz");
  await page.fill("#fTelefono", "0414-5551234");
  // dirección larga: baja de línea en vez de correrse hacia un lado
  await page.fill("#fDireccion", "Av 15 bis Calle 13 edificio Dávila Local 12 Planta Alta El Vigía Mérida 5145 frente a la plaza");
  const dir = await page.locator("#fDireccion").evaluate((e) => ({ alto: e.offsetHeight, sw: e.scrollWidth, cw: e.clientWidth, pag: document.documentElement.scrollWidth - innerWidth }));
  assert.ok(dir.alto > 60 && dir.sw <= dir.cw && dir.pag <= 0, JSON.stringify(dir));
  await page.locator("#fDireccion").press("Enter"); // Enter no agrega saltos de línea
  assert.ok(!/\n/.test(await page.inputValue("#fDireccion")));
  await page.click("#btnUbic");
  await page.waitForFunction(() => /Ubicación lista/.test(document.getElementById("ubicEstado").textContent));
  await page.click("#btnCliListo");
  assert.match(await page.innerText("#cliElegido"), /Salón Luz[\s\S]*0414-5551234[\s\S]*ubicación/);
  await page.locator("#btnPagos").click();
  await page.locator('#pagosWeb input[value="efectivo_pronto"]').check();
  assert.equal(await page.locator("#pagoElegido .hasta-desc").count(), 0); // ya tiene el mayor descuento
  assert.match(await page.innerText("#cartTotal"), /18,00 \$ Efectivo pronto pago/);
  await page.locator("#btnEnviarPedido").click();
  await page.waitForSelector("#listoModal.es-listo:not([hidden])");
  assert.equal(await page.innerText("#listoTit"), "¡Listo!");
  assert.match(await page.innerText("#listoSub"), /^Tu pedido llegó a Skala/);
  assert.equal(await page.innerText("#listoPreg"), "¿Deseas también enviarlo por WhatsApp a tu vendedor?");
  assert.ok((await page.locator("#confeti i").count()) > 20);
  if (process.env.SCREENSHOTS) { await page.waitForTimeout(500); await page.screenshot({ path: path.join(process.env.SCREENSHOTS, `${cfg.nombre}-listo.png`) }); }
  let web = gas.tabla("PedidosWeb")[0];
  assert.ok(web, "no llegó el pedido web");
  assert.equal(web.vendedor, ""); assert.equal(web.negocio, "Salón Luz"); assert.equal(web.total, 18); assert.equal(web.tipo_pago, "efectivo_pronto");
  assert.equal(web.latitud, 8.612346);
  await page.locator("#listoVend .vend-wa", { hasText: "Óscar" }).click();
  abiertos = await page.evaluate(() => window.__abiertos);
  const msg2 = decodeURIComponent(abiertos.at(-1).split("text=")[1]);
  assert.match(msg2, /\(WEB-[A-Z2-9]{6}\)/);
  assert.match(msg2, /Monto: 18,00 \$ \(Efectivo pronto pago\)/);
  assert.match(msg2, /Ubicación: https:\/\/maps\.google\.com\/\?q=8\.61/);
  for (let i = 0; i < 50 && !gas.tabla("PedidosWeb")[0].vendedor; i++) await page.waitForTimeout(100);
  assert.equal(gas.tabla("PedidosWeb")[0].vendedor, "Óscar"); // queda asignado a quien se lo mandó
  await page.click("#btnListoCerrar");
  assert.ok(await page.locator("#orderBar.show").count() === 0); // pedido entregado: se vacía
  ok("con datos: Enviar → ¡Listo! con confeti; por WhatsApp a su vendedor y queda asignado");

  // 3) un cliente ya registrado se busca por su teléfono y no escribe nada
  await tocar('.card[data-card="BC-01"] .card-name');
  await page.click("#btnArmarPedido");
  await page.click("#btnModoCliente");
  await page.click('#cliElegido [data-cli="cambiar"]');
  await page.fill("#cliBuscar", "0416 777 8899");
  await page.click("#btnCliBuscar");
  await page.waitForFunction(() => /Barbería Max/.test(document.getElementById("cliElegido").textContent));
  assert.ok(await page.locator("#cliPanel").isHidden());
  assert.equal(await page.inputValue("#fNegocio"), "Barbería Max");
  ok("cliente registrado: se busca por teléfono");
  await page.click('#cliElegido [data-cli="quitar"]');
  assert.ok(await page.locator("#cliElegido .cli-elegido.saliendo").count());
  await page.waitForFunction(() => !/Barbería Max/.test(document.getElementById("cliElegido").textContent));
  assert.equal(await page.inputValue("#fNegocio"), "");
  assert.ok(await page.locator("#btnCliente").isVisible());
  ok("cliente elegido: se quita con la papelera");
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
