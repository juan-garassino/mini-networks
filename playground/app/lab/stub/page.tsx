"use client";

// The reference skin: the smallest correct wiring of the /lab contract that
// every bake-off skin copies — URL view → useWorld → camera → paint world
// geometry → card → data-lab-ready. Deliberately unstyled: flat family tints,
// grey roads, plain boxes. Positions come ONLY from lib/world.
import { useEffect, useMemo, useState } from "react";
import { T, type World } from "@/lib/world";
import { useWorld } from "@/hooks/use-world";
import { useLabView } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { useCamera, type CamBox } from "@/components/lab/shared/camera";
import { cardModel, displayName, EVIDENCE_COPY } from "@/components/lab/shared/card-model";

const TINT: Record<string, string> = {
  perception: "#d7eadf", sequence: "#dbe4f3", generative: "#f3e1d4",
  representation: "#e6ddf1", structure: "#f1ecd2", decision: "#f2dbe3",
};

// One SVG path per region: every land tile as a 16px square subpath.
function regionPaths(world: World) {
  const d: string[] = world.regions.map(() => "");
  for (let i = 0; i < world.terrain.length; i++) {
    const r = world.regionOf[i];
    if (r < 0 || world.terrain[i] === T.SEA) continue;
    const x = (i % world.cols) * world.tile, y = Math.floor(i / world.cols) * world.tile;
    d[r] += `M${x} ${y}h16v16h-16z`;
  }
  return d;
}

export default function StubPage() {
  const { view, update } = useLabView();
  const { world, taxonomy, evidence, runs, ready } = useWorld(view ? view.still : null);
  const [drawn, setDrawn] = useState(false);

  const target: CamBox = useMemo(() => {
    if (!world || !view) return { x: 0, y: 0, w: 1, h: 1 };
    const node = view.focus ? world.nodes.find((n) => n.name === view.focus) : undefined;
    if (view.zoom === "node" && node) return world.camera.nodes[node.name].box;
    if (view.zoom === "region" && node) return world.camera.regions[node.family];
    return world.camera.world;
  }, [world, view]);

  const cam = useCamera({ world: world?.camera.world ?? target, target, still: view?.still ?? true });
  const paths = useMemo(() => (world ? regionPaths(world) : []), [world]);

  // Ready only after data AND our first painted frame. rAF can stall under
  // headless --dump-dom virtual time, so a short timeout backs it up.
  useEffect(() => {
    if (!ready || !world) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    const t = setTimeout(() => setDrawn(true), 250);
    return () => { cancelAnimationFrame(id); clearTimeout(t); };
  }, [ready, world]);

  const focus = view?.zoom === "node" && view.focus && world && taxonomy
    ? (() => {
        const n = world.nodes.find((x) => x.name === view.focus);
        return n ? cardModel(n.name, { taxonomy, evidence, runs, family: n.family, depth: n.depth }) : null;
      })()
    : null;

  return (
    <LabMotion still={view?.still ?? true}>
      <div data-lab-ready={drawn ? "1" : undefined} className="relative h-full bg-[#9fb8d4] font-sans">
        <div ref={cam.ref} {...cam.handlers} className="absolute inset-0 touch-none">
          {world && (
            <svg viewBox={cam.viewBox} className="h-full w-full" role="img" aria-label="Map of the model zoo">
              {world.regions.map((r) => (
                <path key={r.id} d={paths[r.id]} fill={TINT[r.family] ?? "#eee"} />
              ))}
              {world.roads.map((r) => (
                <polyline key={r.id} points={r.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none" stroke={r.kind === "bridge" ? "#b44" : "#888"} strokeWidth={4} strokeLinejoin="round" />
              ))}
              {world.nodes.map((n) => (
                <rect key={n.name} x={n.foot.x * 16} y={n.foot.y * 16} width={n.foot.w * 16} height={n.foot.h * 16}
                  rx={4} fill="#fff" stroke="#333" strokeWidth={n.atom ? 3 : 1.5} tabIndex={0}
                  className="cursor-pointer outline-none focus-visible:stroke-blue-600"
                  onClick={() => update({ zoom: "node", focus: n.name })}
                  onKeyDown={(e) => { if (e.key === "Enter") update({ zoom: "node", focus: n.name }); }} />
              ))}
              {world.labels.map((l) => (
                <text key={l.node} x={l.box.x + l.box.w / 2} y={l.box.y + l.box.h / 2} fontSize={l.font}
                  textAnchor="middle" dominantBaseline="central" fill="#222" pointerEvents="none">
                  {displayName(l.text)}
                </text>
              ))}
            </svg>
          )}
        </div>

        {focus && (
          <aside className="absolute inset-x-0 bottom-0 max-h-[55%] overflow-y-auto bg-white p-4 shadow-lg sm:inset-x-auto sm:inset-y-4 sm:right-4 sm:bottom-auto sm:max-h-none sm:w-80 sm:rounded">
            <button className="float-right text-sm underline" onClick={() => update({ zoom: "region" })}>Close</button>
            <h2 className="text-xl font-bold">{displayName(focus.name)}</h2>
            <p className="text-sm text-neutral-600">{EVIDENCE_COPY[focus.state]}</p>
            <p className="mt-2 text-[15px]">{focus.description}</p>
            <p className="mt-2 text-sm">Builds on: {focus.parents.map(displayName).join(", ") || "nothing — an atom"}</p>
            <p className="text-sm">Leads to: {focus.children.map(displayName).join(", ") || "nothing yet"}</p>
          </aside>
        )}
        <a href="/lab/" className="absolute left-4 top-4 rounded bg-white/80 px-2 py-1 text-sm underline">All skins</a>
      </div>
    </LabMotion>
  );
}
