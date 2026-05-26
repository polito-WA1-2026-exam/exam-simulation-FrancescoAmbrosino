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

- Route `/`: page content and purpose
- Route `/something/:param`: page content and purpose, param specification
- ...

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

- `PUT /api/studyplan`
  - Body: `{ type, courseCodes[] }`
  - Validates credit range and constraints
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
  - `saveStudyPlan(userId, planType, courseCodes)`: atomic replace of plan
  - `deleteStudyPlan(userId)`: deletes plan and resets planType to null

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
