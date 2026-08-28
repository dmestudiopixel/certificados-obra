/* ═══════════ 5. ANTICIPOS ═══════════ */
const CONCEPTOS = ["Dinero", "Materiales", "Herramientas", "Préstamo", "Otros"];

function vAnticipos() {
  const o = O();
  let h = `<div class="card"><div class="bar">
    <span class="eyebrow">Nuevo anticipo · ${esc(Q().nombre)}</span>
    <select id="aC">${o.contratistas.map(c =>
      `<option value="${c.id}">${esc(c.nombre)}</option>`).join("")}</select>
    <select id="aT">${CONCEPTOS.map(c => `<option>${c}</option>`).join("")}</select>
    <input id="aF" placeholder="Fecha" style="width:100px">
    <input id="aM" placeholder="Monto" style="width:110px">
    <input id="aD" placeholder="Detalle (opcional)" style="width:180px">
    <button class="btn" id="btnAnt">Agregar</button></div>`;

  const ants = S.datos.anticipos;
  h += !ants.length
    ? `<div class="empty">Sin anticipos en esta quincena. Se descuentan del certificado.</div>`
    : `<table class="tb"><thead><tr><th>Fecha</th><th>Contratista</th><th>Concepto</th>
       <th>Detalle</th><th class="n">Monto</th><th></th></tr></thead><tbody>${
       ants.map(a => `<tr><td class="mono">${esc(a.fecha || "—")}</td>
       <td>${esc((o.contratistas.find(c => c.id === a.contratista_id) || {}).nombre)}</td>
       <td>${esc(a.tipo)}</td><td style="color:var(--muted)">${esc(a.detalle || "—")}</td>
       <td class="n mono">${money(a.monto)}</td>
       <td style="width:36px"><button data-delant="${a.id}"
         style="color:var(--over);font-size:15px" title="Borrar">×</button></td></tr>`).join("")
       }</tbody><tfoot><tr><td colspan="4">TOTAL</td>
       <td class="n mono">${money(ants.reduce((s, a) => s + +a.monto, 0))}</td><td></td>
       </tr></tfoot></table>`;
  return h + `</div>`;
}

/* ═══════════ 6. PRECIOS ═══════════ */
function vPrecios() {
  const o = O(), q = Q();
  const idx = o.quincenas.findIndex(x => x.id === q.id);
  const qprev = idx > 0 ? o.quincenas[idx - 1] : null;
  const ed = esAdmin() || !q.cerrada;

  let h = `<div class="card"><div class="bar">
    <span class="eyebrow">Precios · ${esc(q.nombre)}</span>
    <span style="font-size:11.5px;color:var(--muted)">
      Lo que cambies vale para ${esc(q.nombre)} y las que vengan. Las anteriores no se tocan.</span>`;
  if (q.cerrada && !esAdmin()) h += `<span class="cerrada">CERRADA</span>`;
  h += `<div class="spacer"></div>`;
  if (esAdmin()) h += `<button class="btn ghost" id="btnAddTar">Agregar tarea</button>`;
  h += `</div><table class="tb"><thead><tr><th>Tarea</th>
    <th class="n" style="width:150px">Precio en ${esc(q.nombre)}</th>
    <th class="n" style="width:170px">Quincena anterior</th>
    <th style="width:170px">Tipo</th></tr></thead><tbody>`;

  for (const t of o.tareas) {
    const pu = precio(t.id, q.id);
    const pa = qprev ? precio(t.id, qprev.id) : null;
    let dif = `<span style="color:var(--line)">—</span>`;
    if (pa !== null) {
      if (pa === pu) dif = `<span style="color:var(--muted)">${money(pa)}</span>`;
      else {
        const up = pu > pa;
        dif = `<span style="color:var(--muted)">${money(pa)}</span>
          <b style="color:${up ? "var(--full)" : "var(--own)"}">${up ? "▲" : "▼"}${
          pa ? Math.round((pu - pa) / pa * 100) + "%" : ""}</b>`;
      }
    }
    h += `<tr><td>${esAdmin()
      ? `<input value="${esc(t.nombre)}" data-tarnom="${t.id}" style="width:100%">`
      : esc(t.nombre)}</td>
      <td class="n"><input class="mono" data-precio="${t.id}" ${ed ? "" : "readonly"}
        style="width:128px;text-align:right" value="${pu}"></td>
      <td class="n mono" style="font-size:11.5px">${dif}</td>
      <td>${esAdmin()
        ? `<select data-tartipo="${t.id}">
           <option value="CASA"${t.tipo === "CASA" ? " selected" : ""}>Por casa · tope 1</option>
           <option value="LIBRE"${t.tipo === "LIBRE" ? " selected" : ""}>Libre · sin tope</option>
           </select>`
        : (t.tipo === "CASA" ? "Por casa" : "Libre")}</td></tr>`;
  }
  h += `</tbody></table></div>`;

  if (o.quincenas.length > 1) {
    h += `<div class="card" style="margin-top:14px"><div class="bar">
      <span class="eyebrow">Historial de precios</span>
      <span style="font-size:11.5px;color:var(--muted)">Qué se pagaba en cada quincena.
        Marcadas, las que cambiaron.</span></div>
      <div style="overflow-x:auto"><table class="tb"><thead><tr>
      <th style="position:sticky;left:0;z-index:2">Tarea</th>${
      o.quincenas.map(q2 => `<th class="n">${esc(q2.nombre)}</th>`).join("")}
      </tr></thead><tbody>`;
    for (const t of o.tareas) {
      h += `<tr><td style="position:sticky;left:0;background:#fff;z-index:1">${esc(t.nombre)}</td>`;
      let ant = null;
      for (const q2 of o.quincenas) {
        const p = precio(t.id, q2.id);
        const camb = ant !== null && p !== ant;
        h += `<td class="n mono" style="font-size:11.5px;${camb
          ? "background:var(--fullbg);font-weight:700;color:var(--full);" : ""}">${money(p)}</td>`;
        ant = p;
      }
      h += `</tr>`;
    }
    h += `</tbody></table></div></div>`;
  }
  return h;
}

