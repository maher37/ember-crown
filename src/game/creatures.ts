import { foes, monsters } from '../data';
import { crProficiency, type Monster } from '../data/schemas/monster';
import { ABILITIES, parseDice, type Creature, type DieSize } from '../rules';

/** Turn a monster stat block into a rules-engine creature, ready to fight. */
export function monsterToCreature(m: Monster, id = m.id, name = m.name): Creature {
  const hd = m.hitDice ? parseDice(m.hitDice) : { count: 1, sides: 8 };
  return {
    id,
    name,
    kind: 'monster',
    level: 1,
    xp: 0,
    proficiencyBonus: crProficiency(m.cr),
    abilities: m.abilities as Creature['abilities'],
    // Monsters list total save bonuses; treat any listed save as proficient [inferred approximation].
    saveProficiencies: ABILITIES.filter((a) => m.saves[a] !== undefined),
    ac: m.ac,
    maxHp: m.hp,
    hp: m.hp,
    tempHp: 0,
    hitDice: { die: (hd.sides || 8) as DieSize, total: hd.count, remaining: hd.count },
    conditions: [],
    exhaustion: 0,
    deathSaves: { successes: 0, failures: 0 },
    stable: false,
    dead: false,
    // Nonmagical-only resistance is applied in full until magic weapons arrive (M4).
    defenses: {
      resistances: m.resistances,
      vulnerabilities: m.vulnerabilities,
      immunities: m.immunities,
    },
    concentration: null,
  };
}

export function getMonster(id: string): Monster {
  const m = monsters.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown monster "${id}"`);
  return m;
}

/** A named foe (Brother Ulric, Scald...) as a creature, with its overrides applied. */
export function foeToCreature(foeId: string): Creature {
  const f = foes.find((x) => x.id === foeId);
  if (!f) throw new Error(`Unknown foe "${foeId}"`);
  const c = monsterToCreature(getMonster(f.base), f.id, f.name);
  const hp = f.overrides.hp ?? c.maxHp;
  return {
    ...c,
    kind: f.knockedOutAtZero ? 'villain' : 'monster',
    ac: f.overrides.ac ?? c.ac,
    maxHp: hp,
    hp,
  };
}
