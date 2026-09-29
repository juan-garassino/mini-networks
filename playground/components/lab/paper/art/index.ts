// Paper art library — full guide in README.md. TSX/SVG, deterministic, lit
// from the top-left. Render <ArtDefs/> once per document before any asset.
//
// Stand-ups: <X x y size /> — base-centre at (x, y), `size` px tall.
// Flat spots: <LevelSpot|AtomSpot|CapitalSpot name state x y r /> — (x, y) = face centre.
//   state: "champion" | "trained" | "untrained" | "provisional"
// Set-pieces by family: SET_PIECES[family].C; biome props: BIOME[family][i].C.
// Atom landmarks: <AtomLandmark name state size x y /> — 16 distinct metaphors (LANDMARKS[name]).
// Critter: <CritterArt pose="idle|walk0..3|train" facing={±1} />, <CritterWalk still />.
// Materials: <Cutout d material="paper|card|felt|sticker" shadow="drop|ground|none" />, <StandUp foot />.
export * from "./palette";
export * from "./geom";
export * from "./materials";
export * from "./bits";
export * from "./setpieces";
export * from "./flora";
export * from "./buildings";
export * from "./spots";
export * from "./vehicles";
export * from "./sky";
export * from "./critter";
export * from "./secrets";
export * from "./landmarks";
export { Plaque } from "./landmark-kit";
export * from "./catalog";
export * from "./diorama";
