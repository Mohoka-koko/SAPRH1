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
        btnMinimizar.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita interferir con clics del contenedor
            panel.classList.add('minimizado');
        });

        // Al hacer clic sobre el botón minimizado: Vuelve a desplegar la tabla
        panel.addEventListener('click', () => {
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
    
        const cargaPrg = fetch("/api/programas/")
        .then((r) => r.json())
        .then((data) => {
            llenarSelect(selectPrg, data.programas, "id",
                (p) => String(p.codigo_programa).padStart(2, "0"),
                (p) => p.nombre, "Seleccionar PRG...");
        })
        .catch((err) => console.error("Error cargando programas:", err));

        const cargaPar = getPartidas().then((partidas) => {
            llenarSelect(selectPar, partidas, "id",
                (p) => p.codigo, (p) => p.denominacion, "Seleccionar PAR...");
        });

        fila._cargaInicial = Promise.all([cargaPrg, cargaPar]);

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
        guardarBtn.addEventListener("click", pedirCompletar);
    }

    const SUFIJO_EXPEDIENTE = "-GDESDE-APRH#MAMA";
    const mensajeValidacion = document.getElementById("mensaje-validacion");

    function mostrarMensajeValidacion(mensaje) {
        if (!mensajeValidacion) return;
        mensajeValidacion.classList.remove("mensaje-exito");
        mensajeValidacion.textContent = mensaje;
        mensajeValidacion.hidden = false;
    }

    function mostrarMensajeExito(mensaje) {
        if (!mensajeValidacion) return;
        mensajeValidacion.classList.add("mensaje-exito");
        mensajeValidacion.textContent = mensaje;
        mensajeValidacion.hidden = false;
    }

    let guardando = false;

    async function guardarImputacion() {
        if (guardando) return;
        if (mensajeValidacion) {
            mensajeValidacion.hidden = true;
            mensajeValidacion.classList.remove("mensaje-exito");
        }
        guardando = true;
        guardarBtn.disabled    = true;
        guardarBtn.textContent = "Guardando...";

        try {
            const expedienteVariable = document.getElementById("input-expediente")?.value.trim();
            const fecha         = document.getElementById("fecha-actual")?.value;
            const nroExpediente = `${expedienteVariable}${SUFIJO_EXPEDIENTE}`;

            const camposEncabezadoFaltantes = [];
            if (!expedienteVariable) camposEncabezadoFaltantes.push("N° de expediente");
            if (!fecha) camposEncabezadoFaltantes.push("fecha");
            if (camposEncabezadoFaltantes.length > 0) {
                mostrarMensajeValidacion(`Te falta completar: ${camposEncabezadoFaltantes.join(" y ")}.`);
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

                const camposFilaFaltantes = [];
                if (!selectPrg?.value) camposFilaFaltantes.push("PRG");
                if (!selectPry?.value) camposFilaFaltantes.push("PRY");
                if (!selectAo?.value) camposFilaFaltantes.push("A/O");
                if (!selectPar?.value) camposFilaFaltantes.push("PAR");
                if (!selectFf?.value) camposFilaFaltantes.push("FF");
                if (!proveedor) camposFilaFaltantes.push("concepto");
                if (!importeRaw) camposFilaFaltantes.push("importe");
                if (camposFilaFaltantes.length > 0) {
                    mostrarMensajeValidacion(`Te falta completar en una fila: ${camposFilaFaltantes.join(", ")}.`);
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
                mostrarMensajeValidacion("Te falta completar al menos una fila con los datos obligatorios.");
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
                mostrarMensajeExito(
                    `Imputación guardada correctamente.\n` +
                    `Asiento N°: ${data.asiento_nro}. ` +
                    `Total: $${parseFloat(data.importe_total).toLocaleString("es-AR", {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
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

    // ═══════════════════════════════════════════════════════════════
    //  GUARDADO AUTOMÁTICO (borrador "Revisar") + GUARDAR COMO COMPLETADO
    // ═══════════════════════════════════════════════════════════════
    const esModoVer         = (typeof MODO !== "undefined" && MODO === "ver");
    const indicadorAutosave = document.getElementById("autosave-estado");
    const modalCompletar    = document.getElementById("modal-completar");
    const AUTOSAVE_MS       = 1500;

    let imputacionId  = null;                 // id del borrador en la BD (null hasta el primer guardado)
    let autosaveTimer = null;
    let colaGuardado  = Promise.resolve(true); // serializa los guardados: nunca hay dos en paralelo
    let restaurando   = false;                // true mientras se carga un borrador existente
    let completando   = false;

    const aNum     = (v) => (v ? Number(v) : null);
    const disparar = (el) => el.dispatchEvent(new Event("change", { bubbles: true }));

    // ── Indicador visual ──────────────────────────────────────────
    function setEstadoAutosave(estado, detalle) {
        if (!indicadorAutosave) return;
        indicadorAutosave.className = "autosave-estado " + estado;
        const textos = {
            guardando: "Guardando borrador…",
            guardado:  "Borrador guardado (estado: Revisar)",
            error:     "⚠ NO se pudieron guardar los cambios" + (detalle ? `: ${detalle}` : ""),
        };
        indicadorAutosave.textContent = textos[estado] || "";
    }

    // ── Payload del borrador (acepta datos parciales) ─────────────
    function construirPayloadBorrador() {
        const expedienteVariable = document.getElementById("input-expediente")?.value.trim() || "";
        const detalles = [];

        document.querySelectorAll("#filas-body tr").forEach((fila) => {
            const cods = fila.querySelectorAll(".cod");
            const prg = cods[1], pry = cods[3], ao = cods[4], par = cods[5], ff = cods[6];
            const proveedor  = fila.querySelector(".proveedor-input")?.value.trim() || "";
            const importeRaw = fila.querySelector(".importe-input")?.value.trim() || "";

            // Fila totalmente vacía: no se guarda
            if (!prg?.value && !pry?.value && !ao?.value && !par?.value && !ff?.value && !proveedor && !importeRaw) return;

            const importe = parseFloat(importeRaw);
            detalles.push({
                programa_id:        aNum(prg?.value),
                proyecto_id:        aNum(pry?.value),
                actividad_id:       aNum(ao?.value),
                partida_id:         aNum(par?.value),
                fuente_id:          aNum(ff?.value),
                linea_id:           aNum(ff?.selectedOptions[0]?.dataset.lineaId),
                proveedor_concepto: proveedor,
                importe:            isNaN(importe) ? null : importe,
            });
        });

        return {
            fecha:          fechaInput?.value || "",
            nro_expediente: expedienteVariable ? `${expedienteVariable}${SUFIJO_EXPEDIENTE}` : "",
            observacion:    "",
            detalles,
        };
    }

    // ── Guardado (crea la primera vez, actualiza después) ─────────
    async function ejecutarGuardadoBorrador() {
        try {
            const payload = construirPayloadBorrador();

            // No crear un borrador vacío solo por abrir el formulario
            if (!imputacionId && !payload.nro_expediente && payload.detalles.length === 0) return true;

            setEstadoAutosave("guardando");

            const url = imputacionId
                ? `/api/imputacion/borrador/${imputacionId}/actualizar/`
                : "/api/imputacion/borrador/crear/";

            const resp = await fetch(url, {
                method:    "POST",
                headers:   { "Content-Type": "application/json", "X-CSRFToken": csrftoken },
                body:      JSON.stringify(payload),
                keepalive: true,
            });
            let data = {};
            try { data = await resp.json(); } catch (_) {}
            if (!resp.ok) throw new Error(data.error || `Error ${resp.status}`);

            if (!imputacionId && data.imputacion_id) {
                imputacionId = data.imputacion_id;
                history.replaceState(null, "", `?borrador=${imputacionId}`);
            }
            setEstadoAutosave("guardado");
            return true;
        } catch (err) {
            console.error("Error en el guardado automático:", err);
            setEstadoAutosave("error", err.message);
            return false;
        }
    }

    function guardarBorrador() {
        colaGuardado = colaGuardado.catch(() => true).then(ejecutarGuardadoBorrador);
        return colaGuardado;
    }

    function programarAutoguardado() {
        if (esModoVer || restaurando || completando) return;
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => { autosaveTimer = null; guardarBorrador(); }, AUTOSAVE_MS);
    }

    // Cambios en cualquier campo del formulario → guardado con pausa (debounce)
    const formWrap = document.querySelector(".form-wrap");
    ["input", "change"].forEach((tipo) => formWrap?.addEventListener(tipo, programarAutoguardado));
    agregarFilaBtn?.addEventListener("click", programarAutoguardado);
    borrarFilaBtn?.addEventListener("click", programarAutoguardado);

    // Si el usuario cambia de pestaña o cierra, guardar de inmediato lo pendiente
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden" && autosaveTimer) {
            clearTimeout(autosaveTimer);
            autosaveTimer = null;
            guardarBorrador();
        }
    });

    // ── Validación previa a "completar" (informa qué falta) ───────
    function validarParaCompletar() {
        if (!document.getElementById("input-expediente")?.value.trim()) return "Te falta completar el N° de expediente.";
        if (!fechaInput?.value) return "Te falta completar la fecha.";

        const filas = document.querySelectorAll("#filas-body tr");
        let hayFilaCompleta = false;

        for (let i = 0; i < filas.length; i++) {
            const cods      = filas[i].querySelectorAll(".cod");
            const campos    = { PRG: cods[1], PRY: cods[3], "A/O": cods[4], PAR: cods[5], FF: cods[6] };
            const proveedor = filas[i].querySelector(".proveedor-input")?.value.trim();
            const importe   = parseFloat(filas[i].querySelector(".importe-input")?.value);

            const vacia = Object.values(campos).every((s) => !s?.value) && !proveedor && isNaN(importe);
            if (vacia) continue;

            const faltan = Object.entries(campos).filter(([, s]) => !s?.value).map(([n]) => n);
            if (!proveedor) faltan.push("concepto");
            if (isNaN(importe) || importe <= 0) faltan.push("importe");
            if (faltan.length) return `Fila ${i + 1}: te falta completar ${faltan.join(", ")}.`;

            hayFilaCompleta = true;
        }
        return hayFilaCompleta ? null : "Agregá al menos una fila completa.";
    }

    // ── Guardar como completado ───────────────────────────────────
    async function pedirCompletar() {
        if (esModoVer || completando) return;
        if (mensajeValidacion) mensajeValidacion.hidden = true;

        const error = validarParaCompletar();
        if (error) { mostrarMensajeValidacion(error); return; }

        // El servidor tiene que tener exactamente lo que se ve en pantalla
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
        const ok = await guardarBorrador();
        if (!ok || !imputacionId) {
            mostrarMensajeValidacion("No se pudieron guardar los últimos cambios en el servidor. Reintentá antes de completar.");
            return;
        }
        modalCompletar.showModal();
    }

    async function confirmarCompletar() {
        const btnConfirmar = document.getElementById("modal-confirmar");
        completando = true;
        btnConfirmar.disabled = true;
        try {
            const resp = await fetch(`/api/imputacion/${imputacionId}/completar/`, {
                method:  "POST",
                headers: { "X-CSRFToken": csrftoken },
            });
            let data = {};
            try { data = await resp.json(); } catch (_) {}
            modalCompletar.close();

            if (!resp.ok) {
                // Sigue en estado Revisar: el usuario corrige y vuelve a intentar
                mostrarMensajeValidacion(data.error || "No se pudo completar la imputación.");
                return;
            }

            const total = parseFloat(data.importe_total).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            mostrarMensajeExito(`Imputación guardada como completada (estado Listo). Asiento N° ${data.asiento_nro}. Total: $ ${total}`);
            const preview = document.getElementById("asiento-preview");
            if (preview) preview.textContent = data.asiento_nro;
            setEstadoAutosave("");
            bloquearFormularioCompletado();
        } catch (err) {
            console.error(err);
            modalCompletar.close();
            mostrarMensajeValidacion("Error de red: la imputación NO se completó. Revisá su estado en el historial de registros.");
        } finally {
            completando = false;
            btnConfirmar.disabled = false;
        }
    }

    function bloquearFormularioCompletado() {
        document.querySelectorAll(".form-wrap select, .form-wrap input, .form-wrap textarea")
            .forEach((el) => { el.disabled = true; });
        [agregarFilaBtn, borrarFilaBtn, guardarBtn].forEach((b) => { if (b) b.style.display = "none"; });
        const nueva = document.getElementById("nueva-imputacion-btn");
        if (nueva) nueva.style.display = "";
    }

    document.getElementById("modal-cancelar")?.addEventListener("click", () => modalCompletar.close());
    document.getElementById("modal-confirmar")?.addEventListener("click", confirmarCompletar);

    // ── Retomar un borrador (?borrador=ID) ────────────────────────
    function esperarOpciones(select, minimo = 2, timeoutMs = 5000) {
        return new Promise((resolve) => {
            const inicio = Date.now();
            (function chequear() {
                if (select.options.length >= minimo || Date.now() - inicio > timeoutMs) return resolve();
                setTimeout(chequear, 50);
            })();
        });
    }

    async function poblarFilaDesdeBorrador(fila, det) {
        await fila._cargaInicial;   // programas y partidas ya cargados en esta fila

        const cods = fila.querySelectorAll(".cod");
        const selectPrg = cods[1], selectPry = cods[3], selectAo = cods[4], selectPar = cods[5], selectFf = cods[6];

        if (det.programa_id) {
            selectPrg.value = String(det.programa_id);
            disparar(selectPrg);                         // dispara la carga de proyectos
            if (det.proyecto_id) {
                await esperarOpciones(selectPry);
                selectPry.value = String(det.proyecto_id);
                disparar(selectPry);                     // dispara la carga de actividades
            }
        }
        if (det.partida_id) {
            selectPar.value = String(det.partida_id);
            disparar(selectPar);
        }
        if (det.actividad_id) {
            await esperarOpciones(selectAo);
            selectAo.value = String(det.actividad_id);
            disparar(selectAo);                          // resuelve líneas y carga las FF
            await esperarOpciones(selectFf, 2, 3000);
            if (det.fuente_id) {
                selectFf.value = String(det.fuente_id);
                disparar(selectFf);
            }
        }

        // Se completan al final: la carga automática de FF pisa el concepto
        const proveedorInput = fila.querySelector(".proveedor-input");
        const importeInput   = fila.querySelector(".importe-input");
        if (proveedorInput && det.proveedor_concepto) proveedorInput.value = det.proveedor_concepto;
        if (importeInput && det.importe) importeInput.value = parseFloat(det.importe).toFixed(2);
    }

    async function cargarBorradorDesdeURL() {
        const id = new URLSearchParams(location.search).get("borrador");
        if (!id || esModoVer) return;

        restaurando = true;   // evita que la carga dispare guardados automáticos
        try {
            const resp = await fetch(`/api/imputacion/borrador/${id}/obtener/`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || `Error ${resp.status}`);
            if (data.estado_formulario !== "REVISAR") throw new Error("Esta imputación ya fue completada y no se puede editar.");

            imputacionId = data.imputacion_id;

            if (fechaInput && data.fecha) { fechaInput.value = data.fecha; disparar(fechaInput); }
            const exp = data.nro_expediente || "";
            document.getElementById("input-expediente").value =
                exp.endsWith(SUFIJO_EXPEDIENTE) ? exp.slice(0, -SUFIJO_EXPEDIENTE.length) : exp;

            const detalles = data.detalles || [];
            for (let i = 1; i < detalles.length; i++) agregarNuevaFila();

            const filas = Array.from(document.querySelectorAll("#filas-body tr"));
            await Promise.all(detalles.map((det, i) => (filas[i] ? poblarFilaDesdeBorrador(filas[i], det) : null)));

            calcularTotal();
            setEstadoAutosave("guardado");
        } catch (err) {
            console.error(err);
            imputacionId = null;
            history.replaceState(null, "", location.pathname);
            mostrarMensajeValidacion(`No se pudo cargar el borrador: ${err.message}`);
        } finally {
            restaurando = false;
        }
    }

    cargarBorradorDesdeURL();

    // ─── MODO VER: deshabilitar todos los controles de forma definitiva ────
    function aplicarModoVer() {
        if (typeof MODO !== 'undefined' && MODO === 'ver') {
            const guardarBtn = document.getElementById("guardar-imputacion-btn");
            if (guardarBtn) guardarBtn.style.display = "none";
            
            const agregarFilaBtn = document.getElementById("agregar-fila-btn");
            const borrarFilaBtn = document.getElementById("borrar-fila-btn");
            if (agregarFilaBtn) agregarFilaBtn.style.display = "none";
            if (borrarFilaBtn) borrarFilaBtn.style.display = "none";

            // Deshabilitar cabecera
            ["fecha-actual", "input-expediente", "contabilizado-select", "comp-fecha", "comp-contabilizado"].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.disabled = true;
            });

            // Deshabilitar todos los selects, inputs y textareas de las filas actuales y futuras
            document.querySelectorAll("#filas-body select, #filas-body input, #filas-body textarea").forEach(el => {
                el.disabled = true;
                el.style.pointerEvents = "none";
            });

            // Ocultar botones de eliminar fila si existieran
            document.querySelectorAll(".btn-eliminar-fila").forEach(el => el.style.display = "none");
        }
    }

    // Ejecutar al iniciar por si acaso
    aplicarModoVer();

    // ─── CARGAR DATOS SI ESTÁ EN MODO VER (CORREGIDO) ──────────────────────
    if (typeof MODO !== 'undefined' && MODO === "ver" && typeof IMPUTACION !== "undefined" && IMPUTACION) {
        const fechaInput = document.getElementById("fecha-actual");
        const expedienteInput = document.getElementById("input-expediente");

        if (fechaInput) fechaInput.value = IMPUTACION.fecha || "";
        if (expedienteInput) {
            const sufijo = "-GDESDE-APRH#MAMA";
            expedienteInput.value = IMPUTACION.nro_expediente.endsWith(sufijo)
                ? IMPUTACION.nro_expediente.slice(0, -sufijo.length)
                : IMPUTACION.nro_expediente;
        }

        const detalles = IMPUTACION.detalles || [];
        
        // Crear las filas necesarias
        detalles.forEach((det, index) => {
            if (index > 0) agregarNuevaFila();
        });

        // Poblar cada fila secuencialmente reutilizando las funciones del archivo
        setTimeout(async () => {
            const filas = document.querySelectorAll("#filas-body tr");
            
            // Obtener programas y partidas usando las utilidades ya existentes en el archivo
            const respPrg = await fetch("/api/programas/");
            const dataPrg = await respPrg.json();
            const programas = dataPrg.programas;
            
            const partidas = await getPartidas(); // Reutiliza la función existente

            for (let i = 0; i < detalles.length; i++) {
                const det = detalles[i];
                const fila = filas[i];
                if (!fila) continue;

                const cods = fila.querySelectorAll(".cod");
                const selectPrg = cods[1];
                const selectPry = cods[3];
                const selectAo  = cods[4];
                const selectPar = cods[5];
                const selectFf  = cods[6];

                // 1. Llenar y seleccionar Programa
                if (selectPrg && det.programa_id) {
                    llenarSelect(selectPrg, programas, "id",
                        (p) => String(p.codigo_programa).padStart(2, "0"),
                        (p) => p.nombre, "Seleccionar PRG...");
                    selectPrg.value = det.programa_id;
                    actualizarCodigoVisible(selectPrg);
                }

                // 2. Llenar y seleccionar Partida
                if (selectPar && det.partida_id) {
                    llenarSelect(selectPar, partidas, "id",
                        (p) => p.codigo, (p) => p.denominacion, "Seleccionar PAR...");
                    selectPar.value = det.partida_id;
                    actualizarCodigoVisible(selectPar);
                }

                // 3. Cargar Proyectos, Actividades y Fuentes en cascada
                if (det.programa_id && det.proyecto_id) {
                    try {
                        const respPry = await fetch(`/api/proyectos/?programa_id=${det.programa_id}`);
                        const dataPry = await respPry.json();
                        llenarSelect(selectPry, dataPry.proyectos, "id",
                            (p) => String(p.codigo_proyecto).padStart(3, "0"),
                            (p) => p.nombre, "Seleccionar PRY...");
                        selectPry.value = det.proyecto_id;
                        actualizarCodigoVisible(selectPry);

                        if (det.actividad_id) {
                            const respAo = await fetch(`/api/actividades/?proyecto_id=${det.proyecto_id}`);
                            const dataAo = await respAo.json();
                            llenarSelect(selectAo, dataAo.actividades, "id",
                                (a) => String(a.codigo_act_obra).padStart(3, "0"),
                                (a) => a.nombre, "Seleccionar A/O...");
                            selectAo.value = det.actividad_id;
                            actualizarCodigoVisible(selectAo);

                            // Resolver líneas / Fuentes de Financiamiento
                            const ejercicio = new Date(IMPUTACION.fecha).getFullYear();
                            const params = new URLSearchParams({
                                programa_id:  det.programa_id,
                                proyecto_id:  det.proyecto_id,
                                actividad_id: det.actividad_id,
                                partida_id:   det.partida_id,
                                ejercicio:    ejercicio,
                            });

                            const respRes = await fetch(`/api/resolver-lineas/?${params.toString()}`);
                            const dataRes = await respRes.json();
                            
                            if (respRes.ok && dataRes.lineas) {
                                llenarSelectFuentes(selectFf, dataRes.lineas);
                                if (det.fuente_id) {
                                    const optFf = Array.from(selectFf.options).find(o => o.value == det.fuente_id || o.dataset.lineaId == det.fuente_id);
                                    if (optFf) {
                                        selectFf.value = optFf.value;
                                        actualizarCodigoVisible(selectFf);
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        console.error("Error al cargar cascada en modo ver:", err);
                    }
                }

                // 4. Asignar concepto/proveedor e importe
                const proveedorInput = fila.querySelector(".proveedor-input");
                const importeInput = fila.querySelector(".importe-input") || fila.querySelector(".importe");
                
                if (proveedorInput) proveedorInput.value = det.proveedor || "";
                if (importeInput) {
                    // Usar toFixed(2) para evitar el error del input type="number" con comas y puntos de miles
                    importeInput.value = det.importe ? parseFloat(det.importe).toFixed(2) : "0.00";
                }
            }
            calcularTotal();
            actualizarPanelSaldos();
            aplicarModoVer();
        }, 350);
    }
});