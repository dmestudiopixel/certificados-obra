/* ═══════════ chrome ═══════════ */
const TABS = [
  ["carga", "Carga", ["admin", "cargador"]],
  ["cert", "Certificados", ["admin", "cargador", "veedor"]],
  ["avance", "Avance", ["admin", "cargador", "veedor"]],
  ["trabajos", "Parte de trabajos", ["admin", "cargador", "veedor"]],
  ["anticipos", "Anticipos", ["admin"]],
  ["precios", "Precios", ["admin", "cargador"]],
  ["config", "Contratistas", ["admin"]],
  ["usuarios", "Usuarios", ["admin"]],
];

function render() {
  const o = O(), q = Q();
  $("selQ").innerHTML = o.quincenas.map(x =>
    `<option value="${x.id}"${x.id === q.id ? " selected" : ""}>${esc(x.nombre)}${
      x.fecha ? " · " + esc(x.fecha) : ""}${x.cerrada ? " (cerrada)" : ""}</option>`).join("");
  $("obraNom").textContent = o.obra.nombre;
  $("quien").innerHTML = `<b>${esc(S.yo.nombre)}</b>
    <i><span class="badge ${S.yo.rol}">${S.yo.rol}</span></i>`;

  const permitidas = TABS.filter(t => t[2].includes(S.yo.rol));
  if (!permitidas.some(t => t[0] === S.tab)) S.tab = permitidas[0][0];
  $("nav").innerHTML = permitidas.map(([k, l]) =>
    `<button data-tab="${k}" class="${S.tab === k ? "on" : ""}">${l}</button>`).join("");

  const v = $("vista");
  const f = { carga: vCarga, cert: vCert, avance: vAvance, trabajos: vTrabajos,
    anticipos: vAnticipos, precios: vPrecios, config: vConfig, usuarios: vUsuarios }[S.tab];
  v.innerHTML = f ? f() : "";
  if (S.tab === "usuarios") cargarUsuarios();
  if (S.tab === "avance") cargarAvance();
  if (S.tab === "trabajos") cargarTrabajos();
}

