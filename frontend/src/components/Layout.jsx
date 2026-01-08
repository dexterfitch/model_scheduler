import React from 'react';
import { Navbar, Nav, Container, Button, Badge } from 'react-bootstrap';
import { Outlet, Link } from 'react-router-dom';

function Layout({ currentUser, onLogout }) {
  return (
    <>
      <Navbar bg="dark" variant="dark" expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand as={Link} to="/">🎨 Scheduler</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              
              {/* ADMIN LINKS */}
              {currentUser.role === 'admin' && (
                <>
                  <Nav.Link as={Link} to="/">Dashboard</Nav.Link>
                  <Nav.Link as={Link} to="/calendar">Calendar</Nav.Link>
                  <Nav.Link as={Link} to="/requests">Requests</Nav.Link>
                  <Nav.Link as={Link} to="/gigs">Gigs</Nav.Link>
                  <Nav.Link as={Link} to="/directory">Directory</Nav.Link>
                </>
              )}

              {/* FACULTY LINKS */}
              {currentUser.role === 'faculty' && (
                <>
                  <Nav.Link as={Link} to="/">My Classes</Nav.Link>
                </>
              )}

              {/* MODEL LINKS */}
              {currentUser.role === 'model' && (
                <>
                  <Nav.Link as={Link} to="/">My Schedule</Nav.Link>
                </>
              )}

            </Nav>
            
            <div className="d-flex align-items-center gap-3">
              <div className="text-white">
                <small className="text-muted d-block" style={{lineHeight: 1}}>Logged in as:</small>
                {currentUser.first_name} ({currentUser.role})
              </div>
              <Button variant="outline-light" size="sm" onClick={onLogout}>Logout</Button>
            </div>

          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container>
        <Outlet />
      </Container>
    </>
  );
}

export default Layout;