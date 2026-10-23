import React, { useId } from "react";
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

// Per-model preferences live alongside the shared ones above. A new request
// asks for each model separately unless faculty choose "Same for every model".
export const DEFAULT_SLOT_STATE = { same_for_all: false, model_slots: [] };

const SLOT_KEYS = ["pref_skin_tone", "pref_gender", "pref_body_type", "pref_genitalia"];
const slotFrom = (obj) => Object.fromEntries(SLOT_KEYS.map(k => [k, obj?.[k] || "Any"]));

// True when the form is showing one block per model
export const usesModelSlots = (values) => (values.models_needed || 1) > 1 && !values.same_for_all;

// What to send to the server: one set per model, or [] for "same for every model"
export const modelSlotsPayload = (values) =>
  usesModelSlots(values)
    ? (values.model_slots || []).slice(0, values.models_needed).map(slotFrom)
    : [];

// Form state for an existing class: classes saved without per-model
// preferences open with "Same for every model" switched on
export const slotFormState = (series) => ({
  same_for_all: !(series.model_slots?.length),
  model_slots: (series.model_slots || []).map(slotFrom)
});

// Use inside a setState updater so dependent fields stay consistent:
// switching to clothed clears every genitalia preference, and changing the
// number of models keeps exactly one set of preferences per model.
export const applyPreferenceChange = (prev, name, value) => {
  const next = { ...prev, [name]: name === "models_needed" ? Number(value) : value };
  if (name === "model_mode" && value !== "nude") {
    next.pref_genitalia = "Any";
    next.model_slots = (next.model_slots || []).map(slot => ({ ...slot, pref_genitalia: "Any" }));
  }
  const count = next.models_needed || 1;
  const slots = next.model_slots || [];
  if (count > 1 && slots.length !== count) {
    // New models start from the shared preferences
    next.model_slots = Array.from({ length: count }, (_, i) => slots[i] || slotFrom(next));
  }
  return next;
};

// Skin tone, gender presentation, body type and (nude sessions) genitalia
function PreferenceSet({ prefs, isNude, idPrefix, onChange }) {
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
      <Form.Group as={Col} md={6} lg={3} className="mb-3" controlId={`${idPrefix}-body`}>
        <Form.Label>Body Type</Form.Label>
        <Form.Select name="pref_body_type" value={prefs.pref_body_type || "Any"} onChange={handle}>
          <option value="Any">Any</option>
          {BODY_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
        </Form.Select>
      </Form.Group>
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

function ModelPreferenceFields({ values, onChange }) {
  // Unique ids: this appears in both the New Request and Edit Class windows
  const id = useId();
  const isNude = values.model_mode === "nude";
  const count = values.models_needed || 1;
  const perModel = usesModelSlots(values);
  const handle = (e) => onChange(e.target.name, e.target.value);
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