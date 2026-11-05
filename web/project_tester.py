# -*- coding: utf-8 -*-
"""
project_tester.py
=================
Pre-deploy check for the portfolio website (web/). One command runs:

  1. Suites      typecheck, lint, unit tests (vitest)
  2. Build       production build (`next build`), then the link check of the prerendered pages and the
                 one-A4-page CV check (check:cv: prints public/cv/CV_EN.html + CV_VN.html with headless Chrome)
                 and the EN/VN CV drift check (check:cv-html)
  3. Site        every page reachable from /en and /vi (crawled), the images/PDFs they use, redirects, 404s,
                 the API routes' refusals (no email is ever sent, nothing is saved)
  4. Speed       first-load time of each page, and the page-switch cost: the RSC payload a click on an explorer row
                 or tab fetches (median of a few runs; already-prefetched switches in the browser are faster still)

Quick start (builds, starts `next start` on :3012, runs everything, stops it):
    python project_tester.py

Against a server that is already running (only parts 3 and 4 by default):
    python project_tester.py --base http://localhost:3010
    python project_tester.py --live                       # https://voanhduy1710.vercel.app

Main options (see --help for all):
    --only suites,build,site,speed   run only these parts
    --no-build                       reuse the existing .next build (local mode)
    --port 3012                      port for the local `next start` (the owner's dev server stays on :3010)
    --runs 3                         repeats per timing
    --json report.json               also save every check as JSON

Uses only the Python standard library. Never reads or prints .env values.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from html import unescape
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parent
LIVE_URL = "https://voanhduy1710.vercel.app"
LANGS = ("en", "vi")

# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace", line_buffering=True)
os.system("")  # enables ANSI colours in the Windows console


# ─── Colour helpers (ANSI) ───────────────────────────────────────────────────
def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m"


GREEN = lambda t: _c("32", t)
RED = lambda t: _c("31", t)
YELLOW = lambda t: _c("33", t)
CYAN = lambda t: _c("36", t)
BOLD = lambda t: _c("1", t)
DIM = lambda t: _c("2", t)


# ─── Report section ──────────────────────────────────────────────────────────
class Section:
    """Prints one pass/fail line per check and keeps the tally for the summary."""

    all_rows: list[dict] = []

    def __init__(self, title: str):
        self.title = title
        self.rows: list[tuple[str, bool, str]] = []
        print()
        print(BOLD("─" * 80))
        print(BOLD(f"  {title}"))
        print(BOLD("─" * 80))

    def group(self, name: str) -> None:
        print(f"\n  {CYAN(BOLD(name))}")

    def check(self, label: str, ok: bool, detail: str = "") -> bool:
        ok = bool(ok)
        self.rows.append((label, ok, detail))
        Section.all_rows.append({"section": self.title, "check": label, "ok": ok, "detail": detail})
        icon = GREEN("✓") if ok else RED("✗")
        tail = f"  {DIM(detail[:150])}" if detail else ""
        print(f"    {icon} {label:<62}{tail}")
        return ok

    def note(self, text: str) -> None:
        print(f"    {YELLOW('•')} {DIM(text)}")

    @property
    def passed(self) -> int:
        return sum(1 for _, ok, _ in self.rows if ok)

    @property
    def total(self) -> int:
        return len(self.rows)

    def finish(self) -> bool:
        failed = self.total - self.passed
        print(f"\n  {GREEN(f'{self.passed} passed')}  |  {RED(f'{failed} failed')}  |  {self.total} total  ({self.title})")
        return failed == 0


# ─── HTTP (stdlib) ───────────────────────────────────────────────────────────
@dataclass
class Resp:
    status: Optional[int]
    ms: float
    body: bytes = b""
    headers: dict = field(default_factory=dict)
    error: str = ""

    @property
    def text(self) -> str:
        return self.body.decode("utf-8", errors="replace")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


_FOLLOW = urllib.request.build_opener()
_NO_FOLLOW = urllib.request.build_opener(_NoRedirect)
UA = "portfolio-project-tester/1.0"


def http(url: str, method: str = "GET", headers: Optional[dict] = None, data: Optional[bytes] = None,
         timeout: int = 30, follow: bool = True) -> Resp:
    req = urllib.request.Request(url, method=method, data=data, headers={"User-Agent": UA, **(headers or {})})
    t0 = time.perf_counter()
    try:
        with (_FOLLOW if follow else _NO_FOLLOW).open(req, timeout=timeout) as r:
            body = r.read()
            return Resp(r.status, (time.perf_counter() - t0) * 1000, body, {k.lower(): v for k, v in r.headers.items()})
    except urllib.error.HTTPError as e:
        body = e.read() if e.fp else b""
        return Resp(e.code, (time.perf_counter() - t0) * 1000, body, {k.lower(): v for k, v in (e.headers or {}).items()})
    except Exception as e:  # connection refused, timeout, TLS...
        return Resp(None, (time.perf_counter() - t0) * 1000, error=f"{type(e).__name__}: {e}"[:120])


def is_up(base: str) -> bool:
    return http(base.rstrip("/") + "/en", timeout=3).status is not None


# ─── Part 1: suites ──────────────────────────────────────────────────────────
def npm() -> Optional[str]:
    return shutil.which("npm") or shutil.which("npm.cmd")


def run_step(sec: Section, label: str, command: list[str], env: Optional[dict] = None) -> bool:
    started = time.monotonic()
    proc = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
                          env={**os.environ, **(env or {})})
    lines = [l for l in (proc.stdout + proc.stderr).strip().splitlines() if l.strip()]
    summary = next((l.strip() for l in reversed(lines)
                    if re.search(r"Tests\s+\d+|Test Files|resolve|Compiled|error|warning", l)), lines[-1] if lines else "")
    summary = re.sub(r"\x1b\[[0-9;]*m", "", summary)  # strip colour codes
    ok = sec.check(label, proc.returncode == 0, f"{time.monotonic() - started:.0f}s  {summary}"[:150])
    if not ok:
        for line in lines[-15:]:
            print(DIM(f"        {line[:140]}"))
    return ok


def run_suites() -> Section:
    sec = Section("Part 1 — Typecheck, lint and unit tests")
    n = npm()
    if not n:
        sec.check("npm is installed", False, "install Node.js")
        return sec
    run_step(sec, "typecheck (tsc --noEmit)", [n, "exec", "--", "tsc", "--noEmit"])
    run_step(sec, "lint (eslint)", [n, "run", "lint", "--silent"])
    run_step(sec, "unit tests (vitest)", [n, "test", "--silent"])
    sec.finish()
    return sec


# ─── Part 2: build ───────────────────────────────────────────────────────────
def run_build(skip_build: bool) -> Section:
    sec = Section("Part 2 — Production build and link check")
    n = npm()
    if not n:
        sec.check("npm is installed", False, "install Node.js")
        return sec
    if not (ROOT / "public" / "content").exists():
        # `next build` alone skips the prebuild sync (a running dev server locks public/content on Windows).
        run_step(sec, "content sync (local profile repo)", [n, "run", "sync"], {"CONTENT_SOURCE": "local"})
    if skip_build:
        sec.check("existing .next build found", (ROOT / ".next" / "BUILD_ID").exists(), "--no-build")
    else:
        run_step(sec, "next build", [n, "exec", "--", "next", "build"], {"CONTENT_SOURCE": "local"})
    run_step(sec, "link check of prerendered pages (check:links)", [n, "run", "check:links"])
    # The one-A4-page CV rule: prints public/cv/CV_EN.html + CV_VN.html (the CV source, no server needed) with headless
    # Chrome and fails if either PDF has more than one page. Then the two files must match in structure and links.
    run_step(sec, "CV is one A4 page per language (check:cv)", [n, "run", "check:cv"])
    run_step(sec, "CV_EN.html and CV_VN.html match (check:cv-html --strict)", [n, "run", "check:cv-html", "--", "--strict"])
    sec.finish()
    return sec


# ─── Local server ────────────────────────────────────────────────────────────
class LocalServer:
    """Starts `next start` on the given port from the existing build; stops it on exit."""

    def __init__(self, port: int):
        self.port = port
        self.proc: Optional[subprocess.Popen] = None
        self.base = f"http://localhost:{port}"

    def start(self) -> bool:
        if is_up(self.base):
            print(YELLOW(f"  A server is already running at {self.base}; using it (it may serve an older build)"))
            return True
        next_bin = ROOT / "node_modules" / "next" / "dist" / "bin" / "next"
        if not (ROOT / ".next" / "BUILD_ID").exists():
            print(RED("  No production build (.next/BUILD_ID): run without --no-build"))
            return False
        # node directly (not npx.cmd), so stop() reaches the real server process.
        self.proc = subprocess.Popen(["node", str(next_bin), "start", "-p", str(self.port)], cwd=ROOT,
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(80):
            time.sleep(0.5)
            if is_up(self.base):
                print(DIM(f"  started next start at {self.base}"))
                return True
        print(RED(f"  next start did not come up at {self.base}"))
        return False

    def stop(self) -> None:
        if self.proc:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=10)
            except Exception:
                self.proc.kill()


# ─── Part 3: site ────────────────────────────────────────────────────────────
HREF = re.compile(r'\shref="([^"]+)"', re.I)
SRC = re.compile(r'\ssrc="([^"]+)"', re.I)
ASSET_EXT = re.compile(r"\.(pdf|png|jpe?g|webp|gif|svg|ico|txt|xml|json|woff2?)$", re.I)


def same_origin_path(base: str, raw: str) -> Optional[str]:
    """Site-root path (with query) of a link, or None for external links, anchors, mailto: etc."""
    raw = unescape(raw.strip())
    if not raw or raw.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
        return None
    url = urlparse(urljoin(base + "/", raw))
    if url.netloc and url.netloc != urlparse(base).netloc:
        return None
    return url.path + (f"?{url.query}" if url.query else "")


def known_pages() -> list[str]:
    """Pages behind collapsed explorer folders (no link in the HTML): certificates and config-file views.
    Read from the local synced content and src/lib/repoFiles.ts (the live site is built from the same repo)."""
    seeds: list[str] = []
    manifest = ROOT / "content" / "certificates.json"
    certs = json.loads(manifest.read_text(encoding="utf-8")) if manifest.exists() else []
    repo_files = ROOT / "src" / "lib" / "repoFiles.ts"
    slugs = re.findall(r"\{\s*slug:\s*'([^']+)'", repo_files.read_text(encoding="utf-8")) if repo_files.exists() else []
    for lang in LANGS:
        seeds += [f"/{lang}/certifications/{no}" for no in certs]
        seeds += [f"/{lang}/files/{slug}" for slug in slugs]
    return seeds


def crawl(base: str, timeout: int) -> tuple[dict[str, Resp], set[str]]:
    """Breadth-first over every same-origin page link starting at /en, /vi and known_pages().
    Returns (pages, asset paths)."""
    pages: dict[str, Resp] = {}
    assets: set[str] = set()
    queue = [f"/{lang}" for lang in LANGS] + known_pages()
    seen = set(queue)
    while queue:
        batch, queue = queue[:8], queue[8:]
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda p: (p, http(base + p, timeout=timeout)), batch))
        for path, resp in results:
            pages[path] = resp
            if resp.status != 200:
                continue
            html = resp.text
            for raw in SRC.findall(html):
                p = same_origin_path(base, raw)
                if p:
                    assets.add(p)
            for raw in HREF.findall(html):
                p = same_origin_path(base, raw)
                if not p or p.startswith(("/_next/", "/api/")):
                    continue
                if ASSET_EXT.search(p.split("?")[0]):
                    assets.add(p)
                    continue
                page = p.split("?")[0].rstrip("/") or "/"
                if page == "/" or page in seen:
                    continue
                seen.add(page)
                queue.append(page)
    return pages, assets


def run_site(base: str, timeout: int) -> tuple[Section, dict[str, Resp]]:
    sec = Section(f"Part 3 — Site  —  {base}")
    if not is_up(base):
        sec.check("server answers", False, f"no answer at {base} (start it, or run without --base)")
        sec.finish()
        return sec, {}

    sec.group("Pages (crawled from /en and /vi)")
    pages, assets = crawl(base, timeout)
    for path in sorted(pages, key=lambda p: (p.split("/")[1:2], len(p), p)):
        r = pages[path]
        lang = path.split("/")[1]
        html = r.text
        ok = (r.status == 200 and "<title>" in html and f'lang="{lang}"' in html
              and "Encountered a script tag" not in html)
        detail = f"{r.status}  {r.ms:.0f}ms" if r.status else r.error
        if r.status == 200 and not ok:
            detail += "  (missing <title> or wrong <html lang>)"
        sec.check(path, ok, detail)
    for lang in LANGS:
        sec.check(f"/{lang}: at least 10 pages linked", sum(1 for p in pages if p.startswith(f"/{lang}")) >= 10,
                  f"{sum(1 for p in pages if p.startswith(f'/{lang}'))} pages")

    sec.group(f"Images, PDFs and other files ({len(assets)})")
    with ThreadPoolExecutor(max_workers=8) as pool:
        checked = list(pool.map(lambda p: (p, http(base + p, timeout=timeout)), sorted(assets)))
    bad = [(p, r) for p, r in checked if r.status != 200 or not r.body]
    for p, r in bad:
        sec.check(p[:62], False, f"{r.status or r.error}")
    total_kb = sum(len(r.body) for _, r in checked) / 1024
    sec.check(f"{len(checked) - len(bad)} of {len(checked)} files load", not bad, f"{total_kb:,.0f} KB in all")

    sec.group("Redirects and not-found pages")
    r = http(base + "/", follow=False, timeout=timeout)
    loc = r.headers.get("location", "")
    sec.check("/ redirects to /en or /vi", r.status in (307, 308) and re.search(r"/(en|vi)(\?|$)", loc) is not None,
              f"{r.status} -> {loc}")
    r = http(base + "/", follow=False, timeout=timeout, headers={"Cookie": "lang=vi", "Accept-Language": "vi"})
    sec.check("/ with a Vietnamese browser goes to /vi", r.status in (307, 308) and "/vi" in r.headers.get("location", ""),
              f"{r.status} -> {r.headers.get('location', '')}")
    r = http(base + "/en/skills", follow=False, timeout=timeout)
    sec.check("/en/skills (old section page) redirects to /en", r.status in (301, 307, 308)
              and urlparse(r.headers.get("location", "")).path == "/en", f"{r.status} -> {r.headers.get('location', '')}")
    for path in ("/en/this-page-does-not-exist", "/vi/projects/no-such-project", "/xx"):
        r = http(base + path, timeout=timeout)
        # A local `next start` streams the page shell before an unknown project slug calls notFound(), so it answers
        # 200 with the not-found page and noindex; Vercel answers a real 404. Only localhost may give the soft 404.
        soft = (r.status == 200 and urlparse(base).hostname in ("localhost", "127.0.0.1")
                and 'name="robots" content="noindex"' in r.text)
        sec.check(f"{path} answers 404", r.status == 404 or soft,
                  f"{r.status}" + ("  soft 404 (not-found page + noindex; local next start only)" if soft else ""))

    sec.group("API routes (refusals only: no email is sent, nothing is saved)")
    r = http(base + "/api/keepalive", timeout=timeout)
    sec.check("GET /api/keepalive without the cron secret -> 401", r.status == 401, f"{r.status}")
    r = http(base + "/api/keepalive", timeout=timeout, headers={"Authorization": "Bearer wrong"})
    sec.check("GET /api/keepalive with a wrong secret -> 401", r.status == 401, f"{r.status}")
    json_h = {"Content-Type": "application/json"}
    # 503 is accepted where the server has no email/database keys (then it refuses before reading the body).
    r = http(base + "/api/contact", method="POST", data=b"not json", headers=json_h, timeout=timeout)
    sec.check("POST /api/contact with a non-JSON body -> 400", r.status in (400, 503), f"{r.status}  {r.text[:60]}")
    r = http(base + "/api/contact", method="POST", data=b"{}", headers=json_h, timeout=timeout)
    sec.check("POST /api/contact with an empty form -> 400", r.status in (400, 503), f"{r.status}  {r.text[:60]}")
    r = http(base + "/api/contact", method="POST", data=b"x" * (17 * 1024), headers=json_h, timeout=timeout)
    sec.check("POST /api/contact with a 17 KB body -> 400", r.status in (400, 503), f"{r.status}")
    r = http(base + "/api/contact", timeout=timeout)
    sec.check("GET /api/contact -> 405", r.status == 405, f"{r.status}")

    sec.finish()
    return sec, pages


# ─── Part 4: speed ───────────────────────────────────────────────────────────
def page_kind(path: str) -> str:
    parts = path.strip("/").split("/")
    if len(parts) == 1:
        return "home"
    return {"projects": "project", "certifications": "certificate", "files": "config file", "cv": "cv"}.get(parts[1], parts[1])


def rate(ms: float) -> str:
    return GREEN("fast") if ms < 100 else YELLOW("ok") if ms < 300 else RED("slow")


def run_speed(base: str, pages: dict[str, Resp], runs: int, timeout: int) -> Section:
    sec = Section(f"Part 4 — Speed  —  {base}  (median of {runs} runs; fast <100 ms, ok <300 ms, slow >=300 ms)")
    paths = [p for p, r in pages.items() if r.status == 200]
    if not paths:
        sec.check("pages to time", False, "Part 3 found no pages (run it too)")
        sec.finish()
        return sec

    def timed(path: str, headers: Optional[dict] = None) -> tuple[float, int]:
        times, size = [], 0
        for _ in range(runs):
            r = http(base + path, headers=headers, timeout=timeout)
            if r.status != 200:
                return -1, r.status or 0
            times.append(r.ms)
            size = len(r.body)
        return statistics.median(times), size

    rows: list[tuple[str, str, float, int, float, int]] = []
    for path in sorted(paths, key=lambda p: (page_kind(p), p)):
        html_ms, html_size = timed(path)
        # What a client-side switch (explorer row, tab, EN/VI) downloads when it was not prefetched yet.
        rsc_ms, rsc_size = timed(path, {"RSC": "1"})
        rows.append((path, page_kind(path), html_ms, html_size, rsc_ms, rsc_size))

    sec.group("Per page:  first load (HTML)  |  page switch (RSC payload)")
    for path, kind, h_ms, h_size, r_ms, r_size in rows:
        ok = h_ms >= 0 and r_ms >= 0
        detail = (f"load {h_ms:4.0f}ms {h_size / 1024:5.0f}KB  |  switch {r_ms:4.0f}ms {r_size / 1024:4.0f}KB  {rate(r_ms)}"
                  if ok else f"status {h_size if h_ms < 0 else r_size}")
        sec.check(path[:40], ok, detail)

    sec.group("By page type (median)")
    kinds = sorted({k for _, k, *_ in rows})
    for kind in kinds:
        sel = [r for r in rows if r[1] == kind and r[2] >= 0 and r[4] >= 0]
        if not sel:
            continue
        load = statistics.median(r[2] for r in sel)
        switch = statistics.median(r[4] for r in sel)
        worst = max(sel, key=lambda r: r[4])
        sec.note(f"{kind:<12} load {load:4.0f}ms  switch {switch:4.0f}ms {rate(switch)}   "
                 f"slowest switch {worst[4]:.0f}ms {worst[0]}")
    sec.note("Times are network + server only. In the browser the preload scheduler fetches these in the background "
             "after load, so a switch a reader makes after a few seconds usually needs no fetch at all.")
    sec.finish()
    return sec


# ─── Main ────────────────────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser(description="Pre-deploy check for the portfolio website.")
    parser.add_argument("--base", default="", help="test this running server instead of a local build (e.g. http://localhost:3010)")
    parser.add_argument("--live", action="store_true", help=f"same as --base {LIVE_URL}")
    parser.add_argument("--only", default="", help="comma list of parts: suites,build,site,speed")
    parser.add_argument("--no-build", action="store_true", help="local mode: reuse the existing .next build")
    parser.add_argument("--port", type=int, default=3012, help="port for the local next start (default 3012)")
    parser.add_argument("--runs", type=int, default=3, help="repeats per timing (default 3)")
    parser.add_argument("--timeout", type=int, default=30, help="seconds per request (default 30)")
    parser.add_argument("--json", default=None, help="also save every check to this JSON file")
    args = parser.parse_args()

    base = (LIVE_URL if args.live else args.base).rstrip("/")
    local = not base
    default_parts = {"suites", "build", "site", "speed"} if local else {"site", "speed"}
    parts = {p.strip() for p in args.only.split(",") if p.strip()} or default_parts
    unknown = parts - {"suites", "build", "site", "speed"}
    if unknown:
        parser.error(f"unknown part(s): {', '.join(sorted(unknown))}")

    summary: list[tuple[str, bool, str]] = []

    def add(label: str, sec: Section) -> None:
        summary.append((label, sec.total > 0 and sec.passed == sec.total, f"{sec.passed}/{sec.total} passed"))

    if "suites" in parts:
        add("Part 1  Typecheck, lint, unit tests", run_suites())
    if "build" in parts:
        add("Part 2  Build and link check", run_build(args.no_build))

    server: Optional[LocalServer] = None
    try:
        if parts & {"site", "speed"}:
            if local:
                server = LocalServer(args.port)
                if not server.start():
                    summary.append(("Local server", False, f"could not start on :{args.port}"))
                    parts -= {"site", "speed"}
                base = server.base
            pages: dict[str, Resp] = {}
            if "site" in parts:
                sec, pages = run_site(base, args.timeout)
                add("Part 3  Site", sec)
            if "speed" in parts:
                if not pages:
                    print(DIM(f"  finding pages at {base}...")); pages, _ = crawl(base, args.timeout)
                add("Part 4  Speed", run_speed(base, pages, max(1, args.runs), args.timeout))
    finally:
        if server:
            server.stop()

    print()
    print(BOLD("═" * 80))
    print(BOLD("  Summary"))
    print(BOLD("═" * 80))
    for label, ok, detail in summary:
        print(f"    {GREEN('✓ PASS') if ok else RED('✗ FAIL')}  {label:<36} {DIM(detail)}")
    all_ok = bool(summary) and all(ok for _, ok, _ in summary)
    print()
    print(GREEN(BOLD("  Ready to deploy: every part passed.")) if all_ok else RED(BOLD("  Not ready: fix the failed parts above.")))
    print()
    if args.json:
        Path(args.json).write_text(json.dumps({"base": base, "summary": [
            {"part": l, "ok": o, "detail": d} for l, o, d in summary], "checks": Section.all_rows}, indent=2), encoding="utf-8")
        print(DIM(f"  JSON report saved to {args.json}"))
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
