document.addEventListener('DOMContentLoaded', function () {
    const tbody = document.getElementById('tabla-registros-body');
    const filtroTipo = document.getElementById('filtro-tipo');
    const filtroFecha = document.getElementById('filtro-fecha');
    const filtroUsuario = document.getElementById('filtro-usuario');
    const apiUrl = tbody.getAttribute('data-api-url');

    const COLUMNAS = 7;

    // ─── VARIABLES DE ESTADO Y PAGINACIÓN ──────────────────────────────
    let registrosCompletos = []; // Almacena todo el JSON original
    let registrosFiltrados = []; // Almacena los resultados tras aplicar filtros
    let paginaActual = 1;
    const REGISTROS_POR_PAGINA = 8; // Puedes cambiar este número

    cargarRegistros();

    // Fila de mensaje (cargando / error / sin resultados)
    function filaMensaje(texto) {
        return `<tr class="fila-mensaje"><td colspan="${COLUMNAS}" style="text-align: center;">${texto}</td></tr>`;
    }

    async function cargarRegistros() {
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error("Error en la red");

            const data = await response.json();
            registrosCompletos = data.registros;
            aplicarFiltros(); // Inicia el proceso de filtrado y renderizado
        } catch (error) {
            console.error("Error al cargar datos:", error);
            tbody.innerHTML = filaMensaje("Error al cargar los datos.");
        }
    }

    // ─── LÓGICA DE FILTROS SOBRE EL ARRAY ───────────────────────────────
    function aplicarFiltros() {
        const tipo = filtroTipo.value;
        const fecha = filtroFecha.value; // Formato YYYY-MM-DD
        const usuario = filtroUsuario.value.trim().toLowerCase();

        registrosFiltrados = registrosCompletos.filter(reg => {
            const tipoInfo = obtenerDatosTipo(reg.tipo);

            let dataFecha = '';
            if (reg.fecha_creacion) {
                const [fechaParte] = reg.fecha_creacion.split(' - ');
                const [dia, mes, anio] = fechaParte.split('/');
                dataFecha = `${anio}-${mes}-${dia}`;
            }

            const coincideTipo = !tipo || tipoInfo.filtro === tipo;
            const coincideFecha = !fecha || dataFecha === fecha;
            const coincideUsuario = !usuario || reg.creado_por.toLowerCase().includes(usuario);

            return coincideTipo && coincideFecha && coincideUsuario;
        });

        // Reiniciar a la primera página cada vez que se filtra
        paginaActual = 1;
        renderTabla();
    }

    // ─── RENDERIZADO DE TABLA (SOLO LA PÁGINA ACTUAL) ───────────────────
    function renderTabla() {
        tbody.innerHTML = '';

        const inicio = (paginaActual - 1) * REGISTROS_POR_PAGINA;
        const fin = inicio + REGISTROS_POR_PAGINA;
        const paginaRegistros = registrosFiltrados.slice(inicio, fin);

        if (paginaRegistros.length === 0) {
            tbody.innerHTML = filaMensaje("No se encontraron registros.");
        } else {
            paginaRegistros.forEach(reg => {
                const tipoInfo = obtenerDatosTipo(reg.tipo);

                const estadoLower = (reg.estado || '').trim().toLowerCase();
                const esRevisar = estadoLower === 'revisar';

                let claseEstado = 'badge-revisar';
                if (estadoLower === 'listo') claseEstado = 'badge-listo';
                else if (estadoLower === 'revisar') claseEstado = 'badge-revisar';

                // Los borradores de imputación todavía no tienen detalle definitivo para "ver"
                const esBorradorImputacion = esRevisar && reg.tipo === 'Imputación';

                // Ver: visible en todos los registros, salvo borradores de imputación
                const btnVer = esBorradorImputacion
                    ? ''
                    : `<a href="${reg.url_ver || '#'}" class="btn-accion btn-ver" title="Ver" aria-label="Ver">
                            <i class="fa-solid fa-eye"></i>
                        </a>`;

                // Editar: solo si el estado es 'revisar' Y el servidor indicó adónde ir
                // (en los borradores, url_editar viene solo para quien los creó)
                const btnEditar = (esRevisar && reg.url_editar)
                    ? `<a href="${reg.url_editar}" class="btn-accion btn-editar" title="Retomar borrador" aria-label="Retomar borrador">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </a>`
                    : '';

                // Fila principal (los data-label los usa el CSS en vista móvil)
                const trPrincipal = document.createElement('tr');
                trPrincipal.className = 'registro-row';

                trPrincipal.innerHTML = `
                    <td data-label="Tipo">
                        <span class="badge-tipo ${tipoInfo.clase}">${reg.tipo}</span>
                    </td>
                    <td data-label="N.º de expediente">${reg.nro_expediente || '<em>Sin expediente</em>'}</td>
                    <td data-label="Fecha de creación">${reg.fecha_creacion}</td>
                    <td data-label="Creado por">${reg.creado_por}</td>
                    <td data-label="Estado">
                        <span class="badge ${claseEstado}">${reg.estado}</span>
                    </td>
                    <td class="col-acciones" data-label="Acciones">${btnVer}${btnEditar}</td>
                    <td class="expandir" data-label="Más información">
                        <button type="button" class="btn-expandir" aria-label="Ver más información">
                            <i class="fa-solid fa-chevron-down"></i>
                        </button>
                    </td>
                `;

                // Fila detalle oculta
                const trDetalle = document.createElement('tr');
                trDetalle.className = 'detalle-row';
                trDetalle.innerHTML = `
                    <td colspan="${COLUMNAS}">
                        <div class="detalle-contenido">
                            <div>
                                <strong>Fecha de Edicion:</strong>
                                <span>${reg.fecha_modificacion || 'S/N'}</span>
                            </div>
                            <div>
                                <strong>Editado por:</strong>
                                <span>${reg.modificado_por}</span>
                            </div>
                        </div>
                    </td>
                `;

                tbody.appendChild(trPrincipal);
                tbody.appendChild(trDetalle);
            });
        }

        renderPaginacion(registrosFiltrados.length);
    }

    // ─── PAGINACIÓN ─────────────────────────────────────────────────────
    function renderPaginacion(totalRegistros) {
        const infoEl = document.querySelector(".pagination-info");
        if (infoEl) {
            infoEl.textContent = `Total de ${totalRegistros} registro${totalRegistros !== 1 ? "s" : ""} que coinciden con el filtrado`;
        }

        const totalPaginas = Math.ceil(totalRegistros / REGISTROS_POR_PAGINA) || 1;

        const pageText = document.querySelector(".page-number-text");
        const btnPrev  = document.querySelector(".btn-prev");
        const btnNext  = document.querySelector(".btn-next");

        if (!btnPrev || !btnNext) return;

        if (pageText) {
            pageText.textContent = `Página ${paginaActual} de ${totalPaginas}`;
        }

        btnPrev.disabled = paginaActual === 1;
        btnPrev.onclick = () => {
            if (paginaActual > 1) {
                paginaActual--;
                renderTabla();
            }
        };

        btnNext.disabled = paginaActual >= totalPaginas;
        btnNext.onclick = () => {
            if (paginaActual < totalPaginas) {
                paginaActual++;
                renderTabla();
            }
        };
    }

    // ─── EVENTOS Y FUNCIONES AUXILIARES ─────────────────────────────────
    function obtenerDatosTipo(tipo) {
        const mapa = {
            'Imputación': { clase: 'badge-tipo-imputacion', filtro: 'imputacion' },
            'Orden de Pago': { clase: 'badge-tipo-op', filtro: 'op' },
            'Orden de Pago Personal': { clase: 'badge-tipo-op-personal', filtro: 'op-personal' },
            'Modificación': { clase: 'badge-tipo-modificacion', filtro: 'modificacion' },
            'Refuerzo': { clase: 'badge-tipo-refuerzo', filtro: 'refuerzo' }
        };
        return mapa[tipo] || { clase: 'badge-tipo-default', filtro: '' };
    }

    filtroTipo.addEventListener('change', aplicarFiltros);
    filtroFecha.addEventListener('change', aplicarFiltros);
    filtroUsuario.addEventListener('input', aplicarFiltros);

    // Expansión de filas usando delegación de eventos
    tbody.addEventListener("click", function (e) {
        // Si el clic fue en un botón de acción (Ver / Editar), no expandir la fila
        if (e.target.closest(".btn-accion")) return;

        const fila = e.target.closest(".registro-row");
        if (!fila) return;

        const detalle = fila.nextElementSibling;

        if (detalle && detalle.classList.contains("detalle-row")) {
            if (detalle.classList.contains("mostrar")) {
                detalle.classList.remove("mostrar");
                fila.classList.remove("abierto");
            } else {
                detalle.classList.add("mostrar");
                fila.classList.add("abierto");
            }
        }
    });
});