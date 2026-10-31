import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

// Layout checks that only matter once columns stack on a phone screen
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const forms = [
  { name: 'profile',          as: 'jellis@mica.edu',    path: '/profile' },
  { name: 'model setup form', as: 'nnewcomer@mica.edu', path: '/select-role',
    open: (page) => page.getByRole('button', { name: /I am a Model/ }).click() },
  { name: 'superuser panel',  as: 'dfitch@mica.edu',    path: '/superuser' },
];

test.describe('stacked form fields have space between them (phone)', () => {
  for (const f of forms) {
    test(f.name, async ({ page }) => {
      await loginAs(page, f.as);
      await page.goto(f.path);
      await page.waitForLoadState('networkidle');
      if (f.open) await f.open(page);

      const crowded = await page.evaluate(() => {
        const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const fields = [...document.querySelectorAll(
          'input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea'
        )].filter(visible);

        const problems = [];
        for (const label of document.querySelectorAll('label.form-label')) {
          if (!visible(label)) continue;
          // The last field that comes before this label on the page
          const above = fields.filter(f => f.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).pop();
          if (!above) continue;
          const gap = label.getBoundingClientRect().top - above.getBoundingClientRect().bottom;
          if (gap >= 0 && gap < 8) {
            problems.push(`"${label.textContent.trim()}" is only ${Math.round(gap)}px below the field above it`);
          }
        }
        return problems;
      });

      expect(crowded, crowded.join('\n')).toEqual([]);
    });
  }
});

test('model detail badges line up on the left (phone)', async ({ page }) => {
  await loginAs(page, 'preyes@mica.edu');
  await page.goto('/directory');
  await page.locator('a[href^="/models/"]').filter({ visible: true }).first().click();

  const header = page.locator('.card-body').filter({ has: page.locator('.badge') }).first();
  const name = header.locator('h2');
  const firstBadge = header.locator('.badge').first();
  await expect(firstBadge).toBeVisible();

  const nameLeft = (await name.boundingBox()).x;
  const badgeLeft = (await firstBadge.boundingBox()).x;
  expect(Math.abs(badgeLeft - nameLeft), 'badges should start under the name, not on the right').toBeLessThan(2);
});

// Returns how far down the page an element starts
const topOf = async (locator) => (await locator.boundingBox()).y;

test('admin calendar shows the schedule before the availability list (phone)', async ({ page }) => {
  await loginAs(page, 'preyes@mica.edu');
  await page.goto('/calendar');
  const schedule = page.getByRole('heading', { name: 'Full Schedule' });
  const availability = page.getByRole('heading', { name: 'Upcoming Model Availability' });
  await expect(schedule).toBeVisible();

  expect(await topOf(schedule), 'the schedule should come first').toBeLessThan(await topOf(availability));
});

test("model's availability calendar comes before Open Calls (phone)", async ({ page }) => {
  await loginAs(page, 'jellis@mica.edu');
  await page.goto('/');
  await page.getByRole('tab', { name: 'Manage Availability' }).click();
  const calendar = page.locator('.fc').filter({ visible: true }).first();
  const openCalls = page.getByRole('heading', { name: 'Open Calls' });
  await expect(calendar).toBeVisible();

  expect(await topOf(calendar), 'the calendar should come first').toBeLessThan(await topOf(openCalls));
});

test('admin calendar opens on a list of upcoming items (phone)', async ({ page }) => {
  await loginAs(page, 'preyes@mica.edu');
  await page.goto('/calendar');
  await expect(page.locator('.fc-list').first(), 'phones should see a list, not a single day').toBeVisible();
});

test('a model can add availability without tapping the calendar grid (phone)', async ({ page }) => {
  await loginAs(page, 'jellis@mica.edu');
  await page.goto('/');
  await page.getByRole('tab', { name: 'Manage Availability' }).click();
  await page.getByRole('button', { name: 'Add Availability' }).click();
  const window = page.getByRole('dialog', { name: 'Set Availability' });
  await expect(window).toBeVisible();

  // Any day can be chosen in the window itself, so no calendar tapping is needed
  const nextWeek = new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA');
  await window.getByLabel('Date', { exact: true }).fill(nextWeek);
  await window.getByLabel('Start Time').fill('19:00');
  await window.getByLabel('End Time').fill('21:00');
  await window.getByRole('button', { name: 'Add Availability' }).click();
  await expect(window).toBeHidden();
});

