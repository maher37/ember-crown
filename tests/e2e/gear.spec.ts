import { expect, test } from '@playwright/test';
import { makeParty } from './helpers';

test('equipment: buy at Brannoc’s, wear it from the sheet, and prepare a cleric’s spells', async ({
  page,
}) => {
  await makeParty(page);
  // Brannoc's counter: buy studded leather for the rogue.
  await page.getByRole('button', { name: /^Shop \(buy and sell\)/ }).click();
  const shop = page.getByRole('dialog', { name: "Brannoc's stores" });
  await expect(shop).toContainText('Party gold: 60 gp');
  await shop.getByRole('button', { name: 'Buy Studded leather' }).click();
  await expect(shop).toContainText('Party gold: 15 gp');
  await shop.getByRole('button', { name: 'Close' }).click();

  // Edda's sheet → Equipment: wear it (her old leather goes back in the pack).
  await page.getByRole('button', { name: 'Character sheet: Edda Quill' }).click();
  const sheet = page.getByRole('article', { name: 'Edda Quill' });
  await sheet.getByRole('tab', { name: 'Equipment' }).click();
  await sheet.getByRole('button', { name: 'Wear' }).first().click();
  await expect(sheet.getByRole('region', { name: /wears and carries/ })).toContainText(
    'Studded leather',
  );

  // Thorn (cleric) has just started the day: prepared spells can be changed.
  await page.getByRole('button', { name: /^Thorn/ }).click();
  const thorn = page.getByRole('article', { name: 'Thorn' });
  await thorn.getByRole('tab', { name: 'Spells' }).click();
  await expect(thorn).toContainText('Spell save DC');
  await thorn.getByRole('button', { name: 'Change prepared spells' }).click();
  const picked = thorn.locator('.spell-pick.on').first();
  await picked.click();
  await thorn.locator('.spell-pick:not(.on)').first().click();
  await thorn.getByRole('button', { name: 'Prepare these spells' }).click();
  await expect(thorn.getByRole('status')).toContainText('Spells prepared.');
});
