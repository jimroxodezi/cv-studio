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
  sections: [
    {
      id: "skills",
      title: "Skills",
      kind: "groups",
      groups: [
        { id: "s1", label: "Languages", items: ["TypeScript", "Go", "Python"] },
        { id: "s2", label: "Data", items: ["PostgreSQL", "Redis", "Kafka"] },
      ],
    },
    {
      id: "experience",
      title: "Experience",
      kind: "entries",
      entries: [
        {
          id: "e1",
          heading: "Senior Backend Engineer",
          subheading: "Example & Co",
          location: "Remote",
          start: "Jan 2023",
          end: "",
          current: true,
          summary: "",
          link: "",
          bullets: [
            { id: "b1", text: "Re-platformed a trading backend onto Fastify and PostgreSQL 17." },
            { id: "b2", text: "Cut p95 latency by 40% across 12 endpoints." },
          ],
          tags: [],
        },
      ],
    },
    {
      id: "projects",
      title: "Projects",
      kind: "entries",
      entries: [
        {
          id: "p1",
          heading: "Fault simulator",
          subheading: "Go, Raft, PostgreSQL",
          location: "",
          start: "",
          end: "",
          current: false,
          summary: "",
          link: "",
          bullets: [{ id: "pb1", text: "Built a TCP proxy that injects partitions and clock skew." }],
          tags: [],
        },
      ],
    },
    {
      id: "education",
      title: "Education",
      kind: "entries",
      entries: [
        {
          id: "ed1",
          heading: "B.Eng, Electrical Engineering",
          subheading: "University of Example",
          location: "Example",
          start: "2015",
          end: "2021",
          current: false,
          summary: "",
          link: "",
          bullets: [],
          tags: [],
        },
      ],
    },
  ],
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
