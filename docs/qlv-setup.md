# QLV 2026 registration: setup and admin guide

The JCI Aso QLV 2026 registration page lives at `qlv2026/` and is published at
**suturaworks.com/qlv2026/**. It is unlisted: `noindex, nofollow`, disallowed in `robots.txt`, not in the
sitemap and not linked from any other page. Anyone with the link can open it. That is intended.

It carries JCI Aso's identity, not Sutura's. The design and copy come from the approved prototype and
the build spec. The only Sutura presence is "Registration hosted by Sutura Works" in the top bar.

## Landing page

The shared link opens on the landing page from `qlv-2026-landing.html` (approved 19 October): the
gold scaffold draws around the QLV mark, withdraws and leaves it standing. It plays once per browser
session and shows at rest after that. Anyone who asks their device for reduced motion sees the
finished page with no animation. Register leads to the ticket picker.

Sound is off until the visitor presses **Sound**, because browsers do not let a page play sound
before a tap. Pressing it replays the sequence with quiet cues made in the browser (`qlv2026/sound.js`).

The WhatsApp preview uses `qlv2026/assets/og-card.png`. WhatsApp caches previews, so a link
shared before a change may keep showing the old card for a while.

The QLV logo file is only 324 pixels wide and looks soft on sharp screens. A larger PNG (at least
1200 wide) or an SVG from JCI Aso would fix it; swap it in at `qlv2026/assets/qlv-white.png`.

## Member codes

The JCI Aso member rate needs the personal code JCI Aso gave each member. On the member ticket the
page asks for the code, shows the name it belongs to, and once the person confirms it is them,
fills in their name and code on the details form, locked. The server takes the name from the
member list whatever the page sends, and a code can only hold one live registration (releasing it
frees the code).

The list is in the `members` table of the D1 database only. **It is not in this repository**,
because the repository is public. To add or correct a member:

```sh
npx wrangler d1 execute qlv2026 --remote --command "INSERT OR REPLACE INTO members (code, name) VALUES ('ABC123', 'Full Name')"
```

Members' emails sit in the same table (column `email`). The admin page's **Member codes** tab
emails each member with an email on file their own code, once, with a preview first. Members who
have already registered with their code are skipped. It uses the same daily allowance as the
reminder button. To add an email later:

```sh
npx wrangler d1 execute qlv2026 --remote --command "UPDATE members SET email = 'name@example.com' WHERE code = 'ABC123'"
```

Then press **Send codes** again: only the newly added members are emailed.

Code checks are limited to 12 an hour per connection so the codes cannot be guessed by trying many.

## Logos

`qlv2026/assets/jci-aso-white.png` and `qlv-white.png` are the white versions supplied on 19 October,
so every place they appear is navy: the top bar, the claim page header, the digital ticket and the
email header. `favicon.png` is the JCI shield on navy. The older combined lockup files stay in the
folder only because emails already sent point at them.

## How it fits together

| Part | File | What it does |
|---|---|---|
| Page | `qlv2026/index.html`, `app.js`, `qlv.css` | All twelve screens plus closed, ticket view and message screens |
| Prices, dates, bank | `qlv2026/event.js` | One place for every price and date. The Worker recalculates amounts from it |
| Questions | `qlv2026/questions.js` | The four question sets, verbatim from the prototype. Add questions here |
| Endpoint and privacy line | `qlv2026/config.js` | Worker address, contact email, the approved privacy line |
| Worker | `qlv-worker/src/index.js` | Registration, proof upload, claims, advisers, answers |
| Admin | `qlv-worker/src/admin.js` | Sign-in, list, verify, preview, send, query, release, CSV |
| Emails | `qlv-worker/src/emails.js` | The five emails in the spec, plus the adviser confirmation, the corporate receipt and the admin sign-in link |
| Proof cleaning | `qlv-worker/src/strip.js` | Checks the file really is a JPG, PNG or PDF and removes photo metadata |
| Database | `qlv-worker/schema.sql` | Registrations, tickets, answers (no names), email log, reference counters |

Cloudflare (Sutura Works account): Worker `qlv2026` at `https://qlv2026.suturaworks.workers.dev`,
D1 database `qlv2026` (Western Europe), KV namespace `qlv2026` for proof files and sign-in links.
Secrets on the Worker: `RESEND_API_KEY` and `SESSION_SECRET`. Emails go from
`qlv2026@suturaworks.com` with replies to `info@suturaworks.com`.

## Admin

Open **https://qlv2026.suturaworks.workers.dev/admin**, enter `hadeezah@suturaworks.com` and use the
link that arrives (it works once and lasts 15 minutes). You stay signed in on that device for 7 days, then ask for a new link. Signing out ends it straight away. To add the
treasurer later, add their address to `ADMIN_EMAILS` in `qlv-worker/wrangler.toml`, separated by a
comma, and redeploy.

### Who can sign in

- **Admins** (`ADMIN_EMAILS` in `wrangler.toml`): everything.
- **Verifiers** (`VERIFIER_EMAILS`, a Worker secret so personal addresses stay out of the code):
  the Registrations tab only. They can open registrations, view proofs, press **Payment verified**,
  undo their own verification before tickets go out and download the Registrations CSV. Sending
  tickets, queries, releases, settings, answers and member codes stay with admins, and the server
  enforces it. Each registration shows who verified it.

The treasurer is a verifier. To change verifiers: `npx wrangler secret put VERIFIER_EMAILS` with a
comma separated list.

When the treasurer verifies, the registration moves to **Verified, not sent**: check that filter
daily, preview and press Send.

### Daily routine

1. Download **Registrations CSV** and send it to the treasurer. Each row has the reference, name,
   amount and status. The treasurer matches the narration on the FCMB statement and tells you which
   references have cleared.
2. For each one that cleared, open it and press **Payment verified**. This makes the ticket or tickets
   (or a sponsor's claim link) and sends nothing.
3. Read the previews. Each one is the exact email that will go out.
4. Press **Send tickets** (or **Send claim link**). The status becomes Confirmed.
   If you verified the wrong one, press **Undo verification** before sending.
5. If a transfer cannot be found, press **Query**, write what is missing, preview, then send. The
   email links them back to upload a clearer proof, which puts them back in the Awaiting list.
6. Members: check the name against the JCI Aso register before verifying. If they are not on it,
   use Query to tell them about the standard rate.

### Release rule

Anything still Awaiting 3 days after it was registered shows **Flagged for release**. Nothing is
released automatically. **Release seat** moves it to Released without emailing anyone, and
**Reopen** undoes it.

### Reminding people to send their three answers

In the **Answers** tab, **Send next batch** emails a reminder to ticket holders who have not sent
their three answers. Each person is reminded once. People who answered from the Proof received
screen count as answered. Judges, advisers, sponsors and anyone without a sent ticket are left out.
The tab shows counts only, never who has or has not answered.

Resend's free plan allows 100 emails a day, so a batch is at most 70 and never takes the last 24
hours past 90, which keeps room for that day's ticket emails. If more people are waiting, the tab
says so: press it again the next day. A good moment is about a week before answers close, with a
second press for any batch left over. If you move to Resend Pro, raise `DAILY_SAFE` and
`REMINDER_BATCH` at the top of the reminder section in `qlv-worker/src/admin.js`.

### Other buttons

- **Resend** next to a sent ticket: send it again, optionally to a corrected email address.
- **Answers** tab and **Answers CSV**: the three-question answers grouped by situation, with no names
  or references, so the promise on the questions screen holds when you build the six tasks.
- **Tickets CSV**: every issued ticket, for the desk on day two.

## What happens without you

- **Advisers** are confirmed as soon as they submit and get their reference, a confirmation email and
  a calendar invitation. There is no payment, so there is nothing for a person to check.
- **Claimed sponsored seats** get their ticket straight away, and the sponsor gets a "seat claimed"
  email each time. The sponsor's money was verified by you before the claim link existed.
- Everything that depends on money (standard, member, corporate, the sponsor's link) waits for you.

## Tables, partners, staff and badges (admin only)

Added 21 October 2026 from `QLV-2026-Admin-Build-Spec.md`. Nothing here reaches a participant: no
page, email or ticket mentions a table.

- **Tables.** A seat fills when a payment is verified (standard, member, corporate) or when a
  sponsored or partner seat is claimed. Judges and mentors, advisers and facilitators never sit.
  The rule is in `qlv-worker/src/placement.js` with tests in `qlv-worker/test` (`node --test
  qlv-worker/test/*.test.mjs`). Seats never move; cancelling a ticket frees only its seat. The
  page refreshes every 15 seconds. Table names, capacity, partner levels, ignorable organisation
  answers and the admin colours are in `qlv-worker/src/config.js`.
- **Partners.** Add the partner, check the payment, press confirm with a payment note: the contact
  gets one email with a claim link per seat. Each link works once (Void link replaces it). Partner
  income is shown on the Partners page only and never counts as ticket income. The level never
  appears on a ticket, email, badge or export.
- **Staff.** Register facilitators (references QLV26-F01 onward; ticket emailed at once). Advisers
  and judges from the sign-up page and corporate judges or mentors are listed too.
- **Badge export.** Edit badge names, download the CSV (no emails or phones), and lock and stamp
  before printing. Anyone seated after the lock is listed as a late addition.
- **Cancel ticket** (on a registration's ticket list) is the refund action: the ticket stops working
  and its seat is freed.

Database changes are in `qlv-worker/migrations/2026-10-21-admin-additions.sql` (additive only).

## Closing date

- Registration, claims and new answers close at the end of **30 October 2026** (Abuja time) unless
  you change it. After that the page shows a closed screen, not a 404. Advisers can still confirm
  until 5 November.
- To extend or reopen, change **Registration closes at the end of** at the top of the admin page and
  press Save date. A past date closes registration straight away; a later date reopens it. Every
  date on the page and in the sponsor emails follows it. The page picks the change up within a minute.
- To preview the closed screen before then, open the page with `?closed=1` on the end.
- To change a price, edit `qlv2026/event.js`, then publish the site and redeploy the Worker.

## Deploying changes

```sh
cd qlv-worker
npm ci
npx wrangler deploy          # needs CLOUDFLARE_API_TOKEN in the environment
```

The page itself publishes with the rest of the site when `main` changes.

## Testing locally

```sh
cd qlv-worker && npm ci
npx wrangler d1 execute qlv2026 --local --file=schema.sql
echo 'SESSION_SECRET=local-test-secret' > .dev.vars
npx wrangler dev --var ALLOWED_ORIGINS:http://localhost:8000 --var SITE_URL:http://localhost:8000/qlv2026/ --var ADMIN_EMAILS:admin@example.com
# in another terminal, from the repo root
python build.py && python -m http.server 8000 --directory _site
```

Without `RESEND_API_KEY`, emails are not sent: they are stored in the local KV under `outbox:` so you
can read them with `npx wrangler kv key list --prefix outbox: --binding KV --local`.

## Deleting someone's data

```sh
npx wrangler d1 execute qlv2026 --remote --command "DELETE FROM tickets WHERE reg_ref='QLV26-014'; DELETE FROM answers WHERE holder='r:QLV26-014'; DELETE FROM registrations WHERE ref='QLV26-014'"
npx wrangler kv key delete --binding KV --remote "proof:QLV26-014"
```

Answers sent from a ticket link are stored under `t:<ticket id>`; look the id up in the tickets table.
