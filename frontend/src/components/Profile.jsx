/**
 * My Profile, for models: their details and the personal questions used for matching.
 * After saving, the result (saved, or why not) is scrolled into view and focused, since
 * the Save button sits far below it.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { GENDER_IDENTITIES } from '../utils/constants';
import SkinTonePicker from './SkinTonePicker';
import ModelBodyFields from './ModelBodyFields';
import PersonalQuestionsNote from './PersonalQuestionsNote';
import { extractErrorMessages } from '../utils/formatters';

/** The form's values from the saved profile. */
const savedValues = (user) => ({
  first_name: user?.first_name || '',
  last_name: user?.last_name || '',
  phone: user?.phone || '',
  stage_name: user?.stage_name || '',
  pronouns: user?.pronouns || '',
  gender_identity: user?.gender_identity || '',
  skin_tone: user?.skin_tone || '',
  willing_to_model_nude: user?.willing_to_model_nude || false,
  body_type: user?.body_type || '',
  genitalia: user?.genitalia || '',
});

/** The profile form. */
const Profile = ({ currentUser, setCurrentUser }) => {

  const navigate = useNavigate();

  const [formData, setFormData] = useState(() => savedValues(currentUser));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [shownUser, setShownUser] = useState(currentUser);
  if (currentUser !== shownUser) {
    setShownUser(currentUser);
    setFormData(savedValues(currentUser));
  }

  /** Saves a changed field. */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'willing_to_model_nude' && !checked ? { genitalia: '' } : {})
    }));
  };

  /** Saves the chosen skin tone. */
  const handleSkinToneSelect = (value) => {
    setFormData(prev => ({ ...prev, skin_tone: value }));
  };

  /** Saves the profile; on a refusal, shows why and goes back to what's saved. */
  const messageRef = useRef(null);

  useEffect(() => {
    if (!message.text) return;
    messageRef.current?.scrollIntoView?.({ block: 'center' });
    messageRef.current?.focus();
  }, [message]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await api.patch(`/users/${currentUser.id}`, { user: formData });
      setCurrentUser(res.data);
      setMessage({ type: 'success', text: 'Profile saved.' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'danger', text: extractErrorMessages(err, 'Failed to update profile.') });
      setFormData(savedValues(currentUser));
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
            <div ref={messageRef} tabIndex={-1} className={`alert alert-${message.type}`} role={message.type === 'success' ? 'status' : 'alert'}>
              {message.text}
              {message.type === 'success' && (
                <button type="button" className="btn btn-link alert-link p-0 ms-2 align-baseline" onClick={() => navigate('/')}>
                  Back to home
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <h5 className="mb-3 text-primary">Basic Information</h5>
            <div className="row gy-3 mb-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="profile-first-name">First Name</label>
                <input id="profile-first-name" type="text" className="form-control" name="first_name" value={formData.first_name} onChange={handleChange} required autoComplete="given-name" />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="profile-last-name">Last Name</label>
                <input id="profile-last-name" type="text" className="form-control" name="last_name" value={formData.last_name} onChange={handleChange} required autoComplete="family-name" />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="profile-phone">Phone Number</label>
              <input id="profile-phone" type="tel" className="form-control" name="phone" value={formData.phone} onChange={handleChange} placeholder="e.g. 555-123-4567" autoComplete="tel" />
            </div>

            {currentUser.role === 'model' && (
              <>
                <hr className="my-4" />
                <h5 className="mb-3 text-success">Model Details</h5>
                <PersonalQuestionsNote />
                
                <div className="row gy-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="profile-stage-name">Stage Name (Optional)</label>
                    <input id="profile-stage-name" type="text" className="form-control" name="stage_name" value={formData.stage_name} onChange={handleChange} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="profile-pronouns">Pronouns</label>
                    <input id="profile-pronouns" type="text" className="form-control" name="pronouns" value={formData.pronouns} onChange={handleChange} placeholder="e.g. they/them" />
                  </div>
                </div>

                <div className="row gy-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="profile-gender">Gender *</label>
                    <select id="profile-gender" className="form-select" name="gender_identity" value={formData.gender_identity} onChange={handleChange} required>
                      <option value="">Select...</option>
                      {GENDER_IDENTITIES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <SkinTonePicker value={formData.skin_tone} onChange={handleSkinToneSelect} required />
                  </div>
                </div>

                <div className="mb-3 form-check">
                  <input type="checkbox" className="form-check-input" id="nudeCheck" name="willing_to_model_nude" checked={formData.willing_to_model_nude} onChange={handleChange} />
                  <label className="form-check-label" htmlFor="nudeCheck">
                    I am willing to model nude
                  </label>
                </div>

                <ModelBodyFields
                  values={formData}
                  onChange={(name, value) => setFormData(prev => ({ ...prev, [name]: value }))}
                />
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
