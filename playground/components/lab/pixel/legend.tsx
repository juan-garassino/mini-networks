"use client";

// Map key: one entry per mark that appears on the map (mirrors encoding.ts).
// Compact two-column grid so it fits the open sea in the map's corner.
import { useMemo, useState } from "react";
import { BIOMES, familyLabel, SWEETIE } from "./palette";
import { sprite } from "./raster";
import { KEY_BRIDGE, KEY_ROAD, KEY_STONES, QSIGN, STAR } from "./sprites";
import { castleFor, dotFor } from "./terrain";
import { SpriteImg } from "./sprite-img";
import { PixelWindow } from "./window";
import styles from "./pixel.module.css";

export function Legend({ mobile, defaultOpen }: { mobile: boolean; defaultOpen: boolean }) {
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? defaultOpen;
  const icons = useMemo(() => ({
    castle: castleFor({ state: "champion", filled: true, mech: "self-attention" }),
    dot: dotFor({ state: "trained", filled: true }),
    dim: dotFor({ state: "untrained", filled: false }),
    star: sprite(STAR),
    q: sprite(QSIGN),
    road: sprite(KEY_ROAD),
    stones: sprite(KEY_STONES),
    bridge: sprite(KEY_BRIDGE),
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
    ["castle", "Atom; banner shows its mechanism", 1],
    ["dot", "Model with runs", 1],
    ["star", "Champion passed the gate", 2],
    ["dim", "Not trained yet", 1],
    ["q", "Bar still provisional", 1],
    ["road", "Road: builds on", 2],
    ["stones", "Stones: second parent", 2],
    ["bridge", "Bridge: crosses lands", 2],
  ];

  return (
    <PixelWindow as="section" aria-label="Map key" className={`absolute ${place} ${mobile ? "" : "w-[430px]"}`}>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[16px] font-bold leading-none text-[#ffcd75]">Map key</h2>
        <button type="button" className={styles.btn} onClick={() => setOverride(false)} aria-expanded>Hide</button>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-[2px] px-1">
        {rows.map(([k, text, sc]) => (
          <li key={k} className="flex min-h-[26px] items-center gap-2 text-[14px] leading-[1.1]">
            <span className="grid w-[32px] flex-none place-items-center">
              <SpriteImg img={icons[k]} scale={sc} />
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 px-1 sm:grid-cols-[auto_auto_auto]" aria-label="Each land is one family">
        {Object.entries(BIOMES).map(([fam, b]) => (
          <li key={fam} className="flex items-center gap-2 text-[14px] leading-tight">
            <span aria-hidden className="h-[12px] w-[12px] flex-none outline outline-2 outline-[#1a1c2c]" style={{ background: SWEETIE[b.base] }} />
            {familyLabel(fam)}
          </li>
        ))}
      </ul>
    </PixelWindow>
  );
}
