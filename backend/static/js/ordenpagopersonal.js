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
   
   /* Programas y partidas son los mismos para todas las filas: se piden una sola vez. */
   let _promProgramas = null;
   let _promPartidas = null;
   
   function obtenerProgramas() {
     if (!_promProgramas) {
       _promProgramas = fetch("/api/programas/")
         .then((r) => r.json())
         .then((d) => d.programas || [])
         .catch((e) => { _promProgramas = null; throw e; });
     }
     return _promProgramas;
   }
   
   function obtenerPartidas() {
     if (!_promPartidas) {
       _promPartidas = fetch("/api/partidas/")
         .then((r) => r.json())
         .then((d) => d.partidas || [])
         .catch((e) => { _promPartidas = null; throw e; });
     }
     return _promPartidas;
   }
   
   /* ------------------------------------------------------------------------
      UTILIDADES DE FORMATO DE NÚMEROS
      ------------------------------------------------------------------------ */
   
   /**
    * Convierte un string con formato "1.234.567,89" a un número flotante.
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
    */
   function formatearInputImporte(input) {
     const valorNumerico = parsearImporte(input.value);
     input.value = input.value.trim() === "" ? "" : formatearImporte(valorNumerico);
   }
   
   /* ------------------------------------------------------------------------
      VALIDACIONES
      ------------------------------------------------------------------------ */
   
   function marcarValidacion(input, esValido, mensaje = "") {
     input.classList.remove("input-valido", "input-invalido");
     input.classList.add(esValido ? "input-valido" : "input-invalido");
   
     const contenedorError = document.getElementById(`err-${input.id}`);
     if (contenedorError) {
       contenedorError.textContent = esValido ? "" : mensaje;
     }
   }
   
   function validarSoloNumeros(input) {
     const patron = /^[0-9-]*$/;
     const valor = input.value.trim();
     const esValido = valor !== "" && patron.test(valor);
     marcarValidacion(input, esValido, "Solo se admiten números (y guiones).");
     return esValido;
   }
   
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
   
   function validarFecha(input) {
     const valor = input.value.trim();
   
     const patron = /^(\d{2})\/(\d{2})\/(\d{4})$/;
     const coincidencia = valor.match(patron);
   
     if (!coincidencia) {
       marcarValidacion(input, false, "Ingrese la fecha en formato dd/mm/aaaa.");
       return false;
     }
   
     const dia = parseInt(coincidencia[1], 10);
     const mes = parseInt(coincidencia[2], 10);
     const anio = parseInt(coincidencia[3], 10);
   
     const fecha = new Date(anio, mes - 1, dia);
   
     const fechaValida =
       fecha.getFullYear() === anio &&
       fecha.getMonth() === mes - 1 &&
       fecha.getDate() === dia;
   
     if (!fechaValida) {
       marcarValidacion(input, false, "La fecha ingresada no es válida.");
       return false;
     }
   
     const hoy = new Date();
     hoy.setHours(0, 0, 0, 0);
   
     if (fecha > hoy) {
       marcarValidacion(input, false, "La fecha no puede ser futura.");
       return false;
     }
   
     marcarValidacion(input, true);
     return true;
   }
   
   function validarCampoObligatorio(input) {
     const esValido = input.value.trim() !== "";
     marcarValidacion(input, esValido, "Este campo es obligatorio.");
     return esValido;
   }
   
   /* ------------------------------------------------------------------------
      SECTOR IZQUIERDO: NÓMINA DE BENEFICIARIOS
      ------------------------------------------------------------------------ */
   
   /**
    * Agrega una nueva fila de beneficiario (código + nombre + parcial).
    */
   function agregarFilaBeneficiario() {
     contadorBeneficiarios++;
   
     // CÓDIGO (sin placeholder: si no se escribe nada, queda vacío)
     const filaCodigo = document.createElement("div");
     filaCodigo.className = "fila-codigo";
     filaCodigo.innerHTML = `<input type="text" class="input-codigo-beneficiario">`;
     document.getElementById("codigosContainer").appendChild(filaCodigo);
   
     // NOMBRE
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
     document.getElementById("beneficiariosContainer").appendChild(filaBeneficiario);
   
     // IMPORTE PARCIAL
     const filaParcial = document.createElement("input");
     filaParcial.type = "text";
     filaParcial.className = "input-importe-parcial";
     filaParcial.placeholder = "0,00";
     document.getElementById("parcialesContainer").appendChild(filaParcial);
   
     // SELECCIONAR FILA
     filaBeneficiario.addEventListener("click", (evento) => {
       if (evento.target.tagName === "BUTTON") return;
       seleccionarFilaBeneficiario(filaBeneficiario);
     });
   
     // ELIMINAR ESTA FILA (botón ✕)
     const botonEliminar = filaBeneficiario.querySelector(".btn-mini");
     botonEliminar.addEventListener("click", () => {
       const beneficiariosContainer = document.getElementById("beneficiariosContainer");
       const codigosContainer = document.getElementById("codigosContainer");
       const indice = Array.from(beneficiariosContainer.children).indexOf(filaBeneficiario);
   
       filaBeneficiario.remove();
   
       const codigos = codigosContainer.querySelectorAll(".fila-codigo");
       if (codigos[indice]) codigos[indice].remove();
   
       const parciales = document.querySelectorAll(".input-importe-parcial");
       if (parciales[indice]) parciales[indice].remove();
   
       recalcularTotales();
     });
   
     // FORMATO Y RECÁLCULO DEL PARCIAL
     filaParcial.addEventListener("blur", () => {
       formatearInputImporte(filaParcial);
       recalcularTotales();
     });
     filaParcial.addEventListener("input", recalcularTotales);
   
     recalcularTotales();
   }
   
   function seleccionarFilaBeneficiario(fila) {
     document
       .querySelectorAll(".fila-beneficiario")
       .forEach((f) => f.classList.remove("fila-seleccionada"));
     fila.classList.add("fila-seleccionada");
   }
   
   /**
    * Botón "− Beneficiario": siempre quita la última fila (llena o vacía)
    * de las tres columnas (código, nómina y parcial).
    */
   function eliminarFilaBeneficiarioSeleccionada() {
     const contenedor = document.getElementById("beneficiariosContainer");
     const codigosContainer = document.getElementById("codigosContainer");
     const parcialesContainer = document.getElementById("parcialesContainer");
   
     const filas = contenedor.querySelectorAll(".fila-beneficiario");
     if (filas.length === 0) return;
   
     filas[filas.length - 1].remove();
   
     const codigos = codigosContainer.querySelectorAll(".fila-codigo");
     if (codigos.length) codigos[codigos.length - 1].remove();
   
     const parciales = parcialesContainer.querySelectorAll(".input-importe-parcial");
     if (parciales.length) parciales[parciales.length - 1].remove();
   
     recalcularTotales();
   }
   
   /* ------------------------------------------------------------------------
      SECTOR DERECHO: IMPUTACIÓN DE LAS EROGACIONES
      ------------------------------------------------------------------------ */
   
   /** Crea un <option> que se ve corto cerrado y completo al desplegar */
   function crearOpcion(valor, corto, completo) {
     const opt = document.createElement("option");
     opt.value = valor;
     opt.dataset.corto = corto;
     opt.dataset.completo = completo;
     opt.textContent = corto;
     opt.title = completo;
     return opt;
   }
   
   function activarSelectCompacto(select) {
     const mostrar = (tipo) =>
       select.querySelectorAll("option").forEach((o) => {
         o.textContent = o.dataset[tipo] ?? o.textContent;
       });
   
     select.addEventListener("focus", () => mostrar("completo"));
     select.addEventListener("mousedown", () => mostrar("completo"));
     select.addEventListener("change", () => {
       mostrar("corto");
       select.title = select.selectedOptions[0]?.dataset.completo || "";
     });
     select.addEventListener("blur", () => mostrar("corto"));
   }
   
   function agregarFilaErogacion() {
     contadorErogaciones++;
     const filaId = `erog-${contadorErogaciones}`;
   
     const fila = document.createElement("tr");
     fila.dataset.filaId = filaId;
     fila.innerHTML = `
         <td class="celda-prog">
             <select class="erog-prg sel-erog">
                 <option value="" data-corto="PRG" data-completo="PRG">PRG</option>
             </select>
         </td>
         <td class="celda-sp">
             <input type="text" class="erog-sp" value="00" readonly>
         </td>
         <td class="celda-pto">
             <select class="erog-pry sel-erog" disabled>
                 <option value="" data-corto="PRY" data-completo="PRY">PRY</option>
             </select>
         </td>
         <td class="celda-ao">
             <select class="erog-ao sel-erog" disabled>
                 <option value="" data-corto="A/O" data-completo="A/O">A/O</option>
             </select>
         </td>
         <td class="celda-part">
             <select class="erog-par sel-erog">
                 <option value="" data-corto="PAR" data-completo="PAR">PAR</option>
             </select>
         </td>
         <td class="celda-desc">
             <input type="text" class="erog-desc" placeholder="Descripción" readonly>
             <select class="erog-ff sel-erog" style="display:none"></select>
         </td>
         <td class="celda-importe">
             <input type="text" class="input-importe-erogacion" placeholder="0,00">
             <input type="hidden" class="erog-linea-id" value="">
             <input type="hidden" class="erog-fuente-id" value="">
             <input type="hidden" class="erog-saldo" value="0">
         </td>
     `;
   
     document.getElementById("erogacionesBody").appendChild(fila);
     fila.addEventListener("click", () => seleccionarFilaErogacion(fila));
   
     fila.querySelectorAll("select").forEach(activarSelectCompacto);
   
     const inputImporte = fila.querySelector(".input-importe-erogacion");
     inputImporte.addEventListener("blur", () => {
       formatearInputImporte(inputImporte);
       recalcularTotales();
   
       // Validar que no supere el saldo disponible
       const saldo = parseFloat(fila.querySelector(".erog-saldo").value) || 0;
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
     const selectAo = fila.querySelector(".erog-ao");
     const selectPar = fila.querySelector(".erog-par");
     const selectFf = fila.querySelector(".erog-ff");
     const inputDesc = fila.querySelector(".erog-desc");
     const inputLinea = fila.querySelector(".erog-linea-id");
     const inputFuente = fila.querySelector(".erog-fuente-id");
     const inputSaldo = fila.querySelector(".erog-saldo");
   
     let lineasResueltas = [];
     let tokenResolucion = 0; // descarta respuestas viejas si el usuario cambia de opción rápido
   
     const resetSelect = (sel, texto) => {
       sel.innerHTML = "";
       sel.appendChild(crearOpcion("", texto, texto));
       sel.disabled = true;
       sel.title = "";
     };
   
     function ocultarSelectorFuente() {
       selectFf.innerHTML = "";
       selectFf.style.display = "none";
       inputDesc.style.display = "";
       lineasResueltas = [];
     }
   
     function resetLinea() {
       tokenResolucion++; // invalida cualquier resolución en curso
       inputLinea.value = "";
       inputFuente.value = "";
       inputSaldo.value = "0";
       inputDesc.value = "";
       inputDesc.title = "";
       ocultarSelectorFuente();
     }
   
     /** Fija la línea elegida (y con ella la fuente de financiamiento) en los campos ocultos. */
     function aplicarLinea(linea) {
       inputLinea.value = linea.linea_id;
       inputFuente.value = linea.fuente_id;
       inputSaldo.value = linea.saldo_actual;
       inputDesc.value = linea.denominacion || "";
       inputDesc.title = `${linea.denominacion || ""} — FF ${linea.fuente_codigo} - ${linea.fuente}`;
     }
   
     /** La combinación PRG/PRY/A-O/PAR tiene más de una fuente: se pide elegir una. */
     function mostrarSelectorFuente(fuenteIdPreferida) {
       selectFf.innerHTML = "";
       selectFf.appendChild(crearOpcion("", "Elegir fuente…", "Elegir la fuente de financiamiento"));
       lineasResueltas.forEach((l) => {
         const corto = `FF ${l.fuente_codigo} - ${l.fuente}`;
         const saldo = formatearImporte(parseFloat(l.saldo_actual));
         selectFf.appendChild(crearOpcion(l.fuente_id, corto, `${corto} (saldo $${saldo})`));
       });
       selectFf.disabled = false;
       selectFf.title = "Hay más de una fuente de financiamiento para esta combinación: elegí una";
       selectFf.style.display = "";
       inputDesc.style.display = "none";
   
       if (fuenteIdPreferida) {
         selectFf.value = String(fuenteIdPreferida);
         if (selectFf.value) {
           seleccionarFuente();
           selectFf.title = selectFf.selectedOptions[0]?.dataset.completo || "";
         }
       }
     }
   
     function seleccionarFuente() {
       const linea = lineasResueltas.find((l) => String(l.fuente_id) === selectFf.value);
       if (!linea) {
         inputLinea.value = "";
         inputFuente.value = "";
         inputSaldo.value = "0";
         return;
       }
       aplicarLinea(linea);
     }
   
     /**
      * Busca la línea presupuestaria de la combinación elegida. Si hay una sola, la usa;
      * si hay varias, muestra el selector de fuente (preferencia.fuenteId la preselecciona
      * al retomar un borrador).
      */
     async function resolverLinea(preferencia = {}) {
       resetLinea();
       const mio = tokenResolucion;
       if (!selectPrg.value || !selectPry.value || !selectAo.value || !selectPar.value) {
         avisarCambioFormulario(true);
         return;
       }
   
       const ejercicio = new Date().getFullYear();
       try {
         const res = await fetch(
           `/api/resolver-lineas/?programa_id=${selectPrg.value}&proyecto_id=${selectPry.value}&actividad_id=${selectAo.value}&partida_id=${selectPar.value}&ejercicio=${ejercicio}`
         );
         const data = await res.json();
         if (mio !== tokenResolucion) return; // el usuario ya cambió algo: respuesta vieja
   
         if (!res.ok || !data.lineas || data.lineas.length === 0) {
           inputDesc.value = "⚠ Línea no encontrada";
           return;
         }
   
         lineasResueltas = data.lineas;
         if (lineasResueltas.length === 1) {
           aplicarLinea(lineasResueltas[0]);
         } else {
           mostrarSelectorFuente(preferencia.fuenteId);
         }
       } catch {
         if (mio === tokenResolucion) inputDesc.value = "⚠ Error al buscar línea";
       } finally {
         if (mio === tokenResolucion) avisarCambioFormulario(true);
       }
     }
   
     function cargarProyectos() {
       resetSelect(selectPry, "PRY");
       resetSelect(selectAo, "A/O");
       resetLinea();
       if (!selectPrg.value) return Promise.resolve();
   
       return fetch(`/api/proyectos/?programa_id=${selectPrg.value}`)
         .then((r) => r.json())
         .then((data) => {
           (data.proyectos || []).forEach((p) => {
             selectPry.appendChild(
               crearOpcion(p.id, p.codigo_proyecto, `${p.codigo_proyecto} - ${p.nombre}`)
             );
           });
           selectPry.disabled = false;
         })
         .catch(() => {});
     }
   
     function cargarActividades() {
       resetSelect(selectAo, "A/O");
       resetLinea();
       if (!selectPry.value) return Promise.resolve();
   
       return fetch(`/api/actividades/?proyecto_id=${selectPry.value}`)
         .then((r) => r.json())
         .then((data) => {
           (data.actividades || []).forEach((a) => {
             selectAo.appendChild(
               crearOpcion(a.id, a.codigo_act_obra, `${a.codigo_act_obra} - ${a.nombre}`)
             );
           });
           selectAo.disabled = false;
         })
         .catch(() => {});
     }
   
     // Poblar programas (la celda muestra solo el código) y partidas: el listado se pide una
     // sola vez para todas las filas.
     const cargaPrg = obtenerProgramas()
       .then((programas) => {
         programas.forEach((p) => {
           selectPrg.appendChild(
             crearOpcion(p.id, p.codigo_programa, `${p.codigo_programa} - ${p.nombre}`)
           );
         });
       })
       .catch(() => {});
   
     const cargaPar = obtenerPartidas()
       .then((partidas) => {
         partidas.forEach((p) => {
           selectPar.appendChild(
             crearOpcion(p.id, p.codigo, `${p.codigo} - ${p.denominacion}`)
           );
         });
       })
       .catch(() => {});
   
     selectPrg.addEventListener("change", cargarProyectos);
     selectPry.addEventListener("change", cargarActividades);
     selectAo.addEventListener("change", () => resolverLinea());
     selectPar.addEventListener("change", () => resolverLinea());
     selectFf.addEventListener("change", () => {
       seleccionarFuente();
       avisarCambioFormulario(true);
     });
   
     // Lo usa la restauración de un borrador para repoblar la fila en cascada.
     fila._cascada = {
       cargaInicial: Promise.all([cargaPrg, cargaPar]),
       selectPrg, selectPry, selectAo, selectPar,
       cargarProyectos, cargarActividades, resolverLinea,
     };
   }
   
   function seleccionarFilaErogacion(fila) {
     document
       .querySelectorAll("#erogacionesBody tr")
       .forEach((f) => f.classList.remove("fila-seleccionada"));
     fila.classList.add("fila-seleccionada");
   }
   
   /**
    * Botón "− Erogación": siempre quita la última fila, esté vacía o llena.
    */
   function eliminarFilaErogacionSeleccionada() {
     const cuerpoTabla = document.getElementById("erogacionesBody");
     const filas = cuerpoTabla.querySelectorAll("tr");
     if (filas.length === 0) return;
   
     filas[filas.length - 1].remove();
   
     recalcularTotales();
   }
   
   /* ------------------------------------------------------------------------
      IMPORTE EN LETRAS
      ------------------------------------------------------------------------ */
   
   /**
    * Convierte un número a su representación en letras
    * (Ej: "UN MIL DOSCIENTOS CON 00/100").
    */
   function numeroALetras(numero) {
     const partes = numero.toFixed(2).split(".");
     const entero = parseInt(partes[0], 10);
     const centavos = parseInt(partes[1], 10);
     const centavosStr = String(centavos).padStart(2, "0");
   
     const UNIDADES = [
       "", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS",
       "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE",
       "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"
     ];
   
     const DECENAS = [
       "", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA",
       "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"
     ];
   
     const CENTENAS = [
       "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS",
       "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"
     ];
   
     // Convierte números de 0 a 999
     function convertirGrupo(n) {
       if (n === 0) return "";
       if (n === 100) return "CIEN";
   
       const c = Math.floor(n / 100);
       const rest = n % 100;
   
       let parteCentena = "";
       if (c > 0) parteCentena = CENTENAS[c];
   
       let parteDecena = "";
       if (rest > 0 && rest < 20) {
         parteDecena = UNIDADES[rest];
       } else if (rest >= 20) {
         const d = Math.floor(rest / 10);
         const u = rest % 10;
         parteDecena = DECENAS[d] + (u > 0 ? " Y " + UNIDADES[u] : "");
       }
   
       // Caso especial: VEINTIUNO, VEINTIDÓS, etc.
       if (rest >= 21 && rest <= 29) {
         parteDecena =
           "VEINTI" +
           UNIDADES[rest - 20]
             .toLowerCase()
             .normalize("NFD")
             .replace(/[\u0300-\u036f]/g, "")
             .toUpperCase();
         if (rest === 21) parteDecena = "VEINTIÚN";
       }
   
       if (parteCentena && parteDecena) return parteCentena + " " + parteDecena;
       return parteCentena || parteDecena;
     }
   
     const GRUPOS = [
       { valor: BigInt("1000000000000000000"), singular: "UN TRILLÓN", plural: "TRILLONES" },
       { valor: BigInt("1000000000000"), singular: "UN BILLÓN", plural: "BILLONES" },
       { valor: BigInt("1000000"), singular: "UN MILLÓN", plural: "MILLONES" },
       { valor: BigInt("1000"), singular: "MIL", plural: "MIL" }
     ];
   
     function convertirEntero(n) {
       if (n === 0) return "CERO";
   
       let bigN = BigInt(n);
       let resultado = "";
   
       for (const grupo of GRUPOS) {
         if (bigN < grupo.valor) continue;
   
         const cantidad = bigN / grupo.valor;
         bigN = bigN % grupo.valor;
   
         const cantNum = Number(cantidad);
         const cantLetras =
           cantNum === 1
             ? grupo.singular
             : convertirGrupo(cantNum) + " " + grupo.plural;
   
         resultado += cantLetras + " ";
       }
   
       const restoFinal = Number(bigN);
       if (restoFinal > 0) {
         const grupo = convertirGrupo(restoFinal);
         resultado += grupo === "UN" ? "UNO" : grupo;
       }
   
       return resultado.trim();
     }
   
     const letrasEntero = convertirEntero(entero);
     return `${letrasEntero} CON ${centavosStr}/100`;
   }
   
   function actualizarLetras() {
     const importeTotal = document.getElementById("importeTotal");
     const importeLetras = document.getElementById("importeLetras");
     if (!importeTotal || !importeLetras) return;
   
     const numero = parsearImporte(importeTotal.value);
     importeLetras.value = numero > 0 ? numeroALetras(numero) : "";
   }
   
   /* ------------------------------------------------------------------------
      CÁLCULO AUTOMÁTICO DE TOTALES
      ------------------------------------------------------------------------ */
   
   /**
    * Columna TOTAL de beneficiarios: agrupa las filas seguidas que tienen
    * un parcial mayor a 0 y muestra la suma del grupo en la PRIMERA fila
    * del grupo. Una fila con el parcial vacío corta el grupo.
    */
   function actualizarTotalesPorBeneficiario() {
     const cont = document.getElementById("totalesBeneficiariosContainer");
     const par = document.getElementById("parcialesContainer");
     if (!cont || !par) return;
   
     const importes = Array.from(par.querySelectorAll(".input-importe-parcial"))
       .map((input) => parsearImporte(input.value));
   
     const totales = new Array(importes.length).fill(null);
   
     let i = 0;
     while (i < importes.length) {
       if (importes[i] > 0) {
         const inicio = i;
         let suma = 0;
         while (i < importes.length && importes[i] > 0) {
           suma += importes[i];
           i++;
         }
         totales[inicio] = suma;
       } else {
         i++;
       }
     }
   
     cont.innerHTML = "";
     totales.forEach((total) => {
       const fila = document.createElement("div");
       fila.className = "fila-total-ben";
   
       const input = document.createElement("input");
       input.type = "text";
       input.readOnly = true;
       input.tabIndex = -1;
       input.value = total !== null ? formatearImporte(total) : "";
   
       fila.appendChild(input);
       cont.appendChild(fila);
     });
   }
   
   /**
    * Recalcula:
    *  - La columna TOTAL por grupos de beneficiarios.
    *  - El total de la nómina de beneficiarios (suma de parciales).
    *  - El total de la imputación de erogaciones.
    *  - El importe en letras.
    */
   function recalcularTotales() {
     actualizarTotalesPorBeneficiario();
   
     // 1. Total de beneficiarios
     let totalBeneficiarios = 0;
     document.querySelectorAll(".input-importe-parcial").forEach((input) => {
       totalBeneficiarios += parsearImporte(input.value);
     });
   
     const elTotalBen = document.getElementById("totalBeneficiarios");
     const elTotalBenParcial = document.getElementById("totalBeneficiarioParcial");
     if (elTotalBen) elTotalBen.value = formatearImporte(totalBeneficiarios);
     if (elTotalBenParcial) elTotalBenParcial.value = formatearImporte(totalBeneficiarios);
   
     // 2. Total de erogaciones
     let totalErogaciones = 0;
     document.querySelectorAll(".input-importe-erogacion").forEach((input) => {
       totalErogaciones += parsearImporte(input.value);
     });
   
     const elTotalErog = document.getElementById("totalErogaciones");
     if (elTotalErog) elTotalErog.value = formatearImporte(totalErogaciones);
   
     // 3. Comparar contra el Importe O.P.
     validarTotalErogaciones();
   
     // 4. Total en letras
     const elImporteLetras = document.getElementById("importeLetras");
     if (elImporteLetras) elImporteLetras.value = numeroALetras(totalErogaciones);
   }
   
   function validarTotalErogaciones() {
     const totalErogaciones = document.getElementById("totalErogaciones");
     const importeOP = document.getElementById("importeOP");
   
     if (!totalErogaciones || !importeOP) return;
   
     const total = parsearImporte(totalErogaciones.value);
     const importe = parsearImporte(importeOP.value);
   
     let advertencia = document.getElementById("advertenciaTotalErogaciones");
   
     if (!advertencia) {
       advertencia = document.createElement("div");
       advertencia.id = "advertenciaTotalErogaciones";
       advertencia.className = "advertencia-importe-op";
       totalErogaciones.parentElement.appendChild(advertencia);
     }
   
     // Son iguales → todo correcto
     if (total === importe) {
       advertencia.textContent = "";
       advertencia.style.display = "none";
       totalErogaciones.classList.remove("input-invalido");
       return;
     }
   
     // Total mayor que Importe O.P.
     if (total > importe) {
       advertencia.textContent = "⚠ El total de las erogaciones excede el Importe O.P.";
       advertencia.style.display = "block";
       totalErogaciones.classList.add("input-invalido");
       return;
     }
   
     // Total menor que Importe O.P.
     advertencia.textContent = "⚠ El total de las erogaciones es menor que el Importe O.P.";
     advertencia.style.display = "block";
     totalErogaciones.classList.add("input-invalido");
   }
   
   /* ------------------------------------------------------------------------
      LIMPIAR / NUEVO FORMULARIO
      ------------------------------------------------------------------------ */
   
   function limpiarFormulario() {
     const confirmar = confirm("¿Está seguro de que desea limpiar todo el formulario?");
     if (!confirmar) return;
   
     // Los campos readonly (jurisdicción, código 100, iniciales CR, totales)
     // no se borran: o son fijos o se recalculan solos.
     document.querySelectorAll(".hoja input[type='text']").forEach((input) => {
       if (input.readOnly) return;
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
   
     const paginaActual = document.getElementById("paginaActual");
     const paginaTotal = document.getElementById("paginaTotal");
     if (paginaActual) paginaActual.value = "1";
     if (paginaTotal) paginaTotal.value = "1";
   
     inicializarFilasBase();
     recalcularTotales();
   }
   
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
    * Exporta la hoja (#hoja) a PDF A4 con html2pdf.js.
    * - Agrega la clase "exportando-pdf" para ocultar botones y placeholders
    *   y para quitar la escala responsive (ver ordenpagopersonal.css).
    * - Reemplaza cada textarea por un div para que el texto largo se vea
    *   completo y con saltos de línea (html2canvas no ajusta textareas).
    */
   function exportarAPDF() {
     const elemento = document.getElementById("hoja");
     document.body.classList.add("exportando-pdf");
   
     const reemplazos = [];
     elemento.querySelectorAll("textarea").forEach((ta) => {
       const estilo = getComputedStyle(ta);
   
       const div = document.createElement("div");
       div.textContent = ta.value;
       div.style.width = "100%";
       div.style.boxSizing = "border-box";
       div.style.whiteSpace = "pre-wrap";
       div.style.wordBreak = "normal";
       div.style.overflowWrap = "break-word";
       div.style.fontFamily = estilo.fontFamily;
       div.style.fontSize = estilo.fontSize;
       div.style.fontWeight = estilo.fontWeight;
       div.style.lineHeight = estilo.lineHeight;
       div.style.color = estilo.color;
       div.style.padding = estilo.padding;
       div.style.minHeight = estilo.minHeight;
   
       ta.style.display = "none";
       ta.insertAdjacentElement("afterend", div);
       reemplazos.push({ ta, div });
     });
   
     const opciones = {
       margin: 0,
       filename: "orden-de-pago-personal.pdf",
       image: { type: "jpeg", quality: 0.98 },
       html2canvas: {
         scale: 2,
         useCORS: true,
         scrollY: 0,
         windowHeight: elemento.scrollHeight
       },
       jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
       pagebreak: { mode: "avoid-all" }
     };
   
     html2pdf()
       .set(opciones)
       .from(elemento)
       .save()
       .finally(() => {
         document.body.classList.remove("exportando-pdf");
         reemplazos.forEach(({ ta, div }) => {
           div.remove();
           ta.style.display = "";
         });
       });
   }
   
   /* ------------------------------------------------------------------------
      EVENTOS DE BOTONES
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
   
     const btnCompletar = document.getElementById("btnCompletar");
     if (btnCompletar) btnCompletar.addEventListener("click", completarOP);
   
     const btnExportarPDF = document.getElementById("btnExportarPDF");
     if (btnExportarPDF) btnExportarPDF.addEventListener("click", exportarAPDF);
   }
   
   /* ------------------------------------------------------------------------
      VALIDACIONES DE CAMPOS
      ------------------------------------------------------------------------ */
   
   function inicializarValidaciones() {
     const numeroOrden = document.getElementById("numeroOrden");
     if (numeroOrden) numeroOrden.addEventListener("blur", () => validarSoloNumeros(numeroOrden));
   
     const fechaOrden = document.getElementById("fechaOrden");
     if (fechaOrden) fechaOrden.addEventListener("blur", () => validarFecha(fechaOrden));
   
     ["expediente", "jurisdiccion", "uPresupuestaria"].forEach((id) => {
       const campo = document.getElementById(id);
       if (campo) campo.addEventListener("blur", () => validarCampoObligatorio(campo));
     });
   }
   
   /**
    * Comportamiento del campo Importe O.P.
    */
   function inicializarImporteOP() {
     const inputImporteOP = document.getElementById("importeOP");
     if (!inputImporteOP) return;
   
     // Al hacer foco: si tiene 0,00 o 0, se limpia
     inputImporteOP.addEventListener("focus", function () {
       if (this.value.trim() === "0,00" || this.value.trim() === "0") {
         this.value = "";
       }
     });
   
     // Al escribir: solo números, coma y punto
     inputImporteOP.addEventListener("input", function () {
       this.value = this.value.replace(/[^0-9,.]/g, "");
       this.value = this.value.replace(/^[,.]/, "");
     });
   
     // Al perder el foco: validar, formatear y recalcular
     inputImporteOP.addEventListener("blur", function () {
       validarImporte(this);
   
       if (this.value.trim() !== "") {
         formatearInputImporte(this);
       }
   
       recalcularTotales();
     });
   }
   
   /* ------------------------------------------------------------------------
      DATOS DEL FORMULARIO ⇄ SERVIDOR
      El mismo formato se usa para guardar, para repoblar un borrador y para la
      copia de seguridad local.
      ------------------------------------------------------------------------ */
   
   function getCookieOP(name) {
     const value = `; ${document.cookie}`;
     const parts = value.split(`; ${name}=`);
     if (parts.length === 2) return parts.pop().split(";").shift();
     return null;
   }
   
   const aNum = (v) => (v ? Number(v) : null);
   
   /**
    * "1.234.567,89" → "1234567.89" (texto, sin pasar por float). Vacío o ilegible → null.
    * Usa la misma normalización que parsearImporte, así que se guarda lo que se ve en pantalla.
    */
   function textoImporte(texto) {
     if (texto === null || texto === undefined) return null;
     const limpio = texto.toString().trim().replace(/\./g, "").replace(",", ".");
     if (!/^\d+(\.\d*)?$/.test(limpio)) return null;
     return limpio;
   }
   
   /** dd/mm/aaaa → aaaa-mm-dd. Fecha incompleta o inexistente → null (el servidor la admite vacía). */
   function fechaAISO(valor) {
     const m = (valor || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
     if (!m) return null;
     const dia = parseInt(m[1], 10), mes = parseInt(m[2], 10), anio = parseInt(m[3], 10);
     const f = new Date(anio, mes - 1, dia);
     if (f.getFullYear() !== anio || f.getMonth() !== mes - 1 || f.getDate() !== dia) return null;
     return `${m[3]}-${m[2]}-${m[1]}`;
   }
   
   function isoAFecha(iso) {
     if (!iso) return "";
     const [a, m, d] = iso.split("-");
     return `${d}/${m}/${a}`;
   }
   
   /** Foto del formulario tal como está en pantalla (acepta datos parciales). */
   function construirContenido() {
     const v = (id) => (document.getElementById(id)?.value || "").trim();
   
     const filasBenef = document.querySelectorAll("#beneficiariosContainer .fila-beneficiario");
     const filasCodigo = document.querySelectorAll("#codigosContainer .fila-codigo");
     const filasParcial = document.querySelectorAll("#parcialesContainer .input-importe-parcial");
     const beneficiarios = [];
   
     filasBenef.forEach((fila, i) => {
       const nomina = fila.querySelector("input")?.value.trim() || "";
       const codigo = filasCodigo[i]?.querySelector("input")?.value.trim() || "";
       const parcial = textoImporte(filasParcial[i]?.value);
       if (!nomina && !codigo && parcial === null) return; // fila vacía: no se guarda
       beneficiarios.push({ codigo, nomina, importe_parcial: parcial });
     });
   
     const erogaciones = [];
     document.querySelectorAll("#erogacionesBody tr").forEach((fila) => {
       const g = (sel) => fila.querySelector(sel)?.value || "";
       const prg = g(".erog-prg"), pry = g(".erog-pry"), ao = g(".erog-ao"), par = g(".erog-par");
       const importe = textoImporte(g(".input-importe-erogacion"));
       if (!prg && !pry && !ao && !par && importe === null) return; // fila vacía: no se guarda
       erogaciones.push({
         linea_id: aNum(g(".erog-linea-id")),
         programa_id: aNum(prg),
         proyecto_id: aNum(pry),
         actividad_id: aNum(ao),
         partida_id: aNum(par),
         fuente_id: aNum(g(".erog-fuente-id")),
         importe,
       });
     });
   
     return {
       nro_orden_pago: v("numeroOrden"),
       nro_expediente: v("expediente"),
       u_presupuestaria: v("uPresupuestaria"),
       fecha: fechaAISO(v("fechaOrden")),
       importe_op: textoImporte(v("importeOP")),
       codigo: v("codigoConcepto"),
       concepto: v("conceptoTexto"),
       observaciones: (document.getElementById("observaciones")?.value || "").trim(),
       beneficiarios,
       erogaciones,
     };
   }
   
   function contenidoVacio(c) {
     return (
       !c.nro_orden_pago && !c.nro_expediente && !c.u_presupuestaria && !c.codigo &&
       !c.concepto && !c.observaciones && !c.fecha && c.importe_op === null &&
       c.beneficiarios.length === 0 && c.erogaciones.length === 0
     );
   }
   
   /* ------------------------------------------------------------------------
      REPOBLAR EL FORMULARIO (retomar un borrador, ver una OP completada,
      restaurar la copia local)
      ------------------------------------------------------------------------ */
   
   function vaciarFilas() {
     document.getElementById("codigosContainer").innerHTML = "";
     document.getElementById("beneficiariosContainer").innerHTML = "";
     document.getElementById("parcialesContainer").innerHTML = "";
     document.getElementById("erogacionesBody").innerHTML = "";
   }
   
   function formatearDesdeTexto(valor) {
     if (valor === null || valor === undefined || valor === "") return "";
     return formatearImporte(Number(valor));
   }
   
   async function restaurarFilaErogacion(fila, det, soloLectura) {
     const c = fila._cascada;
     await c.cargaInicial; // programas y partidas ya cargados en esta fila
   
     if (det.programa_id) {
       c.selectPrg.value = String(det.programa_id);
       if (c.selectPrg.value) {
         await c.cargarProyectos();
         if (det.proyecto_id) {
           c.selectPry.value = String(det.proyecto_id);
           if (c.selectPry.value) {
             await c.cargarActividades();
             if (det.actividad_id) c.selectAo.value = String(det.actividad_id);
           }
         }
       }
     }
     if (det.partida_id) c.selectPar.value = String(det.partida_id);
   
     fila.querySelectorAll("select").forEach((sel) => {
       sel.title = sel.selectedOptions[0]?.dataset.completo || "";
     });
   
     if (soloLectura) {
       // OP ya completada: se muestra lo que quedó registrado, sin volver a consultar saldos.
       fila.querySelector(".erog-linea-id").value = det.linea_id || "";
       fila.querySelector(".erog-fuente-id").value = det.fuente_id || "";
       const desc = fila.querySelector(".erog-desc");
       desc.value = det.descripcion || "";
       desc.title = `${det.descripcion || ""}${det.fuente ? ` — FF ${det.fuente}` : ""}`;
     } else {
       await c.resolverLinea({ fuenteId: det.fuente_id });
     }
   
     fila.querySelector(".input-importe-erogacion").value = formatearDesdeTexto(det.importe);
   }
   
   async function aplicarDatos(datos, soloLectura) {
     vaciarFilas();
   
     const poner = (id, valor) => {
       const el = document.getElementById(id);
       if (el) el.value = valor ?? "";
     };
     poner("numeroOrden", datos.nro_orden_pago);
     poner("expediente", datos.nro_expediente);
     poner("uPresupuestaria", datos.u_presupuestaria);
     poner("fechaOrden", isoAFecha(datos.fecha));
     poner("importeOP", formatearDesdeTexto(datos.importe_op));
     poner("codigoConcepto", datos.codigo);
     poner("conceptoTexto", datos.concepto);
     poner("observaciones", datos.observaciones);
   
     const beneficiarios = datos.beneficiarios || [];
     if (beneficiarios.length === 0) agregarFilaBeneficiario();
     beneficiarios.forEach((b) => {
       agregarFilaBeneficiario();
       const nombres = document.querySelectorAll("#beneficiariosContainer .input-nombre-beneficiario");
       const codigos = document.querySelectorAll("#codigosContainer .input-codigo-beneficiario");
       const parciales = document.querySelectorAll("#parcialesContainer .input-importe-parcial");
       const i = nombres.length - 1;
       codigos[i].value = b.codigo || "";
       nombres[i].value = b.nomina || "";
       parciales[i].value = b.importe_parcial ? formatearDesdeTexto(b.importe_parcial) : "";
     });
   
     const erogaciones = datos.erogaciones || [];
     if (erogaciones.length === 0) agregarFilaErogacion();
     const restauraciones = erogaciones.map((det) => {
       agregarFilaErogacion();
       const filas = document.querySelectorAll("#erogacionesBody tr");
       return restaurarFilaErogacion(filas[filas.length - 1], det, soloLectura);
     });
     await Promise.all(restauraciones);
   
     recalcularTotales();
   }
   
   /* ------------------------------------------------------------------------
      AVISOS EN PANTALLA
      ------------------------------------------------------------------------ */
   
   let origenMensaje = null; // "guardado" = aviso causado por un error de guardado automático
   
   function mostrarMensaje(texto, tipo = "error", acciones = [], origen = null) {
     const el = document.getElementById("opp-mensaje");
     if (!el) return;
     origenMensaje = origen;
     el.className = `opp-mensaje no-print opp-mensaje-${tipo}`;
     el.textContent = "";
     const span = document.createElement("span");
     span.textContent = texto;
     el.appendChild(span);
     acciones.forEach((a) => {
       const b = document.createElement("button");
       b.type = "button";
       b.textContent = a.texto;
       b.addEventListener("click", a.fn);
       el.appendChild(b);
     });
     el.hidden = false;
   }
   
   function ocultarMensaje() {
     const el = document.getElementById("opp-mensaje");
     if (!el) return;
     el.hidden = true;
     el.textContent = "";
     origenMensaje = null;
   }
   
   function setEstadoAutosave(estado, detalle) {
     const el = document.getElementById("autosave-estado");
     if (!el) return;
     el.className = `autosave-estado solo-edicion ${estado}`;
     const textos = { guardando: "Guardando…", guardado: "Guardado", error: "Error al guardar" };
     el.textContent = textos[estado] || "";
     el.title = detalle || "";
   }
   
   /* ------------------------------------------------------------------------
      GUARDADO AUTOMÁTICO (borrador "Revisar")
      Guardar un borrador NO genera imputaciones ni movimientos presupuestarios:
      eso solo ocurre al "Guardar como completado" (ver completarOP).
      ------------------------------------------------------------------------ */
   
   const AUTOSAVE_MS = 1500;        // pausa al escribir
   const AUTOSAVE_RAPIDO_MS = 400;  // al cambiar un select, agregar o quitar filas
   const esModoVer = MODO_OPP === "ver";
   
   let oppId = MODO_OPP === "editar" && OPP_DATOS ? OPP_DATOS.id : null; // null hasta el primer guardado
   let oppVersion = MODO_OPP === "editar" && OPP_DATOS ? OPP_DATOS.version : null;
   let autosaveTimer = null;
   let reintentoTimer = null;
   let colaGuardado = Promise.resolve(true); // serializa los guardados: nunca hay dos en paralelo
   let ultimoGuardado = null;   // contenido (JSON) que el servidor confirmó por última vez
   let restaurando = false;     // true mientras se carga un borrador: no dispara guardados
   let completando = false;
   let bloqueado = false;       // conflicto, OP ya completada o sin permiso: se deja de guardar
   let guardandoEnCurso = false;
   let hayError = false;
   let intentosFallidos = 0;
   let salidaPermitida = false;
   
   /** Programa un guardado con pausa (debounce). Lo llaman los eventos del formulario. */
   function programarAutoguardado(rapido) {
     if (esModoVer || restaurando || completando || bloqueado) return;
     clearTimeout(autosaveTimer);
     clearTimeout(reintentoTimer);
     autosaveTimer = setTimeout(() => {
       autosaveTimer = null;
       guardarBorrador();
     }, rapido ? AUTOSAVE_RAPIDO_MS : AUTOSAVE_MS);
   }
   
   /** Usada por la cascada de erogaciones (cambios que no disparan eventos del navegador). */
   function avisarCambioFormulario(rapido) {
     programarAutoguardado(rapido);
   }
   
   /* Clave de idempotencia del primer guardado: si se pierde la respuesta y se reintenta,
      el servidor devuelve el mismo borrador en lugar de crear otro. */
   let claveIdempotencia = null;
   
   function generarUUID() {
     if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
     const b = new Uint8Array(16);
     crypto.getRandomValues(b);
     b[6] = (b[6] & 0x0f) | 0x40;
     b[8] = (b[8] & 0x3f) | 0x80;
     const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
     return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
   }
   
   function obtenerClave() {
     if (claveIdempotencia) return claveIdempotencia;
     try { claveIdempotencia = sessionStorage.getItem("opp_clave_nueva"); } catch (_) {}
     if (!claveIdempotencia) {
       claveIdempotencia = generarUUID();
       try { sessionStorage.setItem("opp_clave_nueva", claveIdempotencia); } catch (_) {}
     }
     return claveIdempotencia;
   }
   
   function descartarClave() {
     claveIdempotencia = null;
     try { sessionStorage.removeItem("opp_clave_nueva"); } catch (_) {}
   }
   
   /* Copia local: se escribe antes de cada envío y se borra cuando el servidor lo confirma.
      Si algo falla (sin conexión, conflicto…) los datos no se pierden en silencio. */
   const claveCopia = (id) => `opp_copia_${id || "nuevo"}`;
   
   function guardarCopiaLocal(contenido) {
     try { localStorage.setItem(claveCopia(oppId), JSON.stringify({ ts: Date.now(), contenido })); } catch (_) {}
   }
   function borrarCopiaLocal(id) {
     try { localStorage.removeItem(claveCopia(id)); } catch (_) {}
   }
   function leerCopiaLocal() {
     try {
       const crudo = localStorage.getItem(claveCopia(oppId));
       return crudo ? JSON.parse(crudo) : null;
     } catch (_) {
       return null;
     }
   }
   
   function programarReintento() {
     clearTimeout(reintentoTimer);
     const espera = Math.min(30000, 2000 * Math.pow(2, Math.max(0, intentosFallidos - 1)));
     reintentoTimer = setTimeout(() => guardarBorrador(), espera);
   }
   
   function manejarErrorServidor(status, data) {
     const recargar = { texto: "Recargar página", fn: () => { salidaPermitida = true; location.reload(); } };
   
     if (status === 409 && data.conflicto) {
       bloqueado = true;
       setEstadoAutosave("error", data.error);
       mostrarMensaje(
         `${data.error} Lo que escribiste quedó guardado solo en este navegador y se podrá restaurar al recargar.`,
         "error", [recargar], "guardado"
       );
       return;
     }
     if (status === 409 && data.completado) {
       bloqueado = true;
       setEstadoAutosave("error", data.error);
       mostrarMensaje(
         "Esta OP Personal ya fue completada (por otro usuario u otra pestaña) y no se puede modificar.",
         "error", [recargar], "guardado"
       );
       return;
     }
     if (status === 403 || status === 404) {
       bloqueado = true;
       setEstadoAutosave("error", data.error);
       mostrarMensaje(data.error || "No tenés permiso para editar esta OP Personal.", "error", [], "guardado");
       return;
     }
   
     hayError = true;
     setEstadoAutosave("error", data.error);
     if (status >= 500) {
       intentosFallidos++;
       mostrarMensaje(
         "No se pudieron guardar los últimos cambios (error del servidor). Tus datos siguen en pantalla y se reintentará automáticamente.",
         "error", [], "guardado"
       );
       programarReintento();
     } else {
       // 400: dato inválido. No se reintenta hasta que el usuario cambie algo.
       mostrarMensaje(`No se pudo guardar el borrador: ${data.error || "revisá los datos."}`, "error", [], "guardado");
     }
   }
   
   async function ejecutarGuardado() {
     if (bloqueado) return false;
   
     const contenido = construirContenido();
     const serial = JSON.stringify(contenido);
   
     // No crear un borrador vacío solo por abrir el formulario
     if (!oppId && contenidoVacio(contenido)) return true;
     // Nada nuevo respecto de lo que el servidor ya confirmó
     if (serial === ultimoGuardado) return true;
   
     guardarCopiaLocal(contenido);
     setEstadoAutosave("guardando");
     guardandoEnCurso = true;
   
     const creando = !oppId;
     const url = creando
       ? "/api/op-personal/borrador/crear/"
       : `/api/op-personal/borrador/${oppId}/actualizar/`;
     const payload = { ...contenido };
     if (creando) payload.clave_idempotencia = obtenerClave();
     else payload.version = oppVersion;
   
     try {
       const resp = await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json", "X-CSRFToken": getCookieOP("csrftoken") },
         body: JSON.stringify(payload),
         keepalive: true,
       });
       let data = {};
       try { data = await resp.json(); } catch (_) {}
   
       if (!resp.ok) {
         manejarErrorServidor(resp.status, data);
         return false;
       }
   
       if (creando) {
         borrarCopiaLocal(null);
         oppId = data.opp_id;
         descartarClave();
         history.replaceState(null, "", data.url_editar); // F5 reabre el borrador, no crea otro
       }
       oppVersion = data.version;
   
       if (data.existente) {
         // El servidor ya tenía un borrador con esta clave (primer guardado cuya respuesta se
         // perdió): no aplicó este contenido, así que se reenvía como actualización.
         ultimoGuardado = null;
         programarAutoguardado(true);
         return true;
       }
   
       ultimoGuardado = serial;
       borrarCopiaLocal(oppId);
       hayError = false;
       intentosFallidos = 0;
       if (origenMensaje === "guardado") ocultarMensaje();
       setEstadoAutosave("guardado");
       return true;
     } catch (err) {
       // Error de conexión: la copia local queda y se reintenta con espera creciente.
       console.error("Error en el guardado automático:", err);
       hayError = true;
       intentosFallidos++;
       setEstadoAutosave("error", "Sin conexión con el servidor");
       mostrarMensaje(
         "Sin conexión con el servidor: los últimos cambios todavía NO están guardados. Tus datos siguen en pantalla y se reintentará automáticamente.",
         "error", [], "guardado"
       );
       programarReintento();
       return false;
     } finally {
       guardandoEnCurso = false;
     }
   }
   
   /** Encola el guardado: nunca hay dos solicitudes en paralelo y cada una arma el contenido más reciente. */
   function guardarBorrador() {
     colaGuardado = colaGuardado.catch(() => true).then(ejecutarGuardado);
     return colaGuardado;
   }
   
   function inicializarAutoguardado() {
     const hoja = document.getElementById("hoja");
     hoja.addEventListener("input", () => programarAutoguardado(false));
     hoja.addEventListener("change", () => programarAutoguardado(true));
     hoja.addEventListener("click", (e) => {
       if (e.target.closest(".btn-mini")) programarAutoguardado(true); // quitar una fila de beneficiario
     });
     ["btnAddBeneficiario", "btnDelBeneficiario", "btnAddErogacion", "btnDelErogacion"].forEach((id) => {
       document.getElementById(id)?.addEventListener("click", () => programarAutoguardado(true));
     });
   
     // Si el usuario cambia de pestaña o cierra, se guarda de inmediato lo pendiente
     document.addEventListener("visibilitychange", () => {
       if (document.visibilityState === "hidden" && autosaveTimer) {
         clearTimeout(autosaveTimer);
         autosaveTimer = null;
         guardarBorrador();
       }
     });
   
     // Al volver la conexión se reintenta enseguida
     window.addEventListener("online", () => { if (hayError && !bloqueado) guardarBorrador(); });
   
     // Aviso si se intenta salir con cambios sin guardar
     window.addEventListener("beforeunload", (e) => {
       if (salidaPermitida) return;
       if (autosaveTimer || guardandoEnCurso || hayError) {
         e.preventDefault();
         e.returnValue = "";
       }
     });
   }
   
   /** Ofrece recuperar cambios locales que no llegaron al servidor (sin conexión, pestaña cerrada…). */
   async function ofrecerCopiaLocal() {
     const copia = leerCopiaLocal();
     if (!copia || !copia.contenido) return;
     if (JSON.stringify(copia.contenido) === ultimoGuardado) { borrarCopiaLocal(oppId); return; }
   
     const cuando = new Date(copia.ts).toLocaleString("es-AR");
     mostrarMensaje(
       `Se encontraron cambios de este navegador que no llegaron a guardarse en el servidor (${cuando}).`,
       "aviso",
       [
         {
           texto: "Restaurar",
           fn: async () => {
             restaurando = true;
             try { await aplicarDatos(copia.contenido, false); } finally { restaurando = false; }
             ocultarMensaje();
             programarAutoguardado(true);
           },
         },
         { texto: "Descartar", fn: () => { borrarCopiaLocal(oppId); ocultarMensaje(); } },
       ]
     );
   }
   
   /* ------------------------------------------------------------------------
      GUARDAR COMO COMPLETADO (REVISAR → LISTO)
      Único camino a Listo. El servidor valida de nuevo todo y confirma lo que
      tiene guardado; recién ahí se generan las imputaciones, una sola vez.
      ------------------------------------------------------------------------ */
   
   function aCentavos(texto) {
     return texto === null ? 0 : Math.round(Number(texto) * 100);
   }
   
   /** Devuelve el mensaje de lo que falta, o null si todo está listo para confirmar. */
   function validarParaCompletar() {
     const importeOP = document.getElementById("importeOP");
     const fechaOrden = document.getElementById("fechaOrden");
   
     if (!document.getElementById("numeroOrden").value.trim()) return "Ingresá el número de orden.";
     if (!document.getElementById("expediente").value.trim()) return "Ingresá el expediente.";
     if (!validarFecha(fechaOrden)) return "Ingresá una fecha válida (dd/mm/aaaa, no futura).";
     if (!validarImporte(importeOP) || parsearImporte(importeOP.value) <= 0) {
       return "Ingresá el Importe O.P. (mayor a cero).";
     }
     if (!document.getElementById("conceptoTexto").value.trim()) return "Ingresá el concepto.";
   
     const c = construirContenido();
     if (c.beneficiarios.length === 0) return "Agregá al menos un beneficiario.";
     if (c.erogaciones.length === 0) return "Agregá al menos una erogación.";
   
     const vistas = new Map();
     for (let i = 0; i < c.erogaciones.length; i++) {
       const e = c.erogaciones[i];
       const n = i + 1;
       if (!e.linea_id) {
         return `Erogación ${n}: completá PRG, PRY, A/O, PAR y, si corresponde, elegí la fuente de financiamiento.`;
       }
       if (e.importe === null || Number(e.importe) <= 0) return `Erogación ${n}: el importe debe ser mayor a cero.`;
       if (vistas.has(e.linea_id)) {
         return `Erogación ${n}: la línea presupuestaria está repetida (ya figura en la erogación ${vistas.get(e.linea_id)}).`;
       }
       vistas.set(e.linea_id, n);
     }
   
     const totBen = c.beneficiarios.reduce((s, b) => s + aCentavos(b.importe_parcial), 0);
     const totErog = c.erogaciones.reduce((s, e) => s + aCentavos(e.importe), 0);
     const totOP = aCentavos(c.importe_op);
     if (totBen !== totErog) {
       return `El total de beneficiarios ($ ${formatearImporte(totBen / 100)}) no coincide con el total de erogaciones ($ ${formatearImporte(totErog / 100)}).`;
     }
     if (totOP !== totErog) {
       return `El Importe O.P. ($ ${formatearImporte(totOP / 100)}) no coincide con el total de erogaciones ($ ${formatearImporte(totErog / 100)}).`;
     }
     return null;
   }
   
   async function completarOP() {
     if (esModoVer || completando || bloqueado) return;
     ocultarMensaje();
   
     const error = validarParaCompletar();
     if (error) { mostrarMensaje(error, "error"); return; }
   
     const btn = document.getElementById("btnCompletar");
     completando = true; // frena el autoguardado programado y los dobles clics mientras dura todo
     clearTimeout(autosaveTimer);
     autosaveTimer = null;
     if (btn) btn.disabled = true;
   
     try {
       // El servidor confirma lo que tiene guardado: tiene que ser exactamente lo que se ve en pantalla
       const ok = await guardarBorrador();
       if (!ok || !oppId) {
         mostrarMensaje("No se pudieron guardar los últimos cambios en el servidor. Reintentá antes de completar.", "error");
         return;
       }
   
       if (!confirm("¿Está seguro de que desea guardar esta Orden de Pago Personal como completada?")) {
         return; // sigue editando el borrador, sin cambios de estado
       }
   
       const resp = await fetch(`/api/op-personal/${oppId}/completar/`, {
         method: "POST",
         headers: { "Content-Type": "application/json", "X-CSRFToken": getCookieOP("csrftoken") },
         body: JSON.stringify({ version: oppVersion }),
       });
       let data = {};
       try { data = await resp.json(); } catch (_) {}
   
       if (!resp.ok) {
         // Sigue en Revisar (o ya estaba completada): no se generó nada nuevo.
         if (data.completado || data.conflicto) bloqueado = true;
         mostrarMensaje(
           data.error || "No se pudo completar la OP Personal.",
           "error",
           data.completado || data.conflicto
             ? [{ texto: "Recargar página", fn: () => { salidaPermitida = true; location.reload(); } }]
             : []
         );
         return;
       }
   
       salidaPermitida = true;
       borrarCopiaLocal(oppId);
       alert(`OP Personal guardada como completada.\nAsiento N°: ${data.asiento_nro}`);
       window.location.href = data.url_ver;
     } catch (err) {
       console.error(err);
       mostrarMensaje(
         "Error de red: no se pudo confirmar si la OP Personal se completó. Revisá su estado en el historial de registros antes de reintentar.",
         "error"
       );
     } finally {
       completando = false;
       if (btn) btn.disabled = false;
     }
   }
   
   /* ------------------------------------------------------------------------
      MODO VER (OP Personal ya completada): todo en solo lectura
      ------------------------------------------------------------------------ */
   
   function aplicarModoVer() {
     document.querySelectorAll("#hoja input, #hoja textarea").forEach((el) => {
       el.readOnly = true;
       el.tabIndex = -1;
     });
     document.querySelectorAll("#hoja select").forEach((el) => {
       el.tabIndex = -1; // el CSS (.modo-ver) bloquea además el puntero
     });
   
     const asiento = OPP_DATOS && OPP_DATOS.asiento_nro ? ` Asiento N° ${OPP_DATOS.asiento_nro}.` : "";
     mostrarMensaje(`OP Personal completada (estado Listo).${asiento} Solo lectura.`, "info");
   }
   
   /* ------------------------------------------------------------------------
      ESCALA RESPONSIVE DE LA HOJA
      En pantallas angostas la hoja (#hoja) se reduce para entrar en el ancho
      disponible. En pantallas anchas se ve normal. Durante la exportación a
      PDF y la impresión no se aplica escala (lo fuerza el CSS).
      ------------------------------------------------------------------------ */
   
   const ANCHO_DISENO_HOJA = 960; // ancho (px) con el que se diseña la hoja
   
   function inicializarEscalaHoja() {
     const viewport = document.getElementById("hojaViewport");
     const hoja = document.getElementById("hoja");
     if (!viewport || !hoja) return;
   
     function ajustar() {
       // Durante la exportación a PDF la hoja va sin escala
       if (document.body.classList.contains("exportando-pdf")) return;
   
       const disponible = viewport.clientWidth;
   
       // Pantalla ancha: la hoja se ve normal, como antes
       if (disponible === 0 || disponible >= ANCHO_DISENO_HOJA) {
         hoja.classList.remove("hoja-escalada");
         hoja.style.transform = "";
         viewport.style.height = "";
         return;
       }
   
       // Pantalla angosta: se reduce la hoja para que entre en el ancho
       const escala = disponible / ANCHO_DISENO_HOJA;
       hoja.classList.add("hoja-escalada");
       hoja.style.transform = `scale(${escala})`;
       viewport.style.height = `${Math.ceil(hoja.offsetHeight * escala)}px`;
     }
   
     ajustar();
   
     // Recalcular al cambiar el tamaño de la ventana o girar el dispositivo
     window.addEventListener("resize", ajustar);
     window.addEventListener("orientationchange", ajustar);
   
     // Recalcular cuando la hoja cambia de alto (agregar / quitar filas)
     if ("ResizeObserver" in window) {
       const observador = new ResizeObserver(ajustar);
       observador.observe(hoja);
       observador.observe(viewport);
     }
   
     // Al terminar la exportación a PDF (se quita "exportando-pdf") se vuelve a escalar
     new MutationObserver(ajustar).observe(document.body, {
       attributes: true,
       attributeFilter: ["class"]
     });
   }
   
   /* ------------------------------------------------------------------------
      INICIALIZACIÓN AL CARGAR LA PÁGINA (una sola vez)
      ------------------------------------------------------------------------ */
   
   document.addEventListener("DOMContentLoaded", async () => {
     inicializarEventosBotones();
     inicializarValidaciones();
     inicializarImporteOP();
   
     if (MODO_OPP === "crear" || !OPP_DATOS) {
       inicializarFilasBase();
       recalcularTotales();
     } else {
       restaurando = true; // repoblar el formulario no debe disparar guardados
       try {
         await aplicarDatos(OPP_DATOS, esModoVer);
       } catch (err) {
         console.error(err);
         mostrarMensaje("No se pudo cargar completamente la OP Personal. Recargá la página.", "error");
       } finally {
         restaurando = false;
       }
     }
   
     // Escala responsive de la hoja (en todos los modos, incluido "ver")
     inicializarEscalaHoja();
   
     const delegacion = document.getElementById("delegacionContable");
     if (delegacion) {
       delegacion.value = "ADM. PCIAL. DE RECURSOS HIDRICOS";
     }
   
     if (esModoVer) {
       aplicarModoVer();
       return;
     }
   
     // Lo que el servidor tiene ahora (para no reenviar datos idénticos)
     ultimoGuardado = oppId ? JSON.stringify(construirContenido()) : null;
     inicializarAutoguardado();
     ofrecerCopiaLocal();
   });