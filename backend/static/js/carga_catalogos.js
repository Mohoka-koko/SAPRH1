/* ==========================================================================
   CARGA DE CATÁLOGOS — lógica de la pantalla
   Conectado a la BD real vía las APIs de dashboards:
     GET  /api/catalogos/listar/?tipo=...
     GET  /api/catalogos/padres/?tipo=...
     POST /api/catalogos/crear/
     POST /api/catalogos/editar/<id>/
     POST /api/catalogos/eliminar/<id>/?tipo=...
   ========================================================================== */

// Catálogos que necesitan seleccionar un padre (FK obligatoria en el modelo)
const PADRE_LABEL = {
  'Programa': 'Jurisdicción',
  'Subprograma': 'Programa',
  'Proyecto': 'Programa',
  'Actividad / Obra': 'Proyecto',
};

let datosCatalogos = {
  'Programa': [],
  'Subprograma': [],
  'Proyecto': [],
  'Actividad / Obra': [],
  'Partida': [],
  'Fuente de Financiamiento': [],
};

let catalogoActual = 'Programa';
let editandoId = null; // null = creando, id = editando ese registro

function getCSRFToken() {
  const input = document.querySelector('[name=csrfmiddlewaretoken]');
  if (input) return input.value;
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

// ------------------------- Carga desde la BD -------------------------
async function cargarCatalogo(tipo) {
  const tbody = document.getElementById('tbodyCatalogo');
  tbody.innerHTML = `<tr><td colspan="3" class="sin-datos">Cargando...</td></tr>`;
  try {
    const resp = await fetch(`/api/catalogos/listar/?tipo=${encodeURIComponent(tipo)}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Error al cargar');
    datosCatalogos[tipo] = data.items;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" class="sin-datos">Error al cargar: ${err.message}</td></tr>`;
    return;
  }
  renderTabla();
}

function cambiarCatalogo() {
  catalogoActual = document.getElementById('selectCatalogo').value;
  document.getElementById('buscadorTabla').value = '';
  cargarCatalogo(catalogoActual);
}

// ------------------------- Filtro en tiempo real (client-side) -------------------------
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

  tbody.innerHTML = items.map(item => `
    <tr>
      <td>${item.codigo}</td>
      <td>${item.denominacion}${item.padre_nombre ? ` <span style="color:#9ca3af;font-size:.78rem;">(${item.padre_nombre})</span>` : ''}</td>
      <td class="col-acciones">
        <button class="btn-icon-tabla" title="Editar" onclick="editarItem(${item.id})">✎</button>
        <button class="btn-icon-tabla eliminar" title="Eliminar" onclick="eliminarItem(${item.id})">✕</button>
      </td>
    </tr>
  `).join('');
}

// ------------------------- Modal -------------------------
async function abrirModal(nombre, itemParaEditar = null) {
  editandoId = itemParaEditar ? itemParaEditar.id : null;

  document.getElementById('modalTitulo').textContent = (editandoId ? 'Editar ' : 'Cargar ') + nombre;
  document.getElementById('inputCodigo').value = itemParaEditar ? itemParaEditar.codigo : '';
  document.getElementById('inputDenominacion').value = itemParaEditar ? itemParaEditar.denominacion : '';
  document.getElementById('modalOverlay').classList.add('open');

  document.getElementById('selectCatalogo').value = nombre;
  catalogoActual = nombre;

  const grupoPadre = document.getElementById('grupoPadre');
  const selectPadre = document.getElementById('selectPadre');

  if (PADRE_LABEL[nombre]) {
    document.getElementById('labelPadre').textContent = PADRE_LABEL[nombre];
    grupoPadre.style.display = '';
    selectPadre.innerHTML = '<option value="">Cargando...</option>';
    try {
      const resp = await fetch(`/api/catalogos/padres/?tipo=${encodeURIComponent(nombre)}`);
      const data = await resp.json();
      if (data.padres.length === 0) {
        selectPadre.innerHTML = `<option value="">No hay ${PADRE_LABEL[nombre].toLowerCase()}s cargados</option>`;
      } else {
        selectPadre.innerHTML = data.padres.map(p => `<option value="${p.id}">${p.label}</option>`).join('');
        if (itemParaEditar && itemParaEditar.padre_id) {
          selectPadre.value = itemParaEditar.padre_id;
        }
      }
    } catch (err) {
      selectPadre.innerHTML = '<option value="">Error al cargar</option>';
    }
  } else {
    grupoPadre.style.display = 'none';
    selectPadre.innerHTML = '';
  }

  setTimeout(() => document.getElementById('inputCodigo').focus(), 50);
}

function cerrarModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editandoId = null;
}

async function guardarCatalogo() {
  const codigo = document.getElementById('inputCodigo').value.trim();
  const denom = document.getElementById('inputDenominacion').value.trim();
  const requierePadre = !!PADRE_LABEL[catalogoActual];
  const padreId = requierePadre ? document.getElementById('selectPadre').value : null;

  if (!codigo || !denom) {
    alert('Completá código y denominación.');
    return;
  }
  if (requierePadre && !padreId) {
    alert(`Seleccioná ${PADRE_LABEL[catalogoActual]}.`);
    return;
  }

  const payload = { tipo: catalogoActual, codigo, denominacion: denom };
  if (requierePadre) payload.padre_id = padreId;

  const url = editandoId
    ? `/api/catalogos/editar/${editandoId}/`
    : `/api/catalogos/crear/`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCSRFToken(),
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Error al guardar');

    cerrarModal();
    await cargarCatalogo(catalogoActual);
    mostrarToast(`✓ ${catalogoActual} "${denom}" guardado correctamente`);
  } catch (err) {
    alert(err.message);
  }
}

function editarItem(id) {
  const item = (datosCatalogos[catalogoActual] || []).find(i => i.id === id);
  if (!item) return;
  abrirModal(catalogoActual, item);
}

async function eliminarItem(id) {
  const item = (datosCatalogos[catalogoActual] || []).find(i => i.id === id);
  if (!item) return;
  const confirmar = confirm(`¿Eliminar "${item.denominacion}"?`);
  if (!confirmar) return;

  try {
    const resp = await fetch(`/api/catalogos/eliminar/${id}/?tipo=${encodeURIComponent(catalogoActual)}`, {
      method: 'POST',
      headers: { 'X-CSRFToken': getCSRFToken() },
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Error al eliminar');

    await cargarCatalogo(catalogoActual);
    mostrarToast('✓ Eliminado correctamente');
  } catch (err) {
    alert(err.message);
  }
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
  cargarCatalogo(catalogoActual);
});