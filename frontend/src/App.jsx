import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layout & Auth
import Layout from './components/Layout';
import LoginSimulator from './components/LoginSimulator';

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

  // Handle Login
  const handleLogin = (user) => {
    setCurrentUser(user);
    // In a real app, you'd save a token to localStorage here
  };

  // Handle Logout
  const handleLogout = () => {
    setCurrentUser(null);
  };

  // 1. If not logged in, show Login Screen
  if (!currentUser) {
    return <LoginSimulator onLogin={handleLogin} />;
  }

  // 2. If logged in, show the App with the correct routes
  return (
    <BrowserRouter>
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

          {/* Fallback for unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;