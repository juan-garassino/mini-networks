"""Configs for the four audio classifiers (waveform, spectrogram, mel, Transformer).

All four share the same task — 10-way spoken-digit classification on the Free
Spoken Digit Dataset (`speech_digits`, a download-gated dataset) — and the same
clip length, so they differ only in the input representation they compute.
"""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class AudioClassifierConfig(BaseConfig):
    """Raw-waveform 1D CNN (AudioCNN): the model sees samples directly."""

    model_name: str = "audio_classifier"
    n_classes: int = 10
    sample_len: int = 4000   # samples per clip; shorter wavs are zero-padded, longer truncated
    dataset: str = "speech_digits"
    require_downloads: bool = True


class AudioSpecClassifierConfig(BaseConfig):
    """Linear-spectrogram 2D CNN: STFT magnitude computed in the trainer."""

    model_name: str = "audio_spectrogram"
    n_classes: int = 10
    sample_len: int = 4000   # samples per clip; shorter wavs are zero-padded, longer truncated
    n_fft: int = 256         # STFT window -> n_fft//2+1 = 129 frequency bins
    hop_length: int = 128    # STFT stride in samples (50% window overlap)
    dataset: str = "speech_digits"
    require_downloads: bool = True


class AudioTransformerConfig(BaseConfig):
    """Transformer encoder over STFT frames: each frame (n_fft//2+1 bins) is a token."""

    model_name: str = "audio_transformer"
    n_classes: int = 10
    sample_len: int = 4000   # samples per clip; shorter wavs are zero-padded, longer truncated
    d_model: int = 64
    n_heads: int = 4
    n_layers: int = 2
    n_fft: int = 256         # STFT window -> n_fft//2+1 = 129 frequency bins
    hop_length: int = 128    # STFT stride in samples (50% window overlap)
    dataset: str = "speech_digits"
    require_downloads: bool = True


class AudioMelSpecClassifierConfig(BaseConfig):
    """Mel-spectrogram 2D CNN: STFT magnitude pooled into n_mels mel bands."""

    model_name: str = "audio_melspectrogram"
    n_classes: int = 10
    sample_len: int = 4000   # samples per clip; shorter wavs are zero-padded, longer truncated
    n_fft: int = 256         # STFT window -> n_fft//2+1 = 129 frequency bins
    hop_length: int = 128    # STFT stride in samples (50% window overlap)
    n_mels: int = 64         # mel filterbank bands (rows of the mel image)
    dataset: str = "speech_digits"
    require_downloads: bool = True
