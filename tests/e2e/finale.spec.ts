import { expect, test } from '@playwright/test';
import { makeParty, pick } from './helpers';

test('the Crowning: three Truths talk Maelis down, Corin breaks the crown, and the epilogue plays', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await makeParty(page);
  // Jump to the last rest before the Crowning by editing the autosave (as if the game were played).
  await page.evaluate(() => {
    const key = 'ember-crown:save:autosave';
    const save = JSON.parse(localStorage.getItem(key)!);
    const g = save.game;
    g.act = 3;
    g.location = 'kings-kiln';
    g.flags = {
      ...g.flags,
      intro_seen: true,
      act1_complete: true,
      act2_complete: true,
      pass_cleared: true,
      'won:f16-kiln-gate': true,
      gate_open: true,
      'won:f17-furnace-halls': true,
      seal_broken: true,
      ida_aside: true,
      'won:f19-ember-galleries': true,
      'won:f20-last-stand': true,
      before_crowning: true,
      truth_collapse: true,
      truth_crown: true,
      truth_family: true,
      tarrow_confessed: true,
      wix_companion: true,
      ember: 1,
    };
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'The Southern Greypeaks' })).toBeVisible();
  await page.getByRole('button', { name: /Explore The King’s Kiln/ }).click();
  await pick(page, /Go down to the Crowning/);
  await expect(
    page.getByText(/three crown shards hang in the air around Maelis Varrow/),
  ).toBeVisible();
  await pick(page, /Take it off/);
  await expect(page.getByText(/no roll needed → SUCCESS/)).toBeVisible();
  await pick(page, /break it from the inside/);
  await page.getByRole('button', { name: /Afterwards/ }).click();

  await expect(page.getByRole('heading', { name: 'The Last Varrow' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Ashford' })).toBeVisible();
  await expect(page.getByText(/thirty-one lanterns/)).toBeVisible();
  for (let i = 0; i < 10 && (await page.getByRole('button', { name: 'Next' }).isVisible()); i++)
    await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: '“Thirty-One”' })).toBeVisible();
  await expect(page.getByText('They floated thirty-one this year.')).toBeVisible();
  await page.getByRole('button', { name: /The End/ }).click();
  await expect(page.getByRole('button', { name: /New Game/ })).toBeVisible();
});
