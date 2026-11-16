import { expect, type Page } from '@playwright/test';

async function finishStepTwo(page: Page, skills: string[], extra?: () => Promise<void>) {
  await page.getByRole('button', { name: /Next: Background/ }).click();
  for (const s of skills) await page.getByRole('button', { name: s, exact: true }).click();
  if (extra) await extra();
  await page.getByRole('button', { name: /Add to party/ }).click();
}

async function customHero(
  page: Page,
  name: string,
  cls: string,
  skills: string[],
  extra?: () => Promise<void>,
) {
  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('button', { name: new RegExp(`^${cls}`) }).click();
  await finishStepTwo(page, skills, extra);
}

export async function makeParty(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: /New Game/ }).click();
  await expect(page.getByRole('heading', { name: 'Create your party' })).toBeVisible();

  // 1: Corin, the origin character.
  await page.getByRole('radio', { name: 'Origin: Corin Varrow' }).click();
  await finishStepTwo(page, ['Arcana', 'Insight']);
  await expect(page.getByText('Party member 2 of 4')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Origin: Corin Varrow' })).toBeDisabled();

  // 2: a fighter with a fighting style.
  await customHero(page, 'Mira Ashgrove', 'Fighter', ['Athletics', 'Perception'], () =>
    page.getByRole('radio', { name: /Defense/ }).click(),
  );
  // 3: a cleric, using point buy.
  await page.getByRole('radio', { name: 'Point buy' }).click();
  await expect(page.getByText(/points left/)).toBeVisible();
  await customHero(page, 'Thorn', 'Cleric', ['History', 'Medicine']);
  // 4: a rogue with rolled scores and Expertise.
  await page.getByRole('radio', { name: 'Roll', exact: true }).click();
  await page.getByRole('button', { name: 'Roll 4d6' }).click();
  await expect(page.getByText(/Rolled \(4d6, drop lowest\)/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Name' }).fill('Edda Quill');
  await page.getByRole('button', { name: /^Rogue/ }).click();
  await page.getByRole('button', { name: /Next: Background/ }).click();
  for (const s of ['Acrobatics', 'Perception', 'Insight', 'Investigation'])
    await page.getByRole('button', { name: s, exact: true }).first().click();
  const expertise = page
    .getByRole('heading', { name: /Expertise/ })
    .locator('xpath=following-sibling::div[1]');
  await expertise.getByRole('button', { name: 'Perception' }).click();
  await expertise.getByRole('button', { name: 'Insight' }).click();
  await page.getByRole('button', { name: /Add to party and begin/ }).click();

  await expect(page.getByRole('heading', { name: 'Your party' })).toBeVisible();
  for (const n of ['Corin Varrow', 'Mira Ashgrove', 'Thorn', 'Edda Quill'])
    await expect(page.getByRole('article', { name: n })).toBeVisible();
}