/* ═══════════ 1. GRILLA DE CARGA ═══════════ */
function vCarga() {
  const o = O(), q = Q();
  const casasPorMz = {};
  for (const c of o.casas) (casasPorMz[c.manzana] = casasPorMz[c.manzana] || []).push(c);

  let h = `<div class="card"><div class="bar">
    <span class="eyebrow">Quincena ${esc(q.nombre)}</span>`;
  if (q.cerrada) h += `<span class="cerrada">CERRADA${esAdmin()
    ? " · como administrador podés modificarla" : " · no se puede modificar"}</span>`;
  h += `<div class="leg">
    <i><span class="sw" style="background:#fff"></span>Libre</i>
    <i><span class="sw" style="background:var(--ownbg);border-color:var(--own)"></span>Certificó este</i>
    <i><span class="sw" style="background:var(--blockbg)"></span>La tomó otro</i>
    <i><span class="sw" style="background:var(--fullbg);border-color:var(--full)"></span>Terminada</i>
    </div><div class="spacer"></div>
    <label style="font-size:12px;color:var(--muted);display:flex;gap:6px;align-items:center">
      <input type="checkbox" id="chkOcultar"${S.ocultar ? " checked" : ""}
        style="width:14px;height:14px"> Ocultar tareas que no hace</label>`;
  if (esAdmin()) {
    h += q.cerrada
      ? `<button class="btn ghost" id="btnAbrir">Reabrir quincena</button>`
      : `<button class="btn ghost" id="btnCerrar">Cerrar quincena</button>`;
    h += `<button class="btn" id="btnNuevaQ">Nueva quincena</button>`;
  }
  h += `</div><div class="scroll"><table class="grid"><thead><tr class="mz">
    <th class="cfix c-con" rowspan="2" style="text-align:left;padding-left:7px">Contratista</th>
    <th class="cfix c-tar" rowspan="2" style="text-align:left;padding-left:7px">Tarea</th>
    <th class="cfix c-mon" rowspan="2" style="padding-right:7px">Monto</th>`;
  for (const [mz, cs] of Object.entries(casasPorMz))
    h += `<th colspan="${cs.length}">MZ ${esc(mz)}</th>`;
  h += `<th rowspan="2" style="width:62px;min-width:62px">Global</th>
    <th rowspan="2" style="width:56px;min-width:56px">Cant.</th>
    <th rowspan="2" style="width:96px;min-width:96px">Importe</th></tr><tr class="casas">`;
  for (const c of o.casas)
    h += `<th style="width:27px;min-width:27px"><div class="hcasa">
      <span class="nm mono">${esc(c.nombre)}</span>
      <span class="hbar"><b id="hb_${c.id}" style="width:${avanceCasa(c.id) * 100}%"></b></span>
      </div></th>`;
  h += `</tr></thead><tbody>`;

  const ed = editable();
  for (const c of o.contratistas) {
    const ts = o.tareas.filter(t => !S.ocultar || c.tareas.includes(t.id));
    if (!ts.length) continue;
    ts.forEach((t, i) => {
      const pu = precio(t.id), cant = cantidad(c.id, t.id);
      h += `<tr${t.tipo === "LIBRE" ? ' class="libre"' : ""}>`;
      if (i === 0) h += `<td class="cfix c-con conname" rowspan="${ts.length}"><div>${esc(c.nombre)}
        <small>${Math.round((+c.retencion || 0) * 100)}% ret.</small></div></td>`;
      h += `<td class="cfix c-tar tx">${esc(t.nombre)}</td>
        <td class="cfix c-mon tx mono" style="text-align:right">${pu ? money(pu) : "—"}</td>`;
      for (const casa of o.casas) {
        const st = estadoCelda(t.id, casa.id, c.id, t.tipo);
        const val = carga(c.id, t.id, casa.id);
        const puede = ed && st.ed;
        const tip = st.dueno && st.dueno !== c.id
          ? ` title="Tomada por ${esc((o.contratistas.find(x => x.id === st.dueno) || {}).nombre)}"` : "";
        h += `<td class="s-${st.e}" id="td_${c.id}_${t.id}_${casa.id}"${tip}>
          <input class="cel mono" data-c="${c.id}" data-t="${t.id}" data-casa="${casa.id}"
          ${puede ? "" : "readonly tabindex=-1"} value="${qty(val)}"></td>`;
      }
      h += `<td class="${t.tipo === "LIBRE" ? "s-libre" : "s-block"}">
        <input class="cel mono" data-c="${c.id}" data-t="${t.id}" data-glob="1"
        ${ed && t.tipo === "LIBRE" ? "" : "readonly tabindex=-1"} value="${qty(global_(c.id, t.id))}"></td>
        <td class="num mono" style="font-weight:600" id="cant_${c.id}_${t.id}">${qty(cant)}</td>
        <td class="num mono" id="imp_${c.id}_${t.id}">${cant ? money(cant * pu) : ""}</td></tr>`;
    });
  }
  return h + `</tbody></table></div></div>`;
}

