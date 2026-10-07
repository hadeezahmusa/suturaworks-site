"""Build the Sutura Works site into _site/.

Static files (index.html, styles.css, assets/ ...) are copied as they are.
Every Markdown file in guides/ becomes a page at guides/<slug>/, and the
guides list plus the homepage "Guides" section are generated from them.

Run locally with:  python build.py
"""

import datetime as dt
import html
import re
import shutil
import sys
from pathlib import Path
from string import Template

import markdown
import yaml

ROOT = Path(__file__).parent
OUT = ROOT / "_site"
GUIDES_DIR = ROOT / "guides"
TEMPLATES = ROOT / "templates"
SITE_URL = "https://suturaworks.com"
CALENDLY = "https://calendly.com/hadeezahmusa/free-20-minute-consultation"
STATIC = ["index.html", "thanks.html", "styles.css", "assets", "CNAME"]
HOME_GUIDE_COUNT = 3
REQUIRED = ["title", "description", "slug", "last_updated"]

CALLOUT_RE = re.compile(r"^:::\s*(\w+)\s*\n(.*?)\n:::\s*$", re.S | re.M)
BUTTON_RE = re.compile(r"^\[Button:\s*(.+?)\]\s*$", re.M)
DEFAULT_DISCLAIMER = (
    "This guide is general information, correct as of the date shown. "
    "Requirements change, so confirm with the relevant regulator before you act. "
    "It is not a substitute for legal, tax or regulatory advice."
)


def tpl(name):
    return Template((TEMPLATES / name).read_text(encoding="utf-8"))


def esc(value):
    return html.escape(str(value), quote=True)


def nice_date(d):
    return f"{d.day} {d:%B %Y}"


def read_guide(path):
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        sys.exit(f"{path.name}: missing the --- header block at the top")
    _, front, body = text.split("---", 2)
    meta = yaml.safe_load(front) or {}
    missing = [k for k in REQUIRED if not meta.get(k)]
    if missing:
        sys.exit(f"{path.name}: header is missing {', '.join(missing)}")
    if not re.fullmatch(r"[a-z0-9-]+", str(meta["slug"])):
        sys.exit(f"{path.name}: slug may only use lowercase letters, numbers and hyphens")
    if isinstance(meta["last_updated"], str):
        meta["last_updated"] = dt.date.fromisoformat(meta["last_updated"])
    meta["body"] = body
    meta["source"] = path.name
    return meta


def render_body(body, root):
    lines = body.strip().splitlines()
    # The page header already shows the title, so drop a repeated H1
    # (and a subtitle heading straight after it).
    if lines and lines[0].startswith("# "):
        lines = lines[1:]
        while lines and not lines[0].strip():
            lines = lines[1:]
        if lines and re.match(r"#{2,3} ", lines[0]):
            lines = lines[1:]
    body = "\n".join(lines)

    body = CALLOUT_RE.sub(
        lambda m: f'<div class="callout callout-{m.group(1).lower()}" markdown="1">\n\n{m.group(2).strip()}\n\n</div>',
        body,
    )
    has_button = bool(BUTTON_RE.search(body))
    body = BUTTON_RE.sub(
        lambda m: f'<p class="guide-btn"><a class="btn btn-primary" href="{CALENDLY}" target="_blank" rel="noopener">{esc(m.group(1))}</a></p>',
        body,
    )

    md = markdown.Markdown(
        extensions=["toc", "tables", "sane_lists", "md_in_html", "nl2br"],
        extension_configs={"toc": {"toc_depth": "2"}},
    )
    out = md.convert(body)
    out = re.sub(r'<a href="(https?://[^"]+)"', r'<a href="\1" target="_blank" rel="noopener"', out)
    toc = [(t["id"], t["name"]) for t in md.toc_tokens]
    return out, toc, has_button


def chrome(root):
    return {
        "root": root,
        "header": tpl("header.html").substitute(root=root),
        "footer": tpl("footer.html").substitute(root=root),
    }


