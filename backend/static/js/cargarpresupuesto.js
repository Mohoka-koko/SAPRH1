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

// ── Leer el año desde la URL ──────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const anioDesdeURL = urlParams.get('anio');

if (anioDesdeURL) {
    document.addEventListener("DOMContentLoaded", () => {
        const contenedor = document.querySelector(".contenedor");
        if (contenedor) {
            const banner = document.createElement("div");
            
            // Estilos del contenedor del banner
            banner.style.backgroundColor = "#e8f0fe";
            banner.style.border = "2px solid #0b3d91";
            banner.style.color = "#0b3d91";
            banner.style.padding = "30px 20px";
            banner.style.borderRadius = "12px";
            banner.style.textAlign = "center";
            banner.style.marginBottom = "25px";
            banner.style.boxShadow = "0 6px 15px rgba(11, 61, 145, 0.15)";
            banner.style.display = "flex";
            banner.style.flexDirection = "column";
            banner.style.alignItems = "center";
            banner.style.justifyContent = "center";
            banner.style.gap = "15px";
            banner.style.fontSize = "1.4rem";
            banner.style.fontWeight = "600";
            
            // Contenido del banner
            banner.innerHTML = `
                Ud. está cargando el presupuesto para el 
                <strong style="font-size:3rem; background:#0b3d91; color:white; padding:10px 40px; border-radius:50px; letter-spacing:2px; box-shadow:0 4px 10px rgba(0,0,0,0.2);">
                    Ejercicio ${anioDesdeURL}
                </strong>
            `;
            
            contenedor.insertBefore(banner, contenedor.firstChild);
        }
    });
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

let mensajeCambiosTimeout;

function mostrarMensajeCambiosActualizados() {
    const mensaje = document.getElementById("mensajeCambiosActualizados");
    mensaje.hidden = false;
    window.clearTimeout(mensajeCambiosTimeout);
    mensajeCambiosTimeout = window.setTimeout(() => {
        mensaje.hidden = true;
    }, 4000);
}

async function guardarCambiosPresupuesto() {
    validarPresupuestoGeneral();
    const ok = await guardarPendientes();
    if (ok) mostrarMensajeCambiosActualizados();
}

function abrirConfirmacionFinalizacion() {
    if (hayPendientes()) {
        alert('Hay unidades presupuestarias sin guardar. Presioná "Guardar cambios" antes de finalizar.');
        return;
    }
    document.getElementById("anioFinalizacion").textContent = new Date().getFullYear();
    document.getElementById("confirmacionFinalizacion").hidden = false;
    document.getElementById("btnCancelarFinalizacion").focus();
}

function cancelarFinalizacion() {
    document.getElementById("confirmacionFinalizacion").hidden = true;
    document.getElementById("btnFinalizarCarga").focus();
}

function confirmarFinalizacion() {
    const anioPresupuesto = new Date().getFullYear() + 1;
    localStorage.setItem(`budget-creation-finalized-${anioPresupuesto}`, "true");
    window.location.assign("/admin-dashboard/home/");
}

document.getElementById("btnGuardarCambios").addEventListener("click", guardarCambiosPresupuesto);
document.getElementById("btnFinalizarCarga").addEventListener("click", abrirConfirmacionFinalizacion);
document.getElementById("btnCancelarFinalizacion").addEventListener("click", cancelarFinalizacion);
document.getElementById("btnConfirmarFinalizacion").addEventListener("click", confirmarFinalizacion);

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.getElementById("confirmacionFinalizacion").hidden) {
        cancelarFinalizacion();
    }
});


let lineasCache = [];
let contadorTmp = 0;
let guardandoLote = false;
const anioObjetivo = anioDesdeURL ? parseInt(anioDesdeURL, 10) : new Date().getFullYear();

function claveDe(l) { return l.id != null ? String(l.id) : l._tmp; }
function buscarPorClave(c) { return lineasCache.find((x) => claveDe(x) === String(c)); }
function hayPendientes() { return lineasCache.some((l) => l.id == null); }

function formatearMonto(n) {
    return "$" + Number(n || 0).toLocaleString("es-AR");
}

function celdaMontoHTML(l) {
    const c = claveDe(l);
    const esCero = Number(l.saldo_inicial) === 0;
    return `
        <span class="monto-valor ${esCero ? "monto-cero" : ""}">${formatearMonto(l.saldo_inicial)}</span>
        <button type="button" class="btn-editar-monto" onclick="editarMonto('${c}')">Editar</button>
        <button type="button" class="btn-eliminar-monto" onclick="eliminarLinea('${c}')">Eliminar</button>
    `;
}

function actualizarTotal() {
    const total = lineasCache.reduce((acc, l) => acc + Number(l.saldo_inicial || 0), 0);
    totalGeneralCalculado = total;
    document.getElementById("totalGeneral").textContent =
        "$" + total.toLocaleString("es-AR", { minimumFractionDigits: 2 });
    validarPresupuestoGeneral();
}

