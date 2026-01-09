import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card, Button, Badge, Modal, Form, Alert } from "react-bootstrap";
import api from "../services/api";
import { formatSkinTone } from "../utils/formatters";

// 1. DEFINE DEPARTMENTS
const DEPARTMENTS = [
  "Painting",
  "Drawing",
  "Illustration",
  "FYE",
  "Sculpture",
  "Open Studies"
];

function FacultyDashboard({ user }) {
  const [requests, setRequests] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // 2. UPDATE FORM STATE
  const [formData, setFormData] = useState({
    class_name: "",
    department: "",
    date: "",
    start_time: "",
    end_time: "",
    model_mode: "clothed",
    pref_skin_tone: "Any",
    pref_gender: "Any",
    pref_disability: "Any" // <--- ADDED
  });

  useEffect(() => {
    fetchMyRequests();
  }, [user.id]);

  const fetchMyRequests = () => {
    api.get(`/faculty_requests?user_id=${user.id}`)
      .then((res) => {
        const sorted = res.data.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
        setRequests(sorted);
        setLoading(false);
      })
      .catch((err) => console.error("Error fetching requests:", err));
  };

  // HELPER: Generate options for the Datalist (8am - 10pm)
  const generateTimeOptions = () => {
    const options = [];
    let start = 8 * 60; 
    const end = 22 * 60; 
    while (start <= end) {
      const hours = Math.floor(start / 60);
      const mins = start % 60;
      const value = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      options.push(<option key={value} value={value} />);
      start += 5;
    }
    return options;
  };

  // HELPER: Auto-round time to nearest 5 minutes
  const roundToNearest5 = (timeStr) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(':').map(Number);
    const totalMins = h * 60 + m;
    const rounded = Math.round(totalMins / 5) * 5;
    const newH = Math.floor(rounded / 60);
    const newM = rounded % 60;
    return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    if (name === 'start_time' || name === 'end_time') {
        const cleanedTime = roundToNearest5(value);
        setFormData(prev => ({ ...prev, [name]: cleanedTime }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const inputDate = new Date(formData.date + "T00:00:00"); // Force local time
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Strip time from today for accurate comparison

    if (inputDate <= today) {
      alert("Requests must be made for a future date (tomorrow or later).");
      return;
    }

    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 4); // Add 4 months to today

    if (inputDate > maxDate) {
      alert("Requests cannot be made more than 4 months in advance.");
      return;
    }

    const startDateTime = new Date(`${formData.date}T${formData.start_time}`);
    const endDateTime = new Date(`${formData.date}T${formData.end_time}`);
    const startHour = parseInt(formData.start_time.split(':')[0]);
    const endHour = parseInt(formData.end_time.split(':')[0]);

    if (startHour < 8 || startHour >= 22) {
      alert("Classes must start between 8:00 AM and 10:00 PM."); return;
    }
    if (endHour > 22 || (endHour === 22 && formData.end_time.split(':')[1] !== "00")) {
       alert("Classes must end by 10:00 PM."); return;
    }
    if (endDateTime <= startDateTime) {
      alert("End time must be after start time."); return;
    }

    const payload = {
      user_id: user.id,
      class_name: formData.class_name,
      department: formData.department,
      starts_at: startDateTime,
      ends_at: endDateTime,
      model_mode: formData.model_mode,
      pref_skin_tone: formData.pref_skin_tone,
      pref_gender: formData.pref_gender,
      pref_disability: formData.pref_disability, // <--- ADDED TO PAYLOAD
      status: "pending"
    };

    api.post("/faculty_requests", payload)
      .then(() => {
        alert("Request submitted!");
        setShowModal(false);
        fetchMyRequests(); 
        setFormData({
            class_name: "", department: "", date: "", start_time: "", end_time: "", 
            model_mode: "clothed", pref_skin_tone: "Any", pref_gender: "Any", pref_disability: "Any"
        });
      })
      .catch((err) => {
        console.error(err);
        alert("Error submitting request. Check console.");
      });
  };

  const handleCancel = (id, status, startsAt) => {
    let message = "Are you sure you want to cancel this request?";

    if (status === 'matched') {
      // Check 24h window client-side for better UX
      const gigDate = new Date(startsAt);
      const now = new Date();
      const diffHours = (gigDate - now) / 36e5; // Convert ms to hours

      if (diffHours < 24) {
        message = "⚠️ LATE CANCELLATION WARNING ⚠️\n\nThis class is less than 24 hours away.\nCancelling now may still incur model fees.\n\nAre you sure?";
      } else {
        message = "This will cancel the confirmed model. Are you sure?";
      }
    }

    if (!confirm(message)) return;

    api.delete(`/faculty_requests/${id}`)
      .then(() => {
        alert("Cancelled.");
        fetchMyRequests();
      })
      .catch(err => console.error(err));
  };

  const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>My Classes</h2>
          <p className="text-muted">Manage your model needs</p>
        </div>
        <Button variant="primary" size="lg" onClick={() => setShowModal(true)}>
          + New Request
        </Button>
      </div>

      {requests.length === 0 && !loading && (
        <Alert variant="info">You haven't requested any models yet. Click "New Request" to start.</Alert>
      )}

      <Row>
        {requests.map((req) => (
          <Col md={6} lg={4} key={req.id} className="mb-4">
            <Card className="h-100 shadow-sm border-0">
              <Card.Header className={`text-white fw-bold ${req.status === 'matched' ? 'bg-success' : 'bg-warning'}`}>
                {req.status === 'matched' ? '✅ Model Confirmed' : '⏳ Pending Match'}
              </Card.Header>
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start">
                  <Card.Title>{req.class_name}</Card.Title>
                  {req.department && <Badge bg="secondary" className="small">{req.department}</Badge>}
                </div>
                
                <div className="mb-3">
                  <div className="fs-5">{formatDate(req.starts_at)}</div>
                  <div className="text-muted">{formatTime(req.starts_at)} - {formatTime(req.ends_at)}</div>
                </div>

                <div className="d-flex flex-wrap gap-2 mb-3">
                    {req.model_mode === 'nude' 
                        ? <Badge bg="danger">Nude Required</Badge> 
                        : <Badge bg="success">Clothed</Badge>
                    }
                    {/* Only show preferences if they are NOT 'Any' */}
                    {req.pref_skin_tone !== 'Any' && <Badge bg="light" text="dark" className="border">Skin: {formatSkinTone(req.pref_skin_tone)}</Badge>}
                    {req.pref_gender !== 'Any' && <Badge bg="light" text="dark" className="border">Gender: {req.pref_gender}</Badge>}
                    {req.pref_disability === 'Yes' && <Badge bg="info" text="dark" className="border">♿ Disability Pref.</Badge>}
                </div>
                                
                {(req.status === 'pending' || req.status === 'matched') && (
                  <Button 
                    variant={req.status === 'matched' ? "danger" : "outline-danger"} 
                    size="sm" 
                    className="w-100 mt-2" 
                    onClick={() => handleCancel(req.id, req.status, req.starts_at)}
                  >
                    {req.status === 'matched' ? "Cancel Confirmed Class" : "Cancel Request"}
                  </Button>
                )}
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* --- CREATE REQUEST MODAL --- */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Request a Model</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={8} className="mb-3">
                <Form.Label>Class Name</Form.Label>
                <Form.Control required name="class_name" value={formData.class_name} onChange={handleInputChange} placeholder="e.g. Figure Drawing 101" />
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label>Department</Form.Label>
                <Form.Select required name="department" value={formData.department} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </Form.Select>
              </Col>
            </Row>

            <Row>
              <Col md={4} className="mb-3">
                <Form.Label>Date</Form.Label>
                <Form.Control required type="date" name="date" value={formData.date} onChange={handleInputChange} />
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label>Start Time</Form.Label>
                <Form.Control required type="time" name="start_time" list="time-options" value={formData.start_time} onChange={handleInputChange} onBlur={handleBlur} min="08:00" max="22:00" />
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label>End Time</Form.Label>
                <Form.Control required type="time" name="end_time" list="time-options" value={formData.end_time} onChange={handleInputChange} onBlur={handleBlur} min="08:00" max="22:00" />
              </Col>
            </Row>

            <datalist id="time-options">{generateTimeOptions()}</datalist>

            <hr />
            <h5>Model Preferences</h5>

            <Row>
              {/* SPLIT INTO 4 COLUMNS TO FIT DISABILITY */}
              <Col md={3} className="mb-3">
                <Form.Label>Nudity</Form.Label>
                <Form.Select name="model_mode" value={formData.model_mode} onChange={handleInputChange}>
                  <option value="clothed">Clothed</option>
                  <option value="nude">Nude</option>
                </Form.Select>
              </Col>
              
              <Col md={3} className="mb-3">
                <Form.Label>Skin Tone</Form.Label>
                <Form.Select name="pref_skin_tone" value={formData.pref_skin_tone} onChange={handleInputChange}>
                  <option value="Any">Any</option>
                  <option value="Light">Light</option>
                  <option value="Medium">Medium</option>
                  <option value="Dark">Dark</option>
                </Form.Select>
              </Col>

              <Col md={3} className="mb-3">
                <Form.Label>Gender</Form.Label>
                <Form.Select name="pref_gender" value={formData.pref_gender} onChange={handleInputChange}>
                  <option value="Any">Any</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-Binary">Non-Binary</option>
                </Form.Select>
              </Col>

               {/* NEW FIELD */}
              <Col md={3} className="mb-3">
                <Form.Label>Disability</Form.Label>
                <Form.Select name="pref_disability" value={formData.pref_disability} onChange={handleInputChange}>
                  <option value="Any">Any</option>
                  <option value="Yes">Yes (Preferred)</option>
                  <option value="No">No</option>
                </Form.Select>
              </Col>
            </Row>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
              <Button variant="primary" type="submit">Submit Request</Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
}

export default FacultyDashboard;