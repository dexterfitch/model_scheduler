import { useState, useEffect } from 'react';
import { getBookingRequests, getOpenCalls, createOpenCall, acceptBid } from '../services/api';

export default function FacultyDashboard({ user }) {
  // Job Board State
  const [myJobs, setMyJobs] = useState([]);
  const [history, setHistory] = useState([]); // History of bookings
  
  const [jobForm, setJobForm] = useState({
    class_name: '',
    date: '',
    start_time: '09:00',
    end_time: '12:00',
    notes: '',
    is_nude: false // New Nude Flag
  });

  // --- LOAD DATA ---
  const refreshData = () => {
    // 1. Load My Job Postings
    getOpenCalls(user.email)
      .then(res => setMyJobs(res.data))
      .catch(console.error);
      
    // 2. Load History (Confirmed/Pending Bookings)
    getBookingRequests(user.email)
      .then(res => setHistory(res.data))
      .catch(console.error);
  };

  useEffect(() => {
    refreshData();
  }, [user]);

  // --- ACTION: Post a Job (Open Call) ---
  const handlePostJob = async (e) => {
    e.preventDefault();
    const start = new Date(`${jobForm.date}T${jobForm.start_time}:00`).toISOString();
    const end = new Date(`${jobForm.date}T${jobForm.end_time}:00`).toISOString();

    try {
      await createOpenCall({
        email: user.email,
        class_name: jobForm.class_name,
        starts_at: start,
        ends_at: end,
        notes: jobForm.notes,
        is_nude: jobForm.is_nude
      });
      alert("Job Posted!");
      // Reset form but keep date/times
      setJobForm({ ...jobForm, class_name: '', notes: '' }); 
      refreshData();
    } catch (error) {
      alert("Error: " + error.response?.data?.error);
    }
  };

  // --- ACTION: Accept a Bid ---
  // Note: Even though Faculty 'accepts', Admin must finalize approval in real life,
  // but this action signals the "Wishlist" match.
  const handleAcceptBid = async (bidId) => {
    if (!window.confirm("Accept this model? This will reject other applicants.")) return;
    try {
      await acceptBid(user.email, bidId);
      refreshData();
    } catch (error) {
      alert("Error accepting bid.");
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
      
      {/* LEFT COL: Manage My Job Postings */}
      <div>
        <h2>Post Open Call</h2>
        
        {/* Create Job Form */}
        <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px' }}>
          <h3 style={{ marginTop: 0 }}>New Class Request</h3>
          <form onSubmit={handlePostJob} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input 
              placeholder="Class Name (e.g. Life Drawing II)" 
              required 
              value={jobForm.class_name}
              onChange={e => setJobForm({...jobForm, class_name: e.target.value})}
              style={{ padding: '8px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="date" required value={jobForm.date} onChange={e => setJobForm({...jobForm, date: e.target.value})} style={{ padding: '8px' }} />
              <input type="time" required value={jobForm.start_time} onChange={e => setJobForm({...jobForm, start_time: e.target.value})} style={{ padding: '8px' }} />
              <input type="time" required value={jobForm.end_time} onChange={e => setJobForm({...jobForm, end_time: e.target.value})} style={{ padding: '8px' }} />
            </div>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={jobForm.is_nude}
                onChange={e => setJobForm({...jobForm, is_nude: e.target.checked})}
              />
              <strong>Requires Nude Modeling?</strong>
            </label>

            <textarea 
              placeholder="Preferences (e.g. Costume, specific pose types)" 
              value={jobForm.notes}
              onChange={e => setJobForm({...jobForm, notes: e.target.value})}
              style={{ padding: '8px' }}
            />
            <button type="submit" style={{ background: '#007bff', color: 'white', padding: '10px', border: 'none', cursor: 'pointer' }}>Post Job</button>
          </form>
        </div>

        {/* List My Jobs */}
        <h3>My Active Postings</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {myJobs.map(job => (
            <div key={job.id} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '5px', background: job.status === 'confirmed' ? '#e6fffa' : '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{job.class_name}</strong>
                <span style={{ textTransform: 'uppercase', fontSize: '0.8em', fontWeight: 'bold', color: job.status === 'open' ? 'green' : '#555' }}>
                  {job.status}
                </span>
              </div>
              <div style={{ fontSize: '0.9em', color: '#666' }}>
                {new Date(job.starts_at).toLocaleString()}
                {job.is_nude && <span style={{ marginLeft: '10px', color: 'red', fontWeight: 'bold', fontSize: '0.8em' }}>[NUDE]</span>}
              </div>

              {/* BIDS SECTION */}
              <div style={{ marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                <small>Applicants ({job.bids.length})</small>
                {job.bids.map(bid => (
                  <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px', background: '#f9f9f9', padding: '5px' }}>
                    <span>
                      {bid.model?.first_name || 'Model'} 
                      {bid.status === 'accepted' && <span style={{ color: 'green', fontWeight: 'bold' }}> (SELECTED)</span>}
                    </span>
                    {/* Only allow hiring if job is still open */}
                    {job.status === 'open' && (
                      <button onClick={() => handleAcceptBid(bid.id)} style={{ fontSize: '0.8em', cursor: 'pointer' }}>
                        Hire
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT COL: Booking History (Replaces Marketplace) */}
      <div>
        <h2>Booking History</h2>
        <p style={{ fontSize: '0.9em', color: '#666' }}>Past and upcoming confirmed classes.</p>
        
        <div style={{ display: 'grid', gap: '15px' }}>
          {history.length === 0 && <p>No booking history.</p>}
          
          {history.map(req => (
            <div key={req.id} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', background: '#f9f9f9' }}>
              <p><strong>{new Date(req.availability.starts_at).toLocaleString()}</strong></p>
              <p>Status: <span style={{ fontWeight: 'bold' }}>{req.status}</span></p>
              {/* Anonymized Model Label */}
              <p>Model: {req.model_label}</p> 
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}