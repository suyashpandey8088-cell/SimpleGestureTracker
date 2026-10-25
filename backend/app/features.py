"""Shared train/serve preprocessing. Never flip left/right or reverse time."""

import numpy as np

PREPROCESSING = "body-anchor-velocity-v1"
FEATURE_DIM = 75 * 7  # xyz + velocity xyz + validity


class InsufficientTracking(ValueError):
    pass


def preprocess(points, validity, timestamps):
    p = np.asarray(points, dtype=np.float32)
    mask = np.asarray(validity, dtype=bool)
    t = np.asarray(timestamps, dtype=np.float64)
    if (
        p.ndim != 3
        or p.shape[1:] != (75, 3)
        or mask.shape != p.shape[:2]
        or t.shape != (len(p),)
    ):
        raise ValueError("Expected [T,75,3] points, [T,75] mask and [T] timestamps")
    if (
        len(t) < 3
        or not np.isfinite(p).all()
        or not np.isfinite(t).all()
        or np.any(np.diff(t) <= 0)
    ):
        raise ValueError("Need at least three finite, time-ordered frames")
    # Pose shoulder indices 11/12 after the two hand slots. A fixed clip anchor
    # preserves trajectory (per-frame wrist centering would erase movement).
    shoulders = mask[:, 53] & mask[:, 54]
    visible = mask[:, :42].any(axis=1)
    if shoulders.sum() < 2 or visible.mean() < 0.35:
        raise InsufficientTracking("Keep both shoulders and your signing hands in view")
    first = np.flatnonzero(shoulders)[0]
    origin = (p[first, 53] + p[first, 54]) / 2
    scale = float(np.linalg.norm(p[first, 53, :2] - p[first, 54, :2]))
    if scale < 0.03:
        raise InsufficientTracking("Move closer: shoulder reference is too small")
    coords = (p - origin) / scale
    # MediaPipe hand z is wrist-relative, while pose z is hip-relative.
    # Preserve each hand's local depth shape; never pretend these depths share
    # a calibrated 3D origin or subtract a body z reference from a hand z.
    coords[:, :42, 2] = p[:, :42, 2] / scale
    coords[~mask] = 0
    # Resample by nearest observation at 10 Hz, never interpolate through gaps.
    target = np.arange(t[0], t[-1] + 0.01, 100.0)
    right = np.searchsorted(t, target).clip(0, len(t) - 1)
    left = (right - 1).clip(0, len(t) - 1)
    idx = np.where(abs(t[left] - target) < abs(t[right] - target), left, right)
    resampled_mask = mask[idx].copy()
    resampled_mask[abs(t[idx] - target) > 200] = False
    coords = coords[idx].copy()
    coords[~resampled_mask] = 0
    velocity = np.zeros_like(coords)
    pair = resampled_mask[1:] & resampled_mask[:-1]
    velocity[1:] = np.where(pair[..., None], np.diff(coords, axis=0) / 0.1, 0)
    features = np.concatenate(
        [
            coords.reshape(len(coords), -1),
            velocity.reshape(len(coords), -1),
            resampled_mask.astype(np.float32),
        ],
        axis=1,
    )
    # Fixed physical bounds reduce numerical failures without standardizing each
    # frame independently. Exact same operation used by training and serving.
    return np.clip(features, -20, 20).astype(np.float32), (
        (target - target[0]) / 1000
    ).astype(np.float32)
