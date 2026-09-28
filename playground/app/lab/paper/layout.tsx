import { Fredoka, Lilita_One } from "next/font/google";

// Papercraft skin fonts: Lilita One (signs cut from card) + Fredoka (labels,
// card, UI). Scoped to this route via CSS variables on a wrapper.
const display = Lilita_One({ subsets: ["latin"], weight: "400", variable: "--paper-display" });
const body = Fredoka({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--paper-body" });

export default function PaperLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${display.variable} ${body.variable} h-full w-full`}>{children}</div>;
}
