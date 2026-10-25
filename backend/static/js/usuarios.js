/* ============================================
   USUARIOS.JS — lógica exclusiva de Usuarios
============================================ */

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

/* ===== ROL → ÁREA AUTOMÁTICO ===== */
const selectRol  = document.getElementById('nuevo-rol');
const selectArea = document.getElementById('select-area');

if (selectRol && selectArea) {
    selectRol.addEventListener('change', function () {
        const rolesAdmin = ['admin', 'adminprincipal', 'usuariovip'];
        if (rolesAdmin.includes(this.value)) {
            selectArea.value    = 'todas';
            selectArea.disabled = true;
            document.getElementById('area-hidden').value = 'todas';
        } else {
            selectArea.disabled = false;
            selectArea.value    = '';
            document.getElementById('area-hidden').value = '';
        }
    });
}

/* ===== CONTROL DE ALERTA FLOTANTE DE ÉXITO ===== */
function cerrarAlertaFlotante() {
    const alerta = document.getElementById('alerta-flotante-exito');
    if (alerta) {
        alerta.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        alerta.style.opacity = '0';
        alerta.style.transform = 'translate(-50%, -20px)';
        setTimeout(() => alerta.remove(), 300);
    }
}

// Ocultar automáticamente después de 10 segundos
document.addEventListener('DOMContentLoaded', () => {
    const alerta = document.getElementById('alerta-flotante-exito');
    if (alerta) {
        setTimeout(() => {
            cerrarAlertaFlotante();
        }, 10000); // 10 segundos
    }
});