import { test, expect, type Page } from '@playwright/test';

async function loadExample(page: Page) {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Example', exact: true }).click();
}

test('page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Resume Builder/i })).toBeVisible();
});

test('load example populates name', async ({ page }) => {
  await page.goto('/');
  await loadExample(page);
  await expect(page.locator('#f-name')).toHaveValue('Ada Lovelace');
});

test('undo restores after edit', async ({ page }) => {
  await page.goto('/');
  await loadExample(page);
  const input = page.locator('#f-name');
  await input.fill('Changed Name');
  await page.getByRole('button', { name: /^Undo$/ }).click();
  await expect(input).toHaveValue('Ada Lovelace');
});

test('command palette opens', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '⌘K' }).click();
  await expect(page.getByText(/Command palette/i)).toBeVisible();
});

test('fit to one page button exists', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await expect(page.getByRole('button', { name: /Fit 1 page/i })).toBeVisible();
});
