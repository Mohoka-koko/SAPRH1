// =========================================================
// DATOS
// =========================================================

// Se cargan de forma asíncrona desde la BD (ver fetchLineasPresupuestarias).
let programsData = [];
let resumenData = { presupuestoInicial: 0, presupuestoModificado: 0, aumentoPct: 0, fechaUltimaModificacion: null };

// Se carga de forma asíncrona desde la BD (ver fetchLineasPresupuestarias).
// Cada elemento representa una línea presupuestaria (unidad presupuestaria) real.
let movementsData = [];

// =========================================================
// ESTADO
// =========================================================

let currentSort = { key: null, direction: "asc" };
let currentSearch = "";
let currentPrograma = "todos";
const PAGE_SIZE = 4;
let currentPage = 1;

// FECHASSS
// =========================================================
// ALERTA DE PRESUPUESTO (versión con depuración)
// Reemplaza la función setupBudgetAlert() completa en home.js
// =========================================================
async function setupBudgetAlert() {
  const LOG = "[ALERTA PRESUPUESTO]";
  console.group(LOG);
  console.log("Versión de home.js cargada: debug-v2 (si no ves este log, el navegador usa un JS viejo en caché)");

  try {
    // ---------- 1. Elementos del DOM ----------
    const alertBox = document.getElementById("budgetAlert");
    const button = document.getElementById("loadBudgetButton");
    const displayedYearEl = document.getElementById("displayedExerciseYear");
    const requiredYearEl = document.getElementById("requiredBudgetYear");

    console.log("Elementos DOM:", {
      budgetAlert: alertBox,
      loadBudgetButton: button,
      displayedExerciseYear: displayedYearEl,
      requiredBudgetYear: requiredYearEl,
    });

    if (!alertBox || !button) {
      console.error("FALTA budgetAlert o loadBudgetButton en home.html: revisá los id. Se corta acá.");
      return;
    }

    // ---------- 2. Fechas ----------
    const now = new Date();
    const anioEnCurso = now.getFullYear();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(anioEnCurso, 0, 1); // 1 de enero del año en curso

    console.log("Fecha del navegador (now):", now.toString());
    console.log("anioEnCurso:", anioEnCurso, "| today:", today.toISOString(), "| startDate:", startDate.toISOString());

    if (today < startDate) {
      console.warn("Todavía no llegó el 1 de enero: no se muestra la alerta.");
      return;
    }

    const displayedExerciseYear = anioEnCurso - 1;
    const requiredBudgetYear = anioEnCurso;
    const storageKey = `budget-creation-started-${requiredBudgetYear}`;
    const finalizedStorageKey = `budget-creation-finalized-${requiredBudgetYear}`;

    console.log("Años:", { displayedExerciseYear, requiredBudgetYear });
    console.log("localStorage:", {
      origen: window.location.origin, // localhost y 127.0.0.1 tienen localStorage distinto
      [storageKey]: localStorage.getItem(storageKey),
      [finalizedStorageKey]: localStorage.getItem(finalizedStorageKey),
    });

    // ---------- Helper: mostrar el cartel ----------
    const showAlert = (motivo) => {
      console.log("MOSTRANDO ALERTA. Motivo:", motivo);
      if (displayedYearEl) displayedYearEl.textContent = displayedExerciseYear;
      if (requiredYearEl) requiredYearEl.textContent = requiredBudgetYear;

      alertBox.hidden = false;
      alertBox.removeAttribute("hidden");

      const hasStarted = localStorage.getItem(storageKey) === "true";
      button.textContent = hasStarted
        ? `CONTINUAR CARGANDO PRESUPUESTO ${requiredBudgetYear}`
        : `CREAR PRESUPUESTO ${requiredBudgetYear}`;

      button.onclick = () => {
        localStorage.setItem(storageKey, "true");
        window.location.href = "/seleccion-ejercicio/";
      };

      // Verificamos que el CSS no lo esté ocultando igual
      const cs = window.getComputedStyle(alertBox);
      console.log("Estado visual del cartel:", {
        hidden: alertBox.hidden,
        display: cs.display,
        visibility: cs.visibility,
        alto: alertBox.offsetHeight,
      });
      if (cs.display === "none" || alertBox.offsetHeight === 0) {
        console.error("El cartel está en el DOM pero el CSS lo oculta (display:none / alto 0). Revisá .budget-alert en el CSS.");
      }
    };

    // ---------- 3. Consulta al backend (la BD manda, no el localStorage) ----------
    const url = `/api/home/lineas/?ejercicio=${requiredBudgetYear}`;
    console.log("Consultando:", url);

    let data;
    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
        cache: "no-store",
      });

      console.log("Respuesta HTTP:", {
        status: resp.status,
        ok: resp.ok,
        redirected: resp.redirected,
        urlFinal: resp.url,
        contentType: resp.headers.get("content-type"),
      });

      const rawText = await resp.text();
      console.log("Primeros 300 caracteres de la respuesta:", rawText.slice(0, 300));

      if (!resp.ok) throw new Error(`El backend respondió ${resp.status}`);
      data = JSON.parse(rawText); // si es HTML (login, 404) lanza error y va al catch
    } catch (fetchErr) {
      console.error("Falló la consulta al backend:", fetchErr);
      showAlert("error al consultar el backend");
      return;
    }

    // ---------- 4. Interpretar la respuesta ----------
    const cantidadLineas = Array.isArray(data.lineas) ? data.lineas.length : 0;
    const ejercicioDevuelto = Number(data.ejercicio);
    const backendRespetaEjercicio = ejercicioDevuelto === requiredBudgetYear;

    console.log("Datos recibidos:", {
      ejercicioPedido: requiredBudgetYear,
      ejercicioDevuelto: data.ejercicio,
      cantidadLineas,
      backendRespetaEjercicio,
    });

    if (!backendRespetaEjercicio) {
      console.warn(
        `El backend devolvió datos del ejercicio ${data.ejercicio} aunque se pidió ${requiredBudgetYear}. ` +
        "Probablemente la vista Django ignora ?ejercicio= o hace fallback al último ejercicio con datos."
      );
    }

    // Presupuesto cargado SOLO si hay líneas Y son del año requerido
    const existePresupuesto = cantidadLineas > 0 && backendRespetaEjercicio;

    if (existePresupuesto) {
      console.log(`Ya existe presupuesto ${requiredBudgetYear}: no se muestra la alerta.`);
      return;
    }

    if (localStorage.getItem(finalizedStorageKey) === "true") {
      console.warn(
        `La marca "${finalizedStorageKey}" está en true pero la BD NO tiene líneas de ${requiredBudgetYear}. ` +
        "Se ignora (la BD es la fuente de verdad)."
      );
    }

    showAlert(`no hay líneas del ejercicio ${requiredBudgetYear} en la BD`);
  } catch (err) {
    console.error("Error inesperado en setupBudgetAlert:", err);
  } finally {
    console.groupEnd();
  }
}

