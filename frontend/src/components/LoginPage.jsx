import React from "react";
import { Container, Card, Button, Alert } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";

function LoginPage() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");

  const handleGoogleLogin = () => {
    // Redirect browser to Rails Google Auth route
    window.location.href = "http://localhost:3000/auth/google_oauth2";
  };

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
      <Card className="shadow p-4 text-center" style={{ maxWidth: "400px", width: "100%" }}>
        <h2 className="mb-4">🎨 MICA Scheduler</h2>
        
        {error && <Alert variant="danger">{error}</Alert>}

        <p className="text-muted mb-4">
          Please sign in with your MICA email address to access the scheduler.
        </p>

        <Button 
          variant="outline-dark" 
          size="lg" 
          className="d-flex align-items-center justify-content-center gap-2"
          onClick={handleGoogleLogin}
        >
          <img 
            src="https://www.svgrepo.com/show/475656/google-color.svg" 
            alt="Google" 
            style={{ width: "20px" }} 
          />
          Sign in with MICA Google
        </Button>
      </Card>
    </Container>
  );
}

export default LoginPage;