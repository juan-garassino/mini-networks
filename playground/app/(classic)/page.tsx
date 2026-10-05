import type { Metadata } from "next";
import { Editions } from "./editions";

// "/" — the periodic table (three token skins) and the transit map, switched
// in place by ?edition=<id>. Metadata lives here, in a server component; the
// editions are client-side (editions.tsx). Transit retitles the page while it
// is on screen (components/metro/hooks.ts usePageTitle).
export const metadata: Metadata = {
  title: "Periodic table",
  description: "Every model in mini_networks, by family and generation, drawn as a periodic table.",
};

export default function Page() {
  return <Editions />;
}
