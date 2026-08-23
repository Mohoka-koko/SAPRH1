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
  const columnas = [
    { key: "fecha", label: "Fecha", valor: (r) => formatearFecha(r.fecha) },
    {
      key: "transferentes",
      label: "N° Unidad\nTransferente",
      valor: (r) => (r.transferentes || []).map(f => formatearUnidad(f.numero)).join("<br>") || "—"
    },
    {
      key: "importe_transferente",
      label: "Importe\nTransferente",
      valor: (r) => (r.transferentes || []).map(f => `$${formatearImporte(f.importe)}`).join("<br>") || "—",
      clase: "col-importe"
    },
    {
      key: "receptoras",
      label: "N° Unidad\nReceptora",
      valor: (r) => (r.receptoras || []).map(f => formatearUnidad(f.numero)).join("<br>") || "—"
    },
    {
      key: "importe_receptora",
      label: "Importe\nReceptora",
      valor: (r) => (r.receptoras || []).map(f => `$${formatearImporte(f.importe)}`).join("<br>") || "—",
      clase: "col-importe"
    },
    { key: "expediente", label: "N° Expediente", valor: (r) => r.expediente },
    { key: "usuario",    label: "Usuario",       valor: (r) => r.usuario },
    { key: "decreto",    label: "Decreto/\nResolución", valor: (r) => r.decreto },
    { key: "importe_total", label: "Importe\nTotal", valor: (r) => `$${formatearImporte(r.importe_total)}`, clase: "col-importe" },
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
    columnas.forEach((col) => {
      const th = document.createElement("th");
      th.innerHTML = col.label.replace("\n", "<br/>");
      trHead.appendChild(th);
    });
    const thAcc = document.createElement("th");
    thAcc.style.width = "30px";
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
    const fin    = inicio + REGISTROS_POR_PAGINA;
    const pagina = lista.slice(inicio, fin);
  
    pagina.forEach((reg) => {
      const trDato = document.createElement("tr");
      trDato.className = "fila-dato";
      trDato.dataset.id = reg.id;
  
      columnas.forEach((col) => {
        const td = document.createElement("td");
        td.innerHTML = col.valor(reg);
        if (col.clase) td.className = col.clase;
        trDato.appendChild(td);
      });
  
      const tdDel = document.createElement("td");
      const btnDel = document.createElement("button");
      btnDel.className = "btn-eliminar-fila";
      btnDel.title = "Eliminar registro";
      btnDel.textContent = "✕";
      btnDel.addEventListener("click", (e) => {
        e.stopPropagation();
        eliminarRegistro(reg.id);
      });
      tdDel.appendChild(btnDel);
      trDato.appendChild(tdDel);
  
      trDato.addEventListener("click", () => {
        window.location.href = `/modificacion/editar/${reg.id}/`;
      });
      tbody.appendChild(trDato);
    });
  
    renderPaginacion(lista.length);
  
    // Guardar lista actual para que la paginación funcione
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