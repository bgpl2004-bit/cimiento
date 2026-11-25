/* Cimiento: pruebas (no se cargan con la app; CimientoViaje.pruebas() las trae al pedirlas).
 * 1) Pruebas de datos del modelo (js/viaje.js). 2) Prueba de no solapamiento de la interfaz (sección 1.4 de la ronda 18). */
(function () {
  "use strict";
  var V = window.CimientoViaje, PIE = V.PIE, H48 = V._H48, rangosX = V._rangosX, tamanos = V.tamanos, crearConfig = V.crearConfig, viaje = V.viaje, redistribuir = V.redistribuir,
    premios = V.premios, pct = V.pct, pesos = V.pesos, millones = V.millones, casita = V.casita, plazo = V.plazo, anosMeses = V.anosMeses, mesesCamino = V.mesesCamino,
    rentaPedida = V.rentaPedida, bajaPorCasita = V.bajaPorCasita, formatoRut = V.formatoRut, validarRut = V.validarRut, enmascararRut = V.enmascararRut, proponer = V.proponer,
    invitar = V.invitar, aceptar = V.aceptar, estadoVinculo = V.estadoVinculo, hayDos = V.hayDos, juntos = V.juntos, rechazar = V.rechazar, salir = V.salir, constancia = V.constancia;
  window.CimientoPruebasViaje = function () {
    var r = [], ok = function (nombre, cond, det) { r.push({ prueba: nombre, ok: !!cond, detalle: det || "" }); };
    var t = tamanos(PIE, 10, "rampa"), suma = t.reduce(function (s, x) { return s + x; }, 0);
    ok("Rampa de $121,2 M va de $3,0 M a $21,2 M y suma al peso", suma === PIE && Math.abs(t[0] - 3030000) < 10001 && Math.abs(t[9] - 21210000) < 20001, t[0] + " … " + t[9] + " = " + suma);
    ["adaptativo", "rampa", "escalones", "constante"].forEach(function (f) { var x = tamanos(68680000, 10, f, 600000); ok("Suma de casitas = parte (" + f + ")", x.reduce(function (s, y) { return s + y; }, 0) === 68680000); });
    var cfg = crearConfig({ p1: { nombre: "A", ingreso: 1700000, capacidad: 600000, ahorro: 0 }, p2: { nombre: "B", ingreso: 1300000, capacidad: 400000, ahorro: 0 } });
    ok("Reparto proporcional suma el pie", cfg.personas.p1.parte + cfg.personas.p2.parte === PIE, cfg.personas.p1.parte + " + " + cfg.personas.p2.parte);
    var c1 = cfg.personas.p1.casitas, monto = c1[0].monto + Math.round(c1[1].monto / 2);
    var v = viaje(cfg.personas.p1, [{ de: "p1", monto: monto, estado: "verificado", origen: "cuenta-bci", fecha: new Date().toISOString() }], "p1");
    ok("Un aporte desborda a la casita siguiente", v.acunadas === 1 && Math.abs(v.casitas[1].lleno - 0.5) < 0.01, "acuñadas " + v.acunadas + ", casita 2 al " + Math.round(v.casitas[1].lleno * 100) + " %");
    var ap = [{ de: "p1", monto: c1[0].monto + c1[1].monto, estado: "verificado", origen: "cuenta-bci", fecha: new Date().toISOString() }];
    var nuevas = redistribuir(cfg.personas.p1, ap, "p1", "adaptativo", 300000);
    ok("Aplicar una propuesta no toca casitas acuñadas", nuevas[0].monto === c1[0].monto && nuevas[1].monto === c1[1].monto && nuevas.reduce(function (s, c) { return s + c.monto; }, 0) === cfg.personas.p1.parte);
    var otra = crearConfig({ p1: { nombre: "A", ingreso: 2500000, capacidad: 1200000, ahorro: 0 }, p2: { nombre: "B", ingreso: 1300000, capacidad: 400000, ahorro: 0 } });
    ok("Con otros datos de alta cambia la primera casita", otra.personas.p1.casitas[0].monto !== c1[0].monto, c1[0].monto + " → " + otra.personas.p1.casitas[0].monto);
    var per = JSON.parse(JSON.stringify(cfg.personas.p1)), antes = viaje(per, ap, "p1");
    var ap2 = ap.concat([{ de: "p1", monto: -per.casitas[0].monto, estado: "verificado", origen: "rescate", fecha: new Date().toISOString() }]);
    per.casitas[0].estado = "rescatada";
    per.casitas = redistribuir(per, ap2, "p1");
    var desp = viaje(per, ap2, "p1"), sumaAct = per.casitas.filter(function (c) { return c.estado === "activa"; }).reduce(function (s, c) { return s + c.monto; }, 0);
    ok("El rescate recalcula meses (+N) y conserva la suma de la parte", desp.meses > antes.meses && sumaAct === per.parte && desp.acunadas === antes.acunadas - 1, antes.meses + " → " + desp.meses + " meses");
    // Ronda 18
    var rg = rangosX(c1.map(function (c) { return c.monto; })), w = function (i) { return rg[i].b - rg[i].a; };
    ok("Casa: el ancho de cada pieza es proporcional a su monto en su fila", Math.abs(w(3) / w(4) - c1[3].monto / c1[4].monto) < 0.01 && Math.abs(w(8) / w(9) - c1[8].monto / c1[9].monto) < 0.01, "pieza 4/5: " + (w(3) / w(4)).toFixed(3));
    var dem = [{ de: "p1", monto: 22670000, estado: "verificado", origen: "inicial", fecha: new Date().toISOString() }], vd = viaje(cfg.personas.p1, dem, "p1"), pr = premios(cfg, dem, "p1");
    ok("Premios: ¼ cae en la casita 5, ½ en la 7 y ¾ en la 9 (caso demo)", pr[1].casita === 4 && pr[2].casita === 6 && pr[3].casita === 8, [pr[1].casita, pr[2].casita, pr[3].casita].map(function (x) { return x + 1; }).join(", "));
    ok("Premios: primera y ¼ logrados, ½ próximo (faltan $11.670.000)", pr[0].estado === "logrado" && pr[1].estado === "logrado" && pr[2].estado === "proximo" && pr[2].falta === 11670000, pesos(pr[2].falta));
    ok("Casita en curso: 6 al 32 % y faltan $5.020.000 (caso demo)", vd.actual === 5 && pct(vd.casitas[5].lleno) === "32 %" && vd.faltaCasita === 5020000, pct(vd.casitas[5].lleno) + ", " + pesos(vd.faltaCasita));
    var s1 = casita("lograda", 1, 30), s2 = casita("curso", 0.32, 30), s3 = casita("futura", 0, 30), s4 = casita("futura", 0, 30, { ajuste: true });
    ok("Estados de la casita (lograda, en curso, por venir, por ajustar)", /28892B/.test(s1) && /FFE300/.test(s2) && /width="35\.5"/.test(s2) && /B7C6DA/.test(s3) && !/28892B|FFE300/.test(s3) && /9 8/.test(s4), "ok");
    ok("Plazos: 77 meses = 6 años y 5 meses; 103 = 8 años y 7 meses; 20 = 20 meses", plazo(77) === "6 años y 5 meses" && plazo(103) === "8 años y 7 meses" && plazo(20) === "20 meses" && anosMeses(20) === "1 año y 8 meses", plazo(77) + " / " + plazo(103));
    var esc = ["solo", "familiar", "pareja"].map(function (k) { return mesesCamino(k, 40000000, 1000000); });
    ok("Escenarios con $40 M y $1,0 M al mes: 82, 25 y 20 meses", esc[0] === 82 && esc[1] === 25 && esc[2] === 20, esc.join(" / "));
    ok("Brecha inicial de renta $1,713 M y baja ≈ $256.000 por casita de $12,1 M", Math.abs(rentaPedida(40000000) - 1700000 - 1713000) < 1000 && Math.abs(bajaPorCasita(PIE / 10) - 256000) < 1000, pesos(Math.round(rentaPedida(40000000) - 1700000)) + " / " + pesos(Math.round(bajaPorCasita(PIE / 10))));
    ok("Formato de montos es-CL", pesos(1700000) === "$1.700.000" && millones(7430000) === "$7,4 M" && millones(121200000) === "$121,2 M", pesos(1700000) + " · " + millones(7430000));
    ok("RUT: formato y dígito verificador", formatoRut("111111111") === "11.111.111-1" && validarRut("11.111.111-1") && !validarRut("11.111.111-2") && validarRut("12.345.678-5") && enmascararRut("11.111.111-1") === "••.•••.111-1", formatoRut("111111111"));
    var pm = proponer(cfg.personas.p1, [], "p1"), pq = proponer(cfg.personas.p1, [{ de: "p1", monto: 500000, estado: "verificado", origen: "cuenta-bci", fecha: new Date().toISOString() }], "p1");
    // Vínculo e invitación: pendiente, vencida, aceptada (lo logrado se conserva), rechazada, salida (cada uno conserva lo suyo)
    var solo = crearConfig({ reparto: { p1: 68680000, p2: 0 }, vinculo: { tipo: "pareja", estado: "ninguno", de: "p1" }, p1: { nombre: "A", ingreso: 1700000, capacidad: 600000, plan: 600000 } });
    var apS = [{ de: "p1", monto: 22670000, estado: "verificado", origen: "inicial", fecha: new Date().toISOString() }], t0 = Date.now();
    var inv = invitar(solo, { tipo: "pareja", via: "rut", rut: "••.•••.222-2", codigo: "ABC123" }, t0);
    var acep = aceptar(inv, apS, { nombre: "B", ingreso: 1300000, capacidad: 400000, plan: 400000 }, t0);
    var va = viaje(solo.personas.p1, apS, "p1"), vb = viaje(acep.personas.p1, apS, "p1"), sal = salir(acep);
    ok("Invitación: sin pareja es una persona sola; pendiente y luego vencida a las 48 h", !hayDos(solo) && juntos(solo, apS).total === 22670000 && estadoVinculo(inv, t0) === "pendiente" && estadoVinculo(inv, t0 + H48 + 1000) === "vencida", estadoVinculo(inv, t0 + H48 + 1000));
    ok("Invitación aceptada: suman el pie y lo logrado no se reduce", hayDos(acep) && acep.personas.p1.parte + acep.personas.p2.parte === PIE && vb.acunadas === va.acunadas && vb.verificado === va.verificado, acep.personas.p1.parte + " + " + acep.personas.p2.parte);
    ok("Invitación rechazada o salida: cada uno conserva su viaje", estadoVinculo(rechazar(inv)) === "rechazada" && !hayDos(sal) && sal.personas.p2 && viaje(sal.personas.p1, apS, "p1").acunadas === vb.acunadas, estadoVinculo(sal));
    ok("Fin de mes: sin aportes propone $450.000; con $500.000 no propone", pm && pm.plan === 450000 && pq === null, (pm ? pesos(pm.plan) : "—") + " / " + (pq ? pq.tipo : "sin propuesta"));
    // Constancia (ronda 18c): ventana de 6 meses en orden cronológico, desde el primer mes de la racha
    var REF = new Date(2026, 10, 15), ap = function (y, m) { return { de: "p1", monto: 100000, estado: "verificado", origen: "cuenta-bci", fecha: new Date(y, m, 5, 10).toISOString() }; };
    var et = function (k) { return k.ultimos.map(function (x) { return x.et; }).join(","); };
    var k0 = constancia([], REF, "p1");
    ok("Constancia sin aportes: parte en el mes actual (anillo) y sigue con meses futuros", k0.meses === 0 && et(k0) === "Este mes,dic,ene \u201927,feb,mar,abr" && k0.ultimos[0].actual && !k0.ultimos[0].ok && k0.ultimos[1].futuro && k0.ultimos[0].aria === "noviembre, este mes, sin aporte todavía", et(k0));
    var k1 = constancia([ap(2026, 10)], REF, "p1");
    ok("Constancia solo el mes actual: 1 mes, primera casilla lograda «Este mes»", k1.meses === 1 && k1.ultimos[0].ok && k1.ultimos[0].actual && k1.ultimos[0].aria === "noviembre, este mes, con aporte verificado", et(k1));
    var k2 = constancia([ap(2026, 7), ap(2026, 8), ap(2026, 9)], REF, "p1");
    ok("Constancia racha de 3 terminando el mes anterior: ago, sep, oct, Este mes, dic, ene ’27", k2.meses === 3 && et(k2) === "ago,sep,oct,Este mes,dic,ene \u201927" && k2.ultimos[0].ok && k2.ultimos[2].ok && !k2.ultimos[3].ok && k2.ultimos[3].actual && k2.ultimos[0].aria === "agosto, con aporte verificado" && k2.ultimos[4].aria === "diciembre, mes futuro", et(k2));
    var k3 = constancia([ap(2026, 8), ap(2026, 9), ap(2026, 10)], REF, "p1");
    ok("Constancia racha de 3 terminando el mes actual: sep, oct, Este mes (logrado) y futuros", k3.meses === 3 && et(k3) === "sep,oct,Este mes,dic,ene \u201927,feb" && k3.ultimos[2].ok && k3.ultimos[2].actual && k3.ultimos[3].futuro, et(k3));
    var a8 = []; for (var q8 = 2; q8 <= 9; q8++) a8.push(ap(2026, q8));
    var k4 = constancia(a8, REF, "p1");
    ok("Constancia racha de 8 meses: la ventana se desplaza y termina en el mes actual", k4.meses === 8 && et(k4) === "jun,jul,ago,sep,oct,Este mes" && k4.ultimos.slice(0, 5).every(function (x) { return x.ok; }) && k4.ultimos[5].actual, et(k4));
    var k5 = constancia([ap(2026, 6), ap(2026, 8), ap(2026, 9)], REF, "p1");
    ok("Constancia racha cortada por un mes vacío: cuenta desde después del vacío y no dibuja meses pasados vacíos", k5.meses === 2 && et(k5) === "sep,oct,Este mes,dic,ene \u201927,feb" && k5.ultimos.every(function (x) { return x.ok || x.actual || x.futuro; }), et(k5));
    var k6 = constancia([ap(2026, 10), ap(2026, 11), ap(2027, 0)], new Date(2027, 0, 20), "p1");
    ok("Constancia con cambio de año: nov, dic, Este mes (enero 2027) y meses futuros sin año", k6.meses === 3 && et(k6) === "nov,dic,Este mes,feb,mar,abr" && k6.ultimos[2].aria === "enero de 2027, este mes, con aporte verificado", et(k6));
    // Ronda 19: casita de dos líneas
    var c2 = V.casita2, lo = function (s) { return { estado: "lograda", progreso: 1 }; };
    var g1 = c2({ estado: "lograda", progreso: 1 }, { p: "p2", estado: "lograda", progreso: 1 }, 46);
    var g2 = c2({ estado: "curso", progreso: 0.32 }, { p: "p2", estado: "futura", progreso: 0 }, 62);
    var g3 = c2({ estado: "futura", progreso: 0 }, { p: "p1", estado: "futura", progreso: 0 }, 42);
    var g4 = c2({ estado: "lograda", progreso: 1 }, { p: "p2", estado: "curso", progreso: 0.05 }, 46);
    var g5 = c2({ estado: "futura", progreso: 0 }, { p: "p1", estado: "curso", progreso: 0.5 }, 42);
    ok("Casita de dos líneas: lograda por ambos (verde arriba; celeste con borde abajo)", /viewBox="-8\.5 -8\.5 144 129"/.test(g1) && /class="cs-propia" x="8" y="66" width="111"[^>]*#28892B/.test(g1) && /class="cs-otra"[^>]*width="107(\.0)?"[^>]*#8DB8EE[^>]*#4F86C6/.test(g1), "ok");
    ok("Casita de dos líneas: propia en curso al 32 % (ancho 35,5) y la otra sin avance (solo pista)", /cs-propia" x="8" y="66" width="35\.5"[^>]*#FFE300/.test(g2) && !/cs-otra/.test(g2) && /#1D5699/.test(g2), "ok");
    ok("Casita de dos líneas: ambas vacías = techo gris; avance mínimo de la otra = 20 de ancho", /stroke="#B7C6DA"/.test(g3) && !/cs-propia|cs-otra/.test(g3) && /cs-otra"[^>]*width="16(\.0)?"/.test(g4), "ok");
    ok("Casita de dos líneas: si solo la otra avanza, el techo es azul (Tomás en azul oscuro con borde)", /stroke="#1D5699" stroke-width="17"/.test(g5) && /cs-otra"[^>]*fill="#1D5699" stroke="#12365F"/.test(g5), "ok");
    // Caso único (ronda 22): Tomás 6,7 (casita 7 al 70 %) y Paula 3,2 (3 completas y 20 % de la cuarta); juntos 9,9
    var dd = window.CimientoStore ? window.CimientoStore.datosDemo() : null;
    if (dd) {
      var vt = viaje(dd.cfg.personas.p1, dd.aportes, "p1"), vp = viaje(dd.cfg.personas.p2, dd.aportes, "p2"), dec = function (x) { return Math.floor(V.unidades(x) * 10 + 1e-6) / 10; };
      ok("Demo (caso único): Tomás 6,7 casitas ($33.682.000; casita 7 al 70 %, faltan $2.568.000)", dec(vt) === 6.7 && vt.verificado === 33682000 && vt.faltaCasita === 2568000 && vt.actual === 6, dec(vt) + " · " + pesos(vt.verificado));
      var kd = V.constancia(dd.aportes, null, "p1"), apC = dd.aportes.concat([{ de: "p1", monto: 3000000, estado: "verificado", origen: "cuenta-bci", fecha: new Date().toISOString() }]), vC = viaje(dd.cfg.personas.p1, apC, "p1");
      var prA = V.premios(dd.cfg, dd.aportes, "p1").filter(function (p) { return p.id === "mitad"; })[0], prC = V.premios(dd.cfg, apC, "p1").filter(function (p) { return p.id === "mitad"; })[0], kC = V.constancia(apC, null, "p1");
      ok("Demo: «Completar la casita 7» ($3.000.000) la cierra, empieza la 8 bajo 50 %, desbloquea ½ y la racha pasa de 3 (Bronce) a 4",
       kd.meses === 3 && kd.nivel === "Bronce" && prA.estado === "proximo" && vC.actual === 7 && vC.casitas[7].lleno > 0 && vC.casitas[7].lleno < 0.5 && prC.estado === "logrado" && kC.meses === 4,
       "racha " + kd.meses + "→" + kC.meses + " · ½ " + prA.estado + "→" + prC.estado + " · casita 8 " + pct(vC.casitas[7].lleno));
      ok("Demo: Paula 3,2 casitas (3 completas y 20 % de la 4); conserva $400.000 declarados", dec(vp) === 3.2 && vp.acunadas === 3 && vp.actual === 3 && pct(vp.casitas[3].lleno).replace(/\s/g, " ") === "20 %" && vp.declarado === 400000, dec(vp) + " · " + pesos(vp.verificado) + " · faltan " + pesos(vp.faltaCasita));
      ok("Demo: «Juntos» suma 9,9 casitas (una decimal)", Math.floor((dec(vt) + dec(vp)) * 10 + 1e-6) / 10 === 9.9, (dec(vt) + dec(vp)).toFixed(2));
    }
    // Protocolo de pruebas: importar sin duplicados, SUS y métricas del resumen CIF
    var PR = window.CimientoProtocolo;
    if (PR) {
      var e1 = [{ codigo: "demo-p1", tipo: "toque:tab-ruta", t: "2026-11-11T10:00:00Z", v: "0.19" }, { codigo: "demo-p1", tipo: "aporte", t: "2026-11-11T10:01:00Z", v: "0.19" }];
      var imp = PR.eventosDe(JSON.stringify({ app: "Cimiento", v: "0.19", eventos: [e1[1], { codigo: "alta-p1", tipo: "alta_fin", t: "2026-11-11T09:59:00Z", v: "0.19" }] }));
      var comb = PR.combinarEventos(e1, imp);
      ok("Importar registro: combina sin duplicados (código + tipo + hora) y asocia por código", comb.lista.length === 3 && comb.agregados === 1 && comb.lista[0].tipo === "alta_fin" && PR.participanteDeCodigo("alta-p1") === "P1" && PR.participanteDeCodigo("demo-p12") === "P12" && PR.participanteDeCodigo("demo") === null, comb.lista.length + " eventos, " + comb.agregados + " nuevo");
      ok("SUS: todo neutro = 50; ideal = 100; incompleto = sin valor", PR.sus([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]) === 50 && PR.sus([5, 1, 5, 1, 5, 1, 5, 1, 5, 1]) === 100 && PR.sus([5, 1, 5]) === null, "ok");
      var mt = PR.metricasTarea([{ ok: 1, s: 40, seq: 6 }, { ok: 0.5, s: 80, seq: 4, desl: 1 }, { ok: 0, s: 120, seq: 2, crit: 1 }, { ok: 1, s: 60, seq: 7 }]);
      ok("Resumen CIF: éxito sin ayuda 50 %, con o sin pista 75 %, tiempos solo de exitosas (media 60, mediana 60, desv. 20)", mt.n === 4 && mt.tasaSola === 50 && mt.tasaConPista === 75 && mt.media === 60 && mt.mediana === 60 && mt.desv === 20 && mt.seq === 4.75 && mt.errores === 2, JSON.stringify(mt));
      var hc = PR.consolidarHallazgos([{ id: "P1", problemas: [{ txt: "No encuentra Juntos", sev: 2 }] }, { id: "P2", problemas: [{ txt: "no encuentra  juntos", sev: 3 }, { txt: "Duda con declarado", sev: 4 }] }]);
      ok("Hallazgos consolidados: agrupa el mismo texto y ordena por severidad × frecuencia", hc.length === 2 && hc[0].frec === 2 && hc[0].sev === 3 && hc[0].puntaje === 6 && hc[1].puntaje === 4, hc.map(function (h) { return h.txt + " " + h.puntaje; }).join(" | "));
    }
    return r;
  };

  /* ---------- auditoría de la pantalla visible (ronda 19): solapes, scroll horizontal, texto < 12 px y áreas táctiles < 44 px ---------- */
  window.CimientoAuditoria = function () {
    var W = document.documentElement.clientWidth, chico = [], toque = [];
    var abiertos = [].slice.call(document.querySelectorAll("dialog[open]"));
    function vis(el) {
      if (el.closest("[hidden],dialog:not([open]),.solo-lector,#toast,#tip") || (el.closest("details:not([open])") && !el.closest("summary"))) return false;
      if (abiertos.length && !abiertos.some(function (d) { return d.contains(el); })) return false;
      var r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && r.bottom > 0 && r.top < innerHeight;
    }
    [].forEach.call(document.querySelectorAll("body *:not(svg):not(svg *)"), function (el) {
      if (!vis(el)) return;
      var tieneTexto = [].some.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); });
      if (tieneTexto && parseFloat(getComputedStyle(el).fontSize) < 11.95) chico.push(el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + " «" + el.textContent.trim().slice(0, 20) + "» " + getComputedStyle(el).fontSize);
    });
    [].forEach.call(document.querySelectorAll("button,a[href],select,input:not([type=checkbox]):not([type=radio]):not([type=file])"), function (el) {
      if (!vis(el) || el.closest("label.check,label.opcion,.seg-pista")) return;
      var r = el.getBoundingClientRect(); if (r.height < 43.5 || r.width < 43.5) toque.push((el.id ? "#" + el.id : el.tagName.toLowerCase()) + " «" + (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 20) + "» " + Math.round(r.width) + "×" + Math.round(r.height));
    });
    return { solapes: window.CimientoPruebasSolapes(), scrollH: document.documentElement.scrollWidth > W, chico: chico, toque: toque };
  };

  // Recorre Camino, Aportes, Premios, Casa, Cuenta y las hojas principales; devuelve solo lo que falla (gap = aire entre el camino y la barra).
  window.CimientoRecorrido = function () {
    var q = function (id) { return document.getElementById(id); }, w = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var res = {}, junta = function (k) { var a = window.CimientoAuditoria(); res[k] = res[k] || { solapes: [], scrollH: false, chico: [], toque: [] };
      ["solapes", "chico", "toque"].forEach(function (x) { a[x].forEach(function (v) { var s = typeof v === "string" ? v : JSON.stringify(v); if (res[k][x].indexOf(s) < 0) res[k][x].push(s); }); }); res[k].scrollH = res[k].scrollH || a.scrollH; };
    var pasos = [
      function () { q("tab-ruta").click(); window.scrollTo(0, 0); }, function () { junta("ruta"); var z = q("r-camino"); res.gap = Math.round(q("barra-inf").getBoundingClientRect().top - z.getBoundingClientRect().bottom); z.scrollTop = 0; },
      function () { junta("camino"); q("r-camino").scrollTop += 500; }, function () { junta("camino"); q("r-camino").scrollTop += 9999; }, function () { junta("camino"); }
    ];
    ["aportes", "premios", "juntos", "cuenta"].forEach(function (v) {
      pasos.push(function () { q("tab-" + v).click(); q("tip").hidden = true; window.scrollTo(0, 0); });
      [600, 600, 600, 99999].forEach(function (d) { pasos.push(function () { junta(v); window.scrollBy(0, d); }); });
      pasos.push(function () { junta(v); });
    });
    pasos.push(function () { q("c-instalar").click(); }, function () { junta("instalar"); q("hoja").close(); q("tab-ruta").click(); window.scrollTo(0, 0); },
      function () { q("r-aportar").click(); }, function () { junta("aportar"); q("aportar").close(); q("r-cifra-btn").click(); },
      function () { junta("detalle"); var s = document.querySelector('[data-det="simular"]'); if (s) s.click(); }, function () { junta("simular"); q("simular").close(); q("tab-juntos").click(); },
      function () { var c = document.querySelector('[data-j="casa"]'); if (c) c.click(); }, function () { if (q("hoja").open) { junta("casaDos"); q("hoja").close(); } q("tab-ruta").click(); window.scrollTo(0, 0); });
    return pasos.reduce(function (p, f) { return p.then(function () { f(); return w(260); }); }, Promise.resolve()).then(function () {
      var out = { gap: res.gap }; Object.keys(res).forEach(function (k) { if (k === "gap") return; var r = res[k]; if (r.solapes.length || r.scrollH || r.chico.length || r.toque.length) out[k] = r; }); return out;
    });
  };

  /* ---------- prueba de no solapamiento (1.4): rectángulos de interactivos y textos visibles ---------- */
  window.CimientoPruebasSolapes = function () {
    var sel = "button,a,input,select,label,[role=button]:not(.pieza):not(.nodo):not(.medalla),h1,h2,h3,p,li>span,strong,small,output,.chip,.ruta-circulo,.mapa-svg,.camino-svg";
    var els = [].slice.call(document.querySelectorAll(sel)).filter(function (el) {
      if ((el.closest("svg") && !el.matches(".mapa-svg,.camino-svg")) || el.matches(".campo label") || el.closest("[hidden]") || el.closest("dialog:not([open])") || el.closest(".solo-lector,#toast,#tip,#tour") || (el.closest("details:not([open])") && !el.closest("summary"))) return false;
      var r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== "hidden" && cs.opacity !== "0" && r.bottom > 0 && r.top < innerHeight;
    });
    var abiertos = [].slice.call(document.querySelectorAll("dialog[open]"));
    if (abiertos.length) els = els.filter(function (el) { return abiertos.some(function (d) { return d.contains(el); }); });
    function fijo(el) { for (var n = el; n && n !== document.body; n = n.parentElement) { var p = getComputedStyle(n).position; if (p === "fixed" || p === "sticky") return n; } return null; }
    var fallas = [], W = document.documentElement.clientWidth;
    els.forEach(function (a) { var r = a.getBoundingClientRect(); if (r.left < -1 || r.right > W + 1) fallas.push({ tipo: "fuera", a: desc(a), r: [Math.round(r.left), Math.round(r.right)] }); });
    for (var i = 0; i < els.length; i++) for (var j = i + 1; j < els.length; j++) {
      var a = els[i], b = els[j]; if (a.contains(b) || b.contains(a)) continue;
      if (a.closest(".campo") && a.closest(".campo") === b.closest(".campo")) continue; // campo con botón interno (padding reservado)
      var fa = fijo(a), fb = fijo(b); if ((fa && !fb) || (!fa && fb)) continue; // contenido que pasa bajo una capa fija al desplazarse
      var ra = caja(a), rb = caja(b);
      var ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ix > 1 && iy > 1) fallas.push({ tipo: "solape", a: desc(a), b: desc(b), area: Math.round(ix * iy) });
    }
    // Lo que va dentro de un contenedor con desplazamiento (el camino) se recorta a ese contenedor.
    function caja(el) { var r = el.getBoundingClientRect(), z = el.closest("#r-camino"); if (!z) return r; var k = z.getBoundingClientRect(); return { left: Math.max(r.left, k.left), right: Math.min(r.right, k.right), top: Math.max(r.top, k.top), bottom: Math.min(r.bottom, k.bottom) }; }
    function desc(el) { return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "") + " «" + (el.textContent || "").trim().slice(0, 24) + "»"; }
    return fallas;
  };
})();
