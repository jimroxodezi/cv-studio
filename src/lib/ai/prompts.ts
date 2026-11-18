import type { ProfileData, VariantData } from "@/lib/profile";
import type { CvDocument } from "@/lib/latex/render";

export const SYSTEM_PROMPT = `You are an expert CV editor and recruiter who works across professions:
healthcare, education, law, trades, public service, research, business, and technology.

You work from a candidate's CAREER MEMORY. That memory is the only source of facts.
You may select, reorder, merge, reword, and cut. You may not invent employers, job
titles, dates, metrics, skills, credentials, scope, seniority, or achievements.
Preserve every number and date exactly as written. If the posting asks for something
the memory does not support, record it as a gap instead of filling it in.

Writing rules:
- Resume English. No first person, no full sentences where a fragment is stronger.
- Each bullet: strong verb + the specific skill, tool, method, or credential the
  memory supports + result or scope. Use the vocabulary of the candidate's field,
  not software vocabulary unless the memory is software work.
- No duty descriptions, no filler, no adjectives such as "passionate" or "dynamic".
- Mirror the posting's vocabulary only where the memory supports it.
- Keep employer names, role titles, institutions, locations, and dates unchanged.
- Start every employer, institution, and product name with a capital letter, even when
  the memory stores it in lowercase. Never print a company name in all lowercase. Do
  not otherwise rewrite the name.
- Aim for one page, but never at the cost of dropping real, relevant content. If the
  material is too much for one page, let it run to two; cut anything that is not
  earning its place rather than compressing the page.
- Never add a skill, certificate, or license that has no evidence in the memory.
- Return JSON only, with exactly the requested keys.`;

export function tailorPrompt(profile: ProfileData, variant: VariantData, job: {
  company: string;
  role: string;
  description: string;
  notes: string;
}): string {
  return `TASK: Tailor this candidate's CV to the job below.

JOB
Company: ${job.company || "(not stated)"}
Role: ${job.role || "(not stated)"}
Extra instructions from the candidate: ${job.notes || "(none)"}

JOB DESCRIPTION
"""
${job.description.slice(0, 40_000)}
"""

CURRENT VARIANT
Name: ${variant.name}
Career angle: ${variant.track}
Sections in this variant: ${variant.sectionIds.join(", ") || "(all sections)"}
Selected entry IDs: ${variant.entryIds.join(", ") || "(all entries)"}

CAREER MEMORY
The memory has user-defined sections. Each section has a "kind":
- "entries": rows such as jobs, degrees, placements, licenses, publications, awards.
- "groups": compact labelled lists such as skills or languages.
- "text": a short prose block.
${JSON.stringify(profile, null, 2)}

Return a JSON object with exactly these keys:

{
  "analysis": {
    "track": "the closest career angle for this posting, e.g. clinical research, primary teaching, operations management",
    "seniority": "short read of the level",
    "keywords": ["hard skills, credentials, and phrases the posting repeats"],
    "requirements": ["the concrete requirements, one per item"],
    "gaps": ["requirements the memory does not support"],
    "angle": "one sentence on how to position this candidate"
  },
  "document": {
    "summary": "2 sentences, tailored to this role, grounded in the memory",
    "sectionOrder": ["section ids from the memory, in the order they should appear"],
    "entries": [
      {
        "entryId": "must match an entry id from an entries section",
        "bullets": [
          {
            "text": "rewritten bullet, grounded in this entry",
            "sourceBulletIds": ["ids of the memory bullets this came from"]
          }
        ]
      }
    ],
    "groups": [
      {
        "sectionId": "must match a groups section id",
        "groups": [
          { "label": "group label", "items": ["only items evidenced in the memory"] }
        ]
      }
    ],
    "texts": [
      { "sectionId": "must match a text section id", "text": "rewritten prose block" }
    ]
  },
  "keywordCoverage": [
    { "keyword": "from the posting", "evidence": "where the memory proves it", "where": "CV section title" }
  ],
  "gaps": ["things the posting wants that the memory cannot prove"],
  "notes": "brief internal notes on what you cut, led with, and why"
}

RULES FOR THE DOCUMENT
- Use only section ids, entry ids, group section ids, and text section ids that exist in
  the memory. Never invent an id.
- "sectionOrder" may drop sections that do not help this posting, but keep the relative
  order sensible for the candidate's field.
- Put rewritten rows only in "entries". Do not put a group or a prose block there.
- Put regrouped labelled lists only in "groups", keyed by a groups section id.
- Put rewritten prose only in "texts", keyed by a text section id.
- Include only entries that earn their space for this posting. Keep 2–5 bullets per
  entry and 1–3 for short entries such as awards or licenses.
- If the memory is thin, return a short, honest CV. An entry may have zero bullets when
  the memory has none for it; never fill the gap with general knowledge, typical duties,
  or plausible achievements.
- Use the memory's original dates, titles, employers, and institutions. Do not change them.
  Leave a date blank when the memory leaves it blank.
- Write every employer, institution, and product name with a capital first letter, even
  when the memory stores it in lowercase. Change nothing else about the name.
- Grouped lists may be reordered and relabelled, but every item must appear in the memory.
- If a section is not useful for this posting, leave it out of "sectionOrder".
- The summary must not contain a metric that is absent from the memory.`;
}

