#!/usr/bin/env node
// Thumbnails for /lab/designs → public/local/designs/<id>.jpg (gitignored).
//   node scripts/designs.mjs [--base http://localhost:3000] [--only id,id]
// Lab skins: copy the latest round's desktop shot (.lab-shots/<skin>/r<N>/).
// Other pages: headless Chrome --screenshot with a virtual-time budget.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLAYGROUND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(PLAYGROUND, "public", "local", "designs");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt("--base", "http://localhost:3000").replace(/\/+$/, "");
const only = opt("--only", "")?.split(",").filter(Boolean);

// lib/designs.ts is TypeScript; read the entries without a build step
const src = fs.readFileSync(path.join(PLAYGROUND, "lib", "designs.ts"), "utf8");
const designs = [...src.matchAll(/\{ id: "([^"]+)".*?shoot: (\{[^}]+\}) \}/g)].map((m) => {
  const shoot = m[2];
  const kind = /kind: "lab"/.test(shoot) ? "lab" : "url";
  return kind === "lab"
    ? { id: m[1], kind, skin: shoot.match(/skin: "([^"]+)"/)[1], state: shoot.match(/state: "([^"]+)"/)[1] }
    : { id: m[1], kind, path: shoot.match(/path: "([^"]+)"/)[1] };
});

fs.mkdirSync(OUT, { recursive: true });

function latestRound(skin) {
  const dir = path.join(PLAYGROUND, ".lab-shots", skin);
  if (!fs.existsSync(dir)) return null;
  const rounds = fs.readdirSync(dir).filter((d) => /^r\d+$/.test(d)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  return rounds.length ? path.join(dir, rounds[rounds.length - 1]) : null;
}

function copyLab(d) {
  // newest round that has this state (a late round may have shot other states only)
  const dir = path.join(PLAYGROUND, ".lab-shots", d.skin);
  const rounds = fs.existsSync(dir) ? fs.readdirSync(dir).filter((r) => /^r\d+$/.test(r)).sort((a, b) => Number(b.slice(1)) - Number(a.slice(1))) : [];
  for (const r of rounds) {
    const f = path.join(dir, r, `${d.state}@desktop.jpg`);
    if (fs.existsSync(f)) { fs.copyFileSync(f, path.join(OUT, `${d.id}.jpg`)); return `${r}/${d.state}@desktop.jpg`; }
  }
  return null;
}

function shootUrl(d) {
  const png = path.join(OUT, `${d.id}.png`);
  const r = spawnSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--window-size=1440,900", "--virtual-time-budget=12000", `--screenshot=${png}`, `${base}${d.path}`,
  ], { stdio: "ignore", timeout: 90_000 });
  if (r.status !== 0 || !fs.existsSync(png)) return null;
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "70", png, "--out", path.join(OUT, `${d.id}.jpg`)], { stdio: "ignore" });
  fs.unlinkSync(png);
  return "chrome";
}

for (const d of designs) {
  if (only.length && !only.includes(d.id)) continue;
  const how = d.kind === "lab" ? copyLab(d) : shootUrl(d);
  console.log(`${d.id.padEnd(16)} ${how ?? "MISSING"}`);
}
console.log(`→ ${OUT}  (latest lab rounds: ${["paper", "pixel", "hybrid", "flow", "painted"].map((s) => `${s}=${path.basename(latestRound(s) ?? "-")}`).join(" ")})`);
