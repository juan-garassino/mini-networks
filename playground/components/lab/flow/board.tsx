"use client";

// Skin D · Kawaii DFD — the zoo as a data-flow diagram (/lab/flow). lib/world/dfd.ts lays
// every model on a strict grid (desktop: two stacks of family lanes × generation columns;
// phone: one file tree indented by generation) and routes every builds_on edge orthogonally
// with zero crossings. This board wires the data in, lights a lineage on hover / selection,
// docks the drawer and drives the URL views (?zoom=overview|region|node&focus=…&still=1).
// Pieces: sheet (lanes, lines, boxes), top-bar + legend, use-camera, drawer, packets, ruler,
// pipelines, keeper. Every value comes from tokens.ts.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ModelEvidence } from "@/lib/types";
import type { DfdLayout } from "@/lib/world/dfd";
import { useWorld } from "@/hooks/use-world";
import { useLesson } from "@/hooks/use-lesson";
import { installLabHook, LabMotion, useLabReady, useLabView, useStill } from "@/lib/lab-contract";
import { cardModel, evidenceState } from "@/components/lab/shared/card-model";
import { forwardPassOrder, forwardPassSchedule, GROKKING_EGG, useCritterClicks, useKonami, useLongFocus, useRealLossCurve } from "@/components/lab/shared/eggs";
import { FlowDrawer } from "./drawer";
import { KeeperTrains } from "./keeper";
import { Legend } from "./legend";
import { drawnGraph, hopsUp } from "./lineage";
import { Packets, type PacketRoute } from "./packets";
import { PipelineCaption, PipelinesPanel } from "./pipelines";
import { GenerationRuler, RULER_H } from "./ruler";
import { edgeKey, Sheet, type SheetState } from "./sheet";
import { TopBar } from "./top-bar";
import { useCamera, useStage } from "./use-camera";
import { useDfd, useFlowFont } from "./use-dfd";
import { COLOR, fam, FLOW_CSS_VARS, MOTION, RADIUS, SHADOW, SPACE, TYPE } from "./tokens";
import s from "./flow.module.css";

