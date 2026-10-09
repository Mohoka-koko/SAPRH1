/**
 * refuerzo_form.js
 * Formulario standalone de Refuerzo (crear y editar).
 * - Filas dinámicas para Receptora con cascada JUR/PRG/SPRG/PRY/A/O/PAR
 * - Saldo actual en columna central
 * - Total asignado + validación vs importe total del refuerzo
 * - POST a /api/refuerzo/crear/
 * - Al guardar redirige a la lista de refuerzos
 */

document.addEventListener("DOMContentLoaded", () => {

    // ─── UTILIDADES ───────────────────────────────────────────────────────────
    function formatearImporte(num) {
      if (num === null || num === undefined || num === "") return "";
      return Number(num).toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
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
  
    // ─── REFERENCIAS ──────────────────────────────────────────────────────────
    const mFecha        = document.getElementById("m-fecha");
    const mImporteTotal = document.getElementById("m-importe-total-refuerzo");
    const mExpediente   = document.getElementById("m-expediente");
    const mUsuario      = document.getElementById("m-usuario");
    const mDecreto      = document.getElementById("m-decreto");
    const btnGuardar    = document.getElementById("btn-guardar");
    const btnExportar   = document.getElementById("btn-exportar");
  
    mDecreto.addEventListener("change", () => {
      const archivo = mDecreto.files[0];
      document.getElementById("m-decreto-nombre").textContent =
        archivo ? archivo.name : "Sin archivos seleccionados";
    });
  
    mImporteTotal.addEventListener("blur", () => {
      const v = parsearImporte(mImporteTotal.value);
      if (v !== null && mImporteTotal.value.trim() !== "") mImporteTotal.value = formatearImporte(v);
      actualizarTotal();
    });
  
    mImporteTotal.addEventListener("focus", () => {
      const v = parsearImporte(mImporteTotal.value);
      if (v !== null && v > 0) mImporteTotal.value = v.toFixed(2).replace(".", ",");
    });

    // ─── MODO VER ─────────────────────────────────────────────
    if (MODO === 'ver') {
      const btnAgregarR = document.getElementById("btn-agregar-receptora");
      if (btnAgregarR) btnAgregarR.style.display = "none";
      ["m-expediente", "m-fecha", "m-importe-total-refuerzo"].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.disabled = true;
      });
      const fileBtn = document.querySelector(".mf-file-btn");
      if (fileBtn) fileBtn.style.display = "none";

      // Deshabilitar selectores dinámicamente
      const observer = new MutationObserver(() => {
          document.querySelectorAll(
              ".fila-receptora-refuerzo select, " +
              ".fila-receptora-refuerzo input:not([type='hidden'])"
          ).forEach(el => { el.disabled = true; el.style.pointerEvents = "none"; });
          document.querySelectorAll(".btn-eliminar-fila")
              .forEach(el => el.style.display = "none");
      });
      observer.observe(document.body, { childList: true, subtree: true });
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
  
    // ─── HELPER SELECT CON CÓDIGO/LABEL ───────────────────────────────────────
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
  
    // ─── CREAR FILA ───────────────────────────────────────────────────────────
    let _filaCounter = 0;
  
    function crearFila(datos = {}, onCambio) {
      const filaId = `fila-${++_filaCounter}`;
  
      // ── Cascada (columna izquierda) ──────────────────────────────
      const wrapper = document.createElement("div");
      wrapper.dataset.filaId = filaId;
      wrapper.style.marginBottom = "8px";
  
      const cabecera = document.createElement("div");
      cabecera.className = "mf-cabecera-cascada";
      cabecera.innerHTML = `
        <span>JUR</span>
        <span>PRG</span>
        <span>SPRG</span>
        <span>PRY</span>
        <span>A/O</span>
        <span>PAR</span>
        <span>FF</span>        
      `;
  
      const fila = document.createElement("div");
      fila.className = "fila-receptora-refuerzo";
      fila.dataset.filaId = filaId;
      fila.innerHTML = `
        <input type="text" value="51" readonly title="Jurisdicción (fijo)" />
        <select class="fila-prg"><option value="">Seleccione</option></select>
        <input type="text" value="00" readonly title="Subprograma (fijo)" />
        <select class="fila-pry"><option value="">Seleccione</option></select>
        <select class="fila-ao"><option value="">Seleccione</option></select>
        <select class="fila-par"><option value="">Seleccione</option></select>
        <select class="fila-fuente" disabled><option value="">FF...</option></select>
        <input type="hidden" class="fila-linea-id" value="" />
      `;
    
      wrapper.appendChild(cabecera);
      wrapper.appendChild(fila);
      document.getElementById("contenedor-receptoras").appendChild(wrapper);
  
      // ── Saldo (columna central) ──────────────────────────────────
      const saldoEl = document.createElement("div");
      saldoEl.className = "mf-importe-fila";
      saldoEl.dataset.filaId = filaId;
  
      const saldoInput = document.createElement("input");
      saldoInput.type      = "text";
      saldoInput.className = "fila-saldo-display";
      saldoInput.readOnly  = true;
      saldoInput.placeholder = "—";
      saldoEl.appendChild(saldoInput);
      document.getElementById("bloque-saldos-receptoras").appendChild(saldoEl);
  
      // ── Importe (columna derecha) ────────────────────────────────
      const importeWrapper = document.createElement("div");
      importeWrapper.className = "mf-importe-fila";
      importeWrapper.dataset.filaId = filaId;
  
      const inputImporte = document.createElement("input");
      inputImporte.type        = "text";
      inputImporte.className   = "fila-importe";
      inputImporte.placeholder = "Ingrese importe";
      if (datos.importe) inputImporte.value = formatearImporte(parseFloat(datos.importe));
  
      const btnEliminar = document.createElement("button");
      btnEliminar.type      = "button";
      btnEliminar.className = "btn-eliminar-fila";
      btnEliminar.textContent = "✕";
  
      importeWrapper.appendChild(inputImporte);
      importeWrapper.appendChild(btnEliminar);
      document.getElementById("bloque-importes-receptoras").appendChild(importeWrapper);
  
      // ── Referencias internas ─────────────────────────────────────
      const selectPrg    = fila.querySelector(".fila-prg");
      const selectPry    = fila.querySelector(".fila-pry");
      const selectAo     = fila.querySelector(".fila-ao");
      const selectPar    = fila.querySelector(".fila-par");
      const selectFuente = fila.querySelector(".fila-fuente");
      const inputLineaId = fila.querySelector(".fila-linea-id");
  
      function resetLinea() {
        inputLineaId.value         = "";
        saldoInput.value           = "";
        saldoInput.placeholder     = "—";
        selectFuente.disabled      = true; 
        selectFuente.innerHTML     = `<option value="">FF...</option>`;
      }
  
      // ── Resolver línea ───────────────────────────────────────────
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
            saldoInput.value = "⚠ No encontrada";
            return;
          }
          if (data.lineas.length === 1) {
            const linea = data.lineas[0];
            inputLineaId.value     = linea.linea_id;
            saldoInput.value       = `$${formatearImporte(parseFloat(linea.saldo_actual))}`;
            saldoInput.style.color = "#2e7d32";
            
            // NUEVAS 2 LÍNEAS PARA MOSTRAR EL FF ÚNICO:
            selectFuente.innerHTML = `<option value="${linea.linea_id}">${linea.fuente_nombre.split(" - ")[0]}</option>`;
            selectFuente.disabled = false;
  
          } else {
            selectFuente.innerHTML = `<option value="">Elegir FF</option>`;
            selectFuente.disabled = false; // NUEVA LÍNEA: habilita el selector
            
            data.lineas.forEach(l => {
              const opt = document.createElement("option");
              opt.value          = l.linea_id;
              opt.dataset.saldo  = l.saldo_actual;
              opt.dataset.label  = l.fuente_nombre;
              opt.dataset.codigo = l.fuente_nombre.split(" - ")[0];
              
              // LA LÍNEA MÁGICA: Le asigna SOLO el número de código, sin el saldo
              opt.textContent    = opt.dataset.codigo;
              
              selectFuente.appendChild(opt);
            });
  
            if (datos.fuente_id) {
              const optFuente = Array.from(selectFuente.options).find(o =>
                data.lineas.find(l => l.linea_id == o.value && l.fuente_id == datos.fuente_id)
              );
              if (optFuente) {
                selectFuente.value = optFuente.value;
                selectFuente.dispatchEvent(new Event("change"));
              }
            }
          }
        } catch {
          saldoInput.value = "⚠ Error";
        }
      }
  
      selectFuente.addEventListener("change", () => {
        if (!selectFuente.value) {
          inputLineaId.value     = "";;
          saldoInput.value       = "---";
          return;
        }
        const opt = selectFuente.options[selectFuente.selectedIndex];
        inputLineaId.value     = selectFuente.value;
        saldoInput.value       = `$${formatearImporte(parseFloat(opt.dataset.saldo || 0))}`;
        saldoInput.style.color = "#2e7d32";
        if (opt.dataset.codigo) opt.textContent = opt.dataset.codigo;
      });
  
      // ── Cascada PRG → PRY → A/O ─────────────────────────────────
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
            if (datos.proyecto_id) {
              selectPry.value = datos.proyecto_id;
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
            if (datos.actividad_id) {
              selectAo.value = datos.actividad_id;
              datos.actividad_id = null;
              selectAo.dispatchEvent(new Event("change"));
            }
          });
      });
  
      selectAo.addEventListener("change", resolverLineas);
      selectPar.addEventListener("change", resolverLineas);
  
      getProgramas().then(programas => {
        llenarSelectConCodigo(selectPrg, programas, "id",
          p => p.codigo_programa, p => `${p.codigo_programa} - ${p.nombre}`, "Seleccione");
        if (datos.programa_id) {
          selectPrg.value = datos.programa_id;
          selectPrg.dispatchEvent(new Event("change"));
        }
      });
  
      getPartidas().then(partidas => {
        llenarSelectConCodigo(selectPar, partidas, "id",
          p => p.codigo, p => `${p.codigo} - ${p.denominacion}`, "Seleccione");
        if (datos.partida_id) {
          selectPar.value = datos.partida_id;
          selectPar.dispatchEvent(new Event("change"));
        }
      });
  
      // ── Importe ──────────────────────────────────────────────────
      inputImporte.addEventListener("blur", () => {
        const v = parsearImporte(inputImporte.value);
        if (v !== null && inputImporte.value.trim() !== "") inputImporte.value = formatearImporte(v);
        onCambio();
      });
      inputImporte.addEventListener("input", onCambio);
  
      // ── Eliminar ─────────────────────────────────────────────────
      btnEliminar.addEventListener("click", () => {
        wrapper.remove();
        saldoEl.remove();
        importeWrapper.remove();
        onCambio();
      });
    }
  
    // ─── HELPERS ──────────────────────────────────────────────────────────────
    function limpiarContenedor(id) {
      const c = document.getElementById(id);
      if (c) c.innerHTML = "";
    }
  
    function obtenerFilas() {
      const filas    = document.querySelectorAll("#contenedor-receptoras .fila-receptora-refuerzo");
      const importes = document.querySelectorAll("#bloque-importes-receptoras .mf-importe-fila");
      const result   = [];
      filas.forEach((fila, i) => {
        const linea_id = fila.querySelector(".fila-linea-id").value.trim();
        const importe  = parsearImporte(importes[i]?.querySelector(".fila-importe")?.value) ?? 0;
        if (linea_id) result.push({ linea_id, importe });
      });
      return result;
    }
  
    function calcularTotalAsignado() {
      let total = 0;
      document.querySelectorAll("#bloque-importes-receptoras .fila-importe").forEach(inp => {
        total += parsearImporte(inp.value) ?? 0;
      });
      return total;
    }
  
    // ─── TOTAL Y VALIDACIÓN ───────────────────────────────────────────────────
    function actualizarTotal() {
      const totalAsignado = calcularTotalAsignado();
      const importeTotal  = parsearImporte(mImporteTotal.value) ?? 0;
  
      document.getElementById("total-asignado-refuerzo").textContent = formatearImporte(totalAsignado);
  
      const errorSpan    = document.getElementById("error-importe-refuerzo");
      const totalEl      = document.getElementById("total-asignado-refuerzo");
  
      if (importeTotal > 0 && totalAsignado > importeTotal) {
        errorSpan.style.display = "inline";
        totalEl.classList.add("error-total");
      } else {
        errorSpan.style.display = "none";
        totalEl.classList.remove("error-total");
      }
    }
  
    // ─── BOTÓN + ──────────────────────────────────────────────────────────────
    document.addEventListener("click", (e) => {
      if (e.target && e.target.id === "btn-agregar-receptora") {
        crearFila({}, actualizarTotal);
      }
    });
  
    // ─── VALIDAR ──────────────────────────────────────────────────────────────
    function limpiarErrores() {
      [mFecha, mImporteTotal, mExpediente, mUsuario].forEach(inp => inp && inp.classList.remove("error"));
      document.getElementById("error-importe-refuerzo").style.display = "none";
      document.getElementById("total-asignado-refuerzo").classList.remove("error-total");
    }
  
    function validar() {
      let ok = true;
      limpiarErrores();
      if (!mFecha.value)               { mFecha.classList.add("error");        ok = false; }
      if (!mImporteTotal.value.trim()) { mImporteTotal.classList.add("error"); ok = false; }
      if (!mExpediente.value.trim())   { mExpediente.classList.add("error");   ok = false; }
      if (!mUsuario.value.trim())      { mUsuario.classList.add("error");      ok = false; }
      if (obtenerFilas().length === 0) { ok = false; }
      const totalAsignado = calcularTotalAsignado();
      const importeTotal  = parsearImporte(mImporteTotal.value) ?? 0;
      if (importeTotal > 0 && totalAsignado > importeTotal) { ok = false; }
      return ok;
    }
  
    // ─── GUARDAR ──────────────────────────────────────────────────────────────
    if (btnGuardar) {
      btnGuardar.addEventListener("click", async () => {
        if (!validar()) return;
    
        const filas        = obtenerFilas();
        const importeTotal = parsearImporte(mImporteTotal.value) ?? 0;
    
        const body = {
          fecha:          mFecha.value,
          nro_expediente: mExpediente.value.trim() + "-GDESDE-APRH#MAMA",
          nro_decreto:    mDecreto.files[0] ? mDecreto.files[0].name : "",
          detalles:       filas.map(f => ({ linea_id: f.linea_id, importe: f.importe })),
        };
    
        try {
          btnGuardar.disabled = true;
          btnGuardar.querySelector(".mf-btn-texto").textContent = "Guardando...";
    
          const url = MODO === "editar"
            ? `/api/refuerzo/editar/${REFUERZO.id}/`
            : "/api/refuerzo/crear/";
    
          const res  = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) { alert(`Error: ${data.error}`); return; }
    
          window.location.href = "/admin-dashboard/registros/refuerzo";
    
        } catch (err) {
          alert("Error de conexión con el servidor");
          console.error(err);
        } finally {
          btnGuardar.disabled = false;
          btnGuardar.querySelector(".mf-btn-texto").textContent = "Guardar";
        }
      });
    }

    if (btnExportar) {
    btnExportar.addEventListener("click", () => generarPDFRefuerzo());
    }

    function generarPDFRefuerzo() {
        // ── Recolectar datos de receptoras ────────────────────────
        const wrappers = document.querySelectorAll("#contenedor-receptoras [data-fila-id]");
        const filas_r  = [];

        wrappers.forEach(wrapper => {
            const fila   = wrapper.querySelector(".fila-receptora-refuerzo");
            if (!fila) return;
            const filaId = wrapper.dataset.filaId;
            const importeEl = document.querySelector(
                `#bloque-importes-receptoras .mf-importe-fila[data-fila-id="${filaId}"] .fila-importe`
            );
            filas_r.push({
                jur:     "51",
                prg:     fila.querySelector(".fila-prg")?.value    || "—",
                sprg:    "00",
                pry:     fila.querySelector(".fila-pry")?.value    || "—",
                ao:      fila.querySelector(".fila-ao")?.value     || "—",
                par:     fila.querySelector(".fila-par")?.value    || "—",
                ff:      fila.querySelector(".fila-fuente")?.value || "—",
                importe: importeEl?.value || "—",
            });
        });

        // ── Datos adicionales ─────────────────────────────────────
        const fecha        = document.getElementById("m-fecha")?.value || "";
        const expediente   = document.getElementById("m-expediente")?.value || "";
        const usuario      = document.getElementById("m-usuario")?.value || "";
        const decreto      = document.getElementById("m-decreto-nombre")?.textContent || "";
        const importeTotal = document.getElementById("m-importe-total-refuerzo")?.value || "";
        const totalA       = document.getElementById("total-asignado-refuerzo")?.textContent || "";

        // ── Filas de tabla ────────────────────────────────────────
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

        // ── HTML del PDF ──────────────────────────────────────────
        const html = `<!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Refuerzo Presupuestario</title>
        <style>
            @page { size: A4 landscape; margin: 12mm 15mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1e293b; }

            .encabezado {
                display: flex;
                align-items: center;
                gap: 14px;
                border-bottom: 2px solid #1d2731;
                padding-bottom: 8px;
                margin-bottom: 10px;
            }
            .encabezado-titulo { font-size: 13pt; font-weight: 700; color: #1d2731; }
            .encabezado-sub    { font-size: 9pt; color: #475569; }

            h1 { font-size: 14pt; font-weight: 700; margin-bottom: 10px; color: #1d2731; }

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

            .importe-total-box {
                display: inline-block;
                background: #f0fdf4;
                border: 1px solid #86efac;
                border-radius: 4px;
                padding: 4px 12px;
                font-size: 10pt;
                font-weight: 700;
                color: #166534;
                margin-bottom: 10px;
            }

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

            .totales {
                display: flex;
                justify-content: flex-end;
                padding: 6px 12px;
                background: #f8fafc;
                border-top: 1px solid #dcdfe6;
            }
            .total-item { font-size: 8.5pt; font-weight: 700; color: #1d2731; }
            .total-item span { color: #2e7d32; margin-left: 8px; }

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

        <div class="encabezado">
            <div>
                <div class="encabezado-titulo">ADM. PCIAL. DE RECURSOS HÍDRICOS</div>
                <div class="encabezado-sub">Santiago del Estero</div>
            </div>
        </div>

        <h1>REFUERZO PRESUPUESTARIO</h1>

        <div class="card">
            <div class="card-header">Datos del Refuerzo</div>
            <div class="card-body">

                <div style="margin-bottom:8px; font-size:8pt; color:#475569;">
                    Importe Total del Refuerzo:
                    <span class="importe-total-box">$${importeTotal}</span>
                </div>

                <div class="card-header" style="background:#e8f0fe; color:#1d4ed8; margin: 0 -12px 8px; padding: 4px 12px;">
                    UNIDAD PRESUPUESTARIA RECEPTORA
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>JUR</th><th>PRG</th><th>SPRG</th>
                            <th>PRY</th><th>A/O</th><th>PAR</th><th>FF</th>
                            <th>IMPORTE ($)</th>
                        </tr>
                    </thead>
                    <tbody>${filasTabla(filas_r)}</tbody>
                </table>

            </div>
            <div class="totales">
                <div class="total-item">TOTAL ASIGNADO ($): <span>${totalA}</span></div>
            </div>
        </div>

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
                </div>
            </div>
        </div>

        <script>window.onload = () => { window.print(); }<\/script>
    </body>
    </html>`;

        const ventana = window.open("", "_blank", "width=1000,height=700");
        ventana.document.write(html);
        ventana.document.close();
    }
  
    // ─── INICIALIZAR ──────────────────────────────────────────────────────────
    mUsuario.value = typeof USUARIO_ACTUAL !== "undefined" ? USUARIO_ACTUAL : "";
    const hoy = new Date().toISOString().split("T")[0];
    mFecha.value = hoy;
    mFecha.max   = hoy;
  
    limpiarContenedor("contenedor-receptoras");
    limpiarContenedor("bloque-saldos-receptoras");
    limpiarContenedor("bloque-importes-receptoras");
  
    if ((MODO === "editar" || MODO === "ver") && REFUERZO) {
      mFecha.value        = REFUERZO.fecha || "";
      mFecha.max = new Date().toISOString().split("T")[0];
      const sufijo = "-GDESDE-APRH#MAMA";
      const expCompleto = REFUERZO.nro_expediente || "";
      mExpediente.value = expCompleto.endsWith(sufijo)
          ? expCompleto.slice(0, -sufijo.length)
          : expCompleto;
      mImporteTotal.value = REFUERZO.importe_total ? formatearImporte(parseFloat(REFUERZO.importe_total)) : "";
      document.getElementById("m-decreto-nombre").textContent =
        REFUERZO.nro_decreto || "Sin archivos seleccionados";
  
      (REFUERZO.receptoras || []).forEach(r =>
        crearFila({
          programa_id:  r.programa_id,
          proyecto_id:  r.proyecto_id,
          actividad_id: r.actividad_id,
          partida_id:   r.partida_id,
          fuente_id:    r.fuente_id,
          linea_id:     r.linea_id,
          importe:      r.importe,
        }, actualizarTotal)
      );
    } else {
      crearFila({}, actualizarTotal);
    }
  
    actualizarTotal();
  });