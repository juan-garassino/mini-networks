"use client";

// Agent–environment family.
//   rl_maze    models/rl_maze/{env,agents,trainer}.py: DQN (27 → 64 → 64 → 4 Q
//              values), ε-greedy, replay, target net; MazeEnv 8×8, density 0.2,
//              seed 42, state = 5×5 window + (row, col), rewards +1 goal /
//              −0.5 hole / −0.01 step / +0.05 × distance gained (shaping)
//   reinforce  models/reinforce: policy 27 → 64 → 4, same env; ∇ log π(a|s)·G_t
//   alphazero  models/alphazero: tic-tac-toe, 18-dim two-plane encoding → MLP →
//              policy (9) + value; PUCT MCTS (64 sims, c_puct 1.5, Dirichlet
//              α 0.6, ε 0.25 at the root in self-play); loss CE(π, visits) +
//              MSE(v, z)
// REAL: the maze, the champion's greedy path, rewards, per-cell best action
// and its Q / probability (data/{rl_maze,reinforce}-champion.ts). AlphaZero has
// no local checkpoint: its board values are EXACT minimax (what search
// converges to), computed here; the network's own guesses are not shown.
import { useMemo } from "react";
import * as RLM from "../data/rl_maze-champion";
import * as RF from "../data/reinforce-champion";
import { Bars, Diamond, Frame, Node, PText, Wire } from "../prims";
import { heatIndex, type Theme } from "../themes";

export const RL_VIEW = { w: 560, h: 316 };
export const RL_CARD_VIEW = { w: 190, h: 104 };
export type MazeName = "rl_maze" | "reinforce";

const ARROW = ["↑", "↓", "←", "→"];
interface MD { maze: readonly (readonly number[])[]; path: readonly (readonly number[])[]; rew: readonly number[]; best: readonly number[]; val: readonly number[]; gamma: number }
const MAZES: Record<MazeName, MD> = {
  rl_maze: { maze: RLM.RLM_MAZE, path: RLM.RLM_PATH, rew: RLM.RLM_REW, best: RLM.RLM_BEST, val: RLM.RLM_VAL, gamma: RLM.RLM_GAMMA },
  reinforce: { maze: RF.RF_MAZE, path: RF.RF_PATH, rew: RF.RF_REW, best: RF.RF_BEST, val: RF.RF_P, gamma: RF.RF_GAMMA },
};

function Maze({ theme: T, d, x, y, c, arrows = true }: { theme: Theme; d: MD; x: number; y: number; c: number; arrows?: boolean }) {
  const H = d.maze.length, W = d.maze[0].length;
  const vmax = Math.max(...d.val);
  const vmin = Math.min(...d.val.filter((v) => v > 0));
  return (
    <g>
      {d.maze.map((row, r) => row.map((v, k) => {
        const cx = x + k * c, cy = y + r * c;
        const i = r * W + k;
        return (
          <g key={`${r}${k}`}>
            <rect x={cx} y={cy} width={c - 1} height={c - 1} fill={v === 0 ? T.ground : v === 3 ? T.ramp[6] : T.panel} />
            {v === 0 && <path d={`M${cx + c / 2 - 2} ${cy + c / 2 - 2}h4v4h-4z`} fill={T.loss} opacity={0.6} />}
            {arrows && v === 1 && d.best[i] >= 0 && c >= 14 && (
              <PText x={cx + c / 2} y={cy + c / 2 - 3} text={ARROW[d.best[i]]} fill={T.heat[Math.max(2, heatIndex((d.val[i] - vmin) / Math.max(1e-6, vmax - vmin)))]} anchor="middle" />
            )}
            {v === 2 && c >= 14 && <PText x={cx + c / 2} y={cy + c / 2 - 3} text="S" fill={T.wireHot} anchor="middle" />}
            {v === 3 && c >= 14 && <PText x={cx + c / 2} y={cy + c / 2 - 3} text="G" fill={T.ground} anchor="middle" />}
          </g>
        );
      }))}
      <Frame x={x - 1} y={y - 1} w={W * c + 1} h={H * c + 1} fill={T.frame} />
      <Wire pts={d.path.map(([r, k]) => [x + k * c + Math.floor(c / 2), y + r * c + Math.floor(c / 2)] as [number, number])} fill={T.wireHot} step={1} w={c >= 14 ? 2 : 1} />
    </g>
  );
}

