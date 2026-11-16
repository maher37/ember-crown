/**
 * A tiny scripted duel used to exercise the whole engine together. This is a test harness, not
 * the real combat system (that's Milestone M4: grid, turn order, action economy, AI).
 */
import {
  applyDamage,
  attackRoll,
  deathSave,
  describeTotal,
  isDying,
  mod,
  rollD20,
  rollDamage,
  type Creature,
  type DamagePart,
  type RandomSource,
} from '../../../src/rules';

export interface Fighter {
  creature: Creature;
  weapon: { name: string; attackBonus: number; damage: DamagePart };
}

export function runDuel(a: Fighter, b: Fighter, rng: RandomSource, maxRounds = 20): string[] {
  const lines: string[] = [];
  const say = (t: string) => lines.push(t);

  // Initiative: a Dexterity check each; higher goes first (ties: the first fighter).
  const init = [a, b].map((f) => {
    const r = rollD20('normal', rng);
    const m = mod(f.creature, 'dex');
    say(`${f.creature.name} initiative: ${describeTotal(r, m)}`);
    return r.natural + m;
  });
  const order = init[0]! >= init[1]! ? [a, b] : [b, a];
  say(`${order[0]!.creature.name} acts first.`);

  for (let round = 1; round <= maxRounds; round++) {
    say(`— Round ${round} —`);
    for (const [me, foe] of [order, [order[1]!, order[0]!]] as [Fighter, Fighter][]) {
      if (me.creature.dead) continue;
      if (isDying(me.creature)) {
        const s = deathSave(me.creature, rng);
        me.creature = s.creature;
        s.log.forEach((l) => say(l.text));
        if (s.outcome !== 'revived') continue;
      }
      if (me.creature.hp === 0) continue; // stable but unconscious
      if (foe.creature.dead) continue;

      // Stand up from prone if needed (costs half movement; no roll).
      if (me.creature.conditions.some((c) => c.id === 'prone')) {
        me.creature = {
          ...me.creature,
          conditions: me.creature.conditions.filter((c) => c.id !== 'prone'),
        };
        say(`${me.creature.name} stands up.`);
      }

      const atk = attackRoll(me.creature, foe.creature, rng, {
        attackBonus: me.weapon.attackBonus,
        melee: true,
        within5ft: true,
        label: me.weapon.name,
      });
      say(atk.log.text);
      if (!atk.hit) continue;
      const dmg = rollDamage([me.weapon.damage], atk.critical, rng, me.weapon.name);
      say(dmg.log.text);
      const res = applyDamage(foe.creature, dmg.instances, rng, {
        critical: atk.critical,
        melee: true,
      });
      foe.creature = res.creature;
      res.log.forEach((l) => say(l.text));
      say(`  ${foe.creature.name}: ${foe.creature.hp}/${foe.creature.maxHp} HP`);
    }
    const over = [a, b].find((f) => f.creature.dead || (f.creature.hp === 0 && f.creature.stable));
    if (over) {
      const winner = over === a ? b : a;
      say(`${winner.creature.name} wins the duel.`);
      return lines;
    }
  }
  say('Both fighters are still standing. The duel is a draw.');
  return lines;
}
