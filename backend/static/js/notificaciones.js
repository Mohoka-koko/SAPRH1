document.addEventListener("DOMContentLoaded", function () {

    const notificationBtn = document.getElementById("notificationBtn");
    const notificationPanel = document.getElementById("notificationPanel");
    const notificationClose = document.getElementById("notificationClose");


    // Abrir / cerrar al hacer clic en la campana

    notificationBtn.addEventListener("click", function (event) {

        event.stopPropagation();

        notificationPanel.classList.toggle("active");

    });


    // Cerrar con la X

    notificationClose.addEventListener("click", function () {

        notificationPanel.classList.remove("active");

    });


    // Evita que un clic dentro del panel lo cierre

    notificationPanel.addEventListener("click", function (event) {

        event.stopPropagation();

    });


    // Cerrar si hacemos clic fuera del panel

    document.addEventListener("click", function () {

        notificationPanel.classList.remove("active");

    });

});