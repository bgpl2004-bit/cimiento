/* Cimiento: datos Bci SIMULADOS (una sola fuente). Son datos de demostración: no vienen de Bci ni de ninguna cuenta real.
 * En el producto real, estos valores llegarían de Bci solo con el consentimiento de la persona. Nunca se guarda la clave. */
(function () {
  "use strict";
  var PERSONAS = {
    p1: { nombre: "Tomás", cuenta: "••1234", tipoCuenta: "Cuenta vista", saldo: 2340000, ingreso: 1700000, ingresoNota: "Promedio de los últimos 6 meses",
      ahorro: 28000000, ahorroNota: "Depósito a plazo", gastosSugeridos: 1100000 },
    p2: { nombre: "Paula", cuenta: "••5678", tipoCuenta: "Cuenta vista", saldo: 1850000, ingreso: 1300000, ingresoNota: "Promedio de los últimos 6 meses",
      ahorro: 0, ahorroNota: "Sin depósitos en Bci", gastosSugeridos: 900000 }
  };
  window.CimientoDatosBci = {
    ETIQUETA: "Datos de demostración",
    persona: function (p) { return PERSONAS[p] || PERSONAS.p1; },
    // Simula la conexión con la cuenta (1,2 s). No hace peticiones de red.
    conectar: function (p) { return new Promise(function (ok) { setTimeout(function () { ok(PERSONAS[p] || PERSONAS.p1); }, 1200); }); }
  };
})();
