import { useState, Fragment } from 'react';
import { Table, Button, Badge } from 'react-bootstrap';

// Determines whether a course can be added to the plan, and the reason if not.
function getAddStatus(course, planCourses) {
  const planCodes = new Set(planCourses.map(c => c.courseCode));

  if (planCodes.has(course.courseCode))
    return { canAdd: false, reason: 'Already in plan' };

  for (const incompat of course.incompatibilities)
    if (planCodes.has(incompat))
      return { canAdd: false, reason: `Incompatible with ${incompat}` };

  if (course.preparatoryCourse && !planCodes.has(course.preparatoryCourse))
    return { canAdd: false, reason: `Requires ${course.preparatoryCourse}` };

  if (course.maxStudents !== null && course.enrolledCount >= course.maxStudents)
    return { canAdd: false, reason: 'No seats available' };

  return { canAdd: true, reason: null };
}

function CourseList({ courses, planCourses, isEditing, onAdd }) {
  // Set of course codes currently expanded to show incompatibilities / preparatory.
  const [expanded, setExpanded] = useState(new Set());

  const toggleExpand = (code) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  return (
    <>
      <h4>Courses</h4>
      <Table hover size="sm" className="align-middle">
        <thead className="table-dark">
          <tr>
            <th style={{ width: '2rem' }}></th>
            <th>Code</th>
            <th>Name</th>
            <th>Credits</th>
            <th>Enrolled</th>
            {isEditing && <th></th>}
          </tr>
        </thead>
        <tbody>
          {courses.map(course => {
            const isExpanded    = expanded.has(course.courseCode);
            const hasDetails    = course.incompatibilities.length > 0 || course.preparatoryCourse;
            const alreadyInPlan = planCourses.some(c => c.courseCode === course.courseCode);
            const { canAdd, reason } = isEditing
              ? getAddStatus(course, planCourses)
              : { canAdd: false, reason: null };

            return (
              <Fragment key={course.courseCode}>
                <tr className={isEditing && !canAdd && !alreadyInPlan ? 'table-secondary text-muted' : ''}>
                  <td>
                    {hasDetails && (
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-decoration-none"
                        onClick={() => toggleExpand(course.courseCode)}
                      >
                        {isExpanded ? '▲' : '▼'}
                      </Button>
                    )}
                  </td>
                  <td><code>{course.courseCode}</code></td>
                  <td>{course.name}</td>
                  <td>{course.credits}</td>
                  <td>
                    {course.maxStudents !== null
                      ? <><span>{course.enrolledCount}</span><span className="text-muted">/{course.maxStudents}</span></>
                      : course.enrolledCount}
                  </td>
                  {isEditing && (
                    <td className="text-end">
                      {alreadyInPlan
                        ? <Badge bg="success">✓ Added</Badge>
                        : canAdd
                          ? <Button variant="outline-success" size="sm" onClick={() => onAdd(course)}>+ Add</Button>
                          : <small className="text-danger">{reason}</small>
                      }
                    </td>
                  )}
                </tr>

                {isExpanded && (
                  <tr className="table-light">
                    <td colSpan={isEditing ? 6 : 5} className="small ps-4 fst-italic">
                      {course.preparatoryCourse && (
                        <div>Preparatory: <code>{course.preparatoryCourse}</code></div>
                      )}
                      {course.incompatibilities.length > 0 && (
                        <div>
                          Incompatible with:{' '}
                          {course.incompatibilities.map(c => (
                            <code key={c} className="me-1">{c}</code>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}

export default CourseList;
