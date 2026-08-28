/* Simula el navegador para verificar que las vistas se generen sin errores */
const fs = require("fs");
const path = require("path");

const B = "http://localhost:3000";
let ck = "";

global.fetch = (() => {
  const orig = global.fetch;
  return async (u, o = {}) => {
    const url = u.startsWith("http") ? u : B + u;
    o.headers = { ...(o.headers || {}), ...(ck ? { Cookie: ck } : {}) };
    const r = await orig(url, o);
    const sc = r.headers.get("set-cookie");
    if (sc) ck = sc.split(";")[0];
    return r;
  };
})();

/* DOM mínimo */
const nodos = {};
function nodo(id) {
  if (!nodos[id]) nodos[id] = {
    id, innerHTML: "", textContent: "", value: "", className: "", tabIndex: 0,
    style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){} },
    setAttribute(){}, removeAttribute(){}, querySelector: () => nodo(id + "_i"),
    title: "",
  };
  return nodos[id];
}
global.document = {
  getElementById: nodo,
  addEventListener: () => {},
  body: nodo("body"),
};
global.location = { href: "" };
global.window = { print: () => {} };
const realTimeout = global.setTimeout;
// solo intercepta los setTimeout(fn, 0) de las vistas; el resto va al real
global.setTimeout = (f, ms, ...a) => {
  if (ms === 0 || ms === undefined) { pendientes.push(f); return 0; }
  return realTimeout(f, ms, ...a);
};
const pendientes = [];
global.confirm = () => true;
global.prompt = () => "X";

const errores = [];


/* cargar los tres archivos como si fueran <script> */
const dir = path.join(__dirname, "public");
const src = ["app-core.js", "app-vistas.js", "app-admin.js"]
  .map(f => fs.readFileSync(path.join(dir, f), "utf8"))
  .join("\n;\n");

const ctx = {};
new Function("global", src + "\n;Object.assign(global.__x = {}, {S,render,vCarga,vCert," +
  "vAvance,vTrabajos,vAnticipos,vPrecios,vConfig,vUsuarios,bootstrap,pintarCert," +
  "cargarAvance,cargarTrabajos,cargarUsuarios,totalesQuincena,money,qty});")(global);
const X = global.__x;

const check = (ok, m) => { console.log(`  ${ok ? "OK " : "FALLA"}  ${m}`); if (!ok) errores.push(m); };

(async () => {
  console.log("\n═══ RENDER DE VISTAS ═══\n");

  for (const [usuario, clave, rol] of [
    ["admin", "admin123", "admin"],
    ["carga", "obra2026", "cargador"],
    ["veedor", "ver2026", "veedor"],
  ]) {
    ck = "";
    await fetch("/api/login", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, clave }) });

    await X.bootstrap();
    console.log(`  ── ${rol.toUpperCase()} ──`);
    check(X.S.yo.rol === rol, `sesión ${rol}`);

    const vistas = { carga: X.vCarga, cert: X.vCert, avance: X.vAvance,
      trabajos: X.vTrabajos, anticipos: X.vAnticipos, precios: X.vPrecios,
      config: X.vConfig, usuarios: X.vUsuarios };

    for (const [nom, fn] of Object.entries(vistas)) {
      try {
        X.S.tab = nom;
        const html = fn();
        const ok = typeof html === "string" && html.length > 30 &&
          !html.includes("undefined") && !html.includes("NaN");
        check(ok, `vista ${nom}` + (ok ? ` (${html.length} car.)` :
          " → contiene undefined/NaN o está vacía"));
      } catch (e) { check(false, `vista ${nom} → ${e.message}`); }
    }

    // render general
    try { X.render(); check(true, "render() completo"); }
    catch (e) { check(false, "render() → " + e.message); }

    // certificado async
    try { await X.pintarCert(); check(true, "certificado generado"); }
    catch (e) { check(false, "certificado → " + e.message); }

    // reportes async
    try { await X.cargarAvance(); check(true, "reporte de avance"); }
    catch (e) { check(false, "avance → " + e.message); }
    try { await X.cargarTrabajos(); check(true, "parte de trabajos"); }
    catch (e) { check(false, "trabajos → " + e.message); }
    if (rol === "admin") {
      try { await X.cargarUsuarios(); check(true, "panel de usuarios"); }
      catch (e) { check(false, "usuarios → " + e.message); }
    }
    console.log();
  }

  // verificar cálculo del front contra el backend
  ck = "";
  await fetch("/api/login", { method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: "admin", clave: "admin123" }) });
  await X.bootstrap();
  // posicionarse explícitamente en Q1 (la app abre en la última quincena)
  const q1 = X.S.obra.quincenas.find(q => q.nombre === "Q1");
  X.S.qid = q1.id;
  X.S.datos = await (await fetch("/api/quincena/" + q1.id)).json();
  const t = X.totalesQuincena();
  const neto = Object.values(t).reduce((s, v) => s + v.neto, 0);
  const pagar = Object.values(t).reduce((s, v) => s + v.pagar, 0);
  console.log("═══ CÁLCULO DEL FRONTEND ═══\n");
  console.log("  quincena  : Q1");
  console.log("  neto Q1   :", X.money(neto));
  console.log("  a pagar Q1:", X.money(pagar));
  check(Math.round(neto) === 15469800, "neto coincide con el backend ($15.469.800)");

  console.log("\n" + "═".repeat(52));
  console.log(errores.length ? `${errores.length} PROBLEMAS` : "FRONTEND SIN ERRORES");
  console.log("═".repeat(52));
})();
