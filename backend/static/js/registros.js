/* ============================================
   REGISTROS.JS — lógica exclusiva de Registros
   (preparado para funcionalidad futura)
============================================ */

document.addEventListener('DOMContentLoaded', function () {
    const filtroTipo = document.getElementById('filtro-tipo');
    const filtroFecha = document.getElementById('filtro-fecha');
    const filtroUsuario = document.getElementById('filtro-usuario');
    const filas = document.querySelectorAll('#tabla-registros-body tr');

    function aplicarFiltros() {
        const tipo = filtroTipo.value;
        const fecha = filtroFecha.value; // formato YYYY-MM-DD
        const usuario = filtroUsuario.value.trim().toLowerCase();

        filas.forEach(function (fila) {
            const coincideTipo = !tipo || fila.dataset.tipo === tipo;
            const coincideFecha = !fecha || fila.dataset.fecha === fecha;
            const coincideUsuario = !usuario || fila.dataset.usuario.toLowerCase().includes(usuario);

            fila.style.display = (coincideTipo && coincideFecha && coincideUsuario) ? '' : 'none';
        });
    }

    filtroTipo.addEventListener('change', aplicarFiltros);
    filtroFecha.addEventListener('change', aplicarFiltros);
    filtroUsuario.addEventListener('input', aplicarFiltros);
});