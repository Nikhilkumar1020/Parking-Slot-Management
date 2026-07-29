# ParkSystem 🚗

A real-time, enterprise-grade Smart Parking Management System built with **React**, **Node.js**, **SQLite**, and **Socket.IO**.

## Features

- **Role-Based Access Control** — 6 roles: Super Admin, Facility Manager, Parking Administrator, Security Officer, Employee, Visitor
- **Global Dark/Light Theme** — Seamless theme toggling with `localStorage` persistence across all RBAC panels
- **Role-Based Notifications** — Users only receive live targeted notifications relevant to their specific role (e.g. `facility_manager` or `security_officer`)
- **Real-Time Updates** — WebSocket-powered live data sync across all connected clients
- **JWT Authentication** — Secure login with hashed passwords and Bearer token auth on all API routes
- **Live Parking Map** — Visual slot overview with occupancy status
- **Reservation System** — Create, approve, check-in, and cancel parking bookings
- **Automated Email Pipeline** — Generates and sends Email confirmations with QR codes upon reservation approval (using Ethereal mock SMTP)
- **Visitor Management** — Check-in/out with access control
- **Vehicle Registry** — Register and track vehicles
- **Reports & Analytics** — Role-specific KPIs and metrics
- **User Management** — Super Admin can add, edit roles, activate/deactivate users
- **Toast Notifications** — In-app real-time alerts (no more browser alerts)
- **Comprehensive Project Documentation** — Includes detailed `Project_Report.md` and `Project_Report.pdf` covering system architecture and role-based workflows

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- npm v9+

### 1. Clone / Download the project
```bash
git clone https://github.com/your-username/parksystem.git
cd parksystem
```

### 2. Install all dependencies
```bash
npm run install:all
```

### 3. Build the frontend
```bash
npm run build
```

### 4. Start the server
```bash
npm start
```

Open **http://localhost:5000** in your browser. The full application (frontend + backend + database) runs on a single port.

---

## Development Mode (Hot Reload)

Run both the Vite dev server and Node backend simultaneously:
```bash
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

---

## Environment Variables

Create a `.env` file in the `backend/` directory:
```
PORT=5000
JWT_SECRET=your_super_secret_key_here
NODE_ENV=production
```

> ⚠️ **Never commit your `.env` file.** It is already in `.gitignore`.

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
├── backend/           # Node.js Express + Socket.IO server
│   ├── server.js      # Main server (auth, API routes, socket)
│   ├── db.js          # SQLite schema and seeding
│   ├── .env           # Environment variables (not committed)
│   └── parksystem.db  # Auto-generated SQLite database
├── smart_parking_react/  # React (Vite) frontend
│   └── src/
│       ├── context/   # AuthContext, SocketContext, ToastContext
│       ├── pages/     # All page components
│       ├── components/# Layout, shared components
│       └── hooks/     # useRealtimeData
└── package.json       # Root scripts for unified start/build
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Real-Time | Socket.IO (with Targeted Event Rooms) |
| Database | SQLite (better-sqlite3) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Notifications | Nodemailer, qrcode |
| Security | express-rate-limit, dotenv |

---

## License

MIT
