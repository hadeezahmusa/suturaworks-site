// Standard Web Push from the Worker, with no library: VAPID (RFC 8292) to
// identify us to the push service, and aes128gcm (RFC 8291) to encrypt the
// message so only the person's own device can read it. Uses WebCrypto only.
//
// The VAPID key pair is made on first use and kept in the settings table
// (key vapid). The public half goes to the page so the phone can subscribe.

const enc = new TextEncoder();
const SUBJECT = "mailto:info@suturaworks.com";

export function b64u(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64u(str) {
  const s = atob(String(str).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(str).length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
}

// ---------- keys ----------

export async function vapidKeys(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'vapid'").first();
  if (row) return JSON.parse(row.value);
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const keys = { publicKey: b64u(await crypto.subtle.exportKey("raw", pair.publicKey)), privateJwk: await crypto.subtle.exportKey("jwk", pair.privateKey) };
  // Two requests at once could both make a pair: whichever lands first wins.
  await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('vapid', ?, ?) ON CONFLICT (key) DO NOTHING").bind(JSON.stringify(keys), new Date().toISOString()).run();
  return JSON.parse((await env.DB.prepare("SELECT value FROM settings WHERE key = 'vapid'").first()).value);
}

async function vapidHeader(keys, endpoint) {
  const aud = new URL(endpoint).origin;
  const header = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT })));
  const key = await crypto.subtle.importKey("jwk", keys.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  // WebCrypto gives the raw r||s signature JWT needs.
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${keys.publicKey}`;
}

// ---------- encryption (RFC 8291, one record) ----------

async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

export async function encrypt(sub, plaintext, testing = {}) {
  const uaPublic = unb64u(sub.p256dh), authSecret = unb64u(sub.auth);
  const local = testing.local || await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = testing.salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // The last (only) record ends with the 0x02 delimiter.
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(enc.encode(plaintext), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, body);
}

// Sends one notification. Returns "ok", "gone" (the subscription has
// expired and should be deleted) or "failed".
export async function sendPush(env, sub, payload, { ttl = 3600, urgency = "normal" } = {}) {
  try {
    const keys = await vapidKeys(env);
    const body = await encrypt(sub, JSON.stringify(payload));
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: { authorization: await vapidHeader(keys, sub.endpoint), "content-encoding": "aes128gcm", "content-type": "application/octet-stream", ttl: String(ttl), urgency },
      body,
    });
    if (res.status === 404 || res.status === 410) return "gone";
    return res.ok ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

// For tests: the JWT parts, so they can be checked against the public key.
export const _test = { vapidHeader };
