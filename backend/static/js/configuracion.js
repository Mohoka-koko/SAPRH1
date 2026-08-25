function abrirModal(tipo) {

    const modal = document.getElementById("modal");
    const contenido = document.getElementById("contenidoModal");

    // Mostrar modal
    modal.style.display = "flex";


    // =====================================
    // CAMBIAR CONTRASEÑA
    // =====================================

    if (tipo === "password") {

        contenido.innerHTML = `

            <h2 class="modal-titulo">
                Cambiar contraseña
            </h2>

            <label class="modal-label">
                Contraseña actual
            </label>

            <input
                type="password"
                class="modal-input"
                placeholder="Ingrese su contraseña actual"
            >

            <label class="modal-label">
                Nueva contraseña
            </label>

            <input
                type="password"
                class="modal-input"
                placeholder="Ingrese la nueva contraseña"
            >

            <label class="modal-label">
                Confirmar nueva contraseña
            </label>

            <input
                type="password"
                class="modal-input"
                placeholder="Repita la nueva contraseña"
            >

            <button class="modal-boton">
                Cambiar contraseña
            </button>

        `;
    }


    // =====================================
    // CAMBIAR FOTO DE PERFIL
    // =====================================

    else if (tipo === "perfil") {

        contenido.innerHTML = `

            <h2 class="modal-titulo">
                Cambiar foto de perfil
            </h2>

            <label class="modal-label">
                Seleccionar nueva foto
            </label>

            <input
                type="file"
                class="modal-input"
                accept="image/*"
            >

            <button class="modal-boton">
                Guardar foto
            </button>

        `;
    }


    // =====================================
    // FORMATO DE FECHA Y HORA
    // =====================================

    else if (tipo === "fecha") {

        contenido.innerHTML = `

            <h2 class="modal-titulo">
                Formato de fecha y hora
            </h2>

            <label class="modal-label">
                Formato de fecha
            </label>

            <select class="modal-input">

                <option value="dd/mm/yyyy">
                    DD/MM/YYYY
                </option>

                <option value="mm/dd/yyyy">
                    MM/DD/YYYY
                </option>

                <option value="yyyy-mm-dd">
                    YYYY-MM-DD
                </option>

            </select>


            <label class="modal-label">
                Formato de hora
            </label>

            <select class="modal-input">

                <option value="24">
                    24 horas
                </option>

                <option value="12">
                    12 horas (AM/PM)
                </option>

            </select>


            <button class="modal-boton">
                Guardar configuración
            </button>

        `;
    }


    // =====================================
    // NOTIFICACIONES Y PREFERENCIAS
    // =====================================

    else if (tipo === "notificaciones") {

        contenido.innerHTML = `

            <h2 class="modal-titulo">
                Notificaciones y preferencias
            </h2>


            <label class="modal-label">
                Notificaciones
            </label>

            <label>
                <input type="checkbox">
                Recibir notificaciones del sistema
            </label>

            <br><br>

            <label>
                <input type="checkbox">
                Mostrar avisos importantes
            </label>

            <br><br>


            <button class="modal-boton">
                Guardar preferencias
            </button>

        `;
    }


    // =====================================
    // INFORMACIÓN DEL SISTEMA
    // =====================================

    else if (tipo === "info") {

        contenido.innerHTML = `

            <h2 class="modal-titulo">
                Información del sistema
            </h2>

            <p>
                <strong>Sistema:</strong> S.A.P.R.H
            </p>

            <p>
                <strong>Versión:</strong> 1.0
            </p>

            <p>
                <strong>Descripción:</strong>
                Sistema de Administración de Presupuesto
                y Recursos Humanos.
            </p>

        `;
    }
}


/* =====================================
   CERRAR MODAL
===================================== */

function cerrarModal() {

    const modal = document.getElementById("modal");

    modal.style.display = "none";
}


/* =====================================
   CERRAR AL HACER CLIC FUERA
===================================== */

window.addEventListener("click", function(event) {

    const modal = document.getElementById("modal");

    if (event.target === modal) {

        cerrarModal();

    }

});