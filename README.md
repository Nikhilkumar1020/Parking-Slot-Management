# ParkSystem AI 🚗🤖

> **AI-Powered Real-Time Smart Parking Management System with Computer Vision**

ParkSystem combines **enterprise-grade parking management** with a **computer-vision AI subsystem** for automatic vehicle detection, slot occupancy inference, and license plate recognition — all integrated into a live, WebSocket-driven dashboard.

---

## Architecture

```
                     PARKSYSTEM AI
                          │
       ┌──────────────────┴─────────────────┐
       │                                    │
Parking Management                   AI/CV Service
       │                                    │
React + Node.js                    Python + PyTorch
SQLite + Socket.IO                          │
RBAC + Reservations           ┌─────────────┴────────────┐
Visitors + Vehicles           │                          │
                          Vehicle                  License Plate
                          Detection                 Detection + OCR
                              │                          │
                              └──────────────┬───────────┘
                                             │
                                     Slot Occupancy
                                             │
                                        Node.js API
                                             │
                                         Socket.IO
                                             │
                                     React Live Map
                                             │
                         ┌───────────────────┼──────────────────┐
                         ▼                   ▼                  ▼
                   AI Control          AI Monitoring       Security
                    Center              Dashboard           Alerts
```

---

## Features

### 🤖 AI & Computer Vision

| Feature | Description |
|---------|-------------|
| **AI Parking Occupancy Detection** | Upload a parking-lot camera frame → YOLOv8 detects vehicles → maps them to predefined slot polygons → broadcasts `Occupied`/`Available` per slot via Socket.IO |
| **Vehicle Detection** | Fine-tuned YOLOv8n model (pretrained on COCO, fine-tuned on PKLot dataset) |
| **License Plate Detection + OCR** | Two-stage pipeline: YOLOv8 plate region → CLAHE + bilateral filter preprocessing → EasyOCR → regex post-processing |
| **AI Vehicle Registry Verification** | OCR'd plate is checked against the vehicle registry; unregistered plates trigger live security alerts |
| **Robustness Benchmark** | Evaluation under daylight / night / rain / shadow / blur / noise conditions |
| **ML Performance Monitoring** | Precision, Recall, F1, mAP@0.5, mAP@0.5:0.95, inference latency, FPS — visible in the Reports dashboard |
| **AI Control Center** | Dedicated React page: upload image → see bounding boxes overlaid → per-slot status grid |

### 🅿️ Parking Management

- **AI-Powered Live Parking Map** — Manual or AI mode; AI mode listens to `ai:occupancy-update` Socket.IO events in real time
- **Reservation System** — Create, approve, check-in, and cancel bookings
- **Visitor Management** — Check-in/out with access control
- **Vehicle Registry** — Register, verify, and track vehicles (now used by plate OCR)
- **Reports & Analytics** — Role-specific KPIs + AI Monitoring tab with ML metrics

### 🏢 Enterprise Platform

- **Role-Based Access Control** — 6 roles: Super Admin, Facility Manager, Parking Administrator, Security Officer, Employee, Visitor
- **JWT Authentication** — Hashed passwords, Bearer token auth, token_version liveness checks
- **Role-Based Notifications** — Targeted Socket.IO rooms; AI generates security alerts
- **Global Dark/Light Theme** — Material Design 3 color tokens via CSS variables
- **Toast Notifications** — In-app real-time alerts (no browser `alert()`)
- **Automated Email Pipeline** — QR code email confirmations on reservation approval

---

## Model Metrics

> Populated after running `python training/evaluate.py`. Fill in with your actual measured results.

| Metric | Value |
|--------|-------|
| Precision | — |
| Recall | — |
| F1-Score | — |
| mAP@0.5 | — |
| mAP@0.5:0.95 | — |
| Avg Inference Latency | — ms |
| FPS | — |

### Robustness (Per-Condition)

> Populated after running `python evaluation/robustness.py`

| Condition | Precision | Recall | mAP@0.5 | mAP@0.5:0.95 |
|-----------|-----------|--------|---------|--------------|
| Daylight | — | — | — | — |
| Night | — | — | — | — |
| Rain | — | — | — | — |
| Shadow | — | — | — | — |
| Blur | — | — | — | — |
| Noise | — | — | — | — |

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- Python 3.10+
- npm v9+

### 1. Clone / Download
```bash
git clone https://github.com/your-username/parksystem.git
cd parksystem
```

### 2. Install Node dependencies
```bash
npm run install:all
```

### 3. Install Python AI dependencies
```bash
cd ai-service
pip install -r requirements.txt
```

### 4. Start the Node.js backend + React dev server
```bash
npm run dev
```
- Frontend: `http://localhost:5173` *(Note: Google Sign-In requires exactly port 5173. If it starts on 5174+, kill the process on 5173 and restart)*
- Backend API: `http://localhost:5000`