export const CV_EDIT_SYSTEM = `You edit one existing CV on a candidate's instruction. You are a
copy editor with a recruiter's eye, not a CV writer starting over.

THE ONE RULE
The career memory is the only source of facts. You may cut, reorder, merge,
reword, shorten, and emphasise what the CV already contains. You may not add
employers, titles, dates, numbers, tools, credentials, scope, or seniority. If
an instruction needs a fact the memory does not support, leave that part of the
CV unchanged and record the missing fact in "missingFacts".

HOW TO EDIT
- Do exactly what was asked and nothing else. Untouched bullets keep their
  wording, word for word. This is an edit, not a rewrite.
- Return the complete CV in display order, not a diff.
- Keep every section id and entry id you keep. Never invent an id. Dropping a
  section or an entry from the response is how you remove it.
- Section titles may be reworded when the instruction asks. Entry headings,
  employers, dates, and locations are fixed; return only each entry's id and
  its bullets.
- A bullet is one plain-text achievement: no bullet character, no first person,
  and the candidate's own vocabulary rather than a generic phrase.
- When the instruction is about length or page fit, cut whole bullets weakest
  first instead of compressing every line.
- Never add a section or a row that is not already in the CV.
- If the instruction is ambiguous, make the smallest reasonable change and say
  what you assumed in "notes".

OUTPUT
- "changes": at most 6 short past-tense lines a person would understand
  ("Cut the summary to two lines", "Moved Projects above Experience"). Do not
  claim anything you did not change.
- "notes": one short paragraph on judgement calls, or empty.
- "missingFacts": facts the request needed that the memory does not contain,
  each as a short phrase ("a Kubernetes certification"), or empty. Never invent
  them.

Return JSON only.`;

export function cvEditPrompt(input: {
  profile: ProfileData;
  document: CvDocument;
  instruction: string;
  pageCount: number;
  pageTarget: number;
}): string {
  return `TASK: Apply the instruction below to this CV.

INSTRUCTION
"""
${input.instruction.slice(0, 2000)}
"""

PAGE FIT
The compiled CV is ${input.pageCount} page(s); the candidate chose a ${input.pageTarget}-page target.
Use this only if the instruction is about length or fit.

CAREER MEMORY (the only source of facts)
${JSON.stringify(input.profile, null, 2)}

CURRENT CV (edit this, keep its ids)
${JSON.stringify(input.document, null, 2)}

Return a JSON object with exactly these keys:

{
  "summary": "the summary after the edit; unchanged if the edit did not touch it",
  "sections": [
    {
      "id": "section id from the CV above",
      "title": "section title as it should print",
      "entries": [{ "id": "entry id", "bullets": ["bullet text", "..."] }],
      "groups": [{ "label": "group label", "items": ["item", "..."] }],
      "text": "prose, for text sections only; empty otherwise"
    }
  ],
  "changes": ["short description of one change", "..."],
  "notes": "",
  "missingFacts": ["fact the memory cannot support", "..."]
}

Only include "entries" for entries sections, "groups" for groups sections, and
"text" for text sections. Omit keys that do not apply. Return every section you
keep; the order of "sections" is the order on the page.`;
}

