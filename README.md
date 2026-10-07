# suturaworks-site

Website for Sutura Works Limited.

## Files

- `index.html`: the homepage
- `styles.css`: all styling and brand colours (tokens at the top)
- `thanks.html`: shown after someone sends the enquiry form
- `assets/`: logo mark, full logo and favicon (SVG)
- `guides/`: one Markdown file per how-to guide
- `templates/`: page layouts used for the guides
- `build.py`: turns everything into the finished site in `_site/`

## Posting a new guide

1. Write the guide as a `.md` file with the same header block as the existing ones:
   `title`, `description`, `slug` and `last_updated` are required. `meta_description`,
   `jurisdiction`, `review_cadence`, `reading_time`, `keywords` and `disclaimer` are optional.
2. Upload it to the `guides/` folder on GitHub (Add file > Upload files) and commit it to `main`.
3. Within a couple of minutes the guide has its own page at `suturaworks.com/guides/<slug>/`,
   appears on the Guides page and shows on the homepage if it is one of the three newest.

To update a guide, edit its file and change `last_updated`. If something in the header is
missing, the build stops and the Actions tab on GitHub shows which file and field to fix.
The live site stays as it was until the problem is fixed.

Inside a guide you can use these boxes:

```
::: attention
Text that needs the reader's attention.
:::

::: insider
A tip from experience.
:::

::: critical
Something that will cause real problems if ignored.
:::
```

A line on its own like `[Button: Book a consultation]` becomes a button to the enquiry form.
Guides without one get a standard "Talk to Sutura Works" box at the end.

To preview locally: `pip install -r requirements.txt`, then `python build.py`, then open `_site/index.html`.

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

1. In GitHub, go to Settings > Pages and set the source to "GitHub Actions". The workflow in `.github/workflows/site.yml` then builds and publishes the site every time `main` changes.
2. In Zoho's DNS settings for suturaworks.com, add four `A` records for `@`:
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   Add a `CNAME` record for `www` pointing to `hadeezahmusa.github.io`.
   Do not touch the `MX`, `TXT` or other mail records Zoho created, or email will stop working.
3. Back in Settings > Pages, enter `suturaworks.com` as the custom domain and tick "Enforce HTTPS" once it becomes available.
