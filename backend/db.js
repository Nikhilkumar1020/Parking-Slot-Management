const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'parksystem.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
// Enforce foreign key constraints
db.pragma('foreign_keys = ON');

// ─── Initialize Core Schema ──────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slotId TEXT UNIQUE NOT NULL,
    level TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    occupancy INTEGER DEFAULT 0,
    lastEvent TEXT,
    vehiclePlate TEXT,
    duration TEXT,
    reservedBy TEXT,
    eta TEXT,
    issue TEXT,
    schedule TEXT,
    history TEXT,
    cleaning TEXT,
    charging TEXT,
    cost TEXT
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    make TEXT,
    model TEXT,
    color TEXT,
    plate TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    type TEXT,
    defaultVehicle INTEGER DEFAULT 0,
    ownerId INTEGER
  );

  CREATE TABLE IF NOT EXISTS visitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    purpose TEXT,
    eta TEXT,
    status TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    name TEXT NOT NULL,
    email TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    slot TEXT NOT NULL,
    status TEXT NOT NULL,
    qr_code TEXT,
    email_status TEXT DEFAULT 'pending',
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    label TEXT
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    time TEXT NOT NULL,
    type TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    targetRole TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    token_version INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Safe Column Migrations (idempotent) ─────────────────────────────────────
// Add new columns to existing tables without destroying data.
const safeAddColumn = (table, column, definition) => {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    console.log(`[DB Migration] Added column ${table}.${column}`);
  } catch (e) {
    if (!e.message.includes('duplicate column name')) {
      throw e;
    }
    // Column already exists — skip silently
  }
};

safeAddColumn('users', 'token_version', 'INTEGER NOT NULL DEFAULT 0');
safeAddColumn('reservations', 'qr_code', 'TEXT');
safeAddColumn('reservations', 'email_status', "TEXT DEFAULT 'pending'");

// ─── Performance Indexes (Issue #10 — Scale to 10M rows) ─────────────────────
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_reservations_slot_date_status
    ON reservations(slot, date, status);

  CREATE INDEX IF NOT EXISTS idx_reservations_userId
    ON reservations(userId);

  CREATE INDEX IF NOT EXISTS idx_reservations_status
    ON reservations(status);

  CREATE INDEX IF NOT EXISTS idx_slots_status
    ON slots(status);

  CREATE INDEX IF NOT EXISTS idx_users_email
    ON users(email);

  CREATE INDEX IF NOT EXISTS idx_notifications_targetRole
    ON notifications(targetRole);
