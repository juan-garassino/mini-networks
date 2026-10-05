// A family head's text: the numeral ("I"), its separator and the name, each a span, so a skin
// can show or drop the numeral and set the case with tokens alone (skins/types.ts famhead).
export function FamilyHead({ label }: { label: string }) {
  const [numeral, name] = label.includes(" · ") ? label.split(" · ") : ["", label];
  return (
    <span>
      {numeral && <span className="pt-famnum">{numeral} · </span>}
      {name}
    </span>
  );
}
