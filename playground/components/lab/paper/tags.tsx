"use client";

// Screen-space name tags: constant size (16px atoms / 14px derived), placed
// by priority with collision culling and a 24px edge margin
// (lib/world placeScreenLabels). Cut-paper tags in an HTML overlay above the
// diorama. A tag may carry a station ticket = the model's run count.
//
// Diorama: tags are placed in SCREEN space — every footprint and obstacle is
// projected first (place()), then handed to placeScreenLabels as a pseudo
// world whose camera is the viewport itself (scale 1).
import { useMemo } from "react";
import { placeScreenLabels, type Box, type Pt, type World } from "@/lib/world";
import { displayName } from "@/components/lab/shared/card-model";
import { PAPER } from "./encoding";
import { STORY_FONT } from "./art";
import { secretCaptions } from "./flavour";

const CHAR = 0.56;                    // Fredoka average advance (em)
const TICKET = 26;                    // px added for the run-count ticket

const hit = (a: Box, b: Box, p = 0) => a.x < b.x + b.w + p && b.x < a.x + a.w + p && a.y < b.y + b.h + p && b.y < a.y + a.h + p;

export type Place = (p: Pt) => { x: number; y: number; k: number };

/** A world box that STANDS on its bottom edge → its screen box. */
export function standingBox(place: Place, b: Box): Box {
  const q = place({ x: b.x + b.w / 2, y: b.y + b.h });
  const w = b.w * q.k, h = b.h * q.k;
  return { x: q.x - w / 2, y: q.y - h, w, h };
}

