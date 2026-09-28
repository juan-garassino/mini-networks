#!/usr/bin/env node
// Lab bake-off screenshot harness — headless Chrome, Node built-ins only.
//
//   node scripts/shoot.mjs --skin <name> --round <N|F|critic> [--base http://localhost:3000]
//        [--states overview,region,node,dense] [--vp desktop,mobile]
//        [--check-only] [--typecheck]
//        [--motion select,overview-to-region,konami,critter,idle]
//
// Per state: HTTP warm-up → --dump-dom health check → DevTools-protocol
// screenshot per viewport (waits for data-lab-ready) → JPEG q70 via sips. Output: .lab-shots/<skin>/r<N>/<state>@<vp>.jpg
// --motion replaces the still states: per scenario, a live (no still=1) page at
// 1440×900, an action via window.__lab / keys, timed frames → one contact sheet
// .lab-shots/<skin>/r<N>/motion-<scenario>.jpg. Hook contract: scripts/README-shoot.md.
// Exit: 0 ok · 2 check failed / blank / typecheck errors / motion failed · 3 server unreachable.
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

// Live-motion scenarios (never still=1). `hook` = window.__lab method the
// action needs; `call` runs fire-and-forget right after the "before" frame;
// frames then land every `every` ms until `span` ms. Contract: README-shoot.md.
const KONAMI = [
  ["ArrowUp", "ArrowUp", 38], ["ArrowUp", "ArrowUp", 38], ["ArrowDown", "ArrowDown", 40], ["ArrowDown", "ArrowDown", 40],
  ["ArrowLeft", "ArrowLeft", 37], ["ArrowRight", "ArrowRight", 39], ["ArrowLeft", "ArrowLeft", 37], ["ArrowRight", "ArrowRight", 39],
  ["b", "KeyB", 66], ["a", "KeyA", 65],
];
const MOTION = {
  select: { query: `?zoom=region&focus=${FOCUS.region}`, hook: "select", call: `window.__lab.select(${JSON.stringify(FOCUS.node)})`, every: 200, span: 3000 },
  "overview-to-region": { query: "?zoom=overview", hook: "view", call: `window.__lab.view({ zoom: "region", focus: ${JSON.stringify(FOCUS.dense)} })`, every: 200, span: 2400 },
  konami: { query: "?zoom=overview", keys: KONAMI, every: 250, span: 4000 },
  critter: { query: `?zoom=region&focus=${FOCUS.region}`, hook: "critterClick", call: `window.__lab.critterClick(7)`, every: 250, span: 3000 },
  idle: { query: `?zoom=region&focus=${FOCUS.region}`, every: 500, span: 4000 },
};
const MOTION_VP = VIEWPORTS.desktop;
const MOTION_SETTLE_MS = 1500; // after ready: let intro fly-ins finish so frame 0 is the resting view
const HOOK_WAIT_MS = 3000; // skins install window.__lab in an effect just after ready
const FRAME_W = 480; // frames are downscaled at capture (CDP clip scale) → 480×300
const SHEET_COLS = 4;
const SHEET_MAX_BYTES = 1.5 * 1024 * 1024;
const MOTION_KILL_MS = 4 * 60_000;

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
  const opts = { base: "http://localhost:3000", states: Object.keys(STATES), vp: Object.keys(VIEWPORTS), checkOnly: false, typecheck: false, motion: null };
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
    else if (a === "--motion") opts.motion = val().split(",").filter(Boolean);
    else if (a === "-h" || a === "--help") { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 15).join("\n")); process.exit(0); }
    else die(`unknown argument ${a}`);
  }
  if (!opts.skin || !/^[a-z0-9][a-z0-9-]*$/.test(opts.skin)) die("--skin <name> is required (lowercase, a-z0-9-)");
  // N / F are builder rounds (on the board); "critic" is a reviewer's scratch set.
  if (!opts.round || !/^(\d+|F|critic)$/.test(opts.round)) die("--round <N|F|critic> is required");
  for (const s of opts.states) if (!STATES[s]) die(`unknown state ${s} (have: ${Object.keys(STATES).join(",")})`);
  for (const v of opts.vp) if (!VIEWPORTS[v]) die(`unknown viewport ${v} (have: ${Object.keys(VIEWPORTS).join(",")})`);
  if (opts.motion) {
    if (!opts.motion.length) die("--motion needs at least one scenario");
    if (opts.checkOnly) die("--motion cannot be combined with --check-only");
    for (const m of opts.motion) if (!MOTION[m]) die(`unknown motion scenario ${m} (have: ${Object.keys(MOTION).join(",")})`);
  }
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
      `--user-data-dir=${profile}`, "--virtual-time-budget=15000", ...args,
    ], { doneWhen });
  } finally {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    releaseSlot(slot);
  }
}

