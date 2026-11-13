/* Cimiento: modelo del viaje (esquema de datos v2) y dibujos. Funciones puras, sin DOM, reutilizadas por la app y por las pruebas.
 *
 * Idea: cada persona tiene su viaje (su parte del pie dividida en 10 casitas de tamaño según la forma del camino) y juntos
 * ven el total. Un aporte verificado llena la casita en curso y desborda a la siguiente; lo declarado (otra institución) se
 * muestra a continuación en amarillo y no completa casitas. Las casitas acuñadas nunca se reducen: ajustar el camino solo
 * redistribuye las casitas que faltan.
 *
 * config (v2) = { v: 2, pie, personas: { p1: Persona, p2: Persona }, solicitudes: [], propuestas: {}, cambios: [] }
 * Persona = { nombre, ingreso, gastos, capacidad, plan, parte, forma, plazoDeseado, automatico, casitas: [{ n, monto, estado }] }
 *   estado de casita guardado: "activa" | "rescatada" | "transferida" (en curso y acuñada se derivan de los aportes)
 * aporte = { id, de, monto, fecha, estado: "verificado" | "declarado", origen: "cuenta-bci" | "otra" | "inicial" | "rescate" | "transferencia", desde?, casita?, op? }
 *
 * Ronda 18: casita (techo + barra), casa isométrica (dibujarMapa) y camino vertical (dibujarCamino) devuelven SVG en texto.
 */
