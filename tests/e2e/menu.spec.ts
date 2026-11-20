import { expect, test } from '@playwright/test';
import { makeParty } from './helpers';

test('the in-game menu: settings (difficulty, comfort, sound), credits, and quit to title', async ({
  page,
}) => {
  await makeParty(page);
  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await menu.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('radio', { name: 'Hard' }).click();
  await expect(settings.getByRole('radio', { name: 'Hard' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await settings.getByRole('checkbox', { name: /Reduce flashing/ }).check();
  await expect(settings.getByRole('slider', { name: 'Music volume' })).toBeVisible();
  await settings.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Credits' }).click();
  await expect(page.getByRole('dialog', { name: 'Credits' })).toContainText(
    'System Reference Document 5.1',
  );
  await page
    .getByRole('dialog', { name: 'Credits' })
    .getByRole('button', { name: 'Close' })
    .click();

  await page.getByRole('button', { name: 'Menu' }).click();
  await page
    .getByRole('dialog', { name: 'Menu' })
    .getByRole('button', { name: 'Save and quit to the title screen' })
    .click();
  await expect(page.getByRole('button', { name: /New Game/ })).toBeVisible();
  // The title screen remembers Hard from the in-game settings.
  await expect(page.getByRole('radio', { name: /Hard/ })).toHaveAttribute('aria-checked', 'true');
});
