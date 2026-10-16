// rpp_classifier — structure-only numbers (there is NO local champion, run or
// checkpoint). Every value here is exact from the code, not learned:
//   shapes / params  src/mini_networks/models/rpp_classifier/model.py
//                    (RPPClassifier(hidden_dim=16, num_classes=10))
//   lambdas          models/rpp_classifier/config.py prior_conv / prior_mlp
//   init numbers     RPPClassifier(16, 10) built on CPU with torch seed 0,
//                    nothing trained (field-expert dossier, rpp.md)
//   gate             core/evalspec.py EVAL_SPECS["rpp_classifier"] (PROVISIONAL)

/** parameter counts per tensor: conv paths, free (dense) paths, BN, head */
export const RPP_PARAMS = {
  conv: [72, 1152],          // Conv2d(1,8,3) + Conv2d(8,16,3), no bias
  free: [307328, 307328],    // Linear(196→1568) + Linear(392→784), no bias
  bn: [16, 32],              // BatchNorm2d(8) + BatchNorm2d(16): weight + bias
  head: 170,                 // Linear(16→10)
  total: 616098,
} as const;

/** L2 prior strengths in the training loss: L = CE + λc·Σ‖W_conv‖² + λf·Σ‖W_free‖² */
export const RPP_LAMBDA = { conv: 1e-4, free: 1e-2 } as const;

/** at init (torch seed 0, untrained): norms and squared norms of each path */
export const RPP_INIT = {
  convNorm: 3.90,   // Σ per-block ‖W_conv‖_F
  freeNorm: 39.02,  // Σ per-block ‖W_free‖_F
  convSq: 7.86,     // Σ ‖W_conv‖²_F
  freeSq: 783.9,    // Σ ‖W_free‖²_F
  ce: Math.LN10,    // CE of ~uniform logits over 10 classes
} as const;

/** quality gate: MNIST test accuracy; no M sweep has run, so provisional */
export const RPP_GATE = { M: 0.8, L: 0.93, provisional: true } as const;

/** the spine: [channels, resolution] after each stage */
export const RPP_SPINE = {
  input: [1, 28], pool0: [1, 14], b1: [8, 14], pool1: [8, 7], b2: [16, 7], gap: [16, 1], logits: 10,
} as const;
