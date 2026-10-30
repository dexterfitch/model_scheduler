import { fitsPreferences, dateCoverage, notifyLists, notifyEmailLink } from './coverage';

const model = (id, extra = {}) => ({
  id, role: 'model', first_name: `M${id}`, last_name: 'Test', email: `m${id}@mica.edu`,
  skin_tone: 'Light', gender_identity: 'Woman', body_type: 'Average', genitalia: 'Female', willing_to_model_nude: true, ...extra
});
const anyPrefs = { pref_skin_tone: 'Any', pref_gender: 'Any', pref_body_type: 'Any', pref_genitalia: 'Any' };
const date = { id: 11, status: 'pending', models_needed: 1, starts_at: '2099-03-02T15:00:00Z', ends_at: '2099-03-02T17:00:00Z', confirmed_gigs: [] };
const series = { id: 1, class_name: 'Gesture Drawing', department: 'Drawing', building: 'Fox', room_number: '120',
  model_mode: 'clothed', model_slots: [], ...anyPrefs, faculty_requests: [date] };
const slot = (user, start = '2099-03-02T13:00:00Z', end = '2099-03-02T20:00:00Z') => ({ id: user.id * 10, status: 'active', user, starts_at: start, ends_at: end });

describe('fitsPreferences', () => {
  it('fits anyone when nothing was asked for', () => {
    expect(fitsPreferences(model(1, { gender_identity: 'Prefer not to say' }), anyPrefs, 'clothed')).toBe(true);
  });

  it('needs every preference that was set', () => {
    const prefs = { ...anyPrefs, pref_gender: 'Woman', pref_body_type: 'Fat' };
    expect(fitsPreferences(model(1, { body_type: 'Fat' }), prefs, 'clothed')).toBe(true);
    expect(fitsPreferences(model(2), prefs, 'clothed')).toBe(false);
  });

  it('only checks genitalia for nude sessions', () => {
    const prefs = { ...anyPrefs, pref_genitalia: 'Male' };
    expect(fitsPreferences(model(1), prefs, 'clothed')).toBe(true);
    expect(fitsPreferences(model(1), prefs, 'nude')).toBe(false);
  });
});

describe('dateCoverage', () => {
  it('counts models who are free for the whole date, and which of them match', () => {
    const fat = model(1, { body_type: 'Fat' });
    const average = model(2);
    const busy = model(3, { body_type: 'Fat' });
    const notFree = model(4, { body_type: 'Fat' });
    const fatClass = { ...series, pref_body_type: 'Fat' };
    const gigs = [{ id: 1, status: 'confirmed', art_model_availability: { user: busy },
      faculty_request: { id: 99, starts_at: '2099-03-02T16:00:00Z', ends_at: '2099-03-02T18:00:00Z' } }];
    const result = dateCoverage(date, fatClass, {
      models: [fat, average, busy, notFree],
      availabilities: [slot(fat), slot(average), slot(busy), slot(notFree, '2099-03-02T16:00:00Z')],
      gigs,
    });
    expect(result.free.map(m => m.id)).toEqual([1, 2]);
    expect(result.matching.map(m => m.id)).toEqual([1]);
  });

  it('leaves out models who only pose clothed for a nude session', () => {
    const clothedOnly = model(1, { willing_to_model_nude: false });
    const result = dateCoverage(date, { ...series, model_mode: 'nude' }, { models: [clothedOnly], availabilities: [slot(clothedOnly)], gigs: [] });
    expect(result.free).toEqual([]);
  });

  it('matches against any spot still open on a class with per-model preferences', () => {
    const man = model(1, { gender_identity: 'Man' });
    const woman = model(2);
    const twoSpots = { ...series, model_slots: [
      { position: 1, ...anyPrefs, pref_gender: 'Woman' },
      { position: 2, ...anyPrefs, pref_gender: 'Man' },
    ] };
    // Spot 1 (a woman) is already booked on this date, so only spot 2 is open
    const halfBooked = { ...date, models_needed: 2, confirmed_gigs: [{ id: 5, model_slot_position: 1, art_model_availability: { user: model(9) } }] };
    const result = dateCoverage(halfBooked, twoSpots, { models: [man, woman], availabilities: [slot(man), slot(woman)], gigs: [] });
    expect(result.matching.map(m => m.id)).toEqual([1]);
  });
});

describe('notifyLists', () => {
  it('lists models who fit the class, and everyone willing to pose that way', () => {
    const fat = model(1, { body_type: 'Fat' });
    const average = model(2);
    const clothedOnly = model(3, { body_type: 'Fat', willing_to_model_nude: false });
    const faculty = { id: 4, role: 'faculty', email: 'f@mica.edu' };
    const lists = notifyLists({ ...series, model_mode: 'nude', pref_body_type: 'Fat' }, [fat, average, clothedOnly, faculty]);
    expect(lists.matching.map(m => m.id)).toEqual([1]);
    expect(lists.all.map(m => m.id)).toEqual([1, 2]);
  });
});

describe('notifyEmailLink', () => {
  it("opens an email to the models in BCC, listing the open dates and asking for I'm Available", () => {
    const link = notifyEmailLink(series, [date], [model(1), model(2)], 'https://posepool.mica.edu');
    expect(link.startsWith('mailto:?')).toBe(true);
    const params = new URLSearchParams(link.slice('mailto:?'.length));
    expect(params.get('bcc')).toBe('m1@mica.edu,m2@mica.edu');
    expect(params.get('subject')).toContain('Gesture Drawing');
    const body = params.get('body');
    expect(body).toContain('Fox 120');
    expect(body).toContain('Clothed');
    expect(body).toContain("I'm Available");
    expect(body).toContain('https://posepool.mica.edu');
  });
});
