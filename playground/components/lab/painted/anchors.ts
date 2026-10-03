// Hand-mapped anchors for the "painted" skin: the owner's reference maps are
// the background, and every live element (evidence marker, tag, lineage road,
// critter) sits on a point that was mapped BY EYE onto the painting, in image
// pixels (1536×1024). Nothing here comes from lib/world — the painting is the
// geometry. Pure data + tiny helpers, no React, no "@/" imports, so
// .lab-shots/painted/check.mjs can run it under plain node.
//
// Mapping rules (checked by .lab-shots/painted/check.mjs):
//   · all 44 models on every map; no two anchors closer than MIN_GAP px;
//   · every model inside its family's land (family = lib/blueprint via
//     familyMapFromBlueprint(taxonomy));
//   · atoms sit on the landmark the painter drew/labelled for them; derived
//     models sit on the painted round waypoint markers or towns along the
//     roads of their family's land, children near their parents;
//   · the road graph is connected, and every anchor is a road stop.
//
// Pixel geometry note: the default pixel background is pixel-map-clean2.png
// (render=clean) or its grid-pixelation pixel-map-grid.png (render=grid) —
// same geometry, mapped in PIXEL below. clean2 is a different composition
// from the labelled pixel-map.png, so render=baked uses its own set:
// BAKED_PIXEL (each model's spot on the labelled image) + PIXEL_V1's roads and
// lands (mapped on the first clean pass, which shares the labelled image's
// composition) warped onto it by warpToBaked().

export type MapId = "pixel" | "paper";
export type Family = "perception" | "sequence" | "generative" | "representation" | "structure" | "decision";
export const FAMILIES: Family[] = ["perception", "sequence", "generative", "representation", "structure", "decision"];

export interface Pt { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }
/** [x, y, why] — the why is the mapping decision, kept next to the number. */
export type AnchorRow = readonly [number, number, string];
/** A road: stop → stop (anchor names or junction ids "j:…") via painted waypoints. */
export interface RoadRow { a: string; b: string; via?: readonly (readonly [number, number])[]; kind?: "road" | "bridge" | "air" }
/** Baked lettering (paper): under labels=ours each model plate is covered by OUR plate
 * carrying `name` (the model anchored at that landmark) or "no model yet";
 * family plates are kept and get a count seal; counts/subtitle are refilled. */
export interface BakedText { text: string; name?: string; box: Box; src?: readonly [number, number]; kind: "family" | "model" | "invented" | "count" | "subtitle" }

export interface PaintedMap {
  id: MapId;
  width: number;
  height: number;
  anchors: Record<string, AnchorRow>;
  junctions: Record<string, readonly [number, number]>;
  roads: RoadRow[];
  /** rough land outlines, for the in-land check and the region camera */
  lands: Record<Family, readonly (readonly [number, number])[]>;
  /** where our family sign goes (centre) */
  signs: Record<Family, readonly [number, number]>;
  /** our title cartouche (top-left plate with real counts + search) */
  cartouche: Box;
  /** where "N pipelines" goes */
  pipelines: Pt;
  baked: BakedText[];
  /** hand-placed features of the painting that life.ts animates */
  landmarks?: {
    vents: readonly (readonly [number, number])[];
    lamps: readonly (readonly [number, number])[];
    /** boxes around the painted waterfalls (the water inside pours) */
    falls?: readonly Box[];
  };
}

export const IMAGE = { w: 1536, h: 1024 } as const;
/** Minimum anchor spacing in 1536-wide image px; scaled by map.width / 1536. */
export const MIN_GAP = 28;

