require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { sendReservationConfirmation } = require('./emailService');
const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '100560176750-p4v3u3glpfl44687unh3p81ejr6m2g0p.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

app.use(cors());
app.use(express.json());

// Serve static frontend in production
const distPath = path.join(__dirname, '../smart_parking_react/dist');
app.use(express.static(distPath));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── JWT Auth Middleware (Issue #4 — token_version liveness check) ────────────
// The JWT now includes a `tv` (token_version) claim. On every protected request,
// we verify:
//   1. The token is cryptographically valid (jwt.verify).
//   2. The user still exists and is Active in the DB.
//   3. The token's `tv` matches the DB's `token_version` (invalidates old tokens
//      after a deactivation or forced logout).
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Liveness check — one lightweight DB read per request
    const dbUser = db.prepare('SELECT id, role, status, token_version FROM users WHERE id = ?').get(decoded.id);
    if (!dbUser) {
      return res.status(401).json({ error: 'User account not found.' });
    }
    // Issue #4 — deactivated users are rejected immediately
    if (dbUser.status === 'Inactive') {
      return res.status(401).json({ error: 'Your account has been deactivated. Please contact an administrator.' });
    }
    // Issue #4 — stale token (issued before deactivation/role-change bump)
    if (decoded.tv !== dbUser.token_version) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    req.user = { ...decoded, role: dbUser.role }; // always use DB role, not JWT role
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

// ─── Role Guard Middleware ────────────────────────────────────────────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Insufficient permissions.' });
  }
  next();
};

// ─── Socket.IO Connection Tracking ───────────────────────────────────────────
let connectedClients = 0;
io.on('connection', (socket) => {
  connectedClients++;
  io.emit('clients:count', connectedClients);

  socket.on('authenticate', (data) => {
    if (data.userId) socket.join(`user_${data.userId}`);
    if (['superadmin', 'facility_manager', 'parking_administrator'].includes(data.role)) {
      socket.join('admin');
    }
  });

  // Issue #7 — on reconnect, client asks for a full state snapshot
  socket.on('request:sync', () => {
    try {
      const slots = db.prepare('SELECT id, slotId, status, vehiclePlate, reservedBy FROM slots').all();
      const pendingReservations = db.prepare(
        "SELECT id, slot, date, time, status FROM reservations WHERE status IN ('Pending','Confirmed','Checked-In')"
      ).all();
      socket.emit('state:sync', { slots, pendingReservations, ts: new Date().toISOString() });
    } catch (err) {
      console.error('[Socket] state:sync error:', err.message);
    }
  });

  socket.on('disconnect', () => {
    connectedClients--;
    io.emit('clients:count', connectedClients);
  });
});

const broadcast = (event, data, room = null) => {
  try {
    if (room) io.to(room).emit(event, data);
    else io.emit(event, data);
  } catch (err) {
    console.error(`[broadcast] Failed to emit ${event}:`, err.message);
    // DB is already committed — we never roll back due to a broadcast failure
  }
};

// ─── Helper: Recalculate and Broadcast Metrics ────────────────────────────────
const recalculateMetrics = () => {
  try {
    const totalSlots = db.prepare('SELECT COUNT(*) as count FROM slots').get().count;
    const occupiedSlots = db.prepare("SELECT COUNT(*) as count FROM slots WHERE status = 'Occupied'").get().count;
    const pendingReservations = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE status = 'Pending'").get().count;
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const occupancyPct = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;

    db.prepare("UPDATE metrics SET value = ? WHERE key = 'total_capacity'").run(String(totalSlots));
    db.prepare("UPDATE metrics SET value = ? WHERE key = 'current_occupancy'").run(`${occupancyPct}%`);
    db.prepare("UPDATE metrics SET value = ? WHERE key = 'active_sessions'").run(String(occupiedSlots));
    db.prepare("UPDATE metrics SET value = ? WHERE key = 'total_users'").run(String(totalUsers));

    broadcast('metric:update', { recalculated: true });
  } catch (err) {
    console.error('[Metrics] Recalculation error:', err.message);
  }
};

