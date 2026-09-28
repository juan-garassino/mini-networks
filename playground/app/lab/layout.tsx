import { LabReset } from "./lab-reset";

// Bare full-bleed stage for the /lab/<skin> bake-off: no blueprint shell,
// no grid/grain, no edition tokens. Skins own everything inside.
export default function LabLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="fixed inset-0 isolate z-[60] overflow-hidden bg-white text-neutral-900">
      <LabReset />
      {children}
    </div>
  );
}
