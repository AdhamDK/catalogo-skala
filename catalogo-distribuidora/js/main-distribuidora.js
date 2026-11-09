/* ============================================================
   Distribuciones Ontiveros — Lógica Principal del Catálogo (Estilo Alive Cosmetic)
   - Paridad completa de experiencia e interacciones con catalogo-skala
   - 22 Grupos de Productos con Selector de Fragancias / Variantes
   - Compra por Caja/Bulto o por Unidad (con mínimo sugerido de 6 unidades)
   - Formas de pago con estrellas, búsqueda de cliente, GPS, confeti y CRM
   ============================================================ */

const STORAGE_KEY_DIST = "dist_ontiveros_cart_v1";
const STORAGE_KEY_CFG_DIST = "dist_ontiveros_config_grupos_v1";
const STORAGE_KEY_PANEL = "skala_pedido_v1";
const STORAGE_KEY_CLI_DIST = "dist_ontiveros_cliente_web_v1";
const STORAGE_KEY_VEND_DIST = "dist_ontiveros_vendedores_v1";

function loadClienteWebDist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLI_DIST);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function saveClienteWebDist(c) {
  try {
    if (c) localStorage.setItem(STORAGE_KEY_CLI_DIST, JSON.stringify(c));
    else localStorage.removeItem(STORAGE_KEY_CLI_DIST);
  } catch (_) {}
}

function loadVendedoresDist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VEND_DIST);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/* Estado del carrito:
   cart[code] = { cajas: number, unidades: number } */
const state = {
  cat: "todos",
  search: "",
  marca: "todas",
  cart: loadCart(),
  configGrupos: loadConfigGrupos(),
  grupoActivoId: null,
  modoVentaActual: "caja", // "caja" | "unidad"
  fragActivaPorGrupo: {},  // grupoId -> code de la fragancia activa en la tarjeta
  modoPorGrupo: {},        // grupoId -> "caja" | "unidad" en la tarjeta directa
  pago: "efectivo_pronto",
  pagosAbiertos: false,
  datosCliAbiertos: false,
  clienteWeb: loadClienteWebDist(),
  ubicacion: null,
  vendedores: loadVendedoresDist(),
  ultimoMensajeWa: "",
  ultimoRefWeb: "",
};

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DIST);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const clean = {};
    if (parsed && typeof parsed === "object") {
      for (const [code, val] of Object.entries(parsed)) {
        if (typeof val === "number" && val > 0) {
          clean[code] = { cajas: Math.floor(val), unidades: 0 };
        } else if (val && typeof val === "object") {
          const c = Math.max(0, Math.floor(Number(val.cajas) || 0));
          const u = Math.max(0, Math.floor(Number(val.unidades) || 0));
          if (c > 0 || u > 0) clean[code] = { cajas: c, unidades: u };
        }
      }
    }
    return clean;
  } catch (e) {
    return {};
  }
}

function saveCart() {
  try {
    localStorage.setItem(STORAGE_KEY_DIST, JSON.stringify(state.cart));
    sincronizarCarritoConPanel();
  } catch (e) {}
}

/* Sincroniza con skala_pedido_v1 para que al pasar al Panel del Vendedor se carguen los ítems */
function sincronizarCarritoConPanel() {
  try {
    const mapPanel = {};
    for (const [code, item] of Object.entries(state.cart)) {
      const cj = Number(item.cajas) || 0;
      const und = Number(item.unidades) || 0;
      if (cj > 0) mapPanel[code] = cj;
      else if (und > 0) mapPanel[code] = 1;
    }
    localStorage.setItem(STORAGE_KEY_PANEL, JSON.stringify(mapPanel));
  } catch (e) {}
}

function loadConfigGrupos() {
  const defaults = {};
  GRUPOS_DISTRIBUIDORA.forEach((g) => {
    defaults[g.id] = {
      permiteUnidad: g.permiteUnidad !== false,
      precioMenor: g.precioMenor,
      precioMayor: g.precioMayor,
      precioUnidad: g.precioUnidad,
    };
  });
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CFG_DIST);
    if (!raw) return defaults;
    const saved = JSON.parse(raw);
    for (const [id, val] of Object.entries(saved || {})) {
      if (!val || typeof val !== "object") continue;
      const base = defaults[id] || {};
      defaults[id] = {
        ...base,
        ...val,
        permiteUnidad: typeof val.permiteUnidad === "boolean" ? val.permiteUnidad : (typeof base.permiteUnidad === "boolean" ? base.permiteUnidad : true),
        precioMenor: Number(val.precioMenor) > 0 ? Number(val.precioMenor) : (base.precioMenor || 0),
        precioMayor: Number(val.precioMayor) > 0 ? Number(val.precioMayor) : (base.precioMayor || 0),
        precioUnidad: Number(val.precioUnidad) > 0 ? Number(val.precioUnidad) : (base.precioUnidad || 0),
      };
    }
    return defaults;
  } catch (e) {
    return defaults;
  }
}

function saveConfigGrupos() {
  try {
    localStorage.setItem(STORAGE_KEY_CFG_DIST, JSON.stringify(state.configGrupos));
  } catch (e) {}
}

function cfgGrupo(grupoId) {
  const g = GRUPOS_DISTRIBUIDORA.find((x) => x.id === grupoId);
  const cfg = state.configGrupos[grupoId] || {};
  let modoInv = cfg.modoVenta || "";
  try {
    const rawModo = localStorage.getItem("skala_modalidad_venta_v1");
    if (rawModo && g && Array.isArray(g.variantes)) {
      const mapM = JSON.parse(rawModo) || {};
      const modosVar = g.variantes.map((v) => mapM[String(v.code || "").toUpperCase()]).filter(Boolean);
      if (modosVar.length) {
        if (modosVar.every((m) => m === "caja")) modoInv = "caja";
        else if (modosVar.every((m) => m === "unidad")) modoInv = "unidad";
        else modoInv = "ambos";
      }
    }
  } catch (_) {}
  const permiteUnd = modoInv === "caja"
    ? false
    : (modoInv === "unidad" || modoInv === "ambos")
      ? true
      : (typeof cfg.permiteUnidad === "boolean" ? cfg.permiteUnidad : (g ? g.permiteUnidad !== false : true));
  return {
    permiteUnidad: permiteUnd,
    soloUnidad: modoInv === "unidad",
    modoVenta: modoInv || (permiteUnd ? "ambos" : "caja"),
    precioMenor: Number(cfg.precioMenor) > 0 ? Number(cfg.precioMenor) : (g ? g.precioMenor : 0),
    precioMayor: Number(cfg.precioMayor) > 0 ? Number(cfg.precioMayor) : (g ? g.precioMayor : 0),
    precioUnidad: Number(cfg.precioUnidad) > 0 ? Number(cfg.precioUnidad) : (g ? g.precioUnidad : 0),
  };
}

function precioVariante(code) {
  const map = allProductsMap();
  const p = map[code];
  if (!p) return { precioMenor: 0, precioMayor: 0, precioUnidad: 0, permiteUnidad: true };
  const cfgGrp = cfgGrupo(p.grupoId);
  const cfgVar = state.configGrupos[code] || null;
  let prApi = null;
  try {
    if (typeof SkalaAPI !== "undefined" && typeof SkalaAPI.preciosMapa === "function") {
      const m = SkalaAPI.preciosMapa();
      if (m && m[code]) prApi = m[code];
    }
  } catch (_) {}
  if (cfgVar && Number(cfgVar.precioMenor) > 0) {
    return {
      permiteUnidad: cfgGrp.permiteUnidad,
      precioMenor: Number(cfgVar.precioMenor),
      precioMayor: Number(cfgVar.precioMayor) > 0 ? Number(cfgVar.precioMayor) : Number(cfgVar.precioMenor),
      precioUnidad: Number(cfgVar.precioUnidad) > 0
        ? Number(cfgVar.precioUnidad)
        : Math.round((Number(cfgVar.precioMenor) / (p.unidades || 12)) * 100) / 100,
    };
  }
  if (prApi && Number(prApi.menor) > 0) {
    return {
      permiteUnidad: cfgGrp.permiteUnidad,
      precioMenor: Number(prApi.menor),
      precioMayor: Number(prApi.mayor) > 0 ? Number(prApi.mayor) : Number(prApi.menor),
      precioUnidad: p.preciosDistintos && Number(p.precioUnidad) > 0
        ? Number(p.precioUnidad)
        : Math.round((Number(prApi.menor) / (p.unidades || 12)) * 100) / 100,
    };
  }
  if (p.preciosDistintos) {
    return {
      permiteUnidad: cfgGrp.permiteUnidad,
      precioMenor: Number(p.precioMenor) || cfgGrp.precioMenor,
      precioMayor: Number(p.precioMayor) || cfgGrp.precioMayor,
      precioUnidad: Number(p.precioUnidad) || cfgGrp.precioUnidad,
    };
  }
  return cfgGrp;
}

function esVarianteAgotada(code) {
  try {
    const map = allProductsMap();
    const p = map && map[code];
    if (p && p.agotado) return true;
    if (typeof SkalaAPI !== "undefined" && typeof SkalaAPI.preciosMapa === "function") {
      const m = SkalaAPI.preciosMapa();
      const pr = m && m[code];
      if (pr && (pr.agotado || (pr.controlado && Number(pr.disponible) <= 0))) return true;
    }
  } catch (_) {}
  return false;
}

function esGrupoAgotado(g) {
  if (!g) return false;
  if (g.agotado) return true;
  return Array.isArray(g.variantes) && g.variantes.length > 0 && g.variantes.every((v) => v.agotado || esVarianteAgotada(v.code));
}

function getItemQty(code) {
  const it = state.cart[code];
  return it ? { cajas: it.cajas || 0, unidades: it.unidades || 0 } : { cajas: 0, unidades: 0 };
}

function setFragQty(code, modo, qty) {
  const n = Math.max(0, Math.min(999, Math.floor(Number(qty) || 0)));
  const actual = getItemQty(code);
  if (modo === "unidad") {
    actual.unidades = n;
  } else {
    actual.cajas = n;
  }
  if (actual.cajas <= 0 && actual.unidades <= 0) {
    delete state.cart[code];
  } else {
    state.cart[code] = actual;
  }
  saveCart();
  updateCartUI();
}

function resumenGrupoEnCarrito(grupo) {
  let cajas = 0;
  let unidades = 0;
  let refs = 0;
  grupo.variantes.forEach((v) => {
    const q = getItemQty(v.code);
    if (q.cajas > 0 || q.unidades > 0) refs++;
    cajas += q.cajas;
    unidades += q.unidades;
  });
  return { cajas, unidades, refs };
}

function totalCajas() {
  return Object.values(state.cart).reduce((acc, it) => acc + (Number(it.cajas) || 0), 0);
}

function totalUnidadesSueltas() {
  return Object.values(state.cart).reduce((acc, it) => acc + (Number(it.unidades) || 0), 0);
}

function esTarifaMayor() {
  return totalCajas() >= META_CAJAS;
}

function calcularSubtotalBase() {
  const map = allProductsMap();
  const mayor = esTarifaMayor();
  let subtotal = 0;
  for (const [code, it] of Object.entries(state.cart)) {
    const p = map[code];
    if (!p) continue;
    const pv = precioVariante(code);
    const precioCaja = mayor ? pv.precioMayor : pv.precioMenor;
    if (it.cajas > 0) subtotal += it.cajas * precioCaja;
    if (it.unidades > 0) subtotal += it.unidades * pv.precioUnidad;
  }
  return Math.round(subtotal * 100) / 100;
}

function descuentoPorPagoId(pagoId) {
  if (pagoId === "efectivo_pronto" || pagoId === "efectivo_usd") return 6;
  if (pagoId === "efectivo_credito" || pagoId === "usdt") return 4;
  if (pagoId === "pronto") return 3;
  const p = typeof pagoPorId === "function" ? pagoPorId(pagoId) : null;
  return p && Number(p.desc) > 0 ? Number(p.desc) : 0;
}

function calcularTotalesConPago(pagoId = state.pago) {
  const bruto = calcularSubtotalBase();
  const descPct = descuentoPorPagoId(pagoId);
  const ahorro = Math.round(bruto * (descPct / 100) * 100) / 100;
  const neto = Math.round((bruto - ahorro) * 100) / 100;
  return { bruto, descPct, ahorro, neto };
}

/* -------------------- Filtro de Categorías y Marcas -------------------- */
function poblarFiltroMarcas() {
  const select = document.getElementById("lineFilter");
  if (!select) return;
  const marcas = Array.from(new Set(GRUPOS_DISTRIBUIDORA.map((g) => g.marca).filter(Boolean)));
  select.innerHTML = `<option value="todas">Todas las marcas (${marcas.length})</option>` +
    marcas.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
}

function perteneceACategoriaTab(grupo, tabCat) {
  if (!tabCat || tabCat === "todos") return true;
  if (tabCat === "Detergentes") {
    return grupo.categoria === "Detergentes" || grupo.categoria === "Suavizantes";
  }
  if (tabCat === "Hogar y Papel") {
    return grupo.categoria === "Limpieza del Hogar" || grupo.categoria === "Hogar y Papel";
  }
  if (tabCat === "Cuidado Personal") {
    return grupo.categoria === "Cuidado Personal";
  }
  if (tabCat === "Bebé y Pañales") {
    return grupo.categoria === "Bebé y Pañales";
  }
  return grupo.categoria === tabCat;
}

function actualizarContadoresTabs() {
  const setTxt = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = String(n); };
  setTxt("countAll", GRUPOS_DISTRIBUIDORA.length);
  setTxt("countDet", GRUPOS_DISTRIBUIDORA.filter((g) => perteneceACategoriaTab(g, "Detergentes")).length);
  setTxt("countHog", GRUPOS_DISTRIBUIDORA.filter((g) => perteneceACategoriaTab(g, "Hogar y Papel")).length);
  setTxt("countPer", GRUPOS_DISTRIBUIDORA.filter((g) => perteneceACategoriaTab(g, "Cuidado Personal")).length);
  setTxt("countBeb", GRUPOS_DISTRIBUIDORA.filter((g) => perteneceACategoriaTab(g, "Bebé y Pañales")).length);
}

function filtrarGrupos() {
  const q = state.search.trim().toLowerCase();
  return GRUPOS_DISTRIBUIDORA.filter((g) => {
    if (!perteneceACategoriaTab(g, state.cat)) return false;
    if (state.marca !== "todas" && g.marca !== state.marca) return false;
    if (!q) return true;
    const enGrupo =
      g.nombre.toLowerCase().includes(q) ||
      (g.marca || "").toLowerCase().includes(q) ||
      g.categoria.toLowerCase().includes(q) ||
      (g.descripcion || "").toLowerCase().includes(q);
    if (enGrupo) return true;
    return g.variantes.some(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.fragancia.toLowerCase().includes(q) ||
        v.code.toLowerCase().includes(q)
    );
  });
}

function obtenerFragActivaGrupo(g) {
  const guardada = state.fragActivaPorGrupo[g.id];
  if (guardada && g.variantes.some((v) => v.code === guardada)) {
    return g.variantes.find((v) => v.code === guardada);
  }
  const conCant = g.variantes.find((v) => {
    const q = getItemQty(v.code);
    return q.cajas > 0 || q.unidades > 0;
  });
  const elegida = conCant || g.variantes[0];
  if (elegida) state.fragActivaPorGrupo[g.id] = elegida.code;
  return elegida;
}

