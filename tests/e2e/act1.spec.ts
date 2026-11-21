import { expect, test } from '@playwright/test';
import { leave, makeParty, pick, sitOutFight } from './helpers';

test('Act I: a scene starts the tavern brawl and picks up after it; potions; a map scene', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await makeParty(page);

  // The strangers: the fight choice is marked, and the story carries on whoever wins.
  await page.getByRole('button', { name: /Strangers by the hearth/ }).click();
  await expect(
    page.getByRole('button', { name: /Then come and take it\..*starts combat/ }),
  ).toBeVisible();
  await pick(page, /Then come and take it/);
  await expect(page.getByRole('button', { name: /To battle/ })).toBeVisible();
  await page.getByRole('button', { name: /To battle/ }).click();
  await expect(
    page.getByRole('heading', { name: /Prepare: Brawl at the Drowned Lantern/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Not yet' }).click();
  await expect(page.getByRole('heading', { name: 'The Drowned Lantern' })).toBeVisible();
  await page.getByRole('button', { name: /Strangers by the hearth/ }).click();
  await pick(page, /Then come and take it/);
  await sitOutFight(page);
  await expect(page.getByText(/Brannoc|Grey Company/).first()).toBeVisible();
  await leave(page);

  // Finish Lantern Night with Corin's option, then Brannoc's supplies.
  await page.getByRole('button', { name: /Brannoc/ }).click();
  await pick(page, /Let me see to his wounds/);
  await pick(page, /Will you trust us with the letter now/);
  await expect(page.getByText('Quest complete: Lantern Night')).toBeVisible();
  await pick(page, /supplies for the road/);
  // The item card in the scene says what it is and what it does (and the journal flash too).
  await expect(page.getByRole('status').getByText('Received: Potion of Healing ×4')).toBeVisible();
  await expect(page.locator('.line.item-card')).toContainText(/Potion of Healing[\s\S]*heal/);
  await pick(page, /\d\. Back to the tavern\./);
  await leave(page);
  await page.getByRole('button', { name: 'Inventory' }).click();
  await expect(page.getByRole('dialog', { name: 'Inventory' })).toContainText(
    'Potion of Healing ×4',
  );
  await page.getByRole('button', { name: 'Close' }).click();

  // The map: Varrow's Mill opens its own scene on arrival (Corin knows the kitchen).
  await page.getByRole('button', { name: /Front door/ }).click();
  await pick(page, /Set out \(open the map\)/);
  await page.getByRole('button', { name: 'Set out' }).click();
  await page.getByRole('button', { name: /^Varrow’s Mill/ }).click();
  await page.getByRole('button', { name: /^Travel \(/ }).click();
  const scene = page.getByText(/Varrow's Mill leans over the Grayflow/);
  const ambush = page.getByRole('heading', { name: /^Prepare:/ });
  await expect(scene.or(ambush)).toBeVisible();
  if (await ambush.isVisible()) return; // a random road encounter: covered by the F2 test
  await expect(page.getByText(/That's our kitchen/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Light a lantern and go in\..*starts combat/ }),
  ).toBeVisible();
  await pick(page, /Leave \(to the map\)/);
  await page.getByRole('button', { name: 'Back to the map' }).click();
  await expect(page.getByRole('button', { name: /Explore Varrow’s Mill/ })).toBeVisible();
});
