import React, { useState, useEffect } from "react";
import { Container, Row, Col, Form, Button, Card, Badge, Alert } from "react-bootstrap";
import api from "../services/api";
import "./Reports.css";

function Reports() {
  const [gigs, setGigs] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [report, setReport] = useState(null);

  useEffect(() => {
    api.get("/gigs").then(res => setGigs(res.data));
  }, []);

  const calculateHours = (startsAt, endsAt) => {
    const ms = new Date(endsAt) - new Date(startsAt);
    return Math.round((ms / 36e5) * 4) / 4;
  };

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString();
  };

  const generateReport = () => {
    if (!startDate || !endDate) {
      alert("Please select both a start and end date.");
      return;
    }

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T23:59:59");

    const inRange = gigs.filter(gig => {
      const gigDate = new Date(gig.faculty_request.starts_at);
      return gigDate >= start && gigDate <= end;
    });

    const byModel = {};

    inRange.forEach(gig => {
      const model = gig.art_model_availability.user;
      const modelKey = model.id;
      const modelName = `${model.first_name} ${model.last_name}`;
      const facultyName = `${gig.faculty_request.user.first_name} ${gig.faculty_request.user.last_name}`;
      const department = gig.faculty_request.department || "Unknown";
      const mode = gig.faculty_request.model_mode; 
      const hours = calculateHours(gig.faculty_request.starts_at, gig.faculty_request.ends_at);
      const isConfirmed = gig.status === "confirmed";
      const isLateCancelled = gig.status === "cancelled" && gig.billable === true;
      const isCancelled = gig.status === "cancelled";

      if (!byModel[modelKey]) {
        byModel[modelKey] = { name: modelName, departments: {} };
      }

      if (!byModel[modelKey].departments[department]) {
        byModel[modelKey].departments[department] = {
          name: department,
          confirmed: { 
            clothed: { total: 0, shifts: [] }, 
            nude: { total: 0, shifts: [] } 
          },
          cancelled: []
        };
      }

      const deptData = byModel[modelKey].departments[department];
      const shiftInfo = {
        facultyName,
        date: formatDate(gig.faculty_request.starts_at),
        timeRange: `${formatTime(gig.faculty_request.starts_at)} - ${formatTime(gig.faculty_request.ends_at)}`,
        hours
      };

      if (isConfirmed) {
        deptData.confirmed[mode].total += hours;
        deptData.confirmed[mode].shifts.push(shiftInfo);
      } else if (isCancelled && isLateCancelled) {
        deptData.cancelled.push({ ...shiftInfo, mode, isLateCancelled });
      }
    });

    setReport(byModel);
  };

  return (
    <Container className="py-4">
      <h2 className="mb-4">Reports</h2>

      <Card className="shadow-sm mb-4 report-header-card">
        <Card.Header className="bg-primary text-white fw-bold">Model Hours Report</Card.Header>
        <Card.Body>
          <Row className="align-items-end">
            <Col md={4} className="mb-3">
              <Form.Label>Start Date</Form.Label>
              <Form.Control type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </Col>
            <Col md={4} className="mb-3">
              <Form.Label>End Date</Form.Label>
              <Form.Control type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </Col>
            <Col md={4} className="mb-3">
              <Button variant="primary" className="w-100" onClick={generateReport}>
                Generate Report
              </Button>
              {report && (
                <Button variant="outline-dark" className="w-100 mt-2" onClick={() => window.print()}>
                  Print
                </Button>
              )}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {report && (
        Object.keys(report).length === 0 ? (
          <Alert variant="info">No gigs found in this date range.</Alert>
        ) : (
          Object.values(report).map(modelData => (
            <Card key={modelData.name} className="shadow-sm mb-4">
              <Card.Header className="fw-bold fs-5 bg-light">{modelData.name}</Card.Header>
              <Card.Body>
                {Object.values(modelData.departments).map((dept, i) => (
                  <div key={i} className="mb-4">
                    <div className="fw-bold text-primary border-bottom mb-2 pb-1">
                      {dept.name}
                    </div>
                    
                    {dept.confirmed.clothed.total > 0 && (
                      <div className="mb-3">
                        <div className="d-flex justify-content-between align-items-center py-1">
                          <span><Badge bg="success" className="me-2">Clothed</Badge> Confirmed Work</span>
                          <span className="fw-bold">{dept.confirmed.clothed.total} hrs</span>
                        </div>
                        <div className="ms-4 small text-muted">
                          {dept.confirmed.clothed.shifts.map((s, idx) => (
                            <div key={idx} className="d-flex justify-content-between py-1 border-bottom border-light">
                              <span>{s.facultyName}, {s.date}, {s.timeRange}</span>
                              <span>{s.hours} hrs</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {dept.confirmed.nude.total > 0 && (
                      <div className="mb-3">
                        <div className="d-flex justify-content-between align-items-center py-1">
                          <span><Badge bg="danger" className="me-2">Nude</Badge> Confirmed Work</span>
                          <span className="fw-bold">{dept.confirmed.nude.total} hrs</span>
                        </div>
                        <div className="ms-4 small text-muted">
                          {dept.confirmed.nude.shifts.map((s, idx) => (
                            <div key={idx} className="d-flex justify-content-between py-1 border-bottom border-light">
                              <span>{s.facultyName}, {s.date}, {s.timeRange}</span>
                              <span>{s.hours} hrs</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {dept.cancelled.map((can, j) => (
                      <div key={j} className="mb-2">
                        <div className="d-flex justify-content-between align-items-center py-1 text-muted fst-italic">
                          <span>
                            <Badge bg="secondary" className="me-2">Cancelled</Badge>
                            {can.mode === 'nude' ? 'Nude' : 'Clothed'}
                            <Badge bg="warning" text="dark" className="ms-2">⚠️ Late Cancel — Billable</Badge>
                          </span>
                          <span className="fw-bold">{can.hours} hrs</span>
                        </div>
                        <div className="ms-4 small text-muted">
                          <div className="d-flex justify-content-between">
                            <span>{can.facultyName}, {can.date}, {can.timeRange}</span>
                            <span>{can.hours} hrs</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </Card.Body>
            </Card>
          ))
        )
      )}
    </Container>
  );
}

export default Reports;