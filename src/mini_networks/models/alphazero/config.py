"""Config for mini AlphaZero."""
from __future__ import annotations

from mini_networks.core.config import BaseConfig


class AlphaZeroConfig(BaseConfig):
    """Mini AlphaZero (arXiv 1712.01815) on tic-tac-toe.

    Self-play MCTS generates improved move distributions; the network distills
    them and the search then leans on the better network — the closed loop is
    the lesson. The GATE evaluates the RAW POLICY (no search) vs a seeded
    random opponent: MCTS with terminal backups beats random even with an
    untrained net, so gating search-assisted play would measure the search,
    not the learning. evaluate() also logs search_success_rate as the
    reference; the raw-vs-search gap is the evidence.
    """

    model_name: str = "alphazero"

    hidden_dim: int = 64       # width of the 2-layer MLP trunk (18 -> h -> h)
    n_games: int = 2000        # self-play games at L; limit_steps caps S 2 / M 200
    n_sims: int = 64           # MCTS simulations per move at L; capped S 8 / M 64
    c_puct: float = 1.5        # PUCT exploration weight on the prior term
    dirichlet_alpha: float = 0.6   # root noise (self-play only; off at eval/infer)
    dirichlet_eps: float = 0.25    # root prior mix: (1-eps)*P + eps*Dir(alpha)
    train_steps_per_game: int = 4  # gradient steps after each self-play game
    buffer_size: int = 4096        # replay buffer of (state, pi, z); oldest dropped
    eval_games: int = 200      # raw-policy eval games vs random; capped S 8 / M 200
