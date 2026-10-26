// Who is thanked on the projector, and with what logo.
//
// Three groups: confirmed partners, sponsored-seat sponsors who agreed to be
// named, and JCI Aso members' businesses (listed free, added here by admin).
// Logo size on screen follows what was given: partner level, or for a
// sponsor the amount against the same thresholds. Members' businesses are
// the smallest size. Corporate teams are not listed.

import { HttpError, now } from "./index.js";
import { sniff, stripMetadata } from "./strip.js";
import { PARTNER_LEVELS } from "./config.js";

const MAX_LOGO = 1024 * 1024;
const SIZE_LABEL = { 4: "Largest", 3: "Large", 2: "Medium", 1: "Small" };
const LEVEL_SIZE = { lead: 4, supporting: 3, community: 2 };
const clean = (v, max = 120) => String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);

function sponsorSize(amount) {
  if (amount >= PARTNER_LEVELS.lead.amount) return 4;
  if (amount >= PARTNER_LEVELS.supporting.amount) return 3;
  return 2;
}
const logoPath = (row) => (row && row.logo_at ? `/api/logo?id=${row.id}&v=${encodeURIComponent(row.logo_at)}` : null);

// Everyone who could appear, with whether they do and why not.
async function everyone(env) {
  const [partners, sponsors, rows] = await env.DB.batch([
    env.DB.prepare("SELECT id, name, level, status FROM partners ORDER BY COALESCE(confirmed_at, created_at)"),
    env.DB.prepare("SELECT ref, name, amount, size, status, named_publicly FROM registrations WHERE tier = 'sponsored' AND status != 'released' ORDER BY COALESCE(verified_at, created_at)"),
    env.DB.prepare("SELECT * FROM screen_logos WHERE deleted_at IS NULL ORDER BY id"),
  ]);
  const by = {};
  for (const r of rows.results) if (r.source_ref !== null) by[`${r.source}:${r.source_ref}`] = r;
  const out = [];
  for (const p of partners.results) {
    const row = by[`partner:${p.id}`];
    out.push({
      key: `partner:${p.id}`, source: "partner", registered: p.name, name: (row && row.name) || p.name, size: LEVEL_SIZE[p.level] || 2,
      detail: PARTNER_LEVELS[p.level]?.name || p.level, row,
      live: p.status === "confirmed", why: p.status === "confirmed" ? "" : "Shows once the payment is confirmed",
    });
  }
  for (const s of sponsors.results) {
    const row = by[`sponsor:${s.ref}`];
    const paid = s.status === "verified" || s.status === "confirmed";
    out.push({
      key: `sponsor:${s.ref}`, source: "sponsor", registered: s.name, name: (row && row.name) || s.name, size: sponsorSize(s.amount),
      detail: `${s.ref}, ${s.size} sponsored seats`, row,
      live: paid && !!s.named_publicly,
      why: !s.named_publicly ? "Asked to stay anonymous, so never shown" : paid ? "" : "Shows once the payment is verified",
    });
  }
  for (const r of rows.results.filter((x) => x.source === "member")) {
    out.push({ key: `member:${r.id}`, source: "member", registered: null, name: r.name, size: 1, detail: r.owner ? `JCI Aso member: ${r.owner}` : "JCI Aso member's business", row: r, live: true, why: "" });
  }
  return out;
}

export async function screenList(env) {
  const list = await everyone(env);
  return {
    entries: list.map(({ row, ...e }) => ({ ...e, owner: row ? row.owner : null, sizeLabel: SIZE_LABEL[e.size], logo: logoPath(row) })),
  };
}

// For the display: shown entries only, biggest first, then in the order they came.
export async function screenSponsors(env) {
  const list = (await everyone(env)).filter((e) => e.live);
  return list.map((e, i) => ({ name: e.name, size: e.size, logo: logoPath(e.row), i }))
    .sort((a, b) => b.size - a.size || a.i - b.i).map(({ i, ...e }) => e);
}

