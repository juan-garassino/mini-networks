"use client";

// The line work, in sheet coordinates: every routed edge as one ink line (one weight, one
// elbow radius, an arrowhead at its own input port), the lit lineage redrawn in the accent on
// top, the inline labels (a gap cut into the line, naming a parent in another family), and the
// off-sheet connector pairs (a stub out of each box ending in a tag that names the far end; a
// parent's lines into the other stack share ONE out-tag, a line per far end, and may enter
// their stack at a hub tag whose own routed lines are drawn by Edges).
// Geometry comes from lib/world/dfd.ts; nothing here decides where a line goes.
import { memo } from "react";
import { arrowD, DFD_TAG_H, DFD_TAG_LINE, DFD_TAG_NOTCH, DFD_TAG_TIP, elbowD, tagD, trimEnd, type DfdLabel, type DfdLayout, type DfdOffSheet, type DfdTag } from "@/lib/world/dfd";
import { ARROW, COLOR, fam, OPACITY, STROKE, TYPE } from "./tokens";
import s from "./flow.module.css";

export const edgeKey = (e: { from: string; to: string }) => `${e.from}->${e.to}`;

/** What is lit / dimmed: a lineage (hover, focus, selection) or a shown pipeline. */
export interface EdgeLight {
  /** edges drawn in the accent */
  loud: (key: string) => boolean;
  /** edges faded back */
  dim: (key: string) => boolean;
}

export const Edges = memo(function Edges({ layout, light }: { layout: DfdLayout; light: EdgeLight }) {
  const routed = layout.edges.filter((e) => !e.offSheet && e.points.length > 1);
  const loud = routed.filter((e) => light.loud(edgeKey(e)));
  const [al, ah] = ARROW.rest, [ll, lh] = ARROW.lit;
  return (
    <>
      <g fill="none" stroke={COLOR.ink} strokeWidth={STROKE.edge} strokeLinecap="round" strokeLinejoin="round">
        {routed.map((e) => (
          <g key={edgeKey(e)} opacity={light.dim(edgeKey(e)) ? OPACITY.dimEdge : 1} data-edge={edgeKey(e)}>
            <path d={elbowD(trimEnd(e.points), layout.radius)} />
            <path d={arrowD(e.points, al, ah)} fill={COLOR.ink} stroke="none" />
          </g>
        ))}
      </g>
      <g fill="none" stroke={COLOR.accent} strokeWidth={STROKE.edgeLit} strokeLinecap="round" strokeLinejoin="round">
        {loud.map((e) => (
          <g key={edgeKey(e)}>
            <path d={elbowD(trimEnd(e.points), layout.radius)} />
            <path d={arrowD(e.points, ll, lh)} fill={COLOR.accent} stroke="none" />
          </g>
        ))}
      </g>
    </>
  );
});

export const Labels = memo(function Labels({ labels, light }: { labels: DfdLabel[]; light: EdgeLight | null }) {
  return (
    <>
      {labels.map((l) => {
        // a label fades only when every line it names is faded
        const dim = light ? l.edges.every((k) => light.dim(k)) : false;
        const cx = l.x + l.w / 2, cy = l.y + l.h / 2;
        return (
          <g key={`${l.x}:${l.y}`} opacity={dim ? OPACITY.dimLabel : 1}>
            <rect x={l.x} y={l.y} width={l.w} height={l.h} fill={COLOR.sheet} />
            <text x={cx} y={cy + 3.8} transform={l.turn ? `rotate(-90 ${cx} ${cy})` : undefined}
              textAnchor="middle" className={s.label} fontSize={TYPE.label} fill={COLOR.inkSoft}>{l.text}</text>
          </g>
        );
      })}
    </>
  );
});

/** One connector tag: its stub (the in-end's carries the arrowhead; a hub has none, its lines
 * are routed edges) and the tag, each line banded with ITS far end's family pastel. */
