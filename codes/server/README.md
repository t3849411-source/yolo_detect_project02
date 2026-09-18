# Drone Detection API

FastAPI server for the trained `drone-detection-yolo26n.pt` model. The model is loaded once during startup and every inference runs on CPU.

## Local run

```bash
cd codes/server
uv sync --frozen
uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Open <http://localhost:8001/docs> for the interactive API documentation.

Run the end-to-end smoke test, which starts a temporary server and checks health, inference, and validation errors:

```bash
.venv/bin/python scripts/smoke_test.py
.venv/bin/python scripts/smoke_test.py --gunicorn
```

## Request examples

```bash
curl http://localhost:8001/health

curl -X POST "http://localhost:8001/api/v1/detect?confidence=0.25&iou=0.7" \
  -F "file=@../../images/pic_001.jpg"
```

The detection response contains pixel and normalized bounding boxes, confidence values, image metadata, detection count, and decode/inference/total timings. The server accepts JPEG, PNG, WebP, and BMP images. Default limits are 10MB and 40 million pixels.

## Production run

Use one worker so the model is loaded only once:

```bash
uv run gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers 1 --bind 0.0.0.0:8000 --timeout 120
```

Set the variables from `.env.example` in the process manager when defaults need to change. Docker Compose reads a local `.env` file automatically and exposes the service on port 8000.

On Render, the Docker command binds Gunicorn to the platform-provided `PORT`. The repository root `render.yaml` creates the API with `/health` as its health check and disables startup warmup to reduce the free instance's initial memory spike.