### 5. Start the Python AI service (separate terminal)
```bash
cd ai-service
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```
- AI Service: `http://localhost:8000`
- Health check: `http://localhost:8000/health`

---

## Environment Variables

Create a `.env` file in `backend/`:
```
PORT=5000
JWT_SECRET=your_super_secret_key_here
NODE_ENV=production
AI_SERVICE_URL=http://localhost:8000
```

> ⚠️ **Never commit your `.env` file.** It is already in `.gitignore`.

---

## ML Training Pipeline

### Download Dataset
```
PKLot (Parking Lot Dataset)
https://www.inf.ufpr.br/vri/databases/PKLot/
```
Place images + YOLO-format labels in `datasets/train/`, `datasets/val/`, `datasets/test/`.

### Fine-tune the detector
```bash
cd ai-service
python training/train.py --epochs 50 --batch 16
# Saves best weights to: ai-service/weights/best.pt
```

### Evaluate
```bash
python training/evaluate.py
# Generates: ai-service/experiments/results.md
```

### Robustness benchmark
```bash
python evaluation/robustness.py
# Generates: ai-service/experiments/robustness_report.md
```

---

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@parksystem.com | superadmin |
| Facility Manager | manager@parksystem.com | manager123 |
| Parking Administrator | parking@parksystem.com | parking123 |
| Security Officer | security@parksystem.com | security123 |
| Employee | employee@parksystem.com | employee123 |
| Visitor | visitor@parksystem.com | visitor123 |

---

## Project Structure

```
ParkSystem/
├── backend/
│   ├── server.js         # Express + Socket.IO + AI proxy endpoints
│   ├── db.js             # SQLite schema (incl. ai_inference_log, ai_metrics)
│   └── parksystem.db
│
├── smart_parking_react/
│   └── src/
│       ├── pages/
│       │   ├── AIControlCenter.jsx    ← NEW: occupancy detection + plate OCR UI
│       │   ├── LiveParkingMap.jsx     ← Manual ↔ AI mode toggle
│       │   └── ReportsAnalytics.jsx  ← AI Monitoring tab
│       ├── context/       # AuthContext, SocketContext, ToastContext
│       ├── components/    # Layout, shared components
│       └── hooks/
│
├── ai-service/
│   ├── api.py                        # FastAPI entrypoint (5 endpoints)
│   ├── requirements.txt
│   ├── models/
│   │   ├── vehicle_detector.py       # YOLOv8 wrapper
│   │   └── plate_detector.py         # YOLOv8 + EasyOCR pipeline
│   ├── inference/
│   │   ├── occupancy.py              # Slot occupancy algorithm (IoU/centroid)
│   │   └── plate_ocr.py             # End-to-end plate pipeline
│   ├── preprocessing/
│   │   └── transforms.py            # Day/night/rain/blur augmentations
│   ├── training/
│   │   ├── train.py                 # YOLOv8 fine-tuning script
│   │   └── evaluate.py              # Metrics + latency + robustness
│   ├── evaluation/
│   │   ├── metrics.py               # IoU, AP, mAP helpers
│   │   └── robustness.py           # Per-condition benchmark
│   ├── experiments/
│   │   ├── results.md               # Auto-generated evaluation report
│   │   └── robustness_report.md
│   └── weights/
│       └── best.pt                  # Fine-tuned weights (after train.py)
│
├── datasets/
│   ├── parking.yaml                 # YOLO dataset config
│   ├── slot_zones/
│   │   └── north_terminal.json     # Slot polygon map
│   ├── train/ val/ test/
│   └── test/
│       ├── daylight/ night/ rain/
│       ├── shadows/ blur/ noise/
│       └── occlusion/
│
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS (Material Design 3) |
| Backend | Node.js, Express.js |
| Real-Time | Socket.IO (targeted event rooms + AI events) |
| Database | SQLite (better-sqlite3) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| AI Service | Python, FastAPI, PyTorch |
| Detection | YOLOv8 (ultralytics) — fine-tuned on PKLot |
| OCR | EasyOCR (LSTM + attention) |
| CV Preprocessing | OpenCV (CLAHE, bilateral filter, perspective) |
| Notifications | Nodemailer, qrcode |
| Security | express-rate-limit, dotenv |

---

## API Reference — AI Endpoints

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| `GET` | `/api/ai/status` | all | AI service liveness |
| `GET` | `/api/ai/metrics` | all | Model evaluation metrics |
| `POST` | `/api/ai/analyze-frame` | superadmin, facility_manager, parking_admin | Upload image → occupancy result + Socket.IO broadcast |
| `POST` | `/api/ai/detect-plate` | superadmin, parking_admin, security_officer | Upload image → plate text + vehicle registry check |

### Socket.IO AI Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `ai:occupancy-update` | server → all clients | New slot occupancy from AI frame analysis |
| `ai:plate-detected` | server → security_officer room | Plate scan result |
| `ai:alert` | server → security_officer room | Unauthorized/unregistered plate warning |

---

## License

MIT
