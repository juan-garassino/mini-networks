import { Alegreya, IM_Fell_English_SC, Pixelify_Sans } from "next/font/google";
import localFont from "next/font/local";

// The painted skin's typefaces, scoped to this route via CSS variables:
// Pixelify Sans for the pixel map (crisp, native to the art), IM Fell English
// SC for the paper map's signs and titles, Alegreya for its tags and card text.
const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-pixel", display: "block" });
const fell = IM_Fell_English_SC({ subsets: ["latin"], weight: "400", variable: "--font-fell", display: "block" });
const alegreya = Alegreya({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-alegreya", display: "block" });

// Pixelify draws 5 as S and 8 as B at chrome sizes ("0.1S0"), and numbers are
// data. So the digits 0-9, and only those (unicode-range), come from two
// clearer pixel faces, and every other character falls through to Pixelify
// (material.ts lists this family first). Chosen from a specimen at 13-28 px,
// dpr 2, against Tiny5, Silkscreen, Jersey 10, Micro 5, Handjet, Bytesized:
//   400-500  VT323: one-pixel strokes like Pixelify's regular, so a number
//            sits in a running line instead of shouting; monospaced
//   600-700  Jersey 15: square-topped 5, pinched 8, the weight of Pixelify's
//            bold; carries tabular figures (tnum)
// Both are the unmodified Google Fonts latin files, OFL (fonts/OFL-*.txt).
// size-adjust 115% brings their digits to Pixelify's cap height (0.643 em
// against 0.56 / 0.556). Each face covers its weight range, so the browser
// never fakes a smeared bold. No fallback face: next/font's metric-adjusted
// Arial has no unicode-range and would take the letters.
const digits = localFont({
  src: [
    { path: "./fonts/VT323-Regular.woff2", weight: "400 500" },
    { path: "./fonts/Jersey15-Regular.woff2", weight: "600 700" },
  ],
  variable: "--font-pixel-digits",
  display: "block",
  adjustFontFallback: false,
  declarations: [
    { prop: "unicode-range", value: "U+0030-0039" },
    { prop: "size-adjust", value: "115%" },
  ],
});

export default function PaintedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${pixel.variable} ${digits.variable} ${fell.variable} ${alegreya.variable} h-full w-full`}>{children}</div>;
}
