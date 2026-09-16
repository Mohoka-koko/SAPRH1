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
      inputImporte.required    = true;
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

    function validarFilas() {
      const filas = document.querySelectorAll("#contenedor-receptoras .fila-receptora-refuerzo");
      const importes = document.querySelectorAll("#bloque-importes-receptoras .mf-importe-fila");
      let valido = filas.length > 0;

      filas.forEach((fila, i) => {
        const lineaId = fila.querySelector(".fila-linea-id")?.value.trim();
        const input = importes[i]?.querySelector(".fila-importe");
        const importe = parsearImporte(input?.value);
        const filaValida = Boolean(lineaId) && importe !== null && importe > 0;
        if (input) input.classList.toggle("error", !filaValida);
        if (!filaValida) valido = false;
      });

      return valido;
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
      const importeTotal  = parsearImporte(mImporteTotal.value);
  
      document.getElementById("total-asignado-refuerzo").textContent = formatearImporte(totalAsignado);
  
      const errorSpan    = document.getElementById("error-importe-refuerzo");
      const totalEl      = document.getElementById("total-asignado-refuerzo");
  
      if (importeTotal !== null && totalAsignado > importeTotal) {
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
      document.querySelectorAll(".fila-importe").forEach(inp => inp.classList.remove("error"));
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
      const importeTotal = parsearImporte(mImporteTotal.value);
      const totalAsignado = calcularTotalAsignado();
      if (importeTotal === null || importeTotal <= 0) {
        mImporteTotal.classList.add("error");
        ok = false;
      }
      if (!validarFilas()) {
        alert("Cada línea debe tener una unidad presupuestaria y un importe numérico mayor que cero.");
        ok = false;
      }
      if (importeTotal !== null && totalAsignado > importeTotal) {
        alert("El total asignado no puede superar el importe total del refuerzo.");
        ok = false;
      }
      if (MODO !== "editar" && !mDecreto.files[0]) {
        alert("Seleccioná el decreto o la resolución antes de guardar.");
        ok = false;
      }
      return ok;
    }
  
    // ─── GUARDAR ──────────────────────────────────────────────────────────────
    btnGuardar.addEventListener("click", async () => {
      if (!validar()) return;
  
      const filas        = obtenerFilas();
      const importeTotal = parsearImporte(mImporteTotal.value) ?? 0;
  
      const body = {
        fecha:          mFecha.value,
        nro_expediente: mExpediente.value.trim(),
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
  
    if (btnExportar) {
      btnExportar.addEventListener("click", () => alert("Exportación a PDF — próximamente."));
    }
  
    // ─── INICIALIZAR ──────────────────────────────────────────────────────────
    mUsuario.value = typeof USUARIO_ACTUAL !== "undefined" ? USUARIO_ACTUAL : "";
    const hoy = new Date().toISOString().split("T")[0];
    mFecha.value = hoy;
    mFecha.max   = hoy;
  
    limpiarContenedor("contenedor-receptoras");
    limpiarContenedor("bloque-saldos-receptoras");
    limpiarContenedor("bloque-importes-receptoras");
  
    if (MODO === "editar" && REFUERZO) {
      mFecha.value        = REFUERZO.fecha || "";
      mFecha.max = new Date().toISOString().split("T")[0];
      mExpediente.value   = REFUERZO.nro_expediente || "";
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