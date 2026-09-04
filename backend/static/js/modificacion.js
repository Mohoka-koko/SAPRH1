/**
 * modificacion.js
 * Página exclusiva de Modificación presupuestaria.
 * Funcionalidades:
 *  - Tabla de registros con cabecera repetida por fila
 *  - Filtrado en tiempo real por campo seleccionado
 *  - Modal con filas dinámicas para Transferente y Receptora (con importe)
 *  - Total asignado independiente por grupo + validación cruzada en tiempo real
 *  - Botón eliminar por fila
 *  - Formateo de importes estilo argentino
 *  - POST a /api/modificacion/crear/
 */

document.addEventListener("DOMContentLoaded", () => {

  // ─── DATOS INICIALES ──────────────────────────────────────────────────────
  let registros = [];
  let paginaActual = 1;
  const REGISTROS_POR_PAGINA = 4;
  
  // ─── COLUMNAS ─────────────────────────────────────────────────────────────
  // ─── COLUMNAS PRINCIPALES (Sin Transferente/Receptora) ───────────
  const columnasMain = [
    { key: "fecha", label: "FECHA", valor: (r) => formatearFecha(r.fecha) },
    
    // Expediente vuelve a ser texto normal (sin enlace, color por defecto)
    { key: "expediente", label: "EXPEDIENTE", valor: (r) => r.expediente },
    
    // Usuario con icono de FontAwesome
    { key: "usuario", label: "USUARIO", valor: (r) => `<span style="display:flex; align-items:center; gap:6px;"><i class="fa-solid fa-circle-user" style="color:#3b82f6;"></i> ${r.usuario}</span>` },
    
    // Decreto/Resolución ahora es el enlace azul con icono de archivo
    { key: "decreto", label: "DOC. REFERENCIA", valor: (r) => `<a href="/ruta-a-tu-pdf/${r.id}" target="_blank" style="color:#2563eb; text-decoration:underline; display:flex; align-items:center; gap:6px;" title="Ver documento"><i class="fa-regular fa-file-pdf"></i> ${r.decreto}</a>` },
    
    { key: "importe_total", label: "IMPORTE TOTAL", valor: (r) => `<strong>$${formatearImporte(r.importe_total)}</strong>` }
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

  // ─── RENDERIZADO DE TABLA ─────────────────────────────────────────────────
  function renderTabla(lista) {
    const thead = document.getElementById("thead-tabla");
    const tbody = document.getElementById("tbody-tabla");
    const sinResultados = document.getElementById("sin-resultados");
  
    thead.innerHTML = "";
    const trHead = document.createElement("tr");
    
    // Columna para el ícono de desplegar
    const thToggle = document.createElement("th");
    thToggle.style.width = "40px";
    trHead.appendChild(thToggle);

    columnasMain.forEach((col) => {
      const th = document.createElement("th");
      th.innerHTML = col.label;
      trHead.appendChild(th);
    });
    
    // Columna de Acciones
    const thAcc = document.createElement("th");
    thAcc.innerHTML = "ACCIONES";
    trHead.appendChild(thAcc);
    thead.appendChild(trHead);
  
    tbody.innerHTML = "";
  
    if (lista.length === 0) {
      sinResultados.style.display = "block";
      renderPaginacion(0);
      return;
    }
    sinResultados.style.display = "none";
  
    const totalPaginas = Math.ceil(lista.length / REGISTROS_POR_PAGINA);
    if (paginaActual > totalPaginas) paginaActual = totalPaginas;
    const inicio = (paginaActual - 1) * REGISTROS_POR_PAGINA;
    const pagina = lista.slice(inicio, inicio + REGISTROS_POR_PAGINA);
  
    pagina.forEach((reg) => {
      // 1. FILA PRINCIPAL
      const trMain = document.createElement("tr");
      trMain.className = "fila-principal";
      
      const tdToggle = document.createElement("td");
      tdToggle.className = "toggle-cell";
      tdToggle.innerHTML = "<span>&#8964;</span>"; // Icono chevron down
      trMain.appendChild(tdToggle);

      columnasMain.forEach((col) => {
        const td = document.createElement("td");
        td.innerHTML = col.valor(reg);
        trMain.appendChild(td);
      });
  
      // Acciones (Visualizar, Editar, Eliminar)
      const tdAcc = document.createElement("td");
      tdAcc.innerHTML = `
        <div class="acciones-contenedor">
            <button class="btn-accion btn-ver" title="Ver detalle">
                <i class="fa-regular fa-eye"></i>
            </button>
            <button class="btn-accion btn-editar" title="Editar registro">
                <i class="fa-regular fa-pen-to-square"></i>
            </button>
            <button class="btn-accion btn-eliminar" title="Eliminar registro">
                <i class="fa-regular fa-trash-can"></i>
            </button>
        </div>
      `;

      // Lógica del botón VER
      tdAcc.querySelector('.btn-ver').addEventListener("click", (e) => {
        e.stopPropagation();
        window.location.href = `/modificacion/ver/${reg.id}/`; 
      });

      // Lógica del botón EDITAR
      tdAcc.querySelector('.btn-editar').addEventListener("click", (e) => {
        e.stopPropagation();
        window.location.href = `/modificacion/editar/${reg.id}/`; 
      });

      // Lógica del botón ELIMINAR
      tdAcc.querySelector('.btn-eliminar').addEventListener("click", (e) => {
        e.stopPropagation();
        eliminarRegistro(reg.id);
      });

      trMain.appendChild(tdAcc);
  
      // 2. FILA DETALLE (Oculta por defecto)
      const trDetails = document.createElement("tr");
      trDetails.className = "fila-detalle";
      trDetails.style.display = "none";
      
      const tdDetails = document.createElement("td");
      tdDetails.colSpan = columnasMain.length + 2;
      
      // Generar listas dinámicas de Origen y Destino
      const liOrigen = reg.transferentes.map(t => `<li>${formatearUnidad(t.numero)} ($${formatearImporte(t.importe)})</li>`).join("");
      const liDestino = reg.receptoras.map(r => `<li>${formatearUnidad(r.numero)} ($${formatearImporte(r.importe)})</li>`).join("");

      tdDetails.innerHTML = `
        <div class="detalle-container">
            <div class="detalle-col">
                <div class="detalle-titulo">ORIGEN (Transferente)</div>
                <ul class="detalle-lista">${liOrigen}</ul>
                <div class="detalle-subtotal">Subtotal Origen: $${formatearImporte(reg.importe_total)}</div>
            </div>
            <div class="detalle-col">
                <div class="detalle-titulo">DESTINO (Receptora)</div>
                <ul class="detalle-lista">${liDestino}</ul>
                <div class="detalle-subtotal">Subtotal Destino: $${formatearImporte(reg.importe_total)}</div>
            </div>
        </div>
      `;
      trDetails.appendChild(tdDetails);

      // Evento para expandir/contraer
      trMain.addEventListener("click", () => {
        const isHidden = trDetails.style.display === "none";
        trDetails.style.display = isHidden ? "table-row" : "none";
        tdToggle.innerHTML = isHidden ? "<span>&#8963;</span>" : "<span>&#8964;</span>"; // Cambia chevron up/down
      });

      tbody.appendChild(trMain);
      tbody.appendChild(trDetails);
    });
  
    renderPaginacion(lista.length);
    renderTabla._listaActual = lista;
  }

  function renderPaginacion(totalRegistros) {
    let contenedor = document.getElementById("paginacion-modificaciones");
    if (!contenedor) return;
  
    const totalPaginas = Math.ceil(totalRegistros / REGISTROS_POR_PAGINA);
    contenedor.innerHTML = "";
  
    if (totalPaginas <= 1) return;
  
    // Anterior
    const btnAnterior = document.createElement("button");
    btnAnterior.textContent = "← Anterior";
    btnAnterior.className   = "pag-btn";
    btnAnterior.disabled    = paginaActual === 1;
    btnAnterior.addEventListener("click", () => {
      if (paginaActual > 1) {
        paginaActual--;
        renderTabla(renderTabla._listaActual);
      }
    });
  
    // Info central
    const info = document.createElement("span");
    info.className   = "pag-info";
    info.textContent = `${paginaActual} / ${totalPaginas}`;
  
    // Siguiente
    const btnSiguiente = document.createElement("button");
    btnSiguiente.textContent = "Siguiente →";
    btnSiguiente.className   = "pag-btn";
    btnSiguiente.disabled    = paginaActual === totalPaginas;
    btnSiguiente.addEventListener("click", () => {
      if (paginaActual < totalPaginas) {
        paginaActual++;
        renderTabla(renderTabla._listaActual);
      }
    });
  
    contenedor.appendChild(btnAnterior);
    contenedor.appendChild(info);
    contenedor.appendChild(btnSiguiente);
  }
  
  // ─── FILTRADO ─────────────────────────────────────────────────────────────
  const selectCampo   = document.getElementById("campo-filtro");
  const inputBusqueda = document.getElementById("input-busqueda");
  const btnBuscar     = document.getElementById("btn-buscar");

  function filtrar() {
    const campo   = selectCampo.value;
    const termino = inputBusqueda.value.trim().toLowerCase();
  
    if (!termino) {
      paginaActual = 1;
      renderTabla(registros);
      return;
    }
  
    const filtrados = registros.filter((reg) => {
      let valCampo = "";
      switch (campo) {
        case "fecha":        valCampo = formatearFecha(reg.fecha); break;
        case "transferente": valCampo = (reg.transferentes || []).map(f => f.numero).join(" "); break;
        case "receptora":    valCampo = (reg.receptoras || []).map(f => f.numero).join(" "); break;
        case "expediente":   valCampo = reg.expediente; break;
        case "usuario":      valCampo = reg.usuario; break;
        case "decreto":      valCampo = reg.decreto; break;
        default:             valCampo = "";
      }
      return valCampo.toLowerCase().includes(termino);
    });
  
    paginaActual = 1;
    renderTabla(filtrados);
  }
  
    inputBusqueda.addEventListener("input", filtrar);
    btnBuscar.addEventListener("click", filtrar);
    inputBusqueda.addEventListener("keydown", (e) => { if (e.key === "Enter") filtrar(); });
  

    // Listeners para botones + de cada grupo
    document.addEventListener("click", (e) => {
      if (e.target && e.target.id === "btn-agregar-transferente") {
        crearFila("contenedor-transferentes", "", "", actualizarTotales);
        actualizarTotales();
      }
      if (e.target && e.target.id === "btn-agregar-receptora") {
        crearFila("contenedor-receptoras", "", "", actualizarTotales);
        actualizarTotales();
      }
    });

    // ─── ELIMINAR ─────────────────────────────────────────────────────────────
    function eliminarRegistro(id) {
      if (!confirm("¿Eliminar este registro?")) return;
      registros = registros.filter((r) => r.id !== id);
      filtrar();
    }

    // ─── CARGAR MODIFICACIONES DESDE LA BD ────────────────────────────────────
    async function cargarModificaciones() {
      try {
        const res  = await fetch("/api/modificacion/listar/");
        const data = await res.json();

        registros = data.modificaciones.map(m => ({
          id:           m.id,
          fecha:        m.fecha,
          transferentes: m.transferentes.map(t => ({
            numero:  String(t.linea_id),
            importe: parseFloat(t.importe),
          })),
          receptoras: m.receptoras.map(r => ({
            numero:  String(r.linea_id),
            importe: parseFloat(r.importe),
          })),
          expediente: m.nro_expediente,
          usuario:    m.usuario,
          decreto:    m.nro_decreto,
          importe_total: parseFloat(m.importe_total),
        }));

        
        filtrar();
      } catch (err) {
        console.error("Error al cargar modificaciones:", err);
      }
    }
      
    // ─── INICIALIZAR ──────────────────────────────────────────────────────────
    cargarModificaciones();
  });