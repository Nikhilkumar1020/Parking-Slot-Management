const Database = require('better-sqlite3');
console.log('1');
const path = require('path');
const bcrypt = require('bcryptjs');
console.log('2');
const dbPath = path.resolve(__dirname, 'parksystem.db');
const db = new Database(dbPath);
console.log('3');
