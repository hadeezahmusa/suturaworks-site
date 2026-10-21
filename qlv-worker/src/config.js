// Admin-only settings for QLV 2026, kept in one place so they can change per
// event. Nothing here is sent to the public registration page.

// The admin colours. Every admin page reads these two values.
export const THEME = { primary: "#0F2B63", accent: "#EFC22D" };

// Tables: eight seats each. Six exist from the start; more open by themselves
// and take the next name, then "Table 10", "Table 11" and so on.
export const TABLE_CAPACITY = 8;
export const INITIAL_TABLES = 6;
export const TABLE_NAMES = ["Foundation", "Blueprint", "Scaffold", "Keystone", "Pillar", "Legacy", "Cornerstone", "Anchor", "Bridge"];
export function tableName(i) {
  return TABLE_NAMES[i] || `Table ${i + 1}`;
}

// Partner levels. There is deliberately no limit on how many partners take a
// level. The amount is copied onto the partner when it is created, so a later
// change here never rewrites an existing partnership.
export const PARTNER_LEVELS = {
  lead: { name: "Lead partner", amount: 200000, seats: 4 },
  supporting: { name: "Supporting partner", amount: 100000, seats: 2 },
  community: { name: "Community partner", amount: 50000, seats: 1 },
};

// Organisation answers that say nothing about where someone works, so they
// never keep two people apart at a table.
export const ORG_IGNORE = ["none", "nil", "n a", "na", "not applicable", "self", "self employed", "selfemployed", "student", "freelance", "freelancer", "unemployed", "nysc", "corps member", "corper", "retired", "private", "individual"];

// Endings dropped before comparing organisations, so "Zenith Bank Plc" and
// "zenith bank" count as the same place.
export const ORG_SUFFIXES = ["ltd", "limited", "plc", "llc", "inc", "incorporated", "co", "company", "nig", "nigeria", "ng"];

// Ring colours for organisations with two or more people seated. Reused in
// turn when they run out. Red is kept for a clash.
export const RING_COLOURS = ["#2F6F4E", "#1A5AA8", "#A87D2C", "#7C3F8C", "#1F7D87", "#8A5A2B"];
export const CLASH_COLOUR = "#B3402D";
