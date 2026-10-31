import { setPageTitle } from './pageTitle';

// Records every title the page sets, the way the browser hears about them
const recordTitles = () => {
  const real = Object.getOwnPropertyDescriptor(Document.prototype, 'title');
  const seen = [];
  Object.defineProperty(document, 'title', {
    configurable: true,
    get: () => real.get.call(document),
    set: (value) => { seen.push(value); real.set.call(document, value); },
  });
  return { seen, restore: () => delete document.title };
};

describe('setPageTitle', () => {
  it('sets the title', () => {
    setPageTitle('Requests · MICA Pose Pool');
    expect(document.title).toBe('Requests · MICA Pose Pool');
  });

  it("really changes the title even when it's already the same, so the tab never keeps an old page name after Back", () => {
    document.title = 'Sign In · MICA Pose Pool';
    const { seen, restore } = recordTitles();
    setPageTitle('Sign In · MICA Pose Pool');
    restore();

    expect(seen).toHaveLength(2);
    // Something the browser can't treat as the same title (a space would be ignored)
    expect(seen[0].trim()).not.toBe('Sign In · MICA Pose Pool');
    expect(seen[0].trim()).not.toBe('');
    expect(seen[1]).toBe('Sign In · MICA Pose Pool');
  });
});
