import { expect, test } from '@playwright/test';
import { makeParty } from './helpers';

test('rest at the inn: short rest with Hit Dice, long rest once a day, and Corin’s letter', async ({
  page,
}) => {
  await makeParty(page);
  await expect(page.getByText(/Feast of the Moon, 1492 DR · Evening/)).toBeVisible();
  await page.getByRole('button', { name: /Stairs to the rooms/ }).click();
  await expect(page.getByText('Private room · the Drowned Lantern')).toBeVisible();
  // No Wix yet: he joins in a later side quest.
  await expect(page.getByRole('button', { name: 'Ask Wix for a joke' })).toHaveCount(0);

  // Corin's letter from his sister is in his pack.
  await page.getByRole('button', { name: /Read letter/ }).click();
  await expect(page.getByRole('dialog', { name: /Letter from Mae/ })).toContainText(
    "I've kept your room at the mill. It still leaks.",
  );
  await page.getByRole('button', { name: 'Keep it and close' }).click();

  await page.getByRole('button', { name: /Short rest/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Short rest' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Finish the short rest' }).click();
  await expect(page.getByText('The short rest is over.')).toBeVisible();

  await page.getByRole('button', { name: /Long rest/ }).click();
  await expect(page.getByText(/1 Nightal, 1492 DR · (Dawn|Morning)/).first()).toBeVisible();
  await page.getByRole('button', { name: /Wake the party/ }).click();
  await page.getByRole('button', { name: /Long rest/ }).click();
  await expect(page.getByText(/once per 24 hours/)).toBeVisible();

  await page.getByRole('button', { name: /Break camp/ }).click();
  await expect(page.getByRole('heading', { name: 'The Drowned Lantern' })).toBeVisible();
  await page.getByRole('button', { name: 'Journal' }).click();
  await expect(page.getByRole('dialog', { name: 'Journal' })).toContainText('“Come Home”');
});
