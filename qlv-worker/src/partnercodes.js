// Codes for non-paying partners: the JCI Aso members' businesses on the logo
// wall (screen_logos, source "member"). Each gets one code; their nominee
// types it on the site and gets one free ticket of kind "partner", hung from
// the PTN-FREE registration, with the partner's name as the organisation so
// seating keeps nominees from the same place apart. Admin only, apart from
// the two public calls in index.js.

import { HttpError, now } from "./index.js";

export const FREE_REF = "PTN-FREE";

// Up to four letters from the name, then three numbers: NILE482, MTN107.
// Member codes are initials and three numbers, so the two lists are checked
// against each other.
export function codeStem(name) {
  const letters = String(name || "").toUpperCase().replace(/[^A-Z]/g, "");
  return letters.length >= 3 ? letters.slice(0, 4) : (letters + "QQQ").slice(0, 3);
}

async function freshCode(env, name) {
  const stem = codeStem(name);
  for (let i = 0; i < 40; i++) {
    const n = 100 + (crypto.getRandomValues(new Uint16Array(1))[0] % 900);
    const code = stem + n;
    const clash = await env.DB.prepare("SELECT 1 FROM partner_codes WHERE code = ? UNION SELECT 1 FROM members WHERE code = ? UNION SELECT 1 FROM member_changes WHERE old_code = ?").bind(code, code, code).first();
    if (!clash) return code;
  }
  throw new HttpError(500, "Could not make a new code. Try again.");
}

const PARTNERS_SQL = `SELECT l.id AS logo_id, COALESCE(l.name, '') AS name, l.logo_type, l.logo_at,
    c.id AS code_id, c.code, c.created_at AS code_at, c.redeemed_at,
    t.ticket_ref, t.name AS nominee, t.email AS nominee_email, t.cancelled_at
  FROM screen_logos l
  LEFT JOIN partner_codes c ON c.logo_id = l.id AND c.voided_at IS NULL
  LEFT JOIN tickets t ON t.id = c.ticket_id
  WHERE l.source = 'member' AND l.deleted_at IS NULL
  ORDER BY lower(l.name)`;

export async function codesView(env) {
  const { results } = await env.DB.prepare(PARTNERS_SQL).all();
  const rows = results.map((r) => ({
    logoId: r.logo_id, name: r.name, hasLogo: !!r.logo_at, code: r.code || null, codeAt: r.code_at || null,
    redeemed: r.redeemed_at ? { at: r.redeemed_at, name: r.nominee, email: r.nominee_email, ref: r.ticket_ref, cancelled: !!r.cancelled_at } : null,
  }));
  return {
    rows, link: `${env.SITE_URL}?nominee`,
    total: rows.length, withCode: rows.filter((r) => r.code).length, redeemed: rows.filter((r) => r.redeemed).length,
  };
}

// One code for every non-paying partner that has none. Safe to press again.
export async function createMissing(env, who) {
  const { results } = await env.DB.prepare(PARTNERS_SQL).all();
  const stamp = now();
  for (const r of results.filter((x) => !x.code)) {
    const code = await freshCode(env, r.name);
    await env.DB.prepare("INSERT INTO partner_codes (code, logo_id, name, created_at, created_by) VALUES (?, ?, ?, ?, ?)").bind(code, r.logo_id, r.name, stamp, who || null).run();
  }
  return codesView(env);
}

// A replacement code, if the old one went to the wrong person. The old one
// stops working. Not once the code has been used.
export async function replaceCode(env, b, who) {
  const id = Number(b.logoId);
  const cur = await env.DB.prepare("SELECT * FROM partner_codes WHERE logo_id = ? AND voided_at IS NULL").bind(id).first();
  if (!cur) throw new HttpError(404, "That sponsor has no code yet.");
  if (cur.ticket_id) throw new HttpError(409, "This code has already been used for a ticket, so it can't be replaced.");
  const code = await freshCode(env, cur.name);
  await env.DB.batch([
    env.DB.prepare("UPDATE partner_codes SET voided_at = ? WHERE id = ?").bind(now(), cur.id),
    env.DB.prepare("INSERT INTO partner_codes (code, logo_id, name, created_at, created_by) VALUES (?, ?, ?, ?, ?)").bind(code, id, cur.name, now(), who || null),
  ]);
  return codesView(env);
}

// The live code a nominee typed, with the partner's current name.
export async function codeFor(env, raw) {
  const code = String(raw || "").replace(/\s+/g, "").toUpperCase().slice(0, 12);
  if (!code) throw new HttpError(400, "Please type the code your organisation gave you.");
  const c = await env.DB.prepare(`SELECT c.*, COALESCE(l.name, c.name) AS partner FROM partner_codes c JOIN screen_logos l ON l.id = c.logo_id
    WHERE c.code = ? AND c.voided_at IS NULL AND l.deleted_at IS NULL`).bind(code).first();
  if (!c) throw new HttpError(404, "We could not find that code. Check it against the message from your organisation: it is letters followed by three numbers.", "bad_code");
  if (c.ticket_id) throw new HttpError(409, "This code has already been used for a ticket. Each code is for one person. If that was not you, ask the person who gave you the code.", "code_used");
  return c;
}
