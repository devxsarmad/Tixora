import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('sarmad@gmail.com');
  await page.getByRole('textbox', { name: 'Password Show password' }).click();
  await page.getByRole('textbox', { name: 'Password Show password' }).click();
  await page.getByRole('textbox', { name: 'Password Show password' }).fill('123456');
  await page.locator('form').getByRole('button', { name: 'Login' }).click();
  await page.getByText('Invalid email or password').click();
  await page.getByText('Invalid email or password').click();
  await page.getByText('Invalid email or password').click();
  await page.getByText('Invalid email or password').click();
  await page.getByText('Invalid email or password').click();
  await page.getByText('Invalid email or password').click();
  await expect(page.getByText('Invalid email or password')).toBeVisible();
  await page.getByText('Invalid email or password').click();
  await page.getByText('Invalid email or password').click();
  await expect(page.getByRole('main')).toContainText('Invalid email or password');
});