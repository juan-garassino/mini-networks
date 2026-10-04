import { M_PLUS_Rounded_1c, Mochiy_Pop_One } from "next/font/google";

// Skin D · Kawaii DFD — its two faces, scoped to this route only.
// M PLUS Rounded 1c: everything on the sheet and in the drawer (names, addresses, labels).
// Mochiy Pop One: the page title, nothing else.
const mochiy = Mochiy_Pop_One({ variable: "--flow-display", subsets: ["latin"], weight: "400" });
const rounded = M_PLUS_Rounded_1c({ variable: "--flow-body", subsets: ["latin"], weight: ["500", "700", "800"] });

export default function FlowLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${mochiy.variable} ${rounded.variable} h-full`}>{children}</div>;
}
