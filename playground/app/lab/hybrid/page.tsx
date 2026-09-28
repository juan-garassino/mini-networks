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
import { cardModel, evidenceState, type EvidenceState } from "@/components/lab/shared/card-model";
import { critterStop } from "@/components/lab/hybrid/hybrid-map";
import {
  HybridMap, PixelSprite, RegionMenu, StatusWindow, TitlePlate, familyLabel, frameInto,
  handCssUrl, landBox, nodeBox, HAND, type Insets, type MenuRow, type PartyMember,
} from "@/components/lab/hybrid";
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
  // Phone overview: the land fills the full width right under the title
  // plate, and the family menu sits directly under the map (no dead sea band).
  const PLATE_H = 92;
  const land = world ? landBox(world) : null;
  const phoneMapH = land ? Math.round(vp.w * (land.h / land.w)) : 300;
  const insets: Insets = mobile
    ? zoom === "overview"
      ? { l: 0, r: 0, t: PLATE_H, b: Math.max(12, vp.h - PLATE_H - phoneMapH) }
      : { l: 8, r: 8, t: PLATE_H, b: zoom === "node" ? Math.round(vp.h * 0.52) + 12 : 12 }
    : { l: GAP + LEFT_W + GAP, r: zoom === "node" ? GAP + CARD_W + GAP : GAP, t: GAP, b: GAP };

  const target: CamBox = useMemo(() => {
    if (!world) return { x: 0, y: 0, w: 1, h: 1 };
    let box = zoom === "node" && focusNode ? nodeBox(world, focusNode.name, walk)
      : zoom === "region" && family ? world.camera.regions[family]
      : landBox(world);
    if (mobile && zoom === "node" && focusNode) {
      // phone: never below 1:1, so the focused model's tags print at ≥13px
      const iw = vp.w - insets.l - insets.r, ih = vp.h - insets.t - insets.b;
      const w = Math.min(box.w, iw), h = Math.min(box.h, ih);
      box = { x: focusNode.center.x - w / 2, y: focusNode.center.y - h / 2, w, h };
    }
    return frameInto(box, vp.w, vp.h, insets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, zoom, focusNode, family, walk, mobile, vp.w, vp.h, insets.l, insets.r, insets.t, insets.b]);

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
  // It stands OUTSIDE the target's halo, on the first side (left, right,
  // below, above) not taken by the name tag, the parked critter or the flag.
  const labelAnchor = useMemo(() => new Map((world?.labels ?? []).map((l) => [l.node, l.anchor])), [world]);
  const hand = useMemo(() => {
    if (!world) return null;
    let n: { name: string; center: Pt; atom: boolean } | undefined;
    if (zoom === "node" && focusNode) n = focusNode;
    else if (zoom === "region") {
      const r = menuRows[cursor];
      n = r?.kind === "model" ? byName.get(r.key) : undefined;
    } else {
      const r = menuRows[cursor];
      n = r?.kind === "family" ? entryAtom(r.family) : undefined;   // same rule as pick()
    }
    if (!n) return null;
    const taken = new Set<string>();
    const a = labelAnchor.get(n.name) ?? "S";
    if (a.includes("W")) taken.add("left");
    if (a.includes("E")) taken.add("right");
    if (a.includes("N")) taken.add("up");
    if (a.includes("S")) taken.add("down");
    taken.add("up");                                         // the flag / star seal sits on top
    if (zoom === "node" && focusNode && n === focusNode) {
      const c = critterStop(world, focusNode, walk).park;
      const dx = c.x - n.center.x, dy = c.y - n.center.y;
      if (Math.abs(dx) >= Math.abs(dy) * 0.5) taken.add(dx < 0 ? "left" : "right");
      if (Math.abs(dy) >= Math.abs(dx) * 0.5) taken.add(dy < 0 ? "up" : "down");
    }
    const side = (["left", "right", "down", "up"] as const).find((d) => !taken.has(d)) ?? "left";
    const halo = (n.atom ? 29 : 14.5) + 12;                  // paper spot radius + focus halo
    const cx = (n.center.x - cam.box.x) * cam.scale, cy = (n.center.y - cam.box.y) * cam.scale;
    const off = halo * cam.scale + 4;
    const pos = side === "left" ? { x: cx - off, y: cy } : side === "right" ? { x: cx + off, y: cy }
      : side === "down" ? { x: cx, y: cy + off } : { x: cx, y: cy - off };
    return { ...pos, side };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, zoom, focusNode, walk, menuRows, cursor, byName, labelAnchor, entryAtom, cam.box.x, cam.box.y, cam.scale]);

  // ── chrome rectangles (screen px) → world boxes the map keeps tags out of ─
  const occluders = useMemo(() => {
    const rects: { x: number; y: number; w: number; h: number }[] = [];
    if (mobile) {
      rects.push({ x: 0, y: 0, w: vp.w, h: PLATE_H });
      if (zoom === "node") rects.push({ x: 0, y: vp.h * 0.48 - 12, w: vp.w, h: vp.h });
      if (zoom === "overview" || menuOpen) rects.push({ x: 0, y: PLATE_H + phoneMapH, w: vp.w, h: vp.h });
    } else {
      rects.push({ x: 0, y: 0, w: GAP + LEFT_W + 8, h: vp.h });
      if (zoom === "node") rects.push({ x: vp.w - (GAP + CARD_W + 8), y: 0, w: GAP + CARD_W + 8, h: vp.h });
    }
    return rects.map((r) => ({ x: cam.box.x + r.x / cam.scale, y: cam.box.y + r.y / cam.scale, w: r.w / cam.scale, h: r.h / cam.scale }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile, zoom, menuOpen, vp.w, vp.h, phoneMapH, cam.box.x, cam.box.y, cam.scale]);

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
                signScale={cam.scale * (18 / (mobile ? 13 : 14))} occluders={occluders} onOpen={open}
                phoneSigns={mobile && zoom === "overview" ? { view: cam.box } : null} />
            </svg>
          )}
        </div>

        {/* the pixel hand — chrome, so it floats above the paper */}
        {hand && drawn && !(mobile && zoom === "overview") && (
          <div className={`${s.hand} ${still ? "" : s.handBob}`}
            style={{
              left: hand.side === "left" ? hand.x - HW : hand.side === "right" ? hand.x : hand.x - HW / 2,
              top: hand.side === "down" ? hand.y : hand.side === "up" ? hand.y - HH : hand.y - HH / 2,
            }}>
            {/* sprite points right; turn it toward the target */}
            <PixelSprite sprite={HAND} scale={3} style={{
              transform: hand.side === "right" ? "scaleX(-1)" : hand.side === "down" ? "rotate(-90deg)" : hand.side === "up" ? "rotate(90deg)" : undefined,
            }} />
          </div>
        )}

        {/* left column: title plate + region menu (phone: plate on top, menu under the map) */}
        {world && (
          <div className={mobile
            ? "absolute inset-x-2 top-2 z-30 flex flex-col"
            : "absolute left-4 top-4 bottom-4 z-10 flex flex-col gap-4"}
            style={mobile ? undefined : { width: LEFT_W }}>
            <TitlePlate models={world.nodes.length} families={families.length} compact={mobile}
              onMenu={mobile && zoom !== "overview" ? () => setMenuOpen((o) => !o) : undefined} menuOpen={menuOpen} />
            {showMenu && (
              <RegionMenu title={family ? familyLabel(family) : "Jump to a family"} rows={menuRows} cursor={cursor}
                onPick={pick} onHover={setCursor} touch={mobile}
                footer={mobile
                  ? zoom === "overview" ? "Big castles are atoms, where a family starts. A gold star marks a champion that passed the gate." : undefined
                  : family ? "Arrow keys choose, Enter opens, Esc goes back." : "Arrow keys choose a family, Enter visits it."}
                className={mobile
                  ? zoom === "overview" ? "fixed inset-x-2 z-30 flex" : "fixed inset-x-2 bottom-2 z-30 flex max-h-[45%]"
                  : "flex min-h-0 shrink"}
                style={mobile && zoom === "overview"
                  ? { top: PLATE_H + phoneMapH + 4, maxHeight: vp.h - (PLATE_H + phoneMapH + 4) - 8 } : undefined} />
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
