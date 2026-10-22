// Role pack templates (QLV-2026-Role-Pack-Templates.md). These are the
// defaults: the chair edits any of them on the Briefings tab and the edited
// wording is kept in the templates table. Plain text with merge fields in
// double braces, a little Markdown (**bold**, *italic*, "- " lists, "|"
// tables) and, for the printed sheets, writing boxes:
//   [[box Heading]]            an empty box to write in
//   [[box Heading | numbered]] a box with numbered lines
//   [[box Heading | owners]]   a two-column table of step and owner
//   [[critique Heading]]       gap, question and strength rows

export const TEMPLATE_KEYS = [
  ["cover_email", "Covering email (all roles)"],
  ["facilitator_run_sheet", "Facilitator run sheet"],
  ["mentor_brief", "Mentor/Advisor brief"],
  ["mentor_route", "Mentor/Advisor route card"],
  ["judge_brief", "Judge brief"],
  ["criteria", "Scoring criteria"],
  ["task_card", "Task card (printed)"],
  ["plan_sheet", "Plan sheet (printed)"],
  ["critique_sheet", "Critique sheet (printed)"],
  ["response_sheet", "Response sheet (printed)"],
];

export const DEFAULT_TEMPLATES = {
  cover_email: `Subject: Your QLV 2026 {{role}} brief

Hello {{first_name}},

Thank you for joining QLV 2026 as a {{role}}.

Your brief is here: {{brief_link}}

It opens at {{unlock_time}}. Until then the link shows a holding page. That's deliberate: the sprint tasks stay sealed until the morning of the day, for everyone.

Please arrive at the Transcorp Hilton, Abuja by {{arrival_time}} on Saturday 7 November and collect your badge at the desk. Your reference is {{reference}}.

If anything changes on your side, call or message {{chair_name}} on {{chair_phone}}.

See you on Saturday,
The QLV 2026 team, JCI Aso`,

  facilitator_run_sheet: `**QLV 2026 run sheet · {{full_name}} · {{facilitator_type}} facilitator**
Tables you look after: {{tables_covered}}

**Your job in one line.** You run the process: the clock, the handovers and the room. You never help with the content and you never score.

**Friday 6 November, virtual** *(lead facilitator only. Suggested times, confirm with the chair.)*

| Time | What happens | Your cue |
|---|---|---|
| 3:45pm | Open the call, test sound and screen share | |
| 4:00pm | Welcome and why QLV 2026 | "Building systems that outlive you starts with how we work tomorrow." |
| 4:10pm | How the sprint works | Walk through plan, hand over, critique, respond, present. Say clearly that nobody sees the task until Saturday. |
| 4:25pm | Teams announced | Read out each table and its members. Post the list in the chat. |
| 4:40pm | Teams meet: in breakout rooms if the call allows them, otherwise in each team's group chat | Ten minutes to say hello. No tasks, no homework. |
| 4:55pm | Close | Arrival time on Saturday, what to bring (their reference). |

**Saturday 7 November, Transcorp Hilton, Abuja**

| Time | What happens | Your cue |
|---|---|---|
| 8:30 to 10:50 | Arrivals, tea and light snacks | Badge desk open. Send people to their table by the name on their badge. |
| [confirm] | Opening protocol and partner remarks, 3 minutes each | Lead facilitator introduces each speaker and keeps time. |
| 10:45 | Everyone seated | "Five minutes. Find your table." |
| 10:50 | **Sprint opens.** Task cards handed out to every table at the same moment | Lead: "Your task is on the table. You have fifty minutes. Your plan has to work without you in the room." Start the clock on the screen. |
| 11:15 | Halfway call | "Twenty-five minutes left. If you haven't named who owns each step, start now." |
| 11:35 | Five-minute call | "Five minutes. Finish your sentences, not your ideas." |
| 11:40 | **Plans locked and handed over** | Pens down. Floor facilitators carry each plan to the next table: {{handover_chain}} |
| 11:45 | **Critique opens**, 35 minutes | "You're reviewing another team's plan. Find the gaps. Use the critique sheet: gap, question, strength." |
| 12:20 | **Critiques returned.** Response opens, 15 minutes | Floor facilitators return each critique to the team that wrote the plan. "You have fifteen minutes to answer your critique on the response sheet." |
| 12:35 | **Lunch.** Collect every plan, critique and response | Floor facilitators bundle each table's three sheets and hand them to the judges' table. |
| 13:30 | **Presentations**, 10 minutes per team, 2 minutes changeover | Order: {{presentation_order}}. The timer turns amber at 2 minutes and red at zero. At zero, thank them and stop them. |
| 14:50 | **Panel feedback and recognitions** | Hand over to the judges' spokesperson. |
| [confirm] | Close and certificates | Lead: thanks to partners, mentors/advisors, judges and the committee. |
| 16:00 | End | |

**When things go wrong**
- **A table is short of people.** Up to two empty seats, carry on. More than that, tell the chair before 10:50 so the table can be merged.
- **Someone arrives after 10:50.** Seat them at their own table. Don't stop the clock.
- **A team finishes early.** Ask them to read their plan as if they were a stranger who has to run it tomorrow, then fix what's unclear.
- **A team asks you for an idea.** "That's a great question for your mentor." Then point to the mentor on the floor.
- **The screen or power fails.** The lead calls the times out loud. The sprint runs on paper anyway.`,

  mentor_brief: `**QLV 2026 · Mentor/Advisor brief · {{full_name}}**
Reference {{reference}}

**Your role in one line.** You help the teams think. You ask questions that sharpen their plan. You don't write it for them.

**Your tables:** {{route_table_1}} and {{route_table_2}}
You own these two tables for the whole sprint, moving between them every ten minutes.

**Your route**
{{route_rows}}

**What good looks like**
- Ask before you suggest. "Who owns that step?" does more than "you should assign an owner".
- Push them towards the test. Could someone outside this table run this plan tomorrow?
- Watch the quiet ones. If one person is writing everything, ask someone else to explain the plan back.
- Leave before you take over. Ten minutes, then move.

**What you don't do**
- You don't write any part of the plan.
- You don't visit tables outside your route. Every table gets equal time.
- You step back at 11:40. The critique has to come from the participants.

**Your day**

| Time | |
|---|---|
| {{arrival_time}} | Arrive and collect your badge |
| 10:50 to 11:40 | The sprint, on your route |
| 11:40 to 12:35 | Handover, critique and response. You're off the floor |
| 12:35 | Lunch at a mixed table |
| 13:30 | Presentations. You watch. If you're also judging, see your judge brief |
| 14:50 | Feedback and recognitions |

**The tasks**
{{tasks_block}}`,

  mentor_route: `**{{full_name}} · Route**

{{route_rows}}`,

  judge_brief: `**QLV 2026 · Judge brief · {{full_name}}**
Reference {{reference}}

**Your role in one line.** You assess what the teams produced and how they present it, against five criteria. Your scores and notes go into the QLV report and to the employers who sent people.

**Your scoring link:** {{scoring_link}}
It's yours alone. Open it on your phone. No login is needed. Please don't share it.

**Tables you don't score:** {{excluded_tables}}
You advised these during the sprint, so you sit them out to keep the judging independent. Your link won't show them.

**Your day**

| Time | |
|---|---|
| {{arrival_time}} | Arrive and collect your badge |
| 12:35 | Lunch. Each table's plan, critique and response reach you to read |
| 13:30 | Presentations, 10 minutes each. Score each team straight after it presents |
| 14:40 | All scores in. The tally is checked |
| 14:50 | The panel's spokesperson, {{spokesperson_name}}, gives the feedback |

**How to score.** Give each criterion a 1, 3 or 5, or a 2 or 4 when the team is in between. A score locks once you submit it. If you make a mistake, tell the lead facilitator and admin can unlock that one score.

**The criteria**
{{criteria_block}}

**How the result is worked out.** Each team's result is the average of its judges' totals, not the sum, because teams are scored by different numbers of judges. If two teams tie, the higher average on "Outlives the team" wins. If they are still tied, the judges decide together.

**The tasks**
{{tasks_block}}`,

  criteria: `**Problem understood**
- 1: Describes symptoms. The real problem is never named.
- 3: Names the problem, but the cause is assumed rather than reasoned through.
- 5: Names the root cause and shows why it's the root and not a symptom.

**A plan someone else could run**
- 1: Ideas, not steps. Only the team could act on it.
- 3: Clear steps with some gaps a stranger would have to guess at.
- 5: A stranger could pick this up tomorrow and start without asking anyone.

**Outlives the team**
- 1: Depends on particular people staying. No owners, nothing written down.
- 3: Owners are named, but nothing would carry on if they left.
- 5: Ownership, documentation and handover are built in. The system runs without its builders.

**Used the critique**
- 1: Ignored the critique or argued with it.
- 3: Answered the critique and changed something, but only surface points.
- 5: Took the hardest point seriously and the plan is visibly stronger for it.

**Delivered clearly**
- 1: Over time, or the plan was hard to follow.
- 3: Clear enough, but with padding or rushing.
- 5: Clear, within 10 minutes and the audience could repeat the plan back.`,

  task_card: `**{{table_name}} · Task {{task_number}}**

**{{task_title}}**

**The situation**
{{task_context}}

**The problem to solve**
{{task_problem}}

**What you have to work with**
{{task_constraints}}

**Your plan must cover**
- **Problem.** What is actually going wrong, and why?
- **Approach.** The steps, written so someone outside your team could follow them.
- **Who does what.** A named owner for every step.
- **Risks.** What could stop it working, and what you'll do about it.
- **First 30 days.** What happens in the first month, and how you'll know it's working.

**The test.** At 11:40 your plan goes to another team. They have to understand it without you.

*Tasks come from real workplace problems sent in by participants, rewritten so no workplace can be identified.*`,

  plan_sheet: `**{{table_name}} · Plan for Task {{task_number}}**

[[box Problem]]
[[box Approach | numbered]]
[[box Who does what | owners]]
[[box Risks]]
[[box First 30 days]]

*Write so a stranger could run this tomorrow.*`,

  critique_sheet: `**Critique of the plan from {{source_table_name}}, by {{table_name}}**

[[critique Problem]]
[[critique Approach]]
[[critique Who does what]]
[[critique Risks]]
[[critique First 30 days]]

*Be specific. Name the line and say what would make it stronger.*`,

  response_sheet: `**{{table_name}} responds to the critique from {{critic_table_name}}**

[[box What we're changing, and why]]
[[box What we're keeping, and why]]
[[box The one thing we'd still ask the critics]]

*Fifteen minutes. You don't have to agree with every point. You do have to answer it.*`,
};

