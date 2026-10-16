"""Config for RLHF: base LM size, PPO/KL knobs and rollout budget."""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class RLHFConfig(BaseConfig):
    """Hyperparameters for :class:`RLHFTrainer`.

    Pretraining uses ``learning_rate``; PPO uses ``rlhf_lr``. Budgets are
    tier-capped in the trainer (S: 1 rollout of 8 tokens, 1 PPO iter/epoch;
    M: 4 rollouts of 16 tokens, 2 iters/epochs). ``reward_hidden`` (the
    learned RewardModel head) and ``value_coef`` are not used by the current
    trainer, which scores with ``shakespearean_score`` and has no critic.
    """
    model_name: str = "rlhf"

    # Base TransformerLM (pretrained on Shakespeare)
    d_model: int = 64
    n_layers: int = 2
    n_heads: int = 2
    d_ff: int = 128
    seq_len: int = 64
    vocab_size: int = 256
    dropout: float = 0.1
    pretrain_epochs: int = 2

    # Reward model head
    reward_hidden: int = 32

    # PPO fine-tuning
    ppo_epochs: int = 2           # gradient steps per rollout batch
    ppo_clip: float = 0.2
    kl_coef: float = 0.1          # KL divergence penalty weight
    value_coef: float = 0.5
    rlhf_lr: float = 1e-4

    # Rollout collection
    n_rollouts: int = 50          # number of prompt/response pairs per PPO iteration
    rollout_max_new: int = 32     # tokens generated per response
    rollout_temperature: float = 1.0
    n_ppo_iters: int = 5          # number of PPO iterations (each collects n_rollouts)

    dataset: str = "text_file"
    text_file: str = ""
