/**
 * Screenshots of every page for each role at desktop and phone sizes, for reviewing
 * the design. Only runs with SCREENSHOTS=1.
 */

import { test } from '@playwright/test';
import { loginAs } from './helpers';

test.skip(!process.env.SCREENSHOTS, 'Run with SCREENSHOTS=1 to capture the review gallery');

const sizes = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone:   { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

for (const [size, options] of Object.entries(sizes)) {
  test.describe(size, () => {
    test.use(options);

    /** Waits for the page to settle and saves a full-page screenshot. */
    async function shot(page, name) {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `screenshots/${size}/${name}.png`, fullPage: true });
    }
    /** The first visible button containing this text. */
    const visibleButton = (page, text) => page.locator('button:visible', { hasText: text }).first();

    test('logged out', async ({ page }) => {
      await page.goto('/login');
      await shot(page, '01-login');
    });

    test('faculty', async ({ page }) => {
      await loginAs(page, 'achen@mica.edu');
      await shot(page, '10-faculty-my-classes');
      await visibleButton(page, 'New Request').click();
      await page.locator('select[name="model_mode"]').selectOption('nude');
      await shot(page, '11-faculty-new-request-form');
    });

    test('admin', async ({ page }) => {
      await loginAs(page, 'preyes@mica.edu');
      await shot(page, '20-admin-dashboard');
      for (const [path, name] of [
        ['/requests', '21-admin-requests'],
        ['/gigs', '22-admin-gigs'],
        ['/calendar', '23-admin-calendar'],
        ['/directory', '24-admin-directory'],
        ['/reports', '25-admin-reports'],
      ]) {
        await page.goto(path);
        await shot(page, name);
      }
      await page.goto('/requests');
      await visibleButton(page, 'Find Model').click();
      await shot(page, '26-admin-matching-screen');
      await page.goto('/directory');
      await page.locator('a:visible', { hasText: 'View Availability' }).first().click();
      await shot(page, '27-admin-model-detail');
    });

    test('superuser', async ({ page }) => {
      await loginAs(page, 'dfitch@mica.edu');
      await page.goto('/superuser');
      await shot(page, '30-superuser-panel');
    });

    test('model', async ({ page }) => {
      await loginAs(page, 'jellis@mica.edu');
      await shot(page, '40-model-my-gigs');
      await page.getByRole('tab', { name: 'Manage Availability' }).click();
      await shot(page, '41-model-availability');
      await page.goto('/profile');
      await shot(page, '42-model-profile');
    });
  });
}