// ————————————————————————————————————————————————————————————— pixel (clean2 / grid geometry)
// pixel-map-clean2.png (and pixel-map-grid.png, pixelated FROM it) is the
// default pixel background. Its 25 cream round road markers were found by
// colour (.lab-shots/painted/markers.mjs: cream discs 14–17px wide) plus one
// whiter disc on the snow (695,169) read by eye; landmarks were read off 2×
// gridded crops (.lab-shots/painted/grid/c2*.png).
// Lands: perception = the west green lobe (windmill chapel, cottage), the
// middle forest with the red church town + watermill, the docks and the SW
// rail desert (windmill, water tower, station); representation = the
// treehouse grove + the snow plateau (castle, white tower); sequence = the
// blue castle east of the river, the palm ruins and the NE desert (wagon,
// watchtower, towered manor, lookout crane); generative = the volcano
// (factory stack, lava junction, lighthouse chapel, lava castle); structure =
// the floating neon city (two markers on its deck; reached by an "air" link);
// decision = the church isle + observatory + the drowned temples.
const PIXEL: PaintedMap = {
  id: "pixel",
  width: 1536,
  height: 1024,
  anchors: {
    // perception — atoms on their landmarks
    classifier: [560, 430, "the red church + blue hall town in the middle forest — the zoo's first atom at its busiest crossroads"],
    segmentation: [455, 585, "the red manor above the docks — the second-biggest perception town"],
    tabular_classifier: [262, 732, "the SW windmill on the rail desert — the tabular atom gets the desert's own landmark"],
    // perception — derived, radiating from the church town
    resnet: [467, 455, "marker west of the church town, first stop on classifier's road (classifier child)"],
    convnext: [369, 325, "marker on the NW forest road, one hop past resnet towards the grove (classifier + resnet)"],
    lora: [287, 375, "the windmill chapel on the west lobe (classifier child)"],
    mobilenet: [247, 430, "the cottage below the windmill — small and efficient (classifier child)"],
    vit: [642, 478, "the watermill at the waterfall, the crossing towards the blue castle (transformer + classifier)"],
    detection: [557, 582, "marker south of the church town (classifier child)"],
    sam: [376, 602, "dock marker west of the manor (segmentation + transformer)"],
    unet_ae: [332, 562, "the blue dock house beside Segmentation (segmentation child)"],
    rpp_classifier: [325, 655, "the stilt house on the desert edge between docks and rail (classifier + tabular)"],
    audio_classifier: [597, 655, "marker on the south cliff road (classifier child)"],
    audio_spectrogram: [655, 730, "next marker down the same road, at the desert's volcano edge (audio line, 2nd)"],
    audio_melspectrogram: [457, 692, "the water tower on the rail (audio line, 3rd)"],
    // representation
    simclr: [470, 185, "the great treehouse — the representation atom"],
    vision_embed: [571, 206, "grove marker east of the treehouse (simclr's plainest child)"],
    dino: [770, 118, "the snow castle — the plateau's summit (vit + simclr)"],
    clip: [885, 180, "the white snow tower, on the road that drops to the desert towards the castle (simclr + transformer)"],
    // sequence
    transformer: [735, 330, "the blue castle east of the river — the sequence capital"],
    rnn: [855, 490, "the palm ruins at the heart of the desert — the oldest sequence atom"],
    mamba: [1005, 395, "the towered manor in the NE desert"],
    text_seq2seq: [642, 325, "marker at the forest bridgehead in front of the castle (transformer child)"],
    text_token_classifier: [647, 394, "marker at the church-town bridge, below the castle (transformer child)"],
    moe: [825, 380, "the covered wagon east of the castle — experts on the road"],
    audio_transformer: [940, 380, "the wooden watchtower (transformer + audio_spectrogram)"],
    kimi: [1080, 419, "marker at the NE bridgehead past Mamba — transformer + moe + mamba"],
    deepseek: [1085, 340, "the lookout crane on the NE rocks (transformer + moe)"],
    grokking: [950, 560, "the small shrine SE of the ruins (transformer child)"],
    rag: [745, 502, "marker west of the ruins, over the watermill bridge (transformer child)"],
    text_diffusion: [928, 627, "south desert marker facing the volcano — transformer + diffusion"],
    // generative — the volcano
    pixelcnn: [840, 700, "the crater peak, lava running down in rasters"],
    diffusion: [695, 800, "the factory stack where the rail ends — noise in, samples out"],
    tabular_diffusion: [757, 794, "the lava-junction marker next to the factory (diffusion + tabular)"],
    vae: [740, 890, "the little lighthouse chapel on the south flank"],
    gan: [880, 835, "the lava castle"],
    // structure — the floating city
    gnn: [1200, 185, "the city deck's west marker"],
    nerf: [1359, 185, "the city deck's east marker"],
    // decision
    alphazero: [1260, 450, "the red church on the isle"],
    rlhf: [1385, 540, "the blue-domed observatory (transformer + reinforce)"],
    grpo: [1332, 565, "marker below the observatory (rlhf child)"],
    dpo: [1171, 500, "marker at the long bridge's isle end (rlhf child)"],
    reinforce: [1235, 660, "the drowned domed temple"],
    rl_maze: [1335, 790, "the drowned maze palace (dome + towers)"],
  },
  junctions: {
    "j:grove": [408, 245],       // marker below the treehouse
    "j:snowBridge": [665, 190],  // plank bridge grove → snow
    "j:snowW": [695, 169],       // whiter snow marker
    "j:snowHouse": [930, 235],   // snow house
    "j:snowSE": [985, 287],      // marker on the snow's SE cliff (ladder down)
    "j:westBridge": [365, 478],  // bridge west lobe → middle forest
    "j:sw": [339, 707],          // rail-desert marker
    "j:station": [530, 725],     // rail station
    "j:rail": [518, 811],        // south rail marker
    "j:seqE": [1008, 538],       // desert marker before the long bridge
    "j:lagoon": [1207, 742],     // drowned marker
    "j:volE": [966, 846],        // marker on the volcano's east landing (plank bridge out)
  },
  roads: [
    // representation
    { a: "simclr", b: "j:grove", via: [[440, 225]] },
    { a: "simclr", b: "vision_embed", via: [[520, 215]] },
    { a: "vision_embed", b: "j:snowBridge", via: [[620, 200]], kind: "bridge" },
    { a: "j:snowBridge", b: "j:snowW" },
    { a: "j:snowW", b: "dino", via: [[735, 150]] },
    { a: "j:snowW", b: "clip", via: [[760, 200], [840, 200]] },
    { a: "clip", b: "j:snowHouse" },
    { a: "j:snowHouse", b: "j:snowSE" },
    { a: "j:snowSE", b: "deepseek", via: [[1030, 320]] },
    { a: "j:snowSE", b: "mamba", via: [[1000, 340]] },
    // perception
    { a: "j:grove", b: "convnext", via: [[390, 285]] },
    { a: "convnext", b: "lora", via: [[330, 350]] },
    { a: "lora", b: "mobilenet", via: [[270, 405]] },
    { a: "convnext", b: "resnet", via: [[400, 380], [440, 420]] },
    { a: "mobilenet", b: "j:westBridge", via: [[310, 460]], kind: "bridge" },
    { a: "j:westBridge", b: "resnet", via: [[420, 470]] },
    { a: "resnet", b: "classifier", via: [[510, 445]] },
    { a: "classifier", b: "vit", via: [[605, 470]] },
    { a: "classifier", b: "text_token_classifier", via: [[600, 420], [615, 412]], kind: "bridge" },
    { a: "resnet", b: "segmentation", via: [[440, 520]] },
    { a: "resnet", b: "detection", via: [[515, 520]] },
    { a: "classifier", b: "detection", via: [[560, 500]] },
    { a: "segmentation", b: "sam", via: [[415, 600]] },
    { a: "sam", b: "unet_ae" },
    { a: "sam", b: "rpp_classifier", via: [[350, 635]] },
    { a: "rpp_classifier", b: "j:sw" },
    { a: "j:sw", b: "tabular_classifier", via: [[300, 722]] },
    { a: "j:sw", b: "audio_melspectrogram", via: [[400, 715]] },
    { a: "audio_melspectrogram", b: "j:station" },
    { a: "j:station", b: "j:rail", via: [[525, 770]] },
    { a: "j:station", b: "audio_classifier", via: [[565, 690]] },
    { a: "detection", b: "audio_classifier", via: [[580, 620]] },
    { a: "audio_classifier", b: "audio_spectrogram", via: [[625, 692]] },
    // sequence
    { a: "vision_embed", b: "text_seq2seq", via: [[590, 260], [612, 305]], kind: "bridge" },
    { a: "text_seq2seq", b: "transformer", via: [[690, 338]] },
    { a: "text_seq2seq", b: "text_token_classifier" },
    { a: "text_token_classifier", b: "transformer", via: [[700, 380]] },
    { a: "vit", b: "rag", via: [[690, 488]], kind: "bridge" },
    { a: "text_token_classifier", b: "rag", via: [[690, 440], [720, 480]] },
    { a: "transformer", b: "moe", via: [[790, 395]] },
    { a: "moe", b: "audio_transformer", via: [[880, 405]] },
    { a: "audio_transformer", b: "mamba" },
    { a: "mamba", b: "kimi", via: [[1045, 410]] },
    { a: "kimi", b: "deepseek", via: [[1090, 380]] },
    { a: "rag", b: "rnn", via: [[800, 505]] },
    { a: "moe", b: "rnn", via: [[840, 430]] },
    { a: "rnn", b: "grokking", via: [[910, 530]] },
    { a: "grokking", b: "j:seqE" },
    { a: "kimi", b: "j:seqE", via: [[1045, 480]] },
    { a: "rag", b: "text_diffusion", via: [[840, 605]] },
    { a: "grokking", b: "text_diffusion", via: [[945, 600]] },
    // generative
    { a: "audio_spectrogram", b: "diffusion", via: [[680, 770]] },
    { a: "j:rail", b: "diffusion", via: [[600, 785], [650, 795]] },
    { a: "diffusion", b: "tabular_diffusion" },
    { a: "tabular_diffusion", b: "pixelcnn", via: [[800, 740]] },
    { a: "tabular_diffusion", b: "vae", via: [[755, 850]] },
    { a: "tabular_diffusion", b: "gan", via: [[820, 815]] },
    { a: "pixelcnn", b: "text_diffusion", via: [[880, 655]], kind: "bridge" },
    { a: "gan", b: "j:volE", via: [[925, 845]] },
    // decision
    { a: "kimi", b: "dpo", via: [[1110, 450], [1150, 480]], kind: "bridge" },
    { a: "j:seqE", b: "dpo", via: [[1085, 525], [1130, 510]], kind: "bridge" },
    { a: "dpo", b: "alphazero", via: [[1215, 470]] },
    { a: "dpo", b: "grpo", via: [[1250, 530]] },
    { a: "alphazero", b: "grpo", via: [[1300, 500]] },
    { a: "grpo", b: "rlhf" },
    { a: "grpo", b: "reinforce", via: [[1290, 610]] },
    { a: "reinforce", b: "j:lagoon", via: [[1215, 700]] },
    { a: "j:lagoon", b: "rl_maze", via: [[1260, 770]] },
    { a: "text_diffusion", b: "reinforce", via: [[1010, 640], [1060, 670], [1110, 700]], kind: "bridge" },
    // structure — the floating city, reached through the air from the lookout crane
    { a: "gnn", b: "nerf", via: [[1280, 210]] },
    { a: "deepseek", b: "gnn", via: [[1150, 260]], kind: "air" },
  ],
  lands: {
    representation: [[380, 60], [560, 50], [640, 120], [700, 60], [860, 20], [1000, 120], [1040, 220], [1010, 300], [960, 310], [900, 280], [820, 300], [700, 260], [660, 215], [600, 225], [590, 250], [520, 235], [440, 265], [380, 230]],
    perception: [[130, 380], [200, 330], [300, 280], [380, 240], [440, 270], [520, 240], [590, 255], [610, 300], [625, 420], [640, 450], [680, 500], [690, 560], [640, 640], [690, 720], [670, 760], [600, 760], [560, 840], [450, 860], [300, 860], [200, 820], [140, 720], [180, 620], [200, 520], [120, 450]],
    sequence: [[613, 300], [660, 230], [720, 270], [820, 300], [900, 285], [960, 310], [1010, 300], [1100, 320], [1110, 440], [1060, 560], [1030, 640], [930, 660], [850, 650], [760, 620], [700, 560], [680, 500], [640, 450], [625, 420]],
    generative: [[600, 770], [650, 740], [700, 700], [780, 650], [860, 650], [960, 720], [1050, 860], [980, 960], [800, 990], [620, 960], [580, 880]],
    structure: [[1060, 40], [1480, 40], [1480, 330], [1060, 330]],
    decision: [[1120, 420], [1300, 360], [1450, 420], [1480, 600], [1500, 800], [1420, 940], [1100, 920], [1000, 780], [1050, 660], [1110, 560], [1140, 480]],
  },
  // Signs + cartouche over open sea or cliff faces, never on a town.
  signs: {
    perception: [200, 500],
    representation: [975, 40],
    sequence: [1130, 590],
    generative: [800, 985],
    structure: [1430, 255],
    decision: [1420, 650],
  },
  cartouche: { x: 24, y: 24, w: 292, h: 140 },
  pipelines: { x: 1440, y: 990 },
  baked: [],
};

