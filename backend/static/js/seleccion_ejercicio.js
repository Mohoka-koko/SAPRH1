document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar los años disponibles en la lista lateral
    cargarListaAnios();

    // 2. Abrir el modal al hacer clic en el botón azul
    document.getElementById("btnNuevoEjercicio").addEventListener("click", () => {
        document.getElementById("modalAnio").classList.add("active");
        document.getElementById("inputAnio").focus();
    });

    // 3. Permitir cerrar el modal con la tecla Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") cerrarModal();
    });
});

// Función para traer los años de la BD
async function cargarListaAnios() {
    const lista = document.getElementById("listaAnios");
    try {
        const resp = await fetch('/api/ejercicios-anteriores/anios/');
        const data = await resp.json();
        
        if (data.anios && data.anios.length > 0) {
            lista.innerHTML = data.anios.map(anio => `<li>Ejercicio ${anio}</li>`).join("");
        } else {
            lista.innerHTML = "<li>No hay ejercicios anteriores</li>";
        }
    } catch (err) {
        lista.innerHTML = "<li>Error al cargar</li>";
    }
}

// Función para cerrar el modal
function cerrarModal() {
    document.getElementById("modalAnio").classList.remove("active");
    document.getElementById("inputAnio").value = "";
    document.getElementById("alertaFlotanteError").style.display = "none";
}

// Función que se ejecuta al tocar "Aceptar"
async function verificarYContinuar() {
    const anioIngresado = document.getElementById("inputAnio").value.trim();
    const alerta = document.getElementById("alertaFlotanteError");
    const textoAlerta = document.getElementById("textoAlertaError");

    // Validación básica
    if (!anioIngresado || anioIngresado.length !== 4) {
        textoAlerta.textContent = "Por favor, ingresá un año válido (4 dígitos).";
        alerta.style.display = "flex";
        return;
    }

    try {
        // Consultamos a la API si ese año ya tiene presupuesto
        const resp = await fetch(`/api/home/lineas/?ejercicio=${anioIngresado}`);
        const data = await resp.json();

        // Si hay líneas presupuestarias, el año ya existe
        if (data.lineas && data.lineas.length > 0) {
            textoAlerta.textContent = "El año ingresado ya existe en la base de datos.";
            alerta.style.display = "flex";
            return;
        }

        // Si no existe, redirigimos a la carga pasando el año por la URL
        // Ejemplo: /admin-dashboard/home/cargarpresupuesto/?anio=2027
        window.location.href = `/admin-dashboard/home/cargarpresupuesto/?anio=${anioIngresado}`;

    } catch (err) {
        console.error("Error al verificar el año:", err);
        textoAlerta.textContent = "Error de conexión. Intentá nuevamente.";
        alerta.style.display = "flex";
    }
}