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
                Cambiar contraseña de usuario
            </h2>

            <label class="modal-label">
                Usuario
            </label>

            <select id="usuarioCambioPassword" class="modal-input">
                <option value="">Cargando usuarios...</option>
            </select>

            <label class="modal-label">
                Nueva contraseña
            </label>

            <input
                type="password"
                id="nuevaContrasena"
                class="modal-input"
                placeholder="Ingrese la nueva contraseña"
            >

            <label class="modal-label">
                Confirmar nueva contraseña
            </label>

            <input
                type="password"
                id="confirmarContrasena"
                class="modal-input"
                placeholder="Repita la nueva contraseña"
            >

            <label class="modal-label">
                Tu contraseña de administrador (para confirmar)
            </label>

            <input
                type="password"
                id="contrasenaAdmin"
                class="modal-input"
                placeholder="Ingrese su propia contraseña"
            >

            <p id="mensajePassword" class="modal-mensaje"></p>

            <button
                type="button"
                class="modal-boton"
                onclick="cambiarContrasena()"
            >
                Cambiar contraseña
            </button>

        `;

        cargarUsuariosContrasena();
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
                id="fotoPerfil"
                class="modal-input"
                accept="image/*"
            >

            <p id="mensajeFoto" class="modal-mensaje"></p>

            <button
                type="button"
                class="modal-boton"
                onclick="guardarFotoPerfil()"
            >
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
   

   // =====================================
// HISTORIAL DE ACCESOS
// =====================================

else if (tipo === "historial") {

    contenido.innerHTML = `

        <h2 class="modal-titulo">
            Historial de accesos
        </h2>

        <div id="historialAccesos">

            <p class="modal-mensaje">
                Cargando usuarios...
            </p>

        </div>

    `;

    cargarHistorialAccesos();
}
}


// =====================================
// CAMBIAR CONTRASEÑA
// =====================================

function cargarUsuariosContrasena() {

    const select = document.getElementById("usuarioCambioPassword");

    fetch("/admin-dashboard/configuracion/usuarios-contrasena/")

    .then(response => response.json())

    .then(data => {

        select.innerHTML = "";

        const inicial = document.createElement("option");
        inicial.value = "";
        inicial.textContent = "Seleccionar usuario...";
        select.appendChild(inicial);

        data.usuarios.forEach(u => {
            const opcion = document.createElement("option");
            opcion.value = u.id;
            opcion.textContent =
                u.nombre + " (" + u.email + ") - " + u.rol +
                (u.activo ? "" : " [inactivo]");
            select.appendChild(opcion);
        });

    })

    .catch(error => {
        console.error("Error:", error);
        select.innerHTML =
            "<option value=''>No se pudieron cargar los usuarios</option>";
    });
}


function cambiarContrasena() {

    const usuarioId =
        document.getElementById("usuarioCambioPassword").value;

    const nuevaContrasena =
        document.getElementById("nuevaContrasena").value;

    const confirmarContrasena =
        document.getElementById("confirmarContrasena").value;

    const contrasenaAdmin =
        document.getElementById("contrasenaAdmin").value;

    const mensaje =
        document.getElementById("mensajePassword");


    if (!usuarioId || !nuevaContrasena || !confirmarContrasena || !contrasenaAdmin) {

        mensaje.textContent =
            "Todos los campos son obligatorios.";

        return;
    }


    if (nuevaContrasena !== confirmarContrasena) {

        mensaje.textContent =
            "Las nuevas contraseñas no coinciden.";

        return;
    }


    const datos = new FormData();

    datos.append("usuario_id", usuarioId);
    datos.append("nueva_contrasena", nuevaContrasena);
    datos.append("confirmar_contrasena", confirmarContrasena);
    datos.append("contrasena_admin", contrasenaAdmin);

    const csrfToken = obtenerCSRFToken();


    fetch("/admin-dashboard/configuracion/cambiar-contrasena/", {

        method: "POST",

        headers: {
            "X-CSRFToken": csrfToken
        },

        body: datos

    })

    .then(response => response.json())

    .then(data => {

        mensaje.textContent = data.mensaje;

        if (data.ok) {

            document.getElementById("usuarioCambioPassword").value = "";
            document.getElementById("nuevaContrasena").value = "";
            document.getElementById("confirmarContrasena").value = "";
            document.getElementById("contrasenaAdmin").value = "";

        }

    })

    .catch(error => {

        console.error("Error:", error);

        mensaje.textContent =
            "Ocurrió un error al cambiar la contraseña.";

    });
}
// =====================================
// CAMBIAR FOTO DE PERFIL
// =====================================

function guardarFotoPerfil() {

    const input = document.getElementById("fotoPerfil");
    const mensaje = document.getElementById("mensajeFoto");

    // Verificar que se haya seleccionado una foto
    if (!input.files.length) {

        mensaje.textContent =
            "Seleccioná una foto.";

        return;
    }


    // Crear los datos que enviaremos a Django
    const datos = new FormData();

    datos.append(
        "foto_perfil",
        input.files[0]
    );


    // Obtener token CSRF
    const csrfToken = obtenerCSRFToken();


    // Enviar foto al backend
    fetch("/admin-dashboard/configuracion/cambiar-foto/", {

        method: "POST",

        headers: {
            "X-CSRFToken": csrfToken
        },

        body: datos

    })

    .then(response => response.json())

    .then(data => {

        mensaje.textContent =
            data.mensaje;


        if (data.ok) {

            // Limpiar el selector de archivo
            input.value = "";

        }

    })

    .catch(error => {

        console.error("Error:", error);

        mensaje.textContent =
            "Ocurrió un error al subir la foto.";

    });
}
// =====================================
// CARGAR HISTORIAL DE ACCESOS
// =====================================

function cargarHistorialAccesos() {

    const contenedor =
        document.getElementById("historialAccesos");

    fetch("/admin-dashboard/configuracion/historial-accesos/")

        .then(response => response.json())

        .then(data => {

            if (!data.ok) {

                contenedor.innerHTML = `
                    <p class="modal-mensaje">
                        ${data.mensaje}
                    </p>
                `;

                return;
            }


            if (!data.usuarios.length) {

                contenedor.innerHTML = `
                    <p class="modal-mensaje">
                        No hay usuarios registrados.
                    </p>
                `;

                return;
            }


            let filas = "";


            data.usuarios.forEach(usuario => {

                filas += `

                    <tr>

                        <td>
                            ${usuario.nombre}
                        </td>

                        <td>

                            <span class="${
                                usuario.activo
                                ? 'estado-activo'
                                : 'estado-inactivo'
                            }">

                                ${
                                    usuario.activo
                                    ? 'Activo'
                                    : 'Inactivo'
                                }

                            </span>

                        </td>

                        <td>
                            ${usuario.ultimo_acceso}
                        </td>

                    </tr>

                `;

            });


            contenedor.innerHTML = `

                <div class="tabla-historial-wrapper">

                    <table class="tabla-historial">

                        <thead>

                            <tr>

                                <th>
                                    Nombre de los usuarios
                                </th>

                                <th>
                                    Estado
                                </th>

                                <th>
                                    Última vez que entró
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            ${filas}

                        </tbody>

                    </table>

                </div>

            `;

        })


        .catch(error => {

            console.error(
                "Error al cargar historial:",
                error
            );

            contenedor.innerHTML = `

                <p class="modal-mensaje">
                    Ocurrió un error al cargar el historial.
                </p>

            `;

        });
}

// =====================================
// OBTENER TOKEN CSRF
// =====================================

function obtenerCSRFToken() {

    const nombre = "csrftoken=";

    const cookies = document.cookie.split(";");

    for (let cookie of cookies) {

        cookie = cookie.trim();

        if (cookie.startsWith(nombre)) {

            return decodeURIComponent(
                cookie.substring(nombre.length)
            );

        }

    }

    return "";
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