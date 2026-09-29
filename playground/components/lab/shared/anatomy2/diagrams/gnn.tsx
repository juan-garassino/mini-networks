"use client";

// GNN (GCN) anatomy, from src/mini_networks/models/gnn/{config,model}.py:
// H1 = ReLU(Â X W1), logits = Â H1 W2, Â = D^-½ (A + I) D^-½; 8 → 32 → 4.
// REAL (data/gnn-data.ts): the exact seeded 200-node community graph the code
// trains on, its true communities and 20 labelled nodes, and what averaging
// over neighbours ALONE does to the weak node features (argmax of X, ÂX, Â²X
// — exact propagation, no trained weights; there is no local gnn checkpoint).
import { useMemo } from "react";
import { GNN_ACC, GNN_EDGES, GNN_POS, GNN_PRED, GNN_TRAIN, GNN_Y } from "../data/gnn-data";
import { Bars, Frame, PText, Wire } from "../prims";
import type { Theme } from "../themes";

export const GNN_VIEW = { w: 560, h: 316 };
export const GNN_CARD_VIEW = { w: 190, h: 110 };

const commColor = (T: Theme) => [T.accentHi, T.loss, T.ramp[6], T.ramp[3]];

function Graph({ theme: T, x, y, s, labels, title, sub, node = 3 }: { theme: Theme; x: number; y: number; s: number; labels: readonly number[]; title?: string; sub?: string; node?: number }) {
  const col = commColor(T);
  const P = GNN_POS.map(([a, b]) => [Math.round(x + 4 + a * (s - 8)), Math.round(y + 4 + b * (s - 8))]);
  const edgeD = useMemo(() => GNN_EDGES.map(([i, j]) => `M${P[i][0] + 0.5} ${P[i][1] + 0.5}L${P[j][0] + 0.5} ${P[j][1] + 0.5}`).join(""), [x, y, s]); // eslint-disable-line react-hooks/exhaustive-deps
  const train = new Set<number>(GNN_TRAIN);
  return (
    <g>
      <rect x={x} y={y} width={s} height={s} fill={T.panel} />
      <Frame x={x - 1} y={y - 1} w={s + 2} h={s + 2} fill={T.frame} />
      <path d={edgeD} stroke={T.wire} strokeWidth={0.5} opacity={0.5} fill="none" />
      {P.map(([px, py], i) => (
        <g key={i}>
          {train.has(i) && <rect x={px - 2} y={py - 2} width={node + 2} height={node + 2} fill="#ffffff" />}
          <rect x={px - 1} y={py - 1} width={node} height={node} fill={col[labels[i]]} />
          {labels[i] !== GNN_Y[i] && <rect x={px} y={py} width={1} height={1} fill={T.ground} />}
        </g>
      ))}
      {title && <PText x={x} y={y - 22} text={title} fill={T.text} />}
      {sub && <PText x={x} y={y - 12} text={sub} fill={T.textDim} />}
    </g>
  );
}

