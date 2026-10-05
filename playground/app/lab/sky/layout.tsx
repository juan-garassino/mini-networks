import type { Metadata } from "next";
import { Pixelify_Sans } from "next/font/google";
import localFont from "next/font/local";

export const metadata: Metadata = {
  title: "The Celestial Zoo | mini_networks",
  description: "The 44-model zoo after dark: families are nebulae, models are stars, lineage is the constellation lines.",
};

// The Night Map's three voices, scoped to this route via CSS variables
// (components/lab/sky/tokens.ts FONT / SIGN_FONT read them):
//   --font-pixel         Pixelify Sans: star names, plaques, body text
//   --font-pixel-digits  the painted pixel map's digits-only family: Pixelify's
//                        5 reads as S and its 8 as B, and numbers are data, so
//                        0-9 (unicode-range) come from VT323 (regular weights)
//                        and Jersey 15 (bold). The same files and settings as
//                        app/lab/painted/layout.tsx; imported from there, not
//                        moved, so the two maps share one copy.
//   --font-sky-sign      Jersey 15, whole: the sign voice (cartouche title, tab
//                        and plate titles). Pixelify's bold capital C closes
//                        into an O and its Z reads as 2 ("The Oelestial 2oo");
//                        Jersey's C is open, its Z square, its 5 square-topped.
// size-adjust 115% brings the Jersey / VT323 glyphs to Pixelify's cap height.
const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-pixel", display: "block" });
const digits = localFont({
  src: [
    { path: "../painted/fonts/VT323-Regular.woff2", weight: "400 500" },
    { path: "../painted/fonts/Jersey15-Regular.woff2", weight: "600 700" },
  ],
  variable: "--font-pixel-digits",
  display: "block",
  adjustFontFallback: false,
  declarations: [
    { prop: "unicode-range", value: "U+0030-0039" },
    { prop: "size-adjust", value: "115%" },
  ],
});
// one weight file for every weight asked of it, so the browser never fakes a smeared bold
const signFace = localFont({
  src: [{ path: "../painted/fonts/Jersey15-Regular.woff2", weight: "400 700" }],
  variable: "--font-sky-sign",
  display: "block",
  adjustFontFallback: false,
  declarations: [{ prop: "size-adjust", value: "115%" }],
});

export default function SkyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${pixel.variable} ${digits.variable} ${signFace.variable} h-full w-full`}>{children}</div>;
}
