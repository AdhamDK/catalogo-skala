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

  const srv = await servidor();
  const BASE = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    geolocation: { latitude: 8.6123456, longitude: -71.6543219, accuracy: 12 }, permissions: ["geolocation"],
  });
  let sinSenal = false;
  await ctx.route(API, async (route) => {
    if (sinSenal) return route.abort("internetdisconnected");
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
  const esperarRuta = (h) => page.waitForFunction((h) => (document.body.dataset.lista || "").startsWith(h), h);
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
  await tocar('.qty-btn[data-act="plus"][data-code="BC-01"]');
  await tocar('.qty-btn[data-act="plus"][data-code="BC-01"]');
  await tocar('.qty-btn[data-act="plus"][data-code="KT-01"]');
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
  assert.equal(await page.locator(".prod.elegido").count(), 2);
  assert.equal(await page.innerText("#nTotal"), "3 cajas");
  assert.deepEqual(await page.locator(".app-nav a span").allInnerTexts(), ["Inicio", "Nuevo", "Pedidos", "Clientes", "Más"]);
  assert.equal(await page.innerText(".app-nav .badge"), "3");
  ok("login (error y acierto, ver clave) y vuelve a Nuevo pedido con el carrito del catálogo");

  /* ---------- Nuevo pedido: lista rápida ---------- */
  assert.equal(await page.locator(".prod").count(), 19);
  await page.click('#nFiltros [data-f="elegidos"]');
  assert.equal(await page.locator(".prod:not([hidden])").count(), 2);
  await page.click('#nFiltros [data-f="todos"]');
  await page.fill("#nBuscar", "crespo");
  assert.ok((await page.locator(".prod:not([hidden])").count()) >= 2);
  await page.fill("#nBuscar", "");
  await tocar('.prod[data-code="BC-06"] [data-act="plus"]');
  await page.locator('.prod[data-code="KT-02"] .qty-input').fill("5");
  assert.equal(await page.innerText("#nTotal"), "9 cajas");
  await foto("02-nuevo");
  await revisarDiseno("nuevo");
  ok("lista rápida: buscar, filtrar, + / − y escribir cantidad");

  await tocar("#nSeguir");
  await esperarRuta("#/nuevo/cliente");
  assert.match(await page.innerText(".resumen-carrito"), /9 cajas/);
  assert.ok(await page.locator("#btnAtras").isVisible());
  await tocar("#btnGuardar");
  assert.match(await page.innerText("#cError"), /Falta: Nombre del cliente o del negocio · Teléfono 1/);
  await page.fill("#cContacto", "María Pérez");
  await page.fill("#cNegocio", "Peluquería Bella");
  await page.fill("#cTel1", "0412-1234567");
  await page.fill("#cDireccion", "Av. Bolívar, El Vigía");
  await tocar("#btnGps");
  await page.waitForFunction(() => /Ubicación lista/.test(document.getElementById("gpsEstado").textContent));
  await tocar('input[name="cPago"][value="Divisas · Contado"]');
  await foto("03-cliente");
  await revisarDiseno("cliente");
  await tocar("#btnGuardar");
  await esperarRuta("#/nuevo/listo");
  assert.match(await page.innerText(".listo h2"), /^Pedido SKL-\d{6}-001 guardado$/);
  const msg = await page.inputValue("#lMensaje");
  assert.match(msg, /• 2 × Babosa \(BC-01\) = 12 unidades/);
  assert.match(msg, /• 5 × Kit Aguacate \(KT-02\) = 30 dúos/);
  await page.click("#btnGrupo");
  assert.deepEqual(await page.evaluate(() => window.__compartido), [msg]);
  assert.match(await page.getAttribute("#btnCopia", "href"), /^https:\/\/wa\.me\/584121234567/);
  assert.equal(gas.tabla("Pedidos").length, 1);
  assert.equal(gas.tabla("PedidoItems").length, 4);
  assert.ok(await page.locator(".app-nav .badge").count() === 0);
  await foto("04-listo");
  ok("datos del cliente + GPS → guardado en Sheets → enviar al grupo; carrito vacío");

  /* ---------- Inicio, pedidos, detalle ---------- */
  await page.click('.app-nav a[href="#/inicio"]');
  await esperarRuta("#/inicio");
  await page.waitForSelector("#iLista .fila-ped");
  assert.deepEqual(await page.locator("#iStats .stat strong").allInnerTexts(), ["1", "9", "1", "0"]);
  await foto("05-inicio");
  await revisarDiseno("inicio");
  await page.click('.app-nav a[href="#/pedidos"]');
  await esperarRuta("#/pedidos");
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

  /* ---------- Clientes ---------- */
  await page.click('.app-nav a[href="#/clientes"]');
  await esperarRuta("#/clientes");
  await page.waitForSelector("#kLista a");
  await page.click("#kLista a");
  await esperarRuta("#/cliente/");
  assert.equal(await titulo(), "Peluquería Bella");
  await page.waitForSelector("#kPedidos .fila-ped");
  assert.equal(await page.locator('.botones-contacto a[href^="tel:"]').count(), 1);
  await foto("06-cliente");
  await revisarDiseno("ficha cliente");
  await page.click("#btnPedirCliente");
  await esperarRuta("#/nuevo");
  await tocar('.prod[data-code="BC-03"] [data-act="plus"]');
  await tocar("#nSeguir");
  await esperarRuta("#/nuevo/cliente");
  assert.equal(await page.inputValue("#cNegocio"), "Peluquería Bella");
  assert.match(await page.innerText("#cSel"), /Cliente existente/);
  ok("clientes: lista, ficha con historial y nuevo pedido con el cliente ya cargado");

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
  // volver al pedido que quedó a medio armar (el carrito y el cliente siguen guardados)
  await page.goto(BASE + "/panel.html#/nuevo/cliente");
  await esperarRuta("#/nuevo/cliente");
  assert.equal(await page.inputValue("#cNegocio"), "Peluquería Bella");

  /* ---------- Sin señal ---------- */
  sinSenal = true;
  await tocar("#btnGuardar");
  await esperarRuta("#/nuevo/listo");
  assert.match(await page.innerText(".listo h2"), /Guardado en el teléfono/);
  await page.click('.app-nav a[href="#/inicio"]');
  await page.waitForSelector("#pendSubir:not([hidden])");
  sinSenal = false;
  await page.click("#btnSubirPend");
  await page.waitForSelector("#pendSubir", { state: "hidden" });
  assert.equal(gas.tabla("Pedidos").length, 2);
  ok("sin señal: queda en el teléfono y se sube con Subir ahora");
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
  await salir();

  /* ---------- Despachador ---------- */
  await ingresar("luis", "Luis5555");
  await esperarRuta("#/inicio");
  assert.deepEqual(await page.locator(".app-nav a span").allInnerTexts(), ["Inicio", "Entregas", "Más"]);
  await page.waitForSelector("#iLista .fila-ped");
  assert.match(await page.innerText("#iLista"), /Av\. Bolívar/);
  await page.click('.app-nav a[href="#/entregas"]');
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

  /* ---------- Master ---------- */
  await ingresar("jose", "Skala#2026");
  await esperarRuta("#/inicio");
  await page.click('.app-nav a[href="#/mas"]');
  await esperarRuta("#/mas");
  assert.deepEqual(await page.locator(".menu-mas strong").allInnerTexts(), ["Resumen", "Usuarios", "Ver catálogo"]);
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
  await page.selectOption("#uRol", "despachador");
  await page.fill("#uClave", "123456");
  await page.click("#btnGuardarUsuario");
  await page.waitForSelector("#uError:not([hidden])");
  assert.match(await page.innerText("#uError"), /letras y números/);
  await page.fill("#uClave", "Kevin#9876");
  await page.click("#btnGuardarUsuario");
  await esperarRuta("#/usuarios");
  await page.waitForFunction(() => document.querySelectorAll(".usuarios-lista li").length === 5);
  await foto("10-usuarios");
  await revisarDiseno("usuarios");
  ok("master: Más → Resumen y Usuarios (crear con validación de clave)");

  await page.goto(BASE + "/panel.html#/pedidos?tab=entregado");
  await esperarRuta("#/pedidos");
  await page.click("#pLista .fila-ped");
  await esperarRuta("#/pedido/");
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
