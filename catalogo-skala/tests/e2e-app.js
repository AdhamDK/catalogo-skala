/* Prueba del panel DENTRO de la app Android (window.SkalaApp simulado), en un teléfono de 390 px.
   Verifica lo que la app nativa (android/) espera de las pantallas: sesión larga, copia de datos,
   compartir con el menú de Android, aviso de versión nueva y sin enlaces al catálogo.
   Correr: node tests/e2e-app.js */
const path = require("path");
const http = require("http");
const fs = require("fs");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { crearGas } = require("../../crm/tests/fake-gas.js");

const RAIZ = path.resolve(__dirname, "..");
const API = "https://crm.test/exec";
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".webmanifest": "application/manifest+json" };

(async () => {
  const gas = crearGas();
  gas.ctx.prepararHojas();
  gas.ctx.crearUsuario("oscar", "Óscar", "vendedor", "Oscar.1234");
  const srv = await new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const ruta = path.join(RAIZ, decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (!ruta.startsWith(RAIZ) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(ruta)] || "application/octet-stream" });
      fs.createReadStream(ruta).pipe(res);
    }).listen(0, "127.0.0.1", () => ok(s));
  });
  const BASE = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  let sinSenal = false;
  const pedidos = [];
  await ctx.route(API, async (route) => {
    if (sinSenal) return route.abort("internetdisconnected");
    const body = JSON.parse(route.request().postData() || "{}");
    pedidos.push(body);
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(gas.post(body)) });
  });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  // Puente nativo simulado (android/app/src/main/java/com/skala/equipo/Puente.java)
  await ctx.addInitScript((api) => {
    window.SKALA_CRM_URL = api;
    const reg = (window.__app = { token: null, datos: null, nativo: "", compartido: [], actualizar: [], revisar: 0 });
    window.SkalaApp = {
      versionCode: () => 1, versionName: () => "1.0.0", versionPantallas: () => "de fábrica",
      guardarToken: (t) => { reg.token = t; }, guardarDatos: (d) => { reg.datos = d; }, leerDatos: () => reg.nativo,
      compartir: (t) => reg.compartido.push(t), actualizarApp: (u) => reg.actualizar.push(u), revisarActualizaciones: () => { reg.revisar++; },
    };
  }, API);
  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  const ok = (m) => console.log("  ✔ " + m);
  const esperarRuta = (h) => page.waitForFunction((h) => !!document.body && (document.body.dataset.lista || "").startsWith(h), h);
  const app = () => page.evaluate(() => window.__app);
  console.log("▶ panel dentro de la app Android (390px)");

  try {
    await page.goto(BASE + "/panel.html");
    await esperarRuta("#/ingresar");
    assert.equal(await page.locator('a[href="index.html"]').count(), 0); // sin catálogo en la app
    assert.equal(await page.getAttribute("#lnkCatalogo", "href"), null); // sin dirección pública cargada, el logo no navega
    await page.fill("#lUsuario", "oscar");
    await page.fill("#lClave", "Oscar.1234");
    await page.click("#btnLogin");
    await esperarRuta("#/inicio");
    assert.equal(pedidos.find((p) => p.action === "login").dispositivo, true);
    const tk = (await app()).token;
    assert.ok(tk && tk.split(".").length === 3);
    assert.ok(Number(tk.split(".")[1]) - Date.now() > 29 * 24 * 3600000, "la sesión de la app dura 30 días");
    await page.waitForFunction(() => window.__app.datos);
    assert.ok(JSON.parse((await app()).datos).fecha);
    ok("ingresar: sesión de 30 días guardada en la app y primera descarga de datos");

    // Compartir con el menú de Android
    const r = gas.post({ action: "guardarPedido", token: tk, client_ref: "x1", documento: "Nota de entrega", tipo_pago: "pronto",
      cliente: { negocio: "Bella", telefono: "0412-1234567" }, items: [{ code: "BC-01", producto: "Babosa", cajas: 2 }] });
    await page.goto(BASE + "/panel.html#/pedido/" + r.pedido.id);
    await esperarRuta("#/pedido/");
    await page.click("#btnReenviar");
    assert.match((await app()).compartido[0], new RegExp("PEDIDO " + r.pedido.id));
    ok("compartir al grupo usa el menú de Android");

    // Más: datos en el teléfono, versión, sin catálogo ni "instalar"
    await page.goto(BASE + "/panel.html#/mas");
    await esperarRuta("#/mas");
    assert.deepEqual(await page.locator(".menu-mas strong").allInnerTexts(), ["Resumen"]);
    assert.match(await page.innerText("#verApp"), /App 1\.0\.0 · pantallas de fábrica/);
    assert.doesNotMatch(await page.innerText("#vista"), /Instalar en el teléfono/);
    await page.click("#btnSync");
    await page.waitForFunction(() => /1 pedidos/.test(document.getElementById("datosEstado").textContent));
    assert.equal((await app()).revisar, 1);
    ok("Más: Actualizar ahora guarda la copia y revisa actualizaciones de la app");

    // Versión nueva publicada en la hoja Config
    const fijar = (clave, valor) => { gas.hojas.Config.filas.find((f) => String(f[0]).replace(/^'/, "") === clave)[1] = valor; };
    fijar("version_apk", 2); fijar("url_apk", "'https://github.com/AdhamDK/catalogo-skala/releases/download/app-2/SkalaEquipo.apk"); fijar("notas", "'Precios nuevos");
    await page.click("#btnSync");
    await page.waitForSelector("#avisoApp:not([hidden])");
    assert.match(await page.innerText("#avisoApp"), /Hay una versión nueva de la app: Precios nuevos/);
    await page.click("#btnActualizarApp");
    assert.deepEqual((await app()).actualizar, ["https://github.com/AdhamDK/catalogo-skala/releases/download/app-2/SkalaEquipo.apk"]);
    assert.equal(await page.evaluate(() => document.body.classList.contains("app-bloqueada")), false);
    fijar("minima_apk", 2);
    await page.click("#btnSync");
    await page.waitForFunction(() => document.body.classList.contains("app-bloqueada"));
    assert.match(await page.innerText("#avisoApp"), /Actualización obligatoria/);
    ok("aviso de versión nueva → descarga; versión mínima → bloquea hasta actualizar");
    fijar("minima_apk", 1);
    await page.evaluate(() => { document.body.classList.remove("app-bloqueada"); });

    // La app se actualizó sola con la app cerrada (worker nativo): se usa esa copia sin señal
    await page.evaluate(() => {
      const d = JSON.parse(window.__app.datos);
      d.fecha = new Date(Date.now() + 60000).toISOString();
      d.pedidos = [{ ...d.pedidos[0], id: "SKL-NATIVO", negocio: "Copia del worker" }];
      window.__app.nativo = JSON.stringify(d);
    });
    sinSenal = true;
    await page.goto(BASE + "/panel.html#/pedidos?tab=pendiente");
    await esperarRuta("#/pedidos");
    assert.match(await page.innerText("#pLista"), /Copia del worker/);
    assert.ok(await page.locator("#modoLocal").isVisible());
    sinSenal = false;
    ok("sin señal: usa la copia que bajó la app en segundo plano");

    await page.goto(BASE + "/panel.html#/mas");
    await esperarRuta("#/mas");
    await page.click("#btnSalir");
    await esperarRuta("#/ingresar");
    assert.equal((await app()).token, "");
    assert.equal((await app()).datos, "");
    ok("cerrar sesión borra la sesión y los datos del teléfono");
    assert.deepEqual(errores, []);
    console.log("E2E APP OK");
  } finally {
    await browser.close();
    srv.close();
  }
})().catch((e) => { console.error("✘", e.message); process.exit(1); });
