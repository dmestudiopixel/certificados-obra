/* backup.js — backup COMPLETO en un ZIP: datos, la aplicación y las
 * instrucciones para restaurar. Se descarga desde la pestaña Usuarios (admin).
 *
 *   datos.json          todas las tablas (incluye usuarios con su clave cifrada)
 *   aplicacion/         el programa completo (pantallas, plano, servidor, migraciones)
 *   COMO-RESTAURAR.txt  paso a paso
 *
 * Para volver a cargarlo: restaurar.js (ver COMO-RESTAURAR.txt).
 */
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

// orden en que se cargan al restaurar (respeta las referencias entre tablas)
const TABLAS = [
  "usuarios", "obras", "manzanas", "casas", "tareas", "contratistas", "contratista_tareas",
  "quincenas", "precios", "cargas", "globales", "anticipos", "bitacora",
];

// archivos de la aplicación que van en el backup (sin node_modules ni secretos)
function archivosAplicacion(raiz) {
  const fuera = new Set(["node_modules", ".git", ".claude", ".env"]);
  const lista = [];
  (function recorrer(dir) {
    for (const n of fs.readdirSync(dir)) {
      if (fuera.has(n) || n.startsWith(".env") || n.endsWith(".log")) continue;
      const p = path.join(dir, n);
      if (fs.statSync(p).isDirectory()) recorrer(p);
      else lista.push(p);
    }
  })(raiz);
  return lista;
}

// fecha y hora de Argentina para el nombre del archivo: 2026-10-14_09-30
const fechaArchivo = () => new Date(Date.now() - 3 * 3600e3).toISOString()
  .slice(0, 16).replace("T", "_").replace(":", "-");

async function armarBackup(pool, res) {
  const fecha = fechaArchivo();
  const nombreZip = `backup-completo-certificados-${fecha}.zip`;

  // los datos se leen todos juntos, en una foto consistente, antes de empezar el ZIP
  const datos = {}, resumen = {};
  let migs;
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    for (const t of TABLAS) {
      datos[t] = (await c.query(`SELECT * FROM ${t} ORDER BY 1`)).rows;
      resumen[t] = datos[t].length;
    }
    migs = (await c.query("SELECT nombre FROM _migraciones ORDER BY nombre")).rows;
    await c.query("COMMIT");
  } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; }
  finally { c.release(); }

  const zip = archiver("zip", { zlib: { level: 6 } });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${nombreZip}"`);
  zip.on("warning", e => console.warn("backup:", e.message));
  zip.on("error", e => { console.error("backup:", e.message); res.destroy(e); });
  zip.pipe(res);

  zip.append(JSON.stringify({
    sistema: "Certificados de obra", formato: 1, exportado: new Date().toISOString(),
    migraciones: migs.map(m => m.nombre), tablas: TABLAS, resumen, datos,
  }, null, 1), { name: "datos.json" });

  // la aplicación tal como está publicada
  const raiz = __dirname;
  for (const p of archivosAplicacion(raiz))
    zip.file(p, { name: "aplicacion/" + path.relative(raiz, p).split(path.sep).join("/") });

  zip.append(instrucciones(fecha, nombreZip, resumen), { name: "COMO-RESTAURAR.txt" });
  await zip.finalize();
}

function instrucciones(fecha, nombreZip, resumen) {
  const filas = Object.entries(resumen).map(([t, n]) => `   ${t.padEnd(20)} ${n}`).join("\n");
  return `CERTIFICADOS DE OBRA — BACKUP COMPLETO DEL ${fecha.replace("_", " ")}
${"=".repeat(56)}

QUÉ TRAE ESTE ARCHIVO
  datos.json     Todos los datos: obra, manzanas, casas, tareas, contratistas,
                 quincenas, precios, cargas, tareas libres, anticipos, bitácora
                 y usuarios (con su clave cifrada).
  aplicacion/    El programa completo: pantallas, plano, servidor y estructura
                 de la base.

  Registros por tabla:
${filas}

GUARDALO EN UN LUGAR SEGURO
  Trae las claves de los usuarios (cifradas, no legibles). Guardá una copia en
  Google Drive y otra en un pendrive. No lo mandes por WhatsApp ni por mail.

CÓMO VOLVER A LEVANTAR LA WEB DESDE CERO
  Necesitás: Node.js 18 o más nuevo, y una base PostgreSQL VACÍA
  (por ejemplo, un servicio Postgres nuevo en Railway).

  IMPORTANTE: restaurá los datos ANTES de arrancar la web por primera vez.
  Si la web arranca con la base vacía, carga los datos iniciales de ejemplo.
  (Si ya pasó, usá --reemplazar en el paso 3.)

  1. Descomprimí este ZIP en una carpeta.
  2. Abrí una terminal en la carpeta "aplicacion" y ejecutá:
         npm install
  3. Restaurá los datos en la base vacía (poné la dirección de tu base):
         Windows (PowerShell):
           $env:DATABASE_URL="postgresql://usuario:clave@host:puerto/base"
           node restaurar.js ..\\${nombreZip}
         Mac / Linux:
           DATABASE_URL="postgresql://..." node restaurar.js ../${nombreZip}
     (también se puede indicar la carpeta descomprimida en lugar del .zip)
     Si la base ya tiene datos, no hace nada y avisa.
  4. Publicá la carpeta "aplicacion" (en Railway: nuevo servicio con este código,
     variable DATABASE_URL apuntando a la base, JWT_SECRET con un texto largo
     cualquiera y NODE_ENV=production). Al arrancar queda igual que el
     ${fecha.slice(0, 10)}: mismos usuarios y claves.

  Si algo falla, el comando "node restaurar.js" explica qué pasó y no deja la
  base a medias.
`;
}

module.exports = { armarBackup, TABLAS };
