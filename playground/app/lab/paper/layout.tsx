import type { CSSProperties } from "react";
import { Fredoka } from "next/font/google";
import { STORY_FONT } from "@/components/lab/paper/art";

// Paper skin fonts (two families on this route): Alegreya — the storybook
// serif for the map's title, signs, tags and display headings (loaded by the
// art library, exposed here as --paper-display) — and Fredoka for body/UI.
const body = Fredoka({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--paper-body" });

export default function PaperLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${body.variable} h-full w-full`} style={{ "--paper-display": STORY_FONT } as CSSProperties}>
      {children}
    </div>
  );
}
