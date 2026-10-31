/**
 * Checks every time field in the app steps by 5 minutes and starts at midnight, so only
 * whole 5-minute times are offered.
 */

const sources = import.meta.glob('../components/*.jsx', { query: '?raw', import: 'default', eager: true });

const timeFields = Object.entries(sources).flatMap(([file, code]) => {
  const found = [];
  let at = code.indexOf('type="time"');
  while (at !== -1) {
    const start = code.lastIndexOf('<', at);
    const end = code.indexOf('/>', at);
    found.push({ file: file.replace('../components/', ''), tag: code.slice(start, end + 2) });
    at = code.indexOf('type="time"', at + 1);
  }
  return found;
});

describe('time fields', () => {
  it('are found in the forms that need them', () => {
    const files = new Set(timeFields.map(f => f.file));
    for (const file of ['FacultyDashboard.jsx', 'ModelDashboard.jsx', 'ModelDetail.jsx', 'AllRequests.jsx', 'CorrectRecordModal.jsx', 'SuperUserPanel.jsx']) {
      expect(files.has(file), `${file} should have time fields`).toBe(true);
    }
  });

  it('count their steps from the hour, not from whatever time is already filled in', () => {
    const missing = timeFields.filter(f => !/min="\d\d:00"/.test(f.tag)).map(f => f.file);
    expect(missing, `time fields without a min on the hour: ${missing.join(', ')}`).toEqual([]);
  });

  it('all list 5-minute steps', () => {
    const missing = timeFields.filter(f => !/step=\{300\}/.test(f.tag)).map(f => f.file);
    expect(missing, `time fields without step={300}: ${missing.join(', ')}`).toEqual([]);
  });
});
