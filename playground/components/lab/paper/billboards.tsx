"use client";

// Stand-up props for the diorama: every piece that stands on the ground is a
// billboard — drawn upright in screen space at its projected base point, in
// painter's order (far → near), so the ground can tilt under it. The art for
// each prop is built once per world (memo); per camera frame only the
// wrapper transforms change.
import { memo, useMemo, type ReactNode } from "react";
import { samplePolyline, type Pt, type World } from "@/lib/world";
import { PieceArt, PIECE_TOP, pieceAnchor } from "./set-pieces";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import {
  AtomSpot, BIOME, CapitalSpot, familyRamp, FogIsland, HOUSES, LevelSpot, Mountains, PaperBoat, PaperCloud, Ruins, SET_PIECES,
} from "./art";
import styles from "./paper.module.css";
import { tileCenter } from "./geometry";

export type Place = (p: Pt) => { x: number; y: number; k: number };

export interface Bill { key: string; at: Pt; node: ReactNode }

/** Build every static billboard of the world (memoise on world + zoom factors).
 *  Art comes from the illustrator's library (./art); `kin` spots are returned
 *  separately so the node view can lift them above the dimmed map. */
export function worldBills(world: World, k: { atom: number; place: number; derived: number },
  pops: Record<string, number>, still: boolean,
  spot: { states: Record<string, EvidenceState>; focus: string | null; hover: string | null; kin: string[] | null },
): { bills: Bill[]; kinBills: Bill[] } {
  const bills: Bill[] = [];
  const kinBills: Bill[] = [];
  for (const r of world.regions) {
    if (!r.setPiece) continue;
    const a = pieceAnchor(world, r);
    const sp = SET_PIECES[r.family];
    const pop = pops[r.family] ?? 0;
    bills.push({ key: `sp-${r.family}`, at: { x: a.x, y: a.y },
      node: sp
        ? <g key={pop} className={!still && pop > 0 ? styles.popup : undefined}><sp.C size={120 * k.place} /></g>
        : <PieceArt family={r.family} s={a.s * k.place} sx={a.sx * k.place} pop={pop} animate={!still && pop > 0} /> });
  }
  const fam = new Map(world.nodes.map((n) => [n.name, n.family]));
  const hk = Math.min(k.atom, 1.35);
  for (const c of world.cities) {
    c.blocks.forEach((b, i) => {
      const H = HOUSES[(i + c.node.length) % HOUSES.length];     // deterministic mix, no data
      bills.push({ key: `h-${c.node}-${i}`, at: { x: b.x + b.w / 2, y: b.y + b.h },
        node: <H.C size={H.H * 0.42 * hk} /> });
    });
  }
  world.mountains.forEach((line, li) => {
    const s = samplePolyline(line);
    const step = 110 * k.place;
    const n = Math.max(1, Math.floor(s.length / step));
    for (let i = 0; i <= n; i++) {
      const p = s.at(i / n);
      bills.push({ key: `m-${li}-${i}`, at: { x: p.x, y: p.y + 8 },
        node: <Mountains size={[38, 46, 42][i % 3] * k.place} snow={i % 2 === 0} /> });  // fixed rhythm, not data
    }
  });
  for (const d of world.decor) {
    // the world's own thinning key (variant 0 ≈ ¼ of cells), then every other one: ~60 props
    if (d.variant !== 0 || (d.tile % 2) === 1) continue;
    const c = tileCenter(world, d.tile);
    const kinds = BIOME[d.region];
    if (!kinds) continue;
    const B = kinds[d.tile % kinds.length];      // which biome prop: deterministic mix within the family
    bills.push({ key: `d-${d.tile}`, at: { x: c.x, y: c.y + 6 }, node: <B.C size={B.H * 0.5 * d.scale} /> });
  }
  for (const h of world.harbours) {
    if (h.boats <= 0) continue;
    const shown = Math.min(3, h.boats);
    for (let i = 0; i < shown; i++) {
      bills.push({ key: `b-${h.tile}-${i}`, at: { x: h.pt.x + (30 + (i % 2) * 10) * k.place, y: h.pt.y + (-10 + i * 28) * k.place },
        node: <PaperBoat size={36 * k.place} sail={familyRamp(h.family)} /> });
    }
  }
  // clouds over the three emptiest stretches of sea (weather only, no data)
  world.seaSlots.forEach((b, i) => {
    bills.push({ key: `cl-${i}`, at: { x: b.x + b.w / 2, y: b.y + b.h * 0.7 }, node: <PaperCloud variant={i % 3} size={70} /> });
  });
  // the secret islands
  const hi = world.hiddenIsland;
  bills.push({ key: "fog", at: { x: hi.box.x + hi.box.w / 2, y: hi.box.y + hi.box.h * 0.8 }, node: <FogIsland size={150} /> });
  world.ruinsIsland.slots.forEach((p, i) => bills.push({ key: `ru-${i}`, at: p, node: <Ruins size={42} /> }));

  // level spots (stand up so their thickness and glints read)
  const kin = spot.kin ? new Set(spot.kin) : null;
  for (const n of world.nodes) {
    const st = spot.states[n.name] ?? "untrained";
    const on = n.name === spot.focus;
    const zoom = on ? 1.3 : n.atom ? k.atom : k.derived;
    const city = world.cities.find((c) => c.node === n.name);
    const r = n.atom ? 32 : 20;
    const node = n.atom
      ? (city?.capital ? <CapitalSpot name={n.name} state={st} r={r * 1.1} family={n.family} /> : <AtomSpot name={n.name} state={st} r={r} family={n.family} />)
      : <LevelSpot name={n.name} state={st} r={r} />;
    // the art draws the spot's top face centred at 0,0 — its base sits a thickness lower
    const bill = { key: `s-${n.name}`, at: { x: n.center.x, y: n.center.y + 0.1 }, node: <g transform={`scale(${zoom})`}>{node}</g> };
    if (kin && kin.has(n.name)) kinBills.push(bill); else bills.push(bill);
  }
  return { bills, kinBills };
}

/** Paint billboards (far first) at their projected bases. */
export const Billboards = memo(function Billboards({ bills, place }: { bills: Bill[]; place: Place }) {
  const sorted = useMemo(() => [...bills].sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x), [bills]);
  return (
    <g aria-hidden pointerEvents="none">
      {sorted.map((b) => {
        const p = place(b.at);
        return <g key={b.key} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${p.k.toFixed(4)})`}>{b.node}</g>;
      })}
    </g>
  );
});

export { PIECE_TOP };
