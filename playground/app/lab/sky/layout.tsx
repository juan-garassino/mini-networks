import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next, Pixelify_Sans } from "next/font/google";
import localFont from "next/font/local";
import { pixelDigits } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "The Celestial Zoo",
  description: "The 44-model zoo after dark: families are nebulae, models are stars, lineage is the constellation lines.",
};

// The Night Map's four voices, scoped to this route via CSS variables
// (components/lab/sky/tokens.ts FONT / SIGN_FONT read them):
//   --font-pixel         Pixelify Sans: star names, plaques, body text
//   --font-pixel-digits  the library's digit face (lib/fonts.ts, the numerals
//                        rule in lib/numerals.ts): Pixelify's 5 reads as S and
//                        its 8 as B, and numbers are data, so 0-9 come from
//                        VT323 (regular weights) and Jersey 15 (bold).
//   --font-sky-sign      Jersey 15, whole: the sign voice (cartouche title, tab
//                        and plate titles). Pixelify's bold capital C closes
//                        into an O and its Z reads as 2 ("The Oelestial 2oo");
//                        Jersey's C is open, its Z square, its 5 square-topped.
//   --font-text          Atkinson Hyperlegible Next: sentences (the drawer's prose,
//                        notes, gate rows; the loading line). Pixel type stays the
//                        voice of names, headings, buttons and numbers.
// size-adjust 115% brings the Jersey glyphs to Pixelify's cap height.
const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-pixel", display: "block" });
// one weight file for every weight asked of it, so the browser never fakes a smeared bold
const signFace = localFont({
  src: [{ path: "../painted/fonts/Jersey15-Regular.woff2", weight: "400 700" }],
  variable: "--font-sky-sign",
  display: "block",
  adjustFontFallback: false,
  declarations: [{ prop: "size-adjust", value: "115%" }],
});

const text = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-text", display: "block" });

export default function SkyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${pixel.variable} ${pixelDigits.variable} ${signFace.variable} ${text.variable} h-full w-full`}>{children}</div>;
}
