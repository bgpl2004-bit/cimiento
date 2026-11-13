/* Cimiento: capa de datos en servidor (Firestore). Se carga solo si js/config.js trae la configuración de Firebase.
 * Misma interfaz que el modo local de js/store.js (Store.open). */
(function () {
  "use strict";
  window.CimientoStoreServidor = function (codigo, onCambio, h) {
    var uid = h.uid, normalizar = h.normalizar, nuevoEstado = h.nuevoEstado, VERSION = h.VERSION;
    var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.CIMIENTO_FIREBASE);
    var db = firebase.firestore(app);
    var ref = db.collection("parejas").doc(codigo);
    var cache = nuevoEstado();
    var listo = { config: false, aportes: false };
    var resolver, rechazar;
    var promesa = new Promise(function (ok, no) { resolver = ok; rechazar = no; });

    function emitir() {
      onCambio(normalizar(cache));
      if (listo.config && listo.aportes && resolver) { var r = resolver; resolver = null; r(api); }
    }
    var u1 = ref.onSnapshot(function (snap) {
      cache.config = snap.exists ? snap.data().config || null : null;
      if (cache.config && cache.config.v !== VERSION) cache.config = null; // esquema anterior: se vuelve a crear
      listo.config = true; emitir();
    }, function (err) { if (rechazar) rechazar(err); });
    var u2 = ref.collection("aportes").onSnapshot(function (snap) {
      cache.aportes = snap.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; });
      listo.aportes = true; emitir();
    }, function (err) { if (rechazar) rechazar(err); });

    var api = {
      modo: "servidor",
      estado: function () { return normalizar(cache); },
      crearPareja: function (cfg) { return ref.set({ config: cfg, creadoEn: new Date().toISOString() }); },
      agregarAporte: function (a) { var id = uid(); a.id = id; return ref.collection("aportes").doc(id).set(a).then(function () { return a; }); },
      resolverAporte: function (id, estado, quien) {
        return ref.collection("aportes").doc(id).update({ estado: estado, resueltoPor: quien, resueltoEn: new Date().toISOString() });
      },
      actualizarAporte: function (id, campos) { return ref.collection("aportes").doc(id).update(campos); },
      borrar: function () {
        return ref.collection("aportes").get().then(function (q) { return Promise.all(q.docs.map(function (d) { return d.ref.delete(); })); }).then(function () { return ref.delete(); });
      },
      cerrar: function () { u1(); u2(); }
    };
    api.guardarConfig = api.crearPareja;
    return promesa;
  };
})();
