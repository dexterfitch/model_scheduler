/**
 * Reports: paid hours per model for a date range, by department and nude or clothed,
 * with paid late cancellations and corrected gigs labelled. Prints as a table, or
 * downloads as a CSV file for payroll.
 */

import React, { useState, useEffect } from "react";
import { Container, Row, Col, Form, Button, Card, Badge, Alert } from "react-bootstrap";
import api from "../services/api";
import { formatTimeShort, formatDateNumeric } from "../utils/time";
import styles from "./Reports.module.css";
import { isPaid, workedTimes, paidHours, wasCorrected } from "../utils/pay";
import { toCsv, downloadCsv } from '../utils/csv';
import { useRevealMessage } from '../utils/revealMessage';

/** The first and last day of the current month, as date fields expect them. */
const monthBounds = (today = new Date()) => ({
  start: new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('en-CA'),
  end: new Date(today.getFullYear(), today.getMonth() + 1, 0).toLocaleDateString('en-CA')
});

const CANCELLED_STATUS = {
  late: "Late cancel (billable)",
  'no-show': "No-show (paid, corrected)",
  corrected: "Cancelled (paid, corrected)",
};
const CANCELLED_BADGE = {
  late: "⚠️ Late Cancel — Billable",
  'no-show': "No-show — Paid (corrected)",
  corrected: "Cancelled — Paid (corrected)",
};

