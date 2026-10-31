/**
 * Option lists and colors shared across the app. The option lists match the API's.
 */

export const DEPARTMENTS = [
  "Painting", 
  "Drawing", 
  "Illustration", 
  "FYE", 
  "Sculpture", 
  "Open Studies"
];

export const BUILDINGS = [
  "Main", 
  "Fox", 
  "Lazarus", 
  "Station"
];

export const GENDER_IDENTITIES = [
  "Non-binary",
  "Woman", 
  "Man", 
  "Prefer not to say"
];

export const GENDER_PREFERENCE_OPTIONS = [
  "Any", 
  "Non-binary",
  "Woman", 
  "Man"
];

export const BODY_TYPES = ["Muscular", "Average", "Fat"];

export const GENITALIA_OPTIONS = ["Male", "Female", "Intersex"];

export const MAX_MODELS_PER_REQUEST = 6;

export const SKIN_TONES = ["Light", 
  "Medium", 
  "Dark"
];

export const SKIN_TONE_ANSWERS = [...SKIN_TONES, "Prefer not to say"];

export const SKIN_TONE_OPTIONS = [
  { 
    label: 'Light', 
    color: '#F3CFB3' 
  },
  { 
    label: 'Medium', 
    color: '#C58C65' 
  },
  { 
    label: 'Dark', 
    color: '#593C2B' 
  },
  {
    label: 'Prefer not to say',
    color: null
  }
];

export const CALENDAR_COLORS = {
  blue: '#0047bb',
  green: '#2dc84d',
  orange: '#fe5000',
  grey: '#a7a8aa'
};
