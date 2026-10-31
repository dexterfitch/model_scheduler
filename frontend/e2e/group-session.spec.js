/**
 * End-to-end: an admin books the last model a group session needs.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test('admin fills the last spot in a group session', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  await loginAs(page, 'preyes@mica.edu');

  await page.getByRole('link', { name: 'Requests', exact: true }).click();
  const row = page.getByRole('row', { name: /Group Pose Lab/ });
  await expect(row).toContainText('1/2 models');
  await expect(row).toContainText('Devon Price');
  await row.getByRole('button', { name: 'Find More Models' }).click();

  await expect(page.getByText(/1\/2 booked: Devon Price/)).toBeVisible();
  const sam = page.locator('.list-group-item').filter({ hasText: 'Sam Woods' });
  await sam.getByRole('button', { name: 'Book Model' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm Booking' }).click();
  await expect(page.getByText(/Gig confirmed/)).toBeVisible();

  await page.getByRole('link', { name: 'Requests', exact: true }).click();
  const doneRow = page.getByRole('row', { name: /Group Pose Lab/ });
  await expect(doneRow).toContainText('2/2 models');
  await expect(doneRow).toContainText('Sam Woods');
});