export function MazeDiagram({ theme, name }: { theme: Theme; name: MazeName }) {
  const T = theme;
  const d = MAZES[name];
  const C = 24, MX = 16, MY = 40;
  const ret = d.rew.reduce((a, b) => a + b, 0);
  const G = useMemo(() => { const g: number[] = []; let acc = 0; for (let t = d.rew.length - 1; t >= 0; t--) { acc = d.rew[t] + d.gamma * acc; g[t] = acc; } return g; }, [d]);
  // the real state at the start: 5×5 window (out of bounds = hole) + (row, col)
  const win: number[] = [];
  for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) { const r = dr, k = dc; win.push(r >= 0 && k >= 0 && r < 8 && k < 8 ? d.maze[r][k] : 0); }
  const bx = 240, by = 44;
  return (
    <g>
      <rect x={0} y={0} width={RL_VIEW.w} height={RL_VIEW.h} fill={T.ground} />
      <PText x={MX} y={14} text="the real maze (seed 42)" fill={T.text} />
      <PText x={MX} y={24} text={name === "rl_maze" ? "arrow = best action, brighter = higher Q" : "arrow = likeliest action, brighter = surer"} fill={T.textDim} />
      <Maze theme={T} d={d} x={MX} y={MY} c={C} />
      <PText x={MX} y={MY + 8 * C + 6} text={`greedy path: ${d.path.length - 1} steps, return ${ret.toFixed(2)}`} fill={T.wireHot} />
      <PText x={MX} y={MY + 8 * C + 16} text="red dot = hole (−0.5, game over), G = goal (+1)" fill={T.textDim} />

      {/* the loop */}
      <PText x={bx} y={14} text="agent and environment" fill={T.text} />
      <rect x={bx} y={by} width={70} height={30} fill={T.panel} />
      <Frame x={bx} y={by} w={70} h={30} fill={T.frame} />
      <PText x={bx + 6} y={by + 6} text="maze env" fill={T.text} />
      <PText x={bx + 6} y={by + 17} text="8×8, 0.2" fill={T.textDim} />
      {/* state */}
      <Wire pts={[[bx + 72, by + 15], [bx + 96, by + 15]]} fill={T.wire} />
      <PText x={bx + 98} y={by - 12} text="state s: 5×5 view" fill={T.textDim} />
      {win.map((v, i) => (
        <rect key={i} x={bx + 98 + (i % 5) * 6} y={by + Math.floor(i / 5) * 6} width={5} height={5} fill={v === 0 ? T.ground : v === 2 ? T.wireHot : T.panel} />
      ))}
      <Frame x={bx + 97} y={by - 1} w={31} h={31} fill={T.frame} />
      <PText x={bx + 132} y={by + 12} text="+ (0,0)" fill={T.textDim} />
      <PText x={bx + 98} y={by + 34} text="_{27} numbers" fill={T.textDim} />
      <Wire pts={[[bx + 165, by + 15], [bx + 180, by + 15]]} fill={T.wire} />
      {/* network */}
      <Bars x={bx + 182} y={by + 6} bars={1} h={18} theme={T} bw={3} gap={2} />
      <Bars x={bx + 190} y={by} bars={2} h={30} theme={T} bw={3} gap={2} />
      {name === "rl_maze" && <Bars x={bx + 204} y={by} bars={2} h={30} theme={T} bw={3} gap={2} />}
      <Bars x={bx + (name === "rl_maze" ? 218 : 204)} y={by + 9} bars={1} h={12} theme={T} bw={3} gap={2} />
      <PText x={bx + 182} y={by - 12} text={name === "rl_maze" ? "Q network" : "policy π"} fill={T.text} />
      <PText x={bx + 182} y={by + 36} text={name === "rl_maze" ? "_{27-64-64-4}" : "_{27-64-4}"} fill={T.textDim} />
      <Wire pts={[[bx + 226, by + 15], [bx + 240, by + 15], [bx + 240, by + 64], [bx + 35, by + 64], [bx + 35, by + 32]]} fill={T.wireHot} />
      <PText x={bx + 120} y={by + 68} text={name === "rl_maze" ? "action a = argmax Q (ε-greedy in training)" : "action a ~ π(·|s)"} fill={T.wireHot} anchor="middle" />
      <Wire pts={[[bx + 10, by + 32], [bx + 10, by + 86], [bx + 190, by + 86]]} fill={T.loss} />
      <PText x={bx + 14} y={by + 90} text="reward r:" fill={T.loss} />
      <PText x={bx + 14} y={by + 100} text="+1 goal, −0.5 hole, −0.01 step" fill={T.textDim} />
      <PText x={bx + 14} y={by + 110} text="+0.05 per step closer (shaping)" fill={T.textDim} />
      <Diamond cx={bx + 196} cy={by + 86} r={5} theme={T} />
      <PText x={bx + 206} y={by + 82} text={name === "rl_maze" ? "target" : "gradient"} fill={T.loss} />
      <PText x={bx + 206} y={by + 92} text={name === "rl_maze" ? "r + γ max Q(s′)" : "∇ log π(a|s)·G"} fill={T.loss} />

      {/* rewards along the real path */}
      <PText x={bx} y={186} text={`rewards on the greedy path, and G_t = r_t + ${d.gamma}·G_{t+1}`} fill={T.text} />
      {d.rew.map((r, t) => {
        const h = Math.round(Math.abs(r) * 60);
        return (
          <g key={t}>
            <rect x={bx + t * 20} y={r >= 0 ? 250 - h : 250} width={8} height={Math.max(1, h)} fill={r >= 0.5 ? T.ramp[6] : r >= 0 ? T.accentHi : T.loss} />
            <rect x={bx + t * 20 + 9} y={250 - Math.round(G[t] * 30)} width={8} height={Math.max(1, Math.round(G[t] * 30))} fill={T.accentLo} />
            <PText x={bx + t * 20 + 8} y={254} text={`_{${t + 1}}`} fill={T.textDim} anchor="middle" />
          </g>
        );
      })}
      <rect x={bx} y={250} width={d.rew.length * 20} height={1} fill={T.frame} />
      <PText x={bx} y={266} text="bright: reward that step (gold = goal); dim: return G_t" fill={T.textDim} />
      <PText x={bx} y={280} text={name === "rl_maze" ? "DQN learns Q from replayed steps and a slow target copy" : "REINFORCE nudges up actions followed by high G_t"} fill={T.textDim} />
    </g>
  );
}

