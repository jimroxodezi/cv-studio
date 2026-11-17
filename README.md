# CV Studio

A multi-user web app around the CV system in the parent folder: one career
memory per person, several CV variants, and a tailored LaTeX CV for every job
application. Built for a small group of friends, not a public job board.

- **Career memory** — a structured, editable source of truth built from a pasted
  dump, PDF, DOCX, or manual entry.
- **Variants** — saved career angles (AI, backend, telecom, research, general)
  that select entries and compile a base CV.
- **Applications** — paste a posting or a link, get keyword coverage, gaps,
  rewritten bullets, a PDF, and the `.tex` source. Every build is versioned.
- **Cover letters** — written from the posting and the memory, checked against a
  list of template phrases, and editable line by line before the PDF is rebuilt.
- **Snapshots** — clearing, importing a new dump and restoring all snapshot the
  memory first, so every destructive action is reversible. You can save your own
  checkpoints too.
- **Truthfulness check** — every number and date in a tailored draft is compared
  against the memory; untraceable claims are flagged before download.
- **Real LaTeX** — compiled server-side with the same single-column, table-free
  layout as the parent repo, so ATS parsers read it in order.

## Run it locally and share it

Everything runs on this machine; [Tailscale Funnel](https://tailscale.com/kb/1223/funnel)
publishes it on a fixed HTTPS address without opening a port or owning a domain,
and visitors do not need Tailscale installed. The image is about **66 MB
compressed** and idles at roughly **60 MB RSS**; a PDF compile peaks around
150 MB.

```bash
cd cvstudio
cp .env.example .env
openssl rand -base64 48   # paste into AUTH_SECRET
openssl rand -base64 32   # paste into ENCRYPTION_KEY
# set ADMIN_EMAIL, and APP_URL to your Funnel address
docker compose up -d --build
sudo tailscale funnel --bg 3000
```

`sudo tailscale funnel status` prints the public address, for example
`https://your-machine.your-tailnet.ts.net`. The app is also on
<http://localhost:3000>. The address never changes, so links and 30-day
sessions keep working across restarts.

Sign in with `ADMIN_EMAIL`; the first sign-in creates the admin account. No
email is configured by default, so the sign-in link is printed in the log:

```bash
docker compose logs -f app | grep auth/verify
```

Then open **Admin → Invite someone**, enter a friend's address, and copy the
link the page shows into WhatsApp or email. Each link works once and signs that
person in for 30 days.

Notes:

- Users are invite-only (`ALLOW_OPEN_SIGNUP=false`). Everyone sees only their
  own memory, variants, jobs and PDFs.
- To send links by email instead, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
  `SMTP_PASSWORD` and `MAIL_FROM` (for example a free Resend account, SMTP on
  port 587). The admin then no longer has to copy links by hand.
- Links are built from the host the browser used, so `APP_URL` only matters as
  the fallback for requests with no forwarded headers.

### Tailscale setup (once per machine)

```bash
sudo tailscale up                  # log in if this is a new machine
sudo tailscale funnel --bg 3000    # https://<machine>.<tailnet>.ts.net
sudo tailscale set --operator=$USER  # optional: stop needing sudo
sudo tailscale funnel --bg off     # stop sharing
```

The first `funnel` run may print a link to enable HTTPS certificates and Funnel
for your tailnet; click it once. The app stays bound to `127.0.0.1:3000` and
Funnel proxies to it. Nothing else needs to be exposed.

## Local development

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run db:migrate
npm run dev
```

The app needs:

- Node 24+
- PostgreSQL 17+
- a TeX Live distribution with `pdflatex` and `lmodern`

On Debian/Ubuntu:

```bash
sudo apt-get install texlive-latex-base lmodern
# The style files normally shipped in texlive-latex-recommended/-extra:
mkdir -p ~/texmf/tex/latex/cv-studio
cp latex/vendor/*.sty latex/vendor/*.cfg latex/vendor/*.def ~/texmf/tex/latex/cv-studio/
```

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Signs the session cookie. Use 32+ random bytes. |
| `ENCRYPTION_KEY` | Encrypts users' API keys at rest (AES-256-GCM). 32 bytes. |
| `APP_URL` | Public URL, used in magic links and origin checks |
| `ADMIN_EMAIL` | First sign-in with this email becomes the admin |
| `ALLOW_OPEN_SIGNUP` | `false` by default; keep invite-only |
| `DEFAULT_LLM_PROVIDER` | `openai`, `anthropic`, `openrouter`, or `deepseek` |
| `DEFAULT_LLM_API_KEY` | Server fallback key for users without their own |
| `DEFAULT_LLM_MODEL` | Default model id |
| `DEFAULT_LLM_BASE_URL` | Optional OpenAI-compatible gateway |
| `FREE_GENERATIONS_PER_DAY` | Daily cap when the server key is used |
| `SMTP_*`, `MAIL_FROM` | Magic-link and invite email |
| `LATEX_MAX_CONCURRENCY` | Parallel PDF compilations (default 1; raise only with spare RAM) |

Users can add their own OpenAI, Anthropic, OpenRouter, or DeepSeek key in **Settings**.
For DeepSeek use `deepseek-chat` (or `deepseek-reasoner`) as the model.
Keys are encrypted before they touch the database and are never sent back to
the browser.

## How tailoring works

1. The posting is extracted from text or fetched from a URL (SSRF-guarded).
2. The model receives the full career memory, the chosen variant, and the
   posting. It returns structured JSON: analysis, selected entries, rewritten
   bullets, skill groups, and keyword coverage.
3. The app validates entry IDs against the memory, checks every number and date
   for traceability, and flags anything on the `doNotClaim` list.
4. The structured result is rendered into the same LaTeX macros used in the
   parent repo, compiled in a temporary directory with shell escape disabled,
   then stored as a versioned document.
5. You review the PDF, the coverage, and the gaps, and download the PDF or the
   `.tex` source.

## How cover letters work

1. The same posting and career memory feed a separate writing brief. If the CV has
   already been tailored, its analysis, positioning, and gaps are passed in so the
   letter cannot contradict it.
2. The brief is opinionated on purpose: the letter opens on a concrete artefact or
   constraint rather than announcing itself, develops one centrepiece of evidence,
   and closes on a specific first move. Template language is banned by name.
3. The draft is checked against a fixed list of phrase-level tells
   (`SLOP_PHRASES`, `SLOP_OPENERS`). If it trips them, one repair pass rewrites it
   from scratch; the cleaner of the two drafts is kept.
4. Number claims are checked like the CV, including spelled-out scope such as
   "three programs" — the most common way a letter borrows the employer's numbers
   as the candidate's own.
5. The letter is stored as structured text plus a compiled PDF, so it can be edited
   line by line and rebuilt without another model call. Recent letters on the same
   application are used to steer the next draft onto a different structure.

Letters use `latex/letter-preamble.tex`, not the CV preamble. It deliberately keeps
`\documentclass` at 10pt: the production image ships Latin Modern only, and an
11pt base makes the class demand Computer Modern metrics that are not there.

## Snapshots

Every destructive path keeps a copy first, in `profile_snapshots`:

| Trigger | Reason | When |
|---|---|---|
| "Clear everything" | `clear` | before the memory is wiped |
| Import a new dump | `import` | before the whole memory is replaced |
| Restore an old snapshot | `restore` | before the live memory is overwritten |
| "Save snapshot" | `manual` | whenever you want a checkpoint |

The last **20 automatic** snapshots are kept per user; automatic means anything with a
reason other than `manual`. Manual snapshots stay until deleted. A restore also
re-points variants at section ids that exist, so nothing builds against a memory that
no longer has them. Snapshots after a restore are only taken when the live memory has
content, so clearing-then-restoring does not pile up empty copies.

## Editing and clearing the memory

The profile page edits the memory in place: add or remove sections, rows, bullets,
labelled lists, and guardrails, then save. `POST /api/profile/clear` wipes it back to
an empty profile — same account, same name — and clears the saved source text. It
requires `{"confirm": "CLEAR"}`, and it re-points every variant at the empty sections
so nothing references ids that no longer exist. The UI sends you straight to the
import screen afterwards, which is the intended path: clear, then paste or upload a
fresh dump.

## Data model

- `users` — account, role, encrypted provider keys
- `invites` / `auth_tokens` — invite-only magic-link auth
- `profiles` — one career-memory JSON document per user
- `variants` — selected entry IDs, summary, section order, page target
- `jobs` — posting, analysis, result, notes, status
- `documents` — versioned LaTeX source, PDF bytes, page count, ATS text, warnings.
  `kind` is `variant`, `tailored`, or `cover_letter`; letters keep their editable
  text in `meta.letter`.
- `usage_events` — daily limits for the shared server key

## Security notes

- Session cookie is HttpOnly, SameSite=Lax, signed with `AUTH_SECRET`, and
  `Secure` when `APP_URL` is HTTPS.
- API keys are encrypted at rest with AES-256-GCM.
- All POST/PUT/DELETE routes check `Origin`.
- Job URLs are fetched with DNS resolution and a private-address blocklist;
  redirects are revalidated. If a site blocks the fetch, paste the text.
- LaTeX runs with `-no-shell-escape`, `openin_any=p`, `openout_any=p`, a timeout,
  and a temp working directory. Generated text is escaped before it reaches
  LaTeX.
- PDFs and career data live in Postgres. Back up the database, not a folder.

## Known limitations

- The shared server key has a per-user daily cap; it is not a billing system.
- URL fetching cannot get past login walls or aggressive bot protection.
- The truthfulness check catches **numbers** (digits and spelled-out scope) and the
  `doNotClaim` list, not every possible unsupported claim. A letter can still assert
  experience in non-numeric form. Read the warnings and the draft.
- The letter writer never blocks on a warning; it reports. A warning is a prompt to
  edit, not a failure.
- One page is the default; research CVs can target two. The app reports the
  page count but does not automatically tighten content to fit.
- No password reset, because there are no passwords. Revoke access by deleting
  the user row (and their data cascades).

## Sibling repo

This app grew out of the single-user LaTeX workspace in `../cv`, which holds
`master/career.md`, `content/`, `variants/`, `jobs/`, and `prompts/`. That repo
still builds one-off CVs with `./build.sh`; this one owns the web app. They share
exactly one file: `latex/preamble.tex` here is a copy of `../cv/template/preamble.tex`.
When the shared layout changes there, copy it here and rebuild the image.
