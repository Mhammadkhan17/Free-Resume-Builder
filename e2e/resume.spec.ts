import { test, expect } from '@playwright/test';

test('page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Resume Builder/i })).toBeVisible();
});

test('load example populates name', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Example/i }).click();
  await expect(page.locator('#f-name')).toHaveValue('Ada Lovelace');
});

test('undo restores after edit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Example/i }).click();
  const input = page.locator('#f-name');
  await input.fill('Changed Name');
  await page.getByRole('button', { name: /Undo/i }).click();
  await expect(input).toHaveValue('Ada Lovelace');
});

test('command palette opens', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '⌘K' }).click();
  await expect(page.getByText(/Command palette/i)).toBeVisible();
});

test('fit to one page button exists', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Fit 1 page/i })).toBeVisible();
});
