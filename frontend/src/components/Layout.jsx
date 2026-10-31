/**
 * The frame around every signed-in page: navigation for the person's role, the
 * Updates button (kept outside the phone menu so new updates always show), a skip
 * link, the page title, the SuperUser banner and the Report a Bug window.
 */

import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container, Button, Modal, Form } from 'react-bootstrap';
import { Outlet, Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import styles from './Layout.module.css';
import { useDialog } from './DialogProvider';
import { extractErrorMessages } from '../utils/formatters';
import { setPageTitle } from '../utils/pageTitle';
import UpdatesBell from './UpdatesBell';

const HOME_TITLES = { admin: 'Dashboard', faculty: 'My Classes', model: 'My Gigs' };
const PAGE_TITLES = [
  [/^\/requests/, 'Requests'],
  [/^\/gigs\/new\//, 'Find a Model'],
  [/^\/gigs/, 'Gig Registry'],
  [/^\/calendar/, 'Calendar'],
  [/^\/directory/, 'Directory'],
  [/^\/models\//, 'Model Details'],
  [/^\/reports/, 'Reports'],
  [/^\/superuser/, 'SuperUser Panel'],
  [/^\/profile/, 'My Profile'],
];
/** The tab title for a page. */
const pageTitle = (path, role) =>
  `${PAGE_TITLES.find(([pattern]) => pattern.test(path))?.[1] || HOME_TITLES[role] || 'Home'} · MICA Pose Pool`;

/** The navigation bar and the page inside it. */
function Layout({ currentUser, onLogout, refreshUser }) {
  const location = useLocation();
  const { notify } = useDialog();

  useEffect(() => {
    setPageTitle(pageTitle(location.pathname, currentUser.role));
  }, [location.pathname, currentUser.role]);

  const [navExpanded, setNavExpanded] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [bugDescription, setBugDescription] = useState('');

  /** Switches a SuperUser who was trying the app as faculty or a model back to admin. */
  const handleRestoreAdmin = async () => {
    try {
      const res =await api.post(`/users/${currentUser.id}/promote`, { role: 'admin' });
      refreshUser(res.data);
    } catch (err) {
      notify({ title: "Couldn't restore admin role", message: extractErrorMessages(err, 'Please try again.') });
      console.error(err);
    }
  };

  /**
   * Opens an email to dfitch@mica.edu with the page, the person, their browser and what they wrote.
   */
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
      <a href="#main-content" className="visually-hidden-focusable position-absolute m-2 px-3 py-2 bg-white text-dark border border-dark rounded" style={{ zIndex: 2000 }}>
        Skip to main content
      </a>

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
          <div className="ms-auto me-2 order-lg-last ms-lg-2 me-lg-0">
            <UpdatesBell onNavigate={() => setNavExpanded(false)} />
          </div>
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
                {currentUser.stage_name || currentUser.first_name}
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
                aria-label="Report a bug"
                title="Report a bug"
                onClick={() => { setNavExpanded(false); setShowBugModal(true); }}
              >
                <i className="bi bi-bug" aria-hidden="true"></i>
              </Button>
              <Button variant="outline-light" size="sm" onClick={() => { setNavExpanded(false); onLogout(); }}>
                Logout
              </Button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container as="main" id="main-content" tabIndex={-1}>
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
          <Form.Group controlId="bug-description">
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
            <i className="bi bi-envelope me-1" aria-hidden="true"></i>Open Email
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default Layout;
