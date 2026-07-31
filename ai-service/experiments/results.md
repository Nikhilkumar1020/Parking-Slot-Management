# Robustness Evaluation Report

**Status**: Awaiting model training. Run `python training/train.py` then `python evaluation/robustness.py` to populate this file with real results.

## Per-Condition Metrics

| Condition | Images | Precision | Recall | F1 | mAP@0.5 | mAP@0.5:0.95 | Latency (ms) |
|-----------|--------|-----------|--------|----|---------|--------------|--------------|
| Daylight  | —      | —         | —      | —  | —       | —            | —            |
| Night     | —      | —         | —      | —  | —       | —            | —            |
| Rain      | —      | —         | —      | —  | —       | —            | —            |
| Shadows   | —      | —         | —      | —  | —       | —            | —            |
| Blur      | —      | —         | —      | —  | —       | —            | —            |
| Noise     | —      | —         | —      | —  | —       | —            | —            |

## Failure Analysis

_To be filled in after reviewing per-condition results._

### Hypothesis
- Night mAP degradation: insufficient low-light training samples.
- Rain: false positives on water reflections.

### Improvement Steps
1. Add targeted augmentation (brightness jitter, rain overlay).
2. Collect or synthesize additional night/rain training samples.
3. Retrain (Model V2) and compare robustness table.
