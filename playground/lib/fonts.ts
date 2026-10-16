// The design library's shared font definitions: one next/font instance each,
// imported by any route that needs it (Next: "Using a font definitions file").
import localFont from "next/font/local";

// The numerals rule's digit face (lib/numerals.ts): 0-9 only, from VT323
// (regular weights) and Jersey 15 (bold), at 115% so their glyphs reach
// Pixelify's cap height. The files are the painted pixel map's; that kit still
// loads its own copy (app/lab/painted/layout.tsx) until it adopts this one.
export const pixelDigits = localFont({
  src: [
    { path: "../app/lab/painted/fonts/VT323-Regular.woff2", weight: "400 500" },
    { path: "../app/lab/painted/fonts/Jersey15-Regular.woff2", weight: "600 700" },
  ],
  variable: "--font-pixel-digits",
  display: "block",
  adjustFontFallback: false,
  declarations: [
    { prop: "unicode-range", value: "U+0030-0039" },
    { prop: "size-adjust", value: "115%" },
  ],
});
