/* ═══════════ PLANO DE OBRA ═══════════
 *
 *  Muestra el plano de conjunto con cada casa pintada según su avance:
 *  verde terminada, amarillo en curso, gris sin empezar. Se puede ver el
 *  avance general o el de una tarea. Al tocar una casa se abre su ficha.
 *
 *  Solo lee: usa el acumulado que ya trae la app (S.acum). La ubicación de
 *  cada casa sobre el plano está en plano-casas.js (PLANO.casas[nombre]),
 *  en pixeles de la imagen plano.webp. */

S.pl = { ver: "", casa: null };
let plVB = null;                               // vista actual {x, y, w, h} en pixeles del plano

const PL_TXT = { ok: "Terminada", curso: "En curso", nada: "Sin empezar" };
const plPos = casa => typeof PLANO !== "undefined" && PLANO.casas[casa.nombre];
const plEstado = v => v >= 0.999 ? "ok" : v > 0 ? "curso" : "nada";
const plPlural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/* avance de una casa: general, o de la tarea elegida en "Ver" */
function plValor(casaId) {
  const tid = +S.pl.ver;
  return tid ? Math.min(1, acumTC(tid, casaId).total) : avanceCasa(casaId);
}

/* ── armado de la pestaña ── */
function vPlano() {
  if (typeof PLANO === "undefined")
    return `<div class="card"><div class="empty">No se encontró el plano.</div></div>`;
  const tc = O().tareas.filter(t => t.tipo === "CASA");
  return `<div class="card pl-card"><div class="bar">
    <span class="eyebrow">Plano de obra</span>
    <label class="pl-ver">Ver
      <select id="plVer"><option value="">Avance general</option>${tc.map(t =>
        `<option value="${t.id}"${+S.pl.ver === t.id ? " selected" : ""}>${esc(t.nombre)}</option>`).join("")}
      </select></label>
    <div class="leg">
      <i><span class="sw pl-sw-ok"></span>Terminada</i>
      <i><span class="sw pl-sw-curso"></span>En curso</i>
      <i><span class="sw pl-sw-nada"></span>Sin empezar</i></div>
    <div class="spacer"></div>
    <span class="pl-cuenta" id="plCuenta"></span></div>
    <div class="pl-wrap">
      <svg id="plSvg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <image href="${esc(PLANO.img)}" x="0" y="0" width="${PLANO.w}" height="${PLANO.h}"/>
        <g id="plCasas"></g></svg>
      <div class="pl-zoom">
        <button type="button" data-plzoom="mas" title="Acercar">+</button>
        <button type="button" data-plzoom="menos" title="Alejar">−</button>
        <button type="button" data-plzoom="todo" title="Ver todas las casas">⤢</button></div>
      <div class="pl-ayuda" id="plAyuda">Tocá una casa para ver su detalle · rueda del mouse o dos dedos para acercar</div>
      <div class="pl-ficha" id="plFicha" hidden></div>
    </div>
    <div id="plAviso"></div></div>`;
}

function pintarPlano() {
  const svg = $("plSvg");
  if (!svg) return;
  plPintarCasas();
  if (plVB) plAplicar(); else plVerTodo();
  plEventos(svg);
  $("plVer").onchange = e => { S.pl.ver = e.target.value; plPintarCasas(); plPintarFicha(); };
  for (const b of document.querySelectorAll("[data-plzoom]"))
    b.onclick = () => b.dataset.plzoom === "todo" ? plVerTodo()
      : plZoomCentro(b.dataset.plzoom === "mas" ? 0.7 : 1 / 0.7);
  plPintarFicha();
}

