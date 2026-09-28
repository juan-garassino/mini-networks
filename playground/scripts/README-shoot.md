# shoot.mjs — lab bake-off screenshot harness

Headless Chrome over the DevTools protocol, Node built-ins only. At most 2 Chrome
(or tsc) processes machine-wide (`.lab-shots/.slots/{0,1}`); every Chrome runs in its
own process group with a temp profile that is always removed.

## Still states (unchanged)

```
node scripts/shoot.mjs --skin <s> --round <N|F|critic> [--states overview,region,node,dense] [--vp desktop,mobile] [--check-only] [--typecheck]
```

→ `.lab-shots/<skin>/r<N>/<state>@<vp>.jpg`, all with `still=1`.

## Live motion

```
node scripts/shoot.mjs --skin <s> --round <N|F|critic> --motion <scenario>[,<scenario>…] [--base URL]
```

`--motion` replaces the still states for that run (`--typecheck` still works, `--check-only`
does not). Pages load **without** `still=1` at 1440×900. After `data-lab-ready="1"` the
harness waits 1.5 s (so intro fly-ins finish), captures a "before" frame, runs the
action, then captures frames on a fixed schedule.

| scenario | page | action | frames |
|---|---|---|---|
| `select` | `?zoom=region&focus=transformer` | `window.__lab.select("clip")` | every 200 ms for 3 s |
| `overview-to-region` | `?zoom=overview` | `window.__lab.view({ zoom: "region", focus: "classifier" })` | every 200 ms for 2.4 s |
| `konami` | `?zoom=overview` | ↑ ↑ ↓ ↓ ← → ← → b a via CDP `Input.dispatchKeyEvent` (real `keydown` events on `window`) | every 250 ms for 4 s |
| `critter` | `?zoom=region&focus=transformer` | `window.__lab.critterClick(7)` | every 250 ms for 3 s |
| `idle` | `?zoom=region&focus=transformer` | none. Catches unwanted idle motion. | every 500 ms for 4 s |

Output is one contact sheet per scenario: `.lab-shots/<skin>/r<N>/motion-<scenario>.jpg`
(4 columns of 480×300 frames). Each frame is captioned with its index and the **measured** ms
since the action. An **amber border** means the pixels changed since the previous frame
(`= prev` means byte-identical). **Pink 12 px cells** show where they changed; they are omitted
when more than 30% of the view moved (fly-to, fade), and the caption then says "whole view".
`Δ` is the share of the frame that changed. The terminal summary prints frames, changed/total,
max Δ%, median capture latency, wall time, sheet size and bytes. Frames go to a temp dir that
is deleted afterwards. Sheets stay under 1.5 MB (JPEG quality steps down 72→40 if needed).

**Reading a sheet:** for `idle`, you want every frame to be `= prev`, or at most a
blink-sized pink cell. A walking critter shows as a cluster of cells that moves from frame to frame. A fly-to
shows as "whole view" frames that settle to `= prev` once the camera stops.

Frame timing uses `Page.captureScreenshot` (JPEG, downscaled at capture via `clip.scale`).
The measured median is 30–250 ms per capture at load averages of 5–40, which fits the
200 ms schedule. When the machine is slower than the interval, frames come as fast as
it allows and a note is printed; the captions always carry the true times.
`Page.startScreencast` was not used because it only emits frames on change, which
would hide idle stillness.

Failures (exit 2): the page never became ready (retried once, since Fast Refresh can miss the
flag), `skin does not expose window.__lab.<method>`, the hook threw, an uncaught page
exception happened during the run, a capture failed, or the scenario timed out (4 min).

## `window.__lab` test-hook contract (for skin builders)

Install it **in the browser only, after the skin sets `data-lab-ready="1"`** (e.g. in a
`useEffect` that depends on `ready`), and remove it on unmount. The harness polls for up
to 3 s after ready. It is inert in production: nothing calls it except the harness.

```ts
window.__lab = {
  select(name: string): void,                       // same path as a user click on that model: fly-to, card pop-up, critter walk
  view(v: { zoom: "overview" | "region" | "node"; focus?: string }): void, // same path as URL/nav-driven view change, animated
  critterClick(n: number): void | false,             // as if the critter was clicked n times (7 → "train" egg)
};
```

- Run the **real interaction path**, animated exactly as a user would see it. Do not
  jump straight to the end state, and do not read `still` from anywhere else.
- Return synchronously. A returned promise is not awaited, because frame capture starts immediately.
- Return exactly `false` to say "this skin has nothing to animate for this hook" (e.g.
  `critterClick` in `flow`, which has no critter). The harness then reports
  `SKIP … returned false` (exit 0) instead of a failure.
- The Konami egg needs no hook. Listen for `keydown` on `window` / `document` (`e.key`
  values `ArrowUp`… `b`, `a`).

Minimal install:

```ts
useEffect(() => {
  if (!ready) return;
  const w = window as unknown as { __lab?: unknown };
  w.__lab = { select, view: (v) => setView(v), critterClick: (n) => { for (let i = 0; i < n; i++) onCritterClick(); } };
  return () => { delete w.__lab; };
}, [ready, select, setView, onCritterClick]);
```
