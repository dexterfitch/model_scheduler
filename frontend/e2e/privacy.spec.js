import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

// Models booked on Alice Chen's seeded classes
const bookedModels = [
  { name: 'Sofia Marsh',  email: 'smarsh@mica.edu' },  // Illustration Portfolio
  { name: 'Jordan Ellis', email: 'jellis@mica.edu' },  // Illustration Basics and Advanced
];

test("faculty never see booked models' personal details", async ({ page }) => {
  // Capture exactly what the backend sends to the faculty member's browser
  const seriesResponse = page.waitForResponse(r => r.url().endsWith('/request_series'));
  await loginAs(page, 'achen@mica.edu');
  const body = await (await seriesResponse).text();

  // Sanity check: the classes really are booked, so there's something to hide
  const card = page.locator('.card').filter({ hasText: 'Illustration Portfolio' }).first();
  await expect(card).toContainText('Confirmed');

  for (const model of bookedModels) {
    // Not on the screen...
    await expect(page.getByText(model.name)).toHaveCount(0);
    await expect(page.getByText(model.email)).toHaveCount(0);
    // ...and not hidden anywhere in the data the browser received
    expect(body).not.toContain(model.email);
    expect(body).not.toContain(model.name.split(' ')[1]);
  }
});