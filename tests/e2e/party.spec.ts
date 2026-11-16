import { expect, test } from '@playwright/test';
import { makeParty } from './helpers';

test('create a party of four, save, reload and continue', async ({ page }) => {
  await makeParty(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Save to Slot 1' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved to Slot 1' })).toBeVisible();

  await page.reload();
  await expect(page.getByText(/Corin, Mira, Thorn, Edda · Act I/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'The Drowned Lantern' })).toBeVisible();
  await page.getByRole('button', { name: 'Character sheet: Mira Ashgrove' }).click();
  await expect(page.getByRole('article', { name: 'Corin Varrow' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Mira Ashgrove' })).toContainText('AC19');
});

test('export a save file and import it in a fresh browser', async ({ page, browser }) => {
  await makeParty(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export save file' }).click();
  const file = await (await download).path();

  const fresh = await browser.newPage();
  await fresh.goto('./');
  await expect(fresh.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await fresh.getByRole('button', { name: 'Load Game' }).click();
  await fresh.getByLabel(/Import a save file/).setInputFiles(file);
  await expect(fresh.getByRole('heading', { name: 'The Drowned Lantern' })).toBeVisible();
  await expect(fresh.getByText('Thorn', { exact: true })).toBeVisible();
});
