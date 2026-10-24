/* ==========================================================================
   ORDEN DE PAGO PERSONAL - LÓGICA DEL FORMULARIO
   JavaScript puro (Vanilla JS). Sin frameworks ni librerías externas,
   salvo html2pdf.js utilizada únicamente para exportar a PDF.
   ========================================================================== */

/* ------------------------------------------------------------------------
   ESTADO / CONTADORES
   ------------------------------------------------------------------------ */
   let contadorBeneficiarios = 0;
   let contadorErogaciones = 0;
   
/* 
------------------------------------------------------------------------
    UTILIDADES DE FORMATO DE NÚMEROS
------------------------------------------------------------------------ */

/**
  * Convierte un string con formato "1.234.567,89" a un número flotante.
  * @param {string} texto
  * @returns {number}
  */
function parsearImporte(texto) {
  if (!texto) return 0;
  const limpio = texto
    .toString()
    .replace(/\./g, "")
    .replace(",", ".");
  const numero = parseFloat(limpio);
  return isNaN(numero) ? 0 : numero;
}
   
/**
  * Formatea un número a estilo "1.234.567,00" (formato es-AR).
  * @param {number} numero
  * @returns {string}
  */
function formatearImporte(numero) {
  if (isNaN(numero)) numero = 0;
  return numero.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
   
/**
* Aplica el formato de importe a un input en el evento "blur".
* @param {HTMLInputElement} input
*/
function formatearInputImporte(input) {
  const valorNumerico = parsearImporte(input.value);
  input.value = input.value.trim() === "" ? "" : formatearImporte(valorNumerico);
}

/* ------------------------------------------------------------------------
    VALIDACIONES
    ------------------------------------------------------------------------ */

/**
  * Marca un campo como válido o inválido agregando/quitando clases CSS
  * y mostrando un mensaje de error asociado (si existe el contenedor).
  * @param {HTMLElement} input
  * @param {boolean} esValido
  * @param {string} mensaje
  */
function marcarValidacion(input, esValido, mensaje = "") {
  input.classList.remove("input-valido", "input-invalido");
  input.classList.add(esValido ? "input-valido" : "input-invalido");

  const contenedorError = document.getElementById(`err-${input.id}`);
  if (contenedorError) {
    contenedorError.textContent = esValido ? "" : mensaje;
  }
}
   
/**
  * Valida que el campo solo contenga números (y guiones), como el
  * Número de Orden.
  */
function validarSoloNumeros(input) {
  const patron = /^[0-9-]*$/;
  const valor = input.value.trim();
  const esValido = valor !== "" && patron.test(valor);
  marcarValidacion(input, esValido, "Solo se admiten números (y guiones).");
  return esValido;
}
   
/**
  * Valida que el campo tenga un importe numérico válido (>= 0).
  */
function validarImporte(input) {
  const valor = input.value.trim();
  if (valor === "") {
    marcarValidacion(input, false, "El importe es obligatorio.");
    return false;
  }
  const numero = parsearImporte(valor);
  const esValido = !isNaN(numero) && numero >= 0;
  marcarValidacion(input, esValido, "Ingrese un importe numérico válido.");
  return esValido;
}
   
/**
  * Valida que el campo tenga formato de fecha dd/mm/aa o dd/mm/aaaa
  * y que sea una fecha real.
  */
function validarFecha(input) {
  const valor = input.value.trim();

  // Formato obligatorio: dd/mm/aaaa
  const patron = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const coincidencia = valor.match(patron);

  if (!coincidencia) {
    marcarValidacion(
      input,
      false,
      "Ingrese la fecha en formato dd/mm/aaaa."
    );
    return false;
  }

  const dia = parseInt(coincidencia[1], 10);
  const mes = parseInt(coincidencia[2], 10);
  const anio = parseInt(coincidencia[3], 10);

  // Crear fecha
  const fecha = new Date(anio, mes - 1, dia);

  // Verificar que la fecha exista realmente
  const fechaValida =
    fecha.getFullYear() === anio &&
    fecha.getMonth() === mes - 1 &&
    fecha.getDate() === dia;

  if (!fechaValida) {
    marcarValidacion(
      input,
      false,
      "La fecha ingresada no es válida."
    );
    return false;
  }

  // Fecha de hoy, sin tener en cuenta la hora
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // No permitir fechas futuras
  if (fecha > hoy) {
    marcarValidacion(
      input,
      false,
      "La fecha no puede ser futura."
    );
    return false;
  }

  marcarValidacion(input, true);
  return true;
}

/**
  * Valida que un campo de texto obligatorio no esté vacío.
  */
function validarCampoObligatorio(input) {
  const esValido = input.value.trim() !== "";
  marcarValidacion(input, esValido, "Este campo es obligatorio.");
  return esValido;
}
   
/* ------------------------------------------------------------------------
  SECTOR IZQUIERDO: NÓMINA DE BENEFICIARIOS
  ------------------------------------------------------------------------ */

/**
* Agrega una nueva fila de beneficiario (nombre + importe parcial).
*/
function agregarFilaBeneficiario() {
  console.log("Entró a agregarFilaBeneficiario");

  contadorBeneficiarios++;

  // ============================================================
  // CÓDIGO DEL BENEFICIARIO
  // ============================================================
  const filaCodigo = document.createElement("div");
  filaCodigo.className = "fila-codigo";

  filaCodigo.innerHTML = `
    <input 
      type="text" 
      class="input-codigo-beneficiario" 
      placeholder="00000"
    >
  `;

  document
    .getElementById("codigosContainer")
    .appendChild(filaCodigo);


  // ============================================================
  // NOMBRE DEL BENEFICIARIO
  // ============================================================
  const filaBeneficiario = document.createElement("div");
  filaBeneficiario.className = "fila-beneficiario";

  filaBeneficiario.innerHTML = `
    <input 
      type="text" 
      class="input-nombre-beneficiario" 
      placeholder="Nombre y apellido del beneficiario"
    >
    <button type="button" class="btn-mini no-print">✕</button>
  `;

  document
    .getElementById("beneficiariosContainer")
    .appendChild(filaBeneficiario);


  // ============================================================
  // IMPORTE PARCIAL
  // ============================================================
  const filaParcial = document.createElement("input");

  filaParcial.type = "text";
  filaParcial.className = "input-importe-parcial";
  filaParcial.placeholder = "0,00";

  document
    .getElementById("parcialesContainer")
    .appendChild(filaParcial);


  // ============================================================
  // SELECCIONAR FILA
  // ============================================================
  filaBeneficiario.addEventListener("click", (evento) => {
    if (evento.target.tagName === "BUTTON") return;

    seleccionarFilaBeneficiario(filaBeneficiario);
  });


  // ============================================================
  // ELIMINAR BENEFICIARIO
  // ============================================================
  const botonEliminar = filaBeneficiario.querySelector(".btn-mini");

  botonEliminar.addEventListener("click", () => {

    const beneficiariosContainer = document.getElementById("beneficiariosContainer");
    const codigosContainer = document.getElementById("codigosContainer");
    const indice = Array.from(beneficiariosContainer.children).indexOf(filaBeneficiario);

    // Eliminar nombre
    filaBeneficiario.remove();

    // Eliminar código correspondiente
    const codigos = codigosContainer.querySelectorAll(".fila-codigo");

    if (codigos[indice]) {
      codigos[indice].remove();
    }

    // Eliminar parcial correspondiente
    const parciales = document.querySelectorAll(".input-importe-parcial");

    if (parciales[indice]) {
      parciales[indice].remove();
    }
    recalcularTotales();
  });


  // ============================================================
  // FORMATO Y RECÁLCULO DEL PARCIAL
  // ============================================================
  filaParcial.addEventListener("blur", () => {
    formatearInputImporte(filaParcial);
    recalcularTotales();
  });

  filaParcial.addEventListener("input", recalcularTotales);
}

function seleccionarFilaBeneficiario(fila) {
  document.querySelectorAll(".fila-beneficiario").forEach((f) => f.classList.remove("fila-seleccionada"));
  fila.classList.add("fila-seleccionada");
}
   
/**
* Elimina la fila de beneficiario actualmente seleccionada (o la última
* si no hay ninguna seleccionada).
*/
function eliminarFilaBeneficiarioSeleccionada() {

  const contenedor = document.getElementById("beneficiariosContainer");
  const codigosContainer = document.getElementById("codigosContainer");
  const filas = contenedor.querySelectorAll(".fila-beneficiario");
  if (filas.length === 0) return;

  let filaAEliminar = contenedor.querySelector(".fila-seleccionada");
  let indice;

  // Si hay una seleccionada
  if (filaAEliminar) {
    indice = Array.from(filas).indexOf(filaAEliminar);
  } else {
    // Si no hay seleccionada, elimina la última
    filaAEliminar = filas[filas.length - 1];
    indice = filas.length - 1;
  }

  // ============================================================
  // ELIMINAR NOMBRE
  // ============================================================
  filaAEliminar.remove();

  // ============================================================
  // ELIMINAR CÓDIGO CORRESPONDIENTE
  // ============================================================
  const codigos = codigosContainer.querySelectorAll(".fila-codigo");

  if (codigos[indice]) {
    codigos[indice].remove();
  }


  // ============================================================
  // ELIMINAR PARCIAL CORRESPONDIENTE
  // ============================================================
  const parciales = document.querySelectorAll(".input-importe-parcial");

  if (parciales[indice]) {
    parciales[indice].remove();
  }

  recalcularTotales();
}

function agregarFilaErogacion() {
  contadorErogaciones++;
  const filaId = `erog-${contadorErogaciones}`;

  const fila = document.createElement("tr");
  fila.dataset.filaId = filaId;
  fila.innerHTML = `
      <td class="celda-prog">
          <select class="erog-prg sel-erog" data-filaId="${filaId}">
              <option value="">PRG</option>
          </select>
      </td>
      <td class="celda-sp">
          <input type="text" class="erog-sp" value="00" readonly>
      </td>
      <td class="celda-pto">
          <select class="erog-pry sel-erog" data-filaId="${filaId}" disabled>
              <option value="">PRY</option>
          </select>
      </td>
      <td class="celda-ao">
          <select class="erog-ao sel-erog" data-filaId="${filaId}" disabled>
              <option value="">A/O</option>
          </select>
      </td>
      <td class="celda-part">
          <select class="erog-par sel-erog" data-filaId="${filaId}">
              <option value="">PAR</option>
          </select>
      </td>
      <td class="celda-desc">
          <input type="text" class="erog-desc" placeholder="Descripción" readonly>
      </td>
      <td class="celda-importe">
          <input type="text" class="input-importe-erogacion" placeholder="0,00">
      </td>
      <input type="hidden" class="erog-linea-id" value="">
      <input type="hidden" class="erog-saldo" value="0">
  `;

  document.getElementById("erogacionesBody").appendChild(fila);
  fila.addEventListener("click", () => seleccionarFilaErogacion(fila));

  const inputImporte = fila.querySelector(".input-importe-erogacion");
  inputImporte.addEventListener("blur", () => {
      formatearInputImporte(inputImporte);
      recalcularTotales();

      // Validar que no supere el saldo disponible
      const saldo   = parseFloat(fila.querySelector(".erog-saldo").value) || 0;
      const importe = parsearImporte(inputImporte.value);
      if (saldo > 0 && importe > saldo) {
          inputImporte.style.borderColor = "red";
          inputImporte.title = `Saldo disponible: $${formatearImporte(saldo)}`;
      } else {
          inputImporte.style.borderColor = "";
          inputImporte.title = "";
      }
  });
  inputImporte.addEventListener("input", recalcularTotales);

  inicializarCascadaErogacion(fila);
}

function inicializarCascadaErogacion(fila) {
  const selectPrg = fila.querySelector(".erog-prg");
  const selectPry = fila.querySelector(".erog-pry");
  const selectAo  = fila.querySelector(".erog-ao");
  const selectPar = fila.querySelector(".erog-par");
  const inputDesc = fila.querySelector(".erog-desc");
  const inputLinea = fila.querySelector(".erog-linea-id");
  const inputSaldo = fila.querySelector(".erog-saldo");

  function resetLinea() {
      inputLinea.value = "";
      inputSaldo.value = "0";
      inputDesc.value  = "";
  }

  async function resolverLinea() {
      resetLinea();
      if (!selectPrg.value || !selectPry.value || !selectAo.value || !selectPar.value) return;

      const ejercicio = new Date().getFullYear();
      try {
          const res  = await fetch(
              `/api/resolver-lineas/?programa_id=${selectPrg.value}&proyecto_id=${selectPry.value}&actividad_id=${selectAo.value}&partida_id=${selectPar.value}&ejercicio=${ejercicio}`
          );
          const data = await res.json();

          if (!res.ok || !data.lineas || data.lineas.length === 0) {
              inputDesc.value = "⚠ Línea no encontrada";
              return;
          }

          // Si hay una sola línea la usa directamente
          const linea = data.lineas[0];
          inputLinea.value = linea.linea_id;
          inputSaldo.value = linea.saldo_actual;
          inputDesc.value  = data.lineas.length > 1
              ? `${linea.descripcion} (y ${data.lineas.length - 1} más)`
              : linea.descripcion;

      } catch {
          inputDesc.value = "⚠ Error al buscar línea";
      }
  }

  // Poblar programas
  fetch("/api/programas/")
      .then(r => r.json())
      .then(data => {
          (data.programas || []).forEach(p => {
              const opt = document.createElement("option");
              opt.value       = p.id;
              opt.textContent = `${p.codigo_programa} - ${p.nombre}`;
              selectPrg.appendChild(opt);
          });
      });

  // Poblar partidas
  fetch("/api/partidas/")
      .then(r => r.json())
      .then(data => {
          (data.partidas || []).forEach(p => {
              const opt = document.createElement("option");
              opt.value       = p.id;
              opt.textContent = `${p.codigo} - ${p.denominacion}`;
              selectPar.appendChild(opt);
          });
      });

  selectPrg.addEventListener("change", () => {
      selectPry.innerHTML = `<option value="">PRY</option>`;
      selectAo.innerHTML  = `<option value="">A/O</option>`;
      selectPry.disabled  = true;
      selectAo.disabled   = true;
      resetLinea();
      if (!selectPrg.value) return;

      fetch(`/api/proyectos/?programa_id=${selectPrg.value}`)
          .then(r => r.json())
          .then(data => {
              (data.proyectos || []).forEach(p => {
                  const opt = document.createElement("option");
                  opt.value       = p.id;
                  opt.textContent = `${p.codigo_proyecto} - ${p.nombre}`;
                  selectPry.appendChild(opt);
              });
              selectPry.disabled = false;
          });
  });

  selectPry.addEventListener("change", () => {
      selectAo.innerHTML = `<option value="">A/O</option>`;
      selectAo.disabled  = true;
      resetLinea();
      if (!selectPry.value) return;

      fetch(`/api/actividades/?proyecto_id=${selectPry.value}`)
          .then(r => r.json())
          .then(data => {
              (data.actividades || []).forEach(a => {
                  const opt = document.createElement("option");
                  opt.value       = a.id;
                  opt.textContent = `${a.codigo_act_obra} - ${a.nombre}`;
                  selectAo.appendChild(opt);
              });
              selectAo.disabled = false;
          });
  });

  selectAo.addEventListener("change", resolverLinea);
  selectPar.addEventListener("change", resolverLinea);
}
   
/**
  * Marca visualmente una fila de erogación como seleccionada.
  * @param {HTMLTableRowElement} fila
  */
function seleccionarFilaErogacion(fila) {
  document.querySelectorAll("#erogacionesBody tr").forEach((f) => f.classList.remove("fila-seleccionada"));
  fila.classList.add("fila-seleccionada");
}
   
/**
  * Elimina la fila de erogación actualmente seleccionada (o la última si
  * no hay ninguna seleccionada).
  */
function eliminarFilaErogacionSeleccionada() {
  const cuerpoTabla = document.getElementById("erogacionesBody");
  const filaSeleccionada = cuerpoTabla.querySelector(".fila-seleccionada");

  if (filaSeleccionada) {
    filaSeleccionada.remove();
  } else {
    const filas = cuerpoTabla.querySelectorAll("tr");
    if (filas.length > 0) filas[filas.length - 1].remove();
  }

  recalcularTotales();
}
   
/* ------------------------------------------------------------------------
    CÁLCULO AUTOMÁTICO DE TOTALES
    ------------------------------------------------------------------------ */

/**
  * Recalcula:
  *  - El total de la nómina de beneficiarios (suma de importes parciales).
  *  - El total de la imputación de erogaciones.
  *  - El "Importe O.P" del encabezado (debe coincidir con ambos totales).
  */
/**
 * Convierte un número a su representación en letras (Ej: "UN MIL DOSCIENTOS CON 00/100").
 */
/**
 * Convierte un número a texto simple (ej: 2 -> "DOS", 1800 -> "UN MIL OCHO CIENTOS").
 */

function numeroALetras(numero) {
  // Separar parte entera y centavos con precisión
  const partes     = numero.toFixed(2).split('.');
  const entero     = parseInt(partes[0], 10);
  const centavos   = parseInt(partes[1], 10);
  const centavosStr = String(centavos).padStart(2, '0');

  const UNIDADES = [
    '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS',
    'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE',
    'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'
  ];

  const DECENAS = [
    '', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA',
    'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'
  ];

  const CENTENAS = [
    '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS',
    'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'
  ];

  // Convierte números de 0 a 999
  function convertirGrupo(n) {
    if (n === 0)   return '';
    if (n === 100) return 'CIEN';

    const c    = Math.floor(n / 100);
    const rest = n % 100;

    let parteCentena = '';
    if (c > 0) parteCentena = CENTENAS[c];

    let parteDecena = '';
    if (rest > 0 && rest < 20) {
      parteDecena = UNIDADES[rest];
    } else if (rest >= 20) {
      const d = Math.floor(rest / 10);
      const u = rest % 10;
      parteDecena = DECENAS[d] + (u > 0 ? ' Y ' + UNIDADES[u] : '');
    }

    // Caso especial: VEINTIUNO, VEINTIDÓS, etc.
    if (rest >= 21 && rest <= 29) {
      parteDecena = 'VEINTI' + UNIDADES[rest - 20].toLowerCase()
                              .normalize('NFD')
                              .replace(/[\u0300-\u036f]/g, '')
                              .toUpperCase();
      // Excepción: VEINTIÚN
      if (rest === 21) parteDecena = 'VEINTIÚN';
    }

    if (parteCentena && parteDecena) return parteCentena + ' ' + parteDecena;
    return parteCentena || parteDecena;
  }

  // Grupos de la escala larga (español)
  // Usamos BigInt para no perder precisión con trillones
  const GRUPOS = [
    { valor: BigInt('1000000000000000000'), singular: 'UN TRILLÓN',  plural: 'TRILLONES'  },
    { valor: BigInt('1000000000000'),       singular: 'UN BILLÓN',   plural: 'BILLONES'   },
    { valor: BigInt('1000000'),             singular: 'UN MILLÓN',   plural: 'MILLONES'   },
    { valor: BigInt('1000'),                singular: 'MIL',         plural: 'MIL'        },
  ];

  function convertirEntero(n) {
    if (n === 0) return 'CERO';

    let bigN     = BigInt(n);
    let resultado = '';

    for (const grupo of GRUPOS) {
      if (bigN < grupo.valor) continue;

      const cantidad   = bigN / grupo.valor;           // cuántos de este grupo
      bigN             = bigN % grupo.valor;           // resto

      const cantNum    = Number(cantidad);
      const cantLetras = cantNum === 1
        ? grupo.singular                               // "UN MILLÓN", "MIL"
        : convertirGrupo(cantNum) + ' ' + grupo.plural;

      resultado += cantLetras + ' ';
    }

    // Resto final (0–999)
    const restoFinal = Number(bigN);
    if (restoFinal > 0) {
      // "UN" → "UNO" cuando es el número final suelto
      const grupo = convertirGrupo(restoFinal);
      resultado += grupo === 'UN' ? 'UNO' : grupo;
    }

    return resultado.trim();
  }

  const letrasEntero = convertirEntero(entero);
  return `${letrasEntero} CON ${centavosStr}/100`;
}

function actualizarLetras() {
  const importeTotal  = document.getElementById("importeTotal");
  const importeLetras = document.getElementById("importeLetras");
  if (!importeTotal || !importeLetras) return;

  const numero = parsearImporte(importeTotal.value);
  importeLetras.value = numero > 0 ? numeroALetras(numero) : '';
}
  
document.addEventListener("DOMContentLoaded", () => {
  inicializarEventosBotones();
  inicializarValidaciones();
  inicializarFilasBase();
  recalcularTotales();

  const delegacion = document.getElementById("delegacionContable");
  if (delegacion) {
      delegacion.value = "ADM. PCIAL. DE RECURSOS HIDRICOS";
  }
});

function recalcularTotales() {
  // 1. Calcular total de beneficiarios
  let totalBeneficiarios = 0;
  document.querySelectorAll(".input-importe-parcial").forEach((input) => {
    totalBeneficiarios += parsearImporte(input.value);
  });
  
  const elTotalBen = document.getElementById("totalBeneficiarios");
  const elTotalBenParcial = document.getElementById("totalBeneficiarioParcial");
  if (elTotalBen) elTotalBen.value = formatearImporte(totalBeneficiarios);
  if (elTotalBenParcial) elTotalBenParcial.value = formatearImporte(totalBeneficiarios);

  // 2. Calcular total de erogaciones
  let totalErogaciones = 0;
  document.querySelectorAll(".input-importe-erogacion").forEach((input) => {
    totalErogaciones += parsearImporte(input.value);
  });
  
  const elTotalErog = document.getElementById("totalErogaciones");

  if (elTotalErog) {
      elTotalErog.value = formatearImporte(totalErogaciones);
  }
  // Validar si el total de erogaciones excede el Importe O.P.
  validarTotalErogaciones();
  // 3. Escribir el total numérico en letras en tu input #importeLetras
  const elImporteLetras = document.getElementById("importeLetras");
  if (elImporteLetras) {
    // Si querés que tome el total de erogaciones:
    elImporteLetras.value = numeroALetras(totalErogaciones);
  }
  validarTotalErogaciones();;
}

function validarTotalErogaciones() {

  const totalErogaciones = document.getElementById("totalErogaciones");
  const importeOP = document.getElementById("importeOP");

  if (!totalErogaciones || !importeOP) {
    return;
  }

  const total = parsearImporte(totalErogaciones.value);
  const importe = parsearImporte(importeOP.value);

  let advertencia = document.getElementById("advertenciaTotalErogaciones");

  // Crear advertencia debajo del TOTAL DE EROGACIONES
  if (!advertencia) {
    advertencia = document.createElement("div");

    advertencia.id = "advertenciaTotalErogaciones";
    advertencia.className = "advertencia-importe-op";

    totalErogaciones.parentElement.appendChild(advertencia);
  }

  // ==========================================
  // SON IGUALES → TODO CORRECTO
  // ==========================================

  if (total === importe) {

    advertencia.textContent = "";
    advertencia.style.display = "none";

    totalErogaciones.classList.remove("input-invalido");

    return;
  }

  // ==========================================
  // TOTAL MAYOR QUE IMPORTE O.P.
  // ==========================================

  if (total > importe) {
    advertencia.textContent = "⚠ El total de las erogaciones excede el Importe O.P.";
    advertencia.style.display = "block";
    totalErogaciones.classList.add("input-invalido");
    return;
  }

  // ==========================================
  // TOTAL MENOR QUE IMPORTE O.P.
  // ==========================================

  if (total < importe) {
    advertencia.textContent = "⚠ El total de las erogaciones es menor que el Importe O.P.";
    advertencia.style.display = "block";
    totalErogaciones.classList.add("input-invalido");
    return;
  }
}

function limpiarFormulario() {
  const confirmar = confirm("¿Está seguro de que desea limpiar todo el formulario?");
  if (!confirmar) return;

  document.querySelectorAll(".hoja input[type='text']").forEach((input) => {
    input.value = "";
    input.classList.remove("input-valido", "input-invalido");
  });

  document.querySelectorAll(".textarea-observaciones").forEach((el) => (el.value = ""));
  document.querySelectorAll("[contenteditable='true']").forEach((el) => (el.textContent = ""));
  document.querySelectorAll(".error-msg").forEach((el) => (el.textContent = ""));

  document.getElementById("codigosContainer").innerHTML = "";
  document.getElementById("beneficiariosContainer").innerHTML = "";
  document.getElementById("parcialesContainer").innerHTML = "";
  document.getElementById("erogacionesBody").innerHTML = "";

  document.getElementById("paginaActual").value = "1";
  document.getElementById("paginaTotal").value = "1";

  inicializarFilasBase();
  recalcularTotales();
}
   
/**
  * Solicita confirmación y crea un formulario completamente nuevo.
  */
function nuevoFormulario() {
  const confirmar = confirm("Esto creará un formulario nuevo y se perderán los datos actuales. ¿Continuar?");
  if (!confirmar) return;
  limpiarFormulario();
}

/**
  * Agrega filas iniciales a ambos sectores de la tabla principal para que
  * el formulario no se muestre vacío al cargar.
  */
function inicializarFilasBase() {
  agregarFilaBeneficiario();
  agregarFilaErogacion();
}
   
/* ------------------------------------------------------------------------
    IMPRESIÓN Y EXPORTACIÓN A PDF
    ------------------------------------------------------------------------ */

function imprimirDocumento() {
  window.print();
}

/**
  * Exporta el contenido de la hoja (#hoja) a un archivo PDF en tamaño A4,
  * utilizando la librería html2pdf.js.
  */
function exportarAPDF() {
  const elemento = document.getElementById("hoja");

  const opciones = {
    margin: 0,
    filename: "orden-de-pago-personal.pdf",
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  };

  html2pdf().set(opciones).from(elemento).save();
}
/* ------------------------------------------------------------------------
  ASIGNACIÓN DE VALIDACIONES A CAMPOS ESPECÍFICOS
  ------------------------------------------------------------------------ */

function inicializarEventosBotones() {

  const btnNuevo = document.getElementById("btnNuevo");
  if (btnNuevo) btnNuevo.addEventListener("click", nuevoFormulario);

  const btnLimpiar = document.getElementById("btnLimpiar");
  if (btnLimpiar) btnLimpiar.addEventListener("click", limpiarFormulario);

  const btnAddBeneficiario = document.getElementById("btnAddBeneficiario");
  if (btnAddBeneficiario) {
    btnAddBeneficiario.addEventListener("click", agregarFilaBeneficiario);
  }

  const btnAddBeneficiarioTabla = document.getElementById("btnAddBeneficiarioTabla");
  if (btnAddBeneficiarioTabla) {
    btnAddBeneficiarioTabla.addEventListener("click", agregarFilaBeneficiario);
  }

  const btnDelBeneficiario = document.getElementById("btnDelBeneficiario");
  if (btnDelBeneficiario) {
    btnDelBeneficiario.addEventListener("click", eliminarFilaBeneficiarioSeleccionada);
  }

  const btnAddErogacion = document.getElementById("btnAddErogacion");
  if (btnAddErogacion) {
    btnAddErogacion.addEventListener("click", agregarFilaErogacion);
  }

  const btnDelErogacion = document.getElementById("btnDelErogacion");
  if (btnDelErogacion) {
    btnDelErogacion.addEventListener("click", eliminarFilaErogacionSeleccionada);
  }

  const btnGuardar = document.getElementById("btnGuardar");

  if (btnGuardar) {
    btnGuardar.addEventListener("click", guardarOrdenPago);
  }

  const btnExportarPDF = document.getElementById("btnExportarPDF");
  if (btnExportarPDF) btnExportarPDF.addEventListener("click", exportarAPDF);
}

/* ------------------------------------------------------------------------
  INICIALIZACIÓN AL CARGAR LA PÁGINA
  ------------------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", () => {
  inicializarEventosBotones();
  inicializarFilasBase();
  recalcularTotales();
  inicializarValidaciones();
});

/**
 * Conecta las funciones de validación ya existentes a sus campos.
 */
function inicializarValidaciones() {
  const numeroOrden = document.getElementById("numeroOrden");
  if (numeroOrden) numeroOrden.addEventListener("blur", () => validarSoloNumeros(numeroOrden));

  const fechaOrden = document.getElementById("fechaOrden");
  if (fechaOrden) fechaOrden.addEventListener("blur", () => validarFecha(fechaOrden));

  const importeOP = document.getElementById("importeOP");
  if (importeOP) importeOP.addEventListener("blur", () => validarImporte(importeOP));

  ["expediente", "jurisdiccion", "uPresupuestaria"].forEach((id) => {
    const campo = document.getElementById(id);
    if (campo) campo.addEventListener("blur", () => validarCampoObligatorio(campo));
  });
}
const inputImporteOP = document.getElementById('importeOP');

if (inputImporteOP) {

  // Al hacer foco: si tiene 0,00 o 0, se limpia
  inputImporteOP.addEventListener('focus', function () {
    if (this.value.trim() === '0,00' || this.value.trim() === '0') {
      this.value = '';
    }
  });

  // Al escribir: solo permite números, coma y punto
  inputImporteOP.addEventListener('input', function () {

    this.value = this.value.replace(/[^0-9,.]/g, '');

    // Si empieza con coma o punto, lo elimina
    this.value = this.value.replace(/^[,.]/, '');

  });

  // Al perder el foco: validar
  inputImporteOP.addEventListener('blur', function () {

    // Si está vacío → mostrar error
    validarImporte(this);

    // Si tiene un importe válido → formatearlo
    if (this.value.trim() !== '') {
      formatearInputImporte(this);
    }

    // Actualizar totales
    recalcularTotales();
  });
}

document.getElementById('btnExportarPDF').addEventListener('click', function () {
  const elemento = document.getElementById('hoja');

  // Agregar clase previa
  document.body.classList.add('exportando-pdf');

  const opciones = {
    margin: 0,
    filename: 'orden-de-pago.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      scrollY: 0,
      windowHeight: elemento.scrollHeight // Forzar renderizado completo
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: 'avoid-all' } // Evitar cortes de página indeseados
  };

  html2pdf().set(opciones).from(elemento).save().then(() => {
    document.body.classList.remove('exportando-pdf');
  });
});

