require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { q, tx, migrar } = require("./db");
const sembrar = require("./seed");

const app = express();
const SECRET = process.env.JWT_SECRET || "cambiar-esta-clave-en-railway";
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(express.static("public"));

/* ═══════════ autenticación y roles ═══════════ */

function auth(req, res, next) {
  const t = req.cookies.token;
  if (!t) return res.status(401).json({ error: "Necesitás iniciar sesión" });
  try { req.user = jwt.verify(t, SECRET); next(); }
  catch { res.status(401).json({ error: "Sesión vencida" }); }
}
const rol = (...permitidos) => (req, res, next) =>
  permitidos.includes(req.user.rol) ? next()
  : res.status(403).json({ error: "No tenés permiso para esto" });

const esAdmin = rol("admin");
const puedeCargar = rol("admin", "cargador");

async function log(uid, accion, detalle) {
  try { await q("INSERT INTO bitacora(usuario_id,accion,detalle) VALUES($1,$2,$3)",
    [uid, accion, detalle]); } catch {}
}

/* ═══════════ sesión ═══════════ */

app.post("/api/login", async (req, res) => {
  const { usuario, clave } = req.body || {};
  if (!usuario || !clave) return res.status(400).json({ error: "Faltan datos" });
  const { rows } = await q("SELECT * FROM usuarios WHERE usuario=$1 AND activo", [usuario.trim()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(clave, u.clave)))
    return res.status(401).json({ error: "Usuario o clave incorrectos" });
  const token = jwt.sign({ id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol },
    SECRET, { expiresIn: "12h" });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax",
    secure: process.env.NODE_ENV === "production", maxAge: 12 * 3600e3 });
  await log(u.id, "login", u.usuario);
  res.json({ id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol });
});

app.post("/api/logout", (req, res) => { res.clearCookie("token"); res.json({ ok: true }); });
app.get("/api/yo", auth, (req, res) => res.json(req.user));

/* ═══════════ usuarios (solo admin) ═══════════ */

app.get("/api/usuarios", auth, esAdmin, async (req, res) => {
  const { rows } = await q(
    "SELECT id,usuario,nombre,rol,activo,creado FROM usuarios ORDER BY rol,usuario");
  res.json(rows);
});

app.post("/api/usuarios", auth, esAdmin, async (req, res) => {
  const { usuario, clave, nombre, rol: r } = req.body || {};
  if (!usuario || !clave || !nombre || !r)
    return res.status(400).json({ error: "Completá todos los campos" });
  if (!["admin", "cargador", "veedor"].includes(r))
    return res.status(400).json({ error: "Rol inválido" });
  if (clave.length < 6)
    return res.status(400).json({ error: "La clave tiene que tener al menos 6 caracteres" });
  try {
    const h = await bcrypt.hash(clave, 10);
    const { rows } = await q(
      `INSERT INTO usuarios(usuario,clave,nombre,rol) VALUES($1,$2,$3,$4)
       RETURNING id,usuario,nombre,rol,activo`, [usuario.trim(), h, nombre.trim(), r]);
    await log(req.user.id, "usuario_alta", usuario);
    res.json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.code === "23505" ? "Ese usuario ya existe" : e.message });
  }
});

app.patch("/api/usuarios/:id", auth, esAdmin, async (req, res) => {
  const { nombre, rol: r, activo, clave } = req.body || {};
  const id = +req.params.id;
  if (id === req.user.id && activo === false)
    return res.status(400).json({ error: "No podés desactivar tu propia cuenta" });
  const sets = [], vals = [];
  if (nombre !== undefined) { sets.push(`nombre=$${sets.length + 1}`); vals.push(nombre); }
  if (r !== undefined) { sets.push(`rol=$${sets.length + 1}`); vals.push(r); }
  if (activo !== undefined) { sets.push(`activo=$${sets.length + 1}`); vals.push(activo); }
  if (clave) {
    if (clave.length < 6) return res.status(400).json({ error: "Clave muy corta" });
    sets.push(`clave=$${sets.length + 1}`); vals.push(await bcrypt.hash(clave, 10));
  }
  if (!sets.length) return res.json({ ok: true });
  vals.push(id);
  await q(`UPDATE usuarios SET ${sets.join(",")} WHERE id=$${vals.length}`, vals);
  await log(req.user.id, "usuario_edita", "id " + id);
  res.json({ ok: true });
});

