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
      setSaveError(null);
      navigate('/');
    });
  };

  // POST: creates the plan in DB, then navigates to edit page.
  const handleCreatePlan = (type) => {
    API.createStudyPlan(type)
      .then(result => {
        setUser(u => ({ ...u, planType: result.type }));
        setSavedPlan(result);
        setLocalPlan({ type, courses: [] });
        navigate('/studyplan/edit');
      })
      .catch(err => console.error('Failed to create plan:', err));
  };

  // User clicks "Edit" on an existing saved plan.
  const handleStartEdit = () => {
    setLocalPlan({ ...savedPlan, courses: [...savedPlan.courses] });
    setSaveError(null);
    navigate('/studyplan/edit');
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
        API.getCourses().then(setCourses); // refresh enrolledCount
        navigate('/');
      })
      .catch(err => setSaveError(err.error || 'Save failed'));
  };

  // Discard local changes; go back to home.
  const handleCancel = () => {
    setLocalPlan(null);
    setSaveError(null);
    navigate('/');
  };

  // DELETE: plan in DB → API call. Plan only local (never saved) → just reset state.
  const handleDelete = () => {
    if (user.planType) {
      API.deleteStudyPlan().then(() => {
        setSavedPlan(null);
        setLocalPlan(null);
        setSaveError(null);
        setUser(u => ({ ...u, planType: null }));
        API.getCourses().then(setCourses); // refresh enrolledCount
        navigate('/');
      });
    } else {
      setLocalPlan(null);
      setSaveError(null);
      navigate('/');
    }
  };

  return (
    <>
      <Navbar user={user} onLogout={handleLogout} />

      <Container>
        <Routes>
          <Route path="/login" element={
            user ? <Navigate to="/" /> : <LoginForm onLogin={handleLogin} />
          } />

          {/* View existing plan: read-only, with Edit button */}
          <Route path="/studyplan" element={
            !user         ? <Navigate to="/login" />        :
            !user.planType ? <Navigate to="/studyplan/new" /> :
            <Row className="g-4">
              <Col md={7}>
                <CourseList
                  courses={courses}
                  planCourses={savedPlan?.courses ?? []}
                  isEditing={false}
                  onAdd={handleAddCourse}
                />
              </Col>
              <Col md={5}>
                <StudyPlan
                  user={user}
                  savedPlan={savedPlan}
                  localPlan={null}
                  isEditing={false}
                  saveError={null}
                  onCreatePlan={handleCreatePlan}
                  onStartEdit={handleStartEdit}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  onDelete={handleDelete}
                  onRemoveCourse={handleRemoveCourse}
                />
              </Col>
            </Row>
          } />

          {/* Create new plan: type selector → POST → redirect to /studyplan/edit */}
          <Route path="/studyplan/new" element={
            !user          ? <Navigate to="/login" /> :
            user.planType  ? <Navigate to="/" />      :
            <Row className="g-4">
              <Col md={7}>
                <CourseList
                  courses={courses}
                  planCourses={[]}
                  isEditing={false}
                  onAdd={handleAddCourse}
                />
              </Col>
              <Col md={5}>
                <StudyPlan
                  user={user}
                  savedPlan={null}
                  localPlan={null}
                  isEditing={false}
                  saveError={null}
                  onCreatePlan={handleCreatePlan}
                  onStartEdit={handleStartEdit}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  onDelete={handleDelete}
                  onRemoveCourse={handleRemoveCourse}
                />
              </Col>
            </Row>
          } />

          {/* Edit existing plan: add/remove courses, save/cancel/delete */}
          <Route path="/studyplan/edit" element={
            !user       ? <Navigate to="/login" /> :
            !localPlan  ? <Navigate to="/" />      :
            <Row className="g-4">
              <Col md={7}>
                <CourseList
                  courses={courses}
                  planCourses={localPlan.courses}
                  isEditing={true}
                  onAdd={handleAddCourse}
                />
              </Col>
              <Col md={5}>
                <StudyPlan
                  user={user}
                  savedPlan={savedPlan}
                  localPlan={localPlan}
                  isEditing={true}
                  saveError={saveError}
                  onCreatePlan={handleCreatePlan}
                  onStartEdit={handleStartEdit}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  onDelete={handleDelete}
                  onRemoveCourse={handleRemoveCourse}
                />
              </Col>
            </Row>
          } />

          {/* Home: full course list + read-only study plan panel (when logged in) */}
          <Route path="/" element={
            <Row className="g-4">
              <Col md={user ? 7 : 12}>
                <CourseList
                  courses={courses}
                  planCourses={savedPlan?.courses ?? []}
                  isEditing={false}
                  onAdd={handleAddCourse}
                />
              </Col>
              {user && (
                <Col md={5}>
                  <StudyPlan
                    user={user}
                    savedPlan={savedPlan}
                    localPlan={null}
                    isEditing={false}
                    saveError={null}
                    onGoToNew={() => navigate('/studyplan/new')}
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

          <Route path="*" element={<p className="mt-4 text-center text-muted">Page not found.</p>} />
        </Routes>
      </Container>
    </>
  );
}

export default App;
