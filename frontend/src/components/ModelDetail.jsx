import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Badge, Button, Alert, Spinner } from "react-bootstrap";
import api from "../services/api";
import SharedCalendar from "./SharedCalendar";
import { formatSkinTone } from "../utils/formatters";

function ModelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [availabilities, setAvailabilities] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/users/${id}`)
      .then(res => setUser(res.data))
      .catch(err => {
        setError("Failed to load model profile. Please try again.");
      });

    api.get(`/art_model_availabilities?user_id=${id}`)
      .then(res => {
        const events = res.data.map(a => ({
          id: a.id,
          title: a.status === 'active' ? 'Available' : 'Cancelled',
          start: a.starts_at,
          end: a.ends_at,
          backgroundColor: a.status === 'active' ? '#198754' : '#6c757d',
          display: 'block'
        }));
        setAvailabilities(events);
      })
      .catch(err => {
        setError("Failed to load availability. Please try again.");
      });
  }, [id]);

  if (!user && !error) return (
    <Container className="py-5 text-center">
      <Spinner animation="border" variant="secondary" />
    </Container>
  );

  return (
    <Container className="py-4">
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Button variant="outline-secondary" className="mb-3" onClick={() => navigate(-1)}>
        <i className="bi bi-arrow-left me-1"></i> Back
      </Button>

      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm border-0 bg-light">
            <Card.Body className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
              <div>
                <h2 className="mb-1">{user.first_name} {user.last_name}</h2>
                <div className="text-muted">{user.email}</div>
              </div>
              <div className="text-end">
                <div className="mb-2">
                  <Badge bg="info" text="dark" className="me-1">{formatSkinTone(user.skin_tone)}</Badge>
                  <Badge bg="info" text="dark" className="me-1">{user.gender_identity}</Badge>
                </div>
                <div>
                  {user.willing_to_model_nude
                    ? <Badge bg="danger">Nude OK</Badge>
                    : <Badge bg="success">Clothed Only</Badge>}
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <h4 className="mb-3">Availability Calendar</h4>
      <SharedCalendar events={availabilities} />
    </Container>
  );
}

export default ModelDetail;