/* guardar una celda contra el servidor */
async function setCelda(cid, tid, casaId, raw) {
  const v = raw === "" ? 0 : Number(String(raw).replace(",", "."));
  if (raw !== "" && (isNaN(v) || v < 0)) {
    avisar("Poné un número. 1 = casa completa, 0,5 = media casa."); return false;
  }
  try {
    guardando("Guardando…");
    await api("POST", "/api/carga",
      { quincena_id: S.qid, contratista_id: cid, tarea_id: tid, casa_id: casaId, cantidad: v });
    // actualizar estado local
    const i = S.datos.cargas.findIndex(x =>
      x.contratista_id === cid && x.tarea_id === tid && x.casa_id === casaId);
    if (v === 0) { if (i >= 0) S.datos.cargas.splice(i, 1); }
    else if (i >= 0) S.datos.cargas[i].cantidad = v;
    else S.datos.cargas.push({ quincena_id: S.qid, contratista_id: cid, tarea_id: tid,
      casa_id: casaId, cantidad: v });
    S.acum = await api("GET", "/api/acumulado");
    guardando("Guardado");
    return true;
  } catch (e) { avisar(e.message); guardando("No se guardó"); return false; }
}
async function setGlobal(cid, tid, raw) {
  const v = raw === "" ? 0 : Number(String(raw).replace(",", "."));
  if (raw !== "" && (isNaN(v) || v < 0)) { avisar("Poné un número válido."); return false; }
  try {
    guardando("Guardando…");
    await api("POST", "/api/global",
      { quincena_id: S.qid, contratista_id: cid, tarea_id: tid, cantidad: v });
    const i = S.datos.globales.findIndex(x => x.contratista_id === cid && x.tarea_id === tid);
    if (v === 0) { if (i >= 0) S.datos.globales.splice(i, 1); }
    else if (i >= 0) S.datos.globales[i].cantidad = v;
    else S.datos.globales.push({ quincena_id: S.qid, contratista_id: cid, tarea_id: tid, cantidad: v });
    guardando("Guardado");
    return true;
  } catch (e) { avisar(e.message); guardando("No se guardó"); return false; }
}
function refrescarTareaCasa(tid, casaId) {
  const o = O(), t = o.tareas.find(x => x.id === tid);
  for (const c of o.contratistas) {
    const td = $(`td_${c.id}_${tid}_${casaId}`);
    if (!td) continue;
    const st = estadoCelda(tid, casaId, c.id, t.tipo);
    td.className = "s-" + st.e;
    const inp = td.querySelector("input");
    if (editable() && st.ed) { inp.removeAttribute("readonly"); inp.tabIndex = 0; }
    else { inp.setAttribute("readonly", ""); inp.tabIndex = -1; }
    if (st.dueno && st.dueno !== c.id)
      td.title = "Tomada por " + ((o.contratistas.find(x => x.id === st.dueno) || {}).nombre || "");
    else td.removeAttribute("title");
  }
  const hb = $("hb_" + casaId);
  if (hb) hb.style.width = (avanceCasa(casaId) * 100) + "%";
}
function refrescarFila(cid, tid) {
  const cant = cantidad(cid, tid), pu = precio(tid);
  const a = $(`cant_${cid}_${tid}`), b = $(`imp_${cid}_${tid}`);
  if (a) a.textContent = qty(cant);
  if (b) b.textContent = cant ? money(cant * pu) : "";
}

