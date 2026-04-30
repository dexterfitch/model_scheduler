import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Card, Button, Form, Row, Col, Alert, Spinner } from 'react-bootstrap';
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

  const handleFacultySelect = () => {
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
      await api.post(`/select_role`, { role: payload.role });
      
      const profileData = { ...payload };
      delete profileData.role;
      
      if (Object.keys(profileData).length > 0) {
        await api.patch(`/users/${userId}`, { user: profileData });
      }

      const response = await api.get(`/users/${userId}`);
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
    <Container className="d-flex justify-content-center align-items-center min-vh-100 py-5">
      <Card className="shadow p-4 p-md-5" style={{ maxWidth: '600px', width: '100%' }}>

        {step === 'selection' && (
          <div className="text-center">
            <h2 className="mb-4">Welcome to MICA Pose Pool</h2>
            <p className="lead mb-4">To finish setting up your account, please tell us who you are.</p>
            {error && <Alert variant="danger">{error}</Alert>}
            <div className="d-grid gap-3">
              <Button
                variant="outline-primary"
                size="lg"
                className="p-4"
                onClick={handleFacultySelect}
                disabled={loading}
              >
                <h5 className="mb-1">I am Faculty</h5>
                <small>I want to request models for my classes.</small>
              </Button>
              <Button
                variant="outline-success"
                size="lg"
                className="p-4"
                onClick={handleModelSelect}
                disabled={loading}
              >
                <h5 className="mb-1">I am a Model</h5>
                <small>I want to view gigs and manage my schedule.</small>
              </Button>
            </div>
          </div>
        )}

        {step === 'model-form' && (
          <div>
            <h3 className="mb-3 text-success">Model Profile Setup</h3>
            <p className="text-muted small mb-4">We need a few details to match you with the right art classes.</p>

            {error && <Alert variant="danger">{error}</Alert>}

            <Form onSubmit={handleModelSubmit}>
              <Row className="mb-3">
                <Col md={6} className="mb-3 mb-md-0">
                  <Form.Label>Stage Name (Optional)</Form.Label>
                  <Form.Control
                    type="text"
                    name="stage_name"
                    value={formData.stage_name}
                    onChange={handleModelFormChange}
                  />
                </Col>
                <Col md={6}>
                  <Form.Label>Pronouns</Form.Label>
                  <Form.Control
                    type="text"
                    name="pronouns"
                    value={formData.pronouns}
                    onChange={handleModelFormChange}
                    placeholder="e.g. they/them"
                  />
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={6} className="mb-3 mb-md-0">
                  <Form.Label>Gender Identity *</Form.Label>
                  <Form.Select
                    name="gender_identity"
                    value={formData.gender_identity}
                    onChange={handleModelFormChange}
                    required
                  >
                    <option value="">Select...</option>
                    <option value="Woman">Woman</option>
                    <option value="Man">Man</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Transgender">Transgender</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </Form.Select>
                </Col>

                <Col md={6}>
                  <Form.Label>Skin Tone *</Form.Label>
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
                      />
                    ))}
                  </div>
                  <Form.Text className="small mt-1">
                    Selected: <strong>{formData.skin_tone || 'None'}</strong>
                  </Form.Text>
                </Col>
              </Row>

              <div className="mb-4 bg-light p-3 rounded border">
                <Form.Check
                  type="checkbox"
                  id="nudeCheck"
                  name="willing_to_model_nude"
                  checked={formData.willing_to_model_nude}
                  onChange={handleModelFormChange}
                  label={<strong>I am willing to model nude</strong>}
                />
              </div>

              <div className="d-flex gap-2">
                <Button
                  type="button"
                  variant="outline-secondary"
                  className="flex-grow-1"
                  onClick={() => setStep('selection')}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="success"
                  className="flex-grow-1"
                  disabled={loading}
                >
                  {loading ? 'Creating Profile...' : 'Complete Setup'}
                </Button>
              </div>
            </Form>
          </div>
        )}

        {loading && (
          <div className="text-center mt-3">
            <Spinner animation="border" variant="secondary" role="status" />
          </div>
        )}

      </Card>
    </Container>
  );
};

export default SelectRole;