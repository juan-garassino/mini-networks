import type { Metadata } from "next";
import { Alegreya, Atkinson_Hyperlegible_Next, IM_Fell_English_SC, Pixelify_Sans } from "next/font/google";
import localFont from "next/font/local";

export const metadata: Metadata = {
  title: "The Model Zoo map",
  description: "The 44-model zoo as an illustrated map: six lands, every model on its road, its card and how it works one tap away.",
};

// The painted skin's typefaces, scoped to this route via CSS variables:
// Pixelify Sans for the pixel map (crisp, native to the art), IM Fell English
// SC for the paper map's signs and titles, Alegreya for its tags and card text.
const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-pixel", display: "block" });
const fell = IM_Fell_English_SC({ subsets: ["latin"], weight: "400", variable: "--font-fell", display: "block" });
// The pixel map's reading face (material.ts textFont): the card's sentences,
// notes and gate rows, the map plate's caption. Pixel type stays the voice of
// names, buttons and headings; sentences need open counters at 13-15 px.
const text = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-text", display: "block" });
const alegreya = Alegreya({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-alegreya", display: "block" });

// Pixelify draws 5 as S and 8 as B at chrome sizes ("0.1S0"), and numbers are
// data; its capital Z has a 2's hook ("The Model 2oo"). So the digits 0-9 and
// the capital Z, and only those (unicode-range), come from two
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
    { prop: "unicode-range", value: "U+0030-0039, U+005A" },
    { prop: "size-adjust", value: "115%" },
  ],
});

// The paper map's digits: IM Fell English SC draws old-style figures, its 1 a
// small-cap I ("Champion vi"), and a version or a bar is data. So 0-9, and
// only those, come from Alegreya (the paper map's reading face), and the paper
// material asks for lining figures (material.ts `numeric`): every number
// stands on the line at cap height, in signs and text alike. The unmodified
// Google Fonts latin file of the variable Alegreya, OFL (fonts/OFL-Alegreya.txt).
const paperDigits = localFont({
  src: [{ path: "./fonts/Alegreya-latin.woff2", weight: "400 900" }],
  variable: "--font-paper-digits",
  display: "block",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0030-0039" }],
});

export default function PaintedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${pixel.variable} ${digits.variable} ${text.variable} ${paperDigits.variable} ${fell.variable} ${alegreya.variable} h-full w-full`}>{children}</div>;
}
