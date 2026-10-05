import { Atkinson_Hyperlegible_Next } from "next/font/google";

// The specimen's prose face (truth captions, ledes, index entries). Headings
// and nav labels are drawn in the diagrams' own pixel face, so this is the
// only font the page loads. Exposed as --font-anatomy-prose (tokens.ts TYPE).
const prose = Atkinson_Hyperlegible_Next({ variable: "--font-anatomy-prose", subsets: ["latin"] });

export default function AnatomyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={prose.variable} style={{ display: "contents" }}>{children}</div>;
}
