import { expect, test } from '@playwright/test';
import { makeParty, pick } from './helpers';

// Playtest bug (Nov 21): the evacuation convoy froze when an Ashford militia ally's turn came up.
test('Last Boats: the convoy fight plays through the militia allies’ turns', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await makeParty(page);
  await page.evaluate(() => {
    const key = 'ember-crown:save:autosave';
    const save = JSON.parse(localStorage.getItem(key)!);
    save.game.act = 3;
    save.game.location = 'drowned-lantern';
    save.game.flags = {
      ...save.game.flags,
      intro_seen: true,
      corin_barge: true,
      ember_marked: true,
      act1_complete: true,
      act2_complete: true,
      act3_evacuation: true,
    };
    save.game.quests = {
      'lantern-night': { status: 'done', steps: ['talk-brannoc', 'tend-edric', 'secure-letter'] },
    };
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Brannoc/ }).click();
  await pick(page, /The convoy/);
  await page
    .getByRole('button', { name: /Go on|Set out|Leave/ })
    .first()
    .click();
  await pick(page, /Guard the carts/);
  await page
    .getByRole('button', { name: /To battle|Set out/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Fight!' }).click();
  // End turns (heroes and militia alike) until both militia have had a turn.
  for (let i = 0; i < 14; i++) {
    const end = page.getByRole('button', { name: 'End turn' });
    if ((await end.isVisible()) && (await end.isEnabled())) await end.click();
    await page.waitForTimeout(400);
    if (await page.getByRole('dialog', { name: /Victory!|Beaten|Defeat/ }).isVisible()) break;
  }
  await expect(page.getByRole('log')).toContainText(/Ashford militia [AB]'s turn/);
  expect(errors).toEqual([]);
});
