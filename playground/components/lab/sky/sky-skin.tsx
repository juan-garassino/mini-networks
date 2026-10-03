"use client";

// Skin "sky": the Celestial Zoo — an antique star atlas of the model zoo.
// Positions come ONLY from lib/world: every model is a star at its node's
// centre, every family a constellation over its region box, with a figure
// threaded through its stars (figures.ts). Lineage edges are the constellation
// lines; a selected model's pipelines appear as dotted arcs. The chrome is the
// painted maps' four corners in the night material (one UI, three materials).
// /lab contract: URL view → useWorld → camera → paint → data-lab-ready → window.__lab.
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { WorldNode } from "@/lib/world";
import { useWorld } from "@/hooks/use-world";
import { useLabView, type LabView } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { useCamera, type CamBox } from "@/components/lab/shared/camera";
import { cardModel, displayName, evidenceState, type EvidenceState } from "@/components/lab/shared/card-model";
import { FAMILIES, type Family } from "@/components/lab/painted/anchors";
import { FAMILY_TITLE, MATERIALS } from "@/components/lab/painted/material";
import { Cartouche } from "@/components/lab/painted/corners/cartouche";
import { Compass } from "@/components/lab/painted/corners/compass";
import { ScaleBar } from "@/components/lab/painted/corners/scale-bar";
import { CornerPlate } from "@/components/lab/painted/corners/corner-plate";
import { plateStyle } from "@/components/lab/painted/corners/plate";
import { Drawer, DRAWER_W, sheetHeight, type Sheet } from "@/components/lab/painted/drawer";
import { CONSTELLATION_NAME, FIGURES, fieldStars, starPath } from "./figures";

const m = MATERIALS.sky;
const MOBILE_BP = 640;
const GOLD = "#e8c46a", GOLD_DIM = "#8a7a4a", CREAM = "#f2e8c9", TEAL = "#7fd3c7", FIGURE = "#c9a24a";
const PAD = 1400; // world px of sky painted around the continent
const FIELD = fieldStars(1100, 7);

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function useWindowW() {
  const [w, setW] = useState(1440);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

/** The star for one model: glyph by evidence, size by atom-ness, in SCREEN px (÷ S). */
function Star({ n, state, S, lit, selected, hovered, onSelect, onHover }: {
  n: WorldNode; state: EvidenceState; S: number; lit: boolean; selected: boolean; hovered: boolean;
  onSelect: (n: string) => void; onHover: (n: string | null) => void;
}) {
  const base = n.atom ? 7 : 4.5;
  const r = (base + (selected ? 2 : 0)) / S;
  const e = m.evidence[state];
  const glyph =
    state === "champion" ? <path d={starPath(8, r, 0.45)} fill={e.fill} stroke={e.stroke} strokeWidth={0.6 / S} />
    : state === "trained" ? <path d={starPath(4, r * 1.05, 0.38)} fill={e.fill} stroke={e.stroke} strokeWidth={0.6 / S} />
    : state === "provisional" ? <circle r={r * 0.7} fill="none" stroke={e.stroke} strokeWidth={1.2 / S} strokeDasharray={`${2 / S} ${1.5 / S}`} />
    : <circle r={r * 0.5} fill={e.fill} />;
  return (
    <g transform={`translate(${n.center.x} ${n.center.y})`}>
      {(n.atom || state === "champion") && <circle r={r * 2.6} fill="url(#sky-halo)" opacity={lit ? 0.9 : 0.55} />}
      {glyph}
      {(selected || hovered) && <circle r={r * 1.9} fill="none" stroke={m.ring} strokeWidth={(selected ? 1.4 : 0.8) / S} strokeDasharray={hovered && !selected ? `${3 / S} ${2 / S}` : undefined} />}
      <circle r={Math.max(10, 16 / S)} fill="transparent" className="cursor-pointer outline-none" role="button" tabIndex={0}
        aria-label={`${displayName(n.name)}: ${state}`}
        onClick={(ev) => { ev.stopPropagation(); onSelect(n.name); }}
        onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onSelect(n.name); } }}
        onPointerEnter={() => onHover(n.name)} onPointerLeave={() => onHover(null)} onFocus={() => onHover(n.name)} onBlur={() => onHover(null)} />
    </g>
  );
}

