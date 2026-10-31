/**
 * Setting the browser tab's title.
 */

/**
 * Sets the tab title. After Back or Forward, Chrome can keep showing the title it saved with that
 * history entry, and only updates the tab when the title really changes; so the title is first set
 * to an invisible character, then to the real one. (A plain space doesn't work: Chrome ignores it.)
 */
export const setPageTitle = (title) => {
  document.title = '​';
  document.title = title;
};