// ————————————————————————————————————————————————————————————— pixel TRUE (native 768×512)
// pixel-map-true.png is TRUE pixel art: 768×512, 128 colours, a real 1-px
// grid. The skin paints it itself from pixel-map.json (scripts/
// pixelmap_to_json.py), so these anchors are in NATIVE art pixels — one unit
// = one art pixel — and the camera rests only where an art pixel is a whole
// number of device pixels. The composition is clean2's at exactly half scale:
// every one of clean2's 25 round road markers was re-found on the true image
// by colour (.lab-shots/painted/markers-true.ts: white discs 7–9 px wide)
// within 3.3 px of its halved clean2 position. Anchors on a marker sit on the
// detected disc centre; landmark anchors were halved from clean2 and then
// checked one by one on 4× crops of the true image
// (.lab-shots/painted/overlay/true-*.png) — corrections noted inline.
const TRUE: PaintedMap = {
  id: "pixel",
  width: 768,
  height: 512,
  anchors: {
    classifier: [280, 215, "the red church + blue hall town in the middle forest — the zoo's first atom at its busiest crossroads"],
    segmentation: [228, 293, "the red manor above the docks — the second-biggest perception town"],
    tabular_classifier: [131, 366, "the SW windmill on the rail desert — the tabular atom gets the desert's own landmark"],
    resnet: [234, 227, "on its road marker: marker west of the church town, first stop on classifier's road (classifier child)"],
    convnext: [185, 162.5, "on its road marker: marker on the NW forest road, one hop past resnet towards the grove (classifier + resnet)"],
    lora: [144, 188, "the windmill chapel on the west lobe (classifier child)"],
    mobilenet: [124, 215, "the cottage below the windmill — small and efficient (classifier child)"],
    vit: [321, 239, "the watermill at the waterfall, the crossing towards the blue castle (transformer + classifier)"],
    detection: [280, 291, "on its road marker: marker south of the church town (classifier child)"],
    sam: [188.5, 301, "on its road marker: dock marker west of the manor (segmentation + transformer)"],
    unet_ae: [166, 281, "the blue dock house beside Segmentation (segmentation child)"],
    rpp_classifier: [163, 328, "the stilt house on the desert edge between docks and rail (classifier + tabular)"],
    audio_classifier: [299, 328, "on its road marker: marker on the south cliff road (classifier child)"],
    audio_spectrogram: [328.5, 365.5, "on its road marker: next marker down the same road, at the desert's volcano edge (audio line, 2nd)"],
    audio_melspectrogram: [229, 346, "the water tower on the rail (audio line, 3rd)"],
    simclr: [235, 93, "the great treehouse — the representation atom"],
    vision_embed: [286.5, 102.5, "on its road marker: grove marker east of the treehouse (simclr's plainest child)"],
    dino: [385, 59, "the snow castle — the plateau's summit (vit + simclr)"],
    clip: [443, 90, "the white snow tower, on the road that drops to the desert towards the castle (simclr + transformer)"],
    transformer: [368, 165, "the blue castle east of the river — the sequence capital"],
    rnn: [428, 245, "the palm ruins at the heart of the desert — the oldest sequence atom"],
    mamba: [503, 198, "the towered manor in the NE desert"],
    text_seq2seq: [321, 162.5, "on its road marker: marker at the forest bridgehead in front of the castle (transformer child)"],
    text_token_classifier: [324, 198, "on its road marker: marker at the church-town bridge, below the castle (transformer child)"],
    moe: [413, 190, "the covered wagon east of the castle — experts on the road"],
    audio_transformer: [470, 190, "the wooden watchtower (transformer + audio_spectrogram)"],
    kimi: [543.5, 209, "on its road marker: marker at the NE bridgehead past Mamba — transformer + moe + mamba"],
    deepseek: [543, 170, "the lookout crane on the NE rocks (transformer + moe)"],
    grokking: [475, 280, "the small shrine SE of the ruins (transformer child)"],
    rag: [373.5, 250.5, "on its road marker: marker west of the ruins, over the watermill bridge (transformer child)"],
    text_diffusion: [466, 313.5, "on its road marker: south desert marker facing the volcano — transformer + diffusion"],
    pixelcnn: [420, 350, "the crater peak, lava running down in rasters"],
    diffusion: [348, 400, "the factory stack where the rail ends — noise in, samples out"],
    tabular_diffusion: [379, 398, "on its road marker: the lava-junction marker next to the factory (diffusion + tabular)"],
    vae: [370, 445, "the little lighthouse chapel on the south flank"],
    gan: [440, 418, "the lava castle"],
    gnn: [599.5, 94.5, "on its road marker: the city deck's west marker"],
    nerf: [680, 93, "the city deck's east marker"],
    alphazero: [630, 225, "the red church on the isle"],
    rlhf: [693, 270, "the blue-domed observatory (transformer + reinforce)"],
    grpo: [666, 280, "on its road marker: marker below the observatory (rlhf child)"],
    dpo: [586, 250.5, "on its road marker: marker at the long bridge's isle end (rlhf child)"],
    reinforce: [618, 330, "the drowned domed temple"],
    rl_maze: [655, 392, "the drowned maze palace — on its dome (the halved clean2 point sat on the dome's rim)"],
  },
  junctions: {
    "j:grove": [204, 122.5], // marker
    "j:snowBridge": [333, 95],
    "j:snowW": [346, 88], // marker
    "j:snowHouse": [465, 118],
    "j:snowSE": [492, 144.5], // marker
    "j:westBridge": [183, 239],
    "j:sw": [169, 353], // marker
    "j:station": [265, 363],
    "j:rail": [260, 406], // marker
    "j:seqE": [506, 270], // marker
    "j:lagoon": [604, 371],
    "j:volE": [484, 422.5], // marker
  },
  roads: [
    { a: "simclr", b: "j:grove", via: [[220, 113]] },
    { a: "simclr", b: "vision_embed", via: [[260, 108]] },
    { a: "vision_embed", b: "j:snowBridge", via: [[310, 100]], kind: "bridge" },
    { a: "j:snowBridge", b: "j:snowW" },
    { a: "j:snowW", b: "dino", via: [[368, 75]] },
    { a: "j:snowW", b: "clip", via: [[380, 100], [420, 100]] },
    { a: "clip", b: "j:snowHouse" },
    { a: "j:snowHouse", b: "j:snowSE" },
    { a: "j:snowSE", b: "deepseek", via: [[515, 160]] },
    { a: "j:snowSE", b: "mamba", via: [[500, 170]] },
    { a: "j:grove", b: "convnext", via: [[195, 143]] },
    { a: "convnext", b: "lora", via: [[165, 175]] },
    { a: "lora", b: "mobilenet", via: [[135, 203]] },
    { a: "convnext", b: "resnet", via: [[200, 190], [220, 210]] },
    { a: "mobilenet", b: "j:westBridge", via: [[155, 230]], kind: "bridge" },
    { a: "j:westBridge", b: "resnet", via: [[210, 235]] },
    { a: "resnet", b: "classifier", via: [[255, 223]] },
    { a: "classifier", b: "vit", via: [[303, 235]] },
    { a: "classifier", b: "text_token_classifier", via: [[300, 210], [308, 206]], kind: "bridge" },
    { a: "resnet", b: "segmentation", via: [[220, 260]] },
    { a: "resnet", b: "detection", via: [[258, 260]] },
    { a: "classifier", b: "detection", via: [[280, 250]] },
    { a: "segmentation", b: "sam", via: [[208, 300]] },
    { a: "sam", b: "unet_ae" },
    { a: "sam", b: "rpp_classifier", via: [[175, 318]] },
    { a: "rpp_classifier", b: "j:sw" },
    { a: "j:sw", b: "tabular_classifier", via: [[150, 361]] },
    { a: "j:sw", b: "audio_melspectrogram", via: [[200, 358]] },
    { a: "audio_melspectrogram", b: "j:station" },
    { a: "j:station", b: "j:rail", via: [[263, 385]] },
    { a: "j:station", b: "audio_classifier", via: [[283, 345]] },
    { a: "detection", b: "audio_classifier", via: [[290, 310]] },
    { a: "audio_classifier", b: "audio_spectrogram", via: [[313, 346]] },
    { a: "vision_embed", b: "text_seq2seq", via: [[295, 130], [306, 153]], kind: "bridge" },
    { a: "text_seq2seq", b: "transformer", via: [[345, 169]] },
    { a: "text_seq2seq", b: "text_token_classifier" },
    { a: "text_token_classifier", b: "transformer", via: [[350, 190]] },
    { a: "vit", b: "rag", via: [[345, 244]], kind: "bridge" },
    { a: "text_token_classifier", b: "rag", via: [[345, 220], [360, 240]] },
    { a: "transformer", b: "moe", via: [[395, 198]] },
    { a: "moe", b: "audio_transformer", via: [[440, 203]] },
    { a: "audio_transformer", b: "mamba" },
    { a: "mamba", b: "kimi", via: [[523, 205]] },
    { a: "kimi", b: "deepseek", via: [[545, 190]] },
    { a: "rag", b: "rnn", via: [[400, 253]] },
    { a: "moe", b: "rnn", via: [[420, 215]] },
    { a: "rnn", b: "grokking", via: [[455, 265]] },
    { a: "grokking", b: "j:seqE" },
    { a: "kimi", b: "j:seqE", via: [[523, 240]] },
    { a: "rag", b: "text_diffusion", via: [[420, 303]] },
    { a: "grokking", b: "text_diffusion", via: [[473, 300]] },
    { a: "audio_spectrogram", b: "diffusion", via: [[340, 385]] },
    { a: "j:rail", b: "diffusion", via: [[300, 393], [325, 398]] },
    { a: "diffusion", b: "tabular_diffusion" },
    { a: "tabular_diffusion", b: "pixelcnn", via: [[400, 370]] },
    { a: "tabular_diffusion", b: "vae", via: [[378, 425]] },
    { a: "tabular_diffusion", b: "gan", via: [[410, 408]] },
    { a: "pixelcnn", b: "text_diffusion", via: [[440, 328]], kind: "bridge" },
    { a: "gan", b: "j:volE", via: [[463, 423]] },
    { a: "kimi", b: "dpo", via: [[555, 225], [575, 240]], kind: "bridge" },
    { a: "j:seqE", b: "dpo", via: [[543, 263], [565, 255]], kind: "bridge" },
    { a: "dpo", b: "alphazero", via: [[608, 235]] },
    { a: "dpo", b: "grpo", via: [[625, 265]] },
    { a: "alphazero", b: "grpo", via: [[650, 250]] },
    { a: "grpo", b: "rlhf" },
    { a: "grpo", b: "reinforce", via: [[645, 305]] },
    { a: "reinforce", b: "j:lagoon", via: [[608, 350]] },
    { a: "j:lagoon", b: "rl_maze", via: [[630, 385]] },
    { a: "text_diffusion", b: "reinforce", via: [[505, 320], [530, 335], [555, 350]], kind: "bridge" },
    { a: "gnn", b: "nerf", via: [[640, 105]] },
    { a: "deepseek", b: "gnn", via: [[575, 130]], kind: "air" },
  ],
  lands: {
    representation: [[190, 30], [280, 25], [320, 60], [350, 30], [430, 10], [500, 60], [520, 110], [505, 150], [480, 155], [450, 140], [410, 150], [350, 130], [330, 108], [300, 113], [295, 125], [260, 118], [220, 133], [190, 115]],
    perception: [[65, 190], [100, 165], [150, 140], [190, 120], [220, 135], [260, 120], [295, 128], [305, 150], [313, 210], [320, 225], [340, 250], [345, 280], [320, 320], [345, 360], [335, 380], [300, 380], [280, 420], [225, 430], [150, 430], [100, 410], [70, 360], [90, 310], [100, 260], [60, 225]],
    sequence: [[307, 150], [330, 115], [360, 135], [410, 150], [450, 143], [480, 155], [505, 150], [550, 160], [555, 220], [530, 280], [515, 320], [465, 330], [425, 325], [380, 310], [350, 280], [340, 250], [320, 225], [313, 210]],
    generative: [[300, 385], [325, 370], [350, 350], [390, 325], [430, 325], [480, 360], [525, 430], [490, 480], [400, 495], [310, 480], [290, 440]],
    // the city's silhouette (towers, deck, hanging blocks) — a rectangle took in the clouds and the desert rocks below
    structure: [[530, 72], [562, 28], [596, 6], [690, 6], [716, 34], [744, 66], [746, 108], [718, 124], [704, 176], [680, 182], [642, 168], [600, 162], [568, 142], [530, 112]],
    decision: [[560, 210], [650, 180], [725, 210], [740, 300], [750, 400], [710, 470], [550, 460], [500, 390], [525, 330], [555, 280], [570, 240]],
  },
  signs: {
    perception: [100, 250],
    representation: [488, 20],
    sequence: [565, 295],
    generative: [400, 493],
    structure: [715, 128],
    decision: [710, 325],
  },

  cartouche: { x: 12, y: 12, w: 146, h: 70 },
  pipelines: { x: 720, y: 495 },
  baked: [],
  // the volcano's three chimney tops (smoke + embers) and the two lighthouse lamps (beams)
  landmarks: {
    vents: [[426, 317], [411, 330], [403, 338]], lamps: [[369, 438], [41, 126]],
    falls: [{ x: 337, y: 246, w: 21, h: 50 }, { x: 198, y: 255, w: 20, h: 30 }, { x: 528, y: 232, w: 24, h: 56 }],
  },
};

