#!/usr/bin/env node
// Lab bake-off screenshot harness — headless Chrome, Node built-ins only.
//
//   node scripts/shoot.mjs --skin <name> --round <N|F> [--base http://localhost:3000]
//        [--states overview,region,node,dense] [--vp desktop,mobile]
//        [--check-only] [--typecheck]
//
// Per state: HTTP warm-up → --dump-dom health check → DevTools-protocol
// screenshot per viewport (waits for data-lab-ready) → JPEG q70 via sips. Output: .lab-shots/<skin>/r<N>/<state>@<vp>.jpg
// Exit: 0 ok · 2 check failed / blank / typecheck errors · 3 server unreachable.
// At most 2 Chrome (or tsc) processes machine-wide, via .lab-shots/.slots/{0,1}.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Focus models per state — the orchestrator may retune these.
const FOCUS = { region: "transformer", node: "clip", dense: "classifier" };

const STATES = {
  overview: "?zoom=overview&still=1",
  region: `?zoom=region&focus=${FOCUS.region}&still=1`,
  node: `?zoom=node&focus=${FOCUS.node}&still=1`,
  dense: `?zoom=region&focus=${FOCUS.dense}&still=1`,
};
const VIEWPORTS = { desktop: [1440, 900], mobile: [390, 844] };
const MOBILE_STATES = new Set(["overview", "node"]);

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CHROME_KILL_MS = 60_000;
const WARMUP_MS = 90_000;
const SLOT_COUNT = 2;
const SLOT_STALE_MS = 3 * 60_000;
const BLANK_BYTES = 18 * 1024;
// `nextjs-portal` is NOT a failure signal: `next dev` always mounts it (the
// overlay root) and its error text lives in a shadow root that --dump-dom does
// not serialize. Dev errors surface via the missing ready flag, the console
// scan below, or the overlay itself in the screenshot.
const BAD_DOM = ["Unhandled Runtime Error", "Build Error", "Application error"];
const BAD_CONSOLE = /Uncaught|Unhandled Runtime Error|Minified React error|The above error occurred/;

const PLAYGROUND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(PLAYGROUND, ".lab-shots");
const SLOTS = path.join(SHOTS, ".slots");
const DEV_LOG = path.join(SHOTS, "dev.log");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function die(msg, code = 1) {
  console.error(`shoot: ${msg}`);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { base: "http://localhost:3000", states: Object.keys(STATES), vp: Object.keys(VIEWPORTS), checkOnly: false, typecheck: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { const v = argv[++i]; if (v === undefined) die(`${a} needs a value`); return v; };
    if (a === "--skin") opts.skin = val();
    else if (a === "--round") opts.round = val();
    else if (a === "--base") opts.base = val().replace(/\/+$/, "");
    else if (a === "--states") opts.states = val().split(",").filter(Boolean);
    else if (a === "--vp") opts.vp = val().split(",").filter(Boolean);
    else if (a === "--check-only") opts.checkOnly = true;
    else if (a === "--typecheck") opts.typecheck = true;
    else if (a === "-h" || a === "--help") { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 11).join("\n")); process.exit(0); }
    else die(`unknown argument ${a}`);
  }
  if (!opts.skin || !/^[a-z0-9][a-z0-9-]*$/.test(opts.skin)) die("--skin <name> is required (lowercase, a-z0-9-)");
  if (!opts.round || !/^(\d+|F)$/.test(opts.round)) die("--round <N|F> is required");
  for (const s of opts.states) if (!STATES[s]) die(`unknown state ${s} (have: ${Object.keys(STATES).join(",")})`);
  for (const v of opts.vp) if (!VIEWPORTS[v]) die(`unknown viewport ${v} (have: ${Object.keys(VIEWPORTS).join(",")})`);
  return opts;
}

// ————— machine-wide slots —————

const held = new Set();