export function GNNDiagram({ theme }: { theme: Theme }) {
  const T = theme;
  const S = 124, Y = 44;
  const xs = [16, 150, 284, 418];
  return (
    <g>
      <rect x={0} y={0} width={GNN_VIEW.w} height={GNN_VIEW.h} fill={T.ground} />
      <Graph theme={T} x={xs[0]} y={Y} s={S} labels={GNN_Y} title="true communities" sub="the real 200-node graph" />
      <Graph theme={T} x={xs[1]} y={Y} s={S} labels={GNN_PRED[0]} title="features alone" sub={`right on ${Math.round(GNN_ACC[0] * 100)}% of the rest`} />
      <Graph theme={T} x={xs[2]} y={Y} s={S} labels={GNN_PRED[1]} title="average 1 hop: ÂX" sub={`right on ${Math.round(GNN_ACC[1] * 100)}%`} />
      <Graph theme={T} x={xs[3]} y={Y} s={S} labels={GNN_PRED[2]} title="2 hops: Â²X" sub={`right on ${Math.round(GNN_ACC[2] * 100)}%`} />
      {[1, 2, 3].map((k) => <PText key={k} x={xs[k] - 8} y={Y + S / 2 - 3} text="→" fill={T.wireHot} anchor="middle" />)}
      <PText x={16} y={Y + S + 6} text="colour = community (guessed from the first 4 feature numbers); white box = one of the 20 labelled nodes;" fill={T.textDim} />
      <PText x={16} y={Y + S + 16} text="dark centre = wrong. No weights involved: this is what averaging your neighbours does by itself." fill={T.textDim} />

      {/* the GCN itself */}
      <rect x={10} y={212} width={540} height={94} fill={T.panel} />
      <Frame x={10} y={212} w={540} h={94} fill={T.frame} />
      <PText x={20} y={220} text="the GCN adds learned weights to that averaging, twice" fill={T.wireHot} />
      <PText x={24} y={240} text="X" fill={T.text} />
      <PText x={24} y={250} text="_{200×8}" fill={T.textDim} />
      <Wire pts={[[40, 246], [60, 246]]} fill={T.wire} />
      <PText x={62} y={242} text="Â" fill={T.wireHot} />
      <Wire pts={[[70, 246], [84, 246]]} fill={T.wire} />
      <Bars x={86} y={236} bars={1} h={20} theme={T} bw={3} gap={2} />
      <PText x={84} y={260} text="W1" fill={T.textDim} />
      <Wire pts={[[91, 246], [104, 246]]} fill={T.wire} />
      <Bars x={106} y={230} bars={4} h={32} theme={T} bw={3} gap={2} />
      <PText x={104} y={266} text="_{32} ReLU" fill={T.textDim} />
      <Wire pts={[[126, 246], [140, 246]]} fill={T.wire} />
      <PText x={142} y={242} text="Â" fill={T.wireHot} />
      <Wire pts={[[150, 246], [164, 246]]} fill={T.wire} />
      <Bars x={166} y={238} bars={1} h={16} theme={T} bw={3} gap={2} />
      <PText x={164} y={260} text="W2" fill={T.textDim} />
      <Wire pts={[[171, 246], [186, 246]]} fill={T.wire} />
      {commColor(T).map((c, i) => <rect key={i} x={188 + i * 8} y={242} width={6} height={8} fill={c} />)}
      <PText x={188} y={256} text="4 scores" fill={T.textDim} />
      <PText x={260} y={236} text="H1 = ReLU(Â X W1), scores = Â H1 W2" fill={T.text} />
      <PText x={260} y={248} text="Â = D^-½ (A + I) D^-½: a fair average" fill={T.textDim} />
      <PText x={260} y={258} text="over each node and its neighbours" fill={T.textDim} />
      <PText x={260} y={274} text="loss: cross-entropy on the 20 labelled" fill={T.textDim} />
      <PText x={260} y={284} text="nodes only; the rest learn via Â" fill={T.textDim} />
      <PText x={24} y={286} text="(no local gnn checkpoint: weights not shown)" fill={T.textDim} />
    </g>
  );
}

export function GNNCard({ theme }: { theme: Theme }) {
  const T = theme;
  return (
    <g>
      <rect x={0} y={0} width={GNN_CARD_VIEW.w} height={GNN_CARD_VIEW.h} fill={T.ground} />
      <Graph theme={T} x={4} y={14} s={82} labels={GNN_PRED[0]} node={2} />
      <Graph theme={T} x={104} y={14} s={82} labels={GNN_PRED[2]} node={2} />
      <PText x={4} y={2} text={`features ${Math.round(GNN_ACC[0] * 100)}%`} fill={T.textDim} />
      <PText x={104} y={2} text={`2 hops ${Math.round(GNN_ACC[2] * 100)}%`} fill={T.wireHot} />
      <PText x={95} y={50} text="→" fill={T.wireHot} anchor="middle" />
      <PText x={4} y={98} text="averaging neighbours sorts the graph" fill={T.textDim} />
    </g>
  );
}
