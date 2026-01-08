import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card, Button, Spinner } from "react-bootstrap";
import api from "../services/api";

function LoginSimulator({ onLogin }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/users")
      .then(res => {
        setUsers(res.data);
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, []);

  const getRoleBadge = (role) => {
    switch(role) {
      case 'admin': return 'bg-dark';
      case 'faculty': return 'bg-primary';
      case 'model': return 'bg-success';
      default: return 'bg-secondary';
    }
  };

  const groupedUsers = {
    admin: users.filter(u => u.role === 'admin'),
    faculty: users.filter(u => u.role === 'faculty'),
    model: users.filter(u => u.role === 'model'),
  };

  if (loading) return <Container className="p-5 text-center"><Spinner animation="border" /></Container>;

  return (
    <Container className="py-5" style={{ maxWidth: '900px' }}>
      <div className="text-center mb-5">
        <h1>🎨 Art Model Scheduler</h1>
        <p className="text-muted">Select a user to simulate login:</p>
      </div>

      <Row>
        {/* ADMIN COLUMN */}
        <Col md={4}>
          <Card className="h-100 shadow-sm border-0">
            <Card.Header className="bg-dark text-white text-center">Admins</Card.Header>
            <Card.Body>
              {groupedUsers.admin.map(u => (
                <Button key={u.id} variant="outline-dark" className="w-100 mb-2" onClick={() => onLogin(u)}>
                  {u.first_name} {u.last_name}
                </Button>
              ))}
            </Card.Body>
          </Card>
        </Col>

        {/* FACULTY COLUMN */}
        <Col md={4}>
          <Card className="h-100 shadow-sm border-0">
            <Card.Header className="bg-primary text-white text-center">Faculty</Card.Header>
            <Card.Body>
              {groupedUsers.faculty.map(u => (
                <Button key={u.id} variant="outline-primary" className="w-100 mb-2" onClick={() => onLogin(u)}>
                  {u.first_name} {u.last_name}
                </Button>
              ))}
            </Card.Body>
          </Card>
        </Col>

        {/* MODEL COLUMN */}
        <Col md={4}>
          <Card className="h-100 shadow-sm border-0">
            <Card.Header className="bg-success text-white text-center">Models</Card.Header>
            <Card.Body>
              {groupedUsers.model.map(u => (
                <Button key={u.id} variant="outline-success" className="w-100 mb-2" onClick={() => onLogin(u)}>
                  {u.first_name} {u.last_name}
                </Button>
              ))}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default LoginSimulator;