function Tag({ t, role, families, lit, dim, radius }: { t: DfdTag; role: "out" | "in"; families: string[]; lit: boolean; dim: boolean; radius: number }) {
  const ink = lit ? COLOR.accent : COLOR.ink;
  const [al, ah] = lit ? ARROW.lit : ARROW.rest;
  const textX = t.x + 6 + (t.tip === "left" ? DFD_TAG_TIP : 0);
  // a tip above / below the text takes DFD_TAG_NOTCH of the tag's height
  const bodyY = t.tip === "top" ? t.y + DFD_TAG_NOTCH : t.y;
  const bandX = t.x + (t.tip === "left" ? DFD_TAG_TIP : 0), bandW = t.w - (t.tip === "left" || t.tip === "right" ? DFD_TAG_TIP : 0);
  // line i's band: the first takes the tag's top (DFD_TAG_H), each next one DFD_TAG_LINE
  const bandTop = (i: number) => bodyY + (i === 0 ? 0 : DFD_TAG_H - DFD_TAG_LINE + i * DFD_TAG_LINE);
  const outline = tagD(t);
  return (
    <g opacity={dim ? OPACITY.dimBox : 1} data-connector={role}>
      {t.stub.length > 1 && (
        <g fill="none" stroke={ink} strokeWidth={lit ? STROKE.edgeLit : STROKE.edge} strokeLinecap="round">
          <path d={role === "in" ? elbowD(trimEnd(t.stub), radius) : elbowD(t.stub, radius)} />
          {role === "in" && <path d={arrowD(t.stub, al, ah)} fill={ink} stroke="none" />}
        </g>
      )}
      <path d={outline} fill={fam(families[0] ?? "").strip} />
      {t.lines.slice(1).map((_, k) => (
        <rect key={k} x={bandX} y={bandTop(k + 1)} width={bandW} height={DFD_TAG_LINE} fill={fam(families[k + 1] ?? families[0] ?? "").strip} />
      ))}
      <path d={outline} fill="none" stroke={ink} strokeWidth={STROKE.tag} strokeLinejoin="round" />
      {t.lines.map((l, i) => (
        <text key={i} x={textX} y={bodyY + 12.2 + i * DFD_TAG_LINE} className={s.label} fontSize={TYPE.tag} fill={COLOR.ink}>
          <tspan className={s.addr}>{l.address}</tspan>{l.text.slice(l.address.length)}
        </text>
      ))}
    </g>
  );
}

/** The connector tags, each drawn once: a bundle's out-tag and a hub's in-tag serve several
 * pairs, lit when any of them is and faded only when all of them are. */
export const Connectors = memo(function Connectors({ pairs, familyOf, light, dimBox, radius }: {
  pairs: DfdOffSheet[]; familyOf: (n: string) => string; light: EdgeLight; dimBox: (n: string) => boolean; radius: number;
}) {
  const tags = new Map<DfdTag, { role: "out" | "in"; pairs: DfdOffSheet[] }>();
  for (const o of pairs) for (const [t, role] of [[o.out, "out"], [o.in, "in"]] as const) {
    if (!tags.has(t)) tags.set(t, { role, pairs: [] });
    tags.get(t)!.pairs.push(o);
  }
  return (
    <>
      {[...tags].map(([t, { role, pairs: ps }]) => {
        const keys = ps.map(edgeKey);
        const lit = keys.some((k) => light.loud(k));
        // an out-tag names the far ends (its lines in order); an in-tag names the parent
        const families = t.lines.map((l) => familyOf(l.name));
        const dim = !lit && ps.every((o) => light.dim(edgeKey(o)) || dimBox(role === "out" ? o.from : o.to));
        return (
          <g key={`${role}:${keys.join(",")}`} data-edge={keys.join(" ")}>
            <Tag t={t} role={role} families={families} lit={lit} dim={dim} radius={radius} />
          </g>
        );
      })}
    </>
  );
});