// ————————————————————————————————————————————————————————————— pixel v1 (render=baked only)
// The FIRST label-free pass (pixel-map-clean.png, now retired as a background)
// shares its composition with the labelled pixel-map.png. Its roads/lands are
// kept only so warpToBaked() can move them onto the labelled image.
// Lands (read off pixel-map-clean.png): perception = the west green lobe
// (windmill, Classification town, Segmentation town, docks) + the SW desert
// with the rail town; representation = the snow plateau + the treehouse grove
// the painter labelled "SimCLR"; sequence = the blue Transformer castle, the
// central ruins and the NE desert (watchtower, Mamba house, windmill);
// generative = the volcano; structure = the floating neon city (an island in
// the sky, reached by an "air" link); decision = the AlphaZero isle, the
// observatory and the drowned temples.
const PIXEL_V1: PaintedMap = {
  id: "pixel",
  width: 1536,
  height: 1024,
  anchors: {
    // perception — atoms on their towns
    classifier: [528, 448, "Classification town (red-roofed castle, baked label 'Classification')"],
    segmentation: [462, 596, "Segmentation town (red houses above the docks, baked label 'Segmentation')"],
    tabular_classifier: [330, 772, "the rail-desert town (baked label 'Tabular Classifier')"],
    // perception — derived, on markers/towns radiating from Classification
    resnet: [455, 467, "marker west of Classification — resnet is classifier's first child"],
    convnext: [362, 342, "marker by the windmill road — convnext = classifier + resnet, one hop past resnet"],
    mobilenet: [542, 290, "marker in the forest north of Classification (classifier child)"],
    vit: [630, 358, "marker by the bridge towards the Transformer castle — vit = transformer + classifier"],
    lora: [270, 392, "the windmill — lora (classifier child) on the west lobe"],
    detection: [522, 576, "marker south of Classification (classifier child)"],
    unet_ae: [377, 600, "dock marker beside Segmentation (segmentation child)"],
    sam: [372, 647, "lower dock marker (segmentation + transformer)"],
    rpp_classifier: [332, 691, "desert marker above the rail town — rpp = classifier + tabular"],
    audio_classifier: [612, 690, "rail marker SE of Classification (classifier child)"],
    audio_spectrogram: [641, 728, "next rail marker — audio_classifier → audio_spectrogram"],
    audio_melspectrogram: [490, 728, "the water tower on the rail — third stop of the audio line"],
    // representation
    simclr: [468, 230, "the treehouse (baked label 'SimCLR' sits under it)"],
    vision_embed: [585, 215, "grove marker by the treehouse (simclr's plainest child)"],
    clip: [857, 226, "snow marker by the ice crystal — clip = simclr + transformer, nearest the castle road down"],
    dino: [770, 150, "the snow castle — the plateau's summit (vit + simclr)"],
    // sequence
    transformer: [705, 338, "the blue Transformer castle (baked label 'Transformer')"],
    rnn: [855, 478, "the ancient ruins at the heart of the land (oldest sequence atom; baked 'Sequence')"],
    mamba: [990, 372, "desert house (baked label 'Mamba')"],
    text_seq2seq: [796, 380, "the little red shrine just east of the castle (transformer child)"],
    text_token_classifier: [716, 484, "marker below the castle, west of the ruins (transformer child)"],
    moe: [856, 366, "desert marker between castle and Mamba"],
    audio_transformer: [935, 350, "desert watchtower (transformer + audio_spectrogram)"],
    kimi: [1070, 381, "east desert marker past Mamba — kimi = transformer + moe + mamba"],
    deepseek: [1060, 305, "the east windmill (transformer + moe)"],
    grokking: [980, 535, "marker east of the ruins (transformer child)"],
    rag: [790, 590, "south slope below the ruins, on the road to the volcano"],
    text_diffusion: [925, 616, "south marker facing the volcano — transformer + diffusion"],
    // generative — the volcano
    pixelcnn: [840, 705, "the glowing crater hall (baked label 'PixelCNN')"],
    diffusion: [645, 835, "the stone temple on the west flank (baked label 'Diffusion')"],
    vae: [722, 892, "the small lava chapel (baked label 'VAE')"],
    gan: [890, 842, "the volcano castle (baked label 'GAN')"],
    tabular_diffusion: [712, 745, "the dark tower where the rail meets the volcano — diffusion + tabular"],
    // structure — the floating city
    gnn: [1353, 165, "the city's upper marker (baked label 'GNN' on this island)"],
    nerf: [1358, 288, "the city's lower marker (baked label 'NERF')"],
    // decision
    alphazero: [1250, 445, "the red church (baked label 'AlphaZero')"],
    reinforce: [1212, 622, "the drowned temple (baked label 'Reinforce')"],
    rl_maze: [1345, 790, "the drowned maze-palace (baked label 'RL Maze')"],
    rlhf: [1368, 482, "the observatory (baked 'Decision') — rlhf = transformer + reinforce"],
    grpo: [1293, 539, "marker below the church (rlhf child)"],
    dpo: [1156, 490, "island marker at the bridgehead (rlhf child)"],
  },
  junctions: {
    "j:grove": [412, 257],       // unused painted marker west of the treehouse
    "j:bridgeN": [640, 200],     // river bridge grove → snow
    "j:snowW": [686, 182],       // painted marker on the snow edge
    "j:snowC": [729, 165],       // painted marker under the castle
    "j:hut": [824, 262],         // snow hut above the cliff road
    "j:cliff": [848, 300],       // cliff road down to the desert
    "j:ford": [592, 322],        // bridge over the river, forest → castle
    "j:road398": [640, 398],     // long east–west road south of the castle
    "j:fields": [470, 520],
    "j:docks": [420, 610],
    "j:rail1": [440, 750],
    "j:bridgeAZ": [1110, 440],   // desert → AlphaZero bridge
    "j:bridgeLong": [1030, 540], // long plank bridge ruins → AlphaZero isle
    "j:seaBridge": [1060, 655],  // south bridge into the lagoon
    "j:lagoon": [1150, 700],
    "j:m27": [1215, 745],        // painted marker in the lagoon
    "j:volW": [604, 856],        // painted marker on the volcano's west landing
    "j:sky": [1200, 300],        // air link waypoint under the floating city
  },
  roads: [
    // representation grove + snow
    { a: "simclr", b: "j:grove", via: [[440, 245]] },
    { a: "j:grove", b: "convnext", via: [[392, 290]] },
    { a: "j:grove", b: "mobilenet", via: [[450, 282], [500, 297]] },
    { a: "mobilenet", b: "vision_embed", via: [[562, 258]] },
    { a: "vision_embed", b: "simclr", via: [[530, 222]] },
    { a: "vision_embed", b: "j:bridgeN", via: [[610, 205]], kind: "bridge" },
    { a: "j:bridgeN", b: "j:snowW" },
    { a: "j:snowW", b: "j:snowC" },
    { a: "j:snowC", b: "dino" },
    { a: "j:snowW", b: "j:hut", via: [[730, 200], [780, 215]] },
    { a: "j:hut", b: "clip" },
    { a: "j:hut", b: "j:cliff" },
    { a: "j:cliff", b: "moe", via: [[852, 335]] },
    // perception
    { a: "mobilenet", b: "j:ford", via: [[570, 305]], kind: "bridge" },
    { a: "j:ford", b: "vit" },
    { a: "convnext", b: "lora", via: [[320, 370]] },
    { a: "convnext", b: "resnet", via: [[395, 400], [430, 440]] },
    { a: "resnet", b: "classifier", via: [[490, 455]] },
    { a: "classifier", b: "j:road398", via: [[570, 410], [600, 400]] },
    { a: "vit", b: "j:road398" },
    { a: "resnet", b: "j:fields" },
    { a: "j:fields", b: "detection" },
    { a: "j:fields", b: "segmentation" },
    { a: "segmentation", b: "j:docks" },
    { a: "j:docks", b: "unet_ae" },
    { a: "unet_ae", b: "sam" },
    { a: "sam", b: "rpp_classifier" },
    { a: "rpp_classifier", b: "tabular_classifier", via: [[330, 730]] },
    { a: "tabular_classifier", b: "j:rail1", via: [[390, 765]] },
    { a: "j:rail1", b: "audio_melspectrogram" },
    { a: "audio_melspectrogram", b: "audio_classifier", via: [[550, 705]] },
    { a: "detection", b: "audio_classifier", via: [[560, 630], [595, 665]] },
    { a: "audio_classifier", b: "audio_spectrogram" },
    // sequence
    { a: "j:road398", b: "transformer", via: [[690, 395], [700, 370]] },
    { a: "transformer", b: "text_seq2seq", via: [[750, 370]] },
    { a: "text_seq2seq", b: "moe" },
    { a: "moe", b: "audio_transformer", via: [[895, 372]] },
    { a: "audio_transformer", b: "mamba" },
    { a: "mamba", b: "kimi", via: [[1030, 380]] },
    { a: "kimi", b: "deepseek" },
    { a: "j:road398", b: "text_token_classifier", via: [[700, 420], [712, 455]] },
    { a: "text_token_classifier", b: "rnn", via: [[770, 470]] },
    { a: "rnn", b: "grokking", via: [[930, 500]] },
    { a: "moe", b: "rnn", via: [[870, 420]] },
    { a: "text_token_classifier", b: "rag", via: [[740, 540]] },
    { a: "rag", b: "text_diffusion", via: [[860, 605]] },
    { a: "grokking", b: "text_diffusion", via: [[955, 580]] },
    { a: "grokking", b: "j:bridgeLong" },
    { a: "text_diffusion", b: "j:seaBridge", via: [[990, 640]], kind: "bridge" },
    // volcano
    { a: "audio_spectrogram", b: "tabular_diffusion" },
    { a: "tabular_diffusion", b: "pixelcnn", via: [[775, 715]] },
    { a: "audio_spectrogram", b: "j:volW", via: [[620, 790]] },
    { a: "j:volW", b: "diffusion" },
    { a: "diffusion", b: "vae", via: [[690, 870]] },
    { a: "vae", b: "gan", via: [[800, 880]] },
    { a: "pixelcnn", b: "gan", via: [[870, 780]] },
    // decision
    { a: "kimi", b: "j:bridgeAZ", via: [[1090, 410]], kind: "bridge" },
    { a: "j:bridgeAZ", b: "dpo" },
    { a: "j:bridgeLong", b: "dpo", via: [[1090, 520]], kind: "bridge" },
    { a: "dpo", b: "alphazero", via: [[1200, 465]] },
    { a: "dpo", b: "grpo", via: [[1225, 510]] },
    { a: "alphazero", b: "grpo", via: [[1275, 490]] },
    { a: "grpo", b: "rlhf", via: [[1330, 520]] },
    { a: "j:seaBridge", b: "j:lagoon", via: [[1100, 690]] },
    { a: "j:lagoon", b: "reinforce", via: [[1180, 660]] },
    { a: "j:lagoon", b: "j:m27", via: [[1180, 725]] },
    { a: "j:m27", b: "rl_maze", via: [[1265, 790]] },
    { a: "reinforce", b: "j:m27", via: [[1225, 690]] },
    // structure — the floating city, reached through the air from the east windmill
    { a: "gnn", b: "nerf", via: [[1340, 230]] },
    { a: "deepseek", b: "j:sky", via: [[1120, 290]], kind: "air" },
    { a: "j:sky", b: "nerf", via: [[1280, 300]], kind: "air" },
  ],
  lands: {
    representation: [[395, 60], [560, 40], [640, 110], [700, 100], [760, 40], [900, 60], [1040, 190], [1040, 250], [900, 300], [800, 300], [700, 260], [650, 235], [600, 262], [520, 272], [430, 272], [395, 200]],
    perception: [[100, 330], [230, 280], [330, 250], [400, 274], [520, 276], [600, 264], [662, 300], [655, 400], [690, 450], [690, 520], [640, 560], [600, 650], [700, 700], [640, 800], [560, 860], [400, 880], [200, 860], [170, 740], [230, 650], [260, 560], [120, 480]],
    sequence: [[662, 300], [700, 262], [800, 302], [900, 302], [1040, 262], [1120, 300], [1180, 380], [1130, 460], [1050, 560], [1060, 640], [900, 660], [800, 640], [740, 600], [690, 540], [690, 450], [655, 400]],
    generative: [[560, 860], [640, 800], [700, 700], [780, 640], [860, 620], [950, 700], [1040, 850], [1080, 900], [950, 1000], [700, 1000], [540, 940]],
    structure: [[1070, 60], [1440, 60], [1450, 200], [1400, 360], [1200, 360], [1130, 220], [1070, 160]],
    decision: [[1130, 380], [1300, 370], [1450, 400], [1510, 560], [1480, 640], [1500, 800], [1420, 930], [1100, 920], [1000, 800], [1060, 660], [1120, 560], [1140, 470]],
  },
  // Signs + cartouche sit inside the 1× overview crop (a 1440×900 viewport
  // shows image x 48–1488, y 62–962), over sky/sea or cliff, never on a town.
  signs: {
    perception: [205, 470],
    representation: [960, 84],
    sequence: [1060, 470],
    generative: [820, 944],
    structure: [1165, 345],
    decision: [1395, 622],
  },
  cartouche: { x: 60, y: 72, w: 292, h: 140 },
  pipelines: { x: 1372, y: 946 },
  baked: [],
};

