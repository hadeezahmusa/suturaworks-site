# Research survey: setup and handover

The Nigerian Business Launch Navigator research survey lives at `research/` and is published
at `suturaworks.com/research/`. It is unlisted: `noindex`, not in the sitemap and not linked
from the menu. Responses go to a Cloudflare Worker (`worker/`) that stores them in a D1 database.

## How it fits together

| Part | File | What it does |
|---|---|---|
| Questions | `research/questions.js` | Every question, option and branching rule. Used by the page and the Worker. |
| Page | `research/index.html`, `survey.js`, `research.css` | Step-by-step form, saves progress on the respondent's device. |
| Endpoint address | `research/config.js` | The Worker URL the page posts to. |
| Worker | `worker/src/index.js` | Validates and stores submissions, serves the CSV downloads. |
| Database | `worker/schema.sql` | `responses` (answers, no names) and `contacts` (name, email, location), linked only by the reference `SW-XXXXXXXX`. |

Changes agreed with Hadeezah to the original questionnaire:

1. Business owners who have not registered skip the post-registration questions and answer
   "What steps have you taken so far" instead of "What did you actually have to do".
2. Wording that assumed the service would help now allows "if at all", and the benefits
   question has a "None of these, or I am not sure such a service would help" option.
3. Privacy notice and consent tick box (Nigeria Data Protection Act 2023).
4. Contact details stored apart from answers.
5. One contact step at the end: "send me the findings" and "open to an interview", then name,
   email and location.

Changes made after launch (October 2026, with 14 responses already in):

- The lawyer and "another professional role" options on the first question were reworded on
  screen only, through the `labels` map in `questions.js`. Stored values and the CSV still use
  the original wording, so old and new responses match.
- "How did you hear about this survey?" (optional) opens the closing section. It is stored with
  the answers and appears as the last two columns of `responses.csv` (`csvLast`).
- The thank you screen has a WhatsApp share button and a copy link button. Nothing is stored.
- Answers are JSON, so none of this needed a database migration.

Points Hadeezah should confirm before launch: the 12 month retention period for contact
details, the 18 or older condition and the "15 to 25 minutes" time estimate.

## Status on 19 October 2026

- Deployed: Worker `sutura-research` at `https://sutura-research.suturaworks.workers.dev`, D1
  database `sutura-research` with `schema.sql` applied, and `RESEND_API_KEY` set so each new
  response emails socials@suturaworks.com (reference and respondent type only).
- Still to do: Hadeezah adds `EXPORT_KEY` in the dashboard (step 2 below) to switch on the CSV downloads.
- It shares nothing with the QLV 2026 registration (`qlv2026/`, `qlv-worker/`): separate Worker,
  separate database.

## Status on 12 October 2026

- Survey page, questions, Worker code and database schema are built and tested locally
  (all four role paths, validation, separate contact table, spam and formula guards).
  Everything is on the branch `claude/github-integration-overview-9al5ao`, not yet on `main`.
- Cloudflare: the Sutura Works account exists (login info@suturaworks.com), workers.dev
  subdomain `suturaworks` is set, and a custom API token "Sutura research" exists with the
  three permissions below, limited to that account. Nothing is deployed yet: no database,
  no Worker.
- The environment is named **Sutura** and has `CLOUDFLARE_ACCOUNT_ID` set.
- **The network secret route did not work.** With the token stored as a network secret for
  `api.cloudflare.com`, every request (with or without our own Authorization header) got
  `6111 Invalid format for Authorization header`, including after the session reloaded.
  Recommended next step: delete the network secret, roll the token in Cloudflare, put it in
  the environment variables as `CLOUDFLARE_API_TOKEN`, set network access to Custom with
  `api.cloudflare.com` allowed, start a new session and follow the wrangler steps below.
  After the survey is live, roll the token again.
- A **Cloudflare Developer Platform connector** has since appeared in Claude. It can create
  and query D1 databases but has no tool to deploy a Worker, so wrangler (or the REST API)
  is still needed for `wrangler deploy`.

## Deploying the Worker (needs Cloudflare access)

Cloudflare account: a dedicated **Sutura Works** account (login info@suturaworks.com), separate from
Hadeezah's other projects. Its workers.dev subdomain is `suturaworks`, so the Worker lives at
`https://sutura-research.suturaworks.workers.dev`, which is already set in `research/config.js`.

How the token reaches the session (two possible setups):

