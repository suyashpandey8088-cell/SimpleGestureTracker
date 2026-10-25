"""Versioned transport contract. Coordinates are camera-space, never mirrored.

75 points = left hand 21 + right hand 21 + body pose 33.
Each point has xyz; validity is explicit, not inferred from zero coordinates.
"""

from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StrictBool, model_validator

SCHEMA = "isl-landmarks-v1"
POINTS = 75
MAX_FRAMES = 240
Number = Annotated[float, Field(ge=-10, le=10, allow_inf_nan=False)]
Point = tuple[Number, Number, Number]
Frame = Annotated[list[Point], Field(min_length=POINTS, max_length=POINTS)]
Mask = Annotated[list[StrictBool], Field(min_length=POINTS, max_length=POINTS)]


class SequenceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal["isl-landmarks-v1"] = SCHEMA
    session_id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    sequence_id: int = Field(ge=0, le=2**31 - 1)
    timestamps_ms: list[Annotated[float, Field(ge=0, allow_inf_nan=False)]] = Field(
        min_length=3, max_length=MAX_FRAMES
    )
    landmarks: list[Frame] = Field(min_length=3, max_length=MAX_FRAMES)
    validity_mask: list[Mask] = Field(min_length=3, max_length=MAX_FRAMES)
    is_final: bool = False

    @model_validator(mode="after")
    def dimensions(self):
        n = len(self.timestamps_ms)
        if len(self.landmarks) != n or len(self.validity_mask) != n:
            raise ValueError(
                "Timestamps, landmarks, and masks must have the same frame count"
            )
        if any(len(p) != POINTS for p in self.landmarks) or any(
            len(m) != POINTS for m in self.validity_mask
        ):
            raise ValueError(
                "Each frame must contain exactly 75 xyz points and 75 validity flags"
            )
        if any(b <= a for a, b in zip(self.timestamps_ms, self.timestamps_ms[1:])):
            raise ValueError("Timestamps must increase strictly")
        if self.timestamps_ms[-1] - self.timestamps_ms[0] > 24000:
            raise ValueError(
                "Utterances are limited to 24 seconds; finish and start a new sentence"
            )
        return self


class RecognitionResponse(BaseModel):
    sequence_id: int
    status: Literal["interim", "final", "insufficient_tracking", "unknown"]
    glosses: list[str] = Field(default_factory=list)
    translation: str = ""
    is_final: bool = False
    # No accuracy-like confidence: greedy token likelihood isn't calibrated.
    confidence: None = None
