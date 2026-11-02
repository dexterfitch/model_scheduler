/**
 * The sign-in page, with the reason when a sign-in didn't work or expired.
 */

import React, { useEffect } from "react";
import { Container, Card, Alert, Button } from "react-bootstrap";
import { useSearchParams, useNavigate } from "react-router-dom";
import styles from "./LoginPage.module.css";
import { API_URL } from "../services/api";
import { setPageTitle } from '../utils/pageTitle';
import { useRevealMessage } from '../utils/revealMessage';

/** The sign-in page with the Google sign-in link. */
function LoginPage({ notice }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const error = searchParams.get("error") || notice;
  const errorRef = useRevealMessage(error);

  useEffect(() => {
    setPageTitle('Sign In · MICA Pose Pool');
    document.body.classList.add(styles.loginBg);
    return () => document.body.classList.remove(styles.loginBg);
  }, []);

  return (
    <div className={styles.container}>
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
        <Card className={`shadow p-4 text-center ${styles.card}`} style={{ maxWidth: "400px", width: "100%" }}>
          <h2 className="mb-2">MICA Pose Pool</h2>
          
          {error && (
            <Alert ref={errorRef} tabIndex={-1} variant="danger" dismissible onClose={() => navigate('/login', { replace: true })}>
              {error}
            </Alert>
          )}

          <p className="mb-3 text-warning">
            Thank you for being among the first users of<br />MICA Pose Pool!<br /><br />
            Please let us know if you encounter any problems or have suggestions for improvement. Your feedback is invaluable in helping create a better experience for everyone. 
          </p>

          <p className="mb-3">
            Please sign in with your MICA email address.
          </p>

          <a 
            href={`${API_URL}/auth/google_oauth2`}
            className="btn btn-outline-dark btn-lg d-flex align-items-center justify-content-center gap-2 w-100"
          >
            <i className="bi bi-google" aria-hidden="true"></i>
            <span className="small">Sign in with MICA Google Account</span>
          </a>

        </Card>
      </Container>
    </div>
  );
}

export default LoginPage;
