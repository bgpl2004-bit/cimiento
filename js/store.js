/* Capa de datos de Cimiento.
 * Dos implementaciones con la misma interfaz:
 *  - Firestore (servidor): ambas personas ven lo mismo, en tiempo real. Se activa si js/config.js trae la configuración de Firebase.
 *  - Local (navegador): para probar sin servidor. Sincroniza solo entre pestañas del mismo navegador.
 * Interfaz: Store.open(codigo, onCambio) -> Promise<api>
 *   api.modo, api.estado(), api.crearPareja(cfg) (= guardarConfig), api.agregarAporte(a), api.resolverAporte(id, estado, quien),
 *   api.actualizarAporte(id, campos), api.borrar(), api.cerrar()
 * Esquema de datos v2 (ver js/viaje.js): config.v = 2. Los datos de una versión anterior no tienen migración limpia
 * (cambió el modelo: ya no hay confirmación mutua): se reinician.
 */
(function () {
  "use strict";

  var DEFAULTS = {
    nombres: { p1: "Tomás", p2: "Paula" },
    pie: 121200000,           // $ requerido (4.900 UF a $41.157,43, referencia)
    ahorroInicial: 40000000,  // $ ya ahorrado antes de usar Cimiento
    aporteMensual: 1000000    // $ por mes entre ambos
  };

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var VERSION = 2;
  function nuevoEstado() { return { config: null, aportes: [] }; }
  function vigente(s) { return !s.config || s.config.v === VERSION; }

  function normalizar(estado) {
    estado.aportes.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
    return estado;
  }

  /* ---------- Local ---------- */
  function abrirLocal(codigo, onCambio) {
    var key = "cimiento:pareja:" + codigo;
    var canal = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(key) : null;
    function leer() {
      try { var s = JSON.parse(localStorage.getItem(key)); if (s && s.aportes && vigente(s)) return s; } catch (e) {}
      return nuevoEstado(); // sin datos o con un esquema anterior: se parte de cero
    }
    function guardar(s) {
      try { localStorage.setItem(key, JSON.stringify(s)); } catch (e) {}
      if (canal) canal.postMessage("cambio");
      onCambio(normalizar(s));
    }
    if (canal) canal.onmessage = function () { onCambio(normalizar(leer())); };
    window.addEventListener("storage", function (ev) { if (ev.key === key) onCambio(normalizar(leer())); });
    var api = {
      modo: "local",
      estado: function () { return normalizar(leer()); },
      crearPareja: function (cfg) { var s = leer(); s.config = cfg; guardar(s); return Promise.resolve(); },
      agregarAporte: function (a) { var s = leer(); a.id = uid(); s.aportes.push(a); guardar(s); return Promise.resolve(a); },
      resolverAporte: function (id, estado, quien) {
        var s = leer();
        s.aportes.forEach(function (a) { if (a.id === id) { a.estado = estado; a.resueltoPor = quien; a.resueltoEn = new Date().toISOString(); } });
        guardar(s); return Promise.resolve();
      },
      // Cambia campos de un aporte (monto editado, motivo de rechazo).
      actualizarAporte: function (id, campos) {
        var s = leer();
        s.aportes.forEach(function (a) { if (a.id === id) Object.keys(campos).forEach(function (k) { a[k] = campos[k]; }); });
        guardar(s); return Promise.resolve();
      },
      borrar: function () { try { localStorage.removeItem(key); } catch (e) {} if (canal) canal.postMessage("cambio"); onCambio(nuevoEstado()); return Promise.resolve(); },
      cerrar: function () { if (canal) canal.close(); }
    };
    api.guardarConfig = api.crearPareja;
    onCambio(api.estado());
    return Promise.resolve(api);
  }

  /* ---------- Servidor (Firestore): js/store-servidor.js, cargado por la app solo si hay configuración ---------- */

  window.CimientoStore = {
    DEFAULTS: DEFAULTS,
    // Preferencias de este dispositivo (ocultar montos, accesibilidad, PIN como hash, avisos leídos). No se comparten.
    pref: function (clave, valor) {
      try {
        var k = "cimiento:pref:" + clave;
        if (valor === undefined) return localStorage.getItem(k);
        if (valor === null) localStorage.removeItem(k); else localStorage.setItem(k, String(valor));
      } catch (e) {}
      return valor;
    },
    // Marca de esta sesión del navegador (pantalla de inicio una vez por sesión).
    sesion: function (clave, valor) {
      try { var k = "cimiento:sesion:" + clave; if (valor === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, String(valor)); } catch (e) {}
      return valor;
    },
    // Mediciones del protocolo de pruebas (las lee test.html). Solo código de pareja, tipo y hora: nunca montos ni N.º de operación.
    registrarEvento: function (codigo, tipo) {
      try {
        var k = "cimiento:eventos", l = JSON.parse(localStorage.getItem(k) || "[]");
        l.push({ codigo: codigo || "", tipo: tipo, t: new Date().toISOString(), v: window.CIMIENTO_VERSION || "" });
        localStorage.setItem(k, JSON.stringify(l.slice(-500)));
      } catch (e) {}
    },
    servidorDisponible: function () { return !!(window.CIMIENTO_FIREBASE && window.CIMIENTO_FIREBASE.projectId && typeof firebase !== "undefined" && window.CimientoStoreServidor); },
    open: function (codigo, onCambio) {
      codigo = String(codigo || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!codigo) return Promise.reject(new Error("Código vacío"));
      if (window.CimientoStore.servidorDisponible()) {
        return window.CimientoStoreServidor(codigo, onCambio, { uid: uid, normalizar: normalizar, nuevoEstado: nuevoEstado, VERSION: VERSION }).then(function (api) { api.codigo = codigo; return api; });
      }
      return abrirLocal(codigo, onCambio).then(function (api) { api.codigo = codigo; return api; });
    },
    /* Caso de ejemplo: Tomás y Paula, cada uno con su viaje. Tomás: $22,67 M verificados (5,3 casitas; casita 6 al 32 %).
       Ronda 19: Paula queda con 3,2 casitas verificadas (3 completas y 20 % de la cuarta) para que la casita de dos líneas
       muestre la diferencia; conserva su aporte de este mes ($700.000) y su declarado de $400.000 (otra institución).
       datosDemo() es puro (lo usan las pruebas); sembrarDemo() lo guarda. */
    datosDemo: function (ref) {
      var V = window.CimientoViaje, hoy = ref ? new Date(ref) : new Date();
      function haceMeses(n, dia) { var d = new Date(hoy.getFullYear(), hoy.getMonth() - n, dia || 5, 10); if (d > hoy) d = new Date(hoy.getTime() - 3600000); return d.toISOString(); }
      var cfg = V.crearConfig({
        p1: { nombre: "Tomás", ingreso: 1700000, gastos: 1100000, capacidad: 600000, ahorro: 0 },
        p2: { nombre: "Paula", ingreso: 1300000, gastos: 900000, capacidad: 400000, ahorro: 0 }
      });
      var t1 = V.r10k(40000000 * cfg.personas.p1.parte / cfg.pie), c2 = cfg.personas.p2.casitas;
      var t2 = c2[0].monto + c2[1].monto + c2[2].monto + Math.round(c2[3].monto * 0.2);
      var pasos = [
        // Tomás: saldo inicial + 3 meses con $600.000; este mes, aún nada (aportó menos de lo previsto).
        { de: "p1", monto: t1 - 1800000, m: 6, origen: "inicial" }, { de: "p1", monto: 600000, m: 3 }, { de: "p1", monto: 600000, m: 2 }, { de: "p1", monto: 600000, m: 1 },
        // Paula: saldo inicial + 2 meses con $400.000 y este mes $700.000 + $400.000 declarados de otra institución.
        { de: "p2", monto: t2 - 1500000, m: 6, origen: "inicial" }, { de: "p2", monto: 400000, m: 2 }, { de: "p2", monto: 400000, m: 1 }, { de: "p2", monto: 700000, m: 0, dia: 2 },
        { de: "p2", monto: 400000, m: 0, dia: 3, estado: "declarado", origen: "otra" }
      ];
      var aportes = pasos.map(function (s) { return { de: s.de, monto: s.monto, fecha: haceMeses(s.m, s.dia), estado: s.estado || "verificado", origen: s.origen || "cuenta-bci" }; });
      // El demo parte sin propuestas activas; solo "Simular fin de mes" las crea (comparando el mes con el plan).
      ["p1", "p2"].forEach(function (p) { cfg.personas[p].consentimientoBci = new Date().toISOString(); });
      cfg.vinculo = { tipo: "pareja", estado: "aceptada", de: "p1" };
      return { cfg: cfg, aportes: aportes };
    },
    sembrarDemo: function (api) {
      var dd = window.CimientoStore.datosDemo();
      return api.crearPareja(dd.cfg).then(function () {
        return dd.aportes.reduce(function (pr, a) { return pr.then(function () { return api.agregarAporte(a); }); }, Promise.resolve());
      });
    }  };
})();
