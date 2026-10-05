// THE ENCODING SHAPE — every design's encoding.ts (DESIGN-LIBRARY.md § Encoding).
//
//   export const ENCODING = defineEncoding({
//     "station tick": { encodes: "a derived model served by one line" },
//     train: { encodes: "…", kind: "motion" },
//   });
//   export const KEY = defineKey(ENCODING, {
//     rows: [{ mark: "station tick", sample: "tick", label: "Station on one line" }],
//   });
//
// The record key is the mark's short name; `mark` says how it is drawn when the
// name alone does not. A key (legend) is rows that point at marks by name:
// TypeScript rejects a row whose mark is not in the encoding, and the key
// component renders the rows — drawing `sample` with the design's real mark —
// so the on-screen key cannot drift from the marks
// (lib/world/library-encodings.test.ts checks every design at runtime too).
// Import with a relative path and the .ts extension: node --test reads these.

/** What a mark is for. Anything drawn that is none of these must be cut. */
export type MarkKind =
  | "data"          // encodes a datum (the default)
  | "interaction"   // shows hover / focus / selection, encodes nothing at rest
  | "motion"        // a moving mark; frame 0 under the lab contract's still
  | "chrome"        // page furniture: titles, tabs, keys, counts, controls
  | "decoration";   // atmosphere only, never mistaken for data

export interface MarkSpec {
  /** how the mark is drawn, when its name alone does not say */
  mark?: string;
  /** the datum it encodes (for chrome / decoration: why it is there) */
  encodes: string;
  /** default "data" */
  kind?: MarkKind;
  /** where the datum comes from in code */
  source?: string;
  /** the design token it paints with */
  token?: string;
  /** the primitive that draws it */
  prim?: string;
}

export type Encoding = Readonly<Record<string, MarkSpec>>;

/** One key row: the encoding mark it explains, the sample the key draws (a
 * design-specific id the key component turns into the real mark), the words. */
export interface KeyRow<S extends string = string, M extends string = string> {
  mark: M;
  sample: S;
  label: string;
}

export interface MarkKey<S extends string = string, M extends string = string> {
  title?: string;
  rows: readonly KeyRow<S, M>[];
  /** closing sentences under the rows */
  notes?: readonly string[];
}

/** Identity, typed: keeps the literal mark names so keys can be checked against them. */
export function defineEncoding<const E extends Record<string, MarkSpec>>(e: E): E {
  return e;
}

/** Identity, typed: every row's `mark` must be a mark of `enc`. */
export function defineKey<E extends Encoding, const S extends string>(_enc: E, key: MarkKey<S, keyof E & string>): MarkKey<S, keyof E & string> {
  return key;
}

const KINDS: readonly MarkKind[] = ["data", "interaction", "motion", "chrome", "decoration"];

/** Problems with an encoding and its keys (empty = sound). */
export function auditEncoding(enc: Encoding, keys: readonly MarkKey[] = []): string[] {
  const out: string[] = [];
  for (const [name, m] of Object.entries(enc)) {
    if (!m.encodes?.trim()) out.push(`${name}: encodes nothing`);
    if (m.kind && !KINDS.includes(m.kind)) out.push(`${name}: unknown kind ${m.kind}`);
  }
  for (const k of keys) for (const r of k.rows) if (!(r.mark in enc)) out.push(`key row "${r.label}": no mark "${r.mark}"`);
  return out;
}
