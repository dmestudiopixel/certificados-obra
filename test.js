const B = "http://localhost:3000";
let ck = "";

async function req(m, p, body) {
  const r = await fetch(B + p, {
    method: m,
    headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = r.headers.get("set-cookie");
  if (sc) ck = sc.split(";")[0];
  let d = null;
  try { d = await r.json(); } catch {}
  return { status: r.status, d };
}

const money = n => "$" + Math.round(n).toLocaleString("es-AR");
let fallos = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "OK " : "FALLA"}  ${msg}`); if (!ok) fallos++; };

(async () => {
  console.log("\n═══ 1. LOGIN Y ROLES ═══");
  let r = await req("POST", "/api/login", { usuario: "admin", clave: "malaclave" });
  check(r.status === 401, "clave incorrecta rechazada");

  r = await req("POST", "/api/login", { usuario: "admin", clave: "admin123" });
  check(r.status === 200 && r.d.rol === "admin", "login admin");

  console.log("\n═══ 2. BLOQUEO CRUZADO ═══");
  const obra = (await req("GET", "/api/obra")).d;
  const tPiso = obra.tareas.find(t => t.nombre === "Piso").id;
  const cCesar = obra.contratistas.find(c => c.nombre === "Perez César").id;
  const cAtay = obra.contratistas.find(c => c.nombre === "ATAY").id;
  const C14 = obra.casas.find(c => c.nombre === "C14").id;
  const C8 = obra.casas.find(c => c.nombre === "C8").id;
  const q1 = obra.quincenas[0].id;

  r = await req("POST", "/api/carga",
    { quincena_id: q1, contratista_id: cAtay, tarea_id: tPiso, casa_id: C14, cantidad: 1 });
  check(r.status === 409, "ATAY bloqueado en Piso/C14 → " + (r.d.error || "").slice(0, 60));

  r = await req("POST", "/api/carga",
    { quincena_id: q1, contratista_id: cCesar, tarea_id: tPiso, casa_id: C14, cantidad: 1.5 });
  check(r.status === 409, "tope 1,00 respetado → " + (r.d.error || "").slice(0, 55));

  r = await req("POST", "/api/carga",
    { quincena_id: q1, contratista_id: cAtay, tarea_id: tPiso, casa_id: C8, cantidad: 1 });
  check(r.status === 200, "casa libre C8 aceptada");
  await req("POST", "/api/carga",
    { quincena_id: q1, contratista_id: cAtay, tarea_id: tPiso, casa_id: C8, cantidad: 0 });

  console.log("\n═══ 3. PRECIO CONGELADO POR QUINCENA ═══");
  r = await req("POST", "/api/quincenas", { nombre: "Q2", fecha: "12/09/2026" });
  const q2 = r.d.id;
  check(!!q2, "Q2 creada");

  const av1a = (await req("GET", "/api/reportes/avance/" + q1)).d;
  const brutoQ1antes = av1a.filas.reduce((s, f) => s + f.bruto, 0);

  await req("POST", "/api/precio", { quincena_id: q2, tarea_id: tPiso, monto: 420000 });
  const av1b = (await req("GET", "/api/reportes/avance/" + q1)).d;
  const brutoQ1desp = av1b.filas.reduce((s, f) => s + f.bruto, 0);

  check(brutoQ1antes === brutoQ1desp,
    `Q1 intacta tras subir precio en Q2: ${money(brutoQ1antes)} = ${money(brutoQ1desp)}`);

  console.log("\n═══ 4. CIERRE DE QUINCENA ═══");
  await req("POST", "/api/quincenas/" + q1 + "/cerrar");
  await req("POST", "/api/logout"); ck = "";
  await req("POST", "/api/login", { usuario: "carga", clave: "obra2026" });

  r = await req("POST", "/api/carga",
    { quincena_id: q1, contratista_id: cCesar, tarea_id: tPiso, casa_id: C8, cantidad: 1 });
  check(r.status === 403, "cargador NO puede tocar quincena cerrada");

  r = await req("POST", "/api/carga",
    { quincena_id: q2, contratista_id: cCesar, tarea_id: tPiso, casa_id: C8, cantidad: 1 });
  check(r.status === 200, "cargador SÍ puede cargar en Q2 abierta");

  r = await req("POST", "/api/usuarios",
    { usuario: "x", clave: "123456", nombre: "X", rol: "admin" });
  check(r.status === 403, "cargador NO puede crear usuarios");

  r = await req("POST", "/api/anticipos",
    { quincena_id: q2, contratista_id: cCesar, tipo: "Dinero", monto: 1000 });
  check(r.status === 403, "cargador NO puede cargar anticipos");

  console.log("\n═══ 5. ROL VEEDOR ═══");
  await req("POST", "/api/logout"); ck = "";
  await req("POST", "/api/login", { usuario: "veedor", clave: "ver2026" });

  r = await req("POST", "/api/carga",
    { quincena_id: q2, contratista_id: cCesar, tarea_id: tPiso, casa_id: C14, cantidad: 1 });
  check(r.status === 403, "veedor NO puede cargar");

  r = await req("GET", "/api/reportes/avance/" + q1);
  check(r.status === 200, "veedor SÍ puede ver reportes");

  console.log("\n═══ 6. ADMIN REABRE ═══");
  await req("POST", "/api/logout"); ck = "";
  await req("POST", "/api/login", { usuario: "admin", clave: "admin123" });
  r = await req("POST", "/api/quincenas/" + q1 + "/abrir");
  check(r.status === 200, "admin reabre la quincena");

  // limpiar lo que el cargador dejó en Q2 sobre C8
  await req("POST", "/api/carga",
    { quincena_id: q2, contratista_id: cCesar, tarea_id: tPiso, casa_id: C8, cantidad: 0 });
  r = await req("POST", "/api/carga",
    { quincena_id: q1, contratista_id: cCesar, tarea_id: tPiso, casa_id: C8, cantidad: 1 });
  check(r.status === 200, "admin ya puede cargar en Q1 (antes estaba bloqueado)");
  await req("POST", "/api/carga",
    { quincena_id: q1, contratista_id: cCesar, tarea_id: tPiso, casa_id: C8, cantidad: 0 });

  console.log("\n═══ 7. REPORTE DE AVANCE Q1 ═══");
  const av = (await req("GET", "/api/reportes/avance/" + q1)).d;
  let tb = 0, tn = 0, tp = 0;
  console.log("  " + "CONTRATISTA".padEnd(15) + "BRUTO".padStart(12) +
    "NETO".padStart(12) + "ANTIC".padStart(11) + "A PAGAR".padStart(12));
  for (const f of av.filas) {
    tb += f.bruto; tn += f.neto; tp += f.pagar;
    console.log("  " + f.contratista.padEnd(15) + money(f.bruto).padStart(12) +
      money(f.neto).padStart(12) + money(f.din + f.otr).padStart(11) +
      money(f.pagar).padStart(12));
  }
  console.log("  " + "─".repeat(62));
  console.log("  " + "TOTAL".padEnd(15) + money(tb).padStart(12) +
    money(tn).padStart(12) + money(tb - tn - (tb - tn)).padStart(11) + money(tp).padStart(12));
  check(Math.round(tn) === 15469800, `neto Q1 = ${money(tn)} (esperado $15.469.800)`);

  console.log("\n═══ 8. PARTE DE TRABAJOS (sin plata) ═══");
  const tr = (await req("GET", `/api/reportes/trabajos/${q1}?contratista=${cCesar}`)).d;
  for (const c of tr.contratistas) {
    console.log("  " + c.contratista.toUpperCase());
    for (const i of c.items) {
      const cs = i.casas.map(x => x.casa + (x.cant !== 1 ? ` (${x.cant})` : "")).join(", ");
      console.log(`    ${i.tarea.padEnd(32)} total ${String(i.total).padStart(5)}` +
        (i.global ? `  global ${i.global}` : ""));
      if (cs) console.log(`       ${cs}`);
    }
  }
  check(tr.contratistas.length > 0, "parte de trabajos generado");

  console.log("\n═══ 9. AVANCE FÍSICO POR CASA ═══");
  const ob = (await req("GET", "/api/reportes/obra")).d;
  const conAv = ob.filter(x => x.avance > 0);
  console.log("  casas con avance:", conAv.length, "de", ob.length);
  console.log("  " + conAv.slice(0, 6).map(x => `${x.casa} ${Math.round(x.avance * 100)}%`).join("  "));
  check(conAv.length > 0, "avance por casa calculado");

  console.log("\n═══ 10. BITÁCORA ═══");
  const bit = (await req("GET", "/api/bitacora")).d;
  check(Array.isArray(bit) && bit.length > 0, `bitácora con ${bit.length} registros`);
  console.log("  últimas:", bit.slice(0, 4).map(b => b.accion).join(", "));

  console.log("\n" + "═".repeat(50));
  console.log(fallos === 0 ? "TODAS LAS PRUEBAS PASARON" : `${fallos} PRUEBAS FALLARON`);
  console.log("═".repeat(50));
})();
