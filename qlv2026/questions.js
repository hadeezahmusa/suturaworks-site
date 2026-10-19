// The needs assessment, in one place. The page and the Worker both read this
// file, so adding questions to a set is an edit here and nowhere else.
// Text and hints are copied verbatim from the approved prototype.

export const SITUATIONS = [
  { value: "emp", label: "I work for an organisation", short: "I work for an organisation" },
  { value: "boss", label: "I run a business and have people working for me", short: "I run a business with staff" },
  { value: "solo", label: "I work for myself and have no staff", short: "I work for myself" },
  { value: "study", label: "I am studying, in my service year, or between roles", short: "Studying, service year, or between roles" },
];

export const QBANK = {
  emp: {
    title: "Three questions about where you work",
    q: [
      { t: "What is one thing you do that would be hard for a colleague to pick up if you were away for a month?",
        h: "Two or three sentences, and be specific. \"Managing clients\" tells us nothing. \"I am the only one who knows which supplier accepts late payment and who to call there\" tells us everything." },
      { t: "What is one thing in your office you wish somebody would just fix?",
        h: "Something that wastes time, causes the same argument over and over, or everybody complains about and nobody owns." },
      { t: "Has anyone left in the last two years and taken something important with them? What was it?",
        h: "Knowledge, a relationship, a process nobody else understood.", opt: true },
    ],
  },
  boss: {
    title: "Three questions about your business",
    q: [
      { t: "What is one thing in your business that still only you can do, that you have not managed to hand to anybody?",
        h: "Two or three sentences, and be specific about why it has not transferred. \"Nobody else can handle clients\" tells us nothing. \"Only I know which three customers will walk if we quote them the standard rate\" tells us everything." },
      { t: "What is one thing in how the business runs that keeps going wrong no matter how often you address it?",
        h: "The one you have raised more than once and it still came back." },
      { t: "Has a staff member left and taken something with them that cost you? What was it?",
        h: "A client relationship, a supplier contact, knowing how something was done.", opt: true },
    ],
  },
  solo: {
    title: "Three questions about your own work",
    q: [
      { t: "If you had to hand your work to somebody for a month, which part of it would you struggle to explain to them?",
        h: "Two or three sentences, and be specific. \"The client relationships\" tells us nothing. \"How I price a job, because I adjust it by how the first conversation went and I have never written down what I am adjusting for\" tells us everything." },
      { t: "What is one part of how you run your own work that you keep meaning to sort out and never do?",
        h: "Invoicing, chasing payment, follow ups, records, where things are kept." },
      { t: "Have you ever lost a client or a job because something fell through a gap in how you work? What was the gap?",
        h: "No need to name anybody.", opt: true },
    ],
  },
  study: {
    title: "Three questions about a group you have been part of",
    q: [
      { t: "Think of any group you have been part of. A school project, a committee, a family business, an association. What was one thing only one person knew how to do, and what happened when that person was not around?",
        h: "Two or three sentences. This counts just as much as a workplace answer. Groups fail in exactly the same ways organisations do, with less cover." },
      { t: "In a place you have studied, worked or volunteered, what is one thing that was badly organised and never got fixed?",
        h: "Something people worked around instead of solving." },
      { t: "Has a group you were part of lost momentum when a particular person left? What went with them?",
        h: "No need to name anybody.", opt: true },
    ],
  },
};

export const MAX_ANSWER = 4000;