// Where each anchor sits on the LABELLED pixel-map.png (render=baked) — mapped
// on that image separately because it is a different generation.
export const BAKED_PIXEL: Record<string, readonly [number, number]> = {
  classifier: [552, 438], segmentation: [470, 575], tabular_classifier: [330, 765],
  resnet: [465, 457], convnext: [376, 354], mobilenet: [575, 295], vit: [637, 340],
  lora: [300, 385], detection: [565, 577], unet_ae: [393, 597], sam: [352, 555],
  rpp_classifier: [342, 696], audio_classifier: [615, 691], audio_spectrogram: [643, 745],
  audio_melspectrogram: [505, 732],
  simclr: [505, 210], vision_embed: [590, 205], clip: [972, 220], dino: [772, 122],
  transformer: [742, 352], rnn: [862, 495], mamba: [995, 365], text_seq2seq: [800, 370],
  text_token_classifier: [646, 405], moe: [856, 374], audio_transformer: [935, 355],
  kimi: [1080, 400], deepseek: [1050, 305], grokking: [982, 527], rag: [800, 600],
  text_diffusion: [907, 616],
  pixelcnn: [850, 705], diffusion: [660, 830], vae: [745, 885], gan: [898, 845],
  tabular_diffusion: [712, 740],
  gnn: [1190, 125], nerf: [1363, 269],
  alphazero: [1262, 440], reinforce: [1215, 640], rl_maze: [1348, 785], rlhf: [1368, 515],
  grpo: [1297, 558], dpo: [1162, 497],
};