function plPintarCasas() {
  const cuenta = { ok: 0, curso: 0, nada: 0 }, sinUbicar = [];
  let h = "";
  for (const c of O().casas) {
    const p = plPos(c);
    if (!p) { sinUbicar.push(c.nombre); continue; }
    const v = plValor(c.id), e = plEstado(v);
    cuenta[e]++;
    const tip = `Casa ${c.nombre} · ${e === "curso" ? Math.round(v * 100) + "%" : PL_TXT[e].toLowerCase()}`;
    const forma = p.poly
      ? `<polygon points="${p.poly.map(q => q.join(",")).join(" ")}"/>`
      : `<circle cx="${p.x}" cy="${p.y}" r="${PLANO.r}"/>`;
    const ty = p.poly ? p.y : p.y - PLANO.r - 22;
    h += `<g class="pl-casa pl-${e}${S.pl.casa === c.id ? " pl-sel" : ""}" data-plcasa="${c.id}">
      <title>${esc(tip)}</title>${forma}<text x="${p.x}" y="${ty}">${esc(c.nombre)}</text></g>`;
  }
  $("plCasas").innerHTML = h;

  const t = +S.pl.ver ? (O().tareas.find(x => x.id === +S.pl.ver) || {}).nombre : "Avance general";
  $("plCuenta").innerHTML = `${esc(t)}: <b class="pl-c-ok">${plPlural(cuenta.ok, "terminada", "terminadas")}</b>
    · <b class="pl-c-curso">${cuenta.curso} en curso</b> · <b>${cuenta.nada} sin empezar</b>`;
  $("plAviso").innerHTML = sinUbicar.length
    ? `<div class="pl-aviso">Estas casas todavía no están ubicadas en el plano: ${
      sinUbicar.map(esc).join(", ")}. Avisá para marcarlas.</div>` : "";
}

/* ── zoom y desplazamiento ── */
function plAplicar() {
  const svg = $("plSvg");
  if (!svg || !plVB) return;
  const r = svg.getBoundingClientRect();
  if (r.width && r.height) {                   // la vista mantiene la proporción del recuadro
    const cy = plVB.y + plVB.h / 2;
    plVB.h = plVB.w * r.height / r.width;
    plVB.y = cy - plVB.h / 2;
  }
  svg.setAttribute("viewBox", `${plVB.x} ${plVB.y} ${plVB.w} ${plVB.h}`);
  svg.classList.toggle("pl-cerca", plVB.w < PLANO.w * 0.45);
}

function plVerTodo() {
  const pts = O().casas.map(plPos).filter(Boolean);
  let x0 = 0, y0 = 0, x1 = PLANO.w, y1 = PLANO.h;
  if (pts.length) {
    x0 = Math.min(...pts.map(p => p.x)); x1 = Math.max(...pts.map(p => p.x));
    y0 = Math.min(...pts.map(p => p.y)); y1 = Math.max(...pts.map(p => p.y));
    const pad = Math.max(x1 - x0, y1 - y0) * 0.08 + PLANO.r * 4;
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  }
  const r = $("plSvg").getBoundingClientRect();
  const asp = r.width && r.height ? r.height / r.width : 0.7;
  let w = x1 - x0, h = y1 - y0;
  if (h / w > asp) w = h / asp; else h = w * asp;
  plVB = { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h };
  plAplicar();
}

function plZoom(px, py, f) {
  const nw = Math.min(PLANO.w * 1.3, Math.max(PLANO.w * 0.04, plVB.w * f)), k = nw / plVB.w;
  plVB = { x: px - (px - plVB.x) * k, y: py - (py - plVB.y) * k, w: nw, h: plVB.h * k };
  plAplicar();
}
const plZoomCentro = f => plZoom(plVB.x + plVB.w / 2, plVB.y + plVB.h / 2, f);

/* punto de la pantalla → coordenada del plano */
function plAPlano(svg, cx, cy) {
  const r = svg.getBoundingClientRect();
  return [plVB.x + (cx - r.left) / r.width * plVB.w, plVB.y + (cy - r.top) / r.height * plVB.h];
}

