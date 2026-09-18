from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from io import BytesIO
import logging
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

from .config import Settings
from .detector import DroneDetector
from .schemas import DetectionResponse, HealthResponse, ImageInfo, TimingInfo


LOGGER = logging.getLogger(__name__)
SETTINGS = Settings.from_env()
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/bmp",
}
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP", "BMP"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        detector = await run_in_threadpool(
            DroneDetector,
            SETTINGS.model_path,
            warmup=SETTINGS.warmup,
        )
    except Exception:
        LOGGER.exception("Failed to load YOLO model from %s", SETTINGS.model_path)
        raise

    app.state.detector = detector
    app.state.inference_lock = asyncio.Lock()
    LOGGER.info("Loaded %s on CPU", SETTINGS.model_path)
    yield


app = FastAPI(
    title="Drone Detection API",
    version="1.0.0",
    description="CPU-only YOLO26n drone detection service",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(SETTINGS.cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {
        "service": "Drone Detection API",
        "health": "/health",
        "docs": "/docs",
        "detect": "/api/v1/detect",
    }


@app.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    detector: DroneDetector = request.app.state.detector
    return HealthResponse(
        status="ready",
        model=detector.model_path.name,
        model_sha256=detector.model_sha256,
        device=detector.device,
        classes=detector.class_names,
    )


def _decode_image(payload: bytes) -> tuple[Image.Image, int, int]:
    try:
        with Image.open(BytesIO(payload)) as source:
            image_format = source.format
            width, height = source.size
            source.verify()
        if image_format not in ALLOWED_IMAGE_FORMATS:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported image format: {image_format or 'unknown'}",
            )
        if width * height > SETTINGS.max_image_pixels:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Image exceeds the {SETTINGS.max_image_pixels:,}-pixel limit",
            )
        with Image.open(BytesIO(payload)) as source:
            image = source.convert("RGB")
            image.load()
        return image, width, height
    except HTTPException:
        raise
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The uploaded file is not a readable image",
        ) from exc


@app.post("/api/v1/detect", response_model=DetectionResponse)
async def detect(
    request: Request,
    file: UploadFile = File(..., description="JPEG, PNG, WebP, or BMP image"),
    confidence: float = Query(
        SETTINGS.default_confidence,
        ge=0.0,
        le=1.0,
        description="Minimum detection confidence",
    ),
    iou: float = Query(
        SETTINGS.default_iou,
        ge=0.0,
        le=1.0,
        description="Non-maximum suppression IoU threshold",
    ),
) -> DetectionResponse:
    started_at = perf_counter()
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        await file.close()
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Supported content types: image/jpeg, image/png, image/webp, image/bmp",
        )

    payload = await file.read(SETTINGS.max_upload_bytes + 1)
    await file.close()
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The file is empty")
    if len(payload) > SETTINGS.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {SETTINGS.max_upload_bytes // (1024 * 1024)}MB limit",
        )

    decode_started_at = perf_counter()
    image, width, height = await run_in_threadpool(_decode_image, payload)
    decode_ms = (perf_counter() - decode_started_at) * 1000

    detector: DroneDetector = request.app.state.detector
    async with request.app.state.inference_lock:
        detections, inference_ms = await run_in_threadpool(
            detector.predict,
            image,
            confidence=confidence,
            iou=iou,
        )

    total_ms = (perf_counter() - started_at) * 1000
    return DetectionResponse(
        request_id=str(uuid4()),
        model=detector.model_path.name,
        device=detector.device,
        image=ImageInfo(
            filename=file.filename or "upload",
            content_type=content_type,
            width=width,
            height=height,
            size_bytes=len(payload),
        ),
        detection_count=len(detections),
        detections=detections,
        timing=TimingInfo(
            decode_ms=round(decode_ms, 3),
            inference_ms=round(inference_ms, 3),
            total_ms=round(total_ms, 3),
        ),
    )
