import React from "react";
import { Container, Card, Button, Alert } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";

function LoginPage() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
      <Card className="shadow p-4 text-center" style={{ maxWidth: "400px", width: "100%" }}>
        <h2 className="mb-4">MICA Pose Pool</h2>
        
        {error && <Alert variant="danger">{error}</Alert>}

        <p className="text-muted mb-4">
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
            Sign in with MICA Google
          </Button>
        </form>

      </Card>
    </Container>
  );
}

export default LoginPage;