// ————————————————————————————————————————————————————————————— paper
// Lands are the painter's six labelled lands: Perception (NW forest),
// Representation (snow massif, top centre), Sequence & State (autumn
// heartland), Structured Intelligence (NE sky-islands), Decision & Agents (SW
// desert), Generative World (lava + neon city + drowned ruins, SE).
// The painter invented names we don't have and put three real models in the
// wrong land (VAE in the snow, PixelCNN in the forest, NeRF in the drowned
// ruins). Family membership wins: vae/pixelcnn go to the Generative World,
// nerf to the structure islands, tabular_classifier to Perception; the wrong
// plates are healed away under labels=ours.
const PAPER: PaintedMap = {
  id: "paper",
  width: 1536,
  height: 1024,
  anchors: {
    // perception
    classifier: [385, 398, "the Classification castle (baked 'Classification')"],
    resnet: [318, 300, "the ResNet hall (baked 'ResNet')"],
    vit: [443, 295, "the ViT tower (baked 'ViT')"],
    segmentation: [175, 405, "the Segmentation house (baked 'Segmentation')"],
    mobilenet: [140, 300, "the domed observatory the painter called 'CNN' — the efficient-CNN child"],
    tabular_classifier: [140, 512, "the pink house (baked 'PixelCNN', wrong land for pixelcnn) — perception atom needs a landmark here"],
    convnext: [222, 321, "road marker between CNN and ResNet — convnext = classifier + resnet"],
    lora: [380, 313, "road marker between ResNet and ViT (classifier child)"],
    detection: [473, 409, "marker east of the castle, at the bridge (classifier child)"],
    unet_ae: [220, 499, "marker south of Segmentation (segmentation child)"],
    sam: [253, 537, "marker at the south bridgehead (segmentation + transformer)"],
    rpp_classifier: [62, 452, "west forest clearing near the pink house (classifier + tabular)"],
    audio_classifier: [310, 470, "lakeshore south of the castle (classifier child)"],
    audio_spectrogram: [352, 522, "forest above the waterfall cliffs (audio line, 2nd)"],
    audio_melspectrogram: [100, 375, "road marker west of the observatory (audio line, 3rd)"],
    // representation
    simclr: [874, 158, "the blue ice tower beside the crystal, right of the baked 'SimCLR' plate"],
    vision_embed: [935, 228, "the glass dome (baked 'Embeddings')"],
    clip: [858, 262, "the chalet (baked 'Contrastive Learning' — CLIP is contrastive)"],
    dino: [740, 215, "the great snow castle (baked 'VAE', which belongs to the Generative World)"],
    // sequence
    transformer: [815, 520, "the red-spired castle (baked 'Transformer')"],
    rnn: [572, 512, "the watermill (baked 'RNN')"],
    mamba: [985, 490, "the blue house with the wheel (baked 'Mamba')"],
    text_seq2seq: [812, 630, "the gate tower (baked 'Seq2Seq')"],
    grokking: [672, 462, "the clock tower (baked 'LSTM') — grokking is about waiting"],
    audio_transformer: [597, 462, "road marker at the bridge from Perception (transformer + audio_spectrogram)"],
    text_token_classifier: [747, 482, "road marker west of the castle (transformer child)"],
    moe: [927, 508, "road marker between castle and Mamba"],
    kimi: [1090, 504, "road marker east of Mamba — transformer + moe + mamba"],
    deepseek: [952, 602, "the violet cottage (transformer + moe)"],
    rag: [738, 600, "road marker SW of the castle (transformer child)"],
    text_diffusion: [666, 581, "road marker by the waterfall, south road (transformer + diffusion)"],
    // generative
    gan: [840, 850, "the lava fortress (baked 'GAN')"],
    diffusion: [1025, 790, "the neon tower (baked 'Diffusion')"],
    tabular_diffusion: [950, 830, "the violet neon block between GAN and Diffusion (diffusion + tabular)"],
    pixelcnn: [1150, 735, "the neon city (baked 'Generative Transformers' — autoregressive, like pixelcnn)"],
    vae: [1290, 842, "the drowned pillars (baked 'Normalizing Flows' — latent-variable cousins)"],
    // structure
    gnn: [1200, 182, "the GNN castle (baked 'GNN')"],
    nerf: [1415, 292, "the lookout tower (baked 'Graph Attention') — NeRF belongs to Structure"],
    // decision
    reinforce: [150, 690, "the windmill (baked 'Reinforcement Learning')"],
    rlhf: [290, 752, "the saloon (baked 'DQN') — rlhf = transformer + reinforce"],
    dpo: [372, 747, "road marker between saloon and Actor-Critic (rlhf child)"],
    grpo: [440, 742, "the Actor-Critic house (rlhf child)"],
    alphazero: [560, 715, "the chessboard (baked 'AlphaZero')"],
    rl_maze: [430, 862, "the hedge maze (baked 'RL Maze')"],
  },
  junctions: {
    "j:obsE": [220, 360],
    "j:bridgeRep": [545, 258],    // plank bridge perception → snow
    "j:snow1": [580, 248],
    "j:snow2": [624, 205],
    "j:snow3": [698, 153],        // painted marker by the Autoencoder house
    "j:snow4": [836, 229],
    "j:snow5": [907, 192],
    "j:snowBridge": [922, 342],   // bridge down to the heartland
    "j:bridgeSeq": [520, 425],    // arched bridge perception → sequence
    "j:bridgeDec": [272, 575],    // south bridge perception → desert
    "j:dec1": [287, 690],
    "j:dec2": [208, 737],
    "j:dec3": [443, 705],
    "j:dec4": [532, 775],
    "j:bridgeGen": [700, 880],    // long viaduct desert → lava
    "j:seqBridgeS": [880, 700],   // plank bridge heartland → lava
    "j:repBridgeE": [1080, 250],  // bridge snow → GNN island
    "j:str1": [1136, 277],
    "j:str2": [1170, 340],
    "j:str3": [1275, 200],
    "j:str4": [1308, 220],
    "j:str5": [1380, 200],
    "j:str6": [1327, 285],
    "j:str7": [1265, 430],        // Neural Logic temple island
    "j:str8": [1326, 440],
    "j:neonBridge": [1230, 810],  // neon viaduct → drowned ruins
  },
  roads: [
    // perception
    { a: "mobilenet", b: "j:obsE", via: [[180, 330]] },
    { a: "j:obsE", b: "convnext" },
    { a: "convnext", b: "resnet", via: [[270, 330]] },
    { a: "resnet", b: "lora", via: [[350, 322]] },
    { a: "lora", b: "vit" },
    { a: "lora", b: "classifier", via: [[385, 350]] },
    { a: "vit", b: "detection", via: [[465, 350]] },
    { a: "classifier", b: "detection", via: [[430, 410]] },
    { a: "mobilenet", b: "audio_melspectrogram", via: [[115, 340]] },
    { a: "audio_melspectrogram", b: "segmentation", via: [[130, 400]] },
    { a: "audio_melspectrogram", b: "rpp_classifier", via: [[75, 415]] },
    { a: "rpp_classifier", b: "tabular_classifier", via: [[95, 490]] },
    { a: "segmentation", b: "unet_ae", via: [[200, 460]] },
    { a: "tabular_classifier", b: "unet_ae", via: [[180, 505]] },
    { a: "unet_ae", b: "sam" },
    { a: "segmentation", b: "audio_classifier", via: [[250, 445], [290, 460]] },
    { a: "classifier", b: "audio_classifier", via: [[345, 445]] },
    { a: "audio_classifier", b: "audio_spectrogram" },
    { a: "sam", b: "j:bridgeDec", kind: "bridge" },
    { a: "detection", b: "j:bridgeSeq", kind: "bridge" },
    { a: "vit", b: "j:bridgeRep", via: [[500, 270]], kind: "bridge" },
    // representation
    { a: "j:bridgeRep", b: "j:snow1" },
    { a: "j:snow1", b: "j:snow2" },
    { a: "j:snow2", b: "j:snow3", via: [[660, 175]] },
    { a: "j:snow3", b: "dino", via: [[720, 180]] },
    { a: "dino", b: "j:snow4", via: [[790, 235]] },
    { a: "j:snow4", b: "simclr" },
    { a: "simclr", b: "j:snow5" },
    { a: "j:snow5", b: "vision_embed" },
    { a: "j:snow4", b: "clip" },
    { a: "clip", b: "vision_embed" },
    { a: "clip", b: "j:snowBridge", via: [[900, 300]], kind: "bridge" },
    { a: "vision_embed", b: "j:repBridgeE", via: [[1000, 262]], kind: "bridge" },
    // sequence
    { a: "j:bridgeSeq", b: "audio_transformer", via: [[560, 440]] },
    { a: "audio_transformer", b: "rnn" },
    { a: "audio_transformer", b: "grokking", via: [[635, 470]] },
    { a: "grokking", b: "text_token_classifier", via: [[710, 478]] },
    { a: "text_token_classifier", b: "transformer", via: [[780, 495]] },
    { a: "transformer", b: "moe", via: [[870, 515]] },
    { a: "moe", b: "mamba" },
    { a: "mamba", b: "kimi", via: [[1040, 500]] },
    { a: "j:snowBridge", b: "moe", via: [[925, 420]] },
    { a: "moe", b: "deepseek" },
    { a: "rnn", b: "text_diffusion", via: [[610, 560]] },
    { a: "text_diffusion", b: "rag" },
    { a: "rag", b: "transformer", via: [[775, 570]] },
    { a: "rag", b: "text_seq2seq", via: [[775, 620]] },
    { a: "text_seq2seq", b: "deepseek", via: [[880, 625]] },
    { a: "text_seq2seq", b: "j:seqBridgeS", via: [[850, 665]], kind: "bridge" },
    // decision
    { a: "j:bridgeDec", b: "j:dec1", via: [[285, 630]] },
    { a: "j:dec1", b: "reinforce", via: [[220, 680]] },
    { a: "reinforce", b: "j:dec2", via: [[175, 720]] },
    { a: "j:dec2", b: "rlhf", via: [[250, 745]] },
    { a: "j:dec1", b: "rlhf", via: [[300, 720]] },
    { a: "rlhf", b: "dpo" },
    { a: "dpo", b: "grpo" },
    { a: "grpo", b: "j:dec3" },
    { a: "j:dec1", b: "j:dec3", via: [[360, 690]] },
    { a: "j:dec3", b: "alphazero", via: [[500, 705]] },
    { a: "grpo", b: "j:dec4", via: [[490, 770]] },
    { a: "j:dec4", b: "alphazero" },
    { a: "grpo", b: "rl_maze", via: [[440, 810]] },
    { a: "j:dec4", b: "j:bridgeGen", via: [[600, 820]], kind: "bridge" },
    // generative
    { a: "j:bridgeGen", b: "gan", via: [[770, 870]] },
    { a: "j:seqBridgeS", b: "gan", via: [[870, 760]] },
    { a: "gan", b: "tabular_diffusion", via: [[900, 845]] },
    { a: "tabular_diffusion", b: "diffusion" },
    { a: "diffusion", b: "pixelcnn", via: [[1090, 785]] },
    { a: "pixelcnn", b: "j:neonBridge", via: [[1190, 800]], kind: "bridge" },
    { a: "j:neonBridge", b: "vae" },
    // structure
    { a: "j:repBridgeE", b: "j:str1", kind: "bridge" },
    { a: "j:str1", b: "gnn", via: [[1160, 230]] },
    { a: "gnn", b: "j:str3", via: [[1240, 195]] },
    { a: "j:str3", b: "j:str4" },
    { a: "j:str4", b: "j:str5", via: [[1345, 205]] },
    { a: "j:str5", b: "nerf", via: [[1405, 240]] },
    { a: "j:str4", b: "j:str6" },
    { a: "j:str6", b: "nerf", via: [[1370, 290]], kind: "bridge" },
    { a: "j:str1", b: "j:str2" },
    { a: "j:str2", b: "j:str7", via: [[1220, 380]], kind: "bridge" },
    { a: "j:str7", b: "j:str8" },
    { a: "j:str8", b: "nerf", via: [[1380, 380]] },
    { a: "kimi", b: "j:str7", via: [[1150, 470]], kind: "bridge" },
  ],
  lands: {
    perception: [[20, 300], [100, 200], [250, 170], [420, 180], [540, 240], [562, 300], [540, 420], [470, 480], [430, 545], [300, 585], [150, 592], [30, 545]],
    representation: [[470, 120], [560, 40], [700, 20], [900, 40], [1040, 120], [1062, 260], [980, 320], [900, 345], [750, 322], [600, 300], [520, 272]],
    sequence: [[480, 420], [560, 380], [700, 340], [900, 350], [1050, 380], [1130, 450], [1130, 560], [1050, 612], [950, 652], [900, 700], [760, 690], [650, 640], [560, 600], [500, 540]],
    structure: [[1100, 160], [1250, 140], [1500, 150], [1530, 300], [1500, 520], [1350, 562], [1200, 532], [1170, 420], [1120, 300]],
    decision: [[20, 640], [200, 560], [300, 580], [500, 620], [620, 680], [700, 760], [680, 880], [550, 952], [300, 962], [100, 900], [20, 800]],
    generative: [[720, 760], [820, 700], [1000, 700], [1100, 690], [1300, 700], [1530, 720], [1530, 1000], [1000, 1010], [760, 1000], [720, 900]],
  },
  signs: {
    perception: [260, 222],
    representation: [816, 46],
    sequence: [850, 394],
    generative: [1226, 662],
    structure: [1331, 96],
    decision: [382, 618],
  },
  cartouche: { x: 26, y: 20, w: 310, h: 118 },
  pipelines: { x: 192, y: 999 },
  baked: [
    // family plates: the painter's names are right, so they stay; we pin a
    // wax seal with the live model count to each
    { kind: "family", text: "Perception", box: { x: 150, y: 195, w: 222, h: 54 } },
    { kind: "family", text: "Representation", box: { x: 690, y: 20, w: 254, h: 52 } },
    { kind: "family", text: "Structured Intelligence", box: { x: 1195, y: 72, w: 274, h: 48 } },
    { kind: "family", text: "Sequence & State", box: { x: 695, y: 370, w: 312, h: 50 } },
    { kind: "family", text: "Decision & Agents", box: { x: 250, y: 590, w: 265, h: 56 } },
    { kind: "family", text: "Generative World", box: { x: 1090, y: 637, w: 275, h: 52 } },
    // model plates — real, wrong-land and invented names alike: under
    // labels=ours each is covered by our plate naming the model anchored at
    // that landmark (`name`), or "no model yet" where the painter invented one
    { kind: "model", text: "CNN", name: "mobilenet", box: { x: 120, y: 334, w: 58, h: 28 } },
    { kind: "model", text: "ResNet", name: "resnet", box: { x: 279, y: 334, w: 53, h: 28 } },
    { kind: "model", text: "ViT", name: "vit", box: { x: 442, y: 334, w: 57, h: 28 } },
    { kind: "model", text: "Segmentation", name: "segmentation", box: { x: 149, y: 439, w: 96, h: 28 } },
    { kind: "model", text: "Classification", name: "classifier", box: { x: 337, y: 427, w: 97, h: 29 } },
    { kind: "invented", text: "PixelCNN (wrong land)", name: "tabular_classifier", box: { x: 109, y: 527, w: 78, h: 31 } },
    { kind: "invented", text: "Autoencoder", box: { x: 586, y: 142, w: 96, h: 31 } },
    { kind: "model", text: "SimCLR", name: "simclr", box: { x: 790, y: 168, w: 64, h: 27 } },
    { kind: "invented", text: "VAE (wrong land)", name: "dino", box: { x: 720, y: 253, w: 57, h: 28 } },
    { kind: "invented", text: "Contrastive Learning", name: "clip", box: { x: 813, y: 277, w: 89, h: 38 } },
    { kind: "invented", text: "Embeddings", name: "vision_embed", box: { x: 939, y: 254, w: 88, h: 29 } },
    { kind: "model", text: "GNN", name: "gnn", box: { x: 1175, y: 199, w: 45, h: 30 } },
    { kind: "invented", text: "Relational Models", box: { x: 1440, y: 210, w: 77, h: 40 } },
    { kind: "invented", text: "Graph Transformer", box: { x: 1230, y: 284, w: 85, h: 38 } },
    { kind: "invented", text: "Graph Attention", name: "nerf", box: { x: 1387, y: 336, w: 74, h: 40 } },
    { kind: "invented", text: "Neural Logic", box: { x: 1243, y: 457, w: 70, h: 44 } },
    { kind: "invented", text: "Tabular Models", box: { x: 1392, y: 463, w: 73, h: 40 } },
    { kind: "invented", text: "LSTM", name: "grokking", box: { x: 647, y: 496, w: 60, h: 29 } },
    { kind: "model", text: "RNN", name: "rnn", box: { x: 561, y: 551, w: 67, h: 29 } },
    { kind: "model", text: "Transformer", name: "transformer", box: { x: 772, y: 571, w: 105, h: 31 } },
    { kind: "model", text: "Mamba", name: "mamba", box: { x: 969, y: 521, w: 60, h: 29 } },
    { kind: "invented", text: "Seq2Seq", name: "text_seq2seq", box: { x: 840, y: 638, w: 70, h: 32 } },
    { kind: "invented", text: "Reinforcement Learning", name: "reinforce", box: { x: 82, y: 717, w: 110, h: 42 } },
    { kind: "invented", text: "DQN", name: "rlhf", box: { x: 279, y: 761, w: 60, h: 30 } },
    { kind: "invented", text: "Actor-Critic", name: "grpo", box: { x: 386, y: 799, w: 101, h: 29 } },
    { kind: "model", text: "AlphaZero", name: "alphazero", box: { x: 566, y: 748, w: 90, h: 30 } },
    { kind: "model", text: "RL Maze", name: "rl_maze", box: { x: 397, y: 897, w: 75, h: 33 } },
    { kind: "model", text: "GAN", name: "gan", box: { x: 809, y: 899, w: 65, h: 28 } },
    { kind: "model", text: "Diffusion", name: "diffusion", box: { x: 971, y: 861, w: 76, h: 31 } },
    { kind: "invented", text: "Generative Transformers", name: "pixelcnn", box: { x: 1116, y: 764, w: 105, h: 42 } },
    { kind: "invented", text: "NeRF (wrong land)", box: { x: 1412, y: 799, w: 63, h: 31 } },
    { kind: "invented", text: "Normalizing Flows", name: "vae", box: { x: 1235, y: 884, w: 97, h: 40 } },
    { kind: "invented", text: "3D Generation", box: { x: 1392, y: 934, w: 110, h: 30 } },
    // counts + subtitle: refilled with parchment and rewritten from live data
    { kind: "count", text: "28 pipelines", box: { x: 138, y: 985, w: 110, h: 26 }, src: [0, -36] },
    { kind: "subtitle", text: "Neural networks across six lands…", box: { x: 50, y: 66, w: 276, h: 64 }, src: [0, 0] },
  ],
};

