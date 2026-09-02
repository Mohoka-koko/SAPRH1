/* ==========================================================================
   ORDEN DE PAGO - LÓGICA DEL FORMULARIO
   JavaScript puro (Vanilla JS). Sin frameworks ni librerías externas,
   salvo html2pdf.js utilizada únicamente para exportar a PDF.
   ========================================================================== */

/* ------------------------------------------------------------------------
   ESTADO / CONTADORES
   Se usan para generar identificadores únicos en cada fila creada.
   ------------------------------------------------------------------------ */
   let contadorBeneficiarios = 0;
   let contadorConceptoPago = 0;
   let contadorPartidas = 0;
   let contadorLineasDescripcion = 0;
   
   /* ------------------------------------------------------------------------
      UTILIDADES DE FORMATO DE NÚMEROS
      ------------------------------------------------------------------------ */
   
   /**
    * Convierte un string con formato "1.234.567,89" a un número flotante 1234567.89
    * @param {string} texto
    * @returns {number}
    */
   function parsearImporte(texto) {
     if (!texto) return 0;
     const limpio = texto
       .toString()
       .replace(/\./g, "")   // quita separador de miles
       .replace(",", ".");   // convierte coma decimal en punto
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
    * Aplica el formato de importe (separador de miles + 2 decimales) a un
    * input de tipo texto en el evento "blur" (cuando el usuario sale del campo).
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
    * Valida que el campo solo contenga números (Número de Orden).
    */
   function validarSoloNumeros(input) {
     const soloDigitosGuiones = /^[0-9-]*$/;
     const valor = input.value.trim();
     const esValido = valor !== "" && soloDigitosGuiones.test(valor);
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
    * Valida que el campo tenga formato de fecha dd/mm/aaaa y sea una fecha real.
    */
   function validarFecha(input) {
     const valor = input.value.trim();
     const patron = /^(\d{2})\/(\d{2})\/(\d{4})$/;
     const coincidencia = valor.match(patron);
   
     if (!coincidencia) {
       marcarValidacion(input, false, "Formato esperado: dd/mm/aaaa.");
       return false;
     }
   
     const dia = parseInt(coincidencia[1], 10);
     const mes = parseInt(coincidencia[2], 10);
     const anio = parseInt(coincidencia[3], 10);
     const fecha = new Date(anio, mes - 1, dia);
   
     const esValida =
       fecha.getFullYear() === anio &&
       fecha.getMonth() === mes - 1 &&
       fecha.getDate() === dia;
   
     marcarValidacion(input, esValida, "La fecha ingresada no es válida.");
     return esValida;
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
    TABLA: BENEFICIARIOS (Código / Beneficiario / Importe)
    ------------------------------------------------------------------------ */
  
  /**
  * Crea y agrega una nueva fila a la tabla de beneficiarios.
  */
  function agregarFilaBeneficiario() {
    contadorBeneficiarios++;
    const id = contadorBeneficiarios;
  
    const fila = document.createElement("tr");
    fila.dataset.filaId = id;
  
    fila.innerHTML = `
      <td class="col-codigo">
        <input type="text" class="input-codigo-beneficiario" placeholder="0000-0">
      </td>
      <td class="col-beneficiario">
        <input type="text" class="input-nombre-beneficiario" placeholder="Nombre / razón social del beneficiario">
      </td>
      <td class="col-importe">
        <input type="text" class="input-importe-beneficiario" placeholder="0,00">
      </td>
    `;
  
    const cuerpoTabla = document.getElementById("beneficiariosBody");
    cuerpoTabla.appendChild(fila);
  
    // Evento: seleccionar fila con un clic (para luego poder eliminarla)
    fila.addEventListener("click", () => seleccionarFila(fila, "beneficiariosBody"));
  
    // Formateo y recálculo automático del importe
    const inputImporte = fila.querySelector(".input-importe-beneficiario");
    inputImporte.addEventListener("blur", () => {
      formatearInputImporte(inputImporte);
      recalcularImporteConcepto();
    });
    inputImporte.addEventListener("input", recalcularImporteConcepto);
  }
   
  /**
  * Elimina la fila actualmente seleccionada de la tabla de beneficiarios.
  */
  function eliminarFilaBeneficiario() {
    eliminarFilaSeleccionada("beneficiariosBody");
    recalcularImporteConcepto();
  }
   
  /* ------------------------------------------------------------------------
    TABLA: CONCEPTO DEL PAGO
    ------------------------------------------------------------------------ */
  
   function agregarFilaConceptoPago() {
     contadorConceptoPago++;
   
     const fila = document.createElement("tr");
     fila.innerHTML = `
       <td class="col-codigo">
         <input type="text" class="input-codigo-concepto" placeholder="000">
       </td>
       <td>
         <input type="text" class="input-desc-concepto" placeholder="Descripción del concepto de pago">
       </td>
       <td class="col-importe">
         <input type="text" class="input-importe-concepto" placeholder="0,00" readonly>
       </td>
     `;
   
     const cuerpoTabla = document.getElementById("conceptoPagoBody");
     cuerpoTabla.appendChild(fila);
   
     fila.addEventListener("click", () => seleccionarFila(fila, "conceptoPagoBody"));
   
     const inputImporte = fila.querySelector(".input-importe-concepto");
     inputImporte.addEventListener("blur", () => formatearInputImporte(inputImporte));
   }
   
   function eliminarFilaConceptoPago() {
     eliminarFilaSeleccionada("conceptoPagoBody");
   }
   
   /* ------------------------------------------------------------------------
      TABLA: PARTIDAS PRESUPUESTARIAS
      ------------------------------------------------------------------------ */
   
   function agregarFilaPartida() {
     contadorPartidas++;
   
     const fila = document.createElement("tr");
     fila.innerHTML = `
       <td><input type="text" class="input-partida" placeholder="00"></td>
       <td><input type="text" class="input-partida" placeholder="00"></td>
       <td><input type="text" class="input-partida" placeholder="00"></td>
       <td><input type="text" class="input-partida" placeholder="00"></td>
       <td><input type="text" class="input-partida" placeholder="00"></td>
       <td><input type="text" class="input-partida" placeholder="000"></td>
       <td class="col-partida-desc"><input type="text" class="input-partida" placeholder="Descripción de la partida"></td>
       <td class="col-importe"><input type="text" class="input-importe-partida" placeholder="0,00"></td>
     `;
   
     const cuerpoTabla = document.getElementById("partidasBody");
     cuerpoTabla.appendChild(fila);
   
     fila.addEventListener("click", () => seleccionarFila(fila, "partidasBody"));
   
     const inputImporte = fila.querySelector(".input-importe-partida");
     inputImporte.addEventListener("blur", () => formatearInputImporte(inputImporte));
   }
   
   function eliminarFilaPartida() {
     eliminarFilaSeleccionada("partidasBody");
   }
   
   /* ------------------------------------------------------------------------
      BLOQUE CONCEPTO: LÍNEAS DE DESCRIPCIÓN LIBRE
      ------------------------------------------------------------------------ */
   
   function agregarLineaDescripcionConcepto() {
     contadorLineasDescripcion++;
   
     const linea = document.createElement("div");
     linea.className = "concepto-linea-desc";
     linea.innerHTML = `
       <input type="text" class="input-linea full" placeholder="Línea de descripción del concepto">
     `;
   
     document.getElementById("conceptoDescripcionContainer").appendChild(linea);
   }
   
   /* ------------------------------------------------------------------------
      SELECCIÓN Y ELIMINACIÓN GENÉRICA DE FILAS
      ------------------------------------------------------------------------ */
   
   /**
    * Marca visualmente una fila como seleccionada dentro de un cuerpo de tabla,
    * quitando la selección de cualquier otra fila del mismo cuerpo.
    * @param {HTMLTableRowElement} fila
    * @param {string} idCuerpoTabla
    */
   function seleccionarFila(fila, idCuerpoTabla) {
     const cuerpoTabla = document.getElementById(idCuerpoTabla);
     cuerpoTabla.querySelectorAll("tr").forEach((f) => f.classList.remove("fila-seleccionada"));
     fila.classList.add("fila-seleccionada");
   }
   
   /**
    * Elimina la fila actualmente marcada como seleccionada dentro de un cuerpo
    * de tabla. Si no hay ninguna seleccionada, elimina la última fila.
    * @param {string} idCuerpoTabla
    */
   function eliminarFilaSeleccionada(idCuerpoTabla) {
     const cuerpoTabla = document.getElementById(idCuerpoTabla);
     const filaSeleccionada = cuerpoTabla.querySelector(".fila-seleccionada");
   
     if (filaSeleccionada) {
       filaSeleccionada.remove();
     } else {
       const filas = cuerpoTabla.querySelectorAll("tr");
       if (filas.length > 0) {
         filas[filas.length - 1].remove();
       }
     }
   }
   
  /* ------------------------------------------------------------------------
   CÁLCULO IMPORTE ORDEN DE PAGO (Señor Tesorero)
   Suma los importes que el usuario asigna a las UPs.
   ------------------------------------------------------------------------ */
  function recalcularImporteOrdenPago() {
    const inputsUP = document.querySelectorAll(".input-importe-up");
    let total = 0;
    inputsUP.forEach((input) => {
        total += parsearImporte(input.value);
    });

    const campoTotal = document.getElementById("importeTotal");
    if (campoTotal) {
        campoTotal.value = total > 0 ? formatearImporte(total) : "";
        actualizarLetras();
    }
  }

  /* ------------------------------------------------------------------------
  CÁLCULO IMPORTE CONCEPTO DEL PAGO
  Suma los importes de los beneficiarios y valida contra Señor Tesorero.
  ------------------------------------------------------------------------ */
  function recalcularImporteConcepto() {
    const inputsBenef = document.querySelectorAll(".input-importe-beneficiario");
    let totalBenef = 0;
    inputsBenef.forEach((input) => {
        totalBenef += parsearImporte(input.value);
    });

    // Actualizar importe de concepto del pago
    const primeraFilaConcepto = document.querySelector("#conceptoPagoBody tr");
    if (primeraFilaConcepto) {
        const inputConcepto = primeraFilaConcepto.querySelector(".input-importe-concepto");
        if (inputConcepto) {
            inputConcepto.value = totalBenef > 0 ? formatearImporte(totalBenef) : "";
        }
    }

    // Validación: concepto del pago no puede superar Señor Tesorero
    const campoTotal = document.getElementById("importeTotal");
    const totalOP    = parsearImporte(campoTotal?.value);
    const errTotal   = document.getElementById("err-importeTotal");

    if (totalOP > 0 && totalBenef > totalOP) {
        if (errTotal) {
            errTotal.textContent = `El total de beneficiarios ($${formatearImporte(totalBenef)}) supera el importe de la OP ($${formatearImporte(totalOP)}).`;
        }
    } else {
        if (errTotal) errTotal.textContent = "";
    }
  }
   
   /* ------------------------------------------------------------------------
      ACCIONES GENERALES DEL FORMULARIO
      ------------------------------------------------------------------------ */
   
   /**
    * Limpia todos los campos de texto del formulario y vacía las tablas
    * dinámicas, dejando una fila inicial en cada una.
    */
  function limpiarFormulario() {
     const confirmar = confirm("¿Está seguro de que desea limpiar todo el formulario?");
     if (!confirmar) return;
   
     // Limpiar inputs de texto simples
     document.querySelectorAll(".hoja input[type='text']").forEach((input) => {
       input.value = "";
       input.classList.remove("input-valido", "input-invalido");
     });
   
     // Limpiar campos "contenteditable"
     document.querySelectorAll(".input-like").forEach((el) => (el.textContent = ""));
   
     // Limpiar mensajes de error
     document.querySelectorAll(".error-msg").forEach((el) => (el.textContent = ""));
   
     // Vaciar tablas dinámicas
     document.getElementById("beneficiariosBody").innerHTML = "";
     document.getElementById("conceptoPagoBody").innerHTML = "";
     document.getElementById("partidasBody").innerHTML = "";
     document.getElementById("conceptoDescripcionContainer").innerHTML = "";
   
     // Restaurar página 1 de 1
     document.getElementById("paginaActual").value = "1";
     document.getElementById("paginaTotal").value = "1";
   
     // Volver a dejar una fila base en cada tabla
     inicializarFilasBase();
     recalcularImporteTotal();
   }
   
   /**
    * Inicia un formulario completamente nuevo: limpia todo sin pedir
    * confirmación adicional (se usa al cargar la página o al pedir "Nuevo").
    */
   function nuevoFormulario() {
     const confirmar = confirm("Esto creará un formulario nuevo y se perderán los datos actuales. ¿Continuar?");
     if (!confirmar) return;
     limpiarFormulario();
   }
   
   /**
    * Agrega una fila inicial a cada tabla dinámica para que el formulario
    * no se muestre vacío al cargar.
    */
   function inicializarFilasBase() {
     agregarFilaBeneficiario();
     agregarFilaConceptoPago();
     agregarFilaPartida();
     agregarLineaDescripcionConcepto();
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
       filename: "orden-de-pago.pdf",
       image: { type: "jpeg", quality: 0.98 },
       html2canvas: { scale: 2, useCORS: true },
       jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
     };
   
     // Ocultamos temporalmente los bordes de los inputs para que el PDF
     // se vea igual que la versión impresa.
     document.body.classList.add("exportando-pdf");
     html2pdf()
       .set(opciones)
       .from(elemento)
       .save()
       .then(() => {
         document.body.classList.remove("exportando-pdf");
       });
   }
   
   /* ------------------------------------------------------------------------
      ASIGNACIÓN DE VALIDACIONES A CAMPOS ESPECÍFICOS
      ------------------------------------------------------------------------ */
   
    function configurarValidaciones() {
      const numeroOrden = document.getElementById("numeroOrden");
      numeroOrden.addEventListener("blur", () => validarSoloNumeros(numeroOrden));
    
      const fechaVencimiento = document.getElementById("fechaVencimiento");
      fechaVencimiento.addEventListener("blur", () => validarFecha(fechaVencimiento));
    
      const fechaRentas = document.getElementById("fechaRentas");
      fechaRentas.addEventListener("blur", () => {
        if (fechaRentas.value.trim() !== "") {
          validarFecha(fechaRentas);
        }
      });
   
    const delegacionContable = document.getElementById("delegacionContable");
    delegacionContable.addEventListener("blur", () => validarCampoObligatorio(delegacionContable));
  
    const expediente = document.getElementById("expediente");
    expediente.addEventListener("blur", () => validarCampoObligatorio(expediente));
  
    const importeTotal = document.getElementById("importeTotal");
    importeTotal.addEventListener("blur", () => validarImporte(importeTotal));
  }
   
  /* ------------------------------------------------------------------------
    INICIALIZACIÓN GENERAL DE EVENTOS
    ------------------------------------------------------------------------ */
  
  function inicializarEventosBotones() {
    const btnNuevo   = document.getElementById("btnNuevo");
    const btnLimpiar = document.getElementById("btnLimpiar");

    if (btnNuevo)   btnNuevo.addEventListener("click", nuevoFormulario);
    if (btnLimpiar) btnLimpiar.addEventListener("click", limpiarFormulario);

    document.getElementById("btnAddBeneficiario").addEventListener("click", agregarFilaBeneficiario);
    document.getElementById("btnDelBeneficiario").addEventListener("click", eliminarFilaBeneficiario);

    document.getElementById("btnAddConcepto").addEventListener("click", agregarFilaConceptoPago);
    document.getElementById("btnDelConcepto").addEventListener("click", eliminarFilaConceptoPago);

    document.getElementById("btnAddPartida").addEventListener("click", agregarFilaPartida);
    document.getElementById("btnDelPartida").addEventListener("click", eliminarFilaPartida);

    document.getElementById("btnImprimir").addEventListener("click", guardarOrdenPago);
    document.getElementById("btnExportarPDF").addEventListener("click", exportarAPDF);

    inicializarPanelSaldos();
  }
  
  /**
  * Punto de entrada: se ejecuta cuando el DOM está completamente cargado.
  */

  /* ------------------------------------------------------------------------
   AUTOCOMPLETADO DESDE IMPUTACIÓN
   Lee el parámetro imputacion_id de la URL y completa los campos.
   ------------------------------------------------------------------------ */
  async function autocompletarDesdeImputacion() {
    const params       = new URLSearchParams(window.location.search);
    const imputacionId = params.get('imputacion_id');
    if (!imputacionId) return;

    // Guardamos el id globalmente para usarlo al guardar
    window._imputacionId = imputacionId;

    try {
      // ── Datos del encabezado (expediente, jurisdicción, ejercicio) ────
      const respDetalle = await fetch(`/api/imputacion/${imputacionId}/detalle/`);
      if (!respDetalle.ok) {
          console.error('No se pudo cargar el detalle de la imputación');
          return;
      }
      const detalle = await respDetalle.json();

      const campExpediente   = document.getElementById('expediente');
      const campEjercicio    = document.getElementById('ejercicio');
      const campJurisdiccion = document.getElementById('jurisdiccion');

      if (campExpediente)   campExpediente.value   = detalle.expediente   || '';
      if (campJurisdiccion) campJurisdiccion.value = detalle.jurisdiccion  || '';
      if (campEjercicio && detalle.detalles.length > 0) {
          campEjercicio.value = detalle.detalles[0].ejercicio || '';
      }

      // ── UPs disponibles con saldo ─────────────────────────────────────
      const respUPs = await fetch(`/api/imputacion/${imputacionId}/ups/`);
      if (!respUPs.ok) {
          console.error('No se pudo cargar las UPs de la imputación');
          return;
      }
      const dataUPs = await respUPs.json();

      const partidasBody = document.getElementById('partidasBody');
      partidasBody.innerHTML = '';

      // JUR viene del detalle (primer registro)
      const jur = detalle.detalles.length > 0 ? detalle.detalles[0].jur : '51';

      dataUPs.ups.forEach((up) => {
          contadorPartidas++;
          const fila = document.createElement('tr');
          fila.dataset.filaId   = contadorPartidas;
          fila.dataset.detalleId = up.imputacion_detalle_id;  // ← clave para el guardado
          fila.dataset.saldoDisponible = up.saldo_disponible;

          fila.innerHTML = `
              <td><input type="text" class="input-cod-partida" value="${jur}"      readonly></td>
              <td><input type="text" class="input-cod-partida" value="${up.prog}"  readonly></td>
              <td><input type="text" class="input-cod-partida" value="00"          readonly></td>
              <td><input type="text" class="input-cod-partida" value="${up.pry}"   readonly></td>
              <td><input type="text" class="input-cod-partida" value="${up.ao}"    readonly></td>
              <td><input type="text" class="input-cod-partida" value="${up.part}"  readonly></td>
              <td><input type="text" class="input-cod-partida" value="${up.fuente_codigo}" readonly></td>
              <td>
                  <input type="text" class="input-desc-partida full"
                          value="${up.denominacion}" readonly>
                  <small class="saldo-label">
                      Disponible: $${formatearImporte(parseFloat(up.saldo_disponible))}
                  </small>
              </td>
              <td>
                  <input type="text"
                          class="input-importe-partida input-importe-up"
                          placeholder="0,00"
                          value="">
              </td>
          `;

          fila.addEventListener('click', () => seleccionarFila(fila, 'partidasBody'));

          const inputImp = fila.querySelector('.input-importe-up');
          inputImp.addEventListener('input', () => {
            // Validación visual: si supera el saldo disponible → rojo
            const val  = parsearImporte(inputImp.value);
            const tope = parseFloat(fila.dataset.saldoDisponible);
            inputImp.style.borderColor = val > tope ? 'red' : '';
            recalcularImporteOrdenPago();
          });
          inputImp.addEventListener('blur', () => {
            formatearInputImporte(inputImp);
            recalcularImporteOrdenPago();
          });          

          partidasBody.appendChild(fila);
          // Dentro del forEach de dataUPs.ups, después de appendChild(fila):
          const upIndex = Array.from(partidasBody.children).length - 1;
          const saldoOrig = parseFloat(up.saldo_disponible);

          inputImp.addEventListener('input', () => {
              const val = parsearImporte(inputImp.value);
              actualizarSaldoEnPanel(upIndex, val, saldoOrig);
          });
      });

      mostrarPanelSaldos(dataUPs.ups);

    } catch (err) {
        console.error('Error autocompletando desde imputación:', err);
    }
  }

  /* ------------------------------------------------------------------------
   CONVERSIÓN DE IMPORTE A LETRAS (es-AR)
   Soporta hasta 999.999.999.999.999.999.999,99
   (novecientos noventa y nueve trillones...)
   Escala larga: 1 billón = 10^12 / 1 trillón = 10^18
   ------------------------------------------------------------------------ */

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

  async function guardarOrdenPago() {
    const imputacionId = window._imputacionId;
    if (!imputacionId) {
        alert('No hay una imputación asociada a esta Orden de Pago.');
        return;
    }

    // ── Recolectar beneficiarios ──────────────────────────────────────────
    const filasBeneficiarios = document.querySelectorAll('#beneficiariosBody tr');
    const beneficiarios = [];

    for (const fila of filasBeneficiarios) {
        const codigo  = fila.querySelector('.input-codigo-beneficiario')?.value.trim() || '';
        const nombre  = fila.querySelector('.input-nombre-beneficiario')?.value.trim() || '';
        const importe = parsearImporte(fila.querySelector('.input-importe-beneficiario')?.value);

        if (!nombre && importe === 0) continue;  // fila vacía

        if (!nombre || importe <= 0) {
            alert('Hay un beneficiario incompleto. Revisá nombre e importe.');
            return;
        }
        beneficiarios.push({ codigo_beneficiario: codigo, beneficiario: nombre, importe });
    }

    if (beneficiarios.length === 0) {
        alert('Agregá al menos un beneficiario con importe.');
        return;
    }

    // ── Recolectar UPs ────────────────────────────────────────────────────
    const filasUPs = document.querySelectorAll('#partidasBody tr');
    const ups = [];

    for (const fila of filasUPs) {
        const detalleId = fila.dataset.detalleId;
        const importe   = parsearImporte(fila.querySelector('.input-importe-up')?.value);

        if (!detalleId) continue;
        if (importe === 0) continue;  // UP con importe 0 se ignora

        if (importe < 0) {
            alert('El importe de una UP no puede ser negativo.');
            return;
        }

        const saldo = parseFloat(fila.dataset.saldoDisponible);
        if (importe > saldo) {
            alert(
                `El importe asignado a una UP supera el saldo disponible.\n` +
                `Disponible: $${formatearImporte(saldo)}\n` +
                `Asignado: $${formatearImporte(importe)}`
            );
            return;
        }

        ups.push({ imputacion_detalle_id: detalleId, importe });
    }

    if (ups.length === 0) {
        alert('Asigná importe a al menos una Unidad Presupuestaria.');
        return;
    }

    // ── V1: beneficiarios no pueden superar el importe de la OP ──────────────
    const totalBenef = beneficiarios.reduce((acc, b) => acc + b.importe, 0);
    const totalUPs   = ups.reduce((acc, u) => acc + u.importe, 0);
    const totalOP    = parsearImporte(document.getElementById('importeTotal')?.value);

    if (totalBenef > totalOP) {
        alert(
            `El total de beneficiarios ($${formatearImporte(totalBenef)}) ` +
            `supera el importe de la Orden de Pago ($${formatearImporte(totalOP)}).\n` +
            `Ajustá los importes antes de guardar.`
        );
        return;
    }

    // ── V2: UPs deben coincidir con el importe de la OP ──────────────────────
    if (Math.abs(totalUPs - totalOP) > 0.01) {
        alert(
            `La suma de UPs ($${formatearImporte(totalUPs)}) ` +
            `no coincide con el importe de la OP ($${formatearImporte(totalOP)}).\n` +
            `Ambas deben ser iguales.`
        );
        return;
    }

    // ── Recolectar concepto del pago ──────────────────────────────────────
    const conceptoLineas = Array.from(
        document.querySelectorAll('#conceptoDescripcionContainer input')
    ).map(i => i.value.trim()).filter(v => v).join(' / ');

    const filasConcepto  = document.querySelectorAll('#conceptoPagoBody tr');
    const codigoConcepto = filasConcepto[0]?.querySelector('.input-codigo-concepto')?.value.trim() || '0';
    const descConcepto   = filasConcepto[0]?.querySelector('.input-desc-concepto')?.value.trim()   || '';

    // ── Armar payload ─────────────────────────────────────────────────────
    const payload = {
        imputacion_id:             imputacionId,
        nro_orden_pago:            document.getElementById('numeroOrden')?.value.trim()             || '',
        fecha_vencimiento:         convertirFechaAIso(document.getElementById('fechaVencimiento')?.value) || null,
        codigo_pago:               document.getElementById('codigoPago')?.value.trim()              || '0',
        descripcion_codigo_pago:   document.getElementById('descripcionCodigoPago')?.value.trim()   || '',
        concepto:                  conceptoLineas,
        nro_factura:               document.getElementById('numeroFactura')?.value.trim()           || '',
        nro_resolucion:            document.getElementById('resolucion')?.value.trim()              || '',
        referencia_administrativa: document.getElementById('referenciaAdministrativa')?.value.trim() || '',
        codigo_concepto_pago:      parseInt(codigoConcepto) || 0,
        concepto_del_pago:         descConcepto,
        beneficiarios,
        ups,
    };

    // ── Validación mínima del encabezado ──────────────────────────────────
    if (!payload.nro_orden_pago) {
        alert('Ingresá el Número de Orden de Pago.');
        return;
    }

    // ── POST a la API ─────────────────────────────────────────────────────
    const btnGuardar = document.getElementById('btnImprimir');
    try {
        btnGuardar.disabled     = true;
        btnGuardar.textContent  = 'Guardando...';

        const csrfToken = getCookie('csrftoken');
        const resp = await fetch('/api/orden-pago/crear/', {
            method:  'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken':  csrfToken,
            },
            body: JSON.stringify(payload),
        });

        const data = await resp.json();

        if (resp.ok) {
            alert(
                `Orden de Pago guardada correctamente.\n` +
                `Total: $${formatearImporte(parseFloat(data.importe_total))}`
            );
        } else {
            alert('Error al guardar: ' + (data.error || 'revisá los datos.'));
        }

    } catch (err) {
        console.error('Error guardando OP:', err);
        alert('Error de red al guardar la Orden de Pago.');
    } finally {
        btnGuardar.disabled    = false;
        btnGuardar.textContent = '💾 Guardar';
    }
  }

  // Convierte "dd/mm/aaaa" → "aaaa-mm-dd" para la API
  function convertirFechaAIso(fechaDDMMAAAA) {
    if (!fechaDDMMAAAA) return null;
    const partes = fechaDDMMAAAA.split('/');
    if (partes.length !== 3) return null;
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  }

  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        for (const cookie of document.cookie.split(';')) {
            const c = cookie.trim();
            if (c.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(c.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
  }

  /* ------------------------------------------------------------------------
   PANEL DE SALDOS DISPONIBLES
   ------------------------------------------------------------------------ */

  function inicializarPanelSaldos() {
    const panel       = document.getElementById('panelSaldos');
    const btnMinimizar = document.getElementById('btnMinimizarOP');

    if (!panel || !btnMinimizar) return;

    // X → minimizar
    btnMinimizar.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.add('minimizado');
    });

    // Clic en el cuadro minimizado → desplegar
    panel.addEventListener('click', () => {
        if (panel.classList.contains('minimizado')) {
            panel.classList.remove('minimizado');
        }
    });
  }

  function mostrarPanelSaldos(ups) {
    const tbody = document.getElementById('tabla-saldos-body-op');
    if (!tbody) return;

    tbody.innerHTML = '';

    ups.forEach((up, i) => {
        const saldo   = parseFloat(up.saldo_disponible);
        const agotado = saldo <= 0;
        const tr = document.createElement('tr');
        tr.dataset.upIndex = i;
        tr.innerHTML = `
            <td title="${up.denominacion} (PRG ${up.prog} / A/O ${up.ao})">${i + 1}</td>
            <td class="${agotado ? 'saldo-rojo' : 'saldo-verde'}">
                $ ${formatearImporte(saldo)}
            </td>
        `;
        tbody.appendChild(tr);
    });
  }

  function actualizarSaldoEnPanel(index, importeAsignado, saldoOriginal) {
    const fila = document.querySelector(`#tabla-saldos-body-op tr[data-up-index="${index}"]`);
    if (!fila) return;

    const celdaSaldo = fila.querySelector('td:last-child');
    if (!celdaSaldo) return;

    const saldoRestante = saldoOriginal - importeAsignado;
    celdaSaldo.textContent = `$ ${formatearImporte(Math.max(saldoRestante, 0))}`;
    celdaSaldo.className   = saldoRestante < 0 ? 'saldo-rojo' : 'saldo-verde';
  }
    
  document.addEventListener("DOMContentLoaded", () => {
    inicializarEventosBotones();
    configurarValidaciones();
    inicializarFilasBase();
    recalcularImporteOrdenPago();
    recalcularImporteConcepto();
    autocompletarDesdeImputacion();
  
    // Autocompletar delegación contable con valor fijo
    const delegacion = document.getElementById("delegacionContable");
    if (delegacion) {
      delegacion.value = "ADM. PCIAL. DE RECURSOS HIDRICOS";
    }
  });
   