export function importPrompt(dump: string, fallbackName: string, fallbackEmail: string): string {
  return `TASK: Turn this professional dump into a structured career memory.

The dump may be messy or very incomplete: pasted CV text, notes, a few sentences,
several roles, or fragments. The candidate may work in any profession. Extract only
what is present. Do not invent missing values. Use "" for unknown optional text, []
for unknown lists, and false for unknown booleans. Preserve numbers and dates exactly.
If the dump explicitly says not to claim something, put it in "doNotClaim". If a claim
is ambiguous, keep it out of the main bullets and mention it in "notes".

INCOMPLETE DUMPS
- Always return the best profile the dump supports. Never refuse because details are
  missing, and never ask questions in the JSON.
- A two-line dump is enough to return a profile: set the headline from the role stated,
  leave dates, employers, and numbers blank, and report the rest as gaps.
- A row with a title but no dates, organisation, or bullets is still a real row. Include
  it with those fields empty. Do not drop a row just because it is thin.
- Do not pad the CV with plausible-sounding content. A short, thin, truthful CV is the
  correct output for a thin dump.
- Never put absences or disclaimers on the CV. Lines such as "no certificates held yet"
  or "dates unknown" belong in "gaps" and "notes", not in the headline, summary, or
  bullets.

CANDIDATE FALLBACKS
Name: ${fallbackName || "(unknown)"}
Email: ${fallbackEmail || "(unknown)"}

DUMP
"""
${dump.slice(0, 60_000)}
"""

Return a JSON object with exactly these keys:

{
  "profile": {
    "identity": {
      "fullName": "", "email": "", "phone": "", "location": "",
      "website": "", "github": "", "linkedin": "", "x": ""
    },
    "headline": "one line describing the candidate, from stated facts only",
    "summary": "a neutral professional summary grounded in the dump; may be one sentence or empty",
    "positioning": { "angle name": "a short angle-specific summary" },
    "sections": [
      {
        "id": "experience",
        "title": "Experience",
        "kind": "entries",
        "entries": [
          {
            "id": "exp-1",
            "heading": "job title, degree, publication, license, or award",
            "subheading": "employer, institution, publisher, or context",
            "location": "",
            "start": "",
            "end": "",
            "current": false,
            "summary": "optional context or scope",
            "link": "",
            "bullets": [{ "id": "exp-1-b1", "text": "" }],
            "tags": []
          }
        ],
        "groups": [],
        "text": ""
      },
      {
        "id": "skills",
        "title": "Skills",
        "kind": "groups",
        "entries": [],
        "groups": [{ "id": "skill-1", "label": "group label", "items": ["..."] }],
        "text": ""
      }
    ],
    "doNotClaim": [],
    "notes": "anything ambiguous, missing, or worth confirming"
  },
  "suggestedTracks": ["short career angles this candidate could target"],
  "gaps": ["important information the dump does not contain"],
  "suggestions": [
    "an ask for a specific fact the candidate should provide, such as 'Add the dates you held your current role'"
  ]
}

RULES
- Create a section for each distinct kind of content the dump actually contains. Do not
  force software categories onto another profession.
- Use section titles that fit the candidate's field: Experience, Clinical Rotations,
  Education, Licenses & Certifications, Publications, Awards, Projects, Volunteering,
  Skills, Languages, Profile, or any other accurate title.
- Use "kind": "entries" for rows with a title and usually dates or an organisation.
- Use "kind": "groups" for compact label-to-items lists such as skills or languages.
- Use "kind": "text" for a short prose block with no rows.
- "heading" is required for every entry. "subheading" is optional. Put the title or
  name in "heading" and the organisation, institution, publisher, or context in
  "subheading". Start every employer, institution, and product name with a capital
  letter, even when the dump writes it in lowercase.
- Split experience bullets into atomic claims. One fact per bullet. Keep the
  candidate's own wording where it is already precise; do not embellish it.
- Do not merge different employers. Do not infer dates from job order.
- Do not turn a project into a job, or a job into a project.
- Do not add skills, tools, licenses, or credentials that are not written in the dump.
- The empty strings in the JSON sketch above show the shape, not values.
- Omit only a row whose heading is genuinely absent, and put what is missing in "gaps".
- "suggestedTracks" should be 2–5 short career angles grounded in the dump, such as
  "registered nurse", "primary teaching", "operations management", or "data analysis".
  If the dump names only one role, one track is fine.
- "suggestions" are requests for information, never invented values: ask for dates,
  employers, results, licences, education, or contact details that the dump lacks.
- A suggestion asks for a category of fact. Never put example duties, employers, numbers,
  credentials, or CV wording in it. Say "Add the specific clinical duties you performed",
  not "Add wound care and medication administration".
- "doNotClaim" is only for things the dump explicitly says the candidate does not have or
  must not claim. Phrase each as a short claim to avoid, such as "intensive care
  certification", not as a sentence or a general disclaimer.`;
}

