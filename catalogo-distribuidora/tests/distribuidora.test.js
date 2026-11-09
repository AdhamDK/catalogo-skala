const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const _CAND_SKALA = path.resolve(ROOT, "..", "catalogo-skala", "catalogo-skala");
const ROOT_SKALA_GLOBAL = fs.existsSync(_CAND_SKALA)
  ? _CAND_SKALA
  : path.resolve(ROOT, "..", "catalogo-skala");
const codigoDatos = fs.readFileSync(path.join(ROOT, "js", "datos-distribuidora.js"), "utf8");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  codigoDatos +
    "\nthis.GRUPOS_DISTRIBUIDORA = GRUPOS_DISTRIBUIDORA; this.BANOS = BANOS; this.allProductsMap = allProductsMap; this.fotoHTML = fotoHTML; this.fotoGrande = fotoGrande;",
  ctx
);

const { GRUPOS_DISTRIBUIDORA, BANOS, allProductsMap, fotoHTML, fotoGrande } = ctx;

test("Catálogo Distribuidora: todos los 27 grupos tienen 3 niveles de resolución (-400, -800, -hq), precios y archivos reales en disco", () => {
  assert.equal(GRUPOS_DISTRIBUIDORA.length, 27, "Exactamente 27 grupos configurados (incluyendo Aliclean 350ml/750ml y Alident 100g/75g)");
  const ROOT_SKALA = ROOT_SKALA_GLOBAL;
  let totalVariantes = 0;
  for (const g of GRUPOS_DISTRIBUIDORA) {
    assert.ok(g.id && g.nombre && g.categoria, `Grupo válido: ${g.id}`);
    assert.ok(g.precioMenor > 0 && g.precioMayor > 0, `Precios válidos en ${g.id}`);
    assert.ok(g.precioUnidad > 0, `Precio por unidad válido en ${g.id}`);
    assert.match(g.portada400, /-400\.jpg$/, `Portada 400 en ${g.id}`);
    assert.match(g.portada800, /-800\.jpg$/, `Portada 800 en ${g.id}`);
    assert.match(g.portadaHq, /-hq\.jpg$/, `Portada HQ en ${g.id}`);
    for (const rel of [g.portada400, g.portada800, g.portadaHq]) {
      assert.equal(fs.existsSync(path.join(ROOT, rel)), true, `Existe en distribuidora: ${rel}`);
    }
    assert.equal(fs.existsSync(path.join(ROOT_SKALA, g.portada400)), true, `Existe miniatura portada400 en skala: ${g.portada400}`);
    assert.ok(Array.isArray(g.variantes) && g.variantes.length >= 1, `Variantes en ${g.id}`);
    for (const v of g.variantes) {
      totalVariantes++;
      assert.ok(v.code && v.name && v.fragancia, `Variante válida ${v.code}`);
      assert.match(v.img400, /-400\.jpg$/, `img400 en ${v.code}`);
      assert.match(v.img800, /-800\.jpg$/, `img800 en ${v.code}`);
      assert.match(v.imgHq, /-hq\.jpg$/, `imgHq en ${v.code}`);
      for (const rel of [v.img400, v.img800, v.imgHq]) {
        assert.equal(fs.existsSync(path.join(ROOT, rel)), true, `Existe variante en distribuidora: ${rel}`);
      }
      assert.equal(fs.existsSync(path.join(ROOT_SKALA, v.img400)), true, `Existe miniatura img400 en skala: ${v.img400}`);
    }
  }
  assert.equal(BANOS.length, totalVariantes);
  assert.equal(Object.keys(allProductsMap()).length, totalVariantes);
  assert.match(fotoHTML("ALV-DET1K-01", { grande: false }), /-400\.jpg" srcset="[^"]+-400\.jpg 1x, [^"]+-800\.jpg 2x"/);
  assert.match(fotoHTML("ALV-DET1K-01", { grande: true }), /-800\.jpg" srcset="[^"]+-800\.jpg 1x, [^"]+-hq\.jpg 2x"/);
  assert.match(fotoGrande("ALV-DET1K-01"), /estudio-pro-01-blanco-perla-blanqueador-1kg-hq\.jpg$/);
});

test("Catálogo Skala (datos.js): incorpora los 16 Baños de Crema (BC-01..BC-16) y 8 Kits (KT-01..KT-08) con 3 resoluciones de estudio", () => {
  const ROOT_SKALA = ROOT_SKALA_GLOBAL;
  const codigoProd = fs.readFileSync(path.join(ROOT_SKALA, "js", "producto.js"), "utf8");
  const codigoSkala = fs.readFileSync(path.join(ROOT_SKALA, "js", "datos.js"), "utf8");
  const ctxSkala = {};
  vm.createContext(ctxSkala);
  vm.runInContext(
    codigoProd + "\n" + codigoSkala + "\nthis.BANOS = BANOS; this.KITS = KITS; this.allProductsMap = allProductsMap; this.fotoHTML = fotoHTML; this.fotoGrande = fotoGrande;",
    ctxSkala
  );
  assert.equal(ctxSkala.BANOS.length, 16, "16 Baños de Crema Skala BC-01..BC-16");
  assert.equal(ctxSkala.KITS.length, 8, "8 Kits Skala KT-01..KT-08");
  for (const p of [...ctxSkala.BANOS, ...ctxSkala.KITS]) {
    assert.match(p.img400, /-400\.jpg$/, `Skala img400 en ${p.code}`);
    assert.match(p.img800, /-800\.jpg$/, `Skala img800 en ${p.code}`);
    assert.match(p.imgHq, /-hq\.jpg$/, `Skala imgHq en ${p.code}`);
    for (const rel of [p.img400, p.img800, p.imgHq]) {
      assert.equal(fs.existsSync(path.join(ROOT_SKALA, rel)), true, `Existe imagen Skala: ${rel}`);
    }
  }
  assert.match(ctxSkala.fotoHTML("BC-12", { grande: true }), /estudio-pro-BC-12-mais-cachinhos-800\.jpg/);
  assert.match(ctxSkala.fotoGrande("BC-16"), /estudio-pro-BC-16-bomba-de-vitaminas-hq\.jpg$/);
});

test("Catálogo Distribuidora: index.html y main-distribuidora.js implementan regla de 6 unidades por defecto y toggle de unidad/caja", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "js", "main-distribuidora.js"), "utf8");
  assert.match(html, /id="fragModal"/);
  assert.match(html, /id="btnModoCaja"/);
  assert.match(html, /id="btnModoUnidad"/);
  assert.match(html, /id="configUnidadModal"/);
  assert.match(js, /modoVentaActual === "unidad" && actual === 0 \? 6 : actual \+ 1/);
  assert.match(js, /setFragQty\(code, "unidad", 6\)/);
});

test("Catálogo Distribuidora: paridad estructural y funcional con catalogo-skala + estilo Alive Cosmetic", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "css", "styles.css"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "js", "main-distribuidora.js"), "utf8");
  const panelHtml = fs.readFileSync(path.join(ROOT, "panel.html"), "utf8");

  // Archivos clave presentes en disco
  assert.equal(fs.existsSync(path.join(ROOT, "js", "tema.js")), true, "Existe js/tema.js");
  assert.equal(fs.existsSync(path.join(ROOT, "js", "crm.js")), true, "Existe js/crm.js");

  // Estructura de index.html idéntica en calidad a catalogo-skala
  assert.match(html, /class="blobs"/);
  assert.match(html, /class="brand-mark"/);
  assert.match(html, /id="btnCuenta"/);
  assert.match(html, /hero-content/);
  assert.match(html, /hero-art/);
  assert.match(html, /id="aliveBannerCarousel"/);
  assert.match(html, /id="aliveFeaturedTrack"/);
  assert.match(html, /class="curve-grid"/);
  assert.match(html, /id="fsPagoWeb"/);
  assert.match(html, /id="fCliBuscar"/);
  assert.match(html, /id="btnUbic"/);
  assert.match(html, /id="listoModal"/);
  assert.match(html, /id="modoModal"/);
  assert.match(html, /id="zoomModal"/);
  assert.match(html, /id="footAcceso"/);

  // Estilos Alive Cosmetic en css/styles.css
  assert.match(css, /--verde:\s*#0d6e52/);
  assert.match(css, /--rosa:\s*#0047ab/);
  assert.match(css, /\.hero-tile\.tile-alive-card/);
  assert.match(css, /\.frag-strip/);
  assert.match(css, /\.modal-fragancias/);

  // Funciones clave en main-distribuidora.js
  assert.match(js, /function estrellasHTML/);
  assert.match(js, /function renderPagosWeb/);
  assert.match(js, /function abrirZoom/);
  assert.match(js, /function lanzarConfeti/);
  assert.match(js, /function sincronizarCarritoConPanel/);

  // panel.html apunta a datos-distribuidora.js y logos reales
  assert.match(panelHtml, /js\/datos-distribuidora\.js/);
  assert.match(panelHtml, /assets\/img\/logo\/logo-96\.png/);

  // Carta de productos dividida en las 4 secciones de arriba (sin PASO 01..05) + modal con cuadrícula visual de imágenes
  assert.match(js, /id:\s*"sec-detergentes"/);
  assert.match(js, /id:\s*"sec-personal"/);
  assert.match(js, /id:\s*"sec-papel"/);
  assert.match(js, /id:\s*"sec-bebe"/);
  assert.doesNotMatch(js, /cat-paso-num/);
  assert.match(js, /frag-cards-grid/);
  assert.match(js, /frag-card-img-wrap/);
  assert.match(js, /frag-img-minus/);
  assert.match(css, /\.cat-seccion-icono/);
  assert.match(css, /\.frag-grid\.frag-cards-grid/);
});

