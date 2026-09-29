"use client";

// Map key: one entry per mark that appears on the map (mirrors encoding.ts).
// Compact two-column grid so it fits the open sea in the map's corner.
import { useMemo, useState } from "react";
import { familyLabel } from "./palette";
import { BIOMES, castleSprite, markerSprite, Painter, PALETTE, props, RAMPS, type ArtImage } from "./art";
import { ArtImg } from "./art-img";
import { PixelWindow } from "./window";
import styles from "./pixel.module.css";

/** Small road samples drawn in the same inks as the map. */
function roadSample(kind: "road" | "stones" | "trail"): ArtImage {
  const p = new Painter(16, 6);
  p.rect(0, 0, 16, 6, "meadow", 4);
  for (let x = 0; x < 16; x++) {
    if (kind === "road") { p.px(x, 2, "sand", 4); p.px(x, 3, "wood", 2); }
    else if (kind === "stones") { if (x % 3 === 0) { p.px(x, 2, "sand", 5); p.px(x + 1, 3, "wood", 2); } }
    else p.px(x, 2, "meadow", 2);
  }
  for (const x of [5, 11]) { p.px(x, 1, "wood", 1); p.px(x + 1, 2, "wood", 1); p.px(x, 3, "wood", 1); }
  return p.img;
}

export function Legend({ mobile, defaultOpen }: { mobile: boolean; defaultOpen: boolean }) {
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? defaultOpen;
  const icons = useMemo(() => ({
    castle: castleSprite("transformer").img,
    champion: markerSprite("champion").img,
    trained: markerSprite("trained").img,
    provisional: markerSprite("provisional").img,
    untrained: markerSprite("untrained").img,
    house: props.house(0).img,
    boat: props.boat().img,
    bridge: props.bridge("h").img,
    road: roadSample("road"),
    stones: roadSample("stones"),
    trail: roadSample("trail"),
  }), []);

  const place = mobile ? "bottom-2 left-2 right-2" : "bottom-4 right-4";
  if (!open) {
    return (
      <button type="button" className={`${styles.btn} absolute ${mobile ? "bottom-3 left-3" : "bottom-4 right-4"}`}
        onClick={() => setOverride(true)} aria-expanded={false}>
        Map key
      </button>
    );
  }

  const rows: [keyof typeof icons, string, number][] = [
    ["castle", "Atom city: its castle shows the mechanism", 1],
    ["champion", "Champion passed the gate", 1],
    ["trained", "Trained: has logged runs", 1],
    ["provisional", "Its quality bar is provisional", 1],
    ["untrained", "Not trained yet", 1],
    ["house", "House: a model built on this city", 2],
    ["road", "Path: builds on (arrows point on)", 2],
    ["stones", "Stepping stones: a second parent", 2],
    ["trail", "Faint trail: lineage into another land", 2],
    ["bridge", "Bridge over a border river", 2],
    ["boat", "Boats: pipelines docking here (tag ×N when more than 3)", 2],
  ];

  return (
    <PixelWindow as="section" aria-label="Map key" className={`absolute ${place} ${mobile ? "" : "w-[430px]"}`}>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[16px] font-bold leading-none text-[#f5c24a]">Map key</h2>
        <button type="button" className={styles.btn} onClick={() => setOverride(false)} aria-expanded>Hide</button>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-[2px] px-1">
        {rows.map(([k, text, sc]) => (
          <li key={k} className="flex min-h-[26px] items-center gap-2 text-[14px] leading-[1.1]">
            <span className="grid w-[40px] flex-none place-items-center">
              <ArtImg img={icons[k]} scale={sc} />
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 px-1 sm:grid-cols-[auto_auto_auto]" aria-label="Each land is one family">
        {Object.entries(BIOMES).map(([fam, b]) => (
          <li key={fam} className="flex items-center gap-2 text-[14px] leading-tight">
            <span aria-hidden className="h-[12px] w-[12px] flex-none outline outline-2 outline-[#1e1f4e]" style={{ background: PALETTE[RAMPS[b.mid][Math.min(3, RAMPS[b.mid].length - 1)]] }} />
            {familyLabel(fam)}
          </li>
        ))}
      </ul>
    </PixelWindow>
  );
}
