# Website UX Brief: Consulting Firm

A design brief for a small professional consulting firm's website. It describes structure, layout,
colour, type and behaviour only. All copy is placeholder. Use the bracketed labels (for example
`[Headline]`) as text placeholders and do not invent business details.

Design target: desktop frame 1440px wide, plus tablet (768px) and phone (390px) frames.

---

## 1. Site map

| # | Page | Path | Status | In main menu |
|---|---|---|---|---|
| 1 | Home | `/` | Live | Logo link |
| 2 | Guides index | `/guides/` | Live | Yes |
| 3 | Guide article (template) | `/guides/[slug]/` | Live | No |
| 4 | Enquiry received | `/thanks` | Live | No |
| 5 | Research survey (multi-step form) | `/research/` | Built, unlisted | No |
| 6 | Team | `/team/` or a Home section | Planned | Yes |
| 7 | Our work (sector case studies, tabbed) | `/work/` | Planned | Yes |

Main menu, in order: Services, Method, Principles, Guides, Contact.
"Services", "Method", "Principles" and "Contact" are anchor links to Home sections.
When Team and Our work exist, add them to the menu.

Primary action site-wide: **book a free consultation call** (opens an external booking page).
Secondary action: **send an enquiry** (the contact form on Home).

---

## 2. Colour palette

Dark-first site. Most sections sit on a deep green-black, with one sage band and pale cards for
emphasis.

| Token | Hex | Role |
|---|---|---|
| `forest` | `#0F1E1A` | Page background |
| `panel` | `#13251F` | Raised panels and alternate dark bands |
| `line` | `#2A3D37` | Hairlines and borders on dark |
| `line-strong` | `#3E5A51` | Stronger dividers; secondary text on light |
| `sage` | `#7CA67F` | Eyebrows, numbers, accents; full-width principles band |
| `sage-deep` | `#608F6F` | Sage used on light grounds (focus rings) |
| `pale` | `#D3DECF` | Primary button fill; light cards (contact, form, callouts) |
| `ink` | `#12241F` | Text on pale and sage |
| `logo-ink` | `#152B30` | The dark logo mark; hover on ink buttons |
| `mist` | `#EEF2EC` | Headings on dark |
| `muted` | `#A3B3A9` | Body text on dark |
| `error` | `#8A1F11` | Form errors (on pale only) |

Rules:
- Body text on dark is `muted`; headings on dark are `mist`.
- `sage` on `forest` is for eyebrows, labels and large numbers only, never body text.
- On `pale` and `sage` grounds all text is `ink` or `line-strong`.

---

## 3. Typography

System fonts only, no web fonts.

| Use | Family |
|---|---|
| Headings, eyebrows, labels, navigation, buttons | Verdana, Geneva, sans-serif |
| Paragraphs and long-form reading | Georgia, "Times New Roman", serif |

| Element | Size at 1440px | Weight | Line height | Notes |
|---|---|---|---|---|
| Hero headline | 88px | Bold | 1.05 | Scales down to about 44px on phone |
| Section headline | 64px | Bold | 1.1 | Max width about 24 characters; about 34px on phone |
| Smaller section headline | 46px | Bold | 1.1 | Used in About and Guides sections |
| Card / step heading | 28 to 32px | Bold | 1.2 | |
| Lead paragraph | 21px | Regular | 1.5 | Max width about 640px |
| Body | 17px | Regular | 1.55 | Article body 18px / 1.65 |
| Eyebrow / label | 13px | Regular, uppercase | 1.4 | Letter spacing 0.12em, colour `sage` |
| Navigation | 15px | Regular | 1.4 | |

Writing style for any placeholder you add: plain, short sentences. No dashes as punctuation.

---

## 4. Layout grid and spacing

- Content width 1200px, centred.
- Side padding: 120px at 1440px, 48px on tablet, 20px on phone.
- Section vertical padding: 128px desktop, 88px phone.
- Sections on dark are separated by 1px `line` hairlines.
- Breakpoints: 640px, 760px, 900px, 1000px, 1080px.
- Square corners everywhere (border radius 0).

---

## 5. Brand mark

- A geometric monogram built from three separate interlocking shapes: an upper shape, a lower
  shape and a small accent shape in `sage` between them. Represent it as a placeholder until
  the real asset is supplied.
- Portrait proportion, about 0.8 wide to 1 tall. Never stretch it to square.
- Two versions: light (white) for dark grounds, dark (`logo-ink`) for light grounds.
- Header: mark about 42px wide plus the company name in bold Verdana 15px, `mist`.

---

## 6. Global components

