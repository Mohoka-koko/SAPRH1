document.addEventListener("DOMContentLoaded", function () {

    const filtros = {
        ejercicio:   document.getElementById("filtro-ejercicio"),
        asiento:     document.getElementById("filtro-asiento"),
        expediente:  document.getElementById("filtro-expediente"),
        fecha:       document.getElementById("filtro-fecha"),
        usuario:     document.getElementById("filtro-usuario"),
        estado:      document.getElementById("filtro-estado"),
    };

    const filas        = document.querySelectorAll(".fila-imp");
    const sinResultados = document.getElementById("sin-resultados");

    function aplicarFiltros() {
        let visibles = 0;

        filas.forEach((fila) => {
            const coincide =
                fila.dataset.ejercicio.toLowerCase().includes(filtros.ejercicio.value.toLowerCase()) &&
                fila.dataset.asiento.toLowerCase().includes(filtros.asiento.value.toLowerCase()) &&
                fila.dataset.expediente.toLowerCase().includes(filtros.expediente.value.toLowerCase()) &&
                fila.dataset.fecha.toLowerCase().includes(filtros.fecha.value.toLowerCase()) &&
                fila.dataset.usuario.toLowerCase().includes(filtros.usuario.value.toLowerCase()) &&
                (filtros.estado.value === "" || fila.dataset.estado === filtros.estado.value);

            fila.style.display = coincide ? "" : "none";
            if (coincide) visibles++;
        });

        sinResultados.style.display = visibles === 0 ? "block" : "none";
    }

    Object.values(filtros).forEach((input) => {
        input.addEventListener("input", aplicarFiltros);
        input.addEventListener("change", aplicarFiltros);
    });

    document.getElementById("btn-limpiar-filtros").addEventListener("click", () => {
        Object.values(filtros).forEach((input) => { input.value = ""; });
        aplicarFiltros();
    });
});