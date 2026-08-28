# Certificados de obra

Sistema web para el control de certificaciones por quincena: carga por casa con
bloqueo entre contratistas, certificados, anticipos y reportes.

---

## Cómo subirlo a Railway

### 1. Subir el código a GitHub

1. Entrá a [github.com](https://github.com) y creá una cuenta si no tenés.
2. Botón **New repository**. Ponele un nombre (`certificados-obra`), marcá **Private** y creá.
3. Subí todos los archivos de esta carpeta. Si no usás Git, en la página del repositorio
   está la opción **uploading an existing file**: arrastrás todo y listo.

> **No subas la carpeta `node_modules` ni el archivo `.env`.** El `.gitignore` ya los excluye.

### 2. Crear el proyecto en Railway

1. Entrá a [railway.app](https://railway.app) y registrate con tu cuenta de GitHub.
2. **New Project** → **Deploy from GitHub repo** → elegí el repositorio.
3. Railway detecta que es Node y empieza a construirlo solo.

### 3. Agregar la base de datos

1. Dentro del proyecto: **New** → **Database** → **Add PostgreSQL**.
2. Railway crea la base y define la variable `DATABASE_URL` automáticamente.
   No hay que copiar nada a mano.

### 4. Configurar las claves

En el servicio de la aplicación (no en el de la base), pestaña **Variables**, agregá:

| Variable | Valor |
|---|---|
| `JWT_SECRET` | Una frase larga inventada. Ej: `obra-tucuman-2026-clave-larga-secreta` |
| `NODE_ENV` | `production` |
| `ADMIN_PASS` | La contraseña del administrador |
| `CARGA_PASS` | La contraseña del usuario de carga |
| `VEEDOR_PASS` | La contraseña del veedor |

> Las tres últimas **solo se usan la primera vez**, cuando la base está vacía.
> Después las contraseñas se cambian desde la pantalla de Usuarios.

### 5. Publicar la dirección

En **Settings** → **Networking** → **Generate Domain**.
Te da una dirección tipo `certificados-obra.up.railway.app`. Esa es tu web.

Si querés dominio propio (`certificados.tuobra.com.ar`), en esa misma pantalla está
**Custom Domain** y te dice qué configurar en tu proveedor de dominio.

### 6. Entrar

Abrí la dirección y entrá con `admin` y la contraseña que pusiste en `ADMIN_PASS`.

**Lo primero que conviene hacer:** ir a *Usuarios* y cambiar las contraseñas de
`carga` y `veedor`, o desactivarlos y crear los usuarios reales.

---

## Los tres roles

| Rol | Qué puede hacer |
|---|---|
| **admin** | Todo: cargar, precios, anticipos, contratistas, usuarios, cerrar y **reabrir** quincenas, y modificar quincenas cerradas. |
| **cargador** | Cargar la quincena abierta y ajustar precios. **No puede modificar una quincena cerrada.** No toca anticipos, contratistas ni usuarios. |
| **veedor** | Solo ver certificados, avance y parte de trabajos. |

---

## Cómo actualizar el sistema más adelante

Esta es la parte importante: **el programa y los datos están separados**.
Actualizar el código nunca borra ni pisa lo cargado.

### Si el cambio no toca la estructura de datos

Subís el código nuevo a GitHub. Railway lo detecta y actualiza solo. Nada más.

### Si el cambio necesita un campo o una tabla nueva

1. Creá un archivo en `migrations/` con el número siguiente al último:
   ```
   migrations/002_lo_que_sea.sql
   ```
2. Escribí adentro **solo el cambio**:
   ```sql
   ALTER TABLE contratistas ADD COLUMN IF NOT EXISTS cuit VARCHAR(20);
   ```
3. Subilo. Al arrancar, el sistema aplica únicamente las migraciones que faltan.

Las ya aplicadas no se vuelven a correr. Cada una va en su propia transacción:
si una falla, no queda a medias.

En los registros de Railway vas a ver:

```
Verificando base de datos…
  ✓ migración aplicada: 002_lo_que_sea.sql
Migraciones nuevas: 1
Datos existentes: no se siembra nada
```

Esa última línea es la garantía de que no tocó los datos.

---

## Respaldos

Railway hace copias de la base, pero conviene tener las tuyas.
En el servicio de PostgreSQL, pestaña **Data**, está la opción de exportar.
Guardá una copia al cerrar cada quincena.

---

## Correrlo en tu computadora (opcional)

```bash
npm install
cp .env.example .env      # completá DATABASE_URL con tu PostgreSQL local
npm start
```

Queda en `http://localhost:3000`.

Para verificar que todo funcione:

```bash
node test.js         # backend: roles, bloqueo, cierre, precios, reportes
node test-front.js   # frontend: que todas las vistas se generen bien
```

---

## Archivos

```
server.js          API y permisos
db.js              conexión y motor de migraciones
seed.js            carga inicial (solo si la base está vacía)
reportes.js        cálculos de avance y parte de trabajos
migrations/        cambios de estructura, numerados
public/            la interfaz web
test.js            pruebas del backend
test-front.js      pruebas del frontend
```
