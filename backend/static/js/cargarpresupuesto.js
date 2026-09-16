function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
        const cookies = document.cookie.split(";");
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + "=")) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
const csrftoken = getCookie("csrftoken");

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

// ── Control de presupuesto general inicial ───────────────────────────────
const CLAVE_STORAGE_PRESUPUESTO = "presupuestoGeneralInicial";
let totalGeneralCalculado = 0;

function restaurarPresupuestoGeneral() {
    const guardado = localStorage.getItem(CLAVE_STORAGE_PRESUPUESTO);
    if (guardado !== null) {
        document.getElementById("presupuestoGeneralInicial").value = guardado;
    }
}

function validarPresupuestoGeneral() {
    const input = document.getElementById("presupuestoGeneralInicial");
    const btnCrear = document.getElementById("btnCrearPresupuesto");
    const alerta = document.getElementById("alertaDescuadre");
    const celdaTotal = document.getElementById("totalGeneral");

    const valor = parseFloat(input.value);
    const tieneValor = input.value.trim() !== "" && !isNaN(valor) && valor > 0;

    // Persistimos el valor para no perderlo si se cierra la página a mitad de carga
    if (tieneValor) {
        localStorage.setItem(CLAVE_STORAGE_PRESUPUESTO, input.value);
    } else {
        localStorage.removeItem(CLAVE_STORAGE_PRESUPUESTO);
    }

    // Sin valor cargado: botón bloqueado, sin comparación todavía
    if (!tieneValor) {
        btnCrear.disabled = true;
        alerta.style.display = "none";
        celdaTotal.classList.remove("total-ok", "total-descuadrado");
        return;
    }

    // El total cargado no debe superar el presupuesto general disponible
    // (puede ser menor mientras se sigue cargando; solo se bloquea si se pasa)
    const excedido = totalGeneralCalculado - valor > 0.01;

    if (!excedido) {
        btnCrear.disabled = false;
        alerta.style.display = "none";
        celdaTotal.classList.remove("total-descuadrado");
        celdaTotal.classList.add("total-ok");
    } else {
        btnCrear.disabled = true;
        alerta.style.display = "inline-block";
        celdaTotal.classList.remove("total-ok");
        celdaTotal.classList.add("total-descuadrado");
    }
}

