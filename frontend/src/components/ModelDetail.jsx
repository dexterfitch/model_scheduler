import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Badge, Button } from "react-bootstrap";
import api from "../services/api";
import SharedCalendar from "./SharedCalendar";
import { formatSkinTone } from "../utils/formatters";

function ModelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [availabilities, setAvailabilities] = useState([]);

  useEffect(() => {
    api.get(`/users/${id}`).then(res => setUser(res.data));

    api.get(`/art_model_availabilities?user_id=${id}`).then(res => {
      const events = res.data.map(a => ({
        id: a.id,
        title: a.status === 'active' ? 'Available' : 'Cancelled',
        start: a.starts_at,
        end: a.ends_at,
        backgroundColor: a.status === 'active' ? '#198754' : '#6c757d', 
        display: 'block'
      }));
      setAvailabilities(events);
    });
  }, [id]);

  if (!user) return <div className="p-5">Loading...</div>;

  return (
    <Container className="py-4">
      <Button variant="outline-secondary" className="mb-3" onClick={() => navigate(-1)}>← Back</Button>
      
      <Row className="mb-4">
        <Col md={12}>
          <Card className="shadow-sm border-0 bg-light">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <h2 className="mb-1">{user.first_name} {user.last_name}</h2>
                <div className="text-muted">{user.email}</div>
              </div>
              <div className="text-end">
                <div className="mb-2">
                  <Badge bg="info" text="dark" className="me-1">{formatSkinTone(user.skin_tone)}</Badge>
                  <Badge bg="info" text="dark" className="me-1">{user.gender_identity}</Badge>
                  {user.disability_status !== "None" && <Badge bg="warning" text="dark">{user.disability_status}</Badge>}
                </div>
                <div>
                  {user.willing_to_model_nude ? <Badge bg="danger">Nude OK</Badge> : <Badge bg="success">Clothed Only</Badge>}
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