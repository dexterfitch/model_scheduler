import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // The token arrives after a # so it never reaches a server log; ?token= is the older form
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token') || searchParams.get('token');
    if (token) {
      localStorage.setItem('token', token);
    }

    api.get(`/users/${id}`).then(res => {
      const user = res.data;
      if (!user.role) {
        navigate("/select-role", { state: { userId: user.id }, replace: true });
      } else {
        onLogin(user);
        navigate("/", { replace: true });
      }
    }).catch(() => {
      navigate(`/login?error=${encodeURIComponent("Sign-in didn't work. Please try again.")}`, { replace: true });
    });
  }, [id, navigate, onLogin, searchParams]);

  return <div>Logging in...</div>;
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [needsRoleSelection, setNeedsRoleSelection] = useState(false);
  const [loading, setLoading] = useState(true);
  // A message for the sign-in page, such as an expired sign-in
  const [notice, setNotice] = useState('');

  // The API client announces when a signed-in person's token stops working
  useEffect(() => {
    const signedOut = () => {
      localStorage.removeItem('token');
      setNeedsRoleSelection(false);
      setCurrentUser(null);
      setNotice('Your sign-in has expired. Please sign in again.');
    };
    window.addEventListener('pose-pool:signed-out', signedOut);
    return () => window.removeEventListener('pose-pool:signed-out', signedOut);
  }, []);

  const handleLogout = async () => {
    try {
      await api.delete("/logout");
    } catch (err) {
      console.error("Logout error", err);
    } finally {
      localStorage.removeItem('token');
      setCurrentUser(null);
      setNeedsRoleSelection(false);
    }
  };

  const refreshUser = (userData) => {
    if (userData) setCurrentUser(userData);
  };

  useEffect(() => {
    api.get('/me')
      .then(res => {
        if (!res.data.role) {
          setNeedsRoleSelection(true);
          setCurrentUser(res.data);
        } else {
          setCurrentUser(res.data);
        }
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
          <Route path="/login" element={<LoginPage notice={notice} />} />
          <Route path="/login_success/:id" element={<LoginSuccess onLogin={setCurrentUser} />} />
          <Route path="/select-role" element={<SelectRole onLogin={setCurrentUser} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : needsRoleSelection ? (
        <Routes>
          <Route path="/select-role" element={
            <SelectRole 
              userId={currentUser.id}
              onLogin={(user) => { setNeedsRoleSelection(false); setCurrentUser(user); }} 
            />
          } />
          <Route path="*" element={<Navigate to="/select-role" replace />} />
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
