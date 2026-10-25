"""Small temporal Transformer baseline, not a pretrained ISL interpreter."""

import math
import torch
from torch import nn
from backend.app.features import FEATURE_DIM


def positions(times, width):
    f = torch.exp(
        torch.arange(0, width, 2, device=times.device) * (-math.log(10000) / width)
    )
    angles = times.unsqueeze(-1) * f
    return torch.stack((angles.sin(), angles.cos()), dim=-1).flatten(-2)


class Translator(nn.Module):
    def __init__(self, vocab_size, width=128, layers=2, heads=4):
        super().__init__()
        self.width = width
        self.input = nn.Linear(FEATURE_DIM, width)
        self.embedding = nn.Embedding(vocab_size, width, padding_idx=0)
        self.transformer = nn.Transformer(
            d_model=width,
            nhead=heads,
            num_encoder_layers=layers,
            num_decoder_layers=layers,
            dim_feedforward=width * 4,
            dropout=0.1,
            batch_first=True,
        )
        self.output = nn.Linear(width, vocab_size)

    def encode(self, x, times, padding=None):
        return self.transformer.encoder(
            self.input(x) + positions(times, self.width), src_key_padding_mask=padding
        )

    def decode(self, memory, tokens, padding=None):
        t = (
            torch.arange(tokens.shape[1], device=tokens.device)
            .float()
            .unsqueeze(0)
            .expand(tokens.shape[0], -1)
        )
        embedded = self.embedding(tokens) * math.sqrt(self.width) + positions(
            t, self.width
        )
        causal = torch.triu(
            torch.ones(
                tokens.shape[1], tokens.shape[1], device=tokens.device, dtype=torch.bool
            ),
            diagonal=1,
        )
        decoded = self.transformer.decoder(
            embedded,
            memory,
            tgt_mask=causal,
            tgt_key_padding_mask=tokens.eq(0),
            memory_key_padding_mask=padding,
        )
        return self.output(decoded)

    def forward(self, x, times, tokens, padding=None):
        return self.decode(self.encode(x, times, padding), tokens, padding)

    @torch.inference_mode()
    def generate(self, x, times, max_tokens=64):
        self.eval()
        memory = self.encode(x, times)
        tokens = torch.tensor([[1]], device=x.device)
        for _ in range(max_tokens):
            logits = self.decode(memory, tokens)[:, -1].clone()
            logits[:, 0:2] = -torch.inf  # never emit padding/BOS
            next_token = logits.argmax(-1, keepdim=True)
            tokens = torch.cat((tokens, next_token), dim=1)
            if next_token.item() == 2:
                return tokens[0, 1:-1].tolist(), True
        return tokens[0, 1:].tolist(), False
