import { useState, useEffect } from 'react';
import { getBookingRequests, approveRequest, denyRequest } from '../services/api';

export default function AdminDashboard({ user }) {
  const [requests, setRequests] = useState([]);

  const fetchRequests = () => {
    getBookingRequests(user.email)
      .then(res => setRequests(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  const handleApprove = async (requestId) => {
    if (!window.confirm("Are you sure you want to APPROVE this booking?")) return;
    
    try {
      await approveRequest(user.email, requestId);
      alert("Booking Approved!");
      fetchRequests(); // Refresh list
    } catch (error) {
      alert("Error: " + (error.response?.data?.error || error.message));
    }
  };

  const handleDeny = async (requestId) => {
    if (!window.confirm("Are you sure you want to DENY this booking?")) return;

    try {
      await denyRequest(user.email, requestId);
      alert("Booking Denied.");
      fetchRequests();
    } catch (error) {
      alert("Error: " + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div>
      <h2>Incoming Booking Requests</h2>
      {requests.length === 0 && <p>No requests found.</p>}

      <div style={{ display: 'grid', gap: '15px' }}>
        {requests.map(req => {
          // Color code based on status
          let borderColor = '#ccc';
          if (req.status === 'approved') borderColor = 'green';
          if (req.status === 'denied') borderColor = 'red';

          return (
            <div key={req.id} style={{ 
              border: `1px solid ${borderColor}`, 
              borderLeft: `5px solid ${borderColor}`,
              padding: '15px', 
              borderRadius: '5px',
              backgroundColor: '#fff'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.9em', color: '#666' }}>
                    Request #{req.id} • {new Date(req.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: '1.1em', fontWeight: 'bold', marginTop: '5px' }}>
                    {new Date(req.availability.starts_at).toLocaleString()}
                  </div>
                  
                  <div style={{ marginTop: '10px' }}>
                    <div><strong>Requester:</strong> {req.faculty_name} ({req.faculty_email})</div>
                    <div style={{ fontStyle: 'italic', color: '#555' }}>"{req.notes}"</div>
                  </div>
                  
                  <div style={{ marginTop: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: borderColor }}>
                    Status: {req.status}
                  </div>
                </div>

                {/* ACTION BUTTONS - Only show if Pending */}
                {req.status === 'pending' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button 
                      onClick={() => handleApprove(req.id)}
                      style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleDeny(req.id)}
                      style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Deny
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}