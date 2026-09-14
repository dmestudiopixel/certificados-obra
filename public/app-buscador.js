/* ═══════════ CARGAR POR CASA (buscadores) ═══════════
 *
 *  Otra forma de cargar lo mismo que la grilla de Carga: se elige contratista,
 *  casa y/o tarea con buscadores y se carga el porcentaje.
 *
 *  Guarda con setCelda(), el mismo camino que usa la grilla, así que:
 *   - lo cargado acá aparece en la pestaña Carga (es el mismo dato),
 *   - el servidor aplica las mismas reglas: una tarea en una casa la hace un
 *     solo contratista, y no se puede pasar de 1,00 sumando las quincenas.
 *
 *  El valor que se escribe es el de ESTA quincena (reemplaza, igual que en la
 *  grilla). Las tareas libres (sin casa) se siguen cargando en Carga. */

S.bq = { con: null, casa: null, tar: null, fcon: "", fcasa: "", ftar: "", soloDisp: true };

const bqNorm = s => String(s == null ? "" : s).normalize("NFD")
  .replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const bqPct = f => Math.round((+f || 0) * 1000) / 10;               // 0,3333 → 33,3
const bqPctTxt = f => bqPct(f).toLocaleString("es-AR") + "%";
const bqCon = id => O().contratistas.find(c => c.id === id);
const bqCasa = id => O().casas.find(c => c.id === id);
const bqTarea = id => O().tareas.find(t => t.id === id);
const bqTareasCasa = () => O().tareas.filter(t => t.tipo === "CASA");

/* estado de una tarea en una casa, visto desde un contratista */
function bqSituacion(cid, tid, casaId) {
  const { por, total } = acumTC(tid, casaId);
  const estaQ = carga(cid, tid, casaId);                 // lo cargado en esta quincena
  const mio = por[cid] || 0;                             // lo mío en toda la obra
  const ajeno = Object.keys(por).map(Number).find(k => k !== cid && por[k] > 0);
  const e = ajeno ? "ajena" : total >= 0.9999 ? "completa" : total > 0 ? "curso" : "libre";
  return {
    e, estaQ, total, dueno: ajeno,
    antes: Math.max(0, mio - estaQ),                     // mío en otras quincenas
    disp: Math.max(0, 1 - total),                        // lo que falta para 100%
    tope: Math.max(0, 1 - (total - estaQ)),              // máximo para esta quincena
  };
}

/* ── armado de la pestaña ── */
function vBuscar() {
  const q = Q();
  let h = `<div class="card" style="margin-bottom:14px"><div class="bar">
    <span class="eyebrow">Cargar por casa · Quincena ${esc(q.nombre)}</span>`;
  if (q.cerrada) h += `<span class="cerrada">CERRADA${esAdmin()
    ? " · como administrador podés modificarla" : " · no se puede modificar"}</span>`;
  h += `<div class="spacer"></div>
    <span style="font-size:11.5px;color:var(--muted)">Lo que cargues acá se ve en la pestaña Carga</span>
    <button class="btn ghost" data-bqlimpiar="1">Limpiar</button></div>
    <div class="bq-grid">
      ${bqCaja("con", "1 · Contratista", "Buscar contratista…")}
      ${bqCaja("casa", "2 · Casa", "Buscar casa…  ej. C7")}
      ${bqCaja("tar", "Tarea (opcional)", "Buscar tarea…")}
    </div></div>
    <div id="bqRes"></div>`;
  return h;
}

function bqCaja(k, titulo, ph) {
  return `<div class="bq-caja"><div class="eyebrow">${titulo}</div>
    <div class="bq-sel" id="bqSel_${k}"></div>
    <input id="bqIn_${k}" data-bqbuscar="${k}" placeholder="${ph}" autocomplete="off"
      value="${esc(S.bq["f" + k])}">
    <div class="bq-lista" id="bqLista_${k}"></div></div>`;
}

function pintarBuscador() {
  if (!$("bqRes")) return;
  for (const k of ["con", "casa", "tar"]) { bqPintarSel(k); bqPintarLista(k); }
  bqPintarResultado();
}

function bqPintarSel(k) {
  const id = S.bq[k];
  let txt = "";
  if (id && k === "con") txt = bqCon(id).nombre;
  if (id && k === "casa") { const c = bqCasa(id); txt = `${c.nombre} · Mz ${c.manzana}`; }
  if (id && k === "tar") txt = bqTarea(id).nombre;
  $("bqSel_" + k).innerHTML = id
    ? `<button class="chip on" data-bqquitar="${k}" title="Quitar">${esc(txt)} ✕</button>` : "";
}

