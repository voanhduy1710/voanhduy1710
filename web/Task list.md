# Task list

## 2026-11-05 — Cleanup
- ✅ Deleted the local backup/pre-cleanup branch (last copy of DEPLOY_SCRIPTS.md and the old UI commits); only main remains

## 2026-11-05 — LinkedIn link
- ✅ LinkedIn: the old link is right → https://www.linkedin.com/in/duy-v-983894369/ (README.md, READMEVN.md, CV_EN/VN.html, test fixtures; PDFs re-exported, 1 page each). Other public repos have no LinkedIn link.

## 2026-11-05 — Final ship
- ✅ Commit (0c07570) + push + deploy with deploy_vercel.ps1 (content 0c07570); live tester: site 73/73, speed 58/58, 125/125 files

## 2026-11-05 — Vercel Git deploys
- ✅ Turned off Vercel Git auto-deploys (`vercel git disconnect`): pushes no longer create (failing) deployments; deploy only with web\deploy_vercel.ps1. Cause of the failure emails: project Root Directory "." (repo root) instead of web/. To reconnect later: Vercel → Project voanhduy1710 → Settings → Git (and set Root Directory to web).

## 2026-11-05 — CV as HTML
- ✅ CV source = HTML: web/public/cv/cv.css (shared design, one `--cv-accent` variable) + CV_EN.html + CV_VN.html (from CV_mockup.html, Pine); YAML files, YAML loader/tests and the `yaml` dependency removed; `npm run check:cv-html` warns when EN/VN drift apart (--strict fails; project_tester runs it strict) (uncommitted)
- ✅ Update the CV PDFs + the website CV page from the HTML (1 A4 page rule kept): /{lang}/cv renders the HTML sheet; owner colour picker now sets `--cv-accent`; export_cv.ps1 + `npm run check:cv` print the HTML files directly (no build), fail + keep the old PDFs on >1 page (uncommitted)
- ✅ Remove the mockup file (CV_mockup.html)
- ✅ Re-export CV_Vo Anh Duy_EN.pdf + CV_Vo Anh Duy_VN.pdf from the new HTML (1 A4 page each; uncommitted)

