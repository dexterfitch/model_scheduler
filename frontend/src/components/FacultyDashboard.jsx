import { useState, useEffect } from 'react';
import { getOpenSlots, createBookingRequest } from '../services/api';

export default function FacultyDashboard({ user }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSlots = () => {
    setLoading(true);
    getOpenSlots(user.email)
      .then(res => {
        setSlots(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSlots();
  }, [user]);

  const handleBook = (availabilityId) => {
    const notes = window.prompt("Enter notes for this class (e.g., 'Life Drawing 101'):");
    
    if (notes !== null) {
      createBookingRequest(user.email, availabilityId, notes)
        .then(() => {
          alert("Request sent successfully!");
          fetchSlots(); // Refresh the list
        })
        .catch(err => {
          alert("Error: " + (err.response?.data?.error || err.message));
        });
    }
  };

  return (
    <div>
      <h2>Available Slots</h2>
      {loading && <p>Loading...</p>}
      {!loading && slots.length === 0 && <p>No open slots found.</p>}

      <div style={{ display: 'grid', gap: '15px' }}>
        {slots.map(item => (
          <div key={item.id} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', background: '#f9f9f9' }}>
            
            <p><strong>Date:</strong> {new Date(item.starts_at).toLocaleString()}</p>
            <p><strong>Status:</strong> {item.status}</p>
            
            {item.model_name && <p><strong>Model:</strong> {item.model_name}</p>}
            {item.notes && <p><em>Note from Model: "{item.notes}"</em></p>}
            
            <button 
              onClick={() => handleBook(item.id)}
              style={{ marginTop: '10px', backgroundColor: 'green', color: 'white', padding: '8px 16px', cursor: 'pointer', border: 'none', borderRadius: '4px' }}
            >
              Request Booking
            </button>

          </div>
        ))}
      </div>
    </div>
  );
}