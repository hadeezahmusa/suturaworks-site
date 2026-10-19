// Where the page sends registrations. Local testing points at wrangler dev.
const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);

export const API = LOCAL ? "http://localhost:8787" : "https://qlv2026.suturaworks.workers.dev";
export const CONTACT = "info@suturaworks.com";
export const PRIVACY =
  "JCI Aso collects these details to run QLV 2026. Registration is hosted by Sutura Works Limited. " +
  "Proof of payment is seen only by the JCI Aso verification team.";