test('the longest New Request form scrolls all the way to Submit (phone)', async ({ page }) => {
  await loginAs(page, 'achen@mica.edu');
  await page.goto('/');
  await page.getByRole('button', { name: /New Request/ }).filter({ visible: true }).first().click();
  const form = page.getByRole('dialog');
  await expect(form).toBeVisible();

  // Make the form as long as it gets: three dates, nude, and three models with their own preferences
  await form.getByRole('button', { name: /Add Another Date/ }).click();
  await form.getByRole('button', { name: /Add Another Date/ }).click();
  await form.getByLabel('Nudity').selectOption('nude');
  await form.getByLabel('Number of Models').selectOption('3');
  await expect(form.getByRole('group', { name: 'Model 3' })).toBeVisible();

  const submit = form.getByRole('button', { name: 'Submit Request' });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
  await submit.click({ trial: true }); // fails if anything covers the button
});

test('Requests cards keep one main button and tuck the rest into More (phone)', async ({ page }) => {
  await loginAs(page, 'preyes@mica.edu');
  await page.goto('/requests');
  await expect(page.getByRole('button', { name: /^More actions for/ }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel Class' }).filter({ visible: true })).toHaveCount(0);
});

for (const [pageName, path] of [['Requests', '/requests'], ['Gigs', '/gigs']]) {
  test(`${pageName} puts the date filters below the status filters, with a line between (phone)`, async ({ page }) => {
    await loginAs(page, 'preyes@mica.edu');
    await page.goto(path);
    const status = page.getByRole('group', { name: 'Status' });
    const dates = page.getByRole('group', { name: 'Dates' });
    await expect(dates).toBeVisible();

    const statusBox = await status.boundingBox();
    const datesBox = await dates.boundingBox();
    expect(datesBox.y, 'the date filters should come after the status filters').toBeGreaterThanOrEqual(statusBox.y + statusBox.height);
    const line = await dates.evaluate(el => getComputedStyle(el).borderTopWidth);
    expect(line, 'a line should divide the two groups').not.toBe('0px');
  });
}

test('Requests tags are compact and stay inside their card (phone)', async ({ page }) => {
  await loginAs(page, 'preyes@mica.edu');
  await page.goto('/requests');
  const card = page.locator('.card').filter({ visible: true }).filter({ has: page.locator('.badge') }).first();
  await expect(card).toBeVisible();

  const problems = await page.evaluate(() => {
    const out = [];
    for (const badge of document.querySelectorAll('.card .badge')) {
      const box = badge.getBoundingClientRect();
      if (!box.width) continue;
      const card = badge.closest('.card').getBoundingClientRect();
      const style = getComputedStyle(badge);
      const name = badge.textContent.trim();
      if (parseFloat(style.paddingTop) > 8) out.push(`"${name}" has ${style.paddingTop} of padding above its text`);
      if (box.right > card.right + 1) out.push(`"${name}" runs past the edge of its card`);
    }
    return out;
  });
  expect(problems, problems.join('\n')).toEqual([]);
});

test.describe('desktop calendar', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  for (const [pageName, path] of [['Requests', '/requests'], ['Gigs', '/gigs']]) {
    test(`${pageName} puts the date filters on the right, on the same row as the status filters`, async ({ page }) => {
      await loginAs(page, 'preyes@mica.edu');
      await page.goto(path);
      const statusBox = await page.getByRole('group', { name: 'Status' }).boundingBox();
      const datesBox = await page.getByRole('group', { name: 'Dates' }).boundingBox();
      const barBox = await page.locator('.date-filter-box').boundingBox();

      expect(datesBox.x, 'the date filters should sit to the right of the status filters').toBeGreaterThan(statusBox.x + statusBox.width);
      expect(Math.abs((datesBox.x + datesBox.width) - (barBox.x + barBox.width)), 'the date filters should line up with the right edge').toBeLessThan(4);
      expect(Math.abs(datesBox.y - statusBox.y), 'both groups should share a row').toBeLessThan(4);
    });
  }

  test('still opens on the week grid', async ({ page }) => {
    await loginAs(page, 'preyes@mica.edu');
    await page.goto('/calendar');
    await expect(page.locator('.fc-timeGridWeek-view')).toBeVisible();
  });
});
