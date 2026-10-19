// Nigerian Business Launch Navigator: Journey Research
// Single source of truth for the survey. Used by the page (survey.js) and by the
// Cloudflare Worker (worker/src/index.js) to label export columns.
//
// Question fields:
//   id        stable key stored in the database; never rename once responses exist
//   type      single | multi | short | long
//   label     the question
//   help      optional hint under the question
//   options   for single and multi; this text is what gets stored, so never edit it once responses exist
//   labels    optional { option: display text } to reword an option on screen without changing what is stored
//   csvLast   true puts the question's columns at the end of responses.csv, after the original ones
//   other     true adds a text box when "Other" is chosen
//   required  true if an answer is needed when the question is shown
//   showIf    { q: <id>, in: [values] } shows the question only for those answers

export const ROLE = {
  owner: "I own or have owned a business in Nigeria.",
  lawyer: "I am a lawyer who assists businesses with registration or business-related matters.",
  agent: "I am a CAC-accredited agent who assists with business registration.",
  consultant: "I am a business consultant or adviser who assists business owners.",
  otherPro: "I perform another professional role related to business formation or operations.",
  other: "Other.",
};

const PREPARING = "I am preparing to start my first business but have not registered it.";
const OWNER_STAGES = [
  PREPARING,
  "I have registered a business but have not started operating.",
  "I have been operating a business for less than one year.",
  "I have been operating a business for 1 to 3 years.",
  "I have been operating a business for more than 3 years.",
  "I previously owned a business but no longer operate it.",
];
const STARTED = OWNER_STAGES.slice(1);

const YEARS = ["Less than 2 years.", "2 to 5 years.", "6 to 10 years.", "More than 10 years."];
const FREQUENCY = ["Frequently.", "Occasionally.", "Rarely.", "Never.", "Prefer not to say."];
const SAW_CONFLICT = ["Frequently.", "Occasionally.", "Rarely."];
const CLIENT_COUNT = ["Fewer than 10.", "10 to 25.", "26 to 50.", "51 to 100.", "More than 100."];

export const ROLE_SECTION = {
  id: "role",
  title: "About you",
  questions: [
    {
      id: "role",
      type: "single",
      label: "Which of the following best describes you?",
      options: Object.values(ROLE),
      // reworded after launch to route lawyers correctly; stored values stay as in ROLE
      labels: {
        [ROLE.lawyer]: "I am a lawyer or legal practitioner who assists businesses with registration or business-related matters.",
        [ROLE.otherPro]: "I perform another professional role related to business formation or operations (not a lawyer, CAC-accredited agent or consultant).",
      },
      required: true,
    },
    {
      id: "role_other",
      type: "short",
      label: "Please describe your role.",
      required: false,
      showIf: { q: "role", in: [ROLE.other] },
    },
  ],
};

