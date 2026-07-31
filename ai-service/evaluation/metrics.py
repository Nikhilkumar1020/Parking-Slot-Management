"""
metrics.py
----------
Helper functions for computing detection metrics from raw predictions.
Used by evaluate.py and robustness.py for custom metric calculation
when ultralytics val is not run directly.
"""

from __future__ import annotations

from typing import List, Tuple, Dict

import numpy as np


# ── IoU ───────────────────────────────────────────────────────────────────────

def compute_iou(box_a: List[float], box_b: List[float]) -> float:
    """
    Compute IoU between two bboxes [x1, y1, x2, y2].
    """
    xi1 = max(box_a[0], box_b[0])
    yi1 = max(box_a[1], box_b[1])
    xi2 = min(box_a[2], box_b[2])
    yi2 = min(box_a[3], box_b[3])

    inter = max(0, xi2 - xi1) * max(0, yi2 - yi1)
    if inter == 0:
        return 0.0

    area_a = (box_a[2] - box_a[0]) * (box_a[3] - box_a[1])
    area_b = (box_b[2] - box_b[0]) * (box_b[3] - box_b[1])
    union  = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


# ── Precision / Recall ────────────────────────────────────────────────────────

def match_detections(
    pred_boxes: List[List[float]],
    gt_boxes:   List[List[float]],
    iou_thresh: float = 0.50,
) -> Tuple[int, int, int]:
    """
    Match predicted boxes to ground-truth boxes at an IoU threshold.

    Returns:
        (TP, FP, FN)
    """
    gt_matched = [False] * len(gt_boxes)
    tp = fp = 0

    for pred in pred_boxes:
        best_iou = 0.0
        best_idx = -1
        for i, gt in enumerate(gt_boxes):
            if gt_matched[i]:
                continue
            iou = compute_iou(pred, gt)
            if iou > best_iou:
                best_iou = iou
                best_idx = i
        if best_iou >= iou_thresh and best_idx >= 0:
            tp += 1
            gt_matched[best_idx] = True
        else:
            fp += 1

    fn = gt_matched.count(False)
    return tp, fp, fn


def precision_recall_f1(tp: int, fp: int, fn: int) -> Tuple[float, float, float]:
    """Compute precision, recall, and F1 from TP/FP/FN counts."""
    p  = tp / (tp + fp + 1e-9)
    r  = tp / (tp + fn + 1e-9)
    f1 = 2 * p * r / (p + r + 1e-9)
    return round(p, 4), round(r, 4), round(f1, 4)


# ── Average Precision (AP) ────────────────────────────────────────────────────

def compute_ap(recalls: np.ndarray, precisions: np.ndarray) -> float:
    """
    Compute average precision using the 101-point interpolation method.
    recalls and precisions must be sorted by confidence descending.
    """
    recalls    = np.concatenate([[0.0], recalls, [1.0]])
    precisions = np.concatenate([[0.0], precisions, [0.0]])

    # Make precisions monotonically decreasing from the right
    for i in range(len(precisions) - 2, -1, -1):
        precisions[i] = max(precisions[i], precisions[i + 1])

    indices = np.where(recalls[1:] != recalls[:-1])[0]
    ap = float(np.sum((recalls[indices + 1] - recalls[indices]) * precisions[indices + 1]))
    return round(ap, 4)


def compute_map_at_iou(
    all_pred_boxes:  List[List[List[float]]],   # per image: [[x1,y1,x2,y2], ...]
    all_pred_confs:  List[List[float]],          # per image: [conf, ...]
    all_gt_boxes:    List[List[List[float]]],    # per image: [[x1,y1,x2,y2], ...]
    iou_thresh: float = 0.50,
) -> float:
    """
    Compute mAP@iou_thresh across all images for a single class.
    """
    records = []  # (confidence, is_tp)

    for pred_boxes, pred_confs, gt_boxes in zip(all_pred_boxes, all_pred_confs, all_gt_boxes):
        gt_matched = [False] * len(gt_boxes)
        for bbox, conf in sorted(zip(pred_boxes, pred_confs), key=lambda x: -x[1]):
            best_iou = 0.0
            best_idx = -1
            for i, gt in enumerate(gt_boxes):
                if gt_matched[i]:
                    continue
                iou = compute_iou(bbox, gt)
                if iou > best_iou:
                    best_iou = iou
                    best_idx = i
            if best_iou >= iou_thresh and best_idx >= 0:
                records.append((conf, 1))
                gt_matched[best_idx] = True
            else:
                records.append((conf, 0))

    if not records:
        return 0.0

    records.sort(key=lambda x: -x[0])
    confs, tps = zip(*records)

    cum_tp = np.cumsum(tps)
    cum_fp = np.cumsum([1 - t for t in tps])
    total_gt = sum(len(g) for g in all_gt_boxes)

    recalls    = cum_tp / (total_gt + 1e-9)
    precisions = cum_tp / (cum_tp + cum_fp + 1e-9)

    return compute_ap(recalls, precisions)


def compute_map_50_95(
    all_pred_boxes: List[List[List[float]]],
    all_pred_confs: List[List[float]],
    all_gt_boxes:   List[List[List[float]]],
) -> float:
    """mAP averaged over IoU thresholds 0.50 to 0.95 (step 0.05)."""
    thresholds = [round(t, 2) for t in np.arange(0.50, 1.00, 0.05)]
    aps = [
        compute_map_at_iou(all_pred_boxes, all_pred_confs, all_gt_boxes, iou)
        for iou in thresholds
    ]
    return round(float(np.mean(aps)), 4)