// =========================================================
// CARGA DE DATOS DESDE LA BD
// =========================================================

async function fetchLineasPresupuestarias() {
  try {
    const response = await fetch("/api/home/lineas/", {
      method: "GET",
      headers: { "X-Requested-With": "XMLHttpRequest" },
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status} al obtener las líneas presupuestarias`);
    }

    const data = await response.json();

    movementsData = (data.lineas || []).map((l) => ({
      ...l,
      saldoInicial: parseFloat(l.saldoInicial),
      saldoModificado: parseFloat(l.saldoModificado),
    }));

    programsData = (data.programas || []).map((p) => ({
      codigo: p.codigo,
      nombre: p.nombre,
      monto: parseFloat(p.monto),
      porcentaje: p.porcentaje,
    }));

    if (data.resumen) {
      resumenData = {
        presupuestoInicial: parseFloat(data.resumen.presupuestoInicial),
        presupuestoModificado: parseFloat(data.resumen.presupuestoModificado),
        aumentoPct: data.resumen.aumentoPct,
        fechaUltimaModificacion: data.resumen.fechaUltimaModificacion,
      };
    }
  } catch (err) {
    console.error(err);
    movementsData = [];
    programsData = [];
  }
}

// Cache de movimientos por línea presupuestaria: linea_id -> array de
// movimientos, o undefined mientras todavía no se pidieron.
const movimientosCache = {};

async function fetchMovimientosLinea(lineaId) {
  try {
    const response = await fetch(`/api/home/lineas/${lineaId}/movimientos/`, {
      method: "GET",
      headers: { "X-Requested-With": "XMLHttpRequest" },
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status} al obtener los movimientos de la línea`);
    }

    const data = await response.json();
    movimientosCache[lineaId] = data.movimientos || [];
  } catch (err) {
    console.error(err);
    movimientosCache[lineaId] = [];
  }
}