export const MAPS: Record<MapId, PaintedMap> = { pixel: PIXEL, paper: PAPER };
/** The true pixel map (render=true, the pixel default), in native art pixels. */
export const TRUE_MAP = TRUE;

// ————————————————————————————————————————————————————————————— helpers

export const pt = (r: AnchorRow | readonly [number, number]): Pt => ({ x: r[0], y: r[1] });

export function stopPoint(map: PaintedMap, id: string): Pt | null {
  const a = map.anchors[id];
  if (a) return pt(a);
  const j = map.junctions[id];
  return j ? pt(j) : null;
}

export function insidePolygon(p: Pt, poly: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function landBox(poly: readonly (readonly [number, number])[]): Box {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Inverse-distance-weighted displacement from the 4 nearest anchor pairs:
 * moves any clean-geometry point onto the labelled pixel-map.png. */
export function warpToBaked(p: Pt): Pt {
  const pairs = Object.entries(PIXEL_V1.anchors)
    .map(([n, a]) => ({ a, b: BAKED_PIXEL[n], d: Math.hypot(a[0] - p.x, a[1] - p.y) }))
    .filter((r) => r.b)
    .sort((u, v) => u.d - v.d)
    .slice(0, 4);
  if (!pairs.length) return p;
  if (pairs[0].d < 0.5) return { x: pairs[0].b[0], y: pairs[0].b[1] };
  let wx = 0, wy = 0, ws = 0;
  for (const r of pairs) {
    const w = 1 / (r.d * r.d);
    wx += (r.b[0] - r.a[0]) * w; wy += (r.b[1] - r.a[1]) * w; ws += w;
  }
  return { x: p.x + wx / ws, y: p.y + wy / ws };
}

/** The map as drawn for a given render: pixel+baked gets every point warped. */
export function resolveMap(id: MapId, render: string): PaintedMap {
  if (id === "pixel" && render === "true") return TRUE;
  if (id !== "pixel" || render !== "baked") return MAPS[id];
  const m = PIXEL_V1;
  const w = (r: readonly [number, number]) => { const q = warpToBaked(pt(r)); return [Math.round(q.x), Math.round(q.y)] as const; };
  const anchors: Record<string, AnchorRow> = {};
  for (const [n, a] of Object.entries(m.anchors)) {
    const b = BAKED_PIXEL[n];
    anchors[n] = b ? [b[0], b[1], a[2]] : a;
  }
  const junctions: Record<string, readonly [number, number]> = {};
  for (const [n, j] of Object.entries(m.junctions)) junctions[n] = w(j);
  return {
    ...m,
    anchors,
    junctions,
    roads: m.roads.map((r) => ({ ...r, via: r.via?.map(w) })),
    lands: Object.fromEntries(Object.entries(m.lands).map(([f, poly]) => [f, poly.map(w)])) as unknown as PaintedMap["lands"],
    signs: Object.fromEntries(Object.entries(m.signs).map(([f, s]) => [f, w(s)])) as unknown as PaintedMap["signs"],
  };
}
