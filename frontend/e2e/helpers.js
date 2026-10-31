/**
 * Shared steps for the end-to-end tests.
 */

/** Signs in as a seeded person through the development-only test login, without Google. */
export async function loginAs(page, email) {
  const response = await page.request.post('http://localhost:3000/test_login', { params: { email } });
  const { token } = await response.json();

  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), token);
  await page.goto('/');
}
