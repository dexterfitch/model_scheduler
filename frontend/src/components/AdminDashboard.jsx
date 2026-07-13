import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import styles from "./AdminDashboard.module.css";
import { Row, Col, Card, Badge, Button } from "react-bootstrap";
import { formatDateWithWeekday, formatTime } from "../utils/time";

function AdminDashboard() {
  const navigate = useNavigate();
  const [pendingSeries, setPendingSeries] = useState([]);
  const [todaysGigs, setTodaysGigs] = useState([]);

  const fetchDashboardData = async () => {
    const [seriesRes, gigsRes] = await Promise.all([
      api.get("/request_series"),
      api.get("/gigs"),
    ]);

    const pending = seriesRes.data
      .filter(s => s.faculty_requests?.some(r => r.status === 'pending'))
      .sort((a, b) => {
        const aFirst = a.faculty_requests?.find(r => r.status === 'pending')?.starts_at;
        const bFirst = b.faculty_requests?.find(r => r.status === 'pending')?.starts_at;
        return new Date(aFirst) - new Date(bFirst);
      });
    setPendingSeries(pending);

    const todayStr = new Date().toISOString().split('T')[0];
    const today = gigsRes.data.filter(g =>
      g.status === 'confirmed' && g.faculty_request?.starts_at?.startsWith(todayStr)
    );
    setTodaysGigs(today);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div>
      <h2 className="mb-4">Admin Dashboard</h2>

      <Row>
        <Col md={7} className="order-2 order-md-1 my-4 my-md-0">
          <Card className="shadow-sm">
            <Card.Header className="bg-primary text-white fw-bold d-flex justify-content-between align-items-center">
              Pending Faculty Requests
              <Badge bg="light" text="dark">{pendingSeries.length}</Badge>
            </Card.Header>
            <Card.Body>
              {pendingSeries.length === 0 ? <p className="text-muted">No pending requests.</p> : (
                pendingSeries.map(series => {
                  const pendingRequests = series.faculty_requests?.filter(r => r.status === 'pending') || [];
                  const firstReq = pendingRequests
                    .slice()
                    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0];
                  if (!firstReq) return null;

                  const needsAttention = pendingRequests.some(r => r.needs_attention);

                  return (
                    <Card key={series.id} className="mb-2 border-start border-4 border-primary">
                      <Card.Body className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 gap-md-3 py-3">
                        <div>
                          <div className="fw-bold">{series.class_name}</div>
                          <div className="d-flex flex-wrap gap-1 mt-1">
                            {pendingRequests.length > 1 && (
                              <Badge bg="info" text="dark" className={`${styles.badge}`}>
                                <i className="bi bi-calendar me-1"></i> {pendingRequests.length} dates
                              </Badge>
                            )}
                            {needsAttention && (
                              <Badge bg="danger" className={`${styles.badge}`}>
                                <i className="bi bi-exclamation-triangle-fill me-1"></i>Needs Attention: Model Dropped Out
                              </Badge>
                            )}
                          </div>
                          <div className="small text-muted mt-1">
                            {series.user?.first_name} {series.user?.last_name} &bull; Next: {formatDateWithWeekday(firstReq.starts_at)} {formatTime(firstReq.starts_at)}
                          </div>
                        </div>
                        <div className="d-grid d-md-block">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="text-nowrap"
                            onClick={() => navigate('/requests')}
                          >
                            View &amp; Manage
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>
                  );
                })
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={5} className="order-1 order-md-2">
          <Card className="shadow-sm">
            <Card.Header className="bg-success text-white fw-bold">
              Today's Schedule
            </Card.Header>
            <Card.Body>
              {todaysGigs.length === 0 ? <p className="text-muted">No gigs scheduled for today.</p> : (
                todaysGigs.map(gig => (
                  <Card key={gig.id} className="mb-3 border-start border-5 border-success">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start">
                        <h6 className="mb-1 fw-bold">{gig.faculty_request.class_name}</h6>
                        {gig.faculty_request.model_mode === 'nude'
                          ? <Badge bg="danger">Nude</Badge>
                          : <Badge bg="success">Clothed</Badge>}
                      </div>
                      <div className="small mb-1">
                        {formatTime(gig.faculty_request.starts_at)} - {formatTime(gig.faculty_request.ends_at)}
                      </div>
                      {(gig.faculty_request.building || gig.faculty_request.room_number) && (
                        <div className="small mb-1">
                          <i className="bi bi-door-open me-1"></i>
                          {gig.faculty_request.building}{gig.faculty_request.building && gig.faculty_request.room_number && " "}{gig.faculty_request.room_number}
                        </div>
                      )}
                      <div className="small mb-1">
                        Faculty: {gig.faculty_request.user.first_name} {gig.faculty_request.user.last_name}
                      </div>
                      {gig.faculty_request.department && (
                        <div className="small mb-1">Department: {gig.faculty_request.department}</div>
                      )}
                      <div className="small mb-1">
                        Model: <strong>{gig.art_model_availability.user.first_name} {gig.art_model_availability.user.last_name}</strong>
                      </div>
                      {gig.faculty_request.notes && (
                        <div className="small text-muted fst-italic mt-1">&gt; {gig.faculty_request.notes}</div>
                      )}
                    </Card.Body>
                  </Card>
                ))
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default AdminDashboard;