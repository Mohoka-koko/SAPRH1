/* ===== SIDEBAR ===== */
function toggleMenu() {
  document.getElementById("sidebar").classList.toggle("closed");
}

function cerrarSesion() {
  window.location.href = "ingresar.html";
}

const backBtn = document.getElementById("back-btn");

if (backBtn) {
  backBtn.addEventListener("click", () => {
    document.getElementById("filter-input").value = "";
    renderTabla(data);
  });
}

const data = [
  {
    up: 51, jurisdiccion: 13, programa: "00", sub: "03",
    proyecto: 53, ao: 421, partida: "xx",
    denominacion: "Gastos en Personal",
    saldoInicial: 1000000, saldoMod: 800000,
    movimientos: [
      { tipo: "Imputación",   fecha: "xx/xx/xx", expediente: "xxx xxx xxx", asiento: "01", usuario: "Admi", decreto: "",    importe: -200000, clase: "imputacion"   },
      { tipo: "O. de Pago",   fecha: "xx/xx/xx", expediente: "xxx xxx xxx", asiento: "01", usuario: "Admi", decreto: "",    importe: -200000, clase: "opago"        },
    ]
  },
  {
    up: 51, jurisdiccion: 13, programa: "08", sub: "03",
    proyecto: 53, ao: 421, partida: "xx",
    denominacion: "Bienes de Consumo",
    saldoInicial: 1000000, saldoMod: 1000000,
    movimientos: [
      { tipo: "Refuerzo",     fecha: "xx/xx/xx", expediente: "xxx xxx xxx", asiento: "01", usuario: "Admi", decreto: "xxx", importe: +200000, clase: "refuerzo"     },
    ]
  },
  {
    up: 51, jurisdiccion: 13, programa: "00", sub: "03",
    proyecto: 53, ao: 421, partida: "xx",
    denominacion: "Servicios no Personales",
    saldoInicial: 1000000, saldoMod: 800000,
    movimientos: [
      { tipo: "Modificación", fecha: "xx/xx/xx", expediente: "xxx xxx xxx", asiento: "01", usuario: "Admi", decreto: "xxx", importe: -200000, clase: "modificacion" },
    ]
  },
  {
    up: 51, jurisdiccion: 13, programa: "05", sub: "03",
    proyecto: 53, ao: 421, partida: "xx",
    denominacion: "Transferencias",
    saldoInicial: 1000000, saldoMod: 800000,
    movimientos: []
  },
];
 
function format(n) {
  return n.toLocaleString("es-AR");
}
 
function renderTabla(lista) {
  const tbody = document.getElementById("table-body");
  if (!tbody) return;
  tbody.innerHTML = "";
 
  lista.forEach((item) => {
    // ── FILA PRINCIPAL ──────────────────────────────
    const tr = document.createElement("tr");
    tr.classList.add("data-row");
    tr.innerHTML = `
      <td>${item.up}</td>
      <td>${item.jurisdiccion}</td>
      <td>${item.programa}</td>
      <td>${item.sub}</td>
      <td>${item.proyecto}</td>
      <td>${item.ao}</td>
      <td>${item.partida}</td>
      <td style="text-align:left">${item.denominacion}</td>
      <td>${format(item.saldoInicial)}</td>
      <td>${format(item.saldoMod)}</td>
      <td>${item.movimientos.length > 0 ? '<button class="expand-btn">▾</button>' : ""}</td>
    `;
    tbody.appendChild(tr);
 
    // ── FILA DETALLE ────────────────────────────────
    if (item.movimientos.length > 0) {
      const detalleRow = document.createElement("tr");
      detalleRow.classList.add("detalle-row");
 
      const subFilas = item.movimientos.map(m => {
        const signo    = m.importe < 0 ? "-" : "+";
        const amtClass = m.importe < 0 ? "amount-neg" : "amount-pos";
        return `
          <tr class="${m.clase}">
            <td>${m.tipo}</td>
            <td>${m.fecha}</td>
            <td>${m.expediente}</td>
            <td>${m.asiento}</td>
            <td>${m.usuario}</td>
            <td>${m.decreto || ""}</td>
            <td class="${amtClass}">
  ${signo}${format(Math.abs(m.importe))}
  <button class="btn-archivo">📄</button>
</td>
        `;
      }).join("");
 
      detalleRow.innerHTML = `
        <td colspan="11" style="padding:0; border-bottom:1px solid #e0e0d8;">
          <div class="detalle-inner">
            <table class="sub-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Expediente</th>
                  <th>Asiento N°</th>
                  <th>Usuario</th>
                  <th>Decreto/Res.</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>${subFilas}</tbody>
            </table>
          </div>
        </td>
      `;
 
      tbody.appendChild(detalleRow);
 
      // Evento del botón
      const btn   = tr.querySelector(".expand-btn");
      const inner = detalleRow.querySelector(".detalle-inner");
 
      btn.addEventListener("click", () => {
        const isOpen = inner.classList.contains("open");
        inner.classList.toggle("open", !isOpen);
        btn.classList.toggle("open", !isOpen);
      });
    }
  });
}

