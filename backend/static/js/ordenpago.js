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
       recalcularImporteTotal();
     });
     inputImporte.addEventListener("input", recalcularImporteTotal);
   }
   
   /**
    * Elimina la fila actualmente seleccionada de la tabla de beneficiarios.
    */
   function eliminarFilaBeneficiario() {
     eliminarFilaSeleccionada("beneficiariosBody");
     recalcularImporteTotal();
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
         <input type="text" class="input-importe-concepto" placeholder="0,00">
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
      CÁLCULO AUTOMÁTICO DEL IMPORTE TOTAL
      ------------------------------------------------------------------------ */
   
   /**
    * Suma todos los importes cargados en la tabla de beneficiarios y actualiza
    * el campo "Importe Total" del encabezado del formulario.
    */
    function recalcularImporteTotal() {
      const inputsImporte = document.querySelectorAll(".input-importe-beneficiario");
      let total = 0;
    
      inputsImporte.forEach((input) => {
        total += parsearImporte(input.value);
      });
    
      const campoTotal = document.getElementById("importeTotal");
      campoTotal.value = formatearImporte(total);
      actualizarLetras();

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
  
      document.getElementById("btnImprimir").addEventListener("click", imprimirDocumento);
      document.getElementById("btnExportarPDF").addEventListener("click", exportarAPDF);
  }
  
  /**
  * Punto de entrada: se ejecuta cuando el DOM está completamente cargado.
  */

  /* ------------------------------------------------------------------------
   AUTOCOMPLETADO DESDE IMPUTACIÓN
   Lee el parámetro imputacion_id de la URL y completa los campos.
   ------------------------------------------------------------------------ */
  async function autocompletarDesdeImputacion() {
    const params      = new URLSearchParams(window.location.search);
    const imputacionId = params.get('imputacion_id');
    if (!imputacionId) return;

    try {
        const resp = await fetch(`/api/imputacion/${imputacionId}/detalle/`);
        if (!resp.ok) {
            console.error('No se pudo cargar la imputación');
            return;
        }
        const data = await resp.json();

        // ── Campos de encabezado ──────────────────────────────────────────
        const campExpediente = document.getElementById('expediente');
        const campEjercicio  = document.getElementById('ejercicio');
        const campJurisdiccion = document.getElementById('jurisdiccion');

        if (campExpediente)   campExpediente.value   = data.expediente   || '';
        if (campJurisdiccion) campJurisdiccion.value = data.jurisdiccion  || '';

        // Ejercicio — tomar del primer detalle
        if (campEjercicio && data.detalles.length > 0) {
            campEjercicio.value = data.detalles[0].ejercicio || '';
        }

        // ── Tabla de partidas ─────────────────────────────────────────────
        // Limpiar la fila base que se crea al inicializar
        const partidasBody = document.getElementById('partidasBody');
        partidasBody.innerHTML = '';

        data.detalles.forEach((d) => {
            contadorPartidas++;
            const fila = document.createElement('tr');
            fila.dataset.filaId = contadorPartidas;
            fila.innerHTML = `
                <td><input type="text" class="input-cod-partida" value="${d.jur}"  readonly></td>
                <td><input type="text" class="input-cod-partida" value="${d.prog}" readonly></td>
                <td><input type="text" class="input-cod-partida" value="00"        readonly></td>
                <td><input type="text" class="input-cod-partida" value="${d.pry}"  readonly></td>
                <td><input type="text" class="input-cod-partida" value="${d.ao}"   readonly></td>
                <td><input type="text" class="input-cod-partida" value="${d.part}" readonly></td>
                <td><input type="text" class="input-desc-partida full" value="${d.denominacion}" readonly></td>
                <td><input type="text" class="input-importe-partida" value="${formatearImporte(parseFloat(d.importe))}"></td>
            `;
            fila.addEventListener('click', () => seleccionarFila(fila, 'partidasBody'));

            // El importe de partida puede editarse si el usuario lo necesita
            const inputImp = fila.querySelector('.input-importe-partida');
            inputImp.addEventListener('blur', () => formatearInputImporte(inputImp));

            partidasBody.appendChild(fila);
        });

        // ── Importe total ─────────────────────────────────────────────────
        const total = data.detalles.reduce(
            (acc, d) => acc + parseFloat(d.importe), 0
        );
        const campTotal = document.getElementById('importeTotal');
        if (campTotal) campTotal.value = formatearImporte(total);
        actualizarLetras();

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
  
  document.addEventListener("DOMContentLoaded", () => {
    inicializarEventosBotones();
    configurarValidaciones();
    inicializarFilasBase();
    recalcularImporteTotal();
    autocompletarDesdeImputacion();
  
    // Autocompletar delegación contable con valor fijo
    const delegacion = document.getElementById("delegacionContable");
    if (delegacion) {
      delegacion.value = "ADM. PCIAL. DE RECURSOS HIDRICOS";
    }
  });
   