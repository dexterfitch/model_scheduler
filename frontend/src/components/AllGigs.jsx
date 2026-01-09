import React, { useState, useEffect } from "react";
import { Table, Container, Badge, Button, Form, InputGroup } from "react-bootstrap";
import api from "../services/api";

function AllGigs() {
  const [gigs, setGigs] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchGigs();
  }, []);

  const fetchGigs = () => {
    api.get("/gigs")
      .then(res => {
        // Sort by date (newest first)
        const sorted = res.data.sort((a, b) => 
          new Date(b.faculty_request.starts_at) - new Date(a.faculty_request.starts_at)
        );
        setGigs(sorted);
      })
      .catch(err => console.error(err));
  };

  const handleDelete = (id) => {
    if (!confirm("Are you sure you want to cancel this Gig? The Faculty Request will be re-opened.")) return;

    api.delete(`/gigs/${id}`)
      .then(() => {
        alert("Gig cancelled.");
        fetchGigs(); // Refresh list
      })
      .catch(err => console.error("Error deleting gig", err));
  };

  // Filter Logic
  const filteredGigs = gigs.filter(gig => {
    const term = search.toLowerCase();
    const modelName = `${gig.art_model_availability.user.first_name} ${gig.art_model_availability.user.last_name}`.toLowerCase();
    const facultyName = `${gig.faculty_request.user.first_name} ${gig.faculty_request.user.last_name}`.toLowerCase();
    const className = gig.faculty_request.class_name.toLowerCase();

    return modelName.includes(term) || facultyName.includes(term) || className.includes(term);
  });

  const formatDate = (d) => new Date(d).toLocaleDateString() + " " + new Date(d).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Gig Registry</h2>
        <InputGroup style={{ maxWidth: '300px' }}>
          <InputGroup.Text>🔍</InputGroup.Text>
          <Form.Control 
            placeholder="Search name or class..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>

      <div className="bg-white shadow-sm rounded overflow-hidden">
        <Table hover responsive className="mb-0">
          <thead className="bg-light">
            <tr>
              <th>Date & Time</th>
              <th>Class Name</th>
              <th>Faculty</th>
              <th>Model</th>
              <th>Status</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredGigs.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-4 text-muted">
                  No gigs found matching your search.
                </td>
              </tr>
            ) : (
              filteredGigs.map(gig => (
                <tr key={gig.id}>
                  <td className="align-middle">
                    {/* Safety Check: ensure faculty_request exists */}
                    <div className="fw-bold">{new Date(gig.faculty_request?.starts_at).toLocaleDateString()}</div>
                    <div className="small text-muted">
                      {new Date(gig.faculty_request?.starts_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - 
                      {new Date(gig.faculty_request?.ends_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                    </div>
                  </td>
                  <td className="align-middle">
                    {gig.faculty_request?.class_name}
                    {gig.faculty_request?.model_mode === 'nude' && (
                      <Badge bg="danger" className="ms-2" style={{fontSize: '0.6em'}}>NUDE</Badge>
                    )}
                  </td>
                  <td className="align-middle">
                    {/* Safety Check: ensure user exists */}
                    {gig.faculty_request?.user?.first_name} {gig.faculty_request?.user?.last_name}
                  </td>
                  <td className="align-middle">
                    <Badge bg="success" text="light" className="p-2">
                      {gig.art_model_availability?.user?.first_name} {gig.art_model_availability?.user?.last_name}
                    </Badge>
                  </td>
                  <td className="align-middle">
                    <Badge bg="primary">Confirmed</Badge>
                  </td>
                  <td className="align-middle text-end">
                    <Button variant="outline-danger" size="sm" onClick={() => handleDelete(gig.id)}>
                      Cancel
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </Container>
  );
}

export default AllGigs;