async function acquireSlot(label) {
  fs.mkdirSync(SLOTS, { recursive: true });
  let waited = false;
  for (;;) {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const dir = path.join(SLOTS, String(i));
      try {
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, "owner"), `${process.pid} ${label} ${new Date().toISOString()}\n`);
        const beat = setInterval(() => { try { const t = new Date(); fs.utimesSync(dir, t, t); } catch {} }, 30_000);
        const slot = { dir, beat };
        held.add(slot);
        return slot;
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
        try {
          if (Date.now() - fs.statSync(dir).mtimeMs > SLOT_STALE_MS) {
            fs.rmSync(dir, { recursive: true, force: true });
            console.warn(`  (removed stale slot ${i})`);
          }
        } catch {}
      }
    }
    if (!waited) { console.log(`  waiting for a Chrome slot…`); waited = true; }
    await sleep(2000);
  }
}

function releaseSlot(slot) {
  clearInterval(slot.beat);
  fs.rmSync(slot.dir, { recursive: true, force: true });
  held.delete(slot);
}

const children = new Set();

function killGroup(child, signal = "SIGKILL") {
  try { process.kill(-child.pid, signal); } catch {}
}

function cleanupAndExit(code) {
  for (const c of children) killGroup(c);
  for (const s of held) releaseSlot(s);
  process.exit(code);
}
process.on("SIGINT", () => cleanupAndExit(130));
process.on("SIGTERM", () => cleanupAndExit(143));

// Runs a process in its own group. `doneWhen(stdout, stderr)` lets us stop
// early: headless Chrome often lingers after writing its output.
function run(cmd, args, { cwd, killMs = CHROME_KILL_MS, doneWhen } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    children.add(child);
    let stdout = "";
    let stderr = "";
    let finished = false;
    let timedOut = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(hard);
      killGroup(child);
      children.delete(child);
      // give the OS a beat to reap helpers before the caller deletes their profile dir
      setTimeout(() => resolve({ stdout, stderr, timedOut, code: child.exitCode }), 300);
    };
    const check = () => { if (doneWhen && doneWhen(stdout, stderr)) setTimeout(finish, 250); };
    child.stdout.on("data", (d) => { stdout += d; check(); });
    child.stderr.on("data", (d) => { stderr += d; check(); });
    child.on("close", finish);
    child.on("error", (e) => { stderr += String(e); finish(); });
    const hard = setTimeout(() => { timedOut = true; finish(); }, killMs);
  });
}

async function chrome(label, args, doneWhen) {
  const slot = await acquireSlot(label);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lab-shoot-"));
  try {
    return await run(CHROME, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
      "--no-first-run", "--no-default-browser-check", "--disable-extensions",
      "--enable-logging=stderr", "--v=0",
      `--user-data-dir=${profile}`, "--virtual-time-budget=8000", ...args,
    ], { doneWhen });
  } finally {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    releaseSlot(slot);
  }
}

