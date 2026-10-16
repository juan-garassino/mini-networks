"""Config for the RL maze: maze shape, which agent (q / dqn / ppo) and each agent's hyperparameters."""
from __future__ import annotations
from typing import Literal
from mini_networks.core.config import BaseConfig


class RLMazeConfig(BaseConfig):
    """Hyperparameters for :class:`RLMazeTrainer`.

    ``agent_type`` picks the agent; only that agent's ``dqn_*`` / ``ppo_*``
    fields are used. The epsilon fields apply to Q and DQN only. Budgets are
    tier-capped in the trainer: S uses a 5x5 maze, <= 12 steps/episode and
    2 episodes; M caps at 100 steps/episode and 300 episodes.
    """
    model_name: str = "rl_maze"

    # Maze
    maze_width: int = 8
    maze_height: int = 8
    maze_density: float = 0.2    # fraction of obstacle cells
    max_steps: int = 200          # max steps per episode

    # Agent type
    agent_type: Literal["q", "dqn", "ppo"] = "dqn"

    # Shared RL hyperparameters
    gamma: float = 0.99           # discount factor
    epsilon: float = 1.0          # initial exploration rate
    epsilon_decay: float = 0.995
    epsilon_min: float = 0.01
    rl_lr: float = 1e-3           # learning rate for neural agents

    # DQN
    dqn_hidden: int = 64
    replay_capacity: int = 1000
    replay_batch: int = 32
    target_update_every: int = 100  # episodes between target network syncs

    # PPO
    ppo_hidden: int = 64
    ppo_clip: float = 0.2
    ppo_value_coef: float = 0.5
    ppo_entropy_coef: float = 0.01
    ppo_epochs: int = 4           # optimization epochs per rollout
    ppo_lam: float = 0.95         # GAE lambda

    # Training
    n_episodes: int = 500         # total training episodes
    eval_episodes: int = 20       # evaluation episodes

    # fast_demo overrides
    # (BaseConfig.fast_demo=True → use tiny maze + few episodes)
