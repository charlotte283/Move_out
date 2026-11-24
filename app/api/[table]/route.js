import { db } from "../../../lib/db";
import { T } from "../../../lib/schema";
export const dynamic = "force-dynamic";
const J = (o, s = 200) => Response.json(o, { status: s });
const now = () => new Date().toISOString();
const log = (who, action, tbl, label) => db.prepare("insert into activity(who,action,tbl,label,at) values(?,?,?,?,?)").run(who, action, tbl, String(label ?? ""), now());

function clean(cfg, b) {
  const out = {};
  for (const f of cfg.f) {
    let v = b[f.k];
    if (v === "" || v == null) { if (f.req) throw new Error(f.l + " is required"); out[f.k] = null; continue; }
    if (f.t === "number" || f.t === "ref") {
      v = Number(v);
      if (Number.isNaN(v)) throw new Error(f.l + " must be a number");
      if (f.r ? v < f.r[0] || v > f.r[1] : v < 0) throw new Error(f.r ? `${f.l} must be ${f.r[0]}-${f.r[1]}` : f.l + " cannot be negative");
    } else if (f.t === "select" && !f.o.includes(v)) throw new Error("Invalid " + f.l);
    else v = String(v).slice(0, 2000);
    out[f.k] = v;
  }
  return out;
}
function guard(t, r, id) {
  if (t === "tasks" && r.depends_on) {
    if (r.depends_on === id) throw new Error("A task cannot depend on itself");
    const dep = db.prepare("select title,status from tasks where id=?").get(r.depends_on);
    if (dep && r.status === "completed" && dep.status !== "completed") throw new Error(`Complete "${dep.title}" first`);
  }
  if (t === "settlements" && r.who_from === r.who_to) throw new Error("Payer and receiver must differ");
}

export async function GET(_, { params }) {
  const t = params.table;
  if (t === "activity") return J(db.prepare("select * from activity order by id desc limit 15").all());
  if (t === "settings") return J(db.prepare("select * from settings").all());
  if (!T[t]) return J({ error: "Unknown table" }, 404);
  return J(db.prepare(`select * from ${t} order by id desc`).all());
}

export async function POST(req, { params }) {
  const t = params.table, who = req.headers.get("x-user") || "";
  try {
    const b = await req.json();
    if (t === "settings") {
      db.prepare("insert into settings(key,value) values(?,?) on conflict(key) do update set value=excluded.value").run(String(b.key).slice(0, 50), String(b.value ?? "").slice(0, 200));
      return J({ ok: 1 });
    }
    const cfg = T[t];
    if (!cfg) return J({ error: "Unknown table" }, 404);
    const r = clean(cfg, b); guard(t, r);
    const ks = Object.keys(r), ts = now();
    db.prepare(`insert into ${t}(${ks.join(",")},created_by,updated_by,created_at,updated_at) values(${ks.map(() => "?").join(",")},?,?,?,?)`).run(...ks.map((k) => r[k]), who, who, ts, ts);
    log(who, "added", t, r[cfg.lab]);
    return J({ ok: 1 }, 201);
  } catch (e) { return J({ error: e.message }, 400); }
}

export async function PUT(req, { params }) {
  const t = params.table, cfg = T[t], who = req.headers.get("x-user") || "";
  if (!cfg) return J({ error: "Unknown table" }, 404);
  try {
    const b = await req.json();
    const row = db.prepare(`select updated_at from ${t} where id=?`).get(b.id);
    if (!row) return J({ error: "Record no longer exists" }, 404);
    if (row.updated_at !== b.updated_at) return J({ error: "Someone else changed this record. Reload and try again." }, 409);
    const r = clean(cfg, b); guard(t, r, b.id);
    const ks = Object.keys(r);
    db.prepare(`update ${t} set ${ks.map((k) => k + "=?").join(",")},updated_by=?,updated_at=? where id=?`).run(...ks.map((k) => r[k]), who, now(), b.id);
    log(who, "updated", t, r[cfg.lab]);
    return J({ ok: 1 });
  } catch (e) { return J({ error: e.message }, 400); }
}

export async function DELETE(req, { params }) {
  const t = params.table, cfg = T[t], who = req.headers.get("x-user") || "";
  if (!cfg) return J({ error: "Unknown table" }, 404);
  const id = Number(new URL(req.url).searchParams.get("id"));
  db.transaction(() => {
    const row = db.prepare(`select * from ${t} where id=?`).get(id);
    if (t === "properties") db.prepare("delete from reviews where property_id=?").run(id);
    if (t === "tasks") db.prepare("update tasks set depends_on=null where depends_on=?").run(id);
    db.prepare(`delete from ${t} where id=?`).run(id);
    if (row) log(who, "deleted", t, row[cfg.lab]);
  })();
  return J({ ok: 1 });
}
