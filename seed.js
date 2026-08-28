/*  seed.js — carga inicial
 *
 *  Sólo corre si la base está VACÍA. En cada arranque posterior
 *  no toca absolutamente nada, así una actualización del sistema
 *  nunca pisa los datos reales.
 */
const bcrypt = require("bcryptjs");
const { q, tx } = require("./db");

const MZ = {
  C: ["C2","C3","C7","C8","C10","C11","C14","C16","C19","C21"],
  A: ["A1","A2","A3","A6","A7","A8","A10"],
  M: ["M1","M2","M4","M5","M6","M7","M8","M9","M11","M12","M14"],
  D: ["D2","D3","D4","D7","D9","D10","D11","D12","D13","D14","D15","D16","D17","D18","D22","D23"],
};

const TAREAS = [
  ["Piso",350000,"CASA"],["Baño y Cocina",350000,"CASA"],["Lavadero",55000,"CASA"],
  ["Solia y Zócalo",350000,"CASA"],["Revoque",1500000,"CASA"],["Carpeta",250000,"CASA"],
  ["Rev. Baño Carpeta 5 Puertas",350000,"CASA"],["Revoque de Pared Cocina",125000,"CASA"],
  ["Molduras",175000,"CASA"],["Camino Entrada",40000,"CASA"],["Canaleta",280000,"CASA"],
  ["Colocación Babetas/Cumbreras",125000,"CASA"],["Grampas Ω x Casa",20000,"CASA"],
  ["Durlock",455000,"CASA"],["Enmasillado",45000,"CASA"],["Pintura Interior",450000,"CASA"],
  ["Pintura Exterior",450000,"CASA"],["Medianera",100000,"CASA"],
  ["Rejas x Unidad",5000,"LIBRE"],["Detalles x Jornal",30000,"LIBRE"],
  ["Det. Jornal · Tapado cañerías",30000,"LIBRE"],
  ["Det. Jornal · Relleno solia trasera",30000,"LIBRE"],
  ["Det. Jornal · Pilar eléctrico",30000,"LIBRE"],
  ["Det. Jornal · Ventiluz de baño",30000,"LIBRE"],
  ["Babetas (metro)",1600,"LIBRE"],["Cumbreras (metro)",1800,"LIBRE"],
  ["Saldo / Tapajuntas",10000,"LIBRE"],
];

const JORN = ["Det. Jornal · Tapado cañerías","Det. Jornal · Relleno solia trasera",
  "Det. Jornal · Pilar eléctrico","Det. Jornal · Ventiluz de baño"];

const CONS = [
  ["Perez César",["Piso","Baño y Cocina","Lavadero","Revoque de Pared Cocina","Detalles x Jornal",...JORN]],
  ["Perez Nahuel",["Solia y Zócalo","Detalles x Jornal",...JORN]],
  ["ATAY",["Piso","Baño y Cocina","Lavadero","Solia y Zócalo","Revoque","Carpeta",
    "Rev. Baño Carpeta 5 Puertas","Revoque de Pared Cocina","Detalles x Jornal",...JORN]],
  ["Villarreal",["Molduras","Camino Entrada","Revoque de Pared Cocina",...JORN]],
  ["Juarez",["Canaleta",...JORN]],
  ["Saavedra",["Babetas (metro)","Cumbreras (metro)","Colocación Babetas/Cumbreras",
    "Detalles x Jornal","Saldo / Tapajuntas",...JORN]],
  ["Lucena",["Rejas x Unidad","Grampas Ω x Casa",...JORN]],
  ["Fernandez",["Durlock",...JORN]],
  ["Cruz",["Enmasillado","Pintura Interior","Pintura Exterior","Medianera",...JORN]],
  ["Peñaloza",["Pintura Interior","Pintura Exterior","Medianera",...JORN]],
];

