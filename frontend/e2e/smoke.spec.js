/**
 * End-to-end: faculty and models each land on their own first page after signing in.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test('faculty land on their classes', async ({ page }) => {
  await loginAs(page, 'pnair@mica.edu');
  await expect(page.getByRole('link', { name: 'My Classes' })).toBeVisible();
  await expect(page.getByRole('button', { name: /New Request/ })).toBeVisible();
});

test('models land on their schedule', async ({ page }) => {
  await loginAs(page, 'jellis@mica.edu');
  await expect(page.getByRole('link', { name: 'My Schedule' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /My Gigs/ })).toBeVisible();
});