// =========================================================
// UTILIDADES DE FORMATO
// =========================================================

function formatCurrency(value) {
  return "$" + value.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatCurrencyDetailed(value) {
  return "$ " + value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function calcularVariacion(movimiento) {
  return movimiento.saldoModificado - movimiento.saldoInicial;
}

function calcularVariacionPorcentual(movimiento) {
  if (movimiento.saldoInicial === 0) return 0;
  return (calcularVariacion(movimiento) / movimiento.saldoInicial) * 100;
}

// =========================================================
// RENDER: TARJETAS DE PROGRAMAS
// =========================================================

function renderPrograms() {
  const grid = document.getElementById("programsGrid");
  if (!grid) return;

  grid.innerHTML = "";

  programsData.forEach((programa) => {
    const card = document.createElement("div");
    card.className = "program-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute(
      "aria-label",
      `Programa ${programa.codigo}: ${programa.nombre}, ${programa.porcentaje}% ejecutado`
    );

    card.innerHTML = `
      <div>
        <p class="program-name">${programa.codigo}: ${programa.nombre}</p>
        <p class="program-amount">${formatCurrency(programa.monto)}</p>
      </div>
      <div class="program-progress-row">
        <div class="program-progress-track">
          <div class="program-progress-fill" style="width: ${programa.porcentaje}%"></div>
        </div>
        <span class="program-percent">${programa.porcentaje}%</span>
      </div>
    `;

    card.addEventListener("click", () => onProgramCardClick(programa));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onProgramCardClick(programa);
      }
    });

    grid.appendChild(card);
  });

  window.requestAnimationFrame(() => updateProgramsNavigation());
}

function updateProgramsNavigation() {
  const grid = document.getElementById("programsGrid");
  const prevBtn = document.getElementById("programsPrevBtn");
  const nextBtn = document.getElementById("programsNextBtn");

  if (!grid || !prevBtn || !nextBtn) return;

  const canScroll = grid.scrollWidth > grid.clientWidth + 1;
  prevBtn.hidden = !canScroll;
  nextBtn.hidden = !canScroll;

  const maxScrollLeft = grid.scrollWidth - grid.clientWidth;
  prevBtn.disabled = grid.scrollLeft <= 2;
  nextBtn.disabled = grid.scrollLeft >= maxScrollLeft - 2;
}

function setupProgramsNavigation() {
  const grid = document.getElementById("programsGrid");
  const prevBtn = document.getElementById("programsPrevBtn");
  const nextBtn = document.getElementById("programsNextBtn");

  if (!grid || !prevBtn || !nextBtn) return;

  const getScrollStep = () => {
    const firstCard = grid.querySelector(".program-card");
    if (!firstCard) return 220;
    return firstCard.getBoundingClientRect().width + 16;
  };

  prevBtn.addEventListener("click", () => {
    grid.scrollBy({ left: -getScrollStep(), behavior: "smooth" });
  });

  nextBtn.addEventListener("click", () => {
    grid.scrollBy({ left: getScrollStep(), behavior: "smooth" });
  });

  grid.addEventListener("scroll", updateProgramsNavigation);
  window.addEventListener("resize", updateProgramsNavigation);
  updateProgramsNavigation();
}

function onProgramCardClick(programa) {
  // Filtra la tabla de unidades por el programa seleccionado
  const filterSelect = document.getElementById("filterPrograma");
  filterSelect.value = programa.codigo;
  currentPrograma = programa.codigo;
  applyFilters();
}

// =========================================================
// RENDER: TARJETAS DE RESUMEN (PRESUPUESTO INICIAL / MODIFICADO)
// =========================================================

function renderResumenCards() {
  const inicialEl = document.getElementById("presupuestoInicialValue");
  const modificadoEl = document.getElementById("presupuestoModificadoValue");
  const aumentoEl = document.getElementById("aumentoPctValue");
  const fechaModificadoEl = document.getElementById("fechaUltimaModificacionValue");

  if (inicialEl) {
    inicialEl.textContent = formatCurrencyDetailed(resumenData.presupuestoInicial);
  }
  if (modificadoEl) {
    modificadoEl.textContent = formatCurrencyDetailed(resumenData.presupuestoModificado);
  }
  if (aumentoEl) {
    const signo = resumenData.aumentoPct >= 0 ? "+" : "";
    aumentoEl.textContent = `${signo}${resumenData.aumentoPct}%`;
  }
  if (fechaModificadoEl) {
    fechaModificadoEl.textContent = resumenData.fechaUltimaModificacion || "Sin modificaciones";
  }
}

