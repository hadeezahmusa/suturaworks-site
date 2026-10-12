// Sutura Works research survey: receives submissions, stores them in D1 and
// serves password-protected CSV exports.
//
//   POST /api/submit                     store one response (called by the survey page)
//   GET  /api/export/responses.csv?key=  download answers (no contact details)
//   GET  /api/export/contacts.csv?key=   download contact details (no answers)
//   GET  /api/stats                      counts for the private dashboard
//
// The export and stats routes need EXPORT_KEY, either as ?key= or as an
// "Authorization: Bearer <key>" header (the dashboard uses the header).

import { ROLE, allQuestions, CONTACT_FIELDS, ROLE_SECTION, BRANCHES, CLOSING_SECTION } from "../../research/questions.js";

const QUESTIONS = allQuestions();
const KNOWN = new Map(QUESTIONS.map((q) => [q.id, q]));
const ROLES = new Set(Object.values(ROLE));
const MAX_BODY = 200_000;
const MAX_TEXT = 5000;
const MIN_SECONDS = 15; // faster than this is almost certainly a bot

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/submit") {
        if (request.method === "OPTIONS") return cors(request, env, new Response(null, { status: 204 }));
        if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
        return cors(request, env, await submit(request, env, ctx));
      }
      const route = PRIVATE_ROUTES[url.pathname];
      if (route) {
        if (request.method === "OPTIONS") return cors(request, env, new Response(null, { status: 204 }));
        if (request.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);
        if (!authorised(request, url, env)) return cors(request, env, new Response("Not found", { status: 404 }));
        return cors(request, env, await route(env));
      }
      return new Response("Not found", { status: 404 });
    } catch (err) {
      console.error(err);
      return cors(request, env, json({ ok: false, error: "Server error" }, 500));
    }
  },
};

// ---------- submit ----------

async function submit(request, env, ctx) {
  if (!originAllowed(request, env)) return json({ ok: false, error: "Origin not allowed" }, 403);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ ok: false, error: "Too large" }, 413);

  let body;
  try { body = JSON.parse(raw); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
  if (!body || typeof body !== "object") return json({ ok: false, error: "Invalid body" }, 400);
  if (body.consent !== true) return json({ ok: false, error: "Consent is required" }, 400);

  const ref = makeRef();
  // Honeypot filled or impossibly fast: pretend success, store nothing.
  if (body.website || Number(body.seconds) < MIN_SECONDS) return json({ ok: true, ref });

  const answers = cleanAnswers(body.answers);
  if (!ROLES.has(answers.role)) return json({ ok: false, error: "Missing role" }, 400);

  const contact = cleanContact(body.contact);
  const now = new Date().toISOString();
  const stmts = [
    env.DB.prepare("INSERT INTO responses (ref, created_at, role, answers) VALUES (?, ?, ?, ?)")
      .bind(ref, now, answers.role, JSON.stringify(answers)),
  ];
  if (contact) {
    stmts.push(env.DB.prepare(
      "INSERT INTO contacts (ref, created_at, name, email, location, wants_results, wants_interview) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(ref, now, contact.name, contact.email, contact.location, contact.wants_results ? 1 : 0, contact.wants_interview ? 1 : 0));
  }
  await env.DB.batch(stmts);

  if (env.RESEND_API_KEY) ctx.waitUntil(notify(env, ref, answers.role, Boolean(contact)));
  return json({ ok: true, ref });
}

function cleanAnswers(input) {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const [key, value] of Object.entries(input)) {
    const baseId = key.endsWith("_other") ? key.slice(0, -6) : key;
    const q = KNOWN.get(key) || KNOWN.get(baseId);
    if (!q) continue;
    if (Array.isArray(value)) {
      const list = value.filter((v) => typeof v === "string").map((v) => v.slice(0, 300));
      if (q.options) out[key] = list.filter((v) => q.options.includes(v)).slice(0, q.max || undefined);
    } else if (typeof value === "string" && value.trim()) {
      if (key === q.id && (q.type === "multi" || (q.type === "single" && !q.options.includes(value)))) continue;
      out[key] = value.trim().slice(0, MAX_TEXT);
    }
  }
  return out;
}

function cleanContact(c) {
  if (!c || typeof c !== "object") return null;
  const wants_results = c.wants_results === true;
  const wants_interview = c.wants_interview === true;
  if (!wants_results && !wants_interview) return null;
  const name = String(c.name || "").trim().slice(0, 120);
  const email = String(c.email || "").trim().slice(0, 200);
  // email is needed for either option; a name only for an interview
  if ((wants_interview && !name) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return { name, email, location: String(c.location || "").trim().slice(0, 120), wants_results, wants_interview };
}

function makeRef() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return "SW-" + [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

// Email says only that a response arrived; answers never leave the database.
async function notify(env, ref, role, hasContact) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.NOTIFY_FROM,
      to: [env.NOTIFY_TO],
      subject: `New research response ${ref}`,
      text: `A new response was submitted to the business journey research survey.\n\nReference: ${ref}\nRespondent type: ${role}\nLeft contact details: ${hasContact ? "Yes" : "No"}\n\nDownload responses from your private export link.`,
    }),
  });
  if (!res.ok) console.error("Resend failed", res.status, await res.text());
}

