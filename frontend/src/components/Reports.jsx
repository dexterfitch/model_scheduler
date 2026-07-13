import React, { useState, useEffect } from "react";
import { Container, Row, Col, Form, Button, Card, Badge, Alert } from "react-bootstrap";
import api from "../services/api";
import { formatTimeShort, formatDateNumeric } from "../utils/time";
import styles from "./Reports.module.css";

function Reports() {
  const [gigs, setGigs] = useState([]);
  const [fetchError, setFetchError] = useState('');
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [report, setReport] = useState(null);

  useEffect(() => {
    api.get("/gigs")
      .then(res => setGigs(res.data))
      .catch(() => setFetchError("Failed to load gig data. Please try again."));
  }, []);

  const calculateHours = (startsAt, endsAt) => {
    const ms = new Date(endsAt) - new Date(startsAt);
    return Math.round((ms / 36e5) * 4) / 4;
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
        byModel[modelKey] = { id: modelKey, name: modelName, departments: {} };
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
        className: gig.faculty_request.class_name,
        date: formatDateNumeric(gig.faculty_request.starts_at),
        timeRange: `${formatTimeShort(gig.faculty_request.starts_at)} - ${formatTimeShort(gig.faculty_request.ends_at)}`,
        hours
      };

      if (isConfirmed) {
        deptData.confirmed[mode].total += hours;
        deptData.confirmed[mode].shifts.push(shiftInfo);
      } else if (isCancelled && isLateCancelled) {
        deptData.cancelled.push({ ...shiftInfo, mode, isLateCancelled });
      }
    });

    Object.values(byModel).forEach(modelData => {
      Object.values(modelData.departments).forEach(dept => {
        dept.confirmed.clothed.shifts.sort((a, b) => new Date(a.date) - new Date(b.date));
        dept.confirmed.nude.shifts.sort((a, b) => new Date(a.date) - new Date(b.date));
        dept.cancelled.sort((a, b) => new Date(a.date) - new Date(b.date));
      });
    });

    setReport(byModel);
  };

  const deptHasContent = (dept) =>
    dept.confirmed.clothed.total > 0 || dept.confirmed.nude.total > 0 || dept.cancelled.length > 0;

  const modelHasContent = (modelData) =>
    Object.values(modelData.departments).some(deptHasContent);

  const modelTotalHours = (modelData) =>
    Object.values(modelData.departments).reduce((sum, dept) => {
      const cancelledHours = dept.cancelled.reduce((s, c) => s + c.hours, 0);
      return sum + dept.confirmed.clothed.total + dept.confirmed.nude.total + cancelledHours;
    }, 0);

  const flattenReportRows = () => {
    const rows = [];
    Object.values(report)
      .filter(modelHasContent)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(modelData => {
        Object.values(modelData.departments)
          .filter(deptHasContent)
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach(dept => {
            const deptRows = [];

            dept.confirmed.clothed.shifts.forEach(s => deptRows.push({
              modelName: modelData.name, department: dept.name, className: s.className,
              facultyName: s.facultyName, date: s.date, timeRange: s.timeRange,
              mode: "Clothed", status: "Confirmed", hours: s.hours
            }));
            dept.confirmed.nude.shifts.forEach(s => deptRows.push({
              modelName: modelData.name, department: dept.name, className: s.className,
              facultyName: s.facultyName, date: s.date, timeRange: s.timeRange,
              mode: "Nude", status: "Confirmed", hours: s.hours
            }));
            dept.cancelled.forEach(c => deptRows.push({
              modelName: modelData.name, department: dept.name, className: c.className,
              facultyName: c.facultyName, date: c.date, timeRange: c.timeRange,
              mode: c.mode === 'nude' ? "Nude" : "Clothed", status: "Cancelled (Billable)", hours: c.hours
            }));

            deptRows.sort((a, b) => new Date(a.date) - new Date(b.date) || a.mode.localeCompare(b.mode));
            rows.push(...deptRows);
          });
      });
    return rows;
  };

  const renderShiftLine = (shift) => (
    <div className={`py-1 border-bottom border-light ${styles.shiftLine}`}>
      <div className={`d-flex justify-content-between ${styles.shiftLineDesktop}`}>
        <span>{shift.facultyName}, {shift.date}, {shift.timeRange}</span>
        <span className="ms-2 fw-bold">{shift.hours} hrs</span>
      </div>
      <div className={styles.shiftLineMobile}>
        <div>{shift.facultyName}</div>
        <div className="d-flex justify-content-between">
          <span>{shift.date}, {shift.timeRange}</span>
          <span className="fw-bold">{shift.hours} hrs</span>
        </div>
      </div>
    </div>
  );

  const renderConfirmedSection = (modeData, label, badgeVariant) => {
    if (modeData.total <= 0) return null;
    return (
      <div className="mb-3">
        <div className="d-flex justify-content-between align-items-center py-1">
          <span><Badge bg={badgeVariant} className="me-2">{label}</Badge></span>
          <span className="fw-bold">{modeData.total} hrs</span>
        </div>
        <div className="ms-2 ms-md-4 small text-muted">
          {modeData.shifts.map((s, idx) => <React.Fragment key={idx}>{renderShiftLine(s)}</React.Fragment>)}
        </div>
      </div>
    );
  };

  const renderCancelledEntry = (can, idx) => (
    <div key={idx} className="mb-3">
      <div className="d-flex justify-content-between align-items-center py-1">
        <span>
          <Badge bg={can.mode === 'nude' ? 'danger' : 'success'} className="me-2">
            {can.mode === 'nude' ? 'Nude' : 'Clothed'}
          </Badge>
          <Badge bg="warning" text="dark">⚠️ Late Cancel — Billable</Badge>
        </span>
        <span className="fw-bold">{can.hours} hrs</span>
      </div>
      <div className="ms-2 ms-md-4 small text-muted">
        {renderShiftLine(can)}
      </div>
    </div>
  );

  return (
    <Container className="py-4">
      <h2 className={`mb-4 ${styles.printHide}`}>Reports</h2>

      {fetchError && (
        <Alert variant="danger" dismissible onClose={() => setFetchError('')}>
          {fetchError}
        </Alert>
      )}

      <Card className={`shadow-sm mb-4 ${styles.reportHeaderCard} ${styles.printHide}`}>
        <Card.Header className="bg-primary text-white fw-bold">Model Hours Report</Card.Header>
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col xs={12} sm={6} md={4}>
              <Form.Label>Start Date</Form.Label>
              <Form.Control type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Label>End Date</Form.Label>
              <Form.Control type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </Col>
            <Col xs={12} md={4}>
              <Button variant="primary" className="w-100 mb-2" onClick={generateReport}>
                Generate Report
              </Button>
              {report && (
                <Button variant="outline-dark" className="w-100" onClick={() => window.print()}>
                  Print
                </Button>
              )}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {report && (
        Object.values(report).every(modelData => !modelHasContent(modelData)) ? (
          <Alert variant="info">No gigs found in this date range.</Alert>
        ) : (
          Object.values(report)
            .filter(modelHasContent)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(modelData => (
              <Card key={modelData.id} className={`shadow-sm mb-4 ${styles.modelCard}`}>
                <Card.Header className="fw-bold fs-5 bg-light d-flex justify-content-between align-items-center">
                  {modelData.name}
                  <span className="small fw-normal text-muted">Payable Total: {modelTotalHours(modelData)} hrs</span>
                </Card.Header>
                <Card.Body>
                  {Object.values(modelData.departments)
                    .filter(deptHasContent)
                    .map((dept, i) => (
                      <div key={i} className={`mb-4 ${styles.deptSection}`}>
                        <div className="fw-bold text-primary border-bottom mb-2 pb-1">
                          {dept.name}
                        </div>
                        {renderConfirmedSection(dept.confirmed.clothed, "Clothed", "success")}
                        {renderConfirmedSection(dept.confirmed.nude, "Nude", "danger")}
                        {dept.cancelled.map((can, j) => renderCancelledEntry(can, j))}
                      </div>
                  ))}
                </Card.Body>
              </Card>
          ))
        )
      )}
      {report && !Object.values(report).every(modelData => !modelHasContent(modelData)) && (
        <>
          <div className={`${styles.printOnly} mb-2`}>
            <strong>Report Period:</strong> {startDate} – {endDate}
          </div>
          <table className={`table table-sm table-bordered ${styles.printTable}`}>
            <thead>
              <tr>
                <th>Model</th>
                <th>Department</th>
                <th>Mode</th>
                <th>Date</th>
                <th>Time</th>
                <th className="text-end">Hours</th>
              </tr>
            </thead>
            <tbody>
              {flattenReportRows().map((row, i, arr) => {
                const isNewModel = i === 0 || arr[i - 1].modelName !== row.modelName;
                return (
                  <tr key={i} className={isNewModel ? styles.newModelRow : undefined}>
                    <td>{row.modelName}</td>
                    <td>{row.department}</td>
                    <td>{row.date}</td>
                    <td>{row.timeRange}</td>
                    <td>{row.mode}</td>
                    <td className="text-end">{row.hours}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </Container>
  );
}

export default Reports;