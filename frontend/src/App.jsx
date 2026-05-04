import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { Spinner } from "react-bootstrap";
import api from './services/api';

import Layout from './components/Layout';
import LoginPage from "./components/LoginPage";
import SelectRole from "./components/SelectRole";
import Profile from './components/Profile';
import AdminDashboard from './components/AdminDashboard';
import AdminCalendar from './components/AdminCalendar';
import AllGigs from './components/AllGigs';
import AllRequests from './components/AllRequests';
import UserDirectory from './components/UserDirectory';
import ModelDetail from './components/ModelDetail';
import GigCreator from './components/GigCreator';
import SuperUserPanel from './components/SuperUserPanel';
import FacultyDashboard from './components/FacultyDashboard';
import ModelDashboard from './components/ModelDashboard';
import Reports from './components/Reports';

function LoginSuccess({ onLogin }) {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/users/${id}`).then(res => {
      const user = res.data;
      if (!user.role) {
        navigate("/select-role", { state: { userId: user.id } });
      } else {
        onLogin(user);
        navigate("/");
      }
    }).catch(() => {
      navigate("/login?error=AuthFailed");
    });
  }, [id, navigate, onLogin]);

  return <div>Logging in...</div>;
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);

  const handleLogout = async () => {
    try {
      await api.delete("/logout");
    } catch (err) {
      console.error("Logout error", err);
    } finally {
      setCurrentUser(null);
    }
  };

  const refreshUser = (userData) => {
    if (userData) setCurrentUser(userData);
  };

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/me')
      .then(res => {
        setCurrentUser(res.data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <Spinner animation="border" variant="secondary" />
    </div>
  );

  return (
    <BrowserRouter>
      {!currentUser ? (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login_success/:id" element={<LoginSuccess onLogin={setCurrentUser} />} />
          <Route path="/select-role" element={<SelectRole onLogin={setCurrentUser} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/" element={
            <Layout 
              currentUser={currentUser} 
              onLogout={handleLogout}
              refreshUser={refreshUser}
            />
          }>
            
            {currentUser.role === 'admin' && (
              <>
                <Route index element={<AdminDashboard />} />
                <Route path="calendar" element={<AdminCalendar />} />
                <Route path="gigs" element={<AllGigs />} />
                <Route path="requests" element={<AllRequests />} />
                <Route path="directory" element={<UserDirectory />} />
                <Route path="models/:id" element={<ModelDetail />} />
                <Route path="gigs/new/:requestId" element={<GigCreator />} />
                <Route path="reports" element={<Reports />} />
                
                {currentUser.superuser && (
                  <Route path="superuser" element={
                    <SuperUserPanel 
                      currentUser={currentUser} 
                      refreshUser={refreshUser}
                    />
                  } />
                )}
              </>
            )}

            {currentUser.role === 'faculty' && (
              <>
                <Route index element={<FacultyDashboard user={currentUser} />} />
              </>
            )}

            {currentUser.role === 'model' && (
              <>
                <Route index element={<ModelDashboard user={currentUser} />} />
                <Route path="profile" element={<Profile currentUser={currentUser} setCurrentUser={setCurrentUser} />} />
              </>
            )}
            
            <Route path="*" element={<Navigate to="/" replace />} />

          </Route>
        </Routes>
      )}
    </BrowserRouter>
  );
}

export default App;