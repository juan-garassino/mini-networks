"use client";

// Specimen section for the AUTHORED map (round 4): the hand-drawn stamp
// library, the size-free hero glyphs, and composeAuthored() at several levels
// of detail — every image at the ONE fixed on-screen pixel size (4 screen px
// per art px), which is how the builder's adaptive-resolution map shows it.
import { useEffect, useRef, useState } from "react";
import type { World } from "@/lib/world";
import { artToCanvas, type ArtImage } from "@/components/lab/pixel/art";
import { CAN, STAMPS, composeAuthored, stampImage, type AuthoredMap } from "@/components/lab/pixel/art/authored";
import { cone, forest, lake, mesa, spires } from "@/components/lab/pixel/art/authored/gen";

export const PX = 4;              // fixed on-screen size of one art pixel
const PAPER = "#eee0bd";

function Pix({ img, crop, title }: { img: ArtImage; crop?: { x: number; y: number; w: number; h: number }; title?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const src = artToCanvas(img, 1);
    const r = crop ?? { x: 0, y: 0, w: img.w, h: img.h };
    c.width = r.w * PX; c.height = r.h * PX;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w * PX, r.h * PX);
  }, [img, crop]);
  return <canvas ref={ref} title={title} style={{ imageRendering: "pixelated", display: "block" }} />;
}

function Card({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <figure style={{ margin: 0, background: PAPER, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "flex-end", minHeight: 20 }}>{children}</div>
      <figcaption style={{ fontSize: 13, color: "#5a1a14" }}>{name}</figcaption>
    </figure>
  );
}

const GLYPHS = [
  { name: "cone · snow 25", g: () => cone(25, 16, { snow: true }) },
  { name: "volcano 41", g: () => cone(41, 25, { crater: true }) },
  { name: "mesa 32", g: () => mesa(32, 16) },
  { name: "lake 36×18", g: () => lake(36, 18) },
  { name: "spires 22", g: () => spires(22, 24) },
  { name: "forest r8", g: () => forest(8, CAN) },
];

export function AuthoredStamps() {
  return (
    <>
      <p style={{ fontSize: 14, margin: "0 0 10px", opacity: 0.85 }}>Hand-drawn stamps — 1 art px = {PX} screen px (the map&apos;s fixed pixel size)</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
        {STAMPS.map((s) => <Card key={s.name} name={`${s.name} · ${s.rows[0].length}×${s.rows.length}`}><Pix img={stampImage(s)} /></Card>)}
      </div>
      <p style={{ fontSize: 14, margin: "16px 0 10px", opacity: 0.85 }}>Drawn-to-size hero glyphs (near levels of detail) — same facet rules as the stamps</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
        {GLYPHS.map((x) => <Card key={x.name} name={x.name}><Pix img={x.g().img} /></Card>)}
      </div>
    </>
  );
}

/** composeAuthored at `apt` art px per tile; `crops` in tile coords (centre + size in art px). */
export function AuthoredLevel({ world, apt, crops, onDone }: {
  world: World; apt: number; crops?: { name: string; tx: number; ty: number; w: number; h: number }[]; onDone?: () => void;
}) {
  const [map, setMap] = useState<AuthoredMap | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setMap(composeAuthored(world, apt)), 0);
    return () => clearTimeout(id);
  }, [world, apt]);
  useEffect(() => { if (map) onDone?.(); }, [map, onDone]);
  if (!map) return <p style={{ fontSize: 13 }}>composing {apt} art px / tile…</p>;
  const at = (tx: number, ty: number, w: number, h: number) => ({
    x: Math.round((tx * 16 - map.origin.x) / map.px - w / 2), y: Math.round((ty * 16 - map.origin.y) / map.px - h / 2), w, h,
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontSize: 13, margin: 0, opacity: 0.85 }}>
        {apt} art px per tile · {map.w}×{map.h} art px · heroes: {map.heroes.map((h) => h.kind).join(", ")}
      </p>
      {crops
        ? <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{crops.map((c) => <Card key={c.name} name={c.name}><Pix img={map.img} crop={at(c.tx, c.ty, c.w, c.h)} /></Card>)}</div>
        : <Pix img={map.img} />}
    </div>
  );
}
