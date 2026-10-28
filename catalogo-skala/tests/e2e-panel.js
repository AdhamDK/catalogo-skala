/* Prueba de punta a punta del PANEL DEL EQUIPO (panel.html) en un teléfono (390 px).
   - Sirve la carpeta por HTTP (como Netlify) para probar también el service worker.
   - El backend real (crm/Code.gs) corre en un Google Apps Script simulado en memoria.
   - Un pedido recorre: catálogo → vendedor → administración → despachador → master.
   Correr: node tests/e2e-panel.js  (requiere Playwright). SHOTS=carpeta guarda capturas. */
const path = require("path");
const http = require("http");
const fs = require("fs");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { crearGas } = require("../../crm/tests/fake-gas.js");

const RAIZ = path.resolve(__dirname, "..");
const API = "https://crm.test/exec";
const SHOTS = process.env.SHOTS || "";
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".webmanifest": "application/manifest+json", ".jpg": "image/jpeg", ".pdf": "application/pdf" };

function servidor() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const ruta = path.join(RAIZ, decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (!ruta.startsWith(RAIZ) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(ruta)] || "application/octet-stream" });
      fs.createReadStream(ruta).pipe(res);
    }).listen(0, "127.0.0.1", () => ok(s));
  });
}

(async () => {
  const gas = crearGas();
  gas.ctx.prepararHojas();
  gas.ctx.crearUsuario("jose", "José Montiel", "master", "Skala#2026");
  gas.ctx.crearUsuario("ana", "Ana", "admin", "Ana*2222");
  gas.ctx.crearUsuario("oscar", "Óscar", "vendedor", "Oscar.1234");
  gas.ctx.crearUsuario("luis", "Luis", "despachador", "Luis5555");
  // Precios ($ por caja: menor, mayor, desc. pronto, efectivo crédito, efectivo pronto) e inventario
  const precio = (code, menor, mayor, a, b, c) => gas.ctx.accionGuardarPrecio_({ code, menor, mayor, desc_pronto: a, desc_efectivo_credito: b, desc_efectivo_pronto: c }, { nombre: "Prueba" });
  precio("BC-01", 10, 8, 1, 3, 4); precio("BC-06", 12, 10, 1, 3, 4); precio("KT-01", 20, 18, 2, 6, 8); precio("KT-02", 20, 18, 2, 6, 8);
  gas.ctx.accionMovimiento_({ code: "KT-02", cajas: 6 }, { nombre: "Prueba" });

  const srv = await servidor();
  const BASE = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    geolocation: { latitude: 8.6123456, longitude: -71.6543219, accuracy: 12 }, permissions: ["geolocation"],
  });
  let sinSenal = false, retraso = 0;
  await ctx.route(API, async (route) => {
    if (sinSenal) return route.abort("internetdisconnected");
    if (retraso) await new Promise((r) => setTimeout(r, retraso));
    const body = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(gas.post(body)) });
  });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.addInitScript((api) => {
    window.SKALA_CRM_URL = api;
    window.__compartido = [];
    navigator.share = async (d) => { window.__compartido.push(d.text); };
  }, API);

  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  const ok = (m) => console.log("  ✔ " + m);
  const foto = async (n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  const tocar = async (sel) => {
    const loc = page.locator(sel).first();
    await loc.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
    await loc.click();
  };
  const titulo = () => page.innerText("#appTitulo");
  const esperarTitulo = (t) => page.waitForFunction((t) => document.getElementById("appTitulo").textContent === t, t);
  const esperarRuta = (h) => page.waitForFunction((h) => !!document.body && (document.body.dataset.lista || "").startsWith(h), h);
  const ingresar = async (u, c) => {
    await page.waitForSelector("#fLogin");
    await page.fill("#lUsuario", u);
    await page.fill("#lClave", c);
    await page.click("#btnLogin");
  };
  const salir = async () => {
    await page.goto(BASE + "/panel.html#/mas");
    await page.waitForSelector("#btnSalir");
    await page.click("#btnSalir");
    await esperarRuta("#/ingresar");
  };
  const revisarDiseno = async (donde) => {
    // esperar que terminen las animaciones (entrada de página, toques) antes de medir
    await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))));
    await page.mouse.move(0, 0);
    const r = await page.evaluate(() => {
      const chicos = [...document.querySelectorAll("#vista a.btn, #vista button, .app-nav a, #btnAtras:not([hidden])")]
        .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && (b.height < 44 || b.width < 44); })
        .map((e) => (e.textContent.trim() || e.getAttribute("aria-label")) + " " + Math.round(e.getBoundingClientRect().width) + "x" + Math.round(e.getBoundingClientRect().height));
      return { sw: document.documentElement.scrollWidth, vw: innerWidth, chicos };
    });
    assert.ok(r.sw <= r.vw, `${donde}: scroll horizontal ${r.sw}>${r.vw}`);
    assert.deepEqual(r.chicos, [], `${donde}: botones < 44px`);
  };

  console.log("▶ panel del equipo (390px, HTTP)");

  /* ---------- Catálogo → panel con el carrito ---------- */
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(".card");
  await tocar('.card[data-card="BC-01"] .card-name');
  await tocar('.card[data-card="BC-01"] .card-name');
  await tocar('.card[data-card="KT-01"] .card-name');
  await tocar("#btnArmarPedido");
  assert.ok(await page.locator("#modoModal").isVisible());
  await page.click("#btnModoVendedor");
  await esperarRuta("#/ingresar");
  assert.equal(await titulo(), "Ingresar");
  assert.ok(await page.locator("#appNav").isHidden());
  await foto("01-ingresar");
  ok("catálogo → Vendedor abre el panel y pide ingresar");

  await ingresar("oscar", "mala123");
  await page.waitForSelector("#lError:not([hidden])");
  assert.match(await page.innerText("#lError"), /incorrect/);
  await page.fill("#lClave", "Oscar.1234");
  await page.click('.ver-clave[data-ver="lClave"]');
  assert.equal(await page.getAttribute("#lClave", "type"), "text");
  await page.click("#btnLogin");
  await esperarRuta("#/nuevo");
  assert.equal(await titulo(), "Nuevo pedido");
  assert.deepEqual((await page.locator(".pasos li").allInnerTexts()).map((t) => t.replace(/\s+/g, " ")), ["1 Cliente", "2 Productos", "3 Enviar"]);
  assert.equal(await page.locator(".prod").count(), 0); // paso 1: solo buscar o cliente nuevo
  assert.ok(await page.locator("#cBuscar").isVisible());
  assert.ok(await page.locator("#btnClienteNuevo").isVisible());
  assert.deepEqual(await page.locator(".app-nav a span").allInnerTexts(), ["Inicio", "Nuevo", "Pedidos", "Clientes"]);
  assert.ok(await page.locator("#btnMas").isVisible()); // Más está arriba, al lado del nombre
  assert.equal(await page.innerText(".app-nav .badge"), "3");
  await foto("02a-paso1");
  ok("login (error y acierto, ver clave) → Nuevo empieza con Buscar cliente / Cliente nuevo");

  /* ---------- Paso 1: cliente nuevo ---------- */
  await page.fill("#cBuscar", "bella");
  await page.waitForSelector("#cResultados .vacio-panel");
  assert.match(await page.innerText("#cResultados"), /No está registrado/);
  await page.click("#btnClienteNuevo");
  await page.waitForSelector("#fCli");
  await tocar("#btnCliUsar");
  assert.match(await page.innerText("#cError"), /Falta: Nombre del cliente o del negocio · Teléfono 1/);
  await page.fill("#cContacto", "María Pérez");
  await page.fill("#cNegocio", "Peluquería Bella");
  await page.fill("#cTel1", "0412-1234567");
  await page.fill("#cDireccion", "Av. Bolívar, El Vigía");
  await tocar("#btnGps");
  await page.waitForFunction(() => /Ubicación lista/.test(document.getElementById("gpsEstado").textContent));
  await foto("02b-cliente-nuevo");
  await revisarDiseno("cliente nuevo");
  await tocar("#btnCliUsar");
  await page.waitForSelector("#fichaCli");
  assert.match(await page.innerText("#fichaCli"), /Peluquería Bella[\s\S]*0412-1234567/);
  // el lápiz permite corregir antes de seguir
  await page.click("#btnLapiz");
  await page.waitForSelector("#fCli");
  assert.equal(await page.inputValue("#cNegocio"), "Peluquería Bella");
  await page.fill("#cTel2", "0275-8812345");
  await tocar("#btnCliUsar");
  await page.waitForSelector("#fichaCli");
  assert.match(await page.innerText("#fichaCli"), /0275-8812345/);
  await foto("02c-ficha");
  await revisarDiseno("ficha");
  await tocar("#btnAProductos");
  await esperarRuta("#/nuevo/productos");
  ok("paso 1: cliente nuevo → ficha con lápiz para editar → continuar");

  /* ---------- Paso 2: productos ---------- */
  assert.match(await page.innerText(".cliente-elegido"), /Peluquería Bella/);
  assert.equal(await page.locator(".pcard.elegido").count(), 2);
  await page.waitForFunction(() => /40,00 \$/.test(document.getElementById("nTotal").textContent));
  assert.equal(await page.innerText("#nTotal"), "3 cajas · 40,00 $");
  assert.equal(await page.locator(".pcard").count(), 19);
  assert.equal(await page.innerText('.pcard[data-code="BC-01"] [data-precio]'), "10,00 $ / caja");
  assert.equal(await page.innerText('.pcard[data-code="KT-02"] [data-stock]'), "Hay 6");
  assert.match(await page.innerText("#nNivel"), /faltan 12 cajas para el precio al mayor/);
  await page.click('#nFiltros [data-f="elegidos"]');
  assert.equal(await page.locator(".pcard:not([hidden])").count(), 2);
  await page.click('#nFiltros [data-f="todos"]');
  await page.fill("#nBuscar", "crespo");
  assert.ok((await page.locator(".pcard:not([hidden])").count()) >= 2);
  await page.fill("#nBuscar", "");
  await tocar('.pcard[data-code="BC-06"] .pcard-tap'); // tocar la tarjeta suma una caja
  assert.equal(await page.innerText('.pcard[data-code="BC-06"] .pcard-n'), "1");
  await page.locator('.pcard[data-code="KT-02"] .pcard-tap').click();
  await page.locator('.pcard[data-code="KT-02"] .qty-input').fill("7"); // hay 6
  await page.waitForSelector("#toast:not([hidden])");
  assert.match(await page.innerText("#toast"), /Solo hay 6 cajas de Kit Aguacate/);
  await page.locator('.pcard[data-code="KT-02"] .qty-input').fill("5");
  assert.equal(await page.innerText("#nTotal"), "9 cajas · 152,00 $");
  await foto("02-nuevo");
  await revisarDiseno("productos");
  ok("paso 2: cuadrícula (tocar suma), precio por caja, stock con tope, buscar y filtrar");

  /* ---------- Paso 3: enviar (nota o factura) ---------- */
  await tocar("#nSeguir");
  await esperarRuta("#/nuevo/enviar");
  assert.match(await page.innerText(".total-ped"), /Total: 9 cajas · 18 unidades \+ 36 dúos/);
  await tocar("#btnEnviar");
  assert.match(await page.innerText("#eError"), /nota de entrega o factura/);
  assert.ok(await page.locator("#fsDoc.falta").count());
  await tocar('input[name="eDoc"][value="Factura"]');
  assert.ok(await page.locator("#eRifWrap").isVisible());
  await tocar("#btnEnviar");
  assert.match(await page.innerText("#eError"), /RIF o la cédula/);
  await page.fill("#eRif", "J-12345678-9");
  // Montos según cómo paga: crédito 152 · pronto 137 · efectivo crédito 107 · efectivo pronto 92
  assert.deepEqual(await page.locator("#ePagos .pago-monto strong").allInnerTexts(), ["152,00 $", "137,00 $", "107,00 $", "92,00 $"]);
  await tocar("#btnEnviar");
  assert.match(await page.innerText("#eError"), /forma de pago/);
  await tocar("#eMayor"); // excepción: precio al mayor
  assert.deepEqual(await page.locator("#ePagos .pago-monto strong").allInnerTexts(), ["134,00 $", "119,00 $", "89,00 $", "74,00 $"]);
  assert.match(await page.innerText("#eNivel"), /mayor por excepción/);
  await tocar("#eMayor");
  await tocar('input[name="ePago"][value="credito"]');
  assert.match(await page.innerText("#eItems"), /2 × Babosa[\s\S]*10,00 \$ c\/u · 20,00 \$/);
  assert.ok(await page.locator("#eCredito").isVisible());
  await tocar("#btnEnviar");
  assert.match(await page.innerText("#eError"), /días de crédito/);
  await tocar('#eCredito [data-dias="15"]');
  assert.equal(await page.inputValue("#eDias"), "15");
  await foto("03-enviar");
  await revisarDiseno("enviar");
  await tocar("#btnEnviar");
  await esperarRuta("#/nuevo/listo");
  assert.match(await page.innerText(".listo h2"), /^Pedido SKL-\d{6}-001 guardado$/);
  const msg = await page.inputValue("#lMensaje");
  assert.match(msg, /• 2 × Babosa \(BC-01\) = 12 unidades/);
  assert.match(msg, /• 5 × Kit Aguacate \(KT-02\) = 30 dúos/);
  assert.match(msg, /\*Monto: 152,00 \$\* · precio al por menor/);
  assert.match(msg, /Pago: Crédito \(15 días\)\nDocumento: Factura/);
  assert.equal(gas.tabla("Pedidos")[0].total, 152);
  assert.equal(gas.tabla("Pedidos")[0].tipo_pago, "credito");
  assert.match(msg, /RIF: J-12345678-9/);
  await page.click("#btnGrupo");
  assert.deepEqual(await page.evaluate(() => window.__compartido), [msg]);
  assert.match(await page.getAttribute("#btnCopia", "href"), /^https:\/\/wa\.me\/584121234567/);
  assert.equal(gas.tabla("Pedidos").length, 1);
  assert.equal(gas.tabla("PedidoItems").length, 4);
  assert.ok(await page.locator(".app-nav .badge").count() === 0);
  await foto("04-listo");
  assert.equal(gas.tabla("Pedidos")[0].documento, "Factura");
  assert.equal(gas.tabla("Pedidos")[0].dias_credito, 15);
  assert.equal(gas.tabla("Clientes")[0].rif_cedula, "J-12345678-9");
  ok("paso 3: nota o factura (factura pide RIF) y días de crédito obligatorios → Sheets → grupo");

  /* ---------- Inicio, pedidos, detalle ---------- */
  await page.click('.app-nav a[href="#/inicio"]');
  await esperarRuta("#/inicio");
  assert.ok(await page.locator("#vista.entra").count(), "sin transición al cambiar de página");
  await page.waitForSelector("#iLista .fila-ped");
  // pedidos hoy · cajas hoy · en proceso · en despacho · crédito vencido · por cobrar
  assert.deepEqual(await page.locator("#iStats .stat strong").allInnerTexts(), ["1", "9", "1", "0", "0", "1"]);
  await foto("05-inicio");
  await revisarDiseno("inicio");
  await page.click('.app-nav a[href="#/pedidos"]');
  await esperarRuta("#/pedidos");
  await page.click('.tabs-ped [data-vista="curso"]');
  await esperarRuta("#/pedidos?tab=curso");
  await page.click("#pLista .fila-ped");
  await esperarRuta("#/pedido/");
  assert.match(await titulo(), /^SKL-\d{6}-001$/);
  assert.deepEqual(await page.locator(".acciones-ped .btn").allInnerTexts(), ["Anular pedido"]);
  assert.equal(await page.innerText(".chip-estado"), "En proceso");
  assert.match(await page.innerText(".historial"), /Enviado \(en proceso\) · Óscar \(Vendedor\)/);
  await revisarDiseno("detalle");
  await page.click("#btnAtras");
  await esperarRuta("#/pedidos");
  ok("inicio con cifras de hoy, lista de pedidos, detalle con historial y botón atrás");
  // El logo de arriba lleva a la página de productos (la que ven los clientes)
  await page.click("#lnkCatalogo");
  await page.waitForURL(/index\.html$/);
  await page.waitForSelector("#gridBanos .card");
  assert.equal(await page.innerText("#btnCuenta"), "Óscar"); // sigue con la sesión
  await page.goto(BASE + "/panel.html#/pedidos");
  await esperarRuta("#/pedidos");
  ok("logo de arriba → página de productos de los clientes");

  // Pedidos: 4 pestañas con contadores, buscador y lista por día
  await page.click('.app-nav a[href="#/pedidos"]');
  await esperarRuta("#/pedidos");
  assert.deepEqual(await page.locator(".tabs-ped .tab").evaluateAll((els) => els.map((e) => e.firstChild.textContent.trim())), ["Por hacer", "En curso", "Cobros", "Historial"]);
  assert.match(await page.innerText("#pLista"), /Nada pendiente por ahora/); // el vendedor no tiene nada urgente
  await page.click('.tabs-ped [data-vista="curso"]');
  await esperarRuta("#/pedidos?tab=curso");
  assert.equal(await page.innerText('[data-cuenta="curso"]'), "1");
  assert.equal(await page.innerText("#pLista .grupo-tit"), "HOY");
  assert.match(await page.innerText("#pLista .fila-monto"), /152,00 \$/);
  await page.fill("#pBuscar", "nada que ver");
  await page.waitForFunction(() => /Nada con ese filtro/.test(document.getElementById("pLista").textContent));
  await page.fill("#pBuscar", "1234567"); // por teléfono
  await page.waitForSelector("#pLista .fila-ped");
  await page.fill("#pBuscar", "");
  await page.waitForSelector("#pLista .fila-ped");
  await foto("05b-pedidos");
  await revisarDiseno("pedidos 4 pestañas");
  // abrir un pedido es inmediato (ya está en la lista) y el historial llega después
  retraso = 1500;
  await page.click("#pLista .fila-ped");
  await page.waitForFunction(() => /^SKL-/.test(document.getElementById("appTitulo").textContent) && !!document.querySelector(".acciones-ped"));
  assert.ok(await page.locator("text=Cargando historial").count(), "el detalle esperó al servidor");
  retraso = 0;
  await esperarRuta("#/pedido/");
  await page.waitForSelector(".historial");
  await page.click("#btnAtras");
  await esperarRuta("#/pedidos");
  ok("pedidos: 4 pestañas con contadores, buscador, lista por día y detalle al instante");

  /* ---------- Clientes ---------- */
  await page.click('.app-nav a[href="#/clientes"]');
  await esperarRuta("#/clientes");
  await page.waitForSelector("#kLista a");
  await page.click("#kLista a");
  await esperarRuta("#/cliente/");
  assert.equal(await titulo(), "Peluquería Bella");
  await page.waitForSelector("#kPedidos .fila-ped");
  assert.equal(await page.locator('.botones-contacto a[href^="tel:"]').count(), 2); // tel. 1 y 2
  await foto("06-cliente");
  await revisarDiseno("ficha cliente");
  await page.click("#btnPedirCliente");
  await esperarRuta("#/nuevo/productos");
  assert.match(await page.innerText(".cliente-elegido"), /Peluquería Bella/);
  await tocar('.pcard[data-code="BC-03"] .pcard-tap');
  ok("clientes: lista, ficha con historial y nuevo pedido con el cliente ya elegido");

  /* ---------- Añadir cliente (traspaso de la base, sin pedido) ---------- */
  await page.goto(BASE + "/panel.html#/clientes");
  await esperarRuta("#/clientes");
  await page.click("#btnAnadirCliente");
  await esperarRuta("#/cliente/nuevo");
  assert.equal(await titulo(), "Añadir cliente");
  await page.click("#fnGuardar");
  assert.match(await page.innerText("#fnError"), /Nombre del cliente o del negocio/);
  await page.fill("#fnNegocio", "Salón Luz");
  await page.fill("#fnContacto", "Luz Marina");
  await page.fill("#fnPegar", "https://maps.app.goo.gl/xyz");
  assert.match(await page.innerText("#fnGpsEstado"), /enlace corto/);
  await page.fill("#fnPegar", "https://www.google.com/maps/place/Luz/@8.6201,-71.6502,17z");
  assert.match(await page.innerText("#fnGpsEstado"), /Ubicación lista \(8\.6201, -71\.6502\)/);
  await foto("06b-anadir-cliente");
  await revisarDiseno("añadir cliente");
  await page.click("#fnOtro");
  await page.waitForFunction(() => document.getElementById("fnNegocio") && document.getElementById("fnNegocio").value === "");
  await page.fill("#fnNegocio", "Barbería Max");
  await page.fill("#fnTel1", "0416-5550000");
  await page.click("#fnGuardar");
  await esperarTitulo("Barbería Max");
  await page.waitForSelector("#kPedidos .vacio-panel");
  assert.match(await page.innerText("#kPedidos"), /Todavía no tiene pedidos/);
  const luz = gas.tabla("Clientes").find((c) => c.nombre === "Salón Luz");
  assert.equal(luz.latitud, 8.6201);
  assert.equal(luz.telefono, "");
  // editar: corregir dirección
  await page.click("#btnEditarCliente");
  await esperarTitulo("Editar cliente");
  await page.fill("#fnDireccion", "Calle 5, El Vigía");
  await page.click("#fnGuardar");
  await page.waitForFunction(() => /Calle 5/.test(document.querySelector(".datos")?.textContent || ""));
  assert.equal(gas.tabla("Clientes").length, 3);
  ok("añadir cliente sin pedido (ubicación pegada, guardar y añadir otro) y editar");

  /* ---------- Paso 1: buscar cliente existente y editar con el lápiz ---------- */
  await page.goto(BASE + "/panel.html#/nuevo");
  await esperarRuta("#/nuevo");
  await page.waitForSelector("#fichaCli");                   // el pedido a medio armar recuerda el cliente
  await page.click("#btnCambiarCli");
  retraso = 1200; // señal lenta: el ícono girando y la barrita avisan que está cargando
  await page.fill("#cBuscar", "max");
  await page.waitForSelector("#cResultados .spinner");
  await page.waitForSelector("#barraCarga:not([hidden])");
  assert.match(await page.innerText("#cResultados"), /Buscando cliente/);
  await page.waitForSelector("#cResultados .res-cli");
  retraso = 0;
  await page.waitForSelector("#barraCarga", { state: "hidden" });
  await page.click("#cResultados .res-cli");
  await page.waitForSelector("#fichaCli");
  assert.match(await page.innerText("#fichaCli"), /Barbería Max/);
  assert.ok(await page.locator("#btnGpsFicha").isVisible());  // sin ubicación: se puede tomar ahí mismo
  await page.click("#btnLapiz");
  await page.fill("#cDireccion", "Av. 15, El Vigía");
  await tocar("#btnCliUsar");
  await page.waitForSelector("#fichaCli");
  assert.equal(gas.tabla("Clientes").find((c) => c.nombre === "Barbería Max").direccion, "Av. 15, El Vigía");
  await page.click("#btnCambiarCli");
  await page.fill("#cBuscar", "bella");
  await page.waitForSelector("#cResultados .res-cli");
  await page.click("#cResultados .res-cli");
  await page.waitForSelector("#fichaCli");
  await tocar("#btnAProductos");
  await esperarRuta("#/nuevo/productos");
  assert.equal(await page.innerText("#nTotal"), "1 caja");
  await tocar("#nSeguir");
  await esperarRuta("#/nuevo/enviar");
  await tocar('input[name="eDoc"][value="Nota de entrega"]');
  assert.ok(await page.locator("#eRifWrap").isHidden());
  ok("paso 1: buscar cliente existente, lápiz guarda los cambios en la hoja, cambiar cliente");

  /* ---------- Sin señal ---------- */
  await tocar('input[name="ePago"][value="pronto"]');
  await page.evaluate(() => SkalaAPI.sincronizar()); // copia de los datos en el teléfono
  assert.equal(await page.evaluate(() => SkalaAPI.datosLocales().pedidos.length), 1);
  sinSenal = true;
  await tocar("#btnEnviar");
  await esperarRuta("#/nuevo/listo");
  assert.match(await page.innerText(".listo h2"), /Guardado en el teléfono/);
  await page.click('.app-nav a[href="#/inicio"]');
  await page.waitForSelector("#pendSubir:not([hidden])");
  await page.goto(BASE + "/panel.html#/pedidos?tab=curso");
  await esperarRuta("#/pedidos");
  assert.match(await page.innerText("#modoLocal"), /Sin señal · mostrando los datos guardados/);
  assert.equal(await page.locator("#pLista .fila-ped").count(), 1); // de la copia del teléfono
  await page.click("#pLista .fila-ped");
  await esperarRuta("#/pedido/");
  assert.match(await titulo(), /^SKL-\d{6}-001$/);
  sinSenal = false;
  await page.click("#btnSubirPend");
  await page.waitForSelector("#pendSubir", { state: "hidden" });
  assert.equal(gas.tabla("Pedidos").length, 2);
  await page.goto(BASE + "/panel.html#/mas");
  await esperarRuta("#/mas");
  assert.ok(await page.locator("#modoLocal").isHidden());
  assert.match(await page.innerText("#datosEstado"), /Actualizados hoy/);
  await page.click("#btnSync");
  await page.waitForFunction(() => /2 pedidos/.test(document.getElementById("datosEstado").textContent));
  ok("sin señal: muestra los datos guardados; el pedido queda en el teléfono y se sube; Actualizar ahora");
  await salir();

  /* ---------- Administración ---------- */
  await ingresar("ana", "Ana*2222");
  await esperarRuta("#/inicio");
  await page.waitForSelector("#iLista .fila-ped");
  assert.equal(await page.locator("#iLista .fila-ped").count(), 2);
  await page.locator("#iLista .fila-ped").last().click();
  await esperarRuta("#/pedido/");
  assert.deepEqual(await page.locator(".acciones-ped .btn").allInnerTexts(), ["Aprobar", "Anular pedido"]);
  await page.click('[data-acc="confirmar"]');
  await page.waitForSelector("#hoja:not([hidden])");
  await page.click("#hojaOk");
  assert.match(await page.innerText("#hojaError"), /Elegí un despachador/);
  await page.selectOption("#hDesp", { label: "Luis" });
  await foto("07-confirmar");
  await page.click("#hojaOk");
  await page.waitForFunction(() => /Aprobado · Preparando despacho/.test(document.querySelector(".chip-estado")?.textContent || ""));
  assert.match(await page.innerText(".datos"), /Despachador\s+Luis/);
  assert.equal(gas.tabla("Pedidos")[0].estado, "confirmado");
  ok("administración aprueba (Aprobado · Preparando despacho) y asigna despachador");
  await page.goto(BASE + "/panel.html#/inventario");
  await esperarRuta("#/inventario");
  const kt = '.inv-fila[data-code="KT-02"]';
  assert.match(await page.innerText(kt + " .inv-stock"), /^1\s+disponibles/); // 6 − 5 aprobadas
  assert.match(await page.innerText('.inv-fila[data-code="BC-09"] .inv-stock'), /Sin cargar/);
  await page.click(kt + ' [data-inv="entrada"]');
  await page.click("#hojaOk");
  assert.match(await page.innerText("#hojaError"), /cantidad/);
  await page.fill("#hCajas", "10");
  await page.click("#hojaOk");
  await page.waitForFunction((s) => /^11/.test(document.querySelector(s + " .inv-stock")?.textContent || ""), kt);
  await page.click('.inv-fila[data-code="BC-09"] [data-inv="precio"]');
  await page.fill('#hoja input[name="menor"]', "9,5");
  await page.fill('#hoja input[name="mayor"]', "10");
  await page.click("#hojaOk");
  assert.match(await page.innerText("#hojaError"), /mayor no puede/);
  await page.fill('#hoja input[name="mayor"]', "8");
  await page.click("#hojaOk");
  await page.waitForFunction(() => /Menor 9,50 \$ · Mayor 8,00 \$/.test(document.querySelector('.inv-fila[data-code="BC-09"]')?.textContent || ""));
  assert.equal(gas.tabla("Precios").find((x) => x.code === "BC-09").menor, 9.5);
  await foto("07a-inventario");
  await revisarDiseno("inventario");
  ok("inventario: disponible = cargado − aprobado; entrada de mercancía y precios desde el panel");
  await salir();

  /* ---------- Despachador ---------- */
  await ingresar("luis", "Luis5555");
  await esperarRuta("#/inicio");
  assert.deepEqual(await page.locator(".app-nav a span").allInnerTexts(), ["Inicio", "Entregas"]);
  await page.waitForSelector("#iLista .fila-ped");
  assert.match(await page.innerText("#iLista"), /Av\. Bolívar/);
  assert.match(await page.innerText(".carga-hoy"), /Hoy tenés por entregar\s+9 cajas/);
  await foto("07b-inicio-despachador");
  await page.click('.app-nav a[href="#/entregas"]');
  await esperarRuta("#/entregas");
  assert.ok(await page.locator("#pBarra").isHidden());
  await page.check("#pTodos");
  assert.match(await page.innerText("#pBarra"), /1 pedido · 9 cajas/);
  await foto("07c-elegir-carga");
  await revisarDiseno("entregas con selección");
  await page.click("#btnVerCarga");
  await esperarRuta("#/carga");
  assert.match(await page.innerText(".carga-total"), /9\s+cajas/);
  assert.deepEqual((await page.locator(".lista-carga li").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim().split(" · ")[0]),
    ["5 × Kit Aguacate KT-02", "2 × Babosa BC-01", "1 × Mais Cachos BC-06", "1 × Kit 12 em 1 KT-01"]);
  await page.locator(".lista-carga input").first().check();
  await page.click("#btnCompartirCarga");
  assert.match((await page.evaluate(() => window.__compartido)).at(-1), /\*CARGA LUIS\* · 1 pedido\(s\) · 9 cajas[\s\S]*• 5 × Kit Aguacate/);
  await foto("07d-carga");
  await revisarDiseno("total de carga");
  ok("despachador: hoy tenés N cajas, elegir pedidos → total de carga por producto y compartir");
  await page.click("#btnAtras");
  await esperarRuta("#/entregas");
  await page.click("#pLista .fila-ped");
  await esperarRuta("#/pedido/");
  assert.deepEqual(await page.locator(".acciones-ped .btn").allInnerTexts(), ["Salió en ruta", "Entregado"]);
  assert.ok(await page.locator('.botones-contacto a:has-text("Mapa")').count());
  await foto("08-entrega");
  await page.click('[data-acc="en_ruta"]');
  await page.waitForFunction(() => /En ruta/.test(document.querySelector(".chip-estado")?.textContent || ""));
  await page.click('[data-acc="entregado"]');
  await page.click("#hojaOk");
  await page.waitForFunction(() => /Entregado/.test(document.querySelector(".chip-estado")?.textContent || ""));
  assert.equal(gas.tabla("Pedidos")[0].entregado_por, "Luis");
  // un despachador no puede entrar a Nuevo pedido
  await page.goto(BASE + "/panel.html#/nuevo");
  await esperarRuta("#/inicio");
  ok("despachador: entregas con mapa, en ruta → entregado; Nuevo pedido bloqueado");
  await salir();

  /* ---------- Crédito y cobro: banderas, cancelado (vendedor) → conciliado (Administración) ---------- */
  const fijarEntrega = (diasAtras) => {
    const h = gas.hojas.Pedidos, cab = h.filas[0].map((c) => String(c).replace(/^'/, ""));
    h.filas[1][cab.indexOf("entregado_at")] = "'" + new Date(Date.now() - diasAtras * 86400000).toISOString();
  };
  await ingresar("oscar", "Oscar.1234");
  await esperarRuta("#/inicio");
  await page.goto(BASE + "/panel.html#/pedidos?tab=cobrar");
  await esperarRuta("#/pedidos");
  assert.match(await page.innerText("#pLista .bandera"), /Vence en 15 días/);
  assert.ok(await page.locator("#pLista .b-al_dia").count());
  fijarEntrega(13); await page.reload(); await esperarRuta("#/pedidos");
  assert.match(await page.innerText("#pLista .bandera"), /Vence en 2 días/);
  assert.ok(await page.locator("#pLista .b-proximo").count());
  fijarEntrega(20); await page.reload(); await esperarRuta("#/pedidos");
  assert.match(await page.innerText("#pLista .bandera"), /Vencido hace 5 días/);
  assert.ok(await page.locator("#pLista .b-vencido").count());
  fijarEntrega(40); await page.reload(); await esperarRuta("#/pedidos");
  assert.match(await page.innerText("#pLista .bandera"), /Vencido hace 25 días/);
  assert.ok(await page.locator("#pLista .b-muy_vencido").count());
  assert.match(await page.innerText("#pInfo"), /1 vencido/);
  await foto("09a-por-cobrar");
  await page.goto(BASE + "/panel.html#/inicio");
  await esperarRuta("#/inicio");
  assert.ok(await page.locator(".stat-alerta").count());
  await page.goto(BASE + "/panel.html#/pedidos?tab=cobrar");
  await esperarRuta("#/pedidos");
  await page.click("#pLista .fila-ped");
  await esperarRuta("#/pedido/");
  assert.deepEqual(await page.locator(".acciones-ped .btn").allInnerTexts(), ["Marcar cancelado (pagado)"]);
  await page.click('[data-acc="cobrar"]');
  await page.waitForSelector("#hMonto");
  assert.equal(await page.locator('#hoja input[name="moneda"][value="USD"]').isChecked(), true);
  assert.equal(await page.locator('#hoja input[name="tipo_pago_real"][value="credito"]').isChecked(), true); // lo acordado
  assert.equal(await page.inputValue("#hMonto"), "152");
  await page.click('#hoja input[name="tipo_pago_real"][value="efectivo_pronto"]'); // pagó en efectivo antes del plazo
  assert.equal(await page.inputValue("#hMonto"), "92");
  assert.ok(await page.locator("#hProntoAviso").isVisible()); // la entrega fue hace 40 días
  await foto("09b-forma-pago");
  await page.fill("#hMonto", "");
  await page.click("#hojaOk");
  assert.match(await page.innerText("#hojaError"), /monto/);
  await page.fill("#hMonto", "1.120,50");
  await foto("09b-monto");
  await page.click("#hojaOk");
  await page.waitForFunction(() => /Cancelado · por conciliar/.test(document.querySelector(".bandera")?.textContent || ""));
  assert.equal(await page.locator(".acciones-ped .btn").count(), 0);
  assert.equal(gas.tabla("Pedidos")[0].cobro, "cancelado");
  assert.equal(Number(gas.tabla("Pedidos")[0].monto), 1120.5);
  assert.equal(gas.tabla("Pedidos")[0].moneda, "USD");
  assert.equal(gas.tabla("Pedidos")[0].tipo_pago_real, "efectivo_pronto");
  assert.equal(gas.tabla("Pedidos")[0].total_final, 92);
  assert.match(await page.innerText("#dMontoReal"), /Pagó como Efectivo pronto pago: 92,00 \$/);
  assert.match(await page.innerText(".datos"), /USD 1\.120,50/);
  await foto("09b-cancelado");
  await salir();
  ok("crédito: bandera verde → amarilla → roja → morada; el vendedor marca Cancelado (pagado)");

  await ingresar("ana", "Ana*2222");
  await esperarRuta("#/inicio");
  await page.goto(BASE + "/panel.html#/pedidos?tab=conciliar");
  await esperarRuta("#/pedidos");
  await page.click("#pLista .fila-ped");
  await esperarRuta("#/pedido/");
  assert.deepEqual(await page.locator(".acciones-ped .btn").allInnerTexts(), ["Conciliar pago (recibido)", "Pago no recibido"]);
  await page.click('[data-acc="conciliar"]');
  await page.waitForSelector("#hMonto");
  assert.equal(await page.inputValue("#hMonto"), "1120,5"); // trae lo que reportó el vendedor
  assert.match(await page.innerText("#hojaCuerpo"), /Reportado: USD 1\.120,50 por Óscar/);
  await page.fill("#hMonto", "1100");
  await page.click("#hojaOk");
  await page.waitForFunction(() => /Conciliado/.test(document.querySelector(".bandera")?.textContent || ""));
  assert.equal(gas.tabla("Pedidos")[0].cobro, "conciliado");
  assert.equal(Number(gas.tabla("Pedidos")[0].monto), 1100);
  assert.match(await page.innerText(".historial"), /Cancelado \(pago reportado\) · Óscar[\s\S]*Pago conciliado · Ana/);
  await foto("09c-conciliado");
  await revisarDiseno("detalle conciliado");
  // Conciliados: totales del período
  await page.goto(BASE + "/panel.html#/pedidos?tab=conciliados");
  await esperarRuta("#/pedidos");
  await page.waitForSelector("#concTotal");
  assert.equal(await page.innerText("#concUSD"), "USD 1.100,00");
  assert.equal(await page.innerText("#concBs"), "Bs 0,00");
  assert.match(await page.innerText("#concCuenta"), /1 pedido · \d+ cajas?/);
  assert.match(await page.innerText("#vista"), /Por vendedor[\s\S]*Óscar[\s\S]*Por método de pago/);
  assert.equal(await page.locator("#pLista .fila-ped").count(), 1);
  assert.equal(await page.locator("#pPeriodo .tab.active").innerText(), "30 días");
  assert.equal(await page.locator("#pVer .tab.active").innerText(), "Conciliados");
  await foto("09d-conciliados");
  await revisarDiseno("conciliados");
  await page.click('#pPeriodo a[href$="dias=1"]');
  await page.waitForFunction(() => document.querySelector("#pPeriodo .tab.active")?.textContent === "Hoy" && document.body.dataset.lista);
  assert.equal(await page.innerText("#concUSD"), "USD 1.100,00"); // se concilió hoy
  await salir();
  ok("administración verifica el pago y lo marca Conciliado");

  /* ---------- Pedido web: lo arma el cliente, lo toma su vendedor ---------- */
  const oscarId = gas.tabla("Usuarios").find((u) => u.usuario === "oscar").id;
  const pw = gas.post({ action: "pedidoWeb", ref: "WEB-TEST01", vendedor_id: oscarId, tipo_pago: "pronto",
    cliente: { negocio: "Salón Luz", contacto: "Luz", telefono: "0414-5551234", direccion: "Centro" },
    items: [{ code: "BC-01", producto: "Babosa", cajas: 4, unidades_caja: 6, unidad: "unidades" }] });
  assert.equal(pw.ok, true);
  await ingresar("ana", "Ana*2222");
  await esperarRuta("#/inicio");
  await page.waitForSelector("#iWeb");
  assert.match(await page.innerText("#iWeb"), /1 pedido web/);
  await page.click("#iWeb");
  await esperarRuta("#/pedidos?tab=hacer");
  await page.click("#pLista .fila-web");
  await esperarRuta("#/web/");
  assert.equal(await page.locator("#btnTomarWeb").count(), 0); // Administración lo ve, no lo toma
  assert.match(await page.innerText("#vista"), /Esperando a que Óscar lo tome/);
  await salir();
  await ingresar("oscar", "Oscar.1234");
  await esperarRuta("#/inicio");
  await page.waitForSelector("#iWeb");
  await page.click("#iWeb");
  await esperarRuta("#/pedidos?tab=hacer");
  await page.click("#pLista .fila-web");
  await esperarRuta("#/web/");
  assert.match(await page.innerText(".monto-ped"), /36,00 \$ · Pronto pago/); // 4 × (10 − 1)
  await foto("09e-pedido-web");
  await revisarDiseno("pedido web");
  await page.click("#btnTomarWeb");
  await esperarRuta("#/nuevo");
  await page.waitForSelector("#avisoWeb");
  assert.match(await page.innerText("#fichaCli"), /Salón Luz/);
  await tocar("#btnAProductos");
  await esperarRuta("#/nuevo/productos");
  assert.match(await page.innerText("#nTotal"), /^4 cajas/);
  await tocar('.pcard[data-code="BC-01"] .pcard-tap'); // el vendedor lo edita: 5 cajas
  await tocar("#nSeguir");
  await esperarRuta("#/nuevo/enviar");
  assert.equal(await page.locator('input[name="ePago"][value="pronto"]').isChecked(), true);
  await tocar('input[name="eDoc"][value="Nota de entrega"]');
  await tocar("#btnEnviar");
  await esperarRuta("#/nuevo/listo");
  const w = gas.tabla("PedidosWeb")[0];
  assert.equal(w.estado, "tomado");
  const tomado = gas.tabla("Pedidos").find((p) => p.web_id === "WEB-TEST01");
  assert.equal(tomado.total_cajas, 5); assert.equal(tomado.estado, "pendiente"); assert.equal(tomado.total, 45);
  ok("pedido web: Administración lo ve sin tomarlo; su vendedor lo toma, lo edita y lo envía");

  // Borrar un pedido de prueba (el vendedor, los suyos)
  await page.goto(BASE + "/panel.html#/pedido/" + tomado.id);
  await esperarRuta("#/pedido/");
  await tocar("#btnBorrarPed");
  await page.click("#hojaOk");
  assert.match(await page.innerText("#hojaError"), /motivo/);
  await page.fill('#hoja textarea[name="motivo"]', "Era de prueba");
  await page.click("#hojaOk");
  await esperarRuta("#/pedidos");
  assert.equal(gas.tabla("Pedidos").find((p) => p.id === tomado.id).borrado, true);
  ok("borrar pedido: con motivo; sale de las listas y queda en la hoja");
  await salir();

  /* ---------- Master ---------- */
  await ingresar("jose", "Skala#2026");
  await esperarRuta("#/inicio");
  await page.click("#btnMas");
  await esperarRuta("#/mas");
  assert.deepEqual(await page.locator(".menu-mas strong").allInnerTexts(), ["Resumen", "Inventario y precios", "Usuarios", "Ver catálogo"]);
  await page.click('.menu-mas a[href="#/resumen"]');
  await esperarRuta("#/resumen");
  await page.waitForSelector(".stats .stat");
  assert.deepEqual(await page.locator(".stats .stat strong").allInnerTexts(), ["2", "10", "1", "1"]);
  await foto("09-resumen");
  await page.goto(BASE + "/panel.html#/usuarios");
  await esperarRuta("#/usuarios");
  assert.equal(await page.locator(".usuarios-lista li").count(), 4);
  await page.click('a[href="#/usuario/nuevo"]');
  await esperarRuta("#/usuario/nuevo");
  await page.fill("#uUsuario", "kevin");
  await page.fill("#uNombre", "Kevin");
  await page.uncheck('input[name="uRol"][value="vendedor"]');
  await page.click("#btnGuardarUsuario");
  assert.match(await page.innerText("#uError"), /al menos un rol/);
  await page.check('input[name="uRol"][value="vendedor"]');
  await page.check('input[name="uRol"][value="despachador"]'); // varios roles
  await page.fill("#uClave", "123456");
  await page.click("#btnGuardarUsuario");
  await page.waitForFunction(() => /letras y números/.test(document.getElementById("uError").textContent));
  await page.fill("#uClave", "Kevin#9876");
  await page.click("#btnGuardarUsuario");
  await esperarRuta("#/usuarios");
  await page.waitForFunction(() => document.querySelectorAll(".usuarios-lista li").length === 5);
  assert.match(await page.innerText(".usuarios-lista"), /Kevin[\s\S]*Vendedor · Despachador/);
  assert.equal(gas.tabla("Usuarios").find((u) => u.usuario === "kevin").rol, "vendedor, despachador");
  await foto("10-usuarios");
  await revisarDiseno("usuarios");
  ok("master: Más → Resumen y Usuarios (crear con validación de clave)");

  await page.goto(BASE + "/panel.html#/pedidos?tab=entregado");
  await esperarRuta("#/pedidos");
  await page.click("#pLista .fila-ped");
  await esperarRuta("#/pedido/");
  assert.deepEqual(await page.locator(".acciones-ped .btn").allInnerTexts(), ["Deshacer conciliación"]);
  await page.click('[data-acc="desconciliar"]');
  await page.click("#hojaOk");
  await page.waitForSelector('[data-acc="rechazar"]');
  await page.click('[data-acc="rechazar"]');
  await page.click("#hojaOk");
  assert.match(await page.innerText("#hojaError"), /motivo/);
  await page.fill('#hoja textarea[name="motivo"]', "No llegó la transferencia");
  await page.click("#hojaOk");
  await page.waitForSelector('[data-acc="reabrir"]');
  assert.equal(gas.tabla("Pedidos")[0].cobro, "");
  await page.click('[data-acc="reabrir"]');
  await page.click("#hojaOk");
  await page.waitForFunction(() => /En proceso/.test(document.querySelector(".chip-estado")?.textContent || ""));
  await page.click('[data-acc="cancelar"]');
  await page.click("#hojaOk");
  assert.match(await page.innerText("#hojaError"), /motivo/);
  await page.fill('#hoja textarea[name="motivo"]', "Cliente cerró el local");
  await page.click("#hojaOk");
  await page.waitForFunction(() => /Anulado/.test(document.querySelector(".chip-estado")?.textContent || ""));
  assert.match(await page.innerText(".historial"), /Vuelto a En proceso[\s\S]*Anulado/);
  ok("master: vuelve a En proceso y anula con motivo; queda en el historial");

  /* ---------- Usuario con varios roles: ve y hace todo lo de cada uno ---------- */
  await salir();
  await ingresar("kevin", "Kevin#9876");
  await esperarRuta("#/inicio");
  assert.deepEqual(await page.locator(".app-nav a span").allInnerTexts(), ["Inicio", "Nuevo", "Pedidos", "Clientes", "Entregas"]);
  assert.match(await page.innerText("#appQuien"), /Kevin · Vendedor · Despachador/);
  assert.deepEqual(await page.locator(".accesos .acceso span").allInnerTexts(), ["Nuevo pedido", "Pedidos", "Clientes", "Mis entregas"]);
  await page.click('.app-nav a[href="#/entregas"]');
  await esperarRuta("#/entregas");
  assert.equal(await titulo(), "Mis entregas");
  await page.click('.app-nav a[href="#/nuevo"]');
  await esperarRuta("#/nuevo");
  await page.waitForSelector("#btnClienteNuevo");
  await revisarDiseno("varios roles");
  ok("varios roles: Kevin (Vendedor + Despachador) tiene Nuevo, Pedidos, Clientes y Entregas");
  await salir();
  await ingresar("jose", "Skala#2026");
  await esperarRuta("#/inicio");

  /* ---------- Tema oscuro ---------- */
  const contraste = () => page.evaluate(() => {
    const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const fondo = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || (c[3] ?? 1) > 0.5) return c.slice(0, 3); } return [255, 255, 255]; };
    const malos = [];
    document.querySelectorAll("#vista *, .app-bar *, .app-nav *").forEach((el) => {
      if (!el.offsetParent || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
      const L1 = lum(rgb(getComputedStyle(el).color).slice(0, 3)), L2 = lum(fondo(el));
      const r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      if (r < 4.5) malos.push(el.textContent.trim().slice(0, 25) + " " + r.toFixed(1));
    });
    return malos;
  });
  await page.goto(BASE + "/panel.html#/mas");
  await esperarRuta("#/mas");
  await page.click('.selector-tema [data-tema="oscuro"]');
  assert.equal(await page.getAttribute("html", "data-tema"), "oscuro");
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(23, 22, 20)");
  assert.equal(await page.getAttribute('meta[name="theme-color"]', "content"), "#171614");
  for (const [h, n] of [["#/inicio", "11-oscuro-inicio"], ["#/nuevo", "12-oscuro-nuevo"], ["#/pedidos?tab=cancelado", "13-oscuro-pedidos"], ["#/mas", "14-oscuro-mas"]]) {
    await page.goto(BASE + "/panel.html" + h);
    await esperarRuta(h.split("?")[0]);
    await foto(n);
    assert.deepEqual(await contraste(), [], `${h}: poco contraste en tema oscuro`);
  }
  await page.goto(BASE + "/panel.html#/pedidos?tab=cancelado");
  await esperarRuta("#/pedidos");
  await page.click("#pLista .fila-ped");
  await esperarRuta("#/pedido/");
  await foto("15-oscuro-detalle");
  assert.deepEqual(await contraste(), [], "detalle: poco contraste en tema oscuro");
  // se recuerda al volver a abrir; el catálogo también lo usa
  await page.goto(BASE + "/index.html");
  await page.waitForSelector(".card");
  assert.equal(await page.getAttribute("html", "data-tema"), "oscuro");
  assert.equal(await page.innerText("#btnTema"), "Tema claro");
  await page.evaluate(() => window.scrollTo(0, 0));
  await foto("16-oscuro-catalogo");
  await page.click("#btnTema");
  assert.equal(await page.getAttribute("html", "data-tema"), "claro");
  // en claro también se revisa el contraste de una página del panel
  await page.goto(BASE + "/panel.html#/inicio");
  await esperarRuta("#/inicio");
  assert.deepEqual(await contraste(), [], "inicio: poco contraste en tema claro");
  ok("tema oscuro: se elige en Más, se recuerda, aplica al catálogo y el texto se lee bien");

  /* ---------- Instalable ---------- */
  const pwa = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const m = await (await fetch(document.querySelector('link[rel="manifest"]').href)).json();
    return { sw: !!reg, nombre: m.name, start: m.start_url, display: m.display, iconos: m.icons.map((i) => i.sizes) };
  });
  assert.equal(pwa.sw, true);
  assert.deepEqual(pwa, { sw: true, nombre: "Skala Equipo", start: "panel.html#/inicio", display: "standalone", iconos: ["192x192", "512x512", "512x512"] });
  ok("instalable: manifest (ícono, pantalla completa) y service worker activo");

  assert.deepEqual(errores, [], errores.join(" | "));
  await browser.close();
  srv.close();
  console.log("E2E PANEL OK");
})().catch((e) => { console.error("✘", e.message); process.exit(1); });
