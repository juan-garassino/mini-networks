"""Tokenizers for TransformerLM: character-level and BPE."""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Optional


class BPETokenizer:
    """Byte-level BPE tokenizer (educational port from legacy SimplifiedBPE).

    Trains on raw text by iteratively merging the most frequent byte-pair.
    Token ids 0..255 are raw bytes; merged tokens start at 256.
    Special token: PAD = 0 (overlaps byte 0x00 — acceptable for text data).
    """

    PAD = 0

    def __init__(self):
        # merges: ordered list of (pair, merged_id)
        self.merges: list[tuple[tuple[int, int], int]] = []
        # vocab: id → bytes representation (for decode)
        self.vocab: dict[int, bytes] = {i: bytes([i]) for i in range(256)}

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(self, text: str, vocab_size: int = 512, min_frequency: int = 2) -> None:
        """Train BPE merges until vocab_size is reached."""
        # Start from UTF-8 bytes
        ids = list(text.encode("utf-8"))

        num_merges = vocab_size - 256
        next_id = 256

        for _ in range(num_merges):
            # Count consecutive pairs
            counts: Counter = Counter()
            for a, b in zip(ids, ids[1:]):
                counts[(a, b)] += 1
            if not counts:
                break
            best_pair, freq = counts.most_common(1)[0]
            if freq < min_frequency:
                break

            # Merge best pair
            new_ids: list[int] = []
            i = 0
            while i < len(ids):
                if i < len(ids) - 1 and ids[i] == best_pair[0] and ids[i + 1] == best_pair[1]:
                    new_ids.append(next_id)
                    i += 2
                else:
                    new_ids.append(ids[i])
                    i += 1

            self.merges.append((best_pair, next_id))
            self.vocab[next_id] = self.vocab[best_pair[0]] + self.vocab[best_pair[1]]
            ids = new_ids
            next_id += 1

    # ------------------------------------------------------------------
    # Encode / decode
    # ------------------------------------------------------------------

    def encode(self, text: str) -> list[int]:
        """Encode text to ids: UTF-8 bytes, then apply the learned merges in training order."""
        ids = list(text.encode("utf-8"))
        for (a, b), merged in self.merges:
            new_ids: list[int] = []
            i = 0
            while i < len(ids):
                if i < len(ids) - 1 and ids[i] == a and ids[i + 1] == b:
                    new_ids.append(merged)
                    i += 2
                else:
                    new_ids.append(ids[i])
                    i += 1
            ids = new_ids
        return ids

    def decode(self, ids: list[int]) -> str:
        """Concatenate the byte strings of ``ids`` (skipping PAD = 0) and decode as UTF-8, replacing invalid sequences."""
        raw = b"".join(self.vocab.get(i, b"") for i in ids if i != self.PAD)
        return raw.decode("utf-8", errors="replace")

    @property
    def vocab_size(self) -> int:
        """256 byte ids plus one id per learned merge."""
        return 256 + len(self.merges)

    # ------------------------------------------------------------------
    # Save / load
    # ------------------------------------------------------------------

    def save(self, path: str) -> None:
        """Write the merge list as JSON ``{"merges": [[[a, b], id], ...]}``; the vocab is rebuilt from it on load."""
        data = {
            "merges": [[[a, b], merged_id] for (a, b), merged_id in self.merges],
        }
        with open(path, "w") as f:
            json.dump(data, f)

    @classmethod
    def load(cls, path: str) -> "BPETokenizer":
        """Rebuild a tokenizer from a JSON file written by :meth:`save`."""
        tok = cls()
        with open(path) as f:
            data = json.load(f)
        for (pair, merged_id) in data["merges"]:
            a, b = pair
            tok.merges.append(((a, b), merged_id))
            tok.vocab[merged_id] = tok.vocab[a] + tok.vocab[b]
        return tok


class CharTokenizer:
    """Character-level tokenizer: one id per distinct character.

    ``from_text`` reserves id 0 for PAD and numbers characters from 1. When
    built from ``TextFileDataset``'s vocabulary (ids from 0), id 0 is a real
    character, so ``encode`` cannot tell it from an unknown char and
    ``decode`` drops it.
    """
    PAD = 0

    def __init__(self, vocab: Optional[dict[str, int]] = None):
        self.stoi: dict[str, int] = vocab or {}
        self.itos: dict[int, str] = {v: k for k, v in self.stoi.items()} if vocab else {}

    @classmethod
    def from_text(cls, text: str) -> "CharTokenizer":
        """Build a vocabulary from the sorted set of characters in ``text`` (ids 1..N, 0 = PAD)."""
        chars = sorted(set(text))
        stoi = {c: i + 1 for i, c in enumerate(chars)}  # 0 reserved for PAD
        tok = cls(stoi)
        tok.itos = {v: k for k, v in stoi.items()}
        tok.itos[0] = "<PAD>"
        return tok

    @property
    def vocab_size(self) -> int:
        """Number of characters plus one for PAD."""
        return len(self.stoi) + 1  # +1 for PAD

    def encode(self, text: str) -> list[int]:
        """Map each character to its id; unknown characters become PAD (0)."""
        return [self.stoi.get(c, self.PAD) for c in text]

    def decode(self, ids: list[int]) -> str:
        """Join the characters for ``ids``, skipping PAD (0) and unknown ids."""
        return "".join(self.itos.get(i, "") for i in ids if i != self.PAD)

    def save(self, path: str) -> None:
        """Write the char -> id mapping (``stoi``) as JSON."""
        with open(path, "w") as f:
            json.dump(self.stoi, f)

    @classmethod
    def load(cls, path: str) -> "CharTokenizer":
        """Rebuild a tokenizer from a JSON ``stoi`` file written by :meth:`save`."""
        with open(path) as f:
            stoi = json.load(f)
        return cls(stoi)
