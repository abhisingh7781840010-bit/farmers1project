import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || './data/kisan_procurement.sqlite';
const resolvedDbPath = path.isAbsolute(dbPath)
  ? dbPath
  : path.resolve(__dirname, '../../', dbPath);

// Ensure directory exists
const dbDir = path.dirname(resolvedDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(resolvedDbPath);

// Optimize database performance & enable foreign key integrity
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');

/**
 * Initialize database with schema.sql
 */
export function initDb() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
  return db;
}

/**
 * Execute a query that returns multiple rows
 * @param {string} sql
 * @param {Array|Object} params
 * @returns {Array}
 */
export function query(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

/**
 * Execute a query that returns a single row
 * @param {string} sql
 * @param {Array|Object} params
 * @returns {Object|null}
 */
export function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  const row = stmt.get(...params);
  return row !== undefined ? row : null;
}

/**
 * Execute an INSERT, UPDATE, or DELETE statement
 * @param {string} sql
 * @param {Array|Object} params
 * @returns {{ changes: number, lastInsertRowid: number|bigint }}
 */
export function run(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

let transactionDepth = 0;

/**
 * Run operations within an ACID transaction (supports re-entrant calls)
 * @param {Function} fn
 * @returns {*}
 */
export function transaction(fn) {
  if (transactionDepth > 0) {
    return fn();
  }

  transactionDepth++;
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  } finally {
    transactionDepth--;
  }
}

export default {
  db,
  initDb,
  query,
  queryOne,
  run,
  transaction
};
