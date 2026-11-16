# Sutura Works Events Platform: Build Handover

This is the brief for building a new, multi-client events platform on the Sutura Works Limited site. It is based on a single-event system Sutura built and ran successfully in November 2026. Everything here describes how that system worked and what to change. **No data from that event is included or should be carried over.** No names, emails, scores, money figures, logos, links or keys. Build from an empty database.

Give this whole file to the new session as the starting brief. Section 14 lists decisions still open; ask the owner about those before building the parts they affect.

---

## 1. What we are building

A self-service platform where an organisation (the **client**) can:

1. Create an account on the Sutura Works site.
2. Pick what kind of event they are running and get a **recommended bundle** of features, then add or remove features.
3. Choose **per-event** pricing or a **subscription**, and pay Sutura Works through Paystack.
4. Set up their event: name, dates, venue or virtual link, purpose, logo, colours and fonts from a curated set.
5. Run the whole event from one admin: registration, payments by transfer, tickets, seating, check-in, judging, stage display, certificates, feedback and reports.

**Nothing in the product may be hard-coded to one organisation.** Every name, colour, logo, wording, price, ticket type, criterion, table name and email text comes from the client's settings.

### Who it is for first

Two use cases first:

- **Workshops and bootcamps** (the owner's chosen first use case). The competition style "sprint" features (teams, mentors, task packs, judging, stage display, winner reveal) are **optional modules** that a workshop can switch on.
- **Performances and shows** (drama productions, concerts, recitals, comedy nights). One of the first clients runs a drama production. Shows need performances on several dates, theatre seating with a seat map, ticket tiers, online payment, rich media (poster, gallery, trailer, sound) and a digital programme. See section 6.17 onwards.

### The non-negotiable principle

**Most clients are not technical.** A client must be able to go from sign-up to a live registration page **without touching an API key, a DNS record or a developer console.** Anything technical is optional and comes later, with step-by-step guidance in the app.

---

## 2. People and roles

| Role | Who | How they sign in |
|---|---|---|
| Sutura super admin | Sutura Works staff | Email magic link, on an allow list |
| Client owner | The person who signed up and pays | Email magic link |
| Client team: admin | Full access to their organisation's events | Email magic link, invited by the owner |
| Client team: verifier | Checks payment proofs only | Email magic link |
| Client team: desk | Check-in only, on the day | Email magic link |
| Client team: stage | Runs the stage display only | Email magic link |
| Board or sponsor viewer | Read-only look, with private details hidden | One shared passcode per event |
| Attendee | Registers, gets a ticket, team room, certificate | Personal link in their email, no password |
| Judge, mentor, speaker | Gets their brief and, for judges, a scoring page | Personal link, no password |

Every client-side record belongs to an **organisation** and an **event**. A client can never see another client's data. Enforce this in every query (see section 11).

---

## 3. The client journey

1. **Sign up.** Email and organisation name. Magic link to confirm.
2. **Choose a use case.** Cards: "Workshop", "Bootcamp", "Workshop with team challenge", "Show or performance", "Something else". Each shows its recommended bundle (section 5).
3. **Adjust features.** Toggles with one-line explanations and the price change shown live.
4. **Choose how to pay.** Per event or subscription (section 4). Pick the attendee band and email credits.
5. **Pay** through Paystack checkout on Sutura's account.
6. **Set up wizard** (can be left and resumed):
   - event name, short name, purpose or tagline, dates, timezone;
   - in person (venue, address), virtual (meeting link) or both, with per-day settings;
   - theme: logo upload, primary and accent colour (with a contrast check), one of several font pairings, light or dark header;
   - ticket types and prices (section 6.1), bank details for transfers;
   - which emails go out, with editable wording and a preview.
7. **Go live.** The client gets their registration page link (a Sutura subdomain or path) and a QR code for it.
8. **Run the event** from the admin.
9. **After the event:** certificates gated by feedback, the master report download, then the event is archived. Data is kept for a stated period, then deleted (state this in the terms).

---

## 4. Pricing and billing (Sutura's income)

The owner chose **both** models:

- **Per event:** one payment for one event, priced by bundle, attendee band and email credits.
- **Subscription:** monthly or yearly, covering a set number of events and attendees per period, with included email credits each month.

Prices are **set by the Sutura super admin in a pricing screen**, never in code. Store plans, features, bands and credit packs as data.

### Paystack (Sutura's account only)

Only Sutura's own Paystack account is used. Clients do not connect Paystack at all.

- **One-off payments:** initialise a transaction on the server, send the client to Paystack's checkout, then confirm by **verifying the transaction on the server** and by the **webhook**. Never trust the browser's "success" alone.
- **Webhook:** check the `x-paystack-signature` header (HMAC SHA512 of the raw body with the secret key) before acting. Make handling idempotent: the same event may arrive twice.
- **Subscriptions:** use Paystack plans and subscriptions. Handle renewal, failed charge and cancellation webhooks; downgrade or pause the workspace gracefully, never delete data on a failed payment.
- **Receipts:** email a receipt and keep an invoice record per payment.
- **Fees to plan for (check before quoting):** Paystack's published Nigerian local card rate is 1.5% + NGN 100, capped at NGN 2,000, with the NGN 100 waived under NGN 2,500. International cards are higher. Sources: [Paystack pricing](https://paystack.com/pricing), [Transactions pricing](https://support.paystack.com/en/articles/2130306).

### Attendee ticket fees (client's income)

Two ways, chosen per event:

**1. Manual bank transfer** (the default for workshops), exactly as the original system worked:

- the client enters their own bank details;
- the attendee transfers and uploads proof (image or PDF);
- the client's verifier approves, queries or releases each booking;
- the ticket is sent on approval.

**2. Online payment through Paystack subaccounts** (required for shows; available to other use cases only if the owner decides so, see section 14). Selling to hundreds of members of the public cannot rely on checking proofs by hand, and buyers expect to pay and get a ticket at once.

- **What a subaccount is:** a child of Sutura's Paystack account that points at the client's bank account. Paystack splits each payment automatically, for example most to the client and a set percentage or flat fee to Sutura, and settles both directly.
- **What the client does:** fills in a short form with their bank, account number and business name. The platform checks the account name with Paystack's account resolve call, shows it back for confirmation, then creates the subaccount in the background. No Paystack account, keys or code for the client.
- **Checkout:** the buyer picks a performance, tier and seats, pays on Paystack checkout with the split applied. The ticket is issued only after the server verifies the transaction or receives the signed webhook.
- **Seat holds:** seats chosen on the map are held for a short time (for example 10 minutes) while the buyer pays, then released if payment does not complete. Never sell the same seat twice: hold and confirm in one database transaction with a unique constraint on performance plus seat.
- **Who pays the Paystack fee:** a setting per event. Either the client absorbs it, or it is added to the buyer's total and shown clearly.
- **Refunds and cancellations:** if a performance is cancelled, the client can refund through the platform (Paystack refunds) or move buyers to another performance. Log every refund.
- **Data model:** a `payout_accounts` table per organisation (bank, account name, subaccount code, verified date), and per-order records of the split.

---

## 5. Features and bundles

Each feature is a **module** that can be on or off per event. Suggested bundles for the first use case:

| Bundle | Modules |
|---|---|
| **Workshop Basic** | Registration and tickets, transfer payments, emails, check-in, certificates, feedback, master report |
| **Workshop Plus** | Basic, plus seating with table shapes, name badges and stickers, team rooms, sponsors and logo wall, virtual link sending, invoices, money tracking |
| **Bootcamp with Challenge** | Plus, plus teams and mentors, briefs and task packs, judging and scoring, stage display with timers and winner reveal, achievement certificates |
| **Show Basic** | Performances and showings, ticket tiers, online payment, tickets with QR, door check-in, media page (poster, gallery, cast and crew, synopsis), emails, feedback, master report |
| **Show Plus** | Show Basic, plus theatre seating with seat map and seat choice, trailer and audio player, digital programme, poster-based ticket designs, sponsors and logo wall, interval and countdown screen, promo codes, group bookings |

Modules that do not apply to shows (teams, mentors, task packs, judging, certificates) are hidden for that use case unless the client switches them on.

Price each module and let the bundle show a discount against buying modules one by one.

---

## 6. Module specifications

Each module below describes the behaviour proven in the original system, generalised. Where it says "configurable", the client sets it.

### 6.1 Registration and tickets

- Registration page on the client's theme. Questions are configurable (a simple form builder: short text, long text, choice, yes or no, required or optional).
- **Ticket types** (configurable list): standard, member (with member codes), group or corporate (one booker, several named attendees), sponsored seats (a sponsor buys seats and shares a claim link) and complimentary (admin-issued, zero price, never counted as income).
- **Member codes:** the client uploads a member list; each member gets a code by email; the code unlocks the member price once. Allow corrections without losing history.
- **Sponsored seats:** sponsor pays for N seats, gets a private tracker page and one claim link; each claim makes a named ticket. Bulk upload of names by spreadsheet. A sponsor's seats can be held back (no certificate, no feedback request) until the sponsor's payment is verified.
- **Closing date** that closes registration and claims at the end of a day in the event's timezone.
- **Tickets:** emailed with a QR code and a personal link. Correcting an email resends the ticket.
- **Cancellation and release** of unpaid bookings after a set time, with a flag list before release.
- **Optional anonymous survey** at registration with a stated privacy promise (answers stored without names).

### 6.2 Payments by transfer

- Upload proof: check the real file type, cap the size, and **strip image metadata** (phone photos carry location) before storing.
- Verifier queue: Awaiting, Query (with a note emailed to the booker), Verified, Released. Every action logged with who and when.
- Proof files are never shown to read-only viewers and never included in exports.

### 6.3 Email (see section 7 for the credits model)

- Every automatic email has editable wording with placeholders like `{first_name}`, `{event_name}` and `{role}`, and a preview.
- **Greetings keep titles:** "Dr. Ada", "Senator Bola", never "Dear Dr.,". Skip lone initials ("M. Tunde" greets "Tunde").
- A compose screen to write to chosen groups, with CC and attachments, logged.
- Queue all sending on the server. Never rely on a browser tab staying open to finish a batch: in the original system a batch stopped when the phone screen locked. Skip people with no email instead of stopping, and report the count skipped.

### 6.4 Seating with table shapes

The client sets up tables when the seating module is on:

- **Shapes:** round, square, rectangle, long banquet, boardroom, U-shape, classroom rows, cocktail or standing.
- **Capacity:** seats per table for round, square and cocktail. For rectangles, banquet and boardroom: seats per long side plus whether the ends are used. U-shape: seats per arm and along the base. Classroom: seats per row and number of rows.
- **Table names** (configurable list, or numbers), and a floor plan view drawn from the shapes with seat numbers in the right places.
- **Placement rule** (pure function, deterministic, testable): fill the table with the fewest people first; keep people from the same organisation apart where possible; break ties by the configurable balance field (for example, members spread evenly), then by table number; take the lowest free seat. Same input in the same order always gives the same tables.
- Who gets seated and when: paid bookings once verified, sponsored seats once claimed, staff never.
- **Rebalance** before a freeze date: preview moves, apply only if the preview still matches, never move anyone after the freeze.
- **Late additions** after the freeze: flagged, seated by hand with a suggested table, movable until checked in.
- Table cards, seat labels and stickers follow the shape.

### 6.5 Check-in

- Desk login sees name, reference and table only.
- Search, scan QR, tick arrival; record who checked them in.
- **Works offline:** queue ticks on the device and sync when the connection returns (the original event had an internet glitch that made some times wrong).
- Dashboard: arrived versus expected by ticket type and table, each tile tappable to the list behind it.
- Arrival time is a nice-to-have; the yes or no is what counts for certificates.

### 6.6 Badges, stickers and print

- Name badges (CR80 card, portrait) and name stickers (landscape) as print-ready PDFs with bleed and crop marks, laid out for a print shop. Include blanks.
- Table packs, run sheets, check-in lists and judge or mentor packs as PDFs on the client's theme.
- Generate PDFs **in the browser** where possible (the original ran on a free hosting plan with tiny server CPU), or on the server on a paid plan.

### 6.7 Sponsors and logo wall

- Sponsor levels (configurable names and amounts), seats included per level, contact and payment status.
- Logo upload; the system can make a **white version** of a logo for dark screens. Only sponsors with a logo appear on the display; names without logos are hidden.
- A print-ready photo wall or banner of sponsor logos, sized by level.

### 6.8 Team rooms (optional)

- A personal link opens the attendee's lobby and, after teams are announced, their team room.
- Messages, announcements (scheduled), short intros, read state.
- Installable as a home screen app, with web push notifications (VAPID, standard Web Push, no third-party service needed).
- Team announcement emails go out within the email allowance; never let them crowd out more important emails.

### 6.9 Teams, mentors, briefs and task packs (challenge module)

- Staff roles per person: judge, mentor, both, facilitator, marshal, desk, stage coordinator.
- Mentors are assigned tables; a judge never scores a table they mentored.
- **Briefs:** role-based briefing pages from editable templates, unlocked at a set time, each on a personal link.
- **Task packs:** a library of challenge tasks assigned to tables, printable.

### 6.10 Judging and scoring

- Criteria builder: name, description, score range (default 1 to 5), anchor text for each score. Mark one criterion as the tie-breaker.
- Judge scoring page on a personal link, phone-first, saves every tap on the device and retries until the server has it.
- A table can be scored once it has presented. Submitted scores lock; only admin can unlock, with a reason, and every unlock is logged.
- Results: average of judges' totals, shown with the maximum ("22.8 / 25"); ties go to the tie-break criterion, then to the judges' decision.
- Admin confirms the final places before certificates go.

### 6.11 Stage display (challenge module)

- A projector page on a private link, driven by a stage coordinator from their phone.
- Phases with timers, chime at halfway and near the end, gong at zero. Optional quiet background music on the arrival screen, mutable.
- Speaker spotlight, judges' photo slide, agenda, rotating sponsor logo wall (lead sponsors get their own slide).
- **Winner reveal is configurable:** winner only (two presses: "And the winner is…", then the team) or top three. **Scores are never shown on the public screen.**

### 6.12 Certificates

- Certificate template designer: title, wording, signatures (transparent PNG; offer automatic background removal), placement of name, team and certificate number.
- **Award rules are configurable.** For example "Participation for everyone checked in" plus "Achievement for first place, who also get Participation". The original event changed its mind twice on this, so make it a setting, not code.
- Only people checked in get a certificate. Held seats (unpaid sponsor) wait.
- **Feedback first:** the certificate email has no attachment, only "Give feedback and get your certificate". The download appears after the feedback is sent. A direct download link sends anyone who has not answered back to the form.
- Preview each certificate, issue in batches on the server, resend if a name is corrected (the system tracks "changed since sent").

### 6.13 Feedback

- Default questions (editable): overall experience 1 to 5; what they expected; what they experienced; what they want next time; how likely to recommend the client's events 0 to 10; will they attend again (yes, maybe, no); want membership information (yes or no); want event emails (yes or no); social media handles (optional).
- Each person answers on a personal link, so every answer is tied to their email without asking for it.
- Sent with the certificate for attendees, with the thank-you for staff, or on its own. Reminders skip anyone who has answered.
- Feedback screen: answered count, averages, Net Promoter Score, filters for "wants membership information" and "wants event emails", each answer in full, CSV export.

### 6.14 Thank-you emails

- For judges, mentors, marshals, desk, stage coordinator, speakers, chair and president: editable message with `{role}` filled in, plus the feedback button.

### 6.15 Money, invoices and reports

- Money ledger: income, spending, in-kind support, owed, receipts, with totals (cash in, paid, balance, full cost).
- Invoices for sponsors and groups, emailed from the app.
- **Master report:** one Excel workbook with a Summary sheet, then every dataset (registrations, attendees and check-in, teams, results, scores by judge, corrections, staff, sponsors, money, invoices, certificates, thank-yous, feedback answers and status, lists of people wanting membership information or event emails, survey answers, team room activity, every email sent). Bold frozen headers and filters. **Never include tokens, keys or payment proofs.**
- Attendance report for a sponsor (who came, who did not), on the client's letterhead style.

### 6.16 Read-only board view

- One passcode per event, changeable, signs everyone out when changed.
- Shows the admin read-only with emails, phones, codes, proofs and action links removed.

### 6.17 Performances and showings (shows)

- A show has one or more **performances**, each with its own date, start time, doors-open time, running time, venue (default the show's venue), capacity and status (on sale, sold out, cancelled, past).
- Buyers pick a performance first. Each performance page shows seats left as "Few seats left" or "Sold out" rather than exact numbers, if the client prefers.
- Sales close at a set time before each performance (configurable), with an option for door sales at check-in.
- Cancel or reschedule a performance: email every buyer with the choice of moving to another performance or a refund.
- Reports and check-in split by performance.

### 6.18 Theatre seating and seat map (shows)

- A **venue layout builder** alongside the table shapes in 6.4:
  - **sections** (for example Stalls, Front, Middle, Balcony), each with a price tier;
  - **rows** labelled A, B, C… (or custom), with seats numbered left to right, right to left or odd and even from the centre;
  - **gaps and aisles**, seats removed for pillars, wheelchair spaces and companion seats;
  - **curved rows** as a visual option.
- Save a layout and reuse it for every performance at the same venue. Layouts are per organisation and can be copied.
- **Seat map for buyers:** tap seats on a phone-sized map, colour by tier, see the price before choosing, with "Best available" as a one-tap option for people who do not want to choose.
- **Blocked seats:** the client can hold seats for sponsors, cast families or press, and release them later.
- **General admission** is also allowed: a performance can sell tiers with a capacity and no seat numbers.
- Tickets, door lists and reports show section, row and seat.

### 6.19 Ticket tiers, promo codes and group bookings (shows)

- **Tiers** per performance: name (for example VIP, Regular, Student, Child), price, quantity limit, sale window, what is included and whether a tier needs a check at the door (student ID).
- **Promo codes:** percentage or fixed discount, limited uses, valid dates, specific tiers or performances.
- **Group bookings:** one buyer, several tickets, each ticket with its own QR so the group can arrive separately; names optional.
- **Complimentary tickets** issued by the client (cast families, press, sponsors), never counted as income.
- Order limits per buyer to stop bulk buying for resale.

### 6.20 Media page (registration and sales page)

- **Poster or banner** at the top, with a crop tool for phone and desktop.
- **Logo**, plus a **photo gallery** (cast, rehearsals, past productions) with captions.
- **Synopsis**, **cast and crew list** (name, role, optional photo), running time, age guidance and content notes.
- **Trailer:** a video link (YouTube or Vimeo embed) or an uploaded short clip.
- **Sound:** an audio player for a theme song or teaser. **Browsers block sound that plays by itself**, so it always starts with a tap. Uploads limited to MP3 or M4A and a set size; files stored in R2 and streamed.
- Images are resized and compressed on upload, with metadata stripped. Each image needs a short description for screen readers.
- Social sharing preview (title, image, description) so links look good on WhatsApp, Instagram and X.

### 6.21 Branded tickets and digital programme (shows)

- **Ticket designs** built from the show's artwork: the poster as a background or header, logo, colours, show title, performance date and time, section, row and seat, tier, holder name, QR code and venue directions.
- Delivered as an email, a PDF and an "Add to phone" page; optionally Apple Wallet and Google Wallet passes in a later phase.
- **Sound and video on tickets:** email apps and PDFs cannot play sound. Put a **"Listen" or "Watch the trailer" button in the email** and a **second QR code on the PDF** that opens the show's media page. Do not promise sound inside a ticket.
- **Digital programme:** a phone-friendly page and printable PDF with cast and crew, scenes or acts, director's note, sponsors, thank-yous and photos. Sent before the show or after, and linked from every ticket.
- Reminder email before each performance with time, venue map link, parking notes and the ticket again.

### 6.22 Show night screen and door

- The stage display (6.11) gains a **show mode**: doors-open countdown, "Please take your seats", interval countdown with sponsor logos and a closing thank-you slide. No judging or winner screens.
- **Door check-in** by performance: scan QR, show section, row and seat, warn on the wrong performance date and handle door sales when online payment is on.
- After the show: feedback request (with the programme and photos link) and the master report split by performance.

---

## 7. Email without abuse: credits

The owner's concern: if Sutura pays for sending, someone will abuse it. The answer is **email credits** plus hard limits.

### How it works

- **One credit = one email to one person.** Every plan includes a set number of credits, sized to the attendee band. Rule of thumb from the original event: about **8 to 12 emails per attendee** over an event (confirmation, ticket, reminders, team announcement, virtual link, certificate, feedback reminder), plus staff emails.
- **Top-up packs** bought through Paystack (for example 1,000 or 5,000 credits). Credits never go negative: when they run out, sending pauses with a clear "Buy more credits" button.
- **Price credits above cost.** Resend Pro is listed at $20 a month for 50,000 emails, with extra emails at $0.90 per 1,000; Scale is $90 a month for 100,000 ([Resend pricing](https://resend.com/pricing)). Set the credit price at several times the per-email cost so sending never eats into profit, and review it when the exchange rate moves.

### Limits that stop abuse

- **Only send to people inside the event:** registrants, ticket holders, staff and sponsors. No pasting or uploading arbitrary mailing lists, so the platform cannot be used for spam campaigns.
- **Daily cap per client** (for example a share of their credits per day) and a lower cap for new accounts until their first event completes.
- **No free sending before payment.** A trial can preview emails but not send them.
- **Bounce and complaint watch:** Resend reports bounces and spam complaints by webhook. If a client's rate passes a threshold, pause their sending and alert the super admin.
- **Unsubscribe** link on non-essential emails (reminders, marketing), honoured automatically.
- Every email logged with client, event, kind, recipient, result and credit used.

### Who the email comes from

- **Default (no setup):** sent from Sutura's verified domain, for example `"<Event name>" <events@mail.suturaworks.com>`, with **Reply-To set to the client's own email**. Clients do nothing.
- **Optional, own domain (no Resend account needed):** the client types their domain; the platform adds it to **Sutura's** Resend account through the API and shows the client the DNS records with copy buttons and screenshots for common domain providers. The app checks verification and switches to their address when ready. The client never sees Resend or a key.
- Do not ask clients to create their own Resend accounts. It is the most likely point where non-technical users give up.

---

## 8. WhatsApp

- **Phase 1, no setup:** "Send on WhatsApp" buttons that open WhatsApp with the message already written (a `wa.me` click-to-chat link with the text filled in). The organiser taps send. Good for ticket links, reminders and small groups. Costs nothing.
- **Later phase, optional add-on:** automatic WhatsApp sending through Meta's WhatsApp Business Platform with **Embedded Signup**, a "Connect WhatsApp" button where the client logs in with Facebook in a popup and picks their business number. No keys for the client. For Sutura this needs Meta business verification and approval as a provider, which can take weeks; messages use pre-approved templates and Meta charges per conversation or message. Charge it as an add-on with its own credits. Confirm Meta's current requirements and prices before building.

---

## 9. Theme and customisation

- Logo (with automatic white version), primary and accent colours with a contrast check, a few curated font pairings, light or dark header band.
- Event wording everywhere comes from settings: event name, short name, tagline, purpose, contact email, privacy line, organiser name for certificates and emails.
- Configurable lists: ticket types, sponsor levels, table names, criteria, phases, agenda, staff role names.
- Preview every attendee-facing page and email before going live.
- **Never use generic default template looks.** Each client's pages should look like their brand.

---

## 10. Technical architecture

The original system ran on Cloudflare and worked well. Keep the same family, sized for many clients:

- **Cloudflare Workers** for the API and admin pages. Use the **paid Workers plan** (the free plan's few milliseconds of CPU forced PDF work into the browser).
- **D1** (SQLite) for data, **KV** for settings and small blobs, **R2** for files (proofs, logos, signatures, certificate PDFs). Proofs in R2 with private access only.
- **Cron trigger** every minute for queued emails, scheduled announcements and push notifications.
- **Queues** for sending emails and generating PDFs in batches, so nothing depends on an open browser tab.
- **Resend** for email (Sutura's account), **Paystack** for Sutura's payments.
- Static client pages served from the Sutura Works site, or from the Worker with the client's theme injected.
- Plain JavaScript modules were enough; a small framework is fine if it stays light. Keep pure logic (placement, scoring, tie-breaks, greeting names, award rules) in pure functions with unit tests.

---

## 11. Data, security and privacy

- **Every table has `org_id` and `event_id`.** All queries filter by them through one helper, never by hand. Add tests that one organisation cannot read another's rows.
- Personal links are long random tokens, revocable and reissuable. No passwords for attendees or staff.
- Admin sessions: signed cookies, short-lived magic links, role checks on every route (deny by default).
- **Secrets never leave:** API keys and tokens are never sent to the browser, never logged, never exported. Store any client-provided secret encrypted.
- Uploads: check real file type, size caps, strip image metadata.
- Read-only views pass every response through a redaction step.
- Audit log for money, verification, score unlocks, certificate changes and deletions.
- Backups: export before any bulk change; automated daily backups.
- **Nigeria Data Protection Act (NDPA 2023):** state what is collected and why, keep data only as long as needed, allow export and deletion on request and get consent for marketing emails (the "wants event emails" answer counts as consent; record when it was given).

---

## 12. Lessons from running the original event

1. **Email allowance is the first thing to run out.** Show remaining credits everywhere sending happens, queue the rest and let the admin cancel queued emails.
2. **Batch jobs must run on the server.** A batch run from a phone stopped when the screen locked.
3. **One missing email must never stop a batch.** Skip and report.
4. **Decisions change late** (who gets which certificate, winner reveal style, which names show on screens). Make them settings.
5. **Greet with titles.** "Dear Dr." looks careless; "Dear Dr. Ada" does not.
6. **Check-in can lose connection.** Offline queueing on the desk device.
7. **Sponsors who have not paid** should have their seats work on the day but hold certificates and reports until payment.
8. **Logos come in every format.** Automatic white versions and background removal save hours; hide names without logos.
9. **Signatures arrive with white backgrounds.** Offer automatic background removal on upload.
10. **Feedback before certificate** worked; make the email clear that the download comes after the form.
11. **Late arrivals and walk-ins** (unregistered guests, complimentary places) need a quick "add and check in" path with optional email.
12. **Preview everything** (emails, certificates, stage screens) before it goes to people.

---

## 13. Build phases

1. **Foundation:** accounts and organisations, roles, events, theme settings, Sutura super admin with pricing screen, Paystack checkout, webhook and receipts, email credits and the sending queue.
2. **Workshop Basic:** registration form builder, ticket types, transfer proofs and verification, tickets with QR, check-in with offline mode, certificates gated by feedback, feedback screen, master report.
3. **Workshop Plus:** seating with table shapes and floor plan, badges and stickers, sponsors and logo wall, team rooms with push, invoices, money ledger, WhatsApp click-to-send, own-domain email.
4. **Show Basic:** Paystack subaccounts and online payment with signed webhooks, performances, tiers, promo codes, group bookings, media page with gallery, trailer and audio player, branded tickets, door check-in by performance.
5. **Show Plus:** theatre layout builder and seat map with holds, digital programme, show mode on the stage display.
6. **Bootcamp with Challenge:** staff roles, briefs, task packs, judging and scoring, stage display and winner reveal, achievement rules.
7. **Later:** subscriptions polish, wallet passes, WhatsApp automatic sending through Embedded Signup.

If the drama client needs to go live before phase 4 is finished, build the minimum show set first: performances, tiers, online payment, media page and branded tickets, with general admission instead of a seat map.

Each phase ships with unit tests for pure logic, an end-to-end test on a seeded demo organisation and a phone-width check of every attendee page.

---

## 14. Decisions still open (ask the owner)

1. Product name and where it lives (a subdomain such as `events.suturaworks.com`, or a path on the main site).
2. Prices: per-event bundles, attendee bands, subscription tiers, module prices, credit packs and the daily cap.
3. Whether clients get a free trial (preview only, no sending) and how long.
4. Data retention period after an event, and what happens to an archived event's links.
5. Whether Sutura's name appears on clients' pages ("Powered by Sutura Works") and whether paid plans can remove it.
6. Refund policy for cancelled events and unused credits.
7. Which font pairings and colour limits to offer in the theme picker.
8. Whether the own-domain email option is included in a bundle or charged separately.
9. Support channel for clients (email, WhatsApp, help pages) and response times.
10. Online payment through Paystack subaccounts: shows only, or offered to every use case?
11. Sutura's cut of online ticket sales (percentage, flat fee per ticket, or both) and who pays the Paystack fee by default.
12. Refund rules for show tickets, and whether the client or Sutura decides them.
13. Limits on media uploads (number of photos, audio and video sizes) per plan.

---

## 15. Notes for the new session

- Start in a **new repository or a new folder**, not inside the original event's code, and seed only demo data.
- The original code (`qlv-worker/` and `qlv2026/` in the Sutura Works site repository) can be read for patterns, such as the placement rule, web push without a library, image metadata stripping, the feedback gate, the Excel report builder and the certificate PDF drawing. **Copy patterns, not data, names or branding.**
- Follow the owner's writing preferences in all product copy: plain, human wording; no em or en dashes; no Oxford commas.
