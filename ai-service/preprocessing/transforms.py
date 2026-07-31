"""
transforms.py
-------------
Data augmentation transforms for fine-tuning the parking vehicle detector.

These transforms simulate real-world parking lot conditions:
  - Brightness/contrast shifts  → day / overcast / golden hour
  - Low-light + noise           → night, poor camera
  - Blur                        → motion, defocus
  - Rain overlay                → synthetic rain streaks
  - Shadow overlay              → tree / structure shadows
  - Horizontal flip             → mirror the lot

Usage (with albumentations):
    from preprocessing.transforms import build_train_transform, build_val_transform

    transform = build_train_transform()
    augmented = transform(image=img_array, bboxes=bboxes, class_labels=labels)
"""

from __future__ import annotations

import random
from typing import Tuple

import numpy as np
import cv2


# ── Pure-numpy augmentation helpers ───────────────────────────────────────────
# We implement these without albumentations so no extra dep is required.
# ultralytics built-in augmentation handles the heavy lifting during training.


def adjust_brightness_contrast(
    image: np.ndarray,
    brightness: float = 0.0,  # -1.0 to 1.0
    contrast: float = 1.0,    # 0.5 to 2.0
) -> np.ndarray:
    """Shift brightness and scale contrast."""
    img = image.astype(np.float32)
    img = img * contrast + brightness * 255
    return np.clip(img, 0, 255).astype(np.uint8)


def add_gaussian_noise(image: np.ndarray, sigma: float = 15.0) -> np.ndarray:
    """Add Gaussian noise to simulate low-light sensor noise."""
    noise = np.random.normal(0, sigma, image.shape).astype(np.float32)
    noisy = image.astype(np.float32) + noise
    return np.clip(noisy, 0, 255).astype(np.uint8)


def apply_motion_blur(image: np.ndarray, kernel_size: int = 7) -> np.ndarray:
    """Horizontal motion blur."""
    kernel = np.zeros((kernel_size, kernel_size))
    kernel[kernel_size // 2, :] = 1.0 / kernel_size
    return cv2.filter2D(image, -1, kernel)


def apply_rain_overlay(image: np.ndarray, intensity: float = 0.4) -> np.ndarray:
    """
    Synthetic rain: draw random near-vertical white streaks then blend.
    """
    h, w = image.shape[:2]
    rain_layer = np.zeros_like(image)
    num_drops  = int(h * w * 0.0005)

    for _ in range(num_drops):
        x  = random.randint(0, w - 1)
        y  = random.randint(0, h - 15)
        dy = random.randint(8, 20)
        dx = random.randint(-1, 1)
        cv2.line(rain_layer, (x, y), (x + dx, y + dy), (200, 200, 200), 1)

    return cv2.addWeighted(image, 1.0, rain_layer, intensity, 0)


def apply_shadow(image: np.ndarray, shadow_ratio: float = 0.5) -> np.ndarray:
    """
    Simulate a diagonal shadow across part of the image.
    """
    h, w = image.shape[:2]
    x1, y1 = random.randint(0, w // 2), 0
    x2, y2 = random.randint(w // 2, w), h
    pts = np.array([[0, 0], [x1, y1], [x2, y2], [0, h]], dtype=np.int32)

    mask = np.zeros((h, w), dtype=np.float32)
    cv2.fillPoly(mask, [pts], 1)

    img_f   = image.astype(np.float32)
    img_f   = img_f - shadow_ratio * img_f * mask[:, :, np.newaxis]
    return np.clip(img_f, 0, 255).astype(np.uint8)


def random_augment(
    image: np.ndarray,
    night_prob:  float = 0.25,
    rain_prob:   float = 0.20,
    blur_prob:   float = 0.20,
    shadow_prob: float = 0.30,
    noise_prob:  float = 0.25,
) -> np.ndarray:
    """
    Apply a random subset of augmentations.
    Designed to be called on training images before passing to YOLO trainer.
    """
    img = image.copy()

    if random.random() < night_prob:
        # Simulate night: darken + add noise
        img = adjust_brightness_contrast(img, brightness=-0.55, contrast=0.6)
        img = add_gaussian_noise(img, sigma=25.0)

    if random.random() < rain_prob:
        img = apply_rain_overlay(img, intensity=random.uniform(0.3, 0.6))

    if random.random() < blur_prob:
        k   = random.choice([3, 5, 7])
        img = apply_motion_blur(img, kernel_size=k)

    if random.random() < shadow_prob:
        img = apply_shadow(img, shadow_ratio=random.uniform(0.3, 0.6))

    if random.random() < noise_prob:
        img = add_gaussian_noise(img, sigma=random.uniform(5, 20))

    # Random brightness jitter (day conditions)
    b = random.uniform(-0.15, 0.15)
    c = random.uniform(0.85, 1.15)
    img = adjust_brightness_contrast(img, brightness=b, contrast=c)

    return img


# ── Condition simulators for robustness evaluation ────────────────────────────

CONDITIONS = {
    "daylight":  lambda img: img,
    "night":     lambda img: add_gaussian_noise(
                    adjust_brightness_contrast(img, brightness=-0.60, contrast=0.55),
                    sigma=30,
                 ),
    "rain":      lambda img: apply_rain_overlay(img, intensity=0.5),
    "shadows":   lambda img: apply_shadow(img, shadow_ratio=0.5),
    "blur":      lambda img: apply_motion_blur(img, kernel_size=9),
    "noise":     lambda img: add_gaussian_noise(img, sigma=30),
}


def apply_condition(image: np.ndarray, condition: str) -> np.ndarray:
    """
    Apply a named condition transform for robustness benchmarking.

    Args:
        image:     BGR numpy array.
        condition: One of "daylight", "night", "rain", "shadows", "blur", "noise".

    Returns:
        Transformed image.
    """
    if condition not in CONDITIONS:
        raise ValueError(f"Unknown condition '{condition}'. Valid: {list(CONDITIONS)}")
    return CONDITIONS[condition](image)
