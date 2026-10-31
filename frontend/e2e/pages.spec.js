/**
 * End-to-end: every admin page opens without a script error.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

/** Collects the page's script errors, to check there were none. */
function watchForCrashes(page) {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

test('every admin page loads without errors', async ({ page }) => {
  const errors = watchForCrashes(page);
  await loginAs(page, 'dfitch@mica.edu');

  const pages = [
    ['Dashboard',       'Admin Dashboard'],
    ['Requests',        'Faculty Requests'],
    ['Gigs',            'Gig Registry'],
    ['Calendar',        'Full Schedule'],
    ['Directory',       'User Directory'],
    ['Reports',         'Reports'],
    ['SuperUser Panel', 'SuperUser Controls'],
  ];
  for (const [link, heading] of pages) {
    await page.getByRole('link', { name: link, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }

  await page.getByRole('link', { name: 'Directory', exact: true }).click();
  await page.getByRole('row', { name: /Jordan Ellis/ }).getByRole('link', { name: 'View Availability' }).click();
  await expect(page.getByRole('heading', { name: 'Jordan Ellis', level: 2 })).toBeVisible();

  expect(errors).toEqual([]);
});

test("a model's profile page loads without errors", async ({ page }) => {
  const errors = watchForCrashes(page);
  await loginAs(page, 'smarsh@mica.edu');
  await page.getByRole('button', { name: 'My Profile' }).click();
  await expect(page.getByRole('heading', { name: /My Profile/ })).toBeVisible();
  expect(errors).toEqual([]);
});
