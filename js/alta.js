/* Cimiento: alta en 5 pasos (sección 2.3 de la ronda 18). Se carga solo cuando una persona nueva la necesita
 * (así la app pesa menos al abrir). Recibe de js/app.js las utilidades que usa. */
(function () {
  "use strict";
  window.CimientoAlta = function (k) {
    var $ = k.$, on = k.on, V = k.V, BCI = k.BCI, pesos = V.pesos, millones = V.millones, plazo = V.plazo, SEP = " · ", esc = k.esc, digitos = k.digitos, formatoMonto = k.formatoMonto,
      abrirHoja = k.abrirHoja, cerrarDialogo = k.cerrarDialogo, mostrarSolo = k.mostrarSolo, mostrarEntrada = k.mostrarEntrada, conectar = k.conectar, esperarConfig = k.esperarConfig,
      entrar = k.entrar, ev = k.ev, ancho = k.ancho, ALTA = k.ALTA, leerAlta = k.leerAlta, alta = null;
    function guardarAlta() { try { localStorage.setItem(ALTA, JSON.stringify(alta)); } catch (e) {} }  function iniciarAlta(codigo) {
    var previa = leerAlta();
    if (previa && (!codigo || previa.codigo === codigo)) alta = previa;
    else alta = { codigo: codigo || "cuenta-" + Math.random().toString(36).slice(2, 8), paso: 1, conectado: false, consent: false, ingreso: 0, gastos: 0, capacidad: 0, capEditada: false, sugerir: true, otra: 0, verOtra: false, monto: 0, dia: 5, recordatorio: false, forma: "adaptativo", vinculo: null };
    guardarAlta(); mostrarSolo("pantalla-alta"); pintarAlta(); ev("alta_inicio");
  }
  var TITULOS = ["Sus datos Bci", "Su situación hoy", "Su meta y cómo ahorra", "Su aporte mensual", "Su primer viaje"];
  function datosB() { return BCI.persona("p1"); }
  // Ronda 20: cifra poco realista si supera la mitad del ingreso.
  function capAlta() { return alta.ingreso > 0 && alta.capacidad > alta.ingreso * 0.5; }
  function sugerida() { return alta.gastos > 0 ? Math.max(0, alta.ingreso - alta.gastos) : 0; }
  // Con pareja o familiar, su parte sale de los ingresos de ambos (la otra renta es un dato de demostración); solo, es el pie completo.
  var RENTA_OTRO = { pareja: function () { return BCI.persona("p2").ingreso; }, familiar: function () { return 1200000; } };
  function borrador() {
    var B = datosB(), plan = alta.monto || alta.capacidad, tipo = alta.vinculo || "pareja";
    var p1 = tipo === "solo" ? V.PIE : V.reparto(V.PIE, { p1: alta.ingreso || B.ingreso, p2: RENTA_OTRO[tipo]() }).p1;
    var c = V.crearConfig({ reparto: { p1: p1, p2: V.PIE - p1 }, vinculo: { tipo: tipo, estado: "ninguno", de: "p1" },
      p1: { nombre: B.nombre, ingreso: alta.ingreso, gastos: alta.gastos, capacidad: alta.capacidad, plan: plan, extra: { consentimientoBci: alta.consent ? new Date().toISOString() : null, diaAporte: alta.dia, recordatorio: alta.recordatorio } } });
    var P = c.personas.p1; P.forma = alta.forma; P.casitas = V.casitasNuevas(P.parte, alta.forma, P.plan);
    return c;
  }
  function aportesAlta(c) {
    var t = new Date().toISOString(), out = [], B = datosB();
    if (alta.consent && B.ahorro > 0) out.push({ de: "p1", monto: Math.min(B.ahorro, c.personas.p1.parte), fecha: t, estado: "verificado", origen: "inicial" });
    if (alta.otra > 0) out.push({ de: "p1", monto: alta.otra, fecha: t, estado: "declarado", origen: "otra" });
    return out;
  }
  function campoMonto(id, et, val, extra) { return '<div class="campo"><input id="' + id + '" inputmode="numeric" autocomplete="off" placeholder=" " value="' + (val ? pesos(val) : "") + '"' + (extra || "") + '><label for="' + id + '">' + et + "</label></div>"; }
  function pintarAlta() {
    var p = alta.paso, B = datosB(), cuerpo = $("alta-cuerpo"), html = "";
    $("alta-paso-txt").textContent = "Paso " + p + " de 5"; $("alta-barra").style.width = (p * 20) + "%";
    document.querySelector(".alta-barra").setAttribute("aria-valuenow", p);
    $("alta-titulo").textContent = TITULOS[p - 1]; $("err-alta").hidden = true;
    $("alta-sig").textContent = p === 5 ? "Empezar" : "Siguiente";
    if (p === 1) {
      if (!alta.conectado) {
      cuerpo.innerHTML = '<p class="conectando" role="status"><span class="girador" aria-hidden="true"></span>Conectando con su cuenta…</p>';
      $("alta-sig").disabled = true; $("alta-motivo").textContent = "";
      BCI.conectar("p1").then(function () { alta.conectado = true; guardarAlta(); if (alta.paso === 1 && !$("pantalla-alta").hidden) pintarAlta(); });
      return;
      }
      html = '<p class="bajada">Encontramos estos datos en Bci. Revíselos: usted decide si Cimiento puede usarlos.</p>' +
    '<ul class="datos-bci">' + [["Cuenta Bci " + B.cuenta, B.tipoCuenta + SEP + "conectada", "Saldo " + pesos(B.saldo)], ["Ingreso verificado", B.ingresoNota, pesos(B.ingreso)], ["Ahorro en Bci", B.ahorroNota, pesos(B.ahorro)]].map(function (r, k) {
       return '<li style="--k:' + k + '"><span class="ok" aria-hidden="true"><svg class="ic"><use href="#i-check"/></svg></span><span><strong>' + r[0] + "</strong><small>" + r[1] + '</small></span><span class="monto">' + r[2] + "</span></li>";
      }).join("") + '</ul><span class="etiqueta-demo">' + BCI.ETIQUETA + "</span>" +
    '<h2 class="rotulo">Usaremos</h2><ul class="usaremos"><li>Su ingreso y su ahorro, para sugerir un camino.</li><li>Sus aportes desde la cuenta, para verificarlos.</li><li>Nunca su clave ni sus movimientos.</li></ul>' +
    '<label class="check"><input id="alta-consent" type="checkbox"' + (alta.consent ? " checked" : "") + '><span>Autorizo a Cimiento a usar estos datos Bci</span></label>' +
    '<p class="ayuda">Puede revocarlo en Mi cuenta · Mis datos y consentimientos.</p>';
    } else if (p === 2) {
      if (alta.sugerir && alta.consent && !alta.ingreso) alta.ingreso = B.ingreso;
      html = '<p class="bajada">Con esto sugerimos su camino. Lo puede cambiar cuando quiera.</p>' +
      campoMonto("alta-ingreso", "Ingreso mensual", alta.ingreso) + campoMonto("alta-gastos", "Gastos fijos al mes", alta.gastos, ' aria-describedby="alta-gas-ayuda"') +
    '<p id="alta-gas-ayuda" class="ayuda">No cambia cuánto puede ahorrar; lo usamos solo para sugerirle una cifra.</p>' +
      campoMonto("alta-capacidad", "¿Cuánto puede ahorrar al mes?", alta.capacidad, ' aria-describedby="alta-cap-ayuda"') +
    '<p id="alta-cap-ayuda" class="ayuda">Sugerido: ingreso menos gastos. Puede cambiarlo.</p>' +
    '<p id="alta-alto" class="aviso aviso-amarillo"' + (capAlta() ? "" : " hidden") + '><svg class="ic" aria-hidden="true"><use href="#i-alerta"/></svg><span>Es más de la mitad de su ingreso. ¿Podrá sostenerlo cada mes?</span></p>' +
    (alta.consent ? '<label class="check"><input id="alta-sugerir" type="checkbox"' + (alta.sugerir ? " checked" : "") + '><span>Que Bci sugiera estos valores con mis datos</span></label>' : "") +
    '<p id="alta-despacio" class="aviso aviso-azul"' + (alta.gastos <= alta.ingreso ? " hidden" : "") + '><svg class="ic" aria-hidden="true"><use href="#i-info"/></svg><span>Con este dato, el camino parte despacio; podemos ajustarlo cuando cambie.</span></p>';
    } else if (p === 3) {
      var c = borrador(), tv = alta.vinculo;
      html = '<p class="bajada" style="margin-top:0">Esto define qué requisitos aplican y el plazo.</p>' +
    '<div class="tarjeta" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span><small class="ayuda" style="display:block;margin:0">Vivienda de referencia</small><strong>4.900 UF' + SEP + "pie " + millones(V.PIE) + '</strong></span><button class="enlace" type="button" data-alta="calculo">Cómo se calcula<svg class="ic" aria-hidden="true"><use href="#i-chev"/></svg></button></div>' +
    '<fieldset style="border:0;padding:0;margin:0"><legend class="rotulo">¿Cómo va a ahorrar?</legend>' + ["solo", "familiar", "pareja"].map(function (k) {
       return '<label class="opcion"><input type="radio" name="alta-vinculo" value="' + k + '"' + (k === tv ? " checked" : "") + "><span><strong>" + (V.VINCULOS[k].largo || "Solo") + "</strong><small>" + (k === "solo" ? V.VINCULOS.solo.regla : k === "familiar" ? "Codeudor relacionado: titular desde 23 UF." : "Codeudor no relacionado: renta conjunta desde 70 UF.") + "</small></span></label>";
      }).join("") + '</fieldset><p class="ayuda">Puede cambiarlo cuando quiera en Mi cuenta. Cambia los plazos.</p>' +
    (tv && tv !== "solo" ? '<p class="aviso aviso-azul"><svg class="ic" aria-hidden="true"><use href="#i-info"/></svg><span><strong>Después la invita desde la pestaña Juntos.</strong> Cada uno tiene su camino y ve el total.</span></p>' : "") +
    (tv ? '<div class="cifra-linea"><span>' + (tv === "solo" ? "Su meta: el pie completo" : "Su parte (según los ingresos de ambos)") + "</span><strong>" + millones(c.personas.p1.parte) + "</strong></div>" : "") +
    '<h2 class="rotulo">Lo que ya tiene</h2>' +
    '<div class="cifra-linea"><span>Ahorro en Bci</span><strong>' + (alta.consent ? pesos(B.ahorro) + ' <span class="chip ok">Verificado</span>' : "Sin autorización") + "</strong></div>" +
    (alta.verOtra ? campoMonto("alta-otra", "Ahorro en otra institución", alta.otra) + '<p class="aviso aviso-amarillo"><svg class="ic" aria-hidden="true"><use href="#i-alerta"/></svg><span>Cuenta para su casa, pero Bci aún no lo comprueba: no activa premios.</span></p>'
          : '<button class="enlace" type="button" data-alta="otra">Agregar ahorro de otra institución<svg class="ic" aria-hidden="true"><use href="#i-chev"/></svg></button>') +
    (tv && tv !== "solo" ? '<p class="nota">Renta de ' + (tv === "pareja" ? "su pareja" : "su familiar") + " para el reparto: " + pesos(RENTA_OTRO[tv]()) + " (" + BCI.ETIQUETA.toLowerCase() + ").</p>" : "");
    } else if (p === 4) {
      if (!alta.monto) alta.monto = alta.capacidad || 0;
      var dias = ""; for (var d = 1; d <= 28; d++) dias += '<option value="' + d + '"' + (alta.dia === d ? " selected" : "") + ">Día " + d + "</option>";
      html = '<p class="bajada">Por defecto, su capacidad de ahorro. Lo pueden cambiar cuando quieran.</p>' + campoMonto("alta-monto", "Monto mensual", alta.monto) +
    '<div class="campo campo-select"><select id="alta-origen"><option>Cuenta Bci ' + B.cuenta + " (demostración)</option></select><label for=\"alta-origen\">Desde</label></div>" +
    '<div class="campo campo-select"><select id="alta-dia">' + dias + '</select><label for="alta-dia">Día del mes</label></div>' +
    '<label class="check"><input id="alta-recordatorio" type="checkbox"' + (alta.recordatorio ? " checked" : "") + '><span>Recordarme dentro de la app</span></label>' +
    '<p id="alta-resumen" class="aviso aviso-verde"></p>';
    } else {
      var c5 = borrador(), ini = aportesAlta(c5), P = c5.personas.p1, v = V.viaje(P, ini, "p1"), x = v.actual >= 0 ? v.casitas[v.actual] : null;
      var faltaX = x ? Math.round((1 - x.lleno) * x.monto) : 0, mx = x && P.plan > 0 ? Math.max(1, Math.ceil(faltaX / P.plan)) : null;
      var mapa = V.dibujarMapa("mio", { casitas: v.casitas, actual: v.actual, inicial: B.nombre.charAt(0), pie: V.PIE, puestas: v.acunadas, premios: V.premios(c5, ini, "p1") }, { ancho: Math.min(ancho() - 48, 400), escala: 0.55, sinTitulo: true, sinNumeros: true });
      html = '<div class="primer-viaje"><div class="mapa-mini" aria-hidden="true">' + mapa + "</div>" +
    '<p class="pv-et">' + (v.acunadas ? "Su próxima casita · " + (v.actual + 1) : "Primera casita") + "</p>" +
    '<p class="pv-cifra">' + (x ? millones(x.monto) : "Lista") + "</p>" +
    (mx ? '<p class="pv-plazo">Con ' + pesos(P.plan) + " al mes: unos " + mx + (mx === 1 ? " mes" : " meses") + "</p>" : "") +
    '<p class="hoja-nota">Casita = una meta pequeña de ahorro. Diez casitas forman el pie de su vivienda.</p>' +
    (!isFinite(v.meses) ? '<p class="aviso aviso-azul">Con esta cifra el camino parte despacio. Puede cambiarla después.</p>' : "") +
    '<details class="plegable"><summary>Cómo se calcula</summary><p class="hoja-nota">Meta: ' + millones(P.parte) + (P.parte >= V.PIE ? " (el pie completo)" : " (su parte)") + (isFinite(v.meses) ? SEP + "llegaría en " + plazo(v.meses) : "") + ". " + (v.acunadas ? "Su ahorro de hoy ya completó " + v.acunadas + (v.acunadas === 1 ? " casita" : " casitas") + ". " : "") + 'Si algo cambia, se reparten solo las casitas que faltan.</p><button class="enlace" type="button" data-alta="forma">Elegir cómo crecen sus casitas<svg class="ic" aria-hidden="true"><use href="#i-chev"/></svg></button></details></div>';
    }
    cuerpo.innerHTML = html;
    pintarMotivo();
    if (p === 4) resumenAlta();
  }
  function pintarMotivo() {
    var p = alta.paso, bloq = p === 1 && !alta.consent;
    $("alta-sig").disabled = bloq;
    $("alta-motivo").textContent = bloq ? "Para seguir, marque la autorización de datos Bci." : "";
  }
  function resumenAlta() {
    var c = borrador(), ini = aportesAlta(c), P = c.personas.p1, v = V.viaje(P, ini, "p1"), el = $("alta-resumen"); if (!el) return;
    if (v.actual < 0 || !P.plan) { el.className = "aviso aviso-azul"; el.textContent = "Con esta cifra el camino parte despacio. Puede cambiarla después."; return; }
    var x = v.casitas[v.actual], mx = Math.max(1, Math.ceil(Math.round((1 - x.lleno) * x.monto) / P.plan));
    // Ronda 20: advertir plazos poco realistas (casita en 2 meses o menos, o más de la mitad del ingreso).
    var raro = mx <= 2 || (alta.ingreso > 0 && P.plan > alta.ingreso * 0.5);
    el.className = "aviso " + (raro ? "aviso-amarillo" : "aviso-verde"); el.textContent = "Con " + pesos(P.plan) + " al mes: casita " + x.n + " en " + mx + (mx === 1 ? " mes." : " meses.") + (raro ? " Es muy rápido: revise si podrá sostener ese monto cada mes." : "");
  }
  on("alta-cuerpo", "input", function (e) {
    var t = e.target;
    if (/^alta-(ingreso|gastos|capacidad|otra|monto)$/.test(t.id)) formatoMonto(t);
    if (t.id === "alta-ingreso" || t.id === "alta-gastos") {
      alta.ingreso = digitos($("alta-ingreso").value); alta.gastos = digitos($("alta-gastos").value);
      if (!alta.capEditada) { alta.capacidad = sugerida(); $("alta-capacidad").value = alta.capacidad ? pesos(alta.capacidad) : ""; }
      if (t.id === "alta-ingreso" && $("alta-sugerir")) { alta.sugerir = false; $("alta-sugerir").checked = false; }
    }
    if (t.id === "alta-capacidad") { alta.capacidad = digitos(t.value); alta.capEditada = true; }
    if ($("alta-alto")) $("alta-alto").hidden = !capAlta();
    if (t.id === "alta-otra") alta.otra = digitos(t.value);
    if (t.id === "alta-monto") { alta.monto = digitos(t.value); resumenAlta(); }
    if ($("alta-despacio")) $("alta-despacio").hidden = alta.gastos <= alta.ingreso;
    guardarAlta();
  });
  on("alta-cuerpo", "change", function (e) {
    var t = e.target;
    if (t.id === "alta-consent") { alta.consent = t.checked; guardarAlta(); pintarMotivo(); }
    if (t.name === "alta-vinculo") { alta.vinculo = t.value; guardarAlta(); var y = window.scrollY; pintarAlta(); window.scrollTo(0, y); var r = document.querySelector("input[name=alta-vinculo]:checked"); if (r) r.focus(); }
    if (t.id === "alta-sugerir") { alta.sugerir = t.checked; if (t.checked) { alta.ingreso = datosB().ingreso; if (!alta.capEditada) alta.capacidad = sugerida(); } guardarAlta(); pintarAlta(); }
    if (t.id === "alta-dia") { alta.dia = parseInt(t.value, 10); guardarAlta(); }
    if (t.id === "alta-recordatorio") { alta.recordatorio = t.checked; guardarAlta(); }
  });
  on("alta-cuerpo", "click", function (e) {
    var b = e.target.closest("[data-alta]"); if (!b) return;
    var q = b.getAttribute("data-alta");
    if (q === "otra") { alta.verOtra = true; guardarAlta(); pintarAlta(); $("alta-otra").focus(); }
    else if (q === "calculo") abrirHoja("Cómo se calcula el pie", '<p class="hoja-nota">El banco presta lo que su renta permite: el dividendo no puede pasar de un cuarto de la renta. Con $1.700.000 de renta, el dividendo máximo es $425.000; a 4,0 % y 25 años, eso da un crédito de unos ' + millones(V.CASO.precio - V.PIE) + ".</p>" +
    '<div class="fila-datos"><span>Vivienda 4.900 UF</span><strong>' + millones(V.CASO.precio) + '</strong></div><div class="fila-datos"><span>Crédito posible</span><strong>− ' + millones(V.CASO.precio - V.PIE) + '</strong></div><div class="fila-datos"><span>Pie requerido</span><strong>' + millones(V.PIE) + "</strong></div>" +
    '<p class="fuente">UF $41.157,43, SII 14-10-2026. Regla de renta: Bci, Crédito hipotecario, 9-11-2026. Referencia, no una evaluación de Bci.</p>');
    else if (q === "forma") abrirFormaAlta();
  });
  function abrirFormaAlta() {
    var c = borrador(), P = c.personas.p1;
    abrirHoja("Cómo crecen sus casitas", '<p class="hoja-nota">Lo puede cambiar después. Las casitas logradas se mantienen.</p>' + Object.keys(V.FORMAS).map(function (f) {
      var t = V.tamanos(P.parte, 10, f, P.plan);
      return '<label class="check"><input type="radio" name="forma-alta" value="' + f + '"' + (alta.forma === f ? " checked" : "") + '><span><strong>' + V.FORMAS[f].nombre + "</strong>" + SEP + "primera casita " + millones(t[0]) + '<br><span class="ayuda">' + V.FORMAS[f].txt + "</span></span></label>";
    }).join("") + '<div class="pila"><button class="boton primario" type="button" data-forma-alta="1">Aplicar</button></div>');
  }
  on("hoja-cuerpo", "click", function (e) {
    if (!e.target.closest("[data-forma-alta]")) return;
    var f = (document.querySelector("input[name=forma-alta]:checked") || {}).value; if (f) { alta.forma = f; guardarAlta(); }
    cerrarDialogo("hoja"); pintarAlta();
  });
  on("alta-atras", "click", function () {
    if (alta.paso === 1) { mostrarEntrada(); return; }
    alta.paso--; guardarAlta(); pintarAlta(); window.scrollTo(0, 0);
  });
  on("form-alta", "submit", function (e) {
    e.preventDefault();
    var p = alta.paso, err = $("err-alta");
    function falla(t, id) { err.textContent = t; err.hidden = false; if (id && $(id)) { $(id).setAttribute("aria-invalid", "true"); $(id).focus(); } }
    if (p === 1 && !alta.consent) return falla("Para seguir, marque la autorización de datos Bci.", "alta-consent");
    if (p === 2 && !alta.ingreso) return falla("Escriba su ingreso mensual aproximado.", "alta-ingreso");
    if (p === 2 && !alta.capacidad) return falla("Escriba cuánto puede ahorrar al mes.", "alta-capacidad");
    if (p === 3 && !alta.vinculo) return falla("Elija cómo va a ahorrar.", null);
    if (p === 4 && alta.monto > datosB().saldo * 10) return falla("Revise el monto mensual.", "alta-monto");
    ev("alta_paso_" + p);
    if (p < 5) { alta.paso++; guardarAlta(); pintarAlta(); window.scrollTo(0, 0); var f = $("alta-cuerpo").querySelector("input,select,button"); if (f && p !== 4) try { f.focus({ preventScroll: true }); } catch (er) {} return; }
    var b = $("alta-sig"); b.disabled = true;
    var c = borrador(), ini = aportesAlta(c), cod = alta.codigo;
    k.conectarSiNo(cod).then(function (a) {
      return a.crearPareja(c).then(function () { return ini.reduce(function (pr, x) { return pr.then(function () { return a.agregarAporte(x); }); }, Promise.resolve()); }).then(function () { return esperarConfig(a); });
    }).then(function (st) {
      k.setEstado(st); try { localStorage.removeItem(ALTA); } catch (er) {}
      b.disabled = false; ev("alta_fin"); entrar("p1", {});
    }).catch(function () { b.disabled = false; falla("No pudimos crear su viaje. Sus datos están a salvo; intente de nuevo."); });
  });
    return iniciarAlta;
  };
})();
