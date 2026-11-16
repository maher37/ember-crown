import { expect, test, type Page } from '@playwright/test';
import { lanternNight, levelUpAll, makeParty, pick } from './helpers';

/** One party turn, played like a simple player would: hit something, or walk toward the enemy. */
async function playTurn(page: Page): Promise<void> {
  const tryAttack = async () => {
    for (const attack of await page.getByRole('button', { name: /^Attack · / }).all()) {
      if (await attack.isDisabled()) continue;
      await attack.click();
      const target = page.locator('.token.target').first();
      if (await target.count()) {
        await target.click();
        return true;
      }
      await page.keyboard.press('Escape');
    }
    return false;
  };
  if (!(await tryAttack())) {
    // Walk to the reachable square closest to an enemy, then try again.
    const moved = await page.evaluate(() => {
      const px = (el: Element) => ({
        x: parseFloat((el as HTMLElement).style.left),
        y: parseFloat((el as HTMLElement).style.top),
      });
      const foes = [...document.querySelectorAll('.token.enemy:not(.dead)')].map(px);
      const cells = [...document.querySelectorAll('button.cell.reach')];
      let best = -1;
      let bestD = Infinity;
      cells.forEach((c, i) => {
        const p = px(c);
        const d = Math.min(
          ...foes.map((f) => Math.max(Math.abs(f.x - 4 - p.x), Math.abs(f.y - 4 - p.y))),
        );
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best < 0) return false;
      (cells[best] as HTMLButtonElement).click();
      return true;
    });
    if (moved) await tryAttack();
  }
  const end = page.getByRole('button', { name: 'End turn' });
  if (await end.isEnabled()) await end.click();
}

test('F2 Road ambush: prepare, fight to the end, and come back with XP', async ({ page }) => {
  test.setTimeout(180_000);
  await makeParty(page);
  await lanternNight(page);
  await levelUpAll(page);
  await page.getByRole('button', { name: /Front door/ }).click();
  await pick(page, /Set out along the road/);
  await page.getByRole('button', { name: 'Set out' }).click();
  await expect(
    page.getByRole('heading', { name: /Prepare: Ambush on the Ashford road/ }),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Easy' }).click();
  await expect(page.getByText('3 × Goblin')).toBeVisible();
  await page.getByRole('button', { name: 'Fight!' }).click();
  await expect(page.getByRole('log')).toContainText('Goblins burst from the treeline!');
  await expect(page.getByRole('log')).toContainText(/Initiative: .*d20 \(\d+\)/);

  const outcome = page.getByRole('dialog', { name: /Victory!|Defeat/ });
  for (let i = 0; i < 150 && !(await outcome.isVisible()); i++) {
    const prompt = page.getByRole('alertdialog', { name: 'Reaction' });
    if (await prompt.isVisible()) {
      await prompt.getByRole('button', { name: 'Yes' }).click();
      continue;
    }
    if (await page.getByText('Your turn').isVisible()) await playTurn(page);
    else await page.waitForTimeout(300);
  }
  await expect(outcome).toBeVisible();
  // Every roll is in the log with its breakdown.
  await expect(page.getByRole('log')).toContainText(
    /d20 \(\d+\) \+ \d+ = \d+ vs AC \d+ → (HIT|MISS|CRITICAL HIT)/,
  );

  if (await page.getByRole('heading', { name: 'Victory!' }).isVisible()) {
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText(/Victory! \+50 XP each/)).toBeVisible();
    await expect(page.getByText(/Journal updated: Take the Ashford road/)).toBeVisible();
    await expect(page.getByText('350 / 900 XP')).toBeVisible();
  } else {
    await page.getByRole('button', { name: 'Load the autosave from before the fight' }).click();
    await expect(page.getByRole('heading', { name: 'The Drowned Lantern' })).toBeVisible();
  }
});