function bqPintarLista(k) {
  const f = bqNorm(S.bq["f" + k]);
  const box = $("bqLista_" + k);
  if (S.bq[k] && !f) { box.innerHTML = ""; return; }   // ya elegido y sin buscar: no molestar

  let ops = [];
  if (k === "con")
    ops = O().contratistas.map(c => ({ id: c.id, txt: c.nombre, buscar: c.nombre }));
  if (k === "casa")
    ops = O().casas.map(c => ({ id: c.id, txt: c.nombre, sub: "Mz " + c.manzana,
      buscar: `${c.nombre} mz ${c.manzana} manzana ${c.manzana}` }));
  if (k === "tar") {
    const con = S.bq.con && bqCon(S.bq.con);
    ops = bqTareasCasa().filter(t => !con || con.tareas.includes(t.id))
      .map(t => ({ id: t.id, txt: t.nombre, buscar: t.nombre }));
  }
  if (f) ops = ops.filter(o => bqNorm(o.buscar).includes(f));

  const MAX = k === "casa" ? 80 : 30;
  box.innerHTML = !ops.length
    ? `<span class="bq-nada">Sin resultados</span>`
    : ops.slice(0, MAX).map(o => `<button class="chip" data-bqelegir="${k}|${o.id}">${esc(o.txt)}${
        o.sub ? ` <small>${esc(o.sub)}</small>` : ""}</button>`).join("") +
      (ops.length > MAX ? `<span class="bq-nada">y ${ops.length - MAX} más… seguí escribiendo</span>` : "");
}

/* ── resultados ── */
function bqPintarResultado() {
  const { con, casa, tar } = S.bq;
  const box = $("bqRes");
  const aviso = t => `<div class="card"><div class="empty">${t}</div></div>`;

  if (!con && !casa && !tar)
    return box.innerHTML = aviso("Elegí un <b>contratista</b> y una <b>casa</b> para ver qué puede certificar.");

  // sin contratista: solo ver cómo está (quién tiene cada cosa)
  if (!con) {
    const filas = casa
      ? bqTareasCasa().filter(t => !tar || t.id === tar).map(t => ({ t, c: bqCasa(casa) }))
      : O().casas.map(c => ({ t: bqTarea(tar), c }));
    return box.innerHTML = bqTablaVer(filas, casa ? "Tarea" : "Casa", !!casa);
  }

  const c = bqCon(con);
  const asignadas = bqTareasCasa().filter(t => c.tareas.includes(t.id));
  if (!asignadas.length)
    return box.innerHTML = aviso(`${esc(c.nombre)} no tiene tareas por casa asignadas.
      Se asignan en la pestaña Contratistas.`);

  if (tar && !c.tareas.includes(tar))
    return box.innerHTML = aviso(`${esc(c.nombre)} no tiene asignada la tarea ${esc(bqTarea(tar).nombre)}.`);

  if (casa) {
    const filas = asignadas.filter(t => !tar || t.id === tar).map(t => ({ t, c: bqCasa(casa) }));
    return box.innerHTML = bqTablaCargar(con, filas, "Tarea",
      `${esc(c.nombre)} · Casa ${esc(bqCasa(casa).nombre)} (Mz ${esc(bqCasa(casa).manzana)})`, false);
  }

  if (tar) {
    let filas = O().casas.map(ca => ({ t: bqTarea(tar), c: ca }));
    const total = filas.length;
    if (S.bq.soloDisp)
      filas = filas.filter(f => {
        const s = bqSituacion(con, f.t.id, f.c.id);
        return s.e !== "ajena" && (s.e !== "completa" || s.estaQ > 0);
      });
    return box.innerHTML = bqTablaCargar(con, filas, "Casa",
      `${esc(c.nombre)} · ${esc(bqTarea(tar).nombre)} en todas las casas`, true, total);
  }

  box.innerHTML = aviso(`Ahora elegí una <b>casa</b> — o una <b>tarea</b> para ver en qué casas
    puede cargar ${esc(c.nombre)}.`);
}

function bqEtiqueta(s) {
  if (s.e === "ajena") return `<span class="bq-tag ajena">Bloqueada · la tiene ${
    esc((bqCon(s.dueno) || {}).nombre || "otro")}</span>`;
  if (s.e === "completa") return `<span class="bq-tag completa">Completa</span>`;
  if (s.e === "curso") return `<span class="bq-tag curso">Disponible ${bqPctTxt(s.disp)}</span>`;
  return `<span class="bq-tag libre">Disponible 100%</span>`;
}