def guide_card(g, href):
    meta = [esc(g.get("jurisdiction", "")), f'{g["reading_time"]} min read' if g.get("reading_time") else ""]
    meta = " &middot; ".join(m for m in meta if m)
    return (
        f'<li class="guide-card"><a href="{href}">'
        f'<p class="label">{meta}</p>'
        f'<h3>{esc(g["title"])}</h3>'
        f'<p>{esc(g["description"])}</p>'
        f'<p class="card-foot">Updated {nice_date(g["last_updated"])}</p>'
        f"</a></li>"
    )


def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for name in STATIC:
        src = ROOT / name
        if src.is_dir():
            shutil.copytree(src, OUT / name)
        elif src.exists():
            shutil.copy2(src, OUT / name)

    guides = [read_guide(p) for p in sorted(GUIDES_DIR.glob("*.md"))]
    slugs = [g["slug"] for g in guides]
    dupes = {s for s in slugs if slugs.count(s) > 1}
    if dupes:
        sys.exit(f"Two guides share the slug {', '.join(dupes)}")
    guides.sort(key=lambda g: (g["last_updated"], g["title"]), reverse=True)

    # One page per guide
    page = tpl("guide.html")
    for g in guides:
        root = "../../"
        body, toc, has_button = render_body(g["body"], root)
        toc_html = "".join(f'<li><a href="#{i}">{esc(n)}</a></li>' for i, n in toc)
        rows = [("Jurisdiction", g.get("jurisdiction")),
                ("Last updated", nice_date(g["last_updated"])),
                ("Review cycle", str(g.get("review_cadence", "")).capitalize()),
                ("Reading time", f'{g["reading_time"]} minutes' if g.get("reading_time") else None)]
        control = "".join(f"<div><dt>{k}</dt><dd>{esc(v)}</dd></div>" for k, v in rows if v)
        cta = "" if has_button else tpl("guide-cta.html").substitute(root=root)
        dest = OUT / "guides" / g["slug"]
        dest.mkdir(parents=True)
        (dest / "index.html").write_text(page.substitute(
            **chrome(root),
            title=esc(g["title"]),
            description=esc(g["description"]),
            meta_description=esc(g.get("meta_description") or g["description"]),
            keywords=esc(", ".join(g.get("keywords") or [])),
            canonical=f'{SITE_URL}/guides/{g["slug"]}/',
            control=control,
            toc=toc_html,
            body=body,
            cta=cta,
            disclaimer=esc(g.get("disclaimer") or DEFAULT_DISCLAIMER),
            iso_date=g["last_updated"].isoformat(),
        ), encoding="utf-8")

    # Guides list page
    cards = "".join(guide_card(g, f'{g["slug"]}/index.html') for g in guides)
    (OUT / "guides" / "index.html").parent.mkdir(exist_ok=True)
    (OUT / "guides" / "index.html").write_text(tpl("guides-index.html").substitute(
        **chrome("../"), cards=cards or '<li class="empty">New guides are on the way.</li>',
    ), encoding="utf-8")

    # Homepage section
    home = (OUT / "index.html").read_text(encoding="utf-8")
    latest = "".join(guide_card(g, f'guides/{g["slug"]}/index.html') for g in guides[:HOME_GUIDE_COUNT])
    if "<!--GUIDES-->" not in home:
        sys.exit("index.html is missing the <!--GUIDES--> marker")
    (OUT / "index.html").write_text(home.replace("<!--GUIDES-->", latest), encoding="utf-8")

    # Sitemap so search engines find each guide
    urls = [f"{SITE_URL}/", f"{SITE_URL}/guides/"] + [f'{SITE_URL}/guides/{g["slug"]}/' for g in guides]
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls)
        + "</urlset>\n", encoding="utf-8")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}/sitemap.xml\n", encoding="utf-8")

    print(f"Built {len(guides)} guide(s) into {OUT.name}/")


if __name__ == "__main__":
    build()
