"use client";

// /lab/pixel/specimens — the pixel skin's art specimen sheet (round 3):
// palette ramps, every sprite at 1×/2×/4× on a neutral ground, and the full
// 132×99-tile world painted by the terrain look-dev kernels. Review surface
// for the illustrator's vision loop; the builder integrates components/lab/pixel/art.
//   ?still=1                 freeze (no animation; the sheet has none anyway)
//   ?part=palette|sprites|castles|terrain|crops   one section only (screenshots)
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWorld } from "@/hooks/use-world";
import {
  ART_PER_TILE, CASTLE_NOTES, CASTLES, PALETTE, PALETTE_SIZE, RAMPS, artToCanvas, castleSprite, catalogue,
  cloudSprites, emblemMasks, markerSprite, renderTerrainPreview, type ArtImage, type RampName, type Sprite, type TerrainArt,
} from "@/components/lab/pixel/art";
import { PixelNum } from "@/components/lab/pixel/pixel-num";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { AuthoredLevel, AuthoredStamps } from "./authored";

const GROUND = "#9c98a6";      // neutral grey-violet ground for sprites
const SHEET_BG = "#24223a";
const TEXT = "#f3ecdc";

function parse() {
  const p = new URLSearchParams(window.location.search);
  return { still: p.get("still") === "1", part: p.get("part") };
}

function ArtCanvas({ img, scale, style }: { img: ArtImage; scale: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const src = artToCanvas(img, 1);
    c.width = img.w * scale; c.height = img.h * scale;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, c.width, c.height);
  }, [img, scale]);
  return <canvas ref={ref} style={{ imageRendering: "pixelated", display: "block", ...style }} />;
}

function SpriteCard({ name, note, sprite, scales = [1, 2, 4] }: { name: string; note: string; sprite: Sprite; scales?: number[] }) {
  return (
    <figure style={{ margin: 0, background: GROUND, padding: 10, borderRadius: 2, display: "flex", flexDirection: "column", gap: 8, flex: "0 0 auto", minWidth: 200, maxWidth: 520 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
        {scales.map((s) => <ArtCanvas key={s} img={sprite.img} scale={s} />)}
      </div>
      <figcaption style={{ fontSize: 13, lineHeight: 1.25, color: "#1e1f4e" }}>
        <b>{name}</b> <span style={{ opacity: 0.8 }}>· {sprite.img.w}×{sprite.img.h}</span>
        <div>{note}</div>
      </figcaption>
    </figure>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 20, margin: "0 0 10px", letterSpacing: 0.5 }}>{title}</h2>
      {children}
    </section>
  );
}

const STATES: EvidenceState[] = ["champion", "trained", "provisional", "untrained"];
const MARKER_DEMO: Record<EvidenceState, string> = { champion: "resnet", trained: "vit", provisional: "kimi", untrained: "sam" };

