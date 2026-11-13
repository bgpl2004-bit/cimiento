/* Cimiento: funciones puras del protocolo de pruebas v2 (las usan test.html y CimientoViaje.pruebas()).
 * Sin DOM ni almacenamiento: combinar registros sin duplicados, SUS (Brooke, 1996) y métricas del resumen CIF (ISO/IEC 25062). */
(function () {
  "use strict";
  // Un registro puede venir como lista de eventos o como { app, v, eventos: [...] } (exportado desde «Acerca»).
  function eventosDe(x) {
    if (typeof x === "string") { try { x = JSON.parse(x); } catch (e) { return null; } }
    var l = Array.isArray(x) ? x : x && Array.isArray(x.eventos) ? x.eventos : null;
    if (!l) return null;
    return l.filter(function (e) { return e && typeof e.tipo === "string" && typeof e.t === "string"; })
      .map(function (e) { return { codigo: String(e.codigo || ""), tipo: e.tipo, t: e.t, v: e.v ? String(e.v) : "" }; });
  }
  // Combina sin duplicados (clave: código + tipo + hora). Devuelve la lista ordenada y cuántos eventos nuevos entraron.
  function combinarEventos(base, nuevos) {
    var vistos = {}, out = [], agregados = 0;
    (base || []).forEach(function (e) { var k = e.codigo + "|" + e.tipo + "|" + e.t; if (!vistos[k]) { vistos[k] = 1; out.push(e); } });
    (nuevos || []).forEach(function (e) { var k = e.codigo + "|" + e.tipo + "|" + e.t; if (!vistos[k]) { vistos[k] = 1; out.push(e); agregados++; } });
    out.sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; });
    return { lista: out, agregados: agregados };
  }
  // alta-p3 / demo-p3 → "P3"
  function participanteDeCodigo(c) { var m = /^(?:alta|demo)-p(\d+)$/.exec(String(c || "")); return m ? "P" + m[1] : null; }
  // SUS de 10 respuestas 1..5 (impares positivas, pares negativas) → 0..100; null si falta alguna.
  function sus(r) {
    if (!r || r.length < 10) return null;
    var s = 0;
    for (var i = 0; i < 10; i++) { var v = r[i]; if (!(v >= 1 && v <= 5)) return null; s += i % 2 === 0 ? v - 1 : 5 - v; }
    return s * 2.5;
  }
  function media(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function mediana(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function desv(a) { if (a.length < 2) return a.length ? 0 : null; var m = media(a); return Math.sqrt(a.reduce(function (x, y) { return x + (y - m) * (y - m); }, 0) / (a.length - 1)); }
  // Métricas de una tarea. registros = [{ ok: 1 | 0.5 | 0, s, seq, desl, equiv, crit }]. Tiempos solo de tareas exitosas (ok ≥ 0,5).
  function metricasTarea(registros) {
    var conNota = registros.filter(function (r) { return r && (r.ok === 1 || r.ok === 0.5 || r.ok === 0); });
    var n = conNota.length, sola = conNota.filter(function (r) { return r.ok === 1; }).length, pista = conNota.filter(function (r) { return r.ok >= 0.5; }).length;
    var tiempos = conNota.filter(function (r) { return r.ok >= 0.5 && typeof r.s === "number"; }).map(function (r) { return r.s; });
    var seqs = registros.filter(function (r) { return r && r.seq >= 1; }).map(function (r) { return r.seq; });
    var errores = registros.reduce(function (s, r) { return s + (r ? (r.desl || 0) + (r.equiv || 0) + (r.crit || 0) : 0); }, 0);
    return { n: n, sola: sola, conPista: pista, tasaSola: n ? sola / n * 100 : null, tasaConPista: n ? pista / n * 100 : null,
      media: media(tiempos), mediana: mediana(tiempos), desv: desv(tiempos), seq: media(seqs), errores: errores };
  }
  // Hallazgos consolidados: mismo texto (sin mayúsculas ni espacios extra) = mismo hallazgo; orden por severidad máxima × frecuencia.
  function consolidarHallazgos(participantes) {
    var g = {};
    participantes.forEach(function (p) {
      (p.problemas || []).forEach(function (h) {
        var t = String(h && h.txt || "").trim(); if (!t) return;
        var k = t.toLowerCase().replace(/\s+/g, " ");
        g[k] = g[k] || { txt: t, sev: 0, quienes: [] };
        g[k].sev = Math.max(g[k].sev, h.sev || 1);
        if (g[k].quienes.indexOf(p.id) < 0) g[k].quienes.push(p.id);
      });
    });
    return Object.keys(g).map(function (k) { var x = g[k]; x.frec = x.quienes.length; x.puntaje = x.sev * x.frec; return x; })
      .sort(function (a, b) { return b.puntaje - a.puntaje || b.sev - a.sev; });
  }
  window.CimientoProtocolo = { eventosDe: eventosDe, combinarEventos: combinarEventos, participanteDeCodigo: participanteDeCodigo, sus: sus,
    media: media, mediana: mediana, desv: desv, metricasTarea: metricasTarea, consolidarHallazgos: consolidarHallazgos,
    METAS: { exito: 80, seq: 5.5, sus: 68 } };
})();
