/*  db.js — conexión y motor de migraciones
 *
 *  CÓMO ACTUALIZAR EL SISTEMA A FUTURO
 *  ───────────────────────────────────
 *  1. Creá un archivo nuevo en /migrations con el número siguiente:
 *        002_agregar_campo.sql
 *        003_nueva_tabla.sql
 *  2. Escribí adentro sólo los cambios (ALTER TABLE, CREATE TABLE, etc).
 *  3. Subí el código. Al arrancar, el sistema detecta las migraciones que
 *     todavía no aplicó y ejecuta únicamente esas, en orden.
 *
 *  Las migraciones ya aplicadas NO se vuelven a correr nunca.
 *  Los datos existentes NO se tocan. No hay que exportar ni recargar nada.
 */
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const url = process.env.DATABASE_URL;
if (!url) { console.error("Falta DATABASE_URL"); process.exit(1); }

const pool = new Pool({
  connectionString: url,
  ssl: /railway|render|supabase|amazonaws|neon/.test(url) ? { rejectUnauthorized: false } : false,
  max: 8,
});

async function migrar() {
  const c = await pool.connect();
  try {
    await c.query(`CREATE TABLE IF NOT EXISTS _migraciones (
      nombre VARCHAR(200) PRIMARY KEY,
      aplicada TIMESTAMPTZ DEFAULT NOW()
    )`);

    const dir = path.join(__dirname, "migrations");
    const archivos = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
    const { rows } = await c.query("SELECT nombre FROM _migraciones");
    const hechas = new Set(rows.map(r => r.nombre));

    let n = 0;
    for (const f of archivos) {
      if (hechas.has(f)) continue;
      const sql = fs.readFileSync(path.join(dir, f), "utf8");
      // cada migración corre dentro de su propia transacción:
      // si falla, no queda a medias
      try {
        await c.query("BEGIN");
        await c.query(sql);
        await c.query("INSERT INTO _migraciones(nombre) VALUES($1)", [f]);
        await c.query("COMMIT");
        console.log("  ✓ migración aplicada:", f);
        n++;
      } catch (e) {
        await c.query("ROLLBACK");
        console.error("  ✗ falló la migración", f, "→", e.message);
        throw e;
      }
    }
    console.log(n ? `Migraciones nuevas: ${n}` : "Base de datos al día");
  } finally { c.release(); }
}

const q = (text, params) => pool.query(text, params);

async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) { await c.query("ROLLBACK"); throw e; }
  finally { c.release(); }
}

module.exports = { pool, q, tx, migrar };
