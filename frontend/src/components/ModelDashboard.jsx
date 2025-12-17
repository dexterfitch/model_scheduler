import { useState, useEffect } from 'react';
import { getMySchedule, createAvailability, deleteAvailability, getOpenCalls, createBid } from '../services/api';

// HELPER: Generate time slots
const generateTimeOptions = () => {
  const times = [];
  for (let i = 9; i <= 22; i++) {
    const hour = i < 10 ? `0${i}` : i;
    times.push(`${hour}:00`, `${hour}:15`, `${hour}:30`, `${hour}:45`);
  }
  return times;
};

export default function ModelDashboard({ user }) {
  // --- STATE ---
  const [schedule, setSchedule] = useState([]);
  const [jobs, setJobs] = useState([]); 
  
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');

  const timeOptions = generateTimeOptions();

  // --- DATA FETCHING ---
  const refreshData = () => {
    getMySchedule(user.email).then(res => setSchedule(res.data)).catch(console.error);
    getOpenCalls(user.email).then(res => setJobs(res.data)).catch(console.error);
  };

  useEffect(() => {
    refreshData();
  }, [user]);

  // --- HANDLERS ---
  const handleDelete = async (slotId) => {
    try {
      await deleteAvailability(user.email, slotId);
      refreshData();
    } catch (error) {
      alert("Error deleting slot.");
    }
  };

  const handleCreateAvailability = async (e) => {
    e.preventDefault();
    const start = new Date(`${date}T${startTime}:00`).toISOString();
    const end = new Date(`${date}T${endTime}:00`).toISOString();

    try {
      await createAvailability({ 
        email: user.email, 
        starts_at: start, 
        ends_at: end 
        // No notes anymore
      });
      alert("Slot Created!");
      refreshData();
    } catch (error) {
      alert("Error: " + error.response?.data?.error);
    }
  };

  const handleApply = async (jobId) => {
    const message = window.prompt("Add a note to your application (optional):");
    if (message !== null) {
      try {
        await createBid(user.email, jobId, message);
        alert("Application sent!");
        refreshData(); 
      } catch (error) {
        alert("Error: " + error.response?.data?.error);
      }
    }
  };

  const inputStyle = { padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%' };
  
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
      
      {/* COLUMN 1: Profile & Availability */}
      <div>
        {/* PROFILE STUB */}
        <div style={{ marginBottom: '30px', padding: '15px', background: '#e9ecef', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0 }}>My Profile</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
             <div><strong>Nude Modeling:</strong> {user.nude_model ? "Yes" : "No"}</div>
             <div style={{ fontStyle: 'italic', fontSize: '0.9em', color: '#666' }}>
               (Photo upload and profile editing coming soon...)
             </div>
          </div>
        </div>

        {/* AVAILABILITY FORM */}
        <div style={{ border: '1px solid #ddd', padding: '25px', borderRadius: '10px', marginBottom: '30px' }}>
          <h2 style={{ marginTop: 0 }}>Add Availability</h2>
          <form onSubmit={handleCreateAvailability} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={inputStyle} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="time" list="time-opts" value={startTime} onChange={e => setStartTime(e.target.value)} required style={inputStyle} />
              <input type="time" list="time-opts" value={endTime} onChange={e => setEndTime(e.target.value)} required style={inputStyle} />
            </div>
            <datalist id="time-opts">{timeOptions.map(t => <option key={t} value={t} />)}</datalist>
            <button type="submit" style={{ background: '#007bff', color: 'white', padding: '12px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Create Availability</button>
          </form>
        </div>

        {/* SCHEDULE */}
        <h3>My Schedule</h3>
        {schedule.map(slot => (
          <div key={slot.id} style={{ padding: '10px', borderLeft: `5px solid ${slot.status === 'confirmed' ? 'green' : '#ccc'}`, background: '#f8f9fa', marginBottom: '10px' }}>
            <strong>{new Date(slot.starts_at).toLocaleDateString()}</strong>
            <br/>{slot.status}
            {slot.status === 'available' && <button onClick={() => handleDelete(slot.id)} style={{ marginLeft: '10px', color: 'red', border: 'none', cursor: 'pointer' }}>Delete</button>}
          </div>
        ))}
      </div>

      {/* COLUMN 2: JOB BOARD */}
      <div style={{ background: '#f0f4f8', padding: '20px', borderRadius: '10px' }}>
        <h2 style={{ marginTop: 0 }}>Open Calls</h2>
        <p>Classes seeking models</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {jobs.length === 0 && <p>No open jobs right now.</p>}
          
          {jobs.map(job => {
            const hasApplied = !!job.my_bid;
            
            return (
              <div key={job.id} style={{ background: 'white', padding: '15px', borderRadius: '5px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: '0' }}>{job.class_name}</h3>
                  {job.is_nude && <span style={{ background: 'red', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7em', fontWeight: 'bold' }}>NUDE</span>}
                </div>
                
                <div style={{ color: '#555', fontSize: '0.9em', marginTop: '5px' }}>
                  {new Date(job.starts_at).toLocaleString()}
                </div>
                <div style={{ fontStyle: 'italic', margin: '10px 0' }}>
                  Preferences: "{job.notes}"
                </div>

                <div style={{ marginTop: '10px' }}>
                  {hasApplied ? (
                    <span style={{ color: 'blue', fontWeight: 'bold' }}>✓ Applied ({job.my_bid.status})</span>
                  ) : (
                    <button 
                      onClick={() => handleApply(job.id)}
                      style={{ background: '#28a745', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      I'm Available
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}