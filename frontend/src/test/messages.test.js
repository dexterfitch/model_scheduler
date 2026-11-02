/**
 * Checks every message that appears after someone acts (errors, and success notes that
 * aren't pinned toasts) is brought into view, so it's never left off screen when the
 * page or window is scrolled down.
 */

const sources = import.meta.glob('../components/*.jsx', { query: '?raw', import: 'default', eager: true });

const messages = Object.entries(sources).flatMap(([file, code]) => {
  const found = [];
  const pattern = /&&\s*\(?\s*<(Alert[^\n]*variant="danger"|div[^\n]*className=[^\n]*alert alert-)/g;
  for (const match of code.matchAll(pattern)) {
    const start = match.index + match[0].indexOf('<');
    found.push({ file: file.replace('../components/', ''), tag: code.slice(start, code.indexOf('\n', start)) });
  }
  return found;
});

describe('messages shown after an action', () => {
  it('are found where expected', () => {
    const files = new Set(messages.map(m => m.file));
    for (const file of ['FacultyDashboard.jsx', 'AllRequests.jsx', 'SelectRole.jsx', 'GigCreator.jsx', 'CorrectRecordModal.jsx', 'SuperUserPanel.jsx', 'Profile.jsx']) {
      expect(files.has(file), `${file} should have messages`).toBe(true);
    }
  });

  it('are each brought into view and focused when they appear', () => {
    const missing = messages.filter(m => !/ref=\{\w+\}/.test(m.tag) || !/tabIndex=\{-1\}/.test(m.tag));
    expect(missing.map(m => `${m.file}: ${m.tag.trim()}`)).toEqual([]);
  });
});