// =========================================================
// POBLAR SELECT DE PROGRAMAS
// =========================================================

function populateProgramFilter() {
  const select = document.getElementById("filterPrograma");
  programsData.forEach((programa) => {
    const option = document.createElement("option");
    option.value = programa.codigo;
    option.textContent = `${programa.codigo} - ${programa.nombre}`;
    select.appendChild(option);
  });
}

// =========================================================
// RENDER: TABLA DE MOVIMIENTOS
// =========================================================

let expandedRows = new Set();

function getFilteredMovements() {
  let result = movementsData.map((m, index) => ({ ...m, _id: index }));

  if (currentSearch.trim() !== "") {
    const term = currentSearch.trim().toLowerCase();
    result = result.filter(
      (m) =>
        m.denominacion.toLowerCase().includes(term) ||
        m.partida.toLowerCase().includes(term)
    );
  }

  if (currentPrograma !== "todos") {
    result = result.filter((m) => m.programa === currentPrograma);
  }

  if (currentSort.key) {
    result.sort((a, b) => {
      const dir = currentSort.direction === "asc" ? 1 : -1;
      const valA = a[currentSort.key];
      const valB = b[currentSort.key];
      if (typeof valA === "number" && typeof valB === "number") {
        return (valA - valB) * dir;
      }
      return String(valA).localeCompare(String(valB)) * dir;
    });
  }

  return result;
}

