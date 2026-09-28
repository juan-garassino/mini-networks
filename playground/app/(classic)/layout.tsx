import "./blueprint.css";

// The framed blueprint shell for the classic playground ("/" and "/atlas").
// Its stylesheet stays out of /lab; links across the two must be plain <a>
// (full reload) because global CSS persists across client navigation.
export default function ClassicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative z-10 h-full p-3 sm:p-5">
      <div className="bp-frame relative grid h-full grid-rows-[1fr_auto] overflow-hidden">
        {children}
      </div>
    </div>
  );
}
