import "./blueprint.css";
import "@/components/periodic/periodic.css";
import { editionBootScript } from "@/lib/editions";

// The framed shell for the classic playground ("/" and "/atlas").
// Its stylesheet stays out of /lab; links across the two must be plain <a>
// (full reload) because global CSS persists across client navigation.
//
// The boot script runs before the frame is parsed, so the first paint is
// already the chosen edition's (?edition=<id>, else the saved one): its tokens
// on <html> and only its loading shell (lib/editions.ts editionBootScript).
const BOOT = editionBootScript();

export default function ClassicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      <div className="relative z-10 h-full p-3 sm:p-5">
        <div className="bp-frame relative grid h-full grid-rows-[1fr_auto] overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}