export function FlowBoard() {
  const { view, update } = useLabView();
  // `still` = ?still=1 (the screenshot flag: no polling, no keeper run);
  // `frozen` = the lab contract's still (?still=1 or reduced motion): frame 0, no flight
  const still = view?.still ?? true;
  const frozen = useStill();
  const { taxonomy, runs, evidence, family, ready } = useWorld(view ? view.still : null);
  const { ref: rootRef, size } = useStage();
  const mobile = size.w > 0 && size.w < 640;
  const mode = size.w > 0 ? (mobile ? "mobile" : "desktop") : null;
  const measure = useFlowFont();
  const layout: DfdLayout | null = useDfd(taxonomy, family, mode, measure);

  // ——— the graph as drawn ———
  const g = useMemo(() => (layout ? drawnGraph(layout) : null), [layout]);
  const evBy = useMemo(() => new Map<string, ModelEvidence>(evidence.map((e) => [e.name, e])), [evidence]);
  const states = useMemo(() => new Map((layout?.boxes ?? []).map((b) => [b.name, evidenceState(evBy.get(b.name))])), [layout, evBy]);

  const focusBox = view?.focus && g ? g.box.get(view.focus) ?? null : null;
  const zoom = view && focusBox ? view.zoom : "overview";
  const selected = zoom === "node" && focusBox ? focusBox.name : null;

  // ——— hover, lineage lighting, pipelines ———
  const [hover, setHover] = useState<string | null>(null);
  const onHover = useCallback((n: string | null, on: boolean) => setHover((h) => (on ? n : h === n ? null : h)), []);
  const lit = selected ?? hover ?? (zoom === "region" && focusBox ? focusBox.name : null);
  const lineage = useMemo(() => {
    if (!g || !lit || !layout) return null;
    const up = hopsUp(g.parents, lit);
    const models = new Set([...up.keys(), ...(g.children.get(lit) ?? [])]);
    const edges = new Set(layout.edges.filter((e) => (up.has(e.from) && up.has(e.to)) || e.from === lit).map(edgeKey));
    return { up, models, edges };
  }, [g, lit, layout]);
  const [pipe, setPipe] = useState<string | null>(null);
  const pipeline = useMemo(() => {
    if (!pipe || !taxonomy || !g) return null;
    const c = taxonomy.compositions.find((q) => q.name === pipe);
    return c ? c.composes.filter((m) => g.box.has(m)) : null;
  }, [pipe, taxonomy, g]);
  const [pipesOpen, setPipesOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);

  const select = useCallback((name: string) => { setPipesOpen(false); update({ zoom: "node", focus: name }); }, [update]);
  const close = useCallback(() => update({ zoom: focusBox ? "region" : "overview" }), [update, focusBox]);

  // ——— eggs ———
  const [wave, setWave] = useState<{ key: number; delay: Record<string, number> } | null>(null);
  const schedule = useMemo(() => (layout ? forwardPassSchedule(forwardPassOrder({ nodes: layout.boxes.map((b) => ({ name: b.name, depth: b.depth })) }), MOTION.hopStagger) : {}), [layout]);
  useKonami(useCallback(() => setWave((w) => ({ key: (w?.key ?? 0) + 1, delay: schedule })), [schedule]), !frozen);
  useEffect(() => {
    if (!wave) return;
    const t = setTimeout(() => setWave(null), Math.max(0, ...Object.values(wave.delay)) + MOTION.hop + 280);
    return () => clearTimeout(t);
  }, [wave]);
  const grokHeld = useLongFocus(!frozen && hover === GROKKING_EGG.model ? GROKKING_EGG.model : null, GROKKING_EGG.holdMs);
  const keeper = useCritterClicks(7, 2500);
  const { curve: realCurve } = useRealLossCurve(runs, keeper.unlocked && !still);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (keeper.unlocked) keeper.reset();
      else if (pipe) setPipe(null);
      else if (pipesOpen || keyOpen) { setPipesOpen(false); setKeyOpen(false); }
      else if (zoom === "node") close();
      else if (zoom === "region") update({ zoom: "overview" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, close, update, pipe, pipesOpen, keyOpen, keeper]);

  // ——— camera (desktop) ———
  const stage = { w: size.w, h: size.h - SPACE.barDesktop };
  const { cam, svgRef, handlers, landed } = useCamera({
    layout, g, active: !mobile, stage, zoom, focus: focusBox, frozen,
    onBackground: () => { if (selected || pipe) { setPipe(null); if (selected) close(); } },
  });

  // ——— phone: native scroll; the views scroll the sheet ———
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!mobile || !layout || !scrollEl) return;
    // the sheet starts under the sticky bar + ruler
    const top = SPACE.barMobile + RULER_H;
    let y = 0;
    if (zoom === "node" && focusBox) {
      // the selection sits in the band above the bottom sheet (≤ 55% of the height)
      const band = scrollEl.clientHeight * 0.45;
      y = top + focusBox.y - Math.max(top + 8, (band - focusBox.h) / 2 + top / 2);
    } else if (zoom === "region" && focusBox) {
      y = layout.lanes.find((l) => l.family === focusBox.family)!.y;
    }
    scrollEl.scrollTo({ top: Math.max(0, y), behavior: frozen ? "auto" : "smooth" });
  }, [mobile, layout, zoom, focusBox, frozen, scrollEl]);

  // ——— the card ———
  const card = useMemo(() => {
    if (!selected || !taxonomy || !focusBox) return null;
    return cardModel(selected, { taxonomy, evidence, runs, family: focusBox.family, depth: focusBox.depth });
  }, [selected, taxonomy, focusBox, evidence, runs]);
  const lesson = useLesson(card ? selected : null, { runs, evidence, still: view ? view.still : null });

  // ——— packets: the lineage flowing into the selection ———
  const routes: PacketRoute[] = useMemo(() => {
    if (!layout || !selected || !lineage || !g) return [];
    return layout.edges.filter((e) => e.points.length > 1 && lineage.up.has(e.from) && lineage.up.has(e.to))
      .map((e) => ({ id: edgeKey(e), points: e.points, color: fam(g.box.get(e.from)!.family).deep, hop: lineage.up.get(e.from)! - 1 }));
  }, [layout, selected, lineage, g]);

  const sheetState: SheetState = useMemo(() => ({
    states, selected, wave,
    lit: lineage?.models ?? null, litEdges: lineage?.edges ?? null,
    pipeline: lineage ? null : pipeline,
  }), [states, selected, wave, lineage, pipeline]);

  // ——— ready marker (lib/lab-contract.ts; scripts/shoot.mjs waits for it) ———
  const placed = !!layout && (mobile || (!!cam && landed));
  const labReady = useLabReady(ready && placed, rootRef);

  // ——— test hook for scripts/shoot.mjs --motion ———
  useEffect(() => (labReady ? installLabHook({
    select: (name: string) => select(name),
    view: (nv) => update(nv.focus !== undefined ? { zoom: nv.zoom, focus: nv.focus } : { zoom: nv.zoom }),
    critterClick: (n: number) => { for (let i = 0; i < n; i++) keeper.click(); },
  }) : undefined), [labReady, select, update, keeper]);

  const comps = taxonomy?.compositions ?? [];
  const pipeInfo = pipe ? comps.find((c) => c.name === pipe) : null;
  const grok = g?.box.get(GROKKING_EGG.model);
  const familyOf = useCallback((n: string) => g?.box.get(n)?.family ?? "", [g]);
  const addressOf = useCallback((n: string) => g?.box.get(n)?.address ?? "", [g]);
  const models = layout?.boxes.map((b) => b.name).sort() ?? [];
  const audit = layout ? { "data-crossings": layout.audit.crossings, "data-overlaps": layout.audit.overlaps, "data-detours": layout.audit.detours } : {};

  const sheetBody = layout && (
    <>
      <Sheet layout={layout} st={sheetState} onPick={select} onHover={onHover} />
      {selected && routes.length > 0 && <Packets routes={routes} frozen={frozen} runKey={selected} />}
      {grok && hover === GROKKING_EGG.model && !frozen && (
        <foreignObject x={grok.x} y={grok.y - (grokHeld ? 150 : 64)} width={grokHeld ? 300 : 250} height={grokHeld ? 146 : 60} pointerEvents="none">
          <div className="border px-2.5 py-1.5 font-bold leading-snug" style={{ borderColor: COLOR.ink, color: COLOR.ink, background: COLOR.card, borderRadius: RADIUS.ui, fontSize: TYPE.ui }}>
            {grokHeld ? GROKKING_EGG.after : GROKKING_EGG.before}
            {grokHeld && <p className="mt-1 font-medium leading-snug" style={{ fontSize: TYPE.head }}>{GROKKING_EGG.explain.split(". ")[0]}. <span style={{ color: COLOR.inkSoft }}>({GROKKING_EGG.sketch.note})</span></p>}
          </div>
        </foreignObject>
      )}
    </>
  );

  const header = (
    <TopBar mobile={mobile} keeperHappy={keeper.unlocked} onKeeper={keeper.click}
      pipeCount={comps.length} pipeShown={!!pipe} pipesOpen={pipesOpen} onPipes={() => { setPipesOpen((o) => !o); setKeyOpen(false); }}
      keyOpen={keyOpen} onKey={() => { setKeyOpen((o) => !o); setPipesOpen(false); }}
      models={models} onFind={(v) => { if (!g?.box.has(v)) return false; select(v); return true; }} />
  );

  return (
    <LabMotion still={frozen}>
      <div ref={rootRef} data-flow-root className={`${s.page} relative h-full w-full overflow-hidden`} style={{ ...FLOW_CSS_VARS, background: COLOR.sheet }}
        data-lab-ready={labReady} data-flow-mode={layout?.mode} data-box-hits={layout?.audit.boxHits} {...audit}
        data-names-placed={layout ? `${layout.boxes.length}/${layout.boxes.length}` : undefined}>
        {!mobile && header}
        {!layout && (
          <p className="absolute left-6 font-bold" style={{ top: SPACE.barDesktop + 24, color: COLOR.inkSoft, fontSize: TYPE.body }}>
            {taxonomy ? "Routing the sheet…" : "Waiting for the zoo’s API…"}
          </p>
        )}
        {layout && !mobile && cam && (
          <svg ref={svgRef} className="absolute left-0 touch-none select-none" style={{ top: SPACE.barDesktop, width: stage.w, height: stage.h }}
            {...handlers} {...audit} role="img" aria-label="the zoo as a data-flow diagram">
            <g transform={`translate(${cam.tx} ${cam.ty}) scale(${cam.s})`}>{sheetBody}</g>
          </svg>
        )}
        {layout && mobile && (
          <div ref={setScrollEl} className="absolute inset-0 overflow-y-auto overflow-x-hidden">
            <div className="sticky top-0 z-40" style={{ background: COLOR.sheet }}>
              {header}
              <GenerationRuler layout={layout} />
            </div>
            <svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} className="mx-auto block"
              {...audit} role="img" aria-label="the zoo as a data-flow diagram"
              onClick={(e) => { if ((e.target as Element).closest?.("[data-model]") == null && pipe) setPipe(null); }}>
              {sheetBody}
            </svg>
            <div style={{ height: selected ? "56vh" : 24 }} />
          </div>
        )}
        {keyOpen && (
          <div className={`absolute z-50 border p-3 ${mobile ? "inset-x-3" : "right-3"}`}
            style={{ top: (mobile ? SPACE.barMobile : SPACE.barDesktop) + 6, width: mobile ? undefined : SPACE.keyW, borderColor: COLOR.ink, borderRadius: RADIUS.panel, background: COLOR.card, boxShadow: SHADOW.panel }}>
            <Legend sample={layout?.labels[0]?.text ?? ""} />
          </div>
        )}
        {pipesOpen && (
          <PipelinesPanel comps={comps} shown={pipe} top={(mobile ? SPACE.barMobile : SPACE.barDesktop) + 6}
            onToggle={(n) => { setPipe((p) => (p === n ? null : n)); setPipesOpen(false); if (focusBox) update({ zoom: "overview" }); }} />
        )}
        {pipeInfo && !selected && <PipelineCaption comp={pipeInfo} onClear={() => setPipe(null)} />}
        {card && focusBox && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30" style={{ top: mobile ? 0 : SPACE.barDesktop }}>
            <div className="pointer-events-auto">
              <FlowDrawer c={card} address={focusBox.address} lesson={lesson} mobile={mobile} still={frozen} evidence={evidence}
                familyOf={familyOf} addressOf={addressOf} onPick={select} onClose={close}
                onShowPipeline={(n) => { setPipe((p) => (p === n ? null : n)); update({ zoom: "overview" }); }} pipeline={pipe} />
            </div>
          </div>
        )}
        {keeper.unlocked && realCurve && <KeeperTrains curve={realCurve} still={frozen} onClose={keeper.reset} />}
      </div>
    </LabMotion>
  );
}
