/**
 * modificacion.js
 * Tabla de listado de Modificaciones — estilo prototipo2
 */

document.addEventListener("DOMContentLoaded", () => {

  let registros    = [];
  let paginaActual = 1;
  const REGISTROS_POR_PAGINA = 4;

  // ─── COLUMNAS PRINCIPALES ─────────────────────────────────────────────────
  const columnasMain = [
    { key: "fecha",        label: "FECHA",         valor: (r) => `<span class="font-medium text-slate-800">${formatearFecha(r.fecha)}</span>` },
    { key: "expediente",   label: "EXPEDIENTE",    valor: (r) => r.expediente },
    { key: "usuario",      label: "USUARIO",       valor: (r) => `
        <div class="usuario-cell">
          <div class="usuario-avatar">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
            </svg>
          </div>
          <span class="font-medium text-slate-800">${r.usuario}</span>
        </div>` },
    { key: "decreto",      label: "DECRETO / RESOLUCION", valor: (r) => r.decreto
        ? `<a href="#" class="doc-link">
             <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
             </svg>
             ${r.decreto}
           </a>`
        : `<span style="color:#94a3b8;">—</span>` },
    { key: "importe_total", label: "IMPORTE TOTAL", valor: (r) => `<span class="col-importe-total">$${formatearImporte(r.importe_total)}</span>` },
  ];

  // ─── UTILIDADES ───────────────────────────────────────────────────────────
  function formatearFecha(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function formatearImporte(num) {
    if (num === null || num === undefined || num === "") return "";
    return Number(num).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatearUnidad(numero) {
    return `Unidad ${String(numero).padStart(2, "0")}`;
  }

  // ─── RENDERIZADO ──────────────────────────────────────────────────────────
  function renderTabla(lista) {
    const thead       = document.getElementById("thead-tabla");
    const tbody       = document.getElementById("tbody-tabla");
    const sinResultados = document.getElementById("sin-resultados");

    // Cabecera
    thead.innerHTML = "";
    const trHead = document.createElement("tr");
    const thToggle = document.createElement("th");
    thToggle.style.width = "44px";
    trHead.appendChild(thToggle);
    columnasMain.forEach(col => {
      const th = document.createElement("th");
      th.textContent = col.label;
      trHead.appendChild(th);
    });
    const thAcc = document.createElement("th");
    thAcc.textContent = "ACCIONES";
    thAcc.style.textAlign = "center";
    trHead.appendChild(thAcc);
    thead.appendChild(trHead);

    tbody.innerHTML = "";

    if (lista.length === 0) {
      sinResultados.style.display = "flex";
      renderPaginacion(0);
      return;
    }
    sinResultados.style.display = "none";

    const totalPaginas = Math.ceil(lista.length / REGISTROS_POR_PAGINA);
    if (paginaActual > totalPaginas) paginaActual = totalPaginas;
    const inicio = (paginaActual - 1) * REGISTROS_POR_PAGINA;
    const pagina = lista.slice(inicio, inicio + REGISTROS_POR_PAGINA);

    pagina.forEach(reg => {
      // ── Fila principal ────────────────────────────────────────
      const trMain = document.createElement("tr");
      trMain.className = "fila-principal";

      // Toggle
      const tdToggle = document.createElement("td");
      tdToggle.className = "toggle-cell";
      tdToggle.innerHTML = `<button title="Ver detalle">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>`;
      trMain.appendChild(tdToggle);

      columnasMain.forEach(col => {
        const td = document.createElement("td");
        td.innerHTML = col.valor(reg);
        trMain.appendChild(td);
      });

      // Acciones
      const tdAcc = document.createElement("td");
      tdAcc.style.textAlign = "center";
      tdAcc.innerHTML = `
        <div class="acciones-contenedor">
          <button class="btn-accion btn-ver" title="Ver detalle">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </button>
          <button class="btn-accion btn-editar" title="Editar">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button class="btn-accion btn-eliminar" title="Eliminar">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>`;

      tdAcc.querySelector(".btn-ver").addEventListener("click", e => {
        e.stopPropagation();
        toggleDetalle(trMain, trDetails, tdToggle);
      });
      tdAcc.querySelector(".btn-editar").addEventListener("click", e => {
        e.stopPropagation();
        window.location.href = `/modificacion/editar/${reg.id}/`;
      });
      tdAcc.querySelector(".btn-eliminar").addEventListener("click", e => {
        e.stopPropagation();
        eliminarRegistro(reg.id);
      });
      trMain.appendChild(tdAcc);

      // ── Fila detalle ──────────────────────────────────────────
      const trDetails = document.createElement("tr");
      trDetails.className = "fila-detalle";
      trDetails.style.display = "none";

      const tdDetails = document.createElement("td");
      tdDetails.colSpan = columnasMain.length + 2;

      const liOrigen  = (reg.transferentes || []).map(t =>
        `<li>${formatearUnidad(t.numero)} <span style="font-weight:600;color:#1e293b;">($${formatearImporte(t.importe)})</span></li>`
      ).join("") || "<li>—</li>";

      const liDestino = (reg.receptoras || []).map(r =>
        `<li>${formatearUnidad(r.numero)} <span style="font-weight:600;color:#1e293b;">($${formatearImporte(r.importe)})</span></li>`
      ).join("") || "<li>—</li>";

      tdDetails.innerHTML = `
        <div class="detalle-container">
          <div class="detalle-col">
            <div class="detalle-titulo">ORIGEN (TRANSFERENTE)</div>
            <ul class="detalle-lista">${liOrigen}</ul>
            <div class="detalle-subtotal">
              <span>Subtotal Origen:</span>
              <span>$${formatearImporte(reg.importe_total)}</span>
            </div>
          </div>
          <div class="detalle-col">
            <div class="detalle-titulo">DESTINO (RECEPTORA)</div>
            <ul class="detalle-lista detalle-lista-destino">${liDestino}</ul>
            <div class="detalle-subtotal">
              <span>Subtotal Destino:</span>
              <span>$${formatearImporte(reg.importe_total)}</span>
            </div>
          </div>
        </div>`;
      trDetails.appendChild(tdDetails);

      // Toggle al hacer click en fila
      trMain.addEventListener("click", () => toggleDetalle(trMain, trDetails, tdToggle));

      tbody.appendChild(trMain);
      tbody.appendChild(trDetails);
    });

    renderPaginacion(lista.length);
    renderTabla._listaActual = lista;
  }

  function toggleDetalle(trMain, trDetails, tdToggle) {
    const isHidden = trDetails.style.display === "none";
    trDetails.style.display = isHidden ? "table-row" : "none";
    tdToggle.querySelector("svg").style.transform = isHidden ? "rotate(180deg)" : "";
  }

  // ─── PAGINACIÓN ───────────────────────────────────────────────────────────
  function renderPaginacion(totalRegistros) {
    // Info de registros
    const infoEl = document.querySelector(".pagination-info");
    if (infoEl) {
      const termino = inputBusqueda.value.trim();
      infoEl.textContent = termino
        ? `Total de ${totalRegistros} registro${totalRegistros !== 1 ? "s" : ""} que coinciden con el filtrado`
        : `Total de ${totalRegistros} registro${totalRegistros !== 1 ? "s" : ""} que coinciden con el filtrado`;
    }
  
    const totalPaginas = Math.ceil(totalRegistros / REGISTROS_POR_PAGINA);
  
    // Botones
    const btnPrev     = document.querySelector(".pagination-buttons .btn-page:first-child");
    const btnPageNum  = document.querySelector(".btn-page.page-number");
    const btnNext     = document.querySelector(".pagination-buttons .btn-page:last-child");
  
    if (!btnPrev || !btnPageNum || !btnNext) return;
  
    // Actualizar número de página
    btnPageNum.textContent = `${paginaActual}-${totalPaginas || 1}`;
  
    // Anterior
    btnPrev.disabled = paginaActual === 1;
    btnPrev.onclick  = () => {
      if (paginaActual > 1) { paginaActual--; renderTabla(renderTabla._listaActual); }
    };
  
    // Siguiente
    btnNext.disabled = paginaActual >= totalPaginas || totalPaginas === 0;
    btnNext.onclick  = () => {
      if (paginaActual < totalPaginas) { paginaActual++; renderTabla(renderTabla._listaActual); }
    };
  }

  // ─── FILTRADO ─────────────────────────────────────────────────────────────
  const selectCampo   = document.getElementById("campo-filtro");
  const inputBusqueda = document.getElementById("input-busqueda");
  const btnBuscar     = document.getElementById("btn-buscar");

  function filtrar() {
    const campo   = selectCampo.value;
    const termino = inputBusqueda.value.trim().toLowerCase();
    if (!termino) { paginaActual = 1; renderTabla(registros); return; }
    const filtrados = registros.filter(reg => {
      let v = "";
      switch (campo) {
        case "fecha":        v = formatearFecha(reg.fecha); break;
        case "transferente": v = (reg.transferentes || []).map(f => f.numero).join(" "); break;
        case "receptora":    v = (reg.receptoras    || []).map(f => f.numero).join(" "); break;
        case "expediente":   v = reg.expediente; break;
        case "usuario":      v = reg.usuario; break;
        case "decreto":      v = reg.decreto; break;
        default: v = "";
      }
      return v.toLowerCase().includes(termino);
    });
    paginaActual = 1;
    renderTabla(filtrados);
  }

  inputBusqueda.addEventListener("input", filtrar);
  btnBuscar.addEventListener("click", filtrar);
  inputBusqueda.addEventListener("keydown", e => { if (e.key === "Enter") filtrar(); });

  // ─── ELIMINAR ─────────────────────────────────────────────────────────────
  function eliminarRegistro(id) {
    if (!confirm("¿Eliminar este registro?")) return;
    registros = registros.filter(r => r.id !== id);
    filtrar();
  }

  // ─── CARGAR DESDE BD ──────────────────────────────────────────────────────
  async function cargarModificaciones() {
    try {
      const res  = await fetch("/api/modificacion/listar/");
      const data = await res.json();
      registros = data.modificaciones.map(m => ({
        id:            m.id,
        fecha:         m.fecha,
        transferentes: m.transferentes.map(t => ({ numero: String(t.linea_id), importe: parseFloat(t.importe) })),
        receptoras:    m.receptoras.map(r    => ({ numero: String(r.linea_id), importe: parseFloat(r.importe) })),
        expediente:    m.nro_expediente,
        usuario:       m.usuario,
        decreto:       m.nro_decreto,
        importe_total: parseFloat(m.importe_total),
      }));
      filtrar();
    } catch (err) {
      console.error("Error al cargar modificaciones:", err);
    }
  }

  cargarModificaciones();
});