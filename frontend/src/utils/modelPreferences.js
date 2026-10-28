// Model preferences on a class request: the shared set, and one set per model
// ("model slots"). Used by the request forms and by the per-model fields.

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