- **Network secret (Pro and Max plans).** The token is stored as a network secret on the
  environment with allowed website `api.cloudflare.com`. The agent proxy adds
  `Authorization: Bearer <token>` to requests for that host, so the token is never visible in
  the session and `api.cloudflare.com` is reachable without an allowed-domains entry.
  `CLOUDFLARE_ACCOUNT_ID` is a plain environment variable. First check the proxy works:
  `curl -sS https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database`
  should return `"success": true`. Wrangler insists on a token variable, so try
  `CLOUDFLARE_API_TOKEN=placeholder npx wrangler whoami`. If the proxy does not override the
  placeholder header, skip wrangler for remote calls and use the REST API with curl instead:
  create the database with `POST /accounts/{id}/d1/database`, run `schema.sql` with
  `POST /accounts/{id}/d1/database/{db}/query`, bundle with
  `npx wrangler deploy --dry-run --outdir dist`, then upload `dist/index.js` with
  `PUT /accounts/{id}/workers/scripts/sutura-research` (multipart, `main_module` metadata with
  the D1 binding and the vars from wrangler.toml), and enable workers.dev with
  `POST /accounts/{id}/workers/scripts/sutura-research/subdomain` `{"enabled":true}`.
- **Environment variables (no Network secrets section).** `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` are environment variables and `api.cloudflare.com` is listed under
  Custom network access, allowed domains. Wrangler then works as below.

The token is a custom token with **Account / Workers Scripts / Edit**, **Account / D1 / Edit**
and **Account / Account Settings / Read**, limited to the Sutura Works account.

Then:

```sh
cd worker
npm ci
export WRANGLER_SEND_METRICS=false
npx wrangler whoami                                   # confirms the token works
npx wrangler d1 create sutura-research --location=weur   # Western Europe is the closest location to Nigeria
# copy the database_id it prints into wrangler.toml
npx wrangler d1 execute sutura-research --remote --file=schema.sql
npx wrangler deploy                                   # prints https://sutura-research.suturaworks.workers.dev
```

After deploying:

1. Confirm the deploy printed `https://sutura-research.suturaworks.workers.dev`, the address already in `research/config.js`.
2. **Export key.** Hadeezah adds a secret named `EXPORT_KEY` herself in the Cloudflare dashboard
   (Workers & Pages > sutura-research > Settings > Variables and Secrets > Add, type Secret),
   using a long random value she keeps private. Her download links are then:
   - `https://sutura-research.suturaworks.workers.dev/api/export/responses.csv?key=<EXPORT_KEY>`
   - `https://sutura-research.suturaworks.workers.dev/api/export/contacts.csv?key=<EXPORT_KEY>`
   Do not generate or display the key in chat.
3. Test from the live page: submit one response, download both CSVs, then delete the test rows:
   `npx wrangler d1 execute sutura-research --remote --command "DELETE FROM contacts WHERE ref='SW-...'; DELETE FROM responses WHERE ref='SW-...'"`.
4. Build, commit, open a pull request and merge to publish.

## Private dashboard

`suturaworks.com/research/dashboard/` shows live counts: responses per day, who responded,
how many left contact details, the 10 latest references and a breakdown of every
multiple-choice question. It also has buttons to download both CSVs.

- It asks for the `EXPORT_KEY`. The key is sent to the Worker in a header, so it never appears
  in a link or in browser history. "Remember on this device" keeps it in that browser only;
  "Lock" forgets it.
- The page itself holds no data. The Worker's `/api/stats` route returns counts only: no
  written answers, names or emails.
- Like the survey it is `noindex`, not in the sitemap and not linked from anywhere.

## Email notifications to socials@suturaworks.com (optional, later)

The Worker emails `NOTIFY_TO` through Resend when a `RESEND_API_KEY` secret exists. The email
contains only the reference and respondent type, never the answers.

1. Create a free account at resend.com and add the domain `suturaworks.com`.
2. Add the DNS records Resend shows in Zoho's Modify DNS Zone page. They are a TXT record on
   `resend._domainkey` and an MX and TXT on the `send` subdomain. They do not touch the
   existing Zoho Mail records (the three MX on the root, SPF and `zoho._domainkey`).
3. When Resend shows the domain as verified, create an API key and add it in the Cloudflare
   dashboard as a secret named `RESEND_API_KEY` on the `sutura-research` Worker.

## Handling a deletion request

Respondents quote their reference number. Delete both rows:

```sh
npx wrangler d1 execute sutura-research --remote --command "DELETE FROM contacts WHERE ref='SW-XXXXXXXX'; DELETE FROM responses WHERE ref='SW-XXXXXXXX'"
```

## Testing locally

```sh
cd worker && npm ci
npx wrangler d1 execute sutura-research --local --file=schema.sql
echo 'EXPORT_KEY=local-test-key' > .dev.vars
npx wrangler dev --var ALLOWED_ORIGINS:http://localhost:8000
# in another terminal: python build.py, point _site/research/config.js at http://localhost:8787/api/submit,
# then serve _site with: python -m http.server 8000 --directory _site
```