function mostrarAvisoHerencia(origen, cantidad) {
    let aviso = document.getElementById("avisoHerencia");
    if (!origen) { if (aviso) aviso.remove(); return; }
    if (!aviso) {
        aviso = document.createElement("div");
        aviso.id = "avisoHerencia";
        aviso.style.cssText = "background:#fffbe6;border:1px solid #e0c200;color:#665500;padding:10px 14px;border-radius:8px;margin-bottom:12px;";
        const wrapper = document.querySelector(".tabla-wrapper");
        wrapper.parentNode.insertBefore(aviso, wrapper);
    }
    aviso.textContent = `Se precargaron ${cantidad} unidades presupuestarias del ejercicio ${origen}, con saldos en $0. ` +
        `Todavía NO están guardadas: se registran al presionar "Guardar cambios".`;
}

function renderTabla() {
    const tbody = document.getElementById("tablaPartidas");
    if (lineasCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color: #5a6472;">No hay unidades presupuestarias cargadas para este ejercicio. Usá el botón "+ Cargar Nueva Unidad Presupuestaria".</td></tr>`;
        actualizarTotal();
        return;
    }
    tbody.innerHTML = lineasCache.map((l) => `
        <tr ${l.id == null ? 'class="fila-sin-guardar" style="background:#fffbe6;"' : ""}>
            <td>${l.prog}</td>
            <td>${l.subp}</td>
            <td>${l.py}</td>
            <td>${l.ao}</td>
            <td>${l.partida}</td>
            <td>${l.denominacion}</td>
            <td>${l.func ?? ""}</td>
            <td>${l.fuente}</td>
            <td class="celda-monto" id="monto-${claveDe(l)}">${celdaMontoHTML(l)}</td>
        </tr>
    `).join("");
    actualizarTotal();
}

async function cargarTabla() {
    try {
        const qs = new URLSearchParams({ heredar: "1" });
        if (anioDesdeURL) qs.set("ejercicio", anioDesdeURL);
        const resp = await fetch(`/api/linea-presupuestaria/listar/?${qs}`);
        const data = await resp.json();
        lineasCache = data.lineas;
        lineasCache.forEach((l) => { if (l.id == null) l._tmp = `tmp-${++contadorTmp}`; });
        mostrarAvisoHerencia(data.ejercicio_origen, lineasCache.length);
        renderTabla();
    } catch (err) {
        console.error("Error cargando tabla:", err);
    }
}

function editarMonto(clave) {
    const l = buscarPorClave(clave);
    const td = document.getElementById(`monto-${clave}`);
    const valor = Number(l.saldo_inicial) || "";
    td.innerHTML = `
        <input type="number" min="0" step="0.01" class="input-monto"
               value="${valor}" placeholder="0"
               onkeydown="if(event.key==='Enter') guardarMonto('${clave}'); if(event.key==='Escape') cancelarMonto('${clave}');">
        <button type="button" class="btn-guardar-monto" onclick="guardarMonto('${clave}')">Guardar</button>
        <button type="button" class="btn-cancelar-monto" onclick="cancelarMonto('${clave}')">✕</button>
    `;
    td.querySelector("input").focus();
}

function cancelarMonto(clave) {
    const l = buscarPorClave(clave);
    document.getElementById(`monto-${clave}`).innerHTML = celdaMontoHTML(l);
}

