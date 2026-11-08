/* ============================================================
   Distribuciones Ontiveros — Catálogo: acceso del equipo
   El trabajo del equipo vive en panel.html (js/panel.js).
   Aquí solo: botón Ingresar / nombre, y "Armar pedido" → Cliente, Detalles o Vendedor.
   ============================================================ */
(function () {
  const $ = (id) => document.getElementById(id);
  const irAlPanel = (ruta) => {
    if (typeof sincronizarCarritoConPanel === "function") sincronizarCarritoConPanel();
    location.href = "panel.html#/" + ruta;
  };

  function pintarSesion() {
    const btn = $("btnCuenta");
    if (!btn || typeof SkalaAPI === "undefined") return;
    const s = SkalaAPI.sesion();
    const label = s ? s.usuario.nombre : "Login";
    btn.innerHTML = `<span class="login-bars" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg></span><span class="login-txt">${label}</span>`;
    btn.classList.toggle("con-sesion", !!s);
    btn.setAttribute("aria-label", s ? `Panel de ${s.usuario.nombre} (${s.usuario.rol_nombre})` : "Login al panel del equipo");
  }

  function cerrarModo() {
    const m = $("modoModal");
    if (m) m.hidden = true;
    const om = $("orderModal");
    if (!om || om.hidden) document.body.classList.remove("modal-open");
  }

  function hayProductosEnPedido() {
    const cj = typeof totalCajas === "function" ? totalCajas() : 0;
    const und = typeof totalUnidadesSueltas === "function" ? totalUnidadesSueltas() : 0;
    return cj > 0 || und > 0;
  }

  /* "Armar pedido": vendedor con sesión → directo al panel; si no, preguntar */
  function elegirModo() {
    if (!hayProductosEnPedido()) return;
    const s = typeof SkalaAPI !== "undefined" ? SkalaAPI.sesion() : null;
    if (s && typeof puedeTomarPedidos === "function" && puedeTomarPedidos(s.usuario.roles || s.usuario.rol)) {
      return irAlPanel("nuevo");
    }
    if (typeof closeModal === "function") closeModal();
    if (typeof cargarVendedores === "function") cargarVendedores();
    const m = $("modoModal");
    if (!m) {
      if (typeof openModal === "function") openModal();
      return;
    }
    m.hidden = false;
    document.body.classList.add("modal-open");
    const box = m.querySelector(".modal-box");
    if (box) box.focus({ preventScroll: true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    pintarSesion();
    const btnCuenta = $("btnCuenta");
    if (btnCuenta) {
      btnCuenta.addEventListener("click", () => irAlPanel(SkalaAPI.sesion() ? "inicio" : "ingresar"));
    }
    const footAcceso = $("footAcceso");
    if (footAcceso) {
      footAcceso.addEventListener("click", (e) => { e.preventDefault(); irAlPanel("inicio"); });
    }
    const btnModoCliente = $("btnModoCliente");
    if (btnModoCliente) {
      btnModoCliente.addEventListener("click", () => { cerrarModo(); if (typeof enviarDirectoVendedor === "function") enviarDirectoVendedor(); });
    }
    const btnModoDetalles = $("btnModoDetalles");
    if (btnModoDetalles) {
      btnModoDetalles.addEventListener("click", () => { cerrarModo(); if (typeof openModal === "function") openModal(); });
    }
    const btnModoVendedor = $("btnModoVendedor");
    if (btnModoVendedor) {
      btnModoVendedor.addEventListener("click", () => irAlPanel("nuevo"));
    }
    const modoModal = $("modoModal");
    if (modoModal) {
      modoModal.addEventListener("click", (e) => {
        if (e.target.id === "modoModal" || e.target.closest("[data-cerrar]")) cerrarModo();
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modoModal && !modoModal.hidden) cerrarModo();
    });

    /* Tema claro / oscuro (pie de página) */
    const btnTema = $("btnTema");
    if (btnTema && typeof SkalaTema !== "undefined") {
      const pintarTema = () => { btnTema.textContent = SkalaTema.actual() === "oscuro" ? "Tema claro" : "Tema oscuro"; };
      btnTema.addEventListener("click", () => { SkalaTema.fijar(SkalaTema.actual() === "oscuro" ? "claro" : "oscuro"); pintarTema(); });
      pintarTema();
    }
  });

  window.SkalaCRM = { elegirModo };
})();