// cargas de Q1: "contratista|tarea|casa": cantidad
const CARGAS = {
"Perez César|Piso|C14":1,"Perez César|Piso|C16":1,"Perez César|Piso|C19":1,"Perez César|Piso|C21":1,
"Perez César|Baño y Cocina|C7":1,"Perez César|Baño y Cocina|C14":.5,"Perez César|Baño y Cocina|C16":.5,
"Perez Nahuel|Solia y Zócalo|C14":1,"Perez Nahuel|Solia y Zócalo|C21":.5,"Perez Nahuel|Solia y Zócalo|D23":.3,
"ATAY|Solia y Zócalo|A10":1,"ATAY|Solia y Zócalo|M1":1,"ATAY|Solia y Zócalo|M2":1,
"ATAY|Revoque|A10":.2,"ATAY|Revoque|M1":.2,"ATAY|Revoque|M2":.2,
"ATAY|Carpeta|A10":1,"ATAY|Rev. Baño Carpeta 5 Puertas|M2":.1,
"Villarreal|Molduras|C3":1,"Villarreal|Molduras|M1":.5,"Villarreal|Molduras|M2":.5,
"Villarreal|Camino Entrada|C2":1,"Villarreal|Camino Entrada|C3":1,"Villarreal|Camino Entrada|C7":1,
"Villarreal|Camino Entrada|C8":1,"Villarreal|Camino Entrada|C10":1,"Villarreal|Camino Entrada|C11":1,
"Villarreal|Camino Entrada|C14":1,"Villarreal|Camino Entrada|C16":1,"Villarreal|Camino Entrada|C19":1,
"Villarreal|Camino Entrada|C21":1,"Villarreal|Camino Entrada|M4":1,"Villarreal|Camino Entrada|M5":1,
"Villarreal|Camino Entrada|M6":1,"Villarreal|Camino Entrada|M7":1,"Villarreal|Camino Entrada|M8":1,
"Villarreal|Camino Entrada|M9":1,"Villarreal|Camino Entrada|M11":1,"Villarreal|Camino Entrada|M12":1,
"Villarreal|Camino Entrada|D2":1,"Villarreal|Camino Entrada|D3":1,"Villarreal|Camino Entrada|D4":1,
"Villarreal|Camino Entrada|D17":1,"Villarreal|Camino Entrada|D18":1,"Villarreal|Camino Entrada|D22":1,
"Villarreal|Camino Entrada|D23":1,
"Juarez|Canaleta|C16":1,"Juarez|Canaleta|C19":1,"Juarez|Canaleta|C21":1,"Juarez|Canaleta|A1":1,
"Juarez|Canaleta|A2":1,"Juarez|Canaleta|A3":1,"Juarez|Canaleta|A6":1,"Juarez|Canaleta|A7":1,
"Juarez|Canaleta|A8":1,"Juarez|Canaleta|A10":1,
"Lucena|Rejas x Unidad|C14":5,"Lucena|Rejas x Unidad|C16":6,"Lucena|Rejas x Unidad|C19":6,
"Lucena|Rejas x Unidad|M1":6,"Lucena|Rejas x Unidad|M2":5,"Lucena|Rejas x Unidad|M4":3,
"Lucena|Rejas x Unidad|M5":1,"Lucena|Rejas x Unidad|M6":2,
"Lucena|Grampas Ω x Casa|D9":.5,"Lucena|Grampas Ω x Casa|D10":.5,"Lucena|Grampas Ω x Casa|D11":.5,
"Lucena|Grampas Ω x Casa|D12":.5,"Lucena|Grampas Ω x Casa|D13":.5,"Lucena|Grampas Ω x Casa|D14":.5,
"Lucena|Grampas Ω x Casa|D15":.5,"Lucena|Grampas Ω x Casa|D16":.5,
"Fernandez|Durlock|M1":.5,"Fernandez|Durlock|M2":.5,"Fernandez|Durlock|M4":.5,
"Fernandez|Durlock|M5":.5,"Fernandez|Durlock|M6":.5,"Fernandez|Durlock|M7":.5,
"Cruz|Enmasillado|C2":1,"Cruz|Enmasillado|C10":1,"Cruz|Enmasillado|C21":1,
"Cruz|Pintura Interior|D9":.5,"Cruz|Pintura Interior|D10":.5,"Cruz|Pintura Interior|D14":1,
"Cruz|Pintura Interior|D15":.5,"Cruz|Pintura Interior|D16":.5,
"Cruz|Pintura Exterior|D9":.5,"Cruz|Pintura Exterior|D10":.5,"Cruz|Pintura Exterior|D14":1,
"Cruz|Pintura Exterior|D15":1,"Cruz|Pintura Exterior|D16":1,
"Cruz|Medianera|D10":1,"Cruz|Medianera|D16":1,
"Peñaloza|Pintura Interior|D12":1,"Peñaloza|Pintura Exterior|D12":1,
};

const GLOBALES = {
"Saavedra|Babetas (metro)":175,"Saavedra|Cumbreras (metro)":30,
"Saavedra|Colocación Babetas/Cumbreras":2,"Saavedra|Detalles x Jornal":1,
"Saavedra|Saldo / Tapajuntas":15,
"Perez César|Det. Jornal · Tapado cañerías":2,
"Perez Nahuel|Det. Jornal · Relleno solia trasera":1.5,
"Perez Nahuel|Det. Jornal · Pilar eléctrico":9,
"Perez Nahuel|Det. Jornal · Ventiluz de baño":1,
};

const ANTICIPOS = [
["Perez César","Dinero",400000,"21/8/2026"],["ATAY","Dinero",350000,"21/8/2026"],
["Villarreal","Dinero",100000,"21/8/2026"],["Fernandez","Dinero",100000,"21/8/2026"],
["Saavedra","Dinero",100000,"21/8/2026"],["Cruz","Dinero",200000,"21/8/2026"],
["Juarez","Dinero",200000,"21/8/2026"],["Peñaloza","Dinero",200000,"21/8/2026"],
["Peñaloza","Herramientas",125000,"22/7/2026"],
];

