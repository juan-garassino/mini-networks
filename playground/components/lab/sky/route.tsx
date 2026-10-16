"use client";

// /lab/sky: the Night Map, or (?specimen=1) its specimen sheet. Read from
// window.location (the static export has no server); null until hydrated.
import { useSyncExternalStore } from "react";
import { SkySkin } from "./sky-skin";
import { SkySpecimen } from "./specimen";

const noop = () => () => {};

export function SkyRoute() {
  const specimen = useSyncExternalStore(noop, () => new URLSearchParams(window.location.search).get("specimen") === "1", () => null);
  if (specimen === null) return null;
  return specimen ? <SkySpecimen /> : <SkySkin />;
}
