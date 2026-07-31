"""
occupancy.py
------------
Slot occupancy detection algorithm.

Algorithm:
  1. Run VehicleDetector on the parking-lot image.
  2. Load predefined slot polygons for the given camera zone.
  3. For each slot polygon, check if any vehicle bounding box overlaps
     it with IoU > threshold (default 0.30).
  4. Return {slot_id: "Occupied" | "Available"} for every slot.

Slot zone files live in:  datasets/slot_zones/<zone_name>.json
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional

import numpy as np

from models.vehicle_detector import VehicleDetector

ZONES_DIR = Path(__file__).parent.parent.parent / "datasets" / "slot_zones"
IOU_THRESHOLD = 0.30       # overlap ratio to call a slot "Occupied"
CENTROID_MODE  = True       # alternative: centroid-in-polygon check


# ── Geometry helpers ──────────────────────────────────────────────────────────

def _bbox_area(b: List[int]) -> float:
    """Area of [x1, y1, x2, y2] bbox."""
    return max(0, b[2] - b[0]) * max(0, b[3] - b[1])


def _intersection_area(a: List[int], b: List[int]) -> float:
    """Intersection area of two bboxes [x1,y1,x2,y2]."""
    ix1 = max(a[0], b[0])
    iy1 = max(a[1], b[1])
    ix2 = min(a[2], b[2])
    iy2 = min(a[3], b[3])
    return max(0, ix2 - ix1) * max(0, iy2 - iy1)


def _iou(a: List[int], b: List[int]) -> float:
    """IoU of two bboxes [x1,y1,x2,y2]."""
    inter = _intersection_area(a, b)
    if inter == 0:
        return 0.0
    union = _bbox_area(a) + _bbox_area(b) - inter
    return inter / union if union > 0 else 0.0


def _poly_to_bbox(polygon: List[List[int]]) -> List[int]:
    """Convert polygon [[x,y],...] to axis-aligned bbox [x1,y1,x2,y2]."""
    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    return [min(xs), min(ys), max(xs), max(ys)]


def _centroid_in_bbox(vehicle_bbox: List[int], slot_bbox: List[int]) -> bool:
    """Check if the centroid of vehicle_bbox falls inside slot_bbox."""
    cx = (vehicle_bbox[0] + vehicle_bbox[2]) / 2
    cy = (vehicle_bbox[1] + vehicle_bbox[3]) / 2
    return (slot_bbox[0] <= cx <= slot_bbox[2]) and (slot_bbox[1] <= cy <= slot_bbox[3])


# ── Zone loading ──────────────────────────────────────────────────────────────

def load_zone(zone_name: str) -> List[Dict]:
    """
    Load slot polygon definitions for a camera zone.

    Returns list of {"id": str, "bbox": [x1,y1,x2,y2]} entries.
    """
    zone_file = ZONES_DIR / f"{zone_name}.json"
    if not zone_file.exists():
        raise FileNotFoundError(
            f"Zone file not found: {zone_file}\n"
            f"Create it in datasets/slot_zones/{zone_name}.json"
        )

    with open(zone_file) as f:
        data = json.load(f)

    slots = []
    for entry in data.get("slots", []):
        polygon = entry["polygon"]
        slots.append({
            "id":      entry["id"],
            "polygon": polygon,
            "bbox":    _poly_to_bbox(polygon),
        })
    return slots


# ── Main occupancy function ───────────────────────────────────────────────────

class OccupancyDetector:
    """
    Determines which predefined parking slots are occupied by detected vehicles.
    """

    def __init__(self, iou_threshold: float = IOU_THRESHOLD):
        self.detector      = VehicleDetector()
        self.iou_threshold = iou_threshold

    def analyze(
        self,
        image: np.ndarray,
        zone_name: str = "north_terminal",
    ) -> Dict[str, Any]:
        """
        Analyze a parking-lot image and return per-slot occupancy status.

        Args:
            image:     BGR numpy array (camera frame).
            zone_name: Name of the slot-zone definition file (without .json).

        Returns:
            {
                "slots": {"A-102": "Occupied", "C-210": "Available", ...},
                "occupied_count":  int,
                "available_count": int,
                "total_slots":     int,
                "occupancy_pct":   float,
                "vehicle_count":   int,
                "inference_ms":    float,
                "detections":      [...],   # raw vehicle detections
            }
        """
        # ── 1. Detect vehicles ────────────────────────────────────────────────
        det_result  = self.detector.detect(image)
        detections  = det_result["detections"]
        inference_ms = det_result["inference_ms"]
        vehicle_bboxes = [d["bbox"] for d in detections]

        # ── 2. Load slot zone ─────────────────────────────────────────────────
        try:
            slots = load_zone(zone_name)
        except FileNotFoundError:
            # Return empty result if zone file not yet created
            return {
                "slots": {},
                "occupied_count": 0,
                "available_count": 0,
                "total_slots": 0,
                "occupancy_pct": 0.0,
                "vehicle_count": len(vehicle_bboxes),
                "inference_ms": inference_ms,
                "detections": detections,
                "warning": f"Zone '{zone_name}' not found. Create datasets/slot_zones/{zone_name}.json",
            }

        # ── 3. Compute occupancy per slot ─────────────────────────────────────
        slot_status: Dict[str, str] = {}
        for slot in slots:
            is_occupied = False
            for vbbox in vehicle_bboxes:
                if CENTROID_MODE:
                    if _centroid_in_bbox(vbbox, slot["bbox"]):
                        is_occupied = True
                        break
                else:
                    if _iou(vbbox, slot["bbox"]) >= self.iou_threshold:
                        is_occupied = True
                        break
            slot_status[slot["id"]] = "Occupied" if is_occupied else "Available"

        occupied_count  = sum(1 for s in slot_status.values() if s == "Occupied")
        available_count = len(slot_status) - occupied_count
        occupancy_pct   = round(occupied_count / len(slot_status) * 100, 1) if slot_status else 0.0

        return {
            "slots":           slot_status,
            "occupied_count":  occupied_count,
            "available_count": available_count,
            "total_slots":     len(slot_status),
            "occupancy_pct":   occupancy_pct,
            "vehicle_count":   len(vehicle_bboxes),
            "inference_ms":    inference_ms,
            "detections":      detections,
        }
