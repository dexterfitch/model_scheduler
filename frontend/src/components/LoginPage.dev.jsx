import React, { useEffect } from "react";
import { Container, Card, Alert, Button } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import styles from "./LoginPage.module.css";

function LoginPage() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    document.body.classList.add(styles.loginBg);
    return () => document.body.classList.remove(styles.loginBg);
  }, []);

  return (
    <div className={styles.container}>
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
        <Card className={`shadow p-4 text-center ${styles.card}`} style={{ maxWidth: "400px", width: "100%" }}>
          <h2 className="mb-2">MICA Pose Pool</h2>
          
          {error && <Alert variant="danger">{error}</Alert>}

          <p className="mb-3">
            Please sign in with your MICA email address.
          </p>

          <form action="http://localhost:3000/auth/google_oauth2" method="post">
            <Button 
              variant="outline-dark" 
              size="lg" 
              type="submit"
              className="d-flex align-items-center justify-content-center gap-2 w-100"
            >
              <img 
                src="https://www.svgrepo.com/show/475656/google-color.svg" 
                alt="Google" 
                style={{ width: "20px" }} 
              />
              <span className="small">Sign in with MICA Google Account</span>
            </Button>
          </form>

        </Card>
      </Container>
    </div>
  );
}

export default LoginPage;