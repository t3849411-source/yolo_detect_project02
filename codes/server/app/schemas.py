from __future__ import annotations

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    width: float
    height: float


class Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float = Field(ge=0.0, le=1.0)
    bbox: BoundingBox
    bbox_normalized: BoundingBox


class ImageInfo(BaseModel):
    filename: str
    content_type: str
    width: int
    height: int
    size_bytes: int


class TimingInfo(BaseModel):
    decode_ms: float
    inference_ms: float
    total_ms: float


class DetectionResponse(BaseModel):
    request_id: str
    model: str
    device: str
    image: ImageInfo
    detection_count: int
    detections: list[Detection]
    timing: TimingInfo


class HealthResponse(BaseModel):
    status: str
    model: str
    model_sha256: str
    device: str
    classes: dict[int, str]
