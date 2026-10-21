import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

const dayFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};

test('the billing report pays for a same-day late cancellation', async ({ page }) => {
  await loginAs(page, 'preyes@mica.edu');
  const gigsLoaded = page.waitForResponse(r => r.url().endsWith('/gigs'));
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await gigsLoaded;

  // The seeds include one late cancellation, today: Sam Woods, 2 hours (Scenario H)
  const dates = page.locator('input[type="date"]');
  await dates.nth(0).fill(dayFromNow(0));
  await dates.nth(1).fill(dayFromNow(1));
  // Regenerate until the page's gig data has arrived
  await expect(async () => {
    await page.getByRole('button', { name: 'Generate Report' }).click();
    await expect(page.getByText('Sam Woods').first()).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await expect(page.getByText(/Late Cancel — Billable/)).toHaveCount(1);
  await expect(page.getByText('Payable Total: 2 hrs')).toBeVisible();
});