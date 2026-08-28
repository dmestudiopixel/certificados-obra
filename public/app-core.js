/* ═══════════ estado global ═══════════ */
const S = {
  yo: null, obra: null, qid: null, datos: null, acum: null,
  cache: {},                      // datos de otras quincenas, para reportes
  tab: "carga", ocultar: true, certC: null, certQ: null, repQ: null, repC: "",
};

/* ═══════════ utilidades ═══════════ */
const $ = id => document.getElementById(id);
const money = n => "$" + Math.round(+n || 0).toLocaleString("es-AR");
const qty = n => (!+n) ? "" : (+n).toLocaleString("es-AR", { maximumFractionDigits: 2 });
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
  m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

async function api(m, p, body) {
  const r = await fetch(p, {
    method: m, headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) { location.href = "/"; throw new Error("sesión"); }
  let d = null; try { d = await r.json(); } catch {}
  if (!r.ok) throw new Error((d && d.error) || "Error del servidor");
  return d;
}

let tToast = null;
function avisar(msg, ok) {
  $("toast").innerHTML = `<div class="toast${ok ? " ok" : ""}">
    <span class="dot"></span><span>${esc(msg)}</span></div>`;
  clearTimeout(tToast);
  tToast = setTimeout(() => $("toast").innerHTML = "", ok ? 2600 : 5200);
}
let tSave = null;
function guardando(txt) {
  const g = $("guardando"); g.textContent = txt; g.classList.add("on");
  clearTimeout(tSave); tSave = setTimeout(() => g.classList.remove("on"), 1300);
}

/* ═══════════ atajos de datos ═══════════ */
const O = () => S.obra;
const Q = () => O().quincenas.find(q => q.id === S.qid) || O().quincenas[0];
const esAdmin = () => S.yo.rol === "admin";
const puedeCargar = () => S.yo.rol === "admin" || S.yo.rol === "cargador";
const qCerrada = () => !!Q().cerrada;
// puede editar la quincena actual
const editable = () => puedeCargar() && (!qCerrada() || esAdmin());

function precio(tid, qid) {
  const p = O().precios.find(x => x.quincena_id === (qid || S.qid) && x.tarea_id === tid);
  return p ? +p.monto : 0;
}
function carga(cid, tid, casaId, D) {
  D = D || S.datos;
  const c = D.cargas.find(x =>
    x.contratista_id === cid && x.tarea_id === tid && x.casa_id === casaId);
  return c ? +c.cantidad : 0;
}
function global_(cid, tid, D) {
  D = D || S.datos;
  const g = D.globales.find(x => x.contratista_id === cid && x.tarea_id === tid);
  return g ? +g.cantidad : 0;
}
function cantidad(cid, tid, D) {
  D = D || S.datos;
  let s = global_(cid, tid, D);
  for (const c of D.cargas)
    if (c.contratista_id === cid && c.tarea_id === tid) s += +c.cantidad;
  return s;
}

/* trae (y cachea) los datos de cualquier quincena */
async function datosDe(qid) {
  if (qid === S.qid) return S.datos;
  if (!S.cache[qid]) S.cache[qid] = await api("GET", "/api/quincena/" + qid);
  return S.cache[qid];
}

/* acumulado de obra para tarea+casa: {porCon:{cid:total}, total} */
function acumTC(tid, casaId) {
  const por = {}; let total = 0;
  for (const a of S.acum)
    if (a.tarea_id === tid && a.casa_id === casaId) { por[a.contratista_id] = +a.total; total += +a.total; }
  return { por, total };
}
function estadoCelda(tid, casaId, cid, tipo) {
  if (tipo === "LIBRE") return { e: "libre", ed: true };
  const { por, total } = acumTC(tid, casaId);
  const duenos = Object.keys(por).map(Number);
  const dueno = duenos[0];
  const mio = por[cid] || 0;
  if (total > 1.0001) return { e: mio > 0 ? "over" : "block", ed: mio > 0, dueno };
  if (total >= 0.9999) return { e: mio > 0 ? "own" : "full", ed: mio > 0, dueno };
  if (!dueno) return { e: "libre", ed: true };
  if (dueno === cid) return { e: "own", ed: true, dueno };
  return { e: "block", ed: false, dueno };
}

function totalesQuincena() {
  const r = {};
  for (const c of O().contratistas) {
    let bruto = 0;
    for (const t of O().tareas) bruto += cantidad(c.id, t.id) * precio(t.id);
    const ret = bruto * (+c.retencion || 0);
    const a = S.datos.anticipos.filter(x => x.contratista_id === c.id);
    const din = a.filter(x => x.tipo === "Dinero").reduce((s, x) => s + +x.monto, 0);
    const otr = a.filter(x => x.tipo !== "Dinero").reduce((s, x) => s + +x.monto, 0);
    r[c.id] = { bruto, ret, neto: bruto - ret, din, otr, pagar: bruto - ret - din - otr };
  }
  return r;
}
function avanceCasa(casaId) {
  const tc = O().tareas.filter(t => t.tipo === "CASA");
  if (!tc.length) return 0;
  let s = 0;
  for (const t of tc) s += Math.min(1, acumTC(t.id, casaId).total);
  return s / tc.length;
}

/* ═══════════ carga inicial ═══════════ */
async function bootstrap() {
  S.yo = await api("GET", "/api/yo");
  S.obra = await api("GET", "/api/obra");
  if (!S.obra) { document.body.innerHTML = "<div class='empty'>No hay obras cargadas.</div>"; return; }
  S.qid = S.obra.quincenas[S.obra.quincenas.length - 1].id;
  if (S.yo.rol === "veedor") S.tab = "cert";
  await recargarQuincena();
  render();
}
async function recargarQuincena() {
  const [d, a] = await Promise.all([
    api("GET", "/api/quincena/" + S.qid),
    api("GET", "/api/acumulado"),
  ]);
  S.datos = d; S.acum = a;
  delete S.cache[S.qid];          // el caché de esta quincena queda obsoleto
}
async function recargarObra() { S.obra = await api("GET", "/api/obra"); }