async function guardarMonto(clave) {
    const l = buscarPorClave(clave);
    const td = document.getElementById(`monto-${clave}`);
    const monto = parseFloat(td.querySelector("input").value);

    if (isNaN(monto) || monto < 0) {
        alert("Ingresá un monto válido (0 o mayor).");
        return;
    }

    const general = parseFloat(document.getElementById("presupuestoGeneralInicial").value);
    if (!isNaN(general)) {
        const otros = lineasCache.reduce(
            (acc, x) => acc + (claveDe(x) === String(clave) ? 0 : Number(x.saldo_inicial || 0)), 0
        );
        if (otros + monto - general > 0.01) {
            alert("Con este monto el total supera el presupuesto general disponible.");
            return;
        }
    }

    // Fila sin guardar (plantilla o UP nueva): solo se modifica en memoria.
    if (l.id == null) {
        l.saldo_inicial = monto;
        td.innerHTML = celdaMontoHTML(l);
        actualizarTotal();
        return;
    }

    try {
        const resp = await fetch(`/api/linea-presupuestaria/editar-monto/${l.id}/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": csrftoken },
            body: JSON.stringify({ saldo_inicial: monto }),
        });
        const data = await resp.json();
        if (!resp.ok) {
            alert("Error: " + (data.error || "no se pudo guardar el monto."));
            return;
        }
        l.saldo_inicial = monto;
        td.innerHTML = celdaMontoHTML(l);
        actualizarTotal();
    } catch (err) {
        console.error(err);
        alert("Error de red al guardar el monto.");
    }
}

async function eliminarLinea(clave) {
    const l = buscarPorClave(clave);
    if (!confirm(`¿Eliminar la partida "${l.denominacion}"?`)) return;

    // Fila sin guardar: se descarta localmente y nunca llega a la base.
    if (l.id == null) {
        lineasCache = lineasCache.filter((x) => claveDe(x) !== String(clave));
        renderTabla();
        return;
    }

    try {
        const resp = await fetch(`/api/linea-presupuestaria/eliminar/${l.id}/`, {
            method: "POST",
            headers: { "X-CSRFToken": csrftoken },
        });
        const data = await resp.json();
        if (!resp.ok) {
            alert("Error: " + (data.error || "no se pudo eliminar."));
            return;
        }
        lineasCache = lineasCache.filter((x) => claveDe(x) !== String(clave));
        renderTabla();
    } catch (err) {
        console.error(err);
        alert("Error de red al eliminar.");
    }
}

// ── Guardado en lote de filas sin guardar (plantillas + UP nuevas) ────────
async function guardarPendientes() {
    const pendientes = lineasCache.filter((l) => l.id == null);
    if (pendientes.length === 0) return true;
    if (guardandoLote) return false;

    guardandoLote = true;
    const btn = document.getElementById("btnGuardarCambios");
    btn.disabled = true;
    try {
        const resp = await fetch("/api/linea-presupuestaria/guardar-lote/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": csrftoken },
            body: JSON.stringify({
                ejercicio: anioObjetivo,
                lineas: pendientes.map((l) => ({
                    programa_id:   l.programa_id,
                    proyecto_id:   l.proyecto_id,
                    actividad_id:  l.actividad_id,
                    partida_id:    l.partida_id,
                    fuente_id:     l.fuente_id,
                    saldo_inicial: String(l.saldo_inicial ?? 0),
                })),
            }),
        });
        const data = await resp.json();
        if (!resp.ok) {
            alert("Error: " + (data.error || "no se pudo guardar. No se guardó nada."));
            return false;
        }
        pendientes.forEach((l, i) => {
            const r = data.lineas[i];
            l.id = r.id;
            l.saldo_inicial = r.saldo_inicial;
            l.saldo_actual = r.saldo_inicial;
            l.es_plantilla = false;
            delete l._tmp;
        });
        mostrarAvisoHerencia(null);
        renderTabla();
        return true;
    } catch (err) {
        console.error(err);
        alert("Error de red al guardar. No se guardó nada.");
        return false;
    } finally {
        guardandoLote = false;
        btn.disabled = false;
    }
}

window.addEventListener("beforeunload", (e) => {
    if (hayPendientes()) { e.preventDefault(); e.returnValue = ""; }
});

// ── Cargar selects del modal ─────────────────────────────────────────────
async function cargarSelectsModal() {
    // Programas
    const respPrg = await fetch("/api/programas-catalogo/");
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

    const resp = await fetch(`/api/proyectos-catalogo/?programa_id=${this.value}`);
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

    const resp = await fetch(`/api/actividades-catalogo/?proyecto_id=${this.value}`);
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
    document.getElementById("py").disabled       = true;
    document.getElementById("ao").disabled       = true;
}

window.onclick = function (e) {
    const modal = document.getElementById("modal");
    if (e.target === modal) cerrarModal();
};

// ── Guardar (el presupuesto inicial se carga siempre en 0) ───────────────
async function guardarPresupuesto() {
    const progId    = document.getElementById("prog").value;
    const pyId      = document.getElementById("py").value;
    const aoId      = document.getElementById("ao").value;
    const partidaId = document.getElementById("partida").value;
    const fuenteId  = document.getElementById("fuente").value;

    // Con filas sin guardar, la UP manual se suma en memoria y viaja en el mismo lote.
    // (Si se creara ya en la base, el ejercicio "tendría líneas" y las plantillas se perderían al recargar.)
    if (hayPendientes()) {
        const texto  = (id) => { const s = document.getElementById(id); return s.options[s.selectedIndex].textContent.trim(); };
        const codigo = (id) => texto(id).split(" - ")[0];
        const repetida = lineasCache.some((x) =>
            String(x.actividad_id) === String(aoId) &&
            String(x.partida_id) === String(partidaId) &&
            String(x.fuente_id) === String(fuenteId));
        if (repetida) {
            alert("Esa unidad presupuestaria ya está en la tabla.");
            return;
        }
        lineasCache.push({
            id: null, _tmp: `tmp-${++contadorTmp}`, es_plantilla: false,
            prog: codigo("prog"), subp: "00", py: codigo("py"), ao: codigo("ao"),
            partida: codigo("partida"), denominacion: document.getElementById("nombre").value,
            fuente: codigo("fuente"), saldo_inicial: "0.00", saldo_actual: "0.00",
            programa_id: Number(progId), proyecto_id: Number(pyId), actividad_id: Number(aoId),
            partida_id: Number(partidaId), fuente_id: Number(fuenteId),
        });
        cerrarModal();
        renderTabla();
        return;
    }

    const payload = {
        programa_id:         progId,
        proyecto_id:         pyId,
        actividad_id:        aoId,
        partida_id:          partidaId,
        fuente_id:           fuenteId,
        presupuesto_inicial: 0,
        ejercicio:           anioDesdeURL // 👈 IMPORTANTE
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