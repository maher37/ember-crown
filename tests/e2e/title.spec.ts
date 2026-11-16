import { expect, test } from '@playwright/test';

test('title screen loads and the difficulty choice survives a reload', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'The Ember Crown' })).toBeVisible();
  await expect(page.getByText(/System Reference Document 5\.1/)).toBeVisible();

  const easy = page.getByRole('radio', { name: /Easy/ });
  await easy.click();
  await expect(easy).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('What Easy changes')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('radio', { name: /Easy/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: /New Game/ })).toContainText('Easy');
});
