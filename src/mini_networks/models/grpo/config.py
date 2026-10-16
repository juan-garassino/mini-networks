"""Config for GRPO: the rlhf config (LM, corpus, PPO clip/KL knobs) plus `group_size`."""
from __future__ import annotations

from mini_networks.models.rlhf.config import RLHFConfig


class GRPOConfig(RLHFConfig):
    """RLHFConfig + the group size; PPO's value-network knobs go unused.

    Reused fields: pretrain_epochs (stage 1), n_ppo_iters (= GRPO
    iterations, one prompt group each), rollout_max_new, rollout_temperature,
    ppo_clip, kl_coef, rlhf_lr.
    """

    model_name: str = "grpo"
    # Responses sampled PER PROMPT — the group whose mean reward is the
    # baseline. The paper uses 64; at mini scale 4-8 already shows the effect.
    group_size: int = 4
