"""Config for REINFORCE on MazeEnv: maze shape, policy width, discount and episode budget."""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class ReinforceConfig(BaseConfig):
    """Hyperparameters for :class:`PolicyNet` and the REINFORCE loop.

    ``maze_density`` is the chance each cell is a hole. Budgets are
    tier-capped in the trainer: S uses a 5x5 maze, <= 12 steps/episode and
    2 episodes; M caps at 100 steps/episode and 300 episodes.
    """
    model_name: str = "reinforce"

    # Maze
    maze_width: int = 8
    maze_height: int = 8
    maze_density: float = 0.2
    max_steps: int = 200

    # Policy network
    hidden_dim: int = 64

    # REINFORCE
    gamma: float = 0.99

    # Training
    n_episodes: int = 500
    eval_episodes: int = 20