export const BRANCHES = {
  owner: {
    id: "owner",
    title: "Your business journey",
    questions: [
      { id: "o_stage", type: "single", required: true, label: "Which best describes your current business experience?", options: OWNER_STAGES },
      { id: "o_type", type: "short", required: true, label: "What type of business are you establishing or have you established?", help: "For example: retail, food services, professional services, healthcare, technology or manufacturing." },
      { id: "o_location", type: "short", required: true, label: "Where is the business based or intended to operate?", help: "City and state only. Please do not give a street address." },
      { id: "o_formalise", type: "single", required: true, other: true, label: "How did you first formalise or attempt to formalise your business?", options: ["I handled registration myself.", "I used a lawyer.", "I used a CAC-accredited agent.", "I used a business consultant or another professional.", "Someone else handled it for me.", "I have not started the formalisation process.", "Other."] },
      { id: "o_why", type: "long", required: false, label: "Why did you choose that approach?", help: "For example: cost, convenience, lack of knowledge, recommendations or concern about making mistakes." },
      { id: "o_believed", type: "long", required: true, label: "Thinking back to when you decided to start the business, what did you believe you needed to do to get started?", help: "Describe what you thought the process involved and where that understanding came from." },
      { id: "o_actual", type: "long", required: true, showIf: { q: "o_stage", in: STARTED }, label: "What did you actually have to do?", help: "Walk us through the main steps from deciding to start the business to registration or the start of operations. Include steps you discovered only after starting." },
      { id: "o_sofar", type: "long", required: true, showIf: { q: "o_stage", in: [PREPARING] }, label: "What steps have you taken so far, and what do you expect to do next?", help: "Include anything you have looked into, paid for or been told you need." },
      { id: "o_after_sources", type: "multi", required: true, other: true, showIf: { q: "o_stage", in: STARTED }, label: "After registration, how did you find out what else you needed to do to operate the business?", help: "Select all that apply.", options: ["Information from the lawyer or agent who registered the business.", "Government agency websites or publications.", "Direct contact with government agencies.", "Other business owners.", "Social media, online forums or videos.", "Accountants, lawyers or consultants.", "Business associations, incubators or entrepreneurship programmes.", "I did not actively seek further information.", "I am still unsure what else is required.", "Other."] },
      { id: "o_late", type: "single", required: true, label: "Have you ever discovered that something you needed to do had not been explained to you earlier?", options: ["Yes.", "No.", "I am not sure."] },
      { id: "o_late_what", type: "long", required: true, showIf: { q: "o_late", in: ["Yes."] }, label: "What did you discover, and when did you discover it?", help: "Describe the requirement, obligation, process or information you had missed." },
      { id: "o_late_cost", type: "multi", required: true, other: true, showIf: { q: "o_late", in: ["Yes."] }, label: "What were the consequences of discovering it late?", help: "Select all that apply.", options: ["Additional expenses.", "Delayed business operations.", "A rejected or delayed application.", "A penalty or formal warning.", "Lost customers or business opportunities.", "Time spent seeking clarification.", "I had to hire a professional to resolve it.", "No significant consequences.", "Other."] },
      { id: "o_unclear", type: "single", required: true, label: "Have you encountered information about a business process that was missing, unclear, contradictory or outdated?", options: ["Yes, more than once.", "Yes, once.", "No.", "I am not sure."] },
      { id: "o_unclear_what", type: "long", required: true, showIf: { q: "o_unclear", in: ["Yes, more than once.", "Yes, once."] }, label: "Please describe one specific incident.", help: "What were you trying to do? What information did you receive, where did it come from and what made it difficult to rely on?" },
      { id: "o_unclear_fix", type: "multi", required: true, other: true, showIf: { q: "o_unclear", in: ["Yes, more than once.", "Yes, once."] }, label: "How did you resolve the issue, if you did?", help: "Select all that apply.", options: ["I searched other sources.", "I contacted the relevant agency.", "I consulted a lawyer, agent or consultant.", "I asked other business owners.", "I paid for assistance.", "I followed the instructions I had received despite uncertainty.", "I postponed or abandoned the process.", "I have not resolved it.", "Other."] },
      { id: "o_unexpected", type: "single", required: true, label: "Have you ever been asked to provide a document, complete a step or pay a fee that you did not expect?", options: ["Yes.", "No.", "I am not sure."] },
      { id: "o_unexpected_what", type: "long", required: false, showIf: { q: "o_unexpected", in: ["Yes."] }, label: "What happened?", help: "If possible, say whether it was an official fee, a professional service fee or a payment whose basis was unclear. Please do not include personal names or details that could identify anyone." },
      { id: "o_stuck", type: "single", required: true, other: true, label: "When you encounter a business-related problem you cannot resolve yourself, what do you usually do?", options: ["Contact the professional who handled my registration.", "Hire a lawyer or consultant.", "Contact the relevant government agency.", "Ask other business owners.", "Search online.", "Try to resolve it myself through trial and error.", "Delay taking action.", "Other."] },
      { id: "o_hardest", type: "long", required: true, label: "What has been the most difficult part of establishing or operating your business?" },
      { id: "o_wish", type: "long", required: true, label: "What do you wish you had known before you started?", help: "If you have not started yet, what do you most wish you knew now?" },
      { id: "o_when_help", type: "long", required: true, label: "If reliable, personalised guidance had been available throughout your business journey, at what point, if any, would it have helped you most? Why?", help: "It is fine to say it would not have helped." },
    ],
  },

  lawyer: {
    id: "lawyer",
    title: "Your experience as a lawyer",
    questions: [
      { id: "l_years", type: "single", required: true, label: "How long have you been practising law?", options: YEARS },
      { id: "l_services", type: "multi", required: true, other: true, label: "Which business-related services do you provide?", help: "Select all that apply.", options: ["Business name registration.", "Company incorporation.", "Post-registration filings and changes.", "Corporate governance and statutory compliance.", "Tax-related advisory or referrals.", "Licensing and regulatory compliance.", "Contract drafting and commercial advice.", "Dispute resolution or regulatory problem-solving.", "Other."] },
      { id: "l_volume", type: "single", required: true, label: "Approximately how many SME founders or businesses do you assist in a typical year?", options: [...CLIENT_COUNT, "Difficult to estimate."] },
      { id: "l_misunderstand", type: "long", required: true, label: "What information do clients most commonly misunderstand before engaging you?" },
      { id: "l_questions", type: "long", required: true, label: "What questions do clients frequently ask during business registration or incorporation?" },
      { id: "l_return", type: "multi", required: true, other: true, label: "After completing registration, what issues do clients most frequently return to you to resolve?", help: "Select all that apply.", options: ["Tax registration or obligations.", "Annual returns or statutory filings.", "Business permits or sector-specific licences.", "Corporate changes or ownership matters.", "Employment or workplace obligations.", "Contracts and commercial transactions.", "Banking or payment-related requirements.", "Government agency requests or delays.", "Penalties or missed deadlines.", "Disputes arising from earlier advice or actions.", "Other."] },
      { id: "l_case", type: "long", required: true, label: "Can you describe a recent anonymised case in which a client encountered a problem after registration that they could potentially have anticipated?", help: "Describe the initial situation, what went wrong, how it was resolved and whether earlier information could have prevented the problem. Do not disclose privileged or identifying client information." },
      { id: "l_info_vs_judgement", type: "long", required: true, label: "Which recurring problems are primarily caused by missing or misleading information, rather than the need for specialist legal judgement?" },
      { id: "l_diy", type: "long", required: true, label: "Which matters do you believe founders can reasonably handle themselves with accurate guidance, and which genuinely require legal assistance?" },
      { id: "l_verify", type: "multi", required: true, other: true, label: "Where do you currently obtain or verify information about applicable requirements, fees and procedures?", help: "Select all that apply.", options: ["Legislation and regulations.", "Official government agency websites.", "Direct contact with agencies.", "Professional associations or colleagues.", "Legal databases or research services.", "Client experiences.", "Other."] },
      { id: "l_gap", type: "single", required: true, label: "Have you encountered a difference between published requirements and what an agency or office requested in practice?", options: FREQUENCY },
      { id: "l_gap_example", type: "long", required: false, showIf: { q: "l_gap", in: SAW_CONFLICT }, label: "Without identifying clients or individual officials, describe an example and how you determined what the applicable requirement actually was." },
      { id: "l_prevent", type: "long", required: true, label: "What information or intervention would help clients avoid preventable problems while preserving the need for professional advice where appropriate?" },
    ],
  },

  agent: {
    id: "agent",
    title: "Your experience as a registration agent",
    questions: [
      { id: "a_years", type: "single", required: true, label: "How long have you been assisting clients with business registration?", options: YEARS },
      { id: "a_services", type: "multi", required: true, other: true, label: "Which registration services do you provide?", help: "Select all that apply.", options: ["Business name registration.", "Company incorporation.", "Incorporated trustees or other entity types.", "Post-registration changes.", "Annual returns.", "Other."] },
      { id: "a_volume", type: "single", required: true, label: "Approximately how many SME clients do you assist in a typical year?", options: CLIENT_COUNT },
      { id: "a_misunderstand", type: "long", required: true, label: "What do prospective clients most often misunderstand about registration?" },
      { id: "a_mistakes", type: "long", required: true, label: "What mistakes or omissions most often delay or complicate applications?" },
      { id: "a_explain", type: "long", required: true, label: "How do you explain the differences between a business name, a limited liability company and other available entity types to clients?" },
      { id: "a_expectations", type: "long", required: true, label: "What do clients typically believe they can do immediately after registration, and where are those expectations incomplete or incorrect?" },
      { id: "a_followup", type: "long", required: true, label: "After registration is complete, what follow-up questions or problems do clients commonly bring to you?" },
      { id: "a_verify", type: "long", required: true, label: "How do you verify current fees, documentation requirements and procedural changes?" },
      { id: "a_conflict", type: "single", required: true, label: "Have you experienced cases where instructions from different sources or officials conflicted?", options: FREQUENCY },
      { id: "a_conflict_example", type: "long", required: false, showIf: { q: "a_conflict", in: SAW_CONFLICT }, label: "Describe one anonymised example and explain how you resolved the conflict." },
      { id: "a_before", type: "long", required: true, label: "What information could clients be given before approaching an agent to help them make better decisions and reduce avoidable errors?" },
    ],
  },

  consultant: {
    id: "consultant",
    title: "Your experience as a consultant or adviser",
    questions: [
      { id: "c_years", type: "single", required: true, label: "How long have you been advising or supporting businesses?", options: YEARS },
      { id: "c_areas", type: "multi", required: true, other: true, label: "Which areas do you support?", help: "Select all that apply.", options: ["Business planning and model selection.", "Business registration and formalisation.", "Operational setup.", "Tax and financial administration.", "Licensing and regulatory compliance.", "Process design and documentation.", "Human resources and employment.", "Business growth and restructuring.", "Problem-solving and remediation.", "Other."] },
      { id: "c_types", type: "short", required: true, label: "Which types of businesses do you mainly support?" },
      { id: "c_stage", type: "single", required: true, label: "At what stage do clients usually approach you?", options: ["Before choosing a business model.", "Before registration.", "Immediately after registration.", "Once they have started operating.", "When a specific problem occurs.", "During business growth or restructuring.", "A mixture of these stages."] },
      { id: "c_common", type: "long", required: true, label: "What are the most common problems clients encounter because they did not know what was required earlier?" },
      { id: "c_journey", type: "long", required: true, label: "Describe a recent anonymised client journey in which missing, incomplete or inaccurate information contributed to a problem.", help: "Include the initial goal, what the client believed, what actually happened and how the problem was resolved." },
      { id: "c_recurring", type: "long", required: true, label: "Which problems recur across multiple clients, even when their businesses are different?" },
      { id: "c_distinguish", type: "long", required: true, label: "How do you distinguish a problem caused by poor information from one caused by inadequate resources, poor execution or the need for specialist advice?" },
      { id: "c_diy", type: "long", required: true, label: "Which parts of your advisory work could clients handle themselves if they had reliable, personalised guidance?" },
      { id: "c_needs_pro", type: "long", required: true, label: "Which parts still require a professional? Why?" },
      { id: "c_verify", type: "long", required: true, label: "How do you currently verify regulatory requirements and determine whether guidance remains current?" },
      { id: "c_tool", type: "long", required: true, label: "What, if anything, would make a business-navigation tool useful to your clients without compromising the quality of your work?", help: "It is fine to say you do not think one would be useful, and why." },
    ],
  },

  otherPro: {
    id: "otherPro",
    title: "Your professional experience",
    questions: [
      { id: "p_role", type: "short", required: true, label: "What is your professional role?" },
      { id: "p_services", type: "long", required: true, label: "What services do you provide to founders or businesses?" },
      { id: "p_stages", type: "multi", required: true, other: true, label: "At what stages of the business journey do you usually become involved?", help: "Select all that apply.", options: ["Business idea and model selection.", "Registration or incorporation.", "Post-registration setup.", "Day-to-day operations.", "Licensing or regulatory compliance.", "Business growth.", "Resolving a specific problem.", "Other."] },
      { id: "p_difficulties", type: "long", required: true, label: "What information-related difficulties do the founders or businesses you assist commonly encounter?" },
      { id: "p_example", type: "long", required: true, label: "Describe one anonymised example where incomplete, inaccurate or conflicting information affected a business process." },
      { id: "p_verify", type: "long", required: true, label: "How do you verify the information you provide?" },
      { id: "p_diy", type: "long", required: true, label: "What could founders reasonably manage themselves with better guidance, and when do they need professional assistance?" },
    ],
  },
};

