/**
 * The model preference questions in New Request and Edit Class: nudity, number of
 * models, and preferences, either the same for every model or one set per model.
 */

import React, { useId } from "react";
import { Row, Col, Form } from "react-bootstrap";
import {
  GENDER_PREFERENCE_OPTIONS, SKIN_TONES, GENITALIA_OPTIONS, MAX_MODELS_PER_REQUEST
} from "../utils/constants";
import { genderOptionLabel } from "../utils/formatters";
import { usesModelSlots } from "../utils/modelPreferences";
import BodyTypePicker from "./BodyTypePicker";

/** One set of preferences: skin tone, gender, body type, and genitalia for nude classes. */
function PreferenceSet({ prefs, isNude, idPrefix, onChange }) {
  /** Passes a changed preference to the form. */
  const handle = (e) => onChange(e.target.name, e.target.value);
  const genitalia = isNude ? prefs.pref_genitalia : null;

  return (
    <Row>
      <Form.Group as={Col} md={6} lg={3} className="mb-3" controlId={`${idPrefix}-skin`}>
        <Form.Label>Skin Tone</Form.Label>
        <Form.Select name="pref_skin_tone" value={prefs.pref_skin_tone || "Any"} onChange={handle}>
          <option value="Any">Any</option>
          {SKIN_TONES.map(t => <option key={t} value={t}>{t}</option>)}
        </Form.Select>
      </Form.Group>
      <Form.Group as={Col} md={6} lg={3} className="mb-3" controlId={`${idPrefix}-gender`}>
        <Form.Label>Gender</Form.Label>
        <Form.Select name="pref_gender" value={prefs.pref_gender || "Any"} onChange={handle}>
          {GENDER_PREFERENCE_OPTIONS.map(g => (
            <option key={g} value={g}>{genderOptionLabel(g, genitalia)}</option>
          ))}
        </Form.Select>
      </Form.Group>
      <Col xs={12} lg={6} className="mb-3">
        <BodyTypePicker
          value={prefs.pref_body_type || "Any"}
          onChange={(value) => onChange("pref_body_type", value)}
          noneLabel="Any"
          noneValue="Any"
        />
      </Col>
      {isNude && (
        <Form.Group as={Col} md={6} lg={3} className="mb-3" controlId={`${idPrefix}-genitalia`}>
          <Form.Label>Genitalia</Form.Label>
          <Form.Select name="pref_genitalia" value={prefs.pref_genitalia || "Any"} onChange={handle}>
            <option value="Any">Any</option>
            {GENITALIA_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </Form.Select>
        </Form.Group>
      )}
    </Row>
  );
}

/** Nudity, number of models, and the preferences for each model. */
function ModelPreferenceFields({ values, onChange }) {
  const id = useId();
  const isNude = values.model_mode === "nude";
  const count = values.models_needed || 1;
  const perModel = usesModelSlots(values);
  /** Passes a changed field to the form. */
  const handle = (e) => onChange(e.target.name, e.target.value);
  /** Changes one preference for one model. */
  const setSlot = (index, key, value) =>
    onChange("model_slots", (values.model_slots || []).map((slot, i) => (i === index ? { ...slot, [key]: value } : slot)));

  return (
    <>
      <Row>
        <Form.Group as={Col} md={6} lg={3} className="mb-3" controlId={`${id}-mode`}>
          <Form.Label>Nudity</Form.Label>
          <Form.Select name="model_mode" value={values.model_mode} onChange={handle}>
            <option value="clothed">Clothed</option>
            <option value="nude">Nude</option>
          </Form.Select>
        </Form.Group>
        <Form.Group as={Col} md={6} lg={3} className="mb-3" controlId={`${id}-count`}>
          <Form.Label>Number of Models</Form.Label>
          <Form.Select name="models_needed" value={values.models_needed} onChange={handle}>
            {Array.from({ length: MAX_MODELS_PER_REQUEST }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Form.Select>
        </Form.Group>
      </Row>

      {count > 1 && (
        <Form.Check
          type="switch"
          id={`${id}-same`}
          className="mb-3"
          label="Same for every model"
          checked={!!values.same_for_all}
          onChange={e => onChange("same_for_all", e.target.checked)}
        />
      )}

      {perModel ? (
        (values.model_slots || []).slice(0, count).map((slot, i) => (
          <fieldset key={i} className="border p-3 mb-3">
            <legend className="fs-6 fw-bold mb-2">Model {i + 1}</legend>
            <PreferenceSet prefs={slot} isNude={isNude} idPrefix={`${id}-model-${i}`} onChange={(key, value) => setSlot(i, key, value)} />
          </fieldset>
        ))
      ) : (
        <PreferenceSet prefs={values} isNude={isNude} idPrefix={`${id}-shared`} onChange={onChange} />
      )}

      {count > 1 && !perModel && (
        <Form.Text className="d-block mb-3 text-muted">These preferences apply to every model in the session.</Form.Text>
      )}
    </>
  );
}

export default ModelPreferenceFields;
