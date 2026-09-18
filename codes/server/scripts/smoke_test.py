from __future__ import annotations

import argparse
import http.client
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request
from uuid import uuid4


SERVER_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = SERVER_DIR.parent.parent
HOST = "127.0.0.1"
PORT = 8010
BASE_URL = f"http://{HOST}:{PORT}"


def wait_until_ready(process: subprocess.Popen[str], timeout: float = 60.0) -> dict:
    deadline = time.monotonic() + timeout
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        if process.poll() is not None:
            output = process.stdout.read() if process.stdout else ""
            raise RuntimeError(f"Server exited before becoming ready:\n{output}")
        try:
            with urllib.request.urlopen(f"{BASE_URL}/health", timeout=2) as response:
                return json.load(response)
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            time.sleep(0.25)
    raise TimeoutError(f"Server did not become ready: {last_error}")


def multipart_request(
    path: str,
    *,
    filename: str,
    content_type: str,
    payload: bytes,
) -> tuple[int, dict]:
    boundary = f"----drone-api-{uuid4().hex}"
    body = b"".join(
        [
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(),
            f"Content-Type: {content_type}\r\n\r\n".encode(),
            payload,
            f"\r\n--{boundary}--\r\n".encode(),
        ]
    )
    connection = http.client.HTTPConnection(HOST, PORT, timeout=120)
    connection.request(
        "POST",
        path,
        body=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Content-Length": str(len(body)),
        },
    )
    response = connection.getresponse()
    response_body = response.read()
    connection.close()
    return response.status, json.loads(response_body)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run an end-to-end API smoke test")
    parser.add_argument(
        "--gunicorn",
        action="store_true",
        help="Start the production Gunicorn/Uvicorn worker command",
    )
    args = parser.parse_args()
    sample_path = REPO_ROOT / "images" / "pic_001.jpg"
    if not sample_path.is_file():
        raise FileNotFoundError(sample_path)

    environment = os.environ.copy()
    environment["MODEL_WARMUP"] = "true"
    if args.gunicorn:
        command = [
            str(Path(sys.executable).parent / "gunicorn"),
            "app.main:app",
            "--worker-class",
            "uvicorn.workers.UvicornWorker",
            "--workers",
            "1",
            "--bind",
            f"{HOST}:{PORT}",
            "--timeout",
            "120",
            "--log-level",
            "warning",
        ]
    else:
        command = [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            HOST,
            "--port",
            str(PORT),
            "--log-level",
            "warning",
        ]

    process = subprocess.Popen(
        command,
        cwd=SERVER_DIR,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    try:
        health = wait_until_ready(process)
        if health["status"] != "ready" or health["device"] != "cpu":
            raise AssertionError(f"Unexpected health response: {health}")

        detect_status, detection = multipart_request(
            "/api/v1/detect?confidence=0.25&iou=0.7",
            filename=sample_path.name,
            content_type="image/jpeg",
            payload=sample_path.read_bytes(),
        )
        if detect_status != 200:
            raise AssertionError(f"Detection failed ({detect_status}): {detection}")
        if detection["device"] != "cpu" or detection["image"]["width"] <= 0:
            raise AssertionError(f"Unexpected detection response: {detection}")

        media_status, media_error = multipart_request(
            "/api/v1/detect",
            filename="invalid.txt",
            content_type="text/plain",
            payload=b"not an image",
        )
        if media_status != 415:
            raise AssertionError(f"Expected 415, got {media_status}: {media_error}")

        image_status, image_error = multipart_request(
            "/api/v1/detect",
            filename="broken.jpg",
            content_type="image/jpeg",
            payload=b"not an image",
        )
        if image_status != 422:
            raise AssertionError(f"Expected 422, got {image_status}: {image_error}")

        print(
            json.dumps(
                {
                    "health": health,
                    "server": "gunicorn" if args.gunicorn else "uvicorn",
                    "detection": detection,
                    "invalid_content_type": {
                        "status": media_status,
                        "response": media_error,
                    },
                    "unreadable_image": {
                        "status": image_status,
                        "response": image_error,
                    },
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


if __name__ == "__main__":
    main()
