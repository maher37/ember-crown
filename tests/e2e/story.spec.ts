import { expect, test } from '@playwright/test';
import { lanternNight, leave, makeParty, pick } from './helpers';

test('Lantern Night: dialogue checks, character options, journal, XP and a level-up', async ({
  page,
}) => {
  test.setTimeout(180_000); // Lantern Night may include the tavern brawl now
  await makeParty(page);
  // The front door stays shut until the quest is done.
  await page.getByRole('button', { name: /Front door/ }).click();
  await expect(page.getByText(/You're not walking out on the boy now/)).toBeVisible();
  await leave(page);

  // Corin-only option with the hooded figure.
  await page.getByRole('button', { name: /Hooded figure/ }).click();
  await expect(page.getByRole('button', { name: /\[Corin\] Maelis\?/ })).toBeVisible();
  await pick(page, /Maelis\?/);
  await expect(page.getByText(/Not here, little brother/)).toBeVisible();
  await leave(page);
  await expect(page.getByRole('button', { name: /Hooded figure/ })).toHaveCount(0);

  await lanternNight(page);
  await expect(page.getByText('300 / 900 XP').or(page.getByText(/300 \/ 300 XP/))).toBeVisible();

  // Journal keeps the notes.
  await page.getByRole('button', { name: 'Journal' }).click();
  await expect(page.getByRole('dialog', { name: 'Journal' })).toContainText(
    'hollow eight-pointed star',
  );
  await page.getByRole('button', { name: 'Close' }).click();

  // Level-up for the fighter (Mira): Action Surge, average HP.
  await page
    .locator('.party-card', { hasText: 'Mira Ashgrove' })
    .getByRole('button', { name: 'Level up!' })
    .click();
  await expect(page.getByRole('heading', { name: 'Level up!' })).toBeVisible();
  await expect(page.getByText('Action Surge')).toBeVisible();
  await expect(page.getByText(/Average 6 \+\d Con = \+\d+ HP/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirm level 2' }).click();
  await expect(page.getByText('Mira Ashgrove reaches level 2!')).toBeVisible();
  await expect(page.locator('.party-card', { hasText: 'Mira Ashgrove' })).toContainText(
    'Fighter 2',
  );
});