/* ═══════════ 2. CERTIFICADO ═══════════ */
function vCert() {
  const o = O();
  if (!S.certC || !o.contratistas.some(c => c.id === S.certC)) S.certC = o.contratistas[0].id;
  if (!S.certQ || !o.quincenas.some(q => q.id === S.certQ)) S.certQ = S.qid;

  const h = `<div class="card noprint" style="margin-bottom:14px"><div class="bar">
    <span class="eyebrow">Contratista</span>
    <select id="certC">${o.contratistas.map(x =>
      `<option value="${x.id}"${x.id === S.certC ? " selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select>
    <span class="eyebrow">Quincena</span>
    <select id="certQ">${o.quincenas.map(x =>
      `<option value="${x.id}"${x.id === S.certQ ? " selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select>
    <div class="spacer"></div>
    <button class="btn ghost" onclick="window.print()">Imprimir / PDF</button></div></div>
    <div id="certDoc"><div class="empty">Cargando…</div></div>`;
  setTimeout(pintarCert, 0);
  return h;
}

async function pintarCert() {
  try {
    const o = O();
    const D = await datosDe(S.certQ);
    const c = o.contratistas.find(x => x.id === S.certC);
    const q = o.quincenas.find(x => x.id === S.certQ);

    const filas = o.tareas
      .map(t => ({ t, cant: cantidad(S.certC, t.id, D), pu: precio(t.id, S.certQ) }))
      .filter(f => f.cant > 0).map(f => ({ ...f, imp: f.cant * f.pu }));
    const bruto = filas.reduce((s, f) => s + f.imp, 0);
    const ret = bruto * (+c.retencion || 0);
    const ants = D.anticipos.filter(a => a.contratista_id === S.certC);
    const din = ants.filter(a => a.tipo === "Dinero").reduce((s, a) => s + +a.monto, 0);
    const otr = ants.filter(a => a.tipo !== "Dinero");
    const otrT = otr.reduce((s, a) => s + +a.monto, 0);

    // acumulado del contratista en toda la obra
    let ab = 0, aa = 0;
    for (const qq of o.quincenas) {
      const DD = await datosDe(qq.id);
      for (const t of o.tareas) ab += cantidad(S.certC, t.id, DD) * precio(t.id, qq.id);
      aa += DD.anticipos.filter(a => a.contratista_id === S.certC)
        .reduce((s, a) => s + +a.monto, 0);
    }

    let h = `<div class="doc"><div class="head"><div><h1>Certificado de obra</h1>
      <div style="font-size:12px;color:var(--muted);margin-top:3px">${esc(o.obra.nombre)}</div></div>
      <div class="mono" style="font-size:12px;text-align:right">${esc(q.nombre)}<br>
      ${esc(q.fecha || "sin fecha")}${q.cerrada ? "<br>CERRADA" : ""}</div></div>
      <div class="kv">
        <div><i>Contratista</i><b>${esc(c.nombre)}</b></div>
        <div><i>Retención</i><b class="mono">${Math.round((+c.retencion || 0) * 100)}%</b></div>
        <div><i>Ítems certificados</i><b class="mono">${filas.length}</b></div></div>`;

    h += filas.length
      ? `<table class="tb"><thead><tr><th>Tarea</th><th class="n">Unitario</th>
         <th class="n">Cantidad</th><th class="n">Importe</th></tr></thead><tbody>${
         filas.map(f => `<tr><td>${esc(f.t.nombre)}</td><td class="n mono">${money(f.pu)}</td>
         <td class="n mono">${qty(f.cant)}</td><td class="n mono">${money(f.imp)}</td></tr>`).join("")
         }</tbody></table>`
      : `<div class="empty">No hay trabajo cargado de ${esc(c.nombre)} en ${esc(q.nombre)}.</div>`;

    h += `<div style="margin-top:18px">
      <div class="tl"><span>Total certificado</span><b class="mono">${money(bruto)}</b></div>
      <div class="tl neg"><span>Retención ${Math.round((+c.retencion || 0) * 100)}%</span>
        <b class="mono">−${money(ret)}</b></div>`;
    if (din > 0) h += `<div class="tl neg"><span>Anticipo en dinero</span>
      <b class="mono">−${money(din)}</b></div>`;
    if (otrT > 0) h += `<div class="tl neg"><span>Otros descuentos ·
      ${esc([...new Set(otr.map(a => a.tipo))].join(", "))}</span>
      <b class="mono">−${money(otrT)}</b></div>`;
    h += `<div class="tl fin"><span>Neto a abonar</span>
      <b class="mono">${money(bruto - ret - din - otrT)}</b></div></div>

      <div class="kv" style="margin-top:26px;padding-top:14px;border-top:1px solid var(--line2)">
        <div><i>Certificado acumulado en la obra</i><b class="mono">${money(ab)}</b></div>
        <div><i>Neto acumulado</i><b class="mono">${money(ab * (1 - (+c.retencion || 0)))}</b></div>
        <div><i>Anticipos totales</i><b class="mono">${money(aa)}</b></div></div>

      <div class="firmas"><div>Firma contratista</div><div>Firma dirección de obra</div></div></div>`;
    $("certDoc").innerHTML = h;
  } catch (e) { $("certDoc").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

/* ═══════════ 3. AVANCE (reporte imprimible) ═══════════ */
function vAvance() {
  const o = O();
  if (!S.repQ || !o.quincenas.some(q => q.id === S.repQ)) S.repQ = S.qid;
  return `<div class="card noprint" style="margin-bottom:14px"><div class="bar">
    <span class="eyebrow">Avance de la quincena</span>
    <select id="repQ">${o.quincenas.map(x =>
      `<option value="${x.id}"${x.id === S.repQ ? " selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select>
    <div class="spacer"></div>
    <button class="btn ghost" onclick="window.print()">Imprimir / PDF</button></div></div>
    <div id="repAvance"><div class="empty">Cargando…</div></div>`;
}

async function cargarAvance() {
  try {
    const o = O();
    const [d, casas] = await Promise.all([
      api("GET", "/api/reportes/avance/" + S.repQ),
      api("GET", "/api/reportes/obra"),
    ]);
    const t = d.filas.reduce((a, f) => ({
      bruto: a.bruto + f.bruto, ret: a.ret + f.ret, neto: a.neto + f.neto,
      din: a.din + f.din, otr: a.otr + f.otr, pagar: a.pagar + f.pagar,
      ab: a.ab + f.acum_bruto, an: a.an + f.acum_neto, aa: a.aa + f.acum_ants,
    }), { bruto: 0, ret: 0, neto: 0, din: 0, otr: 0, pagar: 0, ab: 0, an: 0, aa: 0 });

    let h = `<div class="doc ancho"><div class="head">
      <div><h1>Avance de obra por quincena</h1>
      <div style="font-size:12px;color:var(--muted);margin-top:3px">${esc(o.obra.nombre)}</div></div>
      <div class="mono" style="font-size:12px;text-align:right">${esc(d.quincena.nombre)}<br>
      ${esc(d.quincena.fecha || "sin fecha")}${d.quincena.cerrada ? "<br>CERRADA" : ""}</div></div>

      <div style="margin-top:18px;font-size:10px;font-weight:700;letter-spacing:.13em;
        text-transform:uppercase;color:var(--muted)">Esta quincena</div>
      <table class="tb" style="margin-top:6px"><thead><tr><th>Contratista</th>
      <th class="n">Certificado</th><th class="n">Retención</th><th class="n">Neto</th>
      <th class="n">Ant. dinero</th><th class="n">Otros</th><th class="n">A pagar</th>
      </tr></thead><tbody>${d.filas.map(f => `<tr>
        <td>${esc(f.contratista)}</td>
        <td class="n mono">${f.bruto ? money(f.bruto) : "—"}</td>
        <td class="n mono">${f.ret ? money(f.ret) : "—"}</td>
        <td class="n mono">${f.neto ? money(f.neto) : "—"}</td>
        <td class="n mono">${f.din ? money(f.din) : "—"}</td>
        <td class="n mono">${f.otr ? money(f.otr) : "—"}</td>
        <td class="n mono" style="font-weight:700;background:var(--ownbg)">${money(f.pagar)}</td>
      </tr>`).join("")}</tbody>
      <tfoot><tr><td>TOTAL</td>
        <td class="n mono">${money(t.bruto)}</td><td class="n mono">${money(t.ret)}</td>
        <td class="n mono">${money(t.neto)}</td><td class="n mono">${money(t.din)}</td>
        <td class="n mono">${money(t.otr)}</td><td class="n mono">${money(t.pagar)}</td>
      </tr></tfoot></table>

      <div style="margin-top:26px;font-size:10px;font-weight:700;letter-spacing:.13em;
        text-transform:uppercase;color:var(--muted)">Acumulado de la obra hasta ${esc(d.quincena.nombre)}</div>
      <table class="tb" style="margin-top:6px"><thead><tr><th>Contratista</th>
      <th class="n">Certificado acumulado</th><th class="n">Neto acumulado</th>
      <th class="n">Anticipos acumulados</th></tr></thead><tbody>${d.filas.map(f => `<tr>
        <td>${esc(f.contratista)}</td>
        <td class="n mono">${money(f.acum_bruto)}</td>
        <td class="n mono">${money(f.acum_neto)}</td>
        <td class="n mono">${f.acum_ants ? money(f.acum_ants) : "—"}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td>TOTAL</td><td class="n mono">${money(t.ab)}</td>
      <td class="n mono">${money(t.an)}</td><td class="n mono">${money(t.aa)}</td>
      </tr></tfoot></table>`;

    const hechas = casas.filter(c => c.avance >= 0.999).length;
    const prom = casas.reduce((s, c) => s + c.avance, 0) / (casas.length || 1);
    h += `<div style="margin-top:26px;font-size:10px;font-weight:700;letter-spacing:.13em;
      text-transform:uppercase;color:var(--muted)">Avance físico · ${hechas} de ${casas.length}
      casas terminadas · promedio ${Math.round(prom * 100)}%</div>
      <div class="casas-grid" style="padding-left:0">${casas.map(c => `
        <div class="casita"><div class="cn mono">${esc(c.casa)}</div>
        <div class="cb"><div style="height:100%;width:${c.avance * 100}%;
          background:${c.avance >= 1 ? "var(--full)" : "var(--own)"}"></div></div>
        <div class="cp mono">${Math.round(c.avance * 100)}%</div></div>`).join("")}</div>
      <div class="firmas"><div>Dirección de obra</div><div>Comitente</div></div></div>`;
    $("repAvance").innerHTML = h;
  } catch (e) { $("repAvance").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

/* ═══════════ 4. PARTE DE TRABAJOS ═══════════ */
function vTrabajos() {
  const o = O();
  if (!S.repQ || !o.quincenas.some(q => q.id === S.repQ)) S.repQ = S.qid;
  return `<div class="card noprint" style="margin-bottom:14px"><div class="bar">
    <span class="eyebrow">Parte de trabajos</span>
    <select id="trabQ">${o.quincenas.map(x =>
      `<option value="${x.id}"${x.id === S.repQ ? " selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select>
    <select id="trabC"><option value="">Todos los contratistas</option>${
      o.contratistas.map(c => `<option value="${c.id}"${
        String(c.id) === String(S.repC) ? " selected" : ""}>${esc(c.nombre)}</option>`).join("")}</select>
    <span style="font-size:11.5px;color:var(--muted)">Trabajos ejecutados, sin importes</span>
    <div class="spacer"></div>
    <button class="btn ghost" onclick="window.print()">Imprimir / PDF</button></div></div>
    <div id="repTrab"><div class="empty">Cargando…</div></div>`;
}

async function cargarTrabajos() {
  try {
    const o = O();
    const url = "/api/reportes/trabajos/" + S.repQ + (S.repC ? "?contratista=" + S.repC : "");
    const d = await api("GET", url);
    let h = `<div class="doc"><div class="head">
      <div><h1>Parte de trabajos</h1>
      <div style="font-size:12px;color:var(--muted);margin-top:3px">${esc(o.obra.nombre)}</div></div>
      <div class="mono" style="font-size:12px;text-align:right">${esc(d.quincena.nombre)}<br>
      ${esc(d.quincena.fecha || "sin fecha")}</div></div>`;

    if (!d.contratistas.length)
      h += `<div class="empty">No hay trabajos cargados en esta quincena.</div>`;
    else for (const c of d.contratistas) {
      const totalItems = c.items.length;
      h += `<div class="trab"><h3>${esc(c.contratista)}
        <span style="float:right;font-weight:400;font-size:11.5px;opacity:.75">
        ${totalItems} tarea${totalItems === 1 ? "" : "s"}</span></h3>`;
      for (const i of c.items) {
        const casas = i.casas.map(x =>
          `${esc(x.casa)}${x.cant !== 1 ? ` <span style="color:var(--full)">(${qty(x.cant)})</span>` : ""}`
        ).join(" · ");
        h += `<div class="titem"><div style="flex:1">
          <div class="nom">${esc(i.tarea)}${i.tipo === "LIBRE"
            ? '<span class="lib">libre</span>' : ""}</div>
          ${casas ? `<div class="casas">${casas}</div>` : ""}
          ${i.global ? `<div class="casas">Global / sin casa: <b>${qty(i.global)}</b></div>` : ""}
          </div><div class="tot mono">${qty(i.total)}
          ${i.tipo === "CASA" ? `<div style="font-size:10px;font-weight:400;color:var(--muted)">
            ${i.completas} completa${i.completas === 1 ? "" : "s"}${
            i.parciales ? ` · ${i.parciales} parcial${i.parciales === 1 ? "" : "es"}` : ""}</div>` : ""}
          </div></div>`;
      }
      h += `</div>`;
    }
    h += `<div class="firmas"><div>Capataz</div><div>Dirección de obra</div></div></div>`;
    $("repTrab").innerHTML = h;
  } catch (e) { $("repTrab").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