/* ═══════════ 7. CONTRATISTAS ═══════════ */
function vConfig() {
  const o = O();
  return `<div class="card"><div class="bar">
    <span class="eyebrow">Contratistas, retención y tareas</span><div class="spacer"></div>
    <button class="btn ghost" id="btnAddCon">Agregar contratista</button></div>
    <table class="tb"><thead><tr><th style="width:220px">Nombre</th>
    <th class="n" style="width:110px">Retención</th><th>Tareas que hace</th></tr></thead><tbody>${
    o.contratistas.map(c => `<tr>
      <td><input value="${esc(c.nombre)}" data-connom="${c.id}" style="width:100%"></td>
      <td class="n"><input class="mono" data-conret="${c.id}" style="width:64px;text-align:right"
        value="${Math.round((+c.retencion || 0) * 100)}">
        <span style="margin-left:4px;color:var(--muted)">%</span></td>
      <td><div style="display:flex;flex-wrap:wrap;gap:4px">${o.tareas.map(t =>
        `<button class="chip${c.tareas.includes(t.id) ? " on" : ""}"
         data-tog="${c.id}|${t.id}">${esc(t.nombre)}</button>`).join("")}</div></td>
    </tr>`).join("")}</tbody></table></div>`;
}

/* ═══════════ 8. USUARIOS ═══════════ */
function vUsuarios() {
  return `<div class="card"><div class="bar">
    <span class="eyebrow">Nuevo usuario</span>
    <input id="uU" placeholder="Usuario" style="width:130px">
    <input id="uN" placeholder="Nombre y apellido" style="width:180px">
    <select id="uR">
      <option value="cargador">Carga de quincena</option>
      <option value="veedor">Solo ver certificados</option>
      <option value="admin">Administrador</option>
    </select>
    <input id="uC" type="password" placeholder="Contraseña" style="width:130px">
    <button class="btn" id="btnAddUser">Crear</button></div>
    <div id="listaUsuarios"><div class="empty">Cargando…</div></div></div>
    <div class="card" style="margin-top:14px"><div class="bar">
      <span class="eyebrow">Qué puede hacer cada rol</span></div>
      <table class="tb"><thead><tr><th>Rol</th><th>Permisos</th></tr></thead><tbody>
      <tr><td><span class="badge admin">admin</span></td>
        <td>Todo: cargar, precios, anticipos, contratistas, usuarios, cerrar y
            <b>reabrir</b> quincenas, y modificar quincenas cerradas.</td></tr>
      <tr><td><span class="badge cargador">cargador</span></td>
        <td>Cargar la quincena abierta y ajustar precios. No puede tocar anticipos,
            contratistas ni usuarios. <b>No puede modificar una quincena cerrada.</b></td></tr>
      <tr><td><span class="badge veedor">veedor</span></td>
        <td>Solo ver certificados, avance y parte de trabajos. No modifica nada.</td></tr>
      </tbody></table></div>
    <div class="card" style="margin-top:14px"><div class="bar">
      <span class="eyebrow">Bitácora</span>
      <span style="font-size:11.5px;color:var(--muted)">Últimos movimientos del sistema</span></div>
      <div id="bitacora"><div class="empty">Cargando…</div></div></div>`;
}

