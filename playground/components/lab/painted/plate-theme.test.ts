// The pixel map hangs its diagrams in the warm "dusk" theme (anatomy2
// themes.ts) instead of the kit's plum "pixel": same roles, a ground cut
// toward the map's own darks. It may only be adopted if it reads at least as
// well: every drawn role keeps pixel's contrast (WCAG ratio) on the ground and
// on the inset panels, and the data ramps still run dark → light.
import { test } from "node:test";
import assert from "node:assert/strict";
import { THEMES, type Theme } from "../shared/anatomy2/themes.ts";
import { MATERIALS } from "./material.ts";

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const ROLES = ["frame", "wire", "wireHot", "accent", "accentHi", "accentLo", "text", "textDim", "loss", "lossHi"] as const;

test("the pixel map's diagrams use the warm dusk theme", () => {
  assert.equal(MATERIALS.pixel.diagram, "dusk");
});

test("dusk keeps every role at least as legible as plum, on the ground and on panels", () => {
  const { pixel, dusk } = THEMES as Record<string, Theme>;
  for (const role of ROLES) {
    for (const on of ["ground", "panel"] as const) {
      const was = ratio(pixel[role], pixel[on]), now = ratio(dusk[role], dusk[on]);
      assert.ok(now >= was - 1e-6, `${role} on ${on}: ${now.toFixed(2)} < plum ${was.toFixed(2)}`);
    }
  }
  // the reading floor: labels 4.5:1, dim labels 3:1, the network 3:1
  assert.ok(ratio(dusk.text, dusk.ground) >= 4.5);
  assert.ok(ratio(dusk.textDim, dusk.ground) >= 3);
  assert.ok(ratio(dusk.accent, dusk.ground) >= 3);
});

test("dusk's data ramps run dark to light", () => {
  for (const ramp of [THEMES.dusk.ramp, THEMES.dusk.heat]) {
    for (let i = 1; i < ramp.length; i++) assert.ok(lum(ramp[i]) > lum(ramp[i - 1]), `${ramp[i - 1]} → ${ramp[i]}`);
  }
});