module.exports = async function sembrar() {
  const { rows } = await q("SELECT COUNT(*)::int AS n FROM usuarios");
  if (rows[0].n > 0) { console.log("Datos existentes: no se siembra nada"); return; }

  console.log("Base vacía → cargando datos iniciales…");
  await tx(async c => {
    const cl = process.env.ADMIN_PASS || "admin123";
    const { rows: [adm] } = await c.query(
      `INSERT INTO usuarios(usuario,clave,nombre,rol) VALUES('admin',$1,'Administrador','admin') RETURNING id`,
      [await bcrypt.hash(cl, 10)]);
    await c.query(`INSERT INTO usuarios(usuario,clave,nombre,rol) VALUES('carga',$1,'Carga de obra','cargador')`,
      [await bcrypt.hash(process.env.CARGA_PASS || "obra2026", 10)]);
    await c.query(`INSERT INTO usuarios(usuario,clave,nombre,rol) VALUES('veedor',$1,'Veedor','veedor')`,
      [await bcrypt.hash(process.env.VEEDOR_PASS || "ver2026", 10)]);

    const { rows: [o] } = await c.query(
      `INSERT INTO obras(nombre) VALUES('Barrio · Manzanas C · A · M · D') RETURNING id`);

    const casaId = {};
    let mo = 0;
    for (const [m, cs] of Object.entries(MZ)) {
      const { rows: [mz] } = await c.query(
        `INSERT INTO manzanas(obra_id,nombre,orden) VALUES($1,$2,$3) RETURNING id`, [o.id, m, mo++]);
      let co = 0;
      for (const n of cs) {
        const { rows: [ca] } = await c.query(
          `INSERT INTO casas(manzana_id,nombre,orden) VALUES($1,$2,$3) RETURNING id`, [mz.id, n, co++]);
        casaId[n] = ca.id;
      }
    }

    const tareaId = {};
    for (let i = 0; i < TAREAS.length; i++) {
      const [n, , t] = TAREAS[i];
      const { rows: [tr] } = await c.query(
        `INSERT INTO tareas(obra_id,nombre,tipo,orden) VALUES($1,$2,$3,$4) RETURNING id`,
        [o.id, n, t, i]);
      tareaId[n] = tr.id;
    }

    const conId = {};
    for (let i = 0; i < CONS.length; i++) {
      const [n, ts] = CONS[i];
      const { rows: [cr] } = await c.query(
        `INSERT INTO contratistas(obra_id,nombre,retencion,orden) VALUES($1,$2,0.05,$3) RETURNING id`,
        [o.id, n, i]);
      conId[n] = cr.id;
      for (const t of ts)
        if (tareaId[t]) await c.query(
          `INSERT INTO contratista_tareas VALUES($1,$2) ON CONFLICT DO NOTHING`, [cr.id, tareaId[t]]);
    }

    const { rows: [q1] } = await c.query(
      `INSERT INTO quincenas(obra_id,nombre,fecha,orden) VALUES($1,'Q1','28-08-2026',1) RETURNING id`,
      [o.id]);

    for (const [n, m] of TAREAS)
      await c.query(`INSERT INTO precios(quincena_id,tarea_id,monto) VALUES($1,$2,$3)`,
        [q1.id, tareaId[n], m]);

    let nc = 0;
    for (const [k, v] of Object.entries(CARGAS)) {
      const p = k.split("|");
      const casa = p.pop(), cn = p.shift(), tn = p.join("|");
      if (!conId[cn] || !tareaId[tn] || !casaId[casa]) { console.log("  omitido:", k); continue; }
      await c.query(`INSERT INTO cargas(quincena_id,contratista_id,tarea_id,casa_id,cantidad,usuario_id)
        VALUES($1,$2,$3,$4,$5,$6)`, [q1.id, conId[cn], tareaId[tn], casaId[casa], v, adm.id]);
      nc++;
    }

    for (const [k, v] of Object.entries(GLOBALES)) {
      const p = k.split("|");
      const cn = p.shift(), tn = p.join("|");
      await c.query(`INSERT INTO globales(quincena_id,contratista_id,tarea_id,cantidad,usuario_id)
        VALUES($1,$2,$3,$4,$5)`, [q1.id, conId[cn], tareaId[tn], v, adm.id]);
    }

    for (const [cn, tipo, monto, fecha] of ANTICIPOS)
      await c.query(`INSERT INTO anticipos(quincena_id,contratista_id,tipo,monto,fecha,usuario_id)
        VALUES($1,$2,$3,$4,$5,$6)`, [q1.id, conId[cn], tipo, monto, fecha, adm.id]);

    console.log(`  obra, ${Object.keys(casaId).length} casas, ${TAREAS.length} tareas, ` +
      `${CONS.length} contratistas, ${nc} cargas, ${ANTICIPOS.length} anticipos`);
  });
  console.log("Carga inicial lista");
};
