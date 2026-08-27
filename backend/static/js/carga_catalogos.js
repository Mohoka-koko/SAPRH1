/* ==========================================================================
   CARGA DE CATÁLOGOS — lógica de la pantalla
   Maneja: apertura del modal por tipo de catálogo, filtro/selector de
   la tabla de abajo, y guardado (por ahora simulado; hay que conectar
   con el backend, ver comentario al final).
   ========================================================================== */

// Datos de ejemplo. Reemplazar por el fetch real a tu API de Django.
const datosCatalogos = {
  'Programa': [],
  'Subprograma': [],
  'Proyecto': [],
  'Actividad / Obra': [],
  'Partida': [],
  'Fuente de Financiamiento': [],
};

let catalogoActual = 'Programa';

function cambiarCatalogo() {
  catalogoActual = document.getElementById('selectCatalogo').value;
  document.getElementById('buscadorTabla').value = '';
  renderTabla();
}

function renderTabla() {
  const tbody = document.getElementById('tbodyCatalogo');
  const filtro = document.getElementById('buscadorTabla').value.trim().toLowerCase();
  const items = (datosCatalogos[catalogoActual] || []).filter(item =>
    item.codigo.toLowerCase().includes(filtro) ||
    item.denominacion.toLowerCase().includes(filtro)
  );

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="sin-datos">No hay ${catalogoActual.toLowerCase()}s cargados que coincidan.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((item, index) => `
    <tr>
      <td>${item.codigo}</td>
      <td>${item.denominacion}</td>
      <td class="col-acciones">
        <button class="btn-icon-tabla" title="Editar" onclick="editarItem(${index})">✎</button>
        <button class="btn-icon-tabla eliminar" title="Eliminar" onclick="eliminarItem(${index})">✕</button>
      </td>
    </tr>
  `).join('');
}

function abrirModal(nombre) {
  document.getElementById('modalTitulo').textContent = 'Cargar ' + nombre;
  document.getElementById('inputCodigo').value = '';
  document.getElementById('inputDenominacion').value = '';
  document.getElementById('modalOverlay').classList.add('open');

  // Sincroniza el selector de la tabla con lo que se está cargando
  document.getElementById('selectCatalogo').value = nombre;
  catalogoActual = nombre;

  setTimeout(() => document.getElementById('inputCodigo').focus(), 50);
}

function cerrarModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

function guardarCatalogo() {
  const codigo = document.getElementById('inputCodigo').value.trim();
  const denom = document.getElementById('inputDenominacion').value.trim();

  if (!codigo || !denom) {
    alert('Completá código y denominación.');
    return;
  }

  // ------------------------------------------------------------------
  // TODO: reemplazar este bloque por un fetch/POST real a Django, ej:
  //
  // fetch('/api/catalogos/guardar/', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'X-CSRFToken': obtenerCSRFToken(),
  //   },
  //   body: JSON.stringify({ tipo: catalogoActual, codigo, denominacion: denom }),
  // })
  //   .then(resp => resp.json())
  //   .then(data => { ... actualizar tabla con la respuesta real ... });
  //
  // Por ahora se guarda solo en memoria (se pierde al recargar la página).
  // ------------------------------------------------------------------
  if (!datosCatalogos[catalogoActual]) datosCatalogos[catalogoActual] = [];
  datosCatalogos[catalogoActual].push({ codigo, denominacion: denom });

  cerrarModal();
  renderTabla();
  mostrarToast(`✓ ${catalogoActual} "${denom}" guardado correctamente`);
}

function editarItem(index) {
  const item = datosCatalogos[catalogoActual][index];
  const nuevoCodigo = prompt('Código:', item.codigo);
  if (nuevoCodigo === null) return;
  const nuevaDenom = prompt('Denominación:', item.denominacion);
  if (nuevaDenom === null) return;

  item.codigo = nuevoCodigo.trim();
  item.denominacion = nuevaDenom.trim();
  renderTabla();
  mostrarToast('✓ Cambios guardados');

  // TODO: reemplazar por PUT/PATCH real a Django
}

function eliminarItem(index) {
  const item = datosCatalogos[catalogoActual][index];
  const confirmar = confirm(`¿Eliminar "${item.denominacion}"?`);
  if (!confirmar) return;

  datosCatalogos[catalogoActual].splice(index, 1);
  renderTabla();
  mostrarToast('✓ Eliminado correctamente');

  // TODO: reemplazar por DELETE real a Django
}

function mostrarToast(mensaje) {
  const toast = document.getElementById('toast');
  toast.textContent = mensaje;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') cerrarModal();
  });
  renderTabla();
});