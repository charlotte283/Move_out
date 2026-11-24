"use client";
import { useState, useEffect, useCallback } from "react";
import { T, MET, DONE_ITEM } from "../lib/schema";

const api = (t, m = "GET", b, u = "") =>
  fetch("/api/" + t, { method: m, headers: { "content-type": "application/json", "x-user": u }, body: b ? JSON.stringify(b) : undefined })
    .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "Error"); return j; });
const today = () => new Date().toISOString().slice(0, 10);
const kes = (n) => "KES " + Math.round(n || 0).toLocaleString();
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const rv = (r) => mean(MET.map((k) => r[k]).filter(Boolean));
const avgP = (d, id) => mean((d.reviews || []).filter((r) => r.property_id === id).map(rv).filter(Boolean));
const nice = (v) => String(v).replace(/_/g, " ");
const f1 = (n) => (n ? n.toFixed(1) : "—");

function flag(t, r, d) {
  const o = [];
  if (t === "tasks") {
    const dep = (d.tasks || []).find((x) => x.id === r.depends_on);
    if (dep && dep.status !== "completed" && r.status !== "completed") o.push("blocked by " + dep.title);
    if (r.due_date && r.due_date < today() && r.status !== "completed") o.push("overdue");
  }
  if (t === "items" && r.target_date && r.target_date < today() && !DONE_ITEM.includes(r.status) && r.acquisition !== "owned") o.push("overdue");
  if (t === "reviews") o.push("avg " + f1(rv(r)));
  if (t === "properties") { const a = avgP(d, r.id); if (a) o.push("★ " + a.toFixed(1)); }
  return o.join(" · ");
}

function Crud({ table, d, who, people, reload }) {
  const cfg = T[table], rows = d[table] || [];
  const [q, setQ] = useState(""), [form, setForm] = useState(null), [sort, setSort] = useState(null), [err, setErr] = useState("");
  const opts = (f) => f.t === "who" ? people : f.t === "ref" ? (d[f.ref] || []).map((r) => [r.id, r[T[f.ref].lab]]) : (f.o || []).map((o) => [o, nice(o)]);
  const show = (f, v) => v == null || v === "" ? "" : f.t === "who" ? (people.find((p) => p[0] === v) || [0, v])[1]
    : f.t === "ref" ? ((d[f.ref] || []).find((r) => r.id === v) || {})[T[f.ref].lab] || "" : f.t === "select" ? nice(v) : f.t === "number" && v > 99 ? v.toLocaleString() : v;
  const blank = () => Object.fromEntries(cfg.f.filter((f) => f.t === "who" || (f.t === "select" && f.req)).map((f) => [f.k, f.t === "who" ? (f.k === "who_to" ? (who === "A" ? "B" : "A") : who) : f.o[0]]));
  const fields = cfg.cols.map((k) => cfg.f.find((f) => f.k === k));
  let view = rows.filter((r) => !q || JSON.stringify(Object.values(r)).toLowerCase().includes(q.toLowerCase()));
  if (sort) view = [...view].sort((a, b) => ((a[sort] ?? "") > (b[sort] ?? "") ? 1 : -1));
  const save = async (e) => {
    e.preventDefault(); setErr("");
    try { await api(table, form.id ? "PUT" : "POST", form, who); setForm(null); reload(); } catch (x) { setErr(x.message); }
  };
  const del = async (r) => { if (confirm("Delete this record? This cannot be undone.")) { await api(`${table}?id=${r.id}`, "DELETE", null, who); reload(); } };
  return (
    <div>
      <div className="bar"><button className="p" onClick={() => { setErr(""); setForm(blank()); }}>+ Add</button>
        <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {form && (
        <form onSubmit={save}>
          {cfg.f.map((f) => (
            <label key={f.k}>{f.l}{f.req ? " *" : ""}
              {["select", "who", "ref"].includes(f.t) ? (
                <select required={!!f.req} value={form[f.k] ?? ""} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}>
                  <option value="">—</option>{opts(f).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : (
                <input required={!!f.req} type={f.t === "number" ? "number" : f.t === "date" ? "date" : "text"} step="any" min={f.r ? f.r[0] : f.t === "number" ? 0 : undefined} max={f.r ? f.r[1] : undefined}
                  value={form[f.k] ?? ""} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} />
              )}
            </label>
          ))}
          <div><button className="p">Save</button> <button type="button" className="s" onClick={() => setForm(null)}>Cancel</button>
            {err && <div className="err">{err}</div>}</div>
        </form>
      )}
      {view.length === 0 ? <div className="empty">Nothing here yet.</div> : (
        <div className="wrap"><table><thead><tr>{fields.map((f) => <th key={f.k} onClick={() => setSort(f.k)}>{f.l.replace(/ \(.*\)/, "")}</th>)}<th>Flags</th><th /></tr></thead>
          <tbody>{view.map((r) => (
            <tr key={r.id}>{fields.map((f) => <td key={f.k}>{show(f, r[f.k])}</td>)}
              <td className="flag">{flag(table, r, d)}</td>
              <td><button className="s" onClick={() => { setErr(""); setForm({ ...r }); }}>Edit</button> <button className="s d" onClick={() => del(r)}>Delete</button></td></tr>))}
          </tbody></table></div>
      )}
    </div>
  );
}

