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
    recalcularImporteConcepto();
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

    // La suma de los beneficiarios debe ser EXACTAMENTE el importe del Señor Tesorero
    if (totalBenef > 0 && Math.abs(totalBenef - totalOP) > 0.005) {
        if (errTotal) {
            errTotal.textContent = `La suma de los beneficiarios ($${formatearImporte(totalBenef)}) debe ser exactamente igual al importe del Señor Tesorero ($${formatearImporte(totalOP)}).`;
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
   async function exportarAPDF() {
     const elemento = document.getElementById("hoja");
     if (!elemento || typeof html2pdf !== "function") {
       throw new Error("No se pudo preparar la exportación de la orden de pago.");
     }

     const opciones = {
       margin: 0,
       image: { type: "jpeg", quality: 0.98 },
       html2canvas: {
         scale: 2,
         useCORS: true,
         backgroundColor: "#ffffff",
         scrollX: 0,
         scrollY: 0,
         onclone: (documentoClonado) => {
           const hojaClonada = documentoClonado.getElementById("hoja");
           if (!hojaClonada) {
             throw new Error("No se pudo preparar la hoja para exportar.");
           }
           hojaClonada.querySelectorAll("input, textarea, select").forEach((campo) => {
             const valor = campo.tagName === "SELECT"
               ? campo.selectedOptions[0]?.textContent?.trim() || campo.value
               : campo.value || campo.placeholder;
             const texto = documentoClonado.createElement("span");
             texto.className = `pdf-value ${campo.className}`;
             texto.textContent = valor;
             campo.replaceWith(texto);
           });
         }
       },
       jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
     };

     const raiz = document.documentElement;
     raiz.classList.add("exportando-pdf");
     try {
       await new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(resolver)));

       const trabajador = html2pdf().set(opciones).from(elemento);
       const canvas = await trabajador.toCanvas().get("canvas");
       if (!canvas.width || !canvas.height) {
         throw new Error("La hoja no produjo una imagen válida para el PDF.");
       }
       await trabajador.toPdf();
       const pdf = await trabajador.get("pdf");

       while (pdf.getNumberOfPages() > 1) {
         pdf.deletePage(pdf.getNumberOfPages());
       }
       if (pdf.getNumberOfPages() !== 1) {
         throw new Error("No se pudo ajustar la orden a una sola página.");
       }

       const anchoPagina = pdf.internal.pageSize.getWidth();
       const altoPagina = pdf.internal.pageSize.getHeight();
       const margen = 5;
       const escala = Math.min(
         (anchoPagina - margen * 2) / canvas.width,
         (altoPagina - margen * 2) / canvas.height
       );
       const anchoImagen = canvas.width * escala;
       const altoImagen = canvas.height * escala;
       const posicionX = (anchoPagina - anchoImagen) / 2;
       const posicionY = (altoPagina - altoImagen) / 2;
       const imagen = canvas.toDataURL("image/jpeg", 0.98);

       pdf.setPage(1);
       pdf.setFillColor(255, 255, 255);
       pdf.rect(0, 0, anchoPagina, altoPagina, "F");
       pdf.addImage(imagen, "JPEG", posicionX, posicionY, anchoImagen, altoImagen);
       pdf.save("orden-de-pago.pdf");
     } catch (error) {
       console.error("Error al exportar la orden de pago a PDF:", error);
       throw error;
     } finally {
       raiz.classList.remove("exportando-pdf");
     }
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
    const imputacionId = params.get('imputacion_id') || (window.OP_DATOS && window.OP_DATOS.imputacion_id);
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

      // Modo "Ver": solo el encabezado. Las UP se arman desde la propia OP (la lista de UP con saldo
      // no sirve acá: omite las UP que esta OP agotó).
      window._jurVer = detalle.detalles.length > 0 ? detalle.detalles[0].jur : '51';
      if (window.OP_MODO === 'ver') {
        const campEjercicio = document.getElementById('ejercicio');
        if (campEjercicio && detalle.detalles.length > 0 && detalle.detalles[0].ejercicio) {
          campEjercicio.value = detalle.detalles[0].ejercicio;
        }
        return;
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
    mostrarFechaFormateada(contenedorFechaRentas, hoyISO());
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

  /* ------------------------------------------------------------------------
   GUARDADO AUTOMÁTICO DEL BORRADOR + COMPLETAR (Revisar → Listo)

   - Abrir el formulario NO crea nada: el borrador se crea con la primera edición real.
   - Cada cambio se guarda solo (debounce + al salir del campo). Si el contenido no cambió
     respecto de lo último confirmado por el servidor, no se envía nada.
   - El servidor devuelve una "versión": si otra persona u otra pestaña modificó el borrador,
     responde 409 y NO se pisan sus cambios (se bloquea el autoguardado y se avisa).
   - Un borrador nunca consume fondos: eso solo ocurre al completar (en el servidor).
   ------------------------------------------------------------------------ */
  const OP_AUTOGUARDADO_MS = 1500;
  const OP_ESTADO = {
    id: null,               // id del borrador (null hasta el primer guardado)
    version: null,          // versión que el servidor nos devolvió por última vez
    imputacionId: null,
    clave: null,            // UUID del primer guardado (evita duplicados si se pierde la respuesta)
    ultimoGuardado: null,   // contenido (JSON) confirmado por el servidor
    timer: null,
    cola: Promise.resolve(),
    activo: false,          // true cuando terminó de cargar y restaurar
    bloqueado: false,       // true ante conflicto / borrador completado o inexistente
    completando: false,
    cancelando: false,
    guardadoController: null,
  };

  function generarUUID() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  function hoyISO() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function isoADDMMAAAA(iso) {
    if (!iso) return '';
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }

  function esFechaISOValida(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const f = new Date(`${iso}T00:00:00`);
    return !isNaN(f.getTime()) && f.toISOString().slice(0, 10) === iso;
  }

  function postJSON(url, cuerpo, opciones = {}) {
    return fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      signal: opciones.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken') || '',
      },
      body: JSON.stringify(cuerpo),
    });
  }

  /* ── Carteles flotantes (autoguardado / OP completada) ─────────────────── */
  function mostrarCartel(el, duracion) {
    if (!el) return;
    clearTimeout(el._cartelTimer);
    el.classList.add('visible');
    if (duracion) el._cartelTimer = setTimeout(() => ocultarCartel(el), duracion);
  }

  function ocultarCartel(el) {
    if (!el) return;
    clearTimeout(el._cartelTimer);
    el.classList.remove('visible');
  }

  /** Solo el éxito confirmado por el servidor muestra «Borrador guardado»; el resto de los
   *  estados (nuevo, previo, pendiente, guardando, sincambios) no muestra nada. */
  function mostrarEstadoGuardado(estado, texto) {
    const el = document.getElementById('estadoGuardado');
    if (!el || OP_ESTADO.cancelando) return;
    if (estado === 'guardado') {
      el.textContent = 'Borrador guardado (estado: Revisar)';
      el.classList.remove('op-cartel--error');
      mostrarCartel(el, 2500);
    } else if (estado === 'error' || estado === 'sinconexion') {
      el.textContent = estado === 'sinconexion'
        ? 'Sin conexión: se reintentará automáticamente.'
        : (texto || 'No se pudo guardar el borrador.');
      el.classList.add('op-cartel--error');
      mostrarCartel(el, OP_ESTADO.bloqueado ? 0 : 6000);
    }
    el.dataset.estado = estado;
  }

  function mostrarCartelCompletado(total) {
    ocultarCartel(document.getElementById('estadoGuardado'));
    const importe = document.getElementById('opCartelImporte');
    if (importe) importe.textContent = `$ ${formatearImporte(total)}`;
    mostrarCartel(document.getElementById('opCartelCompletado'), 0);
  }

  function mostrarAviso(mensaje, { recargar = false, irRegistros = false } = {}) {
    const el = document.getElementById('opAviso');
    if (!el) { alert(mensaje); return; }
    el.textContent = '';
    const texto = document.createElement('span');
    texto.textContent = mensaje + ' ';
    el.appendChild(texto);
    if (recargar) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn-accion';
      b.textContent = 'Recargar';
      b.addEventListener('click', () => window.location.reload());
      el.appendChild(b);
    }
    if (irRegistros) {
      const a = document.createElement('a');
      a.className = 'btn-accion btn-link';
      a.href = (document.getElementById('ordenpagoPage')?.dataset.registrosUrl || '/');
      a.textContent = 'Ir a Registros';
      el.appendChild(a);
    }
    el.hidden = false;
  }

  /** Foto de lo que hay en pantalla, en el formato que espera el servidor. */
  function recolectarContenido() {
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    const contenido = {
      nro_orden_pago:                val('numeroOrden'),
      fecha:                         document.querySelector('#fechaRentasWrapper [data-valor-iso]')?.dataset?.valorIso || '',
      codigo_pago:                   val('codigoPago'),
      descripcion_codigo_pago:       val('descripcionCodigoPago'),
      concepto_lineas:               Array.from(document.querySelectorAll('#conceptoDescripcionContainer textarea')).map((t) => t.value),
      nro_factura:                   val('numeroFactura'),
      nro_resolucion:                val('resolucion'),
      nro_resolucion_rectificatoria: val('nroResolucionRectificatoria'),
      decreto:                       val('decreto'),
      licitacion:                    val('licitacion'),
    };

    // Fecha de vencimiento: vacía se envía vacía; incompleta (mientras se escribe) no se envía.
    const venc = val('fechaVencimiento');
    if (!venc) {
      contenido.fecha_vencimiento = '';
    } else {
      const iso = convertirFechaAIso(venc);
      if (iso && esFechaISOValida(iso)) contenido.fecha_vencimiento = iso;
    }

    // Concepto del pago (primera fila): el código debe ser numérico; mientras no lo sea no se envía.
    const filaConcepto = document.querySelector('#conceptoPagoBody tr');
    const codConcepto  = (filaConcepto?.querySelector('.input-codigo-concepto')?.value || '').trim();
    if (/^\d*$/.test(codConcepto)) contenido.codigo_concepto_pago = codConcepto;
    contenido.concepto_del_pago = (filaConcepto?.querySelector('.input-desc-concepto')?.value || '').trim();

    contenido.beneficiarios = Array.from(document.querySelectorAll('#beneficiariosBody tr')).map((f) => {
      const crudo = (f.querySelector('.input-importe-beneficiario')?.value || '').trim();
      return {
        codigo_beneficiario: (f.querySelector('.input-codigo-beneficiario')?.value || '').trim(),
        beneficiario:        (f.querySelector('.input-nombre-beneficiario')?.value || '').trim(),
        importe:             crudo === '' ? '' : String(parsearImporte(crudo)),
      };
    });

    contenido.ups = [];
    document.querySelectorAll('#partidasBody tr').forEach((f) => {
      const detalleId = f.dataset.detalleId;
      const importe = parsearImporte(f.querySelector('.input-importe-up')?.value);
      if (detalleId && importe > 0) contenido.ups.push({ imputacion_detalle_id: detalleId, importe: String(importe) });
    });

    return contenido;
  }

  function programarGuardado(demora = OP_AUTOGUARDADO_MS) {
    if (!OP_ESTADO.activo || OP_ESTADO.bloqueado || OP_ESTADO.completando || OP_ESTADO.cancelando) return;
    clearTimeout(OP_ESTADO.timer);
    mostrarEstadoGuardado('pendiente');
    OP_ESTADO.timer = setTimeout(() => guardarBorrador(), demora);
  }

  /** Un solo guardado a la vez (en orden). Devuelve { ok, sinCambios }. */
  function guardarBorrador({ forzar = false } = {}) {
    clearTimeout(OP_ESTADO.timer);
    if (OP_ESTADO.cancelando) return Promise.resolve({ ok: false, cancelado: true });
    OP_ESTADO.cola = OP_ESTADO.cola.then(() => ejecutarGuardado(forzar)).catch(() => ({ ok: false }));
    return OP_ESTADO.cola;
  }

  async function ejecutarGuardado(forzar) {
    if (OP_ESTADO.bloqueado || OP_ESTADO.cancelando) return { ok: false, cancelado: OP_ESTADO.cancelando };
    const contenido = recolectarContenido();
    const instantanea = JSON.stringify(contenido);

    if (!forzar && instantanea === OP_ESTADO.ultimoGuardado) {
      if (OP_ESTADO.id) mostrarEstadoGuardado('sincambios');
      return { ok: true, sinCambios: true };
    }

    mostrarEstadoGuardado('guardando');
    const controller = new AbortController();
    OP_ESTADO.guardadoController = controller;
    try {
      let resp, data;
      if (!OP_ESTADO.id) {
        resp = await postJSON('/api/orden-pago/borrador/crear/', {
          ...contenido,
          imputacion_id: OP_ESTADO.imputacionId,
          clave_idempotencia: OP_ESTADO.clave,
        }, { signal: controller.signal });
        data = await resp.json().catch(() => ({}));
        if (resp.ok) {
          OP_ESTADO.id = data.orden_pago_id;
          OP_ESTADO.version = data.version;
          if (data.url_editar) window.history.replaceState(null, '', data.url_editar);
          if (data.existente) {
            // Reintento de un primer guardado cuya respuesta se perdió: se reenvía el contenido
            // como actualización del mismo borrador.
            OP_ESTADO.ultimoGuardado = null;
            return await ejecutarGuardado(true);
          }
        }
      } else {
        resp = await postJSON(`/api/orden-pago/borrador/${OP_ESTADO.id}/actualizar/`, {
          ...contenido,
          version: OP_ESTADO.version,
        }, { signal: controller.signal });
        data = await resp.json().catch(() => ({}));
        if (resp.ok) OP_ESTADO.version = data.version;
      }

      if (resp.ok) {
        OP_ESTADO.ultimoGuardado = instantanea;
        mostrarEstadoGuardado('guardado');
        return { ok: true };
      }
      return manejarErrorGuardado(resp.status, data);
    } catch (err) {
      if (OP_ESTADO.cancelando) return { ok: false, cancelado: true };
      console.error('Error de red guardando el borrador:', err);
      mostrarEstadoGuardado('sinconexion');
      OP_ESTADO.timer = setTimeout(() => guardarBorrador(), 5000);
      return { ok: false, red: true };
    } finally {
      if (OP_ESTADO.guardadoController === controller) OP_ESTADO.guardadoController = null;
    }
  }

  function bloquearEdicion(mensaje, opciones) {
    OP_ESTADO.bloqueado = true;
    clearTimeout(OP_ESTADO.timer);
    document.getElementById('btnCompletar')?.setAttribute('disabled', 'disabled');
    mostrarEstadoGuardado('error', 'Edición detenida: no se guardan más cambios.');
    mostrarAviso(mensaje, opciones);
  }

  function manejarErrorGuardado(estado, data) {
    const mensaje = (data && data.error) || `No se pudo guardar (error ${estado}).`;
    if (estado === 409 && data && data.conflicto) {
      bloquearEdicion(mensaje, { recargar: true });
    } else if (estado === 409 && data && data.completado) {
      bloquearEdicion(mensaje, { irRegistros: true });
    } else if (estado === 403 || estado === 404) {
      bloquearEdicion(mensaje, { irRegistros: true });
    } else {
      // Error de validación del contenido o del servidor: se informa y se reintenta con la próxima edición.
      mostrarEstadoGuardado('error', mensaje);
    }
    return { ok: false, estado, data };
  }

  /* ── Restaurar un borrador guardado ───────────────────────────────────── */
  function restaurarBorrador(d) {
    const poner = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };

    poner('numeroOrden', d.nro_orden_pago);
    poner('fechaVencimiento', isoADDMMAAAA(d.fecha_vencimiento));
    poner('numeroFactura', d.nro_factura);
    poner('resolucion', d.nro_resolucion);
    poner('nroResolucionRectificatoria', d.nro_resolucion_rectificatoria);
    poner('decreto', d.decreto);
    poner('licitacion', d.licitacion);

    // Fecha de elaboración: la guardada (por defecto, la de creación del borrador)
    const contFecha = document.getElementById('fechaRentasWrapper');
    if (contFecha) mostrarFechaFormateada(contFecha, d.fecha || hoyISO());

    // Código de pago (si ya no figura entre los activos, se conserva igual)
    const select = document.getElementById('codigoPago');
    if (select && d.codigo_pago) {
      if (!Array.from(select.options).some((o) => o.value === String(d.codigo_pago))) {
        const op = document.createElement('option');
        op.value = op.textContent = String(d.codigo_pago);
        select.appendChild(op);
      }
      select.value = String(d.codigo_pago);
    }
    poner('descripcionCodigoPago', d.descripcion_codigo_pago || (window._codigosPagoMap || {})[d.codigo_pago] || '');

    // Descripción del concepto (líneas libres)
    const cont = document.getElementById('conceptoDescripcionContainer');
    cont.innerHTML = '';
    const lineas = (d.concepto_lineas && d.concepto_lineas.length) ? d.concepto_lineas : [''];
    lineas.forEach((texto) => {
      agregarLineaDescripcionConcepto();
      const ta = cont.querySelector('.concepto-linea-desc:last-child textarea');
      ta.value = texto;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });

    // Concepto del pago
    const filaConcepto = document.querySelector('#conceptoPagoBody tr');
    if (filaConcepto) {
      filaConcepto.querySelector('.input-codigo-concepto').value = d.codigo_concepto_pago || '';
      filaConcepto.querySelector('.input-desc-concepto').value = d.concepto_del_pago || '';
    }

    // Beneficiarios
    const cuerpoBenef = document.getElementById('beneficiariosBody');
    cuerpoBenef.innerHTML = '';
    const benef = (d.beneficiarios && d.beneficiarios.length) ? d.beneficiarios : [{}];
    benef.forEach((b) => {
      agregarFilaBeneficiario();
      const fila = cuerpoBenef.lastElementChild;
      fila.querySelector('.input-codigo-beneficiario').value = b.codigo_beneficiario || '';
      fila.querySelector('.input-nombre-beneficiario').value = b.beneficiario || '';
      const imp = fila.querySelector('.input-importe-beneficiario');
      imp.value = b.importe ? formatearImporte(Number(b.importe)) : '';
    });

    // Importes por Unidad Presupuestaria (las filas ya fueron armadas desde la Imputación)
    const perdidas = [];
    (d.ups || []).forEach((u) => {
      const fila = document.querySelector(`#partidasBody tr[data-detalle-id="${u.imputacion_detalle_id}"]`);
      const input = fila && fila.querySelector('.input-importe-up');
      if (!input) { perdidas.push(u); return; }
      input.value = formatearImporte(Number(u.importe));
      input.dispatchEvent(new Event('input'));   // sintético: actualiza panel de saldos y totales
    });
    recalcularImporteOrdenPago();
    recalcularImporteConcepto();

    if (perdidas.length) {
      mostrarAviso(
        'Algunas unidades presupuestarias asignadas en este borrador ya no tienen saldo disponible en la '
        + 'Imputación y no se pudieron restaurar. Revisá los importes antes de completar.'
      );
    }
  }

  /* ── Completar (Revisar → Listo) ──────────────────────────────────────── */
  function abrirConfirmacionCompletar() {
    if (OP_ESTADO.bloqueado || OP_ESTADO.completando) return;
    const overlay = document.getElementById('modalConfirmarCompletar');
    if (overlay) overlay.style.display = 'flex';
  }

  function cerrarConfirmacionCompletar() {
    const overlay = document.getElementById('modalConfirmarCompletar');
    if (overlay) overlay.style.display = 'none';
  }

  async function confirmarCompletar() {
    cerrarConfirmacionCompletar();
    if (OP_ESTADO.bloqueado || OP_ESTADO.completando) return;
    OP_ESTADO.completando = true;
    clearTimeout(OP_ESTADO.timer);

    const btn = document.getElementById('btnCompletar');
    const textoBtn = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Completando...'; }

    try {
      // 1) Lo que se ve en pantalla debe ser exactamente lo que está guardado
      const guardado = await guardarBorrador({ forzar: !OP_ESTADO.id });
      if (!guardado.ok) {
        if (!OP_ESTADO.bloqueado) {
          mostrarModalValidacion([
            (guardado.data && guardado.data.error) || 'No se pudo guardar el borrador antes de completar. Verificá la conexión e intentá de nuevo.',
          ]);
        }
        return;
      }

      // 2) El servidor valida todo y recién ahí pasa a Listo
      const resp = await postJSON(`/api/orden-pago/${OP_ESTADO.id}/completar/`, { version: OP_ESTADO.version });
      const data = await resp.json().catch(() => ({}));

      if (resp.ok) {
        OP_ESTADO.bloqueado = true;
        clearTimeout(OP_ESTADO.timer);
        mostrarCartelCompletado(parseFloat(data.importe_total));
        const destinoRegistros = (document.getElementById('ordenpagoPage')?.dataset.registrosUrl || '/');
        setTimeout(() => { window.location.href = destinoRegistros; }, 2200);
        return;
      }

      if (resp.status === 409 || resp.status === 403 || resp.status === 404) {
        manejarErrorGuardado(resp.status, data);
      } else if (data.errores && data.errores.length) {
        mostrarModalValidacion(data.errores);
      } else {
        mostrarModalValidacion([data.error || 'Error al completar. Revisá los datos.']);
      }
    } catch (err) {
      console.error('Error completando la OP:', err);
      mostrarModalValidacion(['Error de red al completar la Orden de Pago.']);
    } finally {
      OP_ESTADO.completando = false;
      if (btn && !OP_ESTADO.bloqueado) { btn.disabled = false; btn.innerHTML = textoBtn; }
    }
  }

  /* ── Modo "Ver": OP completada, solo lectura ──────────────────────────── */
  async function iniciarModoVer(datos) {
    await Promise.all([autocompletarDesdeImputacion(), cargarCodigosPago()]);

    // Una fila por cada UP de la OP, con su importe definitivo
    const jur = window._jurVer || '51';
    const cuerpo = document.getElementById('partidasBody');
    cuerpo.innerHTML = '';
    (datos.ups_detalle || []).forEach((up) => {
      const fila = document.createElement('tr');
      fila.dataset.detalleId    = up.imputacion_detalle_id;
      fila.dataset.fuenteId     = up.fuente_id;
      fila.dataset.fuenteCodigo = up.fuente_codigo;
      fila.dataset.fuenteNombre = up.fuente;
      const celda = (v, extra = '') => `<td><input type="text" class="input-cod-partida ${extra}" value="${String(v ?? '').replace(/"/g, '&quot;')}" readonly></td>`;
      fila.innerHTML =
        celda(jur) + celda(up.prog) + celda('00') + celda(up.pry) + celda(up.ao) + celda(up.part) +
        celda(up.fuente_codigo) + celda(up.denominacion || '', 'col-partida-desc') +
        `<td><input type="text" class="input-importe-partida input-importe-up" value="${formatearImporte(Number(up.importe))}" readonly></td>`;
      cuerpo.appendChild(fila);
    });

    restaurarBorrador({ ...datos, ups: [] });

    // Todo en solo lectura
    document.querySelectorAll('#hoja input, #hoja textarea').forEach((el) => { el.readOnly = true; });
    document.querySelectorAll('#hoja select').forEach((el) => { el.disabled = true; });
    document.querySelectorAll('#fechaRentasWrapper button').forEach((b) => b.remove());
    ['.tabla-acciones', '#btnCompletar', '#panelSaldos'].forEach((sel) =>
      document.querySelectorAll(sel).forEach((el) => { el.style.display = 'none'; }));

    recalcularImporteOrdenPago();
    recalcularImporteConcepto();

    const estado = document.getElementById('estadoGuardado');
    if (estado) {
      estado.textContent = 'Orden de Pago completada (solo lectura)';
      mostrarCartel(estado, 0);
    }
  }

  /* ── Arranque ─────────────────────────────────────────────────────────── */
  async function iniciarOrdenPago() {
    const datos = window.OP_DATOS || null;
    if (window.OP_MODO === 'ver' && datos) { await iniciarModoVer(datos); return; }
    OP_ESTADO.imputacionId = datos ? datos.imputacion_id : new URLSearchParams(window.location.search).get('imputacion_id');
    OP_ESTADO.clave = generarUUID();

    // Las filas de UP y los códigos de pago llegan del servidor: hay que esperarlos antes de restaurar
    await Promise.all([autocompletarDesdeImputacion(), cargarCodigosPago()]);

    if (datos) {
      OP_ESTADO.id = datos.id;
      OP_ESTADO.version = datos.version;
      restaurarBorrador(datos);
    }

    if (!OP_ESTADO.imputacionId) {
      mostrarAviso('Esta Orden de Pago no tiene una Imputación asociada. Volvé a la lista de Imputaciones y elegí "Generar OP".', { irRegistros: true });
      return;
    }

    OP_ESTADO.ultimoGuardado = JSON.stringify(recolectarContenido());
    OP_ESTADO.activo = true;
    mostrarEstadoGuardado(datos ? 'previo' : 'nuevo');

    // Solo las ediciones del usuario (isTrusted) disparan el guardado: los cambios hechos por el
    // propio código (autocompletado, restauración) no crean ni modifican nada.
    const hoja = document.getElementById('hoja');
    ['input', 'change'].forEach((tipo) => hoja.addEventListener(tipo, (e) => { if (e.isTrusted) programarGuardado(); }));
    hoja.addEventListener('focusout', (e) => { if (e.isTrusted) programarGuardado(400); });
    ['btnAddBeneficiario', 'btnDelBeneficiario'].forEach((id) =>
      document.getElementById(id)?.addEventListener('click', () => programarGuardado(400)));

    document.getElementById('btnCompletar')?.addEventListener('click', abrirConfirmacionCompletar);
    document.getElementById('btnConfirmarCompletar')?.addEventListener('click', confirmarCompletar);
    document.getElementById('btnCancelarCompletar')?.addEventListener('click', cerrarConfirmacionCompletar);

    // Cancelar: sale SIN guardar ni completar. El borrador queda como el servidor lo confirmó por
    // última vez (estado Revisar). La navegación la hace el propio <a href>; acá solo se frena el
    // autoguardado para que nada se dispare mientras se abandona la página.
    document.getElementById('btnSalir')?.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      if (OP_ESTADO.cancelando) { e.preventDefault(); return; }   // doble clic
      OP_ESTADO.cancelando = true;
      clearTimeout(OP_ESTADO.timer);
      OP_ESTADO.guardadoController?.abort();
    });

    window.addEventListener('beforeunload', (e) => {
      if (!OP_ESTADO.activo || OP_ESTADO.bloqueado || OP_ESTADO.cancelando) return;
      if (JSON.stringify(recolectarContenido()) !== OP_ESTADO.ultimoGuardado) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && OP_ESTADO.activo && !OP_ESTADO.bloqueado && !OP_ESTADO.completando && !OP_ESTADO.cancelando) guardarBorrador();
    });
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
    iniciarOrdenPago();
    observarFuentesFinanciamiento();

    // Inicializar: usar el wrapper, no el contenedor completo
    const contenedorFechaRentas = document.getElementById('fechaRentasWrapper');
    if (contenedorFechaRentas) {
      const inputOriginal = document.getElementById('fechaRentas');
      if (inputOriginal) inputOriginal.remove();
      mostrarFechaFormateada(contenedorFechaRentas, hoyISO());
    }
  
    const delegacion = document.getElementById("delegacionContable");
    if (delegacion) {
      delegacion.value = "ADM. PCIAL. DE RECURSOS HIDRICOS";
    }
  });