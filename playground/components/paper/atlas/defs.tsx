"use client";

// Shared SVG foundation for the overworld atlas: gradients, filters and
// patterns referenced by url(#id) throughout island/terrain/landmark/furniture.
// One <AtlasDefs/> is rendered once at the top of the map's <svg>. Filters are
// applied to GROUPS/overlays, never per-tiny-shape, to keep it cheap.
export const ATLAS = {
  seaTop: "#a9c6cc",
  seaDeep: "#6f97a0",
  ink: "#3a2d20",
  foam: "#d8e7e6",
};

export function AtlasDefs() {
  return (
    <defs>
      {/* ——— sea depth: light shallows fading to deeper open water ——— */}
      <radialGradient id="a-sea" cx="50%" cy="42%" r="75%">
        <stop offset="0%" stopColor="#aecbd0" />
        <stop offset="60%" stopColor="#8fb2ba" />
        <stop offset="100%" stopColor="#6f97a0" />
      </radialGradient>

      {/* beach sand: lit crest → shaded inner edge */}
      <linearGradient id="a-sand" x1="0" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stopColor="#efe0b4" />
        <stop offset="100%" stopColor="#d8c48f" />
      </linearGradient>

      {/* per-biome ground gradients (lit top-left → shaded bottom-right) */}
      {[
        ["ground-meadow", "#cbdd9f", "#9dbf76"],
        ["ground-wetland", "#b6d3cb", "#87b0a6"],
        ["ground-mesa", "#e2cc9f", "#c7a874"],
        ["ground-heath", "#cfc2d6", "#a996b6"],
        ["ground-forest", "#bccca0", "#8fab77"],
        ["ground-pines", "#b6ceb4", "#8bb08e"],
      ].map(([id, a, b]) => (
        <linearGradient key={id} id={`a-${id}`} x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor={a} />
          <stop offset="100%" stopColor={b} />
        </linearGradient>
      ))}

      {/* foliage two-tone (canopy highlight → shade) */}
      <linearGradient id="a-leaf" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0%" stopColor="#8fb96f" />
        <stop offset="100%" stopColor="#5f8a52" />
      </linearGradient>
      <linearGradient id="a-pine" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0%" stopColor="#6fa063" />
        <stop offset="100%" stopColor="#3f6e46" />
      </linearGradient>

      {/* metallic gold for the compass; parchment for banners */}
      <linearGradient id="a-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f0d38a" />
        <stop offset="50%" stopColor="#d9ab53" />
        <stop offset="100%" stopColor="#b3852f" />
      </linearGradient>
      <linearGradient id="a-parch" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f7ecca" />
        <stop offset="100%" stopColor="#e9d7a6" />
      </linearGradient>
      <radialGradient id="a-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ffcf6b" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#ffcf6b" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="a-glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#dff0f2" />
        <stop offset="55%" stopColor="#bcd9de" />
        <stop offset="100%" stopColor="#9cc0c6" />
      </linearGradient>

      {/* ——— filters ——— */}
      <filter id="a-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#3a2d20" floodOpacity="0.28" />
      </filter>
      <filter id="a-shadow-sm" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#3a2d20" floodOpacity="0.3" />
      </filter>
      {/* coastline inner shadow: darkens the land just inside the shore */}
      <filter id="a-coast" x="-20%" y="-20%" width="140%" height="140%">
        <feOffset in="SourceAlpha" dx="0" dy="0" result="o" />
        <feGaussianBlur in="o" stdDeviation="9" result="b" />
        <feComposite in="b" in2="SourceAlpha" operator="out" result="ring" />
        <feColorMatrix in="ring" type="matrix"
          values="0 0 0 0 0.22  0 0 0 0 0.17  0 0 0 0 0.10  0 0 0 0.4 0" result="tint" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="tint" /></feMerge>
      </filter>
      {/* union coastline: a single dark outline around the combined alpha of a
          group of overlapping land blobs → one continent, not many islands */}
      <filter id="a-outline" x="-6%" y="-6%" width="112%" height="112%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="2.4" result="d" />
        <feFlood floodColor="#3a2d20" result="c" />
        <feComposite in="c" in2="d" operator="in" result="ring" />
        <feMerge>
          <feMergeNode in="ring" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* paper grain for the whole-map overlay rect */}
      <filter id="a-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n" />
        <feColorMatrix in="n" type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0" />
      </filter>

      {/* ——— patterns ——— */}
      {/* woven / cross-stitch weave for land + sea (the embroidered feel) */}
      <pattern id="a-weave" width="6" height="6" patternUnits="userSpaceOnUse">
        <path d="M0 3 H6 M3 0 V6" stroke="#3a2d20" strokeWidth="0.5" opacity="0.06" />
        <path d="M0 0 L6 6 M6 0 L0 6" stroke="#3a2d20" strokeWidth="0.35" opacity="0.045" />
      </pattern>
      {/* engraved wave-lines for the open sea */}
      <pattern id="a-waves" width="52" height="26" patternUnits="userSpaceOnUse">
        <path d="M0 13 Q13 6 26 13 Q39 20 52 13" fill="none" stroke="#5f8790" strokeWidth="1.1" opacity="0.4" />
      </pattern>
      {/* diagonal hatch for terrain shadow shading */}
      <pattern id="a-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="5" stroke="#3a2d20" strokeWidth="0.7" opacity="0.12" />
      </pattern>
    </defs>
  );
}