// "Other" in Q1 uses the other-professional section
export const BRANCH_FOR_ROLE = {
  [ROLE.owner]: "owner",
  [ROLE.lawyer]: "lawyer",
  [ROLE.agent]: "agent",
  [ROLE.consultant]: "consultant",
  [ROLE.otherPro]: "otherPro",
  [ROLE.other]: "otherPro",
};

export const CLOSING_SECTION = {
  id: "closing",
  title: "Closing questions",
  questions: [
    // added after launch; csvLast keeps the original export columns in place
    { id: "x_heard", type: "single", required: false, other: true, csvLast: true, label: "How did you hear about this survey?", options: ["A personal message from someone I know", "A WhatsApp or Telegram group", "Instagram", "LinkedIn", "Email", "From Sutura Works Limited directly", "Other."], labels: { "Other.": "Other (please specify)" } },
    { id: "x_guidance", type: "multi", max: 3, required: true, other: true, label: "In your experience, which parts of the Nigerian business journey most need clearer guidance?", help: "Choose up to three.", options: ["Choosing the right business model or legal structure.", "Registration or incorporation.", "Understanding obligations after registration.", "Identifying permits, licences or approvals.", "Understanding fees and required documents.", "Knowing which agency or authority to approach.", "Resolving contradictory instructions.", "Handling delays, rejections or unexpected requirements.", "Knowing when to seek professional help.", "Other."] },
    { id: "x_benefit", type: "single", required: true, other: true, label: "Suppose a service could help people understand their options, identify the requirements that apply to them and navigate problems. Which potential benefit, if any, would matter most?", options: ["Making better decisions before starting.", "Avoiding preventable mistakes.", "Saving time.", "Reducing unnecessary expenses.", "Knowing what to do after registration.", "Knowing how to respond when a process goes wrong.", "Knowing when professional assistance is necessary.", "None of these, or I am not sure such a service would help.", "Other."] },
    { id: "x_must", type: "long", required: true, label: "If such a service existed, what is the one thing it would have to get right to be genuinely useful?", help: "If you think it would not be useful, please tell us why." },
  ],
};

// Contact details are stored in a separate table from the answers.
export const CONTACT_FIELDS = [
  { id: "wants_results", label: "Send me a summary of the research findings" },
  { id: "wants_interview", label: "I am open to a follow-up interview" },
];

// Every answer question, in a stable order, for export column headings.
export function allQuestions() {
  const out = [...ROLE_SECTION.questions];
  for (const key of Object.keys(BRANCHES)) out.push(...BRANCHES[key].questions);
  out.push(...CLOSING_SECTION.questions);
  return out;
}
