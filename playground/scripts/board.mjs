#!/usr/bin/env node
// Builds .lab-shots/board.html — a self-contained comparison page of every
// skin's rounds (JPEGs inlined as data URIs). Node built-ins only.
//
//   node scripts/board.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLAYGROUND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(PLAYGROUND, ".lab-shots");
const OUT = path.join(SHOTS, "board.html");
const MAX_BYTES = 14 * 1024 * 1024;
const CRITERIA = ["legibility", "data_integrity", "fidelity", "craft", "hierarchy", "collisions", "motion", "mobile"];
const HEADLINE = ["overview@desktop", "node@desktop", "overview@mobile"];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = (n) => (typeof n === "number" ? (Number.isInteger(n) ? String(n) : n.toFixed(2)) : "—");

// r1 < r2 < … < rF
const roundKey = (name) => (name === "rF" ? Infinity : Number(name.slice(1)));

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function img(file, cls = "") {
  if (!fs.existsSync(file)) return `<div class="missing ${cls}">missing</div>`;
  const b64 = fs.readFileSync(file).toString("base64");
  return `<img class="${cls}" loading="lazy" src="data:image/jpeg;base64,${b64}" alt="${esc(path.basename(file))}">`;
}

function loadSkins() {
  if (!fs.existsSync(SHOTS)) return [];
  return fs.readdirSync(SHOTS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => {
      const dir = path.join(SHOTS, d.name);
      const rounds = fs.readdirSync(dir, { withFileTypes: true })
        .filter((r) => r.isDirectory() && /^r(\d+|F)$/.test(r.name))
        .map((r) => r.name)
        .sort((a, b) => roundKey(a) - roundKey(b))
        .map((name) => {
          const rdir = path.join(dir, name);
          const notes = path.join(rdir, "notes.md");
          return {
            name, dir: rdir,
            scores: readJson(path.join(rdir, "scores.json")),
            notes: fs.existsSync(notes) ? fs.readFileSync(notes, "utf8") : null,
          };
        });
      return { name: d.name, rounds };
    })
    .filter((s) => s.rounds.length);
}

function skinSection(skin) {
  const first = skin.rounds[0];
  const last = skin.rounds[skin.rounds.length - 1];
  const scored = [...skin.rounds].reverse().find((r) => r.scores);
  const latest = scored?.scores;
  const chips = latest
    ? CRITERIA.map((c) => `<span class="chip"><b>${fmt(latest.scores?.[c])}</b> ${esc(c.replace("_", " "))}</span>`).join("")
    : `<span class="dim">no scores yet</span>`;

  const compare = HEADLINE.map((shot) => `
      <figure class="pair ${shot.endsWith("mobile") ? "mobile" : ""}">
        <figcaption>${esc(shot)}</figcaption>
        <div class="pair-row">
          <div><div class="tag">${esc(first.name)}</div>${img(path.join(first.dir, `${shot}.jpg`))}</div>
          ${last !== first ? `<div><div class="tag">${esc(last.name)} · latest</div>${img(path.join(last.dir, `${shot}.jpg`))}</div>` : ""}
        </div>
      </figure>`).join("");

  const strip = skin.rounds.map((r) => `
      <figure class="thumb"><figcaption>${esc(r.name)}</figcaption>${img(path.join(r.dir, "overview@desktop.jpg"))}</figure>`).join("");

  const table = `
      <table>
        <thead><tr><th>round</th>${CRITERIA.map((c) => `<th>${esc(c.replace("_", " "))}</th>`).join("")}<th>mean</th></tr></thead>
        <tbody>${skin.rounds.map((r) => `
          <tr><td>${esc(r.name)}</td>${CRITERIA.map((c) => `<td>${fmt(r.scores?.scores?.[c])}</td>`).join("")}<td class="mean">${fmt(r.scores?.mean)}</td></tr>`).join("")}
        </tbody>
      </table>`;

  const notes = skin.rounds.filter((r) => r.notes).map((r) => `
      <details ${r === last ? "open" : ""}><summary>${esc(r.name)} notes</summary><pre>${esc(r.notes.trim())}</pre></details>`).join("");

  return `
    <section id="${esc(skin.name)}">
      <header>
        <h2>${esc(skin.name)}</h2>
        <div class="meta">${skin.rounds.length} round(s) · latest scored ${esc(scored?.name ?? "—")} · mean <b>${fmt(latest?.mean)}</b></div>
        <div class="chips">${chips}</div>
      </header>
      <div class="compare">${compare}</div>
      <h3>every round · overview@desktop</h3>
      <div class="strip">${strip}</div>
      <h3>scores</h3>
      ${table}
      ${notes ? `<h3>notes</h3>${notes}` : ""}
    </section>`;
}