function bqTablaCargar(cid, filas, col, titulo, porCasa, total) {
  const ed = editable();
  let h = `<div class="card"><div class="bar"><span class="eyebrow">${titulo}</span>
    <div class="spacer"></div>`;
  if (porCasa) h += `<label style="font-size:12px;color:var(--muted);display:flex;gap:6px;align-items:center">
    <input type="checkbox" id="bqSoloDisp"${S.bq.soloDisp ? " checked" : ""} style="width:14px;height:14px">
    Solo casas donde puede cargar</label>`;
  h += `</div>`;
  if (!ed) h += `<div class="bq-ro">Esta quincena está cerrada: podés ver, pero no cargar.</div>`;
  if (!filas.length)
    return h + `<div class="empty">No hay casas disponibles para esta tarea${
      total ? ` (de ${total} casas, todas están completas o las tiene otro contratista)` : ""}.</div></div>`;

  h += `<div class="scroll"><table class="tb bq-tb"><thead><tr><th>${col}</th><th>Estado</th>
    <th class="n">Certificado antes</th><th class="n">Esta quincena</th>
    <th style="width:1%"></th></tr></thead><tbody>`;
  for (const { t, c } of filas) {
    const s = bqSituacion(cid, t.id, c.id);
    const puede = ed && s.e !== "ajena" && s.tope > 0.0001;
    const k = `${cid}|${t.id}|${c.id}`;
    h += `<tr class="bq-f-${s.e}">
      <td style="font-weight:600">${porCasa
        ? `<span class="mono">${esc(c.nombre)}</span> <small style="color:var(--muted);font-weight:400">Mz ${esc(c.manzana)}</small>`
        : esc(t.nombre)}</td>
      <td>${bqEtiqueta(s)}</td>
      <td class="n mono">${s.antes ? bqPctTxt(s.antes) : "—"}</td>
      <td class="n"><span class="bq-in"><input class="mono" data-bqpct="${k}" inputmode="decimal"
        value="${s.estaQ ? bqPct(s.estaQ).toLocaleString("es-AR") : ""}"
        ${puede ? "" : "disabled"} placeholder="0"><i>%</i></span>
        ${puede ? `<div class="bq-max">máx. ${bqPctTxt(s.tope)}</div>` : ""}</td>
      <td style="white-space:nowrap">${puede ? `
        <button class="btn" data-bqguardar="${k}">Guardar</button>${s.e !== "completa" ? `
        <button class="btn ghost" data-bqcompletar="${k}" title="Cargar todo lo que falta">Completar</button>` : ""}` : ""}
        ${ed && s.estaQ > 0 ? `<button class="btn ghost" data-bqborrar="${k}" title="Borrar lo de esta quincena">Quitar</button>` : ""}
      </td></tr>`;
  }
  return h + `</tbody></table></div></div>`;
}

/* vista de solo lectura, cuando no hay contratista elegido */
function bqTablaVer(filas, col, porTarea) {
  let h = `<div class="card"><div class="bar"><span class="eyebrow">${porTarea
      ? `Casa ${esc(bqCasa(S.bq.casa).nombre)} · cómo está cada tarea`
      : `${esc(bqTarea(S.bq.tar).nombre)} · cómo está cada casa`}</span>
    <div class="spacer"></div>
    <span style="font-size:11.5px;color:var(--muted)">Elegí un contratista para cargar</span></div>
    <div class="scroll"><table class="tb bq-tb"><thead><tr><th>${col}</th><th>Quién la tiene</th>
    <th class="n">Certificado</th></tr></thead><tbody>`;
  for (const { t, c } of filas) {
    const { por, total } = acumTC(t.id, c.id);
    const quien = Object.keys(por).map(Number).filter(k => por[k] > 0)
      .map(k => esc((bqCon(k) || {}).nombre || "")).join(", ");
    h += `<tr><td style="font-weight:600">${porTarea ? esc(t.nombre)
        : `<span class="mono">${esc(c.nombre)}</span> <small style="color:var(--muted);font-weight:400">Mz ${esc(c.manzana)}</small>`}</td>
      <td>${quien || `<span style="color:var(--muted)">Nadie todavía</span>`}</td>
      <td class="n mono">${total >= 0.9999 ? `<span class="bq-tag completa">Completa</span>`
        : total > 0 ? bqPctTxt(total) : "—"}</td></tr>`;
  }
  return h + `</tbody></table></div></div>`;
}

