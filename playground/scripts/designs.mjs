#!/usr/bin/env node
// Thumbnails for /lab/designs → public/local/designs/<id>.jpg + shots.json (gitignored).
//   node scripts/designs.mjs [--base http://localhost:3000] [--api http://localhost:8000] [--only id,id]
// Every variant is shot LIVE (never copied from an old bake-off round), so the
// board always shows the current state: ONE headless Chrome driven over the
// DevTools protocol (Node 22's WebSocket), 1440×900 at 1× (the board shows a
// thumb at ≤640 css px, i.e. ≤1280 device px on a retina screen), each URL
// frozen with still=1. /lab/* pages are captured once they set
// data-lab-ready="1"; other pages after a settle. It holds one machine-wide
// Chrome slot (.lab-shots/.slots, shared with scripts/shoot.mjs).
// API calls aimed at any :8000 host are routed to --api, so a dev server whose
// NEXT_PUBLIC_API_BASE baked in a stale LAN IP still renders with data.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLAYGROUND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(PLAYGROUND, "public", "local", "designs");
const SLOTS = path.join(PLAYGROUND, ".lab-shots", ".slots");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [W, H] = [1440, 900];

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt("--base", "http://localhost:3000").replace(/\/+$/, "");
const api = opt("--api", "http://localhost:8000").replace(/\/+$/, "");
const only = opt("--only", "").split(",").filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// lib/designs.ts is TypeScript; read the entries without a build step
const src = fs.readFileSync(path.join(PLAYGROUND, "lib", "designs.ts"), "utf8");
const variants = [...src.matchAll(/\{\s*id: "([^"]+)",[^{}]*?shot: "([^"]+)"/g)]
  .map((m) => ({ id: m[1], shot: m[2] }))
  .filter((v) => !only.length || only.includes(v.id));
if (!variants.length) { console.error("no variants matched"); process.exit(2); }

fs.mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, "shots.json");
let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch { /* first run */ }

// one machine-wide Chrome slot, same protocol as scripts/shoot.mjs
fs.mkdirSync(SLOTS, { recursive: true });
let slot;
for (let waited = false; !slot;) {
  for (const i of [0, 1]) {
    const dir = path.join(SLOTS, String(i));
    try { fs.mkdirSync(dir); fs.writeFileSync(path.join(dir, "owner"), `${process.pid} designs ${new Date().toISOString()}\n`); slot = dir; break; } catch { /* taken */ }
  }
  if (!slot) { if (!waited) { console.log("waiting for a Chrome slot…"); waited = true; } await sleep(2000); }
}
const beat = setInterval(() => { try { const t = new Date(); fs.utimesSync(slot, t, t); } catch { /* gone */ } }, 30_000);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "designs-thumbs-"));
const child = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  "--disable-extensions", `--user-data-dir=${profile}`, "--remote-debugging-port=0", `--window-size=${W},${H}`, "about:blank",
], { detached: true, stdio: ["ignore", "ignore", "pipe"] });
let stderr = "";
child.stderr.on("data", (d) => { stderr += d; });
const cleanup = () => { clearInterval(beat); try { process.kill(-child.pid, "SIGKILL"); } catch { /* gone */ } };
process.on("SIGINT", () => { cleanup(); fs.rmSync(slot, { recursive: true, force: true }); process.exit(130); });

let failed = 0;
try {
  let port;
  for (let i = 0; i < 100 && !port; i++) { port = stderr.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//)?.[1]; if (!port) await sleep(200); }
  if (!port) throw new Error("Chrome did not open a DevTools port");
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("ws error")); });
  let nextId = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((res) => { const id = ++nextId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Fetch.requestPaused") {
      const url = m.params.request.url.replace(/^https?:\/\/[^/]+:8000/, api);
      send("Fetch.continueRequest", { requestId: m.params.requestId, url });
    }
  };
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  await send("Page.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*:8000/*" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });

  for (const v of variants) {
    const t0 = Date.now();
    await send("Page.navigate", { url: `${base}${v.shot}` });
    // lab skins announce they are drawn; classic pages get a fixed settle
    const isLab = v.shot.startsWith("/lab/");
    let ready = !isLab;
    for (let i = 0; i < 120 && !ready; i++) { await sleep(250); ready = await evaluate(`!!document.querySelector('[data-lab-ready="1"]')`); }
    await sleep(isLab ? 600 : 4000);
    await evaluate(`document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 6000); }))))`);
    await evaluate(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300))))`);
    const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 74 });
    if (!shot.result?.data) { failed++; console.log(`${v.id.padEnd(16)} FAILED`); continue; }
    fs.writeFileSync(path.join(OUT, `${v.id}.jpg`), Buffer.from(shot.result.data, "base64"));
    manifest[v.id] = { at: new Date().toISOString(), ready };
    console.log(`${v.id.padEnd(16)} ${ready ? "ok" : "NOT READY"}  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${v.shot}`);
    if (!ready) failed++;
  }
  ws.close();
} finally {
  cleanup();
  await sleep(300);
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  fs.rmSync(slot, { recursive: true, force: true });
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`→ ${OUT}`);
process.exit(failed ? 2 : 0);
