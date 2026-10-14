/* restaurar.js — vuelve a cargar un backup completo (el ZIP de Usuarios →
 * Backup completo) en una base PostgreSQL VACÍA: datos y usuarios con su clave.
 *
 *   DATABASE_URL="postgresql://…" node restaurar.js backup-completo-….zip
 *   DATABASE_URL="postgresql://…" node restaurar.js carpeta-descomprimida
 *
 * Si la base ya tiene datos no hace nada (agregá --reemplazar para pisarla).
 * Corre todo en una transacción: si algo falla, la base queda como estaba.
 */
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { TABLAS } = require("./backup");

// lee datos.json y las migraciones de un ZIP o de una carpeta
function leerBackup(origen) {
  if (Buffer.isBuffer(origen) || /\.zip$/i.test(origen)) {
    const zip = new AdmZip(origen);
    const leer = n => { const e = zip.getEntry(n); return e ? e.getData() : null; };
    const migraciones = zip.getEntries()
      .filter(e => /^aplicacion\/migrations\/[^/]+\.sql$/.test(e.entryName))
      .map(e => ({ nombre: path.basename(e.entryName), sql: e.getData().toString("utf8") }));
    return { leer, migraciones };
  }
  const leer = n => { const p = path.join(origen, n); return fs.existsSync(p) ? fs.readFileSync(p) : null; };
  const dirM = path.join(origen, "aplicacion", "migrations");
  const migraciones = fs.existsSync(dirM) ? fs.readdirSync(dirM).filter(f => f.endsWith(".sql"))
    .map(f => ({ nombre: f, sql: fs.readFileSync(path.join(dirM, f), "utf8") })) : [];
  return { leer, migraciones };
}

/* db: una conexión con query(text, values) → { rows } (pg Client). */
async function restaurarBackup(origen, db, { reemplazar = false } = {}) {
  const { leer, migraciones } = leerBackup(origen);
  const crudo = leer("datos.json");
  if (!crudo) throw new Error("No encuentro datos.json: ¿es un backup completo de Certificados de obra?");
  const b = JSON.parse(crudo.toString("utf8"));
  if (b.sistema !== "Certificados de obra" || !b.datos)
    throw new Error("Este archivo no es un backup completo de Certificados de obra");

  // 1. la estructura de la base (las migraciones que vienen en el backup)
  await db.query(`CREATE TABLE IF NOT EXISTS _migraciones (
    nombre VARCHAR(200) PRIMARY KEY, aplicada TIMESTAMPTZ DEFAULT NOW())`);
  const hechas = new Set((await db.query("SELECT nombre FROM _migraciones")).rows.map(r => r.nombre));
  const faltan = (b.migraciones || []).filter(m => !migraciones.some(x => x.nombre === m));
  if (faltan.length && !faltan.every(m => hechas.has(m)))
    throw new Error("Al backup le faltan migraciones: " + faltan.join(", "));
  for (const m of migraciones.sort((x, y) => x.nombre.localeCompare(y.nombre))) {
    if (hechas.has(m.nombre)) continue;
    await db.query(m.sql);
    await db.query("INSERT INTO _migraciones(nombre) VALUES($1)", [m.nombre]);
  }

  // 2. no pisar una base que ya está en uso
  if (!reemplazar) {
    const { rows } = await db.query(
      "SELECT (SELECT COUNT(*) FROM usuarios) + (SELECT COUNT(*) FROM obras) AS n");
    if (+rows[0].n > 0) throw new Error(
      "La base ya tiene datos (usuarios u obra). Para no pisarlos no restauro nada. " +
      "Usá una base vacía, o agregá --reemplazar si de verdad querés reemplazarla.");
  }

  // 3. los datos, en una transacción
  const resumen = {};
  await db.query("BEGIN");
  try {
    const orden = b.tablas || TABLAS;
    for (const t of [...orden].reverse()) await db.query(`DELETE FROM ${t}`);
    for (const t of orden) {
      const filas = b.datos[t] || [];
      // de a 100 filas por INSERT
      for (let i = 0; i < filas.length; i += 100) {
        const lote = filas.slice(i, i + 100);
        const cols = Object.keys(lote[0]);
        const vals = [], marcas = [];
        lote.forEach(r => {
          marcas.push("(" + cols.map(c => { vals.push(r[c] === undefined ? null : r[c]);
            return "$" + vals.length; }).join(",") + ")");
        });
        await db.query(`INSERT INTO ${t} (${cols.join(",")}) VALUES ${marcas.join(",")}`, vals);
      }
      resumen[t] = filas.length;
    }
    // los contadores de id siguen desde el último cargado
    for (const t of orden) {
      if (!(b.datos[t] || [])[0] || !("id" in b.datos[t][0])) continue;
      await db.query(`SELECT setval(pg_get_serial_sequence('${t}','id'),
        COALESCE((SELECT MAX(id) FROM ${t}), 1), (SELECT MAX(id) FROM ${t}) IS NOT NULL)`);
    }
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    throw e;
  }
  return { exportado: b.exportado, resumen };
}

module.exports = { restaurarBackup };

// ── uso por consola ──
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const origen = args.find(a => !a.startsWith("--"));
    if (!origen) {
      console.log("Uso: node restaurar.js backup-completo-….zip [--reemplazar]");
      process.exit(1);
    }
    const url = process.env.DATABASE_URL;
    if (!url) { console.error("Falta DATABASE_URL (la dirección de la base vacía)."); process.exit(1); }
    const { Client } = require("pg");
    const db = new Client({ connectionString: url,
      ssl: /railway|rlwy|render|supabase|amazonaws|neon/.test(url) ? { rejectUnauthorized: false } : false });
    await db.connect();
    try {
      console.log("Restaurando", origen, "…");
      const r = await restaurarBackup(origen, db, { reemplazar: args.includes("--reemplazar") });
      console.log(`Listo. Backup del ${r.exportado}.`);
      for (const [t, n] of Object.entries(r.resumen)) console.log(`  ${t.padEnd(20)} ${n}`);
    } catch (e) {
      console.error("\nNo se restauró nada:", e.message);
      process.exitCode = 1;
    } finally { await db.end(); }
  })();
}
