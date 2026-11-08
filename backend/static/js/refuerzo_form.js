/**
 * refuerzo_form.js
 * Formulario standalone de Refuerzo (crear y editar).
 * - Filas dinámicas para Receptora con cascada JUR/PRG/SPRG/PRY/A/O/PAR
 * - Saldo actual en columna central
 * - Total asignado + validación vs importe total del refuerzo
 * - Guardado automático en la BD como borrador (estado Revisar), sin tocar saldos
 * - "Guardar como completado": confirmación + validación en el servidor → estado Listo
 * - Al abrir un borrador (editar) se vuelve a cargar todo lo guardado
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
  const btnCompletar  = document.getElementById("btn-completar");
  const btnExportar   = document.getElementById("btn-exportar");

  let decretoNombre = "";   // el sistema guarda el nombre del archivo, no el PDF
  mDecreto.addEventListener("change", () => {
    const archivo = mDecreto.files[0];
    decretoNombre = archivo ? archivo.name : "";
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
          selectFuente.innerHTML = `<option value="${linea.linea_id}" data-fuente-id="${linea.fuente_id ?? ""}">${linea.fuente_nombre.split(" - ")[0]}</option>`;
          selectFuente.disabled = false;

        } else {
          selectFuente.innerHTML = `<option value="">Elegir FF</option>`;
          selectFuente.disabled = false; // NUEVA LÍNEA: habilita el selector
          
          data.lineas.forEach(l => {
            const opt = document.createElement("option");
            opt.value          = l.linea_id;
            opt.dataset.saldo  = l.saldo_actual;
            opt.dataset.fuenteId = l.fuente_id ?? "";
            opt.dataset.label  = l.fuente_nombre;
            opt.dataset.codigo = l.fuente_nombre.split(" - ")[0];
            
            // LA LÍNEA MÁGICA: Le asigna SOLO el número de código, sin el saldo
            opt.textContent    = opt.dataset.codigo;
            
            selectFuente.appendChild(opt);
          });

          if (datos.linea_id || datos.fuente_id) {
            // Primero por la línea guardada; si no, por la fuente de financiamiento
            let optFuente = datos.linea_id
              ? Array.from(selectFuente.options).find(o => String(o.value) === String(datos.linea_id))
              : null;
            if (!optFuente && datos.fuente_id) {
              optFuente = Array.from(selectFuente.options).find(o =>
                data.lineas.find(l => l.linea_id == o.value && l.fuente_id == datos.fuente_id)
              );
            }
            if (optFuente) {
              selectFuente.value = optFuente.value;
              selectFuente.dispatchEvent(new Event("change"));
            }
            // Se usan una sola vez: si después el usuario cambia la partida, no se reaplican
            datos.linea_id  = null;
            datos.fuente_id = null;
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
            datos.proyecto_id = null;
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

    // Al terminar de resolver la línea hay datos nuevos para el guardado automático
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

  // ═════════════════════════════════════════════════════════════════════════
  //  GUARDADO AUTOMÁTICO (borrador "Revisar") + GUARDAR COMO COMPLETADO
  // ═════════════════════════════════════════════════════════════════════════
  // Mientras se completa el formulario, los datos se guardan solos en la BD como
  // borrador (estado Revisar). Un borrador es solo información: no modifica saldos.
  // Recién "Guardar como completado" (confirmado y validado en el servidor) lo pasa
  // a Listo y genera los movimientos presupuestarios.
  const esModoVer          = (MODO === "ver");
  const SUFIJO_EXPEDIENTE  = "-GDESDE-APRH#MAMA";
  const AUTOSAVE_MS        = 1500;   // pausa al escribir (debounce)
  const AUTOSAVE_CAMBIO_MS = 400;    // al cambiar un select, salir de un campo, agregar o quitar filas
  const REDIRECCION_FINAL  = "/admin-dashboard/registros/refuerzo";
  const indicadorAutosave  = document.getElementById("autosave-estado");
  const cajaMensaje        = document.getElementById("mf-mensaje");
  const modalCompletar     = document.getElementById("modal-completar");

  let refuerzoId          = null;   // id del borrador en la BD (null hasta el primer guardado)
  let version             = null;   // token de versión que devuelve el servidor en cada guardado
  let ultimaInstantanea   = null;   // JSON de lo último que el servidor confirmó haber guardado
  let autosaveTimer       = null;
  let colaGuardado        = Promise.resolve(true);   // serializa los guardados: nunca hay dos en paralelo
  let guardandoEnCurso    = false;
  let ultimoGuardadoFallo = false;
  let reintentos          = 0;
  let restaurando         = false;  // true mientras se vuelve a cargar un borrador existente
  let completando         = false;
  let completado          = false;
  let autosaveBloqueado   = false;  // conflicto, borrador no restaurado, etc.: no se guarda nada más
  let lineasResolviendo   = 0;      // consultas de línea presupuestaria en curso

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
    [mFecha, mImporteTotal, mExpediente, mUsuario].forEach(inp => inp && inp.classList.remove("error"));
    document.getElementById("error-importe-refuerzo").style.display = "none";
    document.getElementById("total-asignado-refuerzo").classList.remove("error-total");
  }

  // ─── Payload (acepta datos parciales) ─────────────────────────────────────
  function construirPayload() {
    const detalles = [];

    document.querySelectorAll("#contenedor-receptoras .fila-receptora-refuerzo").forEach(fila => {
      const filaId    = fila.dataset.filaId;
      const importeEl = document.querySelector(
        `#bloque-importes-receptoras .mf-importe-fila[data-fila-id="${filaId}"] .fila-importe`
      );
      const optFuente = fila.querySelector(".fila-fuente")?.selectedOptions[0];

      const f = {
        programa_id:  aNum(fila.querySelector(".fila-prg")?.value),
        proyecto_id:  aNum(fila.querySelector(".fila-pry")?.value),
        actividad_id: aNum(fila.querySelector(".fila-ao")?.value),
        partida_id:   aNum(fila.querySelector(".fila-par")?.value),
        fuente_id:    aNum(optFuente?.dataset.fuenteId),
        linea_id:     aNum(fila.querySelector(".fila-linea-id")?.value),
        importe:      importeOpcional(importeEl?.value),
      };

      // Una fila totalmente vacía (por ejemplo, un "+" sin usar) no se guarda
      const vacia = !f.programa_id && !f.proyecto_id && !f.actividad_id && !f.partida_id
                 && !f.fuente_id && !f.linea_id && f.importe === null;
      if (!vacia) detalles.push(f);
    });

    const expediente = mExpediente.value.trim();
    return {
      fecha:          mFecha.value || "",
      nro_expediente: expediente ? expediente + SUFIJO_EXPEDIENTE : "",
      nro_decreto:    decretoNombre,
      importe_total:  importeOpcional(mImporteTotal.value),
      detalles,
    };
  }

  function borradorVacio(p) {
    return !p.nro_expediente && !p.nro_decreto && !(p.importe_total > 0) && p.detalles.length === 0;
  }

  // ─── Guardado (crea la primera vez, actualiza después) ────────────────────
  async function ejecutarGuardado() {
    if (autosaveBloqueado || completado) return true;

    const payload     = construirPayload();
    const instantanea = JSON.stringify(payload);

    // No crear un borrador vacío solo por abrir el formulario
    if (!refuerzoId && borradorVacio(payload)) return true;
    // Nada nuevo respecto de lo que el servidor ya tiene
    if (refuerzoId && instantanea === ultimaInstantanea) return true;

    guardandoEnCurso = true;
    setEstadoAutosave("guardando");
    try {
      const url  = refuerzoId
        ? `/api/refuerzo/borrador/${refuerzoId}/actualizar/`
        : "/api/refuerzo/borrador/crear/";
      const body = refuerzoId ? { ...payload, version } : payload;

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

      if (!refuerzoId && data.refuerzo_id) {
        refuerzoId = data.refuerzo_id;
        // Si se recarga la página, vuelve este mismo borrador (y no un formulario vacío)
        history.replaceState(null, "", `/refuerzo/editar/${refuerzoId}/`);
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
    if (esModoVer || restaurando || completando || completado || autosaveBloqueado) return;
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

  // La línea presupuestaria se resuelve de forma asíncrona después de elegir la fila:
  // cuando termina hay datos nuevos para guardar.
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

  // ─── Disparadores del guardado ────────────────────────────────────────────
  // Solo cuentan los eventos reales del usuario (isTrusted): los "change" que el propio
  // código dispara al volver a cargar un borrador no deben provocar guardados.
  if (!esModoVer) {
    const pagina   = document.querySelector(".mf-pagina");
    const esCampo  = (el) => el && el.matches && el.matches("input, select, textarea");

    pagina.addEventListener("input", (e) => {
      if (e.isTrusted && esCampo(e.target)) programarAutoguardado(AUTOSAVE_MS);
    });
    ["change", "focusout"].forEach(tipo => pagina.addEventListener(tipo, (e) => {
      if (e.isTrusted && esCampo(e.target)) programarAutoguardado(AUTOSAVE_CAMBIO_MS);
    }));
    pagina.addEventListener("click", (e) => {
      if (e.isTrusted && e.target.closest && e.target.closest("#btn-agregar-receptora, .btn-eliminar-fila")) {
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

    if (!p.fecha)          { mFecha.classList.add("error");        errores.push("Falta la fecha."); }
    if (!p.nro_expediente) { mExpediente.classList.add("error");   errores.push("Falta el N° de expediente."); }
    if (!(p.importe_total > 0)) {
      mImporteTotal.classList.add("error");
      errores.push("Falta el importe total del refuerzo (debe ser mayor a cero).");
    }
    if (!p.nro_decreto)    { errores.push("Falta seleccionar el decreto / resolución."); }
    if (p.detalles.length === 0) { errores.push("Cargá al menos una unidad presupuestaria receptora."); }

    const filaDeLinea = new Map();
    let total = 0;
    p.detalles.forEach((d, i) => {
      const n = i + 1;
      if (!d.linea_id) {
        errores.push(`Fila ${n}: falta completar la línea presupuestaria (programa, proyecto, actividad, partida y fuente).`);
      } else if (filaDeLinea.has(d.linea_id)) {
        errores.push(`Fila ${n}: la línea presupuestaria está repetida (ya figura en la fila ${filaDeLinea.get(d.linea_id)}).`);
      } else {
        filaDeLinea.set(d.linea_id, n);
      }
      if (!(d.importe > 0)) errores.push(`Fila ${n}: el importe debe ser mayor a cero.`);
      total += d.importe || 0;
    });

    if (p.importe_total > 0 && aCentavos(total) > aCentavos(p.importe_total)) {
      document.getElementById("error-importe-refuerzo").style.display = "inline";
      document.getElementById("total-asignado-refuerzo").classList.add("error-total");
      errores.push(
        `El total asignado ($ ${formatearImporte(total)}) supera el importe total del refuerzo ($ ${formatearImporte(p.importe_total)}).`
      );
    }
    return errores;
  }

  // ─── Guardar como completado ──────────────────────────────────────────────
  async function pedirCompletar() {
    if (esModoVer || completando || completado || autosaveBloqueado || restaurando) return;
    ocultarMensaje();
    limpiarErrores();
    actualizarTotal();

    const errores = validarParaCompletar();
    if (errores.length) {
      mostrarMensaje("Todavía no se puede completar. Revisá lo siguiente:\n• " + errores.join("\n• "), "error");
      return;
    }

    // El servidor tiene que tener exactamente lo que se ve en pantalla
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
    const ok = await guardarBorrador();
    if (!ok || !refuerzoId) {
      mostrarMensaje("No se pudieron guardar los últimos cambios en el servidor. Reintentá antes de completar.", "error");
      return;
    }

    if (modalCompletar && typeof modalCompletar.showModal === "function") {
      modalCompletar.showModal();
    } else if (confirm("¿Está seguro de que desea guardar este Refuerzo como completado?")) {
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
      const resp = await fetch(`/api/refuerzo/${refuerzoId}/completar/`, {
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
            ? "Respuesta inesperada del servidor (¿se cerró la sesión?). El Refuerzo NO se completó: revisá su estado en el historial de registros."
            : "No se pudo completar el Refuerzo."),
          "error"
        );
        return;
      }

      completado          = true;
      ultimoGuardadoFallo = false;
      setEstadoAutosave("");
      bloquearFormularioCompletado();
      mostrarMensaje(
        `Refuerzo guardado como completado (estado Listo). Total: $ ${formatearImporte(data.importe_total)}`,
        "exito"
      );
      setTimeout(() => { window.location.href = REDIRECCION_FINAL; }, 1800);

    } catch (err) {
      console.error(err);
      if (modalCompletar && modalCompletar.open) modalCompletar.close();
      mostrarMensaje(
        "Error de red: el Refuerzo NO se completó. Revisá su estado en el historial de registros antes de reintentar.",
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
    const btnAgregarR = document.getElementById("btn-agregar-receptora");
    if (btnAgregarR) btnAgregarR.style.display = "none";
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
      card.inert              = bloquear;
      card.style.pointerEvents = bloquear ? "none" : "";
      card.style.opacity       = bloquear ? "0.6" : "";
    });
  }

  // ¿La fila ya muestra lo que el servidor tenía guardado?
  function filaRestaurada(fila, esperado) {
    const coincide = (selector, id) => !id || (fila.querySelector(selector)?.value || "") === String(id);
    return coincide(".fila-prg",      esperado.programa_id)
        && coincide(".fila-pry",      esperado.proyecto_id)
        && coincide(".fila-ao",       esperado.actividad_id)
        && coincide(".fila-par",      esperado.partida_id)
        && coincide(".fila-linea-id", esperado.linea_id);
  }

  // La cascada de selects se rearma con varias consultas encadenadas. Hasta que termina,
  // el formulario queda bloqueado y NO se guarda nada: un guardado a mitad de la carga
  // pisaría con datos incompletos lo que ya estaba guardado.
  async function restaurarBorrador(datos) {
    restaurando = true;
    bloquearEdicion(true);
    if (btnCompletar) btnCompletar.disabled = true;
    setEstadoAutosave("guardando", "Cargando borrador…", true);

    const filas     = Array.from(document.querySelectorAll("#contenedor-receptoras .fila-receptora-refuerzo"));
    const esperados = datos.receptoras || [];
    const ok = await esperarCondicion(
      () => lineasResolviendo === 0 && esperados.every((e, i) => filas[i] && filaRestaurada(filas[i], e)),
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
    const sufijo = SUFIJO_EXPEDIENTE;
    const expCompleto = REFUERZO.nro_expediente || "";
    mExpediente.value = expCompleto.endsWith(sufijo)
        ? expCompleto.slice(0, -sufijo.length)
        : expCompleto;
    mImporteTotal.value = REFUERZO.importe_total ? formatearImporte(parseFloat(REFUERZO.importe_total)) : "";
    decretoNombre = REFUERZO.nro_decreto || "";
    document.getElementById("m-decreto-nombre").textContent =
      decretoNombre || "Sin archivos seleccionados";

    const receptoras = REFUERZO.receptoras || [];
    receptoras.forEach(r =>
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
    // Un borrador sin filas guardadas igual necesita una fila para seguir completándolo
    if (receptoras.length === 0) crearFila({}, actualizarTotal);

    if (MODO === "editar") {
      refuerzoId = REFUERZO.id;
      version    = REFUERZO.version;
      restaurarBorrador(REFUERZO);
    }
  } else {
    crearFila({}, actualizarTotal);
  }

  actualizarTotal();
});