function getCookieOP(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

async function guardarOrdenPago() {
  const importeOP   = document.getElementById("importeOP");
  const fechaOrden  = document.getElementById("fechaOrden");
  const numeroOrden = document.getElementById("numeroOrden");
  const expediente  = document.getElementById("expediente");
  const codigoConc  = document.getElementById("codigoConcepto");
  const conceptoTxt = document.getElementById("conceptoTexto");

  if (!validarImporte(importeOP))   { importeOP.focus();  return; }
  if (!validarFecha(fechaOrden))    { fechaOrden.focus(); return; }
  if (!numeroOrden.value.trim())    { alert("Ingresá el número de orden."); return; }
  if (!expediente.value.trim())     { alert("Ingresá el expediente."); return; }

  // Recolectar beneficiarios
  const filasBenef  = document.querySelectorAll("#beneficiariosContainer .fila-beneficiario");
  const filasCodigo = document.querySelectorAll("#codigosContainer .fila-codigo");
  const filasParcial = document.querySelectorAll(".input-importe-parcial");
  const beneficiarios = [];

  filasBenef.forEach((fila, i) => {
    const nomina  = fila.querySelector("input")?.value.trim() || '';
    const codigo  = filasCodigo[i]?.querySelector("input")?.value.trim() || '';
    const parcial = parsearImporte(filasParcial[i]?.value || '0');

    if (nomina || parcial > 0) {
      beneficiarios.push({
        codigo,
        nomina,
        importe_parcial: parcial,
        importe_total:   parcial,  // cada beneficiario tiene su propio importe
      });
    }
  });

  // Recolectar erogaciones
  // Recolectar erogaciones
  const filasErog = document.querySelectorAll("#erogacionesBody tr");
  const erogaciones = [];

  filasErog.forEach((fila) => {
    const lineaId = fila.querySelector(".erog-linea-id")?.value.trim() || '';
    const importe = parsearImporte(fila.querySelector(".input-importe-erogacion")?.value || '0');

    if (lineaId && importe > 0) {
      erogaciones.push({
        linea_id: lineaId,
        importe: importe,
      });
    }
  });

  if (beneficiarios.length === 0) { alert("Agregá al menos un beneficiario."); return; }
  if (erogaciones.length === 0)   { alert("Agregá al menos una erogación con línea presupuestaria y un importe válido."); return; }
  
  // Convertir fecha DD/MM/AAAA → YYYY-MM-DD
  const partesFecha = fechaOrden.value.split('/');
  const fechaISO    = partesFecha.length === 3
      ? `${partesFecha[2]}-${partesFecha[1]}-${partesFecha[0]}`
      : fechaOrden.value;

  const payload = {
      nro_orden_pago: numeroOrden.value.trim(),
      nro_expediente: expediente.value.trim(),
      fecha:          fechaISO,
      codigo:         codigoConc?.value.trim() || '',
      concepto:       conceptoTxt?.value.trim() || '',
      beneficiarios,
      erogaciones,
  };

  const btnGuardar = document.getElementById("btnImprimir");
  try {
      if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = "Guardando..."; }

      const resp = await fetch('/api/op-personal/crear/', {
          method:  'POST',
          headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken':  getCookieOP('csrftoken'),
          },
          body: JSON.stringify(payload),
      });

      const data = await resp.json();

      if (resp.ok) {
          alert(`OP Personal guardada. Asiento N°: ${data.asiento_nro}`);
      } else {
          alert(`Error: ${data.error || 'Revisá los datos.'}`);
      }
  } catch (err) {
      console.error(err);
      alert('Error de conexión con el servidor.');
  } finally {
      if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = "💾 Guardar"; }
  }
}