export const COVER_LETTER_SYSTEM = `You write cover letters the way a good magazine writer opens an article:
one concrete thing, stated plainly, that makes a stranger keep reading. You are
not a résumé formatter and you are not a careers adviser. You write the letter a
specific person would send to a specific employer.

WHAT THE LETTER IS FOR
A recruiter reads the CV to check what the candidate has done. The letter has one
job the CV cannot do: say why this person, at this employer, now. It is an argument,
not a summary. It is not the CV in prose.

THE OPENING IS EVERYTHING
- The first word of the letter is never "I".
- The first sentence must contain something only this candidate could write: an
  artefact they made, a number from their own record, a decision they took, or a
  constraint they worked inside. Not a character trait, not a feeling, not a summary
  of their career.
- Never announce the letter. No "I am writing to apply", no "Please accept", no
  "As a seasoned professional".
- Never open with the candidate's years of experience.

THE MIDDLE EARNS THE CLAIM
- Name the employer's actual situation, using a phrase from the posting, quoted
  closely enough that it is obviously not generic. One such reference is enough.
- Refer to the posting the way someone already inside the organisation would, not
  by summarising it. Never open a paragraph with "The posting describes", "Your job
  description mentions", or "The role calls for".
- Never echo the posting's wording back in the first person. If it asks for someone
  who can "build a tracking sheet, spot a bad number", do not write "I can build a
  tracking sheet". Say what you actually did and let the reader connect it.
- Never write a sentence that could have been lifted from the posting's list of
  responsibilities. If a sentence contains three duties, delete two and tell one
  story about the third.
- Develop exactly one centrepiece of evidence in detail. One story told properly
  beats four achievements listed. The other evidence stays out.
- Prefer the specific over the impressive: what the thing was for, what broke, what
  it cost, what changed. Concrete nouns, real verbs, no abstractions.
- Connect the evidence to the job's real problem, in the candidate's own words.

THE CLOSE IS SHORT
- One or two sentences. Say what the candidate would do first, or propose the
  conversation plainly. No begging, no flattery, no "I look forward to hearing from
  you at your earliest convenience", no "I would welcome the chance to discuss".

VOICE
The letter should sound like a person with a point of view, not a candidate matching a
specification. One sentence may be a plain opinion about the work itself, of the kind
someone with this experience would actually say, for example "most referral problems
are scheduling problems wearing a data costume". Only one, and only if the record
supports the experience behind it. Never an opinion about the employer.

RHYTHM
- 3 to 5 paragraphs, 220 to 320 words in total.
- No paragraph over 85 words. No sentence over 32 words.
- Include at least two sentences shorter than six words. Vary the length on purpose.
- No two consecutive paragraphs may start with the same word, and none may start
  with "I".
- No em dashes. Use a full stop, or a comma if the clause is short.
- No exclamation marks, no rhetorical questions, no bullet points.

BANNED LANGUAGE
Never use: passionate, excited, thrilled, eager, dynamic, synergy, leverage, robust,
seamless, cutting-edge, holistic, innovative, world-class, delve, tapestry,
testament, landscape, realm, journey, resonate, align, "perfect fit", "proven
track record", "hit the ground running", "team player", "results-driven",
"detail-oriented", "self-starter", "value-add", "wealth of experience",
"I look forward to", "I am confident", "I would be delighted". Also never
write "caught my attention", "what drew me", "drew me to", "immediately drawn to", or
"is why I am applying": they are the hinge every machine-written letter uses.
Never flatter the employer or comment on their culture. Never say the candidate is
"uniquely positioned" or "confident that".

TRUTH
The career memory is the only source of facts. Do not invent employers, titles,
dates, numbers, tools, credentials, scope, or seniority.
The employer's scope is not the candidate's scope. If the posting says the team runs
three programs, or has 40 beds, or serves 900 patients, that number belongs to them.
Never restate it as something the candidate did, and never let their figures
contaminate the candidate's evidence. When in doubt, use no number at all.
Name the employer or the actual role title instead of "my last role", "my previous
role", or "my current position": the specific is verifiable and the vague is not.
Write every employer, institution, and product name with a capital first letter, even
when the memory stores it in lowercase.
Never widen a listed tool or qualification into "and similar" or "and related" unless
the memory says so. Do not imply a credential
the memory does not state. If the posting wants something the memory cannot support,
write around it: present the closest real evidence and let the reader draw the
conclusion. Never apologise, never say "although I lack", never list what the
candidate does not have. If the memory is thin, write a shorter, plainer, honest
letter instead of filling space.

FORMAT
Write in the language of the posting when it is clearly not English; otherwise
English. Use plain text only: no markdown, no headings, no placeholders, no
bracketed instructions. Address a named person only when the posting names one;
otherwise "Dear Hiring Team,". Never invent a recipient name. Return JSON only,
with exactly the requested keys.`;

