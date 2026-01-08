import React, { useState, useEffect } from "react";
import { Container, Table, Badge, Tab, Tabs, Button } from "react-bootstrap";
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
        
        {/* --- MODELS TAB --- */}
        <Tab eventKey="models" title={`Models (${models.length})`}>
          <Table hover responsive className="bg-white shadow-sm">
            <thead className="bg-light">
              <tr>
                <th>Name</th>
                <th>Demographics</th>
                <th>Safety</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {models.map(u => (
                <tr key={u.id}>
                  <td className="align-middle fw-bold">{u.first_name} {u.last_name}</td>
                  <td className="align-middle">
                    <Badge bg="info" text="dark" className="me-1">{formatSkinTone(u.skin_tone)}</Badge>
                    <Badge bg="info" text="dark" className="me-1">{u.gender_identity}</Badge>
                    {u.disability_status !== "None" && <Badge bg="warning" text="dark">{u.disability_status}</Badge>}
                  </td>
                  <td className="align-middle">
                    {u.willing_to_model_nude ? <Badge bg="danger">Nude OK</Badge> : <Badge bg="success">Clothed Only</Badge>}
                  </td>
                  <td>
                    <Link to={`/models/${u.id}`} className="btn btn-sm btn-outline-primary">
                      View Availability
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Tab>

        {/* --- FACULTY TAB --- */}
        <Tab eventKey="faculty" title={`Faculty (${faculty.length})`}>
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
        </Tab>

      </Tabs>
    </Container>
  );
}

export default UserDirectory;