async function cargarUsuarios() {
  try {
    const us = await api("GET", "/api/usuarios");
    $("listaUsuarios").innerHTML = `<table class="tb"><thead><tr>
      <th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th>
      <th style="width:210px">Acciones</th></tr></thead><tbody>${us.map(u => `<tr>
      <td class="mono">${esc(u.usuario)}</td><td>${esc(u.nombre)}</td>
      <td><span class="badge ${u.rol}">${u.rol}</span></td>
      <td>${u.activo ? "Activo" : '<span style="color:var(--over)">Desactivado</span>'}</td>
      <td><button class="btn ghost" data-pass="${u.id}" style="padding:4px 9px">Cambiar clave</button>
      ${u.id !== S.yo.id
        ? `<button class="btn ghost" data-act="${u.id}|${u.activo ? 0 : 1}"
           style="padding:4px 9px;margin-left:5px">${u.activo ? "Desactivar" : "Activar"}</button>`
        : '<span style="color:var(--muted);font-size:11px;margin-left:8px">tu cuenta</span>'}
      </td></tr>`).join("")}</tbody></table>`;
    const bit = await api("GET", "/api/bitacora");
    $("bitacora").innerHTML = !bit.length
      ? `<div class="empty">Sin movimientos.</div>`
      : `<table class="tb"><thead><tr><th style="width:170px">Cuándo</th>
         <th style="width:150px">Quién</th><th style="width:170px">Acción</th>
         <th>Detalle</th></tr></thead><tbody>${bit.slice(0, 60).map(b => `<tr>
         <td class="mono" style="font-size:11.5px">${new Date(b.creado).toLocaleString("es-AR")}</td>
         <td>${esc(b.unombre || "—")}</td><td class="mono" style="font-size:11.5px">${esc(b.accion)}</td>
         <td style="color:var(--muted)">${esc(b.detalle || "")}</td></tr>`).join("")}</tbody></table>`;
  } catch (e) { $("listaUsuarios").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

/* ═══════════ EVENTOS ═══════════ */

document.addEventListener("input", async e => {
  const el = e.target;
  if (el.classList.contains("cel")) {
    const cid = +el.dataset.c, tid = +el.dataset.t;
    if (el.dataset.glob) {
      if (await setGlobal(cid, tid, el.value)) refrescarFila(cid, tid);
      else el.value = qty(global_(cid, tid));
      return;
    }
    const casaId = +el.dataset.casa;
    if (await setCelda(cid, tid, casaId, el.value)) {
      refrescarTareaCasa(tid, casaId); refrescarFila(cid, tid);
    } else el.value = qty(carga(cid, tid, casaId));
  }
});

/* cambios que se guardan al salir del campo */
document.addEventListener("change", async e => {
  const el = e.target;
  try {
    if (el.id === "selQ") {
      S.qid = +el.value; await recargarQuincena(); render(); return;
    }
    if (el.id === "chkOcultar") { S.ocultar = el.checked; render(); return; }
    if (el.id === "certC") { S.certC = +el.value; render(); return; }
    if (el.id === "certQ") { S.certQ = +el.value; render(); return; }
    if (el.id === "repQ") { S.repQ = +el.value; render(); return; }
    if (el.id === "trabQ") { S.repQ = +el.value; render(); return; }
    if (el.id === "trabC") { S.repC = el.value; render(); return; }

    if (el.dataset.precio) {
      const v = Number(el.value) || 0;
      await api("POST", "/api/precio",
        { quincena_id: S.qid, tarea_id: +el.dataset.precio, monto: v });
      const p = O().precios.find(x => x.quincena_id === S.qid && x.tarea_id === +el.dataset.precio);
      if (p) p.monto = v; else O().precios.push({ quincena_id: S.qid, tarea_id: +el.dataset.precio, monto: v });
      guardando("Precio guardado"); render(); return;
    }
    if (el.dataset.tarnom) {
      await api("PATCH", "/api/tareas/" + el.dataset.tarnom, { nombre: el.value });
      O().tareas.find(t => t.id === +el.dataset.tarnom).nombre = el.value;
      guardando("Guardado"); return;
    }
    if (el.dataset.tartipo) {
      await api("PATCH", "/api/tareas/" + el.dataset.tartipo, { tipo: el.value });
      await recargarObra(); await recargarQuincena(); render(); return;
    }
    if (el.dataset.connom) {
      await api("PATCH", "/api/contratistas/" + el.dataset.connom, { nombre: el.value });
      O().contratistas.find(c => c.id === +el.dataset.connom).nombre = el.value;
      guardando("Guardado"); return;
    }
    if (el.dataset.conret) {
      const v = (Number(el.value) || 0) / 100;
      await api("PATCH", "/api/contratistas/" + el.dataset.conret, { retencion: v });
      O().contratistas.find(c => c.id === +el.dataset.conret).retencion = v;
      guardando("Guardado"); return;
    }
  } catch (x) { avisar(x.message); }
});

document.addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if (b.dataset.tab) { S.tab = b.dataset.tab; render(); return; }

    if (b.id === "btnSalir") {
      await api("POST", "/api/logout"); location.href = "/"; return;
    }

    if (b.id === "btnNuevaQ") {
      const n = prompt("Nombre de la quincena nueva:", "Q" + (O().quincenas.length + 1));
      if (!n) return;
      const f = prompt("Fecha (opcional):", "") || "";
      const nq = await api("POST", "/api/quincenas", { nombre: n, fecha: f });
      await recargarObra(); S.qid = nq.id; await recargarQuincena(); render();
      avisar(`Quincena ${n} creada. Los bloqueos anteriores ya están aplicados.`, true);
      return;
    }
    if (b.id === "btnCerrar") {
      if (!confirm(`¿Cerrar ${Q().nombre}?\n\nEl usuario de carga no va a poder modificarla. ` +
        `Vos como administrador sí podés reabrirla después.`)) return;
      await api("POST", `/api/quincenas/${S.qid}/cerrar`);
      await recargarObra(); render();
      avisar(`${Q().nombre} cerrada.`, true); return;
    }
    if (b.id === "btnAbrir") {
      if (!confirm(`¿Reabrir ${Q().nombre}?\n\nVuelve a quedar editable para el usuario de carga.`)) return;
      await api("POST", `/api/quincenas/${S.qid}/abrir`);
      await recargarObra(); render();
      avisar(`${Q().nombre} reabierta. Queda registrado en la bitácora.`, true); return;
    }

    if (b.id === "btnAnt") {
      const m = Number($("aM").value);
      if (!m || isNaN(m)) { avisar("Poné un monto válido."); return; }
      await api("POST", "/api/anticipos", {
        quincena_id: S.qid, contratista_id: +$("aC").value, tipo: $("aT").value,
        monto: m, fecha: $("aF").value, detalle: $("aD").value });
      await recargarQuincena(); render(); avisar("Anticipo cargado.", true); return;
    }
    if (b.dataset.delant) {
      if (!confirm("¿Borrar este anticipo?")) return;
      await api("DELETE", "/api/anticipos/" + b.dataset.delant);
      await recargarQuincena(); render(); return;
    }

    if (b.dataset.tog) {
      const [cid, tid] = b.dataset.tog.split("|").map(Number);
      const c = O().contratistas.find(x => x.id === cid);
      const activo = !c.tareas.includes(tid);
      await api("POST", "/api/contratista-tarea",
        { contratista_id: cid, tarea_id: tid, activo });
      c.tareas = activo ? [...c.tareas, tid] : c.tareas.filter(x => x !== tid);
      b.classList.toggle("on", activo);
      return;
    }
    if (b.id === "btnAddCon") {
      const n = prompt("Nombre del contratista:");
      if (!n) return;
      await api("POST", "/api/contratistas", { nombre: n });
      await recargarObra(); render(); return;
    }
    if (b.id === "btnAddTar") {
      const n = prompt("Nombre de la tarea:");
      if (!n) return;
      const tipo = confirm("¿Es una tarea POR CASA (con tope de 1,00 y bloqueo)?\n\n" +
        "Aceptar = por casa\nCancelar = libre (metros, jornales, unidades)") ? "CASA" : "LIBRE";
      await api("POST", "/api/tareas", { nombre: n, tipo });
      await recargarObra(); await recargarQuincena(); render();
      avisar("Tarea creada. Cargale el precio y asignala a los contratistas.", true);
      return;
    }

    if (b.id === "btnAddUser") {
      const u = $("uU").value.trim(), n = $("uN").value.trim(), c = $("uC").value;
      if (!u || !n || !c) { avisar("Completá usuario, nombre y contraseña."); return; }
      await api("POST", "/api/usuarios", { usuario: u, nombre: n, clave: c, rol: $("uR").value });
      $("uU").value = $("uN").value = $("uC").value = "";
      cargarUsuarios(); avisar("Usuario creado.", true); return;
    }
    if (b.dataset.pass) {
      const c = prompt("Contraseña nueva (mínimo 6 caracteres):");
      if (!c) return;
      await api("PATCH", "/api/usuarios/" + b.dataset.pass, { clave: c });
      avisar("Contraseña cambiada.", true); return;
    }
    if (b.dataset.act) {
      const [id, act] = b.dataset.act.split("|");
      await api("PATCH", "/api/usuarios/" + id, { activo: act === "1" });
      cargarUsuarios(); return;
    }
  } catch (x) { avisar(x.message); }
});
