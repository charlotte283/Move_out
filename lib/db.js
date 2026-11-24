import { Pool } from "pg";
import { T } from "./schema";
const SQL = { number: "DOUBLE PRECISION", ref: "INTEGER" };
const g = globalThis;
const pool = (g.__pool ||= new Pool({ connectionString: process.env.DATABASE_URL, max: 3 }));

async function init() {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select pg_advisory_xact_lock(727001)"); // serialises first-run table creation across instances
    for (const [n, t] of Object.entries(T))
      await c.query(`create table if not exists ${n}(id serial primary key,${t.f.map((f) => `${f.k} ${SQL[f.t] || "TEXT"}`).join(",")},created_by text,updated_by text,created_at text,updated_at text)`);
    await c.query("create table if not exists settings(key text primary key,value text)");
    await c.query('create table if not exists activity(id serial primary key,who text,action text,tbl text,label text,"at" text)');
    await c.query("commit");
  } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
}
const ready = () => (g.__ready ||= init().catch((e) => { g.__ready = null; throw e; }));

export async function q(text, params = []) {
  await ready();
  return (await pool.query(text, params)).rows;
}
export async function tx(fn) {
  await ready();
  const c = await pool.connect();
  try {
    await c.query("begin");
    const r = await fn((t, p = []) => c.query(t, p).then((x) => x.rows));
    await c.query("commit");
    return r;
  } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
}
