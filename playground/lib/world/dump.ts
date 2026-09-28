// Debug viewer for the world contract. Prints an ASCII terrain map and build
// timings; optionally writes a debug SVG of the world (or of the flow layout).
//
//   node --experimental-strip-types --no-warnings lib/world/dump.ts [--svg out.svg] [--flow]
import { readFileSync, writeFileSync } from "node:fs";
import type { TaxonomyResponse } from "../types.ts";
import type { FlowLayout, World } from "./types.ts";
import { T } from "./types.ts";
import { buildWorld, ferryRoute, lineage, parkingSpot, pathToAtom } from "./world.ts";
import { buildFlow } from "./flow.ts";
import { familyMapFromBlueprint } from "./graph.ts";
import { roundedD } from "./path.ts";

const tax: TaxonomyResponse = JSON.parse(
  readFileSync(new URL("./__fixtures__/taxonomy.json", import.meta.url), "utf8"),
);
const fam = familyMapFromBlueprint();
const args = process.argv.slice(2);
const svgAt = args.indexOf("--svg");
const svgPath = svgAt >= 0 ? args[svgAt + 1] : null;
const flowMode = args.includes("--flow");
const walkAt = args.indexOf("--walk"); // --walk <model>: overlay pathToAtom
const ferryAt = args.indexOf("--ferry"); // --ferry <composition>: overlay ferryRoute

const COLORS: Record<string, string> = {
  perception: "#8FE3C0", sequence: "#9CC9FF", generative: "#FFB38A",
  representation: "#C6B2FF", structure: "#FFE27A", decision: "#FF9CCB",
};
const colorOf = (f: string) => COLORS[f] ?? "#ddd";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function time(fn: () => void, n: number): number {
  const ts: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    fn();
    ts.push(performance.now() - t0);
  }
  ts.sort((a, b) => a - b);
  return ts[Math.floor(n / 2)];
}

function ascii(w: World): string {
  const letters = new Map<number, string>();
  const used = new Set<string>();
  for (const r of w.regions) {
    const ch = [...r.family].find((c) => !used.has(c)) ?? "?";
    used.add(ch);
    letters.set(r.id, ch);
  }
  const decor = new Set(w.decor.map((d) => d.tile));
  const lines: string[] = [];
  for (let y = 0; y < w.rows; y++) {
    let s = "";
    for (let x = 0; x < w.cols; x++) {
      const i = y * w.cols + x;
      const t = w.terrain[i];
      s += t === T.SEA ? "~" : t === T.RIVER ? "=" : t === T.ROAD ? "#" : t === T.BRIDGE ? "H"
        : t === T.FOOT ? "@" : t === T.SETPIECE ? "S" : decor.has(i) ? "*" : letters.get(w.regionOf[i]) ?? "?";
    }
    lines.push(s);
  }
  const legend = w.regions.map((r) => `${letters.get(r.id)}=${r.family}`).join(" ");
  return `${lines.join("\n")}\n${legend}  ~ sea  = river  # road  H bridge  @ node  S set-piece  * decor`;
}

