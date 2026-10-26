/* Prueba de punta a punta del MODO VENDEDOR en un teléfono (390 px).
   El backend real (crm/Code.gs) corre en un Google Apps Script simulado en memoria,
   y el navegador le habla como si fuera la App web publicada.
   Correr: node tests/e2e-vendedor.js  (requiere Playwright) */
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { crearGas } = require("../../crm/tests/fake-gas.js");

const URL = "file://" + path.resolve(__dirname, "..", "index.html");
const API = "https://crm.test/exec";

(async () => {
  const gas = crearGas();
  gas.ctx.prepararHojas();
  gas.ctx.agregarVendedor("Óscar", "1234");
  gas.ctx.agregarVendedor("Kevin", "9876");

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    geolocation: { latitude: 8.6123456, longitude: -71.6543219, accuracy: 12 }, permissions: ["geolocation"],
  });
  let sinSenal = false;
  await ctx.route(API, async (route) => {
    if (sinSenal) return route.abort("internetdisconnected");
    const body = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(gas.post(body)) });
  });
  await ctx.addInitScript((api) => {
    window.SKALA_CRM_URL = api;
    window.__compartido = [];
    navigator.share = async (d) => { window.__compartido.push(d.text); };
  }, API);

  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("dialog", (d) => (d.type() === "prompt" ? d.accept("Cliente cerró el local") : d.accept()));
  const ok = (m) => console.log("  ✔ " + m);
  const tocar = async (sel) => {
    const loc = page.locator(sel).first();
    await loc.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
    await loc.click();
  };
  const agregar = async (code, n) => { for (let i = 0; i < n; i++) await tocar(`.qty-btn[data-act="plus"][data-code="${code}"]`); };

  await page.goto(URL);
  await page.waitForSelector(".card");
  console.log("▶ modo vendedor (390px)");

  // 1. Selector Cliente / Vendedor
  await agregar("BC-01", 2); await agregar("KT-01", 1);
  await tocar("#btnArmarPedido");
  assert.ok(await page.locator("#modoModal").isVisible());
  await page.click("#btnModoCliente");
  assert.ok(await page.locator("#orderModal").isVisible());
  await page.click("#btnClose");
  ok("Cliente → flujo actual sin cambios");

  // 2. Login
  await tocar("#btnArmarPedido");
  await page.click("#btnModoVendedor");
  await page.waitForSelector('#loginVendedor option[value="V1"]', { state: "attached" });
  assert.deepEqual(await page.locator("#loginVendedor option").allInnerTexts(), ["Elegí tu nombre", "Óscar", "Kevin"]);
  await page.selectOption("#loginVendedor", "V1");
  await page.fill("#loginPin", "0000");
  await page.click("#btnLogin");
  await page.waitForSelector("#loginError:not([hidden])");
  assert.match(await page.innerText("#loginError"), /PIN incorrecto/);
  await page.fill("#loginPin", "1234");
  await page.click("#btnLogin");
  await page.waitForSelector("#vendModal:not([hidden])");
  assert.equal(await page.innerText("#vendNombre"), "Óscar");
  assert.ok(await page.locator("#navMisPedidos").isVisible());
  ok("login con PIN (error y acierto), sesión visible en el menú");

  // 3. Validación + datos del cliente + GPS
  assert.match(await page.innerText("#vendResumen"), /3 cajas · 2 × Babosa, 1 × Kit 12 em 1/);
  await page.click("#btnGuardar");
  assert.match(await page.innerText("#vError"), /Falta: Nombre del cliente o del negocio · Teléfono 1/);
  await page.fill("#vContacto", "María Pérez");
  await page.fill("#vNegocio", "Peluquería Bella");
  await page.fill("#vRif", "J-12345678-9");
  await page.fill("#vTel1", "0412-1234567");
  await page.fill("#vTel2", "0275-8812345");
  await page.fill("#vDireccion", "Av. Bolívar, El Vigía");
  await tocar("#btnGps");
  await page.waitForFunction(() => /Ubicación lista/.test(document.getElementById("gpsEstado").textContent));
  assert.match(await page.innerText("#gpsEstado"), /±12 m/);
  await tocar('input[name="vPago"][value="Divisas · Contado"]');
  await page.fill("#vNota", "Entregar el viernes");
  ok("validación, datos del cliente y GPS");

  // 4. Guardar → hoja + mensaje + compartir al grupo
  await tocar("#btnGuardar");
  await page.waitForSelector("#vendPaso2:not([hidden])");
  const titulo = await page.innerText("#vendTitulo");
  assert.match(titulo, /^Pedido SKL-\d{6}-001 guardado$/);
  const msg = await page.inputValue("#vMensaje");
  assert.match(msg, /^\*PEDIDO SKL-\d{6}-001\*\n.* · Vendedor: Óscar/);
  assert.match(msg, /Peluquería Bella · María Pérez/);
  assert.match(msg, /Tel: 0412-1234567 \/ 0275-8812345/);
  assert.match(msg, /Ubicación: https:\/\/maps\.google\.com\/\?q=8\.612346,-71\.654322/);
  assert.match(msg, /• 2 × Babosa \(BC-01\) = 12 unidades\n• 1 × Kit 12 em 1 \(KT-01\) = 6 dúos/);
  assert.match(msg, /\*Total: 3 cajas\* · 12 unidades \+ 6 dúos\nPago: Divisas · Contado\nNota: Entregar el viernes/);
  const ped = gas.tabla("Pedidos");
  assert.equal(ped.length, 1);
  assert.equal(ped[0].estado, "pendiente");
  assert.equal(ped[0].vendedor, "Óscar");
  assert.equal(gas.tabla("PedidoItems").length, 2);
  const cli = gas.tabla("Clientes");
  assert.equal(cli.length, 1);
  assert.equal(cli[0].nombre, "Peluquería Bella");
  assert.equal(cli[0].latitud, 8.612346);
  ok("pedido guardado en Sheets (Pedidos, PedidoItems, Clientes)");

  assert.ok(await page.locator("#orderBar").evaluate((b) => !b.classList.contains("show")));
  ok("carrito vaciado al guardar");

  await page.click("#btnGrupo");
  assert.deepEqual(await page.evaluate(() => window.__compartido), [msg]);
  assert.match(await page.getAttribute("#btnCopiaCliente", "href"), /^https:\/\/wa\.me\/584121234567\?text=/);
  ok("enviar al grupo (menú compartir) y copia al cliente");

  // 5. Cliente existente: búsqueda y segundo pedido
  await page.click("#vendModal [data-cerrar]");
  await agregar("BC-06", 4);
  await tocar("#btnArmarPedido");
  await page.click("#btnModoVendedor"); // ya con sesión: va directo
  await page.waitForSelector("#vendModal:not([hidden])");
  await page.fill("#vBuscar", "bella");
  await page.waitForSelector("#vResultados:not([hidden]) button");
  await page.click("#vResultados button");
  assert.equal(await page.inputValue("#vNegocio"), "Peluquería Bella");
  assert.equal(await page.inputValue("#vTel2"), "0275-8812345");
  assert.match(await page.innerText("#vClienteSel"), /Cliente existente/);
  await tocar("#btnGuardar");
  await page.waitForSelector("#vendPaso2:not([hidden])");
  assert.match(await page.innerText("#vendTitulo"), /-002 guardado/);
  assert.equal(gas.tabla("Clientes").length, 1);
  ok("buscar cliente existente y reutilizarlo (sin duplicar)");

  // 6. Sin señal: queda en el teléfono y se sube después
  await page.click("#vendModal [data-cerrar]");
  await agregar("KT-02", 1);
  await tocar("#btnArmarPedido");
  await page.click("#btnModoVendedor");
  await page.fill("#vNegocio", "Barbería Max");
  await page.fill("#vTel1", "0416-5550000");
  sinSenal = true;
  await tocar("#btnGuardar");
  await page.waitForSelector("#vendPaso2:not([hidden])");
  assert.equal(await page.innerText("#vendTitulo"), "Guardado en el teléfono");
  assert.equal(gas.tabla("Pedidos").length, 2);
  ok("sin señal: pedido guardado en el teléfono");
  sinSenal = false;
  await page.click("#btnVendMisPedidos");
  await page.waitForFunction(() => document.querySelectorAll("#pedidosLista .ped").length === 3);
  assert.equal(gas.tabla("Pedidos").length, 3);
  assert.ok(await page.locator("#pendSubir").isHidden());
  ok("al volver la señal se sube solo (3 pedidos pendientes)");

  // 7. Entregado / Cancelado
  await page.locator("#pedidosLista .ped").filter({ hasText: "-001" }).locator('[data-acc="entregado"]').click();
  await page.waitForFunction(() => document.querySelectorAll("#pedidosLista .ped").length === 2);
  await page.locator("#pedidosLista .ped").filter({ hasText: "Barbería Max" }).locator('[data-acc="cancelado"]').click();
  await page.waitForFunction(() => document.querySelectorAll("#pedidosLista .ped").length === 1);
  await page.click('#pedidosTabs [data-estado="entregado"]');
  await page.waitForFunction(() => document.querySelectorAll("#pedidosLista .ped-entregado").length === 1);
  await page.click('#pedidosTabs [data-estado="cancelado"]');
  await page.waitForFunction(() => document.querySelectorAll("#pedidosLista .ped-cancelado").length === 1);
  assert.match(await page.innerText("#pedidosLista"), /Motivo: Cliente cerró el local/);
  const estados = gas.tabla("Pedidos").map((p) => p.estado).sort();
  assert.deepEqual(estados, ["cancelado", "entregado", "pendiente"]);
  ok("marcar entregado y cancelado (con motivo), filtros por estado");

  // Reenviar al grupo desde la lista
  await page.locator('#pedidosLista [data-acc="grupo"]').first().click();
  assert.match((await page.evaluate(() => window.__compartido)).at(-1), /CANCELADO\*[\s\S]*Motivo: Cliente cerró el local/);
  ok("reenviar al grupo desde Mis pedidos");

  // 8. Diseño móvil de los modales del vendedor
  const lay = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth }));
  assert.ok(lay.sw <= lay.vw);
  const chicos = await page.evaluate(() =>
    [...document.querySelectorAll("#pedidosModal button, #pedidosModal a")]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 44; })
      .map((e) => e.textContent.trim() + " " + Math.round(e.getBoundingClientRect().height)));
  assert.deepEqual(chicos, []);
  ok("modales sin scroll horizontal y botones >= 44px");
  await page.screenshot({ path: process.env.SHOT || "/dev/null" }).catch(() => {});

  // 9. Salir
  await page.locator("#pedidosModal .js-salir").click();
  assert.ok(await page.locator("#navMisPedidos").isHidden());
  assert.equal(await page.evaluate(() => localStorage.getItem("skala_vendedor_v1")), null);
  ok("cerrar sesión");

  assert.deepEqual(errores, [], errores.join(" | "));
  await browser.close();
  console.log("E2E VENDEDOR OK");
})().catch((e) => { console.error("✘", e.message); process.exit(1); });
