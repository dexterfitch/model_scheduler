/**
 * End-to-end: faculty make a nude request, and the seeded requests show their full preferences.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

/** The date ten days from today, as a date field expects it. */
const tenDaysOut = () => {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  return d.toLocaleDateString('en-CA');
};

test('faculty create a nude request and the gender label updates as they choose', async ({ page }) => {
  await loginAs(page, 'achen@mica.edu');
  await page.getByRole('button', { name: /New Request/ }).click();
  const form = page.getByRole('dialog');

  await form.locator('input[name="class_name"]').fill('Life Drawing Lab');
  await form.locator('select[name="department"]').selectOption('Drawing');
  await form.locator('select[name="building"]').selectOption('Main');

  await form.locator('select[name="model_mode"]').selectOption('nude');
  await form.locator('select[name="pref_genitalia"]').selectOption('Male');
  await form.locator('select[name="pref_gender"]').selectOption({ label: 'Woman (Trans)' });

  await form.locator('input[type="date"]').fill(tenDaysOut());
  const times = form.locator('input[type="time"]');
  await times.nth(0).fill('10:00');
  await times.nth(1).fill('12:00');
  await form.getByRole('button', { name: 'Submit Request' }).click();

  await expect(page.getByText('Request submitted successfully!')).toBeVisible();
  const card = page.locator('.card').filter({ hasText: 'Life Drawing Lab' });
  await expect(card).toContainText('Gender: Woman (Trans)');
  await expect(card).toContainText('Male Genitalia');
});

test('the seeded trans woman request shows its full preferences', async ({ page }) => {
  await loginAs(page, 'achen@mica.edu');
  const card = page.locator('.card').filter({ hasText: 'Advanced Figure Painting' });
  await expect(card).toContainText('Gender: Woman (Trans)');
  await expect(card).toContainText('Fat Build');
});
