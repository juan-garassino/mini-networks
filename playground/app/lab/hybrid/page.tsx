"use client";

// Skin C · Papercraft map + pixel chrome. The world is a cut-paper diorama;
// everything you read is a 16-bit dialog window printed on card. Wiring
// follows /lab/stub: URL view → useWorld → camera → paint → ready marker.
import { useCallback, useEffect, useMemo, useState } from "react";
import { pathToAtom, type Pt } from "@/lib/world";
import { useWorld } from "@/hooks/use-world";
import { useLabView } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { useCamera, type CamBox } from "@/components/lab/shared/camera";
import { cardModel, displayName, evidenceState, type EvidenceState } from "@/components/lab/shared/card-model";
import {
  Dialog, HybridMap, PixelSprite, RegionMenu, StatusWindow, TitlePlate, Typewriter, familyLabel, frameInto,
  handCssUrl, landBox, nodeBox, HAND, type Insets, type MenuRow, type PartyMember,
} from "@/components/lab/hybrid";
import { spell } from "@/components/lab/hybrid/pixel-num";
import s from "@/components/lab/hybrid/hybrid.module.css";

const LEFT_W = 288;       // left chrome column (title plate + menu), px
const CARD_W = 392;       // status window, px
const GAP = 16;

export default function HybridPage() {
  const { view, update } = useLabView();
  const still = view?.still ?? true;
  const { world, taxonomy, evidence, runs, ready } = useWorld(view ? view.still : null);
  const [vp, setVp] = useState({ w: 1440, h: 900 });
  const [drawn, setDrawn] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [partyCursor, setPartyCursor] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const mobile = vp.w < 700;

  // ── derived data ────────────────────────────────────────────────────────
  const byName = useMemo(() => new Map((world?.nodes ?? []).map((n) => [n.name, n])), [world]);
  const focusNode = view?.focus ? byName.get(view.focus) : undefined;
  const zoom = view && focusNode ? view.zoom : "overview";
  const family = zoom !== "overview" ? focusNode?.family ?? null : null;

  const states = useMemo(() => {
    const out: Record<string, EvidenceState> = {};
    for (const n of world?.nodes ?? []) out[n.name] = evidenceState(evidence.find((e) => e.name === n.name));
    return out;
  }, [world, evidence]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of world?.nodes ?? []) c[n.family] = (c[n.family] ?? 0) + 1;
    return c;
  }, [world]);

  const families = useMemo(() => (world?.regions ?? []).map((r) => r.family), [world]);

  const menuRows: MenuRow[] = useMemo(() => {
    if (!world) return [];
    if (!family) {
      return families.map((f): MenuRow => ({ key: f, kind: "family", label: familyLabel(f), family: f, meta: `${counts[f]} models` }));
    }
    const models = world.nodes.filter((n) => n.family === family)
      .sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
    return [
      { key: "__back", kind: "back", label: "All families", family, meta: "" },
      ...models.map((n): MenuRow => ({
        key: n.name, kind: "model", label: n.name, family: n.family, meta: `LV ${n.depth + 1}`, atom: n.atom, state: states[n.name],
      })),
    ];
  }, [world, family, families, counts, states]);

  // Menu cursor follows the view: the focused model inside a region, the
  // current family in the overview.
  const menuKey = `${family ?? "all"}`;
  useEffect(() => {
    if (!menuRows.length) return;
    if (family && view?.focus) {
      const i = menuRows.findIndex((r) => r.key === view.focus);
      setCursor(i >= 0 ? i : 1);
    } else setCursor(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuKey, view?.focus, menuRows.length]);

  const home = useMemo(() => (world && focusNode ? pathToAtom(world, focusNode.name) : null), [world, focusNode]);
  const walk: Pt[] = useMemo(() => (home ? [...home.points].reverse() : []), [home]);   // atom → focused node
  const walkNodes = useMemo(() => home?.nodes ?? [], [home]);

  const card = useMemo(() => {
    if (zoom !== "node" || !focusNode || !taxonomy) return null;
    return cardModel(focusNode.name, { taxonomy, evidence, runs, family: focusNode.family, depth: focusNode.depth });
  }, [zoom, focusNode, taxonomy, evidence, runs]);

  const party: PartyMember[] = useMemo(() => {
    if (!card) return [];
    const mk = (name: string, role: "parent" | "child"): PartyMember | null => {
      const n = byName.get(name);
      return n ? { name, role, family: n.family, depth: n.depth } : null;
    };
    return [...card.parents.map((p) => mk(p, "parent")), ...card.children.map((c) => mk(c, "child"))]
      .filter((x): x is PartyMember => x !== null);
  }, [card, byName]);
  useEffect(() => { setPartyCursor(0); }, [card?.name]);

  // ── camera: framed into the part of the screen the chrome leaves free ────
  const insets: Insets = mobile
    ? { l: 8, r: 8, t: 72, b: zoom === "node" ? Math.round(vp.h * 0.52) + 12 : zoom === "overview" ? 330 : 136 }
    : { l: GAP + LEFT_W + GAP, r: zoom === "node" ? GAP + CARD_W + GAP : GAP, t: GAP, b: GAP };

  const target: CamBox = useMemo(() => {
    if (!world) return { x: 0, y: 0, w: 1, h: 1 };
    const box = zoom === "node" && focusNode ? nodeBox(world, focusNode.name, walk)
      : zoom === "region" && family ? world.camera.regions[family]
      : landBox(world);
    return frameInto(box, vp.w, vp.h, insets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, zoom, focusNode, family, walk, vp.w, vp.h, insets.l, insets.r, insets.t, insets.b]);

  const cam = useCamera({ world: world?.camera.world ?? target, target, still });

  // Shim signs counter-scale so their 16px lettering never prints under 13px.
  const signGrow = Math.max(1, 13 / (16 * cam.scale));
  // Labels print only when they land ≥13px on screen (atoms are 15px).
  const minFont = cam.scale * 13 >= 12.5 ? 13 : cam.scale * 15 >= 12.5 ? 15 : 99;

  useEffect(() => {
    if (!ready || !world) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(id);
  }, [ready, world]);

  // ── actions ─────────────────────────────────────────────────────────────
  // A family is entered at its first atom (alphabetical), else any member.
  const entryAtom = useCallback((f: string) => {
    const nodes = world?.nodes ?? [];
    return nodes.filter((n) => n.family === f && n.atom).sort((a, b) => a.name.localeCompare(b.name))[0]
      ?? nodes.find((n) => n.family === f);
  }, [world]);
  const open = useCallback((name: string) => { setMenuOpen(false); update({ zoom: "node", focus: name }); }, [update]);
  const pick = useCallback((r: MenuRow) => {
    if (!world) return;
    if (r.kind === "back") { update({ zoom: "overview", focus: null }); return; }
    if (r.kind === "model") { open(r.key); return; }
    const root = entryAtom(r.family);
    if (root) { setMenuOpen(false); update({ zoom: "region", focus: root.name }); }
  }, [world, update, open, entryAtom]);

  // Keyboard feels like a menu: arrows move the hand, Enter opens, Esc backs out.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const mapNode = t?.closest?.("[data-node]")?.getAttribute("data-node");
      if (mapNode && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(mapNode); return; }
      const onControl = t && (t.tagName === "BUTTON" || t.getAttribute("role") === "button");
      const move = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
      if (zoom === "node" && card) {
        if (move && party.length) { e.preventDefault(); setPartyCursor((c) => (c + move + party.length) % party.length); }
        else if (e.key === "Enter" && !onControl && party[partyCursor]) { e.preventDefault(); open(party[partyCursor].name); }
        else if (e.key === "Escape") { e.preventDefault(); update({ zoom: "region" }); }
        return;
      }
      if (move && menuRows.length) { e.preventDefault(); setCursor((c) => (c + move + menuRows.length) % menuRows.length); }
      else if (e.key === "Enter" && !onControl && menuRows[cursor]) { e.preventDefault(); pick(menuRows[cursor]); }
      else if (e.key === "Escape") {
        e.preventDefault();
        if (menuOpen) setMenuOpen(false);
        else if (zoom === "region") update({ zoom: "overview", focus: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, card, party, partyCursor, menuRows, cursor, pick, open, update, menuOpen]);

  // ── the pixel hand: points at what Enter would open ─────────────────────
  // It approaches from the side AWAY from the target's name tag, so it never
  // covers the name it is pointing at.
  const labelAnchor = useMemo(() => new Map((world?.labels ?? []).map((l) => [l.node, l.anchor])), [world]);
  const hand = useMemo(() => {
    if (!world) return null;
    let p: Pt | null = null, reach = 0, fromRight = false;
    const at = (n: { name: string; center: Pt; atom: boolean }) => {
      p = n.center; reach = n.atom ? 32 : 16;
      fromRight = (labelAnchor.get(n.name) ?? "S").includes("W");
    };
    if (zoom === "node" && focusNode) at(focusNode);
    else if (zoom === "region") {
      const r = menuRows[cursor];
      const n = r?.kind === "model" ? byName.get(r.key) : undefined;
      if (n) at(n);
    } else {
      const r = menuRows[cursor];
      // what Enter opens: the family's entry atom (same rule as pick())
      const root = r?.kind === "family" ? entryAtom(r.family) : undefined;
      if (root) at(root);
    }
    if (!p) return null;
    const q = p as Pt;
    const sx = (q.x - cam.box.x) * cam.scale + (fromRight ? 1 : -1) * reach * cam.scale;
    const sy = (q.y - cam.box.y) * cam.scale;
    return { x: sx, y: sy, fromRight };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, zoom, focusNode, menuRows, cursor, byName, labelAnchor, entryAtom, cam.box.x, cam.box.y, cam.scale]);

  // ── narrator line (overview / region only; the status window has its own) ─
  const narration = useMemo(() => {
    const r = menuRows[cursor];
    if (!r || !world || !taxonomy) return "";
    if (r.kind === "family") {
      const atoms = world.nodes.filter((n) => n.family === r.family && n.atom).map((n) => displayName(n.name));
      return `${r.label} has ${spell(counts[r.family])} models grown from ${atoms.length === 1 ? "the atom" : `${spell(atoms.length)} atoms:`} ${atoms.join(", ")}.`;
    }
    if (r.kind === "back") return "Back to the whole map.";
    const m = taxonomy.models.find((x) => x.name === r.key);
    return `${displayName(r.key)}: ${m?.description ?? ""}`;
  }, [menuRows, cursor, world, taxonomy, counts]);

  const handUrl = useMemo(() => handCssUrl(), []);
  const HW = 14 * 3, HH = 11 * 3;
  // Phone: the family menu IS the overview's legend (bottom window); in a
  // region or on a model it opens from the title plate's Families button.
  const showMenu = !mobile || menuOpen || zoom === "overview";

  return (
    <LabMotion still={still}>
      <div data-lab-ready={drawn ? "1" : undefined} className={s.stage}
        style={{
          ["--hybrid-hand" as string]: handUrl,
          // the paper skin's layers letter in these vars; map them to our Fredoka
          ["--paper-body" as string]: "var(--font-hybrid-round)",
          ["--paper-display" as string]: "var(--font-hybrid-round)",
        }}>
        {/* the diorama */}
        <div ref={cam.ref} {...cam.handlers}
          onPointerDown={(e) => { if (!(e.target as Element).closest("[data-node]")) cam.handlers.onPointerDown(e); }}
          onClick={(e) => {
            const n = (e.target as Element).closest("[data-node]")?.getAttribute("data-node");
            if (n) open(n);
          }}
          className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing">
          {world && (
            <svg viewBox={cam.viewBox} className="h-full w-full select-none" role="application" aria-label="Paper map of the model zoo"
              style={{ fontFamily: "var(--font-hybrid-round), system-ui, sans-serif" }}>
              <HybridMap world={world} states={states} focus={focusNode && zoom !== "overview" ? focusNode : null} zoom={zoom}
                walk={walk} walkNodes={walkNodes} still={still} scale={cam.scale} counts={counts} signGrow={signGrow}
                signScale={mobile ? 0 : cam.scale * (18 / 14)} onOpen={open} />
            </svg>
          )}
        </div>

        {/* the pixel hand — chrome, so it floats above the paper */}
        {hand && drawn && !(mobile && zoom === "overview") && (
          <div className={`${s.hand} ${still ? "" : s.handBob}`}
            style={{ left: hand.fromRight ? hand.x + 2 : hand.x - HW - 2, top: hand.y - HH / 2 }}>
            <PixelSprite sprite={HAND} scale={3} flip={hand.fromRight} />
          </div>
        )}

        {/* left column: title plate, region menu, narrator */}
        {world && (
          <div className={mobile
            ? "absolute inset-x-2 top-2 z-30 flex max-h-[calc(100%-16px)] flex-col gap-3"
            : "absolute left-4 top-4 bottom-4 z-10 flex flex-col gap-4"}
            style={mobile ? undefined : { width: LEFT_W }}>
            <TitlePlate models={world.nodes.length} families={families.length} compact={mobile}
              onMenu={mobile && zoom !== "overview" ? () => setMenuOpen((o) => !o) : undefined} menuOpen={menuOpen} />
            {showMenu && (
              <RegionMenu title={family ? familyLabel(family) : "Jump to a family"} rows={menuRows} cursor={cursor}
                onPick={pick} onHover={setCursor} touch={mobile}
                className={mobile ? "fixed inset-x-2 bottom-2 z-30 flex max-h-[45%]" : "flex min-h-0 shrink"} />
            )}
            {zoom !== "node" && narration && !(mobile && showMenu) && (
              <Dialog className={mobile ? "fixed inset-x-2 bottom-2" : "mt-auto"}>
                <Typewriter text={narration} still={still} className={s.t15} />
                <p className={`${s.t13} ${s.dim} mt-1`}>
                  {mobile ? "Tap a stop on the map, or open Families."
                    : zoom === "overview" ? "Arrow keys choose a family, Enter visits it." : "Arrow keys choose, Enter opens, Esc goes back."}
                </p>
              </Dialog>
            )}
          </div>
        )}

        {card && (
          <StatusWindow card={card} party={party} partyCursor={partyCursor} onParty={open} onHover={setPartyCursor}
            onClose={() => update({ zoom: "region" })} still={still} mobile={mobile} />
        )}
      </div>
    </LabMotion>
  );
}
