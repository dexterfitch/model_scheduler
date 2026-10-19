import React from "react";
import { Row, Col, Form } from "react-bootstrap";
import {
  GENDER_PREFERENCE_OPTIONS, SKIN_TONES, BODY_TYPES, GENITALIA_OPTIONS, MAX_MODELS_PER_REQUEST
} from "../utils/constants";
import { genderOptionLabel } from "../utils/formatters";

export const DEFAULT_MODEL_PREFERENCES = {
  model_mode: "clothed",
  pref_skin_tone: "Any",
  pref_gender: "Any",
  pref_body_type: "Any",
  pref_genitalia: "Any",
  models_needed: 1
};

// Use inside a setState updater so dependent fields stay consistent:
// switching to clothed clears the genitalia preference.
export const applyPreferenceChange = (prev, name, value) => {
  const next = { ...prev, [name]: name === "models_needed" ? Number(value) : value };
  if (name === "model_mode" && value !== "nude") next.pref_genitalia = "Any";
  return next;
};

function ModelPreferenceFields({ values, onChange }) {
  const isNude = values.model_mode === "nude";
  const genitalia = isNude ? values.pref_genitalia : null;
  const handle = (e) => onChange(e.target.name, e.target.value);

  return (
    <>
      <Row>
        <Col md={4} className="mb-3">
          <Form.Label>Nudity</Form.Label>
          <Form.Select name="model_mode" value={values.model_mode} onChange={handle}>
            <option value="clothed">Clothed</option>
            <option value="nude">Nude</option>
          </Form.Select>
        </Col>
        <Col md={4} className="mb-3">
          <Form.Label>Number of Models</Form.Label>
          <Form.Select name="models_needed" value={values.models_needed} onChange={handle}>
            {Array.from({ length: MAX_MODELS_PER_REQUEST }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Form.Select>
        </Col>
        <Col md={4} className="mb-3">
          <Form.Label>Skin Tone</Form.Label>
          <Form.Select name="pref_skin_tone" value={values.pref_skin_tone} onChange={handle}>
            <option value="Any">Any</option>
            {SKIN_TONES.map(t => <option key={t} value={t}>{t}</option>)}
          </Form.Select>
        </Col>
      </Row>

      <Row>
        <Col md={4} className="mb-3">
          <Form.Label>Gender Presentation</Form.Label>
          <Form.Select name="pref_gender" value={values.pref_gender} onChange={handle}>
            {GENDER_PREFERENCE_OPTIONS.map(g => (
              <option key={g} value={g}>{genderOptionLabel(g, genitalia)}</option>
            ))}
          </Form.Select>
        </Col>
        <Col md={4} className="mb-3">
          <Form.Label>Body Type</Form.Label>
          <Form.Select name="pref_body_type" value={values.pref_body_type} onChange={handle}>
            <option value="Any">Any</option>
            {BODY_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
          </Form.Select>
        </Col>
        {isNude && (
          <Col md={4} className="mb-3">
            <Form.Label>Genitalia</Form.Label>
            <Form.Select name="pref_genitalia" value={values.pref_genitalia} onChange={handle}>
              <option value="Any">Any</option>
              {GENITALIA_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </Form.Select>
          </Col>
        )}
      </Row>
      {values.models_needed > 1 && (
        <Form.Text className="d-block mb-3 text-muted">
          Preferences apply to every model in the session. Use the notes if you want a specific mix
          (e.g. one jacked model and one fat model).
        </Form.Text>
      )}
    </>
  );
}

export default ModelPreferenceFields;
