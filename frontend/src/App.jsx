/**
 * The app's shell: signs people in, sends new users to choose a role, and shows each
 * role its own pages (admin, faculty or model). Signs people out when their token
 * stops working, with a message on the sign-in page, and sends any sign-out that
 * couldn't reach the server before.
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Spinner } from "react-bootstrap";
import api from './services/api';
import { signOutOnServer, retryPendingSignOut, forgetPendingSignOut } from './services/signOut';

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
import History from './components/History';

/**
 * Where Google sign-in lands. Saves the token (sent after a #, so it never reaches server logs),
 * then opens the app, or the role choice for someone new.
 */
function LoginSuccess({ onLogin }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token') || searchParams.get('token');
    if (token) {
      localStorage.setItem('token', token);
      forgetPendingSignOut();
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

/** The signed-in user and the routes they can reach. */
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [needsRoleSelection, setNeedsRoleSelection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    /** Signs the person out when the server rejects their token, and says why. */
    const signedOut = () => {
      localStorage.removeItem('token');
      setNeedsRoleSelection(false);
      setCurrentUser(null);
      setNotice('Your sign-in has expired. Please sign in again.');
    };
    window.addEventListener('pose-pool:signed-out', signedOut);
    return () => window.removeEventListener('pose-pool:signed-out', signedOut);
  }, []);

  useEffect(() => {
    retryPendingSignOut();
    window.addEventListener('online', retryPendingSignOut);
    return () => window.removeEventListener('online', retryPendingSignOut);
  }, []);

  /**
   * Signs out on the server (ending every token) and in the browser. If the server
   * can't be reached, the sign-out is sent again later.
   */
  const handleLogout = async () => {
    await signOutOnServer(localStorage.getItem('token'));
    localStorage.removeItem('token');
    setCurrentUser(null);
    setNeedsRoleSelection(false);
  };

  /** Replaces the signed-in user after their profile or role changes. */
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
                <Route path="history" element={<History />} />
                
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