export default function PixelSpecimens() {
  const [view, setView] = useState<{ still: boolean; part: string | null } | null>(null);
  useEffect(() => {
    const sync = () => setView(parse());
    sync();
  }, []);
  const { world } = useWorld(view ? view.still : null);
  const [emblems, setEmblems] = useState<Map<string, Map<number, { size: number; bits: Uint8Array }>> | null>(null);
  const [terrain, setTerrain] = useState<{ canvas: HTMLCanvasElement; art: TerrainArt } | null>(null);
  const termRef = useRef<HTMLDivElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);

  const part = view?.part ?? null;
  const show = (k: string) => !part || part === k;
  const wantTerrain = show("terrain") || show("crops");
  const [authoredDone, setAuthoredDone] = useState(0);
  const markAuthored = useMemo(() => () => setAuthoredDone((n) => n + 1), []);
  const authoredWanted = (show("authored") ? 1 : 0) + (show("authored-lod") ? 2 : 0);

  useEffect(() => {
    if (!view) return;
    emblemMasks([...Object.keys(CASTLES), ...Object.values(MARKER_DEMO)], [7, 9]).then(setEmblems);
  }, [view]);

  useEffect(() => {
    if (!world || !wantTerrain) return;
    const id = setTimeout(() => setTerrain(renderTerrainPreview(world, 1, { imgs: cloudSprites().map((s) => s.img) })), 0);
    return () => clearTimeout(id);
  }, [world, wantTerrain]);

  useEffect(() => {
    if (!terrain) return;
    const host = termRef.current;
    if (host) {
      host.innerHTML = "";
      // a copy: the state's canvas stays untouched
      const src = terrain.canvas;
      const c = document.createElement("canvas");
      c.width = src.width; c.height = src.height;
      c.getContext("2d")!.drawImage(src, 0, 0);
      Object.assign(c.style, { imageRendering: "pixelated", display: "block", width: `${c.width}px` });
      host.appendChild(c);
    }
    const crops = cropRef.current;
    if (crops && world) {
      crops.innerHTML = "";
      // zoomed crops at 3× (art-px centres printed in each title for before/after cuts)
      const a = terrain.art;
      const at = (p: { x: number; y: number }) => ({ x: Math.round((p.x - a.origin.x) / a.px), y: Math.round((p.y - a.origin.y) / a.px) });
      const reg = (f: string) => world.regions.find((r) => r.family === f)!;
      const centre = (f: string) => { const b = reg(f).bbox; return at({ x: (b.x + b.w / 2) * 16, y: (b.y + b.h / 2) * 16 }); };
      const seam = (() => {
        const c = centre("sequence"), p = reg("perception").id, q = reg("sequence").id;
        for (let x = 1; x < a.img.w; x++) { const i = c.y * a.img.w + x; if (a.region[i - 1] === p && a.region[i] === q) return { x, y: c.y }; }
        return c;
      })();
      const rb = world.ruinsIsland.slots;
      const spots: [string, { x: number; y: number }][] = [
        ["sequence interior", centre("sequence")],
        ["decision interior", centre("decision")],
        ["meadow–sand seam", seam],
        ["ruins islets", at({ x: rb[Math.min(4, rb.length - 1)].x, y: rb[0].y })],
        ["? island", at({ x: world.hiddenIsland.box.x + world.hiddenIsland.box.w / 2, y: world.hiddenIsland.box.y + world.hiddenIsland.box.h / 2 })],
      ];
      const label = document.createElement("p");
      label.style.cssText = "width:100%;font-size:13px;margin:0";
      label.textContent = `origin ${a.origin.x},${a.origin.y} · ` + spots.map(([n, p]) => `${n} @ ${p.x},${p.y}`).join(" · ");
      crops.appendChild(label);
      for (const [name, { x: cx, y: cy }] of spots) {
        const w = 180, h = 120, s = 3;
        const c = document.createElement("canvas");
        c.width = w * s; c.height = h * s;
        const ctx = c.getContext("2d")!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(terrain.canvas, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h, 0, 0, w * s, h * s);
        c.style.imageRendering = "pixelated";
        c.title = name;
        crops.appendChild(c);
      }
    }
  }, [terrain, world]);

  const cat = useMemo(() => (view ? catalogue() : []), [view]);
  const ready = view && emblems && (!wantTerrain || terrain) && authoredDone >= authoredWanted;

  return (
    <div
      data-lab-ready={ready ? "1" : undefined}
      style={{ position: "absolute", inset: 0, overflow: "auto", background: SHEET_BG, color: TEXT, fontFamily: "var(--font-pixel), ui-monospace, monospace", padding: 24 }}
    >
      <h1 style={{ fontSize: 28, margin: "0 0 4px" }}>Pixel art specimens</h1>
      <p style={{ fontSize: 14, margin: "0 0 20px", opacity: 0.85 }}>
        Contemporary pixel art · one key light (top-left) · hue-shifted ramps · <PixelNum value={PALETTE_SIZE} /> colours ·{" "}
        <PixelNum value={ART_PER_TILE} /> art px per tile
      </p>

      {show("palette") && (
        <Section title="Palette ramps (dark → light)">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "6px 24px" }}>
            {(Object.keys(RAMPS) as RampName[]).map((k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 70, fontSize: 14 }}>{k}</span>
                <div style={{ display: "flex" }}>
                  {RAMPS[k].map((i, j) => <div key={j} title={PALETTE[i]} style={{ width: 34, height: 26, background: PALETTE[i] }} />)}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {show("castles") && (
        <Section title="Atom landmarks — one per mechanism (36×46, emblem on the banner)">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 12 }}>
            {Object.keys(CASTLES).map((atom) => (
              <SpriteCard key={atom} name={atom} note={CASTLE_NOTES[atom]}
                sprite={castleSprite(atom, emblems?.get(atom)?.get(9))} />
            ))}
          </div>
          <h3 style={{ fontSize: 16, margin: "16px 0 8px" }}>Derived-model markers by evidence state (20×24, 7×7 emblem)</h3>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 12 }}>
            {STATES.map((st) => (
              <SpriteCard key={st} name={st} note={`e.g. ${MARKER_DEMO[st]}`}
                sprite={markerSprite(st, MARKER_DEMO[st], emblems?.get(MARKER_DEMO[st])?.get(7))} />
            ))}
          </div>
        </Section>
      )}

      {show("sprites") && cat.map((g) => (
        <Section key={g.group} title={g.group}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 12 }}>
            {g.items.map((it) => <SpriteCard key={it.name} name={it.name} note={it.note} sprite={it.sprite} />)}
          </div>
        </Section>
      ))}

      {show("terrain") && (
        <Section title="Terrain look-dev — the whole world at 1 art px (= 2 world px)">
          <p style={{ fontSize: 13, margin: "0 0 8px", opacity: 0.85 }}>
            {terrain ? (terrain.art.timings.total > 0
              ? <>render <PixelNum value={terrain.art.timings.total} /> ms · {Object.entries(terrain.art.timings).map(([k, v]) => `${k} ${v}`).join(" · ")} · {terrain.art.img.w}×{terrain.art.img.h} art px</>
              : <>{terrain.art.img.w}×{terrain.art.img.h} art px · timings frozen under headless virtual time</>) : "painting…"}
          </p>
          <div ref={termRef} />
        </Section>
      )}
      {show("authored") && (
        <Section title="Authored map — hand-drawn stamps">
          <AuthoredStamps />
        </Section>
      )}
      {show("authored") && world && (
        <Section title="Authored map — overview (2 art px per tile)">
          <AuthoredLevel world={world} apt={2} onDone={markAuthored} />
        </Section>
      )}
      {show("authored-lod") && world && (
        <Section title="Authored map — mid (4 art px per tile) and near (8 art px per tile) crops">
          <AuthoredLevel world={world} apt={4} onDone={markAuthored} crops={[
            { name: "representation spine", tx: 60, ty: 18, w: 170, h: 110 },
            { name: "generative volcano", tx: 60, ty: 80, w: 170, h: 110 },
          ]} />
          <div style={{ height: 12 }} />
          <AuthoredLevel world={world} apt={8} onDone={markAuthored} crops={[
            { name: "perception lake", tx: 16, ty: 41, w: 170, h: 110 },
            { name: "decision mesa", tx: 102, ty: 57, w: 170, h: 110 },
          ]} />
        </Section>
      )}
      {show("crops") && (
        <Section title="Terrain crops at 3× (interiors · a family seam · the secret islets)">
          <div ref={cropRef} style={{ display: "flex", flexWrap: "wrap", gap: 12 }} />
        </Section>
      )}
    </div>
  );
}
