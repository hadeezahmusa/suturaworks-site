// How an email or page greets someone: any titles at the front of their
// name, then their first name. "Dr. Maulud Tafida-Isa" is "Dr. Maulud",
// "JCI Senator Aina Segun Aina" is "JCI Senator Aina", "Ada Obi" is "Ada".
// A lone initial ("M. Aderomola Ijaiya") is passed over for the name after it.

const TITLE = /^(dr|prof|engr|eng|barr|arc|pharm|mr|mrs|ms|miss|hon|chief|alhaji|alh|hajiya|hajia|rev|pastor|sen|senator|amb|ambassador|jci|jcin|sir|dame|lady|mallam|malam|capt|col|gen|maj|lt|hrh|hrm|oba|emir|justice)\.?$/i;
const INITIAL = /^[A-Za-z]\.?$/;

export function greetName(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  const titles = [];
  let i = 0;
  while (i < words.length - 1 && TITLE.test(words[i])) titles.push(words[i++]);
  while (i < words.length - 1 && INITIAL.test(words[i])) i++;
  const first = words[i] || "";
  return [...titles, first].join(" ").trim();
}
