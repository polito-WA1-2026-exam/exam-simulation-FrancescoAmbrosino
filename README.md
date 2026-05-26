# Exam #N: "Exam Title"
## Student: s123456 LASTNAME FIRSTNAME 

## How to Run

**First time only** — initialize the database:
```bash
cd server
node init_db.js
```

**Start the server:**
```bash
cd server
nodemon index.js
```

**Start the client** (separate terminal):
```bash
cd client
npm run dev
```

App available at `http://localhost:5173`. Server runs on `http://localhost:3001`.

---

## React Client Application Routes

- Route `/`: main page
  - Always shows the full course list (`CourseList`)
  - If logged in: also shows the study plan panel (`StudyPlan`) alongside the course list
  - If not logged in: course list occupies full width, no study plan panel

- Route `/login`: login page
  - Shows `LoginForm` with email and password fields
  - Redirects to `/` if user is already authenticated

- Route `/studyplan`: view the existing study plan (read-only)
  - Requires login (redirects to `/login` if not authenticated)
  - Redirects to `/studyplan/new` if no plan exists
  - Shows full course list and study plan with an Edit button

- Route `/studyplan/new`: create a new study plan
  - Requires login (redirects to `/login` if not authenticated)
  - Redirects to `/` if user already has a plan
  - Shows type selector (full-time / part-time) and "Create Plan" button
  - On creation, navigates to `/studyplan/edit`

- Route `/studyplan/edit`: edit the current study plan
  - Requires login (redirects to `/login` if not authenticated)
  - Redirects to `/` if no local plan is active
  - Shows course list in edit mode and study plan with add/remove controls
  - Save, Cancel, and Delete navigate back to `/`

- Route `*`: catch-all for unknown URLs
  - Shows a "Page not found" message

## API Server

### Authentication

- `POST /api/sessions`
  - Body: `{ email, password }`
  - Response: `{ userId, name, surname, email, planType }`

- `GET /api/sessions/current`
  - Response: `{ userId, name, surname, email, planType }` or 401

- `DELETE /api/sessions/current`
  - Response: empty

### Courses

- `GET /api/courses`
  - Response: array of `{ courseCode, name, credits, maxStudents, enrolledCount, preparatoryCourse, incompatibilities[] }`

### Study Plan

- `GET /api/studyplan`
  - Response: `{ type, courses[] }` or 404 if no plan exists

- `POST /api/studyplan`
  - Creates empty plan for the first time
  - Body: `{ type }`
  - Response: `{ type, courses: [] }` or 409 if plan already exists

- `PUT /api/studyplan`
  - Saves (replaces) the study plan with courses
  - Body: `{ type, courseCodes[] }`
  - Validates credit range and all constraints
  - Response: `{ type, courses[] }` or 422 with error message

- `DELETE /api/studyplan`
  - Response: empty

## Data Models

- `dao-users.js`
  - `getUser(email, password)`: verifies credentials, returns user object or false
  - `getUserById(id)`: re-hydrates user from session

- `dao-courses.js`
  - `getCourses()`: all courses with enrolledCount and incompatibilities array
  - `getStudyPlan(userId)`: courses in the user's plan
  - `createStudyPlan(userId, type)`: sets planType, no courses (first-time creation)
  - `saveStudyPlan(userId, planType, courseCodes)`: atomic replace of plan
  - `deleteStudyPlan(userId)`: deletes plan and resets planType to null

## Database Tables

- Table `users` - contains user credentials: userId (PK), name, surname, email, hashedPassword, salt, planType ('full-time' or 'part-time')
- Table `courses` - contains course data: courseCode (PK), name, credits, optional maxStudents, optional preparatoryCourse (FK to it-self)
- Table `incompatibilities` - contains mutually exclusive course pairs: (courseCode1, courseCode2) (composite PK, FK to courses)
- Table `study_plan_courses` - pivot table linking students to their chosen courses: (userId (FK to users), courseCode (FK to courses)) (composite PK)

## Main React Components

- `LoginForm` (in `components/LoginForm.jsx`)
  - Email and password form
  - Calls POST /api/sessions, redirects to `/` on success

- `CourseList` (in `components/CourseList.jsx`)
  - Renders full course list in alphabetical order
  - Each row is expandable to show incompatibilities and preparatory course
  - In edit mode: shows add button per course, or reason why it cannot be added

- `StudyPlan` (in `components/StudyPlan.jsx`)
  - Study plan panel shown when logged in
  - Type selector (full-time / part-time) when creating a new plan
  - Credit counter with min/max range
  - Save, Cancel and Delete buttons
  - Each row shows remove button with reason if removal is blocked

## Screenshot

![Screenshot](./img/screenshot.jpg)

## Users Credentials

- username, password (plus any other requested info)
- username, password (plus any other requested info)

## Use of AI Tools
Briefly describe whether you used any AI tools (e.g., ChatGPT, GitHub Copilot, Claude) while working on this project, for which purposes (e.g., clarifying concepts, debugging, generating code), and how you verified or adapted their output.
If you did not use any AI tools, simply state so.
