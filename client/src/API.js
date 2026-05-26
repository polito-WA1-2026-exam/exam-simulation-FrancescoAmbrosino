const SERVER_URL = 'http://localhost:3001/api';

// Parses response: returns parsed JSON on success, throws error object on failure.
async function handleResponse(res) {
  if (res.ok) {
    const text = await res.text();
    return text.length ? JSON.parse(text) : {};
  }
  const err = await res.json().catch(() => ({ error: 'Server error' }));
  throw err;
}

export const getCourses = () =>
  fetch(`${SERVER_URL}/courses`, { credentials: 'include' })
    .then(handleResponse);

export const getCurrentUser = () =>
  fetch(`${SERVER_URL}/sessions/current`, { credentials: 'include' })
    .then(handleResponse);

export const login = (email, password) =>
  fetch(`${SERVER_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  }).then(handleResponse);

export const logout = () =>
  fetch(`${SERVER_URL}/sessions/current`, {
    method: 'DELETE',
    credentials: 'include',
  }).then(handleResponse);

export const getStudyPlan = () =>
  fetch(`${SERVER_URL}/studyplan`, { credentials: 'include' })
    .then(handleResponse);

// POST creates an empty study plan (first time only — sets planType, no courses).
export const createStudyPlan = (type) =>
  fetch(`${SERVER_URL}/studyplan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ type }),
  }).then(handleResponse);

// PUT replaces the entire study plan (used for both first save and updates).
export const saveStudyPlan = (type, courseCodes) =>
  fetch(`${SERVER_URL}/studyplan`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ type, courseCodes }),
  }).then(handleResponse);

export const deleteStudyPlan = () =>
  fetch(`${SERVER_URL}/studyplan`, {
    method: 'DELETE',
    credentials: 'include',
  }).then(handleResponse);