// The row behind a key, made on first use for partners and sponsors.
async function rowFor(env, key, who) {
  const [source, ref] = String(key || "").split(/:(.*)/s);
  if (source === "member") {
    const r = await env.DB.prepare("SELECT * FROM screen_logos WHERE id = ? AND source = 'member' AND deleted_at IS NULL").bind(Number(ref)).first();
    if (!r) throw new HttpError(404, "That business is no longer on the list. Refresh the page.");
    return r;
  }
  if (source === "partner") {
    if (!(await env.DB.prepare("SELECT id FROM partners WHERE id = ?").bind(Number(ref)).first())) throw new HttpError(404, "That partner is not there. Refresh the page.");
  } else if (source === "sponsor") {
    if (!(await env.DB.prepare("SELECT ref FROM registrations WHERE ref = ? AND tier = 'sponsored'").bind(ref).first())) throw new HttpError(404, "That sponsor is not there. Refresh the page.");
  } else throw new HttpError(400, "Unknown entry.");
  const id = source === "partner" ? String(Number(ref)) : ref;
  await env.DB.prepare("INSERT INTO screen_logos (source, source_ref, created_at, created_by) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING").bind(source, id, now(), who || null).run();
  return env.DB.prepare("SELECT * FROM screen_logos WHERE source = ? AND source_ref = ?").bind(source, id).first();
}

export async function addMemberBusiness(env, b, who) {
  const name = clean(b.name);
  if (!name) throw new HttpError(400, "Type the business name as it should appear on screen.");
  const dupe = await env.DB.prepare("SELECT id FROM screen_logos WHERE source = 'member' AND deleted_at IS NULL AND lower(name) = lower(?)").bind(name).first();
  if (dupe) throw new HttpError(409, "That business is already on the list.");
  const row = await env.DB.prepare("INSERT INTO screen_logos (source, name, owner, created_at, created_by) VALUES ('member', ?, ?, ?, ?) RETURNING id")
    .bind(name, clean(b.owner) || null, now(), who || null).first();
  return { id: row.id, key: `member:${row.id}`, ...(await screenList(env)) };
}

// Renames what shows on screen. For partners and sponsors a blank name goes
// back to the registered one; a member's business always needs a name.
export async function saveScreenEntry(env, b, who) {
  const row = await rowFor(env, b.key, who);
  const name = clean(b.name);
  if (row.source === "member") {
    if (!name) throw new HttpError(400, "The business needs a name.");
    await env.DB.prepare("UPDATE screen_logos SET name = ?, owner = ? WHERE id = ?").bind(name, clean(b.owner) || null, row.id).run();
  } else {
    await env.DB.prepare("UPDATE screen_logos SET name = ? WHERE id = ?").bind(name || null, row.id).run();
  }
  return screenList(env);
}

export async function removeMemberBusiness(env, b) {
  const row = await rowFor(env, b.key);
  await env.KV.delete(`logo:${row.id}`);
  await env.DB.prepare("UPDATE screen_logos SET deleted_at = ? WHERE id = ?").bind(now(), row.id).run();
  return screenList(env);
}

export async function removeLogo(env, b, who) {
  const row = await rowFor(env, b.key, who);
  await env.KV.delete(`logo:${row.id}`);
  await env.DB.prepare("UPDATE screen_logos SET logo_type = NULL, logo_size = NULL, logo_at = NULL WHERE id = ?").bind(row.id).run();
  return screenList(env);
}

export async function putLogo(env, req, key, who) {
  const row = await rowFor(env, key, who);
  const tooBig = "That logo is over 1MB. Export it smaller, about 1000 pixels wide is plenty.";
  if (Number(req.headers.get("content-length") || 0) > MAX_LOGO) throw new HttpError(413, tooBig);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > MAX_LOGO) throw new HttpError(413, tooBig);
  if (!bytes.length) throw new HttpError(400, "That file is empty. Choose it again.");
  const type = sniff(bytes);
  if (type !== "image/png" && type !== "image/jpeg") throw new HttpError(415, "Upload the logo as a PNG or JPG. A PNG with a transparent background looks best.");
  const stored = stripMetadata(bytes, type), stamp = now();
  await env.KV.put(`logo:${row.id}`, stored, { metadata: { type, size: stored.length, at: stamp } });
  await env.DB.prepare("UPDATE screen_logos SET logo_type = ?, logo_size = ?, logo_at = ? WHERE id = ?").bind(type, stored.length, stamp, row.id).run();
  return screenList(env);
}

// Public, for the display. The URL carries the upload time, so a replaced
// logo is a new address and the old one can be cached for good.
export async function getLogo(env, url) {
  const id = Number(url.searchParams.get("id"));
  const row = id ? await env.DB.prepare("SELECT id, logo_at FROM screen_logos WHERE id = ? AND deleted_at IS NULL").bind(id).first() : null;
  const { value, metadata } = row && row.logo_at ? await env.KV.getWithMetadata(`logo:${id}`, { type: "arrayBuffer" }) : {};
  if (!value) return new Response("Not found.", { status: 404 });
  return new Response(value, {
    headers: { "content-type": metadata.type, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff", "access-control-allow-origin": "*" },
  });
}
