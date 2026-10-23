import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAs } from './helpers';

// Checks every page against WCAG 2.1 AA, the usual accessibility standard
const sizes = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone:   { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};

const pages = [
  { name: 'login',              as: null,               path: '/login' },
  { name: 'faculty classes',    as: 'achen@mica.edu',   path: '/' },
  { name: 'admin dashboard',    as: 'preyes@mica.edu',  path: '/' },
  { name: 'admin requests',     as: 'preyes@mica.edu',  path: '/requests' },
  { name: 'admin gigs',         as: 'preyes@mica.edu',  path: '/gigs' },
  { name: 'admin calendar',     as: 'preyes@mica.edu',  path: '/calendar' },
  { name: 'admin directory',    as: 'preyes@mica.edu',  path: '/directory' },
  { name: 'admin reports',      as: 'preyes@mica.edu',  path: '/reports' },
  { name: 'superuser panel',    as: 'dfitch@mica.edu',  path: '/superuser' },
  { name: 'model gigs',         as: 'jellis@mica.edu',  path: '/' },
  { name: 'model profile',      as: 'jellis@mica.edu',  path: '/profile' },
  { name: 'select role',        as: 'nnewcomer@mica.edu', path: '/select-role' },
  { name: 'model setup form',   as: 'nnewcomer@mica.edu', path: '/select-role',
    open: (page) => page.getByRole('button', { name: /I am a Model/ }).click() },
  { name: 'new request window', as: 'achen@mica.edu',     path: '/',
    open: (page) => openDialog(page, /New Request/) },
  { name: 'admin edit class window',    as: 'preyes@mica.edu',    path: '/requests',
    open: (page) => openDialog(page, 'Edit Class') },
  { name: 'edit date window',   as: 'achen@mica.edu',     path: '/',
    open: (page) => openDialog(page, 'Edit Date') },
  { name: 'edit class window',  as: 'achen@mica.edu',     path: '/',
    open: (page) => openDialog(page, 'Edit Class') },
];

// Clicks the first visible button with this name and waits for its pop-up to finish opening
async function openDialog(page, name) {
  await page.getByRole('button', { name }).filter({ visible: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(400); // let the fade-in finish so colours are final
}

// Turn axe's findings into a short, readable list for the failure message
const summarize = (violations) => violations.map(v =>
  `• ${v.id} (${v.impact}, ${v.nodes.length}×): ${v.help}\n    e.g. ${v.nodes[0].target.join(' ')}`
).join('\n');

for (const [size, options] of Object.entries(sizes)) {
  test.describe(`accessibility (${size})`, () => {
    test.use(options);

    for (const p of pages) {
      test(p.name, async ({ page }) => {
        if (p.as) await loginAs(page, p.as);
        await page.goto(p.path);
        await page.waitForLoadState('networkidle');
        if (p.open) await p.open(page);

        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        expect(violations, summarize(violations)).toEqual([]);
      });
    }
  });
}