import React, { useState } from 'react';
import { Navbar, Nav, Container, Button, Modal, Form } from 'react-bootstrap';
import { Outlet, Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import styles from './Layout.module.css';

function Layout({ currentUser, onLogout, refreshUser }) {
  const location = useLocation();

  const [navExpanded, setNavExpanded] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [bugDescription, setBugDescription] = useState('');

  const handleRestoreAdmin = async () => {
    try {
      const res =await api.post(`/users/${currentUser.id}/promote`, { role: 'admin' });
      refreshUser(res.data);
    } catch (err) {
      alert("Failed to restore admin role. Check console.");
      console.error(err);
    }
  };

  const handleSendBugReport = () => {
    const subject = `Bug Report: ${location.pathname}`;
    const body = `Page: ${window.location.href}
      User: ${currentUser.first_name} ${currentUser.last_name} (${currentUser.email})
      Role: ${currentUser.role}${currentUser.superuser ? ' (SuperUser)' : ''}
      Browser: ${navigator.userAgent}
      Time: ${new Date().toString()}

      Description of the issue:
      ${bugDescription}`;
      
      window.location.href = `mailto:dfitch@mica.edu?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setShowBugModal(false);
      setBugDescription('');
  };

  const isUndercover = currentUser.superuser && currentUser.role !== 'admin';

  return (
    <>
      {isUndercover && (
        <div className="bg-danger text-white text-center p-3 fw-bold d-flex justify-content-center align-items-center gap-3">
          <span>🕵️ SUPERUSER MODE: You are currently acting as {currentUser.role.toUpperCase()}</span>
          <Button variant="light" size="sm" onClick={handleRestoreAdmin}>
            Restore Admin Role
          </Button>
        </div>
      )}

      <Navbar bg="dark" variant="dark" expand="lg" className="mb-4" expanded={navExpanded} onToggle={setNavExpanded}>
        <Container>
          <Navbar.Brand as={Link} to="/">MICA Pose Pool</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              
              {currentUser.role === 'admin' && (
                <>
                  <Nav.Link as={Link} to="/" className={`${styles.navLink}`} onClick={() => setNavExpanded(false)}>Dashboard</Nav.Link>
                  <Nav.Link as={Link} to="/requests" className={`${styles.navLink}`} onClick={() => setNavExpanded(false)}>Requests</Nav.Link>
                  <Nav.Link as={Link} to="/gigs" className={`${styles.navLink}`} onClick={() => setNavExpanded(false)}>Gigs</Nav.Link>
                  <Nav.Link as={Link} to="/calendar" className={`${styles.navLink}`} onClick={() => setNavExpanded(false)}>Calendar</Nav.Link>
                  <Nav.Link as={Link} to="/directory" className={`${styles.navLink}`} onClick={() => setNavExpanded(false)}>Directory</Nav.Link>
                  <Nav.Link as={Link} to="/reports" className={`${styles.navLink}`} onClick={() => setNavExpanded(false)}>Reports</Nav.Link>
                  {currentUser.superuser && (
                    <Nav.Link as={Link} to="/superuser" className={`${styles.navLink}`} onClick={() => setNavExpanded(false)}>SuperUser Panel</Nav.Link>
                  )}
                </>
              )}

              {currentUser.role === 'faculty' && (
                <>
                  <Nav.Link as={Link} to="/" className={`${styles.navLink}`} onClick={() => setNavExpanded(false)}>My Classes</Nav.Link>
                </>
              )}

              {currentUser.role === 'model' && (
                <>
                  <Nav.Link as={Link} to="/" className={`${styles.navLink}`} onClick={() => setNavExpanded(false)}>My Schedule</Nav.Link>
                </>
              )}

            </Nav>
            
            <div className={`d-flex flex-column flex-lg-row align-items-start align-items-lg-center gap-2 ${styles.userSection}`}>
              <div className="text-white">
                {currentUser.first_name}
                {currentUser.superuser ? " (SuperUser)" : ` (${currentUser.role})`}
              </div>
              {currentUser.role === 'model' && (
                <>
                  <Button as={Link} to="/profile" variant="outline-success" size="sm" onClick={() => setNavExpanded(false)}>
                    My Profile
                  </Button>
                </>
              )}
              <Button
                variant="outline-warning"
                size="sm"
                onClick={() => { setNavExpanded(false); setShowBugModal(true); }}
              >
                <i className="bi bi-bug"></i>
              </Button>
              <Button variant="outline-light" size="sm" onClick={() => { setNavExpanded(false); onLogout(); }}>
                Logout
              </Button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container>
        <Outlet />
      </Container>

      <Modal show={showBugModal} onHide={() => setShowBugModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Report a Bug</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">
            This will open your email client with a pre-filled report including the current page and your account info.
          </p>
          <Form.Group>
            <Form.Label>What happened?</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={bugDescription}
              onChange={e => setBugDescription(e.target.value)}
              placeholder="Describe what you were doing and what went wrong..."
              autoFocus
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBugModal(false)}>Cancel</Button>
          <Button variant="warning" onClick={handleSendBugReport}>
            <i className="bi bi-envelope me-1"></i>Open Email
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default Layout;