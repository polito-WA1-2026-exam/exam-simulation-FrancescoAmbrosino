import { Navbar as BSNavbar, Container, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

function Navbar({ user, onLogout }) {
  const navigate = useNavigate();

  return (
    <BSNavbar bg="dark" variant="dark" className="mb-4">
      <Container>
        <BSNavbar.Brand className="fw-bold">StudyPlan</BSNavbar.Brand>
        <div className="d-flex align-items-center gap-3">
          {user ? (
            <>
              <BSNavbar.Text className="text-light">
                {user.name} {user.surname}
              </BSNavbar.Text>
              <Button variant="outline-light" size="sm" onClick={onLogout}>
                Logout
              </Button>
            </>
          ) : (
            <Button variant="outline-light" size="sm" onClick={() => navigate('/login')}>
              Login
            </Button>
          )}
        </div>
      </Container>
    </BSNavbar>
  );
}

export default Navbar;