(function () {
  "use strict";
  var V = 2, N = 10, PIE = 121200000;
  var FORMAS = {
   adaptativo: { nombre: "Adaptativo", txt: "Parte con una casita chica y luego sigue lo que ahorran cada mes." },
   rampa: { nombre: "Rampa", txt: "Cada casita es un poco más grande que la anterior." },
   escalones: { nombre: "Escalones con descanso", txt: "Sube de a dos casitas iguales: un paso y un descanso." },
   constante: { nombre: "Constante", txt: "Todas las casitas del mismo tamaño." }
  };
  function r10k(n) { return Math.round(n / 10000) * 10000; }
  function lim(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- formatos es-CL (se prueban en pruebas()) ---------- */
  function miles(n) { var s = String(Math.round(Math.abs(n))), o = ""; while (s.length > 3) { o = "." + s.slice(-3) + o; s = s.slice(0, -3); } return (n < 0 ? "−" : "") + s + o; }
  function pesos(n) { return (n < 0 ? "−$" : "$") + miles(Math.abs(n)); }
  function millones(n) { return "$" + (Math.round(n / 1e5) / 10).toFixed(1).replace(".", ",") + " M"; }
  function pct(f) { return Math.floor(Math.max(0, Math.min(1, f)) * 100 + 1e-6) + " %"; } // espacio duro: "39 %" no se corta
  function anosMeses(m) {
   if (!isFinite(m)) return "sin plan mensual";
   var a = Math.floor(m / 12), r = m % 12, t = [];
   if (a) t.push(a + (a === 1 ? " año" : " años"));
   if (r || !a) t.push(r + (r === 1 ? " mes" : " meses"));
   return t.join(" y ");
  }
  function plazo(m) { if (!isFinite(m)) return "sin plan mensual"; if (m <= 0) return "ya llegan"; return m < 24 ? (m === 1 ? "1 mes" : m + " meses") : anosMeses(m); }
  function dvRut(num) { var s = 0, k = 2; num = String(num); for (var i = num.length - 1; i >= 0; i--) { s += parseInt(num.charAt(i), 10) * k; k = k === 7 ? 2 : k + 1; } var r = 11 - (s % 11); return r === 11 ? "0" : r === 10 ? "K" : String(r); }
  function limpiarRut(t) { return String(t || "").toUpperCase().replace(/[^0-9K]/g, ""); }
  function formatoRut(t) { var c = limpiarRut(t); if (c.length < 2) return c; var cuerpo = c.slice(0, -1).replace(/K/g, ""), dv = c.slice(-1); return miles(parseInt(cuerpo || "0", 10)) + "-" + dv; }
  function validarRut(t) { var c = limpiarRut(t); if (c.length < 8 || c.length > 9) return false; var cuerpo = c.slice(0, -1); if (!/^\d+$/.test(cuerpo)) return false; return dvRut(cuerpo) === c.slice(-1); }
  function enmascararRut(t) { var c = formatoRut(t); return c.replace(/^[\d.]+(?=\d{3}-)/, function (s) { return s.replace(/\d/g, "•"); }); }

  function reparto(pie, ingresos) {
   var t = (ingresos.p1 || 0) + (ingresos.p2 || 0), p1 = t > 0 ? r10k(pie * ingresos.p1 / t) : r10k(pie / 2);
   return { p1: p1, p2: pie - p1 };
  }

  /* Tamaños de k casitas que suman exactamente T (múltiplos de $10.000; la última absorbe el resto).
   rampa: s1 = 25 % del tamaño equitativo y crecimiento lineal; adaptativo: la primera alcanza en unos 3 meses de plan
   (entre 10 % y 100 % del tamaño equitativo) y luego rampa lineal; escalones: pares iguales que suben; constante: iguales. */
  function tamanos(T, k, forma, plan) {
   if (k <= 0) return [];
   if (k === 1) return [T];
   var eq = T / k, w = [], i;
   if (forma === "constante") for (i = 0; i < k; i++) w.push(eq);
   else if (forma === "escalones") { var s = 0; for (i = 0; i < k; i++) { w.push(1 + Math.floor(i / 2) * 0.5); s += w[i]; } w = w.map(function (x) { return x * T / s; }); }
   else {
    var s1 = forma === "rampa" ? 0.25 * eq : lim(3 * (plan || 0), 0.1 * eq, eq);
    var d = (T - k * s1) / (k * (k - 1) / 2);
    for (i = 0; i < k; i++) w.push(s1 + i * d);
   }
   var out = [], acum = 0;
   for (i = 0; i < k - 1; i++) { var m = Math.max(10000, r10k(w[i])); out.push(m); acum += m; }
   out.push(T - acum);
   return out;
  }
  function casitasNuevas(parte, forma, plan) { return tamanos(parte, N, forma, plan).map(function (m, i) { return { n: i + 1, monto: m, estado: "activa" }; }); }

  function aportesDe(aportes, p) { return aportes.filter(function (a) { return a.de === p && a.estado !== "anulado"; }); }

  /* Estado del viaje de una persona: llena las casitas activas en orden con lo verificado y luego con lo declarado. */
  function viaje(persona, aportes, p) {
   var mios = aportesDe(aportes, p), ver = 0, dec = 0;
   mios.forEach(function (a) { if (a.estado === "verificado") ver += a.monto; else if (a.estado === "declarado") dec += a.monto; });
   var rv = Math.max(0, ver), rd = Math.max(0, dec), cas = [], actual = -1, acunadas = 0;
   var orden = mios.filter(function (a) { return a.estado === "verificado"; }).slice().sort(function (x, y) { return x.fecha < y.fecha ? -1 : 1; });
   var finAcum = 0;
   persona.casitas.forEach(function (c, i) {
    var x = { i: i, n: c.n, monto: c.monto, guardado: c.estado, lleno: 0, pend: 0, acunada: false, fecha: null };
    if (c.estado === "activa") {
     x.lleno = c.monto > 0 ? Math.min(1, rv / c.monto) : 1; rv = Math.max(0, rv - c.monto);
     var hueco = (1 - x.lleno) * c.monto; x.pend = c.monto > 0 ? Math.min(hueco, rd) / c.monto : 0; rd = Math.max(0, rd - hueco);
     x.acunada = x.lleno >= 1 - 1e-9;
     finAcum += c.monto;
     if (x.acunada) { acunadas++; var s = 0; for (var j = 0; j < orden.length; j++) { s += orden[j].monto; if (s >= finAcum - 0.5) { x.fecha = orden[j].fecha; break; } } }
     else if (actual < 0) actual = i;
    }
    x.estado = c.estado !== "activa" ? c.estado : x.acunada ? "acunada" : x.lleno > 0 || x.pend > 0 || i === actual ? "en-curso" : "futura";
    cas.push(x);
   });
   var activas = cas.filter(function (x) { return x.guardado === "activa"; });
   var falta = Math.max(0, persona.parte - Math.max(0, ver));
   return { p: p, casitas: cas, actual: actual, acunadas: acunadas, verificado: Math.max(0, ver), declarado: dec, parte: persona.parte, falta: falta,
    pct: persona.parte > 0 ? Math.min(1, Math.max(0, ver) / persona.parte) : 0,
    faltaCasita: actual >= 0 ? Math.round((1 - cas[actual].lleno) * cas[actual].monto) : 0,
    meses: persona.plan > 0 ? Math.ceil(falta / persona.plan) : Infinity, activas: activas.length };
  }
  function unidades(v) { return v.acunadas + (v.actual >= 0 ? v.casitas[v.actual].lleno : 0); }

  function juntos(cfg, aportes) {
   var dos = hayDos(cfg), a = viaje(cfg.personas.p1, aportes, "p1"), b = dos ? viaje(cfg.personas.p2, aportes, "p2") : null, total = a.verificado + (b ? b.verificado : 0);
   return { p1: a, p2: b, dos: dos, total: total, declarado: a.declarado + (b ? b.declarado : 0), pct: Math.min(1, total / cfg.pie), plan: (cfg.personas.p1.plan || 0) + (b ? cfg.personas.p2.plan || 0 : 0) };
  }

  /* ---------- Vínculo e invitación (3.8) ----------
   cfg.vinculo = { tipo: "solo" | "familiar" | "pareja", estado: "ninguno" | "pendiente" | "aceptada" | "rechazada" | "salida",
           de: "p1", inv: { via: "rut" | "codigo", rut (enmascarado), codigo, t, vence (48 h) } }
   "vencida" se deriva de la fecha. Nada se comparte hasta que la otra persona acepta; al salir, cada uno conserva lo suyo. */
  var VINCULOS = {
   solo: { corto: "Solo", nombre: "Solo", regla: "Titular con su renta actual." },
   familiar: { corto: "Con familiar", nombre: "Familiar directo", largo: "Con un familiar directo", sub: "Como codeudor relacionado", regla: "Codeudor relacionado: titular desde 23 UF y codeudor desde 16 UF." },
   pareja: { corto: "Con pareja", nombre: "Pareja sin vínculo legal", largo: "Con su pareja, sin vínculo legal", sub: "También sin vínculo legal", regla: "Codeudor no relacionado: titular desde 50 UF y renta conjunta desde 70 UF." }
  };
  var H48 = 48 * 3600 * 1000;
  function clon(x) { return JSON.parse(JSON.stringify(x)); }
  function estadoVinculo(cfg, ahora) {
   var v = cfg.vinculo || (cfg.personas.p2 ? { estado: "aceptada" } : { estado: "ninguno" });
   if (v.estado === "pendiente" && v.inv && Date.parse(v.inv.vence) < (ahora || Date.now())) return "vencida";
   return v.estado || "ninguno";
  }
  function hayDos(cfg) { return !!cfg.personas.p2 && estadoVinculo(cfg) === "aceptada"; }
  function tipoVinculo(cfg) { return (cfg.vinculo && cfg.vinculo.tipo) || (cfg.personas.p2 ? "pareja" : "solo"); }
  function invitar(cfg, op, ahora) {
   var c = clon(cfg), t = ahora || Date.now();
   c.vinculo = { tipo: op.tipo, estado: "pendiente", de: "p1", inv: { via: op.via, rut: op.rut || null, codigo: op.codigo, t: new Date(t).toISOString(), vence: new Date(t + H48).toISOString() } };
   return c;
  }
  function aceptar(cfg, aportes, nueva, ahora) {
   var c = clon(cfg), P1 = c.personas.p1;
   if (!c.personas.p2) {
    var v1 = viaje(P1, aportes, "p1"), fijas = P1.casitas.filter(function (x, k) { return x.estado === "activa" && fija(v1, k); }).reduce(function (s, x) { return s + x.monto; }, 0);
    P1.parte = Math.max(reparto(c.pie, { p1: P1.ingreso, p2: nueva.ingreso }).p1, fijas); P1.casitas = redistribuir(P1, aportes, "p1");
    var parte2 = c.pie - P1.parte, plan2 = nueva.plan || Math.max(0, nueva.capacidad || 0);
    c.personas.p2 = { nombre: nueva.nombre, ingreso: nueva.ingreso, gastos: nueva.gastos || 0, capacidad: nueva.capacidad || 0, plan: plan2, parte: parte2, forma: "adaptativo", plazoDeseado: null, automatico: false, casitas: casitasNuevas(parte2, "adaptativo", plan2) };
   }
   c.vinculo = c.vinculo || { tipo: "pareja", de: "p1" };
   c.vinculo.estado = "aceptada"; c.vinculo.aceptada = new Date(ahora || Date.now()).toISOString(); delete c.vinculo.inv;
   return c;
  }
  function rechazar(cfg) { var c = clon(cfg); if (c.vinculo) c.vinculo.estado = "rechazada"; return c; }
  function cancelarInvitacion(cfg) { var c = clon(cfg); if (c.vinculo) { c.vinculo.estado = c.personas.p2 ? "salida" : "ninguno"; delete c.vinculo.inv; } return c; }
  function salir(cfg) { var c = clon(cfg); c.vinculo = c.vinculo || { tipo: "pareja" }; c.vinculo.estado = "salida"; return c; }

  /* Ajustar el camino: redistribuye solo las casitas activas que aún no empiezan; las acuñadas y la que está en curso
   conservan su monto (así ninguna casita queda más chica que lo ya ahorrado en ella). */
  function fija(v, i) { return v.casitas[i].acunada || v.casitas[i].lleno > 0; }
  function redistribuir(persona, aportes, p, forma, plan) {
   var v = viaje(persona, aportes, p), fijas = 0, libres = [];
   persona.casitas.forEach(function (c, i) { if (c.estado !== "activa" || fija(v, i)) { if (c.estado === "activa") fijas += c.monto; } else libres.push(i); });
   var T = persona.parte - fijas, nuevos = tamanos(T, libres.length, forma || persona.forma, plan || persona.plan);
   var casitas = persona.casitas.map(function (c) { return { n: c.n, monto: c.monto, estado: c.estado }; });
   libres.forEach(function (i, j) { casitas[i].monto = nuevos[j]; });
   return casitas;
  }
  function libresAjuste(v) { return v.casitas.filter(function (x, i) { return x.guardado === "activa" && !fija(v, i); }).map(function (x) { return x.i; }); }

  /* Propuesta de fin de mes: compara lo verificado del mes (aportes reales, no saldo inicial ni movimientos internos) con el plan.
   Ronda 18: "menos" si el mes queda bajo el 80 % del plan (con $500.000 de $600.000 no hay propuesta). */
  function aportadoMes(aportes, p, ref) {
   var d = ref ? new Date(ref) : new Date(), k = d.getFullYear() * 12 + d.getMonth();
   return aportesDe(aportes, p).filter(function (a) { var f = new Date(a.fecha); return a.estado === "verificado" && (a.origen === "cuenta-bci" || a.origen === "otra") && f.getFullYear() * 12 + f.getMonth() === k; })
    .reduce(function (s, a) { return s + a.monto; }, 0);
  }
  function proponer(persona, aportes, p, ref) {
   var mes = aportadoMes(aportes, p, ref), plan = persona.plan || 0;
   if (plan <= 0) return null;
   if (mes > plan * 1.15) return { p: p, tipo: "mas", mes: mes, antes: plan, plan: r10k(mes) };
   if (mes < plan * 0.8) return { p: p, tipo: "menos", mes: mes, antes: plan, plan: Math.max(50000, r10k(Math.max(mes, plan * 0.75))) };
   return null;
  }
  function simularPropuesta(persona, aportes, p, plan, forma) {
   var v = viaje(persona, aportes, p), nuevas = redistribuir(persona, aportes, p, forma || "adaptativo", plan);
   var libres = libresAjuste(v);
   return { antes: libres.map(function (i) { return persona.casitas[i].monto; }), despues: libres.map(function (i) { return nuevas[i].monto; }), casitas: nuevas,
    ns: libres.map(function (i) { return persona.casitas[i].n; }), mesesAntes: persona.plan > 0 ? Math.ceil(v.falta / persona.plan) : Infinity, mesesDespues: plan > 0 ? Math.ceil(v.falta / plan) : Infinity, acunadas: v.acunadas };
  }

  /* Premios (concepto): escalera con estado Logrado / Próximo / Bloqueado. Ronda 18: sobre la parte verificada de cada persona. */
  var PREMIOS = [
   { id: "primera", titulo: "Primera casita", corto: "1.ª", txt: "Sello Bci y sin cobro de apertura de la cuenta." },
   { id: "cuarto", titulo: "Un cuarto del pie", corto: "¼", f: 0.25, txt: "Bono por casita." },
   { id: "mitad", titulo: "La mitad del pie", corto: "½", f: 0.5, txt: "Tasa hipotecaria preferente desbloqueada y ejecutivo dedicado." },
   { id: "tres", titulo: "Tres cuartos del pie", corto: "¾", f: 0.75, txt: "Prioridad de atención por constancia y material nuevo en la casita." },
   { id: "meta", titulo: "Meta", corto: "Meta", f: 1, txt: "Bono final y ficha con la trayectoria completa. Condiciones preferentes en tasación y gastos." }
  ];
  function casitaDelHito(v, f) {
   var s = 0, obj = v.parte * f - 0.5;
   for (var i = 0; i < v.casitas.length; i++) { if (v.casitas[i].guardado !== "activa") continue; s += v.casitas[i].monto; if (s >= obj) return i; }
   return v.casitas.length - 1;
  }
  function premios(cfg, aportes, p) {
   var out = [], proximo = false, v = p ? viaje(cfg.personas[p], aportes, p) : null, j = p ? null : juntos(cfg, aportes);
   var base = p ? v.parte : cfg.pie, hecho = p ? v.verificado : j.total;
   PREMIOS.forEach(function (pr) {
    var logrado, falta, meta;
    if (pr.id === "primera") {
     if (p) { logrado = v.acunadas > 0; meta = v.casitas[0].monto; falta = logrado ? 0 : v.faltaCasita; }
     else { logrado = j.p1.acunadas + j.p2.acunadas > 0; meta = 0; falta = Math.min(j.p1.faltaCasita || Infinity, j.p2.faltaCasita || Infinity); }
    } else { meta = base * pr.f; logrado = hecho >= meta - 0.5; falta = Math.max(0, Math.ceil(meta - hecho)); }
    var est = logrado ? "logrado" : !proximo ? "proximo" : "bloqueado";
    if (est === "proximo") proximo = true;
    out.push({ id: pr.id, titulo: pr.titulo, corto: pr.corto, txt: pr.txt, f: pr.f || 0, estado: est, falta: logrado ? 0 : falta, meta: meta, casita: p && pr.f ? casitaDelHito(v, pr.f) : 0 });
   });
   return out;
  }
  function constancia(aportes, ref, p) {
   var d = ref ? new Date(ref) : new Date(), k = d.getFullYear() * 12 + d.getMonth(), meses = {};
   aportes.forEach(function (a) { if ((!p || a.de === p) && a.estado === "verificado" && (a.origen === "cuenta-bci" || a.origen === "otra")) { var f = new Date(a.fecha); meses[f.getFullYear() * 12 + f.getMonth()] = 1; } });
   var n = 0, i = meses[k] ? k : k - 1, primero = k;
   while (meses[i]) { n++; primero = i; i--; }
   var ini = Math.max(primero, k - 5), anios = Math.floor(ini / 12) !== Math.floor((ini + 5) / 12), ult = [];
   for (var q = 0; q < 6; q++) {
    var m = ini + q, mes = m % 12, anio = Math.floor(m / 12), ok = !!meses[m], actual = m === k, futuro = m > k;
    var et = actual ? "Este mes" : MES_CORTO[mes] + (anios && mes === 0 ? " ’" + String(anio).slice(-2) : "");
    var nombreMes = MES_LARGO[mes] + (anios && mes === 0 ? " de " + anio : "");
    var aria = nombreMes + (actual ? ", este mes, " + (ok ? "con aporte verificado" : "sin aporte todavía") : futuro ? ", mes futuro" : ", con aporte verificado");
    ult.push({ k: m, ok: ok, actual: actual, futuro: futuro, et: et, aria: aria });
   }
   return { meses: n, esteMes: !!meses[k], ultimos: ult };
  }
  var MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  var MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  /* Configuración v2 a partir de los datos del alta. */
  function crearConfig(d) {
   var rep = d.reparto || (d.p2 ? reparto(d.pie || PIE, { p1: d.p1.ingreso, p2: d.p2.ingreso }) : { p1: d.pie || PIE, p2: 0 });
   var cfg = { v: V, pie: d.pie || PIE, personas: {}, solicitudes: [], propuestas: {}, cambios: [], vinculo: d.vinculo || { tipo: d.p2 ? "pareja" : "solo", estado: d.p2 ? "aceptada" : "ninguno", de: "p1" } };
   if (!d.p2) cfg.personas.p2 = null;
   ["p1", "p2"].forEach(function (p) {
    if (!d[p]) return;
    var x = d[p], plan = x.plan ? x.plan : d.plazo ? Math.max(50000, r10k(Math.max(0, rep[p] - (x.ahorro || 0)) / d.plazo)) : Math.max(0, x.capacidad);
    cfg.personas[p] = { nombre: x.nombre, ingreso: x.ingreso, gastos: x.gastos || 0, capacidad: Math.max(0, x.capacidad), plan: plan, parte: rep[p],
     forma: "adaptativo", plazoDeseado: d.plazo || null, automatico: false, casitas: casitasNuevas(rep[p], "adaptativo", plan) };
    if (x.extra) Object.keys(x.extra).forEach(function (k) { cfg.personas[p][k] = x.extra[k]; });
   });
   return cfg;
  }

  /* ---------- Escenarios (fórmulas del caso, sin cambios) ----------
   Vivienda 4.900 UF, UF $41.157,43 (SII 14-10-2026), tasa de referencia 4,0 %, 25 años, renta >= 4 x dividendo. */
  var UF = 41157.43;
  var CASO = { precio: 4900 * UF, tasaMes: 0.04 / 12, plazo: 300, rentaTitular: 1700000, caminos: { solo: 0, familiar: 1200000, pareja: 1300000 } };
  var FACTOR = CASO.tasaMes / (1 - Math.pow(1 + CASO.tasaMes, -CASO.plazo));
  function rentaPedida(pieAhorrado) { return 4 * FACTOR * Math.max(0, CASO.precio - pieAhorrado); }
  function pieNecesario(extra) { return Math.max(0, CASO.precio - (CASO.rentaTitular + extra) / (4 * FACTOR)); }
  function mesesCamino(camino, ahorrado, aporte) { var f = Math.max(0, pieNecesario(CASO.caminos[camino]) - ahorrado); return aporte > 0 ? Math.ceil(f / aporte) : Infinity; }
  function bajaPorCasita(monto) { return 4 * FACTOR * monto; }

  /* ================= Dibujos (SVG en texto) ================= */
  var COL = { azul: "#2772CC", azulOsc: "#1D5699", verde: "#28892B", verdeOsc: "#28652B", amarillo: "#FFE300", amarilloOsc: "#C9A800", amarilloTxt: "#6B5D00",
   tinta: "#2C3A41", gris: "#546E7A", grisDeco: "#8FA3BC", linea: "#B7C6DA", pista: "#DCE5F1", fantasma: "#EDF2F9", borde: "#C9D8EC" };
  var MATERIAL = { madera: { nombre: "Madera", c: "#EBC796" }, ladrillo: { nombre: "Ladrillo", c: "#E59C7D" }, hormigon: { nombre: "Hormigón", c: "#B9C5D6" }, teja: { nombre: "Teja", c: "#2772CC" } };
  function material(n) { return n <= 3 ? "madera" : n <= 6 ? "ladrillo" : n <= 8 ? "hormigon" : "teja"; }
  function tono(hex, k) {
   var c = [1, 3, 5].map(function (i) { return Math.max(0, Math.min(255, Math.round(parseInt(hex.substr(i, 2), 16) * k))); });
   return "#" + c.map(function (v) { return ("0" + v.toString(16)).slice(-2); }).join("").toUpperCase();
  }
  function e(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function f1(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function dos(n) { return (n < 10 ? "0" : "") + n; }
  var CHECK = "M-3.6 0.2 L-1 2.8 L3.8 -2.4";

  /* Casita (1.3): techo + barra. estado: "lograda" | "curso" | "futura"; progreso 0..1; opciones.ajuste (contorno punteado). */
  function casita(estado, progreso, ancho, opciones) {
   opciones = opciones || {}; ancho = ancho || 30;
   var techo = estado === "futura" ? COL.linea : COL.azulOsc, alto = Math.round(ancho * 117 / 144 * 10) / 10, relleno = "";
   if (estado === "lograda") relleno = '<rect x="8" y="74" width="111" height="26" rx="13" fill="' + COL.verde + '"/>';
   else if (estado === "curso") relleno = '<rect class="cs-barra" x="8" y="74" width="' + f1(Math.max(26, 111 * lim(progreso || 0, 0, 1))) + '" height="26" rx="13" fill="' + COL.amarillo + '"/>';
   return '<svg class="casita cs-' + estado + (opciones.clase ? " " + opciones.clase : "") + '" viewBox="-8.5 -8.5 144 117" width="' + ancho + '" height="' + alto + '" aria-hidden="true" focusable="false">' +
    '<path d="M0 51 L63.5 0 L127 51" fill="none" stroke="' + techo + '" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<rect x="8" y="74" width="111" height="26" rx="13" fill="' + COL.pista + '"/>' + relleno +
    (opciones.ajuste ? '<rect x="2" y="68" width="123" height="38" rx="19" fill="none" stroke="' + COL.amarilloOsc + '" stroke-width="5" stroke-dasharray="9 8"/>' : "") + "</svg>";
  }
  /* Casita de dos líneas (ronda 19): mismo techo; barra de arriba = la propia persona, barra de abajo = la otra persona
   vinculada (relleno y borde del color de su avatar). propia/otra = { estado: "lograda" | "curso" | "futura", progreso }; otra.p = "p1" | "p2". */
  var COLOR_PERSONA = { p1: { c: "#1D5699", b: "#12365F" }, p2: { c: "#8DB8EE", b: "#4F86C6" } };
  function conAvance(x) { return x.estado === "lograda" || x.estado === "curso" || (x.progreso || 0) > 0; }
  function casita2(propia, otra, ancho, opciones) {
   opciones = opciones || {}; ancho = ancho || 30;
   var techo = conAvance(propia) || conAvance(otra) ? COL.azulOsc : COL.linea, alto = Math.round(ancho * 129 / 144 * 10) / 10, col = COLOR_PERSONA[otra.p] || COLOR_PERSONA.p2, s = "";
   s += '<rect x="8" y="66" width="111" height="20" rx="10" fill="' + COL.pista + '"/>';
   if (propia.estado === "lograda") s += '<rect class="cs-propia" x="8" y="66" width="111" height="20" rx="10" fill="' + COL.verde + '"/>';
   else if (propia.estado === "curso") s += '<rect class="cs-propia" x="8" y="66" width="' + f1(Math.max(20, 111 * lim(propia.progreso || 0, 0, 1))) + '" height="20" rx="10" fill="' + COL.amarillo + '"/>';
   s += '<rect x="8" y="92" width="111" height="20" rx="10" fill="' + COL.pista + '"/>';
   var wo = otra.estado === "lograda" ? 111 : (otra.estado === "curso" || (otra.progreso || 0) > 0) ? Math.max(20, 111 * lim(otra.progreso || 0, 0, 1)) : 0;
   if (wo) s += '<rect class="cs-otra" x="10" y="94" width="' + f1(wo - 4) + '" height="16" rx="8" fill="' + col.c + '" stroke="' + col.b + '" stroke-width="4"/>';
   return '<svg class="casita cs2 cs-' + propia.estado + (opciones.clase ? " " + opciones.clase : "") + '" viewBox="-8.5 -8.5 144 129" width="' + ancho + '" height="' + alto + '" aria-hidden="true" focusable="false">' +
    '<path d="M0 51 L63.5 0 L127 51" fill="none" stroke="' + techo + '" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>' + s +
    (opciones.ajuste ? '<rect x="2" y="60" width="123" height="58" rx="18" fill="none" stroke="' + COL.amarilloOsc + '" stroke-width="5" stroke-dasharray="9 8"/>' : "") + "</svg>";
  }
  function estadoOtra(x) { return { estado: x.estado === "acunada" ? "lograda" : x.lleno > 0 ? "curso" : "futura", progreso: x.estado === "acunada" ? 1 : x.lleno }; }
  function estadoCasita(x) { return x.estado === "acunada" ? "lograda" : x.estado === "en-curso" ? "curso" : "futura"; }

  /* ---------- Casa isométrica (3.2) ----------
   Proyección dos a uno: dx 22, dy 11, dz 22 px por unidad. Casa de 7,2 × 3,8 unidades.
   Zonas: 1–2 losa; 3–5 planta baja (3 con puerta, 4 y 5 con ventanas); 6–8 planta alta; 9–10 techo (10 con el hastial). */
  var ZONAS = [
   { piezas: [0, 1], x0: -0.3, x1: 7.5, y0: -0.3, y1: 4.1, z0: 0, z1: 0.75, losa: true },
   { piezas: [2, 3, 4], x0: 0, x1: 7.2, y0: 0, y1: 3.8, z0: 0.75, z1: 2.25 },
   { piezas: [5, 6, 7], x0: 0, x1: 7.2, y0: 0, y1: 3.8, z0: 2.25, z1: 3.75 },
   { piezas: [8, 9], x0: -0.3, x1: 7.5, techo: true }
  ];
  var TECHO = { ye: 4.15, ze: 3.6, yr: 1.9, zr: 5.85, yb: -0.35 };
  function rangosX(montos) {
   var r = [], MIN = 1.3;
   ZONAS.forEach(function (z) {
    var W = z.x1 - z.x0, tot = z.piezas.reduce(function (s, i) { return s + Math.max(1, montos[i] || 1); }, 0);
    var w = z.piezas.map(function (i) { return W * Math.max(1, montos[i] || 1) / tot; });
    var chicas = w.filter(function (x) { return x < MIN; }).length;
    if (chicas && chicas < w.length) {
     var resto = W - chicas * MIN, grandes = w.reduce(function (s, x) { return x >= MIN ? s + x : s; }, 0);
     w = w.map(function (x) { return x < MIN ? MIN : x * resto / grandes; });
    }
    var x = z.x0;
    z.piezas.forEach(function (i, k) { r[i] = { a: x, b: k === z.piezas.length - 1 ? z.x1 : x + w[k], z: z }; x += w[k]; });
   });
   return r;
  }
  function proy(cx, cy) { return function (x, y, z) { return [cx + (x - y) * 22, cy + (x + y) * 11 - z * 22]; }; }
  function pts(P, l) { return l.map(function (q) { var s = P(q[0], q[1], q[2]); return f1(s[0]) + "," + f1(s[1]); }).join(" "); }

  function caras(rg, a, b, h, ultima) {
   var z = rg.z, out = [];
   if (z.techo) {
    var T = TECHO, ye = T.ye, ze = T.ze, yt = T.ye + (T.yr - T.ye) * h, zt = T.ze + (T.zr - T.ze) * h;
    out.push({ k: "frente", p: [[a, ye, ze], [b, ye, ze], [b, yt, zt], [a, yt, zt]] });
    if (ultima && h >= 1) out.push({ k: "lado", p: [[7.2, 0, 3.75], [7.2, 3.8, 3.75], [7.2, T.yr, T.zr - 0.25]] });
    return out;
   }
   var z1 = z.z0 + (z.z1 - z.z0) * h;
   out.push({ k: "frente", p: [[a, z.y1, z.z0], [b, z.y1, z.z0], [b, z.y1, z1], [a, z.y1, z1]] });
   if (ultima) out.push({ k: "lado", p: [[b, z.y0, z.z0], [b, z.y1, z.z0], [b, z.y1, z1], [b, z.y0, z1]] });
   if (z.losa && h >= 1) out.push({ k: "arriba", p: [[a, z.y0, z1], [b, z.y0, z1], [b, z.y1, z1], [a, z.y1, z1]] });
   return out;
  }
  function pintarCaras(P, lista, colores, trazo) {
   return lista.map(function (c) { return '<polygon points="' + pts(P, c.p) + '" fill="' + colores[c.k] + '"' + trazo + "/>"; }).join("");
  }
  function detalles(P, i, a, b, rg, encendidas) {
   var z = rg.z, y = z.y1 + 0.01, out = "", ven = encendidas ? "#FFF3A6" : "#CFE3F7";
   function rect(x0, x1, za, zb, fill, cls) { return '<polygon class="' + (cls || "") + '" points="' + pts(P, [[x0, y, za], [x1, y, za], [x1, y, zb], [x0, y, zb]]) + '" fill="' + fill + '" stroke="#FFFFFF" stroke-width="1.5"/>'; }
   var m = (a + b) / 2;
   if (i === 2) out += rect(Math.max(a + 0.3, m - 0.35), Math.max(a + 0.3, m - 0.35) + 0.7, z.z0, z.z0 + 1.1, "#8A5A35");
   else if (i === 3 || i === 4 || (i >= 5 && i <= 7)) out += rect(m - 0.4, m + 0.4, z.z0 + 0.45, z.z0 + 1.1, ven, "pz-ventana");
   return out;
  }

  /* datos = { casitas: [{ n, monto, estado, lleno, pend }], actual, inicial, pie, puestas, premios: [{ id, corto, estado, casita }],
        juntos: { p1: viaje, p2: viaje, ini: ["T","P"] } }
   modo: "mio" | "juntos" | "ajuste"; opciones = { ancho, ajuste: [índices] } */
  function dibujarMapa(modo, d, op) {
   op = op || {};
   var W = op.ancho || 390, S = lim(op.escala || 1, 0.5, 1), fs = function (px) { return f1(px / S); };
   var cyCasa = 200, cx = Math.round(W / 2 - (3.6 - 1.9) * 22), P = proy(cx, cyCasa);
   var cas = d.casitas, montos = cas.map(function (x) { return x.monto; }), rg = rangosX(montos), ajuste = op.ajuste || [];
   var y0v = op.sinTitulo ? 84 : 0, Hv = 384 - y0v, Wv = W / S, x0v = -(Wv - W) / 2;
   var s = '<svg class="mapa-svg" viewBox="' + f1(x0v) + " " + y0v + " " + f1(Wv) + " " + Hv + '" width="' + W + '" height="' + Math.round(Hv * S) + '" role="group" aria-label="' + e(op.etiqueta || "Casa en construcción") + '">';
   var L = { x0: -1.6, x1: 8.6, y0: -1.2, y1: 7.0 }, esp = 0.4;
   s += '<g class="mapa-suelo" aria-hidden="true">';
   s += '<polygon points="' + pts(P, [[L.x0, L.y1, 0], [L.x1, L.y1, 0], [L.x1, L.y1, -esp], [L.x0, L.y1, -esp]]) + '" fill="#B9D0AB"/>';
   s += '<polygon points="' + pts(P, [[L.x1, L.y0, 0], [L.x1, L.y1, 0], [L.x1, L.y1, -esp], [L.x1, L.y0, -esp]]) + '" fill="#A9C39A"/>';
   s += '<polygon points="' + pts(P, [[L.x0, L.y0, 0], [L.x1, L.y0, 0], [L.x1, L.y1, 0], [L.x0, L.y1, 0]]) + '" fill="#DDEBD3"/>';
   s += '<polygon points="' + pts(P, [[0.9, 4.1, 0.01], [1.9, 4.1, 0.01], [1.9, L.y1, 0.01], [0.9, L.y1, 0.01]]) + '" fill="#F3E9D2"/>';
   [[8.3, -0.4], [-1.0, 0.2], [8.3, 6.5]].forEach(function (t) {
    var b = P(t[0], t[1], 0), c = P(t[0], t[1], 1.25);
    s += '<line x1="' + f1(b[0]) + '" y1="' + f1(b[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(c[1] + 6) + '" stroke="#8A6A4A" stroke-width="3" stroke-linecap="round"/>' +
     '<circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="10" fill="#7DB36B"/><circle cx="' + f1(c[0] - 3) + '" cy="' + f1(c[1] - 3) + '" r="5" fill="#9CCB89"/>';
   });
   s += "</g>";
   var numeros = "", sellos = "", pin = "", cajasNum = [], cajaDe = {}, hitos = {};
   (d.premios || []).forEach(function (p) { hitos[Math.min(p.casita, cas.length - 1)] = 1; });
   function pieza(i, a, b, x, pers, idx) {
    var z = rg[i].z, ult = b >= z.x1 - 1e-6, mat = MATERIAL[material(x.n)].c, est = x.estado, html = "";
    if (op.colores && pers) mat = COLOR_PERSONA[pers].c;
    var colMat = { frente: mat, lado: tono(mat, 0.84), arriba: tono(mat, 1.07) };
    var colFan = { frente: COL.fantasma, lado: "#E1E8F2", arriba: "#F5F8FC" };
    var enAjuste = modo === "ajuste" && ajuste.indexOf(i) >= 0;
    if (est === "acunada") {
     html += pintarCaras(P, caras(rg[i], a, b, 1, ult), colMat, ' stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round"');
     if (!z.techo && !z.losa) html += detalles(P, i, a, b, rg[i], false);
    } else {
     var trazo = enAjuste ? ' stroke="' + COL.amarilloOsc + '" stroke-width="2" stroke-dasharray="6 4"' : est === "en-curso" ? ' stroke="' + COL.azul + '" stroke-width="1.5" stroke-dasharray="4 3"' : ' stroke="' + COL.linea + '" stroke-width="1.2" stroke-dasharray="4 3"';
     html += pintarCaras(P, caras(rg[i], a, b, 1, ult), colFan, trazo + ' stroke-linejoin="round"');
     if (op.colores && x.pend > 0) html += '<g class="pz-dec">' + pintarCaras(P, caras(rg[i], a, b, lim(x.lleno + x.pend, 0.04, 1), ult).filter(function (c) { return c.k !== "arriba"; }), { frente: COL.amarillo, lado: tono(COL.amarillo, 0.88), arriba: COL.amarillo }, ' stroke="none"') + "</g>";
     if (est === "en-curso" && x.lleno > 0) {
      var h = lim(x.lleno, 0.04, 1);
      html += '<g class="pz-relleno">' + pintarCaras(P, caras(rg[i], a, b, h, ult).filter(function (c) { return c.k !== "arriba"; }), colMat, ' stroke="none"') + "</g>";
     }
     if (est === "en-curso") {
      var hh = lim(x.lleno, 0, 1), l1, l2;
      if (z.techo) { var yt = TECHO.ye + (TECHO.yr - TECHO.ye) * hh, zt = TECHO.ze + (TECHO.zr - TECHO.ze) * hh; l1 = P(a, yt, zt); l2 = P(b, yt, zt); }
      else { var zl = z.z0 + (z.z1 - z.z0) * hh; l1 = P(a, z.y1, zl); l2 = P(b, z.y1, zl); }
      html += '<line class="pz-nivel" x1="' + f1(l1[0]) + '" y1="' + f1(l1[1]) + '" x2="' + f1(l2[0]) + '" y2="' + f1(l2[1]) + '" stroke="' + COL.amarillo + '" stroke-width="2.6" stroke-dasharray="6 4"/>';
      if (modo !== "juntos" && !op.pinInsignia) {
       var px = Math.max(16, Math.min(l1[0], cx - 96) - 30);
       var pr2 = Math.max(14, 11 / S);
       pin = '<g class="mapa-pin" aria-hidden="true"><line x1="' + f1(px + pr2) + '" y1="' + f1(l1[1]) + '" x2="' + f1(l1[0] + 12) + '" y2="' + f1(l1[1]) + '" stroke="' + COL.amarillo + '" stroke-width="2.6"/>' +
        '<circle cx="' + f1(px) + '" cy="' + f1(l1[1]) + '" r="' + f1(pr2) + '" fill="' + COL.amarillo + '" stroke="#FFFFFF" stroke-width="2"/><text x="' + f1(px) + '" y="' + f1(l1[1] + 4.5 / S) + '" text-anchor="middle" font-size="' + fs(13) + '" font-weight="800" fill="' + COL.tinta + '">' + e(d.inicial || "") + "</text></g>";
      }
     }
    }
    var cent = z.techo ? P(a + 0.35, TECHO.ye - 0.9, TECHO.ze + 0.92) : P(a + 0.2, z.y1, z.z1 - (z.losa ? 0.14 : 0.42));
    var colNum = est === "acunada" ? (material(x.n) === "teja" ? "#FFFFFF" : COL.tinta) : est === "en-curso" ? COL.azulOsc : COL.gris;
    if ((pers == null || pers === "p1") && !op.sinNumeros && (!op.soloHitos || hitos[i])) cajasNum.push(cajaDe[i] = [cent[0] + (z.losa ? 4 : 2), cent[1] + (z.losa ? 2 : 4) - 10 / S, cent[0] + (z.losa ? 4 : 2) + 16 / S, cent[1] + (z.losa ? 2 : 4) + 1 / S]);
    if ((pers == null || pers === "p1") && !op.sinNumeros && (!op.soloHitos || hitos[i])) numeros += '<text class="pz-num" x="' + f1(cent[0] + (z.losa ? 4 : 2)) + '" y="' + f1(cent[1] + (z.losa ? 2 : 4)) + '" font-size="' + fs(12) + '" font-weight="800" fill="' + colNum + '">' + dos(x.n) + "</text>";
    if (est === "acunada" && !pers) {
     var sc = z.techo ? P(b - 0.3, TECHO.ye - 0.35, TECHO.ze + 0.36) : P(b, z.y1, z.losa ? (z.z0 + z.z1) / 2 : z.z1);
     var sx = sc[0] - (z.losa ? 10 : 11), sy = sc[1] + (z.losa ? -1 : 11);
     sellos += '<g class="pz-sello" data-i="' + i + '" style="--k:' + idx + '" aria-hidden="true"><circle cx="' + f1(sx) + '" cy="' + f1(sy) + '" r="8.5" fill="' + COL.verde + '" stroke="#FFFFFF" stroke-width="1.5"/>' +
      '<path d="' + CHECK + '" transform="translate(' + f1(sx) + " " + f1(sy) + ')" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>';
    }
    return html;
   }
   var orden = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(function (i) { return i < cas.length; });
   var k = 0;
   orden.forEach(function (i) {
    var x = cas[i], r = rg[i], est = x.estado === "acunada" ? "lograda" : x.estado === "en-curso" ? "en curso" : "por construir";
    var lab = "Casita " + x.n + ", " + MATERIAL[material(x.n)].nombre + ", " + millones(x.monto).replace("$", "") + ", " + est + (x.estado === "en-curso" ? ", " + pct(x.lleno) : "") + (x.estado === "acunada" ? ", verificada por Bci" : "");
    s += '<g class="pieza pz-' + (x.estado === "acunada" ? "hecha" : x.estado === "en-curso" ? "curso" : "futura") + '" role="button" tabindex="0" data-i="' + i + '" style="--k:' + k + '" aria-label="' + e(lab) + '">';
    if (modo === "juntos" && d.juntos) {
     var m = (r.a + r.b) / 2, A = d.juntos.p1.casitas[i], B = d.juntos.p2.casitas[i];
     s += pieza(i, r.a, m, A, "p1", k) + pieza(i, m, r.b, B, "p2", k);
    } else s += pieza(i, r.a, r.b, x, null, k);
    s += "</g>"; k++;
   });
   s += '<g class="mapa-detalles" aria-hidden="true">' + numeros + "</g>" + sellos;
   if (modo === "juntos" && d.juntos) {
    ["p1", "p2"].forEach(function (q, n) {
     var v = d.juntos[q]; if (v.actual < 0) return;
     var r = rg[v.actual], m = (r.a + r.b) / 2, xa = n === 0 ? (r.a + m) / 2 : (m + r.b) / 2, c;
     c = r.z.techo ? P(xa, TECHO.ye - 1.1, TECHO.ze + 1.12) : P(xa, r.z.y1, (r.z.z0 + r.z.z1) / 2);
     s += '<g class="mapa-tp" aria-hidden="true"><circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + f1(Math.max(11, 10 / S)) + '" fill="' + (n === 0 ? COL.azulOsc : "#8DB8EE") + '" stroke="#FFFFFF" stroke-width="2"/>' +
      '<text x="' + f1(c[0]) + '" y="' + f1(c[1] + 4.2 / S) + '" text-anchor="middle" font-size="' + fs(12) + '" font-weight="800" fill="' + (n === 0 ? "#FFFFFF" : "#163F70") + '">' + e(d.juntos.ini[n]) + "</text></g>";
    });
   }
   var postes = (d.premios || []).filter(function (p) { return p.f > 0 && p.f < 1; });
   var xMin = 6.2 + (x0v + 6 + 20 - cx) / 22, xMax = 8.0;
   var xs = postes.map(function (p) { var r = rg[Math.min(p.casita, cas.length - 1)]; return lim((r.a + r.b) / 2 + 1.0, xMin, xMax); });
   var ordenX = xs.map(function (x, i) { return i; }).sort(function (a, b) { return xs[a] - xs[b]; });
   for (var q = 1; q < ordenX.length; q++) if (xs[ordenX[q]] - xs[ordenX[q - 1]] < 2.4) xs[ordenX[q]] = xs[ordenX[q - 1]] + 2.4;
   var corr = ordenX.length ? Math.max(0, xs[ordenX[ordenX.length - 1]] - xMax) : 0; if (corr) xs = xs.map(function (x) { return Math.max(xMin, x - corr); });
   postes.forEach(function (p, i) {
    var base = P(xs[i], 6.2, 0), top = P(xs[i], 6.2, 1.2), rm = Math.max(14, 11 / S), col = p.estado === "logrado" ? COL.verdeOsc : p.estado === "proximo" ? COL.amarillo : "#FFFFFF";
    var txt = p.estado === "logrado" ? "#FFFFFF" : p.estado === "proximo" ? COL.tinta : COL.gris;
    s += '<g class="medalla md-' + p.estado + '" role="button" tabindex="0" data-premio="' + p.id + '" aria-label="' + e("Premio " + p.corto + " del pie: " + (p.estado === "logrado" ? "logrado" : p.estado === "proximo" ? "próximo" : "por venir")) + '">' +
     '<line x1="' + f1(base[0]) + '" y1="' + f1(base[1]) + '" x2="' + f1(top[0]) + '" y2="' + f1(top[1]) + '" stroke="#8FA3BC" stroke-width="3" stroke-linecap="round"/>' +
     '<ellipse cx="' + f1(base[0]) + '" cy="' + f1(base[1]) + '" rx="7" ry="3" fill="#B9D0AB"/>' +
     '<circle cx="' + f1(top[0]) + '" cy="' + f1(top[1]) + '" r="' + f1(22 / S) + '" fill="transparent"/>' +
     (p.estado === "proximo" ? '<circle class="md-aro" cx="' + f1(top[0]) + '" cy="' + f1(top[1]) + '" r="' + f1(rm + 4) + '" fill="none" stroke="' + COL.amarilloOsc + '" stroke-width="2" stroke-dasharray="3 3"/>' : "") +
     '<circle cx="' + f1(top[0]) + '" cy="' + f1(top[1]) + '" r="' + f1(rm) + '" fill="' + col + '" stroke="' + (p.estado === "bloqueado" ? COL.linea : "#FFFFFF") + '" stroke-width="2"/>' +
     '<text x="' + f1(top[0]) + '" y="' + f1(top[1] + 4.5 / S) + '" text-anchor="middle" font-size="' + fs(13) + '" font-weight="800" fill="' + txt + '">' + p.corto + "</text></g>";
   });
   var fb = P(3.4, TECHO.yr, TECHO.zr), ft = P(3.4, TECHO.yr, TECHO.zr + 1.35), meta = d.puestas >= cas.length;
   s += '<g class="mapa-bandera" aria-hidden="true"><line x1="' + f1(fb[0]) + '" y1="' + f1(fb[1]) + '" x2="' + f1(ft[0]) + '" y2="' + f1(ft[1]) + '" stroke="' + COL.linea + '" stroke-width="2" stroke-dasharray="4 3"/>' +
    '<path d="M' + f1(ft[0]) + " " + f1(ft[1]) + " h22 l-6 7 l6 7 h-22 z" + '" fill="' + (meta ? COL.amarillo : "none") + '" stroke="' + COL.amarilloOsc + '" stroke-width="2"' + (meta ? "" : ' stroke-dasharray="4 3"') + "/></g>";
   s += pin;
   function insignia(i, dx, fill, borde, letra, colTxt, clase) {
    if (i == null || i < 0 || !rg[i]) return "";
    var r0 = rg[i], z = r0.z, m = r0.a + (r0.b - r0.a) * 0.74 + dx, base = z.techo ? P(m, (TECHO.ye + TECHO.yr) / 2, (TECHO.ze + TECHO.zr) / 2) : P(m, z.y1, z.losa ? z.z1 : (z.z0 + z.z1) / 2);
    var rr = Math.max(12, 10 / S), cy0 = base[1] - 14 - rr, cyB = cy0, cxB = base[0], g = 2 / S;
    var choca = function (x, y) { return cajasNum.some(function (c) { return y - rr - g < c[3] && y + rr + g > c[1] && x - rr - g < c[2] && x + rr + g > c[0]; }); };
    var palito = !choca(cxB, cyB), cn = cajaDe[i];
    if (!palito && cn) {
     var rr0 = rr, g0 = g; rr = 9.5 / S; g = 1 / S;
     var x0 = cn[2] + g + rr, y0 = (cn[1] + cn[3]) / 2;
     if (!choca(x0, y0)) { cxB = x0; cyB = y0; } else { rr = rr0; g = g0; palito = true; }
    } else palito = true;
    cajasNum.push([cxB - rr, cyB - rr, cxB + rr, cyB + rr]);
    return '<g class="' + clase + '" aria-hidden="true">' + (palito ? '<line x1="' + f1(base[0]) + '" y1="' + f1(base[1]) + '" x2="' + f1(cxB) + '" y2="' + f1(cyB + rr) + '" stroke="' + borde + '" stroke-width="2.5" stroke-linecap="round"/>' : "") +
     '<circle cx="' + f1(cxB) + '" cy="' + f1(cyB) + '" r="' + f1(rr) + '" fill="' + fill + '" stroke="#FFFFFF" stroke-width="2"/>' +
     '<text x="' + f1(cxB) + '" y="' + f1(cyB + 4.3 / S) + '" text-anchor="middle" font-size="' + fs(12) + '" font-weight="800" fill="' + colTxt + '">' + e(letra) + "</text></g>";
   }
   var mismo = op.otro && op.otro.actual === d.actual;
   if (op.pinInsignia) s += insignia(d.actual, mismo ? -0.6 : 0, COL.amarillo, COL.amarilloOsc, d.inicial || "", COL.tinta, "mapa-pin");
   if (op.otro) { var cp = COLOR_PERSONA[op.otro.p]; s += insignia(op.otro.actual, mismo ? 0.6 : 0, cp.c, cp.b, op.otro.inicial, op.otro.p === "p2" ? "#163F70" : "#FFFFFF", "mapa-otro"); }
   return s + "</svg>";
  }
  /* ---------- Camino vertical (3.3) ----------
   datos = { casitas, actual, parte, verificado, premios, juntos?: { p1, p2, ini } }; modo: "mio" | "juntos" | "ajuste" */
  function dibujarCamino(modo, d, op) {
   op = op || {};
   var W = op.ancho || 390, cas = d.casitas, n = cas.length, act = d.actual, ajuste = op.ajuste || [];
   var xL = Math.round(W * 0.34), xR = Math.round(W * 0.66), ref = act >= 0 ? act : n - 1;
   var ys = [], y = 104, i;
   var extra = op.otro ? 24 : 0; // la línea de la otra persona necesita aire bajo cada etiqueta
   var pz = {}; (op.pausas || []).forEach(function (p) { pz[p.i] = pz[p.i] || []; pz[p.i].push(p); });
   for (i = n - 1; i >= 0; i--) { if (i < n - 1) y += ((i === act || i + 1 === act) ? 158 : 128) + extra + (pz[i + 1] ? 56 : 0); ys[i] = y; }
   var H = ys[0] + 132, xs = cas.map(function (x, k) { return ((k - ref) % 2 === 0) ? xL : xR; });
   var s = '<svg class="camino-svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="group" aria-label="Su camino de casitas: la meta arriba y el inicio abajo">';
   var tramos = "";
   // Ronda 21: lo logrado es un trazo grueso y cálido; lo que falta, fino y suave, se aleja hacia la meta; un plan futuro alarga su tramo en azul.
   function tramo(x1, y1, x2, y2, ok, aj, lejos, azul) {
    var dd = "M" + x1 + " " + y1 + " C" + x1 + " " + (y1 + y2) / 2 + " " + x2 + " " + (y1 + y2) / 2 + " " + x2 + " " + y2;
    return ok ? '<path d="' + dd + '" fill="none" stroke="#CFE8CF" stroke-width="22" stroke-linecap="round"/><path class="tr-ok" d="' + dd + '" fill="none" stroke="' + COL.verde + '" stroke-width="12" stroke-linecap="round"/>'
     : '<path class="tr-por' + (azul ? " tr-plan" : "") + '" d="' + dd + '" fill="none" stroke="' + (aj ? COL.amarilloOsc : azul ? COL.azul : "#9FB3CC") + '" stroke-width="' + (azul ? 5 : 4) + '" stroke-linecap="round" stroke-dasharray="' + (azul ? "2 8" : "1 11") + '" opacity="' + f1(Math.max(0.45, 1 - (lejos || 0) * 0.09)) + '"/>';
   }
   var yIni = ys[0] + 80;
   tramos += tramo(xs[0], yIni, xs[0], ys[0], act !== 0 || cas[0].lleno > 0 || act < 0, false);
   for (i = 0; i < n - 1; i++) {
    var ok = act < 0 ? true : i + 1 <= act;
    tramos += tramo(xs[i], ys[i], xs[i + 1], ys[i + 1], ok, modo === "ajuste" && ajuste.indexOf(i + 1) >= 0, i - ref, !!pz[i + 1]);
   }
   tramos += tramo(xs[n - 1], ys[n - 1], W / 2, 52, act < 0, false);
   s += '<g class="camino-tramos" aria-hidden="true">' + tramos + "</g>";
   var metaOk = act < 0 && d.verificado >= d.parte - 0.5;
   s += '<g class="camino-meta" aria-hidden="true"><rect x="' + (W / 2 - 122) + '" y="20" width="244" height="34" rx="17" fill="' + (metaOk ? COL.verde : COL.azulOsc) + '"/>' +
    '<text x="' + W / 2 + '" y="42" text-anchor="middle" font-size="13" font-weight="800" fill="#FFFFFF">' + (metaOk ? "Pie de la vivienda logrado" : "▲ Pie de la vivienda · " + e(millones(op.pie || PIE))) + "</text></g>";
   var med = "";
   (d.premios || []).filter(function (p) { return p.f > 0 && p.f < 1; }).forEach(function (p) {
    var k = p.casita, mx, my;
    if (k <= 0) { mx = xs[0]; my = (ys[0] + yIni) / 2; } else { mx = (xs[k - 1] + xs[k]) / 2; my = (ys[k - 1] + ys[k]) / 2; }
    var col = p.estado === "logrado" ? COL.verdeOsc : p.estado === "proximo" ? COL.amarillo : "#FFFFFF", tx = p.estado === "logrado" ? "#FFFFFF" : p.estado === "proximo" ? COL.tinta : COL.gris;
    med += '<g class="medalla md-' + p.estado + '" role="button" tabindex="0" data-premio="' + p.id + '" aria-label="' + e("Premio " + p.corto + " del pie: " + (p.estado === "logrado" ? "logrado" : p.estado === "proximo" ? "próximo" : "por venir")) + '">' +
     '<circle cx="' + mx + '" cy="' + my + '" r="22" fill="transparent"/>' +
     (p.estado === "proximo" ? '<circle class="md-aro" cx="' + mx + '" cy="' + my + '" r="21" fill="none" stroke="' + COL.amarilloOsc + '" stroke-width="2.5" stroke-dasharray="3 3"/>' : "") +
     '<circle cx="' + mx + '" cy="' + my + '" r="16" fill="' + col + '" stroke="' + (p.estado === "bloqueado" ? COL.linea : "#FFFFFF") + '" stroke-width="3"/>' +
     '<text x="' + mx + '" y="' + (my + 5) + '" text-anchor="middle" font-size="14" font-weight="800" fill="' + tx + '">' + p.corto + "</text></g>";
   });
   var nodos = "";
   cas.forEach(function (x, k) {
    var cx = xs[k], cy = ys[k], izq = cx === xL, cur = k === act, est = estadoCasita(x), aj = modo === "ajuste" && ajuste.indexOf(k) >= 0;
    var mat = material(x.n), declarado = x.pend > 0;
    var lejos = est === "futura" ? Math.max(0, k - ref - 1) : 0, R = cur ? 44 : est === "lograda" ? 34 : 32 - Math.min(6, lejos), lab = "Casita " + x.n + ", " + MATERIAL[mat].nombre + ", " + millones(x.monto).replace("$", "") + ", " +
     (est === "lograda" ? "lograda, verificada por Bci" : cur ? "en curso, " + pct(x.lleno) + ", faltan " + pesos(Math.round((1 - x.lleno) * x.monto)) : "por venir");
    var OM = op.otroMarca && op.otroMarca.i === k ? op.otroMarca : null;
    var g = '<g class="nodo nd-' + est + (cur ? " nd-actual" : "") + '" role="button" tabindex="0" data-i="' + k + '" style="--k:' + (n - k) + (lejos ? ";opacity:" + f1(Math.max(0.55, 1 - lejos * 0.08)) : "") + '" aria-label="' + e(lab + (OM ? ". " + OM.nombre + " va aquí" : "")) + '"' + (cur ? ' aria-current="step"' : "") + ">";
    if (est === "lograda") g += '<ellipse cx="' + cx + '" cy="' + (cy + R + 6) + '" rx="' + (R - 4) + '" ry="6" fill="' + COL.pista + '"/>';
    if (cur) {
     var C = 2 * Math.PI * 44, lleno = x.lleno;
     g += '<circle class="nd-halo" cx="' + cx + '" cy="' + cy + '" r="56" fill="' + (op.mes === "ok" ? "#DDF0DA" : "#DCE8F8") + '"/><circle cx="' + cx + '" cy="' + cy + '" r="44" fill="#FFFFFF"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="44" fill="none" stroke="' + COL.pista + '" stroke-width="8"/>' +
      '<circle class="nd-anillo" cx="' + cx + '" cy="' + cy + '" r="44" fill="none" stroke="' + COL.azul + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + f1(Math.max(0.02, lleno) * C) + " " + f1(C) + '" transform="rotate(-90 ' + cx + " " + cy + ')"/>';
    } else {
     var bord = aj || declarado ? COL.amarilloOsc : est === "lograda" ? COL.verde : COL.linea;
     g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="#FFFFFF" stroke="' + bord + '" stroke-width="4"' + (aj || declarado ? ' stroke-dasharray="7 5"' : "") + "/>";
    }
    var O = op.otro, ox = O ? O.casitas[k] : null, eo = ox ? estadoOtra(ox) : null, linea = null;
    if (O) {
     if (O.actual === k) linea = { pill: true, txt: O.nombre + " está aquí · " + pct(ox.lleno) };
     else if (eo.estado === "lograda") linea = { txt: O.nombre + ": completa" };
     else if (est === "lograda" || cur) linea = { txt: O.nombre + ": aún no" };
     g = g.replace('aria-label="' + e(lab) + '"', 'aria-label="' + e(lab + ". " + O.nombre + ": " + (eo.estado === "lograda" ? "completa" : eo.progreso > 0 ? pct(eo.progreso) : "aún no")) + '"');
    }
    var cw = cur ? 62 : O && est === "futura" ? 42 : 46, ch = cw * (O ? 129 : 117) / 144;
    g += '<g transform="translate(' + f1(cx - cw / 2) + " " + f1(cy - ch / 2 - 2) + ')">' + (O ? casita2({ estado: est, progreso: x.lleno }, { p: O.p, estado: eo.estado, progreso: eo.progreso }, cw, { ajuste: aj }) : casita(est, x.lleno, cw, { ajuste: aj })) + "</g>";
    function lineaOtra(x0, base, fin) {
     if (!linea) return "";
     var colO = COLOR_PERSONA[O.p];
     if (linea.pill) {
      var px = fin ? x0 - 170 : x0, claro = O.p === "p2";
      return '<rect x="' + px + '" y="' + (base - 18) + '" width="170" height="26" rx="13" fill="' + colO.c + '" stroke="' + colO.b + '" stroke-width="2"/>' +
       '<text x="' + (px + 85) + '" y="' + (base - 1) + '" text-anchor="middle" font-size="12" font-weight="800" fill="' + (claro ? "#163F70" : "#FFFFFF") + '">' + e(linea.txt) + "</text>";
     }
     var bx = fin ? x0 - 18 : x0;
     return '<rect x="' + bx + '" y="' + (base - 9) + '" width="18" height="8" rx="4" fill="' + colO.c + '" stroke="' + colO.b + '" stroke-width="1.5"/>' +
      '<text x="' + (fin ? x0 - 24 : x0 + 24) + '" y="' + base + '"' + (fin ? ' text-anchor="end"' : "") + ' font-size="12" font-weight="700" fill="' + COL.gris + '">' + e(linea.txt) + "</text>";
    }
    var colN = est === "lograda" ? COL.verdeOsc : cur ? COL.azulOsc : COL.gris;
    if (OM) { var oc = COLOR_PERSONA[OM.p], ox2 = f1(cx - R * 0.8), oy2 = f1(cy - R * 0.8); g += '<g class="cm-otro" aria-hidden="true"><circle cx="' + ox2 + '" cy="' + oy2 + '" r="12" fill="' + oc.c + '" stroke="#FFFFFF" stroke-width="2"/><text x="' + ox2 + '" y="' + f1(cy - R * 0.8 + 4) + '" text-anchor="middle" font-size="12" font-weight="800" fill="' + (OM.p === "p2" ? "#163F70" : "#FFFFFF") + '">' + e(OM.inicial) + "</text></g>"; }
    if (cur) {
     var lx = cx + 60;
     g += '<rect x="' + lx + '" y="' + (cy - 36) + '" width="104" height="30" rx="15" fill="' + COL.amarillo + '"/>' +
      '<text x="' + (lx + 52) + '" y="' + (cy - 16) + '" text-anchor="middle" font-size="13" font-weight="800" fill="' + COL.tinta + '">Están aquí</text>' +
      '<text x="' + lx + '" y="' + (cy + 16) + '" font-size="14" font-weight="800" fill="' + COL.tinta + '">' + dos(x.n) + " · " + e(millones(x.monto)) + "</text>";
     if (op.mes === "ok") g += '<g class="nd-mes" aria-hidden="true"><circle cx="' + (cx + 40) + '" cy="' + (cy - 40) + '" r="12" fill="' + COL.verde + '" stroke="#FFFFFF" stroke-width="2"/><path d="' + CHECK + '" transform="translate(' + (cx + 40) + " " + (cy - 40) + ')" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>';
    } else if (izq) {
     var lx2 = cx + R + 14;
     g += '<text x="' + lx2 + '" y="' + (cy - 3) + '" font-size="15" font-weight="800" fill="' + colN + '">' + dos(x.n) + "</text>" +
      '<text x="' + lx2 + '" y="' + (cy + 15) + '" font-size="12" font-weight="700" fill="' + COL.gris + '">' + e(millones(x.monto)) + "</text>";
    } else {
     var rx = cx - R - 14;
     g += '<text x="' + rx + '" y="' + (cy - 3) + '" text-anchor="end" font-size="15" font-weight="800" fill="' + colN + '">' + dos(x.n) + "</text>" +
      '<text x="' + rx + '" y="' + (cy + 15) + '" text-anchor="end" font-size="12" font-weight="700" fill="' + COL.gris + '">' + e(millones(x.monto)) + "</text>";
    }
    nodos += g + "</g>";
   });
   s += med + nodos;
   // Marcas tocables: el punto donde se ajustó el camino y los planes futuros (azul sereno).
   function marcaBtn(x0, y0, attr, lab, dentro) { return '<g class="cm-marca" role="button" tabindex="0" ' + attr + ' aria-label="' + e(lab) + '"><circle cx="' + x0 + '" cy="' + y0 + '" r="22" fill="transparent"/><circle cx="' + x0 + '" cy="' + y0 + '" r="13" fill="#FFFFFF" stroke="' + COL.azul + '" stroke-width="2.5"/><g transform="translate(' + x0 + " " + y0 + ')" fill="none" stroke="' + COL.azul + '" stroke-width="2" stroke-linecap="round">' + dentro + "</g></g>"; }
   if (op.marca && act >= 0) s += marcaBtn(xs[act] + 72, ys[act] + 48, 'data-marca="1"', op.marca.txt + ": ver antes y después", '<path d="M-5 2a5 5 0 1 0 1.5-5.5"/><path d="M-5-6v3.5h3.5"/>');
   Object.keys(pz).forEach(function (q) { var j = +q; pz[q].forEach(function (p, t) { var y0 = j > 0 ? (ys[j - 1] + ys[j]) / 2 : (ys[0] + yIni) / 2, x0 = (j > 0 ? (xs[j - 1] + xs[j]) / 2 : xs[0]) + 40 + t * 30;
    s += marcaBtn(x0, y0, 'data-pausa="' + p.k + '"', "Plan futuro: " + p.txt, '<rect x="-5" y="-4" width="10" height="9" rx="1.5"/><path d="M-5-1h10M-2-6v3M2-6v3"/>'); }); });
   s += '<g class="camino-inicio" aria-hidden="true"><circle cx="' + xs[0] + '" cy="' + yIni + '" r="8" fill="' + COL.verde + '"/></g>';   return { svg: s + "</svg>", alto: H, yActual: act >= 0 ? ys[act] : ys[n - 1] };
  }

  /* Pruebas de datos (se ejecutan en la consola: CimientoViaje.pruebas()). */
  function pruebas() {
   if (window.CimientoPruebasViaje) return window.CimientoPruebasViaje();
   function cargar(src) { return new Promise(function (ok) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ok; document.head.appendChild(s); }); }
   return (window.CimientoProtocolo ? Promise.resolve() : cargar("js/protocolo.js")).then(function () { return cargar("js/pruebas.js"); }).then(function () { return window.CimientoPruebasViaje(); });
  }

  window.CimientoViaje = { V: V, N: N, PIE: PIE, UF: UF, CASO: CASO, FORMAS: FORMAS, PREMIOS: PREMIOS, MATERIAL: MATERIAL, COL: COL,
   VINCULOS: VINCULOS, estadoVinculo: estadoVinculo, hayDos: hayDos, tipoVinculo: tipoVinculo, invitar: invitar, aceptar: aceptar, rechazar: rechazar, cancelarInvitacion: cancelarInvitacion, salir: salir,
   reparto: reparto, tamanos: tamanos, casitasNuevas: casitasNuevas, viaje: viaje, unidades: unidades, juntos: juntos, redistribuir: redistribuir, libresAjuste: libresAjuste,
   aportadoMes: aportadoMes, proponer: proponer, simularPropuesta: simularPropuesta, premios: premios, casitaDelHito: casitaDelHito, constancia: constancia, crearConfig: crearConfig,
   rentaPedida: rentaPedida, pieNecesario: pieNecesario, mesesCamino: mesesCamino, bajaPorCasita: bajaPorCasita,
   pesos: pesos, millones: millones, pct: pct, plazo: plazo, anosMeses: anosMeses, formatoRut: formatoRut, validarRut: validarRut, enmascararRut: enmascararRut, limpiarRut: limpiarRut,
   _rangosX: rangosX, _H48: H48, material: material, tono: tono, casita: casita, casita2: casita2, estadoOtra: estadoOtra, COLOR_PERSONA: COLOR_PERSONA, estadoCasita: estadoCasita, dibujarMapa: dibujarMapa, dibujarCamino: dibujarCamino, pruebas: pruebas, r10k: r10k };
})();
