import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const steps = [
  {
    n: "01",
    title: "Dump your career once",
    body: "Paste a CV, upload a PDF or DOCX, or write rough notes. The app turns it into a structured career memory with named roles, projects, skills, and evidence.",
  },
  {
    n: "02",
    title: "Make as many variants as you need",
    body: "AI, backend, telecom, research, general — each variant picks the entries and emphasis that fit that track, and builds a clean one-page LaTeX CV.",
  },
  {
    n: "03",
    title: "Tailor to a real job",
    body: "Paste a posting or a link. The app maps requirements to your evidence, rewrites the bullets, flags gaps, and gives you the PDF plus the LaTeX source.",
  },
];

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#fef3c7_0%,transparent_38%),linear-gradient(180deg,#f8f3e9_0%,#f3ede2_100%)]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-stone-950 font-serif text-lg font-bold text-amber-400">
            C
          </span>
          <span className="font-serif text-xl font-bold tracking-tight">CV Studio</span>
        </div>
        <Link href="/login" className="btn-secondary">
          Sign in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-24">
        <section className="grid items-start gap-12 pb-20 pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:pt-16">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
              <span className="size-1.5 rounded-full bg-amber-600" />
              One memory. Every application.
            </p>
            <h1 className="font-serif text-5xl font-bold leading-[1.02] tracking-tight text-stone-950 md:text-6xl">
              Your career,
              <br />
              written once.
              <br />
              <span className="text-amber-700">Tailored every time.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-600">
              CV Studio keeps a single source of truth for your professional history, then
              turns it into track-specific CVs and job-specific applications — typeset in
              LaTeX, readable by applicant tracking systems, and honest about what your
              evidence actually supports.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn-primary px-5 py-2.5">
                Sign in to your studio
              </Link>
              <a href="#how" className="btn-secondary px-5 py-2.5">
                How it works
              </a>
            </div>
            <p className="mt-4 text-xs text-stone-500">
              Invite-only for now. Use the email your friend invited.
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-3 rotate-2 rounded-3xl bg-amber-200/50" />
            <div className="card relative overflow-hidden p-5">
              <div className="mb-4 flex items-center justify-between border-b border-stone-100 pb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  career memory
                </span>
                <span className="pill border-emerald-200 bg-emerald-50 text-emerald-700">verified facts</span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-stone-50 p-3">
                  <p className="font-semibold text-stone-900">AI Automation Lead</p>
                  <p className="text-xs text-stone-500">Minas Tech · Jan 2024 – Nov 2026</p>
                </div>
                <div className="rounded-xl bg-stone-50 p-3">
                  <p className="font-semibold text-stone-900">Product Engineer</p>
                  <p className="text-xs text-stone-500">Amaris Partners · Aug 2026 – Present</p>
                </div>
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">tailored for</p>
                  <p className="mt-1 font-medium text-stone-800">Senior Backend Engineer</p>
                  <p className="text-xs text-stone-500">matched 14 requirements · 2 gaps flagged</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="grid gap-5 md:grid-cols-3">
          {steps.map((step) => (
            <article key={step.n} className="card p-6">
              <p className="font-serif text-3xl font-bold text-amber-700">{step.n}</p>
              <h2 className="mt-4 font-serif text-xl font-bold text-stone-900">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{step.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-16 grid gap-4 rounded-3xl bg-stone-950 p-8 text-stone-300 md:grid-cols-3 md:p-10">
          <div>
            <h3 className="font-serif text-lg font-bold text-white">No invented facts</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-400">
              Every number and date is checked against your career memory. Anything that
              cannot be traced is flagged before you send it.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-white">Real LaTeX output</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-400">
              You get the PDF and the <code className="text-amber-300">.tex</code> source. Single
              column, no tables, no text boxes — so parsers read it in order.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-white">Gaps are the point</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-400">
              If a posting wants something you cannot prove, CV Studio says so instead of
              quietly filling it in. You decide what to do next.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 px-6 py-6 text-center text-xs text-stone-500">
        CV Studio · a shared tool for careful applications
      </footer>
    </div>
  );
}