/** The Reports page. */
function Reports() {
  const [gigs, setGigs] = useState([]);
  const [fetchError, setFetchError] = useState('');
  const fetchErrorRef = useRevealMessage(fetchError);
  const [startDate, setStartDate] = useState(() => monthBounds().start);
  const [endDate, setEndDate] = useState(() => monthBounds().end);
  const [report, setReport] = useState(null);
  const [formError, setFormError] = useState('');
  const formErrorRef = useRevealMessage(formError);

  useEffect(() => {
    api.get("/gigs")
      .then(res => setGigs(res.data))
      .catch(() => setFetchError("Failed to load gig data. Please try again."));
  }, []);

  /** Totals the paid hours of every gig in the range, by model and department. */
  const generateReport = () => {
    if (!startDate || !endDate) {
      setFormError("Please select both a start and end date.");
      return;
    }
    setFormError('');

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
      if (!isPaid(gig)) return;
      const worked = workedTimes(gig);
      const hours = paidHours(gig);
      const corrected = wasCorrected(gig);
      const isConfirmed = gig.status !== "cancelled";

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
        timeRange: `${formatTimeShort(worked.starts_at)} - ${formatTimeShort(worked.ends_at)}`,
        hours,
        corrected
      };

      if (isConfirmed) {
        deptData.confirmed[mode].total += hours;
        deptData.confirmed[mode].shifts.push(shiftInfo);
      } else {
        const kind = gig.no_show ? 'no-show' : corrected ? 'corrected' : 'late';
        deptData.cancelled.push({ ...shiftInfo, mode, kind });
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

  /** Whether a department has anything to pay. */
  const deptHasContent = (dept) =>
    dept.confirmed.clothed.total > 0 || dept.confirmed.nude.total > 0 || dept.cancelled.length > 0;

  /** Whether a model has anything to pay. */
  const modelHasContent = (modelData) =>
    Object.values(modelData.departments).some(deptHasContent);

  /** A model's total paid hours. */
  const modelTotalHours = (modelData) =>
    Object.values(modelData.departments).reduce((sum, dept) => {
      const cancelledHours = dept.cancelled.reduce((s, c) => s + c.hours, 0);
      return sum + dept.confirmed.clothed.total + dept.confirmed.nude.total + cancelledHours;
    }, 0);

  /** The report as rows for the print table, by model and department in date order. */
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
              mode: "Clothed", status: s.corrected ? "Confirmed (corrected)" : "Confirmed", hours: s.hours
            }));
            dept.confirmed.nude.shifts.forEach(s => deptRows.push({
              modelName: modelData.name, department: dept.name, className: s.className,
              facultyName: s.facultyName, date: s.date, timeRange: s.timeRange,
              mode: "Nude", status: s.corrected ? "Confirmed (corrected)" : "Confirmed", hours: s.hours
            }));
            dept.cancelled.forEach(c => deptRows.push({
              modelName: modelData.name, department: dept.name, className: c.className,
              facultyName: c.facultyName, date: c.date, timeRange: c.timeRange,
              mode: c.mode === 'nude' ? "Nude" : "Clothed", status: CANCELLED_STATUS[c.kind], hours: c.hours
            }));

            deptRows.sort((a, b) => new Date(a.date) - new Date(b.date) || a.mode.localeCompare(b.mode));
            rows.push(...deptRows);
          });
      });
    return rows;
  };

  /** Downloads the report as a CSV file, one row per paid gig, for payroll. */
  const handleDownloadCsv = () => {
    const header = ['Model', 'Department', 'Class', 'Faculty', 'Date', 'Time', 'Mode', 'Status', 'Hours'];
    const rows = flattenReportRows().map(r =>
      [r.modelName, r.department, r.className, r.facultyName, r.date, r.timeRange, r.mode, r.status, r.hours]);
    downloadCsv(`model-hours-${startDate}-to-${endDate}.csv`, toCsv(header, rows));
  };

  /** One gig's line: faculty, date, time and hours. */
  const renderShiftLine = (shift) => (
    <div className={`py-1 border-bottom border-light ${styles.shiftLine}`}>
      <div className={`d-flex justify-content-between ${styles.shiftLineDesktop}`}>
        <span>{shift.facultyName}, {shift.date}, {shift.timeRange}{shift.corrected && ' (corrected)'}</span>
        <span className="ms-2 fw-bold">{shift.hours} hrs</span>
      </div>
      <div className={styles.shiftLineMobile}>
        <div>{shift.facultyName}</div>
        <div className="d-flex justify-content-between">
          <span>{shift.date}, {shift.timeRange}{shift.corrected && ' (corrected)'}</span>
          <span className="fw-bold">{shift.hours} hrs</span>
        </div>
      </div>
    </div>
  );

  /** A model's worked gigs in one mode, with their total. */
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

  /** A cancelled gig that's still paid, labelled with why. */
  const renderCancelledEntry = (can, idx) => (
    <div key={idx} className="mb-3">
      <div className="d-flex justify-content-between align-items-center py-1">
        <span>
          <Badge bg={can.mode === 'nude' ? 'danger' : 'success'} className="me-2">
            {can.mode === 'nude' ? 'Nude' : 'Clothed'}
          </Badge>
          <Badge bg="warning" text="dark">{CANCELLED_BADGE[can.kind]}</Badge>
        </span>
        <span className="fw-bold">{can.hours} hrs</span>
      </div>
      <div className="ms-2 ms-md-4 small text-muted">
        {renderShiftLine(can)}
      </div>
    </div>
  );

  /** The printable table, with a total under each model and a grand total. */
  const renderPrintTable = () => {
    const rows = flattenReportRows();
    /** A model's total hours in the table. */
    const totalFor = (name) => rows.filter(r => r.modelName === name).reduce((sum, r) => sum + r.hours, 0);
    const grandTotal = rows.reduce((sum, r) => sum + r.hours, 0);

    return (
      <table className={`table table-sm table-bordered ${styles.printTable}`}>
        <thead>
          <tr>
            <th>Model</th>
            <th>Department</th>
            <th>Date</th>
            <th>Time</th>
            <th>Mode</th>
            <th>Status</th>
            <th className="text-end">Hours</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isNewModel = i === 0 || rows[i - 1].modelName !== row.modelName;
            const isLastForModel = i === rows.length - 1 || rows[i + 1].modelName !== row.modelName;
            return (
              <React.Fragment key={i}>
                <tr className={isNewModel ? styles.newModelRow : undefined}>
                  <td>{row.modelName}</td>
                  <td>{row.department}</td>
                  <td>{row.date}</td>
                  <td>{row.timeRange}</td>
                  <td>{row.mode}</td>
                  <td>{row.status}</td>
                  <td className="text-end">{row.hours}</td>
                </tr>
                {isLastForModel && (
                  <tr className="fw-bold">
                    <td colSpan={6}>Total for {row.modelName}</td>
                    <td className="text-end">{totalFor(row.modelName)}</td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="fw-bold">
            <td colSpan={6}>Grand total</td>
            <td className="text-end">{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    );
  };

  return (
    <Container className="py-4">
      <h2 className={`mb-4 ${styles.printHide}`}>Reports</h2>

      {fetchError && (
        <Alert ref={fetchErrorRef} tabIndex={-1} variant="danger" dismissible onClose={() => setFetchError('')}>
          {fetchError}
        </Alert>
      )}

      <Card className={`shadow-sm mb-4 ${styles.reportHeaderCard} ${styles.printHide}`}>
        <Card.Header className="bg-primary text-white fw-bold">Model Hours Report</Card.Header>
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Form.Group as={Col} xs={12} sm={6} md={4} controlId="report-start-date">
              <Form.Label>Start Date</Form.Label>
              <Form.Control type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </Form.Group>
            <Form.Group as={Col} xs={12} sm={6} md={4} controlId="report-end-date">
              <Form.Label>End Date</Form.Label>
              <Form.Control type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </Form.Group>
            <Col xs={12} md={4}>
              <Button variant="primary" className="w-100 mb-2" onClick={generateReport}>
                Generate Report
              </Button>
              {report && (
                <div className="d-flex gap-2">
                  <Button variant="outline-dark" className="w-100" onClick={() => window.print()}>
                    Print
                  </Button>
                  <Button variant="outline-dark" className="w-100" onClick={handleDownloadCsv}>
                    Download CSV
                  </Button>
                </div>
              )}
            </Col>
          </Row>
          {formError && <Alert ref={formErrorRef} tabIndex={-1} variant="danger" className="mt-3 mb-0">{formError}</Alert>}
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
          {renderPrintTable()}
        </>
      )}
    </Container>
  );
}

export default Reports;
