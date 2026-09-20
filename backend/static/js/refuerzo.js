/**
 * refuerzo.js
 * Página exclusiva de Refuerzo presupuestario.
 * Funcionalidades:
 *  - Tabla de registros con cabecera repetida por fila
 *  - Filtrado en tiempo real por campo seleccionado
 *  - Modal para agregar / editar registros
 *  - Filas dinámicas de Unidad Receptora + Importe con botón +
 *  - Cálculo y validación del total asignado vs importe del refuerzo
 *  - Botón eliminar por fila
 *  - Formateo de importes estilo argentino
 *  - POST a /api/refuerzo/crear/
 */

document.addEventListener("DOMContentLoaded", () => {

  // ─── DATOS INICIALES ──────────────────────────────────────────────────────
  let registros = [];
  let paginaActual = 1;
  const REGISTROS_POR_PAGINA = 4;

  // ─── COLUMNAS PRINCIPALES ─────────────────────────────────────────────────
  const columnas = [
    { key: "fecha", label: "FECHA", valor: (r) => `<span class="font-medium text-slate-800">${formatearFecha(r.fecha)}</span>` },
    { key: "expediente", label: "EXPEDIENTE", valor: (r) => r.expediente },
    { key: "usuario", label: "USUARIO", valor: (r) => `
        <div class="usuario-cell">
          <div class="usuario-avatar">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
            </svg>
          </div>
          <span class="font-medium text-slate-800">${r.usuario}</span>
        </div>` },
    { key: "decreto", label: "DECRETO / RESOLUCION", valor: (r) => r.decreto
        ? `<a href="#" class="doc-link">
             <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
             </svg>
             ${r.decreto}
           </a>`
        : `<span style="color:#94a3b8;">—</span>` },
    { key: "importe", label: "IMPORTE TOTAL", valor: (r) => `<span class="col-importe-total">$${formatearImporte(r.importe)}</span>` },
  ];
  
  // ─── UTILIDADES ───────────────────────────────────────────────────────────
  function formatearFecha(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

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

    // Función auxiliar para formatear número de unidad
  function formatearUnidad(numero) {
    const n = String(numero).padStart(2, "0");
    return `Unidad ${n}`;
  }
  
  function toggleDetalle(trMain, trDetails, tdToggle) {
    const isHidden = trDetails.style.display === "none";
    trDetails.style.display = isHidden ? "table-row" : "none";
    tdToggle.querySelector("svg").style.transform = isHidden ? "rotate(180deg)" : "";
  }

  // ─── RENDERIZADO DE TABLA ─────────────────────────────────────────────────
  function renderTabla(lista) {
    const thead = document.getElementById("thead-tabla");
    const tbody = document.getElementById("tbody-tabla");
    const sinResultados = document.getElementById("sin-resultados");

    // Cabecera
    thead.innerHTML = "";
    const trHead = document.createElement("tr");
    
    // 1. Columna vacía para la flecha de despliegue
    const thToggle = document.createElement("th");
    thToggle.style.width = "44px";
    trHead.appendChild(thToggle);
    
    // 2. Columnas principales
    columnas.forEach(col => {
      const th = document.createElement("th");
      th.textContent = col.label;
      trHead.appendChild(th);
    });
    
    // 3. Columna de Acciones explícita
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

      // Toggle (Flecha)
      const tdToggle = document.createElement("td");
      tdToggle.className = "toggle-cell";
      tdToggle.innerHTML = `<button title="Ver detalle">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>`;
      trMain.appendChild(tdToggle);

      columnas.forEach(col => {
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
      tdDetails.colSpan = columnas.length + 2;

      // Armamos la lista de receptora usando los datos del Refuerzo
      const liDestino = (reg.receptoras || []).map(r =>
        `<li>${formatearUnidad(r.numero)} <span style="font-weight:600;color:#1e293b;">($${formatearImporte(r.importe)})</span></li>`
      ).join("") || "<li>—</li>";

      tdDetails.innerHTML = `
        <div class="detalle-container">
          <div class="detalle-col">
            <div class="detalle-titulo">DESTINO (RECEPTORA)</div>
            <ul class="detalle-lista detalle-lista-destino">${liDestino}</ul>
            <div class="detalle-subtotal">
              <span>Subtotal Destino:</span>
              <span>$${formatearImporte(reg.importe)}</span>
            </div>
          </div>
        </div>`;
      trDetails.appendChild(tdDetails);

      // ── Eventos de los botones ────────────────────────────────
      tdAcc.querySelector(".btn-ver").addEventListener("click", e => {
        e.stopPropagation();
        toggleDetalle(trMain, trDetails, tdToggle);
      });
      tdAcc.querySelector(".btn-editar").addEventListener("click", e => {
        e.stopPropagation();
        window.location.href = `/refuerzo/editar/${reg.id}/`;
      });
      tdAcc.querySelector(".btn-eliminar").addEventListener("click", e => {
        e.stopPropagation();
        eliminarRegistro(reg.id);
      });

      // Toggle al hacer click en la fila
      trMain.addEventListener("click", () => toggleDetalle(trMain, trDetails, tdToggle));

      tbody.appendChild(trMain);
      tbody.appendChild(trDetails);
    });

    renderPaginacion(lista.length);
    renderTabla._listaActual = lista;
  }

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
        renderTabla(renderTabla._listaActual);
      }
    };

    btnNext.disabled = paginaActual >= totalPaginas;
    btnNext.onclick = () => {
      if (paginaActual < totalPaginas) {
        paginaActual++;
        renderTabla(renderTabla._listaActual);
      }
    };
  }
  
  // ─── FILTRADO ─────────────────────────────────────────────────────────────
  const selectCampo   = document.getElementById("campo-filtro");
  const inputBusqueda = document.getElementById("input-busqueda");
  const btnBuscar     = document.getElementById("btn-buscar");

    function filtrar() {
      const campo   = selectCampo.value;
      const termino = inputBusqueda.value.trim().toLowerCase();
  
      if (!termino) { renderTabla(registros); return; }
  
      const filtrados = registros.filter((reg) => {
        let valCampo = "";
        switch (campo) {
          case "fecha":      valCampo = formatearFecha(reg.fecha); break;
          case "expediente": valCampo = reg.expediente; break;
          case "usuario":    valCampo = reg.usuario; break;
          case "decreto":    valCampo = reg.decreto; break;
          case "importe":    valCampo = formatearImporte(reg.importe); break;
          default:           valCampo = "";
        }
        return valCampo.toLowerCase().includes(termino);
      });
  
      renderTabla(filtrados);
    }
  
    inputBusqueda.addEventListener("input", filtrar);
    btnBuscar.addEventListener("click", filtrar);
    inputBusqueda.addEventListener("keydown", (e) => { if (e.key === "Enter") filtrar(); });
  
    // ─── ELIMINAR ─────────────────────────────────────────────────────────────
    function eliminarRegistro(id) {
      if (!confirm("¿Eliminar este registro?")) return;
      registros = registros.filter((r) => r.id !== id);
      filtrar();
    }

    // ─── CARGAR REFUERZOS DESDE LA BD ─────────────────────────────────────────
    async function cargarRefuerzos() {
      try {
        const res  = await fetch("/api/refuerzo/listar/");
        const data = await res.json();

        registros = data.refuerzos.map(r => ({
          id:                 r.id,
          fecha:              r.fecha,
          receptoras: r.receptoras.map(d => ({
            numero:  String(d.linea_id),
            importe: parseFloat(d.importe),
          })),
          expediente: r.nro_expediente,
          usuario:    r.usuario,
          decreto:    r.nro_decreto,
          importe:    parseFloat(r.importe_total),
        }));

        
        filtrar();
      } catch (err) {
        console.error("Error al cargar refuerzos:", err);
      }
    }

    // ─── INICIALIZAR ──────────────────────────────────────────────────────────
    cargarRefuerzos();
  });