// One headless Chrome driven over the DevTools protocol (Node 22's built-in
// WebSocket). Holds a slot for its lifetime; `body(cdp)` returns the result,
// a hard timeout resolves { ok: false, why: "timeout" } and kills the group.
async function withCdp(label, [w, h], killMs, body) {
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
      new Promise((resolve) => { hard = setTimeout(() => resolve({ ok: false, why: "timeout" }), killMs); }),
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
        const listeners = [];
        ws.onmessage = (ev) => {
          const msg = JSON.parse(ev.data);
          if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
          else if (msg.method) {
            for (const wt of waiters) if (wt.method === msg.method) wt.resolve();
            for (const l of listeners) if (l.method === msg.method) l.fn(msg.params);
          }
        };
        const send = (method, params = {}) => new Promise((res) => {
          const id = ++nextId;
          pending.set(id, res);
          ws.send(JSON.stringify({ id, method, params }));
        });
        const once = (method) => new Promise((resolve) => waiters.push({ method, resolve }));
        const on = (method, fn) => listeners.push({ method, fn });
        const evaluate = async (expression) =>
          (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
        // Navigate and poll for data-lab-ready (80 × 250ms), then settle: fonts,
        // two frames, then a beat for layout-driven effects. Returns `ready`.
        const load = async (url) => {
          await send("Page.enable");
          const loaded = once("Page.loadEventFired");
          await send("Page.navigate", { url });
          await Promise.race([loaded, sleep(45_000)]);
          let ready = false;
          for (let i = 0; i < 80 && !ready; i++) {
            ready = await evaluate(`!!document.querySelector('[data-lab-ready="1"]')`);
            if (!ready) await sleep(250);
          }
          await evaluate(`document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 400)))))`);
          return ready;
        };
        return await body({ send, once, on, evaluate, load });
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

// Screenshots go through the DevTools protocol, not --screenshot: headless
// Chrome clamps windows to >=500px wide, so a 390px --window-size lays out at
// 500 and crops (verified). CDP device metrics give a true 390px viewport, and
// the capture waits for data-lab-ready on the very page being shot.
async function cdpScreenshot(label, url, [w, h], mobile, pngPath) {
  return withCdp(label, [w, h], CHROME_KILL_MS, async ({ send, load }) => {
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
    const ready = await load(url);
    const shot = await send("Page.captureScreenshot", { format: "png" });
    if (!shot.result?.data) return { ok: false, why: "capture failed" };
    fs.writeFileSync(pngPath, Buffer.from(shot.result.data, "base64"));
    return ready ? { ok: true } : { ok: false, why: "not ready after 20s" };
  });
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

// ————— motion —————

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// Frames are inlined as data URIs so the sheet's own script can read their
// pixels (file:// images taint the canvas): each changed frame gets a red box
// around the pixels that moved since the previous frame, plus the Δ% of area.
function sheetHtml({ skin, name, url, action }, frames) {
  const cols = Math.min(SHEET_COLS, frames.length);
  const changed = frames.filter((f) => f.changed).length;
  const cells = frames.map((f, i) => {
    const t = f.t === null ? "before action" : `+${f.t}ms`;
    const tag = i === 0 ? "" : f.changed ? `<b>changed</b>` : `<i>= prev</i>`;
    const cls = i === 0 ? "first" : f.changed ? "moved" : "same";
    return `<figure class="${cls}"><div class="f"><img src="data:image/jpeg;base64,${f.buf.toString("base64")}" width="${FRAME_W}"></div>` +
      `<figcaption><span>#${i} · ${t}</span>${tag}</figcaption></figure>`;
  }).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 16px; background: #15171a; color: #e8e6e1; font: 14px/1.35 -apple-system, "Helvetica Neue", sans-serif; width: max-content; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    p { margin: 0 0 12px; color: #b8b4ab; max-width: ${cols * (FRAME_W + 16)}px; overflow-wrap: anywhere; }
    .grid { display: grid; grid-template-columns: repeat(${cols}, ${FRAME_W + 6}px); gap: 10px; }
    figure { margin: 0; border: 3px solid #3a3d42; background: #000; }
    figure.moved { border-color: #e0a526; }
    .f { position: relative; } img { display: block; }
    .ov { position: absolute; inset: 0; pointer-events: none; }
    figcaption { display: flex; justify-content: space-between; gap: 8px; padding: 3px 6px; font-size: 14px; background: #202328; }
    b { color: #e0a526; font-weight: 600; } i { color: #8a8f96; font-style: normal; }
  </style></head><body>
  <h1>${escapeHtml(skin)} · motion-${escapeHtml(name)}</h1>
  <p>${escapeHtml(url)}<br>action: ${escapeHtml(action)} · ${frames.length} frames · ${changed}/${frames.length - 1} changed vs previous ·
  median capture ${Math.round(median(frames.map((f) => f.latency)))}ms<br>amber border = pixels changed since the previous frame ·
  pink cells = where they changed (12px grid; omitted when >30% of the view moved) · Δ = share of the frame that changed</p>
  <div class="grid">${cells}</div>
  <script>
  (async () => {
    const figs = [...document.querySelectorAll("figure")];
    const imgs = figs.map((f) => f.querySelector("img"));
    await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
    const W = imgs[0].naturalWidth, H = imgs[0].naturalHeight;
    const cv = Object.assign(document.createElement("canvas"), { width: W, height: H });
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    const px = imgs.map((i) => { ctx.drawImage(i, 0, 0); return ctx.getImageData(0, 0, W, H).data; });
    const out = [];
    for (let k = 1; k < px.length; k++) {
      if (!figs[k].classList.contains("moved")) continue;
      const a = px[k - 1], b = px[k];
      const C = 12, gw = Math.ceil(W / C), cells = new Uint8Array(gw * Math.ceil(H / C));
      let n = 0;
      for (let p = 0; p < a.length; p += 4) {
        if (Math.max(Math.abs(a[p] - b[p]), Math.abs(a[p + 1] - b[p + 1]), Math.abs(a[p + 2] - b[p + 2])) <= 16) continue;
        n++; const q = p >> 2;
        cells[((q / W / C) | 0) * gw + (((q % W) / C) | 0)] = 1;
      }
      const pct = (100 * n) / (W * H);
      out.push(pct);
      const whole = cells.reduce((a, v) => a + v, 0) > 0.3 * cells.length;
      figs[k].querySelector("b").textContent = "changed · Δ " + (pct < 0.1 ? pct.toFixed(2) : pct.toFixed(1)) + "%" + (whole ? " (whole view)" : "");
      if (whole) continue; // a fly-to / fade moves everything — an overlay would only bury the frame
      // overlay: every 12px cell that changed, outlined — scattered motion stays scattered
      const ov = Object.assign(document.createElement("canvas"), { width: W, height: H, className: "ov" });
      const o = ov.getContext("2d");
      o.fillStyle = "rgba(255,45,111,0.25)"; o.strokeStyle = "#ff2d6f"; o.lineWidth = 1.5;
      cells.forEach((v, c) => { if (v) { const x = (c % gw) * C, y = ((c / gw) | 0) * C; o.fillRect(x, y, C, C); o.strokeRect(x + 0.75, y + 0.75, C - 1.5, C - 1.5); } });
      figs[k].querySelector(".f").appendChild(ov);
    }
    window.__maxDelta = out.length ? Math.max(...out) : 0;
    document.body.dataset.done = "1";
  })();
  </script></body></html>`;
}

// One Chrome session per scenario: live page → action → timed frames (downscaled
// at capture via CDP clip scale) → contact-sheet page in the same tab → JPEG.
async function captureMotion(opts, name, url, framesDir, jpg) {
  const sc = MOTION[name];
  const [w, h] = MOTION_VP;
  return withCdp(`${opts.skin}:motion-${name}`, [w, h], MOTION_KILL_MS, async ({ send, once, on, evaluate, load }) => {
    const errors = [];
    on("Runtime.exceptionThrown", (p) => errors.push(String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "exception").split("\n")[0]));
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    if (!(await load(url))) return { ok: false, retry: true, why: "not ready after 20s" };
    await sleep(MOTION_SETTLE_MS);

    if (sc.hook) {
      let has = false;
      for (let t = 0; t <= HOOK_WAIT_MS && !has; t += 250) {
        has = await evaluate(`typeof window.__lab?.${sc.hook} === "function"`);
        if (!has) await sleep(250);
      }
      if (!has) return { ok: false, why: `skin does not expose window.__lab.${sc.hook}` };
    }

    const frames = [];
    const grab = async (t) => {
      const t0 = performance.now();
      const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 80, clip: { x: 0, y: 0, width: w, height: h, scale: FRAME_W / w } });
      if (!r.result?.data) throw new Error(`frame capture failed: ${r.error?.message ?? "no data"}`);
      const buf = Buffer.from(r.result.data, "base64");
      const file = path.join(framesDir, `f${String(frames.length).padStart(3, "0")}.jpg`);
      fs.writeFileSync(file, buf);
      const prev = frames.at(-1);
      frames.push({ file, t, buf, latency: performance.now() - t0, changed: prev ? !prev.buf.equals(buf) : false });
    };

    await grab(sc.call || sc.keys ? null : 0);
    let action = "none (idle)";
    if (sc.call) {
      action = sc.call;
      // fire-and-forget: a returned promise is NOT awaited, frames start now
      const r = await send("Runtime.evaluate", { expression: `(() => { const v = ${sc.call}; return v === false ? "no-op" : "ok"; })()`, returnByValue: true });
      const ex = r.result?.exceptionDetails;
      if (ex) return { ok: false, why: `window.__lab.${sc.hook} threw: ${String(ex.exception?.description ?? ex.text).split("\n")[0].slice(0, 160)}` };
      if (r.result?.result?.value === "no-op") return { ok: true, skipped: `window.__lab.${sc.hook} returned false — skin has nothing to animate here; skipped` };
    } else if (sc.keys) {
      action = `Konami via Input.dispatchKeyEvent (${sc.keys.map((k) => k[0].replace("Arrow", "")).join(" ")})`;
      // headless tabs are unfocused: without focus emulation dispatchKeyEvent can block forever
      await send("Page.bringToFront");
      await send("Emulation.setFocusEmulationEnabled", { enabled: true });
      const key = (params) => Promise.race([send("Input.dispatchKeyEvent", params), sleep(10_000).then(() => { throw new Error(`Input.dispatchKeyEvent ${params.key} timed out`); })]);
      for (const [k, code, vk] of sc.keys) {
        const base = { key: k, code, windowsVirtualKeyCode: vk };
        const text = k.length === 1 ? { text: k, unmodifiedText: k } : {};
        await key({ type: "keyDown", ...base, ...text });
        await key({ type: "keyUp", ...base });
      }
    }
    const start = performance.now();
    for (let i = 1; i * sc.every <= sc.span; i++) {
      const wait = i * sc.every - (performance.now() - start);
      if (wait > 0) await sleep(wait);
      await grab(Math.round(performance.now() - start));
    }

    // contact sheet: same tab, file:// page next to the frames
    const html = path.join(framesDir, "sheet.html");
    fs.writeFileSync(html, sheetHtml({ skin: opts.skin, name, url, action }, frames));
    const loaded = once("Page.loadEventFired");
    await send("Page.navigate", { url: `file://${html}` });
    await Promise.race([loaded, sleep(30_000)]);
    const [sw, sh] = await evaluate(`[Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), document.documentElement.scrollHeight]`) ?? [];
    if (!sw || !sh) return { ok: false, why: "contact sheet did not lay out" };
    await send("Emulation.setDeviceMetricsOverride", { width: sw, height: sh, deviceScaleFactor: 1, mobile: false });
    for (let i = 0; i < 120 && !(await evaluate(`document.body.dataset.done === "1"`)); i++) await sleep(250);
    const maxDelta = await evaluate(`window.__maxDelta`);
    await evaluate(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`);
    let bytes = 0;
    for (const quality of [72, 60, 50, 40]) {
      const shot = await send("Page.captureScreenshot", { format: "jpeg", quality, clip: { x: 0, y: 0, width: sw, height: sh, scale: 1 } });
      if (!shot.result?.data) return { ok: false, why: "contact sheet capture failed" };
      const buf = Buffer.from(shot.result.data, "base64");
      fs.writeFileSync(jpg, buf);
      bytes = buf.length;
      if (bytes <= SHEET_MAX_BYTES) break;
    }
    const lat = frames.map((f) => f.latency);
    return {
      ok: errors.length === 0,
      why: errors.length ? `uncaught: ${errors[0].slice(0, 160)}` : "",
      bytes, sheet: [sw, sh],
      frames: frames.length, changed: frames.filter((f) => f.changed).length, maxDelta,
      latency: Math.round(median(lat)), lastT: frames.at(-1).t,
      slow: median(lat) > sc.every,
    };
  });
}

async function motion(opts, name, outDir) {
  const url = `${opts.base}/lab/${opts.skin}/${MOTION[name].query}`;
  const jpg = path.join(outDir, `motion-${name}.jpg`);
  console.log(`motion ${name}: ${url}`);
  fs.rmSync(jpg, { force: true });
  const warm = await httpGet(url, WARMUP_MS);
  if (warm.error || warm.status !== 200) return { status: `FAIL warm-up ${warm.error ?? `HTTP ${warm.status}`}`, jpg };
  const once = async () => {
    const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), "lab-motion-"));
    const t0 = Date.now();
    try {
      return { ...(await captureMotion(opts, name, url, framesDir, jpg)), wall: Date.now() - t0 };
    } finally {
      fs.rmSync(framesDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    }
  };
  let r = await once();
  // A Fast Refresh rebuild right after an edit can miss the ready flag once.
  if (!r.ok && r.retry) r = await once();
  if (r.skipped) return { status: `SKIP ${r.skipped}`, ...r, jpg };
  if (r.frames && r.slow) console.log(`  note: median capture ${r.latency}ms > ${MOTION[name].every}ms interval — frames are as fast as the machine allows; captions carry true ms`);
  return { status: r.ok ? "ok" : `FAIL ${r.why}`, ...r, jpg };
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

  if (opts.motion) {
    const res = [];
    for (const name of opts.motion) {
      const r = await motion(opts, name, outDir);
      if (!r.status.startsWith("ok") && !r.status.startsWith("SKIP")) exit = 2;
      res.push([name, r]);
    }
    console.log(`\n${"scenario".padEnd(20)}${"frames".padStart(7)}${"changed".padStart(9)}${"max Δ%".padStart(8)}${"cap ms".padStart(8)}${"wall s".padStart(8)}${"sheet".padStart(11)}${"bytes".padStart(9)}  status`);
    for (const [name, r] of res) {
      const sheet = r.sheet ? `${r.sheet[0]}×${r.sheet[1]}` : "—";
      console.log(`${name.padEnd(20)}${String(r.frames ?? "—").padStart(7)}${String(r.frames ? `${r.changed}/${r.frames - 1}` : "—").padStart(9)}` +
        `${String(r.frames ? (r.maxDelta ?? 0).toFixed(2) : "—").padStart(8)}` +
        `${String(r.latency ?? "—").padStart(8)}${String(r.wall ? (r.wall / 1000).toFixed(1) : "—").padStart(8)}${sheet.padStart(11)}${String(r.bytes || "—").padStart(9)}  ${r.status}`);
    }
    const files = res.map(([, r]) => r.jpg).filter((f) => fs.existsSync(f));
    if (files.length) console.log(`\n${files.join("\n")}`);
    console.log(exit === 0 ? "\nshoot: ok" : "\nshoot: FAILED");
    process.exit(exit);
  }

  for (const state of opts.states) {
    const url = `${opts.base}/lab/${opts.skin}/${STATES[state]}`;
    console.log(`${state}: ${url}`);
    let c = await checkState(opts, state, url);
    // A Fast Refresh rebuild right after an edit can miss the ready flag once.
    if (!c.ok && c.why.includes("data-lab-ready")) c = await checkState(opts, state, url);
    for (const l of (c.logs ?? []).slice(0, 10)) console.log(`  console: ${l.slice(0, 200)}`);
    // Under extreme load (load avg 250+) --dump-dom can time out on a healthy
    // page; the CDP screenshot step waits for data-lab-ready itself, so let it
    // be the authority when the dump merely timed out.
    if (!c.ok && c.why === "dump-dom timed out" && !opts.checkOnly) {
      console.log("  warn: dump-dom timed out — deferring to the screenshot step's ready check");
      c = { ...c, ok: true };
    }
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
