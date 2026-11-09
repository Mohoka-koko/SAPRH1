document.addEventListener("DOMContentLoaded", function () {

    const centro = document.getElementById("centroNotificaciones");

    if (!centro) {
        return;
    }

    const lista = document.getElementById(
        "listaTodasNotificaciones"
    );

    const estado = document.getElementById(
        "estadoNotificaciones"
    );

    const botonesFiltro = [
        ...centro.querySelectorAll("[data-filtro]")
    ];

    const botonMarcarTodas = document.getElementById(
        "marcarTodasLeidas"
    );

    const apiUrl = centro.dataset.apiUrl;

    const marcarTodasUrl = centro.dataset.marcarTodasUrl;

    const marcarLeidaBase = centro.dataset.marcarLeidaBase;

    let filtroActual = "todas";


    // Obtener el token CSRF de Django.

    function obtenerCSRF() {

        const input = centro.querySelector(
            "[name=csrfmiddlewaretoken]"
        );

        if (input && input.value) {
            return input.value;
        }

        const cookie = document.cookie
            .split("; ")
            .find(fila => fila.startsWith("csrftoken="));

        return cookie
            ? decodeURIComponent(cookie.split("=")[1])
            : "";
    }


    // Escapar texto antes de incorporarlo al HTML.

    function escapar(texto) {

        return String(texto ?? "").replace(
            /[&<>"']/g,
            function (caracter) {

                const equivalencias = {
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                };

                return equivalencias[caracter];
            }
        );
    }


    // Consultar al servidor.

    async function consultar(url, opciones = {}) {

        const cabeceras = {
            "X-Requested-With": "XMLHttpRequest",
            ...(opciones.headers || {})
        };

        if (opciones.method === "POST") {

            cabeceras["X-CSRFToken"] = obtenerCSRF();

        }

        const respuesta = await fetch(url, {
            credentials: "same-origin",
            ...opciones,
            headers: cabeceras
        });

        if (!respuesta.ok) {

            throw new Error(
                "Error HTTP " + respuesta.status
            );

        }

        return await respuesta.json();

    }


    // Obtener la URL para marcar una notificación.

    function urlMarcarLeida(id) {

        return marcarLeidaBase.replace(
            "/0/",
            "/" + encodeURIComponent(id) + "/"
        );

    }


    // Cargar las notificaciones.

    async function cargarNotificaciones() {

        estado.hidden = false;

        estado.textContent = "Cargando notificaciones...";

        lista.replaceChildren();

        try {

            const separador = apiUrl.includes("?") ? "&" : "?";

            const url = apiUrl
                + separador
                + "filtro="
                + encodeURIComponent(filtroActual);

            const datos = await consultar(url);

            if (!datos.ok) {

                throw new Error(
                    "No se pudieron obtener las notificaciones."
                );

            }

            estado.hidden = true;

            if (!datos.notificaciones.length) {

                lista.innerHTML = `
                    <div class="noti-vacia">
                        No hay notificaciones para mostrar.
                    </div>
                `;

                return;

            }


            datos.notificaciones.forEach(function (notificacion) {

                const tarjeta = document.createElement("article");

                tarjeta.className = "noti-tarjeta";

                if (!notificacion.leida) {

                    tarjeta.classList.add("no-leida");

                }


                let icono = "!";

                if (notificacion.tipo === "imputacion") {

                    icono = "I";

                } else if (notificacion.tipo === "orden_pago") {

                    icono = "P";

                } else if (
                    notificacion.tipo === "orden_pago_personal"
                ) {

                    icono = "PP";

                }


                const iconoElemento = document.createElement("div");

                iconoElemento.className = "noti-icono";

                iconoElemento.textContent = icono;

                iconoElemento.setAttribute(
                    "aria-hidden",
                    "true"
                );


                const contenido = document.createElement("div");

                const titulo = document.createElement("h2");

                titulo.textContent = notificacion.titulo;

                const mensaje = document.createElement("p");

                mensaje.className = "noti-mensaje";

                mensaje.textContent = notificacion.mensaje;

                const fecha = document.createElement("span");

                fecha.className = "noti-meta";

                fecha.textContent =
                    notificacion.creada_en
                    + " · "
                    + (
                        notificacion.leida
                            ? "Leída"
                            : "No leída"
                    );


                contenido.appendChild(titulo);

                contenido.appendChild(mensaje);

                contenido.appendChild(fecha);


                tarjeta.appendChild(iconoElemento);

                tarjeta.appendChild(contenido);


                // Botón para abrir el detalle de la operación.

                if (notificacion.url) {

                    const boton = document.createElement("button");

                    boton.type = "button";

                    boton.className = "noti-accion";

                    boton.textContent = "Ver detalle";

                    boton.addEventListener("click", async function () {

                        try {

                            const destino = new URL(
                                notificacion.url,
                                window.location.origin
                            );

                            // Solo permitir destinos del mismo sitio.

                            if (
                                destino.origin !== window.location.origin
                            ) {

                                throw new Error(
                                    "La dirección de destino no es válida."
                                );

                            }

                            if (!notificacion.leida) {

                                await consultar(
                                    urlMarcarLeida(notificacion.id),
                                    {
                                        method: "POST"
                                    }
                                );

                            }

                            window.location.assign(destino.href);

                        } catch (error) {

                            console.error(error);

                            estado.hidden = false;

                            estado.textContent =
                                "No se pudo abrir la notificación.";

                        }

                    });

                    tarjeta.appendChild(boton);

                } else if (!notificacion.leida) {

                    const boton = document.createElement("button");

                    boton.type = "button";

                    boton.className = "noti-accion";

                    boton.textContent = "Marcar como leída";

                    boton.addEventListener("click", async function () {

                        try {

                            await consultar(
                                urlMarcarLeida(notificacion.id),
                                {
                                    method: "POST"
                                }
                            );

                            await cargarNotificaciones();

                        } catch (error) {

                            console.error(error);

                            estado.hidden = false;

                            estado.textContent =
                                "No se pudo marcar como leída.";

                        }

                    });

                    tarjeta.appendChild(boton);

                }


                lista.appendChild(tarjeta);

            });

        } catch (error) {

            console.error(
                "Error cargando notificaciones:",
                error
            );

            estado.hidden = false;

            estado.textContent =
                "No se pudieron cargar las notificaciones. "
                + "Comprobá la conexión con el servidor.";

        }

    }


    // Cambiar los filtros.

    botonesFiltro.forEach(function (boton) {

        boton.addEventListener("click", function () {

            filtroActual = boton.dataset.filtro;

            botonesFiltro.forEach(function (otro) {

                otro.classList.toggle(
                    "activo",
                    otro === boton
                );

            });

            cargarNotificaciones();

        });

    });


    // Marcar todas las notificaciones como leídas.

    if (botonMarcarTodas) {

        botonMarcarTodas.addEventListener(
            "click",
            async function () {

                botonMarcarTodas.disabled = true;

                try {

                    await consultar(
                        marcarTodasUrl,
                        {
                            method: "POST"
                        }
                    );

                    await cargarNotificaciones();

                } catch (error) {

                    console.error(error);

                    estado.hidden = false;

                    estado.textContent =
                        "No se pudieron actualizar las notificaciones.";

                } finally {

                    botonMarcarTodas.disabled = false;

                }

            }
        );

    }


    // Primera carga.

    cargarNotificaciones();

});