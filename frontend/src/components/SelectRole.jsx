import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';

const SelectRole = ({ onLogin }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Get the User ID from the navigation state
  const userId = location.state?.userId;

  // Safety check: If someone tries to visit /select-role directly without logging in first
  useEffect(() => {
    if (!userId) {
      navigate('/login');
    }
  }, [userId, navigate]);

  const handleRoleSelect = async (role) => {
    setLoading(true);
    setError('');

    try {
      // 2. Send PATCH request to update the user
      const response = await api.patch(`/users/${userId}`, {
        user: { role: role }
      });

      // 3. Update the global app state with the full user object (including new role)
      onLogin(response.data);

      // 4. Redirect to Dashboard
      navigate('/');

    } catch (err) {
      console.error("Failed to set role:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  if (!userId) return null;

  return (
    <div className="container d-flex justify-content-center align-items-center vh-100">
      <div className="card shadow p-5 text-center" style={{ maxWidth: '500px', width: '100%' }}>
        <h2 className="mb-4">Welcome to MICA Modeling</h2>
        <p className="lead mb-4">To finish setting up your account, please tell us who you are.</p>

        {error && <div className="alert alert-danger">{error}</div>}

        <div className="d-grid gap-3">
          <button 
            className="btn btn-outline-primary btn-lg p-4"
            onClick={() => handleRoleSelect('faculty')}
            disabled={loading}
          >
            <h5 className="mb-1">I am Faculty</h5>
            <small>I want to request models for my classes.</small>
          </button>

          <button 
            className="btn btn-outline-success btn-lg p-4"
            onClick={() => handleRoleSelect('model')}
            disabled={loading}
          >
            <h5 className="mb-1">I am a Model</h5>
            <small>I want to view gigs and manage my schedule.</small>
          </button>
        </div>
        
        {loading && (
          <div className="mt-3">
            <div className="spinner-border text-secondary" role="status"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectRole;