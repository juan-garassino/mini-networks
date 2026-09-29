import { Alegreya, IM_Fell_English_SC, Pixelify_Sans } from "next/font/google";

// The painted skin's typefaces, scoped to this route via CSS variables:
// Pixelify Sans for the pixel map (crisp, native to the art), IM Fell English
// SC for the paper map's signs and titles, Alegreya for its tags and card text.
const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-pixel", display: "block" });
const fell = IM_Fell_English_SC({ subsets: ["latin"], weight: "400", variable: "--font-fell", display: "block" });
const alegreya = Alegreya({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-alegreya", display: "block" });

export default function PaintedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${pixel.variable} ${fell.variable} ${alegreya.variable} h-full w-full`}>{children}</div>;
}
