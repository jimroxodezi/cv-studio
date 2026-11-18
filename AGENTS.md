# AGENTS.md — CV Studio

A self-hosted, invite-only web app that turns a messy career dump into truthful,
ATS-readable CVs and cover letters. Next.js + Postgres, LaTeX compiled server-side.

## Commands

```bash
npm run dev              # local dev (needs DATABASE_URL; use the compose db)
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run build            # production build; Docker runs this too
npm run db:generate      # drizzle-kit: schema change -> new SQL migration
npm run db:migrate       # apply drizzle/*.sql (also runs on container start)
npm run smoke:latex      # compile a sample CV to /tmp
npm run smoke:letter     # compile a sample cover letter to /tmp
docker compose up -d --build   # deploy on 127.0.0.1:3000, behind Tailscale Funnel
```

`DATABASE_URL` for host commands: `postgres://cv:cv@127.0.0.1:5434/cv`.
The app container reaches Postgres at `db:5432`; both ports are loopback-only.

## The one rule

**The career memory is the only source of facts.** Models may select, reorder,
merge, reword, and cut. They may not invent employers, titles, dates, numbers,
tools, credentials, scope, or seniority. Anything the memory cannot support is a
gap, not a sentence. This is enforced in three places, and changes must keep all
three intact:

1. Prompts (`src/lib/ai/prompts.ts`) — the writing briefs.
2. `src/lib/truthfulness.ts` — number claims (digits *and* spelled-out scope such
   as "three programs"), the `doNotClaim` list, and the slop-phrase list.
3. Snapshot before destructive writes (`src/lib/snapshots.ts`).

Warnings are advisory, never blocking: the user decides what to send.

## Layout

```
src/app/                 routes; (app)/ is the signed-in shell
src/app/api/             profile, variants, jobs, documents, cover-letter
src/lib/profile.ts       zod schema for the memory; normalizeProfileData migrates old JSON
src/lib/cv-document.ts   variant + tailored result -> CvDocument
src/lib/cv-edit.ts       CvDocument + model edit -> merged CvDocument (pins identity)
src/lib/latex/render.ts  CV -> LaTeX body
src/lib/latex/letter.ts  cover letter -> LaTeX body
src/lib/latex/compile.ts pdflatex in a temp dir; preamble.tex or letter-preamble.tex
src/lib/ai/              provider client, prompts, import, tailor, cover letter
src/lib/snapshots.ts     snapshot, prune, restore, repoint variants
latex/vendor/            style files and the CV typeface for the pruned image
drizzle/                 migrations; the container applies them on start
```

## Invariants worth remembering

- **Layout fixes belong in `latex/preamble.tex`**, never in generated body text.
  `\cvsection` paces sections at a fixed distance; it must not add stretchy glue,
  or the CV grows huge gaps between sections.
- **`latex/preamble.tex` is a copy of `../cv/template/preamble.tex`.** Change the
  workspace first, then copy here and rebuild.
- **The production image ships Latin Modern plus the vendored Source Sans Pro** and a
  pruned TeX tree: Latin Modern Roman sets body copy and entry titles, Source Sans Pro
  sets the name, section titles, labels and footer. Do not add packages or fonts
  without vendoring them in `latex/vendor` (for a Type1 face: `.tfm`, `.vf`, `.pfb`,
  `.enc`, and a map line) and updating the Dockerfile keep-list.
  `letter-preamble.tex` documents why the class base size must stay 10pt.
- **Body copy is justified, with hyphenation off.** The right edge of every bullet
  must be flush; a ragged right edge is a design regression, and hyphenated words
  turn into garbage ATS keywords. Widen `\emergencystretch` before allowing
  hyphenation.
- **Page breaks are `\cvneedspace`'s job.** A section heading must never sit at the
  foot of a page, and an entry must never break between its title and its first
  bullet. Keep the fixed room in `\cvsectionroom` / `\cventryroom` ahead of the
  heading, and never put `\newpage` in generated content.
- **A generated CV is edited by prompt, never by editing LaTeX by hand.** Each build
  stores its structured source in `documents.meta.document`. An edit runs through
  `applyCvEdit`, which pins every entry's heading, employer, location and dates from
  that source, refuses ids and skill items the memory does not contain, re-runs the
  number checks, and saves a new version. Never let an edit add a fact.
- **Every new document kind** needs: a preamble (or reuse one), a renderer, storage
  in `documents` with a distinct `kind`, a filter wherever documents are listed, and
  a decision on whether it stores an editable source for prompt edits (CVs use
  `meta.document`; cover letters use `meta.letter`).
- **Section and entry ids are user data.** When the memory changes shape, run
  `repointVariants` so variants never point at ids that no longer exist.

## Deploying

The host publishes port 3000 through Tailscale Funnel; there is no domain and no
port-forwarding. After `docker compose up -d --build`, check:

```bash
curl -s localhost:3000/api/health
curl -s https://your-machine.your-tailnet.ts.net/api/health
```