### Header (all pages)
```
+--------------------------------------------------------------------------------+
| [Mark] [COMPANY NAME]                      [Nav 1] [Nav 2] [Nav 3] [Nav 4] [Nav 5] |
+--------------------------------------------------------------------------------+  1px line
```
- 96px tall on desktop, 72px on phone. Sticky at the top, background `forest`.
- Phone: hide Nav 1 to 3, keep Guides and Contact. Below 420px hide the company name.

### Footer (all pages)
```
+--------------------------------------------------------------------------------+  1px line
| [Mark]  [COMPANY NAME]                               [website link]  [email link] |
|         [Tagline, italic, sage]                                                   |
|         [Registration no. / Locations]                              (giant faint |
|                                                                       mark, 6%,  |
|                                                                       cropped)   |
+--------------------------------------------------------------------------------+
```
- A very large copy of the mark sits in the bottom right corner at about 6% opacity, partly
  cropped by the page edge.

### Buttons
| Variant | Fill | Text | Border | Height |
|---|---|---|---|---|
| Primary | `pale` | `ink`, bold | none | 64px |
| Secondary | `forest` | `mist` | 2px `line` (hover: `sage`) | 64px |
| Ink (on pale cards) | `ink` | `mist`, bold | none | 64px |
| Text link | none | `mist` | 1px `sage` underline, trailing arrow | |

All buttons have square corners and 30px side padding. Focus state: 2px `sage` outline.

### Eyebrow + headline + lead (section opener)
```
[EYEBROW]                    <- 13px uppercase sage
[Section headline]           <- 64px bold mist
[Lead paragraph]             <- 21px muted, max 640px
```

### Cards
- **Guide card:** 2px `line` border, `forest` fill, 32px padding. Contents top to bottom:
  `[LABEL]`, `[Card title]`, `[Short description]`, hairline, `[Date label]`. Hover: border `sage`.
- **Pale card:** `pale` fill, `ink` text, 80px padding desktop, 24px phone.

---

## 7. Page wireframes

### 7.1 Home

```
HEADER
================================================================================
HERO  (dark, two columns)
+----------------------------------------------+   +--------------------------+
| [EYEBROW]                                    |   |  PANEL 460 x 660         |
| [Hero headline, 2 to 3 lines]                |   |  bg panel, 2px line      |
|                                              |   |                          |
| [Lead paragraph]                             |   |   <> two outlined        |
|                                              |   |  <>  diamonds, offset    |
| [Primary button] [Secondary button]          |   |      [Mark, 150px]       |
|                                              |   |                          |
+----------------------------------------------+   | [CAPTION, sage, 13px]    |
                                                   +--------------------------+
================================================================================
SERVICES  (dark)
[EYEBROW]
[Section headline]
[Lead]
+-----------+ +-----------+ +-----------+ +-----------+   1px line-strong rule on top of each
|[01 / LABEL]| |[02 / LABEL]| |[03 / LABEL]| |[04 / LABEL]|
|[Heading]  | |[Heading]  | |[Heading]  | |[Heading]  |
|[Body x3]  | |[Body x3]  | |[Body x3]  | |[Body x3]  |
+-----------+ +-----------+ +-----------+ +-----------+
--------------------------------------------------------------- 1px line
[ALSO / LABEL]          [One extra service line, body text]
================================================================================
METHOD  (panel band)
[EYEBROW]
[Section headline]
[Lead]
   <01>  -----------------  <02>  -----------------  <03>
 [Step heading]          [Step heading]          [Step heading]
 [Body x3]               [Body x3]               [Body x3]
  (diamonds 140px, 2px sage outline, number centred bold sage 26px;
   short line-strong connectors between them)
================================================================================
PRINCIPLES  (full-width sage band, all text ink)
[EYEBROW]
[Section headline]
------------------------------------------------------------------- 1px ink
[01]     [Principle heading]             [One sentence]
------------------------------------------------------------------- 1px ink
[02]     [Principle heading]             [One sentence]
------------------------------------------------------------------- 1px ink
[03]     [Principle heading]             [One sentence]
================================================================================
ABOUT  (dark, two columns)
+-------------------------------------+   +--------------------------------+
| [EYEBROW]                           |   | [LABEL]                        |
| [Smaller section headline]          |   | <> [Outcome 1]                 |
| [Paragraph]                         |   | <> [Outcome 2]   (6 rows,      |
| [Paragraph]                         |   | <> ...            hairlines)   |
| [Paragraph]                         |   | [LABEL]                        |
|                                     |   | [Chip] [Chip] [Chip]           |
+-------------------------------------+   +--------------------------------+
================================================================================
GUIDES  (panel band)
[EYEBROW]                                                  [All guides ->]
[Smaller section headline]
+------------------+ +------------------+ +------------------+
| Guide card       | | Guide card       | | Guide card       |   (newest 3)
+------------------+ +------------------+ +------------------+
================================================================================
CONTACT  (dark page, pale card 1200px)
+------------------------------------------------------------------------------+
| [EYEBROW, line-strong]                                                       |
| [Section headline, ink]                                                      |
| [Lead, line-strong]                                                          |
|                                                                              |
| [Label]                            [Label]                                   |
| ______________________________     ______________________________  (2px ink  |
|                                                                     underline)|
| [Label]                                                                      |
| +--------------------------------------------------------------------------+ |
| |  textarea 220px tall, 2px ink border                                     | |
| +--------------------------------------------------------------------------+ |
| [Ink button]   [Text link ->]                                                |
+------------------------------------------------------------------------------+
================================================================================
FOOTER
```