function obtenerModoTarjetaGrupo(g) {
  const cfg = cfgGrupo(g.id);
  if (!cfg.permiteUnidad) return "caja";
  if (state.modoPorGrupo[g.id]) return state.modoPorGrupo[g.id];
  const res = resumenGrupoEnCarrito(g);
  if (res.unidades > 0 && res.cajas === 0) return "unidad";
  return "caja";
}

/* -------------------- Renderizado de Tarjetas Estilo Skala CRM + Motor de Animación 1 a 1 -------------------- */
function crearStageAnimadoHTML(g, mostrarPildora = true) {
  const srcPortada800 = g.portada800 || g.portada;
  const srcPortadaHq = g.portadaHq || srcPortada800;
  const totalVar = g.variantes.length;

  if (totalVar <= 1) {
    return `
      <picture>
        <img src="${srcPortada800}" srcset="${srcPortada800} 1x, ${srcPortadaHq} 2x" alt="${escapeHtml(g.nombre)}" width="800" height="600" loading="lazy" decoding="async" />
      </picture>
    `;
  }

  const cellsHTML = g.variantes
    .map((v, idx) => {
      const s400 = v.img400 || v.img;
      const s800 = v.img800 || s400;
      return `
        <div class="anim-cell is-visible" data-cell-idx="${idx}" title="${escapeHtml(v.fragancia)}">
          <img src="${s400}" srcset="${s400} 1x, ${s800} 2x" alt="${escapeHtml(v.fragancia)}" width="400" height="300" loading="lazy" decoding="async" />
          <span class="anim-cell-num" aria-hidden="true">${idx + 1}</span>
        </div>
      `;
    })
    .join("");

  return `
    <div class="card-anim-stage" data-anim-stage="${g.id}" data-phase="all" data-total="${totalVar}">
      <div class="anim-layer-all is-active" data-anim-all>
        <picture>
          <img src="${srcPortada800}" srcset="${srcPortada800} 1x, ${srcPortadaHq} 2x" alt="${escapeHtml(g.nombre)}" width="800" height="600" loading="lazy" decoding="async" />
        </picture>
      </div>
      <div class="anim-layer-grid" data-anim-grid data-count="${totalVar}">
        ${cellsHTML}
      </div>
      ${mostrarPildora ? `<span class="card-anim-pill" data-anim-pill>✨ Los ${totalVar} modelos</span>` : ""}
      <div class="card-anim-bar" aria-hidden="true">
        <div class="card-anim-bar-fill" data-anim-bar style="width:100%"></div>
      </div>
    </div>
  `;
}

function cardGrupoHTML(g) {
  const cfg = cfgGrupo(g.id);
  const res = resumenGrupoEnCarrito(g);
  const enCarrito = res.cajas > 0 || res.unidades > 0;
  const mayor = esTarifaMayor();
  const precioActivoCaja = mayor ? cfg.precioMayor : cfg.precioMenor;
  const totalVar = g.variantes.length;

  const partesBadge = [];
  if (res.cajas > 0) partesBadge.push(`${res.cajas} cj`);
  if (res.unidades > 0) partesBadge.push(`${res.unidades} und`);
  const txtBadge = partesBadge.length ? `✓ En pedido: ${partesBadge.join(" + ")}` : "";

  const thumbs = g.variantes.slice(0, 7).map((v, idx) =>
    `<img class="frag-avatar" data-avatar-idx="${idx}" src="${v.img400 || v.img}" alt="${escapeHtml(v.fragancia)}" title="${escapeHtml(v.fragancia)}" width="28" height="28" loading="lazy" decoding="async" />`
  ).join("");
  const extraCount = totalVar > 7 ? `<span class="frag-more" data-avatar-more>+${totalVar - 7}</span>` : "";

  // Resumen compacto de los aromas ya elegidos en este grupo
  const elegidasTxt = g.variantes
    .map((v) => {
      const q = getItemQty(v.code);
      if (q.cajas <= 0 && q.unidades <= 0) return "";
      const p = [];
      if (q.cajas > 0) p.push(`${q.cajas} cj`);
      if (q.unidades > 0) p.push(`${q.unidades} u`);
      return `<span class="card-picked-chip">✓ ${escapeHtml(v.fragancia)}: <b>${p.join("+")}</b></span>`;
    })
    .filter(Boolean)
    .join("");

  const agotadoGrp = (typeof esGrupoAgotado === "function" ? esGrupoAgotado(g) : !!g.agotado) && !enCarrito;
  return `
    <article class="card ${enCarrito ? "in-cart elegido" : ""}${agotadoGrp ? " agotado sin-stock" : ""}" data-group-card="${g.id}" data-open-group="${g.id}" style="cursor:pointer" title="Tocá para abrir las ${totalVar} fragancias">
      <div class="card-top">
        <h3 class="card-name">${escapeHtml(g.nombre)}</h3>
      </div>
      <div class="card-img">
        <span class="card-badge${agotadoGrp ? " agotado" : ""}" data-badge ${enCarrito || agotadoGrp ? "" : "hidden"}>${escapeHtml(agotadoGrp ? "Agotado" : txtBadge)}</span>
        <b class="card-n" data-grupo-badge>${res.refs}/${totalVar} Fragancias</b>
        ${crearStageAnimadoHTML(g, false)}
        <button type="button" class="card-zoom" data-zoom="${g.id}" aria-label="Ver imagen grande de ${escapeHtml(g.nombre)}" title="Ver más grande">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M11 8v6M8 11h6"/></svg>
        </button>
      </div>
      <div class="card-body">
        <div class="frag-strip" title="Tocá para ver las ${totalVar} fragancias">
          <div class="frag-avatars">${thumbs}${extraCount}</div>
        </div>

        ${elegidasTxt ? `<div class="card-picked-list">${elegidasTxt}</div>` : ""}

        <div class="card-precio" data-precio>
          ${g.preciosDistintos ? (() => {
            const preciosVars = g.variantes.map((v) => {
              const pv = precioVariante(v.code);
              return mayor ? pv.precioMayor : pv.precioMenor;
            }).filter((n) => n > 0);
            const minP = preciosVars.length ? Math.min(...preciosVars) : precioActivoCaja;
            const maxP = preciosVars.length ? Math.max(...preciosVars) : precioActivoCaja;
            return minP !== maxP
              ? `<strong>$${minP.toFixed(2)} – $${maxP.toFixed(2)}</strong> <small>/ bulto x ${g.unidades}und</small>`
              : `<strong>$${minP.toFixed(2)}</strong> <small>/ bulto x ${g.unidades}und</small>`;
          })() : `<strong>$${precioActivoCaja.toFixed(2)}</strong> <small>/ bulto x ${g.unidades}und</small>`}
        </div>
      </div>
    </article>
  `;
}

const DEFINICION_SECCIONES = [
  {
    id: "sec-detergentes",
    cat: "Detergentes",
    icono: "🫧",
    titulo: "Detergentes y Hogar",
    subtitulo: "Detergentes en polvo Alive y A-Z, jabón en panela y barra, suavizantes textiles y lavaplatos concentrado Aliclean (350ml y 750ml).",
    ids: [
      "GRP-ALV-DET-1KG",
      "GRP-AZ-DET",
      "GRP-ALV-DET-500G",
      "GRP-ALV-PAN-150G",
      "GRP-JAB-POPULAR",
      "GRP-ALV-SUA-1L",
      "GRP-ALV-LAV",
      "GRP-ALV-LAV-750",
    ],
  },
  {
    id: "sec-personal",
    cat: "Cuidado Personal",
    icono: "✨",
    titulo: "Cuidado Personal",
    subtitulo: "Baños de crema, lociones corporales, shampoos y acondicionadores Alive, crema dental Alident (100g y 75g), jabones Anita y Harmony, toallas femeninas y línea Skala Brasil.",
    ids: [
      "GRP-ALV-CAP",
      "GRP-ALV-LOC",
      "GRP-ALV-SHA-350",
      "GRP-ALV-SHA-250",
      "GRP-ALV-DEN",
      "GRP-ALV-DEN-75G",
      "GRP-ALV-JAB-ANITA",
      "GRP-ALV-TOA-FEM",
      "GRP-HAR-MILKY",
      "GRP-HAR-FRUITY",
      "GRP-SKL-BANOS-DIST",
      "GRP-SKL-KITS-DIST",
    ],
  },
  {
    id: "sec-papel",
    cat: "Hogar y Papel",
    icono: "🌿",
    titulo: "Papel y Multiusos",
    subtitulo: "Línea papelera 100% material virgen Alisoft (215 a 600 hojas), Toallín absorbente de cocina, Espiral Bernice y Afeitadoras Dorco Pace 3.",
    ids: ["GRP-ALV-PAP", "GRP-ALV-TOA-ABS", "GRP-BER-ESP", "GRP-DOR-PACE3"],
  },
  {
    id: "sec-bebe",
    cat: "Bebé y Pañales",
    icono: "👶",
    titulo: "Bebé y Pañales",
    subtitulo: "Pañales Baby Finger por talla (P a XXXG y Adulto · 12 pqts/bulto), toallas húmedas y cuidado diario del bebé.",
    ids: ["GRP-BF-PAN", "GRP-BF-THU", "GRP-BF-CUI"],
  },
];

function renderCatalog() {
  const grid = document.getElementById("catalogGrid");
  const empty = document.getElementById("catalogEmpty");
  if (!grid) return;
  const lista = filtrarGrupos();
  if (!lista.length) {
    grid.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const mapaVisible = Object.fromEntries(lista.map((g) => [g.id, g]));
  const usados = new Set();
  const bloquesHTML = [];

  DEFINICION_SECCIONES.forEach((sec) => {
    const gruposSec = sec.ids.map((id) => mapaVisible[id]).filter(Boolean).sort((a, b) => {
      const agA = esGrupoAgotado(a) ? 1 : 0;
      const agB = esGrupoAgotado(b) ? 1 : 0;
      return agA - agB;
    });
    if (!gruposSec.length) return;
    gruposSec.forEach((g) => usados.add(g.id));

    bloquesHTML.push(`
      <div class="cat-seccion-bloque" id="${sec.id}" data-seccion-cat="${escapeHtml(sec.cat)}">
        <div class="cat-seccion-header">
          <span class="cat-seccion-icono" aria-hidden="true">${sec.icono}</span>
          <div class="cat-seccion-titles">
            <div class="cat-seccion-title-row">
              <h3>${escapeHtml(sec.titulo)}</h3>
              <span class="cat-seccion-count">${gruposSec.length} ${gruposSec.length === 1 ? "producto" : "productos"}</span>
            </div>
            <p>${escapeHtml(sec.subtitulo)}</p>
          </div>
        </div>
        <div class="grid cat-seccion-grid">
          ${gruposSec.map(cardGrupoHTML).join("")}
        </div>
      </div>
    `);
  });

  // Cualquier grupo adicional que no esté en DEFINICION_SECCIONES
  const restantes = lista.filter((g) => !usados.has(g.id));
  if (restantes.length) {
    bloquesHTML.push(`
      <div class="cat-seccion-bloque">
        <div class="grid cat-seccion-grid">
          ${restantes.map(cardGrupoHTML).join("")}
        </div>
      </div>
    `);
  }

  grid.innerHTML = bloquesHTML.join("");
  iniciarAnimacionesTarjetas();
}

/* -------------------- Motor de Animación Cíclica 1 a 1 en Tarjetas (iniciarAnimacionesTarjetas) -------------------- */
let cardAnimObserver = null;
const cardAnimStates = new Map();

function hidratarTarjetasDestacadasAnimadas() {
  document.querySelectorAll("#aliveFeaturedTrack .alive-feat-card[data-open-group]").forEach((card) => {
    if (card.dataset.animHydrated === "1") return;
    const gid = card.getAttribute("data-open-group");
    const g = GRUPOS_DISTRIBUIDORA.find((x) => x.id === gid);
    const imgWrap = card.querySelector(".alive-feat-img");
    if (g && imgWrap && g.variantes.length > 1) {
      imgWrap.innerHTML = crearStageAnimadoHTML(g, false);
      card.dataset.animHydrated = "1";
    }
  });
}

function aplicarEstadoStage(stageEl, g, step) {
  const total = g.variantes.length;
  const allLayer = stageEl.querySelector("[data-anim-all]");
  const gridLayer = stageEl.querySelector("[data-anim-grid]");
  const pillEl = stageEl.querySelector("[data-anim-pill]");
  const barFill = stageEl.querySelector("[data-anim-bar]");
  const cells = stageEl.querySelectorAll(".anim-cell");
  const cardEl = stageEl.closest(".card");

  if (step === 0) {
    stageEl.setAttribute("data-phase", "all");
    if (allLayer) allLayer.classList.add("is-active");
    if (gridLayer) gridLayer.classList.remove("is-active", "is-complete-pulse");
    cells.forEach((c) => {
      c.classList.add("is-visible");
      c.classList.remove("is-just-added");
    });
    if (pillEl) pillEl.textContent = `✨ Los ${total} modelos`;
    if (barFill) barFill.style.width = "100%";
    if (cardEl) {
      cardEl.querySelectorAll(".frag-avatar, .frag-more").forEach((av) => av.classList.remove("is-active-anim"));
    }
    return;
  }

  if (step >= 1 && step <= total) {
    stageEl.setAttribute("data-phase", "step");
    if (allLayer) allLayer.classList.remove("is-active");
    if (gridLayer) {
      gridLayer.classList.add("is-active");
      gridLayer.classList.remove("is-complete-pulse");
    }
    cells.forEach((c, idx) => {
      c.classList.toggle("is-visible", idx < step);
      c.classList.toggle("is-just-added", idx === step - 1);
    });
    const vActiva = g.variantes[step - 1];
    if (pillEl) pillEl.textContent = `${step}/${total} · ${vActiva ? vActiva.fragancia : ""}`;
    if (barFill) barFill.style.width = `${Math.round((step / total) * 100)}%`;
    if (cardEl) {
      cardEl.querySelectorAll(".frag-avatar").forEach((av) => {
        const avIdx = Number(av.getAttribute("data-avatar-idx"));
        av.classList.toggle("is-active-anim", avIdx === step - 1);
      });
      const moreEl = cardEl.querySelector("[data-avatar-more]");
      if (moreEl) moreEl.classList.toggle("is-active-anim", step - 1 >= 7);
    }
    return;
  }

  // step === total + 1: todos los N modelos completados en la cuadrícula antes de volver a empezar
  stageEl.setAttribute("data-phase", "complete");
  if (allLayer) allLayer.classList.remove("is-active");
  if (gridLayer) {
    gridLayer.classList.add("is-active", "is-complete-pulse");
  }
  cells.forEach((c) => {
    c.classList.add("is-visible");
    c.classList.remove("is-just-added");
  });
  if (pillEl) pillEl.textContent = `✓ ${total}/${total} modelos`;
  if (barFill) barFill.style.width = "100%";
  if (cardEl) {
    cardEl.querySelectorAll(".frag-avatar, .frag-more").forEach((av) => av.classList.remove("is-active-anim"));
  }
}

function detenerTimerStage(stageEl) {
  const st = cardAnimStates.get(stageEl);
  if (st && st.timer) {
    clearTimeout(st.timer);
    st.timer = null;
  }
}

function programarSiguientePasoStage(stageEl, delayOverride) {
  const st = cardAnimStates.get(stageEl);
  if (!st || !st.visible) return;
  clearTimeout(st.timer);

  const total = st.grupo.variantes.length;
  const pasoMs = total > 10 ? 780 : 980;
  const duracion =
    typeof delayOverride === "number"
      ? delayOverride
      : st.step === 0
      ? 3200
      : st.step <= total
      ? pasoMs
      : 4200;

  st.timer = setTimeout(() => {
    if (!st.visible) return;
    if (document.body.classList.contains("modal-open") || document.hidden) {
      programarSiguientePasoStage(stageEl, 1000);
      return;
    }
    st.step = (st.step + 1) % (total + 2);
    aplicarEstadoStage(stageEl, st.grupo, st.step);
    programarSiguientePasoStage(stageEl);
  }, duracion);
}

function iniciarAnimacionesTarjetas() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  hidratarTarjetasDestacadasAnimadas();

  // Limpiar timers de nodos que ya no están en el DOM
  for (const [el, st] of cardAnimStates.entries()) {
    if (!document.body.contains(el)) {
      if (st.timer) clearTimeout(st.timer);
      if (cardAnimObserver) cardAnimObserver.unobserve(el);
      cardAnimStates.delete(el);
    }
  }

  if (!cardAnimObserver && "IntersectionObserver" in window) {
    cardAnimObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const stageEl = entry.target;
          const st = cardAnimStates.get(stageEl);
          if (!st) return;
          st.visible = entry.isIntersecting;
          if (entry.isIntersecting) {
            programarSiguientePasoStage(stageEl, 450 + (st.idx % 5) * 180);
          } else {
            detenerTimerStage(stageEl);
          }
        });
      },
      { threshold: 0.15 }
    );
  }

  const stages = document.querySelectorAll(".card-anim-stage[data-anim-stage]");
  stages.forEach((stageEl, idx) => {
    if (cardAnimStates.has(stageEl)) return;
    const gid = stageEl.getAttribute("data-anim-stage");
    const g = GRUPOS_DISTRIBUIDORA.find((x) => x.id === gid);
    if (!g || g.variantes.length <= 1) return;

    const st = { grupo: g, step: 0, timer: null, visible: false, idx };
    cardAnimStates.set(stageEl, st);
    aplicarEstadoStage(stageEl, g, 0);

    if (cardAnimObserver) {
      cardAnimObserver.observe(stageEl);
    } else {
      st.visible = true;
      programarSiguientePasoStage(stageEl, 600 + (idx % 5) * 180);
    }
  });
}

