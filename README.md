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

- `App` (in `App.jsx`)
  - Root component, handles routing
  - Holds global state: logged-in user, full course list, study plan
  - Fetches courses on mount, study plan on login

- `Navbar` (in `components/Navbar.jsx`)
  - Top navigation bar
  - Shows login button when anonymous, user name and logout button when authenticated

- `LoginForm` (in `components/LoginForm.jsx`)
  - Email and password form
  - Calls POST /api/sessions, redirects to `/` on success

- `CourseList` (in `components/CourseList.jsx`)
  - Renders full course list in alphabetical order
  - Passes edit-mode context down to each row

- `CourseRow` (in `components/CourseRow.jsx`)
  - Single expandable course row
  - Expanded view shows incompatible courses and preparatory course
  - In edit mode: shows add button, or reason why course cannot be added

- `StudyPlan` (in `components/StudyPlan.jsx`)
  - Study plan panel shown when logged in
  - Type selector (full-time / part-time) when creating a new plan
  - Credit counter with min/max range
  - Save, Cancel and Delete buttons

- `StudyPlanRow` (in `components/StudyPlanRow.jsx`)
  - Single course row inside the study plan
  - Remove button with reason message if removal is blocked by a preparatory constraint

## Screenshot

![Screenshot](./img/screenshot.jpg)

## Users Credentials

- username, password (plus any other requested info)
- username, password (plus any other requested info)

## Use of AI Tools
Briefly describe whether you used any AI tools (e.g., ChatGPT, GitHub Copilot, Claude) while working on this project, for which purposes (e.g., clarifying concepts, debugging, generating code), and how you verified or adapted their output.
If you did not use any AI tools, simply state so.
