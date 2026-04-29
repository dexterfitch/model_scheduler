import React, { useState, useEffect } from "react";
import { Container, Table, Badge, Tab, Tabs } from "react-bootstrap";
import { Link } from "react-router-dom";
import api from "../services/api";
import { formatSkinTone } from "../utils/formatters";

function UserDirectory() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/users").then(res => {
      setUsers(res.data);
      setLoading(false);
    }).catch(err => console.error(err));
  }, []);

  const faculty = users.filter(u => u.role === "faculty");
  const models = users.filter(u => u.role === "model");

  return (
    <Container className="py-4">
      <h2 className="mb-4">User Directory</h2>

      <Tabs defaultActiveKey="models" className="mb-3">

        <Tab eventKey="models" title={`Models (${models.length})`}>

          {/* Desktop table — hidden on mobile */}
          <div className="d-none d-md-block">
            <Table hover responsive className="bg-white shadow-sm">
              <thead className="bg-light">
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Demographics</th>
                  <th>Dress</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {models.map(u => (
                  <tr key={u.id}>
                    <td className="align-middle fw-bold">{u.first_name} {u.last_name}</td>
                    <td className="align-middle">
                      <div className="small">{u.email}</div>
                      {u.phone && <div className="small text-muted">{u.phone}</div>}
                      {u.stage_name && <div className="small fst-italic text-muted">"{u.stage_name}"</div>}
                    </td>
                    <td className="align-middle">
                      <Badge bg="dark" text="light" className="me-1">Pronouns: {u.pronouns}</Badge>
                      <Badge bg="dark" text="light" className="me-1">{formatSkinTone(u.skin_tone)}</Badge>
                      <Badge bg="dark" text="light">{u.gender_identity} Gender Presentation</Badge>
                    </td>
                    <td className="align-middle">
                      {u.willing_to_model_nude
                        ? <Badge bg="danger">Nude OK</Badge>
                        : <Badge bg="success">Clothed Only</Badge>}
                    </td>
                    <td className="align-middle">
                      <Link to={`/models/${u.id}`} className="btn btn-sm btn-outline-primary">
                        View Availability
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* Mobile cards — hidden on desktop */}
          <div className="d-md-none">
            {models.length === 0 ? (
              <p className="text-center text-muted py-3">No models found.</p>
            ) : (
              models.map(u => (
                <div key={u.id} className="card mb-3 shadow-sm">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="fw-bold fs-6">{u.first_name} {u.last_name}</div>
                      {u.willing_to_model_nude
                        ? <Badge bg="danger">Nude OK</Badge>
                        : <Badge bg="success">Clothed Only</Badge>}
                    </div>
                    <div className="small text-muted mb-1">
                      <i className="bi bi-envelope me-1"></i>{u.email}
                    </div>
                    {u.phone && (
                      <div className="small text-muted mb-1">
                        <i className="bi bi-telephone me-1"></i>{u.phone}
                      </div>
                    )}
                    {u.stage_name && (
                      <div className="small fst-italic text-muted mb-2">
                        <i className="bi bi-star me-1"></i>"{u.stage_name}"
                      </div>
                    )}
                    <div className="mb-2">
                      <Badge bg="dark" text="light" className="me-1">Pronouns: {u.pronouns}</Badge>
                      <Badge bg="dark" text="light" className="me-1">{formatSkinTone(u.skin_tone)}</Badge>
                      <Badge bg="dark" text="light">{u.gender_identity} Gender Presentation</Badge>
                    </div>
                    <Link to={`/models/${u.id}`} className="btn btn-sm btn-outline-primary w-100">
                      View Availability
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

        </Tab>

        <Tab eventKey="faculty" title={`Faculty (${faculty.length})`}>

          {/* Desktop table — hidden on mobile */}
          <div className="d-none d-md-block">
            <Table hover responsive className="bg-white shadow-sm">
              <thead className="bg-light">
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {faculty.map(u => (
                  <tr key={u.id}>
                    <td className="align-middle fw-bold">{u.first_name} {u.last_name}</td>
                    <td className="align-middle">{u.email}</td>
                    <td className="align-middle">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* Mobile cards — hidden on desktop */}
          <div className="d-md-none">
            {faculty.length === 0 ? (
              <p className="text-center text-muted py-3">No faculty found.</p>
            ) : (
              faculty.map(u => (
                <div key={u.id} className="card mb-3 shadow-sm">
                  <div className="card-body">
                    <div className="fw-bold fs-6 mb-1">{u.first_name} {u.last_name}</div>
                    <div className="small text-muted mb-1">
                      <i className="bi bi-envelope me-1"></i>{u.email}
                    </div>
                    <div className="small text-muted">
                      <i className="bi bi-calendar3 me-1"></i>
                      Joined {new Date(u.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

        </Tab>

      </Tabs>
    </Container>
  );
}

export default UserDirectory;
