#!/usr/bin/env node
// Checks the hidden website markers in the profile READMEs.
// Usage: node scripts/check-markers.mjs README.md READMEVN.md
// Exits 1 when a section id is missing, duplicated, unknown or unclosed, when the
// `projects` section does not hold exactly the expected project slugs, or when the
// files' slug sets differ.
import { readFileSync } from "node:fs";

const SECTION_IDS = [
  "header", "summary", "tech-stack", "skills", "experience", "projects",
  "languages", "education", "contact", "certifications", "previews",
];
const PROJECT_SLUGS = [
  "atino-booking", "caro-app", "qandastudy-booking", "atino-approval-web",
  "atino-approval-api", "atino-workspace", "data-analyst-portfolio",
];

const SECTION_OPEN = /^\s*<!--\s*section\s*:\s*([\w-]+)\s*-->\s*$/;
const SECTION_CLOSE = /^\s*<!--\s*\/\s*section\s*-->\s*$/;
const PROJECT = /^\s*<!--\s*project\s*:\s*([\w-]+)\s*-->\s*$/;

function scan(file) {
  const errors = [];
  const sections = [];
  const slugs = { projects: [], previews: [] };
  let open = null;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    let m;
    if ((m = line.match(SECTION_OPEN))) {
      const id = m[1];
      if (open) errors.push(`${at}: section "${id}" opened inside unclosed section "${open}"`);
      if (!SECTION_IDS.includes(id)) errors.push(`${at}: unknown section "${id}" (valid: ${SECTION_IDS.join(", ")})`);
      if (sections.includes(id)) errors.push(`${at}: duplicate section "${id}"`);
      sections.push(id);
      open = id;
    } else if (SECTION_CLOSE.test(line)) {
      if (!open) errors.push(`${at}: <!-- /section --> without an open section`);
      open = null;
    } else if ((m = line.match(PROJECT))) {
      const slug = m[1];
      if (!PROJECT_SLUGS.includes(slug)) errors.push(`${at}: unknown project "${slug}" (valid: ${PROJECT_SLUGS.join(", ")})`);
      if (open !== "projects" && open !== "previews") {
        errors.push(`${at}: project "${slug}" outside the projects/previews sections`);
      } else {
        if (slugs[open].includes(slug)) errors.push(`${at}: duplicate project "${slug}" in ${open}`);
        slugs[open].push(slug);
      }
    } else if (/<!--\s*\/?\s*(section|project)\b/.test(line)) {
      errors.push(`${at}: malformed marker (must be alone on its line): ${line.trim()}`);
    }
  });
  if (open) errors.push(`${file}: section "${open}" is never closed`);
  for (const id of SECTION_IDS) {
    if (!sections.includes(id)) errors.push(`${file}: missing section: ${id}`);
  }
  const missing = PROJECT_SLUGS.filter((s) => !slugs.projects.includes(s));
  if (missing.length) errors.push(`${file}: projects section is missing slugs: ${missing.join(", ")}`);
  return { file, sections, slugs, errors };
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/check-markers.mjs README.md READMEVN.md");
  process.exit(2);
}

const results = files.map(scan);
const errors = results.flatMap((r) => r.errors);
for (const r of results) {
  console.log(`${r.file}`);
  console.log(`  sections (${r.sections.length}): ${r.sections.join(", ")}`);
  console.log(`  projects (${r.slugs.projects.length}): ${r.slugs.projects.join(", ")}`);
  console.log(`  previews (${r.slugs.previews.length}): ${r.slugs.previews.join(", ")}`);
}
const [first, ...rest] = results;
for (const r of rest) {
  for (const kind of ["projects", "previews"]) {
    if (!sameSet(first.slugs[kind], r.slugs[kind])) {
      errors.push(`${kind} slugs differ: ${first.file} [${first.slugs[kind].join(", ")}] vs ${r.file} [${r.slugs[kind].join(", ")}]`);
    }
  }
}

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}
console.log("ok");
