/* Cimiento · Ronda 18: lógica y render de la app (HTML, CSS y JS planos, sin compilación).
 * La app es del banco: se ingresa con la cuenta Bci (simulado y local), el alta parte de datos Bci de demostración
 * (js/datos-bci.js) y la Ruta muestra la casa isométrica y el camino (js/viaje.js). Todo lo que es concepto lleva
 * "Concepto 2050 · simulado, no es una oferta de Bci" solo en la entrada, la ficha (rescatar y transferir) y Acerca de este prototipo.
 * La interfaz no muestra textos "pendientes de definir". El banco decide. Ronda 18 (v2): Ruta individual, pestaña Juntos y "Simular un cambio" en hoja. */
(function () {
  "use strict";
  var Store = window.CimientoStore, V = window.CimientoViaje, BCI = window.CimientoDatosBci;
  var $ = function (id) { return document.getElementById(id); };
  function on(id, t, f) { $(id).addEventListener(t, f); }
  var ROTULO = "Concepto 2050 · simulado, no es una oferta de Bci", SEP = " · ";
  var api = null, estado = null, quien = null, SESION = "cimiento:sesion", rutMem = null;
  var modoRuta = "mio", vista = "ruta", histFiltro = "todos", sliderTocado = false, ultimaFalta = null, transitorio = null;
  var params = new URLSearchParams(location.search);

  /* ---------- utilidades ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var pesos = V.pesos, millones = V.millones, pct = V.pct, plazo = V.plazo;
  function fechaCorta(iso) { return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" }); }
  function fechaLarga(iso) { return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" }); }
  function hora(iso) { return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false }); }
  function otro(p) { return p === "p1" ? "p2" : "p1"; }
  function cfg() { return estado.config; }
  function per(p) { return estado.config.personas[p]; }
  function nombre(p) { var P = estado && estado.config && estado.config.personas ? estado.config.personas[p] : null; return P ? P.nombre : p === "p2" ? "Su pareja" : "Usted"; }
  function inicial(p) { return String(nombre(p)).charAt(0).toUpperCase(); }
  function digitos(v) { var d = String(v || "").replace(/\D/g, ""); return d ? parseInt(d, 10) : 0; }
  function formatoMonto(el) { var d = el.value.replace(/\D/g, "").slice(0, 10); el.value = d ? pesos(parseInt(d, 10)) : ""; }
  function vj(p) { return V.viaje(per(p || quien), estado.aportes, p || quien); }
  function jj() { return V.juntos(estado.config, estado.aportes); }
  function visibles() { return estado.aportes.filter(function (a) { return a.estado !== "anulado"; }); }
  function clonarCfg() { return JSON.parse(JSON.stringify(estado.config)); }
  function pref(k, v) { return Store.pref(k, v); }
  function quieto() { return document.documentElement.classList.contains("sin-movimiento") || !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); }
  function ocultos() { return pref("ocultar") === "1"; }
  function m$(n) { return ocultos() ? "$•••••" : pesos(n); }
  function mM(n) { return ocultos() ? "$•••" : millones(n); }
  function vibrar(p) { if (quieto() || !navigator.vibrate || (navigator.userActivation && !navigator.userActivation.hasBeenActive)) return; try { navigator.vibrate(p); } catch (e) {} }
  function anunciar(t) { var a = $("anuncio"); a.textContent = ""; setTimeout(function () { a.textContent = t; }, 50); }
  function ev(tipo) { Store.registrarEvento(api ? api.codigo : "", tipo); }
  function mesClave(d) { d = d || new Date(); return d.getFullYear() * 12 + d.getMonth(); }
  function ancho() { return Math.min(430, document.documentElement.clientWidth || 390); }
  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  var ORIGEN = { "cuenta-bci": "Cuenta Bci", otra: "Otra institución", inicial: "Saldo inicial", rescate: "Rescate de casita", transferencia: "Transferencia de casita" };
  function matNombre(n) { return V.MATERIAL[V.material(n)].nombre; }
  function matColor(n) { return V.MATERIAL[V.material(n)].c; }

  /* ---------- aviso superior (con acción y tiempo) ---------- */
  var toastT = null, toastFn = null;
  function toast(msg, op) {
   op = op || {};
   $("toast-txt").textContent = msg; $("toast").hidden = false;
   toastFn = op.fn || null; $("toast-accion").hidden = !op.fn; $("toast-accion").textContent = op.accion || "Deshacer";
   var ms = op.ms || (op.fn ? 8000 : 3500), barra = $("toast-tiempo");
   barra.hidden = !op.fn;
   if (op.fn && barra.animate && !quieto()) barra.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: ms, easing: "linear", fill: "forwards" });
   clearTimeout(toastT); toastT = setTimeout(cerrarToast, ms);
  }
  function cerrarToast() { $("toast").hidden = true; toastFn = null; }
  on("toast-accion", "click", function () { var f = toastFn; cerrarToast(); if (f) f(); });

  /* ---------- diálogos y hojas ---------- */
  var focoPrevio = {};
  function abrirDialogo(d) {
   if (d.open) return;
   focoPrevio[d.id] = document.activeElement;
   d.classList.remove("cerrando");
   if (d.showModal) d.showModal(); else d.setAttribute("open", "");
   document.documentElement.classList.add("con-hoja"); // el fondo no se desplaza bajo la hoja
   pausarTour(); ocultarTip();
  }
  function cerrarDialogo(d, inmediato) {
   if (typeof d === "string") d = $(d);
   if (!d || !d.open) return;
   function fin() { d.classList.remove("cerrando"); d.close(); d.style.transform = ""; }
   if (inmediato || quieto() || !d.classList.contains("hoja")) fin(); else { d.classList.add("cerrando"); setTimeout(fin, 190); }
  }
  ["hoja", "aportar", "menu", "premio-modal", "simular"].forEach(function (id) {
   var d = $(id);
   d.addEventListener("cancel", function (e) { e.preventDefault(); cerrarDialogo(d); });
   d.addEventListener("close", function () {
    var f = focoPrevio[d.id]; if (f && f.focus && document.contains(f)) try { f.focus({ preventScroll: true }); } catch (er) {}
    if (!hayDialogo()) document.documentElement.classList.remove("con-hoja");
    setTimeout(function () { if (!hayDialogo()) { if (cola.length) cola.shift()(); else reanudarTour(); } }, 30);
   });
   d.addEventListener("click", function (e) {
    if (e.target !== d) return;
    var r = d.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) cerrarDialogo(d);
   });
   if (d.classList.contains("hoja")) {
    var y0 = null, dy = 0;
    d.addEventListener("pointerdown", function (e) { if (!e.target.closest(".hoja-asa,.hoja-cab") || e.target.closest("button")) return; y0 = e.clientY; dy = 0; d.setPointerCapture && d.setPointerCapture(e.pointerId); });
    d.addEventListener("pointermove", function (e) { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); d.style.transform = "translateY(" + dy + "px)"; });
    var soltar = function () { if (y0 === null) return; y0 = null; if (dy > 80) cerrarDialogo(d, true); else d.style.transform = ""; };
    d.addEventListener("pointerup", soltar); d.addEventListener("pointercancel", soltar);
   }
  });
  function hayDialogo() { return ["hoja", "aportar", "menu", "premio-modal", "simular"].some(function (id) { return $(id).open; }); }
  var cola = []; // lo que se abre cuando se cierre la hoja actual (acuñado, premio, etc.)
  function luego(fn) { if (hayDialogo()) cola.push(fn); else fn(); }
  document.addEventListener("click", function (e) { var b = e.target.closest("[data-cerrar]"); if (b) cerrarDialogo(b.getAttribute("data-cerrar")); });
  on("hoja-cerrar", "click", function () { cerrarDialogo("hoja"); });
  function abrirHoja(titulo, html, op) {
   var d = $("hoja");
   $("hoja-titulo").textContent = titulo; $("hoja-cuerpo").innerHTML = html;
   d.scrollTop = 0;
   if (!d.open) abrirDialogo(d);
   if (op && op.foco) { var f = $(op.foco); if (f) f.focus(); }
  }

  /* ---------- pantallas ---------- */
  function mostrarSolo(id) {
   ["pantalla-carga", "pantalla-entrada", "pantalla-alta", "pantalla-app"].forEach(function (p) { $(p).hidden = p !== id; });
   var app = id === "pantalla-app";
   $("barra-inf").hidden = !app;
   if (!app) { $("btn-mas").hidden = true; $("fade-inf").hidden = true; $("btn-volver").hidden = true; $("ajuste-panel").hidden = true; }
   window.scrollTo(0, 0);
  }
  function irA(v, op) {
   op = op || {};
   if (!$("vista-" + v)) return;
   var cambia = vista !== v; vista = v;
   ["ruta", "aportes", "premios", "juntos", "cuenta"].forEach(function (k) {
    $("vista-" + k).hidden = k !== v;
    $("tab-" + k).setAttribute("aria-selected", k === v ? "true" : "false");
   });
   if (v !== "ruta" && modoRuta === "ajuste") salirAjuste();
   pintarFlotantes();
   if (cambia && !op.sinScroll) window.scrollTo(0, 0);
   if (v === "premios") { marcarPaso("premios"); ev("premios"); tourAccion("premios"); renderPremios(true); }
   if (v === "juntos") { ev("juntos"); tourAccion("juntos"); renderJuntos(); }
   if (v === "aportes") { ev("plan"); tourAccion("plan"); marcarPaso("plan"); cargarPlan(); }
   if (v === "ruta" && cambia && estado && estado.config) renderRuta();
   if (cambia) setTimeout(function () { mostrarTip(v); }, 400);
  }
  function pintarFlotantes() {
   var app = !$("pantalla-app").hidden, conAportar = false;
   $("btn-mas").hidden = !conAportar; $("fade-inf").hidden = !app || vista === "cuenta";
   $("ajuste-panel").hidden = !(app && vista === "ruta" && modoRuta === "ajuste");
   if (vista !== "ruta") $("btn-volver").hidden = true;
  }
  on("tabs", "click", function (e) { var b = e.target.closest("[data-vista]"); if (b) irA(b.getAttribute("data-vista")); });
  on("tabs", "keydown", function (e) {
   if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
   var t = [].slice.call(this.querySelectorAll("[role=tab]")), i = t.indexOf(document.activeElement); if (i < 0) return;
   var n = t[(i + (e.key === "ArrowRight" ? 1 : t.length - 1)) % t.length]; n.focus(); n.click();
  });

  /* ---------- render ---------- */
  function render() {
   if (!estado || !estado.config || !quien) return;
   renderRuta(); renderAportes(); renderPremios(); renderJuntos(); if (planMod && vista === "aportes") planMod.render(); if ($("simular").open) renderEscenarios(false); renderCuenta(); actualizarCampana();
  }

  /* === Ruta === */
  function propuestaActiva() { var p = cfg().propuestas && cfg().propuestas[quien]; return p && pref("prop:" + p.id) !== "no" ? p : null; }
  function datosMapa() {
   var v = vj(), pr = V.premios(cfg(), estado.aportes, quien);
   return { d: { casitas: v.casitas, actual: v.actual, inicial: inicial(quien), pie: cfg().pie, puestas: v.acunadas, premios: pr, parte: v.parte, verificado: v.verificado }, v: v };
  }
  function datosCasaDos() {
   var v = vj(), pr = V.premios(cfg(), estado.aportes, quien), j = jj(), A = j.p1, B = j.p2;
   var cas = A.casitas.map(function (a, i) {
    var b = B.casitas[i], ambos = a.estado === "acunada" && b.estado === "acunada", algo = a.lleno > 0 || b.lleno > 0 || a.estado === "en-curso" || b.estado === "en-curso";
    return { i: i, n: a.n, monto: a.monto + b.monto, guardado: "activa", estado: ambos ? "acunada" : algo ? "en-curso" : "futura", lleno: (a.lleno + b.lleno) / 2, pend: Math.max(a.pend, b.pend) };
   });
   var act = -1; cas.forEach(function (x, i) { if (act < 0 && x.estado !== "acunada") act = i; });
   return { d: { casitas: cas, actual: act, inicial: "", pie: cfg().pie, puestas: cas.filter(function (x) { return x.estado === "acunada"; }).length, premios: pr, parte: cfg().pie, verificado: j.total,
    juntos: { p1: A, p2: B, ini: [inicial("p1"), inicial("p2")] } }, v: v, j: j };
  }
  var UMBRAL_ETAPA = 0.5, ETAPA_FALTA = /[?&]etapa=falta\b/.test(location.search);
  function renderRuta() {
   var dm = datosMapa(), v = dm.v, d = dm.d, W = ancho(), libres = modoRuta === "ajuste" ? V.libresAjuste(v) : [], prop = propuestaActiva();
   var num = $("r-cifra"), meta = $("r-cifra-meta");
   if (transitorio && Date.now() < transitorio.hasta) { num.textContent = transitorio.num; meta.textContent = transitorio.meta; }
   else if (modoRuta === "ajuste" && prop) {
    var sim = V.simularPropuesta(per(quien), estado.aportes, quien, prop.plan, per(quien).forma);
    meta.textContent = "Propuesta" + SEP + plazo(sim.mesesDespues); num.textContent = m$(prop.plan) + " al mes";
   } else if (v.actual < 0) { meta.textContent = v.acunadas + " de 10 casitas"; num.textContent = "Parte lograda"; }
   else {
    var xc = v.casitas[v.actual], llevan = !ETAPA_FALTA && xc.lleno > 0 && xc.lleno < UMBRAL_ETAPA, nuevo = llevan ? Math.round(xc.lleno * xc.monto) : v.faltaCasita, clave = (llevan ? "l" : "f") + v.actual;
    if (ultimaFalta !== null && ultimaFalta.k === clave && ultimaFalta.n !== nuevo && !ocultos() && !quieto()) contar(num, ultimaFalta.n, nuevo, 600, function (x) { return pesos(x); });
    else num.textContent = m$(nuevo);
    ultimaFalta = { k: clave, n: nuevo }; meta.textContent = llevan ? "Llevan en la casita " + (v.actual + 1) + SEP + "de " + m$(xc.monto) : "Faltan para la casita " + (v.actual + 1);
   }
   $("r-heroe-et").textContent = v.actual >= 0 ? "Casita " + (v.actual + 1) + SEP + matNombre(v.actual + 1) : "Su parte del pie";
   $("r-cifra-btn").setAttribute("aria-label", meta.textContent + ": " + num.textContent + ". Ver detalle de mi viaje");
   var ini = visibles().filter(function (a) { return a.de === quien && a.origen === "inicial" && a.estado === "verificado"; }).reduce(function (t, a) { return t + a.monto; }, 0), nI = 0, acI = 0;
   v.casitas.forEach(function (x) { acI += x.monto; if (acI <= ini + 0.5) nI++; });
   $("r-inicial").hidden = !(ini > 0 && nI > 0 && modoRuta !== "ajuste");
   $("r-inicial").textContent = "Su ahorro en Bci (" + m$(ini) + ") ya cuenta: completó " + nI + (nI === 1 ? " casita." : " casitas.");
   $("r-avatar").textContent = inicial(quien); $("r-avatar").className = "avatar av-" + quien;
   var dos = V.hayDos(cfg()), o = otro(quien), vo = dos ? vj(o) : null;
   pintarOjo(); renderAviso(v, prop);
   var aj = ultimoAjuste(), plan = per(quien).plan || 0;
   var mes = visibles().filter(function (a) { return a.de === quien && a.origen !== "inicial" && mesClave(new Date(a.fecha)) === mesClave(); }).reduce(function (t, a) { return t + a.monto; }, 0);
   var cam = V.dibujarCamino(modoRuta, d, { ancho: W, ajuste: libres, pie: cfg().pie, marca: aj && v.actual >= 0 ? { i: v.actual, txt: "Ajuste del " + fechaCorta(aj.t) } : null,
    mes: plan > 0 && mes >= plan ? "ok" : prop && prop.tipo !== "mas" ? "corto" : "", pausas: pausasPlan(v),
    otroMarca: dos && vo.actual >= 0 ? { i: vo.actual, inicial: inicial(o), p: o, nombre: nombre(o) } : null });
   $("camino-mapa").innerHTML = cam.svg; $("camino-mapa").setAttribute("data-y", cam.yActual);
   if (animAjuste) { var tipoA = animAjuste; animAjuste = false; var sv = $("camino-mapa").querySelector("svg"); if (sv && !quieto()) { sv.classList.add("aj-" + tipoA); setTimeout(function () { sv.classList.remove("aj-" + tipoA); }, 1300); } }
   $("camino-lista").innerHTML = d.casitas.map(function (x) {
    return "<li>Casita " + x.n + SEP + millones(x.monto) + SEP + (x.estado === "acunada" ? "lograda, verificada por Bci" : x.estado === "en-curso" ? "en curso, " + pct(x.lleno) : "por venir") + "</li>";
   }).join("") + (aj ? "<li>Ajuste del " + fechaCorta(aj.t) + ": " + plazo(aj.antes || 0) + " a " + plazo(aj.despues || 0) + ". Las casitas logradas se mantienen.</li>" : "");
   pintarFlotantes(); medirCamino(); revisarVolver();
   if (modoRuta === "ajuste" && prop) {
    $("aj-fila").textContent = "Aporte mensual " + m$(prop.antes) + " → " + m$(prop.plan);
    $("aj-titulo").textContent = prop.tipo === "mas" ? "Propuesta: llegar antes" : "Propuesta para su camino";
    var ajt = document.querySelector(".aj-txt").firstChild; if (ajt && ajt.nodeType === 3) ajt.nodeValue = prop.tipo === "mas" ? "Las casitas logradas se mantienen. Cambian solo las que faltan. " : "Este mes no hubo aporte. Las casitas logradas se mantienen y el camino se puede ajustar cuando quieran. ";
   }
  }
  function pausasPlan(v) {
   var P = per(quien), plan = P.plan || 0, hoy = new Date(); if (!plan || v.actual < 0) return [];
   return (P.planes || []).map(function (g, k) {
    var f = String(g.mes || "").split("-"), m = (parseInt(f[0], 10) - hoy.getFullYear()) * 12 + parseInt(f[1], 10) - 1 - hoy.getMonth(), meta = v.verificado + plan * Math.max(0, m), acu = 0, i = v.casitas.length - 1;
    for (var j = 0; j < v.casitas.length; j++) { acu += v.casitas[j].monto; if (acu >= meta) { i = j; break; } }
    return { i: Math.max(v.actual, i), k: k, txt: g.nombre };
   });
  }
  function renderAviso(v, prop) {
   var b = $("r-aviso"), c = cfg(), sol = (c.solicitudes || []).filter(function (s) { return s.estado === "pendiente" && s.para === quien; })[0];
   var fechas = {}; visibles().forEach(function (a) { if (a.de === quien && a.origen !== "inicial") fechas[a.fecha] = 1; });
   var reciente = v.casitas.filter(function (x) { return x.acunada && x.fecha && fechas[x.fecha] && Date.now() - Date.parse(x.fecha) < 7 * 864e5; }).slice(-1)[0];
   var html = "", cls = "pildora-aviso", accion = "";
   $("r-prop").hidden = !(prop && !sol && modoRuta !== "ajuste");
   if (prop) { $("r-prop-t").textContent = prop.tipo === "mas" ? "Pueden llegar antes" : "Su camino puede ajustarse"; }
   if (modoRuta === "ajuste") { b.hidden = true; return; }
   if (sol) { html = '<span class="punto"></span>' + esc(textoSolicitud(sol)); accion = "solicitud"; }
   else if (prop) { b.hidden = true; return; }
   else if (reciente) { cls += " verde"; html = '<span class="punto"></span>Casita ' + reciente.n + " lograda. Verificada por Bci."; accion = "ficha:" + reciente.i; }
   b.hidden = !html; b.className = cls; b.setAttribute("data-accion", accion);
   b.innerHTML = html + (html ? '<svg class="ic" aria-hidden="true"><use href="#i-chev"/></svg>' : "");
  }
  on("r-prop-ver", "click", function () { entrarAjuste(); });
  on("r-aviso", "click", function () {
   var a = this.getAttribute("data-accion") || "";
   if (a === "propuesta") entrarAjuste();
   else if (a === "solicitud") irA("juntos");
   else if (a.indexOf("ficha:") === 0) abrirFicha(quien, parseInt(a.slice(6), 10));
   else if (a === "primeros") abrirPrimerosPasos();
   else if (a === "aportar") abrirAportar();
  });
  on("r-cifra-btn", "click", function () { if (modoRuta === "ajuste") return; abrirDetalle(); ev("detalle"); });
  function activarDibujo(e) {
   var t = e.target.closest(".cm-marca,.pieza,.nodo,.medalla"); if (!t) return;
   if (e.type === "keydown") { if (e.key !== "Enter" && e.key !== " ") return; e.preventDefault(); }
   if (t.hasAttribute("data-marca")) { var aj = ultimoAjuste(); if (aj) abrirHoja("Ajuste del " + fechaCorta(aj.t), '<div class="antes-despues"><span class="ad-antes tabular">' + corto(aj.antes || 0) + '</span><svg class="ic" aria-hidden="true"><use href="#i-chev"/></svg><span class="ad-desp tabular">' + corto(aj.despues || 0) + '</span></div><p class="hoja-nota">Las casitas logradas se mantienen. Cambió solo lo que falta.</p>'); ev("marca_ajuste"); return; }
   if (t.hasAttribute("data-pausa")) { var g = (per(quien).planes || [])[+t.getAttribute("data-pausa")]; if (g) abrirHoja(g.nombre, '<div class="fila-datos"><span>Monto</span><strong>' + m$(g.monto) + '</strong></div><p class="hoja-nota">Nos adaptamos a esto: ese tramo del camino se alarga. Lo puede cambiar en Plan.</p>'); ev("marca_plan"); return; }
   if (t.classList.contains("medalla")) { irA("premios"); return; }
   abrirFicha(quien, parseInt(t.getAttribute("data-i"), 10));
  }
  ["mapa", "camino-mapa"].forEach(function (id) { $(id).addEventListener("click", activarDibujo); $(id).addEventListener("keydown", activarDibujo); });
  var animAjuste = false, caminoVisto = false;
  function corto(m) { m = Math.round(m); var y = Math.floor(m / 12), r = m % 12; return y ? y + (y === 1 ? " año" : " años") + (r ? " " + r + " m" : "") : r + (r === 1 ? " mes" : " meses"); }
  function ultimoAjuste() { return (cfg().cambios || []).filter(function (x) { return x.tipo === "ajuste" && x.por === quien; }).slice(-1)[0] || null; }
  function medirCamino(suave) {
   var z = $("r-camino"); if (vista !== "ruta" || $("pantalla-app").hidden) return;
   var tope = $("barra-inf").getBoundingClientRect().top || innerHeight - 64, h = Math.max(220, Math.round(tope - (z.getBoundingClientRect().top + window.scrollY) - 8));
   z.style.height = h + "px";
   var y = (parseFloat($("camino-mapa").getAttribute("data-y")) || 0) + $("camino-mapa").offsetTop;
   z.scrollTo({ top: Math.max(0, y - h / 2), behavior: suave && !quieto() ? "smooth" : "auto" });
   if (!caminoVisto && !quieto()) { caminoVisto = true; var s = $("camino-mapa").querySelector("svg"); if (s) { s.classList.add("dibujando"); setTimeout(function () { s.classList.remove("dibujando"); }, 1300); } }
  }
  function irAlCamino(suave) { medirCamino(suave); }
  on("btn-deslice", "click", function () { irAlCamino(true); ev("deslice"); tourAccion("camino"); });
  on("btn-volver", "click", function () { irAlCamino(true); });
  on("r-aportar", "click", function () { abrirAportar(per(quien).plan || 0); ev("heroe_aportar"); });
  function revisarVolver() {
   if (vista !== "ruta" || $("pantalla-app").hidden) return;
   var z = $("r-camino"), y = (parseFloat($("camino-mapa").getAttribute("data-y")) || 0) + $("camino-mapa").offsetTop, h = z.clientHeight, sc = z.scrollTop;
   var fuera = y < sc + 30 || y > sc + h - 30;
   $("btn-volver").hidden = !fuera || modoRuta === "ajuste";
   $("btn-volver").classList.toggle("arriba", y < sc + 30);
  }
  $("r-camino").addEventListener("scroll", function () { revisarVolver(); }, { passive: true });
  var anchoPrevio = ancho(), altoPrevio = innerHeight;
  window.addEventListener("resize", function () { var bajo = innerHeight < altoPrevio - 1 && vista === "ruta" && window.scrollY < 5 && !hayDialogo(); altoPrevio = innerHeight; if (ancho() !== anchoPrevio || bajo) { anchoPrevio = ancho(); if (estado && estado.config && quien) renderRuta(); } posicionarTour(); });

  /* Contador animado (6.1, 6.2): cifras con números tabulares */
  function contar(el, desde, hasta, ms, fmt) {
   var id = (el._cuenta || 0) + 1; el._cuenta = id;
   if (quieto() || !isFinite(desde) || !isFinite(hasta)) { el.textContent = fmt(hasta); return; }
   var t0 = null;
   (function paso(ts) {
    if (el._cuenta !== id) return;
    if (t0 === null) t0 = ts;
    var k = Math.min(1, (ts - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(Math.round(desde + (hasta - desde) * e));
    if (k < 1) requestAnimationFrame(paso);
   })(performance.now());
   setTimeout(function () { if (el._cuenta === id) el.textContent = fmt(hasta); }, ms + 80);
  }

  /* === Detalle de mi viaje (3.6) === */
  function abrirDetalle() {
   var v = vj(), P = per(quien), j = jj(), pr = V.premios(cfg(), estado.aportes, quien), prox = pr.filter(function (x) { return x.estado === "proximo"; })[0], prop = propuestaActiva();
   var mitad = Math.max(0, Math.ceil(v.parte / 2 - v.verificado)), renta = V.rentaPedida(j.total), baja = V.bajaPorCasita(cfg().pie / 10), html = "";
   html += '<section class="hoja-sec"><h3 class="rotulo">Próximos pasos</h3>' +
   (prox ? '<div class="fila-datos"><span>Falta para ' + esc(prox.titulo.toLowerCase()) + '</span><strong>' + m$(prox.falta) + "</strong></div>" : '<p class="hoja-nota">Logró todos los premios de su parte.</p>') +
   (prop ? '<button class="enlace" type="button" data-det="propuesta">Ver propuesta para su camino<svg class="ic" aria-hidden="true"><use href="#i-chev"/></svg></button>' : "") + "</section>";
   html += '<section class="hoja-sec"><h3 class="rotulo">Sus números</h3>' +
   '<div class="fila-datos"><span>Su parte verificada</span><strong id="r-ahorrado">' + mM(v.verificado) + " de " + mM(v.parte) + "</strong></div>" +
   (v.declarado > 0 ? '<div class="fila-datos"><span>Declarado (otra institución)</span><strong>' + m$(v.declarado) + "</strong></div>" : "") +
   '<div class="fila-datos"><span>Plan mensual</span><strong>' + m$(P.plan) + "</strong></div>" +
   '<div class="fila-datos"><span>A este ritmo llega en</span><strong id="r-meses">' + (v.falta === 0 ? "Ya llegó" : plazo(v.meses)) + "</strong></div>" +
   '<div class="fila-datos"><span>Falta para la mitad de su parte</span><strong>' + (mitad ? m$(mitad) : "Lista") + "</strong></div></section>";
   var tv = V.tipoVinculo(cfg());
   html += '<section class="hoja-sec"><h3 class="rotulo">Con qué renta postular</h3>' +
   '<div class="fila-datos"><span>Renta que pide el banco hoy</span><strong>' + m$(Math.round(renta / 1000) * 1000) + " al mes</strong></div>" +
   '<p class="hoja-nota">Cada casita de ' + millones(cfg().pie / 10) + " (un décimo del pie) baja la renta que pide el banco en unos " + pesos(Math.round(baja / 1000) * 1000) + ". El banco decide.</p>" +
   '<div class="fila-datos"><span>Ahorra como</span><strong>' + V.VINCULOS[tv].nombre + '</strong></div><p class="fuente">' + V.VINCULOS[tv].regla + " Bci, Crédito hipotecario, 9-11-2026.</p>" +
   '<button class="enlace" type="button" data-det="calculo">Cómo se calcula<svg class="ic" aria-hidden="true"><use href="#i-chev"/></svg></button></section>';
   html += '<div class="pila"><button class="boton secundario" type="button" data-det="ajustar">' + (prop ? "Ver propuesta" : "Cambiar mi aporte mensual") + '</button><button class="enlace centrado" type="button" data-det="simular">Simular un cambio<svg class="ic" aria-hidden="true"><use href="#i-chev"/></svg></button></div>';
   abrirHoja("Detalle de mi viaje", html);
  }

  /* === Juntos (3.8): vista conjunta, invitación por RUT o código, solicitud y salida === */
  var unionPend = false, INV = "cimiento:invitaciones";
  function personas() { return ["p1", "p2"].filter(function (p) { return estado.config.personas[p]; }); }
  function avatar(p, cls) { return '<span class="avatar av-' + p + (cls ? " " + cls : "") + '" aria-hidden="true">' + esc(inicial(p)) + "</span>"; }
  function invitaciones() { try { return JSON.parse(localStorage.getItem(INV) || "[]").filter(function (x) { return Date.parse(x.vence) > Date.now(); }); } catch (e) { return []; } }
  function guardarInv(l) { try { localStorage.setItem(INV, JSON.stringify(l)); } catch (e) {} }
  function codigoNuevo() { var a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = ""; for (var i = 0; i < 6; i++) s += a.charAt(Math.floor(Math.random() * a.length)); return s; }
  function billete(x) {
   var ok = x.estado === "acunada", n = x.n, cab = '<div class="bl-cab"><span class="bl-ic" aria-hidden="true">' + casitaHtml(x, 34) + '</span><span class="bl-tx"><span class="bl-t">Casita ' + n + SEP + matNombre(n) + '</span><span class="bl-v tabular">' + m$(x.monto) + "</span></span>";
   if (ok) return '<li class="billete" style="--mat:' + matColor(n) + '">' + cab + '<span class="chip ok">Lograda</span></div><p class="bl-eq">Equivale a ' + m$(x.monto) + ' depositados y verificados</p><div class="bl-acc"><button class="boton secundario chico" type="button" data-mc="ficha" data-i="' + x.i + '">Ver ficha</button><button class="boton secundario chico" type="button" data-mc="rescatar" data-i="' + x.i + '">Rescatar</button>' + (V.hayDos(cfg()) ? '<button class="boton secundario chico" type="button" data-mc="transferir" data-i="' + x.i + '">Transferir</button>' : "") + "</div></li>";
   var st = x.estado === "en-curso" ? "En curso" + SEP + pct(x.lleno) : x.estado === "rescatada" ? "Rescatada" : x.estado === "transferida" ? "Transferida" : "Por venir";
   return '<li class="billete gris">' + cab + '<span class="chip ' + (x.estado === "en-curso" ? "prox" : "gris") + '">' + st + "</span></div></li>";
  }
  function renderCasa() {
   var dos = V.hayDos(cfg()), W = Math.min(ancho(), 480), mapa = $("mapa"), dd = dos ? datosCasaDos().d : datosMapa().d, j = jj(), v = vj();
   mapa.innerHTML = V.dibujarMapa(dos ? "juntos" : "mio", dd, { ancho: W, escala: 1, sinTitulo: true, colores: dos, soloHitos: true, etiqueta: dos ? "Casa de los dos: cada pieza con el color de quien la construyó" : "Su casa: " + dd.puestas + " de 10 piezas puestas" });
   if (vista === "juntos" && !quieto() && !Store.sesion("armada:" + api.codigo)) { Store.sesion("armada:" + api.codigo, "1"); var s = mapa.querySelector("svg"); if (s) { s.classList.add("armando"); setTimeout(function () { s.classList.remove("armando"); }, 1600); } }
   var tot = dos ? j.total : v.verificado, meta = dos ? cfg().pie : v.parte, pc = meta ? Math.floor(tot / meta * 100) : 0, dec = dos ? j.declarado : v.declarado;
   var ley = (dos ? ["p1", "p2"].map(function (p) { return '<span><i style="background:' + V.COLOR_PERSONA[p].c + '"></i>' + esc(nombre(p)) + "</span>"; }).join("") : "") + (dec > 0 ? '<span><i style="background:#FFE300"></i>Declarado</span>' : "");
   $("j-hero").innerHTML = '<section class="j-hero" aria-label="' + esc((dos ? "Entre ambos: " : "Su parte: ") + (ocultos() ? "monto oculto" : millones(tot)) + " de " + millones(meta) + ", " + pc + " %") + '"><p class="j-et">' + (dos ? "Pie de la vivienda, entre ambos" : "Su parte del pie") + '</p><p class="j-cifras" aria-hidden="true"><span class="j-total">' + mM(tot) + '</span><span class="j-de">de ' + millones(meta) + '</span><span class="j-pct">' + pc + " %</span></p>" + (ley ? '<p class="j-colores" aria-hidden="true">' + ley + "</p>" : "") + "</section>";
  }  function renderJuntos() {
   var c = cfg(), est = V.estadoVinculo(c), tipo = V.tipoVinculo(c), j = jj(), html = "", VI = V.VINCULOS;
   var solPend = (c.solicitudes || []).filter(function (s) { return s.estado === "pendiente"; });
   $("badge-juntos").hidden = !solPend.some(function (s) { return s.para === quien; });
   renderCasa();
   if (j.dos) {
    var A = j.p1, B = j.p2, pie = c.pie, w = function (x) { return Math.max(0, x / pie * 100).toFixed(2) + "%"; };
    $("j-bajada").textContent = "Dos viajes, una casa.";
    html += '<button class="fila-tarjeta" type="button" data-j="vinculo"><span><small>Ahorran como</small><strong>' + VI[tipo].nombre + '</strong></span><span class="der">Cambiar<svg class="ic" aria-hidden="true"><use href="#i-chev"/></svg></span></button>';
    html += solPend.map(function (s) {
    return '<div class="aviso aviso-azul"><span><strong>' + esc(textoSolicitud(s)) + "</strong>" + (s.para === quien ? '<span class="dos-botones"><button class="boton secundario" type="button" data-sol="rechazar" data-id="' + esc(s.id) + '">Ahora no</button><button class="boton primario" type="button" data-sol="aceptar" data-id="' + esc(s.id) + '">Aceptar</button></span>' : '<br><span class="ayuda">Esperando la respuesta de ' + esc(nombre(s.para)) + ".</span>") + "</span></div>";
    }).join("");
    html += '<div class="pila"><button class="enlace centrado" type="button" data-j="simular">Simular un cambio<svg class="ic" aria-hidden="true"><use href="#i-chev"/></svg></button>' +
   '<button class="enlace centrado" type="button" data-j="salir">Dejar de ahorrar juntos</button></div>';
   } else {
    $("j-bajada").textContent = "Su casa, pieza por pieza.";
    var inv = c.vinculo && c.vinculo.inv, quienInv = tipo === "familiar" ? "Su familiar" : "Su pareja";
    if (est === "pendiente" && inv) {
    html += '<section class="tarjeta j-pend"><p class="rotulo" style="margin-top:0">Solicitud enviada' + SEP + "esperando respuesta</p>" +
   '<p class="hoja-nota" style="margin-top:0">' + (inv.via === "rut" ? "A: RUT " + esc(inv.rut) : "Código de invitación: <strong>" + esc(inv.codigo) + "</strong>") + SEP + VI[tipo].nombre + "</p>" +
   '<p class="ayuda">Vence el ' + fechaCorta(inv.vence) + " a las " + hora(inv.vence) + ". Nada se comparte hasta que acepte.</p>" +
   '<div class="dos-botones"><button class="boton secundario" type="button" data-j="reenviar">Reenviar</button><button class="boton terciario" type="button" data-j="cancelar">Cancelar solicitud</button></div></section>';
    } else if (est === "rechazada") html += '<p class="aviso aviso-azul"><svg class="ic" aria-hidden="true"><use href="#i-info"/></svg><span>' + quienInv + " aún no aceptó. Puede invitar cuando quiera.</span></p>";
    else if (est === "vencida") html += '<p class="aviso aviso-azul"><svg class="ic" aria-hidden="true"><use href="#i-info"/></svg><span>La invitación venció sin respuesta. Puede enviarla de nuevo.</span></p>';
    else if (est === "salida") html += '<p class="aviso aviso-azul"><svg class="ic" aria-hidden="true"><use href="#i-info"/></svg><span>Dejaron de ahorrar juntos. Cada uno conserva su camino, su avance y sus premios.</span></p>';
    html += '<section class="tarjeta j-vacio"><div class="j-ilus" aria-hidden="true">' + V.casita("lograda", 1, 44) + V.casita("curso", 0.3, 44) + '</div><p><strong>Cada uno con su camino,</strong><span>la casa se ve completa entre los dos.</span></p></section>';
    if (est !== "pendiente") html += '<h2 class="rotulo">Invitar a</h2>' + ["pareja", "familiar"].map(function (k) {
    return '<button class="fila-tarjeta" type="button" data-j="invitar-' + k + '"><span><strong>' + (k === "pareja" ? "Su pareja" : "Un familiar directo") + "</strong><small>" + VI[k].sub + '</small></span><span class="der"><svg class="ic" aria-hidden="true"><use href="#i-chev"/></svg></span></button>';
    }).join("");
    html += '<div class="pila"><button class="boton secundario" type="button" data-j="codigo">Tengo un código de invitación</button></div><p class="nota">Usted decide qué comparte. Puede salir cuando quiera y lo que ya logró se conserva.</p>';
   }
   $("j-cuerpo").innerHTML = html;
   if (unionPend && j.dos) { unionPend = false; var cu = $("j-cuerpo"); cu.classList.add("union"); setTimeout(function () { cu.classList.remove("union"); }, 900); confeti(14); }
  }
  on("j-cuerpo", "click", function (e) {
   var b = e.target.closest("[data-j],[data-sol]"); if (!b) return;
   if (b.hasAttribute("data-sol")) { responderSolicitud(b.getAttribute("data-id"), b.getAttribute("data-sol") === "aceptar"); return; }
   var q = b.getAttribute("data-j");
   if (q === "vinculo") abrirVinculo();
   else if (q === "simular") abrirSimular();
   else if (q === "salir") abrirHoja("Dejar de ahorrar juntos", '<p class="hoja-nota">Cada uno conserva su camino, su avance y sus premios. Solo deja de verse la vista conjunta.</p><div class="pila"><button class="boton primario" type="button" data-jx="salir">Dejar de ahorrar juntos</button><button class="boton terciario" type="button" data-cerrar="hoja">Volver</button></div>');
   else if (q === "invitar-pareja" || q === "invitar-familiar") abrirInvitar(q.slice(8));
   else if (q === "codigo") abrirCodigoInv();
   else if (q === "cancelar") { guardarInv(invitaciones().filter(function (x) { return x.pareja !== api.codigo; })); guardar(V.cancelarInvitacion(cfg()), "Solicitud cancelada."); ev("inv_cancelar"); }
   else if (q === "reenviar") { var iv = cfg().vinculo.inv; enviarInvitacion(V.tipoVinculo(cfg()), iv.via, iv.rut); }
  });
  on("hoja-cuerpo", "click", function (e) {
   var b = e.target.closest("[data-jx]"); if (!b) return;
   var q = b.getAttribute("data-jx");
   if (q === "salir") guardar(V.salir(cfg()), "Dejaron de ahorrar juntos. Lo logrado se conserva.").then(function () { cerrarDialogo("hoja"); ev("inv_salir"); });
   else if (q === "rut" || q === "codigo") {
    var tipo = (document.querySelector("input[name=inv-tipo]:checked") || {}).value || "pareja";
    if (q === "codigo") { enviarInvitacion(tipo, "codigo", null); return; }
    var r = $("inv-rut").value, err = $("inv-err");
    if (!V.validarRut(r)) { err.textContent = "Revise el RUT: debe tener el formato 12.345.678-9"; err.hidden = false; $("inv-rut").setAttribute("aria-invalid", "true"); $("inv-rut").focus(); return; }
    if (rutMem && V.enmascararRut(r) === rutMem) { err.textContent = "Ese es su propio RUT. Escriba el de la persona que invita."; err.hidden = false; $("inv-rut").focus(); return; }
    enviarInvitacion(tipo, "rut", V.enmascararRut(r));
   } else if (q === "unirse") {
    var cod = String($("inv-codigo").value || "").trim().toUpperCase(), x = invitaciones().filter(function (i) { return i.codigo === cod; })[0];
    if (!x) { $("inv-err2").textContent = "No encontramos ese código o ya venció. Revíselo con quien lo envió."; $("inv-err2").hidden = false; $("inv-codigo").focus(); return; }
    cerrarDialogo("hoja", true); recibirInvitacion(x);
   } else if (q === "si-acepto" || q === "no-ahora") responderInvitacion(q === "si-acepto");
   else if (q === "compartir") { var txt = "Ahorremos el pie juntos en Cimiento. Código de invitación: " + b.getAttribute("data-c") + " (vence en 48 horas)."; if (navigator.share) navigator.share({ title: "Cimiento", text: txt }).catch(function () {}); else copiar(txt, "Invitación copiada."); }
  });
  on("hoja-cuerpo", "input", function (e) { if (e.target.id === "inv-rut") { var c2 = V.limpiarRut(e.target.value).slice(0, 9); e.target.value = c2.length > 1 ? V.formatoRut(c2) : c2; $("inv-err").hidden = true; e.target.removeAttribute("aria-invalid"); } });
  function abrirInvitar(tipo) {
   abrirHoja(tipo === "familiar" ? "Invitar a un familiar" : "Invitar a su pareja", '<p class="bajada" style="margin-top:0">Le llegará una solicitud a su app Bci.</p>' +
   '<div class="campo"><input id="inv-rut" inputmode="text" autocomplete="off" maxlength="12" placeholder=" " aria-describedby="inv-err"><label for="inv-rut">RUT de ' + (tipo === "familiar" ? "su familiar" : "su pareja") + '</label></div><p id="inv-err" class="error" aria-live="assertive" hidden></p>' +
   '<fieldset style="border:0;padding:0;margin:var(--e4) 0 0"><legend class="rotulo" style="margin:0">¿Cómo ahorran juntos?</legend>' + ["pareja", "familiar"].map(function (k) {
    return '<label class="opcion"><input type="radio" name="inv-tipo" value="' + k + '"' + (k === tipo ? " checked" : "") + "><span><strong>" + V.VINCULOS[k].nombre + "</strong><small>" + (k === "pareja" ? "Codeudor no relacionado" : "Codeudor relacionado") + "</small></span></label>";
    }).join("") + '</fieldset><p class="ayuda">Con su RUT no se comparte nada hasta que acepte.</p>' +
   '<div class="pila"><button class="boton primario" type="button" data-jx="rut">Enviar solicitud</button><button class="boton secundario" type="button" data-jx="codigo">Prefiero compartir un código</button><button class="boton terciario" type="button" data-cerrar="hoja">Cancelar</button></div>', { foco: "inv-rut" });
  }
  function enviarInvitacion(tipo, via, rut) {
   var cod = codigoNuevo(), c = V.invitar(cfg(), { tipo: tipo, via: via, rut: rut, codigo: cod });
   guardar(c).then(function () {
    guardarInv(invitaciones().filter(function (x) { return x.pareja !== api.codigo; }).concat([{ codigo: cod, pareja: api.codigo, rut: rut || null, vence: c.vinculo.inv.vence }]));
    marcarPaso("invitar"); ev("inv_" + via);
    if (via === "codigo") abrirHoja("Código de invitación", '<p class="hoja-nota" style="margin-top:0">Compártalo con ' + (tipo === "familiar" ? "su familiar" : "su pareja") + '. Sirve una sola vez y vence en 48 horas.</p><p class="codigo-inv">' + cod + "</p>" +
   '<div class="pila"><button class="boton primario" type="button" data-jx="compartir" data-c="' + cod + '">Compartir código</button><button class="boton terciario" type="button" data-cerrar="hoja">Listo</button></div>');
    else { cerrarDialogo("hoja"); toast("Solicitud enviada. Nada se comparte hasta que acepte."); }
   });
  }
  function abrirCodigoInv() {
   abrirHoja("Tengo un código de invitación", '<div class="campo"><input id="inv-codigo" autocapitalize="characters" autocomplete="off" maxlength="6" placeholder=" " aria-describedby="inv-err2"><label for="inv-codigo">Código de 6 caracteres</label></div><p id="inv-err2" class="error" hidden></p>' +
   '<div class="pila"><button class="boton primario" type="button" data-jx="unirse">Continuar</button></div><p class="nota">Antes de unirse verá qué se comparte.</p>', { foco: "inv-codigo" });
  }
  var invRecibida = null;
  function recibirInvitacion(x) {
   conectar(x.pareja).then(function (a) {
    estado = a.estado(); var c = estado.config;
    if (!c || V.estadoVinculo(c) !== "pendiente") { toast("Esta invitación ya no está vigente."); return; }
    invRecibida = x; var de = c.personas.p1.nombre, B = BCI.persona("p2"), tipo = V.tipoVinculo(c);
    abrirHoja(de + " quiere ahorrar con usted", '<div class="j-av" style="justify-content:center;margin:var(--e2) 0">' + '<span class="avatar av-p1 grande">' + esc(de.charAt(0)) + '</span><span class="avatar av-p2 grande">' + esc(B.nombre.charAt(0)) + "</span></div>" +
   '<p class="bajada" style="text-align:center;margin-top:0">' + V.VINCULOS[tipo].nombre + "</p>" +
   '<h3 class="rotulo">Si acepta, ' + esc(de) + ' verá</h3><ul class="lista-check"><li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>Su avance total y sus casitas logradas</li><li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>Sus aportes verificados, no sus movimientos</li></ul>' +
   '<h3 class="rotulo">Usted seguirá con</h3><p class="hoja-nota" style="margin-top:0">Su propio camino y sus premios. Puede salir cuando quiera; lo logrado se conserva.</p>' +
   '<div class="pila"><button class="boton primario" type="button" data-jx="si-acepto">Aceptar</button><button class="boton secundario" type="button" data-jx="no-ahora">Ahora no</button></div>');
   }).catch(function () { toast("No pudimos abrir la invitación. Sus datos están a salvo."); });
  }
  function responderInvitacion(si) {
   var x = invRecibida; if (!x || !estado || !estado.config) return;
   guardarInv(invitaciones().filter(function (i) { return i.codigo !== x.codigo; }));
   if (!si) { api.guardarConfig(V.rechazar(cfg())).then(function () { cerrarDialogo("hoja"); ev("inv_rechazar"); toast("Listo. No se compartió nada."); }); return; }
   var B = BCI.persona("p2"), c = V.aceptar(cfg(), estado.aportes, { nombre: B.nombre, ingreso: B.ingreso, gastos: B.gastosSugeridos, capacidad: B.ingreso - B.gastosSugeridos, plan: B.ingreso - B.gastosSugeridos });
   c.personas.p2.consentimientoBci = new Date().toISOString();
   api.guardarConfig(c).then(function () { return esperarConfig(api); }).then(function (st) {
    estado = st; cerrarDialogo("hoja", true); ev("inv_aceptar"); unionPend = true; entrar("p2", { sinTour: true }); irA("juntos"); toast("Ahora ahorran juntos. Cada uno con su camino.");
   });
  }
  function abrirVinculo() {
   var t = V.tipoVinculo(cfg());
   abrirHoja("Con quién ahorro", '<p class="hoja-nota" style="margin-top:0">Define qué requisitos de Bci aplican al postular. Cambia los plazos.</p>' + ["solo", "familiar", "pareja"].map(function (k) {
    return '<label class="opcion"><input type="radio" name="vinc" value="' + k + '"' + (k === t ? " checked" : "") + "><span><strong>" + (V.VINCULOS[k].largo || "Solo") + "</strong><small>" + V.VINCULOS[k].regla + "</small></span></label>";
   }).join("") + '<p class="fuente">Bci, Crédito hipotecario, 9-11-2026.</p><div class="pila"><button class="boton primario" type="button" data-vinc="1">Guardar</button></div>');
  }
  on("hoja-cuerpo", "click", function (e) {
   if (!e.target.closest("[data-vinc]")) return;
   var k = (document.querySelector("input[name=vinc]:checked") || {}).value; if (!k) return;
   cambiarVinculo(k).then(function () { cerrarDialogo("hoja"); });
  });
  function cambiarVinculo(k) { var c = clonarCfg(); c.vinculo = c.vinculo || { estado: c.personas.p2 ? "aceptada" : "ninguno", de: "p1" }; c.vinculo.tipo = k; ev("vinculo_" + k); return guardar(c, "Listo: ahora ahorra como «" + V.VINCULOS[k].nombre + "». Cambian los plazos y requisitos."); }
  on("hoja-cuerpo", "click", function (e) {
   var b = e.target.closest("button"); if (!b) return;
   var det = b.getAttribute("data-det");
   if (det === "propuesta") { cerrarDialogo("hoja", true); entrarAjuste(); }
   else if (det === "calculo") abrirCalculoRenta();
   else if (det === "simular") { cerrarDialogo("hoja", true); abrirSimular(); }
   else if (det === "ajustar") { cerrarDialogo("hoja", true); if (propuestaActiva()) entrarAjuste(); else abrirSituacion(); }
   else if (b.hasAttribute("data-sol")) responderSolicitud(b.getAttribute("data-id"), b.getAttribute("data-sol") === "aceptar");
  });
  function abrirCalculoRenta() {
   var j = jj();
   abrirHoja("Cómo se calcula", '<p class="hoja-nota">El banco pide que la renta sea al menos 4 veces el dividendo. El dividendo sale del crédito: el valor de la vivienda menos el pie que ya tienen.</p>' +
   '<div class="fila-datos"><span>Vivienda de referencia</span><strong>4.900 UF (' + millones(V.CASO.precio) + ")</strong></div>" +
   '<div class="fila-datos"><span>Valor UF</span><strong>$41.157,43</strong></div>' +
   '<div class="fila-datos"><span>Tasa de referencia y plazo</span><strong>4,0 % · 25 años</strong></div>' +
   '<div class="fila-datos"><span>Ahorro verificado entre ambos</span><strong>' + mM(j.total) + "</strong></div>" +
   '<div class="fila-datos"><span>Renta que pide el banco</span><strong>' + m$(Math.round(V.rentaPedida(j.total) / 1000) * 1000) + " al mes</strong></div>" +
   '<p class="fuente">UF $41.157,43, SII 14-10-2026. Regla de renta: Bci, Crédito hipotecario, 9-11-2026. Es una referencia, no una evaluación de Bci. El banco decide.</p>');
  }

  /* === Ficha de la casita (3.4) === */
  function casitaHtml(x, w) { return V.casita(V.estadoCasita(x), x.lleno, w || 46); }
  function abrirFicha(p, i) {
   var v = vj(p), x = v.casitas[i]; if (!x) return;
   var mio = p === quien, n = x.n, html;
   html = '<div class="ficha-cab"><span class="ficha-casita" style="--mat:' + matColor(n) + '">' + casitaHtml(x, 46) + "</span>" +
   '<div><p class="ficha-t">Casita ' + n + SEP + matNombre(n) + '</p><p class="ficha-s">' + mM(x.monto) + SEP + "pieza " + n + " de 10" + (mio ? "" : SEP + esc(nombre(p))) + "</p></div></div>";
   if (x.estado === "acunada") {
    html += '<div class="ficha-estado"><span class="chip ok"><svg class="ic" style="width:14px;height:14px" aria-hidden="true"><use href="#i-check"/></svg>Verificada por Bci</span></div>' +
   (x.fecha ? '<p class="hoja-nota">Lograda el ' + fechaLarga(x.fecha) + ". Se mantiene aunque ajuste su camino.</p>" : "") + reconHtml(x.n) +
   '<div class="pila acciones-ficha"><button class="boton secundario" type="button" data-ficha="detalle" data-i="' + i + '" data-p="' + p + '">Ver detalle</button>' +
   (mio ? '<button class="boton secundario" type="button" data-ficha="rescatar" data-i="' + i + '">Rescatar</button>' + (V.hayDos(cfg()) ? '<button class="boton secundario" type="button" data-ficha="transferir" data-i="' + i + '">Transferir</button>' : "") : "") + "</div>";
   } else if (x.estado === "en-curso") {
    html += '<div class="ficha-estado"><span class="chip prox">En curso' + SEP + pct(x.lleno) + "</span></div><p class=\"hoja-nota\">Falta para esta casita: " + m$(Math.round((1 - x.lleno) * x.monto)) + "</p>" +
   (x.pend > 0 ? '<p class="aviso aviso-amarillo"><svg class="ic" aria-hidden="true"><use href="#i-alerta"/></svg><span>Incluye ' + m$(Math.round(x.pend * x.monto)) + " declarados: cuentan para su casa, pero no activan premios.</span></p>" : "") +
   (mio ? '<div class="pila"><button class="boton primario" type="button" data-ficha="aportar">Aportar</button></div>' : "");
   } else if (x.estado === "futura") {
    html += '<div class="ficha-estado"><span class="chip gris">Por venir</span></div><p class="hoja-nota">Se empieza al terminar la casita ' + (n - 1) + ". Si algo cambia, su tamaño puede cambiar. Las casitas logradas se mantienen.</p>";
   } else html += '<div class="ficha-estado"><span class="chip gris">' + (x.estado === "rescatada" ? "Rescatada" : "Transferida") + "</span></div>";
   html += '<p class="rotulo-pie">' + ROTULO + "</p>";
   abrirHoja("Casita " + n, html); ev("ficha"); marcarPaso("ficha");
  }
  function abrirDetalleCasita(p, i) {
   var x = vj(p).casitas[i]; if (!x) return;
   abrirHoja("Detalle de la casita " + x.n, '<div class="fila-datos"><span>Monto</span><strong>' + m$(x.monto) + '</strong></div><div class="fila-datos"><span>Material</span><strong>' + matNombre(x.n) + "</strong></div>" +
   (x.fecha ? '<div class="fila-datos"><span>Lograda el</span><strong>' + fechaLarga(x.fecha) + "</strong></div>" : "") + '<div class="fila-datos"><span>Estado</span><strong>Verificada por Bci</strong></div>' +
   '<p class="hoja-nota">Activo digital respaldado por un depósito Bci (concepto 2050 simulado).</p><div class="pila"><button class="boton terciario" type="button" data-ficha="volver-ficha" data-i="' + i + '" data-p="' + p + '">Volver</button></div>');
   ev("ficha_detalle");
  }
  on("hoja-cuerpo", "click", function (e) {
   var b = e.target.closest("[data-ficha]"); if (!b) return;
   var q = b.getAttribute("data-ficha"), i = parseInt(b.getAttribute("data-i"), 10);
   if (q === "aportar") { cerrarDialogo("hoja", true); abrirAportar(); }
   else if (q === "detalle") abrirDetalleCasita(b.getAttribute("data-p") || quien, i);
   else if (q === "volver-ficha") abrirFicha(b.getAttribute("data-p") || quien, i);
   else if (q === "rescatar") abrirRescate(i);
   else if (q === "transferir") abrirTransferir(i);
   else if (q === "rescate-ok") aplicarRescate(i);
   else if (q === "transferir-ok") { var cs = per(quien).casitas[i]; crearSolicitud({ tipo: "transferir", n: cs.n, monto: cs.monto }).then(function () { cerrarDialogo("hoja"); }); }
   else if (q === "volver") abrirFicha(quien, i);
  });
  function simularSalida(p, i) {
   var P = JSON.parse(JSON.stringify(per(p))), antes = V.viaje(P, estado.aportes, p), monto = P.casitas[i].monto;
   var ap = estado.aportes.concat([{ de: p, monto: -monto, estado: "verificado", origen: "rescate", fecha: new Date().toISOString() }]);
   P.casitas[i].estado = "rescatada"; P.casitas = V.redistribuir(P, ap, p);
   var desp = V.viaje(P, ap, p);
   return { monto: monto, casitas: P.casitas, mas: (isFinite(desp.meses) ? desp.meses : 0) - (isFinite(antes.meses) ? antes.meses : 0) };
  }
  function abrirRescate(i) {
   var s = simularSalida(quien, i), n = i + 1;
   abrirHoja("Rescatar la casita " + n, '<p class="hoja-nota">Qué ocurriría: vuelven ' + m$(s.monto) + " a su Cuenta Bci ••1234 (demostración) y la casita queda como rescatada.</p>" +
   '<div class="fila-datos"><span>Efecto en su ruta</span><strong>−1 casita, +' + s.mas + (s.mas === 1 ? " mes" : " meses") + "</strong></div>" +
   '<p class="hoja-nota">Las demás casitas logradas se conservan.</p><p class="pildora-concepto">' + ROTULO + "</p>" +
   '<div class="pila"><button class="boton primario" type="button" data-ficha="rescate-ok" data-i="' + i + '">Rescatar (simulado)</button><button class="boton terciario" type="button" data-ficha="volver" data-i="' + i + '">Volver</button></div>');
  }
  function aplicarRescate(i) {
   var s = simularSalida(quien, i), c = clonarCfg(), n = i + 1;
   c.personas[quien].casitas = s.casitas;
   c.cambios = (c.cambios || []).concat([{ t: new Date().toISOString(), por: quien, tipo: "rescate", txt: nombre(quien) + " rescató la casita " + n + " (simulado)." }]);
   api.agregarAporte({ de: quien, monto: -s.monto, fecha: new Date().toISOString(), estado: "verificado", origen: "rescate", casita: n })
    .then(function () { return guardar(c); }).then(function () { cerrarDialogo("hoja"); toast("Casita " + n + " rescatada (simulado). Lo demás se conserva."); });
  }
  function abrirTransferir(i) {
   var c = per(quien).casitas[i], n = i + 1;
   abrirHoja("Transferir la casita " + n, '<p class="hoja-nota">Qué ocurriría: la casita ' + n + " (" + m$(c.monto) + ") pasaría al viaje de " + esc(nombre(otro(quien))) + ". Como afecta a los dos, " + esc(nombre(otro(quien))) + " debe aceptarlo.</p>" +
   '<p class="pildora-concepto">' + ROTULO + '</p><div class="pila"><button class="boton primario" type="button" data-ficha="transferir-ok" data-i="' + i + '">Enviar solicitud</button><button class="boton terciario" type="button" data-ficha="volver" data-i="' + i + '">Volver</button></div>');
  }
  function textoSolicitud(s) {
   if (s.tipo === "transferir") return nombre(s.de) + " quiere transferir su casita " + s.n + " a " + nombre(s.para) + ".";
   if (s.tipo === "meta") return nombre(s.de) + " propone cambiar la meta conjunta a " + pesos(s.pie) + ".";
   if (s.tipo === "reparto") return nombre(s.de) + " propone otro reparto del pie.";
   return "Solicitud de " + nombre(s.de) + ".";
  }
  function crearSolicitud(s) {
   var c = clonarCfg(); s.id = Date.now().toString(36); s.de = quien; s.para = otro(quien); s.estado = "pendiente"; s.t = new Date().toISOString();
   c.solicitudes = (c.solicitudes || []).concat([s]);
   return guardar(c, "Solicitud enviada a " + nombre(otro(quien)) + ".");
  }
  function responderSolicitud(id, acepta) {
   var c = clonarCfg(), s = (c.solicitudes || []).filter(function (x) { return x.id === id; })[0]; if (!s || s.estado !== "pendiente") return;
   s.estado = acepta ? "aceptada" : "rechazada"; s.resuelta = new Date().toISOString();
   if (!acepta || s.tipo !== "transferir") { guardar(c, acepta ? "Listo." : "Solicitud rechazada. No cambia nada.").then(function () { cerrarDialogo("hoja"); }); return; }
   var A = c.personas[s.de], i = s.n - 1, monto = A.casitas[i].monto, ahora = new Date().toISOString();
   var ap = estado.aportes.concat([{ de: s.de, monto: -monto, estado: "verificado", origen: "transferencia", fecha: ahora }]);
   A.casitas[i].estado = "transferida"; A.casitas = V.redistribuir(A, ap, s.de);
   api.agregarAporte({ de: s.de, monto: -monto, fecha: ahora, estado: "verificado", origen: "transferencia", casita: s.n })
    .then(function () { return api.agregarAporte({ de: s.para, monto: monto, fecha: ahora, estado: "verificado", origen: "transferencia", desde: s.de, casita: s.n }); })
    .then(function () { return guardar(c, "Transferencia aceptada (simulado)."); }).then(function () { cerrarDialogo("hoja"); });
  }
  function guardar(c, msg) {
   if (api && api.modo === "sin-conexion") { toast("Sin conexión: los cambios esperan. Puede mirar su casa."); return Promise.reject(); }
   return api.guardarConfig(c).then(function () { if (msg) toast(msg); }, function () { toast("No pudimos actualizar. Sus datos están a salvo.", { accion: "Reintentar", fn: function () { guardar(c, msg); }, ms: 8000 }); });
  }

  /* === Ajuste del camino (3.7) === */
  function entrarAjuste() {
   if (!propuestaActiva()) return;
   if (vista !== "ruta") irA("ruta");
   modoRuta = "ajuste"; renderRuta(); window.scrollTo({ top: 0, behavior: quieto() ? "auto" : "smooth" });
   ev("propuesta_ver"); setTimeout(function () { $("aj-si").focus(); }, 80);
  }
  function salirAjuste() { modoRuta = "mio"; $("ajuste-panel").hidden = true; }
  on("aj-no", "click", function () {
   var pr = propuestaActiva(); if (pr) pref("prop:" + pr.id, "no");
   salirAjuste(); renderRuta(); toast("Listo. Su camino sigue igual; la propuesta queda en Detalle de mi viaje."); ev("propuesta_ahora_no");
  });
  on("aj-si", "click", function () {
   var pr = propuestaActiva(); if (!pr) return;
   var c = clonarCfg(), P = c.personas[quien], sim = V.simularPropuesta(per(quien), estado.aportes, quien, pr.plan, per(quien).forma);
   P.plan = pr.plan; P.casitas = sim.casitas; delete c.propuestas[quien];
   c.cambios = (c.cambios || []).concat([{ t: new Date().toISOString(), por: quien, tipo: "ajuste", antes: sim.mesesAntes, despues: sim.mesesDespues, txt: nombre(quien) + " ajustó su camino: " + pesos(pr.antes) + " → " + pesos(pr.plan) + " al mes." }]);
   salirAjuste(); animAjuste = pr.plan > pr.antes ? "mas" : "menos";
   guardar(c, "Camino ajustado. Las casitas logradas se mantienen."); ev("propuesta_aplicar");
  });

  /* === Aportar (4.1) === */
  var SALDO_DEMO = { p1: 5000000, p2: 3000000 };
  function esDemo() { return !!(api && /^demo/.test(api.codigo)); }
  function montoCompletar() { var v = vj(); if (v.actual < 0) return 0; var m = Math.ceil(v.faltaCasita / 500000) * 500000, s = saldoDisponible(); return s >= v.faltaCasita ? Math.min(m, s) : 0; }
  function saldoDisponible() {
   var base = Math.max(BCI.persona(quien).saldo, esDemo() ? SALDO_DEMO[quien] || 0 : 0), usado = visibles().filter(function (a) { return a.de === quien && a.origen === "cuenta-bci" && a.estado === "verificado" && mesClave(new Date(a.fecha)) === mesClave(); }).reduce(function (s, a) { return s + a.monto; }, 0);
   return Math.max(0, base - usado);
  }
  function montoAportar() { return digitos($("monto").value); }
  function efectoAporte(monto, origen) {
   var v = vj(); if (v.actual < 0) return null;
   var ap = estado.aportes.concat([{ de: quien, monto: monto, estado: origen === "otra" ? "declarado" : "verificado", origen: origen, fecha: new Date().toISOString() }]);
   var d = V.viaje(per(quien), ap, quien);
   return { n: v.actual + 1, antes: v.casitas[v.actual].lleno, despues: d.casitas[v.actual].lleno, completa: d.acunadas > v.acunadas, nueva: d.actual >= 0 ? d.actual + 1 : null, nuevaPct: d.actual >= 0 ? d.casitas[d.actual].lleno : 1 };
  }
  function pintarAportar() {
   var m = montoAportar(), origen = $("origen").value, saldo = saldoDisponible(), ef = efectoAporte(m, origen), ay = $("ayuda-monto");
   $("btn-aportar").textContent = (origen === "otra" ? "Declarar " : "Aportar ") + (m ? pesos(m) : "");
   $("ap-saldo").textContent = origen === "otra" ? "Ahorro en otra institución: usted lo declara y Bci aún no lo comprueba." : "Saldo disponible: " + m$(saldo) + SEP + "Dato Bci (demostración)";
   $("ap-otra").hidden = origen === "otra";
   var vC = vj(), mc = origen === "otra" ? 0 : montoCompletar(), bc = $("ap-completar"); bc.hidden = !mc || m === mc;
   if (mc) bc.innerHTML = "<strong>Completar la casita " + (vC.actual + 1) + "</strong><span>" + m$(mc) + "</span>";
   if (origen === "otra") { ay.className = "aviso aviso-amarillo"; ay.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-alerta"/></svg><span>Queda declarado: cuenta para su casa, pero no activa premios hasta que Bci lo verifique.</span>'; }
   else {
    ay.className = "aviso aviso-verde";
    ay.textContent = "Desde la Cuenta Bci queda verificado al instante y suma a sus premios." + (ef && m ? (ef.completa ? " Completa la casita " + ef.n + (ef.nueva ? " y la " + ef.nueva + " queda en " + pct(ef.nuevaPct) : "") + "." : " La casita " + ef.n + " pasa de " + pct(ef.antes) + " a " + pct(ef.despues) + ".") : "");
   }
  }
  function errorMonto(t) { var e = $("err-aporte"); e.textContent = t || ""; e.hidden = !t; if (t) { $("monto").setAttribute("aria-invalid", "true"); e.setAttribute("role", "alert"); } else { $("monto").removeAttribute("aria-invalid"); e.removeAttribute("role"); } }
  function abrirAportar(montoIni) {
   if (!estado || !estado.config) return;
   $("monto").value = pesos(montoIni || 500000); $("origen").value = "cuenta-bci";
   $("ap-paso1").hidden = false; $("ap-paso2").hidden = true; errorMonto(null); pintarAportar();
   abrirDialogo($("aportar")); ev("aportar_abrir");
  }
  on("monto", "input", function () { formatoMonto(this); errorMonto(null); pintarAportar(); });
  on("monto-menos", "click", function () { $("monto").value = pesos(Math.max(0, montoAportar() - 50000)); errorMonto(null); pintarAportar(); });
  on("monto-mas", "click", function () { $("monto").value = pesos(Math.min(50000000, montoAportar() + 50000)); errorMonto(null); pintarAportar(); });
  on("origen", "change", function () { errorMonto(null); pintarAportar(); });
  on("ap-completar", "click", function () { $("monto").value = pesos(montoCompletar()); errorMonto(null); pintarAportar(); ev("aportar_completar"); $("monto").focus(); });
  on("ap-otra", "click", function () { $("origen").value = "otra"; pintarAportar(); $("origen").focus(); });
  on("btn-mas", "click", function () { abrirAportar(); });
  function validarAporte() {
   var m = montoAportar(), origen = $("origen").value;
   if (!m) return "Escriba el monto.";
   if (m < 1000) return "El monto mínimo es $1.000.";
   if (origen === "cuenta-bci" && m > saldoDisponible()) return "El monto supera el saldo disponible de la cuenta.";
   if (m > 50000000) return "El monto máximo es $50.000.000.";
   return null;
  }
  on("form-aporte", "submit", function (e) {
   e.preventDefault();
   var err = validarAporte(); if (err) { errorMonto(err); $("monto").focus(); return; }
   var m = montoAportar(), origen = $("origen").value;
   if (m >= 1000000) {
    var ef = efectoAporte(m, origen);
    $("ap-resumen").innerHTML = '<div><dt>Monto</dt><dd>' + pesos(m) + '</dd></div><div><dt>Desde</dt><dd>' + (origen === "otra" ? "Otra institución (declarado)" : "Cuenta Bci ••1234") + "</dd></div>" +
   (ef ? "<div><dt>Efecto</dt><dd>" + (ef.completa ? "Completa la casita " + ef.n : "Casita " + ef.n + ": " + pct(ef.antes) + " → " + pct(ef.despues)) + "</dd></div>" : "");
    $("ap-paso1").hidden = true; $("ap-paso2").hidden = false; $("ap-confirmar").focus(); return;
   }
   registrarAporte(m, origen);
  });
  on("ap-confirmar", "click", function () { registrarAporte(montoAportar(), $("origen").value); });
  on("ap-volver", "click", function () { $("ap-paso2").hidden = true; $("ap-paso1").hidden = false; $("monto").focus(); });
  var propioAporte = null;
  function registrarAporte(m, origen) {
   if (api && api.modo === "sin-conexion") { errorMonto("Sin conexión: el aporte espera. Intente de nuevo cuando vuelva la señal."); return; }
   var desde = $("btn-aportar").getBoundingClientRect(), ver = origen !== "otra";
   var nuevo = { de: quien, monto: m, fecha: new Date().toISOString(), estado: ver ? "verificado" : "declarado", origen: origen, op: String(Math.floor(10000000 + Math.random() * 89999999)) };
   propioAporte = { t: Date.now() }; tourEspera = Date.now() + 1200;
   cerrarDialogo("aportar");
   api.agregarAporte(nuevo).then(function (a) {
    ev("aporte"); marcarPaso("aporte");
    if (ver) chispa(desde);
    vibrar(12);
    var logro = celebrarPend; celebrarPend = null;
    if (!logro) toast((ver ? "Aporte verificado: " : "Ahorro declarado: ") + pesos(m) + ".", { accion: "Deshacer", fn: function () { deshacerAporte(a.id); } });
    anunciar((ver ? "Aporte verificado de " : "Ahorro declarado de ") + pesos(m) + ".");
    setTimeout(function () {
    if (logro) celebrarLogro(logro, a); else luego(function () { abrirComprobante(a.id); });
    tourAccion("aporte");
    }, quieto() ? 0 : 650);
   }).catch(function () { toast("No pudimos registrar el aporte. Sus datos están a salvo.", { accion: "Reintentar", fn: function () { registrarAporte(m, origen); } }); });
  }
  function deshacerAporte(id) { api.resolverAporte(id, "anulado", quien).then(function () { ev("deshacer"); toast("Aporte deshecho. No se movió dinero (demostración)."); if ($("hoja").open) cerrarDialogo("hoja"); }); }
  function abrirComprobante(id) {
   var a = estado.aportes.filter(function (x) { return x.id === id; })[0]; if (!a) return;
   var ver = a.estado === "verificado", op = a.op || String(a.id || "").replace(/\D/g, "").slice(0, 8) || "—";
   abrirHoja("Comprobante", '<dl class="lista-datos"><div><dt>N.º de operación</dt><dd>' + esc(op) + '</dd></div><div><dt>Fecha y hora</dt><dd>' + fechaCorta(a.fecha) + SEP + hora(a.fecha) + "</dd></div>" +
   "<div><dt>Monto</dt><dd>" + m$(a.monto) + "</dd></div><div><dt>Origen</dt><dd>" + (a.origen === "cuenta-bci" ? "Cuenta Bci ••1234" : ORIGEN[a.origen] || a.origen) + "</dd></div>" +
   "<div><dt>Persona</dt><dd>" + esc(nombre(a.de)) + "</dd></div><div><dt>Estado</dt><dd>" + (a.estado === "anulado" ? '<span class="chip gris">Deshecho</span>' : '<span class="chip ' + (ver ? "ok" : "dec") + '">' + (ver ? "Verificado" : "Declarado") + "</span>") + "</dd></div></dl>" +
   (!ver && a.de === quien && a.estado !== "anulado" ? '<p class="hoja-nota">Para sumarlo a sus premios, Bci tendría que verificarlo en su cuenta.</p><div class="pila"><button class="boton secundario" type="button" data-verificar="' + esc(a.id) + '">Verificar en la Cuenta Bci (simulado)</button></div>' : "") +
   '<p class="nota">Comprobante de demostración. Sin valor legal.</p><div class="pila"><button class="boton primario" type="button" data-cerrar="hoja">Listo</button></div>');
  }
  on("hoja-cuerpo", "click", function (e) {
   var b = e.target.closest("[data-verificar]"); if (!b) return;
   api.resolverAporte(b.getAttribute("data-verificar"), "verificado", quien).then(function () { cerrarDialogo("hoja"); toast("Verificado (simulado). Ya suma a sus premios."); });
  });

  /* === Animaciones de aporte y logro (6.2, 6.3, 6.4) === */
  function chispa(desde) {
   if (quieto() || vista !== "ruta") return;
   var meta = document.querySelector("#mapa .pieza.pz-curso") || document.querySelector("#mapa .pieza.pz-hecha:last-of-type"); if (!meta) return;
   var r = meta.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
   var x0 = desde.left + desde.width / 2, y0 = Math.min(innerHeight - 120, desde.top + desde.height / 2), x1 = r.left + r.width / 2, y1 = r.top + r.height / 2;
   var c = document.createElement("i"); c.className = "chispa"; document.body.appendChild(c);
   var kf = []; for (var k = 0; k <= 8; k++) { var t = k / 8, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * 90; kf.push({ transform: "translate(" + x + "px," + y + "px) scale(" + (1 - t * 0.4) + ")", opacity: t > 0.9 ? 0 : 1 }); }
   var an = c.animate(kf, { duration: 500, easing: "cubic-bezier(.2,.8,.2,1)" }); an.onfinish = function () { c.remove(); };
  }
  function confeti(n) {
   if (quieto()) return;
   var cont = $("confeti"), cols = ["#2772CC", "#28892B", "#FFE300"], W = innerWidth;
   for (var i = 0; i < (n || 28); i++) {
    var p = document.createElement("i"); p.style.background = cols[i % 3]; p.style.left = (W * (0.2 + Math.random() * 0.6)) + "px"; p.style.top = (innerHeight * 0.32) + "px"; cont.appendChild(p);
    var dx = (Math.random() - 0.5) * 260, up = 80 + Math.random() * 120, rot = Math.random() * 540;
    var an = p.animate([{ transform: "translate(0,0) rotate(0)", opacity: 1 }, { transform: "translate(" + dx * 0.6 + "px," + (-up) + "px) rotate(" + rot / 2 + "deg)", opacity: 1, offset: 0.35 }, { transform: "translate(" + dx + "px," + (up * 1.4) + "px) rotate(" + rot + "deg)", opacity: 0 }],
     { duration: 1100 + Math.random() * 100, easing: "cubic-bezier(.2,.6,.4,1)" });
    an.onfinish = (function (el) { return function () { el.remove(); }; })(p);
   }
  }
  var celebrarPend = null;
  function celebrarLogro(lg, aporte) {
   var i = lg.i, svg = $("camino-mapa").querySelector("svg"), pieza = svg && svg.querySelector('.nodo[data-i="' + i + '"]');
   if (vista === "ruta" && pieza && !quieto()) {
    medirCamino(true);
    pieza.setAttribute("data-sube", ""); svg.classList.add("logro");
    var sello = svg.querySelector('.pz-sello[data-i="' + i + '"]'); if (sello) { var ck = sello.querySelector("path"); if (ck && ck.animate) ck.animate([{ strokeDasharray: "14", strokeDashoffset: "14" }, { strokeDasharray: "14", strokeDashoffset: "0" }], { duration: 280, delay: 650, fill: "backwards" }); }
    setTimeout(function () {
    var r = svg.getBoundingClientRect(), d = document.createElement("div"); d.className = "destello"; d.style.cssText = "left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px"; document.body.appendChild(d);
    var an = d.animate([{ backgroundPosition: "100% 0" }, { backgroundPosition: "-50% 0" }], { duration: 450 }); an.onfinish = function () { d.remove(); };
    }, 850);
    setTimeout(function () { confeti(28); }, 900);
    setTimeout(function () { svg.classList.remove("logro"); pieza.removeAttribute("data-sube"); }, 1500);
    vibrar([12, 60, 12]);
   }
   var x = vj().casitas[i];
   transitorio = { num: "Casita " + x.n + " lograda", meta: "Siguiente: " + (x.n < 10 ? x.n + 1 : "meta"), hasta: Date.now() + 4500 };
   renderRuta(); setTimeout(function () { transitorio = null; if (estado && estado.config) renderRuta(); }, 4600);
   anunciar("Casita " + x.n + " lograda. Verificada por Bci.");
   setTimeout(function () { luego(function () { abrirAcunado(i, lg.premio, aporte); }); }, quieto() ? 0 : 1000);
  }
  function reconHtml(n) { return '<p class="recon"><svg class="ic" aria-hidden="true"><use href="#i-premios"/></svg>' + (n <= 3 ? "Sello de la casita en su ficha" : n <= 6 ? "Registro de la casita en su informe de avance" : n <= 8 ? "Reconocimiento del ejecutivo en su próxima visita (idea para Bci)" : "Acceso a una asesoría de 15 minutos con un ejecutivo (idea para Bci)") + '</p><p class="rotulo-prop">Propuesta de Cimiento. Bci define si lo ofrece.</p>'; }
  function abrirAcunado(i, premio, aporte) {
   var v = vj(), x = v.casitas[i], sigX = v.casitas[i + 1], pr = V.premios(cfg(), estado.aportes, quien), prox = pr.filter(function (p) { return p.estado === "proximo"; })[0];
   abrirHoja("Casita " + x.n + " puesta", '<div class="ficha-cab"><span class="ficha-casita" style="--mat:' + matColor(x.n) + '">' + V.casita("lograda", 1, 46) + "</span>" +
   '<div><p class="ficha-t">Casita ' + x.n + ' lograda. Verificada por Bci.</p><p class="ficha-s">' + mM(x.monto) + SEP + matNombre(x.n) + "</p></div></div>" +
   (premio ? '<p class="premio-desb"><span aria-hidden="true">' + esc(premio.corto) + "</span>Premio desbloqueado: " + esc(premio.titulo.toLowerCase()) + "</p>" : "") + reconHtml(x.n) +
   (sigX && sigX.lleno > 0 ? '<p class="sig-iniciada"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>Casita ' + sigX.n + " ya empezó" + SEP + "lleva " + pct(sigX.lleno) + "</p>" : "") +
   (prox ? '<p class="fila-amarilla"><strong>Próximo premio: ' + esc(prox.corto === "1.ª" ? "primera casita" : prox.corto + " del pie") + "</strong><span>Falta para este premio: " + m$(prox.falta) + "</span></p>" : "") +
   '<div class="pila"><button class="boton primario" type="button" data-cerrar="hoja">Seguir</button>' + (aporte ? '<button class="boton terciario" type="button" data-comprobante="' + esc(aporte.id) + '">Ver comprobante</button>' : "") + "</div>");
   if (premio) cola.push(function () { abrirPremioDesbloqueado(premio); });
  }
  on("hoja-cuerpo", "click", function (e) { var b = e.target.closest("[data-comprobante]"); if (b) abrirComprobante(b.getAttribute("data-comprobante")); });
  function abrirPremioDesbloqueado(p) {
   var g = ""; for (var k = 0; k < 12; k++) g += '<polygon points="-6,-58 6,-58 0,-96" fill="' + (k % 2 ? "#FFF3A6" : "#D4E7D5") + '" transform="rotate(' + k * 30 + ')"/>';
   $("pm-rayos-g").innerHTML = g; $("pm-medalla").textContent = p.corto; $("pm-titulo").textContent = p.titulo; $("pm-txt").textContent = p.txt + " Propuesta de Cimiento. Bci define si lo ofrece.";
   abrirDialogo($("premio-modal")); setTimeout(function () { confeti(28); }, 300);
   vibrar([12, 60, 12]);
   anunciar("Premio desbloqueado: " + p.titulo + ".");
  }
  on("pm-ver", "click", function () { cerrarDialogo("premio-modal"); irA("premios"); });

  /* === Aportes (4.2) === */
  function tituloAporte(a) { return a.origen === "cuenta-bci" ? "Aporte desde Cuenta Bci" : a.origen === "otra" ? "Ahorro en otra institución" : a.origen === "inicial" ? "Ahorro inicial" : a.origen === "rescate" ? "Rescate de casita " + (a.casita || "") : "Transferencia de casita " + (a.casita || ""); }
  function renderAuto() {
   var A = pref("auto:" + clavePersona()), au = A ? JSON.parse(A) : { on: false, monto: per(quien).plan || 0 };
   $("ap-auto").innerHTML = '<label class="sw-fila"><span><strong>Aporte automático</strong><small>Simulado: no mueve dinero real.</small></span><input id="ap-auto-on" type="checkbox" role="switch"' + (au.on ? " checked" : "") + "></label>" +
    (au.on ? '<div class="campo"><input id="ap-auto-monto" inputmode="numeric" data-monto autocomplete="off" placeholder=" " value="' + pesos(au.monto || 0) + '"><label for="ap-auto-monto">Monto el día 5 de cada mes</label></div>' : "") +
    '<label class="sw-fila"><span><strong>Recordatorio mensual</strong><small>Un aviso en la app el día 5.</small></span><input id="ap-rec" type="checkbox" role="switch"' + (pref("recordar:" + clavePersona()) ? " checked" : "") + "></label>";
  }
  function renderAportes() {
   var dest = {}; personas().forEach(function (p) {
    var lim = [], acu = 0; vj(p).casitas.forEach(function (x) { lim.push([acu, acu += x.monto]); });
    var cum = 0; visibles().filter(function (a) { return a.de === p; }).slice().sort(function (a, b) { return Date.parse(a.fecha) - Date.parse(b.fecha); }).forEach(function (a) {
     var s0 = cum, s1 = cum += a.monto, ks = []; lim.forEach(function (l, k) { if (l[1] > s0 && l[0] < s1) ks.push(k + 1); });
     dest[a.id] = ks.length ? (ks.length === 1 ? "Sumó a la casita " + ks[0] : "Sumó a las casitas " + ks[0] + " a " + ks[ks.length - 1]) : "";
    });
   });
   document.querySelectorAll(".chip-filtro").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-filtro") === histFiltro ? "true" : "false"); });
   var hist = visibles().filter(function (a) { return histFiltro === "todos" || (histFiltro === "declarados" ? a.estado === "declarado" : a.estado === "verificado"); }).slice().reverse();
   var html = "", ant = null;
   hist.slice(0, 40).forEach(function (a) {
    var k = mesClave(new Date(a.fecha)), ver2 = a.estado === "verificado", d = new Date(a.fecha);
    if (k !== ant) { html += '<li class="grupo">' + ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : "") + "</li>"; ant = k; }
    html += '<li><button class="fila-aporte' + (ver2 ? "" : " dec") + '" type="button" data-aporte="' + esc(a.id) + '">' + avatar(a.de) +
   '<span><span class="fa-t">' + esc(tituloAporte(a)) + '</span><span class="fa-s">' + esc(nombre(a.de)) + SEP + fechaCorta(a.fecha) + (dest[a.id] ? SEP + dest[a.id] : "") + "</span></span>" +
   '<span class="fa-der"><span class="fa-monto">' + m$(a.monto) + '</span><span class="chip ' + (ver2 ? "ok" : "dec") + '">' + (ver2 ? "Verificado" : "Declarado") + "</span></span></button></li>";
   });
   $("lista-hist").innerHTML = html; $("hist-vacio").hidden = hist.length > 0;
   var misDec = visibles().filter(function (a) { return a.de === quien && a.estado === "declarado"; }).length, bd = $("badge");
   bd.hidden = true; bd.textContent = misDec;
  }
  document.querySelectorAll(".chip-filtro").forEach(function (b) { b.addEventListener("click", function () { histFiltro = b.getAttribute("data-filtro"); renderAportes(); ev("filtro_" + histFiltro); }); });
  on("ap-auto", "change", function (e) {
   if (e.target.id === "ap-rec") { pref("recordar:" + clavePersona(), e.target.checked ? "1" : null); ev(e.target.checked ? "rec_on" : "rec_off"); return; }
   if (e.target.id !== "ap-auto-on") return; pref("auto:" + clavePersona(), JSON.stringify({ on: e.target.checked, monto: per(quien).plan || 0 })); ev(e.target.checked ? "auto_on" : "auto_off"); renderAuto(); if (e.target.checked) toast("Aporte automático activado (simulado).");
  });
  on("ap-auto", "input", function (e) { if (e.target.id !== "ap-auto-monto") return; formatoMonto(e.target); pref("auto:" + clavePersona(), JSON.stringify({ on: true, monto: digitos(e.target.value) })); });
  on("reg-ayuda", "click", function () { var x = $("reg-explica"), ab = x.hidden; x.hidden = !ab; this.setAttribute("aria-expanded", ab ? "true" : "false"); });
  on("lista-hist", "click", function (e) { var b = e.target.closest("[data-aporte]"); if (b) abrirComprobante(b.getAttribute("data-aporte")); });
  on("casitas-fila", "click", function (e) { var b = e.target.closest("[data-mc]"); if (!b) return; var q = b.getAttribute("data-mc"), i = parseInt(b.getAttribute("data-i"), 10); ev("casita_" + q); if (q === "ficha") abrirFicha(quien, i); else if (q === "rescatar") abrirRescate(i); else abrirTransferir(i); });
  document.addEventListener("click", function (e) { var b = e.target.closest("[data-ir]"); if (!b) return; var d = b.getAttribute("data-ir"); if (d === "aportar") abrirAportar(); else irA(d); });

  /* === Premios (4.3) === */
  function renderPremios(animar) {
   var v = vj(), pr = V.premios(cfg(), estado.aportes, quien), logr = pr.filter(function (x) { return x.estado === "logrado"; }).length, prox = pr.filter(function (x) { return x.estado === "proximo"; })[0];
   var mcv = v.casitas.reduce(function (t, x) { return t + (x.estado === "acunada" ? x.monto : 0); }, 0);
   $("mc-valor").innerHTML = "Sus casitas valen <strong>" + mM(mcv) + "</strong>"; $("casitas-fila").innerHTML = v.casitas.map(billete).join(""); renderAuto();
   var umbrales = [v.casitas[0].monto, v.parte * 0.25, v.parte * 0.5, v.parte * 0.75, v.parte], ver = v.verificado, pos = 0;
   if (ver >= umbrales[4]) pos = 1; else if (ver >= umbrales[0]) { for (var k = 0; k < 4; k++) if (ver >= umbrales[k] && ver < umbrales[k + 1]) pos = (k + (ver - umbrales[k]) / (umbrales[k + 1] - umbrales[k])) / 4; }
   var paradas = pr.map(function (p, k) {
    var dentro = p.id === "primera" ? V.casita(p.estado === "logrado" ? "lograda" : p.estado === "proximo" ? "curso" : "futura", 0.3, 24) : p.id === "meta" ? '<svg class="ic" aria-hidden="true"><use href="#i-bandera"/></svg>' : p.corto;
    return '<span class="pr-parada ' + p.estado + (p.id === "primera" ? " casa" : "") + '" style="left:calc(22px + (100% - 44px) * ' + (k / 4) + ')" aria-hidden="true">' + dentro + "</span>";
   }).join("");
   $("pr-pista").innerHTML = '<div class="pr-linea"><i style="transform:scaleX(' + pos.toFixed(3) + ')"></i></div>' + paradas + '<span class="pr-hoy" style="left:calc(22px + (100% - 44px) * ' + pos.toFixed(3) + ')" aria-hidden="true">Hoy</span>' +
   '<p class="solo-lector">' + pr.map(function (p) { return p.titulo + ": " + (p.estado === "logrado" ? "logrado" : p.estado === "proximo" ? "próximo" : "bloqueado"); }).join(". ") + "</p>";
   $("pr-resumen").innerHTML = "<span>Su parte verificada: " + mM(v.verificado) + " de " + mM(v.parte) + '</span><span class="verde">' + logr + " de " + pr.length + " logrados</span>";
   if (animar && !quieto()) { var i = $("pr-pista").querySelector(".pr-linea i"); if (i && i.animate) i.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(" + pos.toFixed(3) + ")" }], { duration: 500, easing: "cubic-bezier(.2,.8,.2,1)" }); }
   var box = $("pr-prox");
   if (prox) {
    var idx = pr.indexOf(prox), base = idx > 0 ? (pr[idx - 1].id === "primera" ? v.casitas[0].monto : v.parte * pr[idx - 1].f) : 0, tramo = Math.max(0, Math.min(1, (ver - base) / Math.max(1, prox.meta - base)));
    var P = per(quien), mesesP = P.plan > 0 ? Math.max(1, Math.round(prox.falta / P.plan)) : null;
    box.hidden = false;
    box.innerHTML = '<div class="prox-cab"><span class="medalla-grande" aria-hidden="true">' + (prox.id === "primera" ? V.casita("curso", 0.3, 40) : prox.id === "meta" ? '<svg class="ic" aria-hidden="true"><use href="#i-bandera"/></svg>' : prox.corto) + "</span>" +
   '<div><p class="prox-et" id="t-pr-prox">Próximo premio</p><p class="prox-t">' + esc(prox.titulo) + '</p><p class="prox-x">' + esc(prox.txt) + "</p></div></div>" +
   '<div class="barra-av" role="progressbar" aria-label="Avance del tramo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.floor(tramo * 100) + '"><i style="transform:scaleX(' + tramo.toFixed(3) + ')"></i></div>' +
   '<p class="prox-linea"><span>Faltan <strong class="pr-falta">' + m$(prox.falta) + "</strong> verificados</span><span>" + pct(tramo) + " del tramo</span></p>" +
   '<button class="boton primario" type="button" data-pr="aportar" data-m="' + prox.falta + '">Aportar</button>' +
   (mesesP ? '<p class="ayuda">Con ' + m$(P.plan) + " al mes llega en " + mesesP + (mesesP === 1 ? " mes." : " meses.") + "</p>" : "") +
   '';
   } else { box.innerHTML = '<p class="prox-t">Logró todos los premios de su parte.</p>'; }
   $("r-hitos").innerHTML = pr.map(function (p) {
    var ic = p.id === "primera" ? V.casita(p.estado === "logrado" ? "lograda" : p.estado === "proximo" ? "curso" : "futura", 0.3, 26) : p.id === "meta" ? '<svg class="ic" aria-hidden="true"><use href="#i-bandera"/></svg>' : p.corto;
    var chip = p.estado === "logrado" ? '<span class="chip ok">Desbloqueado</span>' : p.estado === "proximo" ? '<span class="chip prox">Próximo</span>' : '<span class="pf-candado"><svg class="ic" aria-hidden="true"><use href="#i-candado"/></svg>Bloqueado</span>';
    return '<li class="premio-fila ' + p.estado + '"' + (p.estado === "proximo" ? ' aria-current="step"' : "") + '><span class="pm-ic' + (p.id === "primera" ? " casa" : "") + '" aria-hidden="true">' + ic + "</span><div>" +
   '<p class="pf-t">' + esc(p.titulo) + " " + chip + '</p><p class="pf-x">' + esc(p.txt) + "</p>" + (p.estado === "logrado" ? '<button class="boton secundario chico" type="button" data-pr="usar" data-id="' + p.id + '">Ver cómo usarlo</button>' : isFinite(p.falta) ? '<p class="pf-f">Faltan ' + m$(p.falta) + " verificados</p>" : "") + "</div></li>";
   }).join("");
   var dz = $("pr-decl"); dz.hidden = !(v.declarado > 0);
   dz.innerHTML = v.declarado > 0 ? '<svg class="ic" aria-hidden="true"><use href="#i-alerta"/></svg><span>' + m$(v.declarado) + ' declarado: verifíquelo para que cuente.</span><button class="enlace" type="button" data-pr="declarados">Ver<svg class="ic" aria-hidden="true"><use href="#i-chev"/></svg></button>' : "";
   var k2 = V.constancia(estado.aportes, null, quien), NIV = [["Bronce", 3, "Insignia de constancia en su perfil"], ["Plata", 6, "Su constancia queda en su perfil Bci y puede presentarla al pedir su crédito"], ["Oro", 12, "Asesoría con un ejecutivo"]];
   var sig = NIV.filter(function (x) { return k2.max < x[1]; })[0];
   $("pr-constancia").innerHTML = '<div class="nivel"><span class="nv-ins nv-' + (k2.nivel || "sin").toLowerCase() + '" aria-hidden="true">' + (k2.nivel ? k2.nivel.charAt(0) : "") + '</span><div><p class="nv-t">' + (k2.nivel ? "Nivel " + k2.nivel : "Aún sin nivel") + '</p><p class="nv-s tabular">' + k2.meses + (k2.meses === 1 ? " mes seguido" : " meses seguidos") + (sig ? SEP + sig[0] + ": faltan " + (sig[1] - k2.meses) + " meses" : "") + "</p></div></div>" +
   (k2.meses === 0 && k2.nivel ? '<p class="hoja-nota">Su racha vuelve a cero. Su nivel ' + k2.nivel + " se mantiene.</p>" : "") +
   '<ul class="niveles">' + NIV.map(function (x) { var ok = k2.max >= x[1]; return '<li class="' + (ok ? "ok" : "") + '"><strong>' + x[0] + "</strong> " + x[1] + " meses" + SEP + x[2] + (ok ? ' <span class="chip ok">Logrado</span>' : "") + "</li>"; }).join("") + '</ul><p class="rotulo-prop">Propuesta de Cimiento. Bci define si lo ofrece.</p>' +
   '<div class="meses-c">' + k2.ultimos.map(function (m) { return '<span class="mes-c' + (m.ok ? " ok" : "") + (m.actual ? " actual" : "") + (m.futuro ? " futuro" : "") + '" role="img" aria-label="' + esc(m.aria) + '"><i aria-hidden="true">' + (m.ok ? '<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>' : "") + '</i><span aria-hidden="true">' + esc(m.et) + "</span></span>"; }).join("") + "</div>" +
   '<p class="ayuda">Retomen cuando quieran: las casitas logradas se mantienen.</p>';
  }
  on("vista-premios", "click", function (e) {
   var b = e.target.closest("[data-pr]"); if (!b) return; var q = b.getAttribute("data-pr"); ev("premio_" + q);
   if (q === "aportar") abrirAportar(parseInt(b.getAttribute("data-m"), 10) || 0);
   else if (q === "declarados") { histFiltro = "declarados"; irA("juntos"); document.querySelectorAll(".chip-filtro").forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-filtro") === "declarados" ? "true" : "false"); }); renderAportes(); }
   else if (q === "usar") { var p = V.premios(cfg(), estado.aportes, quien).filter(function (x) { return x.id === b.getAttribute("data-id"); })[0]; if (p) abrirHoja(p.titulo, '<p class="hoja-nota">' + esc(p.txt) + '</p><div class="fila-datos"><span>Qué necesita</span><strong>Mantener sus casitas verificadas</strong></div><div class="fila-datos"><span>Cuándo se usaría</span><strong>Al pedir su crédito</strong></div><p class="rotulo-prop">Propuesta de Cimiento. Bci define si lo ofrece.</p><p class="fuente">Concepto 2050 · simulado, no es una oferta de Bci.</p>'); }
  });
  /* === Simular un cambio (4.4): hoja, no pestaña === */
  function abrirSimular() {
   var t = V.tipoVinculo(cfg()), r = document.querySelector('input[name=camino][value="' + t + '"]'); if (r) r.checked = true;
   sliderTocado = false; escNumPrev = null; confirmaUsar = false; renderEscenarios(false);
   $("sim-tip").hidden = !!pref("tip:simular");
   abrirDialogo($("simular")); marcarPaso("simular"); ev("simular"); tourAccion("simular");
  }
  var confirmaUsar = false;
  function pintarUsar() {
   var t = V.tipoVinculo(cfg()), cam = caminoSel(), z = $("sim-usar-zona");
   z.hidden = cam === t;
   $("sim-usar-txt").textContent = confirmaUsar ? "¿Confirma el cambio? Cambian los plazos y los requisitos de toda la app." : "Hoy ahorra como «" + V.VINCULOS[t].nombre + "». Si usa este camino, cambian los plazos y los requisitos.";
   $("sim-usar").textContent = confirmaUsar ? "Confirmar cambio" : "Usar este camino";
  }
  on("sim-usar", "click", function () {
   if (!confirmaUsar) { confirmaUsar = true; pintarUsar(); return; }
   confirmaUsar = false; cambiarVinculo(caminoSel()).then(function () { cerrarDialogo("simular"); });
  });
  on("sim-tip-ok", "click", function () { pref("tip:simular", "1"); $("sim-tip").hidden = true; });
  var NOM = { solo: "Solo", familiar: "Con un familiar", pareja: "Con su pareja" }, UF = V.UF, FALTA_50 = Math.round((50 * UF - V.CASO.rentaTitular) / 1000) * 1000;
  var escNumPrev = null;
  function caminoSel() { var el = document.querySelector("input[name=camino]:checked"); return el ? el.value : "pareja"; }
  function renderEscenarios(anim) {
   var j = jj(), s = $("slider");
   if (!sliderTocado) s.value = Math.max(+s.min, Math.min(+s.max, Math.round(j.plan / 50000) * 50000 || 1000000));
   var valor = parseInt(s.value, 10), cam = caminoSel(), m = {};
   ["solo", "familiar", "pareja"].forEach(function (k) { m[k] = V.mesesCamino(k, j.total, valor); });
   var mc = m[cam], max = Math.max(m.solo, 1);
   if (anim && escNumPrev !== null && isFinite(mc)) contar($("esc-num"), escNumPrev, mc, 320, function (x) { return String(x); }); else $("esc-num").textContent = isFinite(mc) ? mc : "—";
   escNumPrev = isFinite(mc) ? mc : null;
   $("esc-unidad").textContent = mc === 1 ? "mes" : "meses";
   $("esc-sub").textContent = isFinite(mc) ? V.anosMeses(mc) : "";
   $("esc-nota").hidden = cam !== "pareja"; $("esc-nota").textContent = "Si el titular llega a 50 UF de renta (hoy le faltan unos " + pesos(FALTA_50) + " al mes).";
   $("esc-solo-m").textContent = m.solo + " meses"; $("esc-solo-b").style.transform = "scaleX(1)";
   $("esc-fila-sel").hidden = cam === "solo";
   $("esc-sel-n").textContent = NOM[cam]; $("esc-sel-m").textContent = mc + " meses"; $("esc-sel-b").style.transform = "scaleX(" + Math.max(0.03, mc / max).toFixed(3) + ")";
   $("esc-frase").textContent = cam === "solo" ? "Solos llegan en " + m.solo + " meses." : NOM[cam] + " llegan en " + mc + " meses; solos, en " + m.solo + ".";
   $("slider-valor").textContent = pesos(valor);
   s.setAttribute("aria-valuetext", pesos(valor) + " al mes entre ambos"); s.style.setProperty("--f", ((valor - s.min) / (s.max - s.min)).toFixed(4));
   $("slider-meses").textContent = "Con " + pesos(valor) + " al mes entre ambos: " + NOM[cam].toLowerCase() + ", " + mc + " meses para llegar al pie.";
   pintarUsar();
  }
  on("camino", "change", function () { confirmaUsar = false; renderEscenarios(true); ev("camino_" + caminoSel()); });
  on("slider", "input", function () { sliderTocado = true; renderEscenarios(true); });
  on("slider-menos", "click", function () { var s = $("slider"); sliderTocado = true; s.value = Math.max(+s.min, +s.value - 50000); renderEscenarios(true); });
  on("slider-mas", "click", function () { var s = $("slider"); sliderTocado = true; s.value = Math.min(+s.max, +s.value + 50000); renderEscenarios(true); });
  on("btn-esc-det", "click", function () {
   var j = jj();
   abrirHoja("Cómo se calcula", '<p class="hoja-nota">Meses = lo que falta del pie para postular con la renta de cada camino, dividido por el aporte mensual de ambos.</p>' +
   '<div class="req"><h3 class="h4">Solo</h3><ul><li>Postula con la renta del titular ($1.700.000 en el caso).</li></ul></div>' +
   '<div class="req"><h3 class="h4">Con un familiar directo</h3><ul><li>Codeudor relacionado: titular desde 23 UF y codeudor desde 16 UF.</li><li>Renta del familiar: $1.200.000 (valor del caso).</li></ul></div>' +
   '<div class="req"><h3 class="h4">Con su pareja</h3><ul><li>Codeudor no relacionado: titular desde 50 UF y renta conjunta desde 70 UF; financiamiento hasta 80 % a 25 años.</li><li>Renta de la pareja: $1.300.000. Hoy al titular le faltan unos ' + pesos(FALTA_50) + " al mes para 50 UF.</li></ul></div>" +
   '<h3 class="rotulo">Supuestos</h3><p class="hoja-nota" style="margin-top:0">Renta pedida: al menos 4 veces el dividendo. 25 años, tasa de referencia 4,0 %, vivienda de 4.900 UF (UF $41.157,43, SII 14-10-2026). Parte de lo verificado (' + millones(j.total) + "), sin intereses ni reajustes. Requisitos según Crédito hipotecario Bci, 9-11-2026.</p>" +
   '<p class="hoja-nota"><strong>Simulación, no una evaluación de Bci. El banco decide.</strong></p><div class="pila"><button class="boton primario" type="button" data-cerrar="hoja">Entendido</button></div>');
   ev("escenarios_detalle");
  });

  /* === Mi cuenta (4.5) === */
  function renderCuenta() {
   ["c-demo-li", "c-volver-li", "c-persona-li"].forEach(function (id) { $(id).hidden = !esDemo(); });
   $("c-perfil-txt").textContent = nombre(quien) + SEP + "código " + (api ? api.codigo : "");
   $("c-pin-estado").textContent = pref("pin") ? "Activado" : "Desactivado";
   $("c-ocultar").checked = ocultos(); $("a-movimiento").checked = pref("movimiento") === "1";
   $("menu-quien").textContent = nombre(quien) + (V.hayDos(cfg()) ? SEP + "ahorra con " + nombre(otro(quien)) : "");
   $("c-vinculo-txt").textContent = V.VINCULOS[V.tipoVinculo(cfg())].nombre;
  }
  function aplicarPrefs() {
   var h = document.documentElement;
   h.classList.toggle("texto-grande", pref("tam") === "grande"); h.classList.toggle("alto-contraste", pref("contraste") === "1"); h.classList.toggle("sin-movimiento", pref("movimiento") === "1");
  }
  aplicarPrefs();
  function pintarOjo() { var o = ocultos(), b = $("ojo-ruta"); b.setAttribute("aria-pressed", o ? "true" : "false"); b.setAttribute("aria-label", o ? "Mostrar montos" : "Ocultar montos"); b.querySelector("use").setAttribute("href", o ? "#i-ojo-no" : "#i-ojo"); }
  on("ojo-ruta", "click", function () { pref("ocultar", ocultos() ? null : "1"); ultimaFalta = null; render(); });
  on("c-ocultar", "change", function () { pref("ocultar", this.checked ? "1" : null); ultimaFalta = null; render(); });
  on("a-movimiento", "change", function () { pref("movimiento", this.checked ? "1" : null); aplicarPrefs(); });
  on("c-perfil", "click", function () {
   abrirHoja("Perfil", '<div class="fila-datos"><span>Nombre</span><strong>' + esc(nombre(quien)) + "</strong></div>" + (rutMem ? '<div class="fila-datos"><span>RUT</span><strong>' + esc(rutMem) + "</strong></div>" : "") +
   (V.hayDos(cfg()) ? '<div class="fila-datos"><span>Ahorra con</span><strong>' + esc(nombre(otro(quien))) + "</strong></div>" : "") + '<div class="fila-datos"><span>Código compartido</span><strong>' + esc(api.codigo) + "</strong></div>" +
   '<div class="pila"><button class="boton secundario" type="button" data-copiar="codigo">Copiar código</button></div><p class="nota">El RUT se muestra enmascarado y no se guarda en este teléfono.</p>');
  });
  on("c-invitar", "click", function () { irA("juntos"); });
  on("c-vinculo", "click", function () { abrirVinculo(); });
  on("aj-simular", "click", function () { abrirSimular(); });
  function copiar(txt, ok) { (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast(ok); }, function () { toast("No se pudo copiar. Código: " + txt); }); }
  on("hoja-cuerpo", "click", function (e) { var b = e.target.closest("[data-copiar]"); if (b) copiar(api.codigo, "Código copiado."); });
  function abrirSituacion() {
   var P = per(quien);
   abrirHoja("Mi situación y mi camino", '<form id="sit-form" novalidate><p class="hoja-nota">Con esto dimensionamos su camino. Pueden cambiarlo cuando quieran.</p>' +
   '<div class="campo"><input id="s-ingreso" inputmode="numeric" data-monto placeholder=" " value="' + pesos(P.ingreso || 0) + '"><label for="s-ingreso">Ingreso mensual</label></div>' +
   '<div class="campo"><input id="s-gastos" inputmode="numeric" data-monto placeholder=" " value="' + pesos(P.gastos || 0) + '"><label for="s-gastos">Gastos fijos (opcional)</label></div>' +
   '<div class="campo"><input id="s-capacidad" inputmode="numeric" data-monto placeholder=" " value="' + pesos(P.capacidad || 0) + '"><label for="s-capacidad">Capacidad de ahorro mensual</label></div>' +
   '<div class="campo"><input id="s-plan" inputmode="numeric" data-monto placeholder=" " value="' + pesos(P.plan || 0) + '"><label for="s-plan">Plan mensual</label></div>' +
   '<p class="ayuda">Si cambia el plan, le mostramos la propuesta antes de aplicarla. Lo logrado se conserva.</p>' +
   '<fieldset class="hoja-sec" style="border:0;padding:0"><legend class="rotulo">Forma del camino</legend>' + Object.keys(V.FORMAS).map(function (f) {
    return '<label class="check"><input type="radio" name="forma" value="' + f + '"' + (P.forma === f ? " checked" : "") + '><span><strong>' + V.FORMAS[f].nombre + "</strong><br><span class=\"ayuda\">" + V.FORMAS[f].txt + "</span></span></label>";
    }).join("") + '</fieldset><div class="pila"><button class="boton primario" type="submit">Guardar</button></div></form>');
  }
  on("c-situacion", "click", abrirSituacion);
  on("hoja-cuerpo", "input", function (e) {
   if (e.target.matches("[data-monto]")) formatoMonto(e.target);
   if (/^s-(ingreso|gastos)$/.test(e.target.id)) $("s-capacidad").value = pesos(Math.max(0, digitos($("s-ingreso").value) - digitos($("s-gastos").value)));
  });
  on("hoja-cuerpo", "submit", function (e) {
   if (e.target.id !== "sit-form") return; e.preventDefault();
   var P = per(quien), c = clonarCfg(), Q = c.personas[quien], plan = digitos($("s-plan").value), forma = (document.querySelector("input[name=forma]:checked") || {}).value || P.forma;
   Q.ingreso = digitos($("s-ingreso").value); Q.gastos = digitos($("s-gastos").value); Q.capacidad = digitos($("s-capacidad").value);
   if (forma !== P.forma) { Q.forma = forma; Q.casitas = V.redistribuir(Q, estado.aportes, quien, forma, Q.plan); }
   if (plan > 0 && plan !== P.plan) { c.propuestas = c.propuestas || {}; c.propuestas[quien] = { id: "sit-" + Date.now(), p: quien, tipo: plan > P.plan ? "mas" : "menos", mes: 0, antes: P.plan, plan: plan }; }
   guardar(c, plan !== P.plan ? null : "Listo. Lo logrado se conserva.").then(function () { cerrarDialogo("hoja"); if (plan > 0 && plan !== P.plan) setTimeout(entrarAjuste, 250); });
  });
  function hashPin(pin) {
   var txt = "cimiento:" + pin;
   if (window.crypto && crypto.subtle && window.TextEncoder) return crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); });
   var h = 0; for (var i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) | 0; return Promise.resolve("s" + h);
  }
  on("c-pin", "click", function () {
   abrirHoja("PIN de acceso", '<p class="hoja-nota">Pide el PIN al abrir y tras 5 minutos sin uso. Se guarda solo como resumen cifrado en este teléfono.</p>' +
   '<div class="campo"><input id="pin1" type="password" inputmode="numeric" maxlength="4" placeholder=" " autocomplete="off"><label for="pin1">Nuevo PIN (4 dígitos)</label></div>' +
   '<div class="campo"><input id="pin2" type="password" inputmode="numeric" maxlength="4" placeholder=" " autocomplete="off"><label for="pin2">Repita el PIN</label></div><p id="pin-msg" class="error" hidden></p>' +
   '<div class="pila"><button class="boton primario" type="button" data-pin="guardar">Guardar PIN</button>' + (pref("pin") ? '<button class="boton terciario" type="button" data-pin="quitar">Quitar PIN</button>' : "") + "</div>");
  });
  on("hoja-cuerpo", "click", function (e) {
   var b = e.target.closest("[data-pin]"); if (!b) return;
   if (b.getAttribute("data-pin") === "quitar") { pref("pin", null); cerrarDialogo("hoja"); renderCuenta(); toast("PIN desactivado."); return; }
   var a = $("pin1").value, c = $("pin2").value, msg = $("pin-msg");
   if (!/^\d{4}$/.test(a)) { msg.textContent = "El PIN debe tener 4 dígitos."; msg.hidden = false; $("pin1").focus(); return; }
   if (a !== c) { msg.textContent = "Los PIN no coinciden."; msg.hidden = false; $("pin2").focus(); return; }
   hashPin(a).then(function (h) { pref("pin", h); ultimaActividad = Date.now(); cerrarDialogo("hoja"); renderCuenta(); toast("PIN activado en este teléfono."); });
  });
  on("c-datos", "click", function () { var P = per(quien); marcarPaso("datos"); conHojas(function (H) { abrirHoja("Mis datos y consentimientos", H.datos(P)); }); });
  on("hoja-cuerpo", "change", function (e) {
   if (e.target.id !== "cons-credito") return;
   var c = clonarCfg(); c.personas[quien].consentimientoCredito = e.target.checked ? new Date().toISOString() : null; ev(e.target.checked ? "cons_credito_si" : "cons_credito_no");
   guardar(c, e.target.checked ? "Autorización para crédito otorgada." : "Autorización para crédito retirada.");
  });
  on("hoja-cuerpo", "click", function (e) {
   var b = e.target.closest("[data-consent]"); if (!b) return;
   var q = b.getAttribute("data-consent");
   if (q === "descargar") {
    var P = per(quien), datos = { nombre: P.nombre, codigo: api.codigo, situacion: { ingreso: P.ingreso, gastos: P.gastos, capacidad: P.capacidad, plan: P.plan }, parte: P.parte, forma: P.forma, consentimientoBci: P.consentimientoBci || null, consentimientoCredito: P.consentimientoCredito || null, casitas: P.casitas,
    aportes: visibles().filter(function (a) { return a.de === quien; }).map(function (a) { return { fecha: a.fecha, monto: a.monto, estado: a.estado, origen: a.origen }; }), nota: "Prototipo académico. Datos de demostración." };
    descargar("cimiento-mis-datos.json", "application/json", JSON.stringify(datos, null, 2)); toast("Datos descargados."); return;
   }
   var c = clonarCfg(); c.personas[quien].consentimientoBci = q === "otorgar" ? new Date().toISOString() : null;
   guardar(c, q === "otorgar" ? "Autorización otorgada." : "Autorización revocada. Puede volver a darla cuando quiera.").then(function () { cerrarDialogo("hoja"); });
  });
  function descargar(nom, tipo, cont) { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([cont], { type: tipo })); a.download = nom; document.body.appendChild(a); a.click(); a.remove(); }
  on("c-notif", "click", function () {
   abrirHoja("Notificaciones", '<p class="hoja-nota">Avisos dentro de la app (no se piden permisos del teléfono).</p><ul class="lista-filas en-hoja">' +
    [["n-pareja", "Cuando mi pareja aporta"], ["n-recordatorio", "Recordatorio mensual de aporte"]].map(function (x) { return '<li><label class="fila interruptor"><span>' + x[1] + '</span><input type="checkbox" role="switch" data-pref="' + x[0] + '"' + (pref(x[0]) !== "0" ? " checked" : "") + '><span class="int-pista" aria-hidden="true"></span></label></li>'; }).join("") + "</ul>");
  });
  on("c-acces", "click", function () {
   abrirHoja("Accesibilidad", '<ul class="lista-filas en-hoja">' + [["movimiento", "Reducir animaciones"], ["tam", "Texto más grande"], ["contraste", "Más contraste en textos grises"]].map(function (x) {
    var on = x[0] === "tam" ? pref("tam") === "grande" : pref(x[0]) === "1";
    return '<li><label class="fila interruptor"><span>' + x[1] + '</span><input type="checkbox" role="switch" data-acc="' + x[0] + '"' + (on ? " checked" : "") + '><span class="int-pista" aria-hidden="true"></span></label></li>';
   }).join("") + '</ul><p class="nota">También respeta el ajuste de movimiento reducido del teléfono.</p>');
  });
  on("hoja-cuerpo", "change", function (e) {
   var t = e.target;
   if (t.hasAttribute("data-pref")) pref(t.getAttribute("data-pref"), t.checked ? "1" : "0");
   if (t.hasAttribute("data-acc")) { var k = t.getAttribute("data-acc"); pref(k, k === "tam" ? (t.checked ? "grande" : null) : (t.checked ? "1" : null)); aplicarPrefs(); renderCuenta(); if (estado && estado.config) renderRuta(); }
  });
  var hojasMod = null;
  function conHojas(fn) {
   if (hojasMod) { fn(hojasMod); return; }
   var s = document.createElement("script"); s.src = "js/hojas.js";
   s.onload = function () { hojasMod = window.CimientoHojas({ esc: esc }); fn(hojasMod); };
   s.onerror = function () { toast("No pudimos abrir esta hoja. Intente de nuevo."); };
   document.head.appendChild(s);
  }
  function abrirGlosario() { conHojas(function (H) { abrirHoja("Glosario y ayuda", H.glosario()); }); }
  function abrirAcerca() { conHojas(function (H) { abrirHoja("Acerca de este prototipo", H.acerca(location.href.split("?")[0], esDemo(), ROTULO)); }); }
  on("c-glosario", "click", abrirGlosario);
  on("c-acerca", "click", abrirAcerca);
  var avisoInstalar = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); avisoInstalar = e; });
  window.addEventListener("appinstalled", function () { avisoInstalar = null; ev("instalada"); });
  on("c-instalar", "click", function () {
   var instalada = window.matchMedia && matchMedia("(display-mode: standalone)").matches;
   abrirHoja("Instalar en el teléfono", (instalada ? '<p class="aviso aviso-verde">Cimiento ya está instalada en este teléfono.</p>' : "") +
    '<h3 class="rotulo">iPhone (Safari)</h3><ol class="pasos-instalar"><li>Toque Compartir (el cuadrado con la flecha).</li><li>Elija «Agregar a pantalla de inicio».</li><li>Toque «Agregar».</li></ol>' +
    '<h3 class="rotulo">Android (Chrome)</h3><ol class="pasos-instalar"><li>Toque el menú ⋮ arriba a la derecha.</li><li>Elija «Instalar aplicación» o «Agregar a la pantalla principal».</li></ol>' +
    (avisoInstalar ? '<div class="pila"><button class="boton primario" type="button" data-instalar="1">Instalar ahora</button></div>' : "") +
    '<p class="nota">Funciona sin conexión después de la primera visita. Prototipo académico, sin valor legal.</p>');
   ev("instalar_ver");
  });
  on("hoja-cuerpo", "click", function (e) {
   if (!e.target.closest("[data-instalar]") || !avisoInstalar) return;
   var a = avisoInstalar; avisoInstalar = null; a.prompt();
   (a.userChoice || Promise.resolve({})).then(function (r) { ev("instalar_" + (r.outcome || "fin")); cerrarDialogo("hoja"); });
  });
  if (window.visualViewport) {
   var vv = window.visualViewport, ajusteTeclado = function () { var k = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)); document.documentElement.style.setProperty("--teclado", (k > 60 ? k : 0) + "px"); };
   vv.addEventListener("resize", ajusteTeclado); vv.addEventListener("scroll", ajusteTeclado);
  }
  document.addEventListener("focusin", function (e) {
   var t = e.target; if (!t.matches || !t.matches("input,select,textarea")) return;
   setTimeout(function () { try { t.scrollIntoView({ block: "center", behavior: "auto" }); } catch (er) {} }, 300);
  });
  on("c-tour", "click", function () { irA("ruta"); modoRuta = "mio"; renderRuta(); iniciarTour(0); });
  on("c-primeros", "click", function () { abrirPrimerosPasos(); });
  on("hoja-cuerpo", "click", function (e) {
   var b = e.target.closest("[data-fac]"); if (!b) return;
   var q = b.getAttribute("data-fac");
   if (q === "finmes") simularFinMes();
   else if (q === "reiniciar") reiniciarDemo();
   else if (/registro$/.test(q)) {
    var l = []; try { l = JSON.parse(localStorage.getItem("cimiento:eventos") || "[]"); } catch (er) {}
    var txt = JSON.stringify({ app: "Cimiento", v: window.CIMIENTO_VERSION || "", exportado: new Date().toISOString(), eventos: l }, null, 1), nom = "cimiento-registro-" + (api ? api.codigo : "app") + ".json";
    if (q === "registro") { descargar(nom, "application/json", txt); toast("Registro descargado."); }
    else if (q === "copiar-registro") copiar(txt, "Registro copiado. Péguelo en test.html.");
    else {
     var arch = window.File ? new File([txt], nom, { type: "application/json" }) : null;
     if (arch && navigator.canShare && navigator.canShare({ files: [arch] })) navigator.share({ files: [arch], title: "Registro de prueba Cimiento" }).catch(function () {});
     else if (navigator.share) navigator.share({ title: "Registro de prueba Cimiento", text: txt }).catch(function () {});
     else copiar(txt, "Este navegador no comparte archivos: el registro se copió.");
    }
    ev("registro_" + q);
   }
  });
  function simularFinMes() {
   marcarPaso("finmes");
   var c = clonarCfg(), n = 0; c.propuestas = {};
   personas().forEach(function (p) { var pr = V.proponer(c.personas[p], estado.aportes, p); if (pr) { pr.id = "fm-" + Date.now() + p; c.propuestas[p] = pr; n++; } });
   return guardar(c, n ? "Fin de mes simulado: hay una propuesta para su camino." : "Fin de mes simulado: ambos van según lo previsto.").then(function () {
    cerrarDialogo("hoja");
    var pr = propuestaActiva(); if (pr && !pref("prop-auto:" + pr.id)) { pref("prop-auto:" + pr.id, "1"); setTimeout(entrarAjuste, 350); }
   });
  }
  var sembrando = false;
  function reiniciarDemo() {
   var q = quien; sembrando = true; celebrarPend = null;
   api.borrar().then(function () { return Store.sembrarDemo(api); }).then(function () { return esperarConfig(api); }).then(function (e) {
    estado = e; sembrando = false; Object.keys(localStorage).forEach(function (k) { if (/^cimiento:pref:(prop|tip:|pp|tour|premios18)/.test(k)) localStorage.removeItem(k); });
    try { sessionStorage.removeItem("cimiento:sesion:armada:" + api.codigo); } catch (er) {}
    cerrarDialogo("hoja", true); modoRuta = "mio"; ultimaFalta = null; entrar(q, { sinTour: true }); toast("Caso de ejemplo reiniciado.");
   });
  }
  function cerrarSesion() {
   try { localStorage.removeItem(SESION); sessionStorage.removeItem("cimiento:rut"); } catch (e) {}
   ["hoja", "aportar", "menu", "premio-modal", "simular"].forEach(function (id) { cerrarDialogo(id, true); });
   $("tour").hidden = true; $("bloqueo").hidden = true; ocultarTip();
   if (api) api.cerrar(); api = null; quien = null; estado = null; rutMem = null; modoRuta = "mio"; ultimaFalta = null; cerrarToast();
   mostrarEntrada();
  }
  var salirArmado = 0;
  on("btn-salir", "click", function () {
   if (Date.now() > salirArmado) { salirArmado = Date.now() + 4000; this.textContent = "Toque de nuevo para cerrar sesión"; var b = this; setTimeout(function () { b.textContent = "Cerrar sesión"; }, 4000); return; }
   salirArmado = 0; this.textContent = "Cerrar sesión"; ev("cerrar_sesion"); cerrarSesion();
  });

  /* === Menú, actividad === */
  on("btn-menu", "click", function () { renderCuenta(); abrirDialogo($("menu")); });
  on("menu", "click", function (e) {
   var b = e.target.closest("[data-menu]"); if (!b) return;
   var q = b.getAttribute("data-menu"); cerrarDialogo("menu", true);
   if (q === "primeros") abrirPrimerosPasos();
   else if (q === "tour") { irA("ruta"); modoRuta = "mio"; renderRuta(); iniciarTour(0); }
   else if (q === "glosario") abrirGlosario();
   else if (q === "acerca") abrirAcerca();
   else if (q === "persona") { var e2 = estado; mostrarEntrada(); $("form-login").hidden = true; $("form-codigo").hidden = true; elegirPersona(e2); }
  });
  function eventosActividad() {
   var c = cfg(), out = [];
   visibles().forEach(function (a) { if (a.origen === "cuenta-bci" || a.origen === "otra") out.push({ t: a.fecha, por: a.de, txt: nombre(a.de) + (a.estado === "verificado" ? " aportó " + m$(a.monto) + " (verificado)." : " declaró " + m$(a.monto) + " de otra institución.") }); });
   personas().forEach(function (p) { vj(p).casitas.forEach(function (x) { if (x.acunada && x.fecha) out.push({ t: x.fecha, por: p, txt: nombre(p) + " logró su casita " + x.n + "." }); }); });
   (c.cambios || []).forEach(function (x) { out.push({ t: x.t, por: x.por, txt: x.txt || "" }); });
   (c.solicitudes || []).forEach(function (s) { out.push({ t: s.resuelta || s.t, por: s.de, txt: textoSolicitud(s) + (s.estado === "pendiente" ? "" : s.estado === "aceptada" ? " Aceptada." : " Rechazada.") }); });
   return out.filter(function (x) { return x.por === quien || pref("n-pareja") !== "0"; }).sort(function (x, y) { return x.t < y.t ? 1 : -1; }).slice(0, 30);
  }
  function actualizarCampana() {
   if (!api || !estado || !estado.config) return;
   var k = "visto:" + api.codigo + ":" + quien; if (!pref(k)) pref(k, new Date(Date.now() - 7 * 864e5).toISOString());
   var visto = pref(k), n = eventosActividad().filter(function (x) { return x.t > visto && x.por !== quien; }).length, b = $("campana-badge");
   b.hidden = !n; b.textContent = n; $("btn-campana").setAttribute("aria-label", n ? "Actividad, " + n + " sin leer" : "Actividad");
  }
  on("btn-campana", "click", function () {
   var l = eventosActividad();
   abrirHoja("Actividad", l.length ? l.map(function (x) { return '<div class="fila-datos"><span>' + esc(x.txt) + "</span><strong>" + fechaCorta(x.t) + "</strong></div>"; }).join("") : '<p class="hoja-nota">Todavía no hay actividad.</p>');
   pref("visto:" + api.codigo + ":" + quien, new Date().toISOString()); actualizarCampana();
  });

  /* === Primeros pasos (5) === */
  function clavePersona() { return (api ? api.codigo : "") + ":" + quien; }
  var PP = [["aporte", function () { var v = vj(); return v.actual >= 0 ? "Completar la casita " + (v.actual + 1) + " con un aporte" : "Hacer un aporte"; }, "completar"], ["finmes", function () { return "Simular el fin de mes y ver la propuesta"; }, "finmes"],
   ["plan", function () { return "Cambiar el plan"; }, "aportes"], ["ficha", function () { return "Ver la ficha de una casita (rescatar o transferir)"; }, "premios"], ["datos", function () { return "Ver y revocar el uso de datos"; }, "datos"]];
  function ppDatos() { try { return JSON.parse(pref("pp:" + clavePersona()) || "{}"); } catch (e) { return {}; } }
  function marcarPaso(k) { if (!api || !quien) return; var d = ppDatos(); if (d[k]) return; d[k] = 1; pref("pp:" + clavePersona(), JSON.stringify(d)); }
  function abrirPrimerosPasos() {
   var d = ppDatos(), l = PP.filter(function (x) { return x[0] !== "finmes" || esDemo(); }).map(function (x) { return { ok: !!d[x[0]], txt: x[1](), dest: x[2] }; });
   conHojas(function (H) { abrirHoja("Qué probar", H.probar(l, esDemo())); });
  }
  on("hoja-cuerpo", "click", function (e) {
   var b = e.target.closest("[data-pp]"); if (!b) return;
   var q = b.getAttribute("data-pp"); cerrarDialogo("hoja", true); ev("probar_" + q);
   if (q === "completar") { irA("ruta"); abrirAportar(montoCompletar() || per(quien).plan); }
   else if (q === "finmes") { irA("ruta"); simularFinMes(); }
   else if (q === "datos") { irA("cuenta"); $("c-datos").click(); }
   else if (q === "volver") reiniciarDemo();
   else irA(q);
  });
  function abrirQuePropone() { conHojas(function (H) { abrirHoja("¿Qué es Cimiento?", H.que()); }); ev("que_es"); }
  on("btn-que", "click", abrirQuePropone); on("c-que", "click", abrirQuePropone);
  on("c-volver", "click", function () { ev("volver_caso"); reiniciarDemo(); });
  on("c-persona", "click", function () { var e2 = estado; mostrarEntrada(); $("form-login").hidden = true; $("form-codigo").hidden = true; elegirPersona(e2); });
  /* === Recorrido guiado de 6 pasos (5) === */
  var PASOS = [
   { sel: "r-sup", t: "Su próxima casita", x: function () { return "Casita = una meta pequeña de ahorro. Diez forman el pie de su vivienda."; } },
   { sel: "r-camino", t: "Su camino", x: function () { return "Lo logrado queda fijo. Lo que falta se adapta a usted."; } },
   { sel: "tab-juntos", t: "Casa", x: function () { return "La vivienda y quién construyó cada parte."; }, accion: "juntos" },
   { sel: "tab-premios", t: "Beneficios", x: function () { return "Sus casitas valen dinero. Cimiento propone que Bci reconozca cada etapa."; }, accion: "premios" },
   { sel: "tab-aportes", t: "Plan", x: function () { return "Cambie su ahorro o agregue planes: el camino se adapta."; }, accion: "plan" }
  ];
  var tourI = -1, tourPausado = false;
  function claveTour() { return "tour18:" + clavePersona(); }
  function tourEstado() { return pref(claveTour()) || "0"; }
  function iniciarTour(i) { tourI = i || 0; pref(claveTour(), String(tourI)); tourPausado = false; $("tour").hidden = false; pasoTour(tourI); ev("tour_inicio"); }
  function terminarTour(omitido) {
   $("tour").hidden = true; tourI = -1; pref(claveTour(), "fin"); ev(omitido ? "tour_omitir" : "tour_fin");
   if (esDemo()) setTimeout(function () { if (!hayDialogo()) abrirPrimerosPasos(); }, 500);
   else if (!omitido) setTimeout(function () { toast("Listo. Ya conoce su camino. Aporte cuando quiera."); }, 300);
   renderRuta();
  }
  function pasoTour(i) {
   if (i < 0 || i >= PASOS.length) { terminarTour(false); return; }
   tourI = i; pref(claveTour(), String(i));
   var p = PASOS[i];
   if (p.sel === "r-sup" || p.sel === "r-camino" || p.sel === "r-aportar") { if (vista !== "ruta") irA("ruta"); if (modoRuta !== "mio") { modoRuta = "mio"; renderRuta(); } }
   if (i <= 1) window.scrollTo(0, 0);
   $("tour-paso").textContent = (i + 1) + " de " + PASOS.length;
   $("tour-puntos").innerHTML = PASOS.map(function (x, k) { return '<i class="' + (k === i ? "on" : "") + '"></i>'; }).join("");
   $("tour-titulo").textContent = p.t; $("tour-texto").textContent = p.x();
   $("tour-sig").hidden = false; $("tour-sig").textContent = i === PASOS.length - 1 ? "Terminar" : "Siguiente"; $("tour-atras").style.visibility = i === 0 ? "hidden" : "";
   $("tour-bloq-c").hidden = !!p.accion;
   var foco = $("tour-foco"); foco.innerHTML = '<span class="tour-baliza"></span>';
   setTimeout(function () { posicionarTour(); $("tour-sig").focus({ preventScroll: true }); }, quieto() ? 0 : 80);
   ev("tour_paso_" + (i + 1));
  }
  function posicionarTour() {
   if (tourI < 0 || $("tour").hidden) return;
   var el = $(PASOS[tourI].sel); if (!el) return;
   var r = el.getBoundingClientRect(), pad = 6, f = $("tour-foco"), g = $("tour-globo");
   if (PASOS[tourI].sel === "r-camino") { r = { left: Math.max(4, r.left), top: Math.max(r.top, 130), right: Math.min(innerWidth - 4, r.right), bottom: Math.min(r.bottom - 4, innerHeight - 150) }; r.width = r.right - r.left; r.height = r.bottom - r.top; }
   var L = r.left - pad, T = r.top - pad, Wd = r.width + 2 * pad, H = r.height + 2 * pad;
   f.style.left = L + "px"; f.style.top = T + "px"; f.style.width = Wd + "px"; f.style.height = H + "px";
   f.style.borderRadius = /^tab-/.test(PASOS[tourI].sel) || PASOS[tourI].sel === "r-aportar" ? "999px" : "16px";
   var b = document.querySelectorAll(".tour-bloq[data-b]");
   b[0].style.cssText = "left:0;top:0;right:0;height:" + Math.max(0, T) + "px"; b[1].style.cssText = "left:0;right:0;bottom:0;top:" + (T + H) + "px";
   b[2].style.cssText = "left:0;top:" + T + "px;width:" + Math.max(0, L) + "px;height:" + H + "px"; b[3].style.cssText = "right:0;top:" + T + "px;left:" + (L + Wd) + "px;height:" + H + "px";
   $("tour-bloq-c").style.cssText = "left:" + L + "px;top:" + T + "px;width:" + Wd + "px;height:" + H + "px";
   var gw = g.offsetWidth, gh = g.offsetHeight, espAbajo = innerHeight - (T + H) - 96, abajo = espAbajo > gh + 20 || T < gh + 30;
   var left = Math.max(16, Math.min(innerWidth - 16 - gw, r.left + r.width / 2 - gw / 2)), top = abajo ? T + H + 14 : Math.max(8, T - 14 - gh);
   g.style.left = left + "px"; g.style.top = top + "px"; g.classList.toggle("abajo", abajo); g.classList.toggle("arriba", !abajo);
   g.style.setProperty("--flecha", Math.max(20, Math.min(gw - 20, r.left + r.width / 2 - left)) + "px");
  }
  var tourEspera = 0; // tras un aporte o un logro, el globo espera a que terminen la animación y la hoja
  function pausarTour() { if (tourI >= 0 && !$("tour").hidden) { tourPausado = true; $("tour").hidden = true; } }
  function reanudarTour() {
   if (tourI < 0 || !tourPausado) return;
   if (Date.now() < tourEspera || hayDialogo()) { setTimeout(reanudarTour, Math.max(120, tourEspera - Date.now() + 60)); return; }
   tourPausado = false; $("tour").hidden = false; pasoTour(tourI);
  }
  function tourAccion(tipo) {
   if (tourI < 0 || PASOS[tourI].accion !== tipo) return;
   var sig = tourI + 1;
   if (tipo === "aporte") { tourI = sig; pref(claveTour(), String(sig)); tourPausado = true; reanudarTour(); } else pasoTour(sig);
  }
  on("tour-sig", "click", function () { pasoTour(tourI + 1); });
  on("tour-atras", "click", function () { pasoTour(Math.max(0, tourI - 1)); });
  on("tour-omitir", "click", function () { terminarTour(true); });
  on("tour", "keydown", function (e) {
   if (e.key === "Escape") { e.preventDefault(); terminarTour(true); return; }
   if (e.key === "Tab") { var f = [].slice.call($("tour-globo").querySelectorAll("button:not([hidden])")); if (PASOS[tourI] && PASOS[tourI].accion) { var t = $(PASOS[tourI].sel); if (t) f.push(t); } var i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && tourI >= 0 && !$("tour").hidden && !hayDialogo()) terminarTour(true); });
  window.addEventListener("scroll", function () { if (tourI >= 0) posicionarTour(); }, { passive: true });

  /* === Sugerencias de primer uso (una por pantalla) === */
  var TIPS = { premios: "Toque un premio desbloqueado para ver cómo usarlo.", aportes: "Toque un aporte para ver su comprobante.", juntos: "Sus casitas logradas valen dinero. Tóquelas para verlas o usarlas." };
  var tipActual = null;
  function mostrarTip(k) {
   if (!TIPS[k] || !api || pref("tip:" + k) || tourI >= 0 || tourEstado() !== "fin" || hayDialogo()) return;
   tipActual = k; $("tip-txt").textContent = TIPS[k]; $("tip").hidden = false;
   $("tip").style.bottom = "calc(var(--barra) + var(--seguro) + " + ($("btn-mas").hidden ? 40 : 100) + "px)";
  }
  function ocultarTip() { $("tip").hidden = true; }
  on("tip-ok", "click", function () { if (tipActual) pref("tip:" + tipActual, "1"); ocultarTip(); });

  /* ---------- cambios de datos ---------- */
  function onCambio(s) {
   var antes = estado; estado = s;
   if (s.config) guardarCache(s);
   if (sembrando || !(api && quien && s.config && !$("pantalla-app").hidden)) return;
   if (antes && antes.config && antes.config.personas) {
    var va = V.viaje(antes.config.personas[quien], antes.aportes, quien), vn = V.viaje(s.config.personas[quien], s.aportes, quien);
    var pn = V.premios(s.config, s.aportes, quien), vistos = (pref("premios18:" + clavePersona()) || "").split(",");
    var nuevoPremio = pn.filter(function (x) { return x.estado === "logrado" && vistos.indexOf(x.id) < 0; })[0];
    pref("premios18:" + clavePersona(), pn.filter(function (x) { return x.estado === "logrado"; }).map(function (x) { return x.id; }).concat(vistos).filter(Boolean).join(","));
    if (vn.acunadas > va.acunadas) {
    var idx = -1; vn.casitas.forEach(function (x, k) { if (x.acunada && !va.casitas[k].acunada) idx = k; });
    if (idx >= 0) { celebrarPend = { i: idx, premio: nuevoPremio }; if (!propioAporte || Date.now() - propioAporte.t > 3000) { var lg = celebrarPend; celebrarPend = null; render(); celebrarLogro(lg, null); return; } }
    } else if (nuevoPremio) luego(function () { abrirPremioDesbloqueado(nuevoPremio); });
    var ea = V.estadoVinculo(antes.config), en = V.estadoVinculo(s.config);
    if (quien === "p1" && ea === "pendiente" && en === "aceptada") { unionPend = true; toast(nombre("p2") + " aceptó: ahora ahorran juntos. Cada uno con su camino."); }
    if (quien === "p1" && ea === "pendiente" && en === "rechazada") toast("Su invitación aún no fue aceptada. Puede volver a invitar cuando quiera.");
    var ids = {}; antes.aportes.forEach(function (a) { ids[a.id] = 1; });
    s.aportes.forEach(function (a) { if (!(a.id in ids) && a.de !== quien && (a.origen === "cuenta-bci" || a.origen === "otra") && pref("n-pareja") !== "0") toast(nombre(a.de) + (a.estado === "verificado" ? " aportó " : " declaró ") + m$(a.monto) + "."); });
   }
   render();
  }
  function guardarCache(s) { try { if (api && api.codigo) localStorage.setItem("cimiento:cache:" + api.codigo, JSON.stringify({ t: Date.now(), s: s })); } catch (e) {} }
  function leerCache(c) { try { var x = JSON.parse(localStorage.getItem("cimiento:cache:" + c)); return x && x.s && x.s.config && x.s.config.v === V.V ? x : null; } catch (e) { return null; } }

  /* ---------- conexión, sesión y entrada ---------- */
  function guardarSesion() { try { localStorage.setItem(SESION, JSON.stringify({ codigo: api.codigo, quien: quien })); } catch (e) {} }
  function leerSesion() { try { return JSON.parse(localStorage.getItem(SESION)); } catch (e) { return null; } }
  function cargarServidor() {
   var c = window.CIMIENTO_FIREBASE; if (!c || !c.projectId || typeof firebase !== "undefined") return Promise.resolve();
   function s(src) { return new Promise(function (ok) { var x = document.createElement("script"); x.src = src; x.onload = ok; x.onerror = ok; document.head.appendChild(x); }); }
   return s("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js").then(function () { return s("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"); }).then(function () { return s("js/store-servidor.js"); });
  }
  function conectar(codigo) {
   $("estado-conexion").textContent = "Conectando…";
   return cargarServidor().then(function () { return Store.open(codigo, onCambio); }).then(function (a) { api = a; estado = a.estado(); $("estado-conexion").textContent = ""; return a; })
    .catch(function (err) { $("estado-conexion").textContent = "No pudimos conectar. Sus datos están a salvo; intente de nuevo."; throw err; });
  }
  function esperarConfig(a, n) { return new Promise(function (ok) { (function sondear(k) { if (a.estado().config || k <= 0) ok(a.estado()); else setTimeout(function () { sondear(k - 1); }, 120); })(n || 25); }); }
  function mostrarEntrada() {
   mostrarSolo("pantalla-entrada");
   $("form-login").hidden = false; $("paso-persona").hidden = true; $("form-codigo").hidden = true; $("btn-tengo-codigo").setAttribute("aria-expanded", "false");
   if (!$("rut").value) $("rut").value = "11.111.111-1";
   if (!$("clave").value) $("clave").value = "demo1234";
  }
  function elegirPersona(e) {
   $("paso-persona").hidden = false;
   $("botones-persona").innerHTML = ["p1", "p2"].map(function (p) { return '<button class="boton primario" type="button" data-quien="' + p + '">Soy ' + esc(e.config.personas[p].nombre) + "</button>"; }).join("");
  }
  on("botones-persona", "click", function (e) { var b = e.target.closest("[data-quien]"); if (b) entrar(b.getAttribute("data-quien"), {}); });
  function entrar(p, op) {
   op = op || {};
   quien = p; guardarSesion(); vista = "ruta"; modoRuta = "mio"; ultimaFalta = null; caminoVisto = false;
   mostrarSolo("pantalla-app");
   irA("ruta", { sinScroll: true });
   if (!pref("premios18:" + clavePersona())) pref("premios18:" + clavePersona(), V.premios(cfg(), estado.aportes, quien).filter(function (x) { return x.estado === "logrado"; }).map(function (x) { return x.id; }).join(",") || "-");
   if (op.sinTour) pref(claveTour(), "fin");
   if (op.conTour) pref(claveTour(), "0");
   render(); marcarPaso("casa");
   var remedir = function () { if (quien && estado && estado.config && vista === "ruta" && !hayDialogo()) renderRuta(); };
   if (document.fonts && document.fonts.ready) document.fonts.ready.then(remedir);
   setTimeout(remedir, 500); setTimeout(remedir, 1600);
   if (window.ResizeObserver && !window.__cimientoRO) {
    var tRO = null, altos = {};
    window.__cimientoRO = new ResizeObserver(function (ents) {
     var cambio = false; ents.forEach(function (en) { var k = en.target.id || en.target.className, hh = Math.round(en.contentRect.height); if (altos[k] !== undefined && altos[k] !== hh) cambio = true; altos[k] = hh; });
     if (cambio) { clearTimeout(tRO); tRO = setTimeout(remedir, 120); }
    });
    [$("r-fija"), document.querySelector(".aviso-zona"), document.querySelector(".mapa-titulo")].forEach(function (el) { if (el) window.__cimientoRO.observe(el); });
   }
   $("aviso-red").hidden = navigator.onLine !== false && api.modo !== "sin-conexion";
   ultimaActividad = Date.now();
   var t = tourEstado();
   if (t !== "fin") setTimeout(function () { iniciarTour(parseInt(t, 10) || 0); }, quieto() ? 100 : 1500);
   else if (pref("pin")) bloquear();
   if (op.finmes) setTimeout(simularFinMes, 300);
  }
  var intentos = 0, esperaHasta = 0;
  on("rut", "input", function () { var c = V.limpiarRut(this.value).slice(0, 9); this.value = c.length > 1 ? V.formatoRut(c) : c; errorCampo("rut", null); });
  on("clave", "input", function () { errorCampo("clave", null); });
  on("ver-clave", "click", function () { var c = $("clave"), ver = c.type === "password"; c.type = ver ? "text" : "password"; this.setAttribute("aria-pressed", ver ? "true" : "false"); this.setAttribute("aria-label", ver ? "Ocultar clave" : "Mostrar clave"); this.querySelector("use").setAttribute("href", ver ? "#i-ojo-no" : "#i-ojo"); });
  function errorCampo(id, t) { var e = $("err-" + id), el = $(id); e.textContent = t || ""; e.hidden = !t; if (t) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid"); }
  on("form-login", "submit", function (e) {
   e.preventDefault();
   if (Date.now() < esperaHasta) return;
   var rut = $("rut").value, clave = $("clave").value, mal = false;
   if (!V.validarRut(rut)) { errorCampo("rut", "Revise el RUT: debe tener el formato 12.345.678-9"); mal = true; }
   if (clave.length < 4) { errorCampo("clave", "La clave debe tener al menos 4 caracteres."); mal = true; }
   if (mal) {
    intentos++; ev("ingreso_error"); (V.validarRut(rut) ? $("clave") : $("rut")).focus();
    if (intentos >= 3) { intentos = 0; esperaHasta = Date.now() + 10000; cuentaRegresiva(); }
    return;
   }
   var b = $("btn-ingresar"); b.classList.add("cargando"); b.disabled = true; b.setAttribute("aria-busy", "true");
   rutMem = V.enmascararRut(rut); try { sessionStorage.setItem("cimiento:rut", rutMem); } catch (er) {}
   $("clave").value = ""; ev("ingreso");
   setTimeout(function () { b.classList.remove("cargando"); b.disabled = false; b.removeAttribute("aria-busy"); var iv = invitaciones().filter(function (x) { return x.rut && x.rut === rutMem; })[0]; if (iv) recibirInvitacion(iv); else iniciarAlta(null); }, 900);
  });
  function cuentaRegresiva() {
   var p = $("login-espera"), b = $("btn-ingresar"); b.disabled = true; p.hidden = false;
   (function tic() { var s = Math.ceil((esperaHasta - Date.now()) / 1000); if (s <= 0) { p.hidden = true; b.disabled = false; return; } p.textContent = "Probemos otra vez en un momento. Puede intentar en " + s + (s === 1 ? " segundo." : " segundos."); setTimeout(tic, 500); })();
  }
  on("btn-tengo-codigo", "click", function () { var f = $("form-codigo"), ab = f.hidden; f.hidden = !ab; this.setAttribute("aria-expanded", ab ? "true" : "false"); if (ab) $("codigo").focus(); });
  on("form-codigo", "submit", function (e) {
   e.preventDefault();
   var cod = $("codigo").value.trim().toLowerCase(); if (!cod) { $("codigo").focus(); return; }
   var iv = invitaciones().filter(function (x) { return x.codigo === cod.toUpperCase(); })[0]; if (iv) { recibirInvitacion(iv); return; }
   conectar(cod).then(function (a) {
    if (!a.estado().config && /^demo/.test(cod)) return Store.sembrarDemo(a).then(function () { return esperarConfig(a); }).then(elegirPersona);
    if (!a.estado().config) { iniciarAlta(cod); return; }
    elegirPersona(a.estado());
   }).catch(function () {});
  });
  on("btn-demo", "click", function () {
   var b = this; b.disabled = true;
   conectar("demo").then(function (a) { return (a.estado().config ? Promise.resolve() : Store.sembrarDemo(a)).then(function () { return esperarConfig(a); }); })
    .then(function (e) { b.disabled = false; estado = e; ev("demo"); entrar("p1", { conTour: true }); }).catch(function () { b.disabled = false; });
  });

  /* ---------- Plan (ronda 21): js/plan.js se carga al abrir la pestaña ---------- */
  var planMod = null;
  function cargarPlan() {
   if (planMod) { planMod.render(); return; }
   var s = document.createElement("script"); s.src = "js/plan.js";
   s.onload = function () {
    planMod = window.CimientoPlan({ $: $, on: on, V: V, esc: esc, digitos: digitos, formatoMonto: formatoMonto, per: function () { return per(quien); }, vj: function () { return vj(); }, cfg: cfg, clonarCfg: clonarCfg,
     quien: function () { return quien; }, estado: function () { return estado; }, guardar: guardar, entrarAjuste: entrarAjuste, irA: irA, ev: ev, abrirVinculo: abrirVinculo, setAnim: function (t) { animAjuste = t; } });
    planMod.render();
   };
   s.onerror = function () { toast("No pudimos abrir el Plan. Intente de nuevo."); };
   document.head.appendChild(s);
  }
  /* ---------- Alta en 5 pasos (2.3) ---------- */
  var ALTA = "cimiento:alta", altaMod = null;
  function leerAlta() { try { return JSON.parse(localStorage.getItem(ALTA)); } catch (e) { return null; } }
  function iniciarAlta(codigo) {
   if (altaMod) { altaMod(codigo); return; }
   var s = document.createElement("script"); s.src = "js/alta.js";
   s.onload = function () {
    altaMod = window.CimientoAlta({ $: $, on: on, V: V, BCI: BCI, esc: esc, digitos: digitos, formatoMonto: formatoMonto, abrirHoja: abrirHoja, cerrarDialogo: cerrarDialogo, mostrarSolo: mostrarSolo,
     mostrarEntrada: mostrarEntrada, conectar: conectar, esperarConfig: esperarConfig, entrar: entrar, ev: ev, ancho: ancho, ALTA: ALTA, leerAlta: leerAlta,
     conectarSiNo: function (cod) { return api && api.codigo === cod ? Promise.resolve(api) : conectar(cod); }, setEstado: function (st) { estado = st; } });
    altaMod(codigo);
   };
   s.onerror = function () { toast("No pudimos abrir el alta. Sus datos están a salvo; intente de nuevo."); mostrarEntrada(); };
   document.head.appendChild(s);
  }

  /* ---------- bloqueo por inactividad (5 min) ---------- */
  var ultimaActividad = Date.now(), INACTIVO = 5 * 60 * 1000;
  function bloquear() {
   if ($("pantalla-app").hidden || !$("bloqueo").hidden) return;
   var conPin = !!pref("pin");
   $("bl-txt").textContent = conPin ? "Ingrese su PIN para continuar. Sus montos quedan ocultos mientras tanto." : "Por seguridad, la sesión se bloqueó tras 5 minutos sin uso. Sus montos quedan ocultos mientras tanto.";
   $("bl-pin-zona").hidden = !conPin; $("pin-ok").textContent = conPin ? "Desbloquear" : "Continuar";
   $("bl-titulo").textContent = conPin ? "Sesión bloqueada · Ingrese su PIN" : "Sesión bloqueada";
   $("pin-in").value = ""; $("pin-err").hidden = true; $("bloqueo").hidden = false; document.documentElement.setAttribute("aria-busy", "false");
   $("app").setAttribute("aria-hidden", "true"); setTimeout(function () { (conPin ? $("pin-in") : $("pin-ok")).focus(); }, 50);
  }
  function desbloquear() { $("bloqueo").hidden = true; $("app").removeAttribute("aria-hidden"); ultimaActividad = Date.now(); }
  ["pointerdown", "keydown"].forEach(function (t) { document.addEventListener(t, function () { ultimaActividad = Date.now(); }, true); });
  setInterval(function () { if (Date.now() - ultimaActividad > INACTIVO) bloquear(); }, 10000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden && Date.now() - ultimaActividad > INACTIVO) bloquear(); });
  on("pin-ok", "click", function () {
   if (!pref("pin")) { desbloquear(); return; }
   hashPin($("pin-in").value).then(function (h) {
    if (h === pref("pin")) desbloquear();
    else { $("pin-err").textContent = "PIN incorrecto. Intente de nuevo."; $("pin-err").hidden = false; $("pin-in").value = ""; $("pin-in").focus(); }
   });
  });
  on("pin-in", "keydown", function (e) { if (e.key === "Enter") $("pin-ok").click(); });
  on("pin-salir", "click", function () { cerrarSesion(); });

  /* ---------- telemetría local: primer toque y uso (sin datos personales) ---------- */
  document.addEventListener("click", function (e) {
   var t = e.target.closest("button,a,[role=button],input,select"); if (!t || !api) return;
   var id = t.id || t.getAttribute("data-vista") || t.getAttribute("data-filtro") || (t.classList.contains("pieza") ? "pieza" : t.classList.contains("nodo") ? "nodo" : t.classList.contains("medalla") ? "medalla" : t.getAttribute("data-ficha") || t.getAttribute("data-det") || (typeof t.className === "string" ? t.className.split(" ")[0] : "") || t.tagName.toLowerCase());
   ev("toque:" + id);
  }, true);

  /* ---------- conexión del dispositivo ---------- */
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(function () {});
  window.addEventListener("offline", function () { if (!$("pantalla-app").hidden) $("aviso-red").hidden = false; });
  window.addEventListener("online", function () { $("aviso-red").hidden = true; if (api && !$("pantalla-app").hidden) toast("Conexión recuperada."); });

  /* ---------- inicio ---------- */
  function conCarga(fn) {
   if (quieto() || Store.sesion("inicio")) { fn(); return; }
   Store.sesion("inicio", "1"); mostrarSolo("pantalla-carga");
   var t0 = Date.now(), esq = setTimeout(function () { $("carga-esq").hidden = false; }, 1500);
   setTimeout(function () { clearTimeout(esq); fn(); }, Math.max(0, 1150 - (Date.now() - t0)));
  }
  function iniciar() {
   try { rutMem = sessionStorage.getItem("cimiento:rut"); } catch (e) {}
   var cod = (params.get("codigo") || "").trim().toLowerCase(), persona = params.get("persona"), sinTour = params.get("tour") === "0", finmes = params.get("finmes") === "1";
   if (cod) {
    conCarga(function () {
    conectar(cod).then(function (a) {
    if (!a.estado().config && /^demo/.test(cod)) return Store.sembrarDemo(a).then(function () { return esperarConfig(a); });
    return a.estado();
    }).then(function (e) {
    if (!e.config) { if (/^alta/.test(cod)) { try { localStorage.removeItem(ALTA); } catch (er) {} } iniciarAlta(cod); return; }
    estado = e;
    if (persona === "p1" || persona === "p2") entrar(persona, { sinTour: sinTour, finmes: finmes });
    else { mostrarEntrada(); $("form-codigo").hidden = true; elegirPersona(e); }
    }).catch(function () { mostrarEntrada(); });
    });
    return;
   }
   var ses = leerSesion(), alt = leerAlta();
   conCarga(function () {
    if (ses && ses.codigo && ses.quien) {
    conectar(ses.codigo).then(function (a) { if (a.estado().config) entrar(ses.quien, {}); else if (alt && alt.codigo === ses.codigo) iniciarAlta(alt.codigo); else mostrarEntrada(); }).catch(function () {
    var c = leerCache(ses.codigo);
    if (c) { api = { modo: "sin-conexion", codigo: ses.codigo, estado: function () { return estado; }, cerrar: function () {}, agregarAporte: function () { return Promise.reject(); }, resolverAporte: function () { return Promise.reject(); }, guardarConfig: function () { return Promise.reject(); }, crearPareja: function () { return Promise.reject(); } };
     estado = c.s; entrar(ses.quien, {}); $("aviso-estado").hidden = false; $("aviso-estado").textContent = "Actualizado hace " + Math.max(1, Math.round((Date.now() - c.t) / 60000)) + " min"; }
    else mostrarEntrada();
    });
    } else if (alt && alt.paso) iniciarAlta(alt.codigo);
    else mostrarEntrada();
   });
  }
  iniciar();
  window.CimientoApp = { pruebas: function () { return V.pruebas(); }, solapes: function () { return window.CimientoPruebasSolapes ? window.CimientoPruebasSolapes() : V.pruebas().then(function () { return window.CimientoPruebasSolapes(); }); } };

})();
