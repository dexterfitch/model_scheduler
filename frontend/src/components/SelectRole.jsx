import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';

const SKIN_TONE_OPTIONS = [
  { label: 'Light', color: '#F3CFB3' },
  { label: 'Medium', color: '#C58C65' },
  { label: 'Dark', color: '#593C2B' }
];

const SelectRole = ({ onLogin }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [step, setStep] = useState('selection'); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    stage_name: '',
    pronouns: '',
    gender_identity: '',
    skin_tone: '',
    willing_to_model_nude: false,
  });

  const userId = location.state?.userId;

  useEffect(() => {
    if (!userId) navigate('/login');
  }, [userId, navigate]);


  const handleFacultySelect = async () => {
    submitRoleUpdate({ role: 'faculty' });
  };

  const handleModelSelect = () => {
    setStep('model-form');
  };

  const handleModelFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSkinToneSelect = (value) => {
    setFormData(prev => ({ ...prev, skin_tone: value }));
  };

  const handleModelSubmit = (e) => {
    e.preventDefault();
    if (!formData.gender_identity || !formData.skin_tone) {
      setError("Please fill in all required fields.");
      return;
    }
    submitRoleUpdate({ role: 'model', ...formData });
  };

  const submitRoleUpdate = async (payload) => {
    setLoading(true);
    setError('');

    try {
      const response = await api.patch(`/users/${userId}`, { user: payload });
      onLogin(response.data);
      navigate('/');
    } catch (err) {
      console.error("Failed to set role:", err);
      const msg = err.response?.data?.errors?.join(', ') || "Something went wrong.";
      setError(msg);
      setLoading(false);
    }
  };

  if (!userId) return null;

  return (
    <div className="container d-flex justify-content-center align-items-center min-vh-100 py-5">
      <div className="card shadow p-4 p-md-5" style={{ maxWidth: '600px', width: '100%' }}>
        
        {step === 'selection' && (
          <div className="text-center">
            <h2 className="mb-4">Welcome to MICA Pose Pool</h2>
            <p className="lead mb-4">To finish setting up your account, please tell us who you are.</p>
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="d-grid gap-3">
              <button className="btn btn-outline-primary btn-lg p-4" onClick={handleFacultySelect} disabled={loading}>
                <h5 className="mb-1">I am Faculty</h5>
                <small>I want to request models for my classes.</small>
              </button>
              <button className="btn btn-outline-success btn-lg p-4" onClick={handleModelSelect} disabled={loading}>
                <h5 className="mb-1">I am a Model</h5>
                <small>I want to view gigs and manage my schedule.</small>
              </button>
            </div>
          </div>
        )}

        {step === 'model-form' && (
          <div>
            <h3 className="mb-3 text-success">Model Profile Setup</h3>
            <p className="text-muted small mb-4">We need a few details to match you with the right art classes.</p>

            {error && <div className="alert alert-danger">{error}</div>}

            <form onSubmit={handleModelSubmit}>
              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label">Stage Name (Optional)</label>
                  <input type="text" className="form-control" name="stage_name" value={formData.stage_name} onChange={handleModelFormChange} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Pronouns</label>
                  <input type="text" className="form-control" name="pronouns" value={formData.pronouns} onChange={handleModelFormChange} placeholder="e.g. they/them" />
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label">Gender Identity *</label>
                  <select className="form-select" name="gender_identity" value={formData.gender_identity} onChange={handleModelFormChange} required>
                    <option value="">Select...</option>
                    <option value="Woman">Woman</option>
                    <option value="Man">Man</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Transgender">Transgender</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Skin Tone *</label>
                  <div className="d-flex gap-2">
                    {SKIN_TONE_OPTIONS.map((tone) => (
                      <div
                        key={tone.label}
                        onClick={() => handleSkinToneSelect(tone.label)}
                        className="rounded-circle cursor-pointer"
                        title={tone.label}
                        style={{
                          width: '40px',
                          height: '40px',
                          backgroundColor: tone.color,
                          cursor: 'pointer',
                          border: formData.skin_tone === tone.label ? '4px solid #0d6efd' : '1px solid #dee2e6',
                          transform: formData.skin_tone === tone.label ? 'scale(1.1)' : 'scale(1)',
                          transition: 'all 0.2s ease'
                        }}
                      ></div>
                    ))}
                  </div>
                  <div className="form-text small mt-1">
                    Selected: <strong>{formData.skin_tone || 'None'}</strong>
                  </div>
                </div>
              </div>

              <div className="mb-4 form-check bg-light p-3 rounded border">
                <input type="checkbox" className="form-check-input" id="nudeCheck" name="willing_to_model_nude" checked={formData.willing_to_model_nude} onChange={handleModelFormChange} />
                <label className="form-check-label" htmlFor="nudeCheck">
                  <strong>I am willing to model nude</strong>
                </label>
              </div>

              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary flex-grow-1" onClick={() => setStep('selection')} disabled={loading}>Back</button>
                <button type="submit" className="btn btn-success flex-grow-1" disabled={loading}>{loading ? 'Creating Profile...' : 'Complete Setup'}</button>
              </div>
            </form>
          </div>
        )}

        {loading && (
          <div className="text-center mt-3">
            <div className="spinner-border text-secondary" role="status"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectRole;