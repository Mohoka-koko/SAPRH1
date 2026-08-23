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
  
  // ─── COLUMNAS ─────────────────────────────────────────────────────────────
  const columnas = [
    { key: "fecha",      label: "Fecha",                        valor: (r) => formatearFecha(r.fecha) },
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
    { key: "expediente", label: "N° Expediente",                valor: (r) => r.expediente },
    { key: "usuario",    label: "Usuario",                      valor: (r) => r.usuario },
    { key: "decreto",    label: "Decreto/\nResolución",         valor: (r) => r.decreto },
    { key: "importe",    label: "Importe Total",                valor: (r) => formatearImporte(r.importe), clase: "col-importe" },
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
        window.location.href = `/refuerzo/editar/${reg.id}/`;
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