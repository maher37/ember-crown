import { petFeature } from './petAbilities';
import { getMonster } from '../creatures';
import { casterNumbers, spiritAttack } from './spells';
import { slotsLeft, type Hero } from '../hero';
import { attackRoll, abilityModifier, addCondition, hasCondition, roll } from '../../rules';
import { attackBlocked, attackOptions, makeAttack } from './attacks';
import {
  addEffect,
  allies,
  classLevel,
  combatSave,
  currentAc,
  dealDamage,
  healCombatant,
  heroOf,
  hostiles,
  say,
  sayAll,
  spendResource,
  type Ctx,
} from './core';
import { conscious, distanceFeet, posKey, reachable } from './grid';
import { ABILITY_LONG, giveCondition, hexAbilityOf } from './leaves';
import { speedNow } from './turn';
import type { Combatant } from './types';
import { dodge, hide, hideProblem, spendAction } from './basics';
import { featureList, left, type FeatureId } from './featureList';

// Using a class feature in combat (split from actions.ts).

export function feature(
  ctx: Ctx,
  c: Combatant,
  id: FeatureId,
  targetId?: string,
): string | null | undefined {
  const { s, rng } = ctx;
  if (id.startsWith('pet-'))
    return petFeature(ctx, c, id, targetId ? s.combatants[targetId] : undefined);
  const info = featureList(c, ctx.s).find((f) => f.id === id);
  if (!info) return "You don't have that feature.";
  if (info.blocked) return `${info.name}: ${info.blocked}.`;
  const h = heroOf(c) as Hero;
  const target = targetId ? s.combatants[targetId] : undefined;
  if (info.target && !target) return 'Choose a target.';
  if (info.cost === 'bonus') c.turn.bonusUsed = true;
  if (info.cost === 'action' && !spendAction(c)) return 'No action left.';
  const me = (text: string) => say(s, 'you', text);

  switch (id) {
    case 'second-wind': {
      // PHB: Second Wind. Regain 1d10 + fighter level HP.
      spendResource(c, 'second-wind');
      const r = roll(`1d10+${h.level}`, rng);
      me(`Second Wind: ${r.text}`);
      healCombatant(ctx, c, r.total, 'Second Wind', c);
      return null;
    }
    case 'radiance-of-the-dawn': {
      // PHB: Light Domain, Radiance of the Dawn. Hostiles within 30 ft: Con save, 2d10 + level radiant.
      spendResource(c, 'channel-divinity');
      me(`${c.name} channels Radiance of the Dawn!`);
      const dc = 8 + h.proficiencyBonus + abilityModifier(h.abilities.wis);
      for (const t of hostiles(s, c).filter((x) => distanceFeet(c.pos, x.pos) <= 30)) {
        const sv = combatSave(ctx, t, 'con', dc, { label: 'Con (Radiance of the Dawn)' });
        const r = roll(`2d10+${h.level}`, rng);
        const amount = sv.success ? Math.floor(r.total / 2) : r.total;
        say(
          s,
          'dmg',
          `Radiance of the Dawn: ${r.text} radiant${sv.success ? ` (halved: ${amount})` : ''}`,
        );
        dealDamage(ctx, t, [{ amount, type: 'radiant' }], { attacker: c });
      }
      return null;
    }
    case 'guided-strike':
      // PHB: War Domain, Guided Strike (+10 to an attack roll, chosen after seeing it). Readied here;
      // Channel Divinity is spent only if a miss this turn needs it (attacks.ts).
      addEffect(c, {
        id: 'guided-strike',
        name: 'Guided Strike',
        sourceId: c.id,
        tag: 'guided-strike',
        expires: { turnOf: c.id, when: 'end', round: s.round },
      });
      me(`${c.name} readies a Guided Strike: the next miss this turn by 10 or less becomes a hit`);
      return null;
    case 'war-priest': {
      // PHB: War Domain, War Priest. A bonus-action weapon attack after the Attack action.
      const opt = attackOptions(c).find(
        (o) => !o.unarmed && target && !attackBlocked(ctx, c, target, o),
      );
      if (!target || !opt) return 'No target in reach of a weapon.';
      spendResource(c, 'war-priest');
      me(`War Priest: ${c.name} strikes again`);
      makeAttack(ctx, c, target, opt);
      return null;
    }
    case 'eagle-dash':
      c.turn.movement += speedNow(c);
      me(`${c.name} runs like a stooping eagle (+${speedNow(c)} ft)`);
      return null;
    case 'vow-of-enmity': {
      if (!target || target.side === c.side) return 'Choose an enemy.';
      if (distanceFeet(c.pos, target.pos) > 10) return 'Too far away (10 ft).';
      spendResource(c, 'channel-divinity');
      c.effects = c.effects.filter((e) => e.tag !== 'vow-of-enmity');
      addEffect(c, {
        id: 'vow-of-enmity',
        name: 'Vow of Enmity',
        sourceId: c.id,
        tag: 'vow-of-enmity',
        data: { targetId: target.id },
        expires: { turnOf: c.id, when: 'start', round: s.round + 10 },
      });
      me(`${c.name} swears a Vow of Enmity against ${target.name}`);
      return null;
    }
    case 'abjure-enemy': {
      if (!target || target.side === c.side) return 'Choose an enemy.';
      if (distanceFeet(c.pos, target.pos) > 60) return 'Too far away (60 ft).';
      spendResource(c, 'channel-divinity');
      const dc = 8 + h.proficiencyBonus + abilityModifier(h.abilities.cha);
      me(`${c.name} abjures ${target.name} (DC ${dc})`);
      const r = combatSave(ctx, target, 'wis', dc, { against: 'frightened', magic: true });
      if (!r.success) {
        giveCondition(ctx, c, target, 'frightened', { minutes: 1 }, undefined, 'wis', dc);
        if (hasCondition(target.creature, 'frightened'))
          addEffect(target, {
            id: 'abjure-enemy',
            name: 'Abjured (speed 0)',
            sourceId: c.id,
            tag: 'rooted',
          });
      }
      return null;
    }
    case 'destructive-wrath':
      // PHB: Tempest Domain, Destructive Wrath (maximum lightning or thunder damage).
      // Readied here; Channel Divinity is spent when the next such roll is made (leaves.ts).
      addEffect(c, {
        id: 'destructive-wrath',
        name: 'Destructive Wrath',
        sourceId: c.id,
        tag: 'destructive-wrath',
        expires: { turnOf: c.id, when: 'end', round: s.round },
      });
      me(
        `${c.name} readies Destructive Wrath: the next lightning or thunder this turn hits at full force`,
      );
      return null;
    case 'action-surge':
      spendResource(c, 'action-surge');
      c.turn.extraActions += 1;
      me(
        `Action Surge! ${c.name} gains one extra action: attack again, Dash to run further, Disengage, Dodge or cast.`,
      );
      return null;
    case 'rage':
      spendResource(c, 'rage');
      addEffect(c, {
        id: 'rage',
        name: 'Rage',
        sourceId: c.id,
        tag: 'rage',
        expires: { turnOf: c.id, when: 'start', round: s.round + 10 },
      });
      me(`${c.name} flies into a rage!`);
      return null;
    case 'reckless':
      addEffect(c, {
        id: 'reckless',
        name: 'Reckless Attack',
        sourceId: c.id,
        tag: 'reckless',
        expires: { turnOf: c.id, when: 'start', round: s.round + 1 },
      });
      me(`${c.name} attacks recklessly`);
      return null;
    case 'bardic-inspiration': {
      if (!target || target.side !== c.side || target.id === c.id)
        return 'Choose another party member.';
      if (distanceFeet(c.pos, target.pos) > 60) return 'Too far away (60 ft).';
      spendResource(c, 'bardic-inspiration');
      target.inspiration = h.level >= 5 ? 8 : 6;
      me(`${c.name} inspires ${target.name} (d${target.inspiration})`);
      return null;
    }
    case 'preserve-life': {
      // PHB: Preserve Life. Share 5 × cleric level HP among creatures within 30 ft, each up to half its max.
      spendResource(c, 'channel-divinity');
      let pool = 5 * h.level;
      const hurt = [
        c,
        ...allies(s, c),
        ...Object.values(s.combatants).filter(
          (x) => x.side === c.side && !x.creature.dead && x.creature.hp === 0,
        ),
      ]
        .filter((x, i, arr) => arr.indexOf(x) === i && distanceFeet(c.pos, x.pos) <= 30)
        .sort((a, b) => a.creature.hp / a.creature.maxHp - b.creature.hp / b.creature.maxHp);
      me(`${c.name} channels Preserve Life (${pool} HP)`);
      for (const x of hurt) {
        const cap = Math.max(0, Math.floor(x.creature.maxHp / 2) - x.creature.hp);
        const amount = Math.min(cap, pool);
        if (amount > 0) {
          healCombatant(ctx, x, amount, 'Preserve Life', c);
          pool -= amount;
        }
      }
      return null;
    }
    case 'turn-undead': {
      spendResource(c, 'channel-divinity');
      const dc = 8 + h.proficiencyBonus + abilityModifier(h.abilities.wis);
      me(`${c.name} presents a holy symbol: Turn Undead (DC ${dc})`);
      for (const u of hostiles(s, c).filter(
        (x) =>
          x.monsterId &&
          getMonster(x.monsterId).type === 'undead' &&
          distanceFeet(x.pos, c.pos) <= 30,
      )) {
        const r = combatSave(ctx, u, 'wis', dc, { against: 'frightened', magic: true });
        // PHB: Destroy Undead (cleric 5): undead of CR 1/2 or lower that fail are destroyed.
        const cr = getMonster(u.monsterId!).cr;
        const crValue = cr.includes('/')
          ? Number(cr.split('/')[0]) / Number(cr.split('/')[1])
          : Number(cr);
        if (!r.success && classLevel(c, 'cleric') >= 5 && crValue <= 0.5) {
          u.creature = { ...u.creature, hp: 0, dead: true };
          say(s, 'crit', `${u.name} crumbles to dust (Destroy Undead)`);
          continue;
        }
        if (!r.success)
          addEffect(u, {
            id: 'turned',
            name: 'Turned',
            sourceId: c.id,
            tag: 'turned',
            expires: { turnOf: c.id, when: 'start', round: s.round + 10 },
          });
      }
      return null;
    }
    case 'wild-shape': {
      // PHB: Wild Shape (v1: wolf only [inferred simplification]).
      spendResource(c, 'wild-shape');
      const wolf = getMonster('wolf');
      c.wildShape = { monsterId: 'wolf', hp: wolf.hp, maxHp: wolf.hp };
      if (c.creature.concentration)
        me(`${c.name} keeps concentrating on ${c.creature.concentration}`);
      c.turn.movement = Math.max(
        c.turn.movement,
        wolf.speed.walk - (speedNow({ ...c, wildShape: undefined }) - c.turn.movement),
      );
      me(`${c.name} becomes a wolf!`);
      return null;
    }
    case 'revert':
      c.wildShape = undefined;
      me(`${c.name} returns to their own form`);
      return null;
    case 'lay-on-hands': {
      if (!target || target.side !== c.side) return 'Choose a party member.';
      if (distanceFeet(c.pos, target.pos) > 5) return 'You must touch them (5 ft).';
      const need = target.creature.maxHp - target.creature.hp;
      const amount = Math.min(need, left(c, 'lay-on-hands'));
      if (amount <= 0) return `${target.name} is not hurt.`;
      spendResource(c, 'lay-on-hands', amount);
      healCombatant(ctx, target, amount, 'Lay on Hands', c);
      return null;
    }
    case 'martial-arts':
    case 'flurry': {
      if (!target || target.side === c.side) return 'Choose an enemy.';
      const unarmed = attackOptions(c).find((o) => o.unarmed)!;
      const blocked = attackBlocked(ctx, c, target, unarmed);
      if (blocked) return blocked;
      if (id === 'flurry') spendResource(c, 'ki');
      const n = id === 'flurry' ? 2 : 1;
      for (let i = 0; i < n && conscious(target); i++) makeAttack(ctx, c, target, unarmed);
      return null;
    }
    case 'patient-defense':
      spendResource(c, 'ki');
      dodge(s, c);
      return null;
    case 'step-dash':
    case 'cunning-dash':
      if (id === 'step-dash') spendResource(c, 'ki');
      c.turn.movement += speedNow(c);
      me(`${c.name} dashes (bonus action)`);
      return null;
    case 'step-disengage':
    case 'cunning-disengage':
      if (id === 'step-disengage') spendResource(c, 'ki');
      c.turn.disengaged = true;
      me(`${c.name} disengages (bonus action)`);
      return null;
    case 'cunning-hide': {
      const why = hideProblem(s, c);
      if (why) {
        c.turn.bonusUsed = false;
        return why;
      }
      hide(ctx, c);
      return null;
    }
    case 'font-create-slot': {
      // PHB: Font of Magic. 2 sorcery points make a 1st-level slot.
      spendResource(c, 'sorcery-points', 2);
      const hero = heroOf(c)!;
      const used = [...hero.slotsUsed];
      used[0] = (used[0] ?? 0) - 1;
      c.creature = { ...hero, slotsUsed: used };
      me(`${c.name} shapes 2 sorcery points into a 1st-level spell slot`);
      return null;
    }
    case 'font-make-points': {
      const hero = heroOf(c)!;
      const lvlIdx = slotsLeft(hero).findIndex((n) => n > 0);
      const used = [...hero.slotsUsed];
      used[lvlIdx] = (used[lvlIdx] ?? 0) + 1;
      const spent = hero.resourcesUsed['sorcery-points'] ?? 0;
      c.creature = {
        ...hero,
        slotsUsed: used,
        resourcesUsed: {
          ...hero.resourcesUsed,
          'sorcery-points': Math.max(0, spent - (lvlIdx + 1)),
        },
      };
      me(`${c.name} turns a level-${lvlIdx + 1} slot into ${lvlIdx + 1} sorcery point(s)`);
      return null;
    }
    case 'rage-frenzy':
      spendResource(c, 'rage');
      addEffect(c, {
        id: 'rage',
        name: 'Rage',
        sourceId: c.id,
        tag: 'rage',
        expires: { turnOf: c.id, when: 'start', round: s.round + 10 },
      });
      // PHB: Berserker, Frenzy. A bonus-action melee attack each turn while raging; 1 exhaustion when it ends.
      addEffect(c, {
        id: 'frenzy',
        name: 'Frenzy',
        sourceId: c.id,
        tag: 'frenzy',
        expires: { turnOf: c.id, when: 'start', round: s.round + 10 },
      });
      s.flags = { ...s.flags, [`frenzied:${c.id}`]: true };
      me(`${c.name} flies into a frenzied rage!`);
      return null;
    case 'frenzy-attack': {
      const opt = attackOptions(c).find(
        (o) => o.kind === 'melee' && !o.unarmed && target && !attackBlocked(ctx, c, target, o),
      );
      if (!target || !opt) return 'No melee target in reach.';
      makeAttack(ctx, c, target, opt);
      return null;
    }
    case 'flurry-prone':
    case 'flurry-push':
    case 'flurry-no-reactions': {
      if (!target || target.side === c.side) return 'Choose an enemy.';
      const unarmed = attackOptions(c).find((o) => o.unarmed)!;
      const blocked = attackBlocked(ctx, c, target, unarmed);
      if (blocked) return blocked;
      spendResource(c, 'ki');
      // PHB: Way of the Open Hand, Open Hand Technique (save DC 8 + proficiency + Wis).
      const dc = 8 + h.proficiencyBonus + abilityModifier(h.abilities.wis);
      for (let i = 0; i < 2 && conscious(target); i++) {
        const r = makeAttack(ctx, c, target, unarmed);
        if (!r.hit || !conscious(target)) continue;
        if (id === 'flurry-no-reactions') {
          target.reactionUsed = true;
          me(`${target.name} can't take reactions until the end of ${c.name}'s next turn`);
        } else if (id === 'flurry-prone') {
          if (!combatSave(ctx, target, 'dex', dc).success) {
            target.creature = addCondition(target.creature, { id: 'prone' });
            me(`${target.name} is knocked prone`);
          }
        } else if (!combatSave(ctx, target, 'str', dc).success) {
          const n = {
            x: target.pos.x + Math.sign(target.pos.x - c.pos.x) * 3,
            y: target.pos.y + Math.sign(target.pos.y - c.pos.y) * 3,
          };
          for (let k = 3; k > 0; k--) {
            const p = {
              x: target.pos.x + Math.sign(n.x - target.pos.x),
              y: target.pos.y + Math.sign(n.y - target.pos.y),
            };
            if (!reachable(s, target, 5).has(posKey(p))) break;
            target.pos = p;
          }
          me(`${target.name} is pushed away`);
        }
      }
      return null;
    }
    case 'sacred-weapon': {
      spendResource(c, 'channel-divinity');
      const cha = Math.max(1, abilityModifier(h.abilities.cha));
      addEffect(c, {
        id: 'sacred-weapon',
        name: 'Sacred Weapon',
        sourceId: c.id,
        tag: 'sacred-weapon',
        mod: { attack: cha },
        expires: { turnOf: c.id, when: 'start', round: s.round + 10 },
      });
      me(`${c.name}'s weapon blazes with holy light (+${cha} to attack)`);
      return null;
    }
    case 'turn-the-unholy': {
      spendResource(c, 'channel-divinity');
      const dc = 8 + h.proficiencyBonus + abilityModifier(h.abilities.cha);
      me(`${c.name} raises a holy symbol: Turn the Unholy (DC ${dc})`);
      for (const u of hostiles(s, c).filter(
        (x) =>
          x.monsterId &&
          ['undead', 'fiend'].includes(getMonster(x.monsterId).type) &&
          distanceFeet(x.pos, c.pos) <= 30,
      )) {
        if (!combatSave(ctx, u, 'wis', dc, { against: 'frightened', magic: true }).success)
          addEffect(u, {
            id: 'turned',
            name: 'Turned',
            sourceId: c.id,
            tag: 'turned',
            expires: { turnOf: c.id, when: 'start', round: s.round + 10 },
          });
      }
      return null;
    }
    case 'horde-breaker': {
      // PHB: Hunter, Horde Breaker. Once per turn, attack another creature within 5 ft of the first target.
      const opt = attackOptions(c).find(
        (o) => !o.unarmed && target && !attackBlocked(ctx, c, target, o),
      );
      if (!target || !opt) return 'No target in range.';
      c.turn.hordeUsed = true;
      makeAttack(ctx, c, target, opt);
      return null;
    }
    case 'move-mark': {
      const spell = c.creature.concentration;
      if (!target || target.side === c.side) return 'Choose an enemy.';
      if (spell !== 'hex' && spell !== 'hunters-mark') return 'You are not concentrating on it.';
      const tag = spell === 'hex' ? 'hex-target' : 'hunters-mark-target';
      if (distanceFeet(c.pos, target.pos) > 90) return 'Too far (90 ft).';
      for (const x of Object.values(s.combatants))
        x.effects = x.effects.filter((e) => !(e.tag === tag && e.sourceId === c.id));
      const hexAbility = spell === 'hex' ? hexAbilityOf(c) : undefined;
      addEffect(target, {
        id: tag,
        name: spell === 'hex' ? 'Hex' : "Hunter's Mark",
        sourceId: c.id,
        tag,
        concentration: spell,
        ...(hexAbility ? { data: { ability: hexAbility } } : {}),
      });
      me(
        `${c.name} puts ${spell === 'hex' ? 'the Hex' : "the Hunter's Mark"} on ${target.name}${hexAbility ? ` (disadvantage on ${ABILITY_LONG[hexAbility]} checks)` : ''}`,
      );
      return null;
    }
    case 'wholeness-of-body': {
      // PHB: Way of the Open Hand, Wholeness of Body (level 6): heal 3 × monk level.
      spendResource(c, 'wholeness-of-body');
      healCombatant(ctx, c, 3 * classLevel(c, 'monk'), 'Wholeness of Body', c);
      return null;
    }
    case 'call-lightning': {
      // PHB: Call Lightning. A bolt hits a point; everyone within 5 ft makes a Dex save.
      if (!target) return 'Choose an enemy.';
      if (distanceFeet(c.pos, target.pos) > 120) return 'Too far (120 ft).';
      const eff = c.effects.find((e) => e.tag === 'call-lightning')!;
      const dmg = roll(String(eff.data?.dice ?? '3d10'), ctx.rng);
      me(`${c.name} calls down a bolt of lightning: ${dmg.text}`);
      for (const t of Object.values(s.combatants).filter(
        (x) => !x.gone && !x.creature.dead && distanceFeet(x.pos, target.pos) <= 5,
      )) {
        const r = combatSave(ctx, t, 'dex', Number(eff.data?.dc ?? 10), { magic: true });
        dealDamage(
          ctx,
          t,
          [{ amount: r.success ? Math.floor(dmg.total / 2) : dmg.total, type: 'lightning' }],
          { attacker: c },
        );
      }
      return null;
    }
    case 'heat-metal': {
      const eff = c.effects.find((e) => e.tag === 'heat-metal')!;
      if (!target || target.id !== eff.data?.targetId) return 'Only the creature you heated.';
      if (distanceFeet(c.pos, target.pos) > 60) return 'Too far (60 ft).';
      c.turn.bonusUsed = true;
      const dmg = roll(String(eff.data?.dice ?? '2d8'), ctx.rng);
      me(`${c.name} makes the metal glow hotter: ${dmg.text} fire`);
      dealDamage(ctx, target, [{ amount: dmg.total, type: 'fire' }], { attacker: c });
      return null;
    }
    case 'vampiric-touch': {
      if (!target || target.side === c.side) return 'Choose an enemy.';
      if (distanceFeet(c.pos, target.pos) > 5) return 'You must be next to it.';
      const eff = c.effects.find((e) => e.tag === 'vampiric-touch')!;
      const nums = casterNumbers(c);
      const r = attackRoll(c.creature, { ...target.creature, ac: currentAc(target) }, ctx.rng, {
        attackBonus: nums.attack,
        melee: true,
        within5ft: true,
        label: 'Vampiric Touch',
      });
      sayAll(s, [r.log], c);
      if (r.hit) {
        const dmg = roll(String(eff.data?.dice ?? '3d6'), ctx.rng);
        me(`Vampiric Touch: ${dmg.text} necrotic`);
        const dealt = dealDamage(
          ctx,
          target,
          [{ amount: dmg.total * (r.critical ? 2 : 1), type: 'necrotic' }],
          { attacker: c, critical: r.critical },
        );
        const healed = Math.floor(dealt / 2);
        if (healed) healCombatant(ctx, c, healed, 'Vampiric Touch', c);
      }
      return null;
    }
    case 'spiritual-weapon': {
      if (!target || target.side === c.side) return 'Choose an enemy.';
      if (distanceFeet(c.pos, target.pos) > 60) return 'Too far for the spiritual weapon (60 ft).';
      spiritAttack(ctx, c, target);
      return null;
    }
  }
}
