/* ============================================
   SCRIPT.JS — lógica global / presupuesto
============================================ */

/* ===== SIDEBAR ===== */
function toggleMenu() {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.classList.toggle("closed");
}

function cerrarSesion() {
  window.location.href = "ingresar.html";
}

function format(n) {
  return n.toLocaleString("es-AR");
}

/* ── INICIO ── */
if (
  document.getElementById("table-body") &&
  typeof renderTabla === "function" &&
  typeof data !== "undefined"
) {
  renderTabla(data);
}