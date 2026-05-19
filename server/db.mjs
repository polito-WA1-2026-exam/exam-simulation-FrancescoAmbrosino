import Database from 'better-sqlite3';

const db = new Database('studyplan.db');

// Enable foreign key constraints (disabled by default in SQLite)
db.pragma('foreign_keys = ON');

export default db;
