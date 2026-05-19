# Exam #N: "Exam Title"
## Student: s123456 LASTNAME FIRSTNAME 

## React Client Application Routes

- Route `/`: page content and purpose
- Route `/something/:param`: page content and purpose, param specification
- ...

## API Server

### Authentication
- `POST /api/sessions` — login; body: `{ email, password }`; response: user object `{ userId, name, surname, email, planType }`
- `DELETE /api/sessions/current` — logout; no body; response: empty
- `GET /api/sessions/current` — check session; response: user object or 401

### Courses
- `GET /api/courses` — list all courses in alphabetical order; response: array of `{ courseCode, name, credits, maxStudents, enrolledCount, preparatoryCourse, incompatibilities[] }`

### Study Plan
- `GET /api/studyplan` — get logged-in user's study plan; response: `{ type, courses[] }` or 404 if no plan
- `PUT /api/studyplan` — create or replace study plan; body: `{ type, courseCodes[] }`; validates credits and constraints; response: updated plan or 422 with error
- `DELETE /api/studyplan` — delete entire study plan; response: empty

## Data Models

- `dao-users.mjs`: `getUser(email, password)` — verifies credentials, returns user or false; `getUserById(id)` — re-hydrates user from session
- `dao-courses.mjs`: `getCourses()` — all courses with enrolledCount and incompatibilities; `getStudyPlan(userId)` — user's plan courses; `saveStudyPlan(userId, planType, courseCodes)` — atomic replace; `deleteStudyPlan(userId)` — delete plan and reset planType

## Database Tables

- Table `users` - contains user credentials: userId (PK), name, surname, email, hashedPassword, salt, planType ('full-time' or 'part-time')
- Table `courses` - contains course data: courseCode (PK), name, credits, optional maxStudents, optional preparatoryCourse (FK to it-self)
- Table `incompatibilities` - contains mutually exclusive course pairs: (courseCode1, courseCode2) (composite PK, FK to courses)
- Table `study_plan_courses` - pivot table linking students to their chosen courses: (userId (FK to users), courseCode (FK to courses)) (composite PK)

## Main React Components

- `ListOfSomething` (in `List.js`): component purpose and main functionality
- `GreatButton` (in `GreatButton.js`): component purpose and main functionality
- ...

(only _main_ components, minor ones may be skipped)

## Screenshot

![Screenshot](./img/screenshot.jpg)

## Users Credentials

- username, password (plus any other requested info)
- username, password (plus any other requested info)

## Use of AI Tools
Briefly describe whether you used any AI tools (e.g., ChatGPT, GitHub Copilot, Claude) while working on this project, for which purposes (e.g., clarifying concepts, debugging, generating code), and how you verified or adapted their output.
If you did not use any AI tools, simply state so.
