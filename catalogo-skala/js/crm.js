/* ============================================================
   Skala — Catálogo: acceso del equipo
   El trabajo del equipo vive en panel.html (js/panel.js).
   Aquí solo: botón Ingresar / nombre, y "Armar pedido" → Cliente o Vendedor.
   El carrito (localStorage skala_pedido_v1) se comparte con el panel.
   ============================================================ */
(function () {
  const $ = (id) => document.getElementById(id);
  const irAlPanel = (ruta) => { location.href = "panel.html#/" + ruta; };

  function pintarSesion() {
    const s = SkalaAPI.sesion();
    const btn = $("btnCuenta");
    btn.textContent = s ? s.usuario.nombre : "Ingresar";
    btn.classList.toggle("con-sesion", !!s);
    btn.setAttribute("aria-label", s ? `Panel de ${s.usuario.nombre} (${s.usuario.rol_nombre})` : "Ingresar al panel del equipo");
  }

  function cerrarModo() {
    $("modoModal").hidden = true;
    if ($("orderModal").hidden) document.body.classList.remove("modal-open");
  }

  /* "Armar pedido": vendedor con sesión → directo al panel; si no, preguntar */
  function elegirModo() {
    if (totalCajas() <= 0) return;
    const s = SkalaAPI.sesion();
    if (s && puedeTomarPedidos(s.usuario.rol)) return irAlPanel("nuevo");
    if (typeof closeModal === "function") closeModal();
    $("modoModal").hidden = false;
    document.body.classList.add("modal-open");
    $("modoModal").querySelector(".modal-box").focus({ preventScroll: true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    pintarSesion();
    $("btnCuenta").addEventListener("click", () => irAlPanel(SkalaAPI.sesion() ? "inicio" : "ingresar"));
    $("footAcceso").addEventListener("click", (e) => { e.preventDefault(); irAlPanel("inicio"); });
    $("btnModoCliente").addEventListener("click", () => { cerrarModo(); openModal(); });
    $("btnModoVendedor").addEventListener("click", () => irAlPanel("nuevo"));
    $("modoModal").addEventListener("click", (e) => {
      if (e.target.id === "modoModal" || e.target.closest("[data-cerrar]")) cerrarModo();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("modoModal").hidden) cerrarModo(); });

    /* Tema claro / oscuro (pie de página) */
    const btnTema = $("btnTema");
    const pintarTema = () => { btnTema.textContent = SkalaTema.actual() === "oscuro" ? "Tema claro" : "Tema oscuro"; };
    btnTema.addEventListener("click", () => { SkalaTema.fijar(SkalaTema.actual() === "oscuro" ? "claro" : "oscuro"); pintarTema(); });
    pintarTema();
  });

  window.SkalaCRM = { elegirModo };
})();
