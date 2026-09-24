/*
 * Decide ANTES del primer pintado si corre la intro de Virex, para que el
 * panel no parpadee. Se carga síncrono desde el <head> (ver app/layout.tsx).
 *
 * - Una vez por sesión del navegador: abrir el panel a la mañana es el ritual;
 *   navegar entre secciones no la repite.
 * - Nunca con prefers-reduced-motion.
 * - Sólo en el panel: ni en la reserva pública ni en el login (se ve al entrar).
 * - `?intro` en la URL la fuerza (útil para mostrársela al cliente).
 */
(function () {
  try {
    var d = document.documentElement
    var key = "virex:intro"
    if (location.pathname.indexOf("/reservar") === 0 || location.pathname.indexOf("/login") === 0) return
    if (location.search.indexOf("intro") > -1) sessionStorage.removeItem(key)
    if (sessionStorage.getItem(key)) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    sessionStorage.setItem(key, "1")
    d.setAttribute("data-intro", "play")
  } catch (e) {}
})()
