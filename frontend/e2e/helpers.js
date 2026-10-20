// Signs the browser in as any user, using the backend's development-only test_login shortcut
export async function loginAs(page, email) {
  const response = await page.request.post('http://localhost:3000/test_login', { params: { email } });
  const { token } = await response.json();

  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), token);
  await page.goto('/');
}