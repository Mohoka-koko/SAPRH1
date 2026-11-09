
document.addEventListener("DOMContentLoaded", function () {

    const notificationBtn = document.getElementById("notificationBtn");
    const notificationPanel = document.getElementById("notificationPanel");
    const notificationClose = document.getElementById("notificationClose");
    const notificationBody = document.getElementById("notificationBody");

    if (!notificationBtn || !notificationPanel || !notificationClose || !notificationBody) {
        return;
    }

    const apiUrl = notificationPanel.dataset.apiUrl;

    // Consultar las notificaciones del usuario conectado
    async function cargarNotificaciones() {

        notificationBody.textContent = "Cargando notificaciones...";

        try {

            const respuesta = await fetch(apiUrl, {
                method: "GET",
                headers: {
                    "X-Requested-With": "XMLHttpRequest"
                },
                credentials: "same-origin"
            });

            if (!respuesta.ok) {
                throw new Error("No se pudieron consultar las notificaciones.");
            }

            const datos = await respuesta.json();

            notificationBody.replaceChildren();
            
            notificationBody.style.setProperty("display", "flex", "important");
            notificationBody.style.setProperty("flex-direction", "column", "important");
            notificationBody.style.setProperty("align-items", "stretch", "important");
            notificationBody.style.setProperty("width", "100%", "important");
            notificationBody.style.setProperty("gap", "12px", "important");

            if (!datos.notificaciones || datos.notificaciones.length === 0) {

                const mensaje = document.createElement("p");
                mensaje.textContent = "Usted no tiene notificaciones";
                notificationBody.appendChild(mensaje);

                return;
            }

            // Mostrar las últimas cinco notificaciones
            datos.notificaciones.slice(0, 5).forEach(function (notificacion) {

                const item = document.createElement("div");
                item.className = "notification-item";

                item.style.setProperty("display", "block", "important");
                item.style.setProperty("width", "100%", "important");
                item.style.setProperty("max-width", "100%", "important");
                item.style.setProperty("box-sizing", "border-box", "important");
                item.style.setProperty("float", "none", "important");
                item.style.setProperty("margin", "0 0 10px 0", "important");
                item.style.setProperty("padding", "12px", "important");
                item.style.setProperty("text-align", "left", "important");

                if (!notificacion.leida) {
                    item.classList.add("no-leida");
                }

                const titulo = document.createElement("strong");
                titulo.textContent = notificacion.titulo;

                const mensaje = document.createElement("p");
                mensaje.textContent = notificacion.mensaje;

                const fecha = document.createElement("small");
                fecha.textContent = notificacion.creada_en;

                item.appendChild(titulo);
                item.appendChild(mensaje);
                item.appendChild(fecha);

                if (notificacion.url) {

                    const enlace = document.createElement("a");
                    enlace.href = notificacion.url;
                    enlace.textContent = "Ver detalle";

                    item.appendChild(enlace);
                }

                notificationBody.appendChild(item);

            });

        } catch (error) {

            console.error("Error al cargar notificaciones:", error);

            notificationBody.textContent =
                "No se pudieron cargar las notificaciones.";

        }
    }

    // Abrir y cerrar la ventana
    notificationBtn.addEventListener("click", function (event) {

        event.stopPropagation();

        notificationPanel.classList.toggle("active");

        if (notificationPanel.classList.contains("active")) {
            cargarNotificaciones();
        }

    });

    // Cerrar con la X
    notificationClose.addEventListener("click", function () {

        notificationPanel.classList.remove("active");

    });

    // Evitar que un clic dentro del panel lo cierre
    notificationPanel.addEventListener("click", function (event) {

        event.stopPropagation();

    });

    // Cerrar al hacer clic fuera
    document.addEventListener("click", function () {

        notificationPanel.classList.remove("active");

    });

});
