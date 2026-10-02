import { Alegreya, IM_Fell_English_SC, Pixelify_Sans } from "next/font/google";

// The sky skin shares the paper map's typefaces, scoped to this route via CSS variables:
// (IM Fell English SC for titles, Alegreya for body; Pixelify unused here but harmless).
// SC for the paper map's signs and titles, Alegreya for its tags and card text.
const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-pixel", display: "block" });
const fell = IM_Fell_English_SC({ subsets: ["latin"], weight: "400", variable: "--font-fell", display: "block" });
const alegreya = Alegreya({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-alegreya", display: "block" });

export default function SkyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${pixel.variable} ${fell.variable} ${alegreya.variable} h-full w-full`}>{children}</div>;
}
