import { useState, useEffect } from 'react';
import { getBookingRequests, approveRequest, denyRequest, getOpenCalls, acceptBid } from '../services/api';

export default function AdminDashboard({ user }) {
  const [requests, setRequests] = useState([]);
  const [openCalls, setOpenCalls] = useState([]); // New State for Job Board

  const fetchData = () => {
    // 1. Existing Booking Requests
    getBookingRequests(user.email)
      .then(res => setRequests(res.data))
      .catch(console.error);

    // 2. Open Calls (Job Board)
    getOpenCalls(user.email)
      .then(res => setOpenCalls(res.data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // --- HANDLERS ---

  const handleApproveRequest = async (requestId) => {
    if (!window.confirm("Approve this booking?")) return;
    try {
      await approveRequest(user.email, requestId);
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleDenyRequest = async (requestId) => {
    if (!window.confirm("Deny this booking?")) return;
    try {
      await denyRequest(user.email, requestId);
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleHireModel = async (bidId) => {
    if (!window.confirm("Assign this model to the class? This will confirm the booking.")) return;
    try {
      await acceptBid(user.email, bidId);
      alert("Model Hired!");
      fetchData();
    } catch (error) {
      alert("Error: " + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
      
      {/* COLUMN 1: DIRECT BOOKING REQUESTS (Existing) */}
      <div>
        <h2>Booking Requests</h2>
        {requests.length === 0 && <p>No pending requests.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {requests.map(req => (
            <div key={req.id} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '5px', background: req.status === 'approved' ? '#d4edda' : '#fff' }}>
              <div><strong>{new Date(req.availability.starts_at).toLocaleString()}</strong></div>
              <div>Faculty: {req.faculty_name}</div>
              <div>Status: {req.status}</div>
              {req.status === 'pending' && (
                <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleApproveRequest(req.id)} style={{ background: 'green', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>Approve</button>
                  <button onClick={() => handleDenyRequest(req.id)} style={{ background: 'red', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>Deny</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* COLUMN 2: OPEN CALLS / JOB BOARD (New) */}
      <div>
        <h2>Job Board Approvals</h2>
        {openCalls.length === 0 && <p>No open calls found.</p>}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {openCalls.map(call => (
            <div key={call.id} style={{ border: '1px solid #444', padding: '15px', borderRadius: '5px', background: call.status === 'confirmed' ? '#e2e3e5' : '#fff' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{call.class_name}</div>
              <div style={{ color: '#666' }}>{new Date(call.starts_at).toLocaleString()}</div>
              <div style={{ fontSize: '0.9em', marginBottom: '10px' }}>Faculty: {call.faculty?.first_name} {call.faculty?.last_name}</div>
              
              <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '5px' }}>
                <strong>Applicants:</strong>
                {call.bids.length === 0 && <span style={{ marginLeft: '5px', color: '#777' }}>None yet</span>}
                
                <ul style={{ paddingLeft: '20px', margin: '5px 0 0 0' }}>
                  {call.bids.map(bid => (
                    <li key={bid.id} style={{ marginBottom: '5px' }}>
                      {bid.model_name} 
                      {bid.status === 'pending' && call.status === 'open' && (
                        <button 
                          onClick={() => handleHireModel(bid.id)}
                          style={{ marginLeft: '10px', fontSize: '0.8em', cursor: 'pointer', background: '#007bff', color: 'white', border: 'none', borderRadius: '3px', padding: '2px 6px' }}
                        >
                          Assign
                        </button>
                      )}
                      {bid.status === 'accepted' && <span style={{ color: 'green', fontWeight: 'bold', marginLeft: '10px' }}>✓ HIRED</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}