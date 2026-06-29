import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const SKIN_TONE_OPTIONS = [
  { label: 'Light', color: '#F3CFB3' },
  { label: 'Medium', color: '#C58C65' },
  { label: 'Dark', color: '#593C2B' }
];

const Profile = ({ currentUser, setCurrentUser }) => {

  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    stage_name: '',
    pronouns: '',
    gender_identity: '',
    skin_tone: '',
    willing_to_model_nude: false,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (currentUser) {
      setFormData({
        first_name: currentUser.first_name || '',
        last_name: currentUser.last_name || '',
        phone: currentUser.phone || '',
        stage_name: currentUser.stage_name || '',
        pronouns: currentUser.pronouns || '',
        gender_identity: currentUser.gender_identity || '',
        skin_tone: currentUser.skin_tone || '',
        willing_to_model_nude: currentUser.willing_to_model_nude || false,
      });
    }
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSkinToneSelect = (value) => {
    setFormData(prev => ({ ...prev, skin_tone: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await api.patch(`/users/${currentUser.id}`, { user: formData });
      setCurrentUser(res.data);
      setMessage({ type: 'success', text: 'Profile updated successfully! Redirecting...' });
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'danger', text: 'Failed to update profile.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-4">
      <div className="card shadow mx-auto" style={{ maxWidth: '800px' }}>
        <div className="card-header bg-dark text-white">
          <h3 className="mb-0">My Profile ({currentUser.role})</h3>
        </div>
        <div className="card-body">
          
          {message.text && (
            <div className={`alert alert-${message.type}`}>{message.text}</div>
          )}

          <form onSubmit={handleSubmit}>
            <h5 className="mb-3 text-primary">Basic Information</h5>
            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label">First Name</label>
                <input type="text" className="form-control" name="first_name" value={formData.first_name} onChange={handleChange} required />
              </div>
              <div className="col-md-6">
                <label className="form-label">Last Name</label>
                <input type="text" className="form-control" name="last_name" value={formData.last_name} onChange={handleChange} required />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Phone Number</label>
              <input type="text" className="form-control" name="phone" value={formData.phone} onChange={handleChange} placeholder="e.g. 555-123-4567" />
            </div>

            {currentUser.role === 'model' && (
              <>
                <hr className="my-4" />
                <h5 className="mb-3 text-success">Model Details</h5>
                
                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Stage Name (Optional)</label>
                    <input type="text" className="form-control" name="stage_name" value={formData.stage_name} onChange={handleChange} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Pronouns</label>
                    <input type="text" className="form-control" name="pronouns" value={formData.pronouns} onChange={handleChange} placeholder="e.g. they/them" />
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Gender Presentation *</label>
                    <select className="form-select" name="gender_identity" value={formData.gender_identity} onChange={handleChange} required>
                      <option value="">Select...</option>
                      <option value="Woman">Woman</option>
                      <option value="Man">Man</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Agender">Agender</option>
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
                          className="rounded-circle"
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
                  </div>
                </div>

                <div className="mb-3 form-check">
                  <input type="checkbox" className="form-check-input" id="nudeCheck" name="willing_to_model_nude" checked={formData.willing_to_model_nude} onChange={handleChange} />
                  <label className="form-check-label" htmlFor="nudeCheck">
                    I am willing to model nude
                  </label>
                </div>
              </>
            )}

            <div className="d-grid mt-4">
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;