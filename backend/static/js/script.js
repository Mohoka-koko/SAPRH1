/* ============================================
   SCRIPT.JS — lógica global / presupuesto
============================================ */

/* ===== SIDEBAR ===== */
function toggleMenu() {
  document.getElementById("sidebar").classList.toggle("closed");
}

function cerrarSesion() {
  window.location.href = "ingresar.html";
}

function format(n) {
  return n.toLocaleString("es-AR");
}

/* ── INICIO ── */
if (document.getElementById("table-body")) {
  renderTabla(data);
}