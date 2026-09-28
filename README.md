# suturaworks-site

Website for Sutura Works Limited. A single static page with no build step.

## Files

- `index.html`: the page
- `styles.css`: all styling and brand colours (tokens at the top)
- `thanks.html`: shown after someone sends the enquiry form
- `assets/`: logo mark, full logo and favicon (SVG)

## Brand

| Token | Hex | Use |
| --- | --- | --- |
| Ink | `#0D2620` | Text and dark sections |
| Paper | `#EDF0EA` | Page background |
| Lime | `#C8F03C` | Accent fills only, never as text on paper |
| Moss | `#1F4D3F` | Secondary green |

Fonts (Google Fonts): Familjen Grotesk for headings, Newsreader for body text, IBM Plex Mono for labels.

## Enquiry form

The form posts to [FormSubmit](https://formsubmit.co) and is delivered to info@suturaworks.com.
The first submission sends an activation email to that inbox. Click the link in it once, or
nothing will be forwarded.

## Going live on suturaworks.com

1. In GitHub, go to Settings > Pages. Set the source to "Deploy from a branch", choose `main` and `/ (root)`.
2. In Zoho's DNS settings for suturaworks.com, add four `A` records for `@`:
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   Add a `CNAME` record for `www` pointing to `hadeezahmusa.github.io`.
   Do not touch the `MX`, `TXT` or other mail records Zoho created, or email will stop working.
3. Back in Settings > Pages, enter `suturaworks.com` as the custom domain and tick "Enforce HTTPS" once it becomes available.
