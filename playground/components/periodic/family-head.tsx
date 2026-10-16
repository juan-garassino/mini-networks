// A family head's text: the family's name alone. lib/blueprint FAMILY_BLOCKS labels
// carry a roman numeral ("I · Perception") for the older editions; the table drops it in
// every skin, since a numeral marks a sequence and the families are not one.
export function FamilyHead({ label }: { label: string }) {
  return <span>{label.includes(" · ") ? label.split(" · ")[1] : label}</span>;
}