function worldSvg(w: World): string {
  const overlay: string[] = [];
  if (walkAt >= 0) {
    const p = pathToAtom(w, args[walkAt + 1]);
    overlay.push(`<path d="${roundedD(p.points, 6)}" fill="none" stroke="#111" stroke-width="3" stroke-dasharray="2 5" stroke-linecap="round"/>`);
  }
  const litAt = args.indexOf("--lineage"); // --lineage <model>: highlight every parent/child road
  if (litAt >= 0) {
    for (const name of args[litAt + 1].split(",")) {
      const lin = lineage(w, name);
      for (const r of lin.parents) {
        overlay.push(`<path d="${roundedD(r.lanePoints, 8)}" fill="none" stroke="#e0218a" stroke-width="4" opacity="0.85"/>`);
      }
    }
  }
  if (ferryAt >= 0) {
    const c = tax.compositions.find((x) => x.name === args[ferryAt + 1]);
    const f = ferryRoute(w, c ? c.composes : []);
    for (let i = 1; i < f.points.length; i++) {
      const a = f.points[i - 1];
      const b = f.points[i];
      overlay.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${f.sea[i] || f.sea[i - 1] ? "#fff" : "#111"}" stroke-width="3" stroke-dasharray="8 5"/>`);
    }
  }
  const S = w.tile;
  const W = w.cols * S;
  const H = w.rows * S;
  const A = w.camera.all;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${A.x} ${A.y} ${A.w} ${A.h}" width="${A.w}" height="${A.h}">`);
  out.push(`<rect x="${A.x}" y="${A.y}" width="${A.w}" height="${A.h}" fill="#24568f"/>`);
  out.push(`<rect width="${W}" height="${H}" fill="#2f6fb8"/>`);
  // secret islands (outside camera.world)
  for (const [isl, fill, mark] of [[w.hiddenIsland, "#d9c98f", "?"], [w.ruinsIsland, "#9a9a8a", "†"]] as const) {
    const b = isl.box;
    out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${S * 2}" fill="${fill}" stroke="#fff" stroke-dasharray="6 4"/>`);
    isl.slots.forEach((p, i) => {
      out.push(`<circle cx="${p.x}" cy="${p.y}" r="${S}" fill="#fffdf6" stroke="#2b2118" stroke-dasharray="3 3"/>`);
      out.push(`<text x="${p.x}" y="${p.y + 5}" font-size="14" text-anchor="middle" font-family="sans-serif">${mark}</text>`);
      out.push(`<text x="${p.x}" y="${p.y + S * 2 + 4}" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#2b2118">${esc(isl.names[i])}</text>`);
    });
    out.push(`<text x="${isl.dragons.x}" y="${isl.dragons.y}" font-size="13" font-style="italic" text-anchor="middle" font-family="serif" fill="#fff">here be dragons</text>`);
  }
  for (let y = 0; y < w.rows; y++) {
    let x = 0;
    while (x < w.cols) {
      const r = w.regionOf[y * w.cols + x];
      let x2 = x;
      while (x2 < w.cols && w.regionOf[y * w.cols + x2] === r) x2++;
      if (r >= 0) out.push(`<rect x="${x * S}" y="${y * S}" width="${(x2 - x) * S}" height="${S}" fill="${colorOf(w.regions[r].family)}"/>`);
      x = x2;
    }
  }
  for (let i = 0; i < w.terrain.length; i++) {
    if (w.terrain[i] !== T.RIVER) continue;
    out.push(`<rect x="${(i % w.cols) * S}" y="${Math.floor(i / w.cols) * S}" width="${S}" height="${S}" fill="#5aa0e8"/>`);
  }
  for (const d of w.decor) {
    out.push(`<circle cx="${((d.tile % w.cols) + 0.5) * S}" cy="${(Math.floor(d.tile / w.cols) + 0.5) * S}" r="${3 * d.scale}" fill="#2d6b3a" opacity="0.5"/>`);
  }
  for (const s of w.seaSlots) out.push(`<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="none" stroke="#fff" stroke-dasharray="4 4" opacity="0.5"/>`);
  for (const r of w.regions) {
    if (!r.setPiece) continue;
    const b = r.setPiece;
    out.push(`<rect x="${b.x * S}" y="${b.y * S}" width="${b.w * S}" height="${b.h * S}" fill="#8b5a2b" opacity="0.55" rx="4"/>`);
    out.push(`<text x="${(b.x + b.w / 2) * S}" y="${(b.y + b.h / 2) * S + 5}" font-size="13" text-anchor="middle" font-family="sans-serif" fill="#fff">${esc(r.family)}</text>`);
  }
  // mountains: little inked peaks along the range polyline
  for (const m of w.mountains) {
    out.push(`<polyline points="${m.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="#5b4636" stroke-width="1" stroke-dasharray="2 4" opacity="0.6"/>`);
    for (const p of m) out.push(`<path d="M${p.x - 6} ${p.y + 5} L${p.x} ${p.y - 6} L${p.x + 6} ${p.y + 5}" fill="#8c7a66" stroke="#3b2e22" stroke-width="1.2"/>`);
  }
  for (const c of w.cities) {
    for (const b of c.blocks) out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${c.capital ? "#7a3b2e" : "#6b5a4a"}" opacity="0.85"/>`);
  }
  for (const h of w.harbours) {
    const tx = (h.tile % w.cols + 0.5) * S;
    const ty = (Math.floor(h.tile / w.cols) + 0.5) * S;
    out.push(`<line x1="${tx}" y1="${ty}" x2="${h.pt.x}" y2="${h.pt.y}" stroke="#4a3120" stroke-width="4"/>`);
    out.push(`<circle cx="${h.pt.x}" cy="${h.pt.y}" r="7" fill="#fff" stroke="#4a3120" stroke-width="2"/>`);
    out.push(`<text x="${h.pt.x}" y="${h.pt.y + 4}" font-size="10" text-anchor="middle" font-family="sans-serif" font-weight="700">${h.boats}</text>`);
  }
  const roadColor = { primary: "#f2b632", secondary: "#8a6d2f", bridge: "#e23d3d" } as const;
  for (const r of w.roads) {
    if (!r.lanePoints.length) continue;
    out.push(`<path d="${roundedD(r.lanePoints, 8)}" fill="none" stroke="${roadColor[r.kind]}" stroke-width="${r.kind === "secondary" ? 2 : 3}" stroke-linejoin="round" stroke-linecap="round" opacity="0.95"/>`);
  }
  for (const r of w.roads) {
    for (const c of r.chevrons) {
      out.push(`<path d="M-3 -3.5 L2.5 0 L-3 3.5" transform="translate(${c.x} ${c.y}) rotate(${(c.angle * 180) / Math.PI})" fill="none" stroke="#2b2118" stroke-width="1.4" stroke-linejoin="round"/>`);
    }
  }
  for (const b of w.bridges) {
    for (const t of b.tiles) out.push(`<rect x="${(t % w.cols) * S + 2}" y="${Math.floor(t / w.cols) * S + 2}" width="${S - 4}" height="${S - 4}" fill="#6b3d1f"/>`);
  }
  for (const n of w.nodes) {
    const b = n.foot;
    out.push(`<rect x="${b.x * S}" y="${b.y * S}" width="${b.w * S}" height="${b.h * S}" fill="#fffdf6" stroke="#2b2118" stroke-width="${n.atom ? 3 : 2}" rx="${n.atom ? 8 : 5}"/>`);
  }
  for (const l of w.labels) {
    out.push(`<rect x="${l.box.x}" y="${l.box.y}" width="${l.box.w}" height="${l.box.h}" fill="#fffdf6" opacity="0.8" rx="3"/>`);
    out.push(`<text x="${l.box.x + l.box.w / 2}" y="${l.box.y + l.box.h / 2 + l.font * 0.35}" font-size="${l.font}" text-anchor="middle" font-family="sans-serif" font-weight="${l.font === 15 ? 700 : 400}" fill="#2b2118">${esc(l.text)}</text>`);
  }
  for (const n of w.nodes) {
    const p = parkingSpot(w, n.name);
    out.push(`<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="#e0218a"/>`);
  }
  out.push(`<rect width="${W}" height="${H}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="12 6" opacity="0.6"/>`);
  out.push(...overlay);
  out.push(`</svg>`);
  return out.join("\n");
}