// ── FILTRO ──────────────────────────────────────────
const searchBtn = document.getElementById("search-btn");
const filterInput = document.getElementById("filter-input");
const filterSelect = document.getElementById("filter-select");

if (searchBtn) {
  searchBtn.addEventListener("click", () => {
      const texto = filterInput.value.toLowerCase();
      const campo = filterSelect.value;
      const filtrado = data.filter(d =>
          String(d[campo]).toLowerCase().includes(texto)
      );
      renderTabla(filtrado);
  });
}

if (filterInput) {
  filterInput.addEventListener("keydown", e => {
      if (e.key === "Enter") searchBtn.click();
  });
}

// ── INICIO ──────────────────────────────────────────
if (document.getElementById("table-body")) {
renderTabla(data);
}

function confirmarBaja(usuarioId, nombreUsuario) {
document.getElementById('modal-titulo').textContent = 'Confirmar baja';
document.getElementById('modal-mensaje').textContent = 
    `¿Estás seguro que querés dar de baja a ${nombreUsuario}?`;
document.getElementById('btn-confirmar-accion').onclick = () => ejecutarBaja(usuarioId, nombreUsuario);
document.getElementById('modal-baja').style.display = 'flex';
}

function confirmarReactivar(usuarioId, nombreUsuario) {
  document.getElementById('modal-titulo').textContent = 'Confirmar reactivación';
  document.getElementById('modal-mensaje').textContent = 
      `¿Querés reactivar a ${nombreUsuario}?`;
  document.getElementById('btn-confirmar-accion').onclick = () => ejecutarReactivar(usuarioId, nombreUsuario);
  document.getElementById('modal-baja').style.display = 'flex';
}

function cerrarModal() {
  document.getElementById('modal-baja').style.display = 'none';
}

function ejecutarBaja(usuarioId, nombreUsuario) {
  cerrarModal();
  fetch(`/admin-dashboard/usuarios-baja/${usuarioId}/`, {
      method: 'POST',
      headers: {
          'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)[1],
          'Content-Type': 'application/json',
      },
  })
  .then(response => response.json())
  .then(data => {
      if (data.ok) {
          document.getElementById(`fecha-baja-${usuarioId}`).textContent = data.fecha_baja;
          const estado = document.getElementById(`estado-${usuarioId}`);
          estado.classList.remove('verde');
          estado.classList.add('rojo');
          estado.title = 'Dado de baja';
          const fila = document.getElementById(`fila-usuario-${usuarioId}`);
          fila.classList.add('usuario-inactivo');
          const btnTd = fila.querySelector('.btn-baja').parentElement;
          btnTd.innerHTML = `<button class="btn-icon btn-reactivar" title="Reactivar usuario" 
              onclick="confirmarReactivar(${usuarioId}, '${data.nombre}')">↺</button>`;
      }
  })
  .catch(() => alert('Error de conexión. Intentá de nuevo.'));
}

function ejecutarReactivar(usuarioId, nombreUsuario) {
  cerrarModal();
  fetch(`/admin-dashboard/usuarios-reactivar/${usuarioId}/`, {
      method: 'POST',
      headers: {
          'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)[1],
          'Content-Type': 'application/json',
      },
  })
  .then(response => response.json())
  .then(data => {
      if (data.ok) {
          document.getElementById(`fecha-baja-${usuarioId}`).textContent = '—';
          const estado = document.getElementById(`estado-${usuarioId}`);
          estado.classList.remove('rojo');
          estado.classList.add('verde');
          estado.title = 'Activo';
          const fila = document.getElementById(`fila-usuario-${usuarioId}`);
          fila.classList.remove('usuario-inactivo');
          const btnTd = fila.querySelector('.btn-reactivar').parentElement;
          btnTd.innerHTML = `<button class="btn-icon btn-baja" title="Dar de baja" 
              onclick="confirmarBaja(${usuarioId}, '${data.nombre}')">✖</button>`;
      }
  })
  .catch(() => alert('Error de conexión. Intentá de nuevo.'));
}

// ===== ROL → ÁREA AUTOMÁTICO =====
const selectRol  = document.getElementById('nuevo-rol');
const selectArea = document.getElementById('select-area');

if (selectRol && selectArea) {
  selectRol.addEventListener('change', function() {
      const rolesAdmin = ['admin', 'adminprincipal', 'usuariovip'];
      
      if (rolesAdmin.includes(this.value)) {
        selectArea.value = 'todas';
        selectArea.disabled = true;
        document.getElementById('area-hidden').value = 'todas';
    } else {
        selectArea.disabled = false;
        selectArea.value = '';
        document.getElementById('area-hidden').value = '';
    }
  });
}