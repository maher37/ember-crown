import { Story } from 'inkjs';
import { expect, it } from 'vitest';
import smoke from '../../src/content/dialogue/smoke.ink';

it('compiles ink at build time and exposes choice tags', () => {
  const story = new Story(smoke);
  story.BindExternalFunction('has', (tag: string) => tag === 'class:cleric', true);
  story.ChoosePathString('start');
  expect(story.ContinueMaximally().trim()).toBe('Hello.');
  expect(story.currentChoices.map((c) => [c.text, c.tags])).toEqual([
    ['Plain', []],
    ['Pray', ['as:cleric']],
    ['Check', ['check:medicine:10']],
  ]);
});
