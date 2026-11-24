import { q, tx } from "../../../lib/db";
import { T } from "../../../lib/schema";
export const dynamic = "force-dynamic";
const J = (o, s = 200) => Response.json(o, { status: s });
const now = () => new Date().toISOString();
const log = (run, who, action, tbl, label) => run('insert into activity(who,action,tbl,label,"at") values($1,$2,$3,$4,$5)', [who, action, tbl, String(label ?? ""), now()]);
const fail = (e) => J({ error: e.message }, 400);

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
async function guard(t, r, id) {
  if (t === "tasks" && r.depends_on) {
    if (r.depends_on === id) throw new Error("A task cannot depend on itself");
    const [dep] = await q("select title,status from tasks where id=$1", [r.depends_on]);
    if (dep && r.status === "completed" && dep.status !== "completed") throw new Error(`Complete "${dep.title}" first`);
  }
  if (t === "settlements" && r.who_from === r.who_to) throw new Error("Payer and receiver must differ");
}

export async function GET(_, { params }) {
  const t = params.table;
  try {
    if (t === "activity") return J(await q("select * from activity order by id desc limit 15"));
    if (t === "settings") return J(await q("select * from settings"));
    if (!T[t]) return J({ error: "Unknown table" }, 404);
    return J(await q(`select * from ${t} order by id desc`));
  } catch (e) { return J({ error: "Database error: " + e.message }, 500); }
}

export async function POST(req, { params }) {
  const t = params.table, who = req.headers.get("x-user") || "";
  try {
    const b = await req.json();
    if (t === "settings") {
      await q("insert into settings(key,value) values($1,$2) on conflict(key) do update set value=excluded.value", [String(b.key).slice(0, 50), String(b.value ?? "").slice(0, 200)]);
      return J({ ok: 1 });
    }
    const cfg = T[t];
    if (!cfg) return J({ error: "Unknown table" }, 404);
    const r = clean(cfg, b); await guard(t, r);
    const ks = Object.keys(r), ts = now();
    const vals = [...ks.map((k) => r[k]), who, who, ts, ts];
    await q(`insert into ${t}(${ks.join(",")},created_by,updated_by,created_at,updated_at) values(${vals.map((_, i) => "$" + (i + 1)).join(",")})`, vals);
    await log(q, who, "added", t, r[cfg.lab]);
    return J({ ok: 1 }, 201);
  } catch (e) { return fail(e); }
}

export async function PUT(req, { params }) {
  const t = params.table, cfg = T[t], who = req.headers.get("x-user") || "";
  if (!cfg) return J({ error: "Unknown table" }, 404);
  try {
    const b = await req.json();
    const [row] = await q(`select updated_at from ${t} where id=$1`, [b.id]);
    if (!row) return J({ error: "Record no longer exists" }, 404);
    if (row.updated_at !== b.updated_at) return J({ error: "Someone else changed this record. Reload and try again." }, 409);
    const r = clean(cfg, b); await guard(t, r, b.id);
    const ks = Object.keys(r), n = ks.length;
    await q(`update ${t} set ${ks.map((k, i) => `${k}=$${i + 1}`).join(",")},updated_by=$${n + 1},updated_at=$${n + 2} where id=$${n + 3}`, [...ks.map((k) => r[k]), who, now(), b.id]);
    await log(q, who, "updated", t, r[cfg.lab]);
    return J({ ok: 1 });
  } catch (e) { return fail(e); }
}

export async function DELETE(req, { params }) {
  const t = params.table, cfg = T[t], who = req.headers.get("x-user") || "";
  if (!cfg) return J({ error: "Unknown table" }, 404);
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return J({ error: "Bad id" }, 400);
  try {
    await tx(async (run) => {
      const [row] = await run(`select * from ${t} where id=$1`, [id]);
      if (t === "properties") await run("delete from reviews where property_id=$1", [id]);
      if (t === "tasks") await run("update tasks set depends_on=null where depends_on=$1", [id]);
      await run(`delete from ${t} where id=$1`, [id]);
      if (row) await log(run, who, "deleted", t, row[cfg.lab]);
    });
    return J({ ok: 1 });
  } catch (e) { return fail(e); }
}
