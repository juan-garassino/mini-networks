import { PaintedSkin } from "@/components/lab/painted/painted-skin";

// /lab/painted — the owner's reference maps AS the background, with a live
// overlay (markers, tags, lineage roads, critter, card) on hand-mapped anchors.
// ?map=pixel|paper · ?render=grid|clean|baked (pixel) · ?labels=ours|baked
export default function PaintedPage() {
  return <PaintedSkin />;
}
