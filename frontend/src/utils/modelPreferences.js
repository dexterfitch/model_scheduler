/**
 * Form state for model preferences: the same for every model, or one set per model.
 */

export const DEFAULT_MODEL_PREFERENCES = {
  model_mode: "clothed",
  pref_skin_tone: "Any",
  pref_gender: "Any",
  pref_body_type: "Any",
  pref_genitalia: "Any",
  models_needed: 1
};

export const DEFAULT_SLOT_STATE = { same_for_all: false, model_slots: [] };

const SLOT_KEYS = ["pref_skin_tone", "pref_gender", "pref_body_type", "pref_genitalia"];
/** One model's preferences, with Any for anything missing. */
const slotFrom = (obj) => Object.fromEntries(SLOT_KEYS.map(k => [k, obj?.[k] || "Any"]));

/** Whether the form has a separate set of preferences per model. */
export const usesModelSlots = (values) => (values.models_needed || 1) > 1 && !values.same_for_all;

/** The per-model preferences to send, or none when they're the same for every model. */
export const modelSlotsPayload = (values) =>
  usesModelSlots(values)
    ? (values.model_slots || []).slice(0, values.models_needed).map(slotFrom)
    : [];

/** The form's per-model state for a saved class. */
export const slotFormState = (series) => ({
  same_for_all: !(series.model_slots?.length),
  model_slots: (series.model_slots || []).map(slotFrom)
});

/**
 * The form after one change: switching to clothed clears genitalia, and the per-model list follows
 * the number of models.
 */
export const applyPreferenceChange = (prev, name, value) => {
  const next = { ...prev, [name]: name === "models_needed" ? Number(value) : value };
  if (name === "model_mode" && value !== "nude") {
    next.pref_genitalia = "Any";
    next.model_slots = (next.model_slots || []).map(slot => ({ ...slot, pref_genitalia: "Any" }));
  }
  const count = next.models_needed || 1;
  const slots = next.model_slots || [];
  if (count > 1 && slots.length !== count) {
    next.model_slots = Array.from({ length: count }, (_, i) => slots[i] || slotFrom(next));
  }
  return next;
};
