/* ============================================================
   EJERCICIOS ANTERIORES — conectado a la BD
============================================================ */

const formato = n => Math.abs(n).toLocaleString("es-AR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
});

// ── Estado de paginación de botones ──────────────────────────
let aniosDisponibles = [];   // todos los ejercicios de la BD
let paginaAnios      = 0;    // página actual (0 = más recientes)
const POR_PAGINA     = 3;
let anioSeleccionado = null;

// ── Referencias ───────────────────────────────────────────────
const contenedorBotones = document.getElementById("ejantBotones");
const btnFlecha1        = document.getElementById("ejantFlechaAnterior");
const btnFlecha2        = document.getElementById("ejantFlechaSiguiente");
const buscador          = document.getElementById("ejantBuscador");

// ── Renderizar botones de años ────────────────────────────────
function renderBotones() {
    const inicio = paginaAnios * POR_PAGINA;
    const fin    = inicio + POR_PAGINA;
    const pagina = aniosDisponibles.slice(inicio, fin);

    contenedorBotones.innerHTML = "";
    pagina.forEach(anio => {
        const btn = document.createElement("button");
        btn.type           = "button";
        btn.className      = "ejant-anio-btn" + (anio === anioSeleccionado ? " on" : "");
        btn.dataset.anio   = anio;
        btn.textContent    = anio;
        btn.addEventListener("click", () => seleccionarAnio(anio));
        contenedorBotones.appendChild(btn);
    });

    // Flechas
    if (btnFlecha1) btnFlecha1.disabled = paginaAnios === 0;
    if (btnFlecha2) btnFlecha2.disabled = fin >= aniosDisponibles.length;
}

// ── Seleccionar año y cargar datos ────────────────────────────
async function seleccionarAnio(anio) {
    anioSeleccionado = anio;
    renderBotones();
    await cargarDatos(anio);
}

// ── Cargar datos del ejercicio seleccionado ───────────────────
async function cargarDatos(anio) {
    const body = document.getElementById("ejantBody");
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;">Cargando...</td></tr>`;

    try {
        const resp = await fetch(`/api/ejercicios-anteriores/?ejercicio=${anio}`);
        if (!resp.ok) throw new Error(`Error ${resp.status}`);
        const data = await resp.json();
        renderTabla(data.lineas, anio);
        aplicarFiltro();   // mantiene el texto del buscador al cambiar de año
    } catch (err) {
        console.error(err);
        body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#e53e3e;padding:20px;">Error al cargar los datos.</td></tr>`;
    }
}

