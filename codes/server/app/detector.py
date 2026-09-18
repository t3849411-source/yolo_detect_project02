from __future__ import annotations

import hashlib
from pathlib import Path
from time import perf_counter

import numpy as np
from PIL import Image
from ultralytics import YOLO

from .schemas import BoundingBox, Detection


class DroneDetector:
    """Single YOLO model instance used by one API worker."""

    device = "cpu"

    def __init__(self, model_path: Path, *, warmup: bool = True) -> None:
        if not model_path.is_file():
            raise FileNotFoundError(f"YOLO model was not found: {model_path}")

        self.model_path = model_path
        self.model_sha256 = hashlib.sha256(model_path.read_bytes()).hexdigest()
        self.model = YOLO(model_path)
        self.class_names = {
            int(class_id): str(name) for class_id, name in self.model.names.items()
        }

        if warmup:
            blank_image = np.zeros((640, 640, 3), dtype=np.uint8)
            self.model.predict(
                source=blank_image,
                imgsz=640,
                device=self.device,
                verbose=False,
            )

    def predict(
        self,
        image: Image.Image,
        *,
        confidence: float,
        iou: float,
    ) -> tuple[list[Detection], float]:
        started_at = perf_counter()
        result = self.model.predict(
            source=image,
            imgsz=640,
            conf=confidence,
            iou=iou,
            device=self.device,
            verbose=False,
        )[0]
        inference_ms = (perf_counter() - started_at) * 1000

        detections: list[Detection] = []
        if result.boxes is None:
            return detections, inference_ms

        pixel_boxes = result.boxes.xyxy.cpu().tolist()
        normalized_boxes = result.boxes.xyxyn.cpu().tolist()
        confidences = result.boxes.conf.cpu().tolist()
        class_ids = result.boxes.cls.cpu().int().tolist()

        for pixel, normalized, score, class_id in zip(
            pixel_boxes, normalized_boxes, confidences, class_ids, strict=True
        ):
            x1, y1, x2, y2 = (float(value) for value in pixel)
            nx1, ny1, nx2, ny2 = (float(value) for value in normalized)
            detections.append(
                Detection(
                    class_id=int(class_id),
                    class_name=self.class_names.get(int(class_id), str(class_id)),
                    confidence=float(score),
                    bbox=BoundingBox(
                        x1=x1,
                        y1=y1,
                        x2=x2,
                        y2=y2,
                        width=x2 - x1,
                        height=y2 - y1,
                    ),
                    bbox_normalized=BoundingBox(
                        x1=nx1,
                        y1=ny1,
                        x2=nx2,
                        y2=ny2,
                        width=nx2 - nx1,
                        height=ny2 - ny1,
                    ),
                )
            )

        detections.sort(key=lambda item: item.confidence, reverse=True)
        return detections, inference_ms
