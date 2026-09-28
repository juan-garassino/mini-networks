import { Fredoka, Pixelify_Sans } from "next/font/google";

// Two families only: Pixelify Sans for all chrome (everything you read in a
// window) and Fredoka for lettering printed on the paper diorama.
const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-hybrid-pixel" });
const round = Fredoka({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-hybrid-round" });

export default function HybridLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${pixel.variable} ${round.variable} absolute inset-0`}>{children}</div>;
}
