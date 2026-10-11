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

Points Hadeezah should confirm before launch: the 12 month retention period for contact
details, the 18 or older condition and the "15 to 25 minutes" time estimate.

## Deploying the Worker (needs Cloudflare access)

The session needs these in its environment:

- `CLOUDFLARE_API_TOKEN` (secret): custom token with **Account / Workers Scripts / Edit**,
  **Account / D1 / Edit** and **Account / Account Settings / Read**, limited to her account.
- `CLOUDFLARE_ACCOUNT_ID`
- Network access to `api.cloudflare.com`.

Then:

```sh
cd worker
npm ci
export WRANGLER_SEND_METRICS=false
npx wrangler whoami                                   # confirms the token works
npx wrangler d1 create sutura-research --location=weur   # Western Europe is the closest location to Nigeria
# copy the database_id it prints into wrangler.toml
npx wrangler d1 execute sutura-research --remote --file=schema.sql
npx wrangler deploy                                   # prints https://sutura-research.<subdomain>.workers.dev
```

After deploying:

1. Put `https://sutura-research.<subdomain>.workers.dev/api/submit` into `research/config.js`.
2. **Export key.** Hadeezah adds a secret named `EXPORT_KEY` herself in the Cloudflare dashboard
   (Workers & Pages > sutura-research > Settings > Variables and Secrets > Add, type Secret),
   using a long random value she keeps private. Her download links are then:
   - `https://sutura-research.<subdomain>.workers.dev/api/export/responses.csv?key=<EXPORT_KEY>`
   - `https://sutura-research.<subdomain>.workers.dev/api/export/contacts.csv?key=<EXPORT_KEY>`
   Do not generate or display the key in chat.
3. Test from the live page: submit one response, download both CSVs, then delete the test rows:
   `npx wrangler d1 execute sutura-research --remote --command "DELETE FROM contacts WHERE ref='SW-...'; DELETE FROM responses WHERE ref='SW-...'"`.
4. Build, commit, open a pull request and merge to publish.

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
