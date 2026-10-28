import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test('a model drops out and the admin sees the class flagged', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());

  // Jordan Ellis cancels their seeded "Drawing I" gig
  await loginAs(page, 'jellis@mica.edu');
  const gigCard = page.locator('.card')
    .filter({ has: page.getByText('Drawing I', { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Cancel' }) });
  await gigCard.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Cancel (Gig|This Date)$/ }).click();
  await expect(page.getByText('Gig participation cancelled.')).toBeVisible();

  // The admin dashboard now lists that class with a warning
  await loginAs(page, 'preyes@mica.edu');
  // The card closest around the class name, however the cards are styled
  const requestCard = page.getByText('Drawing I', { exact: true })
    .locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " card ")][1]');
  await expect(requestCard).toContainText('Needs Attention: Model Dropped Out');
});