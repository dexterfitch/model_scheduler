import { useState, useEffect } from 'react';
import { getMySchedule, createAvailability, deleteAvailability } from '../services/api';

// HELPER: Generate time slots (09:00 to 22:00 in 15 min increments)
const generateTimeOptions = () => {
  const times = [];
  for (let i = 9; i <= 22; i++) {
    const hour = i < 10 ? `0${i}` : i;
    times.push(`${hour}:00`);
    times.push(`${hour}:15`);
    times.push(`${hour}:30`);
    times.push(`${hour}:45`);
  }
  return times;
};

export default function ModelDashboard({ user }) {
  const [schedule, setSchedule] = useState([]);
  
  // Form State
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [notes, setNotes] = useState('');

  const timeOptions = generateTimeOptions();

  const fetchSchedule = () => {
    getMySchedule(user.email)
      .then(res => setSchedule(res.data))
      .catch(err => console.error(err));
  };

  const handleDelete = async (slotId) => {
    try {
      await deleteAvailability(user.email, slotId);
      fetchSchedule();
    } catch (error) {
      console.error(error);
      alert("Error deleting slot. Please try again.");
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 1. Create a JavaScript Date object
    // When passed a string like "2025-12-01T09:00:00", the browser assumes LOCAL time.
    const startDateObj = new Date(`${date}T${startTime}:00`);
    const endDateObj = new Date(`${date}T${endTime}:00`);

    // 2. Convert it to a UTC String (ISO format with 'Z' at the end)
    // Example: If you picked 9:00 AM EST, this becomes 14:00:00Z so Rails saves it correctly.
    const fullStart = startDateObj.toISOString();
    const fullEnd = endDateObj.toISOString();

    try {
      await createAvailability({
        email: user.email,
        starts_at: fullStart,
        ends_at: fullEnd,
        notes: notes
      });
      
      alert("Slot Created!");
      // Clear notes but keep date/time for rapid entry
      setNotes('');
      fetchSchedule();
    } catch (error) {
      alert("Error: " + (error.response?.data?.error || error.message));
    }
  };

  // CSS Styles
  const inputStyle = {
    padding: '10px',
    borderRadius: '5px',
    border: '1px solid #ccc',
    fontSize: '16px',
    width: '100%',
    fontFamily: 'sans-serif' // Ensures numbers look clean
  };

  const labelStyle = {
    fontWeight: 'bold',
    marginBottom: '5px',
    display: 'block',
    color: '#555'
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
      
      {/* COLUMN 1: CREATE NEW SLOT */}
      <div style={{ border: '1px solid #ddd', padding: '25px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
        <h2 style={{ marginTop: 0, color: '#333' }}>Add Availability</h2>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>Set a block of time where you are free to pose.</p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {/* Date Selection */}
          <div>
            <label style={labelStyle}>Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {/* Time Row */}
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Start Time</label>
              {/* Input type="time" allows typing OR selecting from the datalist */}
              <input 
                type="time" 
                list="time-options"
                min="09:00"
                max="22:00"
                value={startTime} 
                onChange={e => setStartTime(e.target.value)} 
                required
                style={inputStyle}
              />
            </div>

            <div style={{ flex: 1 }}>
              <label style={labelStyle}>End Time</label>
              <input 
                type="time" 
                list="time-options"
                min="09:00"
                max="22:00"
                value={endTime} 
                onChange={e => setEndTime(e.target.value)} 
                required
                style={inputStyle}
              />
            </div>
          </div>

          {/* The Hidden List of Suggestions */}
          <datalist id="time-options">
            {timeOptions.map(t => <option key={t} value={t} />)}
          </datalist>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. I have props, prefer long poses..."
              rows="3"
              style={{ ...inputStyle, fontFamily: 'inherit' }}
            />
          </div>

          <button type="submit" style={{ backgroundColor: '#007bff', color: 'white', padding: '12px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
            Create Availability
          </button>
        </form>
      </div>

      {/* COLUMN 2: VIEW HISTORY */}
      <div>
        <h2 style={{ marginTop: 0, color: '#333' }}>My Schedule</h2>
        {schedule.length === 0 && <p style={{ color: '#777' }}>No slots created yet.</p>}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {schedule.map(slot => {
            let statusColor = '#6c757d'; // grey (pending)
            let bgColor = '#f8f9fa';
            if (slot.status === 'confirmed') { statusColor = '#28a745'; bgColor = '#d4edda'; }
            
            return (
              <div key={slot.id} style={{
                borderLeft: `5px solid ${statusColor}`,
                padding: '15px',
                borderRadius: '5px',
                backgroundColor: bgColor,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1em' }}>
                    {new Date(slot.starts_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      backgroundColor: statusColor,
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '12px',
                      textTransform: 'uppercase'
                    }}>
                      {slot.status}
                    </span>
                    {slot.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleDelete(slot.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#555',
                          cursor: 'pointer',
                          fontSize: '14px',
                          padding: '2px 6px',
                          borderRadius: '50%',
                          lineHeight: 1
                        }}
                        aria-label="Delete availability"
                        title="Delete availability"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                
                <div style={{ color: '#555' }}>
                  {new Date(slot.starts_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(slot.ends_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
                
                {slot.notes && <div style={{ marginTop: '8px', fontSize: '14px', fontStyle: 'italic', color: '#666' }}>"{slot.notes}"</div>}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}