test("Base de datos Supabase compartida (Skala + Distribuciones Ontiveros): cargarInventario reconoce ALV-DET1K-01 y todos los 131 productos sin error", async () => {
  const crmDist = fs.readFileSync(path.join(ROOT, "js", "crm-api.js"), "utf8");
  const crmSkala = fs.readFileSync(path.join(ROOT_SKALA_GLOBAL, "js", "crm-api.js"), "utf8");
  assert.equal(crmDist, crmSkala, "Ambos repositorios usan exactamente el mismo motor crm-api.js conectado a la misma base Supabase");

  // Verificar que todos los 131 códigos del catálogo están registrados en PRODUCTOS_BASE_S
  for (const p of BANOS) {
    assert.equal(crmDist.includes(`"${p.code}"`), true, `Código ${p.code} presente en PRODUCTOS_BASE_S de crm-api.js`);
  }

  // Simular llamada a SkalaAPI.api('cargarInventario') para ALV-DET1K-01 cuando Supabase aún no tenía fila en public.precios
  const escrituras = [];
  const storage = {
    skala_sesion_v2: JSON.stringify({ id: "U1", usuario: "kevin", nombre: "Kevin", rol: "master", roles: ["master"], token: "U1.9999999999999.sig" }),
  };
  const core = require("../js/crm-core.js");
  const sandbox = {
    ...core,
    AbortController,
    setTimeout,
    clearTimeout,
    crypto,
    window: {},
    localStorage: {
      getItem: (k) => storage[k] ?? null,
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; },
    },
    BANOS,
    KITS: [],
    allProductsMap,
    fetch: async (_url, opts) => {
      const body = JSON.parse(opts.body);
      const payload = body.payload || {};
      if (payload.op === "leer") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            sesion: { id: "U1", usuario: "kevin", nombre: "Kevin", rol: "master", roles: ["master"] },
            datos: {
              Precios: [{ code: "BC-01", producto: "Babosa", menor: 25.5, mayor: 24 }],
              Inventario: [],
              Pedidos: [],
              PedidoItems: [],
            },
          }),
        };
      }
      if (payload.op === "escribir") {
        escrituras.push(...(payload.cambios || []));
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, ids: {} }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(crmDist + "\nthis.SkalaAPI = SkalaAPI;", sandbox);

  const res = await sandbox.SkalaAPI.api("cargarInventario", {
    tipo: "entrada",
    nota: "Carga inicial Alive + Skala",
    items: [
      { code: "ALV-DET1K-01", cajas: 15 },
      { code: "AZ-DET-01", cajas: 8 },
      { code: "BC-01", cajas: 6 },
    ],
  });

  assert.equal(res.ok, true);
  assert.equal(res.guardados, 3);
  assert.deepEqual(
    JSON.parse(JSON.stringify(res.productos.map((x) => [x.code, x.disponible, x.fisico]))),
    [
      ["ALV-DET1K-01", 15, 15],
      ["AZ-DET-01", 8, 8],
      ["BC-01", 6, 6],
    ]
  );
  // Debe haber registrado automáticamente los precios base de ALV-DET1K-01 y AZ-DET-01 en Precios
  const preciosUpsert = JSON.parse(JSON.stringify(escrituras.filter((c) => c.tabla === "Precios").map((c) => c.fila.code)));
  assert.deepEqual(preciosUpsert, ["ALV-DET1K-01", "AZ-DET-01"]);
});

