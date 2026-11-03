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

   function revalidarAlEditar(input, validar) {
     const revalidar = () => {
       const contenedorError = document.getElementById(`err-${input.id}`);
       if (input.classList.contains("input-invalido") || contenedorError?.textContent) {
         validar(input);
       }
     };

     input.addEventListener("input", revalidar);
     input.addEventListener("change", revalidar);
   }
   
   /**
    * Valida que el campo solo contenga números (Número de Orden).
    */
   function validarSoloNumeros(input) {
     const valor = input.value.trim();
     const esValido = /^\d{2}-\d{2}-\d{4}$/.test(valor);
     marcarValidacion(input, esValido, "El número debe tener el formato 00-00-0000 (8 dígitos).");
     return esValido;
   }

   function formatearNumeroOrden(input) {
     const posicion = input.selectionStart ?? input.value.length;
     const digitosAntes = input.value.slice(0, posicion).replace(/\D/g, "").length;
     const digitos = input.value.replace(/\D/g, "").slice(0, 8);
     let valorFormateado = digitos;

     if (digitos.length > 2) {
       valorFormateado = `${digitos.slice(0, 2)}-${digitos.slice(2)}`;
     }
     if (digitos.length > 4) {
       valorFormateado = `${digitos.slice(0, 2)}-${digitos.slice(2, 4)}-${digitos.slice(4)}`;
     }

     input.value = valorFormateado;
     const guionesAntes = (digitosAntes > 2 ? 1 : 0) + (digitosAntes > 4 ? 1 : 0);
     const guionesEnPosicion = digitos.length > 2 && digitosAntes === 2 ? 1 : 0;
     input.setSelectionRange(digitosAntes + guionesAntes + guionesEnPosicion, digitosAntes + guionesAntes + guionesEnPosicion);
   }

   function formatearFecha(input) {
     const posicion = input.selectionStart ?? input.value.length;
     const digitosAntes = input.value.slice(0, posicion).replace(/\D/g, "").length;
     let digitos = input.value.replace(/\D/g, "").slice(0, 8);

     let dia = digitos.slice(0, 2);
     let mes = digitos.slice(2, 4);
     const anio = digitos.slice(4, 8);

     if (dia.length === 2 && Number(dia) > 31) dia = "31";
     if (mes.length === 2 && Number(mes) > 12) mes = "12";

     if (dia.length === 2 && mes.length === 2 && Number(mes) >= 1 && Number(mes) <= 12) {
       const anioCompleto = anio.length === 4 ? Number(anio) : null;
       const esBisiesto = anioCompleto !== null
         && anioCompleto % 4 === 0
         && (anioCompleto % 100 !== 0 || anioCompleto % 400 === 0);
       const diasPorMes = [31, esBisiesto || anioCompleto === null ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
       const maximoDia = diasPorMes[Number(mes) - 1];
       if (Number(dia) > maximoDia) dia = String(maximoDia).padStart(2, "0");
     }

     digitos = dia + mes + anio;
     let valorFormateado = digitos;

     if (digitos.length > 2) {
       valorFormateado = `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
     }
     if (digitos.length > 4) {
       valorFormateado = `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
     }

     input.value = valorFormateado;
     const separadoresAntes = (digitosAntes > 2 ? 1 : 0) + (digitosAntes > 4 ? 1 : 0);
     const separadoresEnPosicion = (digitos.length > 2 && digitosAntes === 2 ? 1 : 0)
       + (digitos.length > 4 && digitosAntes === 4 ? 1 : 0);
     const nuevaPosicion = digitosAntes + separadoresAntes + separadoresEnPosicion;
     input.setSelectionRange(nuevaPosicion, nuevaPosicion);
   }

   function validarFecha(input) {
     const partes = input.value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
     let esValida = false;

     if (partes) {
       const dia = Number(partes[1]);
       const mes = Number(partes[2]);
       const anio = Number(partes[3]);
       const esBisiesto = anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);
       const diasPorMes = [31, esBisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
       esValida = anio > 0 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= diasPorMes[mes - 1];
     }

     marcarValidacion(input, esValida, "Ingresá una fecha válida con formato dd/mm/aaaa.");
     return esValida;
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
    const cuerpoTabla = document.getElementById("beneficiariosBody");
    const filas = cuerpoTabla.querySelectorAll("tr");
    const fila = cuerpoTabla.querySelector(".fila-seleccionada") || filas[filas.length - 1];

    if (!fila) return;

    fila.remove();
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
  
    const textarea = document.createElement("textarea");
    textarea.className   = "input-desc-libre";
    textarea.placeholder = "Línea de descripción del concepto";
    textarea.rows        = 1;
  
    // Auto-resize: crece con el contenido, nunca achica por debajo de 1 línea
    textarea.addEventListener("input", () => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    });
  
    linea.appendChild(textarea);
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
     if (!elemento || typeof html2pdf !== "function") {
       throw new Error("No se pudo preparar la exportación de la orden de pago.");
     }

     const opciones = {
       margin: 0,
       filename: "orden-de-pago.pdf",
       image: { type: "jpeg", quality: 0.98 },
       html2canvas: {
         scale: 2,
         useCORS: true,
         backgroundColor: "#ffffff",
         scrollX: 0,
         scrollY: 0
       },
       pagebreak: {
         mode: ["css", "legacy"],
         avoid: ["tr", ".encabezado", ".tabla-datos", ".fila-codigo-pago",
           ".bloque-texto-pago", ".bloque-concepto", ".bloque-resolucion",
           ".rentas-generales", ".pie-inferior"]
       },
       jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
     };

     document.body.classList.add("exportando-pdf");
     html2pdf().set(opciones).from(elemento).save()
       .catch((error) => {
         console.error("Error al exportar la orden de pago a PDF:", error);
         throw error;
       })
       .finally(() => {
         document.body.classList.remove("exportando-pdf");
       });
   }
   
   /* ------------------------------------------------------------------------
      ASIGNACIÓN DE VALIDACIONES A CAMPOS ESPECÍFICOS
      ------------------------------------------------------------------------ */
   
    function configurarValidaciones() {
      const numeroOrden = document.getElementById("numeroOrden");
      numeroOrden.addEventListener("input", () => formatearNumeroOrden(numeroOrden));
      numeroOrden.addEventListener("blur", () => validarSoloNumeros(numeroOrden));
      revalidarAlEditar(numeroOrden, validarSoloNumeros);
    
      const fechaVencimiento = document.getElementById("fechaVencimiento");
      fechaVencimiento.addEventListener("input", () => formatearFecha(fechaVencimiento));
      fechaVencimiento.addEventListener("blur", () => validarFecha(fechaVencimiento));
      revalidarAlEditar(fechaVencimiento, validarFecha);
   
      const delegacionContable = document.getElementById("delegacionContable");
      delegacionContable.addEventListener("blur", () => validarCampoObligatorio(delegacionContable));
      revalidarAlEditar(delegacionContable, validarCampoObligatorio);
    
      const expediente = document.getElementById("expediente");
      expediente.addEventListener("blur", () => validarCampoObligatorio(expediente));
      revalidarAlEditar(expediente, validarCampoObligatorio);
    
      const importeTotal = document.getElementById("importeTotal");
      importeTotal.addEventListener("blur", () => validarImporte(importeTotal));
      revalidarAlEditar(importeTotal, validarImporte);
    }
   
  /* ------------------------------------------------------------------------
    INICIALIZACIÓN GENERAL DE EVENTOS
    ------------------------------------------------------------------------ */
  
  function inicializarEventosBotones() {
    const btnNuevo   = document.getElementById("btnNuevo");
    const btnLimpiar = document.getElementById("btnLimpiar");

    if (btnNuevo)   btnNuevo.addEventListener("click", nuevoFormulario);
    if (btnLimpiar) btnLimpiar.addEventListener("click", limpiarFormulario);

    document.getElementById("btnAddBeneficiario")?.addEventListener("click", agregarFilaBeneficiario);
    document.getElementById("btnDelBeneficiario")?.addEventListener("click", eliminarFilaBeneficiario);
    document.getElementById("btnImprimir")?.addEventListener("click", guardarOrdenPago);
    document.getElementById("btnExportarPDF")?.addEventListener("click", exportarAPDF);

    inicializarPanelSaldos();
  }
  
  /**
  * Punto de entrada: se ejecuta cuando el DOM está completamente cargado.
  */

  /* ------------------------------------------------------------------------
   FUENTES DE FINANCIAMIENTO (título del bloque inferior de la hoja)
   Se calcula a partir de las filas actuales de #partidasBody:
     - se identifica cada fuente por su ID (no por su descripción)
     - se quitan duplicados con un Map (una entrada por ID)
     - se ordena por código de fuente para que el resultado sea estable
   La descripción proviene de la API (FuenteFinanciamiento.nombre).
   Una fuente desaparece solo cuando ya no queda ninguna fila que la use,
   porque el texto se reconstruye siempre desde las filas que existen.
   ------------------------------------------------------------------------ */
  function actualizarFuentesFinanciamiento() {
    const destino = document.getElementById('fuentesFinanciamiento');
    if (!destino) return;

    const fuentes = new Map(); // fuente_id -> { codigo, nombre }
    document.querySelectorAll('#partidasBody tr').forEach((fila) => {
      const id = fila.dataset.fuenteId;
      if (!id || fuentes.has(id)) return;   // fila sin fuente, o fuente ya registrada
      fuentes.set(id, {
        codigo: Number(fila.dataset.fuenteCodigo),
        nombre: (fila.dataset.fuenteNombre || '').trim(),
      });
    });

    destino.textContent = Array.from(fuentes.values())
      .sort((a, b) => (a.codigo - b.codigo) || a.nombre.localeCompare(b.nombre))
      .map((f) => f.nombre)
      .filter(Boolean)
      .join(' / ');
  }

  // Recalcula cuando se agregan, quitan o vacían filas de partidas (cubre
  // carga desde la imputación, eliminarFilaPartida y limpiarFormulario).
  function observarFuentesFinanciamiento() {
    const cuerpo = document.getElementById('partidasBody');
    if (!cuerpo) return;
    new MutationObserver(actualizarFuentesFinanciamiento).observe(cuerpo, { childList: true });
    actualizarFuentesFinanciamiento();
  }

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
      const campJurisdiccion = document.getElementById('jurisdiccion');

      if (campExpediente)   campExpediente.value   = detalle.expediente   || '';
      if (campJurisdiccion) campJurisdiccion.value = detalle.jurisdiccion  || '';

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
          fila.dataset.fuenteId     = up.fuente_id;      // identifica la fuente (no se compara por texto)
          fila.dataset.fuenteCodigo = up.fuente_codigo;
          fila.dataset.fuenteNombre = up.fuente;         // descripción real desde la BD

          fila.innerHTML = `
            <td><input type="text" class="input-cod-partida" value="${jur}"               readonly></td>
            <td><input type="text" class="input-cod-partida" value="${up.prog}"           readonly></td>
            <td><input type="text" class="input-cod-partida" value="00"                   readonly></td>
            <td><input type="text" class="input-cod-partida" value="${up.pry}"            readonly></td>
            <td><input type="text" class="input-cod-partida" value="${up.ao}"             readonly></td>
            <td><input type="text" class="input-cod-partida" value="${up.part}"           readonly></td>
            <td><input type="text" class="input-cod-partida" value="${up.fuente_codigo}"  readonly></td>
            <td><input type="text" class="input-cod-partida col-partida-desc" value="${up.denominacion || ''}" readonly></td>
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

  /* ------------------------------------------------------------------------
    FECHA DE RENTAS GENERALES — selector con formato dd de mes de aaaa
    ------------------------------------------------------------------------ */
  const MESES_RENTAS = [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre'
  ];

  function formatearFechaRentas(valorISO) {
    if (!valorISO) return '';
    const [anio, mes, dia] = valorISO.split('-').map(Number);
    return `${dia} de ${MESES_RENTAS[mes - 1]} de ${anio}`;
  }

  function mostrarFechaFormateada(contenedor, valorISO) {
    contenedor.innerHTML = '';

    const inputTexto     = document.createElement('input');
    inputTexto.type      = 'text';
    inputTexto.className = 'input-linea centrado';
    inputTexto.value     = formatearFechaRentas(valorISO);
    inputTexto.readOnly  = true;
    inputTexto.dataset.valorIso = valorISO;

    const btnCambiar       = document.createElement('button');
    btnCambiar.type        = 'button';
    btnCambiar.textContent = '✎';
    btnCambiar.title       = 'Cambiar fecha';
    btnCambiar.className   = 'btn-cambiar-fecha no-print';
    btnCambiar.addEventListener('click', () => mostrarSelectorFecha(contenedor));

    contenedor.appendChild(inputTexto);
    contenedor.appendChild(btnCambiar);
  }

  function mostrarSelectorFecha(contenedor) {
    // Leer valor previo ANTES de limpiar
    const valorPrevio = contenedor.querySelector('[data-valor-iso]')?.dataset?.valorIso || '';

    contenedor.innerHTML = '';

    const inputDate     = document.createElement('input');
    inputDate.type      = 'date';
    inputDate.className = 'input-linea centrado';
    inputDate.value     = valorPrevio;

    inputDate.addEventListener('change', () => {
      if (!inputDate.value) return;
      mostrarFechaFormateada(contenedor, inputDate.value);
    });

    contenedor.appendChild(inputDate);
    inputDate.focus();
  }

  // Inicializar
  const contenedorFechaRentas = document.getElementById('fechaRentasWrapper');
  if (contenedorFechaRentas) {
    const inputOriginal = document.getElementById('fechaRentas');
    if (inputOriginal) inputOriginal.remove();
    mostrarSelectorFecha(contenedorFechaRentas);
  }

  /* ------------------------------------------------------------------------
   MODAL DE VALIDACIÓN
   ------------------------------------------------------------------------ */
  function mostrarModalValidacion(errores) {
    const overlay = document.getElementById('modalValidacion');
    const lista   = document.getElementById('modalValidacionLista');
    const btnCerrar = document.getElementById('modalValidacionCerrar');

    lista.innerHTML = '';
    errores.forEach(msg => {
      const li = document.createElement('li');
      li.textContent = msg;
      lista.appendChild(li);
    });

    overlay.style.display = 'flex';

    // Cerrar con el botón
    btnCerrar.onclick = () => { overlay.style.display = 'none'; };

    // Cerrar haciendo clic fuera de la caja
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    };
  }

  async function guardarOrdenPago() {
    const imputacionId = window._imputacionId;
    const errores = [];
  
    // ── Validaciones de encabezado ────────────────────────────────────────
    const numeroOrden = document.getElementById('numeroOrden')?.value.trim();
    if (!numeroOrden) errores.push('Número de Orden de Pago es obligatorio.');
    else if (!/^\d{2}-\d{2}-\d{4}$/.test(numeroOrden)) {
      errores.push('El número de orden debe tener el formato 00-00-0000 (8 dígitos).');
    }
  
    const expediente = document.getElementById('expediente')?.value.trim();
    if (!expediente) errores.push('Expediente Nº es obligatorio.');
  
    const ejercicio = document.getElementById('ejercicio')?.value.trim();
    if (!ejercicio) errores.push('Ejercicio es obligatorio.');
  
    const jurisdiccion = document.getElementById('jurisdiccion')?.value.trim();
    if (!jurisdiccion) errores.push('Jurisdicción es obligatoria.');
  
    const codigoPago = document.getElementById('codigoPago')?.value.trim();
    if (!codigoPago) errores.push('Código de Pago es obligatorio.');
  
    const fechaVencimiento = document.getElementById('fechaVencimiento')?.value.trim();
    if (!fechaVencimiento) {
      errores.push('Fecha de Vencimiento es obligatoria.');
    } else if (!validarFecha(document.getElementById('fechaVencimiento'))) {
      errores.push('Fecha de Vencimiento debe ser válida y tener formato dd/mm/aaaa.');
    }
  
    const importeTotal = parsearImporte(document.getElementById('importeTotal')?.value);
    if (importeTotal <= 0) errores.push('El importe total debe ser mayor a cero.');
  
    // ── Validación de imputación ──────────────────────────────────────────
    if (!imputacionId) errores.push('No hay una imputación asociada a esta Orden de Pago.');
  
    // ── Validación de beneficiarios ───────────────────────────────────────
    const filasBenef = document.querySelectorAll('#beneficiariosBody tr');
    const beneficiarios = [];
    let benefIncompleto = false;
  
    for (const fila of filasBenef) {
      const nombre  = fila.querySelector('.input-nombre-beneficiario')?.value.trim() || '';
      const importe = parsearImporte(fila.querySelector('.input-importe-beneficiario')?.value);
      const codigo  = fila.querySelector('.input-codigo-beneficiario')?.value.trim() || '';
  
      if (!nombre && importe === 0) continue; // fila vacía, se ignora
  
      if (!nombre || importe <= 0) {
        benefIncompleto = true;
        break;
      }
      beneficiarios.push({ codigo_beneficiario: codigo, beneficiario: nombre, importe });
    }
  
    if (benefIncompleto) errores.push('Hay un beneficiario incompleto (falta nombre o importe).');
    if (beneficiarios.length === 0 && !benefIncompleto) errores.push('Agregá al menos un beneficiario con importe.');
  
    // ── Validación de UPs ─────────────────────────────────────────────────
    const filasUPs = document.querySelectorAll('#partidasBody tr');
    const ups = [];
    let upNegativa = false;
    let upSuperaSaldo = false;
    let detalleSuperaSaldo = '';
  
    for (const fila of filasUPs) {
      const detalleId = fila.dataset.detalleId;
      const importe   = parsearImporte(fila.querySelector('.input-importe-up')?.value);
  
      if (!detalleId || importe === 0) continue;
  
      if (importe < 0) { upNegativa = true; break; }
  
      const saldo = parseFloat(fila.dataset.saldoDisponible);
      if (importe > saldo) {
        upSuperaSaldo = true;
        detalleSuperaSaldo = `Disponible: $${formatearImporte(saldo)} / Asignado: $${formatearImporte(importe)}`;
        break;
      }
      ups.push({ imputacion_detalle_id: detalleId, importe });
    }
  
    if (upNegativa)    errores.push('El importe de una Unidad Presupuestaria no puede ser negativo.');
    if (upSuperaSaldo) errores.push(`Un importe de UP supera el saldo disponible. ${detalleSuperaSaldo}`);
    if (ups.length === 0 && !upNegativa && !upSuperaSaldo) errores.push('Asigná importe a al menos una Unidad Presupuestaria.');
  
    // ── Validación cruzada ────────────────────────────────────────────────
    const totalBenef = beneficiarios.reduce((acc, b) => acc + b.importe, 0);
    const totalUPs   = ups.reduce((acc, u) => acc + u.importe, 0);
  
    if (beneficiarios.length > 0 && totalBenef > importeTotal) {
      errores.push(`El total de beneficiarios ($${formatearImporte(totalBenef)}) supera el importe de la OP ($${formatearImporte(importeTotal)}).`);
    }
    if (ups.length > 0 && Math.abs(totalUPs - importeTotal) > 0.01) {
      errores.push(`La suma de UPs ($${formatearImporte(totalUPs)}) no coincide con el importe de la OP ($${formatearImporte(importeTotal)}).`);
    }
    
      // ── Validación de código de beneficiario ──────────────────────────────
    for (const fila of filasBenef) {
      const nombre  = fila.querySelector('.input-nombre-beneficiario')?.value.trim() || '';
      const codigo  = fila.querySelector('.input-codigo-beneficiario')?.value.trim() || '';
      const importe = parsearImporte(fila.querySelector('.input-importe-beneficiario')?.value);
      if (!nombre && importe === 0) continue; // fila vacía
      if (!codigo) {
        errores.push('Falta el código en uno o más beneficiarios.');
        break;
      }
    }

    // ── Validación de concepto del pago ───────────────────────────────────
    const filasConceptoVal = document.querySelectorAll('#conceptoPagoBody tr');
    for (const fila of filasConceptoVal) {
      const cod  = fila.querySelector('.input-codigo-concepto')?.value.trim() || '';
      const desc = fila.querySelector('.input-desc-concepto')?.value.trim()   || '';
      if (!cod)  { errores.push('Falta el código en Concepto del Pago.');       break; }
      if (!desc) { errores.push('Falta la descripción en Concepto del Pago.');  break; }
    }

    // ── Validación de descripción del concepto (bloque libre) ────────────
    const descripcionConcepto = Array.from(
      document.querySelectorAll('#conceptoDescripcionContainer textarea')
    ).map(t => t.value.trim()).filter(v => v);
    if (descripcionConcepto.length === 0) {
      errores.push('La descripción del concepto es obligatoria.');
    }

    // ── Validación de número de factura ───────────────────────────────────
    const nroFactura = document.getElementById('numeroFactura')?.value.trim();
    if (!nroFactura) errores.push('El número de factura es obligatorio.');

    // ── Validación de resolución ──────────────────────────────────────────
    const nroResolucion = document.getElementById('resolucion')?.value.trim();
    if (!nroResolucion) errores.push('El número de resolución es obligatorio.');

    // ── Validación de licitación y decreto ────────────────────────────────
    const licitacion = document.getElementById('licitacion')?.value.trim();
    const decreto = document.getElementById('decreto')?.value.trim();
    if (!licitacion) errores.push('La licitación es obligatoria.');
    if (!decreto) errores.push('El decreto es obligatorio.');

    // ── Validación de fecha de Rentas Generales ───────────────────────────
    const inputFechaRentas = document.querySelector('#fechaRentasWrapper [data-valor-iso]');
    if (!inputFechaRentas?.dataset?.valorIso) {
      errores.push('La fecha de Rentas Generales es obligatoria.');
    }

    // ── Si hay errores → mostrar modal y frenar ───────────────────────────
    if (errores.length > 0) {
      mostrarModalValidacion(errores);
      return;
    }
  
    // ── A partir de acá todo está validado: continuar con el POST ─────────
    const conceptoLineas = Array.from(
      document.querySelectorAll('#conceptoDescripcionContainer textarea')
    ).map(t => t.value.trim()).filter(v => v).join(' / ');
    
    const filasConcepto  = document.querySelectorAll('#conceptoPagoBody tr');
    const codigoConcepto = filasConcepto[0]?.querySelector('.input-codigo-concepto')?.value.trim() || '0';
    const descConcepto   = filasConcepto[0]?.querySelector('.input-desc-concepto')?.value.trim()   || '';
  
    const payload = {
      imputacion_id:             imputacionId,
      nro_orden_pago:            numeroOrden,
      fecha_vencimiento:         convertirFechaAIso(fechaVencimiento) || null,
      codigo_pago:               codigoPago,
      descripcion_codigo_pago:   document.getElementById('descripcionCodigoPago')?.value.trim() || '',
      concepto:                  conceptoLineas,
      nro_factura:               document.getElementById('numeroFactura')?.value.trim()          || '',
      nro_resolucion:            document.getElementById('resolucion')?.value.trim()             || '',
      licitacion:                licitacion || '',
      decreto:                   decreto || '',
      nro_resolucion_rectificatoria: document.getElementById('nroResolucionRectificatoria')?.value.trim() || '',
      codigo_concepto_pago:      parseInt(codigoConcepto) || 0,
      concepto_del_pago:         descConcepto,
      beneficiarios,
      ups,
      fecha_rentas: document.querySelector('#fechaRentasWrapper [data-valor-iso]')?.dataset?.valorIso || null,
    };
  
    const btnGuardar = document.getElementById('btnImprimir');
    try {
      btnGuardar.disabled    = true;
      btnGuardar.textContent = 'Guardando...';
  
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
      console.log('Respuesta backend:', data); 
  
      if (resp.ok) {
        alert(`Orden de Pago guardada correctamente.\nTotal: $${formatearImporte(parseFloat(data.importe_total))}`);
      } else {
        mostrarModalValidacion([data.error || 'Error al guardar. Revisá los datos.']);
      }
  
    } catch (err) {
      console.error('Error guardando OP:', err);
      mostrarModalValidacion(['Error de red al guardar la Orden de Pago.']);
    } finally {
      btnGuardar.disabled    = false;
      btnGuardar.innerHTML   = '<i class="fa-solid fa-floppy-disk"></i> Guardar orden de pago';
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
    const btnRestaurar = panel?.querySelector('.panel-saldos-icono');

    if (!panel || !btnMinimizar || !btnRestaurar) return;

    const actualizarEstadoPanel = (minimizado) => {
      panel.classList.toggle('minimizado', minimizado);
      btnMinimizar.setAttribute('aria-expanded', String(!minimizado));
      btnRestaurar.setAttribute('aria-expanded', String(!minimizado));
    };

    btnMinimizar.addEventListener('click', () => actualizarEstadoPanel(true));
    btnRestaurar.addEventListener('click', () => actualizarEstadoPanel(false));
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
    celdaSaldo.className   = saldoRestante <= 0 ? 'saldo-rojo' : 'saldo-verde';
  }

  /* ------------------------------------------------------------------------
   CARGA DE CÓDIGOS DE PAGO
   ------------------------------------------------------------------------ */
  async function cargarCodigosPago() {
    try {
      const resp = await fetch('/api/codigos-pago/');
      if (!resp.ok) return;
      const codigos = await resp.json();

      const select = document.getElementById('codigoPago');
      if (!select) return;

      // Guardar el mapa código → descripción para el autocompletado
      window._codigosPagoMap = {};

      codigos.forEach(({ codigo, descripcion }) => {
        window._codigosPagoMap[codigo] = descripcion;
        const option = document.createElement('option');
        option.value       = codigo;
        option.textContent = `${codigo}`;
        select.appendChild(option);
      });

      // Al cambiar la selección, autocompletar la descripción
      select.addEventListener('change', () => {
        const desc = document.getElementById('descripcionCodigoPago');
        if (desc) {
          desc.value = window._codigosPagoMap[select.value] || '';
        }
      });

    } catch (err) {
      console.error('Error cargando códigos de pago:', err);
    }
  }
    
  document.addEventListener("DOMContentLoaded", () => {
    inicializarEventosBotones();
    configurarValidaciones();
    inicializarFilasBase();
    recalcularImporteOrdenPago();
    recalcularImporteConcepto();
    autocompletarDesdeImputacion();
    cargarCodigosPago(); 
    observarFuentesFinanciamiento();

    // Inicializar: usar el wrapper, no el contenedor completo
    const contenedorFechaRentas = document.getElementById('fechaRentasWrapper');
    if (contenedorFechaRentas) {
      const inputOriginal = document.getElementById('fechaRentas');
      if (inputOriginal) inputOriginal.remove();
      mostrarSelectorFecha(contenedorFechaRentas);
    }
  
    const delegacion = document.getElementById("delegacionContable");
    if (delegacion) {
      delegacion.value = "ADM. PCIAL. DE RECURSOS HIDRICOS";
    }
  });