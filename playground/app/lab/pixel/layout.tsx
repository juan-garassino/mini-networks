import { Pixelify_Sans } from "next/font/google";

// Skin B's only typeface. Scoped to this route via a CSS variable on a
// wrapper (no global CSS); the skin's module stylesheet reads --font-pixel.
const pixel = Pixelify_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-pixel",
  display: "block",
});

export default function PixelLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${pixel.variable} h-full`}>{children}</div>;
}
