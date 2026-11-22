import { expect, test } from '@playwright/test';
import { makeParty, pick } from './helpers';

/** Jump a fresh party to the start of Act II by editing the autosave (as if Act I were played). */
async function startActTwo(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const key = 'ember-crown:save:autosave';
    const save = JSON.parse(localStorage.getItem(key)!);
    const g = save.game;
    g.act = 2;
    g.location = 'drowned-lantern';
    g.flags = {
      ...g.flags,
      intro_seen: true,
      corin_barge: true,
      act1_complete: true,
      edric_tended: true,
      has_letter: true,
      strangers_gone: true,
    };
    g.quests = {
      'lantern-night': { status: 'done', steps: ['talk-brannoc', 'tend-edric', 'secure-letter'] },
      'old-mine': { status: 'done', steps: ['road', 'maelis'] },
      'hollow-star': { status: 'active', steps: [] },
    };
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'The Drowned Lantern' })).toBeVisible();
}

test('Act II: the marsh is locked until the toll bridge; Kell holds the bridge; the Lantern Board', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await makeParty(page);
  await startActTwo(page);

  // The Lantern Board (Deserters' Bounty).
  await page.getByRole('button', { name: /Brannoc/ }).click();
  await pick(page, /Anything on the Lantern Board/);
  await expect(page.getByText(/Captain Kell's paying three hundred gold/)).toBeVisible();
  await pick(page, /\d\. Back to the tavern\./);
  await page.getByRole('button', { name: /^(↵ )?Back to the tavern$/ }).click();

  await page.getByRole('button', { name: /Front door/ }).click();
  await pick(page, /Set out \(open the map\)/);
  await page.getByRole('button', { name: 'Set out' }).click();
  await expect(page.getByRole('heading', { name: 'The Southern Greypeaks' })).toBeVisible();

  // Marrowmere waits behind the bridge.
  await page.getByRole('button', { name: /^Drowned Marrowmere/ }).click();
  await expect(page.getByText(/Cross the Grayflow at the toll bridge first/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Not yet' })).toBeDisabled();

  // The toll bridge opens its scene on arrival (unless a random road encounter gets there first).
  await page.getByRole('button', { name: /^The toll bridge/ }).click();
  await page.getByRole('button', { name: /^Travel \(/ }).click();
  const scene = page.getByText(/A chain hangs across the only bridge/);
  const ambush = page.getByRole('heading', { name: /^Prepare:/ });
  await expect(scene.or(ambush)).toBeVisible();
  if (await ambush.isVisible()) return;
  // D35: the chance to listen under the bridge first; walk up instead.
  await expect(page.getByRole('button', { name: /listen under the bridge/ })).toBeVisible();
  await pick(page, /Walk up to the chain/);
  await expect(page.getByText(/Toll's gone up/)).toBeVisible();
  await expect(page.getByRole('button', { name: /take the bridge.*starts combat/ })).toBeVisible();
  await pick(page, /Make our case/);
  await expect(page.getByRole('button', { name: /Let us cross/ })).toBeVisible();
  await pick(page, /^\d\. Back\.$/);
  await pick(page, /Leave \(to the map\)/);
  await page.getByRole('button', { name: 'Back to the map' }).click();
  await page.getByRole('button', { name: 'Inventory' }).click();
  await expect(page.getByRole('dialog', { name: 'Inventory' })).toContainText('0 gp');
});
