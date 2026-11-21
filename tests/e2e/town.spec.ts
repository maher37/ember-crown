import { expect, test } from '@playwright/test';
import { makeParty, pick } from './helpers';

/** Put a fresh party in Ashford's streets just after Lantern Night (as if it had been played). */
async function startInTown(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const key = 'ember-crown:save:autosave';
    const save = JSON.parse(localStorage.getItem(key)!);
    const g = save.game;
    g.location = 'ashford';
    g.flags = { ...g.flags, intro_seen: true, corin_barge: true, ember_marked: true };
    g.quests = {
      'lantern-night': { status: 'done', steps: ['talk-brannoc', 'tend-edric', 'secure-letter'] },
      'old-mine': { status: 'active', steps: [] },
    };
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Ashford', exact: true })).toBeVisible();
}

test('Ashford: the notice board, quest markers on the map, the magic shop, and the town crier', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await makeParty(page);
  await startInTown(page);

  // The Hall's notice board: take the bandits bounty.
  await page.getByRole('button', { name: /Ashford Hall: notice board/ }).click();
  const board = page.getByRole('dialog', { name: 'Ashford Hall: notice board' });
  await expect(board).toContainText('Bounty: Bandits on the River Road');
  await board
    .getByRole('listitem')
    .filter({ hasText: 'Bandits on the River Road' })
    .getByRole('button', { name: 'Take the notice' })
    .click();
  await expect(board).toContainText('Taken: go and deal with it');
  await board.getByRole('button', { name: 'Close', exact: true }).click();

  // Quillon's Curios: magic for spellcasters (the fighter can't attune to a wand).
  await page.getByRole('button', { name: /Quillon's Curios/ }).click();
  const curios = page.getByRole('dialog', { name: "Quillon's Curios" });
  await expect(curios).toContainText('Wand of the War Mage +1');
  await expect(curios).toContainText(/✗ Mira · spellcasters only/);
  await curios.getByRole('button', { name: 'Close', exact: true }).click();

  // The town crier has the news.
  await page.getByRole('button', { name: /Hobb, the town crier/ }).click();
  await expect(page.getByText(/HEAR YE!/)).toBeVisible();
  await pick(page, /Any work going\?/);
  await expect(page.getByText(/The Hall pins bounties on the board/)).toBeVisible();
  await pick(page, /Back to the street\./);
  await page.getByRole('button', { name: 'Back to Ashford' }).click();

  // The world map marks where quests lead: the old mine (main) and the Ashwood (the bounty).
  await page.getByRole('button', { name: /^The north road/ }).click();
  await expect(page.getByRole('heading', { name: 'The Southern Greypeaks' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^The Old Mine .*quest: The Old Mine/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^The Ashwood .*quest: Bounty: Bandits on the River Road/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: /^The Ashwood/ }).click();
  await expect(page.getByRole('list', { name: 'Quests here' })).toContainText(
    'Deal with the bandits on the Ashwood track',
  );
});