`);

console.log('[DB] Schema initialized and indexes applied.');

// ─── Helper to seed if empty ──────────────────────────────────────────────────
const seedTable = (tableName, data, insertQuery) => {
  const row = db.prepare(`SELECT count(*) as count FROM ${tableName}`).get();
  if (row.count === 0) {
    console.log(`[DB] Seeding ${tableName}...`);
    const insert = db.prepare(insertQuery);
    const insertMany = db.transaction((items) => {
      for (const item of items) insert.run(item);
    });
    insertMany(data);
  }
};

// Hash passwords synchronously for seeding
const hashPwd = (pwd) => bcrypt.hashSync(pwd, 10);

// Seed Users — all 6 roles with hashed passwords
seedTable('users', [
  { name: 'Super Admin', email: 'superadmin@parksystem.com', password: hashPwd('superadmin'), role: 'superadmin', status: 'Active', token_version: 0 },
  { name: 'Facility Manager', email: 'manager@parksystem.com', password: hashPwd('manager123'), role: 'facility_manager', status: 'Active', token_version: 0 },
  { name: 'Parking Admin', email: 'parking@parksystem.com', password: hashPwd('parking123'), role: 'parking_administrator', status: 'Active', token_version: 0 },
  { name: 'Security Officer', email: 'security@parksystem.com', password: hashPwd('security123'), role: 'security_officer', status: 'Active', token_version: 0 },
  { name: 'Alex Employee', email: 'employee@parksystem.com', password: hashPwd('employee123'), role: 'employee', status: 'Active', token_version: 0 },
  { name: 'Guest Visitor', email: 'visitor@parksystem.com', password: hashPwd('visitor123'), role: 'visitor', status: 'Active', token_version: 0 },
], `INSERT INTO users (name, email, password, role, status, token_version) VALUES (@name, @email, @password, @role, @status, @token_version)`);

// Seed Slots
seedTable('slots', [
  { slotId: 'A-102', level: 'Level 1', type: 'VIP', status: 'Available', occupancy: 0, lastEvent: '2h ago', vehiclePlate: null, duration: null, reservedBy: null, eta: null, issue: null, schedule: null, history: null, cleaning: null, charging: null, cost: null },
  { slotId: 'E-044', level: 'Level 0', type: 'EV', status: 'Occupied', occupancy: 100, lastEvent: null, vehiclePlate: 'TESLA-M3-24', duration: '1h 42m', reservedBy: null, eta: null, issue: null, schedule: null, history: null, cleaning: null, charging: null, cost: null },
  { slotId: 'D-012', level: 'Level 1', type: 'Disabled', status: 'Reserved', occupancy: 0, lastEvent: null, vehiclePlate: null, duration: null, reservedBy: 'James Wilson', eta: '14:30 (15m)', issue: null, schedule: null, history: null, cleaning: null, charging: null, cost: null },
  { slotId: 'B-501', level: 'Level 2', type: 'Standard', status: 'Maintenance', occupancy: 0, lastEvent: null, vehiclePlate: null, duration: null, reservedBy: null, eta: null, issue: 'Sensor Failure', schedule: 'Today, 19:00', history: null, cleaning: null, charging: null, cost: null },
  { slotId: 'C-210', level: 'Level 1', type: 'Standard', status: 'Available', occupancy: 0, lastEvent: '30m ago', vehiclePlate: null, duration: null, reservedBy: null, eta: null, issue: null, schedule: null, history: null, cleaning: null, charging: null, cost: null },
  { slotId: 'F-001', level: 'Level 0', type: 'Bike', status: 'Available', occupancy: 0, lastEvent: '1h ago', vehiclePlate: null, duration: null, reservedBy: null, eta: null, issue: null, schedule: null, history: null, cleaning: null, charging: null, cost: null },
], `INSERT INTO slots (slotId, level, type, status, occupancy, lastEvent, vehiclePlate, duration, reservedBy, eta, issue, schedule, history, cleaning, charging, cost) VALUES (@slotId, @level, @type, @status, @occupancy, @lastEvent, @vehiclePlate, @duration, @reservedBy, @eta, @issue, @schedule, @history, @cleaning, @charging, @cost)`);

// Seed Vehicles
seedTable('vehicles', [
  { make: 'Tesla', model: 'Model 3', color: 'Midnight Silver', plate: 'ABC-9872', status: 'VERIFIED', type: 'directions_car', defaultVehicle: 1 },
  { make: 'Rivian', model: 'R1S', color: 'Forest Green', plate: 'XEN-1104', status: 'PENDING', type: 'electric_car', defaultVehicle: 0 }
], `INSERT INTO vehicles (make, model, color, plate, status, type, defaultVehicle) VALUES (@make, @model, @color, @plate, @status, @type, @defaultVehicle)`);

// Seed Visitors
seedTable('visitors', [
  { name: 'Sarah Connor', host: 'John Smith', purpose: 'Meeting', eta: '10:00 AM', status: 'Expected' },
  { name: 'Michael Scott', host: 'David Wallace', purpose: 'Interview', eta: '11:30 AM', status: 'Arrived' }
], `INSERT INTO visitors (name, host, purpose, eta, status) VALUES (@name, @host, @purpose, @eta, @status)`);

// Seed Reservations
seedTable('reservations', [
  { userId: 6, name: 'Visitor User', email: 'visitor@parksystem.com', date: 'Oct 25', time: '09:00 AM', slot: 'VIP-A1', status: 'Confirmed', qr_code: null, email_status: 'pending' },
  { userId: null, name: 'Guest Visitor', email: 'guest@example.com', date: 'Oct 25', time: '02:00 PM', slot: 'EV-B4', status: 'Pending', qr_code: null, email_status: 'pending' }
], `INSERT INTO reservations (userId, name, email, date, time, slot, status, qr_code, email_status) VALUES (@userId, @name, @email, @date, @time, @slot, @status, @qr_code, @email_status)`);

// Seed Notifications
seedTable('notifications', [
  { title: 'New Visitor Arrival', message: 'Michael Scott has arrived at the front desk.', time: '5m ago', type: 'info', read: 0, targetRole: 'security_officer' },
  { title: 'Sensor Alert', message: 'Maintenance required on slot B-501.', time: '1h ago', type: 'warning', read: 0, targetRole: 'facility_manager' },
  { title: 'System Update', message: 'ParkSystem v2.1 deployed successfully.', time: '3h ago', type: 'info', read: 0, targetRole: 'all' }
], `INSERT INTO notifications (title, message, time, type, read, targetRole) VALUES (@title, @message, @time, @type, @read, @targetRole)`);

// Seed Metrics
seedTable('metrics', [
  { key: 'total_capacity', value: '450', label: 'Total Capacity' },
  { key: 'current_occupancy', value: '78%', label: 'Occupancy Rate' },
  { key: 'active_sessions', value: '351', label: 'Active Sessions' },
  { key: 'revenue_today', value: '$1,240', label: 'Daily Revenue' },
  { key: 'total_users', value: '6', label: 'Total Users' }
], `INSERT INTO metrics (key, value, label) VALUES (@key, @value, @label)`);

console.log('[DB] Seeding complete.');
module.exports = db;
