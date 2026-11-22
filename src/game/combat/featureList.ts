import { resourceLeft, slotsLeft, subclassOf } from '../hero';
import { abilityModifier } from '../../rules';
import { hasEffect, heroOf, isSub } from './core';
import { conscious } from './grid';
import { speedNow } from './turn';
import type { CombatState, Combatant } from './types';
import { actionFree } from './basics';

// Which class features a hero can use in combat right now (split from actions.ts).

export type FeatureId =
  | 'second-wind'
  | 'action-surge'
  | 'rage'
  | 'reckless'
  | 'bardic-inspiration'
  | 'preserve-life'
  | 'turn-undead'
  | 'wild-shape'
  | 'revert'
  | 'lay-on-hands'
  | 'flurry'
  | 'martial-arts'
  | 'patient-defense'
  | 'step-dash'
  | 'step-disengage'
  | 'cunning-dash'
  | 'cunning-disengage'
  | 'cunning-hide'
  | 'font-create-slot'
  | 'font-make-points'
  | 'rage-frenzy'
  | 'frenzy-attack'
  | 'flurry-prone'
  | 'flurry-push'
  | 'flurry-no-reactions'
  | 'sacred-weapon'
  | 'turn-the-unholy'
  | 'horde-breaker'
  | 'spiritual-weapon'
  | 'call-lightning'
  | 'heat-metal'
  | 'vampiric-touch'
  | 'wholeness-of-body'
  | 'move-mark'
  | 'radiance-of-the-dawn'
  | 'guided-strike'
  | 'war-priest'
  | 'destructive-wrath'
  | 'eagle-dash'
  | 'vow-of-enmity'
  | 'abjure-enemy';

// ── Class features through level 2 ──

export interface FeatureInfo {
  id: FeatureId;
  name: string;
  cost: 'action' | 'bonus' | 'free';
  detail: string;
  /** Needs a target: an ally or an enemy. */
  target?: 'ally' | 'enemy';
  blocked?: string;
}

export const left = (c: Combatant, id: string) => resourceLeft(heroOf(c)!, id);

