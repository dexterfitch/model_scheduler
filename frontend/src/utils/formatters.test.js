import {
  genderOptionLabel, formatGenderPreference, calculateMatchScore, extractErrorMessages,
  calendarTextColor, formatPreferenceSummary
} from './formatters';
import { CALENDAR_COLORS } from './constants';

describe('genderOptionLabel', () => {
  it('shows Woman (Trans) for Woman with male genitalia', () => {
    expect(genderOptionLabel('Woman', 'Male')).toBe('Woman (Trans)');
  });

  it('shows Man (Trans) for Man with female genitalia', () => {
    expect(genderOptionLabel('Man', 'Female')).toBe('Man (Trans)');
  });

  it('leaves other combinations unchanged', () => {
    expect(genderOptionLabel('Woman', 'Female')).toBe('Woman');
    expect(genderOptionLabel('Woman', 'Intersex')).toBe('Woman');
    expect(genderOptionLabel('Non-binary', 'Male')).toBe('Non-binary');
  });
});

describe('formatGenderPreference', () => {
  it('says what "Any" means', () => {
    expect(formatGenderPreference({ pref_gender: 'Any', model_mode: 'clothed' })).toBe('Any Gender Presentation');
  });

  it('ignores the genitalia preference for clothed sessions', () => {
    const req = { pref_gender: 'Woman', pref_genitalia: 'Male', model_mode: 'clothed' };
    expect(formatGenderPreference(req)).toBe('Woman');
  });
});

describe('calculateMatchScore', () => {
  it('counts genitalia only for nude sessions', () => {
    const model = { skin_tone: 'Light', gender_identity: 'Woman', body_type: 'Fat', genitalia: 'Intersex' };
    const nude = { pref_skin_tone: 'Light', pref_gender: 'Woman', pref_body_type: 'Fat', pref_genitalia: 'Intersex', model_mode: 'nude' };
    expect(calculateMatchScore(model, nude)).toBe(4);
    expect(calculateMatchScore(model, { ...nude, model_mode: 'clothed' })).toBe(3);
  });
});

describe('extractErrorMessages', () => {
  it('uses the fallback when the server sends no message', () => {
    expect(extractErrorMessages({}, 'Try again')).toBe('Try again');
  });

  it('joins a list of server errors', () => {
    const err = { response: { data: { errors: ['First problem.', 'Second problem.'] } } };
    expect(extractErrorMessages(err, 'x')).toBe('First problem. Second problem.');
  });

  it('uses a single server error', () => {
    const err = { response: { data: { error: 'Not authorized' } } };
    expect(extractErrorMessages(err, 'x')).toBe('Not authorized');
  });
});

describe('calendarTextColor', () => {
  it('uses MICA-approved text on each calendar colour', () => {
    expect(calendarTextColor(CALENDAR_COLORS.blue)).toBe('#ffffff');
    expect(calendarTextColor(CALENDAR_COLORS.green)).toBe('#000000');
    expect(calendarTextColor(CALENDAR_COLORS.orange)).toBe('#000000');
    expect(calendarTextColor(CALENDAR_COLORS.grey)).toBe('#000000');
  });

  it('falls back to black for any other colour', () => {
    expect(calendarTextColor('#123456')).toBe('#000000');
  });
});

describe('formatPreferenceSummary', () => {
  const prefs = { pref_skin_tone: 'Any', pref_gender: 'Any', pref_body_type: 'Fat', pref_genitalia: 'Any' };

  it('spells out every preference, including the ones left as Any', () => {
    expect(formatPreferenceSummary(prefs, 'clothed')).toBe('Any Skintone, Any Gender Presentation, Fat Build');
  });

  it('can list only the preferences that were set', () => {
    expect(formatPreferenceSummary(prefs, 'clothed', { onlySet: true })).toBe('Fat Build');
  });

  it('says so when nothing was set', () => {
    expect(formatPreferenceSummary({ ...prefs, pref_body_type: 'Any' }, 'nude', { onlySet: true })).toBe('No preferences');
  });
});