function plEventos(svg) {
  svg.addEventListener("wheel", e => {
    e.preventDefault();
    const [px, py] = plAPlano(svg, e.clientX, e.clientY);
    plZoom(px, py, e.deltaY < 0 ? 0.82 : 1 / 0.82);
  }, { passive: false });

  // un dedo o el mouse arrastra; dos dedos acercan; tocar sin mover abre la casa
  const ptr = new Map();
  let movido = false, casaToque = null, distPrev = 0;
  svg.addEventListener("pointerdown", e => {
    svg.setPointerCapture(e.pointerId);
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    if (ptr.size === 1) {
      movido = false;
      const g = e.target.closest("[data-plcasa]");
      casaToque = g ? +g.dataset.plcasa : null;
    } else movido = true;
  });
  svg.addEventListener("pointermove", e => {
    const p = ptr.get(e.pointerId);
    if (!p) return;
    if (ptr.size === 1) {
      if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 6) movido = true;
      if (movido) {
        const k = plVB.w / svg.getBoundingClientRect().width;
        plVB.x -= (e.clientX - p.x) * k; plVB.y -= (e.clientY - p.y) * k;
        plAplicar();
      }
    } else if (ptr.size === 2) {
      const otro = [...ptr.entries()].find(([id]) => id !== e.pointerId)[1];
      const d = Math.hypot(e.clientX - otro.x, e.clientY - otro.y);
      if (distPrev > 0 && d > 0) {
        const [px, py] = plAPlano(svg, (e.clientX + otro.x) / 2, (e.clientY + otro.y) / 2);
        plZoom(px, py, distPrev / d);
      }
      distPrev = d;
    }
    p.x = e.clientX; p.y = e.clientY;
  });
  svg.addEventListener("pointerup", e => {
    if (!ptr.delete(e.pointerId)) return;
    if (ptr.size < 2) distPrev = 0;
    if (ptr.size === 0 && !movido) casaToque ? plAbrir(casaToque) : S.pl.casa && plCerrar();
  });
  svg.addEventListener("pointercancel", e => { ptr.delete(e.pointerId); movido = true; distPrev = 0; });
}

/* ── ficha de la casa ── */
function plAbrir(casaId) { S.pl.casa = casaId; plPintarCasas(); plPintarFicha(); }
function plCerrar() { S.pl.casa = null; plPintarCasas(); plPintarFicha(); }

function plPintarFicha() {
  const box = $("plFicha");
  if (!box) return;
  const c = S.pl.casa && O().casas.find(x => x.id === S.pl.casa);
  $("plAyuda").hidden = !!c;
  if (!c) { box.hidden = true; box.innerHTML = ""; return; }

  const av = avanceCasa(c.id), ea = plEstado(av);
  const cnt = { ok: 0, curso: 0, nada: 0 };
  const filas = O().tareas.filter(t => t.tipo === "CASA").map(t => {
    const { por, total } = acumTC(t.id, c.id);
    const e = plEstado(Math.min(1, total));
    cnt[e]++;
    const quien = Object.keys(por).filter(k => por[k] > 0)
      .map(k => (O().contratistas.find(x => x.id === +k) || {}).nombre).filter(Boolean).join(", ");
    return `<div class="pl-t pl-${e}${+S.pl.ver === t.id ? " pl-t-sel" : ""}">
      <span class="pl-dot"></span>
      <span class="pl-tn">${esc(t.nombre)}${quien ? `<small>${esc(quien)}</small>` : ""}</span>
      <b>${e === "ok" ? "✓" : e === "curso" ? Math.round(total * 100) + "%" : "—"}</b></div>`;
  }).join("");

  box.hidden = false;
  box.innerHTML = `<div class="pl-f-head">
      <div><div class="pl-f-nom">Casa ${esc(c.nombre)}</div>
      <div class="pl-f-sub">Manzana ${esc(c.manzana)} · <span class="pl-e-${ea}">${PL_TXT[ea]}</span></div></div>
      <button type="button" class="pl-x" data-plcerrar="1" title="Cerrar">✕</button></div>
    ${barra(av, ea === "ok" ? "var(--pl-ok)" : "var(--pl-curso)")}
    <div class="pl-f-res">${plPlural(cnt.ok, "terminada", "terminadas")} · ${cnt.curso} en curso
      · ${cnt.nada} sin empezar</div>
    <div class="pl-f-lista">${filas}</div>
    ${puedeCargar() ? `<button type="button" class="btn pl-cargar" data-plcargar="1">Cargar en esta casa</button>` : ""}`;

  box.querySelector("[data-plcerrar]").onclick = plCerrar;
  const bc = box.querySelector("[data-plcargar]");
  if (bc) bc.onclick = () => {
    Object.assign(S.bq, { casa: c.id, fcasa: "" });
    S.tab = "buscar"; render();
    const inp = $("bqIn_con");
    if (inp) inp.focus();
  };
}

window.addEventListener("resize", () => { if (S.tab === "plano") plAplicar(); });
