"""
vehicle_detector.py
-------------------
Wrapper around YOLOv8 for vehicle detection.

Usage:
    detector = VehicleDetector()
    results  = detector.detect(image_array)
    # results: [{"class": "car", "bbox": [x1,y1,x2,y2], "confidence": 0.91}, ...]
"""

from __future__ import annotations

import time
import os
from pathlib import Path
from typing import List, Dict, Any

import numpy as np

# ── Lazy imports (ultralytics heavy; only loaded once) ────────────────────────
_yolo_model = None

# Paths
WEIGHTS_DIR   = Path(__file__).parent.parent / "weights"
FINETUNED_PT  = WEIGHTS_DIR / "best.pt"
PRETRAINED_PT = "yolov8n.pt"   # downloaded automatically on first run

# COCO classes we care about (car = 2, motorcycle = 3, bus = 5, truck = 7)
VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}


def _load_model():
    """Load the model once and cache it in module-level _yolo_model."""
    global _yolo_model
    if _yolo_model is not None:
        return _yolo_model

    from ultralytics import YOLO

    if FINETUNED_PT.exists():
        print(f"[VehicleDetector] Loading fine-tuned weights: {FINETUNED_PT}")
        _yolo_model = YOLO(str(FINETUNED_PT))
    else:
        print(f"[VehicleDetector] Fine-tuned weights not found. Using pretrained {PRETRAINED_PT}.")
        print("[VehicleDetector] Run 'python training/train.py' to fine-tune.")
        _yolo_model = YOLO(PRETRAINED_PT)

    return _yolo_model


class VehicleDetector:
    """
    Wrapper that runs YOLOv8 inference and returns a clean list of detections.
    Thread-safe: the underlying model state is read-only during inference.
    """

    def __init__(self, conf_threshold: float = 0.40, iou_threshold: float = 0.45):
        self.conf = conf_threshold
        self.iou  = iou_threshold
        self.model = _load_model()

    # ── Public API ─────────────────────────────────────────────────────────────

    def detect(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Run vehicle detection on a BGR numpy array (OpenCV format).

        Returns:
            {
                "detections": [{"class": str, "bbox": [x1,y1,x2,y2], "confidence": float}],
                "inference_ms": float,
                "model_version": str
            }
        """
        t0 = time.perf_counter()

        raw = self.model.predict(
            source=image,
            conf=self.conf,
            iou=self.iou,
            verbose=False,
        )[0]  # single image → first result

        inference_ms = (time.perf_counter() - t0) * 1000.0

        detections = []
        if raw.boxes is not None:
            for box in raw.boxes:
                cls_id = int(box.cls[0].item())
                if cls_id not in VEHICLE_CLASSES:
                    continue
                x1, y1, x2, y2 = [round(v) for v in box.xyxy[0].tolist()]
                detections.append({
                    "class":      VEHICLE_CLASSES[cls_id],
                    "bbox":       [x1, y1, x2, y2],
                    "confidence": round(float(box.conf[0].item()), 4),
                })

        return {
            "detections":   detections,
            "inference_ms": round(inference_ms, 2),
            "model_version": "finetuned" if FINETUNED_PT.exists() else "pretrained-coco",
        }

    def detect_from_file(self, image_path: str | Path) -> Dict[str, Any]:
        """Convenience: load image from file path and run detect()."""
        import cv2
        img = cv2.imread(str(image_path))
        if img is None:
            raise ValueError(f"Cannot read image: {image_path}")
        return self.detect(img)