function balance(d) {
  let net = 0; // positive: B owes A
  for (const e of d.expenses || []) {
    if (e.status !== "paid" || !e.paid_by) continue;
    const shareA = e.split === "custom" ? e.share_a || 0 : e.amount / 2;
    net += (e.paid_by === "A" ? e.amount : 0) - shareA;
  }
  for (const s of d.settlements || []) net += s.who_from === "A" ? s.amount : -s.amount;
  return net;
}
const balText = (net, A, B) => Math.abs(net) < 1 ? "All square" : net > 0 ? `${B} owes ${A} ${kes(net)}` : `${A} owes ${B} ${kes(-net)}`;
const Card = ({ v, l }) => <div className="card"><b>{v}</b><span>{l}</span></div>;

function Dash({ d, S, A, B }) {
  const P = d.properties || [], I = d.items || [], E = d.expenses || [], K = d.tasks || [];
  const cnt = (a, s) => a.filter((x) => x.status === s).length;
  const out = I.filter((i) => !DONE_ITEM.includes(i.status) && i.acquisition !== "owned");
  const sum = (a) => a.reduce((s, e) => s + e.amount, 0);
  const spend = E.filter((e) => e.kind === "expense");
  const paid = sum(spend.filter((e) => e.status === "paid")), committed = sum(spend.filter((e) => ["pending", "committed"].includes(e.status)));
  const deposits = sum(E.filter((e) => e.kind === "refundable_deposit" && e.status === "paid"));
  const budget = Number(S.budget || 0);
  const blocked = K.filter((t) => t.status === "blocked" || flag("tasks", t, d).includes("blocked by")).length;
  const overdue = K.filter((t) => t.due_date && t.due_date < today() && t.status !== "completed").length;
  const next = P.filter((p) => p.viewing_planned >= today() && !p.viewing_actual).sort((a, b) => (a.viewing_planned > b.viewing_planned ? 1 : -1))[0];
  const days = S.moving_date ? Math.ceil((new Date(S.moving_date) - new Date(today())) / 864e5) : null;
  const sel = P.find((p) => p.status === "selected");
  return (
    <div>
      <h2>{S.project_completed === "1" ? "Household management" : "Moving project"}</h2>
      <div className="grid">
        <Card v={days == null ? "Not set" : days >= 0 ? days + " days" : "Moved"} l="until moving day" />
        <Card v={K.length ? Math.round((cnt(K, "completed") / K.length) * 100) + "%" : "—"} l={`tasks complete (${cnt(K, "completed")}/${K.length})`} />
        <Card v={`${overdue} overdue · ${blocked} blocked`} l="tasks needing attention" />
      </div>
      <h2>Properties</h2>
      <div className="grid">
        <Card v={P.length} l="tracked" /><Card v={cnt(P, "scheduled")} l="scheduled for viewing" /><Card v={cnt(P, "visited")} l="visited" />
        <Card v={sel ? sel.title : "None yet"} l="selected property" />
        <Card v={next ? `${next.title} · ${next.viewing_planned}` : "None"} l="next viewing" />
      </div>
      <h2>Shopping</h2>
      <div className="grid">
        <Card v={I.length} l="items on list" /><Card v={I.filter((i) => ["purchased", "delivered", "set_up"].includes(i.status)).length} l="purchased" />
        <Card v={I.filter((i) => i.acquisition === "owned").length} l="already owned" /><Card v={out.length} l="outstanding" />
        <Card v={kes(out.reduce((s, i) => s + (i.estimated_price || 0) * (i.qty || 1), 0))} l="estimated value outstanding" />
      </div>
      <h2>Money</h2>
      <div className="grid">
        <Card v={budget ? kes(budget) : "Not set"} l="budget" /><Card v={kes(paid)} l="spent (paid)" /><Card v={kes(committed)} l="committed / pending" />
        <Card v={budget ? kes(budget - paid - committed) : "—"} l="remaining budget" /><Card v={kes(deposits)} l="refundable deposits (not in spend)" />
        <Card v={balText(balance(d), A, B)} l="balance" />
      </div>
      <h2>Recent activity</h2>
      {(d.activity || []).length === 0 ? <div className="empty">No activity yet.</div> :
        <div className="card">{d.activity.map((a) => <div key={a.id}>{a.who === "B" ? B : A} {a.action} {a.tbl}: {a.label} <span>· {a.at.slice(0, 16).replace("T", " ")}</span></div>)}</div>}
    </div>
  );
}

