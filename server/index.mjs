import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

import { getUser, getUserById } from './dao-users.mjs';
import { getCourses, getStudyPlan } from './dao-courses.mjs';

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

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
