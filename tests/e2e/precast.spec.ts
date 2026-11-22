import { expect, test } from '@playwright/test';
import { lanternNight, levelUpAll, makeParty, pick } from './helpers';
// D34: casting between fights. A buff chosen on the Prepare screen is cast when the fight starts.
test('Prepare: cast Bless before the fight and see it in the log', async ({ page }) => {
  test.setTimeout(180_000);
  await makeParty(page);
  await lanternNight(page);
  await levelUpAll(page);
  await page.getByRole('button', { name: /Front door/ }).click();
  await pick(page, /Set out \(open the map\)/);
  await page.getByRole('button', { name: 'Set out' }).click();
  await page.getByRole('button', { name: /^The Old Mine/ }).click();
  await page.getByRole('button', { name: /^Travel \(/ }).click();
  await expect(page.getByRole('heading', { name: /Prepare:/ })).toBeVisible();
  await page.getByRole('combobox', { name: 'Spell' }).first().selectOption('bless');
  for (const n of ['Mira', 'Thorn', 'Edda']) await page.getByRole('checkbox', { name: n }).click();
  await page.getByRole('button', { name: 'Cast Bless' }).click();
  await page.getByRole('button', { name: /^Fight!|Ambush|spotted/ }).click();
  await expect(page.getByRole('log')).toContainText('Before the fight');
  await expect(page.getByRole('log')).toContainText('Thorn casts Bless');
});
