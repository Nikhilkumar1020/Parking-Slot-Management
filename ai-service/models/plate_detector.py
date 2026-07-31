"""
plate_detector.py
-----------------
Two-stage license-plate pipeline:
  Stage 1 — YOLOv8 detects the plate region (bounding box).
  Stage 2 — EasyOCR reads the cropped plate text.

Falls back to the vehicle detector's bounding-box bottom-third heuristic
when no dedicated plate weights are available.
"""

from __future__ import annotations

import time
import re
from pathlib import Path
from typing import Dict, Any, Optional

import numpy as np

WEIGHTS_DIR       = Path(__file__).parent.parent / "weights"
PLATE_PT          = WEIGHTS_DIR / "plate_best.pt"   # optional fine-tuned plate detector
VEHICLE_CONF      = 0.30
OCR_LANGUAGES     = ["en"]

# Post-processing: keep only alphanumeric + hyphens
_CLEAN_RE = re.compile(r"[^A-Z0-9\-]")


def _load_ocr():
    """Lazy-load EasyOCR reader (heavy; first call downloads models ~80 MB)."""
    global _ocr_reader
    try:
        return _ocr_reader
    except NameError:
        import easyocr
        _ocr_reader = easyocr.Reader(OCR_LANGUAGES, gpu=False, verbose=False)
        return _ocr_reader


def _load_plate_yolo():
    """Load a dedicated plate-detection YOLO model if weights exist."""
    global _plate_yolo
    try:
        return _plate_yolo
    except NameError:
        if PLATE_PT.exists():
            from ultralytics import YOLO
            _plate_yolo = YOLO(str(PLATE_PT))
        else:
            _plate_yolo = None
        return _plate_yolo


def _crop_plate_heuristic(image: np.ndarray, vehicle_bbox: list) -> np.ndarray:
    """
    Heuristic fallback: plate is typically in the lower-third of the vehicle bbox.
    vehicle_bbox = [x1, y1, x2, y2]
    """
    x1, y1, x2, y2 = vehicle_bbox
    h = y2 - y1
    # Lower third
    py1 = y1 + int(h * 0.65)
    crop = image[py1:y2, x1:x2]
    return crop


class PlateDetector:
    """
    Detects license plate region and reads the plate text via OCR.
    Works with or without dedicated plate-detection weights.
    """

    def __init__(self):
        self.plate_yolo = _load_plate_yolo()
        self.ocr        = _load_ocr()

    # ── Public API ─────────────────────────────────────────────────────────────

    def detect_and_read(
        self,
        image: np.ndarray,
        vehicle_bbox: Optional[list] = None,
    ) -> Dict[str, Any]:
        """
        Detect plate in `image` (full frame or vehicle crop) and OCR it.

        Args:
            image:        BGR numpy array (full parking frame).
            vehicle_bbox: [x1,y1,x2,y2] of the vehicle — used for heuristic
                          crop when no plate detector is available.

        Returns:
            {
                "plate_text":   str | None,
                "plate_bbox":   [x1,y1,x2,y2] | None,
                "confidence":   float,
                "inference_ms": float,
            }
        """
        t0 = time.perf_counter()

        plate_bbox  = None
        plate_crop  = None

        # ── Stage 1: detect plate region ─────────────────────────────────────
        if self.plate_yolo is not None:
            raw = self.plate_yolo.predict(source=image, conf=VEHICLE_CONF, verbose=False)[0]
            if raw.boxes and len(raw.boxes) > 0:
                # Take highest-confidence box
                best = max(raw.boxes, key=lambda b: float(b.conf[0]))
                x1, y1, x2, y2 = [round(v) for v in best.xyxy[0].tolist()]
                plate_bbox = [x1, y1, x2, y2]
                plate_crop = image[y1:y2, x1:x2]
        elif vehicle_bbox is not None:
            plate_crop = _crop_plate_heuristic(image, vehicle_bbox)
        else:
            # No plate model and no vehicle bbox — OCR full image (low quality)
            plate_crop = image

        # ── Stage 2: preprocessing ────────────────────────────────────────────
        plate_crop = _preprocess_plate(plate_crop)

        # ── Stage 3: OCR ─────────────────────────────────────────────────────
        raw_results = self.ocr.readtext(plate_crop, detail=1)

        plate_text   = None
        ocr_conf     = 0.0

        if raw_results:
            # Pick result with highest confidence
            best_r = max(raw_results, key=lambda r: r[2])
            raw_text = best_r[1].upper()
            ocr_conf = float(best_r[2])
            plate_text = _clean_plate(raw_text)

        inference_ms = (time.perf_counter() - t0) * 1000.0

        return {
            "plate_text":   plate_text,
            "plate_bbox":   plate_bbox,
            "confidence":   round(ocr_conf, 4),
            "inference_ms": round(inference_ms, 2),
        }


# ── Preprocessing helpers ─────────────────────────────────────────────────────

def _preprocess_plate(crop: np.ndarray) -> np.ndarray:
    """
    Improve plate legibility for OCR:
      1. Resize to fixed height (keep aspect).
      2. Convert to grayscale.
      3. CLAHE contrast enhancement.
      4. Bilateral filter (noise reduction, edge preservation).
    """
    import cv2

    if crop is None or crop.size == 0:
        return crop

    # Resize to height=64
    h, w = crop.shape[:2]
    if h == 0 or w == 0:
        return crop
    scale = 64 / h
    new_w = max(1, int(w * scale))
    crop  = cv2.resize(crop, (new_w, 64), interpolation=cv2.INTER_CUBIC)

    # Grayscale
    if len(crop.shape) == 3:
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    else:
        gray = crop

    # CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
    gray  = clahe.apply(gray)

    # Bilateral filter
    gray = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)

    return gray


def _clean_plate(text: str) -> str:
    """Strip non-alphanumeric characters and format as uppercase."""
    cleaned = _CLEAN_RE.sub("", text.upper())
    return cleaned if len(cleaned) >= 3 else text.upper()