export function MazeCard({ theme, name }: { theme: Theme; name: MazeName }) {
  const T = theme;
  const d = MAZES[name];
  return (
    <g>
      <rect x={0} y={0} width={RL_CARD_VIEW.w} height={RL_CARD_VIEW.h} fill={T.ground} />
      <Maze theme={T} d={d} x={4} y={4} c={12} arrows={false} />
      <PText x={106} y={8} text="real maze," fill={T.text} />
      <PText x={106} y={18} text="champion's" fill={T.text} />
      <PText x={106} y={28} text="greedy path" fill={T.wireHot} />
      <PText x={106} y={44} text={`${d.path.length - 1} steps`} fill={T.textDim} />
      <PText x={106} y={54} text={`return ${d.rew.reduce((a, b) => a + b, 0).toFixed(2)}`} fill={T.textDim} />
      <PText x={106} y={70} text={name === "rl_maze" ? "Q-learning" : "policy grad."} fill={T.textDim} />
    </g>
  );
}

/* ————————————— alphazero ————————————— */
type Board = number[]; // 1 = X, −1 = O, 0 = empty
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const win = (b: Board) => { for (const [a, c, e] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[e]) return b[a]; return 0; };
function minimax(b: Board, p: number): number {
  const w = win(b);
  if (w) return w * p; // from p's view
  if (b.every((v) => v)) return 0;
  let best = -2;
  for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = p; best = Math.max(best, -minimax(b, -p)); b[i] = 0; }
  return best;
}
const POS: Board = [1, 0, 0, 0, -1, 0, 0, 0, 1]; // X corner, O centre, X opposite corner; O to move
const TO_MOVE = -1;

function BoardView({ theme: T, x, y, c, vals }: { theme: Theme; x: number; y: number; c: number; vals?: (number | null)[] }) {
  return (
    <g>
      {POS.map((v, i) => {
        const cx = x + (i % 3) * c, cy = y + Math.floor(i / 3) * c;
        const val = vals?.[i];
        return (
          <g key={i}>
            <rect x={cx} y={cy} width={c - 2} height={c - 2} fill={T.panel} />
            {v !== 0 && <PText x={cx + c / 2 - 1} y={cy + c / 2 - (c > 20 ? 7 : 4)} text={v === 1 ? "X" : "O"} fill={v === 1 ? T.accentHi : T.loss} anchor="middle" s={c > 20 ? 2 : 1} />}
            {v === 0 && val !== undefined && val !== null && (
              <PText x={cx + c / 2 - 1} y={cy + c / 2 - 4} text={val > 0 ? "win" : val < 0 ? "loss" : "draw"} fill={val > 0 ? T.wireHot : val < 0 ? T.loss : T.textDim} anchor="middle" />
            )}
          </g>
        );
      })}
    </g>
  );
}

