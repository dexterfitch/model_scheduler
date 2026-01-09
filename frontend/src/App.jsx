import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';

// API Service
import api from './services/api';

// Layout & Auth
import Layout from './components/Layout';
import LoginPage from "./components/LoginPage";
import SelectRole from "./components/SelectRole"; // <--- NEW IMPORT

// Admin Views
import AdminDashboard from './components/AdminDashboard';
import AdminCalendar from './components/AdminCalendar';
import AllGigs from './components/AllGigs';
import AllRequests from './components/AllRequests';
import UserDirectory from './components/UserDirectory';
import ModelDetail from './components/ModelDetail';
import GigCreator from './components/GigCreator';

// New Role Views
import FacultyDashboard from './components/FacultyDashboard';
import ModelDashboard from './components/ModelDashboard';

function App() {
  // Store the logged-in user in state (null = not logged in)
  const [currentUser, setCurrentUser] = useState(null);

  // Handle Logout
  const handleLogout = () => {
    setCurrentUser(null);
  };

  // --- HELPER: HANDLE SUCCESSFUL GOOGLE LOGIN ---
  const LoginSuccess = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
      // 1. Fetch the full user object using the ID from the URL
      api.get(`/users/${id}`)
        .then(res => {
          const user = res.data;

          // 2. CHECK IF ROLE EXISTS
          if (!user.role) {
            // If no role, force them to selection page
            // We pass the userId in 'state' so SelectRole knows who to update
            navigate("/select-role", { state: { userId: user.id } });
          } else {
            // If role exists, log them in fully
            setCurrentUser(user);
            navigate("/");
          }
        })
        .catch(err => {
          console.error("Login Failed:", err);
          navigate("/login?error=AuthFailed"); 
        });
    }, [id, navigate]);

    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status"></div>
          <h4>Logging you in...</h4>
        </div>
      </div>
    );
  };

  return (
    <BrowserRouter>
      {!currentUser ? (
        // --- SCENARIO 1: NOT LOGGED IN (or Onboarding) ---
        <Routes>
          {/* The Login Page */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Rails redirects here after Google Auth */}
          <Route path="/login_success/:id" element={<LoginSuccess />} />

          {/* New: Role Selection Page */}
          {/* We pass setCurrentUser so it can log us in after selection */}
          <Route path="/select-role" element={<SelectRole onLogin={setCurrentUser} />} />
          
          {/* Default to Login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        // --- SCENARIO 2: LOGGED IN ---
        <Routes>
          <Route path="/" element={<Layout currentUser={currentUser} onLogout={handleLogout} />}>
            
            {/* --- ADMIN ROUTES --- */}
            {currentUser.role === 'admin' && (
              <>
                <Route index element={<AdminDashboard />} />
                <Route path="calendar" element={<AdminCalendar />} />
                <Route path="gigs" element={<AllGigs />} />
                <Route path="requests" element={<AllRequests />} />
                <Route path="directory" element={<UserDirectory />} />
                <Route path="models/:id" element={<ModelDetail />} />
                <Route path="gigs/new/:requestId" element={<GigCreator />} />
              </>
            )}

            {/* --- FACULTY ROUTES --- */}
            {currentUser.role === 'faculty' && (
              <>
                <Route index element={<FacultyDashboard user={currentUser} />} />
              </>
            )}

            {/* --- MODEL ROUTES --- */}
            {currentUser.role === 'model' && (
              <>
                <Route index element={<ModelDashboard user={currentUser} />} />
              </>
            )}

            {/* Fallback for unknown routes inside the app */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Route>
        </Routes>
      )}
    </BrowserRouter>
  );
}

export default App;