function chevronIcon() {
  return `<svg viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function getTipoConfig(tipo) {
  switch (tipo) {
    case "Imputación":
      return { className: "tipo-imputacion", badgeClass: "tipo-badge-imputacion" };
    case "O. P.":
      return { className: "tipo-op", badgeClass: "tipo-badge-op" };
    case "O. P. Personal":
      return { className: "tipo-op-personal", badgeClass: "tipo-badge-op-personal" };
    case "Refuerzo":
      return { className: "tipo-refuerzo", badgeClass: "tipo-badge-refuerzo" };
    case "Modificación":
    case "Modificación Transferente":
    case "Modificación Transferente Modo B":
    case "Modificación Receptora":
      return { className: "tipo-modificacion", badgeClass: "tipo-badge-modificacion" };
    default:
      return { className: "tipo-imputacion", badgeClass: "tipo-badge-imputacion" };
  }
}

function getMovimientoImporte(movimiento) {
  return Number(movimiento.importe ?? calcularVariacion(movimiento));
}

function renderMovimientoDetalle(item, numeroLabel) {
  const importe = Number(item.importe);
  const importeClass = importe >= 0 ? "importe-positiva" : "importe-negativa";
  const tipoConfig = getTipoConfig(item.tipo);

  return `
    <div class="detail-grid">
      <div class="detail-item">
        <span class="detail-label">Tipo</span>
        <span class="detail-value detail-badge ${tipoConfig.badgeClass}">${item.tipo}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Fecha de creación</span>
        <span class="detail-value">${item.fechaCreacion || "--/--/----"}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">${numeroLabel}</span>
        <span class="detail-value">${item.numeroExpediente || "S/N"}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Usuario</span>
        <span class="detail-value">${item.usuario || "No asignado"}</span>
      </div>
      ${item.decretoResolucion ? `
        <div class="detail-item">
          <span class="detail-label">Decreto/Resolución</span>
          <span class="detail-value">${item.decretoResolucion}</span>
        </div>
      ` : ""}
      <div class="detail-item">
        <span class="detail-label">Importe</span>
        <span class="detail-value ${importeClass}">${importe >= 0 ? "+" : ""}${formatCurrencyDetailed(importe)}</span>
      </div>
    </div>
  `;
}

function renderMovimientoItem(mov) {
  const tipoConfig   = getTipoConfig(mov.tipo);
  const esImputacion = mov.tipo.startsWith("Imputación");
  const ordenesPago  = mov.ordenesPago || [];
  const modsModoB    = mov.modificacionesModoB || [];

  const subMovimientos = [...ordenesPago, ...modsModoB];

  return `
    <div class="detail-movimiento ${tipoConfig.className}">
      ${renderMovimientoDetalle(mov, esImputacion ? "N° de Expediente" : "N° de Expediente / Orden")}
      ${subMovimientos.length > 0 ? `
        <div class="detail-ordenes-pago">
          ${subMovimientos.map((sub) => `
            <div class="detail-movimiento detail-movimiento-op ${getTipoConfig(sub.tipo).className}">
              ${renderMovimientoDetalle(sub, sub.tipo.startsWith("O.") ? "N° de Orden de Pago" : "N° de Expediente")}
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderUnitsTable() {
  const tbody = document.getElementById("unitsTableBody");
  const noResults = document.getElementById("noResults");
  const movements = getFilteredMovements();
  const totalPages = Math.max(1, Math.ceil(movements.length / PAGE_SIZE));

  currentPage = Math.min(currentPage, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageMovements = movements.slice(startIndex, startIndex + PAGE_SIZE);

  tbody.innerHTML = "";

  if (movements.length === 0) {
    noResults.hidden = false;
    updatePagination(0, 0, 0, 0);
    return;
  }
  noResults.hidden = true;

  pageMovements.forEach((m) => {
    const isOpen = expandedRows.has(m._id);

    const row = document.createElement("tr");
    row.className = isOpen ? "row-expanded" : "";
    row.innerHTML = `
      <td>${m.jurisdiccion}</td>
      <td>${m.programa}</td>
      <td>${m.subprograma}</td>
      <td>${m.proyecto}</td>
      <td>${m.ao}</td>
      <td>${m.partida}</td>
      <td>${m.ff}</td>
      <td class="denominacion-cell">${m.denominacion}</td>
      <td class="numeric">${formatCurrencyDetailed(m.saldoInicial)}</td>
      <td class="numeric saldo-modificado">${formatCurrencyDetailed(m.saldoModificado)}</td>
      <td class="td-expand">
        <button class="expand-toggle" type="button" aria-expanded="${isOpen}" data-id="${m._id}" data-linea-id="${m.id}" aria-label="Ver movimientos asociados">
          ${chevronIcon()}
        </button>
      </td>
    `;
    tbody.appendChild(row);

    // Contenido del desplegable: movimientos reales (imputaciones,
    // refuerzos, modificaciones y órdenes de pago) asociados a la línea,
    // obtenidos vía fetchMovimientosLinea() y cacheados en movimientosCache.
    let detailContent;
    if (!isOpen) {
      detailContent = "";
    } else if (!(m.id in movimientosCache)) {
      detailContent = `<p class="detail-placeholder-text">Cargando movimientos...</p>`;
    } else if (movimientosCache[m.id].length === 0) {
      detailContent = `<p class="detail-placeholder-text">Esta línea presupuestaria no tiene movimientos registrados.</p>`;
    } else {
      detailContent = `<div class="detail-movimientos-list">${movimientosCache[m.id].map(renderMovimientoItem).join("")}</div>`;
    }

    const detailRow = document.createElement("tr");
    detailRow.className = "detail-row" + (isOpen ? " open" : "");
    detailRow.innerHTML = `
      <td colspan="11">
        <div class="detail-row-content">
          ${detailContent}
        </div>
      </td>
    `;
    tbody.appendChild(detailRow);
  });

  document.querySelectorAll(".expand-toggle").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.id);
      const lineaId = Number(btn.dataset.lineaId);

      if (expandedRows.has(id)) {
        expandedRows.delete(id);
        renderUnitsTable();
        return;
      }

      expandedRows.add(id);
      renderUnitsTable();

      if (!(lineaId in movimientosCache)) {
        await fetchMovimientosLinea(lineaId);
        renderUnitsTable();
      }
    });
  });

  updatePagination(startIndex + 1, startIndex + pageMovements.length, movements.length, totalPages);
}

function updatePagination(firstRecord, lastRecord, totalRecords, totalPages) {
  const pagination = document.getElementById("tablePagination");
  const summary = document.getElementById("paginationSummary");
  const pageLabel = document.getElementById("paginationPage");
  const previousButton = document.getElementById("paginationPrev");
  const nextButton = document.getElementById("paginationNext");

  if (!pagination || !summary || !pageLabel || !previousButton || !nextButton) return;

  const hasResults = totalRecords > 0;
  pagination.hidden = !hasResults;
  if (!hasResults) return;

  summary.textContent = `Total de ${totalRecords} registro${totalRecords !== 1 ? "s" : ""} que coinciden con el filtrado`;
  pageLabel.textContent = `Página ${currentPage} de ${totalPages}`;
  previousButton.disabled = currentPage === 1;
  nextButton.disabled = currentPage === totalPages;
}

