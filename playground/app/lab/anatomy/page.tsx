"use client";

// /lab/anatomy — specimen page for Anatomy v2 (components/lab/shared/anatomy2).
// ?model=<name>&theme=pixel|paper&t=<1..1000>&still=1&from=<path>&variant=card
// variant=card shows every card composition side by side (review sheet);
// from=<same-site path> adds a "back to the map" link.
// Sets data-lab-ready="1" once the diagram has painted (scripts/shoot.mjs
// contract). Owner notes from the Feedback tab land in
// .lab-shots/feedback/*-anatomy/.
import { useEffect, useState } from "react";
import { DIAGRAM_NAMES, MechanismDiagram, diagramFor, type ThemeName } from "@/components/lab/shared/anatomy2";
import { THEMES } from "@/components/lab/shared/anatomy2/themes";

interface View { model: string; theme: ThemeName; t: number; still: boolean; from: string | null; cards: boolean }

function parse(search: string): View {
  const p = new URLSearchParams(search);
  const theme = p.get("theme") === "paper" ? "paper" : "pixel";
  const t = Number(p.get("t"));
  return {
    model: p.get("model") || "diffusion",
    theme,
    t: Number.isFinite(t) && t >= 1 && t <= 1000 ? Math.round(t) : 380,
    still: p.get("still") === "1",
    from: safeFrom(p.get("from")),
    cards: p.get("variant") === "card",
  };
}

const FALLBACK_DEMO = "lora";

// only same-site paths (no protocol-relative or absolute URLs)
function safeFrom(v: string | null): string | null {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
}

export default function AnatomySpecimen() {
  const [view, setView] = useState<View | null>(null);
  const [vw, setVw] = useState(1440);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const sync = () => setView(parse(window.location.search));
    const size = () => setVw(window.innerWidth);
    sync(); size();
    window.addEventListener("popstate", sync);
    window.addEventListener("resize", size);
    return () => { window.removeEventListener("popstate", sync); window.removeEventListener("resize", size); };
  }, []);

  useEffect(() => {
    if (!view) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    const to = setTimeout(() => setDrawn(true), 250);
    return () => { cancelAnimationFrame(id); clearTimeout(to); };
  }, [view]);

  const go = (next: Partial<View>) => {
    if (!view) return;
    const merged = { ...view, ...next };
    const p = new URLSearchParams(window.location.search);
    p.set("model", merged.model);
    p.set("theme", merged.theme);
    if (next.t !== undefined) p.set("t", String(merged.t));
    window.history.replaceState(null, "", `${window.location.pathname}?${p}`);
    setView(merged);
  };

  if (!view) return <div style={{ position: "absolute", inset: 0, background: "#0a0c12" }} />;
  const th = THEMES[view.theme];
  const def = diagramFor(view.model);
  // integer pixel scale where it fits (560-wide art × 2 at desktop)
  const avail = Math.min(vw - 32, 1400);
  const base = def?.view.w ?? 560;
  // below 1× the art is unreadable: keep 1× and let the diagram scroll sideways
  const narrow = avail < base;
  const width = narrow ? base : Math.floor(avail / base) * base;
  const models = [...DIAGRAM_NAMES, FALLBACK_DEMO];

  return (
    <main
      data-lab-ready={drawn ? "1" : undefined}
      style={{ position: "absolute", inset: 0, overflow: "auto", background: th.ground, color: th.text, fontFamily: "var(--font-jost), system-ui, sans-serif" }}
    >
      <div style={{ maxWidth: narrow ? avail : width, margin: "0 auto", padding: "20px 16px 64px", boxSizing: "content-box" }}>
        <header style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 20px", marginBottom: 16 }}>
          {view.from && (
            <a href={view.from} style={{ color: th.wireHot, fontSize: 14, textDecoration: "none" }}>← back to the map</a>
          )}
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: th.wireHot, letterSpacing: 0 }}>
            How it works
          </h1>
          <nav aria-label="model" style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {models.map((m) => (
              <button key={m} type="button" onClick={() => go({ model: m })} aria-pressed={m === view.model}
                style={{
                  font: "inherit", fontSize: 13, padding: "3px 9px", cursor: "pointer",
                  border: `1px solid ${m === view.model ? th.wireHot : th.frame}`,
                  background: m === view.model ? th.panel : "transparent",
                  color: m === view.model ? th.wireHot : th.text,
                }}>
                {m}{m === FALLBACK_DEMO ? " (old)" : ""}
              </button>
            ))}
          </nav>
          <nav aria-label="theme" style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            {(["pixel", "paper"] as const).map((tn) => (
              <button key={tn} type="button" onClick={() => go({ theme: tn })} aria-pressed={tn === view.theme}
                style={{
                  font: "inherit", fontSize: 13, padding: "3px 9px", cursor: "pointer",
                  border: `1px solid ${tn === view.theme ? th.wireHot : th.frame}`,
                  background: tn === view.theme ? th.panel : "transparent",
                  color: tn === view.theme ? th.wireHot : th.text,
                }}>
                {tn}
              </button>
            ))}
          </nav>
        </header>
        {view.cards ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
            {models.map((m) => (
              <MechanismDiagram key={`${m}-${view.theme}`} name={m} theme={view.theme} variant="card" still={view.still} width={Math.min(380, avail)} />
            ))}
          </div>
        ) : (
        <div style={narrow ? { overflowX: "auto", margin: "0 -16px", padding: "0 16px" } : undefined}>
        <MechanismDiagram
          key={`${view.model}-${view.theme}`}
          name={view.model}
          theme={view.theme}
          t={view.t}
          onTChange={(t) => go({ t })}
          still={view.still}
          width={width}
          fit={!narrow}
        />
        </div>
        )}
      </div>
    </main>
  );
}