// ─── Auth Endpoints (Public) ──────────────────────────────────────────────────
app.post('/api/auth/login', loginLimiter, (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid email or password' });

    // Issue #4 — reject Inactive users at login too
    if (user.status === 'Inactive') {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact an administrator.' });
    }

    // Include token_version (tv) in JWT so we can invalidate stale tokens
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, tv: user.token_version },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, facility } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    const userRole = 'superadmin';

    const info = db.prepare('INSERT INTO users (name, email, password, role, status, token_version) VALUES (?, ?, ?, ?, ?, 0)')
      .run(name, email, hashedPassword, userRole, 'Active');
    const newUser = { id: info.lastInsertRowid, name, email, role: userRole, status: 'Active', token_version: 0 };

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, tv: 0 },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    broadcast('user:update', { action: 'create' });
    recalculateMetrics();
    res.json({ token, user: newUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/google (Google Sign-In)
app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const { email, name } = payload;

    // Check if user exists
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (user) {
      // Check if user is active
      if (user.status === 'Inactive') {
        return res.status(403).json({ error: 'Your account has been deactivated. Please contact an administrator.' });
      }
    } else {
      // Create new user with a random placeholder password
      const randomPassword = require('crypto').randomBytes(16).toString('hex');
      const hashedPassword = bcrypt.hashSync(randomPassword, 10);
      const userRole = 'visitor'; // Default role for Google users
      
      const info = db.prepare('INSERT INTO users (name, email, password, role, status, token_version) VALUES (?, ?, ?, ?, ?, 0)')
        .run(name, email, hashedPassword, userRole, 'Active');
      
      user = { id: info.lastInsertRowid, name, email, role: userRole, status: 'Active', token_version: 0 };
      
      broadcast('user:update', { action: 'create' });
      recalculateMetrics();
    }

    // Generate standard JWT
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, tv: user.token_version },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    const { password: _, ...safeUser } = user;
    res.json({ token: jwtToken, user: safeUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/change-password (Authenticated)
app.post('/api/auth/change-password', authenticate, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new passwords are required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = bcrypt.compareSync(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hashed = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Metrics endpoint (Public for dashboard reads) ────────────────────────────
app.get('/api/metrics', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM metrics').all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Issue #7 — State Snapshot Endpoint ──────────────────────────────────────
// Clients call this after reconnecting to reconcile local state with server truth.
app.get('/api/state/snapshot', authenticate, (req, res) => {
  try {
    const slots = db.prepare('SELECT id, slotId, status, vehiclePlate, reservedBy FROM slots').all();
    const pendingReservations = db.prepare(
      "SELECT id, slot, date, time, status FROM reservations WHERE status IN ('Pending','Confirmed','Checked-In')"
    ).all();
    res.json({ slots, pendingReservations, ts: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Issue #10 — Admin: retry failed emails ───────────────────────────────────
app.post('/api/admin/retry-emails', authenticate, requireRole('superadmin', 'facility_manager'), async (req, res) => {
  try {
    const failedReservations = db.prepare(
      "SELECT * FROM reservations WHERE email_status = 'failed' AND status = 'Confirmed'"
    ).all();

    const results = [];
    for (const reservation of failedReservations) {
      const result = await sendReservationConfirmation(reservation);
      if (result.success) {
        db.prepare("UPDATE reservations SET email_status = 'sent', qr_code = ? WHERE id = ?")
          .run(result.qrData, reservation.id);
        results.push({ id: reservation.id, success: true });
      } else {
        results.push({ id: reservation.id, success: false, error: result.error });
      }
    }
    res.json({ retried: failedReservations.length, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Protected CRUD Routes ────────────────────────────────────────────────────
const tableEventMap = {
  slots: 'slot:update',
  vehicles: 'vehicle:update',
  visitors: 'visitor:update',
  reservations: 'reservation:update',
  notifications: 'notification:new',
  users: 'user:update',
};

// Tables handled by the generic CRUD below (reservations handled separately)
const genericTables = ['slots', 'vehicles', 'visitors', 'notifications'];

genericTables.forEach(table => {
  // GET all (authenticated)
  app.get(`/api/${table}`, authenticate, (req, res) => {
    try {
      let rows;
      if (table === 'notifications') {
        rows = db.prepare(`SELECT * FROM ${table} WHERE targetRole = ? OR targetRole = 'all' ORDER BY id DESC`).all(req.user.role);
      } else {
        rows = db.prepare(`SELECT * FROM ${table}`).all();
      }
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET by id (authenticated)
  app.get(`/api/${table}/:id`, authenticate, (req, res) => {
    try {
      const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
      if (row) res.json(row);
      else res.status(404).json({ error: 'Not found' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST create (authenticated)
  app.post(`/api/${table}`, authenticate, (req, res) => {
    try {
      const keys = Object.keys(req.body);
      const values = Object.values(req.body);
      const placeholders = keys.map(() => '?').join(', ');
      const info = db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
      const result = { id: info.lastInsertRowid, ...req.body };
      const event = tableEventMap[table];
      if (event) broadcast(event, { action: 'create', data: result });
      if (table === 'slots') recalculateMetrics();
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // PUT update (authenticated)
  app.put(`/api/${table}/:id`, authenticate, (req, res) => {
    try {
      const keys = Object.keys(req.body);
      const values = Object.values(req.body);
      if (keys.length === 0) return res.status(400).json({ error: 'No data provided' });
      const setClause = keys.map(key => `${key} = ?`).join(', ');
      const info = db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...values, req.params.id);

      if (info.changes > 0) {
        const event = tableEventMap[table];
        if (event) broadcast(event, { action: 'update', id: req.params.id, data: req.body });
        if (table === 'slots') recalculateMetrics();
        res.json({ message: 'Updated successfully' });
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // DELETE (authenticated)
  app.delete(`/api/${table}/:id`, authenticate, (req, res) => {
    try {
      const info = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
      if (info.changes > 0) {
        const event = tableEventMap[table];
        if (event) broadcast(event, { action: 'delete', id: req.params.id });
        if (table === 'slots') recalculateMetrics();
        res.json({ message: 'Deleted successfully' });
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
});

// ─── Reservations (Custom, with race protection) ──────────────────────────────

// GET all reservations — with pagination (Issue #10)
app.get('/api/reservations', authenticate, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, parseInt(req.query.limit) || 100);
    const offset = (page - 1) * limit;

    const rows = db.prepare(
      'SELECT * FROM reservations ORDER BY createdAt DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);
    const { total } = db.prepare('SELECT COUNT(*) as total FROM reservations').get();

    res.json({ data: rows, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single reservation
app.get('/api/reservations/:id', authenticate, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
    if (row) res.json(row);
    else res.status(404).json({ error: 'Not found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create reservation — Issue #1: atomic race guard
// Wraps in a serialized SQLite transaction to prevent two simultaneous requests
// from both reading "slot available" and both succeeding.
app.post('/api/reservations', authenticate, (req, res) => {
  try {
    const { name, date, time, slot, status, userId, email } = req.body;
    if (!name || !date || !slot) {
      return res.status(400).json({ error: 'name, date, and slot are required' });
    }

    // Atomic reservation: check availability and insert in one transaction.
    // better-sqlite3 is synchronous, so the transaction is truly atomic.
    const createReservation = db.transaction(() => {
      // Check if this slot+date already has an active reservation
      const conflict = db.prepare(
        `SELECT id FROM reservations
         WHERE slot = ? AND date = ? AND status IN ('Pending', 'Confirmed', 'Checked-In')`
      ).get(slot, date);

      if (conflict) {
        return { conflict: true, conflictId: conflict.id };
      }

      const info = db.prepare(
        `INSERT INTO reservations (userId, name, email, date, time, slot, status, email_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
      ).run(userId || null, name, email || null, date, time || '', slot, status || 'Pending');

      return { conflict: false, id: info.lastInsertRowid };
    });

    const result = createReservation();

    if (result.conflict) {
      return res.status(409).json({
        error: `Slot "${slot}" is already reserved for ${date}. Please choose a different slot or date.`
      });
    }

    const created = db.prepare('SELECT * FROM reservations WHERE id = ?').get(result.id);
    broadcast('reservation:update', { action: 'create', data: created });
    recalculateMetrics();
    res.json(created);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update reservation — Issue #3: approval with email_status tracking
app.put('/api/reservations/:id', authenticate, async (req, res) => {
  try {
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);
    if (keys.length === 0) return res.status(400).json({ error: 'No data provided' });

    const prevRow = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
    if (!prevRow) return res.status(404).json({ error: 'Reservation not found' });

    const setClause = keys.map(key => `${key} = ?`).join(', ');
    const info = db.prepare(`UPDATE reservations SET ${setClause} WHERE id = ?`).run(...values, req.params.id);

    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });

    const updatedRow = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);

    // Broadcast to affected user and admins
    if (updatedRow.userId) {
      broadcast('reservation:update', { action: 'update', id: req.params.id, data: updatedRow }, `user_${updatedRow.userId}`);
    }
    broadcast('reservation:update', { action: 'update', id: req.params.id, data: updatedRow }, 'admin');
    recalculateMetrics();

    // Issue #3 — Approval triggers email + QR; failure does NOT roll back the approval.
    if (prevRow.status === 'Pending' && req.body.status === 'Confirmed') {
      // Respond immediately — don't make client wait for email
      res.json({ message: 'Updated successfully', emailPending: true });

      // Fire-and-forget email (non-blocking)
      sendReservationConfirmation(updatedRow).then((emailResult) => {
        const emailStatus = emailResult.success ? 'sent' : 'failed';
        db.prepare('UPDATE reservations SET email_status = ?, qr_code = ? WHERE id = ?')
          .run(emailStatus, emailResult.qrData, updatedRow.id);
        if (!emailResult.success) {
          console.warn(`[ReservationApproval] Email failed for reservation #${updatedRow.id}: ${emailResult.error}`);
          broadcast('notification:new', {
            action: 'create',
            data: {
              title: 'Email Delivery Failed',
              message: `QR email for reservation #${updatedRow.id} (${updatedRow.name}) failed. Use the retry endpoint.`,
              time: 'Just now',
              type: 'warning',
              targetRole: 'superadmin'
            }
          }, 'admin');
        }
      });
    } else {
      res.json({ message: 'Updated successfully' });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE reservation
app.delete('/api/reservations/:id', authenticate, (req, res) => {
  try {
    const info = db.prepare('DELETE FROM reservations WHERE id = ?').run(req.params.id);
    if (info.changes > 0) {
      broadcast('reservation:update', { action: 'delete', id: req.params.id });
      recalculateMetrics();
      res.json({ message: 'Deleted successfully' });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Issue #8 — Atomic QR Check-In: prevents double scan race condition.
// Because better-sqlite3 is synchronous, the transaction is serialized at the
// process level — no two check-ins can interleave for the same reservation.
app.post('/api/reservations/:id/checkin', authenticate, requireRole('superadmin', 'security_officer', 'parking_administrator'), (req, res) => {
  try {
    const checkin = db.transaction(() => {
      const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
      if (!reservation) return { notFound: true };

      if (reservation.status === 'Checked-In') {
        return { alreadyCheckedIn: true, reservation };
      }

      if (reservation.status !== 'Confirmed') {
        return { invalidStatus: true, currentStatus: reservation.status };
      }

      db.prepare("UPDATE reservations SET status = 'Checked-In' WHERE id = ?").run(req.params.id);
      return { success: true, reservation: { ...reservation, status: 'Checked-In' } };
    });

    const result = checkin();

    if (result.notFound) return res.status(404).json({ error: 'Reservation not found' });
    if (result.alreadyCheckedIn) {
      return res.status(409).json({
        error: 'This reservation has already been checked in.',
        checkedInAt: result.reservation.updatedAt
      });
    }
    if (result.invalidStatus) {
      return res.status(400).json({
        error: `Cannot check in a reservation with status "${result.currentStatus}". Only Confirmed reservations can be checked in.`
      });
    }

    broadcast('reservation:update', { action: 'update', id: req.params.id, data: result.reservation });
    if (result.reservation.userId) {
      broadcast('reservation:update', { action: 'update', id: req.params.id, data: result.reservation }, `user_${result.reservation.userId}`);
    }
    recalculateMetrics();
    res.json({ message: 'Checked in successfully', reservation: result.reservation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Users Routes ──────────────────────────────────────────────────────────────

// Issue #6 — GET /api/users is now restricted to superadmin, facility_manager, parking_administrator only.
// A plain Employee calling this endpoint will now receive HTTP 403.
app.get('/api/users', authenticate, requireRole('superadmin', 'facility_manager', 'parking_administrator'), (req, res) => {
  try {
    // Issue #10 — Pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, parseInt(req.query.limit) || 100);
    const offset = (page - 1) * limit;

    const rows = db.prepare(
      'SELECT id, name, email, role, status, createdAt FROM users ORDER BY createdAt DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);
    const { total } = db.prepare('SELECT COUNT(*) as total FROM users').get();

    res.json({ data: rows, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id', authenticate, (req, res) => {
  try {
    // Users can only view their own profile; admins can view any
    const isSelf = String(req.user.id) === String(req.params.id);
    const isAdmin = ['superadmin', 'facility_manager', 'parking_administrator'].includes(req.user.role);
    if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Insufficient permissions' });

    const row = db.prepare('SELECT id, name, email, role, status, createdAt FROM users WHERE id = ?').get(req.params.id);
    if (row) res.json(row);
    else res.status(404).json({ error: 'Not found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/:id — safe update
// Issues #4 & #5: When status or role changes, bump token_version to invalidate
// existing JWTs, and emit force:relogin to the affected user's socket room.
app.put('/api/users/:id', authenticate, (req, res) => {
  try {
    const { name, email, status, role } = req.body;
    const isSelf = String(req.user.id) === String(req.params.id);
    const isAdmin = req.user.role === 'superadmin';

    if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Insufficient permissions' });

    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (status && isAdmin) updates.status = status;
    if (role && isAdmin) updates.role = role;

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    // Issue #4 & #5: Bump token_version if status or role changes so old JWTs become invalid.
    const requiresInvalidation = (status && isAdmin) || (role && isAdmin);
    if (requiresInvalidation) {
      updates.token_version = db.prepare('SELECT token_version FROM users WHERE id = ?').get(req.params.id)?.token_version + 1 || 1;
    }

    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const info = db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...Object.values(updates), req.params.id);

    if (info.changes > 0) {
      broadcast('user:update', { action: 'update', id: req.params.id });
      recalculateMetrics();

      // Issue #5 — Notify the affected user's active socket session to force re-login.
      // This covers both deactivation (Issue #4) and role change (Issue #5).
      if (requiresInvalidation) {
        const reason = status === 'Inactive'
          ? 'Your account has been deactivated by an administrator.'
          : 'Your permissions have changed. Please log in again to continue.';
        broadcast('force:relogin', { reason }, `user_${req.params.id}`);
      }

      res.json({ message: 'Updated successfully' });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/users/:id', authenticate, requireRole('superadmin'), (req, res) => {
  try {
    if (String(req.user.id) === String(req.params.id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    // Force logout the user before deleting
    broadcast('force:relogin', { reason: 'Your account has been deleted.' }, `user_${req.params.id}`);

    const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    if (info.changes > 0) {
      broadcast('user:update', { action: 'delete', id: req.params.id });
      recalculateMetrics();
      res.json({ message: 'User deleted' });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Real-Time Status Endpoint (Public) ──────────────────────────────────────
app.get('/api/realtime/status', (req, res) => {
  res.json({ connectedClients, uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ─── Search Endpoint (Authenticated, role-filtered) ───────────────────────────
app.get('/api/search', authenticate, (req, res) => {
  try {
    const q = `%${req.query.q || ''}%`;
    const vehicles = db.prepare('SELECT id, make, model, plate, status FROM vehicles WHERE plate LIKE ? OR make LIKE ? OR model LIKE ? LIMIT 5').all(q, q, q);

    // Issue #6 — Only admins can search users
    const canSearchUsers = ['superadmin', 'facility_manager', 'parking_administrator'].includes(req.user.role);
    const users = canSearchUsers
      ? db.prepare('SELECT id, name, email, role FROM users WHERE name LIKE ? OR email LIKE ? LIMIT 5').all(q, q)
      : [];

    const visitors = db.prepare('SELECT id, name, host, status FROM visitors WHERE name LIKE ? OR host LIKE ? LIMIT 5').all(q, q);
    res.json({ vehicles, users, visitors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Catch-All Route for React Router ────────────────────────────────────────
app.use((req, res) => {
  const indexFile = path.join(__dirname, '../smart_parking_react/dist', 'index.html');
  const fs = require('fs');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(200).send('<h2>Building... Please refresh in 30 seconds.</h2><script>setTimeout(()=>location.reload(),30000)</script>');
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 ParkSystem Real-Time Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO with state:sync, force:relogin, and request:sync events`);
  console.log(`🔒 JWT auth with token_version liveness checks (Issues #4, #5)`);
  console.log(`⚡ Atomic reservation POST with race guard (Issue #1)`);
  console.log(`🔑 Auth endpoints: POST /api/auth/login, POST /api/auth/register`);
  console.log(`📧 Email failures tracked in email_status (non-rollback, Issue #3)\n`);
});
