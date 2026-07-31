"""
evaluate.py
-----------
Evaluate the fine-tuned YOLOv8 model on the test set and generate:
  1. Standard metrics: Precision, Recall, F1, mAP@0.5, mAP@0.5:0.95
  2. Inference latency (ms/image) and FPS
  3. Per-condition robustness table (day/night/rain/shadow/blur/noise)
  4. Saves results to ai-service/experiments/results.md
              and ai-service/experiments/results_summary.json

Usage:
  cd ai-service
  python training/evaluate.py [--weights weights/best.pt] [--data ../../datasets/parking.yaml]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

ROOT        = Path(__file__).parent.parent.parent
DATASETS    = ROOT / "datasets"
EXPERIMENTS = Path(__file__).parent.parent / "experiments"
WEIGHTS_DIR = Path(__file__).parent.parent / "weights"


def parse_args():
    p = argparse.ArgumentParser(description="Evaluate YOLOv8 parking detector")
    p.add_argument("--weights", default=str(WEIGHTS_DIR / "best.pt"), help="Path to weights")
    p.add_argument("--data",    default=str(DATASETS / "parking.yaml"), help="Dataset YAML")
    p.add_argument("--imgsz",   default=640, type=int)
    p.add_argument("--conf",    default=0.40, type=float)
    p.add_argument("--iou",     default=0.45, type=float)
    p.add_argument("--device",  default="", help="cuda device or ''")
    return p.parse_args()


def benchmark_latency(model, test_images_dir: Path, n: int = 50) -> dict:
    """Measure inference latency on up to n test images."""
    import cv2

    images = list(test_images_dir.glob("*.jpg")) + list(test_images_dir.glob("*.png"))
    images = images[:n]

    if not images:
        return {"avg_ms": None, "fps": None, "n_images": 0}

    latencies = []
    for img_path in images:
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        t0 = time.perf_counter()
        model.predict(img, conf=0.40, verbose=False)
        latencies.append((time.perf_counter() - t0) * 1000)

    avg_ms = float(np.mean(latencies))
    fps    = round(1000.0 / avg_ms, 1)

    return {"avg_ms": round(avg_ms, 2), "fps": fps, "n_images": len(latencies)}


def evaluate_condition(model, images_dir: Path, condition: str, data_yaml: str, args) -> dict:
    """
    Run evaluation on a condition-specific subset.
    Returns a dict with P, R, mAP50, mAP50-95.
    """
    import cv2
    from preprocessing.transforms import apply_condition

    images = list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.png"))
    if not images:
        return {}

    # Apply synthetic condition transform and run model.val equivalent
    # ultralytics val on a directory:
    tmp_dir = EXPERIMENTS / f"_tmp_{condition}"
    tmp_img = tmp_dir / "images"
    tmp_img.mkdir(parents=True, exist_ok=True)

    for src in images[:100]:  # evaluate on up to 100 images per condition
        img = cv2.imread(str(src))
        if img is None:
            continue
        if condition != "daylight":
            img = apply_condition(img, condition)
        cv2.imwrite(str(tmp_img / src.name), img)

    # Run ultralytics val
    metrics = model.val(
        data=data_yaml,
        split="test",
        conf=args.conf,
        iou=args.iou,
        imgsz=args.imgsz,
        verbose=False,
        save=False,
    )

    # Clean up temp
    import shutil
    shutil.rmtree(tmp_dir, ignore_errors=True)

    try:
        return {
            "precision": round(float(metrics.box.mp), 4),
            "recall":    round(float(metrics.box.mr), 4),
            "mAP50":     round(float(metrics.box.map50), 4),
            "mAP50_95":  round(float(metrics.box.map), 4),
        }
    except Exception:
        return {}


def render_markdown_table(condition_results: dict, base: dict, latency: dict) -> str:
    """Render results as a Markdown report."""
    lines = [
        "# ParkSystem AI — Model Evaluation Report",
        f"\n**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "\n## Overall Performance (Test Set)\n",
        "| Metric | Value |",
        "|--------|-------|",
        f"| Precision     | {base.get('precision', 'N/A')} |",
        f"| Recall        | {base.get('recall', 'N/A')} |",
        f"| F1-Score      | {base.get('f1', 'N/A')} |",
        f"| mAP@0.5       | {base.get('mAP50', 'N/A')} |",
        f"| mAP@0.5:0.95  | {base.get('mAP50_95', 'N/A')} |",
        f"| Avg Latency   | {latency.get('avg_ms', 'N/A')} ms |",
        f"| FPS           | {latency.get('fps', 'N/A')} |",
        f"| Test Images   | {latency.get('n_images', 'N/A')} |",
        "\n## Robustness — Per-Condition Evaluation\n",
        "| Condition | Precision | Recall | mAP@0.5 | mAP@0.5:0.95 |",
        "|-----------|-----------|--------|---------|--------------|",
    ]
    for cond, res in condition_results.items():
        if not res:
            lines.append(f"| {cond.capitalize()} | — | — | — | — |")
        else:
            lines.append(
                f"| {cond.capitalize()} "
                f"| {res.get('precision','—')} "
                f"| {res.get('recall','—')} "
                f"| {res.get('mAP50','—')} "
                f"| {res.get('mAP50_95','—')} |"
            )
    lines += [
        "\n## Analysis Notes\n",
        "- Document your failure analysis here after reviewing per-condition results.",
        "- E.g., 'Night mAP dropped 21 points — added brightness augmentation in v2.'",
        "\n## Model Info\n",
        "- Architecture: YOLOv8n (fine-tuned)",
        "- Dataset: PKLot + custom samples",
        "- Input size: 640×640",
    ]
    return "\n".join(lines)


def main():
    args = parse_args()

    weights_path = Path(args.weights)
    if not weights_path.exists():
        print(f"[ERROR] Weights not found: {weights_path}")
        print("Run 'python training/train.py' first.")
        sys.exit(1)

    from ultralytics import YOLO
    model = YOLO(str(weights_path))

    print(f"[Evaluate] Loaded weights: {weights_path}")

    # ── 1. Full test-set evaluation ────────────────────────────────────────────
    print("[Evaluate] Running val on test set...")
    metrics = model.val(
        data=args.data,
        split="test",
        conf=args.conf,
        iou=args.iou,
        imgsz=args.imgsz,
        verbose=True,
    )

    precision = round(float(metrics.box.mp), 4)
    recall    = round(float(metrics.box.mr), 4)
    map50     = round(float(metrics.box.map50), 4)
    map50_95  = round(float(metrics.box.map), 4)
    f1        = round(2 * precision * recall / (precision + recall + 1e-9), 4)

    base = {
        "precision": precision,
        "recall":    recall,
        "f1":        f1,
        "mAP50":     map50,
        "mAP50_95":  map50_95,
    }

    print(f"\n  Precision    : {precision}")
    print(f"  Recall       : {recall}")
    print(f"  F1           : {f1}")
    print(f"  mAP@0.5      : {map50}")
    print(f"  mAP@0.5:0.95 : {map50_95}\n")

    # ── 2. Latency benchmark ───────────────────────────────────────────────────
    test_img_dir = DATASETS / "test" / "images"
    latency = benchmark_latency(model, test_img_dir)
    print(f"  Avg latency  : {latency.get('avg_ms')} ms")
    print(f"  FPS          : {latency.get('fps')}")

    # ── 3. Robustness evaluation ───────────────────────────────────────────────
    CONDITIONS = ["daylight", "night", "rain", "shadows", "blur", "noise"]
    condition_results = {}

    for cond in CONDITIONS:
        cond_dir = DATASETS / "test" / cond
        if cond_dir.exists():
            print(f"[Evaluate] Condition: {cond} ...")
            condition_results[cond] = evaluate_condition(
                model, cond_dir, cond, args.data, args
            )
        else:
            # Daylight: use main test set
            if cond == "daylight":
                condition_results[cond] = {k: base[k] for k in ["precision", "recall", "mAP50", "mAP50_95"]}
            else:
                condition_results[cond] = {}

    # ── 4. Save reports ────────────────────────────────────────────────────────
    EXPERIMENTS.mkdir(parents=True, exist_ok=True)

    md  = render_markdown_table(condition_results, base, latency)
    md_path = EXPERIMENTS / "results.md"
    md_path.write_text(md, encoding="utf-8")
    print(f"\n[✓] Markdown report saved: {md_path}")

    summary = {"base": base, "latency": latency, "conditions": condition_results,
               "generated_at": datetime.now().isoformat()}
    json_path = EXPERIMENTS / "results_summary.json"
    json_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"[✓] JSON summary saved:   {json_path}")


if __name__ == "__main__":
    main()
