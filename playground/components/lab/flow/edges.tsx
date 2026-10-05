"use client";

// The line work, in sheet coordinates: every routed edge as one ink line (one weight, one
// elbow radius, an arrowhead at its own input port), the lit lineage redrawn in the accent on
// top, the inline labels (a gap cut into the line, naming a parent in another family), and the
// off-sheet connector pairs (a stub out of each box ending in a tag that names the far end).
// Geometry comes from lib/world/dfd.ts; nothing here decides where a line goes.
import { memo } from "react";
import { arrowD, DFD_TAG_NOTCH, DFD_TAG_TIP, elbowD, tagD, trimEnd, type DfdLabel, type DfdLayout, type DfdOffSheet, type DfdTag } from "@/lib/world/dfd";
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

/** One end of a connector pair: its stub (the in-end carries the arrowhead) and its tag,
 * tinted with the FAR end's family. */
function Tag({ t, role, farFamily, lit, dim, radius }: { t: DfdTag; role: "out" | "in"; farFamily: string; lit: boolean; dim: boolean; radius: number }) {
  const ink = lit ? COLOR.accent : COLOR.ink;
  const [al, ah] = lit ? ARROW.lit : ARROW.rest;
  const name = t.text.slice(t.address.length);
  const textX = t.x + 6 + (t.tip === "left" ? DFD_TAG_TIP : 0);
  // a tip above / below the text takes DFD_TAG_NOTCH of the tag's height
  const vertical = t.tip === "top" || t.tip === "bottom";
  const bodyY = t.tip === "top" ? t.y + DFD_TAG_NOTCH : t.y, bodyH = vertical ? t.h - DFD_TAG_NOTCH : t.h;
  return (
    <g opacity={dim ? OPACITY.dimBox : 1} data-connector={role}>
      <g fill="none" stroke={ink} strokeWidth={lit ? STROKE.edgeLit : STROKE.edge} strokeLinecap="round">
        <path d={role === "in" ? elbowD(trimEnd(t.stub), radius) : elbowD(t.stub, radius)} />
        {role === "in" && <path d={arrowD(t.stub, al, ah)} fill={ink} stroke="none" />}
      </g>
      <path d={tagD(t)} fill={fam(farFamily).strip} stroke={ink} strokeWidth={STROKE.tag} strokeLinejoin="round" />
      <text x={textX} y={bodyY + bodyH / 2 + 4.2} className={s.label} fontSize={TYPE.tag} fill={COLOR.ink}>
        <tspan className={s.addr}>{t.address}</tspan>{name}
      </text>
    </g>
  );
}

export const Connectors = memo(function Connectors({ pairs, familyOf, light, dimBox, radius }: {
  pairs: DfdOffSheet[]; familyOf: (n: string) => string; light: EdgeLight; dimBox: (n: string) => boolean; radius: number;
}) {
  return (
    <>
      {pairs.map((o) => {
        const k = edgeKey(o);
        const lit = light.loud(k);
        return (
          <g key={k} data-edge={k}>
            <Tag t={o.out} role="out" farFamily={familyOf(o.to)} lit={lit} dim={!lit && (light.dim(k) || dimBox(o.from))} radius={radius} />
            <Tag t={o.in} role="in" farFamily={familyOf(o.from)} lit={lit} dim={!lit && (light.dim(k) || dimBox(o.to))} radius={radius} />
          </g>
        );
      })}
    </>
  );
});