export function AlphaZeroDiagram({ theme }: { theme: Theme }) {
  const T = theme;
  const vals = useMemo(() => POS.map((v, i) => { if (v) return null; const b = [...POS]; b[i] = TO_MOVE; return -minimax(b, -TO_MOVE); }), []);
  const cx = 350, cy = 140, R = 92;
  const stations: { a: number; t: string; s: string }[] = [
    { a: -90, t: "network", s: "board → π (9), v" },
    { a: -18, t: "MCTS", s: "64 sims, PUCT" },
    { a: 54, t: "visits", s: "a better π" },
    { a: 126, t: "self-play", s: "play, get z" },
    { a: 198, t: "train", s: "CE(π, visits)+MSE(v, z)" },
  ];
  const pt = (a: number, r = R) => [Math.round(cx + r * Math.cos((a * Math.PI) / 180)), Math.round(cy + r * Math.sin((a * Math.PI) / 180))] as [number, number];
  return (
    <g>
      <rect x={0} y={0} width={RL_VIEW.w} height={RL_VIEW.h} fill={T.ground} />
      <PText x={16} y={14} text="a real position, O to move" fill={T.text} />
      <BoardView theme={T} x={16} y={30} c={40} vals={vals} />
      <PText x={16} y={156} text="perfect play from each empty square" fill={T.textDim} />
      <PText x={16} y={166} text="(exact minimax, computed here):" fill={T.textDim} />
      <PText x={16} y={176} text="O must take an edge, a corner loses" fill={T.wireHot} />
      <PText x={16} y={196} text="this is what search converges to;" fill={T.textDim} />
      <PText x={16} y={206} text="the net learns to guess it in one shot" fill={T.textDim} />

      <PText x={cx} y={14} text="the loop that teaches itself" fill={T.text} anchor="middle" />
      <path d={(() => { let d = ""; for (let k = 0; k < 360; k += 4) { const [a, b] = pt(k); d += `M${a} ${b}h1v1h-1z`; } return d; })()} fill={T.wire} />
      {stations.map((s, i) => {
        const [x, y] = pt(s.a);
        const [ax, ay] = pt(s.a + 36);
        return (
          <g key={i}>
            <PText x={ax} y={ay - 3} text="→" fill={T.wireHot} anchor="middle" />
            <rect x={x - 30} y={y - 12} width={60} height={24} fill={T.panel} />
            <Frame x={x - 30} y={y - 12} w={60} h={24} fill={i === 0 ? T.accent : T.frame} />
            <PText x={x} y={y - 8} text={s.t} fill={i === 0 ? T.wireHot : T.text} anchor="middle" />
            <PText x={x} y={y + 16} text={s.s} fill={T.textDim} anchor="middle" />
          </g>
        );
      })}
      <Node cx={cx} cy={cy} glyph="z" theme={T} />
      <PText x={cx} y={cy + 10} text="outcome" fill={T.textDim} anchor="middle" />

      <PText x={16} y={240} text="network: 18 inputs (two 3×3 planes, from the mover's view) → MLP 64 → 9 move logits + 1 value" fill={T.textDim} />
      <PText x={16} y={252} text="PUCT: pick argmax Q + 1.5·P·√ΣN / (1 + N); Dirichlet(0.6) noise, weight 0.25, at the root in self-play" fill={T.textDim} />
      <PText x={16} y={264} text="the gate scores the RAW network with no search, so it measures learning, not the planner" fill={T.textDim} />
      <PText x={16} y={284} text="no local alphazero checkpoint: the network's own move guesses are not shown" fill={T.loss} />
    </g>
  );
}

export function AlphaZeroCard({ theme }: { theme: Theme }) {
  const T = theme;
  const vals = useMemo(() => POS.map((v, i) => { if (v) return null; const b = [...POS]; b[i] = TO_MOVE; return -minimax(b, -TO_MOVE); }), []);
  return (
    <g>
      <rect x={0} y={0} width={RL_CARD_VIEW.w} height={RL_CARD_VIEW.h} fill={T.ground} />
      <BoardView theme={T} x={4} y={4} c={30} vals={vals} />
      <PText x={100} y={8} text="search ↔ net" fill={T.text} />
      <PText x={100} y={20} text="MCTS makes a" fill={T.textDim} />
      <PText x={100} y={30} text="better policy;" fill={T.textDim} />
      <PText x={100} y={40} text="the net copies it" fill={T.textDim} />
      <PText x={100} y={60} text="values: exact" fill={T.wireHot} />
      <PText x={100} y={70} text="minimax" fill={T.wireHot} />
    </g>
  );
}