function renderTabla(lista, anio) {
    const body = document.getElementById("ejantBody");
    body.innerHTML = "";

    let totalInicial        = 0;
    let totalModificaciones = 0;
    let totalEjecutado      = 0;
    let totalSaldo          = 0;

    if (!lista || lista.length === 0) {
        body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#888;">No hay datos para el ejercicio ${anio}.</td></tr>`;
        actualizarTotalesYTarjetas(0, 0, 0, 0, 0, anio);
        return;
    }

    lista.forEach(up => {
        totalInicial        += up.inicial;
        totalModificaciones += up.modificaciones;
        totalEjecutado      += up.ejecutado;
        totalSaldo          += parseFloat(up.saldo_final);

        const fila = document.createElement("tr");
        fila.className = "ejant-up";
        fila.innerHTML = `
            <td data-label="Unidad">
                <div class="ejant-up-code">
                    <span class="ejant-flecha">›</span>
                    ${up.up}
                </div>
            </td>
            <td class="ejant-denominacion" data-label="Denominación">${up.denominacion}</td>
            <td class="num" data-label="Inicial">$ ${formato(up.inicial)}</td>
            <td class="num ${up.modificaciones >= 0 ? 'positivo' : 'negativo'}" data-label="Modificaciones">
                ${up.modificaciones >= 0 ? '+' : ''}$ ${formato(up.modificaciones)}
            </td>
            <td class="num" data-label="Ejecutado">$ ${formato(up.ejecutado)}</td>
            <td class="num saldo-final" data-label="Saldo final">$ ${formato(parseFloat(up.saldo_final))}</td>
        `;

        const detalle = document.createElement("tr");
        detalle.className = "ejant-detalle";
        detalle.hidden    = true;
        detalle.innerHTML = `
            <td colspan="6">
                <div class="ejant-detalle-contenido">
                    <div class="ejant-detalle-titulo">
                        <div>
                            <strong>Historial de movimientos</strong>
                            <span>${up.denominacion}</span>
                        </div>
                        <span class="ejant-mov-count">${up.movimientos.length} movimientos</span>
                    </div>
                    <table class="ejant-mov">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Tipo</th>
                                <th>Referencia</th>
                                <th class="num">Importe</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${up.movimientos.length === 0
                                ? `<tr><td colspan="4" style="text-align:center;color:#888;padding:12px;">Sin movimientos registrados</td></tr>`
                                : up.movimientos.map(m => `
                                <tr>
                                    <td>${m.fecha}</td>
                                    <td>
                                        <span class="ejant-tag ${
                                            m.tipo === 'Modificación'  ? 'modificacion' :
                                            m.tipo === 'Orden de pago' ? 'orden'        :
                                            m.tipo === 'Refuerzo'      ? 'refuerzo'     :
                                            'imputacion'
                                        }">${m.tipo}</span>
                                    </td>
                                    <td>${m.referencia}</td>
                                    <td class="num ${m.importe >= 0 ? 'positivo' : 'negativo'}">
                                        ${m.importe >= 0 ? '+' : ''}$ ${formato(m.importe)}
                                    </td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </td>
        `;

        fila.addEventListener("click", () => {
            const abrir = detalle.hidden;
            detalle.hidden = !abrir;
            fila.classList.toggle("abierta", abrir);
            fila.querySelector(".ejant-flecha").textContent = abrir ? "⌄" : "›";
        });

        body.appendChild(fila);
        body.appendChild(detalle);
    });

    actualizarTotalesYTarjetas(lista.length, totalInicial, totalModificaciones, totalEjecutado, totalSaldo, anio);
}

function actualizarTotalesYTarjetas(cantidad, inicial, modificaciones, ejecutado, saldo, anio) {
    // Año seleccionado
    const ejantAnio = document.getElementById("ejantAnioActual");
    if (ejantAnio) ejantAnio.textContent = anio || '';

    // Tarjetas
    const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setEl("totalInicial",        "$ " + formato(inicial));
    setEl("totalModificaciones", "$ " + formato(modificaciones));
    setEl("totalEjecutado",      "$ " + formato(ejecutado));
    setEl("totalSaldo",          "$ " + formato(saldo));
    setEl("cantidadUP",          cantidad);

    // Totales del pie de tabla
    setEl("totIni",  formato(inicial));
    setEl("totMod",  (modificaciones >= 0 ? "+" : "") + formato(modificaciones));
    setEl("totEj",   formato(ejecutado));
    setEl("totFin",  formato(saldo));
}

// ── Buscador ──────────────────────────────────────────────────
function aplicarFiltro() {
    const texto = (buscador?.value || "").toLowerCase();
    document.querySelectorAll("#ejantBody .ejant-up").forEach(fila => {
        const coincide = fila.textContent.toLowerCase().includes(texto);
        fila.style.display = coincide ? "" : "none";

        // CORREGIDO: el detalle se restablece cuando la fila vuelve a coincidir
        const detalle = fila.nextElementSibling;
        if (detalle) detalle.style.display = coincide ? "" : "none";
    });
}

buscador?.addEventListener("input", aplicarFiltro);

// ── Inicializar ───────────────────────────────────────────────
async function inicializar() {
    try {
        const resp = await fetch('/api/ejercicios-anteriores/anios/');
        if (!resp.ok) throw new Error();
        const data   = await resp.json();
        aniosDisponibles = data.anios || [];

        if (aniosDisponibles.length === 0) {
            contenedorBotones.innerHTML = '<span style="color:#888;font-size:13px;">Sin ejercicios anteriores</span>';
            return;
        }

        // Mostrar el más reciente automáticamente
        anioSeleccionado = aniosDisponibles[0];
        renderBotones();
        await cargarDatos(anioSeleccionado);

    } catch {
        contenedorBotones.innerHTML = '<span style="color:#e53e3e;">Error al cargar años</span>';
    }
}

// ── Flechas de paginación ─────────────────────────────────────
if (btnFlecha1) {
    btnFlecha1.addEventListener("click", () => {
        if (paginaAnios > 0) { paginaAnios--; renderBotones(); }
    });
}
if (btnFlecha2) {
    btnFlecha2.addEventListener("click", () => {
        if ((paginaAnios + 1) * POR_PAGINA < aniosDisponibles.length) {
            paginaAnios++;
            renderBotones();
        }
    });
}

// ── Volver ────────────────────────────────────────────────────
document.getElementById("btnVolver")?.addEventListener("click", () => history.back());

// ── Arrancar ──────────────────────────────────────────────────
inicializar();