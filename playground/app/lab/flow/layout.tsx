import { M_PLUS_Rounded_1c, Mochiy_Pop_One } from "next/font/google";

// Skin D · Kawaii flow — its two families, scoped to this route only.
// Mochiy Pop One: creature names, lane titles, card title.
// M PLUS Rounded 1c: everything learners read (card body, legend, chrome).
const mochiy = Mochiy_Pop_One({ variable: "--flow-display", subsets: ["latin"], weight: "400" });
const rounded = M_PLUS_Rounded_1c({ variable: "--flow-body", subsets: ["latin"], weight: ["500", "700", "800"] });

export default function FlowLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${mochiy.variable} ${rounded.variable} h-full`}>{children}</div>;
}