// ---------- export ----------

const PRIVATE_ROUTES = {
  "/api/export/responses.csv": exportResponses,
  "/api/export/contacts.csv": exportContacts,
  "/api/stats": stats,
};

function authorised(request, url, env) {
  const bearer = (request.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/);
  const key = bearer ? bearer[1].trim() : url.searchParams.get("key") || "";
  const expected = env.EXPORT_KEY || "";
  if (!expected || key.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function exportResponses(env) {
  const { results } = await env.DB.prepare("SELECT ref, created_at, answers FROM responses ORDER BY created_at").all();
  const columns = [];
  for (const q of QUESTIONS) {
    columns.push({ key: q.id, title: q.label });
    if (q.other) columns.push({ key: `${q.id}_other`, title: `${q.label} (Other, please specify)` });
  }
  const rows = [["Reference", "Submitted (UTC)", ...columns.map((c) => c.title)]];
  for (const r of results) {
    const a = JSON.parse(r.answers);
    rows.push([r.ref, r.created_at, ...columns.map((c) => (Array.isArray(a[c.key]) ? a[c.key].join("; ") : a[c.key] ?? ""))]);
  }
  return csv(rows, "research-responses.csv");
}

async function exportContacts(env) {
  const { results } = await env.DB.prepare(
    "SELECT ref, created_at, name, email, location, wants_results, wants_interview FROM contacts ORDER BY created_at",
  ).all();
  const rows = [["Reference", "Submitted (UTC)", "Name", "Email", "Location", ...CONTACT_FIELDS.map((f) => f.label)]];
  for (const r of results) {
    rows.push([r.ref, r.created_at, r.name, r.email, r.location || "", r.wants_results ? "Yes" : "No", r.wants_interview ? "Yes" : "No"]);
  }
  return csv(rows, "research-contacts.csv");
}

// ---------- dashboard stats ----------

const SECTIONS = [ROLE_SECTION, ...Object.values(BRANCHES), CLOSING_SECTION];
const ROLE_SHORT = { owner: "Business owners", lawyer: "Lawyers", agent: "CAC agents", consultant: "Consultants", otherPro: "Other professionals", other: "Other" };
const lagosDay = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }); // YYYY-MM-DD

// Counts only: no free-text answers and no contact details leave the database here.
async function stats(env) {
  const [{ results: rows }, contactRow] = await Promise.all([
    env.DB.prepare("SELECT ref, created_at, role, answers FROM responses ORDER BY created_at").all(),
    env.DB.prepare("SELECT count(*) AS total, coalesce(sum(wants_results), 0) AS results, coalesce(sum(wants_interview), 0) AS interview FROM contacts").first(),
  ]);
  const answers = rows.map((r) => JSON.parse(r.answers));

  const roles = Object.entries(ROLE).map(([k, label]) => ({ label: ROLE_SHORT[k], count: rows.filter((r) => r.role === label).length }));

  const perDay = new Map();
  for (const r of rows) { const d = lagosDay(r.created_at); perDay.set(d, (perDay.get(d) || 0) + 1); }
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = lagosDay(new Date(Date.now() - i * 86400000).toISOString());
    days.push({ date: d, count: perDay.get(d) || 0 });
  }

  const sections = SECTIONS.map((s) => ({
    title: s.title,
    questions: s.questions.map((q) => {
      const given = answers.filter((a) => (Array.isArray(a[q.id]) ? a[q.id].length : a[q.id]));
      const out = { id: q.id, label: q.label, type: q.type, answered: given.length };
      if (q.options) {
        out.max = q.max || null;
        out.options = q.options.map((o) => ({ label: o, count: given.filter((a) => (Array.isArray(a[q.id]) ? a[q.id].includes(o) : a[q.id] === o)).length }));
      }
      return out;
    }),
  }));

  const today = lagosDay(new Date().toISOString());
  return new Response(JSON.stringify({
    ok: true,
    total: rows.length,
    today: perDay.get(today) || 0,
    last7: days.slice(-7).reduce((n, d) => n + d.count, 0),
    lastAt: rows.length ? rows[rows.length - 1].created_at : null,
    roles,
    days,
    contacts: contactRow,
    recent: rows.slice(-10).reverse().map((r) => ({ ref: r.ref, at: r.created_at, role: ROLE_SHORT[Object.keys(ROLE).find((k) => ROLE[k] === r.role)] || r.role })),
    sections,
  }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

// Quote every cell, and stop spreadsheet apps treating text as a formula.
function csv(rows, filename) {
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const body = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

// ---------- helpers ----------

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
}
function originAllowed(request, env) {
  const origin = request.headers.get("Origin");
  return origin && allowedOrigins(env).includes(origin);
}
function cors(request, env, response) {
  const origin = request.headers.get("Origin");
  if (origin && allowedOrigins(env).includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Expose-Headers", "Content-Disposition");
    response.headers.set("Access-Control-Max-Age", "86400");
    response.headers.set("Vary", "Origin");
  }
  return response;
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
