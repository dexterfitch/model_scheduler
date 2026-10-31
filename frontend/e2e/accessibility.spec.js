/**
 * Accessibility checks with axe on every page and the main windows, at desktop and
 * phone sizes, plus a check that buttons and links on phones are big enough to tap.
 * Needs the API running with the seed data.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAs } from './helpers';

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

/**
 * Opens a window by its button, looking in the phone More menu when the button is tucked away
 * there.
 */
async function openDialog(page, name) {
  /** The first visible button with this name. */
  const button = () => page.getByRole('button', { name }).filter({ visible: true }).first();
  if (await button().count() === 0) {
    await page.getByRole('button', { name: /^More actions for/ }).filter({ visible: true }).first().click();
  }
  await button().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(400);
}

/** axe's findings as a readable list for the failure message. */
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

test.describe('tap targets (phone)', () => {
  test.use(sizes.phone);

  for (const p of pages) {
    test(p.name, async ({ page }) => {
      if (p.as) await loginAs(page, p.as);
      await page.goto(p.path);
      await page.waitForLoadState('networkidle');
      if (p.open) await p.open(page);

      const tooSmall = await page.evaluate(() =>
        [...document.querySelectorAll('button, a.btn, select, input:not([type=hidden]):not([type=checkbox]):not([type=radio])')]
          .filter(el => {
            const box = el.getBoundingClientRect();
            return box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden' && box.height < 43.5;
          })
          .map(el => {
            const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || '').trim().slice(0, 40);
            return `${el.tagName.toLowerCase()} "${name}" is ${Math.round(el.getBoundingClientRect().height)}px tall`;
          })
      );

      expect(tooSmall, tooSmall.join('\n')).toEqual([]);
    });
  }
});
