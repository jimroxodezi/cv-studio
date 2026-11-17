import type { ProfileData, VariantData } from "@/lib/profile";

export const SYSTEM_PROMPT = `You are an expert CV editor and technical recruiter.

You work from a candidate's CAREER MEMORY. That memory is the only source of facts.
You may select, reorder, merge, reword, and cut. You may not invent employers, job
titles, dates, metrics, technologies, scope, seniority, or achievements. Preserve
every number and date exactly as written. If the posting asks for something the
memory does not support, record it as a gap instead of filling it in.

Writing rules:
- Resume English. No first person, no full sentences where a fragment is stronger.
- Each bullet: strong verb + specific technology + result or scope.
- No duty descriptions, no filler, no adjectives such as "passionate" or "dynamic".
- Mirror the posting's vocabulary only where the memory supports it.
- Keep company names, role titles, locations, and dates unchanged.
- One page is the default. Research roles may use two.
- Never add a skill that has no evidence in the memory.
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
Track: ${variant.track}
Selected experience IDs: ${variant.experienceIds.join(", ") || "(all)"}
Selected project IDs: ${variant.projectIds.join(", ") || "(all)"}
Selected skill group IDs: ${variant.skillGroupIds.join(", ") || "(all)"}
Selected education IDs: ${variant.educationIds.join(", ") || "(all)"}

CAREER MEMORY
${JSON.stringify(profile, null, 2)}

Return a JSON object with exactly these keys:

{
  "analysis": {
    "track": "one of ai | backend | telecom | research | general | the closest custom track",
    "seniority": "short read of the level",
    "keywords": ["hard skills and phrases the posting repeats"],
    "requirements": ["the concrete requirements, one per item"],
    "gaps": ["requirements the memory does not support"],
    "angle": "one sentence on how to position this candidate"
  },
  "document": {
    "summary": "2 sentences, tailored to this role, grounded in the memory",
    "skills": [
      { "label": "Languages", "items": ["only skills evidenced in the memory"] }
    ],
    "experience": [
      {
        "entryId": "must match an experience id from the memory",
        "bullets": [
          {
            "text": "rewritten bullet, grounded in this entry",
            "sourceBulletIds": ["ids of the memory bullets this came from"]
          }
        ]
      }
    ],
    "projects": [
      {
        "entryId": "must match a project id from the memory",
        "bullets": [{ "text": "...", "sourceBulletIds": ["..."] }]
      }
    ],
    "educationIds": ["ids from the memory"],
    "sectionOrder": ["summary", "skills", "experience", "projects", "education"]
  },
  "keywordCoverage": [
    { "keyword": "from the posting", "evidence": "where the memory proves it", "where": "CV section" }
  ],
  "gaps": ["things the posting wants that the memory cannot prove"],
  "notes": "brief internal notes on what you cut, led with, and why"
}

RULES FOR THE DOCUMENT
- Include only experience entries that earn their space for this posting.
- Keep 2-5 bullets per experience entry and 1-3 per project.
- Use the memory's original employment dates and titles. Do not change them.
- Skills may be regrouped and reordered, but every item must appear in the memory.
- If the candidate has no projects worth showing for this role, return an empty array.
- The summary must not contain a metric that is absent from the memory.`;
}

export function importPrompt(dump: string, fallbackName: string, fallbackEmail: string): string {
  return `TASK: Turn this professional dump into a structured career memory.

The dump may be messy: pasted CV text, notes, several roles, or fragments. Extract
only what is present. Do not invent missing values. Use "" for unknown text, []
for unknown lists, and false for unknown booleans. Preserve numbers and dates
exactly. If the dump explicitly says not to claim something, put it in
"doNotClaim". If a claim is ambiguous, keep it out of the main bullets and mention
it in "notes".

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
    "headline": "one line describing the candidate",
    "summary": "a neutral professional summary grounded in the dump",
    "positioning": { "ai": "", "backend": "", "general": "" },
    "skillGroups": [
      { "id": "skill-1", "label": "Languages", "items": ["..."], "tracks": ["backend"] }
    ],
    "experience": [
      {
        "id": "exp-1", "company": "", "location": "", "role": "",
        "start": "", "end": "", "current": false, "summary": "",
        "bullets": [{ "id": "exp-1-b1", "text": "" }],
        "tags": ["backend"]
      }
    ],
    "projects": [
      {
        "id": "proj-1", "name": "", "stack": "", "link": "",
        "bullets": [{ "id": "proj-1-b1", "text": "" }],
        "tags": []
      }
    ],
    "education": [
      {
        "id": "edu-1", "degree": "", "institution": "", "location": "",
        "start": "", "end": "", "details": ""
      }
    ],
    "doNotClaim": [],
    "notes": "anything ambiguous, missing, or worth confirming"
  },
  "suggestedTracks": ["short track names this candidate could target"],
  "gaps": ["important information the dump does not contain"]
}

RULES
- Split experience bullets into atomic claims. One fact per bullet.
- Keep the candidate's own wording where it is already precise.
- Do not merge different employers. Do not infer dates from job order.
- Do not turn a project into a job, or a job into a project.
- Do not add technologies that are not written in the dump.
- "suggestedTracks" should be 2-5 short labels such as ai, backend, telecom, research, general.`;
}
