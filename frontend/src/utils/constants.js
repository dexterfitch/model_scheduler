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

// Gender-neutral build options (used for both nude and clothed sessions)
export const BODY_TYPES = ["Muscular", "Average", "Fat"];

// Only used for nude sessions
export const GENITALIA_OPTIONS = ["Male", "Female", "Intersex"];

// Keep in sync with FacultyRequest::MAX_MODELS_PER_REQUEST
export const MAX_MODELS_PER_REQUEST = 6;

export const SKIN_TONES = ["Light", 
  "Medium", 
  "Dark"
];

// What a model can answer about themselves: a tone, or not to say. Requests only
// ask for SKIN_TONES (or Any), since "Prefer not to say" isn't something to ask for.
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

// Mirrors the --brand-* custom properties in src/index.css
export const CALENDAR_COLORS = {
  blue: '#0047bb',
  green: '#2dc84d',
  orange: '#fe5000',
  grey: '#a7a8aa'
};
