/* ============================================
   USUARIOS.JS — lógica exclusiva de Usuarios
============================================ */

// Lee la cookie CSRF sin romper si no existe
function getCsrfToken() {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : '';
}

// Crea el botón de la columna "Acción" sin insertar el nombre en HTML
function crearBotonAccion(tipo, usuarioId, nombre) {
    const btn = document.createElement('button');
    btn.type = 'button';
    if (tipo === 'baja') {
        btn.className = 'btn-icon btn-baja';
        btn.title = 'Dar de baja';
        btn.textContent = '✖';
        btn.addEventListener('click', () => confirmarBaja(usuarioId, nombre));
    } else {
        btn.className = 'btn-icon btn-reactivar';
        btn.title = 'Reactivar usuario';
        btn.textContent = '↺';
        btn.addEventListener('click', () => confirmarReactivar(usuarioId, nombre));
    }
    return btn;
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

// Cerrar el modal con Escape o haciendo clic fuera de la caja
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModal();
});
document.getElementById('modal-baja')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-baja') cerrarModal();
});

function ejecutarBaja(usuarioId, nombreUsuario) {
    cerrarModal();
    fetch(`/admin-dashboard/usuarios-baja/${usuarioId}/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCsrfToken(),
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
            btnTd.replaceChildren(crearBotonAccion('reactivar', usuarioId, data.nombre || nombreUsuario));
        }
    })
    .catch(() => alert('Error de conexión. Intentá de nuevo.'));
}

function ejecutarReactivar(usuarioId, nombreUsuario) {
    cerrarModal();
    fetch(`/admin-dashboard/usuarios-reactivar/${usuarioId}/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCsrfToken(),
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
            btnTd.replaceChildren(crearBotonAccion('baja', usuarioId, data.nombre || nombreUsuario));
        }
    })
    .catch(() => alert('Error de conexión. Intentá de nuevo.'));
}

/* ===== ROL → ÁREA AUTOMÁTICO ===== */
const selectRol  = document.getElementById('nuevo-rol');
const selectArea = document.getElementById('select-area');
const areaHidden = document.getElementById('area-hidden');

if (selectRol && selectArea) {
    selectRol.addEventListener('change', function () {
        const rolesAdmin = ['admin', 'adminprincipal', 'usuariovip'];
        if (rolesAdmin.includes(this.value)) {
            // El select deshabilitado no se envía: lo reemplaza el campo oculto
            selectArea.value    = 'todas';
            selectArea.disabled = true;
            areaHidden.value    = 'todas';
            areaHidden.disabled = false;
        } else {
            // El select se envía solo; el oculto se desactiva para no duplicar "area"
            selectArea.disabled = false;
            selectArea.value    = '';
            areaHidden.disabled = true;
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