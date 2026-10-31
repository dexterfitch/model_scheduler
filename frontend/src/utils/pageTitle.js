// Sets the tab title. After Back or Forward, Chrome can keep showing the title it
// saved with that history entry (for example "Dashboard" after signing out), and
// it only updates the tab when the title really changes. So the title is first
// set to an invisible character, then to the real title, which makes the tab
// always show the page you're on. (A plain space doesn't work: Chrome ignores it.)
export const setPageTitle = (title) => {
  document.title = '​';
  document.title = title;
};
