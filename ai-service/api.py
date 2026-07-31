"""
api.py
------
FastAPI application — the AI/CV service entrypoint.

Endpoints:
  GET  /health                  — liveness probe
  GET  /metrics/model           — last inference stats from DB
  POST /detect-vehicles         — detect vehicles in uploaded image
  POST /detect-occupancy        — detect vehicles + map to slot status
  POST /detect-plate            — detect license plate + OCR
  POST /detect-plate-full       — full pipeline: vehicles → plates for all vehicles

Run with:
  uvicorn api:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import io
import time
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ── Local modules (run from ai-service/ directory) ────────────────────────────
from models.vehicle_detector import VehicleDetector
from inference.occupancy import OccupancyDetector
from inference.plate_ocr import PlateOCRPipeline

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="ParkSystem AI Service",
    description="Computer-vision microservice: vehicle detection, slot occupancy, license plate OCR.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Singleton model instances (loaded once on first request) ───────────────────
_vehicle_detector: Optional[VehicleDetector] = None
_occupancy_detector: Optional[OccupancyDetector] = None
_plate_pipeline: Optional[PlateOCRPipeline] = None

# ── In-memory metrics store (persisted to disk optionally) ────────────────────
_metrics_store: Dict[str, Any] = {
    "total_requests":    0,
    "avg_latency_ms":    0.0,
    "last_inference_ms": 0.0,
    "last_request_at":   None,
    "model_version":     "pretrained-coco",
}

METRICS_FILE = Path(__file__).parent / "experiments" / "runtime_metrics.json"


def _update_metrics(inference_ms: float, model_version: str = ""):
    global _metrics_store
    n = _metrics_store["total_requests"]
    _metrics_store["total_requests"]    = n + 1
    _metrics_store["avg_latency_ms"]    = round(
        (_metrics_store["avg_latency_ms"] * n + inference_ms) / (n + 1), 2
    )
    _metrics_store["last_inference_ms"] = round(inference_ms, 2)
    _metrics_store["last_request_at"]   = datetime.utcnow().isoformat()
    if model_version:
        _metrics_store["model_version"] = model_version

    # Persist to disk
    try:
        METRICS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(METRICS_FILE, "w") as f:
            json.dump(_metrics_store, f, indent=2)
    except Exception:
        pass


def _get_vehicle_detector() -> VehicleDetector:
    global _vehicle_detector
    if _vehicle_detector is None:
        _vehicle_detector = VehicleDetector()
    return _vehicle_detector


def _get_occupancy_detector() -> OccupancyDetector:
    global _occupancy_detector
    if _occupancy_detector is None:
        _occupancy_detector = OccupancyDetector()
    return _occupancy_detector


def _get_plate_pipeline() -> PlateOCRPipeline:
    global _plate_pipeline
    if _plate_pipeline is None:
        _plate_pipeline = PlateOCRPipeline()
    return _plate_pipeline


def _bytes_to_bgr(data: bytes) -> np.ndarray:
    """Decode uploaded image bytes to BGR numpy array."""
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Cannot decode image. Use JPEG or PNG.")
    return img


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Liveness probe — called by Node.js on startup."""
    return {
        "status": "ok",
        "service": "ParkSystem AI Service",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/metrics/model")
def get_model_metrics():
    """Return runtime inference metrics."""
    # Try to load static evaluation metrics from experiments/
    static_metrics: Dict[str, Any] = {}
    static_file = Path(__file__).parent / "experiments" / "results_summary.json"
    if static_file.exists():
        with open(static_file) as f:
            static_metrics = json.load(f)

    return {
        "runtime": _metrics_store,
        "evaluation": static_metrics,
    }


@app.post("/detect-vehicles")
async def detect_vehicles(file: UploadFile = File(...)):
    """
    Detect vehicles in a parking-lot image.

    Request: multipart/form-data with field 'file' (JPEG/PNG).
    Response: list of vehicle detections with bounding boxes.
    """
    raw   = await file.read()
    image = _bytes_to_bgr(raw)
    det   = _get_vehicle_detector()

    result = det.detect(image)
    _update_metrics(result["inference_ms"], result.get("model_version", ""))

    return {
        "detections":   result["detections"],
        "count":        len(result["detections"]),
        "inference_ms": result["inference_ms"],
        "model_version": result["model_version"],
        "timestamp":    datetime.utcnow().isoformat(),
    }


@app.post("/detect-occupancy")
async def detect_occupancy(
    file:      UploadFile = File(...),
    zone_name: str        = Form(default="north_terminal"),
):
    """
    Detect slot occupancy from a parking-lot camera image.

    Request: multipart/form-data
      - file:      parking-lot image
      - zone_name: name of the slot-zone definition (default: north_terminal)

    Response: per-slot status + summary statistics.
    """
    raw   = await file.read()
    image = _bytes_to_bgr(raw)
    odet  = _get_occupancy_detector()

    result = odet.analyze(image, zone_name=zone_name)
    _update_metrics(result["inference_ms"])

    return {**result, "timestamp": datetime.utcnow().isoformat()}


@app.post("/detect-plate")
async def detect_plate(file: UploadFile = File(...)):
    """
    Detect license plate(s) and read text via OCR pipeline.

    Request: multipart/form-data with field 'file' (vehicle or full frame).
    Response: plate text + confidence + bounding boxes.
    """
    raw      = await file.read()
    image    = _bytes_to_bgr(raw)
    pipeline = _get_plate_pipeline()

    result = pipeline.run(image)
    _update_metrics(result["inference_ms"])

    # Flatten: return the first/best plate
    plates    = result.get("plates", [])
    best_plate = max(plates, key=lambda p: p.get("plate_confidence", 0), default=None)

    return {
        "plate_text":       best_plate["plate_text"]       if best_plate else None,
        "plate_confidence": best_plate["plate_confidence"] if best_plate else 0.0,
        "plate_bbox":       best_plate["plate_bbox"]       if best_plate else None,
        "all_plates":       plates,
        "inference_ms":     result["inference_ms"],
        "timestamp":        datetime.utcnow().isoformat(),
    }


@app.post("/detect-plate-full")
async def detect_plate_full(file: UploadFile = File(...)):
    """
    Full pipeline: detect all vehicles → read plate from each vehicle region.
    Returns plates for all detected vehicles in the scene.
    """
    raw      = await file.read()
    image    = _bytes_to_bgr(raw)
    pipeline = _get_plate_pipeline()

    result = pipeline.run(image)
    _update_metrics(result["inference_ms"])

    return {**result, "timestamp": datetime.utcnow().isoformat()}
