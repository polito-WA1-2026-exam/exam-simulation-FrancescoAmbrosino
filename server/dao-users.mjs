import db from './db.mjs';
import crypto from 'crypto';

// Used by Passport LocalStrategy to verify credentials at login.
// Returns user object (no sensitive fields) or false if invalid.
export const getUser = (email, password) => {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return false;

  const hash = crypto.scryptSync(password, user.salt, 32).toString('hex');
  const valid = crypto.timingSafeEqual(
    Buffer.from(user.hashedPassword, 'hex'),
    Buffer.from(hash, 'hex')
  );
  if (!valid) return false;

  return { userId: user.userId, name: user.name, surname: user.surname, email: user.email, planType: user.planType };
};

// Used by Passport to re-hydrate the user from the session on each request.
export const getUserById = (id) => {
  return db.prepare(
    'SELECT userId, name, surname, email, planType FROM users WHERE userId = ?'
  ).get(id);
};
