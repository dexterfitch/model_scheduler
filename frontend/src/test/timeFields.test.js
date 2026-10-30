// Every time field offers 5-minute steps, so browser time pickers list
// 00, 05 … 55 instead of every minute (the app rounds to 5 minutes anyway)
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

  it('all list 5-minute steps', () => {
    const missing = timeFields.filter(f => !/step=\{300\}/.test(f.tag)).map(f => f.file);
    expect(missing, `time fields without step={300}: ${missing.join(', ')}`).toEqual([]);
  });
});