// ── Cargar tabla al iniciar ──────────────────────────────────────────────
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
                    <td>${l.prog}</td>
                    <td>${l.subp}</td>
                    <td>${l.py}</td>
                    <td>${l.ao}</td>
                    <td>${l.partida}</td>
                    <td>${l.denominacion}</td>
                    <td>${l.fuente}</td>
                    <td>$${Number(l.saldo_inicial).toLocaleString("es-AR")}</td>
                </tr>
            `;
            total += parseFloat(l.saldo_inicial);
        });

        totalGeneralCalculado = total;

        document.getElementById("totalGeneral").textContent =
            "$" + total.toLocaleString("es-AR", { minimumFractionDigits: 2 });

        // Revalida contra lo que haya cargado en el campo de presupuesto general
        validarPresupuestoGeneral();

    } catch (err) {
        console.error("Error cargando tabla:", err);
    }
}

// ── Cargar selects del modal ─────────────────────────────────────────────
async function cargarSelectsModal() {
    // Programas
    const respPrg = await fetch("/api/programas/");
    const dataPrg = await respPrg.json();
    llenarSelect(
        document.getElementById("prog"),
        dataPrg.programas, "id",
        (p) => `${p.codigo_programa} - ${p.nombre}`,
        "Seleccionar programa..."
    );

    // Partidas
    const respPar = await fetch("/api/partidas/");
    const dataPar = await respPar.json();
    llenarSelect(
        document.getElementById("partida"),
        dataPar.partidas, "id",
        (p) => `${p.codigo} - ${p.denominacion}`,
        "Seleccionar partida..."
    );

    // Fuentes
    const respFuente = await fetch("/api/fuentes/");
    const dataFuente = await respFuente.json();
    llenarSelect(
        document.getElementById("fuente"),
        dataFuente.fuentes, "id",
        (f) => `${f.codigo} - ${f.nombre}`,
        "Seleccionar fuente..."
    );
}

// ── Cascada Programa → Proyecto → Actividad ──────────────────────────────
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

// ── Autocompletar denominación al elegir partida ─────────────────────────
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

// ── Modal ────────────────────────────────────────────────────────────────
function abrirModal() {
    document.getElementById("modal").style.display = "block";
    cargarSelectsModal();
}

function cerrarModal() {
    document.getElementById("modal").style.display = "none";
    limpiarFormulario();
}

function limpiarFormulario() {
    document.getElementById("prog").innerHTML    = '<option value="">Seleccionar programa...</option>';
    document.getElementById("py").innerHTML      = '<option value="">Seleccionar proyecto...</option>';
    document.getElementById("ao").innerHTML      = '<option value="">Seleccionar actividad...</option>';
    document.getElementById("partida").innerHTML = '<option value="">Seleccionar partida...</option>';
    document.getElementById("fuente").innerHTML  = '<option value="">Seleccionar fuente...</option>';
    document.getElementById("nombre").value      = "";
    document.getElementById("presupuesto").value = "";
    document.getElementById("py").disabled       = true;
    document.getElementById("ao").disabled       = true;
}

window.onclick = function (e) {
    const modal = document.getElementById("modal");
    if (e.target === modal) cerrarModal();
};

// ── Guardar ──────────────────────────────────────────────────────────────
async function guardarPresupuesto() {
    const progId     = document.getElementById("prog").value;
    const pyId       = document.getElementById("py").value;
    const aoId       = document.getElementById("ao").value;
    const partidaId  = document.getElementById("partida").value;
    const fuenteId   = document.getElementById("fuente").value;
    const presupuesto = document.getElementById("presupuesto").value;

    if (!progId || !pyId || !aoId || !partidaId || !fuenteId || !presupuesto) {
        alert("Completá todos los campos antes de guardar.");
        return;
    }

    const payload = {
        programa_id:        progId,
        proyecto_id:        pyId,
        actividad_id:       aoId,
        partida_id:         partidaId,
        fuente_id:          fuenteId,
        presupuesto_inicial: presupuesto,
    };

    try {
        const resp = await fetch("/api/linea-presupuestaria/crear/", {
            method:  "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken":  csrftoken,
            },
            body: JSON.stringify(payload),
        });

        const data = await resp.json();

        if (resp.ok) {
            alert(data.mensaje);
            cerrarModal();
            cargarTabla();
        } else {
            alert("Error: " + (data.error || "revisá los datos."));
        }
    } catch (err) {
        console.error("Error guardando línea presupuestaria:", err);
        alert("Error de red al guardar.");
    }
}

// ── Buscador ─────────────────────────────────────────────────────────────
function buscarPartida() {
    const filtro = document.getElementById("buscador").value.toLowerCase();
    document.querySelectorAll("#tablaPartidas tr").forEach((fila) => {
        fila.style.display = fila.textContent.toLowerCase().includes(filtro) ? "" : "none";
    });
}

// ── Inicializar ──────────────────────────────────────────────────────────
restaurarPresupuestoGeneral();
cargarTabla();
// ── Catálogos ──────────────────────────────────────────────────────────
const PADRE_LABEL = {
    'Programa': 'Jurisdicción',
    'Subprograma': 'Programa',
    'Proyecto': 'Programa',
    'Actividad / Obra': 'Proyecto',
};

let datosCatalogos = {
    'Programa': [], 'Subprograma': [], 'Proyecto': [],
    'Actividad / Obra': [], 'Partida': [], 'Fuente de Financiamiento': [],
};

let catalogoActual = 'Programa';
let editandoId = null;



function abrirModalCatalogos() {
    document.getElementById('modalCatalogosPanel').style.display = 'block';
    cargarCatalogo(catalogoActual);
}

function cerrarModalCatalogos() {
    document.getElementById('modalCatalogosPanel').style.display = 'none';
}

async function cargarCatalogo(tipo) {
    const tbody = document.getElementById('tbodyCatalogo');
    tbody.innerHTML = `<tr><td colspan="3" class="sin-datos">Cargando...</td></tr>`;
    try {
        const resp = await fetch(`/api/catalogos/listar/?tipo=${encodeURIComponent(tipo)}`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Error al cargar');
        datosCatalogos[tipo] = data.items;
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" class="sin-datos">Error al cargar: ${err.message}</td></tr>`;
        return;
    }
    renderTablaCatalogo();
}

function cambiarCatalogo() {
    catalogoActual = document.getElementById('selectCatalogo').value;
    document.getElementById('buscadorTabla').value = '';
    cargarCatalogo(catalogoActual);
}

