"""Config for DPO: the rlhf config (LM, corpus, rollout budgets) plus `dpo_beta`."""
from __future__ import annotations

from mini_networks.models.rlhf.config import RLHFConfig


class DPOConfig(RLHFConfig):
    """RLHFConfig + DPO's beta; PPO-only knobs (ppo_epochs, clip, ...) go unused.

    Reused fields: pretrain_epochs (stage 1), n_ppo_iters (= DPO iterations),
    n_rollouts (= prompts per iteration, two samples each), rollout_max_new,
    rollout_temperature, rlhf_lr (AdamW lr for the DPO updates).
    """

    model_name: str = "dpo"
    # Inverse-temperature of the implicit reward. Small beta = gentle
    # preference pressure (paper sweeps 0.1-0.5).
    dpo_beta: float = 0.1
