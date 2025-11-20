import { useState } from 'react';

// Import our three distinct dashboards
import ModelDashboard from './components/ModelDashboard';
import AdminDashboard from './components/AdminDashboard';
import FacultyDashboard from './components/FacultyDashboard';

function App() {
  const [user, setUser] = useState(null);

  // --- SCREEN 1: LOGIN ---
  if (!user) {
    return (
      <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h1>M.C. Scheduler</h1>
        <p>Select a role to simulate login:</p>
        
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
          
          <button 
            onClick={() => setUser({ name: 'Alice', email: 'alice@example.com', role: 'model' })}
            style={buttonStyle}
          >
            Login as Alice (Model)
          </button>

          <button 
            onClick={() => setUser({ name: 'Frank', email: 'frank@example.com', role: 'faculty' })}
            style={buttonStyle}
          >
            Login as Frank (Faculty)
          </button>
          
          <button 
            onClick={() => setUser({ name: 'Anita', email: 'anita@example.com', role: 'admin' })}
            style={buttonStyle}
          >
            Login as Anita (Admin)
          </button>
          
        </div>
      </div>
    )
  }

  // --- SCREEN 2: THE DASHBOARD ---
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* GLOBAL HEADER */}
      <header style={{ 
        borderBottom: '1px solid #ccc', 
        marginBottom: '30px', 
        paddingBottom: '15px',
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{ margin: 0 }}>Art Scheduler</h3>
          <span style={{ color: '#666', fontSize: '0.9em' }}>
            Logged in as: <strong>{user.name}</strong> ({user.role})
          </span>
        </div>
        <button onClick={() => setUser(null)} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Logout
        </button>
      </header>

      {/* ROLE-BASED ROUTING */}
      <main>
        {user.role === 'model' && <ModelDashboard user={user} />}
        {user.role === 'admin' && <AdminDashboard user={user} />}
        {user.role === 'faculty' && <FacultyDashboard user={user} />}
      </main>

    </div>
  )
}

// Simple inline style for the login buttons
const buttonStyle = {
  padding: '15px 25px',
  fontSize: '16px',
  cursor: 'pointer',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
};

export default App;