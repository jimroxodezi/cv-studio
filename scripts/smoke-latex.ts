import { renderBody, type CvDocument } from "../src/lib/latex/render";
import { compileCv } from "../src/lib/latex/compile";
import { writeFile } from "node:fs/promises";

const doc: CvDocument = {
  identity: {
    fullName: "Ada Example",
    email: "ada@example.com",
    phone: "",
    location: "Remote — UTC+1",
    website: "https://example.com",
    github: "https://github.com/ada",
    linkedin: "https://linkedin.com/in/ada",
    x: "",
  },
  summary:
    "Backend engineer who ships production systems end to end. Comfortable with PostgreSQL, Fastify, and AWS.",
  skills: [
    { id: "s1", label: "Languages", items: ["TypeScript", "Go", "Python"], tracks: [] },
    { id: "s2", label: "Data", items: ["PostgreSQL", "Redis", "Kafka"], tracks: [] },
  ],
  experience: [
    {
      id: "e1",
      company: "Example & Co",
      location: "Remote",
      role: "Senior Backend Engineer",
      start: "Jan 2023",
      end: "",
      current: true,
      summary: "",
      bullets: [
        { id: "b1", text: "Re-platformed a trading backend onto Fastify and PostgreSQL 17." },
        { id: "b2", text: "Cut p95 latency by 40% across 12 endpoints." },
      ],
      tags: [],
    },
  ],
  projects: [
    {
      id: "p1",
      name: "Fault simulator",
      stack: "Go, Raft, PostgreSQL",
      link: "",
      bullets: [{ id: "pb1", text: "Built a TCP proxy that injects partitions and clock skew." }],
      tags: [],
    },
  ],
  education: [
    {
      id: "ed1",
      degree: "B.Eng, Electrical Engineering",
      institution: "University of Example",
      location: "Example",
      start: "2015",
      end: "2021",
      details: "",
    },
  ],
  sectionOrder: ["summary", "skills", "experience", "projects", "education"],
};

async function main() {
  const result = await compileCv(renderBody(doc));
  await writeFile("/tmp/cv-studio-smoke.pdf", result.pdf);
  console.log({
    pages: result.pageCount,
    warnings: result.warnings,
    ats: result.atsText.slice(0, 300),
    pdf: "/tmp/cv-studio-smoke.pdf",
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