// Screenshots go through the DevTools protocol, not --screenshot: headless
// Chrome clamps windows to >=500px wide, so a 390px --window-size lays out at
// 500 and crops (verified). CDP device metrics give a true 390px viewport, and
// the capture waits for data-lab-ready on the very page being shot.
async function cdpScreenshot(label, url, [w, h], mobile, pngPath) {
  const slot = await acquireSlot(label);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lab-shoot-"));
  const child = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--no-first-run", "--no-default-browser-check", "--disable-extensions",
    `--user-data-dir=${profile}`, "--remote-debugging-port=0",
    `--window-size=${Math.max(w, 500)},${h}`, "about:blank",
  ], { detached: true, stdio: ["ignore", "ignore", "pipe"] });
  children.add(child);
  let stderr = "";
  child.stderr.on("data", (d) => { stderr += d; });
  let ws;
  let hard;
  try {
    return await Promise.race([
      new Promise((resolve) => { hard = setTimeout(() => resolve({ ok: false, why: "timeout" }), CHROME_KILL_MS); }),
      (async () => {
        let port;
        for (let i = 0; i < 100 && !port; i++) {
          port = stderr.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//)?.[1];
          if (!port) await sleep(200);
        }
        if (!port) return { ok: false, why: "no DevTools port" };
        const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        const page = targets.find((t) => t.type === "page");
        if (!page) return { ok: false, why: "no page target" };

        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("ws error")); });
        let nextId = 0;
        const pending = new Map();
        const waiters = [];
        ws.onmessage = (ev) => {
          const msg = JSON.parse(ev.data);
          if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
          else if (msg.method) for (const wt of waiters) if (wt.method === msg.method) wt.resolve();
        };
        const send = (method, params = {}) => new Promise((res) => {
          const id = ++nextId;
          pending.set(id, res);
          ws.send(JSON.stringify({ id, method, params }));
        });
        const once = (method) => new Promise((resolve) => waiters.push({ method, resolve }));
        const evaluate = async (expression) =>
          (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

        await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
        await send("Page.enable");
        const loaded = once("Page.loadEventFired");
        await send("Page.navigate", { url });
        await Promise.race([loaded, sleep(45_000)]);
        let ready = false;
        for (let i = 0; i < 80 && !ready; i++) {
          ready = await evaluate(`!!document.querySelector('[data-lab-ready="1"]')`);
          if (!ready) await sleep(250);
        }
        // settle: fonts, two frames, then a beat for layout-driven effects
        await evaluate(`document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 400)))))`);
        const shot = await send("Page.captureScreenshot", { format: "png" });
        if (!shot.result?.data) return { ok: false, why: "capture failed" };
        fs.writeFileSync(pngPath, Buffer.from(shot.result.data, "base64"));
        return ready ? { ok: true } : { ok: false, why: "not ready after 20s" };
      })(),
    ]);
  } catch (e) {
    return { ok: false, why: e.message };
  } finally {
    clearTimeout(hard);
    try { ws?.close(); } catch {}
    killGroup(child);
    children.delete(child);
    await sleep(300);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    releaseSlot(slot);
  }
}

// ————— checks —————

async function httpGet(url, timeoutMs) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
    await res.arrayBuffer();
    return { status: res.status };
  } catch (e) {
    return { error: e.name === "TimeoutError" ? `timed out after ${timeoutMs / 1000}s` : e.cause?.code ?? e.message };
  }
}

function consoleLines(stderr) {
  return stderr.split("\n")
    .filter((l) => l.includes(":CONSOLE"))
    .map((l) => l.replace(/^\[[^\]]*CONSOLE[^\]]*\]\s*/, "").replace(/, source: .*$/, ""));
}

function devLogTail(skin) {
  if (!fs.existsSync(DEV_LOG)) return `  (no ${path.relative(PLAYGROUND, DEV_LOG)})`;
  const hits = fs.readFileSync(DEV_LOG, "utf8").split("\n").filter((l) => l.includes(skin)).slice(-40);
  return hits.length ? hits.map((l) => `  | ${l}`).join("\n") : `  (dev.log has no lines mentioning "${skin}")`;
}

async function checkState(opts, state, url) {
  const warm = await httpGet(url, WARMUP_MS);
  if (warm.error) return { ok: false, why: `warm-up failed: ${warm.error}` };
  if (warm.status !== 200) return { ok: false, why: `warm-up HTTP ${warm.status}` };

  const [w, h] = VIEWPORTS.desktop;
  const r = await chrome(`${opts.skin}:${state}:dom`, [`--window-size=${w},${h}`, "--dump-dom", url],
    (out) => out.includes("</html>"));
  const dom = r.stdout;
  const logs = consoleLines(r.stderr);
  const problems = [];
  if (!dom.includes("</html>")) problems.push(r.timedOut ? "dump-dom timed out" : "dump-dom produced no document");
  else if (!dom.includes('data-lab-ready="1"')) problems.push('no data-lab-ready="1" in DOM');
  for (const bad of BAD_DOM) if (dom.includes(bad)) problems.push(`DOM contains "${bad}"`);
  const fatal = logs.filter((l) => BAD_CONSOLE.test(l));
  if (fatal.length) problems.push(`console: ${fatal[0].slice(0, 200)}`);
  return { ok: problems.length === 0, why: problems.join("; "), logs };
}

