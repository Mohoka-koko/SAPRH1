function getCSRFToken() {
  const input = document.querySelector('[name=csrfmiddlewaretoken]');
  if (input) return input.value;
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

function llenarSelect(select, items, valueKey, labelFn, placeholder, disabled = false) {
    select.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item[valueKey];
        opt.textContent = labelFn(item);
        select.appendChild(opt);
    });
    select.disabled = disabled;
}

function mostrarToast(mensaje) {
  const toast = document.getElementById('toast');
  toast.textContent = mensaje;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}



/* ==========================================================================
   CONTROL DE PRESUPUESTO GENERAL (Faltante)
   ========================================================================== */
const CLAVE_STORAGE_PRESUPUESTO = "presupuestoGeneralInicial";
let totalGeneralCalculado = 0;

function restaurarPresupuestoGeneral() {
    const guardado = localStorage.getItem(CLAVE_STORAGE_PRESUPUESTO);
    if (guardado !== null) {
        // Asegúrate de que el input exista en el HTML donde usas crear_partida.js
        const input = document.getElementById("presupuestoGeneralInicial");
        if(input) input.value = guardado;
    }
}

function validarPresupuestoGeneral() {
    const input = document.getElementById("presupuestoGeneralInicial");
    const btnCrear = document.getElementById("btnCrearPresupuesto"); 
    const alerta = document.getElementById("alertaDescuadre");
    const celdaTotal = document.getElementById("totalGeneral");

    // Si los elementos no existen en esta vista, evitamos errores
    if (!input || !celdaTotal) return;

    const valor = parseFloat(input.value);
    const tieneValor = input.value.trim() !== "" && !isNaN(valor) && valor > 0;

    // Persistimos el valor para no perderlo
    if (tieneValor) {
        localStorage.setItem(CLAVE_STORAGE_PRESUPUESTO, input.value);
    } else {
        localStorage.removeItem(CLAVE_STORAGE_PRESUPUESTO);
    }

    // Sin valor cargado: botón bloqueado, sin comparación todavía
    if (!tieneValor) {
        if(btnCrear) btnCrear.disabled = true;
        if(alerta) alerta.style.display = "none";
        celdaTotal.classList.remove("total-ok", "total-descuadrado");
        return;
    }

    // El total cargado no debe superar el presupuesto general disponible
    const excedido = totalGeneralCalculado - valor > 0.01;

    if (!excedido) {
        if(btnCrear) btnCrear.disabled = false;
        if(alerta) alerta.style.display = "none";
        celdaTotal.classList.remove("total-descuadrado");
        celdaTotal.classList.add("total-ok");
    } else {
        if(btnCrear) btnCrear.disabled = true;
        if(alerta) alerta.style.display = "inline-block";
        celdaTotal.classList.remove("total-ok");
        celdaTotal.classList.add("total-descuadrado");
    }
}

/* ==========================================================================
    TABLA DE PRESUPUESTO (Actualizada)
    Cada <td> lleva data-label para mostrar el título en la vista móvil.
    ========================================================================== */
async function cargarTabla() {
    try {
        const resp = await fetch("/api/linea-presupuestaria/listar/");
        const data = await resp.json();
        const tbody = document.getElementById("tablaPartidas");
        tbody.innerHTML = "";
        let total = 0;

        data.lineas.forEach((l) => {
            tbody.innerHTML += `
                <tr>
                    <td data-label="Prog">${l.prog}</td>
                    <td data-label="Subp">${l.subp}</td>
                    <td data-label="Py">${l.py}</td>
                    <td data-label="A/O">${l.ao}</td>
                    <td data-label="Part.">${l.partida}</td>
                    <td data-label="Denominación">${l.denominacion}</td>
                    <td data-label="Fuente">${l.fuente}</td>
                    <td data-label="Presupuesto">$${Number(l.saldo_inicial).toLocaleString("es-AR")}</td>
                </tr>
            `;
            total += parseFloat(l.saldo_inicial);
        });

        // Almacenar el total en la variable global para la validación
        totalGeneralCalculado = total;

        document.getElementById("totalGeneral").textContent =
            "$" + total.toLocaleString("es-AR", { minimumFractionDigits: 2 });

        // Revalida contra lo que haya cargado en el campo de presupuesto general
        validarPresupuestoGeneral();

    } catch (err) {
        console.error("Error cargando tabla:", err);
    }
}

function buscarPartida() {
    const filtro = document.getElementById("buscador").value.toLowerCase();
    document.querySelectorAll("#tablaPartidas tr").forEach((fila) => {
        fila.style.display = fila.textContent.toLowerCase().includes(filtro) ? "" : "none";
    });
}

/* ==========================================================================
   MODAL: CREAR PARTIDA
   ========================================================================== */
function abrirModalPartida() {
    document.getElementById('inputCodigoPartida').value = '';
    document.getElementById('inputDenominacionPartida').value = '';
    document.getElementById('modalOverlayPartida').classList.add('open');
    setTimeout(() => document.getElementById('inputCodigoPartida').focus(), 50);
}

function cerrarModalPartida() {
    document.getElementById('modalOverlayPartida').classList.remove('open');
}

async function guardarPartida() {
    const codigo = document.getElementById('inputCodigoPartida').value.trim();
    const denom = document.getElementById('inputDenominacionPartida').value.trim();

    if (!codigo || !denom) {
        alert('Completá código y denominación.');
        return;
    }

    const payload = { tipo: 'Partida', codigo, denominacion: denom };

    try {
        const resp = await fetch('/api/catalogos/crear/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken(),
            },
            body: JSON.stringify(payload),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Error al guardar');

        cerrarModalPartida();
        mostrarToast(`✓ Partida "${denom}" guardada correctamente`);
    } catch (err) {
        alert(err.message);
    }
}

