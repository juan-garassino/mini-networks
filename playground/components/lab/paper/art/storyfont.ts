// The storybook serif for map furniture (title cartouche, family signs,
// model tags). next/font injects the @font-face when this module is
// imported; components use STORY_FONT inline, so no wrapper class is needed.
import { Alegreya } from "next/font/google";

const alegreya = Alegreya({ subsets: ["latin"], weight: ["500", "700", "800"], display: "swap" });
export const STORY_FONT = alegreya.style.fontFamily;
