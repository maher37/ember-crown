import { expect, test } from '@playwright/test';

test('sound: settings dialog, volume sliders, the M key, and no errors once audio starts', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('./');
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('slider', { name: 'Music volume' }).fill('30');
  await expect(dialog).toContainText('30%');
  await page.keyboard.press('m');
  await expect(dialog.getByRole('checkbox', { name: /Mute all sound/ })).toBeChecked();
  await page.keyboard.press('m');
  await dialog.getByRole('button', { name: 'Close' }).click();
  // Let the music and effects run for a moment.
  await page.getByRole('button', { name: /New Game/ }).click();
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});
