import { beforeEach, describe, expect, it } from 'vitest';
import { origins } from '../../src/data';
import { ORIGIN_IDS } from '../../src/data/schemas/origin';
import {
  buildHero,
  corinDraft,
  draftProblems,
  getOrigin,
  originDraft,
  subclassOf,
  type HeroDraft,
} from '../../src/game/hero';
import { makeSave, parseSave, serializeSave, type GameState } from '../../src/game/save';
import { useGame } from '../../src/game/store';

/** Each new origin hero with legal level-1 picks (class skills not already given). */
const ready: Record<'harl' | 'nessa' | 'rhessa', () => HeroDraft> = {
  harl: () => ({ ...originDraft('harl'), classSkills: ['history', 'medicine'] }),
  nessa: () => ({ ...originDraft('nessa'), classSkills: ['arcana', 'deception'] }),
  rhessa: () => ({
    ...originDraft('rhessa'),
    classSkills: ['acrobatics', 'perception'],
    fightingStyle: 'defense',
  }),
};

describe('origin heroes (D33)', () => {
  it('has one data record per origin id, Corin included', () => {
    expect(origins.map((o) => o.id).sort()).toEqual([...ORIGIN_IDS].sort());
  });

  it('Corin is unchanged: human sorcerer, Urchin, amber eyes', () => {
    expect(corinDraft()).toMatchObject({
      origin: 'corin',
      name: 'Corin Varrow',
      speciesId: 'human',
      classId: 'sorcerer',
      backgroundId: 'urchin',
    });
    expect(corinDraft().portrait.eyes).toBe('#9a8a3a');
  });

  it('Harl Deepdelve: hill dwarf cleric of the Life Domain, Acolyte', () => {
    const d = ready.harl();
    expect(draftProblems(d)).toEqual([]);
    const h = buildHero(d, 'harl');
    expect(h).toMatchObject({
      origin: 'harl',
      name: 'Harl Deepdelve',
      speciesId: 'hill-dwarf',
      classId: 'cleric',
      backgroundId: 'acolyte',
    });
    expect(subclassOf(h)).toBe('life');
  });

  it('Nessa Thorne: human warlock with the Fiend patron, Noble', () => {
    const d = ready.nessa();
    expect(draftProblems(d)).toEqual([]);
    const h = buildHero(d, 'nessa');
    expect(h).toMatchObject({
      origin: 'nessa',
      speciesId: 'human',
      classId: 'warlock',
      backgroundId: 'noble',
    });
    expect(subclassOf(h)).toBe('fiend');
  });

  it('Rhessa Kalvaar: red dragonborn fighter, Soldier, resists fire', () => {
    const d = ready.rhessa();
    expect(draftProblems(d)).toEqual([]);
    const h = buildHero(d, 'rhessa');
    expect(h).toMatchObject({
      origin: 'rhessa',
      speciesId: 'dragonborn',
      classId: 'fighter',
      backgroundId: 'soldier',
    });
    // PHB: Draconic Ancestry (red) gives resistance to fire damage.
    expect(h.defenses.resistances).toContain('fire');
  });

  it('every origin has a backstory and a want for the character sheet', () => {
    for (const id of ORIGIN_IDS) {
      expect(getOrigin(id).backstory.length).toBeGreaterThan(0);
      expect(getOrigin(id).wants.length).toBeGreaterThan(0);
    }
  });
});

describe('origin heroes in the party', () => {
  beforeEach(() => useGame.getState().startNewGame(1));

  it('each origin hero can join once; different origin heroes can join together', () => {
    const { addHero } = useGame.getState();
    addHero(buildHero(ready.harl(), 'a'));
    addHero(buildHero(ready.nessa(), 'b'));
    expect(() => addHero(buildHero(ready.harl(), 'c'))).toThrow(/already in the party/);
    addHero(buildHero(ready.rhessa(), 'd'));
    expect(useGame.getState().pendingParty.map((h) => h.origin)).toEqual([
      'harl',
      'nessa',
      'rhessa',
    ]);
  });

  it('new origin heroes survive a save and load', () => {
    const party = [
      buildHero(ready.harl(), 'a'),
      buildHero(ready.nessa(), 'b'),
      buildHero(ready.rhessa(), 'c'),
      buildHero({ ...corinDraft(), classSkills: ['arcana', 'insight'] }, 'd'),
    ];
    const s = useGame.getState();
    party.forEach((h) => s.addHero(h));
    s.beginAdventure();
    const game = useGame.getState().game as GameState;
    const r = parseSave(serializeSave(makeSave(game)));
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.save.game.party.map((h) => h.origin)).toEqual(['harl', 'nessa', 'rhessa', 'corin']);
  });
});