/* -------------------- Ventana Emergente de Fragancias (#fragModal): Cuadrícula Visual de Imágenes -------------------- */
function openFragModal(grupoId) {
  const g = GRUPOS_DISTRIBUIDORA.find((x) => x.id === grupoId);
  if (!g) return;
  state.grupoActivoId = g.id;
  const cfg = cfgGrupo(g.id);

  const res = resumenGrupoEnCarrito(g);
  if (cfg.soloUnidad) {
    state.modoVentaActual = "unidad";
  } else if (!cfg.permiteUnidad) {
    state.modoVentaActual = "caja";
  } else if (state.modoPorGrupo[g.id]) {
    state.modoVentaActual = state.modoPorGrupo[g.id];
  } else if (res.unidades > 0 && res.cajas === 0) {
    state.modoVentaActual = "unidad";
  } else {
    state.modoVentaActual = "caja";
  }

  const imgEl = document.getElementById("fragModalImg");
  if (imgEl) {
    const src800 = g.portada800 || g.portada;
    const srcHq = g.portadaHq || src800;
    imgEl.src = src800;
    imgEl.srcset = `${src800} 1x, ${srcHq} 2x`;
    imgEl.alt = g.nombre;
  }
  const marcaEl = document.getElementById("fragModalMarca");
  if (marcaEl) marcaEl.textContent = `${g.marca || "ALIVE"} · ${g.categoria}`.toUpperCase();
  const titleEl = document.getElementById("fragModalTitle");
  if (titleEl) titleEl.textContent = g.nombre;
  const subEl = document.getElementById("fragModalSub");
  if (subEl) {
    if (g.variacionesLineaTotal) {
      subEl.textContent = `Bulto de ${g.unidades} ${g.unidad} · ${g.variantes.length} disponibles de ${g.variacionesLineaTotal} variaciones`;
    } else if (g.preciosDistintos) {
      subEl.textContent = `Bulto de ${g.unidades} ${g.unidad} · ${g.variantes.length} presentaciones con precio según modelo/talla`;
    } else {
      subEl.textContent = `Bulto de ${g.unidades} ${g.unidad} · ${g.variantes.length} fragancias al mismo precio`;
    }
  }

  const toolbar = document.getElementById("fragToolbar") || document.querySelector("#fragModal .frag-toolbar");
  const modoSwitch = document.getElementById("fragModoSwitch");
  const btnCaja = document.getElementById("btnModoCaja");
  const btnUnidad = document.getElementById("btnModoUnidad");
  if (toolbar) toolbar.hidden = !cfg.permiteUnidad && !cfg.soloUnidad;
  if (modoSwitch) modoSwitch.hidden = !cfg.permiteUnidad && !cfg.soloUnidad;
  if (btnCaja) {
    btnCaja.hidden = Boolean(cfg.soloUnidad);
    btnCaja.textContent = g.id === "GRP-DOR-PACE3"
      ? "📦 Por Caja (=×12 blísters)"
      : `📦 Por Caja / Bulto (${g.unidades} und)`;
  }
  if (btnUnidad) {
    btnUnidad.hidden = !cfg.permiteUnidad;
    const pUndTxt = !g.preciosDistintos && Number(cfg.precioUnidad) > 0
      ? ` · $${Number(cfg.precioUnidad).toFixed(2)} c/u`
      : "";
    btnUnidad.textContent = g.id === "GRP-DOR-PACE3"
      ? `🪒 Por Blíster ($${Number(cfg.precioUnidad).toFixed(2)} c/u)`
      : `🧴 Por Unidad (mín. 6${pUndTxt})`;
  }

  renderFragModalContent();

  const modal = document.getElementById("fragModal");
  if (modal) {
    modal.hidden = false;
    document.body.classList.add("modal-open");
    const box = modal.querySelector(".modal-box");
    if (box) box.focus({ preventScroll: true });
  }
}

function closeFragModal() {
  const modal = document.getElementById("fragModal");
  if (!modal) return;
  modal.hidden = true;
  state.grupoActivoId = null;
  if (document.getElementById("orderModal")?.hidden) {
    document.body.classList.remove("modal-open");
  }
  renderCatalog();
}

