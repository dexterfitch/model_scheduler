import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Row, Col, Card, Badge, Button } from "react-bootstrap";
import { formatSkinTone } from "../utils/formatters";

function AdminDashboard() {
  const navigate = useNavigate();
  const [pendingSeries, setPendingSeries] = useState([]);
  const [todaysGigs, setTodaysGigs] = useState([]);

  const fetchDashboardData = async () => {
    const [seriesRes, gigsRes] = await Promise.all([
      api.get("/request_series"),
      api.get("/gigs"),
    ]);

    // CHANGED: filter series with at least one pending request
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
      g.faculty_request?.starts_at?.startsWith(todayStr)
    );
    setTodaysGigs(today);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <h2 className="mb-4">Admin Dashboard</h2>

      <Row>
        <Col md={7} className="order-2 order-md-1 my-4 my-md-0">
          <Card className="shadow-sm">
            <Card.Header className="bg-primary text-white fw-bold">
              Pending Faculty Requests
            </Card.Header>
            <Card.Body>
              {pendingSeries.length === 0 ? <p className="text-muted">No pending requests.</p> : (
                pendingSeries.map(series => {
                  const pendingRequests = series.faculty_requests?.filter(r => r.status === 'pending') || [];
                  const firstReq = pendingRequests[0];
                  if (!firstReq) return null;

                  return (
                    <Card key={series.id} className="mb-3 border-start border-5 border-primary">
                      <Card.Body className="d-flex justify-content-between align-items-start gap-3">
                        <div className="flex-grow-1">
                          <h5 className="mb-1">{series.class_name}</h5>
                          <div className="mb-1 text-muted small">
                            {firstReq.user?.first_name} {firstReq.user?.last_name}
                            {series.room_number && <span> &nbsp;|&nbsp; <i className="bi bi-door-open me-1"></i>{series.room_number}</span>}
                          </div>

                          <div className="mb-2">
                            {pendingRequests.map((req, idx) => (
                              <div key={req.id} className="small">
                                <i className="bi bi-calendar3 me-1"></i>
                                {formatDate(req.starts_at)} &nbsp;{formatTime(req.starts_at)} - {formatTime(req.ends_at)}
                              </div>
                            ))}
                          </div>

                          <div className="text-muted small mb-2">
                            Request Submitted: {new Date(series.created_at).toLocaleDateString()} at {new Date(series.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div>
                            {series.model_mode === "nude"
                              ? <Badge bg="danger">Nude</Badge>
                              : <Badge bg="success">Clothed</Badge>}
                            <span className="ms-2 small text-secondary">
                              Pref: {formatSkinTone(series.pref_skin_tone)}, {series.pref_gender} Gender Presentation
                            </span>
                          </div>
                          {series.notes && (
                            <div className="mt-2 text-muted small fst-italic border rounded p-2">
                              <i className="bi bi-journal-text"></i>: {series.notes}
                            </div>
                          )}
                        </div>

                        <Button
                          variant="outline-primary"
                          onClick={() => navigate(`/gigs/new/${series.id}?type=series`)}
                        >
                          Find Match
                        </Button>
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