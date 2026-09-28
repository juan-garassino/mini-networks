// Data numerals as an unambiguous 5×7 pixel digit set (inline SVG in the DOM,
// crisp at integer scale). Pixelify Sans draws 2, 5 and 8 alike below ~20px,
// which misstated counts and thresholds; every number that IS data goes
// through here. The real text stays in the DOM (screen readers, tests).
const GLYPHS: Record<string, string[]> = {
  "0": [".xxx.", "x...x", "x..xx", "x.x.x", "xx..x", "x...x", ".xxx."],
  "1": ["..x..", ".xx..", "..x..", "..x..", "..x..", "..x..", ".xxx."],
  "2": [".xxx.", "x...x", "....x", "...x.", "..x..", ".x...", "xxxxx"],
  "3": ["xxxxx", "...x.", "..x..", "...x.", "....x", "x...x", ".xxx."],
  "4": ["...x.", "..xx.", ".x.x.", "x..x.", "xxxxx", "...x.", "...x."],
  "5": ["xxxxx", "x....", "xxxx.", "....x", "....x", "x...x", ".xxx."],
  "6": ["..xx.", ".x...", "x....", "xxxx.", "x...x", "x...x", ".xxx."],
  "7": ["xxxxx", "....x", "...x.", "..x..", ".x...", ".x...", ".x..."],
  "8": [".xxx.", "x...x", "x...x", ".xxx.", "x...x", "x...x", ".xxx."],
  "9": [".xxx.", "x...x", "x...x", ".xxxx", "....x", "...x.", ".xx.."],
  ".": [".", ".", ".", ".", ".", ".", "x"],
  "-": ["...", "...", "...", "xxx", "...", "...", "..."],
};

export function PixelNum({ value, scale = 2, className }: { value: string | number; scale?: number; className?: string }) {
  const text = String(value);
  let x = 0;
  let d = "";
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) { x += 3; continue; }
    g.forEach((row, y) => {
      for (let i = 0; i < row.length; i++) if (row[i] === "x") d += `M${x + i} ${y}h1v1h-1z`;
    });
    x += g[0].length + 1;
  }
  const w = Math.max(1, x - 1);
  return (
    <span className={`relative inline-block ${className ?? ""}`} style={{ verticalAlign: "baseline" }}>
      <span className="sr-only">{text}</span>
      <svg aria-hidden width={w * scale} height={7 * scale} viewBox={`0 0 ${w} 7`} shapeRendering="crispEdges"
        style={{ display: "inline-block", verticalAlign: "baseline", fill: "currentColor" }}>
        <path d={d} />
      </svg>
    </span>
  );
}
