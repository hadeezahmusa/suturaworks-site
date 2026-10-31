// Demo mode for the lobby and team rooms (my/?demo=1): the real page with
// sample people, posts and messages, answered here in the browser instead of
// by the server. Nothing is saved and nothing is sent. A switch at the top
// moves between the lobby (before Friday) and the team rooms (after the
// announcement).

const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const person = (short, org, what, hoping, role = "") => ({ short, org, what, hoping, role });

const PEOPLE = [
  person("Amaka O.", "Zenith Bank", "I run branch operations in Wuse 2", "A way to make our processes survive staff changes", ""),
  person("Ibrahim S.", "Kaduna Polytechnic", "I lecture in public administration", "Better ways to hand over projects to new teams", ""),
  person("Tolu A.", "", "Freelance product designer", "To meet people solving real problems", ""),
  person("Zainab M.", "Federal Ministry of Health", "Policy analyst, primary health care", "A plan I can take back to my unit", ""),
  person("Chinedu E.", "Sterling Bank", "", "", ""),
  person("Halima B.", "JCI Aso", "Programme lead for youth outreach", "How to build things that outlive my term", ""),
  person("David K.", "Andela", "Engineering manager", "Sprint habits for non-tech teams", ""),
  person("Ngozi U.", "Abuja Chamber of Commerce", "Membership and events", "", ""),
  person("Musa Y.", "", "", "", "Mentor"),
];

const POSTS = [
  { id: 3, audience: "lobby", at: ago(60 * 26), title: "New to sprints? Here's the whole day in one minute ⏱️", text: "Read the task, build on the board, hand it over, take the critique, then present. Watch the explainer: https://suturaworks.com/qlv2026/" },
  { id: 2, audience: "lobby", at: ago(60 * 41), title: "One small thing before you go: add QLV to your home screen 📲", text: "It takes ten seconds, and it means your team room is one tap away on Friday. Turn on notifications while you're there so you don't miss the reveal." },
  { id: 1, audience: "lobby", at: ago(60 * 49), title: "Welcome to the QLV 2026 lobby! 👋🏽", text: "This is where you'll meet the people you're building with on Saturday. Start by writing your intro, then say hello. Teams are revealed on Friday at 4:45pm, right here." },
];

let nextId = 100;
const msg = (who, body, min, role = "", mine = false) => ({ id: nextId++, who, role, mine, body, at: ago(min) });
const LOBBY = [
  msg("Amaka", "Good morning everyone! Looking forward to Saturday 🙌🏽", 300),
  msg("Ibrahim", "Hello all. First time at a QLV event, any tips?", 240),
  msg("Halima", "Ibrahim, just come with an open mind. The critique part is the best bit.", 230),
  msg("Tolu", "Has anyone done a design sprint before? Curious how close this is.", 90),
  msg("David", "Similar idea, but shorter and with a real problem from someone in the room 👀", 60),
];
const ROOM = [
  msg("Zainab", "Hi team Foundation! 👋🏽", 12),
  msg("Musa", "Welcome, all. I'll be with you and Blueprint on Saturday. Read each other's intros before we meet.", 9, "Mentor"),
  msg("Chinedu", "Hello! Is anyone driving from Gwarinpa? Happy to share a ride.", 4),
];
const REPLIES = {
  lobby: [["Amaka", "Welcome! 👋🏽"], ["Halima", "Great to have you here."], ["David", "See you Saturday!"], ["Tolu", "😂👍🏽"]],
  room: [["Zainab", "Love that 😄"], ["Chinedu", "Agreed! See you Saturday."], ["Musa", "Good start, team.", "Mentor"], ["Ibrahim", "Count me in 👍🏽"]],
};
let roomsOpen = false, pending = [], intro = { what: "", hoping: "", hideOrg: false, org: "Your organisation" };

function view() {
  const me = { short: "You", org: intro.hideOrg ? "" : intro.org, what: intro.what, hoping: intro.hoping, role: "" };
  return {
    state: "open",
    me: { first: "Guest", short: "Guest", role: "participant", roleLabel: "", note: "" },
    roomsOpen,
    countdownTo: "2026-11-06T15:00:00Z", announceLabel: "Teams are announced on Friday at 4:45pm.",
    saturday: "Arrive from 8:30am · Transcorp Hilton, Abuja · Find your table by the name on your badge.",
    posts: [...POSTS], roomPosts: [],
    people: [me, ...PEOPLE],
    intro: { ...intro },
    lobby: [...LOBBY],
    rooms: roomsOpen ? [{
      space: "t:0", name: "Foundation", mentors: ["Musa Y."],
      members: [me, PEOPLE[3], PEOPLE[4], PEOPLE[1], PEOPLE[6]],
      messages: [...ROOM],
    }] : [],
    push: { key: "", state: null },
    installed: false,
  };
}

export function setDemoRooms(open) { roomsOpen = open; }

export async function demoApi(path, body) {
  await new Promise((r) => setTimeout(r, 150));
  if (path.startsWith("/api/my?")) return view();
  if (path.startsWith("/api/my-wall")) {
    const space = new URLSearchParams(path.split("?")[1]).get("space");
    const due = pending.filter((p) => p.space === space && p.at <= Date.now());
    pending = pending.filter((p) => !due.includes(p));
    const list = space === "lobby" ? LOBBY : ROOM;
    const out = due.map((p) => ({ ...p.msg, at: new Date().toISOString() }));
    list.push(...out);
    return { messages: out, closed: false, roomsOpen };
  }
  if (path === "/api/my-intro") { intro = { ...intro, what: body.what.trim(), hoping: body.hoping.trim(), hideOrg: !!body.hideOrg }; return { ok: true }; }
  if (path === "/api/my-post") {
    const m = msg("You", body.body.trim().slice(0, 280), 0, "", true);
    (body.space === "lobby" ? LOBBY : ROOM).push(m);
    // Someone answers a few seconds later, so the refresh can be seen working.
    const pool = REPLIES[body.space === "lobby" ? "lobby" : "room"];
    const [who, text, role = ""] = pool[nextId % pool.length];
    pending.push({ space: body.space, at: Date.now() + 4000, msg: msg(who, text, 0, role) });
    return { message: m };
  }
  return { ok: true };
}