/* ═══════════ obra completa ═══════════ */

app.get("/api/obra", auth, async (req, res) => {
  const { rows: obras } = await q("SELECT * FROM obras WHERE activa ORDER BY id LIMIT 1");
  if (!obras.length) return res.json(null);
  const o = obras[0];
  const [mz, casas, tareas, cons, ct, quinc, precios] = await Promise.all([
    q("SELECT * FROM manzanas WHERE obra_id=$1 ORDER BY orden,id", [o.id]),
    q(`SELECT c.*, m.nombre AS manzana FROM casas c JOIN manzanas m ON m.id=c.manzana_id
       WHERE m.obra_id=$1 ORDER BY m.orden, c.orden, c.id`, [o.id]),
    q("SELECT * FROM tareas WHERE obra_id=$1 AND activa ORDER BY orden,id", [o.id]),
    q("SELECT * FROM contratistas WHERE obra_id=$1 AND activo ORDER BY orden,id", [o.id]),
    q(`SELECT ct.* FROM contratista_tareas ct
       JOIN contratistas c ON c.id=ct.contratista_id WHERE c.obra_id=$1`, [o.id]),
    q("SELECT * FROM quincenas WHERE obra_id=$1 ORDER BY orden,id", [o.id]),
    q(`SELECT p.* FROM precios p JOIN quincenas x ON x.id=p.quincena_id
       WHERE x.obra_id=$1`, [o.id]),
  ]);
  res.json({
    obra: o,
    manzanas: mz.rows,
    casas: casas.rows,
    tareas: tareas.rows.map(t => ({ ...t })),
    contratistas: cons.rows.map(c => ({ ...c, retencion: +c.retencion,
      tareas: ct.rows.filter(x => x.contratista_id === c.id).map(x => x.tarea_id) })),
    quincenas: quinc.rows,
    precios: precios.rows.map(p => ({ ...p, monto: +p.monto })),
  });
});

/* ═══════════ datos de una quincena ═══════════ */

app.get("/api/quincena/:id", auth, async (req, res) => {
  const id = +req.params.id;
  const [cargas, glob, ants] = await Promise.all([
    q("SELECT * FROM cargas WHERE quincena_id=$1", [id]),
    q("SELECT * FROM globales WHERE quincena_id=$1", [id]),
    q("SELECT * FROM anticipos WHERE quincena_id=$1 ORDER BY id", [id]),
  ]);
  res.json({
    cargas: cargas.rows.map(r => ({ ...r, cantidad: +r.cantidad })),
    globales: glob.rows.map(r => ({ ...r, cantidad: +r.cantidad })),
    anticipos: ants.rows.map(r => ({ ...r, monto: +r.monto })),
  });
});

// acumulado de tarea+casa en TODA la obra (para el bloqueo)
app.get("/api/acumulado", auth, async (req, res) => {
  const { rows } = await q(
    `SELECT c.tarea_id, c.casa_id, c.contratista_id, SUM(c.cantidad) AS total
     FROM cargas c JOIN tareas t ON t.id=c.tarea_id
     WHERE t.tipo='CASA' GROUP BY 1,2,3 HAVING SUM(c.cantidad) > 0`);
  res.json(rows.map(r => ({ ...r, total: +r.total })));
});

/* ═══════════ cargar una celda ═══════════ */

