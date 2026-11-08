/* Base PostgreSQL en memoria (PGlite) con supabase/schema.sql cargado, roles de Supabase simulados
   y usuarios de prueba. La usan skala_db.test.mjs y crm-api.test.mjs. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const aqui = dirname(fileURLToPath(import.meta.url));
export const SCHEMA = readFileSync(join(aqui, "..", "schema.sql"), "utf8");

export const CLAVES = {
  jose: "Skala#2026", ana: "Ana*2222", oscar: "Oscar.1234", kevin: "Kevin9876", luis: "Luis5555",
};

export async function crearBase({ conUsuarios = true } = {}) {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  // Roles que existen en Supabase (PostgREST ejecuta como anon con la clave pública)
  await db.exec(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    -- Supabase da por defecto todos los permisos de tablas/funciones de public a anon: lo simulamos
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;
  `);
  await db.exec(SCHEMA);
  if (conUsuarios) {
    await db.exec(`
      INSERT INTO public.usuarios (id, usuario, nombre, rol, pin_hash, activo, created_at, telefono, comision_pct) VALUES
        ('U1', 'jose',  'José',  'master',      public.skala_hash_pin('U1', '${CLAVES.jose}'),  true, '', '', 3),
        ('U2', 'ana',   'Ana',   'admin',       public.skala_hash_pin('U2', '${CLAVES.ana}'),   true, '', '', 3),
        ('U3', 'oscar', 'Óscar', 'vendedor',    public.skala_hash_pin('U3', '${CLAVES.oscar}'), true, '', '0412-1234567', 3),
        ('U4', 'kevin', 'Kevin', 'vendedor',    public.skala_hash_pin('U4', '${CLAVES.kevin}'), true, '', '04247387202', 3),
        ('U5', 'luis',  'Luis',  'despachador', public.skala_hash_pin('U5', '${CLAVES.luis}'),  true, '', '', 3);
    `);
  }
  return db;
}

/* Llama a una función como lo haría PostgREST con la clave pública (rol anon) */
export async function rpc(db, payload, { funcion = "skala_db", rol = "anon" } = {}) {
  await db.exec(`SET ROLE ${rol}`);
  try {
    const r = await db.query(`SELECT public.${funcion}($1::jsonb) AS r`, [JSON.stringify(payload)]);
    return r.rows[0].r;
  } finally {
    await db.exec("RESET ROLE");
  }
}

export async function login(db, usuario) {
  const r = await rpc(db, { op: "login", usuario, clave: CLAVES[usuario] });
  if (!r.ok) throw new Error("login " + usuario + ": " + JSON.stringify(r));
  return r.token;
}

export async function filas(db, sql, params = []) {
  return (await db.query(sql, params)).rows;
}