export function SkySkin() {
  const { view, update } = useLabView();
  const still = view?.still ?? true;
  const { world, taxonomy, evidence, runs, family, ready } = useWorld(view ? view.still : null);
  const winW = useWindowW();
  const mobile = winW < MOBILE_BP;
  const [sheet, setSheet] = useState<Sheet>("peek");
  const [uiHidden, setUiHidden] = useState(false);
  const [fullDiagram, setFullDiagram] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setUiHidden(new URLSearchParams(window.location.search).get("ui") === "0");
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  // ——— data
  const nodes = useMemo(() => world?.nodes ?? [], [world]);
  const byName = useMemo(() => new Map(nodes.map((n) => [n.name, n])), [nodes]);
  const names = useMemo(() => nodes.map((n) => n.name), [nodes]);
  const atoms = useMemo(() => new Set(nodes.filter((n) => n.atom).map((n) => n.name)), [nodes]);
  const states = useMemo(() => {
    const out: Record<string, EvidenceState> = {};
    for (const n of names) out[n] = evidenceState(evidence.find((e) => e.name === n));
    return out;
  }, [names, evidence]);
  const famCount = useMemo(() => { const c: Record<string, number> = {}; for (const n of nodes) c[n.family] = (c[n.family] ?? 0) + 1; return c; }, [nodes]);
  const famProven = useMemo(() => { const c: Record<string, number> = {}; for (const n of nodes) if (states[n.name] === "champion") c[n.family] = (c[n.family] ?? 0) + 1; return c; }, [nodes, states]);
  const pipelines = useMemo(() => taxonomy?.compositions.map((c) => c.name) ?? [], [taxonomy]);
  const counts = useMemo(() => ({
    models: names.length, pipelines: pipelines.length,
    champions: Object.values(states).filter((s) => s === "champion").length, lands: Object.keys(famCount).length,
  }), [names, pipelines, states, famCount]);

  const selectedNode = view?.zoom === "node" && view.focus ? byName.get(view.focus) ?? null : null;
  const selected = selectedNode?.name ?? null;
  const focusNode = (view?.zoom === "region" || view?.zoom === "node") && view.focus ? byName.get(view.focus) ?? null : null;
  const focusFam = (focusNode?.family as Family | undefined) ?? null;
  const lineageSet = useMemo(() => {
    const s = new Set<string>();
    if (!selected) return s;
    const walk = (n: string) => { if (s.has(n)) return; s.add(n); (byName.get(n)?.parents ?? []).forEach(walk); };
    walk(selected);
    return s;
  }, [selected, byName]);
  const arcs = useMemo(() => {
    if (!selected || !taxonomy) return [];
    return taxonomy.compositions.filter((c) => c.composes.includes(selected)).map((c) => ({
      name: c.name, pts: c.composes.map((x) => byName.get(x)?.center).filter((p): p is { x: number; y: number } => Boolean(p)),
    })).filter((a) => a.pts.length >= 2);
  }, [selected, taxonomy, byName]);

  // ——— camera (world px); the drawer / sheet cover part of the viewport, so
  // the target box is widened / heightened to keep its content in the visible part
  const [vp, setVp] = useState({ w: 1, h: 1 });
  const [manual, setManual] = useState<CamBox | null>(null);
  const sheetPx = mobile && selected ? sheetHeight(sheet === "peek" ? "half" : sheet, vp.h) : 0;
  const drawerPx = !mobile && selected && !fullDiagram ? DRAWER_W : 0;
  const visW = Math.max(160, vp.w - drawerPx), visH = Math.max(120, vp.h - sheetPx);
  const worldBox: CamBox = world?.camera.world ?? { x: 0, y: 0, w: 1600, h: 1000 };
  const target: CamBox = useMemo(() => {
    if (!world || !view) return worldBox;
    // the whole sky: the continent box with room for the constellation names
    // (below each figure) and the corner plates
    let b: CamBox = { x: worldBox.x - worldBox.w * 0.06, y: worldBox.y - worldBox.h * 0.1, w: worldBox.w * 1.12, h: worldBox.h * 1.3 };
    const node = view.focus ? byName.get(view.focus) : undefined;
    const reg = node ? world.camera.regions[node.family] : undefined;
    // a star is seen in its constellation: the region box, a little tighter, centred on the star
    if (view.zoom === "node" && node && reg) b = { x: node.center.x - reg.w * 0.4, y: node.center.y - reg.h * 0.4, w: reg.w * 0.8, h: reg.h * 0.8 };
    else if (view.zoom === "region" && reg) b = { x: reg.x - reg.w * 0.05, y: reg.y - reg.h * 0.05, w: reg.w * 1.1, h: reg.h * 1.25 };
    // fit b into the visible part, then extend over the covered part
    const aspect = visW / Math.max(1, visH);
    let w = b.w, h = b.h;
    if (w / h > aspect) h = w / aspect; else w = h * aspect;
    const x = b.x + b.w / 2 - w / 2, y = b.y + b.h / 2 - h / 2;
    return { x, y, w: w * (vp.w / visW), h: h * (vp.h / visH) };
  }, [world, view, byName, worldBox, visW, visH, vp.w, vp.h]);
  useEffect(() => { setManual(null); }, [view?.zoom, view?.focus, vp.w, vp.h, drawerPx]);
  const camClamp = useMemo(() => ({ right: drawerPx, bottom: sheetPx }), [drawerPx, sheetPx]);
  const skyBox = useMemo(() => ({ x: worldBox.x - PAD, y: worldBox.y - PAD, w: worldBox.w + 2 * PAD, h: worldBox.h + 2 * PAD }), [worldBox]);
  const cam = useCamera({ world: skyBox, target: manual ?? target, still, targetViewport: vp, minWidth: 120, clamp: camClamp });
  useEffect(() => { if (cam.size.w !== vp.w || cam.size.h !== vp.h) setVp({ w: cam.size.w, h: cam.size.h }); }, [cam.size.w, cam.size.h, vp.w, vp.h]);
  const S = vp.w / cam.box.w; // screen px per world px
  const minW = worldBox.w * 0.08, maxW = worldBox.w * 1.4;
  const zoomTo = (w: number, fx = 0.5, fy = 0.5) => {
    const b = cam.box;
    w = clamp(w, minW, maxW);
    const h = w * (b.h / b.w);
    setManual({ x: b.x + (b.w - w) * fx, y: b.y + (b.h - h) * fy, w, h });
  };
  const stepZoom = (dir: 1 | -1) => zoomTo(cam.box.w / (dir > 0 ? 1.6 : 1 / 1.6));
  const onWheel = (e: React.WheelEvent) => {
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    zoomTo(cam.box.w * Math.exp(e.deltaY * 0.0015), (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
  };
  const panBy = (dx: number, dy: number) => {
    const b = cam.box;
    setManual({ ...b, x: clamp(b.x + dx * b.w, skyBox.x, skyBox.x + skyBox.w - b.w), y: clamp(b.y + dy * b.h, skyBox.y, skyBox.y + skyBox.h - b.h) });
  };
  const fitWhole = () => { setManual(null); update({ zoom: "overview", focus: null }); };
  const jumpLand = (f: Family) => {
    const first = nodes.filter((n) => n.family === f).sort((a, b) => Number(b.atom) - Number(a.atom))[0];
    if (first) update({ zoom: "region", focus: first.name });
  };
  const onSelect = useCallback((n: string) => {
    if (n === selected) { setManual(null); update({ zoom: "overview", focus: null }); return; }
    update({ zoom: "node", focus: n }); setSheet((s) => (s === "peek" ? "half" : s)); setFullDiagram(false);
  }, [update, selected]);
  useEffect(() => { if (!selected) setFullDiagram(false); }, [selected]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (fullDiagram) setFullDiagram(false); else if ((view?.zoom ?? "overview") !== "overview") fitWhole(); }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "h" || e.key === "H") setUiHidden((v) => !v);
      else if (e.key === "+" || e.key === "=") stepZoom(1);
      else if (e.key === "-" || e.key === "_") stepZoom(-1);
      else if (e.key === "0") fitWhole();
      else if (e.key === "ArrowLeft") panBy(-0.2, 0);
      else if (e.key === "ArrowRight") panBy(0.2, 0);
      else if (e.key === "ArrowUp") panBy(0, -0.2);
      else if (e.key === "ArrowDown") panBy(0, 0.2);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const card = useMemo(() => (selectedNode && taxonomy ? cardModel(selectedNode.name, { taxonomy, evidence, runs, family: selectedNode.family, depth: selectedNode.depth }) : null), [selectedNode, taxonomy, evidence, runs]);

  // ——— ready + hooks
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    setDrawn(false);
    if (!ready || !world || vp.w <= 1) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    const t = setTimeout(() => setDrawn(true), 250);
    return () => { cancelAnimationFrame(id); clearTimeout(t); };
  }, [ready, world, vp.w]);
  useEffect(() => {
    if (!drawn) return;
    const w = window as unknown as { __lab?: unknown };
    w.__lab = { select: (n: string) => onSelect(n), view: (v: { zoom: LabView["zoom"]; focus?: string }) => update({ zoom: v.zoom, focus: v.focus ?? null }) };
    return () => { delete w.__lab; };
  }, [drawn, onSelect, update]);

  // ——— which derived names show
  const zoomedIn = world ? cam.box.w < worldBox.w * 0.7 : false;
  const showName = (n: WorldNode) => n.atom || n.name === selected || n.name === hovered || lineageSet.has(n.name) || (focusFam ? n.family === focusFam : zoomedIn);

  const whole = !manual && (view?.zoom ?? "overview") === "overview";
  const corner = "pointer-events-auto absolute z-20";
  const hair = 1 / S;

  return (
    <LabMotion still={still}>
      <div data-lab-ready={drawn ? "1" : undefined} className="relative h-full w-full select-none overflow-hidden"
        style={{ background: m.sea, ["--ap" as string]: "2px" } as CSSProperties}>
        <div ref={cam.ref} {...cam.handlers} onWheel={onWheel}
          onClick={() => { if (!cam.dragged.current && (view?.zoom ?? "overview") !== "overview") fitWhole(); }} className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing">
          {world && (
            <svg viewBox={cam.viewBox} className="block h-full w-full" role="group" aria-label="The Celestial Zoo: a star atlas of the models">
              <defs>
                <radialGradient id="sky-halo"><stop offset="0" stopColor={GOLD} stopOpacity="0.35" /><stop offset="1" stopColor={GOLD} stopOpacity="0" /></radialGradient>
                <radialGradient id="sky-dust" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#8fa3d9" stopOpacity="0.16" /><stop offset="1" stopColor="#8fa3d9" stopOpacity="0" /></radialGradient>
              </defs>
              {/* the night: field stars and one band of dust */}
              <g pointerEvents="none">
                <ellipse cx={worldBox.x + worldBox.w * 0.55} cy={worldBox.y + worldBox.h * 0.45} rx={worldBox.w * 1.1} ry={worldBox.h * 0.28} fill="url(#sky-dust)" transform={`rotate(-18 ${worldBox.x + worldBox.w * 0.55} ${worldBox.y + worldBox.h * 0.45})`} />
                {FIELD.map((f, i) => (
                  <circle key={i} cx={skyBox.x + f.x * skyBox.w} cy={skyBox.y + f.y * skyBox.h} r={f.r / Math.sqrt(S)} fill={CREAM} opacity={f.a * 0.6} />
                ))}
              </g>
              {/* constellations: figure + name + lines + stars, per family (dimmed when another is focused) */}
              {FAMILIES.map((f) => {
                const box = world.camera.regions[f];
                const fig = FIGURES[f];
                const dim = focusFam !== null && f !== focusFam;
                const fam = nodes.filter((n) => n.family === f);
                return (
                  <g key={f} opacity={dim ? 0.28 : 1} style={{ transition: still ? undefined : "opacity 300ms" }}>
                    {box && fig && (
                      <g transform={`translate(${box.x} ${box.y}) scale(${box.w} ${box.h})`} pointerEvents="none">
                        {fig.strokes.map((d, i) => (
                          <g key={i}>
                            <path d={d} fill="none" stroke={FIGURE} strokeWidth={7} opacity={0.07} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                            <path d={d} fill="none" stroke={FIGURE} strokeWidth={1.1} opacity={0.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                          </g>
                        ))}
                      </g>
                    )}
                    {box && (
                      <text x={box.x + box.w * (fig?.label.x ?? 0.5)} y={box.y + box.h * (fig?.label.y ?? 1) + 22 / S} textAnchor="middle"
                        fontSize={17 / S} fontFamily={m.signFont} fill={GOLD} letterSpacing={2 / S} opacity={0.9} pointerEvents="none">
                        {(CONSTELLATION_NAME[f] ?? FAMILY_TITLE[f]).toUpperCase()}
                        <tspan fontSize={12 / S} fill={m.inkSoft} dx={8 / S}>{famCount[f] ?? 0} stars</tspan>
                      </text>
                    )}
                    {/* same-family lineage lines */}
                    {world.roads.filter((r) => r.kind !== "bridge" && byName.get(r.to)?.family === f).map((r) => {
                      const a = byName.get(r.from), b = byName.get(r.to);
                      if (!a || !b) return null;
                      const lit = lineageSet.has(r.to) && lineageSet.has(r.from);
                      return <line key={r.id} x1={a.center.x} y1={a.center.y} x2={b.center.x} y2={b.center.y}
                        stroke={lit ? m.ring : GOLD} strokeWidth={(lit ? 1.6 : 0.9) * hair} opacity={lit ? 1 : r.primary ? 0.75 : 0.4} pointerEvents="none" />;
                    })}
                    {fam.map((n) => (
                      <Star key={n.name} n={n} state={states[n.name] ?? "untrained"} S={S} lit={lineageSet.has(n.name) || n.name === hovered}
                        selected={n.name === selected} hovered={n.name === hovered} onSelect={onSelect} onHover={setHovered} />
                    ))}
                    {fam.filter(showName).map((n) => (
                      <text key={`l-${n.name}`} x={n.center.x} y={n.center.y + (n.atom ? 22 : 16) / S} textAnchor="middle" pointerEvents="none"
                        fontSize={(n.atom ? 14 : 12) / S} fontFamily={n.atom ? m.signFont : m.bodyFont} fill={n.name === selected ? m.ring : CREAM}
                        opacity={n.atom || n.name === selected || n.name === hovered ? 1 : 0.8}
                        style={{ paintOrder: "stroke", stroke: m.sea, strokeWidth: 3 / S, strokeLinejoin: "round" }}>
                        {displayName(n.name)}
                      </text>
                    ))}
                  </g>
                );
              })}
              {/* cross-family lines: dashed, faint, brighter on the selected lineage */}
              <g pointerEvents="none">
                {world.roads.filter((r) => r.kind === "bridge").map((r) => {
                  const a = byName.get(r.from), b = byName.get(r.to);
                  if (!a || !b) return null;
                  const lit = lineageSet.has(r.to) && lineageSet.has(r.from);
                  const touches = focusFam === null || a.family === focusFam || b.family === focusFam;
                  return <line key={r.id} x1={a.center.x} y1={a.center.y} x2={b.center.x} y2={b.center.y}
                    stroke={lit ? m.ring : GOLD_DIM} strokeWidth={(lit ? 1.4 : 0.8) * hair} strokeDasharray={`${4 * hair} ${4 * hair}`} opacity={lit ? 1 : touches ? 0.6 : 0.2} />;
                })}
                {/* the selected star's pipelines, as dotted arcs */}
                {arcs.map((a) => a.pts.slice(1).map((p, i) => {
                  const q = a.pts[i];
                  const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
                  const dx = p.x - q.x, dy = p.y - q.y, len = Math.hypot(dx, dy) || 1;
                  const cx = mx - (dy / len) * len * 0.18, cy = my + (dx / len) * len * 0.18;
                  return <path key={`${a.name}-${i}`} d={`M${q.x} ${q.y} Q${cx} ${cy} ${p.x} ${p.y}`} fill="none" stroke={TEAL} strokeWidth={1.2 * hair} strokeDasharray={`${1.5 * hair} ${4 * hair}`} strokeLinecap="round" opacity={0.9} />;
                }))}
              </g>
            </svg>
          )}
        </div>

        {uiHidden && (
          <button type="button" onClick={() => setUiHidden(false)} aria-label="Show the UI (h)" title="Show the UI (h)"
            className="absolute right-3 top-3 z-20 px-2.5 py-1 leading-none opacity-50 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 sm:right-5 sm:top-5"
            style={{ ...plateStyle(m, { shadow: false }), fontFamily: m.bodyFont, fontSize: 14 }}>UI</button>
        )}
        {!uiHidden && (
          <div className="pointer-events-none absolute inset-0 z-20" style={{ right: drawerPx, bottom: sheetPx }}>
            <div className={`${corner} left-3 top-3 sm:left-5 sm:top-5`}>
              <Cartouche m={m} title="The Celestial Zoo" noun="constellations" counts={counts} names={names} focusFam={focusFam} famCount={famCount} famProven={famProven}
                onPick={onSelect} onWhole={fitWhole} compact={mobile} />
            </div>
            <div className={`${corner} right-3 top-0 flex items-start gap-1.5 sm:right-5`}>
              <a href="/lab/painted/" className="px-3 pb-2 pt-2 leading-none focus-visible:outline-2" style={{ ...plateStyle(m), borderTop: "none", fontFamily: m.bodyFont, fontSize: 14, textDecoration: "none" }}>day map</a>
              <button type="button" onClick={() => setUiHidden(true)} aria-label="Sky only: hide the UI (h)" title="Sky only (h)"
                className="px-3 pb-2 pt-2 leading-none focus-visible:outline-2" style={{ ...plateStyle(m), borderTop: "none", fontFamily: m.bodyFont, fontSize: 14 }}>sky only</button>
            </div>
            <div className={`${corner} bottom-3 left-3 flex flex-col items-start gap-3 sm:bottom-5 sm:left-5`}>
              {!mobile && (
                <ScaleBar m={m} names={names} family={family} states={states} atoms={atoms} pipelines={pipelines} counts={counts}
                  selected={selected} onPick={onSelect} onLand={jumpLand} focusFam={focusFam} />
              )}
              <Compass m={m} unit={mobile ? 3.5 : 5} onPan={panBy} onWhole={fitWhole} onZoom={stepZoom}
                canIn={cam.box.w > minW + 1} canOut={cam.box.w < maxW - 1} whole={whole} />
            </div>
            {!mobile && (
              <div className={`${corner} bottom-3 right-3 sm:bottom-5 sm:right-5`}>
                <CornerPlate m={m} face="legend" world={{ w: worldBox.w, h: worldBox.h }} box={cam.box} source={{ img: "", pixelated: false }} onCenter={() => {}}
                  note="The brightest stars are the atoms; the lines run from a parent to the models built on it." />
              </div>
            )}
          </div>
        )}

        {card && !uiHidden && (
          <Drawer m={m} mobile={mobile} sheet={sheet === "peek" ? "half" : sheet} setSheet={setSheet} card={card} still={still}
            onPick={onSelect} onBack={fitWhole}
            stateOf={(n) => states[n] ?? "untrained"} isAtom={(n) => atoms.has(n)}
            fullDiagram={fullDiagram} setFullDiagram={setFullDiagram} stageW={vp.w} />
        )}
      </div>
    </LabMotion>
  );
}

