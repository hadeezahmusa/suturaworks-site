// Prices, dates and the bank account, shared by the page and the Worker.
// The Worker recomputes every amount from this file, so the page can never
// set its own price.

export const PRICES = {
  standard: 10000,
  member: 8000,
  corporate: { 3: 40000, 5: 60000 },
  sponsoredSeat: 9500,
};
export const SPONSORED_MIN = 6;
export const SPONSORED_MAX = 200; // a sanity cap on the stepper, not a ceiling anyone should reach

export const TIER_NAME = {
  standard: "Standard",
  member: "JCI Aso member",
  corporate: "Corporate team",
  sponsored: "Sponsored seats",
  adviser: "Adviser",
};

export const BANK = { number: "7723913012", name: "JCI Aso", bank: "FCMB" };

// Registration, claims and new answers close at the end of 30 October 2026,
// Abuja time (WAT, UTC+1). This is the default: the admin page can move it,
// and the Worker serves the current date at /api/config.
export const CLOSES_AT = "2026-10-30T23:00:00Z";
// Advisers can still confirm until day one.
export const ADVISERS_CLOSE_AT = "2026-11-05T23:00:00Z";

// Registrations still awaiting verification after this many days are flagged
// in the admin list so a person can decide whether to release the seat.
export const RELEASE_AFTER_DAYS = 3;

export function amountFor(tier, size) {
  if (tier === "standard") return PRICES.standard;
  if (tier === "member") return PRICES.member;
  if (tier === "corporate") return PRICES.corporate[size] || null;
  if (tier === "sponsored") return size >= SPONSORED_MIN ? size * PRICES.sponsoredSeat : null;
  return 0;
}

export function ngn(n) {
  return "₦" + String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
export function word(n) {
  return WORDS[n] || String(n);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// "30 October" for a closing time stored as the end of that day in Abuja.
export function closeLabel(iso) {
  const d = new Date(Date.parse(iso) + 3600000 - 60000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
// The stored closing time for a YYYY-MM-DD date: the end of that day in Abuja.
export function closeAtFor(date) {
  return `${date}T23:00:00Z`;
}