function flowSvg(f: FlowLayout): string {
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f.width} ${f.height}" width="${f.width}" height="${f.height}">`);
  out.push(`<rect width="${f.width}" height="${f.height}" fill="#F3F0FF"/>`);
  for (const l of f.lanes) {
    out.push(`<rect x="0" y="${l.y}" width="${f.width}" height="${l.h}" fill="${colorOf(l.family)}" opacity="0.25"/>`);
    out.push(`<text x="6" y="${l.y + 14}" font-size="13" font-family="sans-serif" fill="#3B2E5A">${esc(l.family)}</text>`);
  }
  for (const p of f.pipes) {
    out.push(`<path d="${roundedD(p.points, 10)}" fill="none" stroke="${p.crossLane ? "#e23d3d" : "#3B2E5A"}" stroke-width="2" opacity="0.7"/>`);
    for (const c of p.chevrons) {
      out.push(`<path d="M-3 -3.5 L2.5 0 L-3 3.5" transform="translate(${c.x} ${c.y}) rotate(${(c.angle * 180) / Math.PI})" fill="none" stroke="#3B2E5A" stroke-width="1.4"/>`);
    }
  }
  for (const n of f.nodes) {
    out.push(`<rect x="${n.box.x}" y="${n.box.y}" width="${n.box.w}" height="${n.box.h}" rx="12" fill="${colorOf(n.family)}" stroke="#3B2E5A" stroke-width="1.5"/>`);
    out.push(`<text x="${n.box.x + n.box.w / 2}" y="${n.box.y + n.box.h / 2 + 5}" font-size="13" text-anchor="middle" font-family="sans-serif" fill="#3B2E5A">${esc(n.name)}</text>`);
  }
  out.push(`</svg>`);
  return out.join("\n");
}

