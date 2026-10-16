from __future__ import annotations
from mini_networks.core.config import BaseConfig


class DCRNNConfig(BaseConfig):
    model_name: str = "dcrnn"
    # DCRNN (Li et al. 2018) forecasts traffic on a road-sensor GRAPH over TIME.
    # Its one idea: take a GRU and replace every matmul in the gates with a GRAPH
    # DIFFUSION CONVOLUTION — so the recurrent state is defined per graph node and
    # updates by diffusing information along the (directed) edges. It is literally
    # the `gnn` mini's message passing (message-passing atom) fused into the `rnn`
    # mini's recurrence atom. Source: liyaguang/DCRNN model/dcrnn_cell.py:133-184.
    #
    # Toy data: a synthetic sensor graph with a diffusion process on it (no METR-LA
    # download). Sensors are random 2D points; the adjacency is a Gaussian kernel
    # of pairwise distance (gen_adj_mx.py:11-42, deliberately NOT symmetrized so
    # the DUAL random-walk supports below are meaningful).
    n_nodes: int = 20
    seq_len: int = 12            # input timesteps
    horizon: int = 6             # forecast timesteps
    hidden_dim: int = 16
    # max_diffusion_step (K): Chebyshev-style diffusion order. K=2 mixes each
    # node's own value, its 1-hop and 2-hop neighbours (both forward D^-1 A and
    # reverse D^-1 Aᵀ random walks — the DUAL support for a directed graph).
    max_diffusion_step: int = 2
    # cl_decay_steps (k): controls INVERSE-SIGMOID scheduled sampling
    # threshold(step) = k / (k + exp(step / k)) (dcrnn_model.py:84-92) — the decoder
    # is fed ground truth with this (decaying) probability during training so it
    # transitions smoothly from teacher-forced to autoregressive.
    cl_decay_steps: int = 200
    n_samples: int = 512         # synthetic sequences per split
    dataset: str = "synthetic_sensor_graph"