Hero animation (on load, once, about 2 seconds): the two diamonds fade in, then the three parts
of the mark rise into place one after another from about 60% of their height below: lower
shape, upper shape, then the accent. Skip the animation when the visitor prefers reduced motion.

Responsive:
- Tablet: hero panel moves under the text and shrinks to about 360px wide. Services go to 2 columns.
- Phone: everything stacks to 1 column. Method diamonds stack vertically and connectors disappear.
  The three parts of each principle row stack.

### 7.2 Guides index

```
HEADER
================================================================================
[EYEBROW]
[Section headline]
[Lead]
+------------------+ +------------------+ +------------------+
| Guide card       | | Guide card       | | Guide card       |
+------------------+ +------------------+ +------------------+
+------------------+ +------------------+
| Guide card       | | Guide card       |        (auto-fill grid, min 340px)
+------------------+ +------------------+
================================================================================
FOOTER
```

### 7.3 Guide article (template)

```
HEADER
================================================================================
ARTICLE HERO (dark, two columns)
+---------------------------------------------+   +------------------------------+
| [GUIDES / BREADCRUMB]                       |   | [CONTROL BOX]   [STATUS TAG] |
| [Article title, 60px, 2 lines]              |   |------------------------------|
| [Lead paragraph]                            |   | [Label]   | [Value]          |
|                                             |   | [Label]   | [Value]          |
|                                             |   | [Label]   | [Value]          |
+---------------------------------------------+   | [Label]   | [Value]          |
                                                  +------------------------------+
================================================================================
BODY (two columns)
+--------------------+   +---------------------------------------------------+
| [CONTENTS]         |   | [Intro paragraph, larger, mist]                   |
| [1. Section link]  |   | [Paragraph]                                       |
| [2. Section link]  |   | ------------------------------------------------- |
| [3. Section link]  |   | [Numbered section heading]                        |
|  ...               |   | [Paragraph]                                       |
| (sticky on desktop,|   | +-----------------------------------------------+ |
|  left border line) |   | | [ATTENTION tag]  callout, panel fill, sage    | |
|                    |   | | [Callout text]   border                       | |
|                    |   | +-----------------------------------------------+ |
|                    |   | +- - - - - - - - - - - - - - - - - - - - - - - -+ |
|                    |   | | [INSIDER NOTE tag]  dashed border, no fill    | |
|                    |   | +- - - - - - - - - - - - - - - - - - - - - - - -+ |
|                    |   | +-----------------------------------------------+ |
|                    |   | | [CRITICAL tag]  pale fill, ink text           | |
|                    |   | +-----------------------------------------------+ |
|                    |   | [Bulleted list, sage markers]                     |
|                    |   | ...                                               |
|                    |   | +-----------------------------------------------+ |
|                    |   | | CTA card, pale: [Eyebrow] [Heading] [Button]  | |
|                    |   | +-----------------------------------------------+ |
|                    |   | [PLEASE NOTE] [Disclaimer, small]                 |
+--------------------+   +---------------------------------------------------+
================================================================================
FOOTER
```
- Contents column 260px; article max width about 70 characters.
- Phone: contents becomes a bordered box above the article.

### 7.4 Enquiry received

```
HEADER (logo only, no nav)
================================================================================
[EYEBROW]
[Section headline]
[Lead]
[Primary button]  [Secondary button]
================================================================================
```

### 7.5 Research survey (multi-step form, unlisted)