app.post("/api/carga", auth, puedeCargar, async (req, res) => {
  const { quincena_id, contratista_id, tarea_id, casa_id, cantidad } = req.body || {};
  const v = Number(cantidad) || 0;
  if (v < 0) return res.status(400).json({ error: "No se admiten negativos" });

  try {
    const out = await tx(async c => {
      const { rows: [qn] } = await c.query("SELECT * FROM quincenas WHERE id=$1", [quincena_id]);
      if (!qn) throw { code: 404, msg: "Quincena inexistente" };
      if (qn.cerrada && req.user.rol !== "admin")
        throw { code: 403, msg: `La quincena ${qn.nombre} está cerrada. Solo el administrador puede modificarla.` };

      const { rows: [t] } = await c.query("SELECT * FROM tareas WHERE id=$1", [tarea_id]);
      if (!t) throw { code: 404, msg: "Tarea inexistente" };

      if (t.tipo === "CASA" && v > 0) {
        // ¿otro contratista ya es dueño de esta tarea+casa en toda la obra?
        const { rows: prev } = await c.query(
          `SELECT contratista_id, SUM(cantidad) AS s FROM cargas
           WHERE tarea_id=$1 AND casa_id=$2 GROUP BY contratista_id HAVING SUM(cantidad)>0`,
          [tarea_id, casa_id]);
        const ajenos = prev.filter(r => r.contratista_id !== contratista_id);
        if (ajenos.length) {
          const { rows: [d] } = await c.query("SELECT nombre FROM contratistas WHERE id=$1",
            [ajenos[0].contratista_id]);
          const { rows: [ca] } = await c.query("SELECT nombre FROM casas WHERE id=$1", [casa_id]);
          throw { code: 409,
            msg: `${t.nombre} en ${ca.nombre} ya la certificó ${d.nombre}. Una tarea en una casa la hace un solo contratista.` };
        }
        // tope 1,00 sumando las demás quincenas
        const { rows: [ot] } = await c.query(
          `SELECT COALESCE(SUM(cantidad),0) AS s FROM cargas
           WHERE tarea_id=$1 AND casa_id=$2 AND contratista_id=$3 AND quincena_id<>$4`,
          [tarea_id, casa_id, contratista_id, quincena_id]);
        if (v + Number(ot.s) > 1.0001) {
          const { rows: [ca] } = await c.query("SELECT nombre FROM casas WHERE id=$1", [casa_id]);
          throw { code: 409,
            msg: `${t.nombre} en ${ca.nombre}: quedan ${(1 - Number(ot.s)).toFixed(2)} disponibles de 1,00.` };
        }
      }

      if (v === 0)
        await c.query(`DELETE FROM cargas WHERE quincena_id=$1 AND contratista_id=$2
          AND tarea_id=$3 AND casa_id=$4`, [quincena_id, contratista_id, tarea_id, casa_id]);
      else
        await c.query(
          `INSERT INTO cargas(quincena_id,contratista_id,tarea_id,casa_id,cantidad,usuario_id)
           VALUES($1,$2,$3,$4,$5,$6)
           ON CONFLICT (quincena_id,contratista_id,tarea_id,casa_id)
           DO UPDATE SET cantidad=$5, usuario_id=$6, actualizado=NOW()`,
          [quincena_id, contratista_id, tarea_id, casa_id, v, req.user.id]);
      return { ok: true };
    });
    res.json(out);
  } catch (e) {
    if (e.code && e.msg) return res.status(e.code).json({ error: e.msg });
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/global", auth, puedeCargar, async (req, res) => {
  const { quincena_id, contratista_id, tarea_id, cantidad } = req.body || {};
  const v = Number(cantidad) || 0;
  const { rows: [qn] } = await q("SELECT * FROM quincenas WHERE id=$1", [quincena_id]);
  if (qn.cerrada && req.user.rol !== "admin")
    return res.status(403).json({ error: `La quincena ${qn.nombre} está cerrada.` });
  if (v === 0)
    await q(`DELETE FROM globales WHERE quincena_id=$1 AND contratista_id=$2 AND tarea_id=$3`,
      [quincena_id, contratista_id, tarea_id]);
  else
    await q(`INSERT INTO globales(quincena_id,contratista_id,tarea_id,cantidad,usuario_id)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT (quincena_id,contratista_id,tarea_id)
      DO UPDATE SET cantidad=$4, usuario_id=$5, actualizado=NOW()`,
      [quincena_id, contratista_id, tarea_id, v, req.user.id]);
  res.json({ ok: true });
});

/* ═══════════ quincenas ═══════════ */

app.post("/api/quincenas", auth, esAdmin, async (req, res) => {
  const { nombre, fecha } = req.body || {};
  if (!nombre) return res.status(400).json({ error: "Falta el nombre" });
  const out = await tx(async c => {
    const { rows: [o] } = await c.query("SELECT id FROM obras WHERE activa ORDER BY id LIMIT 1");
    const { rows: [ult] } = await c.query(
      "SELECT id FROM quincenas WHERE obra_id=$1 ORDER BY orden DESC, id DESC LIMIT 1", [o.id]);
    const { rows: [nq] } = await c.query(
      `INSERT INTO quincenas(obra_id,nombre,fecha,orden)
       VALUES($1,$2,$3,(SELECT COALESCE(MAX(orden),0)+1 FROM quincenas WHERE obra_id=$1))
       RETURNING *`, [o.id, nombre, fecha || null]);
    // copiar precios vigentes
    if (ult)
      await c.query(`INSERT INTO precios(quincena_id,tarea_id,monto)
        SELECT $1, tarea_id, monto FROM precios WHERE quincena_id=$2`, [nq.id, ult.id]);
    else
      await c.query(`INSERT INTO precios(quincena_id,tarea_id,monto)
        SELECT $1, id, 0 FROM tareas WHERE obra_id=$2`, [nq.id, o.id]);
    return nq;
  });
  await log(req.user.id, "quincena_alta", nombre);
  res.json(out);
});

app.post("/api/quincenas/:id/cerrar", auth, esAdmin, async (req, res) => {
  const id = +req.params.id;
  await q(`UPDATE quincenas SET cerrada=TRUE, cerrada_por=$1, cerrada_en=NOW() WHERE id=$2`,
    [req.user.id, id]);
  await log(req.user.id, "quincena_cierre", "id " + id);
  res.json({ ok: true });
});

app.post("/api/quincenas/:id/abrir", auth, esAdmin, async (req, res) => {
  const id = +req.params.id;
  await q(`UPDATE quincenas SET cerrada=FALSE, cerrada_por=NULL, cerrada_en=NULL WHERE id=$1`, [id]);
  await log(req.user.id, "quincena_reapertura", "id " + id);
  res.json({ ok: true });
});

app.patch("/api/quincenas/:id", auth, esAdmin, async (req, res) => {
  const { nombre, fecha } = req.body || {};
  await q("UPDATE quincenas SET nombre=COALESCE($1,nombre), fecha=COALESCE($2,fecha) WHERE id=$3",
    [nombre || null, fecha ?? null, +req.params.id]);
  res.json({ ok: true });
});

/* ═══════════ precios ═══════════ */

app.post("/api/precio", auth, rol("admin", "cargador"), async (req, res) => {
  const { quincena_id, tarea_id, monto } = req.body || {};
  const { rows: [qn] } = await q("SELECT * FROM quincenas WHERE id=$1", [quincena_id]);
  if (qn.cerrada && req.user.rol !== "admin")
    return res.status(403).json({ error: `La quincena ${qn.nombre} está cerrada.` });
  await q(`INSERT INTO precios(quincena_id,tarea_id,monto) VALUES($1,$2,$3)
    ON CONFLICT (quincena_id,tarea_id) DO UPDATE SET monto=$3`,
    [quincena_id, tarea_id, Number(monto) || 0]);
  await log(req.user.id, "precio", `q${quincena_id} t${tarea_id} = ${monto}`);
  res.json({ ok: true });
});

/* ═══════════ anticipos ═══════════ */

app.post("/api/anticipos", auth, esAdmin, async (req, res) => {
  const { quincena_id, contratista_id, tipo, monto, fecha, detalle } = req.body || {};
  if (!monto) return res.status(400).json({ error: "Falta el monto" });
  const { rows } = await q(
    `INSERT INTO anticipos(quincena_id,contratista_id,tipo,monto,fecha,detalle,usuario_id)
     VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [quincena_id, contratista_id, tipo, monto, fecha || null, detalle || null, req.user.id]);
  res.json(rows[0]);
});

app.delete("/api/anticipos/:id", auth, esAdmin, async (req, res) => {
  await q("DELETE FROM anticipos WHERE id=$1", [+req.params.id]);
  res.json({ ok: true });
});

/* ═══════════ configuración (solo admin) ═══════════ */

app.patch("/api/contratistas/:id", auth, esAdmin, async (req, res) => {
  const { nombre, retencion, activo } = req.body || {};
  await q(`UPDATE contratistas SET nombre=COALESCE($1,nombre),
    retencion=COALESCE($2,retencion), activo=COALESCE($3,activo) WHERE id=$4`,
    [nombre ?? null, retencion ?? null, activo ?? null, +req.params.id]);
  res.json({ ok: true });
});

app.post("/api/contratistas", auth, esAdmin, async (req, res) => {
  const { rows: [o] } = await q("SELECT id FROM obras WHERE activa ORDER BY id LIMIT 1");
  const { rows } = await q(
    `INSERT INTO contratistas(obra_id,nombre,retencion,orden)
     VALUES($1,$2,$3,(SELECT COALESCE(MAX(orden),0)+1 FROM contratistas WHERE obra_id=$1))
     RETURNING *`, [o.id, req.body.nombre || "Contratista nuevo", req.body.retencion ?? 0.05]);
  res.json(rows[0]);
});

app.post("/api/contratista-tarea", auth, esAdmin, async (req, res) => {
  const { contratista_id, tarea_id, activo } = req.body || {};
  if (activo)
    await q(`INSERT INTO contratista_tareas VALUES($1,$2) ON CONFLICT DO NOTHING`,
      [contratista_id, tarea_id]);
  else
    await q(`DELETE FROM contratista_tareas WHERE contratista_id=$1 AND tarea_id=$2`,
      [contratista_id, tarea_id]);
  res.json({ ok: true });
});

app.post("/api/tareas", auth, esAdmin, async (req, res) => {
  const { rows: [o] } = await q("SELECT id FROM obras WHERE activa ORDER BY id LIMIT 1");
  const out = await tx(async c => {
    const { rows: [t] } = await c.query(
      `INSERT INTO tareas(obra_id,nombre,tipo,orden)
       VALUES($1,$2,$3,(SELECT COALESCE(MAX(orden),0)+1 FROM tareas WHERE obra_id=$1))
       RETURNING *`, [o.id, req.body.nombre || "Tarea nueva", req.body.tipo || "CASA"]);
    await c.query(`INSERT INTO precios(quincena_id,tarea_id,monto)
      SELECT id,$1,0 FROM quincenas WHERE obra_id=$2`, [t.id, o.id]);
    return t;
  });
  res.json(out);
});

app.patch("/api/tareas/:id", auth, esAdmin, async (req, res) => {
  const { nombre, tipo, activa } = req.body || {};
  await q(`UPDATE tareas SET nombre=COALESCE($1,nombre), tipo=COALESCE($2,tipo),
    activa=COALESCE($3,activa) WHERE id=$4`,
    [nombre ?? null, tipo ?? null, activa ?? null, +req.params.id]);
  res.json({ ok: true });
});

/* ═══════════ reportes ═══════════ */

const rep = require("./reportes");

// avance completo de la quincena (con acumulado de obra)
app.get("/api/reportes/avance/:qid", auth, async (req, res) => {
  try { res.json(await rep.reporteAvance(+req.params.qid)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// parte de trabajos, agrupado por tarea, con cantidades y sin plata
app.get("/api/reportes/trabajos/:qid", auth, async (req, res) => {
  try { res.json(await rep.reporteTrabajos(+req.params.qid, req.query.contratista)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// avance físico por casa
app.get("/api/reportes/obra", auth, async (req, res) => {
  const { rows: [o] } = await q("SELECT id FROM obras WHERE activa ORDER BY id LIMIT 1");
  res.json(await rep.avanceObra(o.id));
});

/* ═══════════ bitácora ═══════════ */

app.get("/api/bitacora", auth, esAdmin, async (req, res) => {
  const { rows } = await q(
    `SELECT b.*, u.usuario, u.nombre AS unombre FROM bitacora b
     LEFT JOIN usuarios u ON u.id=b.usuario_id ORDER BY b.creado DESC LIMIT 300`);
  res.json(rows);
});

/* ═══════════ arranque ═══════════ */

(async () => {
  try {
    console.log("Verificando base de datos…");
    await migrar();
    await sembrar();
    app.listen(PORT, () => console.log("Servidor escuchando en el puerto " + PORT));
  } catch (e) {
    console.error("No se pudo arrancar:", e.message);
    process.exit(1);
  }
})();
