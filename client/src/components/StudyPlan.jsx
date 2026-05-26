import { useState } from 'react';
import { ListGroup, Button, Alert, Badge, Form } from 'react-bootstrap';

const CREDIT_LIMITS = {
  'full-time': { min: 60, max: 80 },
  'part-time':  { min: 20, max: 40 },
};

// Checks whether a course can be removed (no other course in the plan requires it as preparatory).
function getRemoveStatus(courseCode, planCourses) {
  const dependent = planCourses.find(c => c.preparatoryCourse === courseCode);
  if (dependent) return { canRemove: false, reason: `Required by ${dependent.courseCode}` };
  return { canRemove: true, reason: null };
}

function StudyPlan({
  user, savedPlan, localPlan, isEditing, saveError,
  onCreatePlan, onStartEdit, onSave, onCancel, onDelete, onRemoveCourse,
}) {
  // Local state for type selector shown when creating a new plan.
  const [newPlanType, setNewPlanType] = useState('full-time');

  const plan = isEditing ? localPlan : savedPlan;
  const totalCredits = plan ? plan.courses.reduce((s, c) => s + c.credits, 0) : 0;
  const limits = plan ? CREDIT_LIMITS[plan.type] : null;
  const creditsOk = limits && totalCredits >= limits.min && totalCredits <= limits.max;

  // No plan in DB and not in an editing session: show plan creation form.
  if (!user.planType && !isEditing) {
    return (
      <>
        <h4>Study Plan</h4>
        <p className="text-muted">No study plan yet. Choose a type to get started.</p>
        <Form.Select
          className="mb-2"
          value={newPlanType}
          onChange={e => setNewPlanType(e.target.value)}
        >
          <option value="full-time">Full-time (60–80 credits)</option>
          <option value="part-time">Part-time (20–40 credits)</option>
        </Form.Select>
        <Button variant="primary" onClick={() => onCreatePlan(newPlanType)}>
          Create Plan
        </Button>
      </>
    );
  }

  return (
    <>
      <h4>Study Plan</h4>

      {/* Plan type + credit counter */}
      <div className="mb-3 d-flex gap-2 align-items-center">
        <Badge bg="secondary" className="text-capitalize">{plan?.type}</Badge>
        {limits && (
          <Badge bg={creditsOk ? 'success' : 'warning'} text={creditsOk ? undefined : 'dark'}>
            {totalCredits} / {limits.min}–{limits.max} credits
          </Badge>
        )}
      </div>

      {/* Course list */}
      {plan?.courses.length === 0 ? (
        <p className="text-muted">No courses added yet.</p>
      ) : (
        <ListGroup className="mb-3">
          {plan.courses.map(course => {
            const { canRemove, reason } = isEditing
              ? getRemoveStatus(course.courseCode, plan.courses)
              : { canRemove: false, reason: null };

            return (
              <ListGroup.Item key={course.courseCode} className="d-flex justify-content-between align-items-center">
                <span>
                  <code className="me-2 small">{course.courseCode}</code>
                  {course.name}
                  <small className="text-muted ms-2">({course.credits} cr)</small>
                </span>
                {isEditing && (
                  canRemove
                    ? <Button variant="outline-danger" size="sm" onClick={() => onRemoveCourse(course.courseCode)}>Remove</Button>
                    : <small className="text-muted">{reason}</small>
                )}
              </ListGroup.Item>
            );
          })}
        </ListGroup>
      )}

      {/* Save error */}
      {saveError && <Alert variant="danger" className="py-2">{saveError}</Alert>}

      {/* Action buttons */}
      {isEditing ? (
        <div className="d-flex gap-2 flex-wrap">
          <Button variant="success" onClick={onSave}>Save</Button>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" className="ms-auto" onClick={onDelete}>Delete Plan</Button>
        </div>
      ) : (
        <Button variant="primary" onClick={onStartEdit}>Edit</Button>
      )}
    </>
  );
}

export default StudyPlan;
