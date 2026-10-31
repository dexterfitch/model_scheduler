import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

// What the browser itself shows on the tab, which can differ from document.title
const tabTitle = async (context, page) => {
  const cdp = await context.newCDPSession(page);
  return (await cdp.send('Target.getTargetInfo')).targetInfo.title;
};

test("after signing out, Back doesn't show the last page's name on the tab", async ({ page, context }) => {
  await loginAs(page, 'preyes@mica.edu');
  await page.getByRole('link', { name: 'Requests' }).filter({ visible: true }).first().click();
  await expect(page).toHaveTitle('Requests · MICA Pose Pool');

  await page.getByRole('button', { name: 'Logout' }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/login/);

  await page.goBack();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('link', { name: /Sign in with MICA Google Account/ })).toBeVisible();
  await expect.poll(() => tabTitle(context, page)).toBe('Sign In · MICA Pose Pool');
});
