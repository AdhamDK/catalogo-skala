/* Skala — tema claro / oscuro.
   Se carga en el <head> (antes de pintar) para que no haya parpadeo.
   Preferencia guardada en el teléfono: "auto" (sigue al sistema), "claro" u "oscuro". */
(function () {
  var K = "skala_tema";
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function pref() {
    try { var p = localStorage.getItem(K); return p === "claro" || p === "oscuro" ? p : "auto"; } catch (e) { return "auto"; }
  }
  function aplicar(forzar) {
    var p = pref();
    var t = forzar || (p === "auto" ? (mq && mq.matches ? "oscuro" : "claro") : p);
    var html = document.documentElement;
    html.setAttribute("data-tema", t);
    html.setAttribute("data-tema-pref", p);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "oscuro" ? "#171614" : "#fdf7ef");
  }
  aplicar();
  if (mq) {
    if (mq.addEventListener) mq.addEventListener("change", function () { aplicar(); });
    else if (mq.addListener) mq.addListener(function () { aplicar(); });
  }
  // Al imprimir o guardar PDF, siempre claro
  window.addEventListener("beforeprint", function () { aplicar("claro"); });
  window.addEventListener("afterprint", function () { aplicar(); });
  window.SkalaTema = {
    pref: pref,
    actual: function () { return document.documentElement.getAttribute("data-tema"); },
    fijar: function (p) {
      try { if (p === "auto") localStorage.removeItem(K); else localStorage.setItem(K, p); } catch (e) {}
      aplicar();
    },
  };
})();
