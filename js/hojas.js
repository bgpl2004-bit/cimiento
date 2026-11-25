/* Cimiento: textos de hojas que se abren a pedido (ronda 22). Se carga la primera vez que se abre una de ellas,
 * para que el JS de carga inicial quede bajo 200 KB. Solo arma HTML; la lógica (botones, consentimientos) sigue en js/app.js. */
(function () {
 "use strict";
 window.CimientoHojas = function (k) {
  var esc = k.esc;
  function datosBci() { return '<ul class="lista-corta"><li><strong>Ingreso y ahorro:</strong> para sugerir un camino.</li><li><strong>Aportes:</strong> para verificarlos y mostrar el avance.</li><li><strong>Constancia y niveles:</strong> para reconocerla.</li></ul>'; }
  return {
   que: function () {
    return '<p class="qp-frase">Un sistema de ahorro para el pie que convierte una meta grande en 10 casitas, con el avance verificado por Bci.</p>' +
     '<ul class="lista-corta"><li>Metas pequeñas: 10 casitas en vez de una cifra lejana.</li><li>Lo logrado no se pierde: las casitas logradas se mantienen.</li><li>El banco reconoce cada etapa.</li><li>La pareja construye junta, cada uno a su ritmo.</li></ul>' +
     '<h3 class="rotulo">Ya funciona en este prototipo</h3><ul class="lista-corta"><li>Camino de casitas que se adapta al plan.</li><li>Aportes verificados y declarados.</li><li>Ficha, rescate y transferencia de casitas (simulados).</li><li>Propuesta de fin de mes y planes futuros.</li><li>Vista conjunta de la pareja.</li></ul>' +
     '<h3 class="rotulo">Propuesta de Cimiento para Bci</h3><ul class="lista-corta"><li>Premios por etapa y reconocimiento por casita.</li><li>Niveles por constancia: Bronce, Plata y Oro.</li><li>Aporte automático.</li><li>Historial de ahorro al evaluar un crédito.</li></ul>' +
     '<h3 class="rotulo">Qué datos recibe Bci</h3>' + datosBci() + '<p class="fuente">Concepto 2050 · simulado, no es una oferta de Bci.</p>';
   },
   datos: function (P) {
    var ok = !!P.consentimientoBci;
    return '<div class="fila-datos"><span>Uso de datos por Bci</span><strong>' + (ok ? "Autorizado" : "Revocado") + "</strong></div>" +
     '<h3 class="rotulo">Qué recibe y usa Bci</h3>' + datosBci() +
     '<p class="hoja-nota">Lo logrado se mantiene. En esta demostración, al revocar, Cimiento deja de sugerir valores con sus datos Bci.</p>' +
     '<div class="pila"><button class="boton secundario" type="button" data-consent="' + (ok ? "revocar" : "otorgar") + '">' + (ok ? "Revocar autorización" : "Autorizar de nuevo") + "</button></div>" +
     '<label class="sw-fila cons-credito"><span><strong>Autorizo a Bci a considerar mi historial de ahorro en Cimiento al evaluar un crédito</strong><small>Opcional. Puede retirarlo cuando quiera.</small></span><input id="cons-credito" type="checkbox" role="switch"' + (P.consentimientoCredito ? " checked" : "") + "></label>" +
     '<p class="rotulo-prop">Propuesta de Cimiento. Bci define si lo ofrece.</p>' +
     '<div class="pila"><button class="boton secundario" type="button" data-consent="descargar">Descargar mis datos (JSON)</button></div>' +
     '<p class="hoja-nota">Cimiento nunca ve ni guarda su clave. En esta demostración los datos quedan en este teléfono; en el producto real los recibiría Bci con su autorización.</p>' +
     '<p class="nota">Derechos de acceso, rectificación, supresión y portabilidad: Ley 21.719, en vigencia desde el 1 de diciembre de 2026 salvo que se publique su postergación.</p>';
   },
   probar: function (l, demo) {
    return '<ul class="pp-lista">' + l.map(function (x) { return '<li><button class="pp-item' + (x.ok ? " ok" : "") + '" type="button" data-pp="' + x.dest + '"><i aria-hidden="true">' + (x.ok ? '<svg class="ic"><use href="#i-check"/></svg>' : "") + "</i><span>" + esc(x.txt) + '</span><svg class="ic" aria-hidden="true"><use href="#i-chev"/></svg></button></li>'; }).join("") + "</ul>" +
     (demo ? '<ul class="pp-notas"><li>La propuesta de fin de mes depende de si aportó este mes: con aporte, «Pueden llegar antes»; sin aporte, «Su camino puede ajustarse». Para ver la otra, use «Volver al caso de ejemplo».</li><li>Plata y Oro piden 6 y 12 meses de constancia: aquí se muestran como siguientes niveles.</li><li>Para ver el alta de una persona nueva, ingrese con su cuenta Bci desde la entrada.</li></ul>' +
      '<div class="pila"><button class="boton terciario" type="button" data-pp="volver">Volver al caso de ejemplo</button></div>' : "");
   },
   glosario: function () {
    return '<dl class="glosario"><dt>Casita</dt><dd>Una de las 10 partes de su meta. Su tamaño sale de su plan y su parte del pie.</dd><dt>Verificado</dt><dd>Bci lo comprobó en su cuenta. Suma a sus premios.</dd>' +
     "<dt>Declarado</dt><dd>Ahorro en otra institución que usted indicó. Cuenta para su casa, pero no activa premios.</dd><dt>Propuesta para su camino</dt><dd>Si cambia lo que pueden aportar, se reparten de nuevo solo las casitas que faltan. Las casitas logradas se mantienen.</dd>" +
     "<dt>Juntos</dt><dd>La suma de los dos viajes. Ninguno aprueba los aportes del otro.</dd><dt>Renta que pide el banco</dt><dd>Al menos 4 veces el dividendo (Bci, Crédito hipotecario, 9-11-2026).</dd></dl>" +
     '<p class="nota">La idea de dividir el pie en casitas es una hipótesis de diseño que estamos probando.</p>';
   },
   acerca: function (base, demo, rotulo) {
    return '<p class="hoja-nota">Prototipo académico del Taller de Interacción IV (UDD) para Bci Labs. Sin valor legal. No es una oferta de Bci: el banco decide.</p><p class="nota">Versión ' + esc(window.CIMIENTO_VERSION || "0.22") + " · 24-11-2026. Datos de demostración.</p>" +
     '<h3 class="rotulo">Para la persona que facilita</h3><div class="pila"><button class="boton secundario" type="button" data-fac="finmes">Simular fin de mes</button>' + (demo ? '<button class="boton secundario" type="button" data-fac="reiniciar">Reiniciar demo</button>' : "") +
     '<button class="boton secundario" type="button" data-fac="registro">Descargar registro de la prueba (JSON)</button><button class="boton secundario" type="button" data-fac="copiar-registro">Copiar registro</button><button class="boton secundario" type="button" data-fac="compartir-registro">Compartir registro</button></div>' +
     '<p class="ayuda">El registro no guarda nombres, RUT, claves ni montos: solo el código de la prueba, la acción, la hora y la versión.</p>' +
     '<p class="ayuda">Caso de ejemplo: <code>' + esc(base) + "?codigo=demo-p1&amp;persona=p1&amp;tour=0</code> (Tomás; p2 = Paula). <code>?codigo=alta-p1</code> abre el alta limpia. <code>&amp;finmes=1</code> simula el fin de mes al entrar. <code>&amp;etapa=falta</code> muestra siempre lo que falta.</p>" +
     '<p class="rotulo-pie">' + rotulo + "</p>";
   }
  };
 };
})();
