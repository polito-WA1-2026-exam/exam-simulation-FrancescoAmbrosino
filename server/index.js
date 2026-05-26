import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

import { getUser, getUserById } from './dao-users.js';
import { getCourses, getStudyPlan, saveStudyPlan, deleteStudyPlan } from './dao-courses.js';

const app = express();
const port = 3001;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(express.json());

// CORS: allow requests from Vite dev server with session cookies ("two servers" pattern).
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Session: cookie-based, required by Passport.
app.use(session({
  secret: 'studyplan-secret',
  resave: false,
  saveUninitialized: false,
}));

// ---------------------------------------------------------------------------
// Passport: LocalStrategy + serialize/deserialize
// ---------------------------------------------------------------------------

// LocalStrategy: called on POST /api/sessions (login).
// usernameField overrides default 'username' to match our 'email' field.
passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
  const user = getUser(email, password);
  if (!user) return done(null, false, { message: 'Invalid credentials.' });
  return done(null, user);
}));

// serializeUser: stores only userId in the session cookie.
passport.serializeUser((user, done) => done(null, user.userId));

// deserializeUser: re-hydrates user from DB on every authenticated request.
passport.deserializeUser((id, done) => {
  const user = getUserById(id);
  if (!user) return done(null, false);
  return done(null, user);
});

app.use(passport.initialize());
app.use(passport.session());

// ---------------------------------------------------------------------------
// Helper: protect routes that require authentication.
// ---------------------------------------------------------------------------

const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Not authenticated' });
};

// ---------------------------------------------------------------------------
// GET /api/sessions/current
// Returns logged-in user or 401. Used by client on startup to restore session.
// ---------------------------------------------------------------------------

app.get('/api/sessions/current', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/courses  (public — no auth required)
// Returns all courses alphabetically with enrolledCount and incompatibilities[].
// ---------------------------------------------------------------------------

app.get('/api/courses', (req, res) => {
  try {
    const courses = getCourses();
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/studyplan  (protected)
// Returns { type, courses[] } for the logged-in user, or 404 if no plan exists.
// ---------------------------------------------------------------------------

app.get('/api/studyplan', isLoggedIn, (req, res) => {
  try {
    if (!req.user.planType) {
      return res.status(404).json({ error: 'No study plan found' });
    }
    const courses = getStudyPlan(req.user.userId);
    res.json({ type: req.user.planType, courses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/sessions  (login)
// passport.authenticate handles credential check via LocalStrategy.
// On success: returns user object. On failure: 401.
// ---------------------------------------------------------------------------

app.post('/api/sessions', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || 'Invalid credentials' });
    req.login(user, (err) => {
      if (err) return next(err);
      res.json(req.user);
    });
  })(req, res, next);
});

// ---------------------------------------------------------------------------
// DELETE /api/sessions/current  (logout)
// req.logout() in Passport 0.6+ requires a callback.
// ---------------------------------------------------------------------------

app.delete('/api/sessions/current', isLoggedIn, (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.status(200).json({});
  });
});

// ---------------------------------------------------------------------------
// PUT /api/studyplan  (protected)
// Creates or replaces the study plan. Validates:
//   1. type is 'full-time' or 'part-time'
//   2. all courseCodes exist
//   3. total credits within range (full-time: 60-80, part-time: 20-40)
//   4. no two incompatible courses
//   5. preparatory course present when required
//   6. max enrollment not exceeded (only for courses new to the user's plan)
// ---------------------------------------------------------------------------

app.put('/api/studyplan', isLoggedIn, (req, res) => {
  const { type, courseCodes } = req.body;

  // --- basic input validation ---
  if (!type || !['full-time', 'part-time'].includes(type))
    return res.status(422).json({ error: 'Invalid plan type' });
  if (!Array.isArray(courseCodes))
    return res.status(422).json({ error: 'courseCodes must be an array' });

  // --- load all courses (with enrolledCount and incompatibilities) ---
  const allCourses = getCourses();
  const courseMap = Object.fromEntries(allCourses.map(c => [c.courseCode, c]));

  // --- all codes must exist ---
  for (const code of courseCodes) {
    if (!courseMap[code])
      return res.status(422).json({ error: `Course ${code} not found` });
  }

  const selected = courseCodes.map(code => courseMap[code]);
  const codeSet = new Set(courseCodes);

  // --- credits range ---
  const totalCredits = selected.reduce((sum, c) => sum + c.credits, 0);
  const [min, max] = type === 'full-time' ? [60, 80] : [20, 40];
  if (totalCredits < min || totalCredits > max)
    return res.status(422).json({ error: `Total credits (${totalCredits}) must be between ${min} and ${max}` });

  // --- incompatibilities ---
  for (const course of selected) {
    for (const incompat of course.incompatibilities) {
      if (codeSet.has(incompat))
        return res.status(422).json({ error: `${course.courseCode} is incompatible with ${incompat}` });
    }
  }

  // --- preparatory courses ---
  for (const course of selected) {
    if (course.preparatoryCourse && !codeSet.has(course.preparatoryCourse))
      return res.status(422).json({ error: `${course.courseCode} requires ${course.preparatoryCourse} as preparatory course` });
  }

  // --- max enrollment (skip check for courses already in user's current plan) ---
  const currentPlan = getStudyPlan(req.user.userId);
  const currentCodes = new Set(currentPlan.map(c => c.courseCode));

  for (const course of selected) {
    const isNew = !currentCodes.has(course.courseCode);
    if (isNew && course.maxStudents !== null && course.enrolledCount >= course.maxStudents)
      return res.status(422).json({ error: `${course.courseCode} has reached maximum enrollment` });
  }

  // --- persist ---
  try {
    saveStudyPlan(req.user.userId, type, courseCodes);
    const updatedCourses = getStudyPlan(req.user.userId);
    res.json({ type, courses: updatedCourses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/studyplan  (protected)
// Removes all plan courses and resets planType to NULL.
// ---------------------------------------------------------------------------

app.delete('/api/studyplan', isLoggedIn, (req, res) => {
  try {
    deleteStudyPlan(req.user.userId);
    res.status(200).json({});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
