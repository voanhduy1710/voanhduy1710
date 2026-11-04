# Portfolio website

`web/` is the Next.js portfolio site for the profile repo. It has no content of its own: every page is built from
`README.md` (English) and `READMEVN.md` (Vietnamese) in the repo root, plus the logos, preview images and CV PDFs they
reference.

- Dev server: `.\deploy_local.ps1` (or `npm run dev -- -p 3010`), then open `http://localhost:3010`.
- Tests and checks: `npm test`, `npm run lint`, `npx tsc --noEmit`; after `npm run build`, `npm run check:links`.

## Scripts

PowerShell scripts, all in `web/`:

| Script | Does |
| --- | --- |
| `deploy_local.ps1` | Starts the dev server on port 3010 (or says it is already running there). |
| `clean_restart.ps1` | Stops the server on port 3010 and starts it again with fresh content. |
| `export_cv.ps1` | Exports the two CV PDFs (see below). |
| `deploy_vercel.ps1` | Builds and deploys to the Vercel project `voanhduy1710`; copies the contact-form, keep-alive and `GITHUB_TOKEN` variables to production. |

## Environment variables

Set them in `web/.env` (gitignored; `.env.example` lists them) and, for production, in the Vercel project (the deploy
script copies them, except the Vercel token).

| Name | Used for |
| --- | --- |
| `VERCEL_ACCESS_TOKEN` | `deploy_vercel.ps1` only. Never committed or printed. |
| `RESEND_API_KEY` | Contact form: sends the email through Resend. Without it the form shows an email fallback. |
| `CONTACT_TO`, `CONTACT_FROM` | Contact form recipient and sender (defaults in `.env.example`). |
| `SUPABASE_SECRET_KEY`, `SUPABASE_URL` | Contact form: saves each message to `public.contact_messages`. Server-only. |
| `CRON_SECRET` | Protects `GET /api/keepalive`; Vercel sends it as a Bearer token. |
| `GITHUB_TOKEN` | Optional: lists the Certifications repo during the content sync without the 60 requests/hour limit. |

`CONTENT_REF` (set by `deploy_vercel.ps1`) pins only the profile repo's files (READMEs, CV PDFs, `.gitignore`); project
READMEs and certificate PDFs always come from `main` of their own repos (or the branch named in a project's `/tree/<branch>/` link).

## Project README images (sharp)

The content sync (`npm run sync`, run by `prebuild`) converts PNG/JPEG images from project READMEs to WebP (max 1600 px
wide, quality 82) with [`sharp`](https://sharp.pixelplumbing.com/) and serves them as `<original path>.webp`. GIFs are
kept as they are (animation); SVGs are skipped; certificate PDFs are untouched. If sharp cannot convert a file, the
sync keeps the original bytes and prints a warning, so the build never fails for this.

`sharp` is pinned in `devDependencies`. Vercel installs devDependencies for the build, and sharp ships prebuilt
binaries for Linux x64 (installed through npm's optional `@img/sharp-*` packages, so keep optional dependencies on),
so nothing else needs configuring. The converted images are static files in `public/`.

The sync also fetches `READMEVN.md` from the same folder as each project README (optional: a 404 means English only).
`/vi/projects/<slug>` renders it when present, without its `> 🇬🇧 English version` line; both languages share the
images. A running `npm run dev` picks up a re-sync without a restart (the loaders re-read synced files when they change).

## CV export

`.\export_cv.ps1` builds the site, serves it on port 3011, prints `/en/cv` and `/vi/cv` with a local Chromium browser and
writes `CV_Vo Anh Duy_EN.pdf` and `CV_Vo Anh Duy_VN.pdf` to the profile repo root (or the folder given with `-OutDir`).

## Keep-alive

`vercel.json` runs a daily cron (03:00 UTC) on `/api/keepalive`, which makes one tiny read from Supabase so the free
project is not paused for inactivity.

## Default language

The bare `/` is handled by `src/proxy.ts` (the only route it runs on, so every other page stays static). It redirects
(307, not cached) to `/en` or `/vi`: the `lang` cookie set by the EN | VI switch, else Vietnam (`x-vercel-ip-country`),
else a browser whose first language is Vietnamese, else English. Every page also lists both languages as
`<link rel="alternate" hreflang>`; the home page adds `x-default` = `/`.