export function PaperTags({ hidden = false, world, place, size, focus, kin, counts, obstacles, spotR, atomsOnly = false, regionSigns = null, version, screenObstacles = [] }: {
  /** the camera is moving: tags wait (placed again when it rests) */
  hidden?: boolean;
  /** screen-px boxes of chrome (HUD) no tag or sign may sit under */
  screenObstacles?: Box[];
  world: World;
  place: Place;
  size: { w: number; h: number };
  focus: string | null;
  /** node view / hovered tree: names lifted above the dimmed map (others muted) */
  kin: string[] | null;
  counts: Record<string, number>;
  /** standing world boxes no tag may cover (set-pieces, critter, focus flag) */
  obstacles: Box[];
  /** drawn spot radius in world px (semantic zoom included) */
  spotR: (name: string) => number;
  atomsOnly?: boolean;
  /** whole-map view: family signs, placed beside their set-piece (standing world box) */
  regionSigns?: { text: string; color: string; box: Box }[] | null;
  /** changes whenever the camera moves (so the memos recompute per frame) */
  version: string;
}) {
  const T = world.tile;
  // region signs (whole-map view): beside their set-piece, clear of tags and spots
  const signs = useMemo(() => {
    if (!regionSigns) return [];
    const taken: Box[] = [...screenObstacles];
    const feet = world.nodes.map((n) => {
      const q = place(n.center), r = spotR(n.name) * q.k + 4;
      return { x: q.x - r, y: q.y - r, w: 2 * r, h: 2 * r };
    });
    const out: { key: string; x: number; y: number; w: number; text: string; color: string }[] = [];
    for (const g of regionSigns) {
      const pb = standingBox(place, g.box);
      const f = 21, w = CHAR * 1.02 * f * g.text.length + 28, h = f * 1.5 + 8;
      const cands = [
        { x: pb.x + pb.w + 8, y: pb.y + pb.h / 2 - h / 2 }, { x: pb.x - 8 - w, y: pb.y + pb.h / 2 - h / 2 },
        { x: pb.x + pb.w / 2 - w / 2, y: pb.y + pb.h + 6 }, { x: pb.x + pb.w / 2 - w / 2, y: pb.y - h - 6 },
        // staked on the piece's own base (covers only its foot)
        { x: pb.x + pb.w / 2 - w / 2, y: pb.y + pb.h - h * 0.8 },
        { x: pb.x + pb.w + 8, y: pb.y + pb.h - h }, { x: pb.x - 8 - w, y: pb.y + pb.h - h },
      ];
      const ok = cands.map((c) => ({ ...c, w, h })).find((c) =>
        c.x > 12 && c.y > 12 && c.x + w < size.w - 12 && c.y + h < size.h - 12 &&
        !taken.some((t) => hit(c, t, 4)) && !feet.some((t) => hit(c, t, 2)));
      if (!ok) continue;
      taken.push(ok);
      out.push({ key: g.text, x: ok.x, y: ok.y, w, text: g.text, color: g.color });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionSigns, version, screenObstacles]);

  const placed = useMemo(() => {
    if (size.w < 10) return [];
    const toTiles = (b: Box) => ({ x: b.x / T, y: b.y / T, w: b.w / T, h: b.h / T });
    // spots lie flat on the tilted ground: project the centre, keep a round-ish box
    const nodes = world.nodes.map((n) => {
      const q = place(n.center);
      const r = (n.name === focus ? spotR(n.name) * 1.3 + 16 : spotR(n.name) + 2) * q.k;
      return { ...n, center: { x: q.x, y: q.y }, foot: toTiles({ x: q.x - r, y: q.y - r * 0.9, w: 2 * r, h: 1.8 * r }) };
    });
    const extra = obstacles.map((o, i) => {
      const b = standingBox(place, o);
      return { name: `__o${i}`, family: "", depth: 0, atom: false, primary: null, parents: [], center: { x: b.x + b.w / 2, y: b.y + b.h / 2 }, foot: toTiles(b) };
    });
    const labels = world.labels.filter((l) => !atomsOnly || l.node === focus || l.font === 15);
    return placeScreenLabels({ ...world, nodes: [...nodes, ...extra], labels }, { x: 0, y: 0, w: size.w, h: size.h }, size, {
      font: { atom: 15, derived: 13 }, focus, edgeMargin: 24, gap: 4,
      // family signs are placed first (they name the islands); tags avoid them and the HUD
      obstacles: [...screenObstacles, ...signs.map((g) => ({ x: g.x, y: g.y, w: g.w, h: 21 * 1.5 + 8 }))],
      measure: (t, f) => ({ w: CHAR * f * t.length + 16 + (counts[t] ? TICKET : 0), h: 1.35 * f + 8 }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, version, size.w, size.h, focus, counts, obstacles, atomsOnly, signs, screenObstacles]);

  // captions for the secret islands, greedily culled against everything above
  const extras = useMemo(() => {
    const taken: Box[] = [...placed.map((l) => ({ x: l.x, y: l.y, w: l.w, h: l.h })), ...signs.map((g) => ({ x: g.x, y: g.y, w: g.w, h: 40 }))];
    const out: { key: string; x: number; y: number; w: number; text: string; kind: string }[] = [];
    for (const c of secretCaptions(world)) {
      const p = place(c.at);
      const f = c.kind === "dragons" ? 15 : 13;
      const w = CHAR * f * c.text.length + 14, h = f * 1.35 + 6;
      const b = { x: p.x - w / 2, y: p.y, w, h };
      if (b.x < 24 || b.y < 24 || b.x + w > size.w - 24 || b.y + h > size.h - 24) continue;
      if (taken.some((t) => hit(b, t, 3))) continue;
      taken.push(b);
      out.push({ key: c.key, x: b.x, y: b.y, w, text: c.text, kind: c.kind });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, signs, world, version]);

  const kinSet = kin ? new Set(kin) : null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" style={{ visibility: hidden ? "hidden" : undefined }}>
      {placed.map((l) => {
        const hot = l.node === focus;
        const muted = kinSet ? !kinSet.has(l.node) : false;
        const n = counts[l.node] ?? 0;
        return (
          <div key={l.node}
            className="absolute flex items-center justify-center gap-1.5 whitespace-nowrap"
            style={{
              left: l.x, top: l.y, width: l.w, height: l.h, fontSize: l.font,
              // storybook model tag: parchment, ink frame, the map's serif
              background: hot ? "#3B2A20" : muted ? "rgba(242,226,192,0.8)" : "#F2E2C0",
              color: hot ? "#FCF3DE" : muted ? "#6B5E50" : "#3B2A20",
              border: `1.2px solid ${hot ? "#3B2A20" : "#6A4127"}`, borderRadius: 2,
              fontFamily: STORY_FONT, fontWeight: 700, letterSpacing: 0.1,
              boxShadow: muted ? "none" : "1.5px 2.5px 0 rgba(42,27,20,0.25)",
            }}>
            {displayName(l.node)}
            {n > 0 && (
              <span className="rounded-sm px-1 text-[12px] font-semibold leading-4"
                style={{ background: hot ? PAPER.die : PAPER.face, color: hot ? PAPER.ink : PAPER.die }}>
                {n}
              </span>
            )}
          </div>
        );
      })}
      {signs.map((g) => (
        <div key={g.key} className="absolute flex items-center justify-center whitespace-nowrap rounded-lg text-[21px] leading-none"
          style={{ left: g.x, top: g.y, width: g.w, height: 21 * 1.5 + 8, background: g.color, color: PAPER.die,
            fontFamily: "var(--paper-display)", boxShadow: `0 0 0 3px ${PAPER.die}, 2px 5px 0 3px rgba(43,33,24,0.25)` }}>
          {g.text}
        </div>
      ))}
      {extras.map((e) => (
        <div key={e.key} className="absolute whitespace-nowrap rounded-md px-1.5 text-center"
          style={{
            left: e.x, top: e.y, width: e.w, fontSize: e.kind === "dragons" ? 15 : 13,
            fontStyle: e.kind === "dragons" ? "italic" : undefined,
            background: e.kind === "next" ? "rgba(255,253,246,0.75)" : e.kind === "ruin" ? PAPER.die : "transparent",
            color: e.kind === "dragons" ? PAPER.die : e.kind === "next" ? PAPER.inkSoft : PAPER.ink,
            border: e.kind === "next" ? `1.5px dashed ${PAPER.pencil}` : undefined,
            fontFamily: e.kind === "dragons" ? "var(--paper-display)" : undefined,
          }}>
          {e.text}
        </div>
      ))}
    </div>
  );
}