function setupPaginationEvents() {
  document.getElementById("paginationPrev").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage -= 1;
      renderUnitsTable();
    }
  });

  document.getElementById("paginationNext").addEventListener("click", () => {
    const totalPages = Math.ceil(getFilteredMovements().length / PAGE_SIZE);
    if (currentPage < totalPages) {
      currentPage += 1;
      renderUnitsTable();
    }
  });
}

// =========================================================
// FILTROS Y BÚSQUEDA
// =========================================================

function applyFilters() {
  currentSearch = document.getElementById("searchInput").value;
  currentPrograma = document.getElementById("filterPrograma").value;
  currentPage = 1;
  renderUnitsTable();
}

function setupFilterEvents() {
  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  document.getElementById("searchInput").addEventListener("input", () => {
    currentSearch = document.getElementById("searchInput").value;
    currentPage = 1;
    renderUnitsTable();
  });

  document.getElementById("searchInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyFilters();
  });
}

// =========================================================
// ORDENAMIENTO DE COLUMNAS
// =========================================================

function setupSortEvents() {
  const headers = document.querySelectorAll("#unitsTable thead th[data-key]");
  headers.forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;

      if (currentSort.key === key) {
        currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
      } else {
        currentSort.key = key;
        currentSort.direction = "asc";
      }

      currentPage = 1;

      headers.forEach((h) => h.classList.remove("sort-asc", "sort-desc"));
      th.classList.add(currentSort.direction === "asc" ? "sort-asc" : "sort-desc");

      renderUnitsTable();
    });
  });
}

// =========================================================
// MINI GRÁFICOS (SVG) DE LAS TARJETAS SUPERIORES
// =========================================================

function renderBarChart(containerId, values) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const width = 140;
  const height = 70;
  const max = Math.max(...values);
  const barWidth = width / values.length - 4;

  let bars = "";
  values.forEach((v, i) => {
    const barHeight = (v / max) * height;
    const x = i * (barWidth + 4);
    const y = height - barHeight;
    const opacity = 0.45 + (i / values.length) * 0.55;
    bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="2" fill="#2b6f8e" opacity="${opacity.toFixed(2)}"></rect>`;
  });

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="none">${bars}</svg>`;
}

function renderLineChart(containerId, values) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const width = 220;
  const height = 70;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 10) - 5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="none">
      <polygon points="${areaPoints}" fill="#2b6f8e" opacity="0.12"></polygon>
      <polyline points="${points}" fill="none" stroke="#2b6f8e" stroke-width="2.5"></polyline>
    </svg>
  `;
}

function renderTopCharts() {
  const hasInitialChart = document.getElementById("chartInicial");
  const hasModifiedChart = document.getElementById("chartModificado");

  if (!hasInitialChart && !hasModifiedChart) {
    return;
  }

  if (hasInitialChart) {
    renderBarChart("chartInicial", [40, 55, 62, 48, 58, 50, 46, 42]);
  }

  if (hasModifiedChart) {
    renderLineChart("chartModificado", [30, 42, 38, 50, 46, 60, 55, 68, 62, 72]);
  }
}

// =========================================================
// TOGGLE DE LA SECCIÓN DE PROGRAMAS
// =========================================================

function setupToggleProgramsBtn() {
  const toggleBtn = document.getElementById("toggleProgramsBtn");
  const programsGrid = document.getElementById("programsGrid");

  if (!toggleBtn || !programsGrid) return;

  // Estado inicial: collapsed
  toggleBtn.classList.add("collapsed");
  programsGrid.classList.add("hidden");

  toggleBtn.addEventListener("click", () => {
    const isHidden = programsGrid.classList.contains("hidden");

    if (isHidden) {
      // Mostrar
      programsGrid.classList.remove("hidden");
      toggleBtn.classList.remove("collapsed");
      toggleBtn.classList.add("expanded");
    } else {
      // Ocultar
      programsGrid.classList.add("hidden");
      toggleBtn.classList.remove("expanded");
      toggleBtn.classList.add("collapsed");
    }
  });
}

// =========================================================
// INICIALIZACIÓN
// =========================================================

async function init() {
  setupBudgetAlert();
  setupFilterEvents();
  setupSortEvents();
  setupPaginationEvents();
  setupToggleProgramsBtn();
  setupProgramsNavigation();
  renderTopCharts();

  await fetchLineasPresupuestarias();

  populateProgramFilter();
  renderPrograms();
  renderResumenCards();
  renderUnitsTable();
}

document.addEventListener("DOMContentLoaded", init);