function Compare({ d, people }) {
  const P = (d.properties || []).filter((p) => p.status !== "rejected");
  if (!P.length) return <div className="empty">Add properties first.</div>;
  const rr = (p) => (d.reviews || []).filter((r) => r.property_id === p.id);
  const rows = [
    ["Status", (p) => nice(p.status)], ["Monthly rent", (p) => kes(p.rent)], ["Deposit", (p) => kes(p.deposit)],
    ["Move-in cost (rent + deposit + agent fee)", (p) => kes((p.rent || 0) + (p.deposit || 0) + (p.agent_fee || 0))],
    ["Other monthly fees", (p) => kes(p.other_fees)], ["Beds / baths", (p) => `${p.bedrooms ?? "?"} / ${p.bathrooms ?? "?"}`],
    ["Gym", (p) => nice(p.gym || "unknown")], ["Pool", (p) => nice(p.pool || "unknown")], ["Generator", (p) => nice(p.generator || "unknown")], ["Parking", (p) => nice(p.parking || "unknown")],
    ["Group rating", (p) => f1(avgP(d, p.id))],
    ...people.map(([k, n]) => [n + "'s rating", (p) => f1(mean(rr(p).filter((r) => r.reviewer === k).map(rv).filter(Boolean)))]),
    ...MET.map((m) => ["Avg " + m, (p) => f1(mean(rr(p).map((r) => r[m]).filter(Boolean)))]),
  ];
  return <div className="wrap"><table><thead><tr><th />{P.map((p) => <th key={p.id}>{p.title}</th>)}</tr></thead>
    <tbody>{rows.map(([l, fn]) => <tr key={l}><th>{l}</th>{P.map((p) => <td key={p.id}>{fn(p)}</td>)}</tr>)}</tbody></table></div>;
}

function Settings({ S, reload }) {
  const set = async (key, value) => { await api("settings", "POST", { key, value }); reload(); };
  const field = (key, label, type = "text") => (
    <label key={key + (S[key] || "")}>{label}<input type={type} defaultValue={S[key] || ""} onBlur={(e) => e.target.value !== (S[key] || "") && set(key, e.target.value)} /></label>);
  return (
    <div>
      <form>{field("person_a", "Person A name")}{field("person_b", "Person B name (leave blank if solo)")}{field("budget", "Overall budget (KES)", "number")}{field("moving_date", "Moving date", "date")}</form>
      <h2>Moving project</h2>
      <p>{S.project_completed === "1" ? "Marked complete. All records, outstanding purchases and tasks are kept." : "Active."}</p>
      <button className="p" onClick={() => set("project_completed", S.project_completed === "1" ? "0" : "1")}>{S.project_completed === "1" ? "Reopen moving project" : "Mark moving project complete"}</button>
      <p className="empty">Your data lives in <code>data/moveout.db</code>. Back it up by copying that file.</p>
    </div>
  );
}

const TABS = { Dashboard: [], Properties: ["properties", "reviews"], Compare: [], Shopping: ["items"], Expenses: ["expenses", "settlements"], Tasks: ["tasks"], Settings: [] };
export default function App() {
  const [d, setD] = useState({}), [tab, setTab] = useState("Dashboard"), [who, setWho] = useState("A"), [err, setErr] = useState("");
  const load = useCallback(async () => {
    try { const n = [...Object.keys(T), "settings", "activity"]; const r = await Promise.all(n.map((x) => api(x))); setD(Object.fromEntries(n.map((x, i) => [x, r[i]]))); }
    catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); setWho(localStorage.getItem("me") || "A"); }, [load]);
  const S = Object.fromEntries((d.settings || []).map((s) => [s.key, s.value]));
  const A = S.person_a || "Person A", B = S.person_b || "Person B";
  const people = S.person_b === "" ? [["A", A]] : [["A", A], ["B", B]];
  return (
    <>
      <header><b>MOVEOUT</b>
        <nav>{Object.keys(TABS).map((t) => <button key={t} className={t === tab ? "on" : ""} onClick={() => setTab(t)}>{t}</button>)}</nav>
        <label>Acting as<select value={who} onChange={(e) => { setWho(e.target.value); localStorage.setItem("me", e.target.value); }}>{people.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
      </header>
      <main>
        {err && <div className="err">{err}</div>}
        {tab === "Dashboard" && <Dash d={d} S={S} A={A} B={B} />}
        {tab === "Compare" && <Compare d={d} people={people} />}
        {tab === "Settings" && <Settings S={S} reload={load} />}
        {tab === "Expenses" && <div className="card" style={{ marginBottom: 12 }}><b>{balText(balance(d), A, B)}</b><span>based on paid expenses and settlements</span></div>}
        {TABS[tab].map((t) => <section key={t}><h2>{t === "reviews" ? "Property reviews (one per person)" : t[0].toUpperCase() + t.slice(1)}</h2><Crud table={t} d={d} who={who} people={people} reload={load} /></section>)}
      </main>
    </>
  );
}
