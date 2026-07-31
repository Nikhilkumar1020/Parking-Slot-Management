"""
convert_pklot.py
----------------
Convert the PKLot dataset XML annotations to YOLO format and organize
the directory structure expected by parking.yaml.

PKLot download: https://www.inf.ufpr.br/vri/databases/PKLot/
Expected input layout:
  PKLot/
  └── PKLot/
      ├── PUCPR/
      │   ├── Cloudy/ Rainy/ Sunny/
      │   │   └── YYYY-MM-DD/
      │   │       ├── *.jpg
      │   │       └── *.xml
      ├── UFPR04/
      └── UFPR05/

Output layout:
  datasets/
  ├── train/images/ train/labels/
  ├── val/images/   val/labels/
  └── test/images/  test/labels/

Usage:
  python training/convert_pklot.py --pklot-root path/to/PKLot/PKLot
"""

from __future__ import annotations

import argparse
import random
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT    = Path(__file__).parent.parent.parent
DATASET = ROOT / "datasets"

SPLITS = {"train": 0.70, "val": 0.15, "test": 0.15}

# PKLot only annotates: car=0
CLASS_MAP = {"car": 0, "bus": 1, "truck": 1}   # merge bus+truck → truck class


def xml_to_yolo(xml_path: Path, img_w: int, img_h: int) -> list[str]:
    """
    Parse PKLot XML and return YOLO annotation lines.
    PKLot XML structure:
      <parking>
        <space id="..." occupied="0|1">
          <contour>
            <point x="..." y="..." />
            ...
          </contour>
        </space>
      </parking>
    We create a bounding box from the 4 contour points of each OCCUPIED space.
    """
    lines = []
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except ET.ParseError:
        return lines

    for space in root.findall("space"):
        occupied = space.get("occupied", "0")
        if occupied != "1":
            continue  # Skip empty spaces

        points = space.findall(".//point")
        if len(points) < 2:
            continue

        xs = [int(p.get("x", 0)) for p in points]
        ys = [int(p.get("y", 0)) for p in points]

        x_min, x_max = min(xs), max(xs)
        y_min, y_max = min(ys), max(ys)

        # Normalize to [0,1]
        cx = ((x_min + x_max) / 2) / img_w
        cy = ((y_min + y_max) / 2) / img_h
        bw = (x_max - x_min) / img_w
        bh = (y_max - y_min) / img_h

        # Clamp
        cx = max(0.0, min(1.0, cx))
        cy = max(0.0, min(1.0, cy))
        bw = max(0.001, min(1.0, bw))
        bh = max(0.001, min(1.0, bh))

        lines.append(f"0 {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")

    return lines


def collect_pairs(pklot_root: Path) -> list[tuple[Path, Path]]:
    """Find all (image_path, xml_path) pairs in the PKLot root."""
    pairs = []
    for img_path in pklot_root.rglob("*.jpg"):
        xml_path = img_path.with_suffix(".xml")
        if xml_path.exists():
            pairs.append((img_path, xml_path))
    print(f"[Convert] Found {len(pairs)} image-annotation pairs.")
    return pairs


def split_pairs(pairs: list, splits: dict, seed: int = 42) -> dict:
    """Random-shuffle and split pairs into train/val/test."""
    random.seed(seed)
    random.shuffle(pairs)
    n = len(pairs)
    n_train = int(n * splits["train"])
    n_val   = int(n * splits["val"])
    return {
        "train": pairs[:n_train],
        "val":   pairs[n_train:n_train + n_val],
        "test":  pairs[n_train + n_val:],
    }


def write_split(name: str, pairs: list[tuple[Path, Path]], out_root: Path):
    img_out = out_root / name / "images"
    lbl_out = out_root / name / "labels"
    img_out.mkdir(parents=True, exist_ok=True)
    lbl_out.mkdir(parents=True, exist_ok=True)

    skipped = 0
    for img_path, xml_path in pairs:
        # Read image dimensions without loading pixel data
        try:
            import cv2
            img = cv2.imread(str(img_path))
            if img is None:
                skipped += 1
                continue
            h, w = img.shape[:2]
        except Exception:
            skipped += 1
            continue

        yolo_lines = xml_to_yolo(xml_path, w, h)
        if not yolo_lines:
            skipped += 1
            continue  # Skip frames with no occupied spaces

        # Copy image
        dst_img = img_out / img_path.name
        shutil.copy2(img_path, dst_img)

        # Write label
        dst_lbl = lbl_out / img_path.with_suffix(".txt").name
        dst_lbl.write_text("\n".join(yolo_lines), encoding="utf-8")

    total  = len(pairs)
    kept   = total - skipped
    print(f"  [{name}] {kept}/{total} frames converted  ({skipped} skipped — no cars or unreadable)")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--pklot-root", required=True, help="Path to PKLot/PKLot/ directory")
    p.add_argument("--out",        default=str(DATASET), help="Output datasets/ root")
    p.add_argument("--seed",       default=42, type=int)
    args = p.parse_args()

    pklot_root = Path(args.pklot_root)
    out_root   = Path(args.out)

    if not pklot_root.exists():
        print(f"[ERROR] PKLot root not found: {pklot_root}")
        return

    print(f"\n[Convert] PKLot root : {pklot_root}")
    print(f"[Convert] Output root: {out_root}\n")

    pairs  = collect_pairs(pklot_root)
    splits = split_pairs(pairs, SPLITS, seed=args.seed)

    for split_name, split_pairs_list in splits.items():
        write_split(split_name, split_pairs_list, out_root)

    print(f"\n[✓] Dataset ready at: {out_root}")
    print(f"    Now run: python training/train.py")


if __name__ == "__main__":
    main()
