/**
 * modificacion_form.js
 * Modo A — UP Presupuesto General
 * Modo B — UP de una Imputación
 *
 * Guardado automático en la BD como borrador (estado Revisar), sin tocar saldos ni
 * remanentes de imputaciones. "Guardar como completado": confirmación + validación en el
 * servidor → estado Listo. Al abrir un borrador (editar) se vuelve a cargar todo lo guardado.
 */

document.addEventListener("DOMContentLoaded", () => {

    // ─── UTILIDADES ───────────────────────────────────────────────────────────
    function formatearImporte(num) {
        if (num === null || num === undefined || num === "") return "";
        return Number(num).toLocaleString("es-AR", {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
        });
    }

    function parsearImporte(valor) {
        if (!valor || valor.trim() === "") return 0;
        const limpio = valor.trim().replace(/\./g, "").replace(",", ".");
        const num = parseFloat(limpio);
        return isNaN(num) ? null : num;
    }

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(";").shift();
        return null;
    }

    // ─── MODO ACTIVO ──────────────────────────────────────────────────────────
    // 'general' | 'imputacion'
    function getModo() {
        return document.querySelector('input[name="tipoUpTransferente"]:checked')?.value || 'general';
    }

    // ─── REFERENCIAS ──────────────────────────────────────────────────────────
    const mFecha      = document.getElementById("m-fecha");
    const mExpediente = document.getElementById("m-expediente");
    const mUsuario    = document.getElementById("m-usuario");
    const mDecreto    = document.getElementById("m-decreto");
    const mImporte    = document.getElementById("m-importe");
    const btnCompletar = document.getElementById("btn-completar");
    const btnExportar = document.getElementById("btn-exportar");

    let decretoNombre = "";   // el sistema guarda el nombre del archivo, no el PDF
    mDecreto.addEventListener("change", () => {
        const archivo = mDecreto.files[0];
        decretoNombre = archivo ? archivo.name : "";
        document.getElementById("m-decreto-nombre").textContent =
            archivo ? archivo.name : "Sin archivos seleccionados";
    });

    // ─── MODO VER: deshabilitar todos los controles ───────────────────────────
    if (MODO === 'ver') {
        // Ocultar botón Guardar
        if (btnCompletar) btnCompletar.style.display = "none";
    
        // Deshabilitar radios de tipo UP
        document.querySelectorAll('input[name="tipoUpTransferente"]').forEach(r => r.disabled = true);
        // Deshabilitar botones +
        const btnAgregarT = document.getElementById("btn-agregar-transferente");
        const btnAgregarR = document.getElementById("btn-agregar-receptora");
        if (btnAgregarT) btnAgregarT.style.display = "none";
        if (btnAgregarR) btnAgregarR.style.display = "none";
        // Deshabilitar campos de info adicional
        ["m-expediente", "m-fecha", "m-usuario", "m-importe", "m-decreto"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
        });
        document.getElementById("m-decreto-nombre") && 
        (document.querySelector(".mf-file-btn").style.display = "none");
    }

    // ─── CACHE ────────────────────────────────────────────────────────────────
    let _programasCache = null;
    let _partidasCache  = null;

    function getProgramas() {
        if (_programasCache) return Promise.resolve(_programasCache);
        return fetch("/api/programas/").then(r => r.json()).then(d => {
            _programasCache = d.programas; return _programasCache;
        });
    }

    function getPartidas() {
        if (_partidasCache) return Promise.resolve(_partidasCache);
        return fetch("/api/partidas/").then(r => r.json()).then(d => {
            _partidasCache = d.partidas; return _partidasCache;
        });
    }

    // ─── HELPER SELECT ────────────────────────────────────────────────────────
    function llenarSelectConCodigo(select, items, valueKey, codigoFn, labelFn, placeholder) {
        select.innerHTML = `<option value="">${placeholder}</option>`;
        items.forEach(item => {
            const opt = document.createElement("option");
            opt.value          = item[valueKey];
            opt.dataset.codigo = String(codigoFn(item));
            opt.dataset.label  = labelFn(item);
            opt.textContent    = labelFn(item);
            select.appendChild(opt);
        });
        select.addEventListener("change", () => {
            const opt = select.options[select.selectedIndex];
            if (opt && opt.dataset.codigo && opt.value) opt.textContent = opt.dataset.codigo;
        });
        select.addEventListener("focus", () => {
            Array.from(select.options).forEach(opt => {
                if (opt.dataset.label) opt.textContent = opt.dataset.label;
            });
        });
        select.addEventListener("blur", () => {
            const opt = select.options[select.selectedIndex];
            if (opt && opt.dataset.codigo && opt.value) opt.textContent = opt.dataset.codigo;
        });
    }

    // ─── CREAR FILA TRANSFERENTE ──────────────────────────────────────────────
    let _filaCounter = 0;

    function crearFilaTransferente(contenedorId, bloqueSaldoId, bloqueImporteId, datos = {}, onCambio, modoForzado = null) {
        const filaId = `fila-${++_filaCounter}`;
        const modo   = modoForzado || getModo();
        const esImputacion = (modo === 'imputacion');
        // Capturar todos los datos al inicio para que no muten durante la cascada asíncrona
        const _programa_id           = datos.programa_id           || null;
        let   _proyecto_id           = datos.proyecto_id           || null;
        let   _actividad_id          = datos.actividad_id          || null;
        const _partida_id            = datos.partida_id            || null;
        let   _fuente_id             = datos.fuente_id             || null;
        const _linea_id              = datos.linea_id              || null;
        let   _imputacion_detalle_id = datos.imputacion_detalle_id || null;
        const _importe               = datos.importe               || null;

        // ── Parte cascada (columna izquierda) ─────────────────────────────────
        const wrapper = document.createElement("div");
        wrapper.dataset.filaId = filaId;
        wrapper.style.marginBottom = "8px";

        // Cabecera dinámica
        const cabecera = document.createElement("div");
        cabecera.className = `mf-cabecera-cascada ${esImputacion ? 'modo-imputacion' : ''}`;
        cabecera.innerHTML = `
            <span>JUR</span><span>PRG</span><span>SPRG</span>
            <span>PRY</span><span>A/O</span><span>PAR</span><span>FF</span>
            ${esImputacion ? '<span>IMPUTACIÓN</span>' : ''}
        `;

        // Fila de controles alineados
        const fila = document.createElement("div");
        fila.className   = `fila-receptora-refuerzo ${esImputacion ? 'modo-imputacion' : ''}`;
        fila.dataset.filaId = filaId;
        fila.innerHTML = `
            <input type="text" value="51" readonly title="Jurisdicción (fijo)" />
            <select class="fila-prg"><option value="">Seleccione</option></select>
            <input type="text" value="00" readonly title="Subprograma (fijo)" />
            <select class="fila-pry"><option value="">Seleccione</option></select>
            <select class="fila-ao"><option value="">Seleccione</option></select>
            <select class="fila-par"><option value="">Seleccione</option></select>
            <select class="fila-fuente" disabled><option value="">FF...</option></select>
            ${esImputacion ? `
                <select class="fila-imputacion" disabled>
                    <option value="">Seleccione</option>
                </select>
            ` : ''}
            <input type="hidden" class="fila-linea-id" value="" />
            <input type="hidden" class="fila-detalle-id" value="" />
        `;

        // Referencias internas en Modo B (conectadas al selector de la grilla)
        const selectImputacion = esImputacion ? fila.querySelector(".fila-imputacion") : null;
        const inputDetalleId   = esImputacion ? fila.querySelector(".fila-detalle-id") : null;

        // ── Saldo (columna central) ────────────────────────────────────────────
        const saldoEl = document.createElement("div");
        saldoEl.className      = "mf-importe-fila";
        saldoEl.dataset.filaId = filaId;

        const saldoInput    = document.createElement("input");
        saldoInput.type     = "text";
        saldoInput.className = "fila-saldo-display";
        saldoInput.readOnly  = true;
        saldoInput.value     = "";
        saldoEl.appendChild(saldoInput);
        document.getElementById(bloqueSaldoId).appendChild(saldoEl);

        wrapper.appendChild(cabecera);
        wrapper.appendChild(fila);
        document.getElementById(contenedorId).appendChild(wrapper);

        // ── Importe (columna derecha) ──────────────────────────────────────────
        const importeWrapper       = document.createElement("div");
        importeWrapper.className   = "mf-importe-fila";
        importeWrapper.dataset.filaId = filaId;

        const inputImporte       = document.createElement("input");
        inputImporte.type        = "text";
        inputImporte.className   = "fila-importe";
        inputImporte.placeholder = "Ingrese importe";
        if (datos.importe) inputImporte.value = formatearImporte(parseFloat(datos.importe));

        const btnEliminar         = document.createElement("button");
        btnEliminar.type          = "button";
        btnEliminar.className     = "btn-eliminar-fila";
        btnEliminar.textContent   = "✕";
        // Después de: btnEliminar.textContent = "✕";
        if (MODO === 'ver') btnEliminar.style.display = "none";

        importeWrapper.appendChild(inputImporte);
        importeWrapper.appendChild(btnEliminar);
        document.getElementById(bloqueImporteId).appendChild(importeWrapper);

        // ── Referencias internas ───────────────────────────────────────────────
        const selectPrg    = fila.querySelector(".fila-prg");
        const selectPry    = fila.querySelector(".fila-pry");
        const selectAo     = fila.querySelector(".fila-ao");
        const selectPar    = fila.querySelector(".fila-par");
        const selectFuente = fila.querySelector(".fila-fuente");
        const inputLineaId = fila.querySelector(".fila-linea-id");

        function resetLinea() {
            inputLineaId.value     = "";
            saldoInput.value       = "";
            saldoInput.placeholder = "—";
            selectFuente.innerHTML = `<option value="">FF...</option>`;
            selectFuente.disabled  = true;
            if (selectImputacion) {
                selectImputacion.innerHTML = `<option value="">Seleccione</option>`;
                selectImputacion.disabled  = true;
                inputDetalleId.value       = "";
                const saldoImp = fila.querySelector(".fila-saldo-imp");
                if (saldoImp) saldoImp.textContent = "";
            }
        }

        // ── Resolver línea ─────────────────────────────────────────────────────
        async function resolverLineas() {
            resetLinea();
            if (!selectPrg.value || !selectPry.value || !selectAo.value || !selectPar.value) return;

            const ejercicio = new Date().getFullYear();
            try {
                const res  = await fetch(
                    `/api/resolver-lineas-modificacion/?programa_id=${selectPrg.value}&proyecto_id=${selectPry.value}&actividad_id=${selectAo.value}&partida_id=${selectPar.value}&ejercicio=${ejercicio}`
                );
                const data = await res.json();

                if (!res.ok) {
                    saldoInput.value       = "⚠ Línea no encontrada";
                    saldoInput.style.color = "#ef4444";
                    return;
                }

                if (data.lineas.length === 1) {
                    const linea = data.lineas[0];
                    inputLineaId.value     = linea.linea_id;
                    const codigoFF         = linea.fuente_nombre.split(" - ")[0];
                    selectFuente.innerHTML = `<option value="${linea.linea_id}" data-fuente="${linea.fuente_id ?? ""}">${codigoFF}</option>`;
                    selectFuente.disabled  = true;

                    if (modo === 'general') {
                        saldoInput.value       = `$${formatearImporte(parseFloat(linea.saldo_actual))}`;
                        saldoInput.style.color = "#2e7d32";
                    } else {
                        await cargarImputaciones(linea.linea_id);
                    }

                } else {
                    selectFuente.innerHTML = `<option value="">Elegir FF</option>`;
                    data.lineas.forEach(l => {
                        const opt          = document.createElement("option");
                        opt.value          = l.linea_id;
                        opt.dataset.saldo  = l.saldo_actual;
                        opt.dataset.fuente = l.fuente_id;
                        opt.dataset.codigo = l.fuente_nombre.split(" - ")[0];
                        opt.textContent    = opt.dataset.codigo;
                        selectFuente.appendChild(opt);
                    });
                    selectFuente.disabled = false;
                
                    // Preseleccionar fuente en modo editar/ver (primero por la línea guardada)
                    if (_linea_id || _fuente_id) {
                        let optFuente = _linea_id
                            ? Array.from(selectFuente.options).find(o => String(o.value) === String(_linea_id))
                            : null;
                        if (!optFuente && _fuente_id) {
                            optFuente = Array.from(selectFuente.options).find(o =>
                                String(o.dataset.fuente) === String(_fuente_id)
                            );
                        }
                        if (optFuente) {
                            selectFuente.value = optFuente.value;
                            selectFuente.dispatchEvent(new Event("change"));
                        }
                        // Se usan una sola vez: si después el usuario cambia la partida, no se reaplican
                        _fuente_id = null;
                    }
                }

            } catch {
                saldoInput.value       = "⚠ Error al buscar la línea";
                saldoInput.style.color = "#ef4444";
            }
        }

        // ── Cargar imputaciones para Modo B ────────────────────────────────────
        async function cargarImputaciones(lineaId) {
            if (!selectImputacion) return;
            lineasResolviendo++;
            try {
                const res  = await fetch(`/api/imputaciones-por-linea/?linea_id=${lineaId}`);
                const data = await res.json();

                if (!res.ok || data.detalles.length === 0) {
                    selectImputacion.innerHTML = `<option value="">Sin imputaciones disponibles</option>`;
                    selectImputacion.disabled  = true;
                    return;
                }

                selectImputacion.innerHTML = `<option value="">— Seleccionar imputación —</option>`;
                data.detalles.forEach(d => {
                    const opt               = document.createElement("option");
                    opt.value               = d.imputacion_detalle_id;
                    opt.dataset.saldo       = d.saldo_disponible;
                    opt.dataset.expediente  = d.nro_expediente;
                    opt.dataset.asiento     = d.asiento_nro;
                    opt.textContent         = `Asiento ${d.asiento_nro} — Exp. ${d.nro_expediente}`;
                    selectImputacion.appendChild(opt);
                });
                selectImputacion.disabled = false;

                // Restaurar la imputación guardada (una sola vez)
                if (_imputacion_detalle_id) {
                    selectImputacion.value = _imputacion_detalle_id;
                    _imputacion_detalle_id = null;
                    selectImputacion.dispatchEvent(new Event("change"));
                }

            } catch {
                selectImputacion.innerHTML = `<option value="">⚠ Error al cargar</option>`;
            } finally {
                lineasResolviendo--;
            }
        }

        // ── Listener fuente ────────────────────────────────────────────────────
        selectFuente.addEventListener("change", async () => {
            if (!selectFuente.value) {
                inputLineaId.value     = "";
                saldoInput.value       = "";
                return;
            }
            const opt = selectFuente.options[selectFuente.selectedIndex];
            inputLineaId.value     = selectFuente.value;

            if (modo === 'general') {
                saldoInput.value       = `$${formatearImporte(parseFloat(opt.dataset.saldo || 0))}`;
                saldoInput.style.color = "#2e7d32";
                if (opt.dataset.codigo) opt.textContent = opt.dataset.codigo;
            } else {
                await cargarImputaciones(selectFuente.value);
                notificarCambioLinea();
            }
        });

        // ── Listener imputación (Modo B) ───────────────────────────────────────
        if (selectImputacion) {
            selectImputacion.addEventListener("change", () => {
                if (!selectImputacion.value) {
                    inputDetalleId.value = "";
                    saldoInput.value     = "";
                    const saldoImp = fila.querySelector(".fila-saldo-imp");
                    if (saldoImp) saldoImp.textContent = "";
                    return;
                }
                const opt            = selectImputacion.options[selectImputacion.selectedIndex];
                inputDetalleId.value = selectImputacion.value;
                const saldo          = parseFloat(opt.dataset.saldo || 0);
                saldoInput.value       = `$${formatearImporte(saldo)}`;
                saldoInput.style.color = "#2e7d32";
            });
        }

        // ── Cascada ────────────────────────────────────────────────────────────
        selectPrg.addEventListener("change", () => {
            selectPry.innerHTML = `<option value="">Seleccione</option>`;
            selectAo.innerHTML  = `<option value="">Seleccione</option>`;
            resetLinea();
            if (!selectPrg.value) return;
            fetch(`/api/proyectos/?programa_id=${selectPrg.value}`)
                .then(r => r.json())
                .then(data => {
                    llenarSelectConCodigo(selectPry, data.proyectos, "id",
                        p => p.codigo_proyecto, p => `${p.codigo_proyecto} - ${p.nombre}`, "Seleccione");
                    if (_proyecto_id) { 
                        selectPry.value = _proyecto_id;
                        _proyecto_id = null;
                        selectPry.dispatchEvent(new Event("change"));
                    }
                });
        });

        selectPry.addEventListener("change", () => {
            selectAo.innerHTML = `<option value="">Seleccione</option>`;
            resetLinea();
            if (!selectPry.value) return;
            fetch(`/api/actividades/?proyecto_id=${selectPry.value}`)
                .then(r => r.json())
                .then(data => {
                    llenarSelectConCodigo(selectAo, data.actividades, "id",
                        a => a.codigo_act_obra, a => `${a.codigo_act_obra} - ${a.nombre}`, "Seleccione");
                    if (_actividad_id) { 
                        selectAo.value = _actividad_id;
                        _actividad_id = null;
                        selectAo.dispatchEvent(new Event("change"));
                    }
                });
        });

        async function resolverLineasYNotificar() {
            lineasResolviendo++;
            try { await resolverLineas(); } finally { lineasResolviendo--; }
            notificarCambioLinea();
        }
        selectAo.addEventListener("change", resolverLineasYNotificar);
        selectPar.addEventListener("change", resolverLineasYNotificar);

        getProgramas().then(programas => {
            llenarSelectConCodigo(selectPrg, programas, "id",
                p => p.codigo_programa, p => `${p.codigo_programa} - ${p.nombre}`, "Seleccione");
            if (_programa_id) { 
                selectPrg.value = _programa_id;
                selectPrg.dispatchEvent(new Event("change"));
            }
        });

        getPartidas().then(partidas => {
            llenarSelectConCodigo(selectPar, partidas, "id",
                p => p.codigo, p => `${p.codigo} - ${p.denominacion}`, "Seleccione");
            if (_partida_id) {
                selectPar.value = _partida_id;
                selectPar.dispatchEvent(new Event("change"));
            }
        });

        inputImporte.addEventListener("blur", () => {
            const v = parsearImporte(inputImporte.value);
            if (v !== null && inputImporte.value.trim() !== "") inputImporte.value = formatearImporte(v);
            onCambio();
        });
        inputImporte.addEventListener("input", onCambio);

        btnEliminar.addEventListener("click", () => {
            wrapper.remove();
            saldoEl.remove();
            importeWrapper.remove();
            onCambio();
        });
    }

    // ─── CREAR FILA RECEPTORA (siempre Modo A) ────────────────────────────────
    function crearFilaReceptora(contenedorId, bloqueSaldoId, bloqueImporteId, datos = {}, onCambio) {
        crearFilaTransferente(contenedorId, bloqueSaldoId, bloqueImporteId, datos, onCambio, 'general');
    }

    // ─── HELPERS ──────────────────────────────────────────────────────────────
    function limpiarContenedor(id) {
        const c = document.getElementById(id);
        if (c) c.innerHTML = "";
    }

    function obtenerFilasTransferentes() {
        const wrappers = document.querySelectorAll("#contenedor-transferentes [data-fila-id]");
        const result   = [];
    
        wrappers.forEach(wrapper => {
            const fila = wrapper.querySelector(".fila-receptora-refuerzo");
            if (!fila) return;
    
            const filaId   = wrapper.dataset.filaId;
            const linea_id = fila.querySelector(".fila-linea-id")?.value.trim();
    
            // Buscar el importe por filaId en lugar de por índice
            const importeEl = document.querySelector(
                `#bloque-importes-transferentes .mf-importe-fila[data-fila-id="${filaId}"] .fila-importe`
            );
            const importe = parsearImporte(importeEl?.value) ?? 0;
    
            if (!linea_id || importe <= 0) return;
    
            const item = { linea_id, importe };
    
            if (getModo() === 'imputacion') {
                const det_id = fila.querySelector(".fila-detalle-id")?.value.trim();
                if (!det_id) return;
                item.imputacion_detalle_id = det_id;
            }
    
            result.push(item);
        });
    
        return result;
    }
    
    function obtenerFilasReceptoras() {
        const wrappers = document.querySelectorAll("#contenedor-receptoras [data-fila-id]");
        const result   = [];
    
        wrappers.forEach(wrapper => {
            const fila = wrapper.querySelector(".fila-receptora-refuerzo");
            if (!fila) return;
    
            const filaId   = wrapper.dataset.filaId;
            const linea_id = fila.querySelector(".fila-linea-id")?.value.trim();
    
            const importeEl = document.querySelector(
                `#bloque-importes-receptoras .mf-importe-fila[data-fila-id="${filaId}"] .fila-importe`
            );
            const importe = parsearImporte(importeEl?.value) ?? 0;
    
            if (linea_id && importe > 0) result.push({ linea_id, importe });
        });
    
        return result;
    }
    
    function calcularTotal(bloqueImporteId) {
        let total = 0;
        document.querySelectorAll(`#${bloqueImporteId} .fila-importe`)
            .forEach(inp => { total += parsearImporte(inp.value) ?? 0; });
        return total;
    }

    // ─── TOTALES ──────────────────────────────────────────────────────────────
    function actualizarTotales() {
        const totalTransf = calcularTotal("bloque-importes-transferentes");
        const totalRecep  = calcularTotal("bloque-importes-receptoras");

        document.getElementById("total-asignado-transferente").textContent = formatearImporte(totalTransf);
        document.getElementById("total-asignado-receptora").textContent    = formatearImporte(totalRecep);
        if (mImporte) mImporte.value = formatearImporte(totalRecep);

        const errorSpan    = document.getElementById("error-receptora-supera");
        const totalRecepEl = document.getElementById("total-asignado-receptora");

        if (totalTransf > 0 && totalRecep > totalTransf) {
            errorSpan.style.display = "inline";
            totalRecepEl.classList.add("error-total");
        } else {
            errorSpan.style.display = "none";
            totalRecepEl.classList.remove("error-total");
        }
    }

    // ─── RADIO BUTTONS: el cambio de modalidad se maneja en el bloque de guardado automático

    // ─── BOTONES + ────────────────────────────────────────────────────────────
    document.addEventListener("click", (e) => {
        if (e.target?.id === "btn-agregar-transferente") {
            crearFilaTransferente(
                "contenedor-transferentes",
                "bloque-saldos-transferentes",
                "bloque-importes-transferentes",
                {}, actualizarTotales
            );
        }
        if (e.target?.id === "btn-agregar-receptora") {
            crearFilaReceptora(
                "contenedor-receptoras",
                "bloque-saldos-receptoras",
                "bloque-importes-receptoras",
                {}, actualizarTotales
            );
        }
    });

    // ═════════════════════════════════════════════════════════════════════════
    //  GUARDADO AUTOMÁTICO (borrador "Revisar") + GUARDAR COMO COMPLETADO
    // ═════════════════════════════════════════════════════════════════════════
    // Mientras se completa el formulario, los datos se guardan solos en la BD como
    // borrador (estado Revisar). Un borrador es solo información: no modifica saldos
    // ni consume el remanente de ninguna imputación. Recién "Guardar como completado"
    // (confirmado y validado en el servidor) lo pasa a Listo y ejecuta la transferencia.
    // Funciona igual en las dos modalidades (A: presupuesto general / B: imputación).
    const esModoVer          = (MODO === "ver");
    const SUFIJO_EXPEDIENTE  = "-GDESDE-APRH#MAMA";
    const AUTOSAVE_MS        = 1500;   // pausa al escribir (debounce)
    const AUTOSAVE_CAMBIO_MS = 400;    // al cambiar un select, salir de un campo, agregar o quitar filas
    const REDIRECCION_FINAL  = "/admin-dashboard/registros/modificacion";
    const indicadorAutosave  = document.getElementById("autosave-estado");
    const cajaMensaje        = document.getElementById("mf-mensaje");
    const modalCompletar     = document.getElementById("modal-completar");
    const modalModalidad     = document.getElementById("modal-modalidad");

    let modificacionId        = null;   // id del borrador en la BD (null hasta el primer guardado)
    let version               = null;   // token de versión que devuelve el servidor en cada guardado
    let ultimaInstantanea     = null;   // JSON de lo último que el servidor confirmó haber guardado
    let autosaveTimer         = null;
    let colaGuardado          = Promise.resolve(true);   // serializa los guardados: nunca hay dos en paralelo
    let guardandoEnCurso      = false;
    let ultimoGuardadoFallo   = false;
    let reintentos            = 0;
    let restaurando           = false;  // true mientras se vuelve a cargar un borrador existente
    let completando           = false;
    let completado            = false;
    let autosaveBloqueado     = false;  // conflicto, borrador no restaurado, etc.: no se guarda nada más
    let dialogoModalidadAbierto = false; // mientras se pregunta si cambiar de modalidad no se guarda
    let lineasResolviendo     = 0;      // consultas de línea / imputación en curso
    let modoActual            = "general";   // modalidad vigente (para poder revertir si se cancela el cambio)

    // ─── Utilidades del bloque ────────────────────────────────────────────────
    function aNum(v) {
        if (v === undefined || v === null || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    // Vacío → null (un borrador puede no tener importe todavía); texto inválido → null
    function importeOpcional(texto) {
        if (texto === undefined || texto === null || String(texto).trim() === "") return null;
        return parsearImporte(String(texto));
    }

    function aCentavos(n) { return Math.round((n || 0) * 100); }

    function setEstadoAutosave(estado, texto, reemplazar = false) {
        if (!indicadorAutosave) return;
        const textos = {
            guardando: "Guardando borrador…",
            guardado:  "Borrador guardado (estado: Revisar)",
            error:     "⚠ NO se pudieron guardar los cambios" + (texto ? `: ${texto}` : ""),
        };
        indicadorAutosave.className   = estado ? `mf-autosave ${estado}` : "mf-autosave";
        indicadorAutosave.textContent = !estado ? "" : (reemplazar && texto ? texto : textos[estado]);
    }

    function mostrarMensaje(texto, tipo) {
        if (!cajaMensaje) return;
        cajaMensaje.textContent = texto;
        cajaMensaje.className   = `mf-msg ${tipo}`;
        cajaMensaje.hidden      = false;
        cajaMensaje.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function ocultarMensaje() {
        if (cajaMensaje) cajaMensaje.hidden = true;
    }

    function limpiarErrores() {
        [mFecha, mExpediente, mUsuario].forEach(inp => inp && inp.classList.remove("error"));
        document.getElementById("error-receptora-supera").style.display = "none";
        document.getElementById("total-asignado-receptora").classList.remove("error-total");
    }

    // ─── Payload (acepta datos parciales) ─────────────────────────────────────
    function filasDe(contenedorId, bloqueImporteId, conDetalle) {
        const filas = [];

        document.querySelectorAll(`#${contenedorId} .fila-receptora-refuerzo`).forEach(fila => {
            const filaId    = fila.dataset.filaId;
            const importeEl = document.querySelector(
                `#${bloqueImporteId} .mf-importe-fila[data-fila-id="${filaId}"] .fila-importe`
            );
            const optFuente = fila.querySelector(".fila-fuente")?.selectedOptions[0];

            const f = {
                programa_id:  aNum(fila.querySelector(".fila-prg")?.value),
                proyecto_id:  aNum(fila.querySelector(".fila-pry")?.value),
                actividad_id: aNum(fila.querySelector(".fila-ao")?.value),
                partida_id:   aNum(fila.querySelector(".fila-par")?.value),
                fuente_id:    aNum(optFuente?.dataset.fuente),
                linea_id:     aNum(fila.querySelector(".fila-linea-id")?.value),
                importe:      importeOpcional(importeEl?.value),
            };
            if (conDetalle) f.imputacion_detalle_id = aNum(fila.querySelector(".fila-detalle-id")?.value);

            // Una fila totalmente vacía (por ejemplo, un "+" sin usar) no se guarda
            const vacia = Object.values(f).every(v => v === null);
            if (!vacia) filas.push(f);
        });
        return filas;
    }

    function construirPayload() {
        const expediente = mExpediente.value.trim();
        return {
            fecha:             mFecha.value || "",
            nro_expediente:    expediente ? expediente + SUFIJO_EXPEDIENTE : "",
            nro_decreto:       decretoNombre,
            tipo_transferente: getModo(),
            transferentes:     filasDe("contenedor-transferentes", "bloque-importes-transferentes", true),
            receptoras:        filasDe("contenedor-receptoras",    "bloque-importes-receptoras",    false),
        };
    }

    function borradorVacio(p) {
        return !p.nro_expediente && !p.nro_decreto && p.transferentes.length === 0 && p.receptoras.length === 0;
    }

    // ─── Guardado (crea la primera vez, actualiza después) ────────────────────
    async function ejecutarGuardado() {
        if (autosaveBloqueado || completado || dialogoModalidadAbierto) return true;

        const payload     = construirPayload();
        const instantanea = JSON.stringify(payload);

        // No crear un borrador vacío solo por abrir el formulario
        if (!modificacionId && borradorVacio(payload)) return true;
        // Nada nuevo respecto de lo que el servidor ya tiene
        if (modificacionId && instantanea === ultimaInstantanea) return true;

        guardandoEnCurso = true;
        setEstadoAutosave("guardando");
        try {
            const url  = modificacionId
                ? `/api/modificacion/borrador/${modificacionId}/actualizar/`
                : "/api/modificacion/borrador/crear/";
            const body = modificacionId ? { ...payload, version } : payload;

            const resp = await fetch(url, {
                method:    "POST",
                headers:   { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") },
                body:      JSON.stringify(body),
                keepalive: true,
            });
            let data = {};
            try { data = await resp.json(); } catch (_) {}

            // Un 200 que no es nuestro JSON suele ser la pantalla de login (sesión vencida)
            if (!resp.ok || data.ok !== true) {
                const err = new Error(
                    data.error || (resp.ok
                        ? "respuesta inesperada del servidor (¿se cerró la sesión? Recargá la página)"
                        : `Error ${resp.status}`)
                );
                err.status = resp.status;
                throw err;
            }

            if (!modificacionId && data.modificacion_id) {
                modificacionId = data.modificacion_id;
                // Si se recarga la página, vuelve este mismo borrador (y no un formulario vacío)
                history.replaceState(null, "", `/modificacion/editar/${modificacionId}/`);
            }
            version             = data.version;
            ultimaInstantanea   = instantanea;
            ultimoGuardadoFallo = false;
            reintentos          = 0;
            setEstadoAutosave("guardado");
            return true;

        } catch (err) {
            console.error("Error en el guardado automático:", err);
            ultimoGuardadoFallo = true;

            // 409 (otro usuario lo modificó / ya completado) o 404: seguir guardando pisaría datos ajenos
            if (err.status === 409 || err.status === 404) {
                autosaveBloqueado = true;
                clearTimeout(autosaveTimer);
                autosaveTimer = null;
                setEstadoAutosave("error", err.message);
                mostrarMensaje(`${err.message}\nEl guardado automático quedó desactivado.`, "error");
                if (btnCompletar) btnCompletar.disabled = true;
                return false;
            }

            setEstadoAutosave("error", err.name === "TypeError" ? "sin conexión con el servidor" : err.message);
            if (!err.status || err.status >= 500) reintentarLuego();   // caída de red o error del servidor
            return false;

        } finally {
            guardandoEnCurso = false;
        }
    }

    function guardarBorrador() {
        colaGuardado = colaGuardado.catch(() => true).then(ejecutarGuardado);
        return colaGuardado;
    }

    function programarAutoguardado(ms = AUTOSAVE_MS) {
        if (esModoVer || restaurando || completando || completado || autosaveBloqueado || dialogoModalidadAbierto) return;
        reintentos = 0;
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => { autosaveTimer = null; guardarBorrador(); }, ms);
    }

    function reintentarLuego() {
        if (reintentos >= 5 || autosaveBloqueado || completado) return;
        reintentos++;
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => { autosaveTimer = null; guardarBorrador(); }, Math.min(5000 * reintentos, 30000));
    }

    // La línea y la imputación se resuelven de forma asíncrona después de elegir la fila:
    // cuando terminan hay datos nuevos para guardar.
    function notificarCambioLinea() {
        programarAutoguardado(AUTOSAVE_CAMBIO_MS);
    }

    function volcarPendiente() {
        if (autosaveTimer) {
            clearTimeout(autosaveTimer);
            autosaveTimer = null;
            guardarBorrador();
        }
    }

    function hayCambiosSinGuardar() {
        return !!autosaveTimer || guardandoEnCurso || (ultimoGuardadoFallo && !autosaveBloqueado);
    }

    // ─── Cambio de modalidad (A ↔ B) ──────────────────────────────────────────
    // Al cambiar se descartan los transferentes (receptoras no). Como el formulario se guarda
    // solo, ese descarte quedaría guardado al instante: si ya hay transferentes cargados se
    // pide confirmación antes. Si se cancela vuelve la modalidad anterior.
    function hayTransferentesCargados() {
        return filasDe("contenedor-transferentes", "bloque-importes-transferentes", true).length > 0;
    }

    function aplicarCambioDeModo() {
        limpiarContenedor("contenedor-transferentes");
        limpiarContenedor("bloque-saldos-transferentes");
        limpiarContenedor("bloque-importes-transferentes");
        crearFilaTransferente(
            "contenedor-transferentes",
            "bloque-saldos-transferentes",
            "bloque-importes-transferentes",
            {}, actualizarTotales
        );
        actualizarTotales();
        modoActual = getModo();
    }

    function revertirCambioDeModo() {
        dialogoModalidadAbierto = false;
        const radio = document.querySelector(`input[name="tipoUpTransferente"][value="${modoActual}"]`);
        if (radio) radio.checked = true;      // asignarlo por código no dispara "change"
        if (modalModalidad && modalModalidad.open) modalModalidad.close();
        // Un guardado que estaba en cola mientras se preguntaba se salteó: se reprograma para
        // que ningún cambio quede sin guardar (si no hay nada nuevo, no se envía nada)
        programarAutoguardado(AUTOSAVE_CAMBIO_MS);
    }

    document.querySelectorAll('input[name="tipoUpTransferente"]').forEach(radio => {
        radio.addEventListener("change", () => {
            if (getModo() === modoActual) return;

            if (!esModoVer && modalModalidad && hayTransferentesCargados()) {
                // Se frena el guardado hasta que el usuario decida (este handler corre antes
                // que el listener general del formulario, que es quien programa el guardado)
                dialogoModalidadAbierto = true;
                clearTimeout(autosaveTimer);
                autosaveTimer = null;
                if (typeof modalModalidad.showModal === "function") {
                    modalModalidad.showModal();
                } else if (confirm("Al cambiar el tipo de UP se borrarán las unidades transferentes ya cargadas. ¿Desea continuar?")) {
                    dialogoModalidadAbierto = false;
                    aplicarCambioDeModo();
                    programarAutoguardado(AUTOSAVE_CAMBIO_MS);
                } else {
                    revertirCambioDeModo();
                }
                return;
            }
            aplicarCambioDeModo();
        });
    });

    if (modalModalidad) {
        document.getElementById("modal-modalidad-confirmar")?.addEventListener("click", () => {
            dialogoModalidadAbierto = false;
            if (modalModalidad.open) modalModalidad.close();
            aplicarCambioDeModo();
            programarAutoguardado(AUTOSAVE_CAMBIO_MS);
        });
        document.getElementById("modal-modalidad-cancelar")?.addEventListener("click", revertirCambioDeModo);
        modalModalidad.addEventListener("cancel", revertirCambioDeModo);   // Esc
    }

    // ─── Disparadores del guardado ────────────────────────────────────────────
    // Solo cuentan los eventos reales del usuario (isTrusted): los "change" que el propio
    // código dispara al volver a cargar un borrador no deben provocar guardados.
    if (!esModoVer) {
        const pagina  = document.querySelector(".mf-pagina");
        const esCampo = (el) => el && el.matches && el.matches("input, select, textarea");

        pagina.addEventListener("input", (e) => {
            if (e.isTrusted && esCampo(e.target)) programarAutoguardado(AUTOSAVE_MS);
        });
        ["change", "focusout"].forEach(tipo => pagina.addEventListener(tipo, (e) => {
            if (e.isTrusted && esCampo(e.target)) programarAutoguardado(AUTOSAVE_CAMBIO_MS);
        }));
        pagina.addEventListener("click", (e) => {
            if (e.isTrusted && e.target.closest &&
                e.target.closest("#btn-agregar-transferente, #btn-agregar-receptora, .btn-eliminar-fila")) {
                programarAutoguardado(AUTOSAVE_CAMBIO_MS);
            }
        });

        // Si cambia de pestaña o cierra, se guarda de inmediato lo pendiente
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") volcarPendiente();
        });
        window.addEventListener("pagehide", volcarPendiente);
        window.addEventListener("beforeunload", (e) => {
            if (hayCambiosSinGuardar()) {
                volcarPendiente();
                e.preventDefault();
                e.returnValue = "";
            }
        });
        // Al volver la conexión se reintenta lo que falló
        window.addEventListener("online", () => {
            if (ultimoGuardadoFallo && !autosaveBloqueado && !completado) guardarBorrador();
        });
    }

    // ─── Validación previa a "completar" (el servidor valida de nuevo, es la definitiva) ───
    function validarParaCompletar() {
        const errores = [];
        const p = construirPayload();

        if (!p.fecha)          { mFecha.classList.add("error");      errores.push("Falta la fecha."); }
        if (!p.nro_expediente) { mExpediente.classList.add("error"); errores.push("Falta el N° de expediente."); }
        if (!p.nro_decreto)    { errores.push("Falta seleccionar el decreto / resolución."); }
        if (p.transferentes.length === 0) errores.push("Cargá al menos una unidad transferente.");
        if (p.receptoras.length === 0)    errores.push("Cargá al menos una unidad receptora.");

        let totalT = 0, totalR = 0;
        p.transferentes.forEach((d, i) => {
            const n = i + 1;
            if (!d.linea_id) errores.push(`Transferente fila ${n}: falta completar la línea presupuestaria (programa, proyecto, actividad, partida y fuente).`);
            if (!(d.importe > 0)) errores.push(`Transferente fila ${n}: el importe debe ser mayor a cero.`);
            if (p.tipo_transferente === "imputacion" && !d.imputacion_detalle_id) {
                errores.push(`Transferente fila ${n}: en la modalidad "UP de una Imputación" hay que elegir la imputación.`);
            }
            totalT += d.importe || 0;
        });
        p.receptoras.forEach((d, i) => {
            const n = i + 1;
            if (!d.linea_id) errores.push(`Receptora fila ${n}: falta completar la línea presupuestaria (programa, proyecto, actividad, partida y fuente).`);
            if (!(d.importe > 0)) errores.push(`Receptora fila ${n}: el importe debe ser mayor a cero.`);
            totalR += d.importe || 0;
        });

        if (p.transferentes.length && p.receptoras.length && aCentavos(totalT) !== aCentavos(totalR)) {
            if (aCentavos(totalR) > aCentavos(totalT)) {
                document.getElementById("error-receptora-supera").style.display = "inline";
                document.getElementById("total-asignado-receptora").classList.add("error-total");
            }
            errores.push(
                `El total transferente ($ ${formatearImporte(totalT)}) no coincide con el total receptora ($ ${formatearImporte(totalR)}).`
            );
        }
        return errores;
    }

    // ─── Guardar como completado ──────────────────────────────────────────────
    async function pedirCompletar() {
        if (esModoVer || completando || completado || autosaveBloqueado || restaurando) return;
        ocultarMensaje();
        limpiarErrores();
        actualizarTotales();

        const errores = validarParaCompletar();
        if (errores.length) {
            mostrarMensaje("Todavía no se puede completar. Revisá lo siguiente:\n• " + errores.join("\n• "), "error");
            return;
        }

        // El servidor tiene que tener exactamente lo que se ve en pantalla
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
        const ok = await guardarBorrador();
        if (!ok || !modificacionId) {
            mostrarMensaje("No se pudieron guardar los últimos cambios en el servidor. Reintentá antes de completar.", "error");
            return;
        }

        if (modalCompletar && typeof modalCompletar.showModal === "function") {
            modalCompletar.showModal();
        } else if (confirm("¿Está seguro de que desea guardar esta Modificación Presupuestaria como completada?")) {
            confirmarCompletar();
        }
    }

    async function confirmarCompletar() {
        const btnConfirmar = document.getElementById("modal-confirmar");
        const btnCancelar  = document.getElementById("modal-cancelar");

        completando = true;
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
        if (btnConfirmar) btnConfirmar.disabled = true;
        if (btnCancelar)  btnCancelar.disabled  = true;

        try {
            const resp = await fetch(`/api/modificacion/${modificacionId}/completar/`, {
                method:  "POST",
                headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") },
                body:    JSON.stringify({ version }),
            });
            let data = {};
            try { data = await resp.json(); } catch (_) {}
            if (modalCompletar && modalCompletar.open) modalCompletar.close();

            if (!resp.ok || data.ok !== true) {
                // Sigue en estado Revisar: el usuario corrige y vuelve a intentar
                if (resp.status === 409 || resp.status === 404) {
                    autosaveBloqueado = true;
                    if (btnCompletar) btnCompletar.disabled = true;
                }
                mostrarMensaje(
                    data.error || (resp.ok
                        ? "Respuesta inesperada del servidor (¿se cerró la sesión?). La Modificación NO se completó: revisá su estado en el historial de registros."
                        : "No se pudo completar la Modificación."),
                    "error"
                );
                return;
            }

            completado          = true;
            ultimoGuardadoFallo = false;
            setEstadoAutosave("");
            bloquearFormularioCompletado();
            mostrarMensaje(
                `Modificación guardada como completada (estado Listo). Total transferido: $ ${formatearImporte(data.importe_total)}`,
                "exito"
            );
            setTimeout(() => { window.location.href = REDIRECCION_FINAL; }, 1800);

        } catch (err) {
            console.error(err);
            if (modalCompletar && modalCompletar.open) modalCompletar.close();
            mostrarMensaje(
                "Error de red: la Modificación NO se completó. Revisá su estado en el historial de registros antes de reintentar.",
                "error"
            );
        } finally {
            completando = false;
            if (btnConfirmar) btnConfirmar.disabled = false;
            if (btnCancelar)  btnCancelar.disabled  = false;
        }
    }

    function bloquearFormularioCompletado() {
        document.querySelectorAll(".mf-pagina input, .mf-pagina select").forEach(el => { el.disabled = true; });
        document.querySelectorAll(".btn-eliminar-fila").forEach(el => { el.style.display = "none"; });
        ["btn-agregar-transferente", "btn-agregar-receptora"].forEach(id => {
            const b = document.getElementById(id);
            if (b) b.style.display = "none";
        });
        const fileBtn = document.querySelector(".mf-file-btn");
        if (fileBtn) fileBtn.style.display = "none";
        if (btnCompletar) btnCompletar.style.display = "none";
    }

    if (btnCompletar) btnCompletar.addEventListener("click", pedirCompletar);
    if (modalCompletar) {
        document.getElementById("modal-cancelar")?.addEventListener("click", () => modalCompletar.close());
        document.getElementById("modal-confirmar")?.addEventListener("click", confirmarCompletar);
        // Con la confirmación en curso no se puede cerrar con Esc
        modalCompletar.addEventListener("cancel", (e) => { if (completando) e.preventDefault(); });
    }

    // ─── Retomar un borrador ──────────────────────────────────────────────────
    function esperarCondicion(fn, timeoutMs, intervaloMs = 100) {
        return new Promise(resolve => {
            const inicio = Date.now();
            (function chequear() {
                if (fn()) return resolve(true);
                if (Date.now() - inicio > timeoutMs) return resolve(false);
                setTimeout(chequear, intervaloMs);
            })();
        });
    }

    function bloquearEdicion(bloquear) {
        document.querySelectorAll(".mf-card").forEach(card => {
            card.inert               = bloquear;
            card.style.pointerEvents = bloquear ? "none" : "";
            card.style.opacity       = bloquear ? "0.6" : "";
        });
    }

    // La imputación guardada puede dejar de estar disponible (se agotó su remanente o se anuló):
    // el listado solo trae imputaciones con saldo. Se avisa para que se elija otra.
    function imputacionYaNoDisponible(fila, esperado) {
        if (!esperado.imputacion_detalle_id) return false;
        const sel = fila.querySelector(".fila-imputacion");
        if (!sel) return false;
        return !Array.from(sel.options).some(o => String(o.value) === String(esperado.imputacion_detalle_id));
    }

    // ¿La fila ya muestra lo que el servidor tenía guardado?
    function filaRestaurada(fila, esperado) {
        const coincide = (selector, id) => !id || (fila.querySelector(selector)?.value || "") === String(id);
        const base = coincide(".fila-prg",      esperado.programa_id)
                  && coincide(".fila-pry",      esperado.proyecto_id)
                  && coincide(".fila-ao",       esperado.actividad_id)
                  && coincide(".fila-par",      esperado.partida_id)
                  && coincide(".fila-linea-id", esperado.linea_id);
        if (!base) return false;
        if (!esperado.imputacion_detalle_id) return true;
        // Modalidad B: la imputación elegida, o bien (ya cargado el listado) que ya no figure en él
        return coincide(".fila-detalle-id", esperado.imputacion_detalle_id)
            || imputacionYaNoDisponible(fila, esperado);
    }

    // La cascada de selects y las imputaciones se rearman con varias consultas encadenadas.
    // Hasta que termina, el formulario queda bloqueado y NO se guarda nada: un guardado a mitad
    // de la carga pisaría con datos incompletos lo que ya estaba guardado.
    async function restaurarBorrador(datos) {
        restaurando = true;
        bloquearEdicion(true);
        if (btnCompletar) btnCompletar.disabled = true;
        setEstadoAutosave("guardando", "Cargando borrador…", true);

        const filasT = Array.from(document.querySelectorAll("#contenedor-transferentes .fila-receptora-refuerzo"));
        const filasR = Array.from(document.querySelectorAll("#contenedor-receptoras .fila-receptora-refuerzo"));
        const esperadosT = datos.transferentes || [];
        const esperadosR = datos.receptoras || [];

        const ok = await esperarCondicion(
            () => lineasResolviendo === 0
               && esperadosT.every((e, i) => filasT[i] && filaRestaurada(filasT[i], e))
               && esperadosR.every((e, i) => filasR[i] && filaRestaurada(filasR[i], e)),
            20000
        );

        if (!ok) {
            // Se deja el formulario bloqueado y sin guardado automático para no pisar el borrador guardado
            autosaveBloqueado = true;
            const aviso = "No se pudo cargar el borrador completo. El guardado automático quedó desactivado para no pisar los datos ya guardados: recargá la página.";
            setEstadoAutosave("error", aviso, true);
            mostrarMensaje(aviso, "error");
            return;
        }

        ultimaInstantanea = JSON.stringify(construirPayload());   // lo que el servidor tiene ahora
        restaurando = false;
        bloquearEdicion(false);
        if (btnCompletar) btnCompletar.disabled = false;
        setEstadoAutosave("guardado");

        const sinImputacion = esperadosT
            .map((e, i) => (filasT[i] && imputacionYaNoDisponible(filasT[i], e)) ? i + 1 : null)
            .filter(n => n !== null);
        if (sinImputacion.length) {
            mostrarMensaje(
                `La imputación elegida en la fila ${sinImputacion.join(", ")} de transferentes ya no tiene saldo disponible ` +
                `(o fue anulada). Elegí otra antes de completar.`,
                "error"
            );
        }
    }

    if (btnExportar) {
        btnExportar.addEventListener("click", () => generarPDF());
    }
    
    function generarPDF() {
        // ── Recolectar datos de transferentes ─────────────────────
        const wrappers_t = document.querySelectorAll("#contenedor-transferentes [data-fila-id]");
        const filas_t = [];
        wrappers_t.forEach(wrapper => {
            const fila    = wrapper.querySelector(".fila-receptora-refuerzo");
            if (!fila) return;
            const filaId  = wrapper.dataset.filaId;
            const inputs  = fila.querySelectorAll("select, input[type='text']:not([readonly])");
            const valores = Array.from(fila.querySelectorAll("select, input[type='text']"))
                .map(el => el.value || "—");
            const importeEl = document.querySelector(
                `#bloque-importes-transferentes .mf-importe-fila[data-fila-id="${filaId}"] .fila-importe`
            );
            filas_t.push({
                jur:    "51",
                prg:    fila.querySelector(".fila-prg")?.value || "—",
                sprg:   "00",
                pry:    fila.querySelector(".fila-pry")?.value || "—",
                ao:     fila.querySelector(".fila-ao")?.value  || "—",
                par:    fila.querySelector(".fila-par")?.value || "—",
                ff:     fila.querySelector(".fila-fuente")?.value || "—",
                importe: importeEl?.value || "—",
            });
        });
    
        // ── Recolectar datos de receptoras ────────────────────────
        const wrappers_r = document.querySelectorAll("#contenedor-receptoras [data-fila-id]");
        const filas_r = [];
        wrappers_r.forEach(wrapper => {
            const fila   = wrapper.querySelector(".fila-receptora-refuerzo");
            if (!fila) return;
            const filaId = wrapper.dataset.filaId;
            const importeEl = document.querySelector(
                `#bloque-importes-receptoras .mf-importe-fila[data-fila-id="${filaId}"] .fila-importe`
            );
            filas_r.push({
                jur:    "51",
                prg:    fila.querySelector(".fila-prg")?.value    || "—",
                sprg:   "00",
                pry:    fila.querySelector(".fila-pry")?.value    || "—",
                ao:     fila.querySelector(".fila-ao")?.value     || "—",
                par:    fila.querySelector(".fila-par")?.value    || "—",
                ff:     fila.querySelector(".fila-fuente")?.value || "—",
                importe: importeEl?.value || "—",
            });
        });
    
        // ── Datos adicionales ─────────────────────────────────────
        const fecha      = document.getElementById("m-fecha")?.value || "";
        const expediente = document.getElementById("m-expediente")?.value || "";
        const usuario    = document.getElementById("m-usuario")?.value || "";
        const decreto    = document.getElementById("m-decreto-nombre")?.textContent || "";
        const importe    = document.getElementById("m-importe")?.value || "";
        const totalT     = document.getElementById("total-asignado-transferente")?.textContent || "";
        const totalR     = document.getElementById("total-asignado-receptora")?.textContent || "";
        const tipoUp     = document.querySelector('input[name="tipoUpTransferente"]:checked')?.value === "imputacion"
                           ? "UP de una Imputación" : "UP Presupuesto General";
    
        // ── Función para generar filas de tabla HTML ──────────────
        function filasTabla(filas) {
            return filas.map(f => `
                <tr>
                    <td>${f.jur}</td>
                    <td>${f.prg}</td>
                    <td>${f.sprg}</td>
                    <td>${f.pry}</td>
                    <td>${f.ao}</td>
                    <td>${f.par}</td>
                    <td>${f.ff}</td>
                    <td class="importe">${f.importe}</td>
                </tr>
            `).join("");
        }
    
        // ── Construir HTML del PDF ────────────────────────────────
        const html = `<!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Modificación Presupuestaria</title>
            <style>
                @page { size: A4 landscape; margin: 12mm 15mm; }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1e293b; }
        
                /* Encabezado */
                .encabezado {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    border-bottom: 2px solid #1d2731;
                    padding-bottom: 8px;
                    margin-bottom: 10px;
                }
                .encabezado img { width: 48px; height: 48px; object-fit: contain; }
                .encabezado-titulo { font-size: 13pt; font-weight: 700; color: #1d2731; }
                .encabezado-sub { font-size: 9pt; color: #475569; }
        
                h1 { font-size: 14pt; font-weight: 700; margin-bottom: 10px; color: #1d2731; }
        
                /* Cards */
                .card {
                    border: 1px solid #dcdfe6;
                    border-radius: 6px;
                    margin-bottom: 10px;
                    overflow: hidden;
                    page-break-inside: avoid;
                }
                .card-header {
                    background: #eef2f6;
                    padding: 6px 12px;
                    font-size: 8pt;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    color: #1d2731;
                    text-transform: uppercase;
                }
                .card-body { padding: 10px 12px; }
        
                /* Tipo UP */
                .tipo-up { font-size: 8pt; color: #475569; margin-bottom: 8px; }
                .tipo-up strong { color: #1d2731; }
        
                /* Tablas de UPs */
                table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
                thead tr { background: #1d4ed8; color: #fff; }
                thead th {
                    padding: 5px 8px;
                    font-size: 7.5pt;
                    font-weight: 700;
                    text-align: center;
                    letter-spacing: 0.3px;
                }
                tbody tr:nth-child(even) { background: #f8fafc; }
                tbody td {
                    padding: 5px 8px;
                    font-size: 8.5pt;
                    text-align: center;
                    border-bottom: 1px solid #e2e8f0;
                }
                td.importe { text-align: right; font-weight: 600; }
        
                /* Totales */
                .totales {
                    display: flex;
                    justify-content: flex-end;
                    gap: 24px;
                    padding: 6px 12px;
                    background: #f8fafc;
                    border-top: 1px solid #dcdfe6;
                }
                .total-item { font-size: 8.5pt; font-weight: 700; color: #1d2731; }
                .total-item span { color: #2e7d32; margin-left: 8px; }
        
                /* Info adicional */
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px 16px;
                }
                .info-campo label {
                    display: block;
                    font-size: 7pt;
                    font-weight: 700;
                    color: #475569;
                    text-transform: uppercase;
                    margin-bottom: 2px;
                }
                .info-campo p {
                    font-size: 9pt;
                    color: #1e293b;
                    border-bottom: 1px solid #e2e8f0;
                    padding-bottom: 3px;
                }
            </style>
        </head>
        <body>
        
            <!-- Encabezado institucional -->
            <div class="encabezado">
                <div>
                    <div class="encabezado-titulo">ADM. PCIAL. DE RECURSOS HÍDRICOS</div>
                    <div class="encabezado-sub">Santiago del Estero</div>
                </div>
            </div>
        
            <h1>MODIFICACIÓN PRESUPUESTARIA</h1>
        
            <!-- Datos de modificación -->
            <div class="card">
                <div class="card-header">Datos de Modificación</div>
                <div class="card-body">
        
                    <!-- Tipo de UP -->
                    <div class="tipo-up">Tipo de UP: <strong>${tipoUp}</strong></div>
        
                    <!-- Unidades Transferentes -->
                    <div class="card-header" style="background:#e8f0fe; color:#1d4ed8; margin: 0 -12px 8px; padding: 4px 12px;">
                        UNIDAD PRESUPUESTARIA TRANSFERENTE
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>JUR</th><th>PRG</th><th>SPRG</th>
                                <th>PRY</th><th>A/O</th><th>PAR</th><th>FF</th>
                                <th>IMPORTE ($)</th>
                            </tr>
                        </thead>
                        <tbody>${filasTabla(filas_t)}</tbody>
                    </table>
        
                    <!-- Unidades Receptoras -->
                    <div class="card-header" style="background:#e8f0fe; color:#1d4ed8; margin: 8px -12px 8px; padding: 4px 12px;">
                        UNIDAD PRESUPUESTARIA RECEPTORA
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>JUR</th><th>PRG</th><th>SPRG</th>
                                <th>PRY</th><th>A/O</th><th>FF</th>
                                <th>IMPORTE ($)</th>
                            </tr>
                        </thead>
                        <tbody>${filasTabla(filas_r)}</tbody>
                    </table>
        
                </div>
        
                <!-- Totales -->
                <div class="totales">
                    <div class="total-item">TOTAL TRANSFERENTE ($): <span>${totalT}</span></div>
                    <div class="total-item">TOTAL RECEPTORA ($): <span>${totalR}</span></div>
                </div>
            </div>
        
            <!-- Información adicional -->
            <div class="card">
                <div class="card-header">Información Adicional</div>
                <div class="card-body">
                    <div class="info-grid">
                        <div class="info-campo">
                            <label>Decreto / Resolución</label>
                            <p>${decreto}</p>
                        </div>
                        <div class="info-campo">
                            <label>N° Expediente</label>
                            <p>${expediente}-GDESDE-APRH#MAMA</p>
                        </div>
                        <div class="info-campo">
                            <label>Fecha</label>
                            <p>${fecha}</p>
                        </div>
                        <div class="info-campo">
                            <label>Responsable</label>
                            <p>${usuario}</p>
                        </div>
                        <div class="info-campo">
                            <label>Importe Total</label>
                            <p><strong>${importe}</strong></p>
                        </div>
                    </div>
                </div>
            </div>
        
            <script>window.onload = () => { window.print(); }</script>
        </body>
        </html>`;
    
        // ── Abrir en ventana nueva y disparar impresión ────────────
        const ventana = window.open("", "_blank", "width=1000,height=700");
        ventana.document.write(html);
        ventana.document.close();
    }

    // ─── INICIALIZAR ──────────────────────────────────────────────────────────
    mUsuario.value = typeof USUARIO_ACTUAL !== "undefined" ? USUARIO_ACTUAL : "";
    const hoy      = new Date().toISOString().split("T")[0];
    mFecha.value   = hoy;
    mFecha.max     = hoy;

    limpiarContenedor("contenedor-transferentes");
    limpiarContenedor("contenedor-receptoras");
    limpiarContenedor("bloque-saldos-transferentes");
    limpiarContenedor("bloque-saldos-receptoras");
    limpiarContenedor("bloque-importes-transferentes");
    limpiarContenedor("bloque-importes-receptoras");

    // ─── MODO VER: deshabilitar todos los controles ───────────────────────────
    if (MODO === 'ver') {
        document.querySelectorAll('input[name="tipoUpTransferente"]').forEach(r => r.disabled = true);
        const btnAgregarT = document.getElementById("btn-agregar-transferente");
        const btnAgregarR = document.getElementById("btn-agregar-receptora");
        if (btnAgregarT) btnAgregarT.style.display = "none";
        if (btnAgregarR) btnAgregarR.style.display = "none";
        ["m-expediente", "m-fecha"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
        });
        const fileBtn = document.querySelector(".mf-file-btn");
        if (fileBtn) fileBtn.style.display = "none";
            // Deshabilitar todos los selectores e inputs de las filas dinámicas
        // usando un MutationObserver para capturar los que se crean asincrónicamente
        const observer = new MutationObserver(() => {
            document.querySelectorAll(
                ".fila-receptora-refuerzo select, " +
                ".fila-receptora-refuerzo input:not([type='hidden'])"
            ).forEach(el => {
                el.disabled = true;
                el.style.pointerEvents = "none";
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    if ((MODO === "editar" || MODO === "ver") && MODIFICACION) {
            mFecha.value      = MODIFICACION.fecha || "";
            mFecha.max        = new Date().toISOString().split("T")[0];
            const sufijo = "-GDESDE-APRH#MAMA";
            const expCompleto = MODIFICACION.nro_expediente || "";
            mExpediente.value = expCompleto.endsWith(sufijo)
                ? expCompleto.slice(0, -sufijo.length)
                : expCompleto;
            decretoNombre = MODIFICACION.nro_decreto || "";
            document.getElementById("m-decreto-nombre").textContent =
                decretoNombre || "Sin archivos seleccionados";

            // Restaurar modo del radio button
            const tipoGuardado = MODIFICACION.tipo_transferente || 'general';
            const radioRestore = document.querySelector(`input[name="tipoUpTransferente"][value="${tipoGuardado}"]`);
            if (radioRestore) radioRestore.checked = true;
            modoActual = getModo();

            (MODIFICACION.transferentes || []).forEach(t =>
                crearFilaTransferente(
                    "contenedor-transferentes",
                    "bloque-saldos-transferentes",
                    "bloque-importes-transferentes",
                    {
                        programa_id:           t.programa_id,
                        proyecto_id:           t.proyecto_id,
                        actividad_id:          t.actividad_id,
                        partida_id:            t.partida_id,
                        fuente_id:             t.fuente_id,
                        linea_id:              t.linea_id,
                        importe:               t.importe,
                        imputacion_detalle_id: t.imputacion_detalle_id || null,
                    },
                    actualizarTotales
                )
            );

            (MODIFICACION.receptoras || []).forEach(r =>
                crearFilaReceptora(
                    "contenedor-receptoras",
                    "bloque-saldos-receptoras",
                    "bloque-importes-receptoras",
                    {
                        programa_id:  r.programa_id,
                        proyecto_id:  r.proyecto_id,
                        actividad_id: r.actividad_id,
                        partida_id:   r.partida_id,
                        fuente_id:    r.fuente_id,
                        linea_id:     r.linea_id,
                        importe:      r.importe,
                    },
                    actualizarTotales
                )
            );

            // Un borrador sin filas guardadas igual necesita una fila para seguir completándolo
            if (!(MODIFICACION.transferentes || []).length && MODO === "editar") {
                crearFilaTransferente("contenedor-transferentes", "bloque-saldos-transferentes",
                    "bloque-importes-transferentes", {}, actualizarTotales);
            }
            if (!(MODIFICACION.receptoras || []).length && MODO === "editar") {
                crearFilaReceptora("contenedor-receptoras", "bloque-saldos-receptoras",
                    "bloque-importes-receptoras", {}, actualizarTotales);
            }

            if (MODO === "editar") {
                modificacionId = MODIFICACION.id;
                version        = MODIFICACION.version;
                restaurarBorrador(MODIFICACION);
            }

        } else {
            crearFilaTransferente(
                "contenedor-transferentes",
                "bloque-saldos-transferentes",
                "bloque-importes-transferentes",
                {}, actualizarTotales
            );
            crearFilaReceptora(
                "contenedor-receptoras",
                "bloque-saldos-receptoras",
                "bloque-importes-receptoras",
                {}, actualizarTotales
            );
        }

        actualizarTotales();
});