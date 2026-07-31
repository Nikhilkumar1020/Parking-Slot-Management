"""
plate_ocr.py
------------
Full license plate inference pipeline exposed as a single function.

Pipeline:
  Image → Vehicle Detection → Plate Region → Preprocessing → OCR → Post-processing

Integrates with the existing ParkSystem vehicle registry:
  - Returns plate_text.
  - Node.js compares against vehicles table.
  - If mismatch: security alert via Socket.IO.
"""

from __future__ import annotations

import time
from typing import Dict, Any, List, Optional

import numpy as np

from models.vehicle_detector import VehicleDetector
from models.plate_detector import PlateDetector


class PlateOCRPipeline:
    """
    End-to-end pipeline: full image → plate text for all detected vehicles.
    """

    def __init__(self):
        self.vehicle_detector = VehicleDetector(conf_threshold=0.35)
        self.plate_detector   = PlateDetector()

    def run(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Detect all vehicles in the image, then read plate from each vehicle region.

        Returns:
            {
                "plates": [
                    {
                        "vehicle_bbox": [x1,y1,x2,y2],
                        "vehicle_class": "car",
                        "plate_text": "BR01AB1234",
                        "plate_confidence": 0.88,
                        "plate_bbox": [x1,y1,x2,y2],
                    },
                    ...
                ],
                "inference_ms": float,
            }
        """
        t0 = time.perf_counter()

        # ── 1. Detect vehicles ─────────────────────────────────────────────
        veh_result = self.vehicle_detector.detect(image)
        detections = veh_result["detections"]

        plates: List[Dict[str, Any]] = []

        # ── 2. For each vehicle, crop & OCR plate ──────────────────────────
        for det in detections:
            bbox      = det["bbox"]
            x1, y1, x2, y2 = bbox

            # Crop vehicle from full image
            vehicle_crop = image[max(0, y1):y2, max(0, x1):x2]
            if vehicle_crop.size == 0:
                continue

            plate_result = self.plate_detector.detect_and_read(
                image=vehicle_crop,
                vehicle_bbox=[0, 0, x2 - x1, y2 - y1],
            )

            # Re-map plate_bbox to full-image coordinates
            pb = plate_result.get("plate_bbox")
            abs_plate_bbox = None
            if pb is not None:
                abs_plate_bbox = [pb[0] + x1, pb[1] + y1, pb[2] + x1, pb[3] + y1]

            plates.append({
                "vehicle_bbox":      bbox,
                "vehicle_class":     det["class"],
                "plate_text":        plate_result.get("plate_text"),
                "plate_confidence":  plate_result.get("confidence", 0.0),
                "plate_bbox":        abs_plate_bbox,
            })

        total_ms = (time.perf_counter() - t0) * 1000.0

        return {
            "plates":       plates,
            "inference_ms": round(total_ms, 2),
        }
