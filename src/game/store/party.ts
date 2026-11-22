import { roll, SeededRng } from '../../rules';
import {
  equipToSlot,
  isMagicItem,
  itemName,
  switchWeapons,
  unequipGear,
  unequipSlot,
} from '../gear';
import { prepareProblem, prepareSpells } from '../spellPrep';
import { getItem } from '../items';
import { castHealing, layOnHands } from '../healing';
import { withFormation } from '../formation';
import { spellNumbers } from '../hero';
import { type GameStore, type StoreSet, type StoreGet } from './shared';

/** Party management outside fights: equipment, spells, healing, potions, magic items and formation. */
export const partySlice = (
  set: StoreSet,
  get: StoreGet,
): Pick<
  GameStore,
  | 'equipItem'
  | 'unequipItem'
  | 'unequipGear'
  | 'equipToHeroSlot'
  | 'clearHeroSlot'
  | 'switchHeroWeapons'
  | 'prepareHeroSpells'
  | 'spendPearl'
  | 'spendStaff'
  | 'healOutside'
  | 'setFormation'
  | 'drinkPotion'
> => ({
  equipItem: (heroId, itemId) => {
    const { game } = get();
    if (!game) return 'No game';
    if ((game.inventory[itemId] ?? 0) < 1) return 'That item is not in the pack.';
    return get().equipToHeroSlot(heroId, itemId);
  },

  unequipItem: (heroId, itemId) => {
    const { game } = get();
    if (!game) return;
    const hero = game.party.find((h) => h.id === heroId);
    const lo = hero?.equipment.loadout;
    const slot = lo
      ? (Object.keys(lo) as (keyof typeof lo)[]).find((k) => k !== 'active' && lo[k] === itemId)
      : undefined;
    if (slot && slot !== 'active') get().clearHeroSlot(heroId, slot);
    else if (hero)
      // An older hero without slots: take it off the magic list.
      set({
        game: {
          ...game,
          party: game.party.map((h) =>
            h.id === heroId
              ? {
                  ...h,
                  equipment: {
                    ...h.equipment,
                    magic: h.equipment.magic.filter((x) => x !== itemId),
                  },
                }
              : h,
          ),
          inventory: { ...game.inventory, [itemId]: (game.inventory[itemId] ?? 0) + 1 },
        },
      });
  },

  unequipGear: (heroId, slot) => {
    const { game } = get();
    if (game) set({ game: unequipGear(game, heroId, slot) });
  },

  equipToHeroSlot: (heroId, itemId, slot) => {
    const { game, shortRest } = get();
    if (!game) return 'No game';
    if (isMagicItem(itemId)) {
      const item = getItem(itemId);
      // Items.md: attuning happens during a short rest.
      if (item.attunement && !shortRest)
        return `Attuning to ${item.name} takes a short rest (Camp → Short rest).`;
    }
    const r = equipToSlot(game, heroId, itemId, slot);
    if (!r.error) {
      set({ game: r.game });
      if (r.note) get().toast([r.note]);
    }
    return r.error;
  },

  clearHeroSlot: (heroId, slot) => {
    const { game } = get();
    if (game) set({ game: unequipSlot(game, heroId, slot) });
  },

  switchHeroWeapons: (heroId) => {
    const { game } = get();
    if (game) set({ game: switchWeapons(game, heroId) });
  },

  prepareHeroSpells: (heroId, spellIds) => {
    const { game } = get();
    if (!game) return 'No game';
    const hero = game.party.find((h) => h.id === heroId);
    if (!hero) return 'No such hero';
    const problem = prepareProblem(hero, spellIds);
    if (problem) return problem;
    set({
      game: {
        ...game,
        party: game.party.map((h) => (h.id === heroId ? prepareSpells(h, spellIds) : h)),
      },
    });
    return undefined;
  },

  spendPearl: (heroId, itemId = 'bog-pearl') => {
    const { game } = get();
    if (!game) return 'No game';
    // The Bog Pearl keeps its old flag (saves); other pearls have one each.
    const usedKey = itemId === 'bog-pearl' ? 'pearl_used' : `item_used:${itemId}`;
    if (game.flags[usedKey]) return 'The pearl is dull until tomorrow (after a long rest).';
    const h = game.party.find((x) => x.id === heroId)!;
    const lvl = [3, 2, 1].find((l) => (h.slotsUsed[l - 1] ?? 0) > 0);
    if (!lvl) return `${h.name} has no spent spell slot of 3rd level or lower.`;
    const slotsUsed = h.slotsUsed.map((n, i) => (i === lvl - 1 ? n - 1 : n));
    set({
      game: {
        ...game,
        flags: { ...game.flags, [usedKey]: true },
        party: game.party.map((x) => (x.id === heroId ? { ...x, slotsUsed } : x)),
      },
    });
    get().toast([`The ${itemName(itemId)} glows: ${h.name} regains a level-${lvl} spell slot.`]);
    return undefined;
  },

  spendStaff: (wielderId, targetId) => {
    const { game, rngState } = get();
    if (!game) return 'No game';
    const charges = Number(game.flags['staff_charges'] ?? 10);
    if (charges < 1) return 'The staff has no charges left (it recovers some at dawn).';
    const w = game.party.find((x) => x.id === wielderId)!;
    const t = game.party.find((x) => x.id === targetId)!;
    if (t.dead) return `${t.name} is beyond Cure Wounds.`;
    if (t.hp >= t.maxHp) return `${t.name} is already at full health.`;
    const mod = spellNumbers(w)?.mod ?? 0;
    const rng = SeededRng.fromState(rngState);
    const r = roll('1d8', rng);
    const hp = Math.min(t.maxHp, t.hp + r.total + mod);
    set({
      rngState: rng.state,
      game: {
        ...game,
        flags: { ...game.flags, staff_charges: charges - 1 },
        party: game.party.map((x) => (x.id === targetId ? { ...x, hp } : x)),
      },
    });
    get().toast([
      `Staff of Healing (Cure Wounds): ${r.text} + ${mod} → ${t.name} ${hp}/${t.maxHp} HP · ${charges - 1} charges left`,
    ]);
    return undefined;
  },

  healOutside: (casterId, how, targetId) => {
    const { game, rngState } = get();
    if (!game) return 'No game';
    const rng = SeededRng.fromState(rngState);
    const r =
      how === 'lay-on-hands'
        ? layOnHands(game, casterId, targetId)
        : castHealing(game, casterId, how.spellId, how.slotLevel, targetId, rng);
    if ('error' in r) return r.error;
    set({ game: r.game, rngState: rng.state });
    get().toast(r.log);
    return undefined;
  },

  setFormation: (order) => {
    const { game } = get();
    if (game) set({ game: withFormation(game, order) });
  },

  drinkPotion: (heroId, itemId) => {
    const { game, rngState } = get();
    if (!game) return 'No game';
    if ((game.inventory[itemId] ?? 0) < 1) return 'None left.';
    if (!isMagicItem(itemId)) return 'That isn\u2019t something to drink.';
    const item = getItem(itemId);
    const heal = item.effects.find((e) => e.type === 'heal');
    if (!heal || heal.type !== 'heal') return `${item.name} only matters in a fight.`;
    const hero = game.party.find((h) => h.id === heroId)!;
    if (hero.dead) return `${hero.name} is beyond a potion's help.`;
    if (hero.hp >= hero.maxHp) return `${hero.name} is already at full health.`;
    const rng = SeededRng.fromState(rngState);
    const r = roll(heal.dice, rng);
    const hp = Math.min(hero.maxHp, hero.hp + r.total);
    set({
      rngState: rng.state,
      game: {
        ...game,
        party: game.party.map((h) => (h.id === heroId ? { ...h, hp } : h)),
        inventory: { ...game.inventory, [itemId]: game.inventory[itemId]! - 1 },
      },
    });
    get().toast([`${hero.name} drinks ${item.name}: ${r.text} → ${hp}/${hero.maxHp} HP`]);
    return undefined;
  },
});
