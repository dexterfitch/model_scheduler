import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { loginAs } from './helpers';

// Screenshots of every step faculty and models take, for the user guide.
// Only runs when asked for:   GUIDE=1 npx playwright test e2e/user-guide.spec.js
// Pictures land in frontend/user-guide/<desktop|phone>/<faculty|model>/, and
// frontend/user-guide/index.html shows them all in order with their captions.
test.skip(!process.env.GUIDE, 'Run with GUIDE=1 to capture the user guide screenshots');

const OUT = 'user-guide';
const sizes = {
  desktop: { viewport: { width: 1280, height: 800 } },
  phone:   { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const shots = [];   // { size, role, file, caption } for the index page

// Takes one picture. `target` gets a pink outline, to show what to click or fill in.
// Pop-up windows are cropped to just the window.
async function snap(page, { size, role, name, caption, target, dialog = false }) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400); // let windows finish opening and calendars finish drawing
  const n = String(shots.filter(s => s.size === size && s.role === role).length + 1).padStart(2, '0');
  const file = `${size}/${role}/${n}-${name}.png`;

  if (target) {
    await target.scrollIntoViewIfNeeded();
    await target.evaluate(el => { el.dataset.guideOutline = el.style.outline; el.style.outline = '4px solid #e10098'; el.style.outlineOffset = '3px'; });
  }
  const shotOf = dialog ? page.getByRole('dialog') : page;
  await shotOf.screenshot({ path: path.join(OUT, file), ...(dialog ? {} : { fullPage: true }) });
  if (target) await target.evaluate(el => { el.style.outline = el.dataset.guideOutline; el.style.outlineOffset = ''; });

  shots.push({ size, role, file, caption });
}

const visible = (locator) => locator.filter({ visible: true }).first();

