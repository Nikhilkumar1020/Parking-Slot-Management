"""
train.py
--------
Fine-tune YOLOv8n on the PKLot parking dataset (or your custom dataset).

Dataset structure expected at ../../datasets/:
  datasets/
  ├── parking.yaml         ← YOLO dataset config
  ├── train/
  │   ├── images/
  │   └── labels/
  ├── val/
  │   ├── images/
  │   └── labels/
  └── test/
      ├── images/
      └── labels/

Usage:
  cd ai-service
  python training/train.py [--epochs 50] [--batch 16] [--model yolov8n.pt]

After training, best weights are saved to:
  ai-service/weights/best.pt
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

# Ensure ai-service is on path
sys.path.insert(0, str(Path(__file__).parent.parent))

ROOT       = Path(__file__).parent.parent.parent   # ParkSystem root
DATASETS   = ROOT / "datasets"
WEIGHTS    = Path(__file__).parent.parent / "weights"
EXPERIMENTS = Path(__file__).parent.parent / "experiments"


def parse_args():
    p = argparse.ArgumentParser(description="Fine-tune YOLOv8 for parking vehicle detection")
    p.add_argument("--model",   default="yolov8n.pt",   help="Base model (yolov8n/s/m.pt)")
    p.add_argument("--epochs",  default=50,  type=int,  help="Training epochs")
    p.add_argument("--batch",   default=16,  type=int,  help="Batch size")
    p.add_argument("--imgsz",   default=640, type=int,  help="Input image size")
    p.add_argument("--device",  default="",             help="cuda device ('' = auto)")
    p.add_argument("--name",    default="parking_v1",   help="Experiment name")
    p.add_argument("--augment", default=True, type=lambda x: x.lower() != "false",
                   help="Enable custom augmentation (default True)")
    return p.parse_args()


def check_dataset(yaml_path: Path):
    if not yaml_path.exists():
        print(f"\n[ERROR] Dataset config not found: {yaml_path}")
        print(
            "\nPlease create datasets/parking.yaml.\n"
            "You can download PKLot from:\n"
            "  https://www.inf.ufpr.br/vri/databases/PKLot/\n"
            "And convert annotations to YOLO format using the convert script:\n"
            "  python training/convert_pklot.py\n"
        )
        sys.exit(1)


def main():
    args = parse_args()

    yaml_path = DATASETS / "parking.yaml"
    check_dataset(yaml_path)

    from ultralytics import YOLO

    print(f"\n{'='*60}")
    print(f"  ParkSystem AI — Vehicle Detector Fine-Tuning")
    print(f"{'='*60}")
    print(f"  Base model : {args.model}")
    print(f"  Dataset    : {yaml_path}")
    print(f"  Epochs     : {args.epochs}")
    print(f"  Batch size : {args.batch}")
    print(f"  Image size : {args.imgsz}")
    print(f"  Experiment : {args.name}")
    print(f"{'='*60}\n")

    WEIGHTS.mkdir(parents=True, exist_ok=True)
    EXPERIMENTS.mkdir(parents=True, exist_ok=True)

    model = YOLO(args.model)

    results = model.train(
        data=str(yaml_path),
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        device=args.device or None,
        project=str(EXPERIMENTS),
        name=args.name,
        # Standard augmentation (ultralytics built-in)
        hsv_h=0.015, hsv_s=0.7, hsv_v=0.4,
        degrees=5.0,
        translate=0.1,
        scale=0.5,
        flipud=0.0,
        fliplr=0.5,
        mosaic=1.0,
        # Robustness: extra brightness/contrast jitter
        erasing=0.4,
        # Save best checkpoint
        save=True,
        save_period=10,
        patience=15,
        verbose=True,
    )

    # ── Copy best weights to ai-service/weights/ ──────────────────────────────
    exp_dir   = EXPERIMENTS / args.name
    best_src  = exp_dir / "weights" / "best.pt"

    if best_src.exists():
        best_dst = WEIGHTS / "best.pt"
        shutil.copy2(best_src, best_dst)
        print(f"\n[✓] Best weights saved to: {best_dst}")
    else:
        print(f"\n[!] best.pt not found at {best_src} — check the experiment directory.")

    print("\n[✓] Training complete. Run 'python training/evaluate.py' next.")


if __name__ == "__main__":
    main()