// Fills {{fields}}. Anything that cannot be filled stays visible and is
// reported, so a pack never goes out with a hole in it unnoticed.
export function fill(text, fields) {
  const missing = new Set();
  const out = String(text).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (m, k) => {
    if (fields[k] === undefined || fields[k] === null) { missing.add(k); return m; }
    return String(fields[k]);
  });
  return { text: out, missing: [...missing] };
}

// The five criteria, read from the criteria template so the judge's screen
// and the brief always say the same thing.
export function parseCriteria(text) {
  const out = [];
  let cur = null;
  for (const raw of String(text).split("\n")) {
    const line = raw.trim();
    const head = line.match(/^\*\*(.+?)\*\*$/);
    const anchor = line.match(/^-\s*([135])\s*:\s*(.+)$/);
    if (head) { cur = { name: head[1].trim(), anchors: {} }; out.push(cur); }
    else if (anchor && cur) cur.anchors[anchor[1]] = anchor[2].trim();
  }
  return out;
}

export function checkCriteria(text) {
  const c = parseCriteria(text);
  if (c.length !== 5 || c.some((x) => !x.anchors[1] || !x.anchors[3] || !x.anchors[5])) {
    return "The criteria need exactly five headings in **bold**, each with lines starting - 1:, - 3: and - 5:.";
  }
  if (!c.some((x) => /outlives the team/i.test(x.name))) return 'Keep a criterion called "Outlives the team": it breaks ties.';
  return null;
}