function renderTablaCatalogo() {
    const tbody = document.getElementById('tbodyCatalogo');
    const filtro = document.getElementById('buscadorTabla').value.trim().toLowerCase();
    const items = (datosCatalogos[catalogoActual] || []).filter(item =>
        item.codigo.toLowerCase().includes(filtro) ||
        item.denominacion.toLowerCase().includes(filtro)
    );

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="sin-datos">No hay ${catalogoActual.toLowerCase()}s cargados que coincidan.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => `
        <tr>
            <td>${item.codigo}</td>
            <td>${item.denominacion}${item.padre_nombre ? ` <span style="color:#9ca3af;font-size:.78rem;">(${item.padre_nombre})</span>` : ''}</td>
            <td class="col-acciones">
                <button class="btn-icon-tabla" title="Editar" onclick="editarItemCatalogo(${item.id})">✎</button>
                <button class="btn-icon-tabla eliminar" title="Eliminar" onclick="eliminarItemCatalogo(${item.id})">✕</button>
            </td>
        </tr>
    `).join('');
}

async function abrirModalItem(nombre, itemParaEditar = null) {
    editandoId = itemParaEditar ? itemParaEditar.id : null;

    document.getElementById('modalTituloItem').textContent = (editandoId ? 'Editar ' : 'Cargar ') + nombre;
    document.getElementById('inputCodigo').value = itemParaEditar ? itemParaEditar.codigo : '';
    document.getElementById('inputDenominacion').value = itemParaEditar ? itemParaEditar.denominacion : '';
    document.getElementById('modalOverlayItem').classList.add('open');

    document.getElementById('selectCatalogo').value = nombre;
    catalogoActual = nombre;

    const grupoPadre = document.getElementById('grupoPadre');
    const selectPadre = document.getElementById('selectPadre');

    if (PADRE_LABEL[nombre]) {
        document.getElementById('labelPadre').textContent = PADRE_LABEL[nombre];
        grupoPadre.style.display = '';
        selectPadre.innerHTML = '<option value="">Cargando...</option>';
        try {
            const resp = await fetch(`/api/catalogos/padres/?tipo=${encodeURIComponent(nombre)}`);
            const data = await resp.json();
            if (data.padres.length === 0) {
                selectPadre.innerHTML = `<option value="">No hay ${PADRE_LABEL[nombre].toLowerCase()}s cargados</option>`;
            } else {
                selectPadre.innerHTML = data.padres.map(p => `<option value="${p.id}">${p.label}</option>`).join('');
                if (itemParaEditar && itemParaEditar.padre_id) {
                    selectPadre.value = itemParaEditar.padre_id;
                }
            }
        } catch (err) {
            selectPadre.innerHTML = '<option value="">Error al cargar</option>';
        }
    } else {
        grupoPadre.style.display = 'none';
        selectPadre.innerHTML = '';
    }

    setTimeout(() => document.getElementById('inputCodigo').focus(), 50);
}

function cerrarModalItem() {
    document.getElementById('modalOverlayItem').classList.remove('open');
    editandoId = null;
}

async function guardarCatalogoItem() {
    const codigo = document.getElementById('inputCodigo').value.trim();
    const denom = document.getElementById('inputDenominacion').value.trim();
    const requierePadre = !!PADRE_LABEL[catalogoActual];
    const padreId = requierePadre ? document.getElementById('selectPadre').value : null;

    if (!codigo || !denom) {
        alert('Completá código y denominación.');
        return;
    }
    if (requierePadre && !padreId) {
        alert(`Seleccioná ${PADRE_LABEL[catalogoActual]}.`);
        return;
    }

    const payload = { tipo: catalogoActual, codigo, denominacion: denom };
    if (requierePadre) payload.padre_id = padreId;

    const url = editandoId
        ? `/api/catalogos/editar/${editandoId}/`
        : `/api/catalogos/crear/`;

    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken,
            },
            body: JSON.stringify(payload),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Error al guardar');

        cerrarModalItem();
        await cargarCatalogo(catalogoActual);
       
    } catch (err) {
        alert(err.message);
    }
}

function editarItemCatalogo(id) {
    const item = (datosCatalogos[catalogoActual] || []).find(i => i.id === id);
    if (!item) return;
    abrirModalItem(catalogoActual, item);
}

async function eliminarItemCatalogo(id) {
    const item = (datosCatalogos[catalogoActual] || []).find(i => i.id === id);
    if (!item) return;
    const confirmar = confirm(`¿Eliminar "${item.denominacion}"?`);
    if (!confirmar) return;

    try {
        const resp = await fetch(`/api/catalogos/eliminar/${id}/?tipo=${encodeURIComponent(catalogoActual)}`, {
            method: 'POST',
            headers: { 'X-CSRFToken': csrftoken },
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Error al eliminar');

        await cargarCatalogo(catalogoActual);
        
    } catch (err) {
        alert(err.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('modalOverlayItem').addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlayItem') cerrarModalItem();
    });
});