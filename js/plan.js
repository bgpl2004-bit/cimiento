/* Cimiento: pestaña Plan (ronda 21). Se carga solo al abrir la pestaña (la app pesa menos al abrir).
 * Aquí se edita lo que mueve el camino; cada cambio vuelve a Camino con su animación. Recibe de js/app.js las utilidades que usa. */
(function () {
 "use strict";
 window.CimientoPlan = function (k) {
  var $ = k.$, V = k.V, pesos = V.pesos, millones = V.millones, esc = k.esc, digitos = k.digitos, SEP = " · ";
  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
  function clave(i) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2); }
  function nombreMes(s) { var f = String(s).split("-"); return MESES[parseInt(f[1], 10) - 1] + " " + f[0]; }
  function campo(id, et, val) { return '<div class="campo"><input id="' + id + '" inputmode="numeric" data-monto autocomplete="off" enterkeyhint="done" placeholder=" " value="' + (val ? pesos(val) : "") + '"><label for="' + id + '">' + et + "</label></div>"; }
  function fila(a, b) { return '<div class="fila-datos"><span>' + a + "</span><strong>" + b + "</strong></div>"; }
  function render() {
   var P = k.per(), v = k.vj(), c = k.cfg(), planes = P.planes || [], plan = P.plan || 0, opMes = "";
   for (var i = 1; i <= 12; i++) opMes += '<option value="' + clave(i) + '">' + nombreMes(clave(i)) + "</option>";
   $("plan-cuerpo").innerHTML =
    '<form id="pl-form" class="tarjeta plan-sec" novalidate><h2 class="rotulo">Su mes</h2>' +
    campo("pl-ingreso", "Ingreso mensual", P.ingreso) + campo("pl-gastos", "Gastos fijos al mes", P.gastos) +
    '<div class="pl-rango"><p class="pl-et"><label for="pl-plan">Ahorro al mes</label><output id="pl-plan-v" for="pl-plan" class="tabular">' + pesos(plan) + "</output></p>" +
    '<input id="pl-plan" class="rango" type="range" min="100000" max="3000000" step="50000" value="' + Math.max(100000, plan) + '"></div>' +
    '<p id="pl-aviso" class="aviso aviso-amarillo" hidden></p><p id="pl-err" class="error" hidden></p>' +
    '<button class="boton primario" type="submit">Guardar cambios</button></form>' +
    '<section class="tarjeta plan-sec"><h2 class="rotulo">Planes futuros</h2>' +
    (planes.length ? '<ul class="pl-lista">' + planes.map(function (g, j) { return '<li><span><strong>' + esc(g.nombre) + "</strong><small>" + nombreMes(g.mes) + SEP + pesos(g.monto) + '</small></span><button class="boton-icono" type="button" data-pl-quitar="' + j + '" aria-label="Quitar ' + esc(g.nombre) + '"><svg class="ic" aria-hidden="true"><use href="#i-cerrar"/></svg></button></li>'; }).join("") + "</ul>" : "") +
    '<form id="pl-nuevo" novalidate><div class="campo"><input id="pl-g-nombre" maxlength="40" autocomplete="off" enterkeyhint="next" placeholder=" "><label for="pl-g-nombre">Un viaje, un evento…</label></div>' +
    campo("pl-g-monto", "Monto", 0) + '<div class="campo campo-select"><select id="pl-g-mes">' + opMes + '</select><label for="pl-g-mes">Mes</label></div><p id="pl-g-err" class="error" hidden></p>' +
    '<button class="boton secundario" type="submit">Agregar</button></form></section>' +
    '<section class="tarjeta plan-sec"><h2 class="rotulo">Ritmo del camino</h2>' + Object.keys(V.FORMAS).map(function (f) {
     return '<label class="check"><input type="radio" name="pl-forma" value="' + f + '"' + (P.forma === f ? " checked" : "") + "><span><strong>" + V.FORMAS[f].nombre + "</strong></span></label>";
    }).join("") + "</section>" +
    '<section class="tarjeta plan-sec"><h2 class="rotulo">Lo que ya tiene</h2>' + fila("Verificado por Bci", pesos(v.verificado)) + (v.declarado > 0 ? fila("Declarado", pesos(v.declarado)) : "") + "</section>" +
    '<section class="tarjeta plan-sec"><h2 class="rotulo">Vivienda</h2>' + fila("Valor de referencia", "4.900 UF") + fila("Pie", millones(c.pie)) + (P.parte < c.pie ? fila("Su parte", millones(P.parte)) : "") +
    '<button class="fila-tarjeta" type="button" data-pl="vinculo"><span><small>Con quién ahorro</small><strong>' + V.VINCULOS[V.tipoVinculo(c)].nombre + '</strong></span><span class="der">Cambiar<svg class="ic" aria-hidden="true"><use href="#i-chev"/></svg></span></button></section>';
   avisar();
  }
  function avisar() {
   var ing = digitos($("pl-ingreso").value), pl = parseInt($("pl-plan").value, 10), a = $("pl-aviso");
   $("pl-plan-v").textContent = pesos(pl);
   a.hidden = !(ing > 0 && pl > ing * 0.5); a.textContent = "Es más de la mitad de su ingreso. ¿Podrá sostenerlo cada mes?";
  }
  k.on("plan-cuerpo", "input", function (e) { if (e.target.matches("[data-monto]")) k.formatoMonto(e.target); if (e.target.id === "pl-plan" || e.target.id === "pl-ingreso") avisar(); });
  k.on("plan-cuerpo", "change", function (e) {
   if (e.target.name !== "pl-forma") return;
   var P = k.per(), c = k.clonarCfg(), Q = c.personas[k.quien()];
   Q.forma = e.target.value; Q.casitas = V.redistribuir(Q, k.estado().aportes, k.quien(), Q.forma, Q.plan);
   k.setAnim("menos"); k.ev("plan_forma"); k.guardar(c, "Listo. Las casitas logradas se mantienen.").then(function () { k.irA("ruta"); });
  });
  k.on("plan-cuerpo", "click", function (e) {
   var b = e.target.closest("[data-pl-quitar],[data-pl]"); if (!b) return;
   if (b.getAttribute("data-pl") === "vinculo") { k.abrirVinculo(); return; }
   var c = k.clonarCfg(), Q = c.personas[k.quien()]; Q.planes = (Q.planes || []).slice(); Q.planes.splice(parseInt(b.getAttribute("data-pl-quitar"), 10), 1);
   k.setAnim("mas"); k.ev("plan_quitar"); k.guardar(c, "Quitamos ese plan. El camino vuelve a acortarse.");
  });
  k.on("plan-cuerpo", "submit", function (e) {
   e.preventDefault();
   var P = k.per(), c = k.clonarCfg(), Q = c.personas[k.quien()];
   if (e.target.id === "pl-nuevo") {
    var nom = $("pl-g-nombre").value.trim(), mon = digitos($("pl-g-monto").value), er = $("pl-g-err");
    if (!nom || !mon) { er.textContent = !nom ? "Escriba qué es." : "Escriba el monto."; er.hidden = false; $(!nom ? "pl-g-nombre" : "pl-g-monto").focus(); return; }
    Q.planes = (Q.planes || []).concat([{ nombre: nom, monto: mon, mes: $("pl-g-mes").value }]);
    k.setAnim("menos"); k.ev("plan_futuro"); k.guardar(c, "Nos adaptamos a esto.").then(function () { k.irA("ruta"); });
    return;
   }
   if (e.target.id !== "pl-form") return;
   var ing = digitos($("pl-ingreso").value), plan = parseInt($("pl-plan").value, 10), err = $("pl-err");
   if (!ing) { err.textContent = "Escriba su ingreso mensual aproximado."; err.hidden = false; $("pl-ingreso").focus(); return; }
   Q.ingreso = ing; Q.gastos = digitos($("pl-gastos").value); Q.capacidad = plan;
   if (plan !== P.plan) { c.propuestas = c.propuestas || {}; c.propuestas[k.quien()] = { id: "plan-" + Date.now(), p: k.quien(), tipo: plan > P.plan ? "mas" : "menos", mes: 0, antes: P.plan, plan: plan }; }
   k.ev("plan_guardar"); k.guardar(c, plan !== P.plan ? null : "Listo.").then(function () { if (plan !== P.plan) setTimeout(k.entrarAjuste, 200); });
  });
  return { render: render };
 };
})();
