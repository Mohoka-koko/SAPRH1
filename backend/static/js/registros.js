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
        registrosFiltrados = calcularFiltrados();

        // Reiniciar a la primera página cada vez que se filtra
        paginaActual = 1;
        renderTabla();
    }

    function calcularFiltrados() {
        const tipo = filtroTipo.value;
        const fecha = filtroFecha.value; // Formato YYYY-MM-DD
        const usuario = filtroUsuario.value.trim().toLowerCase();

        return registrosCompletos.filter(reg => {
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

                // Eliminar: solo borradores en 'revisar' y solo si el servidor lo habilitó.
                // (El backend vuelve a verificar rol, estado y dependencias.)
                const btnEliminar = (esRevisar && reg.url_eliminar)
                    ? `<button type="button" class="btn-accion btn-eliminar" data-url="${reg.url_eliminar}" data-reg-id="${reg.id}" data-tipo="${reg.tipo}" data-version="${reg.version || ''}" title="Eliminar borrador" aria-label="Eliminar borrador">
                            <i class="fa-solid fa-trash"></i>
                        </button>`
                    : '';

                // Historial de intervenciones (el servidor lo informa solo para Refuerzo)
                const bloqueHistorial = reg.url_auditoria
                    ? `<div>
                                <strong>Historial:</strong>
                                <button type="button" class="btn-historial-link" data-url="${reg.url_auditoria}" data-reg-id="${reg.id}">Ver intervenciones</button>
                            </div>`
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
                    <td class="col-acciones" data-label="Acciones">${btnVer}${btnEditar}${btnEliminar}</td>
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
                            ${bloqueHistorial}
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

    // ─── ELIMINAR BORRADOR (con confirmación) ───────────────────────────
    const modalEliminar     = document.getElementById('modal-eliminar');
    const msgEliminar       = document.getElementById('modal-eliminar-msg');
    const btnEliminarOk     = document.getElementById('modal-eliminar-confirmar');
    const btnEliminarCancel = document.getElementById('modal-eliminar-cancelar');
    let eliminarPendiente   = null; // { url, regId, tipo, version }

    // El diálogo es el mismo para todos los tipos: el texto cambia según el registro
    const textoEliminar      = document.getElementById('modal-eliminar-texto');
    const TEXTO_ELIMINAR_BASE = textoEliminar ? textoEliminar.textContent : '';
    const TEXTOS_ELIMINAR = {
        'Refuerzo': '¿Está seguro de que desea eliminar este borrador de Refuerzo? Esta acción no se puede deshacer. '
                  + 'No se modificarán saldos ni se generarán movimientos presupuestarios. '
                  + 'Quedará registrado quién lo eliminó y cuándo.',
    };

    // Vuelve a pedir el listado conservando la página actual (p. ej. tras un conflicto de edición)
    async function refrescarRegistrosConservandoPagina() {
        try {
            const resp = await fetch(apiUrl);
            if (!resp.ok) return;
            const data = await resp.json();
            registrosCompletos = data.registros;
            const previa = paginaActual;
            registrosFiltrados = calcularFiltrados();
            paginaActual = Math.min(previa, Math.ceil(registrosFiltrados.length / REGISTROS_POR_PAGINA) || 1);
            renderTabla();
        } catch (err) {
            console.error(err);
        }
    }

    function getCookie(name) {
        const m = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
        return m ? decodeURIComponent(m.split('=')[1]) : '';
    }

    tbody.addEventListener('click', function (e) {
        const btn = e.target.closest('.btn-eliminar');
        if (!btn || !modalEliminar) return;
        eliminarPendiente = {
            url:     btn.dataset.url,
            regId:   btn.dataset.regId,
            tipo:    btn.dataset.tipo,
            version: btn.dataset.version,
        };
        if (textoEliminar) {
            textoEliminar.textContent = TEXTOS_ELIMINAR[eliminarPendiente.tipo] || TEXTO_ELIMINAR_BASE;
        }
        msgEliminar.textContent = '';
        msgEliminar.hidden = true;
        btnEliminarOk.disabled = false;
        modalEliminar.showModal();
    });

    btnEliminarCancel?.addEventListener('click', () => { eliminarPendiente = null; modalEliminar.close(); });

    btnEliminarOk?.addEventListener('click', async function () {
        if (!eliminarPendiente) return;
        btnEliminarOk.disabled = true;
        try {
            // Si el registro informó su versión (Refuerzo), se envía: el servidor se niega a borrar
            // un borrador que alguien modificó después de cargar este listado.
            const opciones = { method: 'POST', headers: { 'X-CSRFToken': getCookie('csrftoken') } };
            if (eliminarPendiente.version) {
                opciones.headers['Content-Type'] = 'application/json';
                opciones.body = JSON.stringify({ version: eliminarPendiente.version });
            }
            const resp = await fetch(eliminarPendiente.url, opciones);
            let data = {};
            try { data = await resp.json(); } catch (_) {}
            if (!resp.ok) {
                msgEliminar.textContent = data.error || `No se pudo eliminar (error ${resp.status}).`;
                msgEliminar.hidden = false;
                if (resp.status === 404 || resp.status === 409) {
                    // El borrador cambió o ya no existe: reintentar con los mismos datos fallaría.
                    // Se deja el mensaje, se actualiza el listado y se cierra con "Cancelar".
                    refrescarRegistrosConservandoPagina();
                } else {
                    btnEliminarOk.disabled = false;
                }
                return;
            }
            registrosCompletos = registrosCompletos.filter(r => r.id !== eliminarPendiente.regId);
            eliminarPendiente = null;
            modalEliminar.close();
            // Re-filtrar conservando la página actual (acotada al total)
            const previa = paginaActual;
            registrosFiltrados = calcularFiltrados();
            paginaActual = Math.min(previa, Math.ceil(registrosFiltrados.length / REGISTROS_POR_PAGINA) || 1);
            renderTabla();
        } catch (err) {
            console.error(err);
            msgEliminar.textContent = 'Error de red: el borrador NO se eliminó.';
            msgEliminar.hidden = false;
            btnEliminarOk.disabled = false;
        }
    });

    // ─── HISTORIAL DE INTERVENCIONES (Refuerzo, solo lectura) ───────────
    const modalHistorial = document.getElementById('modal-historial-refuerzo');

    async function abrirHistorial(btn) {
        if (!modalHistorial) return;
        const lista  = document.getElementById('historial-lista');
        const estado = document.getElementById('historial-estado');
        const sub    = document.getElementById('historial-subtitulo');
        const reg    = registrosCompletos.find(r => r.id === btn.dataset.regId);

        lista.innerHTML = '';
        estado.textContent = 'Cargando…';
        sub.textContent = reg && reg.nro_expediente ? 'Expediente ' + reg.nro_expediente : 'Refuerzo sin expediente';
        modalHistorial.showModal();

        try {
            const resp = await fetch(btn.dataset.url, { headers: { 'Accept': 'application/json' } });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Error');

            if (!data.eventos.length) {
                estado.textContent = 'Sin intervenciones registradas.';
                return;
            }
            estado.textContent = '';
            data.eventos.forEach(ev => {
                const li = document.createElement('li');
                li.className = 'historial-item historial-' + ev.operacion.toLowerCase();

                const cab = document.createElement('div');
                const que = document.createElement('strong');
                que.textContent = ev.texto;
                const quien = document.createElement('span');
                quien.textContent = ' — ' + ev.usuario;
                cab.appendChild(que);
                cab.appendChild(quien);
                li.appendChild(cab);

                const cuando = document.createElement('div');
                cuando.className = 'historial-fecha';
                cuando.textContent = ev.fecha
                    + (ev.cantidad > 1 && ev.fecha_ultima ? ' → ' + ev.fecha_ultima + ' (' + ev.cantidad + ' guardados)' : '');
                li.appendChild(cuando);

                if (ev.campos && ev.campos.length) {
                    const campos = document.createElement('div');
                    campos.className = 'historial-campos';
                    campos.textContent = 'Modificó: ' + ev.campos.join(', ');
                    li.appendChild(campos);
                }
                lista.appendChild(li);
            });
        } catch (err) {
            console.error(err);
            estado.textContent = 'No se pudo cargar el historial.';
        }
    }

    tbody.addEventListener('click', function (e) {
        const btn = e.target.closest('.btn-historial-link');
        if (btn) abrirHistorial(btn);
    });

    document.getElementById('modal-historial-cerrar')?.addEventListener('click', () => modalHistorial.close());

    // Expansión de filas usando delegación de eventos
    tbody.addEventListener("click", function (e) {
        // Si el clic fue en un botón de acción (Ver / Editar / Eliminar), no expandir la fila
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