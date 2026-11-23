// D34: long spells cast before or during a fight last into the next one while their time runs:
// Aid and Mage Armor (8 hours), and the temporary hit points of Armor of Agathys and False Life
// (1 hour, or until used up). The game clock counts hours (calendar.ts).
import type { Buff, Hero } from '../hero';
import { addEffect, heroOf, say, type Ctx } from './core';
import type { Combatant } from './types';

/** How long each lasting spell runs, in hours (PHB). */
export const BUFF_HOURS: Record<Buff['spell'], number> = {
  aid: 8,
  'mage-armor': 8,
  'armor-of-agathys': 1,
  'false-life': 1,
};

const NAMES: Record<Buff['spell'], string> = {
  aid: 'Aid',
  'mage-armor': 'Mage Armor',
  'armor-of-agathys': 'Armor of Agathys',
  'false-life': 'False Life',
};

/** When an effect ends: the hour it carried in with, or `hours` from the clock if cast now. */
const untilOf = (
  data: Record<string, string | number> | undefined,
  clock: number,
  hours: number,
) => (typeof data?.until === 'number' ? data.until : clock + hours);

/**
 * What still runs on a hero when the fight ends. Read before the fight's clean-up (Aid's extra
 * hit points are taken off, temporary HP cleared).
 */
export function buffsAfterFight(c: Combatant, h: Hero, clock: number): Buff[] {
  if (h.dead || h.hp <= 0) return [];
  const out: Buff[] = [];
  const aid = c.effects.find((e) => e.tag === 'aid');
  if (aid) {
    const amount = Number(aid.data?.amount ?? 0);
    out.push({
      spell: 'aid',
      until: untilOf(aid.data, clock, BUFF_HOURS.aid),
      amount,
      // The part of Aid's +HP not yet lost to wounds comes back with it.
      hpAbove: Math.max(0, Math.min(amount, h.hp - (h.maxHp - amount))),
    });
  }
  const armor = c.effects.find((e) => e.tag === 'mage-armor');
  if (armor)
    out.push({ spell: 'mage-armor', until: untilOf(armor.data, clock, BUFF_HOURS['mage-armor']) });
  const temp = c.effects.find((e) => e.tag === 'spell-temp-hp');
  if (temp && h.tempHp > 0) {
    const spell = temp.data?.spell === 'false-life' ? 'false-life' : 'armor-of-agathys';
    const agathys = c.effects.find((e) => e.tag === 'agathys');
    out.push({
      spell,
      until: untilOf(temp.data, clock, BUFF_HOURS[spell]),
      tempHp: h.tempHp,
      ...(agathys ? { cold: Number(agathys.data?.cold ?? 5) } : {}),
    });
  }
  return out;
}

/** At the start of a fight: put back every lasting spell still within its time. */
export function restoreBuffs(ctx: Ctx, clock: number): void {
  const { s } = ctx;
  const still: string[] = [];
  for (const c of Object.values(s.combatants)) {
    const h = heroOf(c);
    if (!h?.buffs?.length) continue;
    const live = h.buffs.filter((b) => b.until > clock);
    for (const b of live) {
      const data = { until: b.until };
      if (b.spell === 'aid' && b.amount) {
        addEffect(c, {
          id: 'aid',
          name: 'Aid',
          sourceId: c.id,
          tag: 'aid',
          data: { ...data, amount: b.amount },
        });
        c.creature = {
          ...c.creature,
          maxHp: c.creature.maxHp + b.amount,
          hp: c.creature.hp > 0 ? c.creature.hp + (b.hpAbove ?? 0) : c.creature.hp,
        };
      } else if (b.spell === 'mage-armor') {
        if (!c.effects.some((e) => e.tag === 'mage-armor'))
          addEffect(c, {
            id: 'mage-armor',
            name: 'Mage Armor',
            sourceId: c.id,
            tag: 'mage-armor',
            data,
          });
      } else if (b.tempHp) {
        c.creature = { ...c.creature, tempHp: Math.max(c.creature.tempHp, b.tempHp) };
        addEffect(c, {
          id: 'spell-temp-hp',
          name: NAMES[b.spell],
          sourceId: c.id,
          tag: 'spell-temp-hp',
          data: { ...data, spell: b.spell },
        });
        if (b.cold)
          addEffect(c, {
            id: 'agathys',
            name: 'Armor of Agathys',
            sourceId: c.id,
            tag: 'agathys',
            data: { ...data, cold: b.cold },
          });
      }
      still.push(`${c.name}'s ${NAMES[b.spell]}`);
    }
    c.creature = { ...(c.creature as Hero), buffs: [] };
  }
  if (still.length) say(s, 'you', `Still in effect from earlier: ${still.join(', ')}`);
}