const world = buildWorld(tax, fam, {
  onAttempt: (a, f) => { if (f.length) console.log(`attempt ${a} failed: ${f.join("; ")}`); },
});
const flow = buildFlow(tax, fam);
console.log(ascii(world));
console.log(`\ngrid ${world.cols}×${world.rows}  nodes ${world.nodes.length}  roads ${world.roads.length}  bridges ${world.bridges.length}  labels ${world.labels.length}  decor ${world.decor.length}`);
console.log(`lanes ${JSON.stringify(world.roads.reduce<Record<number, number>>((m, r) => { m[r.lane] = (m[r.lane] ?? 0) + 1; return m; }, {}))}  chevrons ${world.roads.reduce((a, r) => a + r.chevrons.length, 0)}  harbours ${world.harbours.map((h) => `${h.family}:${h.boats}`).join(",")}  cities ${world.cities.map((c) => `${c.node}${c.capital ? "*" : ""}:${c.blocks.length}`).join(",")}  mountains ${world.mountains.length} (${world.mountains.reduce((a, m) => a + m.length, 0)} pts)`);
{
  let minD = Infinity;
  let pair = "";
  for (const [i, a] of world.nodes.entries()) for (const b of world.nodes.slice(i + 1)) {
    const d = Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y) / world.tile;
    if (d < minD) { minD = d; pair = `${a.name}/${b.name}`; }
  }
  console.log(`min node-centre distance ${minD.toFixed(1)} tiles (${pair})`);
}
console.log("regions:", world.regions.map((r) => `${r.family} ${r.tiles}/${r.targetTiles}${r.islet ? " islet" : ""}${r.setPiece ? ` sp ${r.setPiece.w}×${r.setPiece.h}` : " no-sp"}`).join(", "));
console.log(`flow ${flow.width}×${flow.height}  lanes ${flow.lanes.map((l) => l.family).join(" / ")}  crossings ${flow.crossings} (seed ${flow.seedCrossings})`);
console.log(`median buildWorld ${time(() => buildWorld(tax, fam), 15).toFixed(1)}ms  buildFlow ${time(() => buildFlow(tax, fam), 15).toFixed(1)}ms`);
{
  const bd = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    Math.hypot(Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w)), Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h)));
  const S = world.tile;
  const fp = (n: (typeof world.nodes)[number]) => ({ x: n.foot.x * S, y: n.foot.y * S, w: n.foot.w * S, h: n.foot.h * S });
  const amb = world.labels.filter((l) => {
    const own = world.nodes.find((n) => n.name === l.node)!;
    const dOwn = bd(l.box, fp(own));
    return world.nodes.some((n) => n !== own && bd(l.box, fp(n)) <= dOwn);
  }).map((l) => l.node);
  const roadLen = world.roads.reduce((a, r) => a + r.length, 0);
  console.log(`ambiguous labels ${amb.length}${amb.length ? ` (${amb.join(", ")})` : ""}  road px ${roadLen.toFixed(0)}  anchors ${JSON.stringify(world.labels.reduce<Record<string, number>>((m, l) => { m[l.anchor] = (m[l.anchor] ?? 0) + 1; return m; }, {}))}`);
}
console.log("warnings:", world.warnings.length ? world.warnings : "none");
if (svgPath) {
  writeFileSync(svgPath, flowMode ? flowSvg(flow) : worldSvg(world));
  console.log(`wrote ${svgPath}`);
}
