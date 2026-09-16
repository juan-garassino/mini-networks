from __future__ import annotations
from mini_networks.core.config import BaseConfig


class ConvLSTMConfig(BaseConfig):
    model_name: str = "convlstm"
    # The `rnn` mini carries a hidden state through time with fully-connected
    # gates over a 1D sequence. ConvLSTM (Shi et al. 2015) replaces every matmul
    # in the LSTM gates with a CONVOLUTION, so the hidden state is a spatial
    # feature MAP, not a vector — the network predicts the next FRAME of a video
    # from the past frames. Source: NVlabs/conv-tt-lstm code/convlstmcell.py
    # (ConvLSTMCell, lines 162-250) + code/convlstmnet.py (seq2seq rollout).
    #
    # Data: a self-generated Moving-MNIST toy — one MNIST digit drifting linearly
    # across a small canvas over `seq_len` frames (no external download).
    canvas_size: int = 32
    seq_len: int = 10            # total frames per clip
    input_frames: int = 5        # frames given as context; predict the rest
    hidden_dim: int = 16         # ConvLSTM hidden channels (small/CPU)
    kernel_size: int = 3
    n_layers: int = 1
    # scheduled_sampling_prob: probability of feeding the model its OWN previous
    # prediction (vs the ground-truth frame) during training rollout — the
    # differentiable Bernoulli soft-mix from conv-tt-lstm convlstmnet.py:128-204.
    # 0 = always teacher-forced; 1 = fully autoregressive. Val is always
    # open-loop (predictions fed back), so this only shapes the training signal.
    scheduled_sampling_prob: float = 0.5
    n_clips: int = 512           # synthetic clips per split
    dataset: str = "mnist"
