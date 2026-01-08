import React, { useState, useEffect } from "react";
import { Container, Table, Badge, Form, InputGroup } from "react-bootstrap";
import api from "../services/api";

function AllRequests() {
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/faculty_requests").then(res => {
      // Sort newest first
      const sorted = res.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setRequests(sorted);
    });
  }, []);

  const filtered = requests.filter(r => 
    r.class_name.toLowerCase().includes(search.toLowerCase()) || 
    r.user.last_name.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending': return <Badge bg="warning" text="dark">Pending</Badge>;
      case 'matched': return <Badge bg="success">Matched</Badge>;
      case 'archived': return <Badge bg="secondary">Archived</Badge>;
      default: return <Badge bg="light" text="dark">{status}</Badge>;
    }
  };

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Faculty Request Archive</h2>
        <InputGroup style={{ maxWidth: '300px' }}>
          <InputGroup.Text>🔍</InputGroup.Text>
          <Form.Control placeholder="Search..." onChange={e => setSearch(e.target.value)} />
        </InputGroup>
      </div>

      <Table hover responsive className="shadow-sm bg-white">
        <thead className="bg-light">
          <tr>
            <th>Date Needed</th>
            <th>Class</th>
            <th>Faculty</th>
            <th>Reqs</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(req => (
            <tr key={req.id}>
              <td>{new Date(req.starts_at).toLocaleDateString()}</td>
              <td>
                <div className="fw-bold">{req.class_name}</div>
                <small className="text-muted">
                  {new Date(req.starts_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - 
                  {new Date(req.ends_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                </small>
              </td>
              <td>{req.user.first_name} {req.user.last_name}</td>
              <td>
                {req.model_mode === 'nude' ? <span className="text-danger fw-bold me-2">Nude</span> : <span className="text-success me-2">Clothed</span>}
                <small className="text-muted">({req.pref_skin_tone}, {req.pref_gender})</small>
              </td>
              <td>{getStatusBadge(req.status)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Container>
  );
}

export default AllRequests;