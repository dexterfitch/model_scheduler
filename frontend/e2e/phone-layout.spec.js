import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

// Layout checks that only matter once columns stack on a phone screen
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const forms = [
  { name: 'profile',          as: 'jellis@mica.edu',    path: '/profile' },
  { name: 'model setup form', as: 'nnewcomer@mica.edu', path: '/select-role',
    open: (page) => page.getByRole('button', { name: /I am a Model/ }).click() },
  { name: 'superuser panel',  as: 'dfitch@mica.edu',    path: '/superuser' },
];

test.describe('stacked form fields have space between them (phone)', () => {
  for (const f of forms) {
    test(f.name, async ({ page }) => {
      await loginAs(page, f.as);
      await page.goto(f.path);
      await page.waitForLoadState('networkidle');
      if (f.open) await f.open(page);

      const crowded = await page.evaluate(() => {
        const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const fields = [...document.querySelectorAll(
          'input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea'
        )].filter(visible);

        const problems = [];
        for (const label of document.querySelectorAll('label.form-label')) {
          if (!visible(label)) continue;
          // The last field that comes before this label on the page
          const above = fields.filter(f => f.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).pop();
          if (!above) continue;
          const gap = label.getBoundingClientRect().top - above.getBoundingClientRect().bottom;
          if (gap >= 0 && gap < 8) {
            problems.push(`"${label.textContent.trim()}" is only ${Math.round(gap)}px below the field above it`);
          }
        }
        return problems;
      });

      expect(crowded, crowded.join('\n')).toEqual([]);
    });
  }
});

test('model detail badges line up on the left (phone)', async ({ page }) => {
  await loginAs(page, 'preyes@mica.edu');
  await page.goto('/directory');
  await page.locator('a[href^="/models/"]').filter({ visible: true }).first().click();

  const header = page.locator('.card-body').filter({ has: page.locator('.badge') }).first();
  const name = header.locator('h2');
  const firstBadge = header.locator('.badge').first();
  await expect(firstBadge).toBeVisible();

  const nameLeft = (await name.boundingBox()).x;
  const badgeLeft = (await firstBadge.boundingBox()).x;
  expect(Math.abs(badgeLeft - nameLeft), 'badges should start under the name, not on the right').toBeLessThan(2);
});