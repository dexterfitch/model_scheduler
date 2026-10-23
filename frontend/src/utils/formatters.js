import { CALENDAR_COLORS } from './constants';

// Text colour for each calendar fill, from MICA's approved combinations:
// white on blue; black on green, orange and Cool Grey.
export const calendarTextColor = (background) =>
  background === CALENDAR_COLORS.blue ? '#ffffff' : '#000000';

export const formatSkinTone = (tone) => {
  if (!tone || tone === "Any") return "Any Skintone";
  if (tone.toLowerCase().includes("skintone")) return tone;
  return `${tone} Skintone`;
};

export const extractErrorMessages = (err, fallback) => {
  const data = err.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length) return data.errors.join(" ");
  if (data?.error) return data.error;
  return fallback;
};

// Display label for a gender preference option. The stored values stay separate
// (pref_gender + pref_genitalia) so matching against a model's own profile isn't
// affected by how the option is labeled. Pass genitalia only for nude sessions.
export const genderOptionLabel = (gender, genitalia) => {
  if (gender === "Woman" && genitalia === "Male") return "Trans Woman";
  if (gender === "Man" && genitalia === "Female") return "Trans Man";
  return gender;
};

export const formatGenderPreference = (req) =>
  genderOptionLabel(req.pref_gender || "Any", req.model_mode === "nude" ? req.pref_genitalia : null);

export const formatBodyType = (type) => {
  if (!type || type === "Any") return "Any Build";
  return `${type} Build`;
};

export const formatGenitalia = (genitalia) => {
  if (!genitalia || genitalia === "Any") return "Any Genitalia";
  return `${genitalia} Genitalia`;
};

export const formatModelCount = (n) => `${n} model${n === 1 ? "" : "s"}`;

export const calculateMatchScore = (user, target) => {
  let score = 0;
  if (user.skin_tone === target.pref_skin_tone) score++;
  if (user.gender_identity === target.pref_gender) score++;
  if (user.body_type && user.body_type === target.pref_body_type) score++;
  if (target.model_mode === "nude" && user.genitalia && user.genitalia === target.pref_genitalia) score++;
  return score;
};

// "Any Skintone, Woman, Fat Build" (plus genitalia for nude sessions) for one set of preferences
export const formatPreferenceSummary = (prefs, modelMode) => [
  formatSkinTone(prefs.pref_skin_tone),
  formatGenderPreference({ ...prefs, model_mode: modelMode }),
  formatBodyType(prefs.pref_body_type),
  ...(modelMode === 'nude' ? [formatGenitalia(prefs.pref_genitalia)] : [])
].join(', ');