document.addEventListener("DOMContentLoaded", function () {
    const exportBtn = document.getElementById("exportar-pdf-btn");

    if (exportBtn) {
        exportBtn.addEventListener("click", function () {
            window.print();
        });
    }

    const totalDisplay = document.getElementById("total-display");
    const fechaInput = document.getElementById("fecha-actual");
    const compFechaInput = document.getElementById("comp-fecha");
    const contabilizadoSelect = document.getElementById("contabilizado-select");
    const compContabilizadoInput = document.getElementById("comp-contabilizado");
    const agregarFilaBtn = document.getElementById("agregar-fila-btn");
    const borrarFilaBtn = document.getElementById("borrar-fila-btn");
    const filasBody = document.getElementById("filas-body");
    const filaBase = document.querySelector(".fila-registro");

    const panel = document.getElementById('panelSaldos');
        const btnMinimizar = document.getElementById('btnMinimizar');

        // Al presionar la 'X': Encoje el cuadro ocultando la tabla
        btnMinimizar?.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita interferir con clics del contenedor
            panel.classList.add('minimizado');
        });

        // Al hacer clic sobre el botón minimizado: Vuelve a desplegar la tabla
        panel?.addEventListener('click', () => {
            if (panel.classList.contains('minimizado')) {
            panel.classList.remove('minimizado');
            }
        });

    function parseImporte(valorTexto) {
        const valor = valorTexto.trim().replace(/\$/g, "");
        if (!valor) return NaN;

        const normalizado = valor.includes(",")
            ? valor.replace(/\./g, "").replace(",", ".")
            : valor;
        return Number(normalizado);
    }

    function calcularTotal() {
        let total = 0;
        const inputs = document.querySelectorAll(".importe");

        inputs.forEach((input) => {
            const valorTexto = input.value.trim();
            if (!valorTexto) {
                return;
            }

            const valor = parseImporte(valorTexto);

            if (!isNaN(valor)) {
                total += valor;
            }
        });

        if (totalDisplay) {
            totalDisplay.textContent = total === 0
                ? ""
                : "$ " + total.toLocaleString("es-AR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
        }
    }

    const tablaSaldosBody = document.getElementById("tabla-saldos-body");

    function actualizarPanelSaldos() {
        if (!tablaSaldosBody) return;
    
        const filas = document.querySelectorAll("#filas-body tr");
        let filasHtml = "";
    
        filas.forEach((fila, index) => {
            const numeroFila = index + 1; // posición real en el formulario, siempre fija
            const cods = fila.querySelectorAll(".cod");
            const selectFf = cods[6];
    
            let saldoHtml = "-----";
    
            if (selectFf && selectFf.value) {
                const opcionSeleccionada = selectFf.options[selectFf.selectedIndex];
                const saldoRaw = opcionSeleccionada?.dataset.saldo;
    
                if (saldoRaw !== undefined && saldoRaw !== "") {
                    const saldo = parseFloat(saldoRaw);
                    if (!isNaN(saldo)) {
                        saldoHtml = `$ ${saldo.toLocaleString("es-AR", {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                    }
                }
            }
    
            const claseSaldo = saldoHtml === "-----" ? "saldo-pendiente" : "saldo-verde";
    
            filasHtml += `
                <tr>
                    <td>${numeroFila}</td>
                    <td class="${claseSaldo}">${saldoHtml}</td>
                </tr>
            `;
        });
    
        tablaSaldosBody.innerHTML = filasHtml;
    }

    function agregarEventosImporte() {
        const inputs = document.querySelectorAll(".importe");
        inputs.forEach((input) => {
            input.removeEventListener("input", calcularTotal);
            input.addEventListener("input", calcularTotal);
        });
    }

    agregarEventosImporte();
    calcularTotal();

    function formatearFecha(fecha) {
        const fechaObj = new Date(fecha);
        const año = fechaObj.getFullYear();
        const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
        const dia = String(fechaObj.getDate()).padStart(2, '0');
        return `${año}-${mes}-${dia}`;
    }

    function establecerFechaActual() {
        const hoy = new Date();
        const fechaHoy = formatearFecha(hoy);

        [fechaInput, compFechaInput].forEach((el) => {
            if (el) {
                el.max = fechaHoy;
                if (!el.value) {
                    el.value = fechaHoy;
                }

                if (el.value > fechaHoy) {
                    el.value = fechaHoy;
                }
            }
        });

        if (fechaInput && compFechaInput) {
            fechaInput.addEventListener("change", function () {
                const fechaSeleccionada = fechaInput.value;
                if (fechaSeleccionada > fechaInput.max) {
                    fechaInput.value = fechaInput.max;
                }
                compFechaInput.value = fechaInput.value;
            });
        }

        if (compFechaInput) {
            compFechaInput.addEventListener("change", function () {
                if (compFechaInput.value > compFechaInput.max) {
                    compFechaInput.value = compFechaInput.max;
                }
                if (fechaInput && !fechaInput.value) {
                    fechaInput.value = compFechaInput.value;
                }
            });
        }
    }

    const asientoPreview = document.getElementById("asiento-preview");

    function actualizarAsientoPreview() {
        if (!asientoPreview) return;
        const ejercicio = fechaInput?.value
            ? new Date(fechaInput.value).getFullYear()
            : new Date().getFullYear();

        fetch(`/api/proximo-asiento/?ejercicio=${ejercicio}`)
            .then((r) => r.json())
            .then((data) => {
                asientoPreview.textContent = data.proximo_asiento || "----";
            })
            .catch((err) => {
                console.error("Error obteniendo próximo asiento:", err);
                asientoPreview.textContent = "----";
            });
    }

    establecerFechaActual();
    actualizarAsientoPreview();

    if (fechaInput) {
        fechaInput.addEventListener("change", actualizarAsientoPreview);
    }

    function agregarNuevaFila() {
        if (!filaBase || !filasBody) return;
    
        const nuevaFila = filaBase.cloneNode(true);
        nuevaFila.querySelectorAll("select, input, textarea").forEach((el) => {
            el.value = "";
            if (el.tagName === "SELECT") el.selectedIndex = 0;
            el.removeAttribute("data-codigo-eventos");
            el.style.borderColor = "";
        });
        nuevaFila.querySelectorAll(".cod-cell").forEach((celda) => {
            celda.classList.remove("mostrar-codigo");
            delete celda.dataset.codigo;
        });
        filasBody.appendChild(nuevaFila);
    
        // Inicializar cascada y autocompletado en la nueva fila
        inicializarFila(nuevaFila);
        agregarEventosImporte();
        calcularTotal();
        actualizarPanelSaldos();
    }

    if (agregarFilaBtn) {
        agregarFilaBtn.addEventListener("click", agregarNuevaFila);
    }

    if (borrarFilaBtn && filasBody) {
        borrarFilaBtn.addEventListener("click", function () {
            const filas = filasBody.querySelectorAll("tr");
            if (filas.length > 1) {
                filasBody.removeChild(filas[filas.length - 1]);
                calcularTotal();
                actualizarPanelSaldos();
            }
        });
    }

    if (contabilizadoSelect && compContabilizadoInput) {
        const obtenerTextoContabilizado = () => {
            return contabilizadoSelect.value !== undefined
                ? contabilizadoSelect.value
                : contabilizadoSelect.textContent.trim();
        };

        const actualizarContabilizado = () => {
            compContabilizadoInput.value = obtenerTextoContabilizado();
        };

        if (contabilizadoSelect.addEventListener) {
            contabilizadoSelect.addEventListener("change", actualizarContabilizado);
        }
        actualizarContabilizado();
    }

    function obtenerIniciales(nombreCompleto) {
        if (!nombreCompleto) return "";
        const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean);
        if (partes.length === 0) return "";
        if (partes.length === 1) {
            return partes[0].slice(0, 2).toUpperCase();
        }
        return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
    }

    const inicialesUsuario = document.getElementById("iniciales-usuario");
    if (inicialesUsuario) {
        const nombreUsuario = inicialesUsuario.dataset.userName || inicialesUsuario.textContent.trim();
        inicialesUsuario.textContent = obtenerIniciales(nombreUsuario);
    }

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== "") {
            const cookies = document.cookie.split(";");
            for (let cookie of cookies) {
                cookie = cookie.trim();
                if (cookie.startsWith(name + "=")) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    const csrftoken = getCookie("csrftoken");

    function actualizarCodigoVisible(select) {
        const celda = select.closest(".cod-cell");
        const opcion = select.options[select.selectedIndex];
        if (!celda) return;

        celda.dataset.codigo = opcion?.dataset.codigo || opcion?.textContent || "";
        celda.classList.toggle("mostrar-codigo", Boolean(select.value));
    }

    function configurarVisualizacionCodigo(select) {
        if (!select.dataset.codigoEventos) {
            select.addEventListener("focus", () => {
                select.closest(".cod-cell")?.classList.remove("mostrar-codigo");
            });
            select.addEventListener("change", () => actualizarCodigoVisible(select));
            select.addEventListener("blur", () => actualizarCodigoVisible(select));
            select.dataset.codigoEventos = "true";
        }
        actualizarCodigoVisible(select);
    }

    function llenarSelect(select, items, valueKey, codeFn, descriptionFn, placeholder) {
        select.innerHTML = "";
        const opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = placeholder || "Seleccionar...";
        select.appendChild(opt0);
        items.forEach((item) => {
            const opt = document.createElement("option");
            opt.value = item[valueKey];
            const codigo = String(codeFn(item));
            opt.textContent = `${codigo} - ${descriptionFn(item)}`;
            opt.dataset.codigo = codigo;
            select.appendChild(opt);
        });
        configurarVisualizacionCodigo(select);
    }

    function llenarSelectFuentes(select, lineas) {
        select.innerHTML = "";
        const opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = "Seleccionar FF...";
        select.appendChild(opt0);
        lineas.forEach((l) => {
            const opt = document.createElement("option");
            opt.value = l.fuente_id;
            opt.textContent = `${l.fuente_codigo} - ${l.fuente}`;
            opt.dataset.codigo = String(l.fuente_codigo);
            opt.dataset.saldo = l.saldo_actual;
            opt.dataset.lineaId = l.linea_id;
            select.appendChild(opt);
        });
        configurarVisualizacionCodigo(select);
    }

    // ---- Fuente (una sola vez, a nivel encabezado) ----
    const selectFuente = document.getElementById("select-fuente");
    if (selectFuente) {
        fetch("/api/fuentes/")
            .then((r) => r.json())
            .then((data) => {
                llenarSelect(selectFuente, data.fuentes, "id",
                    (f) => f.codigo, (f) => f.nombre, "Seleccionar fuente...");
            })
            .catch((err) => console.error("Error cargando fuentes:", err));
    }

    // ---- Partidas (mismo listado para todas las filas, se pide una sola vez) ----
    let partidasCache = null;
    function getPartidas() {
        if (partidasCache) return Promise.resolve(partidasCache);
        return fetch("/api/partidas/")
            .then((r) => r.json())
            .then((data) => {
                partidasCache = data.partidas;
                return partidasCache;
            });
    }

    function inicializarFila(fila) {
        const cods      = fila.querySelectorAll(".cod");
        const selectJur = cods[0];
        const selectPrg = cods[1];
        const selectSprg = cods[2];
        const selectPry = cods[3];
        const selectAo  = cods[4];
        const selectPar = cods[5];
        const selectFf  = cods[6];

        function setValorFijo(select, valor) {
            select.innerHTML = "";
            const opt = document.createElement("option");
            opt.value = valor;
            opt.textContent = valor;
            opt.dataset.codigo = valor;
            opt.selected = true;
            select.appendChild(opt);
            select.disabled = true;
            configurarVisualizacionCodigo(select);
        }
    
        setValorFijo(selectJur, "51");
        setValorFijo(selectSprg, "00");
    
        fetch("/api/programas/")
            .then((r) => r.json())
            .then((data) => {
                llenarSelect(selectPrg, data.programas, "id",
                    (p) => String(p.codigo_programa).padStart(2, "0"),
                    (p) => p.nombre, "Seleccionar PRG...");
            })
            .catch((err) => console.error("Error cargando programas:", err));
    
        getPartidas().then((partidas) => {
            llenarSelect(selectPar, partidas, "id",
                (p) => p.codigo, (p) => p.denominacion, "Seleccionar PAR...");
        });
    
        selectPrg.addEventListener("change", function () {
            llenarSelect(selectPry, [], "id", () => "", () => "", "Seleccionar PRY...");
            llenarSelect(selectAo, [], "id", () => "", () => "", "Seleccionar A/O...");
            llenarSelectFuentes(selectFf, []);
            actualizarPanelSaldos();
            if (!selectPrg.value) return;
            fetch(`/api/proyectos/?programa_id=${selectPrg.value}`)
                .then((r) => r.json())
                .then((data) => {
                    llenarSelect(selectPry, data.proyectos, "id",
                        (p) => String(p.codigo_proyecto).padStart(3, "0"),
                        (p) => p.nombre, "Seleccionar PRY...");
                })
                .catch((err) => console.error("Error cargando proyectos:", err));
        });
    
        selectPry.addEventListener("change", function () {
            llenarSelect(selectAo, [], "id", () => "", () => "", "Seleccionar A/O...");
            llenarSelectFuentes(selectFf, []);
            actualizarPanelSaldos();
            if (!selectPry.value) return;
            fetch(`/api/actividades/?proyecto_id=${selectPry.value}`)
                .then((r) => r.json())
                .then((data) => {
                    llenarSelect(selectAo, data.actividades, "id",
                        (a) => String(a.codigo_act_obra).padStart(3, "0"),
                        (a) => a.nombre, "Seleccionar A/O...");
                })
                .catch((err) => console.error("Error cargando actividades:", err));
        });
    
        async function intentarAutocompletar() {
            if (!selectAo.value || !selectPar.value || !selectPrg.value || !selectPry.value) return;
        
            const ejercicio = new Date().getFullYear();
            const params = new URLSearchParams({
                programa_id:  selectPrg.value,
                proyecto_id:  selectPry.value,
                actividad_id: selectAo.value,
                partida_id:   selectPar.value,
                ejercicio:    ejercicio,
            });
        
            try {
                const resp = await fetch(`/api/resolver-lineas/?${params.toString()}`);
                const data = await resp.json();
                const proveedorInput = fila.querySelector(".proveedor-input");
        
                if (resp.ok && data.lineas?.length > 0) {
                    proveedorInput.value = data.lineas[0].denominacion;
                    proveedorInput.style.borderColor = "green";
                    llenarSelectFuentes(selectFf, data.lineas);
                } else {
                    proveedorInput.value = "";
                    proveedorInput.style.borderColor = "red";
                    llenarSelectFuentes(selectFf, []);
                }
            } catch (err) {
                console.error("Error resolviendo línea:", err);
            }
        }
    
        selectAo.addEventListener("change", intentarAutocompletar);
        selectPar.addEventListener("change", intentarAutocompletar);
        selectFf.addEventListener("change", actualizarPanelSaldos);
    }
    
    // Inicializar fila base
    document.querySelectorAll("#filas-body tr").forEach((fila) => {
        inicializarFila(fila);
    });
    actualizarPanelSaldos();

    // ---- Guardar imputación ----
    const guardarBtn = document.getElementById("guardar-imputacion-btn");
    if (guardarBtn) {
        guardarBtn.addEventListener("click", guardarImputacion);
    }

    const SUFIJO_EXPEDIENTE = "-GDESDE-APRH#MAMA";

    let guardando = false;

    async function guardarImputacion() {
        if (guardando) return;
        guardando = true;
        guardarBtn.disabled    = true;
        guardarBtn.textContent = "Guardando...";

        try {
            const expedienteVariable = document.getElementById("input-expediente")?.value.trim();
            const fecha         = document.getElementById("fecha-actual")?.value;
            const nroExpediente = `${expedienteVariable}${SUFIJO_EXPEDIENTE}`;

            const fechaSeleccionada = fecha ? new Date(`${fecha}T00:00:00`) : null;
            const fechaValida = fechaSeleccionada && !Number.isNaN(fechaSeleccionada.getTime());
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            if (!expedienteVariable || !fechaValida || fechaSeleccionada > hoy) {
                alert("Completá el N° de expediente y la fecha antes de guardar.");
                return;
            }

            const filasActuales = document.querySelectorAll("#filas-body tr");
            const detalles = [];

            for (const fila of filasActuales) {
                const cods      = fila.querySelectorAll(".cod");
                const selectPrg = cods[1];
                const selectPry = cods[3];
                const selectAo  = cods[4];
                const selectPar = cods[5];
                const selectFf  = cods[6];
                const proveedor = fila.querySelector(".proveedor-input")?.value.trim();
                const importeRaw = fila.querySelector(".importe-input")?.value.trim();

                if (!selectPrg?.value && !selectPry?.value && !selectAo?.value
                    && !selectPar?.value && !selectFf?.value && !proveedor && !importeRaw) {
                    continue;
                }

                if (!selectPrg?.value || !selectPry?.value || !selectAo?.value
                    || !selectPar?.value || !selectFf?.value || !proveedor || !importeRaw) {
                    alert("Hay una fila incompleta. Revisá PRG, PRY, A/O, PAR, FF, concepto e importe.");
                    return;
                }

                const importe = parseImporte(importeRaw);
                if (isNaN(importe) || importe <= 0) {
                    alert("El importe de una fila es inválido.");
                    return;
                }

                const ejercicio = new Date(fecha).getFullYear();
                const params = new URLSearchParams({
                    actividad_id: selectAo.value,
                    partida_id:   selectPar.value,
                    fuente_id:    selectFf.value,
                    ejercicio:    ejercicio,
                });

                try {
                    const resp = await fetch(`/api/buscar-linea/?${params.toString()}`);
                    const data = await resp.json();

                    if (!resp.ok) {
                        alert(`Error en una fila: ${data.error || "línea no encontrada para la fuente seleccionada"}`);
                        return;
                    }

                    const saldoDisponible = parseFloat(data.saldo_actual);
                    if (importe > saldoDisponible) {
                        alert(
                            `Saldo insuficiente en la fuente seleccionada.\n` +
                            `Disponible: $${saldoDisponible.toLocaleString("es-AR", {minimumFractionDigits: 2})}\n` +
                            `Requerido: $${importe.toLocaleString("es-AR", {minimumFractionDigits: 2})}`
                        );
                        return;
                    }
                } catch (err) {
                    console.error("Error verificando línea presupuestaria:", err);
                    alert("Error de red verificando la línea presupuestaria.");
                    return;
                }

                detalles.push({
                    programa_id:        selectPrg.value,
                    proyecto_id:        selectPry.value,
                    actividad_id:       selectAo.value,
                    partida_id:         selectPar.value,
                    fuente_id:          selectFf.value,
                    proveedor_concepto: proveedor,
                    importe:            importe,
                });
            }

            if (detalles.length === 0) {
                alert("Agregá al menos una fila completa antes de guardar.");
                return;
            }

            const payload = {
                fecha:          fecha,
                nro_expediente: nroExpediente,
                origen:         "MANUAL",
                observacion:    "",
                detalles:       detalles,
            };

            const resp = await fetch("/api/imputacion/crear/", {
                method:  "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken":  csrftoken,
                },
                body: JSON.stringify(payload),
            });

            const data = await resp.json();

            if (resp.ok) {
                alert(
                    `Imputación guardada correctamente.\n` +
                    `Asiento N°: ${data.asiento_nro}\n` +
                    `Total: $${parseFloat(data.importe_total).toLocaleString("es-AR", {minimumFractionDigits: 2})}`
                );
                document.getElementById("input-expediente").value = "";
                document.querySelectorAll("#filas-body tr:not(:first-child)").forEach(f => f.remove());
                document.querySelectorAll("#filas-body tr:first-child select, #filas-body tr:first-child input, #filas-body tr:first-child textarea")
                    .forEach(el => { el.value = ""; });
                calcularTotal();
                actualizarPanelSaldos();
            } else {
                alert("Error al guardar: " + (data.error || "revisá los datos."));
            }

        } catch (err) {
            console.error("Error guardando imputación:", err);
            alert("Error de red al guardar la imputación.");
        } finally {
            guardando = false;
            guardarBtn.disabled    = false;
            guardarBtn.textContent = "Guardar imputación";
        }
    }
});