function renderFragModalContent() {
  const g = GRUPOS_DISTRIBUIDORA.find((x) => x.id === state.grupoActivoId);
  if (!g) return;
  const cfg = cfgGrupo(g.id);
  const modoVentaActual = state.modoVentaActual;

  const btnCaja = document.getElementById("btnModoCaja");
  const btnUnidad = document.getElementById("btnModoUnidad");
  if (btnCaja) btnCaja.classList.toggle("is-active", modoVentaActual === "caja");
  if (btnUnidad) btnUnidad.classList.toggle("is-active", modoVentaActual === "unidad");

  const preciosInfo = document.getElementById("fragPreciosInfo");
  if (preciosInfo) {
    if (g.preciosDistintos) {
      const menores = g.variantes.map((v) => precioVariante(v.code).precioMenor).filter((n) => n > 0);
      const mayores = g.variantes.map((v) => precioVariante(v.code).precioMayor).filter((n) => n > 0);
      const minMen = menores.length ? Math.min(...menores) : cfg.precioMenor;
      const maxMen = menores.length ? Math.max(...menores) : cfg.precioMenor;
      const minMay = mayores.length ? Math.min(...mayores) : cfg.precioMayor;
      const maxMay = mayores.length ? Math.max(...mayores) : cfg.precioMayor;
      preciosInfo.innerHTML = `
        <span class="frag-price-chip">📦 Caja (${g.unidades} ${escapeHtml(g.unidad)}): <strong>$${minMen.toFixed(2)}${minMen !== maxMen ? ` – $${maxMen.toFixed(2)}` : ""}</strong></span>
        <span class="frag-price-chip">🏷️ Mayorista (15+ cj): <strong>$${minMay.toFixed(2)}${minMay !== maxMay ? ` – $${maxMay.toFixed(2)}` : ""}</strong></span>
        <span class="frag-price-chip">💡 <strong>Precios individuales por presentación abajo</strong></span>
      `;
    } else {
      preciosInfo.innerHTML = `
        <span class="frag-price-chip">📦 Caja (${g.unidades} ${escapeHtml(g.unidad)}): <strong>$${cfg.precioMenor.toFixed(2)}</strong></span>
        <span class="frag-price-chip">🏷️ Mayorista (15+ cj): <strong>$${cfg.precioMayor.toFixed(2)}</strong></span>
        ${cfg.permiteUnidad ? `<span class="frag-price-chip">${g.id === "GRP-DOR-PACE3" ? "🪒 Por Blíster" : "🧴 Por Unidad"}: <strong>$${cfg.precioUnidad.toFixed(2)} c/u</strong></span>` : ""}
      `;
    }
  }

  const hintBanner = document.getElementById("fragHintBanner");
  if (hintBanner) {
    hintBanner.innerHTML = modoVentaActual === "unidad"
      ? `👆 <strong>Tocá la imagen de cualquier fragancia para sumar</strong> (empieza en <strong>6 unidades</strong> por defecto) o tocá <strong>−</strong> para restar.`
      : `👆 <strong>Tocá la imagen de cualquier fragancia para sumar (+1 caja)</strong>, o usá el botón <strong>−</strong> para restar.`;
  }

  const fragGrid = document.getElementById("fragGrid");
  if (fragGrid) {
    fragGrid.className = "frag-grid frag-cards-grid";
    const chkAgotada = (v) => !!(v.agotado || (typeof esVarianteAgotada === "function" && esVarianteAgotada(v.code)));
    const variantesOrdenadas = [...g.variantes].sort((a, b) => {
      const agA = chkAgotada(a) ? 1 : 0;
      const agB = chkAgotada(b) ? 1 : 0;
      return agA - agB;
    });
    fragGrid.innerHTML = variantesOrdenadas.map((v) => {
      const q = getItemQty(v.code);
      const pv = precioVariante(v.code);
      const agotadaVar = chkAgotada(v) && q.cajas <= 0 && q.unidades <= 0;
      const cantModo = modoVentaActual === "unidad" ? q.unidades : q.cajas;
      const otraCant = modoVentaActual === "unidad" ? q.cajas : q.unidades;
      const otraEtiqueta = modoVentaActual === "unidad"
        ? (otraCant > 0 ? `+ ${otraCant} cj` : "")
        : (otraCant > 0 ? `+ ${otraCant} und` : "");
      const unidadCorto = modoVentaActual === "unidad"
        ? (g.id === "GRP-DOR-PACE3" ? "blíster" : "und")
        : (cantModo === 1 ? "caja" : "cajas");

      const srcVar800 = v.img800 || v.img;
      const srcVarHq = v.imgHq || srcVar800;

      const etqModoUnd = g.id === "GRP-DOR-PACE3" ? "blíster" : "und";
      const precioCard = modoVentaActual === "unidad"
        ? `$${pv.precioUnidad.toFixed(2)} / ${etqModoUnd} · Caja: $${pv.precioMenor.toFixed(2)}`
        : `$${pv.precioMenor.toFixed(2)} / cj · Mayor: $${pv.precioMayor.toFixed(2)}${cfg.permiteUnidad && pv.precioUnidad > 0 ? ` · ${g.id === "GRP-DOR-PACE3" ? "Blíster" : "Und"}: $${pv.precioUnidad.toFixed(2)}` : ""}`;

      return `
        <div class="frag-card ${cantModo > 0 ? "is-selected" : ""}${agotadaVar ? " sin-stock agotado" : ""}" data-frag-row="${v.code}" data-frag-preview="${v.code}">
          <div class="frag-card-img-wrap" data-frag-inc="${v.code}" role="button" tabindex="0" aria-label="Tocar imagen para sumar ${escapeHtml(v.fragancia)}" title="Tocá la imagen para sumar">
            ${cantModo > 0 ? `
              <button type="button" class="frag-img-minus" data-frag-dec="${v.code}" aria-label="Restar ${escapeHtml(v.fragancia)}" title="Restar 1">−</button>
            ` : ""}
            <span class="frag-card-badge ${cantModo > 0 || agotadaVar ? "is-visible" : ""}${agotadaVar ? " agotado" : ""}" data-check-badge="${v.code}">
              ${agotadaVar ? "Agotado" : (cantModo > 0 ? `✓ ${cantModo} ${unidadCorto}` : "+ Tocar")}
            </span>
            <img src="${srcVar800}" srcset="${srcVar800} 1x, ${srcVarHq} 2x" alt="${escapeHtml(v.fragancia)}" width="800" height="600" loading="lazy" decoding="async" />
            <button type="button" class="frag-zoom-btn" data-zoom-var="${v.code}" aria-label="Ver en grande ${escapeHtml(v.fragancia)}" title="Ampliar foto">🔍</button>
          </div>
          <div class="frag-card-body">
            <strong class="frag-card-title" data-frag-inc="${v.code}" style="cursor:pointer">${escapeHtml(v.fragancia)}</strong>
            <small class="frag-var-price" style="display:block;color:var(--verde-osc);font-weight:700;font-size:0.76rem;margin-top:2px">${escapeHtml(precioCard)}</small>
            ${otraEtiqueta ? `<span class="frag-other-mode-badge">${escapeHtml(otraEtiqueta)}</span>` : ""}
            <div class="frag-card-controls">
              <div class="frag-stepper">
                <button type="button" class="qty-btn" data-frag-dec="${v.code}" aria-label="Restar">−</button>
                <input type="number" class="qty-input frag-qty-input" data-frag-input="${v.code}" min="0" max="999" inputmode="numeric" pattern="[0-9]*" value="${cantModo}" ${agotadaVar ? "disabled" : ""} aria-label="Cantidad de ${escapeHtml(v.fragancia)}" />
                <button type="button" class="qty-btn" data-frag-inc="${v.code}" ${agotadaVar ? "disabled" : ""} aria-label="Sumar">+</button>
              </div>
              ${modoVentaActual === "unidad" ? `
                <div class="chips-und-rapida">
                  <button type="button" class="chip-und-btn ${cantModo === 6 ? "is-active" : ""}" data-quick-und="6" data-code="${v.code}" ${agotadaVar ? "disabled" : ""}>6</button>
                  <button type="button" class="chip-und-btn ${cantModo === 12 ? "is-active" : ""}" data-quick-und="12" data-code="${v.code}" ${agotadaVar ? "disabled" : ""}>12</button>
                  <button type="button" class="chip-und-btn ${cantModo === 24 ? "is-active" : ""}" data-quick-und="24" data-code="${v.code}" ${agotadaVar ? "disabled" : ""}>24</button>
                </div>
              ` : ""}
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  actualizarPieFragModal(g);
}

/* Actualiza una tarjeta de #fragGrid sin destruir el input enfocado */
function sincronizarFilaFragEnVivo(code) {
  const g = GRUPOS_DISTRIBUIDORA.find((x) => x.id === state.grupoActivoId);
  if (!g) return;
  const q = getItemQty(code);
  const modoVentaActual = state.modoVentaActual;
  const cantModo = modoVentaActual === "unidad" ? q.unidades : q.cajas;
  const unidadCorto = modoVentaActual === "unidad"
    ? (g.id === "GRP-DOR-PACE3" ? "blíster" : "und")
    : (cantModo === 1 ? "caja" : "cajas");
  const row = document.querySelector(`#fragGrid [data-frag-row="${code}"]`);
  if (row) {
    row.classList.toggle("is-selected", cantModo > 0);
    const badge = row.querySelector(`[data-check-badge="${code}"]`);
    if (badge) {
      badge.classList.toggle("is-visible", cantModo > 0);
      badge.textContent = cantModo > 0 ? `✓ ${cantModo} ${unidadCorto}` : "+ Tocar";
    }
    const inp = row.querySelector(`[data-frag-input="${code}"]`);
    if (inp && document.activeElement !== inp) {
      inp.value = String(cantModo);
    }
    row.querySelectorAll("[data-quick-und]").forEach((b) => {
      b.classList.toggle("is-active", Number(b.getAttribute("data-quick-und")) === cantModo);
    });
  }
  actualizarPieFragModal(g);
}

function actualizarPieFragModal(g) {
  const res = resumenGrupoEnCarrito(g);
  const el = document.getElementById("fragResumenGrupo");
  if (!el) return;
  if (res.cajas === 0 && res.unidades === 0) {
    el.textContent = "Sin cantidades seleccionadas en este grupo";
    return;
  }
  const partes = [];
  if (res.cajas > 0) partes.push(`${res.cajas} caja(s)`);
  if (res.unidades > 0) partes.push(`${res.unidades} unidad(es)`);
  el.textContent = `Seleccionado: ${partes.join(" + ")} en ${res.refs} fragancia(s)`;
}

/* -------------------- Barra Inferior y Modal del Pedido (#orderModal) -------------------- */
function updateCartUI() {
  const cajas = totalCajas();
  const unidades = totalUnidadesSueltas();
  const totalRefs = Object.keys(state.cart).length;
  const bar = document.getElementById("cartBar");
  const countEl = document.getElementById("cartCount");
  const summaryEl = document.getElementById("cartSummary");
  const subEl = document.getElementById("cartSub");
  const progEl = document.getElementById("orderProgress");
  const progFill = document.getElementById("orderProgressFill");

  const tieneAlgo = cajas > 0 || unidades > 0;
  document.body.classList.toggle("has-order", tieneAlgo);
  if (bar) {
    bar.classList.toggle("show", tieneAlgo);
    bar.classList.toggle("visible", tieneAlgo);
    if (tieneAlgo) {
      if (countEl) countEl.textContent = String(cajas + unidades);
      const partes = [];
      if (cajas > 0) partes.push(`${cajas} ${cajas === 1 ? "caja" : "cajas"}`);
      if (unidades > 0) partes.push(`${unidades} und.`);
      const { neto } = calcularTotalesConPago();
      if (summaryEl) summaryEl.textContent = `(${partes.join(" + ")}) · $${neto.toFixed(2)}`;

      const faltanMayor = Math.max(0, META_CAJAS - cajas);
      const pct = Math.min(100, Math.round((cajas / META_CAJAS) * 100));
      if (subEl) {
        subEl.textContent = faltanMayor > 0
          ? `Faltan ${faltanMayor} cj para Mayorista (15+ cj) · ${totalRefs} ref.`
          : `🎉 ¡Precio Mayorista activo! · ${totalRefs} ref.`;
        subEl.classList.toggle("ok", faltanMayor === 0);
      }
      if (progEl) progEl.classList.toggle("completo", faltanMayor === 0);
      if (progFill) progFill.style.width = `${pct}%`;
    }
  }
}

/* 3 estrellas doradas en triángulo (idéntico a catalogo-skala) */
function estrellasHTML(n) {
  const s = (i, cls) => `<svg class="estrella ${cls} ${i <= n ? "on" : ""}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.3 6.1 20.5l1.2-6.5-4.8-4.6 6.6-.9L12 2.5z"/></svg>`;
  return `<span class="estrellas" aria-label="Nivel ${n} de 3">${s(1, "e1")}${s(2, "e2")}${s(3, "e3")}</span>`;
}

function renderPagosWeb() {
  const fsPago = document.getElementById("fsPagoWeb");
  const contElegido = document.getElementById("pagoElegido");
  const contLista = document.getElementById("pagosWeb");
  const btnPagos = document.getElementById("btnPagos");
  if (!fsPago || !contElegido || !contLista || typeof PAGOS === "undefined") return;

  const tieneItems = totalCajas() > 0 || totalUnidadesSueltas() > 0;
  fsPago.hidden = !tieneItems;
  if (!tieneItems) return;

  const actual = PAGOS.find((p) => p.id === state.pago) || PAGOS[0];
  const totActual = calcularTotalesConPago(actual.id);
  const nombreActual = actual.nombre || actual.titulo || "Efectivo";

  contElegido.innerHTML = `
    <button type="button" class="pago-resumen" id="btnResumenPago">
      <div class="pago-opt ${actual.estrellas === 3 ? "es-premium" : ""}">
        <div class="pago-txt" style="flex:1">
          <strong>${escapeHtml(nombreActual)}</strong>
          ${actual.estrellas === 3 ? '<span class="premium">Premium</span>' : ""}
          <div>
            ${estrellasHTML(actual.estrellas || 1)}
            <small style="margin-left:6px;color:var(--tinta-suave)">
              ${totActual.descPct > 0 ? `${totActual.descPct}% desc. · Ahorrás $${totActual.ahorro.toFixed(2)}` : (actual.ayuda || "Precio estándar del catálogo")}
            </small>
          </div>
        </div>
        <div style="text-align:right">
          <strong style="font-size:1.05rem;color:var(--verde-osc)">$${totActual.neto.toFixed(2)}</strong>
        </div>
      </div>
    </button>
  `;

  contLista.hidden = !state.pagosAbiertos;
  if (btnPagos) {
    btnPagos.textContent = state.pagosAbiertos ? "Ocultar" : "Cambiar";
    btnPagos.setAttribute("aria-expanded", state.pagosAbiertos ? "true" : "false");
  }

  contLista.innerHTML = `<div class="pagos-lista">` + PAGOS.map((p) => {
    const t = calcularTotalesConPago(p.id);
    const checked = p.id === state.pago ? "checked" : "";
    const nombrePago = p.nombre || p.titulo || "Pago";
    return `
      <label class="pago-opt ${p.estrellas === 3 ? "es-premium" : ""}" style="cursor:pointer">
        <input type="radio" name="pagoWeb" value="${escapeHtml(p.id)}" ${checked} />
        <div class="pago-txt" style="flex:1">
          <strong>${escapeHtml(nombrePago)}</strong>
          ${p.estrellas === 3 ? '<span class="premium">Premium</span>' : ""}
          <div>
            ${estrellasHTML(p.estrellas || 1)}
            <small style="margin-left:6px;color:var(--tinta-suave)">
              ${t.descPct > 0 ? `${t.descPct}% desc. (Ahorrás $${t.ahorro.toFixed(2)})` : (p.ayuda || "Sin descuento adicional")}
            </small>
          </div>
        </div>
        <strong style="color:var(--verde-osc)">$${t.neto.toFixed(2)}</strong>
      </label>
    `;
  }).join("") + `</div>`;
}

function renderOrderModalList() {
  const listEl = document.getElementById("cartList");
  if (!listEl) return;
  const map = allProductsMap();
  const mayor = esTarifaMayor();
  const rows = [];

  for (const [code, it] of Object.entries(state.cart)) {
    const p = map[code];
    if (!p) continue;
    const pv = precioVariante(code);
    const precioCaja = mayor ? pv.precioMayor : pv.precioMenor;

    if (it.cajas > 0) {
      const sub = it.cajas * precioCaja;
      rows.push(`
        <div class="cart-item" data-cart-row="${code}:caja">
          <span class="cart-foto"><img src="${p.img400}" alt="${escapeHtml(p.fragancia)}" width="44" height="44" /></span>
          <div class="cart-info">
            <strong>${escapeHtml(p.grupoNombre)}</strong>
            <small>🌸 Fragancia: <b>${escapeHtml(p.fragancia)}</b> · 📦 Caja × ${p.unidades} ${escapeHtml(p.unidad)}</small>
          </div>
          <div class="cart-acc">
            <div class="cart-precio">
              <strong>$${sub.toFixed(2)}</strong>
              <span class="pu">$${precioCaja.toFixed(2)} / cj</span>
            </div>
            <div class="frag-stepper">
              <button type="button" class="qty-btn" data-cart-dec="${code}" data-cart-modo="caja" aria-label="Restar caja">−</button>
              <input type="number" class="qty-input" data-cart-input="${code}" data-cart-modo="caja" value="${it.cajas}" min="0" max="999" inputmode="numeric" />
              <button type="button" class="qty-btn" data-cart-inc="${code}" data-cart-modo="caja" aria-label="Sumar caja">+</button>
            </div>
            <button type="button" class="btn-icon cart-quitar" data-cart-del="${code}" data-cart-modo="caja" aria-label="Quitar ítem" title="Quitar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><g class="tapa"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></g><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </div>
      `);
    }

    if (it.unidades > 0) {
      const subU = it.unidades * pv.precioUnidad;
      rows.push(`
        <div class="cart-item" data-cart-row="${code}:unidad">
          <span class="cart-foto"><img src="${p.img400}" alt="${escapeHtml(p.fragancia)}" width="44" height="44" /></span>
          <div class="cart-info">
            <strong>${escapeHtml(p.grupoNombre)}</strong>
            <small>🌸 Fragancia: <b>${escapeHtml(p.fragancia)}</b> · 🧴 Por Unidad suelta</small>
          </div>
          <div class="cart-acc">
            <div class="cart-precio">
              <strong>$${subU.toFixed(2)}</strong>
              <span class="pu">$${pv.precioUnidad.toFixed(2)} / und</span>
            </div>
            <div class="frag-stepper">
              <button type="button" class="qty-btn" data-cart-dec="${code}" data-cart-modo="unidad" aria-label="Restar unidad">−</button>
              <input type="number" class="qty-input" data-cart-input="${code}" data-cart-modo="unidad" value="${it.unidades}" min="0" max="999" inputmode="numeric" />
              <button type="button" class="qty-btn" data-cart-inc="${code}" data-cart-modo="unidad" aria-label="Sumar unidad">+</button>
            </div>
            <button type="button" class="btn-icon cart-quitar" data-cart-del="${code}" data-cart-modo="unidad" aria-label="Quitar ítem" title="Quitar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><g class="tapa"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></g><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </div>
      `);
    }
  }

  if (!rows.length) {
    listEl.innerHTML = `<p class="catalog-empty">Todavía no seleccionaste productos. Cerrá esta ventana y tocá «Elegir fragancias» en cualquier grupo.</p>`;
  } else {
    const { bruto, ahorro, neto } = calcularTotalesConPago();
    rows.push(`
      <div class="cart-item" style="background:var(--verde-suave);border-color:var(--verde);justify-content:space-between;display:flex;padding:10px 14px">
        <div>
          <strong>Total estimado del pedido</strong>
          <small style="display:block;color:var(--tinta-suave)">
            ${totalCajas()} caja(s) · ${totalUnidadesSueltas()} unidad(es) ${ahorro > 0 ? `· Ahorro pago: -$${ahorro.toFixed(2)}` : ""}
          </small>
        </div>
        <strong style="font-size:1.2rem;color:var(--verde-osc)">$${neto.toFixed(2)}</strong>
      </div>
    `);
    listEl.innerHTML = rows.join("");
  }

  renderPagosWeb();
}

function openModal() {
  renderOrderModalList();
  const modal = document.getElementById("orderModal");
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  const warn = document.getElementById("formWarn");
  if (warn) warn.hidden = true;
}

function closeModal() {
  const modal = document.getElementById("orderModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

/* -------------------- Modal Configuración de Unidades (Vendedor) -------------------- */
function openConfigModal() {
  const listEl = document.getElementById("configUnidadList");
  if (listEl) {
    listEl.innerHTML = GRUPOS_DISTRIBUIDORA.map((g) => {
      const cfg = cfgGrupo(g.id);
      return `
        <div class="config-row">
          <div class="config-row-info">
            <strong>${escapeHtml(g.nombre)}</strong>
            <small>${escapeHtml(g.marca || "Alive")} · Caja: $${cfg.precioMenor.toFixed(2)} / Mayor: $${cfg.precioMayor.toFixed(2)} · Unidad: $${cfg.precioUnidad.toFixed(2)}</small>
          </div>
          <label class="config-toggle-label">
            <input type="checkbox" data-cfg-group="${g.id}" ${cfg.permiteUnidad ? "checked" : ""} />
            <span>Permitir Unidad</span>
          </label>
        </div>
      `;
    }).join("");
  }
  const modal = document.getElementById("configUnidadModal");
  if (modal) {
    modal.hidden = false;
    document.body.classList.add("modal-open");
  }
}

function closeConfigModal() {
  const modal = document.getElementById("configUnidadModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  renderCatalog();
}

/* -------------------- Visor de Imagen Ampliada (#zoomModal) -------------------- */
function abrirZoom(src, titulo, subtitulo, origenEl) {
  const zm = document.getElementById("zoomModal");
  const zImg = document.getElementById("zoomImg");
  const zCap = document.getElementById("zoomCaption");
  if (!zm || !zImg) return;

  if (origenEl && origenEl.getBoundingClientRect) {
    const r = origenEl.getBoundingClientRect();
    const dx = Math.round(r.left + r.width / 2 - window.innerWidth / 2);
    const dy = Math.round(r.top + r.height / 2 - window.innerHeight / 2);
    zm.style.setProperty("--zx", `${dx}px`);
    zm.style.setProperty("--zy", `${dy}px`);
  } else {
    zm.style.setProperty("--zx", "0px");
    zm.style.setProperty("--zy", "0px");
  }

  zImg.src = src;
  zImg.alt = titulo || "";
  if (zCap) {
    zCap.innerHTML = `<strong>${escapeHtml(titulo || "")}</strong>${subtitulo ? ` <span>· ${escapeHtml(subtitulo)}</span>` : ""}`;
  }
  zm.hidden = false;
  zm.classList.remove("cerrando");
  requestAnimationFrame(() => zm.classList.add("abierto"));
}

function cerrarZoom() {
  const zm = document.getElementById("zoomModal");
  if (!zm || zm.hidden) return;
  zm.classList.remove("abierto");
  zm.classList.add("cerrando");
  setTimeout(() => {
    zm.hidden = true;
    zm.classList.remove("cerrando");
  }, 200);
}

/* -------------------- Búsqueda de Cliente Web y GPS en #orderModal -------------------- */
const RUTAS_WEB_DIST = ["Chivo", "Vigía", "Mérida", "Mocotíes", "Caja Seca", "Táchira"];
function inferirRutaCliente(c) {
  if (!c) return "";
  if (c.ruta && RUTAS_WEB_DIST.includes(c.ruta)) return c.ruta;
  const txt = `${c.ruta || ""} ${c.ciudad || ""} ${c.direccion || ""} ${c.negocio || ""} ${c.nombre || ""}`
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/tachira|san\s*cristobal|la\s*fria|coloncito|pinal|rubio|tariba/.test(txt)) return "Táchira";
  if (/caja\s*seca|panamericana|nueva\s*bolivia|arenales|zancudo|bobures|arapuey/.test(txt)) return "Caja Seca";
  if (/mocoties|santa\s*cruz\s*de\s*mora|tovar|bailadores|zea/.test(txt)) return "Mocotíes";
  if (/chivo|pueblo\s*nuevo|rurale|cuatro\s*esquinas/.test(txt)) return "Chivo";
  if (/merida|llano|milla|lora|independencia|pinto\s*salina|ejido/.test(txt)) return "Mérida";
  if (/vigia|cano\s*seco/.test(txt)) return "Vigía";
  return "";
}

function rutaClienteActual() {
  const fCiudad = typeof document !== "undefined" ? document.getElementById("fCiudad") : null;
  const fDir = typeof document !== "undefined" ? document.getElementById("fDireccion") : null;
  const fNeg = typeof document !== "undefined" ? document.getElementById("fNegocio") : null;
  return inferirRutaCliente(state.clienteWeb)
    || inferirRutaCliente({
      ciudad: fCiudad ? fCiudad.value : "",
      direccion: fDir ? fDir.value : "",
      negocio: fNeg ? fNeg.value : "",
    });
}

let timerCliBusq = null;
async function buscarClienteEnCatalogo(q) {
  const resEl = document.getElementById("fCliResultados");
  if (!resEl) return;
  const term = String(q || "").trim();
  const dig = term.replace(/\D/g, "");
  if (term.length < 3) {
    resEl.hidden = true;
    resEl.innerHTML = "";
    return;
  }
  resEl.hidden = false;
  if (dig.length < 6) {
    resEl.innerHTML = `<p class="cli-res">Escribí al menos 6 números de tu teléfono o RIF/Cédula.</p>`;
    return;
  }
  resEl.innerHTML = `<p class="cli-res"><span class="spinner-chico"></span> Buscando tus datos...</p>`;
  try {
    if (typeof SkalaAPI !== "undefined" && SkalaAPI.api) {
      const r = await SkalaAPI.api("buscarClienteWeb", { q: term });
      const lista = r && r.cliente ? [r.cliente] : ((r && r.clientes) || []);
      if (!lista.length) {
        resEl.innerHTML = `<p class="cli-res">No encontramos coincidencias. Tocá «+ Nuevo · registrarme» para anotar tus datos.</p>`;
        return;
      }
      resEl.innerHTML = lista.slice(0, 4).map((c) => {
        const rutaC = inferirRutaCliente(c);
        return `
        <button type="button" class="vend-opt" data-pick-cli='${escapeHtml(JSON.stringify(c))}' style="width:100%;margin-top:4px">
          <span class="avatar">${escapeHtml((c.negocio || c.nombre || "C").charAt(0).toUpperCase())}</span>
          <div style="display:flex;flex-direction:column;text-align:left;min-width:0">
            <strong>${escapeHtml(c.negocio || c.nombre)}</strong>
            <small style="color:var(--tinta-suave)">${escapeHtml([c.rif_cedula || c.rif, c.telefono || c.direccion].filter(Boolean).join(" · "))}${rutaC ? ` · 📍 Ruta ${escapeHtml(rutaC)}` : ""}</small>
          </div>
        </button>
      `;
      }).join("");
    }
  } catch (_) {
    resEl.innerHTML = `<p class="cli-res">Podés completar tus datos manualmente tocando «+ Nuevo · registrarme».</p>`;
  }
}

function aplicarClienteElegido(c) {
  const rutaDetectada = inferirRutaCliente(c);
  state.clienteWeb = {
    ...c,
    id: c.id || c.cliente_id || "",
    ruta: rutaDetectada || c.ruta || "",
  };
  saveClienteWebDist(state.clienteWeb);
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
  setVal("fNombre", c.contacto || c.nombre || "");
  setVal("fNegocio", c.negocio || c.nombre || "");
  setVal("fRif", c.rif_cedula || c.rif || "");
  setVal("fTelefono", c.telefono || "");
  setVal("fCiudad", c.ciudad || rutaDetectada || c.ruta || "");
  setVal("fDireccion", c.direccion || "");
  const formCampos = document.getElementById("cliFormCampos");
  if (formCampos) formCampos.hidden = false;
  const resEl = document.getElementById("fCliResultados");
  if (resEl) {
    const vAsig = vendedorAsignado();
    if (vAsig) {
      resEl.hidden = false;
      resEl.innerHTML = `<p class="cli-res" style="color:var(--verde-osc)">✓ Cliente identificado${rutaDetectada ? ` (Ruta ${escapeHtml(rutaDetectada)})` : ""} · Vendedor asignado: <strong>${escapeHtml(vAsig.nombre)}</strong></p>`;
    } else {
      resEl.hidden = true;
    }
  }
}

function tomarUbicacionWeb() {
  const btn = document.getElementById("btnUbic");
  const est = document.getElementById("ubicEstado");
  if (!navigator.geolocation) {
    if (est) est.textContent = "Tu navegador no soporta GPS.";
    return;
  }
  if (btn) btn.classList.add("buscando");
  if (est) est.textContent = "Obteniendo coordenadas GPS...";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (btn) { btn.classList.remove("buscando"); btn.classList.add("lista"); }
      state.ubicacion = {
        lat: Math.round(pos.coords.latitude * 1e6) / 1e6,
        lng: Math.round(pos.coords.longitude * 1e6) / 1e6,
      };
      if (est) est.textContent = `✓ Ubicación adjuntada (${state.ubicacion.lat}, ${state.ubicacion.lng})`;
    },
    () => {
      if (btn) btn.classList.remove("buscando");
      if (est) est.textContent = "No se pudo leer el GPS. Verificá el permiso de ubicación.";
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
  );
}

/* -------------------- Armado de Mensaje WhatsApp, Confeti y Vendedores por Catálogo -------------------- */
function telefonoWaVendedor(v) {
  if (!v) return "";
  if (v.whatsapp && String(v.whatsapp).replace(/\D/g, "").length >= 10) return String(v.whatsapp).replace(/\D/g, "");
  if (typeof telefonoWhatsapp === "function" && v.telefono) {
    const t = telefonoWhatsapp(v.telefono);
    if (t) return t;
  }
  const d = String(v.telefono || "").replace(/\D/g, "");
  if (d.startsWith("58") && d.length >= 12) return d;
  if (d.startsWith("0") && d.length === 11) return "58" + d.slice(1);
  if (d.length === 10) return "58" + d;
  return "";
}

function vendedoresDeEsteCatalogo() {
  const lista = state.vendedores || [];
  const filtrados = lista.filter((v) => {
    const cat = String(v.catalogo || "ambos").toLowerCase();
    return cat === "distribuidora" || cat === "ambos";
  });
  return filtrados.length ? filtrados : lista;
}

function vendedorAsignado() {
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const listaCat = vendedoresDeEsteCatalogo();
  const paramVend = typeof location !== "undefined" ? norm(new URLSearchParams(location.search).get("vendedor") || "") : "";
  if (paramVend) {
    const porUrl = listaCat.find((v) => telefonoWaVendedor(v) && (norm(v.id) === paramVend || norm(v.usuario) === paramVend || norm(v.nombre).includes(paramVend)))
      || (state.vendedores || []).find((v) => telefonoWaVendedor(v) && (norm(v.id) === paramVend || norm(v.usuario) === paramVend || norm(v.nombre).includes(paramVend)));
    if (porUrl) return porUrl;
  }
  const conWa = listaCat.filter((v) => telefonoWaVendedor(v));
  const soloDist = conWa.filter((v) => String(v.catalogo || "").toLowerCase() === "distribuidora");
  const rutaCli = rutaClienteActual();
  if (rutaCli) {
    const porRutaExplicitaDist = soloDist.find((v) => Array.isArray(v.rutas) && v.rutas.includes(rutaCli));
    if (porRutaExplicitaDist) return porRutaExplicitaDist;
    const porRutaCubiertaDist = soloDist.find((v) => !Array.isArray(v.rutas) || !v.rutas.length || v.rutas.includes(rutaCli));
    if (porRutaCubiertaDist) return porRutaCubiertaDist;
    const porRutaExplicita = conWa.find((v) => Array.isArray(v.rutas) && v.rutas.includes(rutaCli));
    if (porRutaExplicita) return porRutaExplicita;
    const porRutaCubierta = conWa.find((v) => !Array.isArray(v.rutas) || !v.rutas.length || v.rutas.includes(rutaCli));
    if (porRutaCubierta) return porRutaCubierta;
  }
  if (soloDist.length === 1) return soloDist[0];
  if (conWa.length === 1) return conWa[0];
  if (typeof VENDEDOR_ASIGNADO !== "undefined" && VENDEDOR_ASIGNADO) {
    const buscado = norm(VENDEDOR_ASIGNADO);
    const porDef = conWa.find((v) => norm(v.nombre).split(/\s+/).includes(buscado));
    if (porDef) return porDef;
  }
  return soloDist[0] || conWa[0] || null;
}

async function cargarVendedores(forzar = false) {
  if (!forzar && state.vendedores.length && state.vendedores.some((v) => v.id)) return state.vendedores;
  try {
    if (typeof SkalaAPI !== "undefined" && SkalaAPI.api) {
      const r = await SkalaAPI.api("vendedores", { catalogo: "distribuidora" });
      if (r && Array.isArray(r.vendedores) && r.vendedores.length) {
        const filtrados = r.vendedores.filter((v) => {
          const cat = String(v.catalogo || "ambos").toLowerCase();
          return cat === "distribuidora" || cat === "ambos";
        });
        state.vendedores = (filtrados.length ? filtrados : r.vendedores).map((v) => ({
          ...v,
          telefono: v.telefono || v.whatsapp || "",
          whatsapp: telefonoWaVendedor(v),
          catalogo: String(v.catalogo || "ambos").toLowerCase(),
        }));
        try { localStorage.setItem(STORAGE_KEY_VEND_DIST, JSON.stringify(state.vendedores)); } catch (_) {}
        return state.vendedores;
      }
    }
  } catch (_) {}
  if (!state.vendedores.length) {
    state.vendedores = [
      { id: "", usuario: "ontiveros", nombre: "Atención Principal · Dist. Ontiveros", telefono: WHATSAPP_NUMBER, whatsapp: WHATSAPP_NUMBER, catalogo: "distribuidora" },
    ];
  }
  return state.vendedores;
}

function construirMensajeWhatsApp(datosCliente = {}) {
  const map = allProductsMap();
  const mayor = esTarifaMayor();
  const { bruto, descPct, ahorro, neto } = calcularTotalesConPago();
  const pagoObj = (typeof PAGOS !== "undefined" && PAGOS.find((p) => p.id === state.pago)) || { titulo: "Efectivo $" };

  const lineas = [
    "🌿 *PEDIDO · DISTRIBUCIONES ONTIVEROS*",
    "─────────────────────",
  ];

  const porGrupo = {};
  for (const [code, it] of Object.entries(state.cart)) {
    const p = map[code];
    if (!p) continue;
    if (!porGrupo[p.grupoId]) porGrupo[p.grupoId] = { nombre: p.grupoNombre, items: [] };
    porGrupo[p.grupoId].items.push({ p, it });
  }

  for (const [gid, grp] of Object.entries(porGrupo)) {
    lineas.push(`\n📦 *${grp.nombre}*`);
    grp.items.forEach(({ p, it }) => {
      const pv = precioVariante(p.code);
      const pCaja = mayor ? pv.precioMayor : pv.precioMenor;
      if (it.cajas > 0) {
        lineas.push(`  • ${p.fragancia}: *${it.cajas} caja(s)* × $${pCaja.toFixed(2)} = *$${(it.cajas * pCaja).toFixed(2)}*`);
      }
      if (it.unidades > 0) {
        lineas.push(`  • ${p.fragancia}: *${it.unidades} und.* × $${pv.precioUnidad.toFixed(2)} = *$${(it.unidades * pv.precioUnidad).toFixed(2)}*`);
      }
    });
  }

  lineas.push("\n─────────────────────");
  lineas.push(`📊 *Resumen:* ${totalCajas()} caja(s) · ${totalUnidadesSueltas()} unidad(es)`);
  lineas.push(`💳 *Forma de pago:* ${pagoObj.titulo}`);
  if (ahorro > 0) {
    lineas.push(`🏷️ *Subtotal:* $${bruto.toFixed(2)} (-${descPct}% desc: -$${ahorro.toFixed(2)})`);
  }
  lineas.push(`💰 *TOTAL ESTIMADO: $${neto.toFixed(2)}*`);

  if (datosCliente.vendedor) {
    lineas.push(`🤝 *Vendedor asignado:* ${datosCliente.vendedor}`);
  }
  if (datosCliente.nombre || datosCliente.negocio || datosCliente.telefono) {
    lineas.push("\n👤 *Datos del Cliente:*");
    if (datosCliente.negocio) lineas.push(`• Negocio: ${datosCliente.negocio}`);
    if (datosCliente.nombre) lineas.push(`• Contacto: ${datosCliente.nombre}`);
    if (datosCliente.rif) lineas.push(`• RIF/CI: ${datosCliente.rif}`);
    if (datosCliente.telefono) lineas.push(`• Teléfono: ${datosCliente.telefono}`);
    if (datosCliente.ciudad) lineas.push(`• Ciudad/Ruta: ${datosCliente.ciudad}`);
    if (datosCliente.direccion) lineas.push(`• Dirección: ${datosCliente.direccion}`);
    if (state.ubicacion) lineas.push(`• GPS: https://maps.google.com/?q=${state.ubicacion.lat},${state.ubicacion.lng}`);
  }
  if (datosCliente.notas) {
    lineas.push(`📝 *Notas:* ${datosCliente.notas}`);
  }

  return lineas.join("\n");
}

function lanzarConfeti() {
  const c = document.getElementById("confetti");
  if (!c) return;
  const colores = ["#1f6f50", "#3fa37c", "#0e7490", "#f59e0b", "#22d3ee"];
  c.innerHTML = Array.from({ length: 24 }, (_, i) => {
    const left = Math.round(Math.random() * 96);
    const delay = (Math.random() * 0.45).toFixed(2);
    const col = colores[i % colores.length];
    return `<i style="left:${left}%;animation-delay:${delay}s;background:${col}"></i>`;
  }).join("");
}

function formatearRutasVendedor(rutas) {
  return Array.isArray(rutas) && rutas.length ? rutas.join(" · ") : "Todas las rutas";
}

async function mostrarModalListo(mensajeWa, refPedido = "", modo = "listo", datosCliBase = null) {
  state.ultimoMensajeWa = mensajeWa;
  if (refPedido) state.ultimoRefWeb = refPedido;
  closeModal();
  await cargarVendedores();
  const baseLista = vendedoresDeEsteCatalogo();
  const asig = vendedorAsignado();
  const rutaCli = rutaClienteActual();
  const tieneAsigDirecto = !!(asig && (
    rutaCli
    || (typeof location !== "undefined" && new URLSearchParams(location.search).get("vendedor"))
    || baseLista.filter((x) => telefonoWaVendedor(x)).length === 1
  ));
  const ordenados = tieneAsigDirecto
    ? [asig, ...baseLista.filter((v) => String(v.id || v.usuario) !== String(asig.id || asig.usuario))]
    : baseLista;

  const titEl = document.getElementById("listoTit");
  const subEl = document.getElementById("listoSub");
  const pregEl = document.getElementById("listoPreg");
  if (modo === "seleccionar") {
    if (titEl) titEl.textContent = "Selecciona tu vendedor";
    if (subEl) subEl.textContent = "Elegí el vendedor que atiende tu ruta o zona para enviarle tu pedido por WhatsApp.";
    if (pregEl) pregEl.textContent = "Vendedores disponibles y rutas que atienden:";
  } else {
    if (titEl) titEl.textContent = "¡Listo!";
    if (subEl) subEl.textContent = "Tu pedido quedó armado con todas sus fragancias.";
    if (pregEl) pregEl.textContent = "Elegí con qué asesor enviarlo por WhatsApp:";
  }

  const cont = document.getElementById("listoVend");
  if (cont) {
    cont.innerHTML = `<ul class="lista-vend-wa">` + ordenados.map((v) => {
      const tel = telefonoWaVendedor(v) || WHATSAPP_NUMBER;
      const esAsig = tieneAsigDirecto && String(v.id || v.usuario) === String(asig.id || asig.usuario);
      const msgParaVend = datosCliBase ? construirMensajeWhatsApp({ ...datosCliBase, vendedor: v.nombre || "" }) : mensajeWa;
      const url = `https://wa.me/${tel}?text=${encodeURIComponent(msgParaVend)}`;
      const rutasTxt = formatearRutasVendedor(v.rutas);
      return `
        <li>
          <a class="vend-wa${esAsig ? " es-asignado" : ""}" href="${url}" data-vend-id="${escapeHtml(v.id || "")}" target="_blank" rel="noopener">
            <span class="avatar">${escapeHtml((v.nombre || "V").charAt(0).toUpperCase())}</span>
            <span class="vend-wa-info" style="display:flex;flex-direction:column;text-align:left;min-width:0;flex:1">
              <strong>${escapeHtml(v.nombre || "Asesor Comercial")}</strong>
              <small class="vend-wa-rutas" style="color:var(--tinta-suave);font-size:0.75rem">📍 Rutas que atiende: <b>${escapeHtml(rutasTxt)}</b></small>
              ${esAsig ? `<small class="vend-wa-tag" style="color:var(--verde-osc);font-weight:700;font-size:0.74rem">Tu vendedor asignado · Catálogo Distribuciones Ontiveros${rutaCli ? ` · Ruta ${escapeHtml(rutaCli)}` : ""}</small>` : ""}
            </span>
            <span class="flecha" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </span>
          </a>
        </li>
      `;
    }).join("") + `</ul>`;
  }
  const lm = document.getElementById("listoModal");
  if (lm) {
    lm.hidden = false;
    document.body.classList.add("modal-open");
    if (modo === "listo") lanzarConfeti();
  }
}

async function enviarDirectoVendedor() {
  await cargarVendedores();
  const cli = state.clienteWeb || {};
  const datosCliBase = {
    nombre: cli.contacto || cli.nombre || "",
    negocio: cli.negocio || "",
    rif: cli.rif_cedula || cli.rif || "",
    telefono: cli.telefono || "",
    direccion: cli.direccion || "",
  };
  const conWa = vendedoresDeEsteCatalogo().filter((x) => telefonoWaVendedor(x));
  const rutaCli = rutaClienteActual();
  const paramVend = typeof location !== "undefined" ? new URLSearchParams(location.search).get("vendedor") : "";
  // Cliente nuevo (sin ruta conocida y sin ?vendedor=) y hay más de 1 vendedor en el catálogo:
  // muestra "Selecciona tu vendedor" con la lista de vendedores, nombre y rutas que atienden
  if (!rutaCli && !paramVend && conWa.length > 1) {
    const msgBase = construirMensajeWhatsApp(datosCliBase);
    await mostrarModalListo(msgBase, "", "seleccionar", datosCliBase);
    return;
  }
  const v = vendedorAsignado();
  const msg = construirMensajeWhatsApp({
    ...datosCliBase,
    vendedor: v ? v.nombre : "",
  });
  const tel = telefonoWaVendedor(v) || WHATSAPP_NUMBER;
  if (v && typeof window !== "undefined" && typeof window.open === "function") {
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  }
  await mostrarModalListo(msg, "", "listo", datosCliBase);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* -------------------- Eventos del DOM -------------------- */
document.addEventListener("DOMContentLoaded", () => {
  poblarFiltroMarcas();
  actualizarContadoresTabs();
  renderCatalog();
  updateCartUI();
  sincronizarCarritoConPanel();
  cargarVendedores(true);
  if (state.clienteWeb) aplicarClienteElegido(state.clienteWeb);

  // Filtros de categorías (.filters .filter)
  document.querySelectorAll("#filterCategorias .filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#filterCategorias .filter").forEach((b) => {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      state.cat = btn.dataset.cat || "todos";
      renderCatalog();
    });
  });

  // Selector de vista Cuadrícula vs Lista rápida (.vista-cat-btn)
  document.querySelectorAll(".vista-cat-btn[data-vista-modo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".vista-cat-btn[data-vista-modo]").forEach((b) => b.classList.remove("activo"));
      btn.classList.add("activo");
      const modo = btn.getAttribute("data-vista-modo");
      document.getElementById("catalogGrid")?.classList.toggle("modo-matriz", modo === "matriz");
    });
  });

  // Tarjetas de Divisiones Comerciales (.curve[data-QuickCat])
  document.querySelectorAll(".curve[data-QuickCat]").forEach((card) => {
    const activar = () => {
      const cat = card.getAttribute("data-QuickCat") || "todos";
      const btn = document.querySelector(`#filterCategorias .filter[data-cat="${cat}"]`);
      if (btn) btn.click();
      document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
    };
    card.addEventListener("click", activar);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activar(); }
    });
  });

  // Diapositivas, recortes del abanico 3D y Tarjetas Destacadas ([data-open-group] fuera de #catalogGrid)
  document.querySelectorAll("#inicio [data-open-group]").forEach((el) => {
    const abrir = (e) => {
      if (el.closest('[data-dragged-recently="1"]')) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (e) e.stopPropagation();
      const gid = el.getAttribute("data-open-group");
      if (gid) openFragModal(gid);
    };
    el.addEventListener("click", abrir);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(e); }
    });
  });

  // Helper reutilizable para permitir deslizar con dedo (touch) o arrastrar con mouse hacia ambos lados
  const habilitarArrastreCarrusel = (trackEl, { onPauseChange, onReleaseSnap } = {}) => {
    if (!trackEl) return;
    let isMouseDown = false;
    let startX = 0;
    let startScrollLeft = 0;
    let movedPx = 0;
    let resumeTimer = null;

    const pausar = () => {
      clearTimeout(resumeTimer);
      if (onPauseChange) onPauseChange(true);
    };
    const reanudarDiferido = (ms = 2500) => {
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        if (onPauseChange) onPauseChange(false);
      }, ms);
    };
    const marcarArrastradoTemporal = () => {
      trackEl.setAttribute("data-dragged-recently", "1");
      setTimeout(() => trackEl.removeAttribute("data-dragged-recently"), 160);
    };

    // Soporte Mouse (PC / Laptop)
    trackEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || e.target.closest(".alive-slider-arrow, .alive-dot, .alive-feat-arrow")) return;
      isMouseDown = true;
      movedPx = 0;
      startX = e.clientX;
      startScrollLeft = trackEl.scrollLeft;
      trackEl.classList.add("is-dragging");
      pausar();
    });
    window.addEventListener("mousemove", (e) => {
      if (!isMouseDown) return;
      const dx = e.clientX - startX;
      movedPx = Math.max(movedPx, Math.abs(dx));
      if (movedPx > 4) e.preventDefault();
      trackEl.scrollLeft = startScrollLeft - dx;
    });
    const finalizarMouse = (e) => {
      if (!isMouseDown) return;
      isMouseDown = false;
      trackEl.classList.remove("is-dragging");
      const dx = (e && typeof e.clientX === "number") ? e.clientX - startX : 0;
      if (movedPx > 6) {
        marcarArrastradoTemporal();
        if (onReleaseSnap) onReleaseSnap(dx);
      }
      reanudarDiferido(2500);
    };
    window.addEventListener("mouseup", finalizarMouse);
    trackEl.addEventListener("mouseleave", finalizarMouse);

    // Soporte Táctil (Teléfono / Tablet)
    let touchStartX = 0;
    let touchMoved = 0;
    trackEl.addEventListener("touchstart", (e) => {
      pausar();
      touchMoved = 0;
      if (e.touches && e.touches[0]) touchStartX = e.touches[0].clientX;
    }, { passive: true });
    trackEl.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches[0]) {
        touchMoved = Math.max(touchMoved, Math.abs(e.touches[0].clientX - touchStartX));
      }
    }, { passive: true });
    trackEl.addEventListener("touchend", () => {
      if (touchMoved > 10) marcarArrastradoTemporal();
      reanudarDiferido(3000);
    }, { passive: true });
  };

  // Panel Deslizable de Banners Superiores (#aliveBannerTrack con pista translate3d y apertura en abanico 3D)
  const bannerCarousel = document.getElementById("aliveBannerCarousel");
  const bannerTrack = document.getElementById("aliveBannerTrack");
  const bannerSlides = Array.from(document.querySelectorAll("#aliveBannerTrack .alive-banner-slide"));
  const bannerDots = Array.from(document.querySelectorAll("#aliveBannerDots .alive-dot"));
  if (bannerTrack && bannerDots.length && bannerSlides.length) {
    let bannerIdx = 0;
    let bannerPausado = false;
    const totalBanners = bannerSlides.length;

    const irABanner = (idx) => {
      bannerIdx = ((idx % totalBanners) + totalBanners) % totalBanners;
      bannerTrack.style.transform = `translate3d(-${bannerIdx * 100}%, 0, 0)`;
      bannerSlides.forEach((s, i) => s.classList.toggle("is-active", i === bannerIdx));
      bannerDots.forEach((d, i) => d.classList.toggle("is-active", i === bannerIdx));
    };

    // Activar apertura lenta en abanico 3D al iniciar en la portada 1
    if (bannerCarousel) {
      bannerCarousel.classList.add("banner-fan-init");
      requestAnimationFrame(() => {
        setTimeout(() => bannerCarousel.classList.remove("banner-fan-init"), 140);
      });
    }

    document.getElementById("bannerPrevBtn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      irABanner(bannerIdx - 1);
    });
    document.getElementById("bannerNextBtn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      irABanner(bannerIdx + 1);
    });
    bannerDots.forEach((dot) => {
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        irABanner(Number(dot.getAttribute("data-banner-idx")) || 0);
      });
    });

    bannerTrack.addEventListener("dragstart", (e) => e.preventDefault());

    const aplicarFeedbackBanner = (dx) => {
      if (dx === 0) {
        bannerTrack.style.transform = `translate3d(-${bannerIdx * 100}%, 0, 0)`;
      } else {
        const enExtremo = (bannerIdx === 0 && dx > 0) || (bannerIdx === totalBanners - 1 && dx < 0);
        const offsetPx = enExtremo ? dx * 0.32 : dx;
        bannerTrack.style.transform = `translate3d(calc(-${bannerIdx * 100}% + ${offsetPx}px), 0, 0)`;
      }
    };

    // Soporte táctil (Swipe en móvil / tablet)
    let bTouchStartX = 0;
    let bTouchDeltaX = 0;
    bannerTrack.addEventListener("touchstart", (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      bTouchStartX = e.touches[0].clientX;
      bTouchDeltaX = 0;
      bannerPausado = true;
      bannerTrack.classList.add("is-dragging");
    }, { passive: true });

    bannerTrack.addEventListener("touchmove", (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      bTouchDeltaX = e.touches[0].clientX - bTouchStartX;
      if (Math.abs(bTouchDeltaX) > 4) aplicarFeedbackBanner(bTouchDeltaX);
    }, { passive: true });

    bannerTrack.addEventListener("touchend", () => {
      bannerTrack.classList.remove("is-dragging");
      if (Math.abs(bTouchDeltaX) > 10) {
        bannerTrack.setAttribute("data-dragged-recently", "1");
        setTimeout(() => bannerTrack.removeAttribute("data-dragged-recently"), 160);
      }
      const umbral = Math.min(70, (bannerTrack.clientWidth || 360) * 0.12);
      if (Math.abs(bTouchDeltaX) >= umbral) {
        irABanner(bTouchDeltaX < 0 ? bannerIdx + 1 : bannerIdx - 1);
      } else {
        irABanner(bannerIdx);
      }
      bTouchDeltaX = 0;
      setTimeout(() => { bannerPausado = false; }, 2800);
    }, { passive: true });

    // Soporte arrastre con ratón (Mouse Drag en escritorio)
    let bMouseDown = false;
    let bMouseStartX = 0;
    let bMouseDeltaX = 0;
    bannerTrack.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || e.target.closest(".alive-slider-arrow, .alive-dot")) return;
      bMouseDown = true;
      bMouseStartX = e.clientX;
      bMouseDeltaX = 0;
      bannerPausado = true;
      bannerTrack.classList.add("is-dragging");
    });

    window.addEventListener("mousemove", (e) => {
      if (!bMouseDown) return;
      bMouseDeltaX = e.clientX - bMouseStartX;
      if (Math.abs(bMouseDeltaX) > 5) {
        e.preventDefault();
        aplicarFeedbackBanner(bMouseDeltaX);
      }
    });

    const finalizarMouseBanner = () => {
      if (!bMouseDown) return;
      bMouseDown = false;
      bannerTrack.classList.remove("is-dragging");
      if (Math.abs(bMouseDeltaX) > 8) {
        bannerTrack.setAttribute("data-dragged-recently", "1");
        setTimeout(() => bannerTrack.removeAttribute("data-dragged-recently"), 160);
      }
      const umbral = Math.min(80, (bannerTrack.clientWidth || 600) * 0.12);
      if (Math.abs(bMouseDeltaX) >= umbral) {
        irABanner(bMouseDeltaX < 0 ? bannerIdx + 1 : bannerIdx - 1);
      } else {
        irABanner(bannerIdx);
      }
      bMouseDeltaX = 0;
      setTimeout(() => { bannerPausado = false; }, 2500);
    };

    window.addEventListener("mouseup", finalizarMouseBanner);
    bannerTrack.addEventListener("mouseleave", finalizarMouseBanner);
    bannerCarousel?.addEventListener("mouseenter", () => { bannerPausado = true; });
    bannerCarousel?.addEventListener("mouseleave", () => {
      if (!bMouseDown) bannerPausado = false;
    });

    setInterval(() => {
      if (bannerPausado || document.body.classList.contains("modal-open")) return;
      irABanner(bannerIdx + 1);
    }, 7800);
  }

  // Barra Deslizable Compacta de Marcas Afiliadas (#aliveBrandsBar) y Píldoras en Portada 1 (.dist-brand-mini-pill)
  const brandsBar = document.getElementById("aliveBrandsBar");
  const sincronizarPildorasMarcas = () => {
    const q = (state.search || "").trim().toLowerCase();
    document.querySelectorAll(".alive-brand-pill, .dist-brand-mini-pill").forEach((pill) => {
      const bf = pill.getAttribute("data-brand-filter");
      const bk = pill.getAttribute("data-brand-keyword");
      const activo = bf
        ? state.marca === bf && !q
        : Boolean(bk && q === bk.toLowerCase());
      pill.classList.toggle("is-active", activo);
    });
  };

  // Click en las píldoras interactivas de marcas dentro de la Portada 1 (.dist-brand-mini-pill)
  document.querySelectorAll(".dist-brand-mini-pill").forEach((pill) => {
    pill.addEventListener("click", (e) => {
      if (pill.closest('[data-dragged-recently="1"]')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
      const brandFilter = pill.getAttribute("data-brand-filter");
      const brandKeyword = pill.getAttribute("data-brand-keyword");
      const sInput = document.getElementById("searchInput");
      const lSelect = document.getElementById("lineFilter");

      state.cat = "todos";
      document.querySelectorAll("#filterCategorias .filter").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-cat") === "todos");
      });

      if (brandFilter) {
        const yaActiva = state.marca === brandFilter && !state.search.trim();
        state.marca = yaActiva ? "todas" : brandFilter;
        state.search = "";
      } else if (brandKeyword) {
        const yaActiva = state.search.trim().toLowerCase() === brandKeyword.toLowerCase();
        state.marca = "todas";
        state.search = yaActiva ? "" : brandKeyword;
      }

      if (lSelect) lSelect.value = state.marca;
      if (sInput) sInput.value = state.search;
      sincronizarPildorasMarcas();
      renderCatalog();
      document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
    });
  });
  if (brandsBar) {
    let brandsPaused = false;
    let brandsMouseDown = false;
    let brandsStartX = 0;
    let brandsStartScroll = 0;
    let brandsMovedPx = 0;
    let brandsResumeTimer = null;
    let autoScrollAccum = 0;

    const normalizarLoopMarcas = () => {
      const half = brandsBar.scrollWidth / 2;
      if (half <= 20) return;
      if (brandsBar.scrollLeft >= half) {
        brandsBar.scrollLeft -= half;
        brandsStartScroll -= half;
        autoScrollAccum = brandsBar.scrollLeft;
      } else if (brandsBar.scrollLeft <= 1 && (brandsMouseDown || brandsPaused)) {
        brandsBar.scrollLeft += half;
        brandsStartScroll += half;
        autoScrollAccum = brandsBar.scrollLeft;
      }
    };

    const pausarMarcas = () => {
      clearTimeout(brandsResumeTimer);
      brandsPaused = true;
      brandsBar.classList.add("is-paused");
    };
    const reanudarMarcas = (ms = 1800) => {
      clearTimeout(brandsResumeTimer);
      brandsResumeTimer = setTimeout(() => {
        autoScrollAccum = brandsBar.scrollLeft;
        brandsPaused = false;
        brandsBar.classList.remove("is-paused");
      }, ms);
    };
    const marcarArrastreMarcas = () => {
      brandsBar.setAttribute("data-dragged-recently", "1");
      setTimeout(() => brandsBar.removeAttribute("data-dragged-recently"), 160);
    };

    // Auto-scroll continuo suave por scrollLeft (permite mover con el dedo o mouse en cualquier momento)
    const reducido = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducido && typeof requestAnimationFrame === "function") {
      const stepMarquee = () => {
        if (!brandsPaused && !brandsMouseDown && !document.hidden && !document.body.classList.contains("modal-open")) {
          const half = brandsBar.scrollWidth / 2;
          if (half > 20) {
            autoScrollAccum = (autoScrollAccum || brandsBar.scrollLeft) + 0.5;
            if (autoScrollAccum >= half) autoScrollAccum -= half;
            brandsBar.scrollLeft = autoScrollAccum;
          }
        }
        requestAnimationFrame(stepMarquee);
      };
      requestAnimationFrame(stepMarquee);
    }

    brandsBar.addEventListener("scroll", () => {
      normalizarLoopMarcas();
      if (brandsPaused || brandsMouseDown) {
        autoScrollAccum = brandsBar.scrollLeft;
      }
    }, { passive: true });

    // Arrastre con mouse hacia izquierda o derecha
    brandsBar.addEventListener("mouseenter", pausarMarcas);
    brandsBar.addEventListener("mouseleave", () => {
      if (!brandsMouseDown) reanudarMarcas(600);
    });
    brandsBar.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      pausarMarcas();
      normalizarLoopMarcas();
      brandsMouseDown = true;
      brandsMovedPx = 0;
      brandsStartX = e.clientX;
      brandsStartScroll = brandsBar.scrollLeft;
      brandsBar.classList.add("is-dragging");
    });
    window.addEventListener("mousemove", (e) => {
      if (!brandsMouseDown) return;
      const dx = e.clientX - brandsStartX;
      brandsMovedPx = Math.max(brandsMovedPx, Math.abs(dx));
      if (brandsMovedPx > 4) e.preventDefault();
      brandsBar.scrollLeft = brandsStartScroll - dx;
      normalizarLoopMarcas();
    });
    window.addEventListener("mouseup", () => {
      if (!brandsMouseDown) return;
      brandsMouseDown = false;
      brandsBar.classList.remove("is-dragging");
      if (brandsMovedPx > 6) marcarArrastreMarcas();
      reanudarMarcas(1600);
    });

    // Deslizamiento táctil con el dedo hacia ambos lados
    let tStartX = 0;
    let tMoved = 0;
    brandsBar.addEventListener("touchstart", (e) => {
      pausarMarcas();
      normalizarLoopMarcas();
      tMoved = 0;
      if (e.touches && e.touches[0]) tStartX = e.touches[0].clientX;
    }, { passive: true });
    brandsBar.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches[0]) {
        tMoved = Math.max(tMoved, Math.abs(e.touches[0].clientX - tStartX));
      }
      normalizarLoopMarcas();
    }, { passive: true });
    brandsBar.addEventListener("touchend", () => {
      if (tMoved > 8) marcarArrastreMarcas();
      reanudarMarcas(2200);
    }, { passive: true });

    brandsBar.addEventListener("click", (e) => {
      if (brandsBar.getAttribute("data-dragged-recently") === "1") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const pill = e.target.closest(".alive-brand-pill");
      if (!pill) return;
      const brandFilter = pill.getAttribute("data-brand-filter");
      const brandKeyword = pill.getAttribute("data-brand-keyword");
      const sInput = document.getElementById("searchInput");
      const lSelect = document.getElementById("lineFilter");

      state.cat = "todos";
      document.querySelectorAll("#filterCategorias .filter").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-cat") === "todos");
      });

      if (brandFilter) {
        const yaActiva = state.marca === brandFilter && !state.search.trim();
        state.marca = yaActiva ? "todas" : brandFilter;
        state.search = "";
      } else if (brandKeyword) {
        const yaActiva = state.search.trim().toLowerCase() === brandKeyword.toLowerCase();
        state.marca = "todas";
        state.search = yaActiva ? "" : brandKeyword;
      }

      if (lSelect) lSelect.value = state.marca;
      if (sInput) sInput.value = state.search;
      sincronizarPildorasMarcas();
      renderCatalog();
      document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  // Panel Deslizable de Tarjetas Destacadas (#aliveFeaturedTrack)
  const featTrack = document.getElementById("aliveFeaturedTrack");
  const featDots = Array.from(document.querySelectorAll("#aliveFeatDots .feat-dot"));
  if (featTrack) {
    const desplazarFeat = (dir) => {
      const step = Math.max(180, Math.round(featTrack.clientWidth * 0.85));
      featTrack.scrollBy({ left: dir * step, behavior: "smooth" });
    };
    document.getElementById("featPrevBtn")?.addEventListener("click", () => desplazarFeat(-1));
    document.getElementById("featNextBtn")?.addEventListener("click", () => desplazarFeat(1));
    featTrack.addEventListener("scroll", () => {
      const maxScroll = Math.max(1, featTrack.scrollWidth - featTrack.clientWidth);
      const ratio = featTrack.scrollLeft / maxScroll;
      const activeDot = Math.min(featDots.length - 1, Math.max(0, Math.round(ratio * (featDots.length - 1))));
      featDots.forEach((d, i) => d.classList.toggle("is-active", i === activeDot));
    }, { passive: true });
    habilitarArrastreCarrusel(featTrack);
  }

  // Buscador y filtro de marca
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.search = e.target.value || "";
      sincronizarPildorasMarcas();
      renderCatalog();
    });
  }
  const lineFilter = document.getElementById("lineFilter");
  if (lineFilter) {
    lineFilter.addEventListener("change", (e) => {
      state.marca = e.target.value || "todas";
      sincronizarPildorasMarcas();
      renderCatalog();
    });
  }

  // Click e interacción directa en tarjetas del catálogo (marcar fragancia, +/- directo, modo caja/und, zoom o modal)
  const catalogGrid = document.getElementById("catalogGrid");
  if (catalogGrid) {
    catalogGrid.addEventListener("click", (e) => {
      const zoomBtn = e.target.closest("[data-zoom]");
      if (zoomBtn) {
        e.stopPropagation();
        const gid = zoomBtn.getAttribute("data-zoom");
        const g = GRUPOS_DISTRIBUIDORA.find((x) => x.id === gid);
        if (g) abrirZoom(g.portadaHq || g.portada800 || g.portada, g.nombre, `${g.marca || "Alive"} · ${g.variantes.length} fragancias`, zoomBtn);
        return;
      }

      // 1) Tocar chip de fragancia en la tarjeta: marca esa fragancia y si estaba en 0 le suma 1 caja (o 6 und)
      const pickFrag = e.target.closest("[data-pick-frag]");
      if (pickFrag) {
        e.stopPropagation();
        const code = pickFrag.getAttribute("data-pick-frag");
        const gid = pickFrag.getAttribute("data-pick-group");
        const g = GRUPOS_DISTRIBUIDORA.find((x) => x.id === gid);
        if (!g) return;
        const yaEraActiva = state.fragActivaPorGrupo[gid] === code;
        state.fragActivaPorGrupo[gid] = code;
        const modo = obtenerModoTarjetaGrupo(g);
        const q = getItemQty(code);
        const actual = modo === "unidad" ? q.unidades : q.cajas;
        if (actual === 0) {
          setFragQty(code, modo, modo === "unidad" ? 6 : 1);
        } else if (yaEraActiva) {
          // Si vuelve a tocar la misma fragancia activa que ya tenía cantidad, suma 1 más
          setFragQty(code, modo, actual + 1);
        }
        renderCatalog();
        return;
      }

      // 2) Cambiar modo Caja / Unidad en la tarjeta
      const modoBtn = e.target.closest("[data-card-modo]");
      if (modoBtn) {
        e.stopPropagation();
        const gid = modoBtn.getAttribute("data-card-grp");
        const nuevoModo = modoBtn.getAttribute("data-card-modo") === "unidad" ? "unidad" : "caja";
        state.modoPorGrupo[gid] = nuevoModo;
        renderCatalog();
        return;
      }

      // 3) Botón + directo en la tarjeta
      const cardInc = e.target.closest("[data-card-inc]");
      if (cardInc) {
        e.stopPropagation();
        const code = cardInc.getAttribute("data-card-inc");
        const gid = cardInc.getAttribute("data-card-grp");
        const g = GRUPOS_DISTRIBUIDORA.find((x) => x.id === gid);
        if (!g) return;
        const modo = obtenerModoTarjetaGrupo(g);
        const q = getItemQty(code);
        const actual = modo === "unidad" ? q.unidades : q.cajas;
        const next = modo === "unidad" && actual === 0 ? 6 : actual + 1;
        setFragQty(code, modo, next);
        renderCatalog();
        return;
      }

      // 4) Botón − directo en la tarjeta
      const cardDec = e.target.closest("[data-card-dec]");
      if (cardDec) {
        e.stopPropagation();
        const code = cardDec.getAttribute("data-card-dec");
        const gid = cardDec.getAttribute("data-card-grp");
        const g = GRUPOS_DISTRIBUIDORA.find((x) => x.id === gid);
        if (!g) return;
        const modo = obtenerModoTarjetaGrupo(g);
        const q = getItemQty(code);
        const actual = modo === "unidad" ? q.unidades : q.cajas;
        setFragQty(code, modo, Math.max(0, actual - 1));
        renderCatalog();
        return;
      }

      // 5) Ignorar click en el input numérico directo (lo manejan focusin / input)
      if (e.target.closest("[data-card-input]")) {
        e.stopPropagation();
        return;
      }

      // 6) Abrir modal detallado de fragancias
      const openBtn = e.target.closest("[data-open-group]");
      if (openBtn) {
        openFragModal(openBtn.getAttribute("data-open-group"));
        return;
      }

      // 7) Tocar en el cuerpo general de la tarjeta abre el modal (o si tiene 1 sola variante, suma directo)
      const cardEl = e.target.closest(".card[data-group-card]");
      if (cardEl && !e.target.closest("button, input, a")) {
        const gid = cardEl.getAttribute("data-group-card");
        openFragModal(gid);
      }
    });

    catalogGrid.addEventListener("focusin", (e) => {
      const inp = e.target.closest("[data-card-input]");
      if (!inp) return;
      const code = inp.getAttribute("data-card-input");
      const gid = inp.getAttribute("data-card-grp");
      const g = GRUPOS_DISTRIBUIDORA.find((x) => x.id === gid);
      if (!g) return;
      const modo = obtenerModoTarjetaGrupo(g);
      const actual = Number(inp.value) || 0;
      if (modo === "unidad" && actual === 0) {
        inp.value = "6";
        setFragQty(code, "unidad", 6);
        setTimeout(() => { try { inp.select(); } catch (_) {} }, 0);
      }
    });

    catalogGrid.addEventListener("input", (e) => {
      const inp = e.target.closest("[data-card-input]");
      if (!inp) return;
      const code = inp.getAttribute("data-card-input");
      const gid = inp.getAttribute("data-card-grp");
      const g = GRUPOS_DISTRIBUIDORA.find((x) => x.id === gid);
      if (!g) return;
      const modo = obtenerModoTarjetaGrupo(g);
      setFragQty(code, modo, inp.value);
    });

    catalogGrid.addEventListener("change", (e) => {
      const inp = e.target.closest("[data-card-input]");
      if (!inp) return;
      renderCatalog();
    });
  }

  // Modal de Fragancias: cambio de modo Caja vs Unidad
  document.getElementById("btnModoCaja")?.addEventListener("click", () => {
    state.modoVentaActual = "caja";
    if (state.grupoActivoId) state.modoPorGrupo[state.grupoActivoId] = "caja";
    renderFragModalContent();
  });
  document.getElementById("btnModoUnidad")?.addEventListener("click", () => {
    state.modoVentaActual = "unidad";
    if (state.grupoActivoId) state.modoPorGrupo[state.grupoActivoId] = "unidad";
    renderFragModalContent();
  });

  // Modal de Fragancias: controles +/-, check de fila, vista previa individual e inputs (con regla de 6 unidades por defecto)
  const actualizarPreviewModalVariante = (code) => {
    const p = allProductsMap()[code];
    const imgEl = document.getElementById("fragModalImg");
    if (p && imgEl) {
      const s800 = p.img800 || p.img;
      const sHq = p.imgHq || s800;
      imgEl.src = s800;
      imgEl.srcset = `${s800} 1x, ${sHq} 2x`;
      imgEl.alt = p.name;
    }
  };

  const fragGrid = document.getElementById("fragGrid");
  if (fragGrid) {
    fragGrid.addEventListener("pointerover", (e) => {
      const card = e.target.closest("[data-frag-preview]");
      if (card) actualizarPreviewModalVariante(card.getAttribute("data-frag-preview"));
    });

    fragGrid.addEventListener("click", (e) => {
      const previewCard = e.target.closest("[data-frag-preview]");
      if (previewCard) actualizarPreviewModalVariante(previewCard.getAttribute("data-frag-preview"));

      const zoomVar = e.target.closest("[data-zoom-var]");
      if (zoomVar) {
        e.stopPropagation();
        const code = zoomVar.getAttribute("data-zoom-var");
        const p = allProductsMap()[code];
        if (p) abrirZoom(p.imgHq || p.img800 || p.img400, p.fragancia, p.grupoNombre, zoomVar);
        return;
      }

      const quickBtn = e.target.closest("[data-quick-und]");
      if (quickBtn) {
        e.stopPropagation();
        const code = quickBtn.getAttribute("data-code");
        if (esVarianteAgotada(code)) return;
        const cant = Number(quickBtn.getAttribute("data-quick-und")) || 6;
        setFragQty(code, "unidad", cant);
        renderFragModalContent();
        return;
      }

      // IMPORTANTE: evaluar [data-frag-dec] ANTES que [data-frag-inc] porque .frag-img-minus
      // está dentro de .frag-card-img-wrap[data-frag-inc]
      const decBtn = e.target.closest("[data-frag-dec]");
      if (decBtn) {
        e.preventDefault();
        e.stopPropagation();
        const code = decBtn.getAttribute("data-frag-dec");
        const q = getItemQty(code);
        const modoVentaActual = state.modoVentaActual;
        const actual = modoVentaActual === "unidad" ? q.unidades : q.cajas;
        const next = Math.max(0, actual - 1);
        setFragQty(code, modoVentaActual, next);
        renderFragModalContent();
        return;
      }

      const incBtn = e.target.closest("[data-frag-inc]");
      if (incBtn && !e.target.closest("[data-frag-dec], [data-zoom-var], input")) {
        e.stopPropagation();
        const code = incBtn.getAttribute("data-frag-inc");
        if (esVarianteAgotada(code)) return;
        const q = getItemQty(code);
        const modoVentaActual = state.modoVentaActual;
        const actual = modoVentaActual === "unidad" ? q.unidades : q.cajas;
        const next = modoVentaActual === "unidad" && actual === 0 ? 6 : actual + 1;
        setFragQty(code, modoVentaActual, next);
        renderFragModalContent();
        return;
      }

      // Tocar la fila (imagen, check o título) marca/desmarca esa fragancia
      const toggleEl = e.target.closest("[data-frag-toggle]");
      if (toggleEl && !e.target.closest("button, input")) {
        const code = toggleEl.getAttribute("data-frag-toggle");
        const q = getItemQty(code);
        const modoVentaActual = state.modoVentaActual;
        const actual = modoVentaActual === "unidad" ? q.unidades : q.cajas;
        const next = actual > 0 ? 0 : (modoVentaActual === "unidad" ? 6 : 1);
        setFragQty(code, modoVentaActual, next);
        renderFragModalContent();
      }
    });

    fragGrid.addEventListener("focusin", (e) => {
      const inp = e.target.closest("[data-frag-input]");
      if (!inp) return;
      const code = inp.getAttribute("data-frag-input");
      const actual = Number(inp.value) || 0;
      if (state.modoVentaActual === "unidad" && actual === 0) {
        inp.value = "6";
        setFragQty(code, "unidad", 6);
        sincronizarFilaFragEnVivo(code);
        setTimeout(() => { try { inp.select(); } catch (_) {} }, 0);
      }
    });

    fragGrid.addEventListener("input", (e) => {
      const inp = e.target.closest("[data-frag-input]");
      if (!inp) return;
      const code = inp.getAttribute("data-frag-input");
      setFragQty(code, state.modoVentaActual, inp.value);
      sincronizarFilaFragEnVivo(code);
    });

    fragGrid.addEventListener("change", (e) => {
      const inp = e.target.closest("[data-frag-input]");
      if (!inp) return;
      const code = inp.getAttribute("data-frag-input");
      setFragQty(code, state.modoVentaActual, inp.value);
      sincronizarFilaFragEnVivo(code);
    });
  }

  document.getElementById("btnLimpiarGrupo")?.addEventListener("click", () => {
    const g = GRUPOS_DISTRIBUIDORA.find((x) => x.id === state.grupoActivoId);
    if (!g) return;
    g.variantes.forEach((v) => { delete state.cart[v.code]; });
    saveCart();
    updateCartUI();
    renderFragModalContent();
  });

  document.getElementById("btnIrPedidoDesdeFrag")?.addEventListener("click", () => {
    closeFragModal();
    if (window.SkalaCRM && typeof window.SkalaCRM.elegirModo === "function" && (totalCajas() > 0 || totalUnidadesSueltas() > 0)) {
      window.SkalaCRM.elegirModo();
    } else {
      openModal();
    }
  });

  document.querySelectorAll("[data-close-frag]").forEach((el) => {
    el.addEventListener("click", closeFragModal);
  });
  document.getElementById("fragModal")?.addEventListener("click", (e) => {
    if (e.target.id === "fragModal") closeFragModal();
  });

  // Modal de Configuración de Unidades (Vendedor)
  document.getElementById("btnConfigUnidades")?.addEventListener("click", openConfigModal);
  document.querySelectorAll("[data-close-config]").forEach((el) => {
    el.addEventListener("click", closeConfigModal);
  });
  document.getElementById("configUnidadModal")?.addEventListener("click", (e) => {
    if (e.target.id === "configUnidadModal") closeConfigModal();
  });
  document.getElementById("configUnidadList")?.addEventListener("change", (e) => {
    const chk = e.target.closest("[data-cfg-group]");
    if (!chk) return;
    const gid = chk.getAttribute("data-cfg-group");
    if (!state.configGrupos[gid]) state.configGrupos[gid] = cfgGrupo(gid);
    state.configGrupos[gid].permiteUnidad = chk.checked;
    saveConfigGrupos();
  });
  document.getElementById("btnHabilitarTodasUnidades")?.addEventListener("click", () => {
    GRUPOS_DISTRIBUIDORA.forEach((g) => {
      if (!state.configGrupos[g.id]) state.configGrupos[g.id] = cfgGrupo(g.id);
      state.configGrupos[g.id].permiteUnidad = true;
    });
    saveConfigGrupos();
    openConfigModal();
  });
  document.getElementById("btnSoloCajasTodos")?.addEventListener("click", () => {
    GRUPOS_DISTRIBUIDORA.forEach((g) => {
      if (!state.configGrupos[g.id]) state.configGrupos[g.id] = cfgGrupo(g.id);
      state.configGrupos[g.id].permiteUnidad = false;
    });
    saveConfigGrupos();
    openConfigModal();
  });

  // Abrir Modal de Pedido / Modo
  const abrirFlujoPedido = () => {
    if (totalCajas() <= 0 && totalUnidadesSueltas() <= 0) {
      document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (window.SkalaCRM && typeof window.SkalaCRM.elegirModo === "function") {
      window.SkalaCRM.elegirModo();
    } else {
      openModal();
    }
  };
  document.getElementById("openOrderModalBtn")?.addEventListener("click", abrirFlujoPedido);
  document.getElementById("heroOrderBtn")?.addEventListener("click", abrirFlujoPedido);
  document.getElementById("ctaOrderBtn")?.addEventListener("click", abrirFlujoPedido);

  document.getElementById("clearCartBtn")?.addEventListener("click", () => {
    state.cart = {};
    saveCart();
    updateCartUI();
    renderCatalog();
  });

  document.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });
  document.getElementById("orderModal")?.addEventListener("click", (e) => {
    if (e.target.id === "orderModal") closeModal();
  });
  document.getElementById("addMoreBtn")?.addEventListener("click", () => {
    closeModal();
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
  });

  // Eventos dentro de #cartList (sumar, restar, papelera con animación)
  const cartList = document.getElementById("cartList");
  if (cartList) {
    cartList.addEventListener("click", (e) => {
      const inc = e.target.closest("[data-cart-inc]");
      if (inc) {
        const code = inc.getAttribute("data-cart-inc");
        const modo = inc.getAttribute("data-cart-modo") || "caja";
        const q = getItemQty(code);
        setFragQty(code, modo, (modo === "unidad" ? q.unidades : q.cajas) + 1);
        renderOrderModalList();
        renderCatalog();
        return;
      }
      const dec = e.target.closest("[data-cart-dec]");
      if (dec) {
        const code = dec.getAttribute("data-cart-dec");
        const modo = dec.getAttribute("data-cart-modo") || "caja";
        const q = getItemQty(code);
        setFragQty(code, modo, Math.max(0, (modo === "unidad" ? q.unidades : q.cajas) - 1));
        renderOrderModalList();
        renderCatalog();
        return;
      }
      const del = e.target.closest("[data-cart-del]");
      if (del) {
        const code = del.getAttribute("data-cart-del");
        const modo = del.getAttribute("data-cart-modo") || "caja";
        del.classList.add("tirando");
        const row = del.closest(".cart-item");
        if (row) row.classList.add("saliendo");
        setTimeout(() => {
          setFragQty(code, modo, 0);
          renderOrderModalList();
          renderCatalog();
        }, 260);
      }
    });

    cartList.addEventListener("change", (e) => {
      const inp = e.target.closest("[data-cart-input]");
      if (!inp) return;
      const code = inp.getAttribute("data-cart-input");
      const modo = inp.getAttribute("data-cart-modo") || "caja";
      setFragQty(code, modo, inp.value);
      renderOrderModalList();
      renderCatalog();
    });
  }

  // Formas de pago en #orderModal
  document.getElementById("btnPagos")?.addEventListener("click", () => {
    state.pagosAbiertos = !state.pagosAbiertos;
    renderPagosWeb();
  });
  document.getElementById("pagoElegido")?.addEventListener("click", () => {
    state.pagosAbiertos = !state.pagosAbiertos;
    renderPagosWeb();
  });
  document.getElementById("pagosWeb")?.addEventListener("change", (e) => {
    const r = e.target.closest('input[name="pagoWeb"]');
    if (!r) return;
    state.pago = r.value;
    state.pagosAbiertos = false;
    renderOrderModalList();
    updateCartUI();
  });

  // Datos del cliente en #orderModal
  document.getElementById("btnDatosCli")?.addEventListener("click", () => {
    state.datosCliAbiertos = !state.datosCliAbiertos;
    const campos = document.getElementById("cliCampos");
    const btn = document.getElementById("btnDatosCli");
    if (campos) campos.hidden = !state.datosCliAbiertos;
    if (btn) {
      btn.textContent = state.datosCliAbiertos ? "Ocultar" : "Completar";
      btn.setAttribute("aria-expanded", state.datosCliAbiertos ? "true" : "false");
    }
  });
  document.getElementById("btnCliNuevo")?.addEventListener("click", () => {
    const fc = document.getElementById("cliFormCampos");
    if (fc) fc.hidden = false;
    document.getElementById("fNombre")?.focus();
  });
  document.getElementById("fCliBuscar")?.addEventListener("input", (e) => {
    clearTimeout(timerCliBusq);
    timerCliBusq = setTimeout(() => buscarClienteEnCatalogo(e.target.value), 260);
  });
  document.getElementById("fCliResultados")?.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-pick-cli]");
    if (!pick) return;
    try {
      const c = JSON.parse(pick.getAttribute("data-pick-cli"));
      aplicarClienteElegido(c);
    } catch (_) {}
  });
  document.getElementById("btnUbic")?.addEventListener("click", tomarUbicacionWeb);

  // Envío del formulario #orderForm
  document.getElementById("orderForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (totalCajas() <= 0 && totalUnidadesSueltas() <= 0) return;

    await cargarVendedores();
    const vAsig = vendedorAsignado();
    const datosCli = {
      nombre: document.getElementById("fNombre")?.value.trim() || "",
      negocio: document.getElementById("fNegocio")?.value.trim() || "",
      rif: document.getElementById("fRif")?.value.trim() || "",
      telefono: document.getElementById("fTelefono")?.value.trim() || "",
      ciudad: document.getElementById("fCiudad")?.value.trim() || "",
      direccion: document.getElementById("fDireccion")?.value.trim() || "",
      notas: document.getElementById("fNotas")?.value.trim() || "",
      vendedor: vAsig ? vAsig.nombre : "",
    };

    const msg = construirMensajeWhatsApp(datosCli);
    let refGenerada = typeof refWeb === "function" ? refWeb() : "";

    try {
      if (typeof SkalaAPI !== "undefined" && SkalaAPI.api) {
        const map = allProductsMap();
        const itemsPayload = [];
        for (const [code, it] of Object.entries(state.cart)) {
          const p = map[code];
          if (!p) continue;
          const cj = (Number(it.cajas) || 0) + ((Number(it.unidades) || 0) > 0 && !(Number(it.cajas) > 0) ? 1 : 0);
          if (cj > 0) {
            itemsPayload.push({
              code,
              producto: `${p.grupoNombre} · ${p.fragancia}`,
              cajas: cj,
              unidades_caja: p.unidades || 12,
              unidad: p.unidad || "unidades",
            });
          }
        }
        const vendId = (vAsig && vAsig.id) || "";
        const rPed = await SkalaAPI.api("pedidoWeb", {
          ref: refGenerada,
          vendedor_id: vendId,
          tipo_pago: state.pago || "credito",
          nota: [datosCli.ciudad ? `Ciudad/Ruta: ${datosCli.ciudad}` : "", datosCli.notas].filter(Boolean).join(" · "),
          cliente: {
            cliente_id: (state.clienteWeb && (state.clienteWeb.id || state.clienteWeb.cliente_id)) || "",
            negocio: datosCli.negocio || datosCli.nombre || "Cliente Web Dist. Ontiveros",
            contacto: datosCli.nombre || datosCli.negocio || "",
            rif_cedula: datosCli.rif || "",
            telefono: datosCli.telefono || "",
            direccion: datosCli.direccion || "",
            ruta: rutaClienteActual() || "",
            latitud: state.ubicacion ? state.ubicacion.lat : "",
            longitud: state.ubicacion ? state.ubicacion.lng : "",
          },
          items: itemsPayload,
        }).catch(() => null);
        if (rPed && rPed.id) refGenerada = rPed.id;
      }
    } catch (_) {}

    await mostrarModalListo(msg, refGenerada);
  });

  // Al tocar un vendedor en #listoVend, asignar el pedido web a ese vendedor
  document.getElementById("listoVend")?.addEventListener("click", (e) => {
    const a = e.target.closest("a.vend-wa[data-vend-id]");
    if (!a) return;
    const vid = a.getAttribute("data-vend-id");
    if (vid && state.ultimoRefWeb && typeof SkalaAPI !== "undefined" && SkalaAPI.enviarSinEsperar) {
      SkalaAPI.enviarSinEsperar("asignarVendedorWeb", { id: state.ultimoRefWeb, vendedor_id: vid });
    }
  });

  // Cerrar #listoModal y #zoomModal (con botón o tocando fuera de la ventana)
  const cerrarListoModal = () => {
    const lm = document.getElementById("listoModal");
    if (lm) lm.hidden = true;
    document.body.classList.remove("modal-open");
  };
  document.querySelectorAll("[data-cerrar-listo]").forEach((el) => {
    el.addEventListener("click", cerrarListoModal);
  });
  document.getElementById("listoModal")?.addEventListener("click", (e) => {
    if (e.target.id === "listoModal") cerrarListoModal();
  });
  document.querySelectorAll("[data-close-zoom]").forEach((el) => {
    el.addEventListener("click", cerrarZoom);
  });
  document.getElementById("zoomModal")?.addEventListener("click", (e) => {
    if (e.target.id === "zoomModal" || e.target.classList.contains("zoom-box")) cerrarZoom();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!document.getElementById("zoomModal")?.hidden) return cerrarZoom();
      if (!document.getElementById("fragModal")?.hidden) return closeFragModal();
      if (!document.getElementById("configUnidadModal")?.hidden) return closeConfigModal();
      if (!document.getElementById("orderModal")?.hidden) return closeModal();
      const lm = document.getElementById("listoModal");
      if (lm && !lm.hidden) { lm.hidden = true; document.body.classList.remove("modal-open"); }
    }
  });
});
