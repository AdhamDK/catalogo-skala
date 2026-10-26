/* Prueba de punta a punta del CRM con roles, en un teléfono (390 px).
   El backend real (crm/Code.gs) corre en un Google Apps Script simulado en memoria.
   Un mismo pedido recorre: vendedor → administración → despachador → master.
   Correr: node tests/e2e-crm.js  (requiere Playwright) */
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { crearGas } = require("../../crm/tests/fake-gas.js");

const URL = "file://" + path.resolve(__dirname, "..", "index.html");
const API = "https://crm.test/exec";
const SHOTS = process.env.SHOTS || "";

(async () => {
  const gas = crearGas();
  gas.ctx.prepararHojas();
  gas.ctx.crearUsuario("jose", "José Montiel", "master", "111111");
  gas.ctx.crearUsuario("ana", "Ana", "admin", "2222");
  gas.ctx.crearUsuario("oscar", "Óscar", "vendedor", "1234");
  gas.ctx.crearUsuario("luis", "Luis", "despachador", "5555");

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
  const foto = async (n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  const tocar = async (sel) => {
    const loc = page.locator(sel).first();
    await loc.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
    await loc.click();
  };
  const agregar = async (code, n) => { for (let i = 0; i < n; i++) await tocar(`.qty-btn[data-act="plus"][data-code="${code}"]`); };
  const ingresar = async (usuario, pin) => {
    await page.fill("#loginUsuario", usuario);
    await page.fill("#loginPin", pin);
    await page.click("#btnLogin");
  };
  const salir = async () => {
    await page.locator("#panelModal .js-salir").click();
    assert.equal(await page.innerText("#btnCuenta"), "Ingresar");
  };
  const tarjetas = () => page.locator("#panelContenido .ped");
  const esperarTarjetas = (n) => page.waitForFunction((n) => document.querySelectorAll("#panelContenido .ped").length === n, n);
  const tab = async (id) => { await page.click(`#panelTabs [data-tab="${id}"]`); };

  await page.goto(URL);
  await page.waitForSelector(".card");
  console.log("▶ CRM con roles (390px)");

  /* ---------- Sin sesión ---------- */
  assert.equal(await page.innerText("#btnCuenta"), "Ingresar");
  await agregar("BC-01", 2); await agregar("KT-01", 1);
  await tocar("#btnArmarPedido");
  assert.ok(await page.locator("#modoModal").isVisible());
  await foto("01-quien");
  await page.click("#btnModoCliente");
  assert.ok(await page.locator("#orderModal").isVisible());
  await page.click("#btnClose");
  ok("sin sesión: elige Cliente / Vendedor; Cliente igual que antes");

  /* ---------- VENDEDOR ---------- */
  await tocar("#btnArmarPedido");
  await page.click("#btnModoVendedor");
  await page.waitForSelector("#loginModal:not([hidden])");
  await foto("02-login");
  await ingresar("oscar", "0000");
  await page.waitForSelector("#loginError:not([hidden])");
  assert.match(await page.innerText("#loginError"), /Usuario o PIN incorrecto/);
  await ingresar("Oscar", "1234");
  await page.waitForSelector("#vendModal:not([hidden])");
  assert.equal(await page.innerText("#btnCuenta"), "Óscar");
  assert.match(await page.innerText("#vendModal .js-quien"), /Óscar · Vendedor/);
  ok("login clásico usuario + PIN (error y acierto)");

  await page.click("#btnGuardar");
  assert.match(await page.innerText("#vError"), /Falta: Nombre del cliente o del negocio · Teléfono 1/);
  await page.fill("#vContacto", "María Pérez");
  await page.fill("#vNegocio", "Peluquería Bella");
  await page.fill("#vTel1", "0412-1234567");
  await page.fill("#vDireccion", "Av. Bolívar, El Vigía");
  await tocar("#btnGps");
  await page.waitForFunction(() => /Ubicación lista/.test(document.getElementById("gpsEstado").textContent));
  await tocar('input[name="vPago"][value="Divisas · Contado"]');
  await foto("03-pedido");
  await tocar("#btnGuardar");
  await page.waitForSelector("#vendPaso2:not([hidden])");
  assert.match(await page.innerText("#vendTitulo"), /^Pedido SKL-\d{6}-001 guardado$/);
  const msg = await page.inputValue("#vMensaje");
  assert.match(msg, /Peluquería Bella · María Pérez[\s\S]*Ubicación: https:\/\/maps\.google\.com\/\?q=8\.612346,-71\.654322/);
  await page.click("#btnGrupo");
  assert.deepEqual(await page.evaluate(() => window.__compartido), [msg]);
  assert.equal(gas.tabla("Pedidos")[0].estado, "pendiente");
  ok("vendedor guarda el pedido en Sheets y lo envía al grupo");

  // Con sesión de vendedor, "Armar pedido" va directo al formulario
  await page.click("#vendModal [data-cerrar]");
  await agregar("BC-06", 1);
  await tocar("#btnArmarPedido");
  await page.waitForSelector("#vendModal:not([hidden])");
  assert.ok(await page.locator("#modoModal").isHidden());
  await page.click("#vendModal [data-cerrar]");
  await page.click("#btnClear");
  ok("con sesión de vendedor: Armar pedido va directo, sin preguntar");

  // Panel del vendedor
  await page.click("#btnCuenta");
  await page.waitForSelector("#panelModal:not([hidden])");
  assert.deepEqual(await page.locator("#panelTabs .tab").allInnerTexts(), ["Pendientes", "En curso", "Entregados", "Cancelados", "Resumen"]);
  await esperarTarjetas(1);
  assert.deepEqual(await tarjetas().first().locator(".ped-acciones .btn").allInnerTexts(), ["Cancelar"]);
  await foto("04-panel-vendedor");
  await salir();
  ok("panel del vendedor: sus pendientes, solo puede cancelar");

  /* ---------- ADMINISTRACIÓN ---------- */
  await page.click("#btnCuenta");
  await ingresar("ana", "2222");
  await page.waitForSelector("#panelModal:not([hidden])");
  assert.equal(await page.innerText("#panelTitulo"), "Administración");
  assert.deepEqual(await page.locator("#panelTabs .tab").allInnerTexts(), ["Por confirmar", "En curso", "Entregados", "Cancelados", "Resumen"]);
  await esperarTarjetas(1);
  assert.deepEqual(await tarjetas().first().locator(".ped-acciones .btn").allInnerTexts(), ["Confirmar", "Cancelar"]);
  assert.match(await tarjetas().first().innerText(), /Vendedor: Óscar/);
  await foto("05-admin");
  await tarjetas().first().locator('[data-acc="confirmar"]').click();
  await page.waitForSelector('#asignarDespachador option[value]:not([value=""])', { state: "attached" });
  await page.click("#btnAsignar");
  await page.waitForSelector("#asignarError:not([hidden])");
  assert.match(await page.innerText("#asignarError"), /Elegí un despachador/);
  await page.selectOption("#asignarDespachador", { label: "Luis" });
  await foto("06-asignar");
  await page.click("#btnAsignar");
  await page.waitForSelector("#asignarModal", { state: "hidden" });
  await esperarTarjetas(0);
  await tab("curso");
  await esperarTarjetas(1);
  assert.match(await tarjetas().first().innerText(), /Despacha: Luis/);
  assert.equal(gas.tabla("Pedidos")[0].estado, "confirmado");
  assert.equal(gas.tabla("Pedidos")[0].confirmado_por, "Ana");
  await salir();
  ok("administración confirma y asigna despachador");

  /* ---------- DESPACHADOR ---------- */
  await page.click("#btnCuenta");
  await ingresar("luis", "5555");
  await page.waitForSelector("#panelModal:not([hidden])");
  assert.equal(await page.innerText("#panelTitulo"), "Mis entregas");
  assert.deepEqual(await page.locator("#panelTabs .tab").allInnerTexts(), ["Por entregar", "Entregados"]);
  assert.ok(await page.locator("#btnNuevoPedido").isHidden());
  await esperarTarjetas(1);
  const card = tarjetas().first();
  assert.match(await card.innerText(), /Av\. Bolívar, El Vigía/);
  assert.equal(await card.locator('a[href^="tel:"]').count(), 1);
  assert.equal(await card.locator('a[href^="https://maps.google.com"]').count(), 1);
  assert.deepEqual(await card.locator(".ped-acciones .btn").allInnerTexts(), ["En ruta", "Entregado"]);
  await card.locator("summary").click();
  assert.match(await card.locator(".ped-items").innerText(), /2 × Babosa/);
  await foto("07-despachador");
  await card.locator('[data-acc="en_ruta"]').click();
  await page.waitForFunction(() => /En ruta/.test(document.querySelector("#panelContenido .ped-estado")?.textContent || ""));
  await tarjetas().first().locator('[data-acc="entregado"]').click();
  await esperarTarjetas(0);
  await tab("entregado");
  await esperarTarjetas(1);
  assert.equal(gas.tabla("Pedidos")[0].entregado_por, "Luis");
  // un despachador no toma pedidos
  await page.click("#panelModal [data-cerrar]");
  await agregar("BC-02", 1);
  await tocar("#btnArmarPedido");
  await page.click("#btnModoVendedor");
  await page.waitForSelector("#toast:not([hidden])");
  assert.match(await page.innerText("#toast"), /no toma pedidos/);
  await page.click("#btnClear");
  await page.click("#btnCuenta");
  await salir();
  ok("despachador: ve sus entregas con llamar/mapa, en ruta → entregado; no toma pedidos");

  /* ---------- MASTER ---------- */
  await page.click("#btnCuenta");
  await ingresar("jose", "111111");
  await page.waitForSelector("#panelModal:not([hidden])");
  assert.equal(await page.innerText("#panelTitulo"), "Panel Master");
  assert.deepEqual(await page.locator("#panelTabs .tab").allInnerTexts(), ["Por confirmar", "En curso", "Entregados", "Cancelados", "Resumen", "Usuarios"]);

  // Resumen
  await tab("resumen");
  await page.waitForSelector("#panelContenido .stats");
  const stats = await page.locator("#panelContenido .stat strong").allInnerTexts();
  assert.deepEqual(stats, ["1", "3", "1", "0"]);
  assert.match(await page.innerText("#panelContenido"), /Óscar\s+1\s+3/);
  await foto("08-resumen");
  ok("master: resumen (pedidos, cajas, entregados, por vendedor)");

  // Usuarios: crear vendedor nuevo, editar rol
  await tab("usuarios");
  await page.waitForSelector("#panelContenido .usuarios-lista li");
  assert.equal(await page.locator("#panelContenido .usuarios-lista li").count(), 4);
  await foto("09-usuarios");
  await page.click("#btnNuevoUsuario");
  await page.fill("#uUsuario", "kevin");
  await page.fill("#uNombre", "Kevin");
  await page.selectOption("#uRol", "vendedor");
  await page.click("#btnGuardarUsuario");
  await page.waitForSelector("#usuarioError:not([hidden])");
  assert.match(await page.innerText("#usuarioError"), /Asigná un PIN/);
  await page.fill("#uPin", "9876");
  await page.click("#btnGuardarUsuario");
  await page.waitForFunction(() => document.querySelectorAll("#panelContenido .usuarios-lista li").length === 5);
  await page.locator("#panelContenido .usuarios-lista li").filter({ hasText: "Kevin" }).locator("[data-editar]").click();
  await page.selectOption("#uRol", "despachador");
  await page.click("#btnGuardarUsuario");
  await page.waitForFunction(() => /Kevin[\s\S]*Despachador/.test(document.querySelector("#panelContenido .usuarios-lista").innerText));
  assert.equal(gas.tabla("Usuarios").find((u) => u.usuario === "kevin").rol, "despachador");
  ok("master: crea usuario y le cambia el rol desde la web");

  // Master reabre el pedido entregado (corrección) y lo cancela con motivo
  await tab("entregado");
  await esperarTarjetas(1);
  await tarjetas().first().locator('[data-acc="reabrir"]').click();
  await esperarTarjetas(0);
  await tab("pendiente");
  await esperarTarjetas(1);
  await tarjetas().first().locator('[data-acc="cancelar"]').click();
  await esperarTarjetas(0);
  assert.equal(gas.tabla("Pedidos")[0].estado, "cancelado");
  assert.deepEqual(gas.tabla("Historial").map((h) => h.accion), ["creado", "confirmado", "en_ruta", "entregado", "pendiente", "cancelado"]);
  ok("master: reabre y cancela; todo queda en Historial");

  /* ---------- Diseño ---------- */
  const lay = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth }));
  assert.ok(lay.sw <= lay.vw, "scroll horizontal");
  const chicos = await page.evaluate(() =>
    [...document.querySelectorAll("#panelModal button, #panelModal a, #panelModal summary, #btnCuenta")]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 44; })
      .map((e) => e.textContent.trim() + " " + Math.round(e.getBoundingClientRect().height)));
  assert.deepEqual(chicos, []);
  ok("sin scroll horizontal y botones >= 44px");
  await salir();

  assert.deepEqual(errores, [], errores.join(" | "));
  await browser.close();
  console.log("E2E CRM OK");
})().catch((e) => { console.error("✘", e.message); process.exit(1); });