/* ==========================================================================
   MODAL: CREAR UP (Unidad Presupuestaria)
   ========================================================================== */
async function cargarSelectsUP() {
    const respPrg = await fetch("/api/programas/");
    const dataPrg = await respPrg.json();
    llenarSelect(
        document.getElementById("prog"),
        dataPrg.programas, "id",
        (p) => `${p.codigo_programa} - ${p.nombre}`,
        "Seleccionar programa..."
    );

    const respPar = await fetch("/api/partidas/");
    const dataPar = await respPar.json();
    llenarSelect(
        document.getElementById("partida"),
        dataPar.partidas, "id",
        (p) => `${p.codigo} - ${p.denominacion}`,
        "Seleccionar partida..."
    );

    const respFuente = await fetch("/api/fuentes/");
    const dataFuente = await respFuente.json();
    llenarSelect(
        document.getElementById("fuente"),
        dataFuente.fuentes, "id",
        (f) => `${f.codigo} - ${f.nombre}`,
        "Seleccionar fuente..."
    );
}

document.getElementById("prog").addEventListener("change", async function () {
    const selectPy = document.getElementById("py");
    const selectAo = document.getElementById("ao");
    llenarSelect(selectPy, [], "id", () => "", "Seleccionar proyecto...", true);
    llenarSelect(selectAo, [], "id", () => "", "Seleccionar actividad...", true);
    if (!this.value) return;

    const resp = await fetch(`/api/proyectos/?programa_id=${this.value}`);
    const data = await resp.json();
    llenarSelect(
        selectPy, data.proyectos, "id",
        (p) => `${p.codigo_proyecto} - ${p.nombre}`,
        "Seleccionar proyecto..."
    );
    selectPy.disabled = false;
});

document.getElementById("py").addEventListener("change", async function () {
    const selectAo = document.getElementById("ao");
    llenarSelect(selectAo, [], "id", () => "", "Seleccionar actividad...", true);
    if (!this.value) return;

    const resp = await fetch(`/api/actividades/?proyecto_id=${this.value}`);
    const data = await resp.json();
    llenarSelect(
        selectAo, data.actividades, "id",
        (a) => `${a.codigo_act_obra} - ${a.nombre}`,
        "Seleccionar actividad..."
    );
    selectAo.disabled = false;
});

document.getElementById("partida").addEventListener("change", function () {
    const opt = this.options[this.selectedIndex];
    if (this.value) {
        const texto = opt.textContent.trim();
        const denominacion = texto.substring(texto.indexOf(" - ") + 3);
        document.getElementById("nombre").value = denominacion;
    } else {
        document.getElementById("nombre").value = "";
    }
});

function abrirModalUP() {
    document.getElementById("modalUP").style.display = "block";
    limpiarFormularioUP(); // Resetea el formulario y bloquea presupuesto en '00,00'
    cargarSelectsUP();
}

function cerrarModalUP() {
    document.getElementById("modalUP").style.display = "none";
    limpiarFormularioUP();
}

function limpiarFormularioUP() {
    document.getElementById("prog").innerHTML    = '<option value="">Seleccionar programa...</option>';
    document.getElementById("py").innerHTML      = '<option value="">Seleccionar proyecto...</option>';
    document.getElementById("ao").innerHTML      = '<option value="">Seleccionar actividad...</option>';
    document.getElementById("partida").innerHTML = '<option value="">Seleccionar partida...</option>';
    document.getElementById("fuente").innerHTML  = '<option value="">Seleccionar fuente...</option>';
    document.getElementById("nombre").value      = "";

    // Fijar presupuesto en '00,00' y dejarlo no editable
    // (corregido: el id en el HTML es "presupuestoInicial")
    const inputPresupuesto = document.getElementById("presupuestoInicial");
    if (inputPresupuesto) {
        inputPresupuesto.value = "00,00";
        inputPresupuesto.readOnly = true;
    }

    document.getElementById("py").disabled       = true;
    document.getElementById("ao").disabled       = true;
}

async function guardarUP() {
    const progId    = document.getElementById("prog").value;
    const pyId      = document.getElementById("py").value;
    const aoId      = document.getElementById("ao").value;
    const partidaId = document.getElementById("partida").value;
    const fuenteId  = document.getElementById("fuente").value;

    // Se quitó la validación de presupuesto porque ya no es ingresado por el usuario
    if (!progId || !pyId || !aoId || !partidaId || !fuenteId) {
        alert("Completá todos los campos antes de guardar.");
        return;
    }

    const payload = {
        programa_id:         progId,
        proyecto_id:         pyId,
        actividad_id:        aoId,
        partida_id:          partidaId,
        fuente_id:           fuenteId,
        presupuesto_inicial: "00,00", // Se guarda en 00,00
    };

    try {
        const resp = await fetch("/api/linea-presupuestaria/crear/", {
            method:  "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken":  getCSRFToken(),
            },
            body: JSON.stringify(payload),
        });

        const data = await resp.json();

        if (resp.ok) {
            mostrarToast(data.mensaje || "✓ UP guardada correctamente");
            cerrarModalUP();
            cargarTabla();
        } else {
            alert("Error: " + (data.error || "revisá los datos."));
        }
    } catch (err) {
        console.error("Error guardando línea presupuestaria:", err);
        alert("Error de red al guardar.");
    }
}

window.onclick = function (e) {
    const modalUP = document.getElementById("modalUP");
    if (e.target === modalUP) cerrarModalUP();
};

/* ==========================================================================
   INICIALIZAR
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('modalOverlayPartida').addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlayPartida') cerrarModalPartida();
    });
});

restaurarPresupuestoGeneral();
cargarTabla();