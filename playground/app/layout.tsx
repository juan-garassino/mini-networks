import type { Metadata } from "next";
import {
  Big_Shoulders, Cormorant_Garamond, Instrument_Serif, Jost,
  Martian_Mono, Patrick_Hand, VT323,
} from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/copy";

const display = Big_Shoulders({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});
const draft = Martian_Mono({
  variable: "--font-draft",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});
const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400" });
const vt = VT323({ variable: "--font-vt", subsets: ["latin"], weight: "400" });
const jost = Jost({ variable: "--font-jost", subsets: ["latin"], weight: ["400", "600", "700"] });
const cormorant = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin"], weight: ["400", "600", "700"] });
const patrick = Patrick_Hand({ variable: "--font-patrick", subsets: ["latin"], weight: "400" });

// Every route names itself: "<design> | mini_networks" (lib/copy.ts pageTitle
// is the same rule for titles set on the client). A route without a title is
// just the site name.
export const metadata: Metadata = {
  title: { template: `%s | ${SITE}`, default: SITE },
  description: "The mini_networks zoo: small neural networks, their families and lineage, drawn many ways.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${draft.variable} ${instrument.variable} ${vt.variable} ${jost.variable} ${cormorant.variable} ${patrick.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
