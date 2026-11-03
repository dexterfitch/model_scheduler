/**
 * The Directory: models and faculty in alphabetical order by first name, with links to
 * each model's page, and Retire or Bring Back for each model. Retired models come after
 * the others, marked Retired; people whose data was removed aren't listed.
 */

import React, { useState, useEffect } from "react";
import { Container, Table, Badge, Tab, Tabs, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import api from "../services/api";
import { formatSkinTone, byFirstName } from "../utils/formatters";
import { useRetireModel } from "./useRetireModel";
import StatusToast from "./StatusToast";

/** People in alphabetical order by first name. */
const alphabetical = (list) => [...list].sort(byFirstName);

/** The Directory page, on Models and Faculty tabs. */
function UserDirectory() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const retireOrBringBack = useRetireModel();

  /** Retires a model or brings them back, then updates their place in the list. */
  const handleRetire = async (person) => {
    const result = await retireOrBringBack(person);
    if (!result) return;
    setUsers(prev => prev.map(u => (u.id === person.id ? result.user : u)));
    setSuccess(result.message);
  };

  /** The Retire or Bring Back button for a model. */
  const retireButton = (u, extraClass = '') => (
    <Button
      variant={u.retired_at ? 'outline-success' : 'outline-secondary'}
      size="sm"
      className={extraClass}
      aria-label={`${u.retired_at ? 'Bring Back' : 'Retire'} ${u.first_name} ${u.last_name}`}
      onClick={() => handleRetire(u)}
    >
      {u.retired_at ? 'Bring Back' : 'Retire'}
    </Button>
  );

  useEffect(() => {
    api.get("/users").then(res => {
      setUsers(res.data);
      setLoading(false);
    }).catch(err => console.error(err));
  }, []);

  const people = users.filter(u => !u.removed_at);
  const faculty = alphabetical(people.filter(u => u.role === "faculty"));
  const activeModels = alphabetical(people.filter(u => u.role === "model" && !u.retired_at));
  const models = [...activeModels, ...alphabetical(people.filter(u => u.role === "model" && u.retired_at))];

  return (
    <Container className="py-4">
      <StatusToast message={success} onClose={() => setSuccess('')} />
      <h2 className="mb-4">User Directory</h2>

      {loading && <p className="text-muted" role="status">Loading…</p>}

      <Tabs defaultActiveKey="models" className="mb-3">

        <Tab eventKey="models" title={`Models (${activeModels.length})`}>

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
                    <td className="align-middle fw-bold">
                      {u.first_name} {u.last_name}
                      {u.retired_at && <Badge bg="secondary" className="ms-2">Retired</Badge>}
                    </td>
                    <td className="align-middle">
                      <div className="small">{u.email}</div>
                      {u.phone && <div className="small text-muted">{u.phone}</div>}
                      {u.stage_name && <div className="small fst-italic text-muted">"{u.stage_name}"</div>}
                    </td>
                    <td className="align-middle">
                      {u.pronouns && <Badge bg="dark" text="light" className="me-1">Pronouns: {u.pronouns}</Badge>}
                      <Badge bg="dark" text="light" className="me-1">{formatSkinTone(u.skin_tone)}</Badge>
                      <Badge bg="dark" text="light" className="me-1">Gender: {u.gender_identity}</Badge>
                      {u.body_type && <Badge bg="dark" text="light" className="me-1">{u.body_type} Build</Badge>}
                      {u.willing_to_model_nude && u.genitalia && <Badge bg="dark" text="light">{u.genitalia} Genitalia</Badge>}
                    </td>
                    <td className="align-middle">
                      {u.willing_to_model_nude
                        ? <Badge bg="danger">Nude OK</Badge>
                        : <Badge bg="success">Clothed Only</Badge>}
                    </td>
                    <td className="align-middle">
                      <div className="d-flex flex-column gap-1">
                        <Link to={`/models/${u.id}`} className="btn btn-sm btn-outline-primary">
                          View Availability
                        </Link>
                        {retireButton(u)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="d-md-none">
            {models.length === 0 ? (
              <p className="text-center text-muted py-3">No models found.</p>
            ) : (
              models.map(u => (
                <div key={u.id} className="card mb-3 shadow-sm">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="fw-bold fs-6">
                        {u.first_name} {u.last_name}
                        {u.retired_at && <Badge bg="secondary" className="ms-2">Retired</Badge>}
                      </div>
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
                      {u.pronouns && <Badge bg="dark" text="light" className="me-1">Pronouns: {u.pronouns}</Badge>}
                      <Badge bg="dark" text="light" className="me-1">{formatSkinTone(u.skin_tone)}</Badge>
                      <Badge bg="dark" text="light" className="me-1">Gender: {u.gender_identity}</Badge>
                      {u.body_type && <Badge bg="dark" text="light" className="me-1">{u.body_type} Build</Badge>}
                      {u.willing_to_model_nude && u.genitalia && <Badge bg="dark" text="light">{u.genitalia} Genitalia</Badge>}
                    </div>
                    <div className="d-flex gap-2">
                      <Link to={`/models/${u.id}`} className="btn btn-sm btn-outline-primary flex-grow-1">
                        View Availability
                      </Link>
                      {retireButton(u)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

        </Tab>

        <Tab eventKey="faculty" title={`Faculty (${faculty.length})`}>

          <div className="d-none d-md-block">
            <Table hover responsive className="bg-white shadow-sm">
              <thead className="bg-light">
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {faculty.map(u => (
                  <tr key={u.id}>
                    <td className="align-middle fw-bold">{u.first_name} {u.last_name}</td>
                    <td className="align-middle">{u.email}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

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
