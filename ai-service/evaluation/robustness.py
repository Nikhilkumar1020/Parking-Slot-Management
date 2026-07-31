"""
robustness.py
-------------
Evaluate the detector across synthetic condition subsets to build a
robustness benchmark (per Section 7 of the project design).

Conditions tested:
  daylight | night | rain | shadows | blur | noise | occlusion

Usage:
  cd ai-service
  python evaluation/robustness.py [--weights weights/best.pt]

Outputs:
  ai-service/experiments/robustness_report.md
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from preprocessing.transforms import apply_condition, CONDITIONS
from evaluation.metrics import compute_map_at_iou, compute_map_50_95, precision_recall_f1, match_detections

ROOT        = Path(__file__).parent.parent.parent
DATASETS    = ROOT / "datasets"
EXPERIMENTS = Path(__file__).parent.parent / "experiments"
WEIGHTS_DIR = Path(__file__).parent.parent / "weights"


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--weights", default=str(WEIGHTS_DIR / "best.pt"))
    p.add_argument("--conf",    default=0.40, type=float)
    p.add_argument("--iou",     default=0.50, type=float)
    return p.parse_args()


def load_labels(label_path: Path) -> list:
    """Load YOLO format labels [[cx,cy,w,h,cls], ...] and convert to [x1,y1,x2,y2]."""
    if not label_path.exists():
        return []
    boxes = []
    for line in label_path.read_text().strip().splitlines():
        parts = list(map(float, line.split()))
        if len(parts) < 5:
            continue
        cx, cy, w, h = parts[1], parts[2], parts[3], parts[4]
        boxes.append([cx - w/2, cy - h/2, cx + w/2, cy + h/2])
    return boxes


def evaluate_condition_subset(
    model,
    images_dir: Path,
    labels_dir: Path,
    condition: str,
    conf: float,
) -> dict:
    """
    Run model on all images in images_dir (with condition transform applied),
    compare to ground-truth labels, compute metrics.
    """
    image_files = list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.png"))
    if not image_files:
        return {}

    all_pred_boxes, all_pred_confs, all_gt_boxes = [], [], []
    latencies = []

    for img_path in image_files[:200]:
        img = cv2.imread(str(img_path))
        if img is None:
            continue

        # Apply synthetic condition
        if condition != "daylight":
            img = apply_condition(img, condition)

        h, w = img.shape[:2]

        t0 = time.perf_counter()
        raw = model.predict(img, conf=conf, verbose=False)[0]
        latencies.append((time.perf_counter() - t0) * 1000)

        # Parse predictions (normalized to image dims)
        pred_boxes, pred_confs = [], []
        if raw.boxes is not None:
            for box in raw.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                pred_boxes.append([x1/w, y1/h, x2/w, y2/h])
                pred_confs.append(float(box.conf[0]))

        # Ground truth
        label_file = labels_dir / img_path.with_suffix(".txt").name
        gt_boxes   = load_labels(label_file)

        all_pred_boxes.append(pred_boxes)
        all_pred_confs.append(pred_confs)
        all_gt_boxes.append(gt_boxes)

    map50    = compute_map_at_iou(all_pred_boxes, all_pred_confs, all_gt_boxes, 0.50)
    map50_95 = compute_map_50_95(all_pred_boxes, all_pred_confs, all_gt_boxes)

    # Aggregate TP/FP/FN at IoU=0.50
    total_tp = total_fp = total_fn = 0
    for pbs, gbs in zip(all_pred_boxes, all_gt_boxes):
        tp, fp, fn = match_detections(pbs, gbs, iou_thresh=0.50)
        total_tp += tp; total_fp += fp; total_fn += fn

    precision, recall, f1 = precision_recall_f1(total_tp, total_fp, total_fn)
    avg_ms = round(float(np.mean(latencies)), 2) if latencies else None

    return {
        "condition":   condition,
        "n_images":    len(latencies),
        "precision":   precision,
        "recall":      recall,
        "f1":          f1,
        "mAP50":       map50,
        "mAP50_95":    map50_95,
        "avg_ms":      avg_ms,
    }


def render_robustness_report(results: list) -> str:
    lines = [
        "# Robustness Evaluation Report",
        f"\n**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "\n## Per-Condition Metrics\n",
        "| Condition | Images | Precision | Recall | F1 | mAP@0.5 | mAP@0.5:0.95 | Latency (ms) |",
        "|-----------|--------|-----------|--------|----|---------|--------------|--------------|",
    ]
    for r in results:
        cond = r.get("condition", "—").capitalize()
        n    = r.get("n_images", "—")
        p    = r.get("precision", "—")
        rec  = r.get("recall", "—")
        f1   = r.get("f1", "—")
        m50  = r.get("mAP50", "—")
        m95  = r.get("mAP50_95", "—")
        ms   = r.get("avg_ms", "—")
        lines.append(f"| {cond} | {n} | {p} | {rec} | {f1} | {m50} | {m95} | {ms} |")

    lines += [
        "\n## Failure Analysis\n",
        "_Fill in observations after reviewing per-condition results._",
        "\n### Hypothesis",
        "- Night mAP degradation: insufficient low-light training samples.",
        "- Rain: false positives on water reflections.",
        "\n### Improvement Steps",
        "1. Add targeted augmentation (brightness jitter, rain overlay).",
        "2. Collect or synthesize additional night/rain training samples.",
        "3. Retrain (Model V2) and compare robustness table.",
        "\n### V1 vs V2 Comparison",
        "| Condition | V1 mAP@0.5 | V2 mAP@0.5 | Δ |",
        "|-----------|-----------|-----------|---|",
        "| Night     | _tbd_     | _tbd_     | — |",
        "| Rain      | _tbd_     | _tbd_     | — |",
    ]
    return "\n".join(lines)


def main():
    args = parse_args()

    weights_path = Path(args.weights)
    if not weights_path.exists():
        print(f"[ERROR] Weights not found: {weights_path}")
        sys.exit(1)

    from ultralytics import YOLO
    model = YOLO(str(weights_path))
    print(f"[Robustness] Loaded: {weights_path}")

    test_images_base  = DATASETS / "test"
    test_labels_base  = DATASETS / "test" / "labels"

    results = []
    all_conditions = list(CONDITIONS.keys())

    for cond in all_conditions:
        cond_img_dir = test_images_base / cond / "images"
        cond_lbl_dir = test_images_base / cond / "labels"

        # Fall back to main test images if per-condition dir doesn't exist
        img_dir = cond_img_dir if cond_img_dir.exists() else test_images_base / "images"
        lbl_dir = cond_lbl_dir if cond_lbl_dir.exists() else test_labels_base

        if not img_dir.exists():
            print(f"[Robustness] Skipping '{cond}' — no images found at {img_dir}")
            continue

        print(f"[Robustness] Evaluating condition: {cond} ...")
        res = evaluate_condition_subset(model, img_dir, lbl_dir, cond, args.conf)
        if res:
            results.append(res)

    EXPERIMENTS.mkdir(parents=True, exist_ok=True)

    report = render_robustness_report(results)
    report_path = EXPERIMENTS / "robustness_report.md"
    report_path.write_text(report, encoding="utf-8")
    print(f"\n[✓] Robustness report: {report_path}")

    json_path = EXPERIMENTS / "robustness_results.json"
    json_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"[✓] JSON results:      {json_path}")

    # Print table to console
    print("\n" + "="*80)
    for r in results:
        print(f"  {r['condition']:12s}  mAP@0.5={r.get('mAP50','—')}  mAP@0.5:0.95={r.get('mAP50_95','—')}")
    print("="*80)


if __name__ == "__main__":
    main()
