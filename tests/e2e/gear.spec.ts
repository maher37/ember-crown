import { expect, test } from '@playwright/test';
import { lanternNight, makeParty, pick } from './helpers';

test('equipment: prepare a cleric’s spells, buy armor at the forge, and wear it from the sheet', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await makeParty(page);
  // Thorn (cleric) has just started the day: prepared spells can be changed (until a fight).
  await page.getByRole('button', { name: 'Character sheet: Thorn' }).click();
  const thorn = page.getByRole('article', { name: 'Thorn' });
  await thorn.getByRole('tab', { name: 'Spells' }).click();
  await expect(thorn).toContainText('Spell save DC');
  await thorn.getByRole('button', { name: 'Change prepared spells' }).click();
  const picked = thorn.locator('.spell-pick.on').first();
  await picked.click();
  await thorn.locator('.spell-pick:not(.on)').first().click();
  await thorn.getByRole('button', { name: 'Prepare these spells' }).click();
  await expect(thorn.getByRole('status')).toContainText('Spells prepared.');
  await page.getByRole('button', { name: 'Back to the tavern' }).click();

  // Brannoc's counter: rope and oil, but no armor (that's the smith's trade).
  await page.getByRole('button', { name: /^Shop \(buy and sell\)/ }).click();
  const brannoc = page.getByRole('dialog', { name: "Brannoc's stores" });
  await expect(brannoc).toContainText('Party gold: 60 gp');
  await expect(brannoc.getByRole('button', { name: 'Buy Rope' })).toBeVisible();
  await expect(brannoc.getByRole('button', { name: 'Buy Studded leather' })).toHaveCount(0);
  await brannoc.getByRole('button', { name: 'Close', exact: true }).click();

  // Out into Ashford, to the Stonemantle Forge: studded leather for the rogue.
  await lanternNight(page);
  await page.getByRole('button', { name: /Front door/ }).click();
  await expect(page.getByText(/ember-kiss/)).toBeVisible();
  await pick(page, /Step out into Ashford/);
  await page.getByRole('button', { name: 'Into the street' }).click();
  await page.getByRole('button', { name: /^Stonemantle Forge/ }).click();
  const shop = page.getByRole('dialog', { name: 'Stonemantle Forge' });
  await shop.getByRole('button', { name: 'Buy Studded leather' }).click();
  await expect(shop).toContainText('Party gold: 15 gp');
  await shop.getByRole('button', { name: 'Close', exact: true }).click();

  // Edda's sheet → Equipment: wear it (her old leather goes back in the pack).
  await page.getByRole('button', { name: 'Character sheet: Edda Quill' }).click();
  const sheet = page.getByRole('article', { name: 'Edda Quill' });
  await sheet.getByRole('tab', { name: 'Equipment' }).click();
  await sheet
    .getByRole('listitem')
    .filter({ hasText: 'Studded leather' })
    .getByRole('button', { name: /^Equip: armor/ })
    .click();
  await expect(sheet.getByRole('group', { name: /^Armor: Studded leather/ })).toBeVisible();
  // Her old leather armor went back in the pack.
  await expect(sheet.getByRole('listitem').filter({ hasText: /^Leather/ })).toBeVisible();
});