/** The class features a hero can use in combat right now. */
/** Class features usable now. `s` (the fight) lets features look at other creatures. */
export function featureList(c: Combatant, s?: CombatState): FeatureInfo[] {
  const h = heroOf(c);
  if (!h) return [];
  const out: FeatureInfo[] = [];
  const t = c.turn;
  const bonus = (b?: string) => b ?? (t.bonusUsed ? 'bonus action used' : undefined);
  const action = (b?: string) => b ?? (actionFree(c) ? undefined : 'action used');
  const lvl = (cls: string) => (h.classId === cls ? h.level : 0);
  const res = (id: string, n = 1) => (left(c, id) >= n ? undefined : 'none left');

  if (lvl('fighter')) {
    out.push({
      id: 'second-wind',
      name: 'Second Wind',
      cost: 'bonus',
      detail: `heal 1d10+${h.level} · ${left(c, 'second-wind')} left`,
      blocked: bonus(res('second-wind')),
    });
    if (h.level >= 2)
      out.push({
        id: 'action-surge',
        name: 'Action Surge',
        cost: 'free',
        detail: `extra action · ${left(c, 'action-surge')} left`,
        blocked: res('action-surge'),
      });
  }
  if (lvl('barbarian')) {
    const raging = hasEffect(c, 'rage');
    out.push({
      id: 'rage',
      name: raging ? 'Raging' : 'Rage',
      cost: 'bonus',
      detail: `+2 damage, resist weapons · ${left(c, 'rage')} left`,
      blocked: raging
        ? 'already raging'
        : h.equipment.armor && /plate|splint|chain-mail|ring/.test(h.equipment.armor)
          ? 'not in heavy armor'
          : bonus(res('rage')),
    });
    if (h.level >= 2)
      out.push({
        id: 'reckless',
        name: 'Reckless Attack',
        cost: 'free',
        detail: 'advantage now; enemies get advantage on you',
        blocked: t.attacked
          ? 'only before your first attack'
          : hasEffect(c, 'reckless')
            ? 'already reckless'
            : undefined,
      });
  }
  if (lvl('bard'))
    out.push({
      id: 'bardic-inspiration',
      name: 'Bardic Inspiration',
      cost: 'bonus',
      detail: `give an ally a d${h.level >= 5 ? 8 : 6} · ${left(c, 'bardic-inspiration')} left`,
      target: 'ally',
      blocked: bonus(res('bardic-inspiration')),
    });
  // Cleric domains (D4, Nov 21): each domain's own Channel Divinity and features.
  const domain = lvl('cleric') ? subclassOf(h) : null;
  if (domain === 'light' && lvl('cleric') >= 2)
    out.push({
      id: 'radiance-of-the-dawn',
      name: 'Radiance of the Dawn',
      cost: 'action',
      detail: `enemies within 30 ft: Con save or 2d10+${h.level} radiant (half on a save) · Channel Divinity ${left(c, 'channel-divinity')}`,
      blocked: action(res('channel-divinity')),
    });
  if (domain === 'war') {
    out.push({
      id: 'war-priest',
      name: 'War Priest attack',
      cost: 'bonus',
      detail: `one more weapon attack after the Attack action · ${left(c, 'war-priest')} left`,
      target: 'enemy',
      blocked: !c.turn.attacked ? 'take the Attack action first' : bonus(res('war-priest')),
    });
    if (lvl('cleric') >= 2)
      out.push({
        id: 'guided-strike',
        name: 'Guided Strike',
        cost: 'free',
        detail: `if an attack misses this turn by 10 or less, +10 to hit · Channel Divinity ${left(c, 'channel-divinity')}`,
        blocked: hasEffect(c, 'guided-strike') ? 'already guided' : res('channel-divinity'),
      });
  }
  if (domain === 'tempest' && lvl('cleric') >= 2)
    out.push({
      id: 'destructive-wrath',
      name: 'Destructive Wrath',
      cost: 'free',
      detail: `your next lightning or thunder damage this turn is rolled at its maximum · Channel Divinity ${left(c, 'channel-divinity')}`,
      blocked: hasEffect(c, 'destructive-wrath') ? 'already ready' : res('channel-divinity'),
    });
  if (lvl('cleric') >= 2 && domain === 'life')
    out.push({
      id: 'preserve-life',
      name: 'Preserve Life',
      cost: 'action',
      detail: `share ${5 * h.level} HP of healing · Channel Divinity ${left(c, 'channel-divinity')}`,
      blocked: action(res('channel-divinity')),
    });
  if (lvl('cleric') >= 2) {
    out.push({
      id: 'turn-undead',
      name: 'Turn Undead',
      cost: 'action',
      detail: 'undead within 30 ft flee',
      blocked: action(res('channel-divinity')),
    });
  }
  if (lvl('druid') >= 2) {
    if (c.wildShape)
      out.push({
        id: 'revert',
        name: 'Leave beast form',
        cost: 'bonus',
        detail: 'return to your normal form',
        blocked: bonus(),
      });
    else
      out.push({
        id: 'wild-shape',
        name: 'Wild Shape: Wolf',
        cost: 'action',
        detail: `become a wolf (11 HP) · ${left(c, 'wild-shape')} left`,
        blocked: action(res('wild-shape')),
      });
  }
  if (lvl('paladin'))
    out.push({
      id: 'lay-on-hands',
      name: 'Lay on Hands',
      cost: 'action',
      detail: `heal by touch · ${left(c, 'lay-on-hands')} HP in pool`,
      target: 'ally',
      blocked: action(res('lay-on-hands')),
    });
  if (lvl('monk')) {
    const monkHit = t.attacked;
    out.push({
      id: 'martial-arts',
      name: 'Martial Arts strike',
      cost: 'bonus',
      detail: 'unarmed strike after attacking',
      target: 'enemy',
      blocked: bonus(monkHit ? undefined : 'attack first'),
    });
    if (h.level >= 2) {
      out.push({
        id: 'flurry',
        name: 'Flurry of Blows',
        cost: 'bonus',
        detail: `two unarmed strikes · 1 ki (${left(c, 'ki')} left)`,
        target: 'enemy',
        blocked: bonus(monkHit ? res('ki') : 'attack first'),
      });
      out.push({
        id: 'patient-defense',
        name: 'Patient Defense',
        cost: 'bonus',
        detail: 'Dodge · 1 ki',
        blocked: bonus(res('ki')),
      });
      out.push({
        id: 'step-dash',
        name: 'Step of the Wind: Dash',
        cost: 'bonus',
        detail: '1 ki',
        blocked: bonus(res('ki')),
      });
      out.push({
        id: 'step-disengage',
        name: 'Step of the Wind: Disengage',
        cost: 'bonus',
        detail: '1 ki',
        blocked: bonus(res('ki')),
      });
    }
  }
  if (lvl('rogue') >= 2) {
    out.push({
      id: 'cunning-dash',
      name: 'Cunning Action: Dash',
      cost: 'bonus',
      detail: 'bonus-action Dash',
      blocked: bonus(),
    });
    out.push({
      id: 'cunning-disengage',
      name: 'Cunning Action: Disengage',
      cost: 'bonus',
      detail: 'bonus-action Disengage',
      blocked: bonus(),
    });
    out.push({
      id: 'cunning-hide',
      name: 'Cunning Action: Hide',
      cost: 'bonus',
      detail: 'bonus-action Hide',
      blocked: bonus(),
    });
  }
  if (lvl('sorcerer') >= 2) {
    out.push({
      id: 'font-create-slot',
      name: 'Font of Magic: make a slot',
      cost: 'bonus',
      detail: `2 sorcery points → 1st-level slot (${left(c, 'sorcery-points')} pts)`,
      blocked: bonus(res('sorcery-points', 2)),
    });
    out.push({
      id: 'font-make-points',
      name: 'Font of Magic: make points',
      cost: 'bonus',
      detail: 'spend a slot for sorcery points',
      blocked: bonus(slotsLeft(h).some((n) => n > 0) ? undefined : 'no slots'),
    });
  }
  // ── Level 3 subclass features ──
  if (lvl('barbarian') >= 3 && isSub(c, 'barbarian', 'berserker')) {
    if (!hasEffect(c, 'rage'))
      out.push({
        id: 'rage-frenzy',
        name: 'Rage (Frenzy)',
        cost: 'bonus',
        detail: 'rage, and attack as a bonus action each turn; 1 exhaustion afterwards',
        blocked:
          h.equipment.armor && /plate|splint|chain-mail|ring/.test(h.equipment.armor)
            ? 'not in heavy armor'
            : bonus(res('rage')),
      });
    if (hasEffect(c, 'frenzy'))
      out.push({
        id: 'frenzy-attack',
        name: 'Frenzy attack',
        cost: 'bonus',
        detail: 'one melee weapon attack',
        target: 'enemy',
        blocked: bonus(),
      });
  }
  if (lvl('monk') >= 3) {
    const flurry = (id: FeatureId, name: string, detail: string) =>
      out.push({
        id,
        name,
        cost: 'bonus',
        detail: `${detail} · 1 ki`,
        target: 'enemy',
        blocked: bonus(t.attacked ? res('ki') : 'attack first'),
      });
    flurry('flurry-prone', 'Flurry: knock prone', 'two strikes; each hit: Dex save or prone');
    flurry('flurry-push', 'Flurry: push 15 ft', 'two strikes; each hit: Str save or pushed');
    flurry('flurry-no-reactions', 'Flurry: no reactions', 'two strikes; each hit stops reactions');
  }
  if (lvl('paladin') >= 3 && isSub(c, 'paladin', 'devotion')) {
    out.push({
      id: 'sacred-weapon',
      name: 'Sacred Weapon',
      cost: 'action',
      detail: `+${Math.max(1, abilityModifier(h.abilities.cha))} to weapon attacks for 1 minute · Channel Divinity`,
      blocked: action(hasEffect(c, 'sacred-weapon') ? 'already active' : res('channel-divinity')),
    });
    out.push({
      id: 'turn-the-unholy',
      name: 'Turn the Unholy',
      cost: 'action',
      detail: 'fiends and undead within 30 ft flee',
      blocked: action(res('channel-divinity')),
    });
  }
  if (lvl('ranger') >= 3 && h.choices['hunters-prey']?.includes('horde-breaker'))
    out.push({
      id: 'horde-breaker',
      name: 'Horde Breaker',
      cost: 'free',
      detail: 'one more attack on a creature next to your last target',
      target: 'enemy',
      blocked:
        t.attacked && !t.hordeUsed ? undefined : t.hordeUsed ? 'once per turn' : 'attack first',
    });
  // PHB: Totem Warrior (Eagle). While raging, Dash as a bonus action.
  if (isSub(c, 'barbarian', 'totem-eagle', 3) && hasEffect(c, 'rage'))
    out.push({
      id: 'eagle-dash',
      name: 'Eagle Dash',
      cost: 'bonus',
      detail: `+${speedNow(c)} ft of movement this turn`,
      blocked: bonus(),
    });
  // PHB: Oath of Vengeance. Channel Divinity: Vow of Enmity, Abjure Enemy.
  if (isSub(c, 'paladin', 'vengeance', 3)) {
    out.push({
      id: 'vow-of-enmity',
      name: 'Vow of Enmity',
      cost: 'bonus',
      detail: `advantage on attacks against one foe within 10 ft for 1 minute · Channel Divinity ${left(c, 'channel-divinity')}`,
      target: 'enemy',
      blocked: bonus(res('channel-divinity')),
    });
    out.push({
      id: 'abjure-enemy',
      name: 'Abjure Enemy',
      cost: 'action',
      detail: `one foe within 60 ft: Wis save or frightened and unable to move · Channel Divinity ${left(c, 'channel-divinity')}`,
      target: 'enemy',
      blocked: action(res('channel-divinity')),
    });
  }
  if (lvl('monk') >= 6)
    out.push({
      id: 'wholeness-of-body',
      name: 'Wholeness of Body',
      cost: 'action',
      detail: `heal ${3 * lvl('monk')} HP · once per long rest`,
      blocked: action(res('wholeness-of-body')),
    });
  // PHB: Hex / Hunter's Mark. When the marked creature drops to 0 HP, move the mark to a new
  // creature as a bonus action [inferred: allowed on the same turn too].
  const markSpell = c.creature.concentration;
  if (s && (markSpell === 'hex' || markSpell === 'hunters-mark')) {
    const tag = markSpell === 'hex' ? 'hex-target' : 'hunters-mark-target';
    const marked = Object.values(s.combatants).some(
      (x) => conscious(x) && x.effects.some((e) => e.tag === tag && e.sourceId === c.id),
    );
    if (!marked)
      out.push({
        id: 'move-mark',
        name: markSpell === 'hex' ? 'Hex: curse a new target' : "Hunter's Mark: mark a new target",
        cost: 'bonus',
        detail: 'the last one dropped; move it without a new spell slot',
        target: 'enemy',
        blocked: bonus(),
      });
  }
  const lightning = c.effects.find((e) => e.tag === 'call-lightning');
  if (lightning)
    out.push({
      id: 'call-lightning',
      name: 'Call Lightning',
      cost: 'action',
      detail: `another bolt (${lightning.data?.dice} lightning, Dex save half) on an enemy and anyone within 5 ft`,
      target: 'enemy',
      blocked: action(),
    });
  if (hasEffect(c, 'heat-metal'))
    out.push({
      id: 'heat-metal',
      name: 'Heat Metal',
      cost: 'bonus',
      detail: 'burn the heated creature again (2d8 fire)',
      target: 'enemy',
      blocked: bonus(),
    });
  if (hasEffect(c, 'vampiric-touch'))
    out.push({
      id: 'vampiric-touch',
      name: 'Vampiric Touch',
      cost: 'action',
      detail: 'another draining touch (melee spell attack; heal half)',
      target: 'enemy',
      blocked: action(),
    });
  if (hasEffect(c, 'spiritual-weapon'))
    out.push({
      id: 'spiritual-weapon',
      name: 'Spiritual Weapon attack',
      cost: 'bonus',
      detail: 'the floating weapon strikes (melee spell attack)',
      target: 'enemy',
      blocked: bonus(),
    });
  return out;
}
