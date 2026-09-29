"use client";

// Title + find-a-model menu + where-am-I breadcrumb, in one JRPG window.
import { useEffect, useMemo, useRef, useState } from "react";
import type { WorldNode } from "@/lib/world";
import type { Zoom } from "@/components/lab/shared/url-state";
import { displayName } from "@/components/lab/shared/card-model";
import { familyLabel } from "./palette";
import { sprite } from "./raster";
import { POINTER } from "./sprites";
import { SpriteImg } from "./sprite-img";
import { PixelWindow } from "./window";
import { PixelNum } from "./pixel-num";
import styles from "./pixel.module.css";

export function TitleWindow({ taxonomyNames, zoom, focus, regionCount, mobile, onPick, onZoom, hidden }: {
  taxonomyNames: string[];
  zoom: Zoom;
  focus: WorldNode | null;
  regionCount: number;
  mobile: boolean;
  onPick: (name: string) => void;
  onZoom: (z: Zoom) => void;
  hidden?: boolean;
}) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement | null>(null);
  const pointer = useMemo(() => sprite(POINTER), []);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/_/g, " ");
    if (!s) return [];
    return taxonomyNames
      .filter((n) => displayName(n).includes(s))
      .sort((a, b) => Number(!displayName(a).startsWith(s)) - Number(!displayName(b).startsWith(s)) || a.localeCompare(b))
      .slice(0, 6);
  }, [q, taxonomyNames]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") { e.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (hidden) return null;
  const pick = (n: string) => { setQ(""); input.current?.blur(); onPick(n); };

  return (
    <PixelWindow as="header" className={`absolute ${mobile ? "left-2 right-2 top-2 !py-2 !px-3" : "left-4 top-4 w-[320px]"}`}>
      <div className={mobile ? "flex items-center gap-3" : "px-1"}>
        <h1 className={`${mobile ? "flex-none text-[18px]" : "text-[24px]"} font-bold leading-none text-[#f5c24a]`}>The model zoo</h1>
        {!mobile && zoom === "overview" && (
          <p className="mt-2 text-[16px] leading-snug text-[#fff6e0]">
            <PixelNum value={taxonomyNames.length} /> models across six lands. Pick one and the blob walks there from its root.
          </p>
        )}
        <label className={mobile ? "block min-w-0 flex-1" : "mt-3 block"}>
          <span className="sr-only">Find a model</span>
          <input
            ref={input}
            className={styles.input}
            placeholder={mobile ? "Find a model" : "Find a model (press /)"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hits[0]) pick(hits[0]);
              if (e.key === "Escape") { setQ(""); e.stopPropagation(); }
            }}
          />
        </label>
        {hits.length > 0 && (
          <ul className="mt-1">
            {hits.map((n) => (
              <li key={n}>
                <button type="button" className={styles.row} onClick={() => pick(n)}>
                  <span className={styles.cursor}><SpriteImg img={pointer} scale={2} /></span>
                  <span className="text-[16px]">{displayName(n)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {q.trim() && hits.length === 0 && <p className="mt-1 text-[15px] text-[#bccbe8]">No model by that name.</p>}
        {zoom !== "overview" && focus && (
          <p className="mt-3 text-[17px] leading-tight">
            <span className="text-[#62dcf2]">{familyLabel(focus.family)} land</span>
            <span className="text-[#bccbe8]">, <PixelNum value={regionCount} /> models</span>
          </p>
        )}
        {zoom !== "overview" && (
          <nav aria-label="Where you are" className="mt-2 flex flex-wrap items-center gap-2 text-[15px]">
            <button type="button" className={styles.btn} onClick={() => onZoom("overview")}>World map</button>
            {focus && zoom === "node" && (
              <button type="button" className={styles.btn} onClick={() => onZoom("region")}>Whole land</button>
            )}
          </nav>
        )}
      </div>
    </PixelWindow>
  );
}
