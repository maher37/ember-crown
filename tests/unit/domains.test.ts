// Cleric domains (D4, playtest): Life, Light, War and Tempest. Each test cites the rule it checks.
import { describe, expect, it } from 'vitest';
import { act, advance, featureList, readyParty } from '../../src/game/combat';
import { weapons } from '../../src/data';
import { armorProficient, weaponProficient } from '../../src/game/gear';
import {
  domainSpellsOf,
  resourceLeft,
  resourceMax,
  subclassName,
  subclassOf,
  type Hero,
} from '../../src/game/hero';
import { levelUpOptions } from '../../src/game/levelup';
import { heroOf } from '../../src/game/combat/core';
import type { CombatState } from '../../src/game/combat';
import { arrange, fight, party, texts, withSeed } from './combat/arrange';
import { hero } from './combat/helpers';

/** A cleric of this domain at this level. */
const D = (domain: string, level: number, name = 'Ada'): Hero =>
  readyParty([hero('cleric', name, { subclassId: domain })], level)[0]!;
const F = (lead: Hero, seed = 1) => fight('f13-cloister', party(lead, lead.level), seed);
const left = (s: CombatState, id: string, res: string) =>
  resourceLeft(heroOf(s.combatants[id]!)!, res);
const longsword = weapons.find((w) => w.id === 'longsword')!;

describe('choosing a domain', () => {
  it('each domain keeps its own name, spells and armor (PHB: Divine Domain)', () => {
    const light = D('light', 1);
    expect(subclassName(light)).toBe('Light Domain');
    expect(domainSpellsOf(light)).toEqual(
      expect.arrayContaining(['light', 'burning-hands', 'faerie-fire']),
    );
    expect(domainSpellsOf(light)).not.toContain('fireball');
    expect(domainSpellsOf(D('light', 5))).toContain('fireball');
    // PHB: Life, War and Tempest grant heavy armor; Light does not, so its kit swaps chain mail for scale.
    expect(armorProficient(light, 'chain-mail')).toBe(false);
    expect(light.equipment.armor).toBe('scale-mail');
    expect(armorProficient(D('life', 1), 'chain-mail')).toBe(true);
    // PHB: War and Tempest grant martial weapons.
    expect(weaponProficient(D('war', 1), longsword)).toBe(true);
    expect(weaponProficient(D('tempest', 1), longsword)).toBe(true);
    expect(weaponProficient(light, longsword)).toBe(false);
  });
  it('a cleric from an old save (no domain stored) is still a Life cleric', () => {
    const old = { ...D('life', 3) };
    delete (old as { subclassId?: string }).subclassId;
    expect(subclassOf(old)).toBe('life');
    expect(domainSpellsOf(old)).toEqual(expect.arrayContaining(['bless', 'cure-wounds']));
  });
  it('uses equal to Wisdom modifier (min 1) for the domain reaction (PHB)', () => {
    const light = D('light', 1);
    const wis = Math.max(1, Math.floor((light.abilities.wis - 10) / 2));
    expect(resourceMax(light, 'warding-flare')).toBe(wis);
    expect(resourceMax(light, 'wrath-of-the-storm')).toBe(0);
    expect(resourceMax(D('tempest', 1), 'wrath-of-the-storm')).toBe(wis);
  });
  it('level-up shows only your own domain’s features', () => {
    const at2 = levelUpOptions(D('light', 1)).features.map((f) => f.id);
    expect(at2).toContain('radiance-of-the-dawn');
    expect(at2).not.toContain('preserve-life');
    expect(at2).not.toContain('guided-strike');
    const life = levelUpOptions(D('life', 1)).features.map((f) => f.id);
    expect(life).toContain('preserve-life');
  });
  it('Preserve Life is Life only; every cleric can Turn Undead (PHB)', () => {
    const s = F(D('war', 2));
    const ids = featureList(s.combatants['ada']!, s).map((f) => f.id);
    expect(ids).not.toContain('preserve-life');
    expect(ids).toContain('turn-undead');
    expect(ids).toContain('guided-strike');
  });
});

describe('Light Domain', () => {
  it('Radiance of the Dawn: enemies within 30 ft save or take 2d10 + level radiant (PHB)', () => {
    const s = arrange(
      F(D('light', 2)),
      { ada: { x: 5, y: 4 }, 'cultist-a': { x: 7, y: 2 }, fanatic: { x: 14, y: 4 } },
      'ada',
    );
    const r = act(s, { type: 'feature', id: 'radiance-of-the-dawn' });
    expect(r.error).toBeUndefined();
    const t = texts(r.state);
    expect(t).toMatch(/Cultist A.*Con \(Radiance of the Dawn\)/);
    expect(t).not.toMatch(/Fanatic.*Radiance/); // 45 ft away
    expect(t).toMatch(/Radiance of the Dawn: 2d10\+2/);
    expect(left(r.state, 'ada', 'channel-divinity')).toBe(0);
  });
  it('Warding Flare: the reaction gives an attacker disadvantage (PHB) [used automatically]', () => {
    let s = F(D('light', 1));
    s = arrange(s, { ada: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } }, 'cultist-a');
    const out = advance(s);
    const t = texts(out);
    expect(t).toMatch(/Ada flares with light: Cultist A is dazzled/);
    expect(t).toMatch(/Cultist A attacks Ada .*d20 dis/);
    expect(out.combatants['ada']!.reactionUsed).toBe(true);
  });
  it('Improved Flare (cleric 6) also shields an ally (PHB)', () => {
    let s = F(D('light', 6));
    s = arrange(
      s,
      { ada: { x: 6, y: 4 }, thorn: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } },
      'cultist-a',
    );
    // Only Thorn is in reach.
    for (const id of ['ilse', 'wren']) s.combatants[id]!.pos = { x: 1, y: 7 - id.length };
    const out = advance(s);
    expect(texts(out)).toMatch(/Ada flares with light/);
  });
});