```
HEADER (logo only) + 3px progress bar under it (line track, sage fill)
================================================================================
INTRO (dark, two columns)
+---------------------------------------------+   +------------------------------+
| [EYEBROW]                                   |   | [PRIVACY NOTICE]             |
| [Title, 56px, 3 lines]                      |   | [Term]                       |
| [Lead]                                      |   | [Definition]                 |
| [Paragraph]                                 |   |   (6 term/definition pairs)  |
| <> [Fact]                                   |   |                              |
| <> [Fact]                                   |   |                              |
| <> [Fact]                                   |   |                              |
| | [Warning note, sage left rule]            |   |                              |
+---------------------------------------------+   +------------------------------+
================================================================================
FORM CARD (pale, max 880px, centred)
+------------------------------------------------------------------------------+
| [STEP X OF Y]                                                                |
| [Step title]                                                                 |
|                                                                              |
| [Question label, bold]  [REQUIRED tag]                                       |
| [Help text]                                                                  |
| +--------------------------------------------------------------------------+ |
| | ( ) [Option]                                    single choice: radio     | |
| +--------------------------------------------------------------------------+ |
| | ( ) [Option]                                                             | |
| +--------------------------------------------------------------------------+ |
| [Please specify ___________]   <- appears only when "Other" is chosen        |
|                                                                              |
| [Question label]  [OPTIONAL tag]                                             |
| +--------------------------------------------------------------------------+ |
| | textarea, 2px ink border                                                 | |
| +--------------------------------------------------------------------------+ |
| [Error message, red]   <- shown on a required question left blank            |
|                                                                              |
| ---------------------------------------------------------------------------- |
| [Back, outlined]                                            [Next, ink fill] |
+------------------------------------------------------------------------------+
================================================================================
FOOTER
```
Steps: 1 consent (bordered box with a tick box), 2 role selection, 3 role-specific questions
(5 different branches), 4 closing questions, 5 optional contact details (2 tick boxes reveal
name, email and location fields). Then a confirmation state with a reference number.
Follow-up questions appear inline when a qualifying answer is chosen.
Choice rows: 1px border at 25% ink; selected row gets a solid ink border and a lighter fill.

### 7.6 Team (planned)

```
[EYEBROW]
[Section headline]
+--------------------------------------+   +--------------------------------------+
| +------------------+                 |   | +------------------+                 |
| | Headshot         |  [Name]         |   | | Headshot         |  [Name]         |
| | portrait 4:5     |  [ROLE, sage]   |   | | portrait 4:5     |  [ROLE, sage]   |
| |                  |  [Bio, 3 to 5   |   | |                  |  [Bio, 3 to 5   |
| +------------------+   lines]        |   | +------------------+   lines]        |
|                       [Credentials]  |   |                       [Credentials]  |
|                       [Profile link] |   |                       [Profile link] |
+--------------------------------------+   +--------------------------------------+
```
- Two people. Matching photo treatment (same crop and background tone).
- Phone: photo above text.

### 7.7 Our work (planned, tabbed by sector)

```
[EYEBROW]
[Section headline]
[Lead]
[ Sector A ] [ Sector B ] [ Sector C ]      <- tabs; active tab has sage underline
--------------------------------------------------------------------------------
+-----------------------------------+   +------------------------------------+
| [STARTING POINT]                  |   | [WHAT WE DID]                      |
| [Paragraph]                       |   | <> [Deliverable]                   |
|                                   |   | <> [Deliverable]                   |
| [WHAT CHANGED]                    |   | <> [Deliverable]                   |
| [Outcome] [Outcome] [Outcome]     |   | [TIMEFRAME] [Value]                |
|  (stat tiles, large sage numbers) |   |                                    |
+-----------------------------------+   +------------------------------------+
| [Quote, optional, Georgia italic]                                         |
+--------------------------------------------------------------------------+
```
- Each tab has its own URL fragment (for example `/work/#sector-a`) so sector chips on Home can
  link straight to it.
- Clients are always anonymous.

---

## 8. Interaction and accessibility

- Visible focus on every interactive element: 2px `sage` outline (on pale: `sage-deep`).
- Smooth scrolling for anchor links; disabled when the visitor prefers reduced motion.
- Every image has alt text; decorative marks are hidden from screen readers.
- Form errors appear under the field and the first invalid field scrolls into view.
- No horizontal scrolling at any width down to 360px.
- Minimum tap target 44px on phone.

---

## 9. Deliverables requested from the design tool

1. A colour and type style sheet built from sections 2 and 3.
2. Components from section 6 (header, footer, buttons, cards, form fields, callouts, tabs).
3. Desktop frames (1440px) for every page in section 7.
4. Phone frames (390px) for Home, Guide article and Research survey.
5. Placeholder text only. Do not write real copy, prices, names or claims.
