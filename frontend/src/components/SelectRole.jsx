import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Card, Button, Form, Row, Col, Alert, Spinner } from 'react-bootstrap';
import api from '../services/api';
import { GENDER_IDENTITIES } from "../utils/constants";
import SkinTonePicker from "./SkinTonePicker";
import ModelBodyFields from "./ModelBodyFields";
import PersonalQuestionsNote from "./PersonalQuestionsNote";
import { extractErrorMessages } from "../utils/formatters";

const SelectRole = ({ onLogin, userId: propUserId }) => {
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
    body_type: '',
    genitalia: '',
  });

  const userId = propUserId || location.state?.userId;

  useEffect(() => {
    if (!userId) navigate('/login');
  }, [userId, navigate]);

  useEffect(() => {
    document.title = 'Welcome · MICA Pose Pool';
  }, []);

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
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'willing_to_model_nude' && !checked ? { genitalia: '' } : {})
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
      // Save the details first: if they're refused, no role is set yet, so the
      // person can fix them and try again. The skin tone goes with the role too,
      // so the new model profile is complete from the start.
      const profileData = { ...payload };
      delete profileData.role;

      if (Object.keys(profileData).length > 0) {
        await api.patch(`/users/${userId}`, { user: profileData });
      }

      await api.post(`/select_role`, payload.role === 'model'
        ? { role: 'model', skin_tone: payload.skin_tone }
        : { role: payload.role });

      const response = await api.get(`/users/${userId}`);
      onLogin(response.data);
      navigate('/');
    } catch (err) {
      console.error("Failed to set role:", err);
      setError(extractErrorMessages(err, "Something went wrong."));
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
            {error && (
              <Alert variant="danger" dismissible onClose={() => setError('')}>
                {error}
              </Alert>
            )}
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
            <p className="text-muted small mb-2">We need a few details to match you with the right art classes.</p>
            <PersonalQuestionsNote />

            {error && (
              <Alert variant="danger" dismissible onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <Form onSubmit={handleModelSubmit}>
              <Row className="mb-3">
                <Form.Group as={Col} md={6} className="mb-3 mb-md-0" controlId="setup-stage-name">
                  <Form.Label>Stage Name (Optional)</Form.Label>
                  <Form.Control
                    type="text"
                    name="stage_name"
                    value={formData.stage_name}
                    onChange={handleModelFormChange}
                  />
                </Form.Group>
                <Form.Group as={Col} md={6} controlId="setup-pronouns">
                  <Form.Label>Pronouns</Form.Label>
                  <Form.Control
                    type="text"
                    name="pronouns"
                    value={formData.pronouns}
                    onChange={handleModelFormChange}
                    placeholder="e.g. they/them"
                  />
                </Form.Group>
              </Row>

              <Row className="mb-3">
                <Form.Group as={Col} md={6} className="mb-3 mb-md-0" controlId="setup-gender">
                  <Form.Label>Gender *</Form.Label>
                  <Form.Select
                    name="gender_identity"
                    value={formData.gender_identity}
                    onChange={handleModelFormChange}
                    required
                  >
                    <option value="">Select...</option>
                    {GENDER_IDENTITIES.map(g => <option key={g} value={g}>{g}</option>)}
                  </Form.Select>
                </Form.Group>

                <Col md={6}>
                  <SkinTonePicker value={formData.skin_tone} onChange={handleSkinToneSelect} required />
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

              <ModelBodyFields
                values={formData}
                onChange={(name, value) => setFormData(prev => ({ ...prev, [name]: value }))}
              />

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