test("Catálogo Distribuidora: tarjetas con cabecera estilo Skala CRM (.card-top) y escenario animado secuencial 1 a 1 (.card-anim-stage)", () => {
  const css = fs.readFileSync(path.join(ROOT, "css", "styles.css"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "js", "main-distribuidora.js"), "utf8");

  // Selectores CSS clave del diseño de tarjeta estilo Skala + escenario animado
  assert.match(css, /\.card-top\b/);
  assert.match(css, /\.card-top-right\b/);
  assert.match(css, /\.card-pack-chip\b/);
  assert.match(css, /\.card-anim-stage\b/);
  assert.match(css, /\.anim-layer-all\b/);
  assert.match(css, /\.anim-layer-grid\b/);
  assert.match(css, /\.anim-layer-grid\[data-count="7"\]\s*\.anim-cell/);
  assert.match(css, /\.anim-cell\.is-visible/);
  assert.match(css, /\.anim-cell\.is-just-added/);
  assert.match(css, /\.card-anim-pill\b/);
  assert.match(css, /\.card-anim-bar-fill\b/);
  assert.match(css, /\.frag-avatar\.is-active-anim/);

  // Funciones clave en main-distribuidora.js
  assert.match(js, /function crearStageAnimadoHTML\(g,\s*mostrarPildora = true\)/);
  assert.match(js, /function aplicarEstadoStage\(stageEl,\s*g,\s*step\)/);
  assert.match(js, /function iniciarAnimacionesTarjetas\(\)/);
  assert.match(js, /function hidratarTarjetasDestacadasAnimadas\(\)/);

  // Verificar que los grupos de 7 detergentes Alive generan las 7 celdas animadas en orden
  const det1kg = GRUPOS_DISTRIBUIDORA.find((g) => g.id === "GRP-ALV-DET-1KG");
  assert.ok(det1kg, "Existe el grupo GRP-ALV-DET-1KG (Detergentes Alive 1 kg)");
  assert.equal(det1kg.variantes.length, 7, "GRP-ALV-DET-1KG tiene exactamente 7 detergentes Alive");

  // Extraer y evaluar crearStageAnimadoHTML con el grupo de 7 detergentes Alive
  const matchFn = js.match(/function crearStageAnimadoHTML\(g, mostrarPildora = true\) \{[\s\S]*?\n\}/);
  assert.ok(matchFn, "Se encontró la implementación de crearStageAnimadoHTML");
  const fnCtx = { escapeHtml: (s) => String(s ?? "") };
  vm.createContext(fnCtx);
  vm.runInContext(matchFn[0] + "\nthis.crearStageAnimadoHTML = crearStageAnimadoHTML;", fnCtx);

  const stageHtml = fnCtx.crearStageAnimadoHTML(det1kg, true);
  assert.match(stageHtml, /class="card-anim-stage"/);
  assert.match(stageHtml, /data-total="7"/);
  assert.match(stageHtml, /data-phase="all"/);
  assert.match(stageHtml, /class="anim-layer-all is-active"/);
  assert.match(stageHtml, /class="anim-layer-grid" data-anim-grid data-count="7"/);
  assert.match(stageHtml, /✨ Los 7 modelos/);

  // Debe contener las 7 celdas individuales data-cell-idx="0" .. data-cell-idx="6"
  for (let i = 0; i < 7; i++) {
    assert.match(stageHtml, new RegExp(`data-cell-idx="${i}"`), `Celda individual #${i + 1} presente`);
    assert.equal(stageHtml.includes(det1kg.variantes[i].img400), true, `Imagen 400 de variante #${i + 1} presente en la cuadrícula animada`);
  }

  // Verificar la máquina de estados paso a paso (0 -> 1..7 -> 8 -> 0) en aplicarEstadoStage
  const matchStepFn = js.match(/function aplicarEstadoStage\(stageEl, g, step\) \{[\s\S]*?\n\}/);
  assert.ok(matchStepFn, "Se encontró la implementación de aplicarEstadoStage");
  vm.runInContext(matchStepFn[0] + "\nthis.aplicarEstadoStage = aplicarEstadoStage;", fnCtx);

  const makeClassList = (initial = []) => {
    const set = new Set(initial);
    return {
      add: (...cls) => cls.forEach((c) => set.add(c)),
      remove: (...cls) => cls.forEach((c) => set.delete(c)),
      toggle: (c, force) => {
        const shouldHave = force !== undefined ? Boolean(force) : !set.has(c);
        if (shouldHave) set.add(c);
        else set.delete(c);
      },
      contains: (c) => set.has(c),
    };
  };

  const mockAll = { classList: makeClassList(["is-active"]) };
  const mockGrid = { classList: makeClassList([]) };
  const mockPill = { textContent: "" };
  const mockBar = { style: { width: "100%" } };
  const mockCells = det1kg.variantes.map(() => ({ classList: makeClassList(["is-visible"]) }));
  const mockAvatars = det1kg.variantes.map((_, i) => ({
    classList: makeClassList([]),
    getAttribute: (k) => (k === "data-avatar-idx" ? String(i) : null),
  }));
  const mockCard = {
    querySelectorAll: (sel) => (sel.includes(".frag-avatar") ? mockAvatars : []),
    querySelector: () => null,
  };
  const attrs = { "data-phase": "all" };
  const mockStage = {
    setAttribute: (k, v) => { attrs[k] = v; },
    querySelector: (sel) => {
      if (sel === "[data-anim-all]") return mockAll;
      if (sel === "[data-anim-grid]") return mockGrid;
      if (sel === "[data-anim-pill]") return mockPill;
      if (sel === "[data-anim-bar]") return mockBar;
      return null;
    },
    querySelectorAll: (sel) => (sel === ".anim-cell" ? mockCells : []),
    closest: () => mockCard,
  };

  // Paso 1..7: se van mostrando 1 a 1 poco a poco hasta completar los 7
  for (let paso = 1; paso <= 7; paso++) {
    fnCtx.aplicarEstadoStage(mockStage, det1kg, paso);
    assert.equal(attrs["data-phase"], "step");
    assert.equal(mockAll.classList.contains("is-active"), false);
    assert.equal(mockGrid.classList.contains("is-active"), true);
    const visibles = mockCells.filter((c) => c.classList.contains("is-visible")).length;
    assert.equal(visibles, paso, `En el paso ${paso} deben verse exactamente ${paso} detergentes en la cuadrícula`);
    assert.equal(mockCells[paso - 1].classList.contains("is-just-added"), true, `El detergente #${paso} recién agregado se resalta`);
    assert.equal(mockAvatars[paso - 1].classList.contains("is-active-anim"), true, `El avatar #${paso} se ilumina en sincronía`);
    assert.match(mockPill.textContent, new RegExp(`^${paso}/7 · `));
  }

  // Paso 8: los 7 completados con pulso final
  fnCtx.aplicarEstadoStage(mockStage, det1kg, 8);
  assert.equal(attrs["data-phase"], "complete");
  assert.equal(mockGrid.classList.contains("is-complete-pulse"), true);
  assert.equal(mockCells.every((c) => c.classList.contains("is-visible")), true);
  assert.equal(mockPill.textContent, "✓ 7/7 modelos");

  // Vuelta a empezar (Paso 0: muestra la portada con los 7 juntos)
  fnCtx.aplicarEstadoStage(mockStage, det1kg, 0);
  assert.equal(attrs["data-phase"], "all");
  assert.equal(mockAll.classList.contains("is-active"), true);
  assert.equal(mockGrid.classList.contains("is-active"), false);
  assert.equal(mockPill.textContent, "✨ Los 7 modelos");

  // Regresión 1: el badge ".card-n[data-grupo-badge]" ("X fragancias") tiene z-index superior al escenario animado aislado
  assert.match(css, /\.card\s+\.card-n\[data-grupo-badge\]\s*\{\s*z-index:\s*8/);
  assert.match(css, /\.card-anim-stage\s*\{[\s\S]*?z-index:\s*1;[\s\S]*?isolation:\s*isolate;/);

  // Regresión 2: en #fragGrid, el botón (−) encima del producto ([data-frag-dec]) se evalúa ANTES que el contenedor [data-frag-inc]
  const idxDec = js.indexOf('const decBtn = e.target.closest("[data-frag-dec]");');
  const idxInc = js.indexOf('const incBtn = e.target.closest("[data-frag-inc]");');
  assert.ok(idxDec > 0 && idxInc > 0 && idxDec < idxInc, "decBtn ([data-frag-dec]) debe evaluarse antes que incBtn ([data-frag-inc]) para que el botón (−) reste correctamente");

  // Regresión 3: blindaje mobile-first contra desplazamiento lateral (0px overflow-x)
  assert.match(css, /html,\s*body\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?overflow-x:\s*clip;/);
  assert.match(css, /\.filters\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?margin:\s*0;/);

  // Regresión 4: nombres cortos en los 27 grupos y tarjeta limpia en cardGrupoHTML(g)
  const nombresEsperados = {
    "GRP-ALV-DET-1KG": "Detergente Alive 1kg",
    "GRP-AZ-DET": "Detergente A-Z 1kg",
    "GRP-ALV-DET-500G": "Detergente Alive 500g",
    "GRP-ALV-PAN-150G": "Jabón Panela Alive 150g",
    "GRP-JAB-POPULAR": "Jabón Popular Barra",
    "GRP-ALV-SUA-1L": "Suavizante Alive 1L",
    "GRP-ALV-LAV": "Lavaplatos Aliclean 350ml",
    "GRP-ALV-LAV-750": "Lavaplatos Aliclean 750ml",
    "GRP-ALV-PAP": "Papel Alisoft 4 Rollos",
    "GRP-ALV-TOA-ABS": "Toallín Alisoft",
    "GRP-BER-ESP": "Espirales Bernice x60",
    "GRP-DOR-PACE3": "Afeitadora Dorco Pace 3",
    "GRP-ALV-CAP": "Baño de Crema Alive 400g",
    "GRP-ALV-LOC": "Loción Corporal Alive 400ml",
    "GRP-ALV-SHA-350": "Shampoo Alive 350ml",
    "GRP-ALV-SHA-250": "Shampoo Alive 250ml",
    "GRP-ALV-DEN": "Crema Dental Alident 100g",
    "GRP-ALV-DEN-75G": "Crema Dental Alident 75g",
    "GRP-ALV-JAB-ANITA": "Jabón Anita 125g",
    "GRP-ALV-TOA-FEM": "Toallas Femeninas Alive",
    "GRP-HAR-MILKY": "Jabón Harmony Milky",
    "GRP-HAR-FRUITY": "Jabón Harmony Fruity",
    "GRP-SKL-BANOS-DIST": "Baño de Crema Skala 1kg",
    "GRP-SKL-KITS-DIST": "Kits Skala Dúo",
    "GRP-BF-PAN": "Pañales Baby Finger",
    "GRP-BF-THU": "Toallas Húmedas Baby Finger",
    "GRP-BF-CUI": "Cuidado Bebé Baby Finger",
  };
  for (const [id, nombreEsp] of Object.entries(nombresEsperados)) {
    const grp = GRUPOS_DISTRIBUIDORA.find((x) => x.id === id);
    assert.ok(grp, `Existe grupo ${id}`);
    assert.equal(grp.nombre, nombreEsp, `Nombre corto exacto para ${id}`);
  }

  const matchCardFn = js.match(/function cardGrupoHTML\(g\) \{[\s\S]*?\n\}/);
  assert.ok(matchCardFn, "Se encontró la implementación de cardGrupoHTML");
  let mockCart = {};
  const cardCtx = {
    escapeHtml: (s) => String(s ?? ""),
    crearStageAnimadoHTML: fnCtx.crearStageAnimadoHTML,
    cfgGrupo: (id) => {
      const grp = GRUPOS_DISTRIBUIDORA.find((x) => x.id === id);
      return {
        permiteUnidad: grp.permiteUnidad !== false,
        precioMenor: grp.precioMenor,
        precioMayor: grp.precioMayor,
        precioUnidad: grp.precioUnidad,
      };
    },
    precioVariante: (code) => {
      const p = allProductsMap()[code] || {};
      return {
        precioMenor: p.precioMenor || 0,
        precioMayor: p.precioMayor || 0,
        precioUnidad: p.precioUnidad || 0,
      };
    },
    getItemQty: (code) => mockCart[code] || { cajas: 0, unidades: 0 },
    resumenGrupoEnCarrito: (grupo) => {
      let cajas = 0, unidades = 0, refs = 0;
      grupo.variantes.forEach((v) => {
        const q = mockCart[v.code] || { cajas: 0, unidades: 0 };
        if (q.cajas > 0 || q.unidades > 0) refs++;
        cajas += q.cajas;
        unidades += q.unidades;
      });
      return { cajas, unidades, refs };
    },
    esTarifaMayor: () => false,
  };
  vm.createContext(cardCtx);
  vm.runInContext(matchCardFn[0] + "\nthis.cardGrupoHTML = cardGrupoHTML;", cardCtx);

  const cardVaciaHtml = cardCtx.cardGrupoHTML(det1kg);
  assert.match(cardVaciaHtml, /<h3 class="card-name">Detergente Alive 1kg<\/h3>/);
  assert.doesNotMatch(cardVaciaHtml, /card-top-right/);
  assert.match(cardVaciaHtml, /<b class="card-n" data-grupo-badge>0\/7 Fragancias<\/b>/);
  assert.doesNotMatch(cardVaciaHtml, /card-anim-pill/);
  assert.doesNotMatch(cardVaciaHtml, /frag-count-pill/);
  assert.match(cardVaciaHtml, /<strong>\$16\.80<\/strong> <small>\/ bulto x 12und<\/small>/);
  assert.doesNotMatch(cardVaciaHtml, /card-precio-extra/);
  assert.doesNotMatch(cardVaciaHtml, /card-order/);
  assert.doesNotMatch(cardVaciaHtml, /btn-abrir-fragancias/);

  mockCart = {
    "ALV-DET1K-01": { cajas: 2, unidades: 0 },
    "ALV-DET1K-03": { cajas: 1, unidades: 0 },
  };
  const cardCon2Html = cardCtx.cardGrupoHTML(det1kg);
  assert.match(cardCon2Html, /<b class="card-n" data-grupo-badge>2\/7 Fragancias<\/b>/);

  // Pausa más larga al completar la vuelta (3800/4200 ms) y en portada inicial (2600/3200 ms)
  assert.match(js, /\?\s*(?:2600|3200)\s*:\s*st\.step\s*<=\s*total\s*\?\s*pasoMs\s*:\s*(?:3800|4200)/);
  assert.match(css, /\.frag-strip\s*\{[\s\S]*?justify-content:\s*center;/);

  // Regresión 5: GRP-ALV-PAN-150G (Jabón Panela Alive 150g) usa sus imágenes reales de estudio (Lavanda, Limón, Suavizante) y no las de Jabón Popular
  const grpPanela = GRUPOS_DISTRIBUIDORA.find((g) => g.id === "GRP-ALV-PAN-150G");
  assert.ok(grpPanela, "Existe GRP-ALV-PAN-150G");
  assert.match(grpPanela.portada800, /portada-estudio-3-panelas-alive-800\.jpg$/);
  assert.doesNotMatch(grpPanela.portada800, /jabon-popular/);
  assert.equal(grpPanela.variantes.length, 3);
  assert.match(grpPanela.variantes[0].img800, /estudio-pro-panela-01-lavanda-150g-800\.jpg$/);
  assert.match(grpPanela.variantes[1].img800, /estudio-pro-panela-02-limon-150g-800\.jpg$/);
  assert.match(grpPanela.variantes[2].img800, /estudio-pro-panela-03-suavizante-150g-800\.jpg$/);

  // Regresión 6: Optimización de espacio en #fragModal (cabecera limpia superior izquierda + solo 2 botones visibles: Limpiar y Listo)
  const htmlDist = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(htmlDist, /<img id="fragModalImg"[^>]*hidden/);
  assert.match(htmlDist, /<p class="eyebrow" id="fragModalMarca" hidden>/);
  assert.match(htmlDist, /<h3 id="fragModalTitle">Detergente Alive 1kg<\/h3>/);
  assert.match(htmlDist, /<p class="modal-sub" id="fragModalSub" hidden><\/p>/);
  assert.match(htmlDist, /<div class="frag-toolbar" id="fragToolbar">/);
  assert.match(htmlDist, /<div class="frag-precios-chips" id="fragPreciosInfo" hidden><\/div>/);
  assert.match(htmlDist, /<p class="frag-hint-banner" id="fragHintBanner" hidden>/);
  assert.match(htmlDist, /<button type="button" class="btn btn-ghost" id="btnLimpiarGrupo">Limpiar<\/button>/);
  assert.match(htmlDist, /<button type="button" class="btn btn-ghost" id="btnIrPedidoDesdeFrag" hidden>Ver pedido<\/button>/);
  assert.match(htmlDist, /<button type="button" class="btn btn-primary" data-close-frag id="btnListoFrag">✓ Listo<\/button>/);
  assert.match(css, /\.modal-fragancias\s+#btnIrPedidoDesdeFrag\s*\{\s*display:\s*none\s*!important;/);
  assert.match(css, /\.frag-foot-actions\s*\{[\s\S]*?grid-template-columns:\s*5fr\s+7fr;/);

  // Regresión 7: Todas las mini-ventanas / modales se cierran al tocar fuera (sobre el fondo .modal)
  assert.match(js, /getElementById\("fragModal"\)\?\.addEventListener\("click",[\s\S]*?if\s*\(e\.target\.id\s*===\s*"fragModal"\)\s*closeFragModal\(\)/);
  assert.match(js, /getElementById\("configUnidadModal"\)\?\.addEventListener\("click",[\s\S]*?if\s*\(e\.target\.id\s*===\s*"configUnidadModal"\)\s*closeConfigModal\(\)/);
  assert.match(js, /getElementById\("orderModal"\)\?\.addEventListener\("click",[\s\S]*?if\s*\(e\.target\.id\s*===\s*"orderModal"\)\s*closeModal\(\)/);
  assert.match(js, /getElementById\("listoModal"\)\?\.addEventListener\("click",[\s\S]*?if\s*\(e\.target\.id\s*===\s*"listoModal"\)\s*cerrarListoModal\(\)/);
  assert.match(js, /getElementById\("zoomModal"\)\?\.addEventListener\("click",[\s\S]*?if\s*\(e\.target\.id\s*===\s*"zoomModal"\s*\|\|\s*e\.target\.classList\.contains\("zoom-box"\)\)\s*cerrarZoom\(\)/);
});

test("10. Base de clientes unificada compartida por Ruta/Zona + asignación de catálogo y rutas por vendedor", () => {
  const SKALA_ROOT = ROOT_SKALA_GLOBAL;
  const schemaSql = fs.readFileSync(path.join(SKALA_ROOT, "..", "supabase", "schema.sql"), "utf8");
  const crmApiDist = fs.readFileSync(path.join(ROOT, "js", "crm-api.js"), "utf8");
  const panelDist = fs.readFileSync(path.join(ROOT, "js", "panel.js"), "utf8");
  const panelSkala = fs.readFileSync(path.join(SKALA_ROOT, "js", "panel.js"), "utf8");
  const mainDist = fs.readFileSync(path.join(ROOT, "js", "main-distribuidora.js"), "utf8");
  const mainSkala = fs.readFileSync(path.join(SKALA_ROOT, "js", "main.js"), "utf8");

  // 1) Base de datos PostgreSQL (schema.sql): columnas catalogo y rutas en usuarios, y ruta en clientes
  assert.match(schemaSql, /ALTER TABLE public\.usuarios ADD COLUMN IF NOT EXISTS catalogo text NOT NULL DEFAULT 'ambos';/);
  assert.match(schemaSql, /ALTER TABLE public\.usuarios ADD COLUMN IF NOT EXISTS rutas text NOT NULL DEFAULT '';/);
  assert.match(schemaSql, /ALTER TABLE public\.clientes ADD COLUMN IF NOT EXISTS ruta text NOT NULL DEFAULT '';/);
  assert.match(schemaSql, /IF v_op = 'vendedores_publico' THEN[\s\S]*?'rutas',\s*COALESCE\(u\.rutas, ''\)/);
  assert.match(schemaSql, /IF v_op = 'buscar_cliente_web' THEN[\s\S]*?'ruta',\s*public\.skala_ruta_cliente/);

  // 2) API CRM (crm-api.js): normalización de catálogo y rutas (RUTAS_CARTERA_S), ruta en clientes y buscarClienteWeb
  assert.match(crmApiDist, /const CATALOGOS_S = \["ambos", "skala", "distribuidora"\];/);
  assert.match(crmApiDist, /const RUTAS_CARTERA_S = \["Chivo", "Vigía", "Mérida", "Mocotíes", "Caja Seca", "Táchira"\];/);
  assert.match(crmApiDist, /if \(action === "vendedores"\)[\s\S]*?op:\s*"vendedores_publico"/);
  assert.match(crmApiDist, /ruta:\s*normalizarRutaS\(c\.ruta \|\| c\.zona,\s*c\.nombre,\s*c\.direccion,\s*c\.id\)/);

  // 3) Panel (panel.js en ambos repos): clientes compartidos por Ruta/Zona (#fnRuta, sin #fnVendedor exclusivo) y vendedores con #uCatalogoWrap + #uRutasWrap
  for (const [nombre, codigoPanel] of [["distribuidora", panelDist], ["skala", panelSkala]]) {
    assert.match(codigoPanel, /id="uCatalogoWrap"/, `Selector de catálogo para vendedor en panel (${nombre})`);
    assert.match(codigoPanel, /id="uRutasWrap"/, `Selector de rutas/zonas para vendedor en panel (${nombre})`);
    assert.match(codigoPanel, /name="uRuta"/, `Checkboxes uRuta en panel (${nombre})`);
    assert.match(codigoPanel, /catalogo:\s*catElegido,\s*rutas:\s*rutasElegidas/, `Envío de catalogo y rutas en guardarUsuario (${nombre})`);
    assert.match(codigoPanel, /id="fnRuta"/, `Selector de Ruta / Zona en ficha de cliente (${nombre})`);
    assert.doesNotMatch(codigoPanel, /id="fnVendedor"/, `Clientes compartidos: sin vendedor exclusivo fijo en formulario de cliente (${nombre})`);
  }

  // 4) Un mismo cliente compartido (ej. "Abasto El Sol" en ruta "Mérida") recibe en WhatsApp el vendedor del catálogo y ruta correspondiente
  assert.match(mainSkala, /SkalaAPI\.api\("vendedores",\s*\{\s*catalogo:\s*"skala"\s*\}\)/);
  assert.match(mainDist, /SkalaAPI\.api\("vendedores",\s*\{\s*catalogo:\s*"distribuidora"\s*\}\)/);

  const matchInferir = mainDist.match(/const RUTAS_WEB_DIST = [\s\S]*?function rutaClienteActual\(\) \{[\s\S]*?\n\}/);
  const matchTelFn = mainDist.match(/function telefonoWaVendedor\(v\) \{[\s\S]*?\n\}/);
  const matchCatFn = mainDist.match(/function vendedoresDeEsteCatalogo\(\) \{[\s\S]*?\n\}/);
  const matchAsigFn = mainDist.match(/function vendedorAsignado\(\) \{[\s\S]*?\n\}/);
  assert.ok(matchInferir && matchTelFn && matchCatFn && matchAsigFn, "Funciones de ruta y resolución de vendedor presentes en main-distribuidora.js");

  const ctxDist = {
    state: {
      vendedores: [
        { id: "U1", usuario: "ana", nombre: "Ana Skala Mérida", telefono: "0414-1112233", whatsapp: "584141112233", catalogo: "skala", rutas: ["Mérida"] },
        { id: "U2", usuario: "carlos", nombre: "Carlos Dist Vigía", telefono: "0424-4445566", whatsapp: "584244445566", catalogo: "distribuidora", rutas: ["Vigía", "Chivo"] },
        { id: "U3", usuario: "pedro", nombre: "Pedro Dist Mérida", telefono: "0412-7778899", whatsapp: "584127778899", catalogo: "distribuidora", rutas: ["Mérida", "Mocotíes"] },
      ],
      clienteWeb: null,
    },
    URLSearchParams,
  };
  vm.createContext(ctxDist);
  vm.runInContext(
    `${matchInferir[0]}\n${matchTelFn[0]}\n${matchCatFn[0]}\n${matchAsigFn[0]}\nthis.vendedoresDeEsteCatalogo = vendedoresDeEsteCatalogo; this.vendedorAsignado = vendedorAsignado;`,
    ctxDist
  );

  // Cliente compartido en ruta "Mérida": en Distribuciones Ontiveros asigna a Pedro Dist Mérida (U3)
  ctxDist.state.clienteWeb = { id: "CLI-1", negocio: "Abasto El Sol", ruta: "Mérida" };
  const asigMeridaDist = ctxDist.vendedorAsignado();
  assert.equal(asigMeridaDist.id, "U3");
  assert.equal(asigMeridaDist.whatsapp, "584127778899");

  // Cliente compartido en ruta "Vigía": en Distribuciones Ontiveros asigna a Carlos Dist Vigía (U2)
  ctxDist.state.clienteWeb = { id: "CLI-2", negocio: "Bodegón Sur", ruta: "Vigía" };
  const asigVigiaDist = ctxDist.vendedorAsignado();
  assert.equal(asigVigiaDist.id, "U2");
  assert.equal(asigVigiaDist.whatsapp, "584244445566");

  // 5) Los vendedores deben marcar las rutas que atienden (obligatorio al guardar vendedor + botón "Mis rutas" para el vendedor)
  for (const [nombre, codigoPanel] of [["distribuidora", panelDist], ["skala", panelSkala]]) {
    assert.match(codigoPanel, /if \(elegidos\.includes\("vendedor"\) && !rutasElegidas\.length\)[\s\S]*?Marcá al menos una ruta que atiende el vendedor/, `Validación obligatoria de rutas al guardar vendedor (${nombre})`);
    assert.match(codigoPanel, /function abrirMisRutasVendedor\(\)/, `Modal abrirMisRutasVendedor presente en panel (${nombre})`);
    assert.match(codigoPanel, /id="btnMisRutasVend"/, `Botón Mis rutas en vista de clientes para el vendedor (${nombre})`);
    assert.match(codigoPanel, /api\("guardarMisRutas",\s*\{\s*rutas:\s*marcadas\s*\}\)/, `Acción guardarMisRutas invocada desde panel (${nombre})`);
  }
  assert.match(crmApiDist, /if \(action === "guardarMisRutas"\)/);

  // 6) Cuando el cliente es nuevo (sin ruta conocida ni ?vendedor= en URL) y hay más de 1 vendedor -> muestra "Selecciona tu vendedor" con nombre y rutas que atienden
  for (const [nombre, codigoMain] of [["distribuidora", mainDist], ["skala", mainSkala]]) {
    assert.match(codigoMain, /function formatearRutasVendedor\(rutas\)/, `formatearRutasVendedor presente en ${nombre}`);
    assert.match(codigoMain, /Selecciona tu vendedor/, `Título "Selecciona tu vendedor" presente en ${nombre}`);
    assert.match(codigoMain, /Rutas que atiende:/, `Etiqueta "Rutas que atiende:" presente en ${nombre}`);
    assert.match(codigoMain, /if \(!rutaCli && !paramVend && conWa\.length > 1\)/, `Apertura de selector de vendedor cuando el cliente es nuevo y hay varios vendedores (${nombre})`);
  }
});

test("11. Barra deslizable compacta de marcas afiliadas (#aliveBrandsBar) bajo el banner slide incluyendo SKALA", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "css", "styles.css"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "js", "main-distribuidora.js"), "utf8");

  // Ubicación exacta: debajo de #aliveBannerCarousel y antes de .alive-welcome-section
  const idxBanner = html.indexOf('id="aliveBannerCarousel"');
  const idxBrands = html.indexOf('id="aliveBrandsBar"');
  const idxWelcome = html.indexOf('class="alive-welcome-section');
  assert.ok(idxBanner > 0 && idxBrands > idxBanner && idxWelcome > idxBrands, "#aliveBrandsBar está ubicado justo debajo del banner slide y encima de bienvenida");

  // Los 12 logos oficiales (incluyendo SKALA, A-Z y Bernice) existen en disco y están referenciados en la barra
  const logosEsperados = [
    "assets/img/alive-web/logo-alive.png",
    "assets/img/alive-web/logo-skala.png",
    "assets/img/alive-web/logo-alisoft.jpg",
    "assets/img/alive-web/logo-baby-finger.jpg",
    "assets/img/alive-web/logo-az.jpg",
    "assets/img/alive-web/logo-bernice.jpg",
    "assets/img/alive-web/logo-alive-gold.jpg",
    "assets/img/alive-web/logo-aliclean.jpg",
    "assets/img/alive-web/logo-alident.jpg",
    "assets/img/alive-web/logo-anita.jpg",
    "assets/img/alive-web/logo-harmony.jpg",
    "assets/img/alive-web/logo-dorco.jpg",
  ];
  for (const rel of logosEsperados) {
    assert.equal(fs.existsSync(path.join(ROOT, rel)), true, `Existe logo de marca afiliada: ${rel}`);
    assert.equal(html.includes(rel), true, `index.html incluye ${rel} en #aliveBrandsBar`);
  }

  // Botón de SKALA presente con filtro directo a la marca Skala
  assert.match(html, /class="alive-brand-pill is-skala"[^>]*data-brand-filter="Skala"/);

  // Reglas CSS de barra compacta y animación marquee continua
  assert.match(css, /\.alive-brands-bar\b/);
  assert.match(css, /\.alive-brands-track\b/);
  assert.match(css, /@keyframes aliveBrandsMarquee\b/);
  assert.match(css, /\.alive-brand-pill\s*\{[\s\S]*?width:\s*82px;[\s\S]*?height:\s*36px;/);

  // Interacción en main-distribuidora.js para filtrar por marca o sub-línea al tocar en la barra
  assert.match(js, /getElementById\("aliveBrandsBar"\)/);
  assert.match(js, /function sincronizarPildorasMarcas|const sincronizarPildorasMarcas/);

  // Deslizamiento manual hacia ambos lados (touch + mouse drag) en #aliveBrandsBar y #aliveBannerTrack sin disparos accidentales de modal
  assert.match(css, /\.alive-brands-bar\s*\{[\s\S]*?overflow-x:\s*auto;/);
  assert.match(css, /\.alive-banner-track\s*\{[\s\S]*?touch-action:\s*pan-x\s+pan-y;/);
  assert.match(js, /const habilitarArrastreCarrusel =/);
  assert.match(js, /const normalizarLoopMarcas =/);
  assert.match(js, /data-dragged-recently/);
});

test("12. Separación en el Panel entre Inventario (solo existencias) y Precios (Skala Venezuela vs Dist. Ontiveros)", () => {
  const SKALA_ROOT = ROOT_SKALA_GLOBAL;
  const panelDist = fs.readFileSync(path.join(ROOT, "js", "panel.js"), "utf8");
  const panelSkala = fs.readFileSync(path.join(SKALA_ROOT, "js", "panel.js"), "utf8");

  for (const [nombre, codigoPanel] of [["distribuidora", panelDist], ["skala", panelSkala]]) {
    // 1) Rutas separadas en RUTAS: inventario y precios
    assert.match(codigoPanel, /inventario:\s*\{\s*titulo:\s*"Inventario",\s*roles:\s*\["master",\s*"admin"\],\s*nav:\s*"mas",\s*atras:\s*"#\/mas",\s*render:\s*vInventario\s*\}/, `Ruta #/inventario en ${nombre}`);
    assert.match(codigoPanel, /precios:\s*\{\s*titulo:\s*"Precios",\s*roles:\s*\["master",\s*"admin"\],\s*nav:\s*"mas",\s*atras:\s*"#\/mas",\s*render:\s*vPrecios\s*\}/, `Ruta #/precios en ${nombre}`);

    // 2) En el menú Más (vMas): 2 opciones independientes ("Inventario" solo existencias y "Precios" solo precios)
    assert.match(codigoPanel, /\["#\/inventario",\s*"Inventario",\s*"Ajustar existencias, entradas de mercancía y conteo total"\]/, `Ítem de menú Inventario en ${nombre}`);
    assert.match(codigoPanel, /\["#\/precios",\s*"Precios",\s*"Ajustar precios de Skala Venezuela o Dist\. Ontiveros"\]/, `Ítem de menú Precios en ${nombre}`);
    assert.doesNotMatch(codigoPanel, /\["#\/inventario",\s*"Inventario y precios"/, `Ya no están mezclados Inventario y precios en ${nombre}`);

    // 3) vInventario contiene ajuste de stock/existencias + selector de modalidad de venta (Caja/Bulto o Unidad/Blíster) y no controles de precios
    const matchInv = codigoPanel.match(/async function vInventario\(v, _p, _q, vigente\) \{[\s\S]*?\n  \}\n\n  \/\* ---------- Precios/);
    assert.ok(matchInv, `Función vInventario encontrada en ${nombre}`);
    assert.match(matchInv[0], /data-inv="entrada">Ajustar stock<\/button>/, `Botón Ajustar stock en vInventario (${nombre})`);
    assert.match(matchInv[0], /data-modo-venta="caja"[^>]*>📦 Caja \/ Bulto<\/button>/, `Botón Caja / Bulto en vInventario (${nombre})`);
    assert.match(matchInv[0], /data-modo-venta="unidad"[^>]*>🧴 Unidad \/ Blíster<\/button>/, `Botón Unidad / Blíster en vInventario (${nombre})`);
    assert.match(matchInv[0], /data-modo-venta="ambos"[^>]*>📦\+🧴 Ambos<\/button>/, `Botón Ambos en vInventario (${nombre})`);
    assert.match(matchInv[0], /name="modo_venta" value="caja"/, `Selector de Caja / Bulto dentro del modal de Ajustar stock (${nombre})`);
    assert.match(matchInv[0], /name="modo_venta" value="unidad"/, `Selector de Unidad / Blíster dentro del modal de Ajustar stock (${nombre})`);
    assert.doesNotMatch(matchInv[0], /secPreciosGrupo/, `vInventario no mezcla precios por grupo (${nombre})`);
    assert.doesNotMatch(matchInv[0], /btnPreciosVarios/, `vInventario no mezcla barra de precios (${nombre})`);
    assert.doesNotMatch(matchInv[0], /data-inv="precio"/, `vInventario no muestra botón de precio (${nombre})`);

    // 4) vPrecios tiene el selector entre Skala Venezuela y Dist. Ontiveros y filtra grupos + productos
    const matchPre = codigoPanel.match(/async function vPrecios\(v, _p, query, vigente\) \{[\s\S]*?\n  \}\n\n  \/\* ---------- Cargar inventario/);
    assert.ok(matchPre, `Función vPrecios encontrada en ${nombre}`);
    assert.match(matchPre[0], /id="preCatalogoTabs"/, `Selector #preCatalogoTabs en vPrecios (${nombre})`);
    assert.match(matchPre[0], /data-cat-precios="skala">🌸 Skala Venezuela<\/button>/, `Opción Skala Venezuela en vPrecios (${nombre})`);
    assert.match(matchPre[0], /data-cat-precios="distribuidora">🏢 Dist\. Ontiveros<\/button>/, `Opción Dist. Ontiveros en vPrecios (${nombre})`);
    assert.match(matchPre[0], /id="secPreciosGrupo"/, `Sección de precios por grupo en vPrecios (${nombre})`);
    assert.match(matchPre[0], /id="preLista"/, `Lista de precios de productos en vPrecios (${nombre})`);
    assert.match(matchPre[0], /id="btnPreciosVarios"/, `Botón Poner precios a varios en vPrecios (${nombre})`);
    assert.doesNotMatch(matchPre[0], /check-unidad-grp/, `vPrecios no muestra casilla 'Permitir venta por unidad' (eso vive en Inventario) (${nombre})`);
  }
});

test("13. Presentaciones exactas (Aliclean 350/750, Alident 100g/75g, Dorco, Harmony, Toallas 72pqts, Pañales 12pqts + XXXG) y precios individuales fáciles de ajustar", () => {
  const SKALA_ROOT = ROOT_SKALA_GLOBAL;
  const panelDist = fs.readFileSync(path.join(ROOT, "js", "panel.js"), "utf8");
  const panelSkala = fs.readFileSync(path.join(SKALA_ROOT, "js", "panel.js"), "utf8");
  const bloquePreDist = panelDist.slice(panelDist.indexOf("function gruposDeCatalogoParaPrecios"), panelDist.indexOf("/* ---------- Cargar inventario"));
  const bloquePreSkala = panelSkala.slice(panelSkala.indexOf("function gruposDeCatalogoParaPrecios"), panelSkala.indexOf("/* ---------- Cargar inventario"));
  assert.equal(
    bloquePreDist,
    bloquePreSkala,
    "panel.js comparte exactamente la misma implementación de gruposDeCatalogoParaPrecios, vInventario y vPrecios en ambos repositorios"
  );

  const mapa = allProductsMap();

  // 1) Aliclean dividido en 2 presentaciones con sus fragancias y distintos precios: 350ml (3 fragancias, 24 envases/cja) y 750ml (2 fragancias, 12 envases/cja)
  const alv350 = GRUPOS_DISTRIBUIDORA.find((g) => g.id === "GRP-ALV-LAV");
  const alv750 = GRUPOS_DISTRIBUIDORA.find((g) => g.id === "GRP-ALV-LAV-750");
  assert.ok(alv350 && alv750, "Existen ambos grupos de Aliclean: 350ml y 750ml");
  assert.equal(alv350.unidades, 24);
  assert.equal(alv350.variantes.length, 3);
  assert.equal(alv750.unidades, 12);
  assert.equal(alv750.variantes.length, 2);
  assert.notEqual(alv350.precioMenor, alv750.precioMenor, "Aliclean 350ml y 750ml manejan distintos precios");

  // 2) Alisoft y Toallín manejan distintos precios por presentación
  const grpPap = GRUPOS_DISTRIBUIDORA.find((g) => g.id === "GRP-ALV-PAP");
  const grpToaAbs = GRUPOS_DISTRIBUIDORA.find((g) => g.id === "GRP-ALV-TOA-ABS");
  assert.equal(grpPap.preciosDistintos, true, "Alisoft marca preciosDistintos: true");
  assert.equal(new Set(grpPap.variantes.map((v) => v.precioMenor)).size, 4, "Las 4 presentaciones de Alisoft (215, 300, 400, 600 hojas) tienen precios distintos");
  assert.equal(grpToaAbs.preciosDistintos, true, "Toallín marca preciosDistintos: true");
  assert.notEqual(grpToaAbs.variantes[0].precioMenor, grpToaAbs.variantes[1].precioMenor, "Los 2 modelos de Toallín manejan distintos precios");

  // 3) Afeitadoras Dorco Pace 3: 1 caja = 12 blísters · 1 blíster = 12 pqts de 3 afeitadoras
  const grpDorco = GRUPOS_DISTRIBUIDORA.find((g) => g.id === "GRP-DOR-PACE3");
  assert.equal(grpDorco.unidades, 12, "Dorco: 1 caja = 12 blísters");
  assert.match(grpDorco.unidad, /12 pqts/i, "Dorco especifica 1 blíster = 12 pqts de 3 afeitadoras");

  // 4) Shampoo Alive 250ml: línea de 8 variaciones (4 disponibles actualmente)
  const grpSha250 = GRUPOS_DISTRIBUIDORA.find((g) => g.id === "GRP-ALV-SHA-250");
  assert.equal(grpSha250.variacionesLineaTotal, 8);
  assert.equal(grpSha250.variantes.length, 4);

  // 5) Crema Dental Alident 100g (1 cja = 8 blísters × 12 und) y 75g (1 cja = 10 blísters × 12 und)
  const grpDen100 = GRUPOS_DISTRIBUIDORA.find((g) => g.id === "GRP-ALV-DEN");
  const grpDen75 = GRUPOS_DISTRIBUIDORA.find((g) => g.id === "GRP-ALV-DEN-75G");
  assert.ok(grpDen100 && grpDen75, "Existen Alident 100g y Alident 75g");
  assert.equal(grpDen100.unidades, 8, "Alident 100g: 1 cja = 8 blísters × 12 und");
  assert.match(grpDen100.unidad, /blísters ×12 und/);
  assert.equal(grpDen75.unidades, 10, "Alident 75g: 1 cja = 10 blísters × 12 und");
  assert.match(grpDen75.unidad, /blísters ×12 und/);
  assert.equal(grpDen75.variantes.length, 10);
  assert.ok(mapa["ALV-DEN75-01"] && mapa["ALV-DEN75-10"], "Códigos ALV-DEN75-01..10 presentes en allProductsMap()");

  // 6) Toallas Femeninas 245mm, 290mm, 340mm y Protectores: todas las cajas traen 72 pqts y manejan distintos precios
  const grpToaFem = GRUPOS_DISTRIBUIDORA.find((g) => g.id === "GRP-ALV-TOA-FEM");
  assert.equal(grpToaFem.unidades, 72, "Todas las cajas de toallas y protectores traen 72 pqts");
  assert.equal(grpToaFem.preciosDistintos, true);
  assert.equal(new Set(grpToaFem.variantes.map((v) => v.precioMenor)).size, 4, "245mm, 290mm, 340mm y Protectores manejan distintos precios");

  // 7) Jabón Harmony 135g (1 cja = 48 und) y Jabón Harmony Pequeño Fruit (1 cja = 72 und)
  const grpHarMilky = GRUPOS_DISTRIBUIDORA.find((g) => g.id === "GRP-HAR-MILKY");
  const grpHarFruity = GRUPOS_DISTRIBUIDORA.find((g) => g.id === "GRP-HAR-FRUITY");
  assert.equal(grpHarMilky.unidades, 48, "Jabón Harmony 135g: 1 cja = 48 und");
  assert.equal(grpHarFruity.unidades, 72, "Jabón Harmony Pequeño (Fruit): 1 cja = 72 und");

  // 8) Pañales Baby Finger: todos los bultos llevan 12 pqts, incluye Talla XXXG (BF-PAN-XXXG) y manejan distintos precios
  const grpPan = GRUPOS_DISTRIBUIDORA.find((g) => g.id === "GRP-BF-PAN");
  assert.equal(grpPan.unidades, 12, "Todos los bultos de pañales llevan 12 pqts");
  assert.equal(grpPan.preciosDistintos, true);
  const varXxxg = grpPan.variantes.find((v) => v.code === "BF-PAN-XXXG");
  assert.ok(varXxxg, "Catálogo incluye Pañal Baby Finger Talla XXXG (BF-PAN-XXXG)");
  assert.match(varXxxg.fragancia, /Talla XXXG/);

  // 9) En gruposDeCatalogoParaPrecios('distribuidora'), cada presentación con precio distinto tiene su propio renglón de ajuste rápido
  const matchGruposPreFn = panelDist.match(/function gruposDeCatalogoParaPrecios\(cat\) \{[\s\S]*?\n  \}/);
  assert.ok(matchGruposPreFn, "Existe gruposDeCatalogoParaPrecios en panel.js");
  const ctxPre = {
    allProductsMap,
    esProductoSkala: (c) => /^(BC|KT)-/i.test(String(c || "")),
  };
  vm.createContext(ctxPre);
  vm.runInContext(matchGruposPreFn[0] + "\nthis.gruposDeCatalogoParaPrecios = gruposDeCatalogoParaPrecios;", ctxPre);
  const listaPreciosDist = ctxPre.gruposDeCatalogoParaPrecios("distribuidora");
  const idsPrecios = listaPreciosDist.map((x) => x.id);

  for (const idEsperado of [
    "GRP-ALV-LAV",
    "GRP-ALV-LAV-750",
    "GRP-DOR-PACE3",
    "GRP-ALV-SHA-250",
    "GRP-ALV-DEN",
    "GRP-ALV-DEN-75G",
    "GRP-HAR-MILKY",
    "GRP-HAR-FRUITY",
    "ALV-PAP-01",
    "ALV-PAP-02",
    "ALV-PAP-03",
    "ALV-PAP-04",
    "ALV-TOAABS-01",
    "ALV-TOAABS-02",
    "ALV-TOAFEM-01",
    "ALV-TOAFEM-02",
    "ALV-TOAFEM-03",
    "ALV-TOAFEM-04",
    "BF-PAN-P20",
    "BF-PAN-P10",
    "BF-PAN-M18",
    "BF-PAN-G18",
    "BF-PAN-XG16",
    "BF-PAN-XXG16",
    "BF-PAN-XXXG",
    "ALV-PAN-ADM",
    "ALV-PAN-ADXG",
  ]) {
    assert.equal(idsPrecios.includes(idEsperado), true, `En #/precios aparece renglón directo para ajustar precio de ${idEsperado}`);
  }
});

test("14. Selección por Caja y por Unidad / Blíster en #fragModal y Panel (#/nuevo)", () => {
  const htmlDist = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const cssDist = fs.readFileSync(path.join(ROOT, "css", "styles.css"), "utf8");
  const mainDist = fs.readFileSync(path.join(ROOT, "js", "main-distribuidora.js"), "utf8");
  const panelDist = fs.readFileSync(path.join(ROOT, "js", "panel.js"), "utf8");

  // 1) #fragToolbar y #fragModoSwitch NO están ocultos por CSS forzado en #fragModal
  assert.doesNotMatch(
    cssDist,
    /\.modal-fragancias\s+\.frag-toolbar\s*,/,
    ".frag-toolbar no debe estar forzado a display:none en #fragModal"
  );
  assert.match(htmlDist, /<div class="frag-toolbar" id="fragToolbar">/);
  assert.match(htmlDist, /id="fragModoSwitch"/);
  assert.match(htmlDist, /id="btnModoCaja"/);
  assert.match(htmlDist, /id="btnModoUnidad"/);

  // 2) Evaluar renderFragModalContent en modo "caja" y modo "unidad"
  const matchRenderFrag = mainDist.match(/function renderFragModalContent\(\) \{[\s\S]*?\n\}/);
  assert.ok(matchRenderFrag, "Existe renderFragModalContent en main-distribuidora.js");

  const det1kg = GRUPOS_DISTRIBUIDORA.find((g) => g.id === "GRP-ALV-DET-1KG");
  const mockFragGrid = { innerHTML: "", className: "" };
  const mockSummary = { innerHTML: "" };
  const mockHint = { hidden: true, innerHTML: "" };
  const mockElements = {
    fragGrid: mockFragGrid,
    fragSummaryText: mockSummary,
    fragHintBanner: mockHint,
  };
  const stateSim = {
    grupoActivoId: "GRP-ALV-DET-1KG",
    modoVentaActual: "caja",
    cart: {},
  };

  const fragCtx = {
    state: stateSim,
    GRUPOS_DISTRIBUIDORA,
    MIN_UNIDADES_SUELTAS: 6,
    document: {
      getElementById: (id) => mockElements[id] || null,
    },
    escapeHtml: (s) => String(s ?? ""),
    formatUSD: (n) => "$" + Number(n || 0).toFixed(2),
    esTarifaMayor: () => false,
    cfgGrupo: () => ({
      permiteUnidad: true,
      soloUnidad: false,
      precioMenor: det1kg.precioMenor,
      precioMayor: det1kg.precioMayor,
      precioUnidad: det1kg.precioUnidad,
    }),
    getItemQty: (code) => stateSim.cart[code] || { cajas: 0, unidades: 0 },
    precioVariante: (code) => {
      const v = det1kg.variantes.find((x) => x.code === code) || det1kg.variantes[0];
      return {
        precioMenor: v.precioMenor ?? det1kg.precioMenor,
        precioMayor: v.precioMayor ?? det1kg.precioMayor,
        precioUnidad: v.precioUnidad ?? det1kg.precioUnidad,
      };
    },
    esVarianteAgotada: (code) => code === "ALV-DET1K-02",
    actualizarPieFragModal: () => {},
  };
  vm.createContext(fragCtx);
  vm.runInContext(matchRenderFrag[0] + "\nthis.renderFragModalContent = renderFragModalContent;", fragCtx);

  // En modo caja muestra referencia de precio por caja y también precio por unidad
  fragCtx.renderFragModalContent();
  assert.match(mockFragGrid.innerHTML, /\$16\.80 \/ cj · Mayor: \$15\.60 · Und: \$1\.45/);

  // La variante agotada (ALV-DET1K-02) queda al final en gris con etiqueta "Agotado"
  const ordenCodigos = [...mockFragGrid.innerHTML.matchAll(/data-frag-row="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ordenCodigos[ordenCodigos.length - 1], "ALV-DET1K-02", "La variante sin existencias queda al final de #fragGrid");
  assert.match(mockFragGrid.innerHTML, /class="frag-card\s+sin-stock agotado"[^>]*data-frag-row="ALV-DET1K-02"/);

  // Al cambiar a modo unidad muestra precio por unidad ($1.45 / und), botones rápidos (+6, 12, 24) y controles de cantidad
  stateSim.modoVentaActual = "unidad";
  stateSim.cart["ALV-DET1K-01"] = { cajas: 0, unidades: 6 };
  fragCtx.renderFragModalContent();
  assert.match(mockFragGrid.innerHTML, /\$1\.45 \/ und · Caja: \$16\.80/);
  assert.match(mockFragGrid.innerHTML, /data-quick-und="6"/);
  assert.match(mockFragGrid.innerHTML, /data-quick-und="12"/);
  assert.match(mockFragGrid.innerHTML, /data-quick-und="24"/);
  assert.match(mockFragGrid.innerHTML, /✓ 6 und/);

  // 3) En panel.js (#/nuevo), permiteUnidades está activo por defecto en el catálogo de Distribuidora
  assert.match(panelDist, /const permiteUnidades = esDist\s*\|\|/);
});

test("15. Paridad visual del catálogo en Panel (#/nuevo) y productos sin existencias al final en gris", () => {
  const panelDist = fs.readFileSync(path.join(ROOT, "js", "panel.js"), "utf8");
  const panelCss = fs.readFileSync(path.join(ROOT, "css", "panel.css"), "utf8");

  // 1) Las tarjetas de #/nuevo usan la misma estructura visual que el catálogo principal (.pcard-top, .pcard-img-wrap 4:3, .pcard-body, .pcard-qty)
  assert.match(panelDist, /<div class="pcard-top">/);
  assert.match(panelDist, /<strong class="pcard-title">\$\{esc\(p\.name\)\}<\/strong>/);
  assert.match(panelDist, /<div class="pcard-top-right">/);
  assert.match(panelDist, /<span class="pcard-pack-chip">/);
  assert.match(panelDist, /<div class="pcard-img-wrap">/);
  assert.match(panelDist, /<div class="pcard-body">/);

  // 2) En panel.js, los productos sin existencias (.sin-stock / .agotado) se ordenan al final de #nLista preservando data-idx
  assert.match(panelDist, /const agA = a\.classList\.contains\("sin-stock"\) \? 1 : 0;/);
  assert.match(panelDist, /const agB = b\.classList\.contains\("sin-stock"\) \? 1 : 0;/);
  assert.match(panelDist, /return \(Number\(a\.dataset\.idx\) \|\| 0\) - \(Number\(b\.dataset\.idx\) \|\| 0\);/);

  // 3) En panel.css, las tarjetas .pcard.sin-stock / .pcard.agotado tienen order: 1, filtro gris (grayscale(1)) y badge gris (#6b6760)
  assert.match(panelCss, /\.pcard\.sin-stock[\s\S]*?order:\s*1/);
  assert.match(panelCss, /filter:\s*grayscale\(1\)/);
  assert.match(panelCss, /#6b6760/);

  // 4) El catálogo principal no muestra el engranaje de configuración (#btnConfigUnidades), solo se ajusta desde el Panel (#/inventario)
  const htmlDist = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.doesNotMatch(htmlDist, /id="btnConfigUnidades"/);
});