async function shoot(opts, state, vp, url, outDir) {
  const [w, h] = VIEWPORTS[vp];
  const png = path.join(outDir, `${state}@${vp}.png`);
  const jpg = path.join(outDir, `${state}@${vp}.jpg`);
  fs.rmSync(png, { force: true });
  fs.rmSync(jpg, { force: true });
  const r = await cdpScreenshot(`${opts.skin}:${state}@${vp}`, url, [w, h], vp === "mobile", png);
  if (!fs.existsSync(png)) return { status: `FAIL ${r.why}`, bytes: 0, jpg };
  const s = await run("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "70", png, "--out", jpg], { killMs: 30_000 });
  fs.rmSync(png, { force: true });
  if (!fs.existsSync(jpg)) return { status: `FAIL sips ${s.stderr.trim().slice(0, 80)}`, bytes: 0, jpg };
  const bytes = fs.statSync(jpg).size;
  if (!r.ok) return { status: `FAIL ${r.why}`, bytes, jpg };
  return { status: bytes < BLANK_BYTES ? "BLANK?" : "ok", bytes, jpg };
}

async function typecheck(opts) {
  const slot = await acquireSlot(`${opts.skin}:tsc`);
  try {
    console.log("typecheck: npx tsc --noEmit --incremental false …");
    const r = await run("npx", ["tsc", "--noEmit", "--incremental", "false"], { cwd: PLAYGROUND, killMs: 10 * 60_000 });
    const errors = (r.stdout + r.stderr).split("\n").filter((l) => /error TS\d+/.test(l));
    const mine = errors.filter((l) => l.includes(`lab/${opts.skin}/`));
    for (const l of mine) console.log(`  ${l}`);
    console.log(`typecheck: ${mine.length} error(s) in lab/${opts.skin}/, ${errors.length - mine.length} elsewhere${r.timedOut ? " (tsc timed out)" : ""}`);
    return mine.length === 0 && !r.timedOut;
  } finally {
    releaseSlot(slot);
  }
}

// ————— main —————

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(CHROME)) die(`Chrome not found at ${CHROME}`);

  const probe = await httpGet(`${opts.base}/`, 10_000);
  if (probe.error) die(`server unreachable at ${opts.base} (${probe.error})`, 3);

  const outDir = path.join(SHOTS, opts.skin, `r${opts.round}`);
  if (!opts.checkOnly) fs.mkdirSync(outDir, { recursive: true });
  let exit = 0;
  const rows = [];

  if (opts.typecheck && !(await typecheck(opts))) exit = 2;

  for (const state of opts.states) {
    const url = `${opts.base}/lab/${opts.skin}/${STATES[state]}`;
    console.log(`${state}: ${url}`);
    const c = await checkState(opts, state, url);
    for (const l of (c.logs ?? []).slice(0, 10)) console.log(`  console: ${l.slice(0, 200)}`);
    if (!c.ok) {
      exit = 2;
      rows.push([state, "—", 0, `FAIL ${c.why}`]);
      console.log(`  FAIL ${c.why}\n  dev.log (lines mentioning "${opts.skin}"):\n${devLogTail(opts.skin)}`);
      continue;
    }
    if (opts.checkOnly) { rows.push([state, "dom", 0, "ok"]); continue; }
    for (const vp of opts.vp) {
      if (vp === "mobile" && !MOBILE_STATES.has(state)) continue;
      const s = await shoot(opts, state, vp, url, outDir);
      if (s.status !== "ok") exit = 2;
      rows.push([state, vp, s.bytes, s.status, s.jpg]);
    }
  }

  console.log(`\n${"state".padEnd(10)}${"vp".padEnd(9)}${"bytes".padStart(9)}  status`);
  for (const [state, vp, bytes, status] of rows) {
    console.log(`${state.padEnd(10)}${vp.padEnd(9)}${String(bytes || "—").padStart(9)}  ${status}`);
  }
  const files = rows.map((r) => r[4]).filter((f) => f && fs.existsSync(f));
  if (files.length) console.log(`\n${files.join("\n")}`);
  if (rows.some((r) => r[3] === "BLANK?")) console.log(`\nwarning: JPEGs under ${BLANK_BYTES / 1024}KB are probably blank`);
  console.log(exit === 0 ? "\nshoot: ok" : "\nshoot: FAILED");
  process.exit(exit);
}

main().catch((e) => {
  console.error(e);
  cleanupAndExit(1);
});
