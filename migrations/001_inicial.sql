-- 001_inicial.sql — esquema base del sistema

CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  usuario VARCHAR(60) UNIQUE NOT NULL,
  clave VARCHAR(120) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin','cargador','veedor')),
  activo BOOLEAN DEFAULT TRUE,
  creado TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE obras (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  activa BOOLEAN DEFAULT TRUE,
  creado TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE manzanas (
  id SERIAL PRIMARY KEY,
  obra_id INT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nombre VARCHAR(20) NOT NULL,
  orden INT DEFAULT 0
);

CREATE TABLE casas (
  id SERIAL PRIMARY KEY,
  manzana_id INT NOT NULL REFERENCES manzanas(id) ON DELETE CASCADE,
  nombre VARCHAR(20) NOT NULL,
  orden INT DEFAULT 0
);

CREATE TABLE tareas (
  id SERIAL PRIMARY KEY,
  obra_id INT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nombre VARCHAR(140) NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('CASA','LIBRE')),
  orden INT DEFAULT 0,
  activa BOOLEAN DEFAULT TRUE
);

CREATE TABLE contratistas (
  id SERIAL PRIMARY KEY,
  obra_id INT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nombre VARCHAR(140) NOT NULL,
  retencion NUMERIC(6,4) NOT NULL DEFAULT 0.05,
  orden INT DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE contratista_tareas (
  contratista_id INT NOT NULL REFERENCES contratistas(id) ON DELETE CASCADE,
  tarea_id INT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  PRIMARY KEY (contratista_id, tarea_id)
);

CREATE TABLE quincenas (
  id SERIAL PRIMARY KEY,
  obra_id INT NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nombre VARCHAR(60) NOT NULL,
  fecha VARCHAR(20),
  cerrada BOOLEAN NOT NULL DEFAULT FALSE,
  cerrada_por INT REFERENCES usuarios(id),
  cerrada_en TIMESTAMPTZ,
  orden INT DEFAULT 0,
  creado TIMESTAMPTZ DEFAULT NOW()
);

-- precio congelado por quincena: cambiar el precio no afecta quincenas pasadas
CREATE TABLE precios (
  quincena_id INT NOT NULL REFERENCES quincenas(id) ON DELETE CASCADE,
  tarea_id INT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  monto NUMERIC(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (quincena_id, tarea_id)
);

CREATE TABLE cargas (
  quincena_id INT NOT NULL REFERENCES quincenas(id) ON DELETE CASCADE,
  contratista_id INT NOT NULL REFERENCES contratistas(id) ON DELETE CASCADE,
  tarea_id INT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  casa_id INT NOT NULL REFERENCES casas(id) ON DELETE CASCADE,
  cantidad NUMERIC(10,4) NOT NULL,
  usuario_id INT REFERENCES usuarios(id),
  actualizado TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (quincena_id, contratista_id, tarea_id, casa_id)
);

CREATE TABLE globales (
  quincena_id INT NOT NULL REFERENCES quincenas(id) ON DELETE CASCADE,
  contratista_id INT NOT NULL REFERENCES contratistas(id) ON DELETE CASCADE,
  tarea_id INT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  cantidad NUMERIC(12,4) NOT NULL,
  usuario_id INT REFERENCES usuarios(id),
  actualizado TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (quincena_id, contratista_id, tarea_id)
);

CREATE TABLE anticipos (
  id SERIAL PRIMARY KEY,
  quincena_id INT NOT NULL REFERENCES quincenas(id) ON DELETE CASCADE,
  contratista_id INT NOT NULL REFERENCES contratistas(id) ON DELETE CASCADE,
  tipo VARCHAR(40) NOT NULL,
  monto NUMERIC(14,2) NOT NULL,
  fecha VARCHAR(20),
  detalle VARCHAR(240),
  usuario_id INT REFERENCES usuarios(id),
  creado TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bitacora (
  id SERIAL PRIMARY KEY,
  usuario_id INT REFERENCES usuarios(id),
  accion VARCHAR(80) NOT NULL,
  detalle TEXT,
  creado TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cargas_q    ON cargas(quincena_id);
CREATE INDEX idx_cargas_tc   ON cargas(tarea_id, casa_id);
CREATE INDEX idx_globales_q  ON globales(quincena_id);
CREATE INDEX idx_anticipos_q ON anticipos(quincena_id);
CREATE INDEX idx_casas_mz    ON casas(manzana_id);
CREATE INDEX idx_bitacora_f  ON bitacora(creado DESC);
