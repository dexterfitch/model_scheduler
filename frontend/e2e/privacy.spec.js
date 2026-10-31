/**
 * End-to-end: faculty never see a booked model's personal details.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

const bookedModels = [
  { name: 'Sofia Marsh',  email: 'smarsh@mica.edu' },
  { name: 'Jordan Ellis', email: 'jellis@mica.edu' },
];

test("faculty never see booked models' personal details", async ({ page }) => {
  const seriesResponse = page.waitForResponse(r => r.url().endsWith('/request_series'));
  await loginAs(page, 'achen@mica.edu');
  const body = await (await seriesResponse).text();

  const card = page.locator('.card').filter({ hasText: 'Illustration Portfolio' }).first();
  await expect(card).toContainText('Confirmed');

  for (const model of bookedModels) {
    await expect(page.getByText(model.name)).toHaveCount(0);
    await expect(page.getByText(model.email)).toHaveCount(0);
    expect(body).not.toContain(model.email);
    expect(body).not.toContain(model.name.split(' ')[1]);
  }
});
