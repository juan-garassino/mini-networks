"use client";

// Specimen section for the round-4 ZONE library (?part=biomes), drawn after the
// owner's final pixel reference: composed scenes at the map's display scale
// (3 screen px per art px), then per zone every landmark (full · ÷2 · micro ÷3,
// inked as on the map), zone markers by evidence state, and every stamp at 1×/2×/4×.
//   &zone=forest|wildwest|snow|marble|stilts|forge|village|sunken|cyber|sea   one zone
//   &scenes=0   skip the scenes · &scenes=only   scenes only
import { useEffect, useRef, useState } from "react";
import { artToCanvas, inkOutline, PALETTE, type ArtImage, type Sprite } from "@/components/lab/pixel/art";
import {
  BIOME_INK, BIOME_LANDMARK_NOTES, BR, SCENES, ZONES, atTier, biomeLandmark, biomeMarker, biomeStamps, cartouche, type ZoneKey,
} from "@/components/lab/pixel/art/biomes";
import type { EvidenceState } from "@/components/lab/shared/card-model";

type Masks = Map<string, Map<number, { size: number; bits: Uint8Array }>>;

const STATES: EvidenceState[] = ["champion", "trained", "provisional", "untrained"];
const MARKER_DEMO: Partial<Record<ZoneKey, string>> = { wildwest: "tabular_classifier", sunken: "grpo", cyber: "gnn" };
export const BIOME_EMBLEMS = [
  "classifier", "segmentation", "tabular_classifier", "simclr", "transformer", "rnn", "mamba", "diffusion", "pixelcnn", "vae", "gan",
  "alphazero", "reinforce", "rl_maze", "gnn", "nerf", "grpo",
];
const hex = (i: number) => PALETTE[i];
const bgOf = (z: ZoneKey) => hex(({
  forest: BR.olive[4], wildwest: BR.desert[4], snow: BR.snowR[4], marble: BR.desert[6], stilts: BR.desert[4], forge: BR.basalt[2],
  village: BR.olive[5], sunken: BR.reef[3], cyber: BR.night[2], sea: BR.paperR[2],
} as Record<ZoneKey, number>)[z]);
const ink = (s: Sprite | ArtImage) => inkOutline("img" in s ? s.img : s, BIOME_INK);

function Pix({ img, scale }: { img: ArtImage; scale: number }) {
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
  return <canvas ref={ref} style={{ imageRendering: "pixelated", display: "block" }} />;
}

function Card({ name, note, img, bg, scales = [1, 2, 4] }: { name: string; note?: string; img: ArtImage; bg: string; scales?: number[] }) {
  return (
    <figure style={{ margin: 0, background: bg, padding: 8, display: "flex", flexDirection: "column", gap: 6, flex: "0 0 auto", maxWidth: 620 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>{scales.map((s) => <Pix key={s} img={img} scale={s} />)}</div>
      <figcaption style={{ fontSize: 12, lineHeight: 1.2, color: "#f6ecd2", textShadow: "0 1px 0 #2a1012, 1px 0 0 #2a1012" }}>
        <b>{name}</b> · {img.w}×{img.h}{note ? <div style={{ opacity: 0.95 }}>{note}</div> : null}
      </figcaption>
    </figure>
  );
}

function Scenes({ only }: { only?: string | null }) {
  const [imgs, setImgs] = useState<Record<string, ArtImage>>({});
  useEffect(() => {
    const id = setTimeout(() => setImgs(Object.fromEntries(Object.entries(SCENES).filter(([k]) => !only || k === only).map(([k, v]) => [k, v.make()]))), 0);
    return () => clearTimeout(id);
  }, [only]);
  return (
    <section style={{ marginBottom: 30 }}>
      <h2 style={{ fontSize: 20, margin: "0 0 10px" }}>Scenes at the map&apos;s display scale (3 screen px per art px)</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        {Object.entries(SCENES).filter(([k]) => !only || k === only).map(([k, v]) => (
          <figure key={k} style={{ margin: 0 }}>
            {imgs[k] ? <Pix img={imgs[k]} scale={3} /> : <p>composing…</p>}
            <figcaption style={{ fontSize: 13, marginTop: 4 }}>{k} — {v.title}</figcaption>
          </figure>
        ))}
        {!only && <figure style={{ margin: 0 }}><Pix img={cartouche(96, 40)} scale={3} /><figcaption style={{ fontSize: 13, marginTop: 4 }}>title cartouche frame · any size (96×40 shown)</figcaption></figure>}
      </div>
    </section>
  );
}

export function BiomeSpecimens({ emblems, zone, scenes }: { emblems: Masks | null; zone?: string | null; scenes?: string | null }) {
  const zones = (Object.keys(ZONES) as ZoneKey[]).filter((z) => !zone || z === zone);
  return (
    <>
      {scenes !== "0" && <Scenes only={zone && zone in SCENES ? zone : scenes && scenes !== "only" ? scenes : null} />}
      {scenes !== "only" && zones.map((z) => {
        const bg = bgOf(z);
        const demo = MARKER_DEMO[z];
        return (
          <section key={z} style={{ marginBottom: 30 }}>
            <h2 style={{ fontSize: 20, margin: "0 0 10px" }}>{z} — {ZONES[z].name}</h2>
            {ZONES[z].atoms.length > 0 && <>
              <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>Atom landmarks (36×46, 9×9 emblem) — full · ÷2 · micro ÷3, inked</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
                {ZONES[z].atoms.map((a) => {
                  const s = biomeLandmark(a, emblems?.get(a)?.get(9));
                  if (!s) return null;
                  return (
                    <div key={a} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                      <Card name={a} note={BIOME_LANDMARK_NOTES[a]} img={ink(s)} bg={bg} />
                      <Card name="÷2 · ÷3 @3×" img={ink(atTier(s, 2))} bg={bg} scales={[3]} />
                      <Card name="" img={ink(atTier(s, 3))} bg={bg} scales={[3]} />
                    </div>
                  );
                })}
              </div>
            </>}
            {demo && <>
              <h3 style={{ fontSize: 15, margin: "14px 0 8px" }}>Zone markers by evidence state (20×28, 7×7 emblem)</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
                {STATES.map((st) => { const s = biomeMarker(z, st, emblems?.get(demo)?.get(7)); return s ? <Card key={st} name={st} img={ink(s)} bg={bg} /> : null; })}
              </div>
            </>}
            <h3 style={{ fontSize: 15, margin: "14px 0 8px" }}>Stamps (1× · 2× · 4×)</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
              {biomeStamps(z).map((s) => <Card key={s.name} name={s.name} note={`${s.role}${s.note ? " · " + s.note : ""}`} img={s.img} bg={bg} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}
