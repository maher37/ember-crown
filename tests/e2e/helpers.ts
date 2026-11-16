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

  // Corin's origin opening (the barge), then the Lantern Night scene card, then the tavern.
  await expect(page.getByText(/The evening barge noses into Ashford/)).toBeVisible();
  await pick(page, /Pull the hood up and walk/);
  await expect(page.getByText(/Every lantern on the Grayflow flared red/)).toBeVisible();
  await page.getByRole('button', { name: 'Back to the tavern' }).click();
  await expect(page.getByRole('heading', { name: 'The Drowned Lantern' })).toBeVisible();
}

/** Pick a dialogue choice by its text (choices are numbered buttons). */
export async function pick(page: Page, text: RegExp) {
  await page.getByRole('button', { name: text }).click();
}

export async function leave(page: Page) {
  await page.getByRole('button', { name: /^(↵ )?Back to the tavern$/ }).click();
}

/**
 * Play Lantern Night to the end. Every check fails forward, so this works whatever the dice do.
 */
export async function lanternNight(page: Page) {
  await page.getByRole('button', { name: /Brannoc/ }).click();
  await expect(page.getByText(/He came in off the river road/)).toBeVisible();
  await pick(page, /Let me see to his wounds/);
  await expect(page.getByText(/Medicine check \(\w+\): d20 \(\d+\)/)).toBeVisible();
  await pick(page, /\d\. Back to the tavern\./);
  await leave(page);
  await page.getByRole('button', { name: /Strangers by the hearth/ }).click();
  await pick(page, /Leave this house/);
  // A failed check starts the brawl (F1); losing it is fine, the story goes on.
  if (await page.getByRole('button', { name: /To battle/ }).isVisible()) await sitOutFight(page);
  await leave(page);
  await page.getByRole('button', { name: /Brannoc/ }).click();
  await pick(page, /Will you trust us with the letter now|You know me, Brannoc/);
  await expect(page.getByText('Quest complete: Lantern Night')).toBeVisible();
  await pick(page, /\d\. Back to the tavern\./);
  await leave(page);
}

/** Level up everyone who can, keeping the suggested choices. */
export async function levelUpAll(page: Page) {
  for (let i = 0; i < 4; i++) {
    const btn = page.getByRole('button', { name: 'Level up!' }).first();
    if (!(await btn.count())) break;
    await btn.click();
    await page.getByRole('button', { name: /^Confirm level/ }).click();
  }
  await expect(page.getByRole('button', { name: 'Level up!' })).toHaveCount(0);
}

/**
 * Start the fight a scene offered and let the party stand there (ending turns) until it ends,
 * then continue. Only for fights the story survives losing (the tavern brawl).
 */
export async function sitOutFight(page: Page) {
  await page.getByRole('button', { name: /To battle/ }).click();
  await page.getByRole('button', { name: 'Fight!' }).click();
  const outcome = page.getByRole('dialog', { name: /Victory!|Beaten|Defeat|The fight is over/ });
  for (let i = 0; i < 400 && !(await outcome.isVisible()); i++) {
    const prompt = page.getByRole('alertdialog', { name: 'Reaction' });
    if (await prompt.isVisible()) await prompt.getByRole('button', { name: 'No' }).click();
    else if (await page.getByRole('button', { name: 'End turn' }).isEnabled())
      await page.getByRole('button', { name: 'End turn' }).click();
    else await page.waitForTimeout(200);
  }
  await expect(outcome).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
}