describe('War Domain', () => {
  it('War Priest: a bonus-action weapon attack after the Attack action (PHB)', () => {
    let s = arrange(F(D('war', 1)), { ada: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } }, 'ada');
    expect(act(s, { type: 'feature', id: 'war-priest', targetId: 'cultist-a' }).error).toMatch(
      /Attack action first/,
    );
    s = act(s, { type: 'attack', targetId: 'cultist-a', optionId: 'mace' }).state;
    if (s.combatants['cultist-a']!.creature.dead) return;
    const before = left(s, 'ada', 'war-priest');
    const r = act(s, { type: 'feature', id: 'war-priest', targetId: 'cultist-a' });
    expect(r.error).toBeUndefined();
    expect(texts(r.state)).toMatch(/War Priest: Ada strikes again/);
    expect(left(r.state, 'ada', 'war-priest')).toBe(before - 1);
    expect(r.state.combatants['ada']!.turn.bonusUsed).toBe(true);
  });
  it('Guided Strike: +10 turns a near miss into a hit; Channel Divinity only spent if needed (PHB)', () => {
    const make = (seed: number) => {
      let s = arrange(
        F(D('war', 2), seed),
        { ada: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } },
        'ada',
      );
      s.combatants['cultist-a']!.creature = { ...s.combatants['cultist-a']!.creature, ac: 22 };
      s = act(s, { type: 'feature', id: 'guided-strike' }).state;
      return act(s, { type: 'attack', targetId: 'cultist-a', optionId: 'mace' }).state;
    };
    const out = withSeed(make, (x) => /Guided Strike: \+10/.test(texts(x)));
    expect(texts(out)).toMatch(/Guided Strike: \+10 → now \d+, a HIT/);
    expect(left(out, 'ada', 'channel-divinity')).toBe(0);
    // A clean miss (natural 1) never spends it.
    const miss = withSeed(make, (x) => /d20 \(1\)/.test(texts(x)));
    expect(left(miss, 'ada', 'channel-divinity')).toBe(1);
  });
  it("War God's Blessing (cleric 6): the reaction adds +10 to an ally's attack (PHB)", () => {
    const make = (seed: number) => {
      const s = arrange(
        F(D('war', 6), seed),
        { ada: { x: 6, y: 4 }, thorn: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } },
        'thorn',
      );
      s.combatants['cultist-a']!.creature = { ...s.combatants['cultist-a']!.creature, ac: 24 };
      return act(s, { type: 'attack', targetId: 'cultist-a', optionId: 'mace' }).state;
    };
    const out = withSeed(make, (x) => /War God's Blessing/.test(texts(x)));
    expect(texts(out)).toMatch(/Ada calls War God's Blessing on Thorn: \+10 → now \d+, a HIT/);
    expect(out.combatants['ada']!.reactionUsed).toBe(true);
  });
});

describe('Tempest Domain', () => {
  it('Destructive Wrath: the next thunder damage is rolled at its maximum (PHB)', () => {
    let s = arrange(
      F(D('tempest', 2)),
      { ada: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } },
      'ada',
    );
    s = act(s, { type: 'feature', id: 'destructive-wrath' }).state;
    expect(left(s, 'ada', 'channel-divinity')).toBe(1); // readied, not yet spent
    const r = act(s, {
      type: 'cast',
      spellId: 'thunderwave',
      slotLevel: 1,
      point: { x: 9, y: 4 },
    });
    expect(r.error).toBeUndefined();
    expect(texts(r.state)).toMatch(
      /Destructive Wrath: Ada's thunder damage is rolled at its maximum/,
    );
    expect(texts(r.state)).toMatch(/2d8 \(8, 8\)/);
    expect(left(r.state, 'ada', 'channel-divinity')).toBe(0);
  });
  it('Wrath of the Storm: hit from 5 ft, the attacker takes 2d8 lightning, Dex half (PHB) [used automatically]', () => {
    let s = F(D('tempest', 1));
    s = arrange(s, { ada: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } }, 'cultist-a');
    s.combatants['ada']!.creature = { ...s.combatants['ada']!.creature, ac: 1 };
    const out = advance(s);
    const t = texts(out);
    expect(t).toMatch(/Ada answers with the Wrath of the Storm/);
    expect(t).toMatch(/Wrath of the Storm: 2d8 .* lightning/);
    expect(t).not.toMatch(/Thunderbolt Strike/); // that comes at cleric 6
  });
  it('Thunderbolt Strike (cleric 6): lightning from the cleric pushes the creature 10 ft (PHB)', () => {
    let s = F(D('tempest', 6));
    s = arrange(s, { ada: { x: 8, y: 4 }, 'cultist-a': { x: 9, y: 4 } }, 'cultist-a');
    s.combatants['ada']!.creature = { ...s.combatants['ada']!.creature, ac: 1 };
    const out = advance(s);
    expect(texts(out)).toMatch(/Thunderbolt Strike hurls Cultist A back/);
  });
});