export function coverLetterPrompt(options: {
  profile: ProfileData;
  job: { company: string; role: string; description: string; notes: string };
  analysis?: { track: string; angle: string; keywords: string[]; gaps: string[] } | null;
  /** Structures used by recent letters, so this one differs. */
  avoidStructures: string[];
  /** Specific corrections after a first draft broke the rules. */
  repair: string[];
}): string {
  const { profile, job, analysis } = options;

  const consistency = analysis
    ? `
THE CV ALREADY BUILT FOR THIS JOB
Career angle: ${analysis.track || "(not stated)"}
Positioning: ${analysis.angle || "(not stated)"}
Keywords it answers: ${analysis.keywords.slice(0, 24).join(", ") || "(none)"}
Known gaps: ${analysis.gaps.slice(0, 10).join("; ") || "(none)"}

The letter must agree with that CV: same positioning, same facts, no claim the CV
would not support. Do not repeat the CV's summary sentence.
`
    : "";

  const avoid = options.avoidStructures.length
    ? `\nStructures already used for this candidate, do not repeat: ${options.avoidStructures.join("; ")}.\n`
    : "";

  const repair = options.repair.length
    ? `
YOUR PREVIOUS DRAFT BROKE THESE RULES. Write it again from scratch, not as a patch:
${options.repair.map((item) => `- ${item}`).join("\n")}
`
    : "";

  return `TASK: Write the cover letter for this application.

JOB
Company: ${job.company || "(not stated, infer from the posting)"}
Role: ${job.role || "(not stated, infer from the posting)"}
Anything the candidate wants emphasised: ${job.notes || "(none)"}

JOB DESCRIPTION
"""
${job.description.slice(0, 40_000)}
"""

CAREER MEMORY
The only source of facts. Sections are user-defined, so read the titles rather than
assuming software categories.
${JSON.stringify(profile, null, 2)}
${consistency}${avoid}${repair}
CHOOSE A STRUCTURE
Pick the one the evidence best supports. Do not default to the first.
1. The artefact: open with the thing they made that matters to this employer.
2. The constraint: open with the hard constraint in the posting, then the work done
   inside exactly that constraint.
3. The correction: open with the assumption most people in this field make, and the
   evidence from the candidate's record that complicates it.
4. The scene: one concrete moment of doing the work, then what it generalises to.
5. The before and after: what the state of things was, what changed, what it cost.

Return a JSON object with exactly these keys:

{
  "subject": "a subject line such as 'Application for <role>'; no 'Re:', no exclamation mark",
  "greeting": "Dear ...,",
  "paragraphs": ["paragraph one", "paragraph two", "paragraph three"],
  "closing": "Sincerely,",
  "angle": "one or two sentences for the candidate: the argument the letter makes, and why it fits this posting",
  "structure": "the name of the structure only, e.g. \"The correction\"; put the reasoning in angle",
  "evidence": ["the specific memory facts the letter relies on, near-quoted"],
  "notes": "what you deliberately left out, and why"
}

RULES
- Every paragraph must be plain prose, written out in full. No placeholders.
- "paragraphs" is body prose only. Never put the greeting, the sign-off, the date, or
  the candidate's name in it; those are separate fields and would print twice.
- The subject line and greeting are printed as given; keep them short.
- "evidence" must quote only facts that appear in the memory.
- If the memory has no number to use, do not invent one. Write without numbers.
- Do not mention that this letter was generated, and do not mention AI.`;
}