function page(skins) {
  const nav = skins.map((s) => `<a href="#${esc(s.name)}">${esc(s.name)}</a>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lab Bake-off Board</title>
<style>
  :root { --bg: #f6f6f4; --card: #ffffff; --ink: #1b1b1a; --dim: #6b6b66; --rule: #e2e2dd; --accent: #2f5bd3; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #141414; --card: #1d1d1c; --ink: #ecebe6; --dim: #9a9993; --rule: #303030; --accent: #8aa8ff; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  .wrap { max-width: 1600px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: var(--dim); margin: 0 0 16px; }
  nav { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
  nav a { color: var(--accent); text-decoration: none; border: 1px solid var(--rule); border-radius: 999px; padding: 2px 12px; background: var(--card); }
  section { background: var(--card); border: 1px solid var(--rule); border-radius: 12px; padding: 20px; margin-bottom: 28px; }
  section header h2 { margin: 0; font-size: 20px; text-transform: capitalize; }
  .meta { color: var(--dim); font-size: 13px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .chip { font-size: 13px; border: 1px solid var(--rule); border-radius: 6px; padding: 1px 8px; color: var(--dim); }
  .chip b { color: var(--ink); }
  h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: var(--dim); margin: 22px 0 8px; font-weight: 600; }
  .compare { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
  .pair { margin: 0; }
  .pair.mobile { grid-column: 1 / -1; }
  .pair figcaption { font-size: 13px; color: var(--dim); margin-bottom: 4px; }
  .pair-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .pair.mobile .pair-row { grid-template-columns: repeat(2, minmax(0, 260px)); }
  .tag { font-size: 12px; color: var(--dim); }
  img { display: block; width: 100%; height: auto; border: 1px solid var(--rule); border-radius: 6px; }
  .missing { display: grid; place-items: center; aspect-ratio: 16 / 10; border: 1px dashed var(--rule); border-radius: 6px; color: var(--dim); font-size: 13px; }
  .strip { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 6px; }
  .thumb { margin: 0; flex: 0 0 360px; width: 360px; }
  .thumb figcaption { font-size: 12px; color: var(--dim); }
  table { border-collapse: collapse; font-size: 13px; width: 100%; display: block; overflow-x: auto; }
  th, td { border-bottom: 1px solid var(--rule); padding: 4px 10px; text-align: right; white-space: nowrap; }
  th:first-child, td:first-child { text-align: left; }
  th { color: var(--dim); font-weight: 600; }
  td.mean { font-weight: 700; }
  details { margin: 6px 0; }
  summary { cursor: pointer; color: var(--dim); font-size: 13px; }
  pre { white-space: pre-wrap; background: var(--bg); border: 1px solid var(--rule); border-radius: 6px; padding: 10px; font-size: 13px; margin: 6px 0 0; }
  .dim { color: var(--dim); }
  @media (max-width: 800px) { .compare, .pair-row { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="wrap">
  <h1>Lab bake-off board</h1>
  <p class="sub">${skins.length} skin(s) · generated ${esc(new Date().toISOString().slice(0, 16).replace("T", " "))} UTC · round 1 vs latest, then every round</p>
  <nav>${nav}</nav>
  ${skins.map(skinSection).join("\n")}
</div>
</body>
</html>
`;
}

const skins = loadSkins();
if (!skins.length) {
  console.error(`board: no skin rounds under ${SHOTS}`);
  process.exit(1);
}
const html = page(skins);
const bytes = Buffer.byteLength(html);
if (bytes > MAX_BYTES) {
  console.error(`board: output would be ${(bytes / 1048576).toFixed(1)}MB (> 14MB) — prune rounds or shots`);
  process.exit(1);
}
fs.writeFileSync(OUT, html);
console.log(`board: ${OUT} (${(bytes / 1048576).toFixed(2)}MB, ${skins.length} skin(s): ${skins.map((s) => `${s.name}×${s.rounds.length}`).join(", ")})`);
