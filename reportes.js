/*  reportes.js — cálculos y reportes imprimibles */
const { q } = require("./db");

/* Devuelve todo lo necesario para calcular una quincena */
async function datosQuincena(qid) {
  const [{ rows: [qn] }, precios, cargas, glob, ants, cons, tareas, casas] = await Promise.all([
    q("SELECT * FROM quincenas WHERE id=$1", [qid]),
    q("SELECT tarea_id, monto FROM precios WHERE quincena_id=$1", [qid]),
    q("SELECT * FROM cargas WHERE quincena_id=$1", [qid]),
    q("SELECT * FROM globales WHERE quincena_id=$1", [qid]),
    q("SELECT * FROM anticipos WHERE quincena_id=$1", [qid]),
    q(`SELECT c.* FROM contratistas c JOIN quincenas x ON x.obra_id=c.obra_id
       WHERE x.id=$1 AND c.activo ORDER BY c.orden, c.id`, [qid]),
    q(`SELECT t.* FROM tareas t JOIN quincenas x ON x.obra_id=t.obra_id
       WHERE x.id=$1 AND t.activa ORDER BY t.orden, t.id`, [qid]),
    q(`SELECT ca.id, ca.nombre, m.nombre AS manzana, m.orden AS mo, ca.orden AS co
       FROM casas ca JOIN manzanas m ON m.id=ca.manzana_id
       JOIN quincenas x ON x.obra_id=m.obra_id WHERE x.id=$1
       ORDER BY m.orden, ca.orden`, [qid]),
  ]);
  const precio = {};
  for (const p of precios.rows) precio[p.tarea_id] = +p.monto;
  return { qn, precio, cargas: cargas.rows, globales: glob.rows,
    anticipos: ants.rows, contratistas: cons.rows, tareas: tareas.rows, casas: casas.rows };
}

/* cantidad de un contratista+tarea en la quincena */
function cantidadDe(d, cid, tid) {
  let s = 0;
  for (const c of d.cargas)
    if (c.contratista_id === cid && c.tarea_id === tid) s += +c.cantidad;
  for (const g of d.globales)
    if (g.contratista_id === cid && g.tarea_id === tid) s += +g.cantidad;
  return s;
}

/* totales de plata por contratista */
function totales(d) {
  const out = {};
  for (const c of d.contratistas) {
    let bruto = 0;
    for (const t of d.tareas) bruto += cantidadDe(d, c.id, t.id) * (d.precio[t.id] || 0);
    const ret = bruto * (+c.retencion || 0);
    const a = d.anticipos.filter(x => x.contratista_id === c.id);
    const din = a.filter(x => x.tipo === "Dinero").reduce((s, x) => s + +x.monto, 0);
    const otr = a.filter(x => x.tipo !== "Dinero").reduce((s, x) => s + +x.monto, 0);
    out[c.id] = { bruto, ret, neto: bruto - ret, din, otr, pagar: bruto - ret - din - otr };
  }
  return out;
}

