import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Container, Row, Col } from 'react-bootstrap';
import * as API from './API.js';
import Navbar from './components/Navbar.jsx';
import LoginForm from './components/LoginForm.jsx';
import CourseList from './components/CourseList.jsx';
import StudyPlan from './components/StudyPlan.jsx';

function App() {
  const [user, setUser]           = useState(null);   // logged-in user or null
  const [courses, setCourses]     = useState([]);      // full course list (always loaded)
  const [savedPlan, setSavedPlan] = useState(null);    // plan persisted in DB
  const [localPlan, setLocalPlan] = useState(null);    // working copy during editing
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const navigate = useNavigate();

  // Fetch all courses on mount (public — always available, no auth needed).
  useEffect(() => {
    API.getCourses()
      .then(setCourses)
      .catch(err => console.error('Failed to load courses:', err));
  }, []);

  // Restore session on mount. If logged in and has a plan, load it.
  useEffect(() => {
    API.getCurrentUser()
      .then(u => {
        setUser(u);
        if (u.planType) {
          API.getStudyPlan().then(setSavedPlan).catch(() => setSavedPlan(null));
        }
      })
      .catch(() => setUser(null));
  }, []);

  // Called after successful login (from LoginForm).
  const handleLogin = (u) => {
    setUser(u);
    if (u.planType) {
      API.getStudyPlan().then(setSavedPlan).catch(() => setSavedPlan(null));
    }
    navigate('/');
  };

  const handleLogout = () => {
    API.logout().then(() => {
      setUser(null);
      setSavedPlan(null);
      setLocalPlan(null);
      setIsEditing(false);
      setSaveError(null);
    });
  };

  // POST: creates the plan in DB, then starts editing the empty plan.
  const handleCreatePlan = (type) => {
    API.createStudyPlan(type)
      .then(result => {
        setUser(u => ({ ...u, planType: result.type }));
        setSavedPlan(result);           // { type, courses: [] } now in DB
        setLocalPlan({ type, courses: [] });
        setIsEditing(true);
      })
      .catch(err => console.error('Failed to create plan:', err));
  };

  // User clicks "Edit" on an existing saved plan.
  const handleStartEdit = () => {
    setLocalPlan({ ...savedPlan, courses: [...savedPlan.courses] });
    setIsEditing(true);
    setSaveError(null);
  };

  const handleAddCourse = (course) => {
    setLocalPlan(p => ({ ...p, courses: [...p.courses, course] }));
  };

  const handleRemoveCourse = (courseCode) => {
    setLocalPlan(p => ({
      ...p,
      courses: p.courses.filter(c => c.courseCode !== courseCode),
    }));
  };

  // PUT: validates and persists the local plan.
  const handleSave = () => {
    setSaveError(null);
    API.saveStudyPlan(localPlan.type, localPlan.courses.map(c => c.courseCode))
      .then(result => {
        setSavedPlan(result);
        setUser(u => ({ ...u, planType: result.type }));
        setLocalPlan(null);
        setIsEditing(false);
        API.getCourses().then(setCourses); // refresh enrolledCount
      })
      .catch(err => setSaveError(err.error || 'Save failed'));
  };

  // Discard local changes; go back to showing saved plan (or create form if none).
  const handleCancel = () => {
    setLocalPlan(null);
    setIsEditing(false);
    setSaveError(null);
  };

  // DELETE: plan in DB → API call. Plan only local (never saved) → just reset state.
  const handleDelete = () => {
    if (user.planType) {
      API.deleteStudyPlan().then(() => {
        setSavedPlan(null);
        setLocalPlan(null);
        setIsEditing(false);
        setSaveError(null);
        setUser(u => ({ ...u, planType: null }));
        API.getCourses().then(setCourses); // refresh enrolledCount
      });
    } else {
      setLocalPlan(null);
      setIsEditing(false);
      setSaveError(null);
    }
  };

  // Courses to check constraints against in CourseList.
  const activePlanCourses = isEditing
    ? (localPlan?.courses ?? [])
    : (savedPlan?.courses ?? []);

  return (
    <>
      <Navbar user={user} onLogout={handleLogout} />

      <Container>
        <Routes>
          <Route path="/login" element={
            user ? <Navigate to="/" /> : <LoginForm onLogin={handleLogin} />
          } />
          <Route path="/" element={
            <Row className="g-4">
              <Col md={user ? 7 : 12}>
                <CourseList
                  courses={courses}
                  planCourses={activePlanCourses}
                  isEditing={isEditing}
                  onAdd={handleAddCourse}
                />
              </Col>
              {user && (
                <Col md={5}>
                  <StudyPlan
                    user={user}
                    savedPlan={savedPlan}
                    localPlan={localPlan}
                    isEditing={isEditing}
                    saveError={saveError}
                    onCreatePlan={handleCreatePlan}
                    onStartEdit={handleStartEdit}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    onDelete={handleDelete}
                    onRemoveCourse={handleRemoveCourse}
                  />
                </Col>
              )}
            </Row>
          } />
        </Routes>
      </Container>
    </>
  );
}

export default App;