/* ── guardar ── */
async function bqGuardar(k, valorPct) {
  const [cid, tid, casaId] = k.split("|").map(Number);
  if (!editable()) { avisar("La quincena está cerrada."); return; }
  const s = bqSituacion(cid, tid, casaId);
  const t = bqTarea(tid), ca = bqCasa(casaId);
  if (s.e === "ajena") {
    avisar(`${t.nombre} en ${ca.nombre} ya la tiene ${(bqCon(s.dueno) || {}).nombre}. ` +
      `Una tarea en una casa la hace un solo contratista.`);
    return;
  }
  const raw = String(valorPct == null ? "" : valorPct).trim().replace(",", ".");
  const p = raw === "" ? 0 : Number(raw);
  if (isNaN(p) || p < 0 || p > 100) { avisar("Poné un porcentaje entre 0 y 100."); return; }
  const v = Math.round(p * 100) / 10000;                   // 30 % → 0,3
  if (v > s.tope + 0.0001) {
    avisar(`${t.nombre} en ${ca.nombre}: como máximo ${bqPctTxt(s.tope)} en esta quincena ` +
      `(ya hay ${bqPctTxt(s.total - s.estaQ)} certificado antes).`);
    return;
  }
  if (await setCelda(cid, tid, casaId, v ? String(v) : "")) {
    pintarBuscador();
    avisar(v ? `${t.nombre} en ${ca.nombre}: ${bqPctTxt(v)} cargado en ${Q().nombre}.`
      : `${t.nombre} en ${ca.nombre}: se quitó lo de ${Q().nombre}.`, true);
  }
}

/* ── eventos (solo reaccionan a elementos de esta pestaña) ── */
document.addEventListener("input", e => {
  const el = e.target;
  if (el.dataset && el.dataset.bqbuscar) {
    const k = el.dataset.bqbuscar;
    S.bq["f" + k] = el.value;
    bqPintarLista(k);
  }
});

document.addEventListener("keydown", e => {
  const el = e.target;
  if (!el.dataset) return;
  if (el.dataset.bqpct && e.key === "Enter") { e.preventDefault(); bqGuardar(el.dataset.bqpct, el.value); }
  if (el.dataset.bqbuscar && e.key === "Enter") {         // Enter elige el primer resultado
    const b = $("bqLista_" + el.dataset.bqbuscar).querySelector("button");
    if (b) { e.preventDefault(); b.click(); }
  }
});

document.addEventListener("change", e => {
  if (e.target.id === "bqSoloDisp") { S.bq.soloDisp = e.target.checked; bqPintarResultado(); }
});

document.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || !b.dataset) return;
  const d = b.dataset;

  if (d.bqelegir) {
    const [k, id] = d.bqelegir.split("|");
    S.bq[k] = +id; S.bq["f" + k] = "";
    $("bqIn_" + k).value = "";
    // si el contratista nuevo no hace la tarea elegida, se suelta la tarea
    if (k === "con" && S.bq.tar && !bqCon(+id).tareas.includes(S.bq.tar)) S.bq.tar = null;
    pintarBuscador();
    const sig = k === "con" && !S.bq.casa ? "casa" : null;  // pasar al siguiente buscador
    if (sig) $("bqIn_" + sig).focus();
    return;
  }
  if (d.bqquitar) { S.bq[d.bqquitar] = null; pintarBuscador(); $("bqIn_" + d.bqquitar).focus(); return; }
  if (d.bqlimpiar) {
    Object.assign(S.bq, { con: null, casa: null, tar: null, fcon: "", fcasa: "", ftar: "" });
    for (const k of ["con", "casa", "tar"]) $("bqIn_" + k).value = "";
    pintarBuscador(); return;
  }
  if (d.bqguardar) {
    const inp = document.querySelector(`[data-bqpct="${d.bqguardar}"]`);
    bqGuardar(d.bqguardar, inp.value); return;
  }
  if (d.bqcompletar) {
    const [cid, tid, casaId] = d.bqcompletar.split("|").map(Number);
    const tope = bqSituacion(cid, tid, casaId).tope;
    bqGuardar(d.bqcompletar, String(Math.round(tope * 10000) / 100));
    return;
  }
  if (d.bqborrar) {
    const [, tid, casaId] = d.bqborrar.split("|").map(Number);
    if (!confirm(`¿Quitar lo cargado en ${Q().nombre} para ${bqTarea(tid).nombre} en ${bqCasa(casaId).nombre}?`)) return;
    bqGuardar(d.bqborrar, ""); return;
  }
});
