import { writeFile } from "node:fs/promises";
import { compileLetter } from "../src/lib/latex/compile";
import { renderCoverLetter } from "../src/lib/latex/letter";
import type { CoverLetter, Identity } from "../src/lib/profile";

const identity: Identity = {
  fullName: "Amara Okafor",
  email: "amara.okafor@example.com",
  phone: "+234 802 555 0134",
  location: "Lagos, Nigeria",
  website: "amaraokafor.com",
  github: "",
  linkedin: "linkedin.com/in/amaraokafor",
  x: "",
};

// Deliberately a mid-career, non-software letter, to check the layout under
// realistic prose rather than bullet text.
const letter: CoverLetter = {
  subject: "Application for Clinical Research Coordinator",
  greeting: "Dear Dr Adeyemi,",
  paragraphs: [
    "Fourteen months of consent forms, and not one missing signature. That was the small win that got me the audit role at the teaching hospital, and it is the part of research coordination I am best at: the unglamorous record that decides whether a study survives review.",
    "A multi-site oncology study needs a coordinator who can hold it together while the sponsor's monitoring visits move. I did that at Lagos State Teaching Hospital across three sites and 240 participants. I built the tracking sheet the team still uses, rebuilt the consent log after an external audit flagged it, and stayed with the queries until the database locked.",
    "I work best when the protocol and the ward disagree, because that is where studies quietly fail. At Lagos State, more than a third of scheduled visits slipped. I wrote the reason codes that showed the delays were transport, not consent, and rescheduling moved to a single day each week.",
    "I would like to talk about what your oncology portfolio needs in its first quarter. I am available to start in January.",
  ],
  closing: "Sincerely,",
  angle: "Leads with the audit save, because the posting stresses monitoring-readiness.",
  structure: "The artefact",
  evidence: ["Rebuilt the consent log after an external audit", "Three sites, 240 participants"],
  notes: "Left out the teaching work; not relevant here.",
};

async function main() {
  const body = renderCoverLetter({
    identity,
    company: "St Nicholas Hospital",
    role: "Clinical Research Coordinator",
    date: "2026-11-17",
    letter,
  });
  const result = await compileLetter(body);
  await writeFile("/tmp/cover-letter-smoke.tex", result.latex);
  await writeFile("/tmp/cover-letter-smoke.pdf", result.pdf);
  console.log({
    pages: result.pageCount,
    warnings: result.warnings,
    words: letter.paragraphs.join(" ").split(/\s+/).length,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
