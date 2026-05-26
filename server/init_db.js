/**
 * Database initialization script.
 * Run once with: node init_db.js
 * WARNING: drops and recreates all tables — destroys existing data.
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';

const db = new Database('studyplan.db');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

db.exec(`
  DROP TABLE IF EXISTS study_plan_courses;
  DROP TABLE IF EXISTS study_plans;
  DROP TABLE IF EXISTS incompatibilities;
  DROP TABLE IF EXISTS courses;
  DROP TABLE IF EXISTS users;

  CREATE TABLE users (
    userId       INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    surname      TEXT    NOT NULL,
    email        TEXT    UNIQUE NOT NULL,
    hashedPassword TEXT  NOT NULL,
    salt         TEXT    NOT NULL,
    planType     TEXT    CHECK(planType IN ('full-time', 'part-time'))
  );

  CREATE TABLE courses (
    courseCode        TEXT    PRIMARY KEY,
    name              TEXT    NOT NULL,
    credits           INTEGER NOT NULL,
    maxStudents       INTEGER,
    preparatoryCourse TEXT    REFERENCES courses(courseCode)
  );

  -- Both directions stored (A→B and B→A) for simple querying.
  CREATE TABLE incompatibilities (
    courseCode1 TEXT NOT NULL REFERENCES courses(courseCode),
    courseCode2 TEXT NOT NULL REFERENCES courses(courseCode),
    PRIMARY KEY (courseCode1, courseCode2)
  );

  -- enrolled count for a course = COUNT(*) on this table.
  CREATE TABLE study_plan_courses (
    userId     INTEGER NOT NULL REFERENCES users(userId),
    courseCode TEXT    NOT NULL REFERENCES courses(courseCode),
    PRIMARY KEY (userId, courseCode)
  );
`);

// ---------------------------------------------------------------------------
// Courses (22 from spec)
// ---------------------------------------------------------------------------

const insertCourse = db.prepare(
  'INSERT INTO courses (courseCode, name, credits, maxStudents, preparatoryCourse) VALUES (?, ?, ?, ?, ?)'
);

const courses = [
  ['02GOLOV', 'Architetture dei sistemi di elaborazione',      12, null, null],
  ['02LSEOV', 'Computer architectures',                        12, null, null],
  ['01SQJOV', 'Data Science and Database Technology',           8, null, null],
  ['01SQMOV', 'Data Science e Tecnologie per le Basi di Dati',  8, null, null],
  ['01SQLOV', 'Database systems',                               8, null, null],
  ['01OTWOV', 'Computer network technologies and services',     6, 3,    null],
  ['02KPNOV', 'Tecnologie e servizi di rete',                   6, 3,    null],
  ['01TYMOV', 'Information systems security services',         12, null, null],
  ['01UDUOV', 'Sicurezza dei sistemi informativi',             12, null, null],
  ['05BIDOV', 'Ingegneria del software',                        6, null, '02GOLOV'],
  ['04GSPOV', 'Software engineering',                           6, null, '02LSEOV'],
  ['01UDFOV', 'Applicazioni Web I',                             6, null, null],
  ['01TXYOV', 'Web Applications I',                             6, 3,    null],
  ['01TXSOV', 'Web Applications II',                            6, null, '01TXYOV'],
  ['02GRSOV', 'Programmazione di sistema',                      6, null, null],
  ['01NYHOV', 'System and device programming',                  6, 3,    null],
  ['01SQOOV', 'Reti Locali e Data Center',                      6, null, null],
  ['01TYDOV', 'Software networking',                            7, null, null],
  ['03UEWOV', 'Challenge',                                      5, null, null],
  ['01URROV', 'Computational intelligence',                     6, null, null],
  ['01OUZPD', 'Model based software design',                    4, null, null],
  ['01URSPD', 'Internet Video Streaming',                       6, 2,    null],
];

for (const c of courses) insertCourse.run(...c);

// ---------------------------------------------------------------------------
// Incompatibilities (both directions stored)
// ---------------------------------------------------------------------------

const insertIncompat = db.prepare(
  'INSERT INTO incompatibilities (courseCode1, courseCode2) VALUES (?, ?)'
);

const incompatPairs = [
  ['02GOLOV', '02LSEOV'],
  ['01SQJOV', '01SQMOV'],
  ['01SQJOV', '01SQLOV'],
  ['01SQMOV', '01SQLOV'],
  ['01OTWOV', '02KPNOV'],
  ['01TYMOV', '01UDUOV'],
  ['05BIDOV', '04GSPOV'],
  ['01UDFOV', '01TXYOV'],
  ['02GRSOV', '01NYHOV'],
];

for (const [a, b] of incompatPairs) {
  insertIncompat.run(a, b);
  insertIncompat.run(b, a);
}

// ---------------------------------------------------------------------------
// Users (5 required: >=1 part-time, >=1 full-time)
// All passwords: "password"
// ---------------------------------------------------------------------------

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return { hash, salt };
}

const insertUser = db.prepare(
  'INSERT INTO users (name, surname, email, hashedPassword, salt, planType) VALUES (?, ?, ?, ?, ?, ?)'
);

const users = [
  { name: 'Mario',  surname: 'Rossi',   email: 'mario.rossi@polito.it',   planType: 'full-time' },
  { name: 'Luigi',  surname: 'Verdi',   email: 'luigi.verdi@polito.it',   planType: 'full-time' },
  { name: 'Anna',   surname: 'Bianchi', email: 'anna.bianchi@polito.it',  planType: 'full-time' },
  { name: 'Carla',  surname: 'Neri',    email: 'carla.neri@polito.it',    planType: 'part-time' },
  { name: 'Franco', surname: 'Gialli',  email: 'franco.gialli@polito.it', planType: 'part-time' },
];

const userIds = {};
for (const u of users) {
  const { hash, salt } = hashPassword('password');
  const result = insertUser.run(u.name, u.surname, u.email, hash, salt, u.planType);
  userIds[u.email] = result.lastInsertRowid;
}

// ---------------------------------------------------------------------------
// Study plan courses
// ---------------------------------------------------------------------------

const insertPlanCourse = db.prepare(
  'INSERT INTO study_plan_courses (userId, courseCode) VALUES (?, ?)'
);

// user1 — full-time, 62 credits
// 02GOLOV(12)+01SQJOV(8)+01TYMOV(12)+01UDFOV(6)+01OTWOV(6)+01TYDOV(7)+03UEWOV(5)+01URSPD(6)=62
for (const code of ['02GOLOV','01SQJOV','01TYMOV','01UDFOV','01OTWOV','01TYDOV','03UEWOV','01URSPD']) {
  insertPlanCourse.run(userIds['mario.rossi@polito.it'], code);
}

// user2 — full-time, 63 credits
// 02LSEOV(12)+01SQLOV(8)+01UDUOV(12)+04GSPOV(6)+01OTWOV(6)+01TYDOV(7)+01URROV(6)+01URSPD(6)=63
for (const code of ['02LSEOV','01SQLOV','01UDUOV','04GSPOV','01OTWOV','01TYDOV','01URROV','01URSPD']) {
  insertPlanCourse.run(userIds['luigi.verdi@polito.it'], code);
}

// user3 — full-time, 61 credits
// 02GOLOV(12)+01SQMOV(8)+01TYMOV(12)+05BIDOV(6)+01TXYOV(6)+01TXSOV(6)+01OTWOV(6)+03UEWOV(5)=61
for (const code of ['02GOLOV','01SQMOV','01TYMOV','05BIDOV','01TXYOV','01TXSOV','01OTWOV','03UEWOV']) {
  insertPlanCourse.run(userIds['anna.bianchi@polito.it'], code);
}

// user4 — part-time, 32 credits
// 02LSEOV(12)+01SQJOV(8)+01UDFOV(6)+01SQOOV(6)=32
for (const code of ['02LSEOV','01SQJOV','01UDFOV','01SQOOV']) {
  insertPlanCourse.run(userIds['carla.neri@polito.it'], code);
}

// user5 — part-time, 29 credits
// 01SQLOV(8)+01URROV(6)+01OUZPD(4)+03UEWOV(5)+01NYHOV(6)=29
for (const code of ['01SQLOV','01URROV','01OUZPD','03UEWOV','01NYHOV']) {
  insertPlanCourse.run(userIds['franco.gialli@polito.it'], code);
}

// ---------------------------------------------------------------------------
// Verify: 01OTWOV max=3 → enrolled 3/3, 01URSPD max=2 → enrolled 2/2
// ---------------------------------------------------------------------------

db.close();
console.log('Database initialized successfully.');
console.log('All users have password "password"');