// ---------- rendering to HTML ----------

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,;:]|$)/g, "$1<i>$2</i>")
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:)])/g, '<a href="$1">$1</a>');
}

function box(spec) {
  const [title, kind] = spec.split("|").map((s) => s.trim());
  if (kind === "numbered") return `<section class="box"><h4>${esc(title)}</h4><ol class="lines">${"<li></li>".repeat(7)}</ol></section>`;
  if (kind === "owners") return `<section class="box"><h4>${esc(title)}</h4><table class="owners"><tr><th>Step</th><th>Owner</th></tr>${"<tr><td></td><td></td></tr>".repeat(6)}</table></section>`;
  return `<section class="box"><h4>${esc(title)}</h4><div class="space"></div></section>`;
}
function critique(title) {
  return `<section class="box crit"><h4>${esc(title)}</h4>${["Gap", "Question", "Strength"].map((k) => `<div class="row"><b>${k}</b><span></span></div>`).join("")}</section>`;
}

// Markdown-ish text to HTML. The first line, if wholly bold, becomes the
// document title.
export function render(text) {
  const lines = String(text).replace(/\r/g, "").split("\n");
  const html = [];
  let i = 0, titled = false;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { i++; continue; }
    const special = t.match(/^\[\[(box|critique)\s+(.+?)\]\]$/);
    if (special) { html.push(special[1] === "box" ? box(special[2]) : critique(special[2])); i++; continue; }
    if (t.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(lines[i].trim()); i++; }
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const body = rows.filter((r) => !/^\|[\s|:-]+\|$/.test(r));
      const [head, ...rest] = body;
      html.push(`<table class="doc"><thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rest.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    if (t.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) { items.push(lines[i].trim().slice(2)); i++; }
      html.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`);
      continue;
    }
    const whole = t.match(/^\*\*([^*]+)\*\*$/);
    if (whole) {
      html.push(!titled && html.length === 0 ? `<h2 class="doc-title">${inline(whole[1])}</h2>` : `<h3>${inline(whole[1])}</h3>`);
      titled = true; i++; continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(\||- |\[\[)/.test(lines[i].trim()) && !/^\*\*[^*]+\*\*$/.test(lines[i].trim())) { para.push(inline(lines[i].trim())); i++; }
    if (para.length) html.push(`<p>${para.join("<br>")}</p>`);
    else { html.push(`<p>${inline(t)}</p>`); i++; }
  }
  return html.join("\n");
}
