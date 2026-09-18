from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path


SERVER_DIR = Path(__file__).resolve().parent.parent


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError as exc:
        raise ValueError(f"{name} must be a number") from exc


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer") from exc


@dataclass(frozen=True)
class Settings:
    model_path: Path
    max_upload_bytes: int
    max_image_pixels: int
    default_confidence: float
    default_iou: float
    cors_origins: tuple[str, ...]
    warmup: bool

    @classmethod
    def from_env(cls) -> "Settings":
        model_path = Path(
            os.getenv("MODEL_PATH", str(SERVER_DIR / "drone-detection-yolo26n.pt"))
        ).expanduser().resolve()
        max_upload_mb = _env_int("MAX_UPLOAD_MB", 10)
        max_image_pixels = _env_int("MAX_IMAGE_PIXELS", 40_000_000)
        confidence = _env_float("DEFAULT_CONFIDENCE", 0.25)
        iou = _env_float("DEFAULT_IOU", 0.7)
        origins = tuple(
            origin.strip()
            for origin in os.getenv(
                "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
            ).split(",")
            if origin.strip()
        )
        warmup = os.getenv("MODEL_WARMUP", "true").lower() in {"1", "true", "yes", "on"}

        if max_upload_mb <= 0:
            raise ValueError("MAX_UPLOAD_MB must be greater than zero")
        if max_image_pixels <= 0:
            raise ValueError("MAX_IMAGE_PIXELS must be greater than zero")
        if not 0.0 <= confidence <= 1.0:
            raise ValueError("DEFAULT_CONFIDENCE must be between 0 and 1")
        if not 0.0 <= iou <= 1.0:
            raise ValueError("DEFAULT_IOU must be between 0 and 1")

        return cls(
            model_path=model_path,
            max_upload_bytes=max_upload_mb * 1024 * 1024,
            max_image_pixels=max_image_pixels,
            default_confidence=confidence,
            default_iou=iou,
            cors_origins=origins,
            warmup=warmup,
        )