/* ═══════ REPORTE 1: avance completo de la quincena ═══════ */
async function reporteAvance(qid) {
  const d = await datosQuincena(qid);
  const t = totales(d);

  // acumulado de la obra hasta esta quincena inclusive
  const { rows: acum } = await q(
    `SELECT c.contratista_id,
            SUM(c.cantidad * COALESCE(p.monto,0)) AS bruto
     FROM cargas c
     JOIN precios p ON p.quincena_id=c.quincena_id AND p.tarea_id=c.tarea_id
     JOIN quincenas x ON x.id=c.quincena_id
     WHERE x.orden <= (SELECT orden FROM quincenas WHERE id=$1)
       AND x.obra_id = (SELECT obra_id FROM quincenas WHERE id=$1)
     GROUP BY 1`, [qid]);
  const { rows: acumG } = await q(
    `SELECT g.contratista_id, SUM(g.cantidad * COALESCE(p.monto,0)) AS bruto
     FROM globales g
     JOIN precios p ON p.quincena_id=g.quincena_id AND p.tarea_id=g.tarea_id
     JOIN quincenas x ON x.id=g.quincena_id
     WHERE x.orden <= (SELECT orden FROM quincenas WHERE id=$1)
       AND x.obra_id = (SELECT obra_id FROM quincenas WHERE id=$1)
     GROUP BY 1`, [qid]);
  const { rows: acumA } = await q(
    `SELECT a.contratista_id, SUM(a.monto) AS m FROM anticipos a
     JOIN quincenas x ON x.id=a.quincena_id
     WHERE x.orden <= (SELECT orden FROM quincenas WHERE id=$1)
       AND x.obra_id = (SELECT obra_id FROM quincenas WHERE id=$1)
     GROUP BY 1`, [qid]);

  const ac = {};
  for (const c of d.contratistas) ac[c.id] = { bruto: 0, ants: 0 };
  for (const r of acum) if (ac[r.contratista_id]) ac[r.contratista_id].bruto += +r.bruto;
  for (const r of acumG) if (ac[r.contratista_id]) ac[r.contratista_id].bruto += +r.bruto;
  for (const r of acumA) if (ac[r.contratista_id]) ac[r.contratista_id].ants += +r.m;

  return {
    quincena: d.qn,
    filas: d.contratistas.map(c => ({
      contratista: c.nombre,
      retencion: +c.retencion,
      ...t[c.id],
      acum_bruto: ac[c.id].bruto,
      acum_neto: ac[c.id].bruto * (1 - (+c.retencion || 0)),
      acum_ants: ac[c.id].ants,
    })).filter(f => f.bruto > 0 || f.acum_bruto > 0),
  };
}

/* ═══════ REPORTE 2: parte de trabajos (sin plata) ═══════ */
async function reporteTrabajos(qid, cid) {
  const d = await datosQuincena(qid);
  const casaNom = {};
  for (const c of d.casas) casaNom[c.id] = c.nombre;
  const orden = {};
  d.casas.forEach((c, i) => orden[c.id] = i);

  const cons = cid ? d.contratistas.filter(c => c.id === +cid) : d.contratistas;

  const out = cons.map(c => {
    const items = [];
    for (const t of d.tareas) {
      const cs = d.cargas
        .filter(x => x.contratista_id === c.id && x.tarea_id === t.id && +x.cantidad > 0)
        .sort((a, b) => orden[a.casa_id] - orden[b.casa_id])
        .map(x => ({ casa: casaNom[x.casa_id], cant: +x.cantidad }));
      const g = d.globales.find(x => x.contratista_id === c.id && x.tarea_id === t.id);
      const glob = g ? +g.cantidad : 0;
      if (!cs.length && !glob) continue;
      items.push({
        tarea: t.nombre, tipo: t.tipo, casas: cs, global: glob,
        total: cs.reduce((s, x) => s + x.cant, 0) + glob,
        completas: cs.filter(x => x.cant >= 1).length,
        parciales: cs.filter(x => x.cant < 1).length,
      });
    }
    return { contratista: c.nombre, items };
  }).filter(x => x.items.length);

  return { quincena: d.qn, contratistas: out };
}

/* ═══════ avance físico de obra por casa ═══════ */
async function avanceObra(obraId) {
  const { rows } = await q(
    `SELECT ca.id, ca.nombre, m.nombre AS manzana,
       (SELECT COUNT(*) FROM tareas WHERE obra_id=$1 AND tipo='CASA' AND activa) AS total_tareas,
       COALESCE((SELECT SUM(LEAST(s.t,1)) FROM (
          SELECT c.tarea_id, SUM(c.cantidad) AS t FROM cargas c
          JOIN tareas tt ON tt.id=c.tarea_id
          WHERE c.casa_id=ca.id AND tt.tipo='CASA' GROUP BY c.tarea_id) s),0) AS hechas
     FROM casas ca JOIN manzanas m ON m.id=ca.manzana_id
     WHERE m.obra_id=$1 ORDER BY m.orden, ca.orden`, [obraId]);
  return rows.map(r => ({
    casa: r.nombre, manzana: r.manzana,
    avance: +r.total_tareas ? +r.hechas / +r.total_tareas : 0,
  }));
}

module.exports = { datosQuincena, totales, cantidadDe, reporteAvance, reporteTrabajos, avanceObra };
