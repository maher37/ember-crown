// Familiars: Find Familiar (wizard) and Pact of the Chain (warlock). Each test cites the rule.
import { describe, expect, it } from 'vitest';
import { act, attackOptions, checkOutcome, finishCombat } from '../../src/game/combat';
import { familiarForms, familiarOf, setFamiliarForm } from '../../src/game/familiar';
import type { Hero } from '../../src/game/hero';
import { takeLongRest } from '../../src/game/rest';
import { makeSave, parseSave, serializeSave, type GameState } from '../../src/game/save';
import { SeededRng } from '../../src/rules';
import { arrange, fight, L, party, texts } from './combat/arrange';

const wizard = (): Hero => {
  const h = L('wizard', 'Ivo', 3);
  return { ...h, spells: [...h.spells, 'find-familiar'] };
};
const chain = (): Hero => L('warlock', 'Nyx', 3, { 'pact-boon': ['pact-of-the-chain'] });
const F = (lead: Hero) => fight('f13-cloister', party(lead, 3));

describe('who has a familiar', () => {
  it('a wizard who knows Find Familiar, or a Pact of the Chain warlock (PHB)', () => {
    expect(familiarOf(wizard())?.form).toBe('owl');
    expect(familiarOf(chain())?.form).toBe('imp');
    expect(familiarOf(L('wizard', 'Ivo', 3))).toBeNull();
    expect(familiarOf(L('warlock', 'Nyx', 3, { 'pact-boon': ['pact-of-the-blade'] }))).toBeNull();
  });

  it('only the Chain may pick an imp, pseudodragon, quasit or sprite (PHB: Pact of the Chain)', () => {
    expect(familiarForms(wizard())).not.toContain('imp');
    expect(familiarForms(chain())).toEqual(expect.arrayContaining(['imp', 'sprite', 'cat']));
    expect(familiarOf(setFamiliarForm(wizard(), 'imp'))?.form).toBe('owl');
    expect(familiarOf(setFamiliarForm(wizard(), 'cat'))?.form).toBe('cat');
  });
});

describe('familiars in a fight', () => {
  it('joins beside its hero on the party side, with its own initiative (PHB: Find Familiar)', () => {
    const s = F(setFamiliarForm(wizard(), 'cat'));
    const cat = s.combatants['ivo-familiar']!;
    expect(cat.side).toBe('party');
    expect(cat.monsterId).toBe('cat');
    expect(cat.name).toBe("Ivo's cat");
    expect(s.order).toContain('ivo-familiar');
    const me = s.combatants['ivo']!.pos;
    expect(Math.max(Math.abs(cat.pos.x - me.x), Math.abs(cat.pos.y - me.y))).toBeLessThanOrEqual(3);
  });

  it('a flying familiar moves at its flying speed (the grid has no height)', () => {
    expect(F(wizard()).combatants['ivo-familiar']!.speed).toBe(60);
  });

  it("a wizard's familiar can't attack but can Help (PHB: Find Familiar)", () => {
    let s = arrange(F(wizard()), {}, 'ivo-familiar');
    expect(attackOptions(s.combatants['ivo-familiar']!)).toHaveLength(0);
    s = act(s, { type: 'help', allyId: 'ivo' }).state;
    expect(s.combatants['ivo']!.effects.some((e) => e.tag === 'help')).toBe(true);
    expect(texts(s)).toMatch(/helps Ivo/);
  });

  it('a Pact of the Chain familiar can attack (owner, Nov 23: BG3 style)', () => {
    const s = F(chain());
    expect(attackOptions(s.combatants['nyx-familiar']!).map((o) => o.id)).toContain('sting');
  });

  it('the fight is lost when every hero is down, even if a familiar stands', () => {
    const s = F(wizard());
    for (const c of Object.values(s.combatants))
      if (c.side === 'party' && !c.pet) c.creature = { ...c.creature, hp: 0 };
    expect(checkOutcome(s)).toBe('defeat');
  });

  it('a slain familiar is gone until a long rest, then returns', () => {
    const s = F(wizard());
    const owl = s.combatants['ivo-familiar']!;
    owl.creature = { ...owl.creature, hp: 0, dead: true };
    s.outcome = 'victory';
    const out = finishCombat(s, party(wizard(), 3));
    const ivo = out.party[0]!;
    expect(ivo.familiar?.lost).toBe(true);
    expect(out.notes.join(' ')).toMatch(/comes back after a long rest/);
    expect(F(ivo).combatants['ivo-familiar']).toBeUndefined();
    const g = { party: [ivo], flags: {}, clock: 100, lastLongRest: null } as unknown as GameState;
    const rested = takeLongRest(g, new SeededRng(1)).game.party[0]!;
    expect(rested.familiar?.lost).toBeFalsy();
    expect(F(rested).combatants['ivo-familiar']).toBeDefined();
  });
});

describe('saving a familiar', () => {
  it('keeps its shape and whether it is lost through a save and load (old saves need no migration)', () => {
    const ivo = { ...setFamiliarForm(wizard(), 'raven'), familiar: { form: 'raven', lost: true } };
    const g = {
      id: 'g',
      createdAt: '2026-11-16T10:00:00.000Z',
      seed: 1,
      rngState: 1,
      party: [ivo],
      act: 1,
      location: 'drowned-lantern',
      playSeconds: 0,
      flags: {},
      quests: {},
      notes: [],
      ink: {},
      clock: 7972,
      lastLongRest: null,
      letters: [],
      inventory: {},
      gold: 0,
    } as GameState;
    const r = parseSave(serializeSave(makeSave(g)));
    expect(r.ok && r.save.game.party[0]!.familiar).toEqual({ form: 'raven', lost: true });
  });
});
