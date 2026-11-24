import Database from "better-sqlite3";
import fs from "fs";
import { T } from "./schema";
const SQL = { number: "REAL", ref: "INTEGER" };
function make() {
  const dir = process.env.DATA_DIR || "data";
  fs.mkdirSync(dir, { recursive: true });
  const d = new Database(dir + "/moveout.db");
  d.pragma("journal_mode = WAL");
  for (const [n, c] of Object.entries(T))
    d.exec(`create table if not exists ${n}(id integer primary key autoincrement,${c.f.map((f) => `${f.k} ${SQL[f.t] || "TEXT"}`).join(",")},created_by text,updated_by text,created_at text,updated_at text)`);
  d.exec("create table if not exists settings(key text primary key,value text);create table if not exists activity(id integer primary key autoincrement,who text,action text,tbl text,label text,at text)");
  return d;
}
export const db = (globalThis.__moveoutdb ||= make());