for (const [size, options] of Object.entries(sizes)) {
  test.describe(size, () => {
    test.use(options);

    test('faculty', async ({ page }) => {
      const shot = (name, caption, extra = {}) => snap(page, { size, role: 'faculty', name, caption, ...extra });

      await page.goto('/login');
      await shot('sign-in', 'Sign in with your MICA Google account.');

      await loginAs(page, 'achen@mica.edu');
      const newRequest = visible(page.getByRole('button', { name: /New Request/ }));
      await shot('my-classes', 'My Classes lists every class you have asked for, with its dates and who is booked.', { target: newRequest });

      // A new request, step by step
      await newRequest.click();
      const form = page.getByRole('dialog');
      await expect(form).toBeVisible();
      await shot('new-request-empty', 'Choose New Request to open the request form.', { dialog: true });

      await form.getByLabel('Class Name').fill('Life Drawing Lab');
      await form.getByLabel('Department').selectOption('Drawing');
      await form.getByLabel('Building').selectOption({ index: 1 });
      await form.getByLabel('Room Number').fill('413');
      await shot('new-request-class-details', 'Fill in the class name, department, building and room.', { dialog: true, target: form.getByLabel('Class Name') });

      const date1 = form.getByRole('group', { name: 'Date 1' });
      const inTwoWeeks = new Date(Date.now() + 14 * 86400000).toLocaleDateString('en-CA');
      await date1.getByLabel('Date', { exact: true }).fill(inTwoWeeks);
      await date1.getByLabel('Start Time').fill('10:00');
      await date1.getByLabel('End Time').fill('12:00');
      const addDate = form.getByRole('button', { name: /Add Another Date/ });
      await shot('new-request-dates', 'Pick the date and times. Use Add Another Date for a class that meets more than once.', { dialog: true, target: addDate });

      await form.getByLabel('Number of Models').selectOption('2');
      await expect(form.getByRole('group', { name: 'Model 2' })).toBeVisible();
      await form.getByRole('group', { name: 'Model 2' }).getByText('Muscular', { exact: true }).click();
      await shot('new-request-preferences', 'Set model preferences: one set for each model, or switch on Same for every model. Any means no preference.', { dialog: true, target: form.getByLabel('Number of Models') });

      const submit = form.getByRole('button', { name: 'Submit Request' });
      await shot('new-request-submit', 'Add any notes for the coordinator, then choose Submit Request.', { dialog: true, target: submit });
      await submit.click();
      await expect(page.getByText('Request submitted successfully!')).toBeVisible();
      await shot('new-request-sent', 'Your new class appears on My Classes, waiting for a model.');

      // Changing a class
      const editDate = visible(page.getByRole('button', { name: 'Edit Date' }));
      await shot('edit-date-button', 'Edit Date changes the day or times of one date.', { target: editDate });
      await editDate.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot('edit-date-window', 'Change the day or times, then choose Save Changes.', { dialog: true });
      await page.getByRole('dialog').getByRole('button', { name: 'Close' }).first().click();
      await expect(page.getByRole('dialog')).toBeHidden();

      const editClass = visible(page.getByRole('button', { name: 'Edit Class' }));
      await shot('edit-class-button', 'Edit Class changes the details for every date of a class, until a model is booked.', { target: editClass });
      await editClass.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot('edit-class-window', 'Change the class details or model preferences for every date at once.', { dialog: true });
      await page.getByRole('dialog').getByRole('button', { name: 'Close' }).first().click();
      await expect(page.getByRole('dialog')).toBeHidden();

      // Cancelling (we go back without cancelling anything)
      const cancelDate = visible(page.getByRole('button', { name: /Cancel Date/ }));
      await shot('cancel-date-button', 'Cancel Date cancels one date. The rest of the class stays booked.', { target: cancelDate });
      await cancelDate.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot('cancel-date-confirm', "You'll be asked to confirm. Keep Date goes back without cancelling.", { dialog: true });
      await page.getByRole('dialog').getByRole('button', { name: 'Keep Date' }).click();

      const cancelClass = visible(page.getByRole('button', { name: /Cancel Class/ }));
      await shot('cancel-class-button', 'Cancel Class cancels every date of the class.', { target: cancelClass });
      await cancelClass.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot('cancel-class-confirm', "You'll be asked to confirm. Keep Class goes back without cancelling.", { dialog: true });
      await page.getByRole('dialog').getByRole('button', { name: 'Keep Class' }).click();
    });

    test('model', async ({ page }) => {
      const shot = (name, caption, extra = {}) => snap(page, { size, role: 'model', name, caption, ...extra });

      await loginAs(page, 'jellis@mica.edu');
      await shot('my-gigs', 'My Gigs shows your upcoming gigs, with the class, faculty member, time and room.');

      for (const [filter, caption] of [
        ['Completed', 'Completed shows gigs you have already worked.'],
        ['Cancelled', 'Cancelled shows gigs that were cancelled, and whether they are still paid.'],
      ]) {
        const button = page.getByRole('button', { name: filter, exact: true });
        await button.click();
        await shot(`my-gigs-${filter.toLowerCase()}`, caption, { target: button });
      }
      await page.getByRole('button', { name: 'Confirmed', exact: true }).click();

      const cancel = visible(page.getByRole('button', { name: 'Cancel', exact: true }));
      await shot('cancel-gig-button', 'To drop out of a gig, choose Cancel on its card.', { target: cancel });
      await cancel.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot('cancel-gig-confirm', "You'll be asked to confirm. Keep Gig goes back without cancelling.", { dialog: true });
      await page.getByRole('dialog').getByRole('button', { name: 'Keep Gig' }).click();

      // Availability
      const tab = page.getByRole('tab', { name: 'Manage Availability' });
      await tab.click();
      await shot('availability', 'Manage Availability shows the times you are free, your booked gigs, and open calls you can sign up for.', { target: tab });

      const add = page.getByRole('button', { name: 'Add Availability' });
      await shot('add-availability-button', 'Choose Add Availability to tell the coordinator when you are free. On a computer you can also click a day on the calendar.', { target: add });
      await add.click();
      const window = page.getByRole('dialog');
      await expect(window).toBeVisible();
      // Next week, in the evening, so this doesn't overlap the seeded daytime availability
      const nextWeek = new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA');
      await window.getByLabel('Date', { exact: true }).fill(nextWeek);
      await window.getByLabel('Start Time').fill('19:00');
      await window.getByLabel('End Time').fill('21:00');
      await shot('add-availability-window', 'Choose the day, the start time and the end time, then Add Availability.', { dialog: true });
      await window.getByRole('button', { name: 'Add Availability' }).click();
      await expect(window).toBeHidden();
      await shot('availability-added', 'Your new time appears on the calendar.');

      const signUp = page.getByRole('button', { name: "I'm Available" }).first();
      if (await signUp.count()) {
        await shot('open-call', "Open Calls are classes still looking for a model. I'm Available adds your availability for all of its dates.", { target: signUp });
      }

      // Profile
      await page.goto('/profile');
      await shot('profile', 'Your profile: the details used to match you with classes.');
      const why = page.getByRole('button', { name: 'Why are we asking?' });
      await why.click();
      await shot('profile-why', 'Why are we asking? explains what your answers are for and who can see them.', { target: why });
      const bodyType = page.getByRole('radiogroup', { name: 'Body Type' });
      await shot('profile-body-type', 'Every personal question can be skipped with Prefer not to say.', { target: bodyType });
    });

    test('first sign-in', async ({ page }) => {
      const shot = (name, caption, extra = {}) => snap(page, { size, role: 'model', name, caption, ...extra });

      await loginAs(page, 'nnewcomer@mica.edu');
      await page.goto('/select-role');
      const model = page.getByRole('button', { name: /I am a Model/ });
      await shot('first-sign-in', 'The first time you sign in, choose whether you are faculty or a model.', { target: model });
      await model.click();
      await shot('first-sign-in-model-form', 'New models fill in a few details. Only Gender and Skin Tone are required, and both can be Prefer not to say.');
      // Nothing is submitted, so the same newcomer can be used for the phone pictures
    });
  });
}

// One page that shows every picture in order, desktop and phone side by side
test.afterAll(() => {
  if (!shots.length) return;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const section = (role) => {
    const desktop = shots.filter(s => s.role === role && s.size === 'desktop');
    return desktop.map((d, i) => {
      const phone = shots.find(s => s.role === role && s.size === 'phone' && s.file.endsWith(d.file.split('/').pop()));
      return `<figure><figcaption><b>${role} ${i + 1}.</b> ${esc(d.caption)}</figcaption>
        <div class="pair"><img src="${d.file}" alt="${esc(d.caption)} (desktop)">${phone ? `<img class="phone" src="${phone.file}" alt="${esc(d.caption)} (phone)">` : ''}</div></figure>`;
    }).join('\n');
  };
  fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Pose Pool User Guide Screenshots</title>
<style>body{font-family:Arial,sans-serif;margin:24px;max-width:1400px}figure{margin:0 0 40px}figcaption{margin-bottom:8px;font-size:16px}
.pair{display:flex;gap:16px;align-items:flex-start}.pair img{max-width:70%;border:1px solid #a7a8aa}.pair img.phone{max-width:24%}</style></head>
<body><h1>User guide screenshots</h1><h2>Faculty</h2>${section('faculty')}<h2>Models</h2>${section('model')}</body></html>`);
});