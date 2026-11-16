import { noDefenses, type Creature } from '../../../src/rules';

/** A plain level-1 hero with all 10s except where overridden. */
export function makeCreature(over: Partial<Creature> = {}): Creature {
  return {
    id: over.id ?? 'hero',
    name: over.name ?? 'Hero',
    kind: 'pc',
    level: 1,
    xp: 0,
    proficiencyBonus: 2,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saveProficiencies: [],
    ac: 10,
    maxHp: 10,
    hp: 10,
    tempHp: 0,
    hitDice: { die: 8, total: 1, remaining: 1 },
    conditions: [],
    exhaustion: 0,
    deathSaves: { successes: 0, failures: 0 },
    stable: false,
    dead: false,
    defenses: noDefenses(),
    concentration: null,
    ...over,
  };
}

/** A creature at 0 HP and dying. */
export function dying(over: Partial<Creature> = {}): Creature {
  return makeCreature({
    hp: 0,
    conditions: [{ id: 'unconscious' }, { id: 'prone' }],
    ...over,
  });
}
