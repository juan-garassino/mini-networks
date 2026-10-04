import { Pixelify_Sans } from "next/font/google";

// The Night Map is set in Pixelify Sans, like the painted pixel map's chrome
// (scoped to this route via the --font-pixel CSS variable).
const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-pixel", display: "block" });

export default function SkyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${pixel.variable} h-full w-full`}>{children}</div>;
}
