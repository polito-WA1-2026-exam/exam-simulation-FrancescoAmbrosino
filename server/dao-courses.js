import db from './db.js';

const getIncompat = db.prepare(
  'SELECT courseCode2 FROM incompatibilities WHERE courseCode1 = ?'
);

// All courses in alphabetical order with enrolledCount and incompatibilities array.
export const getCourses = () => {
  const courses = db.prepare(`
    SELECT c.courseCode, c.name, c.credits, c.maxStudents, c.preparatoryCourse,
           COUNT(spc.userId) AS enrolledCount
    FROM courses c
    LEFT JOIN study_plan_courses spc ON spc.courseCode = c.courseCode
    GROUP BY c.courseCode
    ORDER BY c.name
  `).all();

  return courses.map(c => ({
    ...c,
    incompatibilities: getIncompat.all(c.courseCode).map(r => r.courseCode2),
  }));
};

// Courses currently in the user's study plan.
export const getStudyPlan = (userId) => {
  return db.prepare(`
    SELECT c.courseCode, c.name, c.credits, c.maxStudents, c.preparatoryCourse
    FROM study_plan_courses spc
    JOIN courses c ON c.courseCode = spc.courseCode
    WHERE spc.userId = ?
  `).all(userId);
};

// Atomically replace study plan: delete old courses, insert new ones, update planType.
export const saveStudyPlan = db.transaction((userId, planType, courseCodes) => {
  db.prepare('DELETE FROM study_plan_courses WHERE userId = ?').run(userId);
  db.prepare('UPDATE users SET planType = ? WHERE userId = ?').run(planType, userId);
  const insert = db.prepare('INSERT INTO study_plan_courses (userId, courseCode) VALUES (?, ?)');
  for (const code of courseCodes) insert.run(userId, code);
});

// Delete all plan courses and reset planType to NULL.
export const deleteStudyPlan = db.transaction((userId) => {
  db.prepare('DELETE FROM study_plan_courses WHERE userId = ?').run(userId);
  db.prepare('UPDATE users SET planType = NULL WHERE userId = ?').run(userId);
});
