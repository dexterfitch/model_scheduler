/**
 * Words for values: preferences, statuses and server errors, as people read them.
 */

import { CALENDAR_COLORS } from './constants';

/** Text color that's readable on a calendar event's background. */
export const calendarTextColor = (background) =>
  background === CALENDAR_COLORS.blue ? '#ffffff' : '#000000';

/** A skin tone preference in words. */
export const formatSkinTone = (tone) => {
  if (!tone || tone === "Any") return "Any Skintone";
  if (tone === "Prefer not to say") return "Skin tone: Prefer not to say";
  if (tone.toLowerCase().includes("skintone")) return tone;
  return `${tone} Skintone`;
};

/** The server's explanation of an error, or the fallback. */
export const extractErrorMessages = (err, fallback) => {
  const data = err.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length) return data.errors.join(" ");
  if (data?.error) return data.error;
  return fallback;
};

/** A gender, shown as trans when the genitalia preference differs. */
export const genderOptionLabel = (gender, genitalia) => {
  if (gender === "Woman" && genitalia === "Male") return "Woman (Trans)";
  if (gender === "Man" && genitalia === "Female") return "Man (Trans)";
  return gender;
};

/** A class's gender preference in words. */
export const formatGenderPreference = (req) => {
  const gender = req.pref_gender || "Any";
  if (gender === "Any") return "Any Gender Presentation";
  return genderOptionLabel(gender, req.model_mode === "nude" ? req.pref_genitalia : null);
};

/** A body type preference in words. */
export const formatBodyType = (type) => {
  if (!type || type === "Any") return "Any Build";
  return `${type} Build`;
};

/** A genitalia preference in words. */
export const formatGenitalia = (genitalia) => {
  if (!genitalia || genitalia === "Any") return "Any Genitalia";
  return `${genitalia} Genitalia`;
};

/** A number of models, like 2 models. */
export const formatModelCount = (n) => `${n} model${n === 1 ? "" : "s"}`;

/** How many of a class's preferences a model matches. */
export const calculateMatchScore = (user, target) => {
  let score = 0;
  if (user.skin_tone === target.pref_skin_tone) score++;
  if (user.gender_identity === target.pref_gender) score++;
  if (user.body_type && user.body_type === target.pref_body_type) score++;
  if (target.model_mode === "nude" && user.genitalia && user.genitalia === target.pref_genitalia) score++;
  return score;
};

/** A set of preferences in one line; with onlySet, only the ones that were set. */
export const formatPreferenceSummary = (prefs, modelMode, { onlySet = false } = {}) => {
  const parts = [
    [prefs.pref_skin_tone, formatSkinTone(prefs.pref_skin_tone)],
    [prefs.pref_gender, formatGenderPreference({ ...prefs, model_mode: modelMode })],
    [prefs.pref_body_type, formatBodyType(prefs.pref_body_type)],
    ...(modelMode === 'nude' ? [[prefs.pref_genitalia, formatGenitalia(prefs.pref_genitalia)]] : [])
  ];
  const shown = onlySet ? parts.filter(([value]) => value && value !== 'Any') : parts;
  return shown.length ? shown.map(([, label]) => label).join(', ') : 'No preferences';
};
