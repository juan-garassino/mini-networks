// Through services: pipelines that ride several lines. Each row names the
// pipeline and the stations it calls at (bullets in each station's line
// colour); pointing at a row lights those stations on the map via onLight.
import { Bullet } from "./marks";
import { lineColor, type SystemLayout } from "./system";

export interface Service { id: string; label: string; calls: string[] }

export function Services({ layout, services, onSelect, onLight }: {
  layout: SystemLayout;
  services: Service[];
  onSelect: (id: string) => void;
  onLight: (ids: string[] | null) => void;
}) {
  const byId = new Map(layout.stations.map((s) => [s.id, s]));
  return (
    <section className="mt-8">
      <div className="flex flex-col gap-1 border-b-2 border-ink pb-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h2 className="text-[17px] font-semibold text-ink">Through services</h2>
        <span className="text-[12px] text-ink-dim sm:text-right">
          {services.length} pipelines that ride several lines. Point at one to light its stops.
        </span>
      </div>
      <div className="grid sm:grid-cols-2 sm:gap-x-10 xl:grid-cols-3">
        {services.map((c) => (
          <button key={c.id} onClick={() => onSelect(c.id)}
            onMouseEnter={() => onLight(c.calls)} onMouseLeave={() => onLight(null)}
            onFocus={() => onLight(c.calls)} onBlur={() => onLight(null)}
            className="metro-service grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line-faint py-2 text-left">
            <span className="truncate text-[13px] text-ink">{c.label}</span>
            <span className="flex gap-1">
              {c.calls.map((n) => {
                const st = byId.get(n);
                return <Bullet key={n} label={st?.label ?? n} symbol={st?.symbol ?? ""} color={lineColor(layout, st?.lines[0] ?? "")} />;
              })}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