## 2026-11-05 — CV colours + account login
- ✅ "Allow new users to sign up" turned OFF in Supabase (verified 2026-11-05: disable_signup=true; project-wide — also affects the QR app and gift app on the same project). To turn it back on later: https://supabase.com/dashboard/project/sudfxyhjksqjmarwcevp/auth/providers (Authentication → Sign In / Providers → Allow new users to sign up)
- ✅ CV mockup colour: Pine (#1f4d3a); "Selected Projects" → "Projects"
- ✅ Account menu (activity bar): add Log in — Supabase Auth, one account voanhduy1710 with a one-time password (owner changes it himself); no registering, login only (Opus) — account created; temp password in web/.owner-login.local.txt (gitignored: change it via menu → Change password, then delete the file); no sign-up UI; sign-ups disabled server-side (re-checked 2026-11-05 after the build: disable_signup=true); uncommitted
- ✅ Logged-in feature: CV section → pick the CV colour from the CV_colors.html choices (+ blue tones) or a free colour picker, to match a company's colour (Opus) — /{lang}/cv "Colour" button when logged in: 26 presets (+ Blues), picker + hex field, low-contrast warning, saved per account (cv_preferences, RLS) → Print / Save as PDF uses it; public CV accent is now Pine; committed PDFs not re-exported; uncommitted

## 2026-11-05 — CV mockup
- ✅ Mockup of my CV as an HTML file in the root folder, but better → C:/voanhduy1710/CV_mockup.html (1 A4 page; newest facts from README; review notes on screen; uncommitted)

## 2026-11-05 — README in the explorer
- ✅ README row in the explorer UI should open README.md (/en) / READMEVN.md (/vi) inside the site, not the GitHub profile (new page /{lang}/readme: markdown preview in an editor tab, row + tab labelled README.md / READMEVN.md, "View on GitHub ↗" at the top; uncommitted)

## 2026-11-05 — Lazada Power BI link
- ✅ Portfolio-projects: Lazada dashboard link bit.ly → direct app.powerbi.com link (565c4c5: README.md, READMEVN.md, 5. Lazada Sales Report/README.md); website re-synced, button uses it (uncommitted)

## 2026-11-05 — Remove dashboard sentences
- ✅ Uber Trips, Supply Chain & Sales, Lazada: removed the "Analyzing … Interactive dashboard can be found here (Full details …)" paragraph from the web UI (EN + VI); the button already links the dashboard; README on GitHub unchanged

## 2026-11-05 — Commit + CV fix
- ✅ Commit and push (a19c589 CV YAML, 181f776 BI split + Lazada + icons; pushed, not redeployed)
- ✅ Pull back my old CV (CV_Vo Anh Duy_EN.pdf / CV_Vo Anh Duy_VN.pdf restored from git = the original 2025 CV, 1 page each) (cv.en/vi.yaml now hold the June 2025 CV word for word, and the template copies its layout. Exceptions: the current LinkedIn URL is used, MongoDB is back as on the old CV, and the page is now A4 instead of Letter. PDFs re-exported; uncommitted)
- ✅ Add rule: CV => only 1 A4 page (`npm run check:cv` prints both languages with Chrome and fails if either is longer than 1 page; it also runs in project_tester Part 2. export_cv.ps1 refuses to replace the PDFs on overflow. The on-screen sheet marks where the A4 page ends)

## 2026-11-05 — Website domain links
- ✅ Replace voanhduy1710.dev with voanhduy1710.vercel.app in all public repos (commits: Certifications 7764fb4, Other-private-repo-previews 4426d9a, Portfolio-projects e2b19ba; others had no match)

### Where the website link lives (find & replace these when the domain is bought)
| Repo | File | Line | Link now | Note |
|---|---|---|---|---|
| voanhduy1710 | README.md | 6, 235 | vercel.app | content (header link + Contact Website) |
| voanhduy1710 | READMEVN.md | 6, 235 | vercel.app | content (header link + Contact Website) |
| Portfolio-projects | README.md | 150 | vercel.app | content |
| Portfolio-projects | READMEVN.md | 152 | vercel.app | content |
| Certifications | README.md | 55 | vercel.app | content |
| Other-private-repo-previews | README.md | 93 | vercel.app | content |
| voanhduy1710 | web/src/lib/i18n/paths.ts | 15 | vercel.app | code: SITE_URL constant, change on domain purchase |
| voanhduy1710 | web/src/lib/content/index.ts | 51 | vercel.app + .dev | code: WEBSITE_HOSTS accepts both hosts; add the new domain, keep both |
| voanhduy1710 | web/deploy_vercel.ps1 | 234 | vercel.app | code: final message URL |
| voanhduy1710 | web/project_tester.py | 19, 53 | vercel.app | code: LIVE_URL for --live run |
| voanhduy1710 | web/tests/content/load.test.ts | 60, 66, 68, 72, 76-77 | vercel.app + .dev | tests: .dev lines are intentional (second host); keep both / switch when domain bought |
| voanhduy1710 | web/tests/content/parse-simple.test.ts | 52, 166 | vercel.app | tests |
| voanhduy1710 | web/tests/cv/cv-document.test.tsx | 32 | vercel.app | tests |
| voanhduy1710 | web/tests/fixtures/README.md | 6, 234 | vercel.app | test fixture (copy of README) |
| voanhduy1710 | web/tests/fixtures/READMEVN.md | 6, 234 | vercel.app | test fixture (copy of READMEVN) |
| voanhduy1710 | web/tests/proxy.test.ts | 9, 11, 17, 18 | vercel.app | tests (proxy redirects) |
| voanhduy1710 | web/tests/shell/activityLinks.test.tsx | 13 | vercel.app | tests |

Hint: when the domain is bought, also add it as a Vercel project domain + DNS records, then update SITE_URL (paths.ts), WEBSITE_HOSTS (content/index.ts), LIVE_URL / deploy script URL, and the README links above.

## 2026-11-05 — Lazada Sales Report
- ✅ Excel – Adidas Sales: Excel icon instead of Power BI (rule: Excel without Power BI)
- ✅ Update the web with the new "5. Lazada Sales Report" and the renamed files in Portfolio-projects (3d8dfeb) (7 analyses; /{lang}/projects/data-analyst-portfolio/lazada-sales-report; Power BI icon + dashboard button via its bit.ly link; SQL/Apps Script read 6./7. files; old slugs unchanged; uncommitted)

## 2026-11-05 — CV file
- ✅ CV as its own file, separate from the README (goes through HR): YAML (web/public/cv/cv.en.yaml + cv.vi.yaml — owner: move into web/public) + one template (strict validation + EN/VI parity check fail the build; also served at /cv/cv.*.yaml; uncommitted)
- ✅ Downloadable as PDF; synced to CV_Vo Anh Duy_EN.pdf / CV_Vo Anh Duy_VN.pdf in the repo (web\export_cv.ps1 regenerated both: 2 A4 pages each, selectable text, no MongoDB)
- ✅ Viewed in the web UI (explorer CV row) (/{lang}/cv renders the YAML; row, tab and Download PDF unchanged)

## 2026-11-05 — BI projects
- ✅ Separate the BI projects: one page per analysis (6 pages × EN/VI at /{lang}/projects/data-analyst-portfolio/<analysis>, own explorer rows + tabs; overview page now lists them as cards; uncommitted)
- ✅ Add "Interactive dashboard can be found here" link for the Power BI ones that have it (found in the repo) (Uber Trips + Supply Chain: README link works, plus a yellow "Open interactive dashboard ↗" button)
- ⚠️ Update the README instead of hyperlinking to GitHub; read from README.md / READMEVN.md — MISREAD: owner meant the explorer README row (open README.md / READMEVN.md in the site instead of linking to GitHub); redone under "2026-11-05 — README in the explorer". What was built here instead: (repo-relative links unlinked; SQL questions + Apps Script shown in-page; only a "Repository ↗" link remains)
- ✅ Change the SQL interview questions and the Apps Script rows to another logo (database icon + Apps Script fan icon, chosen from each section's skills line; Excel/others can get a rule later)

## 2026-11-05 — Ship
- ✅ Commit + push + redeploy to Vercel (f65b16d fix, 7bed0dc tester; live tester run 99/99)

## 2026-11-05 — Tester run
- ✅ Update CLAUDE.md with the new task list place (web/Task list.md)
- ✅ Run the project tester and check for bottlenecks (local + live all pass; main bottleneck: BI dashboard screenshots 626/433/212 KB)

## 2026-11-05 — Project tester
- ✅ Create web\project_tester.py based on C:\Atino-tong-hop-approval-web\project_tester.py, to run tests (suites, build + link check, site crawl, speed; passes locally and with --live)

## 2026-11-05 — Console error
- ✅ Cron job visible in Vercel (owner checked)
- ✅ Speed test after initial load: wait 5 s like a real reader, then time tab/page switches; write results to an md file (Sonnet) — stopped by owner before the report was written
- ✅ Fix "Encountered a script tag while rendering React component" (new SidebarWidthBoot: script only on server/hydration; next/script hit the same error on language switch) — uncommitted, deploy after speed test
- ✅ bug_logs.md check: ReferenceErrors were mid-edit states of the fix (gone); fixed logo "width or height modified" warning (SkillsSection 96×96 + sizes=48px) and title-bar icon LCP warning (loading="eager"); Chrome "Lazy-loaded images should have explicit dimensions" gone (logo box w-10 h-7, object-left)

## 2026-11-04 — Ship it
- ⏸ CV PDFs still mention MongoDB — owner: ignore for now
- ✅ After the sub-agents finished: committed (clean history: 9a70ba8 + 843583c, DEPLOY_SCRIPTS.md + old UI iterations gone), force-pushed main, deployed to Vercel (live, checks pass)

## 2026-11-04 — Remove MongoDB
- ✅ Remove MongoDB from the repo: logo in README.md + READMEVN.md, test fixtures, web\public\logos\MongoDB.png deleted, test counts updated
- Remove MongoDB from the CV PDFs: regenerate CV_Vo Anh Duy_EN/VN.pdf with export_cv.ps1 (old PDFs still say "NoSQL: MongoDB"; waits for the running build agents)

## 2026-11-04 — Speed audit
- ✅ Opus: test switching between pages + loading, compare speeds, report the bottlenecks (perf-report.md)
- ✅ Goal: after initial load, switching feels almost instant — every switch is a cache hit, warm < 100 ms; EN↔VI / CV first render / back-to-home still 100–300 ms of main-thread work
- ✅ Initial load order: About Me + My works first → BI projects → rest (Task 15l scheduler; PDFs skipped on slow links)
- ✅ Matrix hand adaptive quality (30 fps/12 streams → 15 fps → 8 streams on slow devices)

## 2026-11-04 — Cloudflare logo
- ✅ Add web\public\logos\Cloudflare.png: tech-stack strip (after Railway) + Cloud & DevOps skills row, both READMEs

## 2026-11-04 — Order + CV size
- ✅ Move Caro app to the bottom of My works (README.md + READMEVN.md order, previews too)
- ✅ Q: is the HTML CV A4? → yes (print: @page A4, 12 mm margins; screen: 210 mm-wide page)

## 2026-11-04 — Experience text
- ✅ Justify the Experience bullet text (left-aligned on phones)

## 2026-11-04 — Vietnamese project READMEs
- ✅ READMEVN.md for each project repo, one Sonnet each, pushed (7 READMEs / 4 repos)
- ✅ Site uses READMEVN.md on /vi (switch line dropped, no EN-only note, shared images, VI anchors work)
- ✅ /vi/projects/atino-workspace missing an image → same root cause as BI (stale dev cache), fixed

## 2026-11-04 — Load order
- Preload in order: public (About Me…) → My works → BI projects → Certifications; first 2 prioritized (Task 15l, queued after the BI image fix)

## 2026-11-04 — Power BI images still missing
- ✅ Power BI projects still missing images → root cause: dev server cached the old manifest; fixed + BI home card uses first README image

## 2026-11-04 — Tech skills, WebP, contact test, cleanup
- ✅ Skills sub-heading → "Tech skills"
- ✅ Convert BI / project README images to WebP at build time (BI 11.8 MB → 1.4 MB)
- ✅ Send one real test message through the contact form (emailed + saved to Supabase)
- ✅ Matrix hand mockup: shape fixed, denser mono rain, default tilt −30°
- ✅ Build the matrix hand into the hero (Task 15k): done (−30°, continuous 1.5 s wave, 12 streams, 2× size ~192 px); at 4× CPU throttle the hero runs below 55 fps, owner to decide
- History cleanup approved: also remove DEPLOY_SCRIPTS.md from history (at commit time, force push)

## 2026-11-04 — Final review fixes + owner addenda (final2, uncommitted)
- ✅ Contact time trap uses form-open time (elapsedMs), not the visitor's clock; "reload the page" message for stale
- ✅ project_structure.py / Project_structure.txt git-ignored
- ✅ Minor review items (GITHUB_TOKEN sync, fetch timeouts, README note, /about redirect, query kept on /, x-default home only, comments, de-dup, activity bar label)
- ✅ Glowing icons on home section headings (briefcase, book, archive, envelope) + fade-in
- ✅ BI project page shows its repo README with all 6 dashboard images
- ⚠️ BI explorer rows open the page top (no scroll to the matching item: README items and profile bullets do not line up by name)
- ✅ Contact Links row: Email chip removed
- ✅ Message placeholder "Leave a message" / "Để lại lời nhắn"
- ✅ Project pages: links row directly after the title

## 2026-11-04 — Contact + project links
- Remove the Email button from the Contact links (queued)
- Message field hint "What would you like to talk about" → "Leave a message" (queued)
- Move "Live Platform: … / Repository ↗" to right after the project title, all projects (queued)

## 2026-11-04 — BI project images
- BI projects show their images, read from github.com/voanhduy1710/Portfolio-projects (full README + dashboards; queued with final fix wave)

## 2026-11-04 — Glowing section icons
- Work Experience: glowing icon like the reference (briefcase, orange glow) (queued with final fix wave)
- Same for Skills (book, purple), Projects (archive, yellow), Contact Me (envelope, blue) (queued)

## 2026-11-04 — Project page duplicates
- ✅ Remove the duplicated title + badges at the top of project pages
- ✅ Remove the "README.md" label bar
- ✅ Keep "Live Application: …" + "Repository ↗" links
- ✅ Fix console error "two children with the same key cert:7"

## 2026-11-04 — Default language
- Default EN/VI by visitor: remembered choice → country (VN → vi) → browser language → en; only for the bare address (Task 15h, queued after 15g)

## 2026-11-04 — CV name in explorer
- ✅ Explorer CV row shows CV_Vo Anh Duy_EN.pdf / CV_Vo Anh Duy_VN.pdf by language
- ✅ Reorder root files: CV first, README.md, then config files
- ✅ GitHub icon + link in the left icon bar, below Extensions
- ✅ EN and VI both preloaded → switching language is instant (46–96 ms on prod build)
- ✅ Switching language keeps the scroll position
- ✅ Q: does the CV read straight from the README? → yes (web CV page renders the README at build/dev time; the PDFs are snapshots from export_cv.ps1)

## 2026-11-04 — My works from repos
- ✅ My works project pages read the full README from each project's own repo (all public; Task 15g done, uncommitted, awaiting review)

## 2026-11-04 — Headings
- "## Tech stack" → plain bold "Tech stack"; "## Skills matrix" → bold "Skills"; same for all other "## …" headings (sent to implementer)

## 2026-11-04 — Supabase + keep-alive + sync bug
- Contact form saves to Supabase (project curriculum-vitae, restored) + emails via Resend (in progress)
- Daily Vercel ping keeps Supabase awake (/api/keepalive + Vercel Cron, in progress)
- Fix deploy_local EPERM bug (dev server already running held the files; in progress)
- ✅ Owner added SUPABASE_SECRET_KEY, RESEND_API_KEY, CRON_SECRET to web\.env
- ✅ Supabase table contact_messages created (private: RLS on, only the website server can write)

## 2026-11-04 — Unify CV
- Unify CV: one source = web CV page (/cv, from README) → export to CV_Vo Anh Duy_EN.pdf / _VN.pdf when needed (Task 15f)
- ✅ Fix references to renamed PDFs: README.md + READMEVN.md links done; web/ scripts/tests/docs in Task 15f

## 2026-11-04 — Skills table, contact form, icons
- Skills section as a table like the README (Task 15f)
- Remove file-name captions like "// experience.md" (Task 15f)
- Contact Me form: visitors enter their info (name, email, company, message) → emailed via Resend (Task 15f)
- Spam blocking: honeypot, time trap, rate limit, content checks (Turnstile optional later) (Task 15f)
- Restore icon in the title bar looks broken → redraw (Task 15f)
- Owner to do: create Resend account + API key → put RESEND_API_KEY in web\.env

## 2026-11-04 — Certs, resize, N button
- ✅ Q: what is Ctrl+P → browser print shortcut (print preview of /en/cv)
- ✅ README summary edit (Data Analyst → Data Specialist): include in commit = yes (noted for the commit step)
- ✅ Middle-click works (owner checked)
- Certifications open as PDFs in the web UI, loaded from github.com/voanhduy1710/Certifications (Task 15e)
- Explorer width adjustable by dragging (Task 15e)
- Remove the Next.js "N" button (dev-only indicator; Task 15e)

## 2026-11-04 — Small tweaks
- ✅ Browser tab icon → VS Code one (old favicon.ico removed)
- ✅ BI projects + Certifications folders collapsed by default
- ✅ EN/VI toggle: one click switches to the other language

## 2026-11-04 — VS Code icon
- Use web\public\vscode_icon.webp as the VS Code icon (title bar + browser tab), replacing the self-drawn one (sent to Task 15c)

## 2026-11-04 — Explorer folders
- public/ and src/ folder icons like the reference (globe badge / <> badge) (Task 15c)
- src/ gets 3 folders: My works, BI projects, Certifications (Task 15c; content from README)

## 2026-11-04 — Explorer files + cleanup
- Remove about_me.ts from the explorer (Task 15c, queued after 15b)
- Add .gitignore, .vercelignore, package.json, tsconfig.json (+ next.config.ts as the extra pick) at the root of the explorer; clicking shows the real file contents (Task 15c)
- Two .gitignore files → keep one (merge web\.gitignore into the root one, delete web\.gitignore) (Task 15c)
- ⏸ Remove web\DEPLOY_SCRIPTS.md and scrub it from commit history — NOT YET, do it during the later history cleanup (touches commits 983cb20, 4f5b8af, a8f48b9; needs force push)

## 2026-11-04 — Remove Education + speed
- Remove Education from the website (Task 15b; stays in README + CV)
- Clicking is slow → make it near-instant like the reference (Task 15b: one page with sections, scroll instead of page loads; project pages prefetched)

## 2026-11-04 — Tab icon → VS Code icon
- Remove web\public\Icon.svg, use the VS Code-style icon instead (in progress, uncommitted)
- ✅ Q: is there a VS Code icon file? → no, it's drawn in code (RibbonMark in web/src/components/shell/icons.tsx); being exported to web/public/vscode-mark.svg for the tab

## 2026-11-04 — Selected file highlight
- ✅ Selected explorer file highlighted like real VS Code (grey row background) instead of the reference's [ ] brackets (uncommitted, live on localhost:3010)

## 2026-11-04 — EN/VI position
- ✅ Move EN/VI into the EXPLORER header, before "···" (also kept in the Settings activity menu; removed from the menu bar)

## 2026-11-04 — Project structure script
- ✅ Move project_structure.py + Project_structure.txt into web\
- ✅ Still scans the whole repo as if run from root (works from any folder; writes web\Project_structure.txt); kept out of Vercel uploads

## 2026-11-04 — .env
- ✅ Move .env into web\ (C:\voanhduy1710\web\.env; gitignored + .vercelignore'd; contents not read)

## 2026-11-04 — Review before commit
- Shell v2 must appear on localhost:3010 so owner can check before committing/deploying (Task 15 left uncommitted)
- Later: clean up commit history to remove the ugly-UI commits (needs owner go-ahead: force push to public repo)

## 2026-11-04 — Build shell v2 into the site
- ✅ Runs smoothly like the reference (opacity-only CSS tiles, no timers: 60 fps idle, also at 4x CPU throttle, no long tasks)
- ✅ Clicking explorer items auto-opens a new tab (also Run and Debug / Extensions; tabs survive EN/VI)
- ✅ Middle-click closes a tab (tabs and OPEN EDITORS; no autoscroll)
- ✅ Then implement the mockup into the live site (uncommitted, for owner review)
- ✅ Top-left icon → VS Code icon (own VS Code-style SVG; official logo is a Microsoft trademark)

## 2026-11-04 — Mockup v2 tweaks 2
- ✅ about_me.tsx → about_me.ts
- ✅ Typing roles focus on data + internal web apps (Full-Stack Data Specialist, Data Analyst, Internal Web App Developer, BI & Reporting Automation) — no DevOps-type roles
- ✅ Remove the wave emoji after "Vo Anh Duy"

## 2026-11-04 — Mockup v2 tweaks
- ✅ Move EN/VN to after the Help button (menu bar EN | VI switch; removed from status bar)
- ✅ Colours → VS Code dark mode black (Dark Modern palette, neutral tiles with a few blue ones)
- ✅ Explorer sub-items like screenshot (indent guide + corner brackets on the selected item)

## 2026-11-04 — Shell v2 mockup (closer to reference)
- ✅ Missing bars (menu bar File/Edit/Selection…, window controls, layout icons) — in mockup
- ✅ No red/yellow/green Mac dots — Windows-style controls in mockup
- ✅ Other buttons look like VS Code (activity bar icons etc.) — in mockup
- ✅ Add the animated slanted square tiles background — in mockup (own code)
- ✅ Mockup only, don't implement — C:\voanhduy1710\.superpowers\mockups\shell-v2.html, live site untouched

## 2026-11-04 — Task 9 screenshots (Haiku, mechanical)
- ✅ Start dev server on port 3010 (CONTENT_SOURCE=local) and wait for /en 200
- ✅ Screenshot /en/skills, /en/about, /vi/contact, /vi/experience at 1440x900
- ✅ Screenshot /en/skills, /en/about, /vi/skills, /vi/about, /vi/contact at 390x844
- ✅ Save all 9 files to .superpowers\sdd\PORTFOLIO_BUILD_PLAN\shots\ (task9-*.png), list console errors per page (no errors or warnings on any page)
- ✅ Stop dev server, confirm port 3010 is free

## 2026-11-04 — Tab icon
- ✅ Use web\public\Icon.svg as the browser tab icon (done in Task 9; favicon.ico kept as fallback)

## 2026-11-04 — Duy icon mockups
- ✅ Mock up the best seven ideas focused on Duy

## 2026-11-04 — Move images into web
- ✅ Move logos/ and previews/ into web/ (Task 8c → web/public/; also fixed MySQL.png/Mysql.png case mismatch)
- ✅ README reads images from there (Task 8c)

## 2026-11-04 — Personal icon mockups
- ✅ Read this project, specifically /web
- ✅ Read my GitHub to get a feel for me
- ✅ Design 7 icon mockups
- ✅ Put the files into the public folder

## 2026-11-04 — Move website
- ✅ Move website into C:\voanhduy1710\web\ (git subtree, full history kept; tests + build pass there)
- ⚠️ Delete C:\voanhduy1710-portfolio — blocked by Claude's safety check; owner deletes it manually (contents verified copied)

## 2026-11-04 — Shell looks worse than reference
- ✅ Make it look like the reference: font, icons, file types, folders (Task 8b)
- ✅ Size ×1.2 (100% zoom should look like 120% zoom now) (Task 8b, root font 120%)

## 2026-11-04 — CV download + export
- ✅ Add Download PDF (reference site has none) — added to plan: Home hero, CV page toolbar, explorer cv.pdf, activity bar (spec §6.1)
- ✅ HTML page that builds the CV, exportable to CV_DA_Vo Anh Duy_EN.pdf / _VN.pdf anytime — added to plan (Task 11 CV page, Task 12 export_cv.ps1)
- ✅ Implement it (Task 11 CV page, Task 12 export_cv.ps1)

## 2026-11-04 — Build it
- ✅ Implement everything in PORTFOLIO_BUILD_PLAN.md — T1–T13 done; merged to main, pushed, live at https://voanhduy1710.vercel.app
- ✅ Railway.png: added to tech stack (after Render) + Cloud & DevOps skills row, both READMEs
- ✅ Subagent-driven
- Opus builds the important parts (T1, T4, T5, T6, T7), Sonnet the rest

## 2026-11-04 — Go ahead
- ✅ Point README Website links to voanhduy1710.vercel.app (README.md + READMEVN.md, header + Contact)
- ✅ Plan approved → write step-by-step build plan (PORTFOLIO_BUILD_PLAN.md)

## 2026-11-04 — Plan update
- ✅ Visual direction: VS Code look like reference (plan §11)
- ✅ Domain voanhduy1710.dev not bought yet, buy later, DNS on Vercel (plan §7, §9)
- ✅ Vercel link: voanhduy1710.vercel.app (plan §7, §8)

## 2026-11-04 — Portfolio website plan
- ✅ No GitHub Action for rebuild; deploy via scripts like Caro-app (clean_restart / deploy_local / deploy_vercel), per DEPLOY_SCRIPTS.md (in plan §8)
- ✅ Vietnamese version: READMEVN.md → /vi, README.md → /en, hidden section markers (in plan §5)
- ✅ Create plan as md file in root folder (PORTFOLIO_WEBSITE_PLAN.md)
- ✅ README is like a CV (sections); webapp has many pages → each page reads its part of README (in plan §6)
