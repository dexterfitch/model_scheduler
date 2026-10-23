import {
  genderOptionLabel, formatGenderPreference, calculateMatchScore, extractErrorMessages,
  calendarTextColor
} from './formatters';
import { CALENDAR_COLORS } from './constants';

describe('genderOptionLabel', () => {
  it('shows Trans Woman for Woman with male genitalia', () => {
    expect(genderOptionLabel('Woman', 'Male')).toBe('Trans Woman');
  });

  it('shows Trans Man for Man with female genitalia', () => {
    expect(genderOptionLabel('Man', 'Female')).toBe('Trans Man');
  });

  it('leaves other combinations unchanged', () => {
    expect(genderOptionLabel('Woman', 'Female')).toBe('Woman');
    expect(genderOptionLabel('Woman', 'Intersex')).toBe('Woman');
    expect(genderOptionLabel('Non-binary', 'Male')).toBe('Non-binary');
  });
});

describe('formatGenderPreference', () => {
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