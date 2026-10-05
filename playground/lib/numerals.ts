// THE NUMERALS RULE (DESIGN-LIBRARY.md § Numerals). Numbers are data, so a
// digit must never be mistaken for a letter. Pixel display faces fail that
// (Pixelify's 5 reads as S and its 8 as B), so every design that sets text in a
// pixel face lays one shared digits-only family over it:
//
//   --font-pixel-digits   0-9 only (unicode-range): VT323 for regular weights,
//                         Jersey 15 for bold, sized to Pixelify's cap height.
//                         Loaded by lib/fonts.ts pixelDigits; put its .variable
//                         on the route's layout element.
//
// Build every pixel-face stack with withDigits(); designs whose faces already
// have clear digits (Martian Mono, VT323, Jost, M PLUS Rounded, Atkinson, the
// diagram kit's 5×7 bitmap) keep their own. Never small-cap a numeral.
// Pure: node --test may import it (relative path, .ts extension).

export const DIGITS_VAR = "--font-pixel-digits";

/** "var(--font-pixel), monospace" → digits from the shared digit face, letters
 * from the stack; with the variable unset the stack's first face is used alone. */
export function withDigits(stack: string): string {
  const first = stack.split(",")[0].trim();
  return `var(${DIGITS_VAR}, ${first}), ${stack}`;
}
