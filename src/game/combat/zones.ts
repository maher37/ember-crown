// Spells that leave something on the battlefield (M8): Spirit Guardians, Moonbeam, Flaming
// Sphere, Hunger of Hadar, Spike Growth, Silence and Darkness. Pure functions over CombatState.
import type { Spell } from '../../data/schemas/spell';
import { roll, type Ability, type DamageType } from '../../rules';
import { combatSave, dealDamage, say, type Ctx } from './core';
import { conscious, distanceFeet, posKey, setZoneSlows, sphereCells } from './grid';
import type { CombatState, Combatant, Pos, Zone } from './types';

/** The squares a zone covers right now (an aura follows its caster). */
export function zoneCells(s: CombatState, z: Zone): Pos[] {
  if (z.aura) {
    const c = s.combatants[z.casterId];
    if (!c || c.gone || c.creature.dead) return [];
    return sphereCells(s.map, c.pos, z.aura);
  }
  return z.cells ?? [];
}

export const inZone = (s: CombatState, z: Zone, p: Pos) =>
  zoneCells(s, z).some((c) => c.x === p.x && c.y === p.y);

/** Does this zone hurt this creature? (Spirit Guardians spares the caster's side.) */
const affects = (z: Zone, c: Combatant) =>
  c.id !== z.casterId && (!z.enemiesOnly || c.side !== z.side);

/** Squares covered by Darkness (they block sight in and out). */
export function darkCells(s: CombatState): string[] {
  return s.zones.filter((z) => z.kind === 'darkness').flatMap((z) => zoneCells(s, z).map(posKey));
}

/**
 * Extra cost to step into a square because of zones: Spike Growth is difficult terrain, and
 * Spirit Guardians halves an enemy's speed (treated as difficult terrain [inferred]).
 */
export function zoneSlows(s: CombatState, mover: Combatant, p: Pos): boolean {
  return s.zones.some(
    (z) => (z.kind === 'spikes' || (z.halfSpeed && affects(z, mover))) && inZone(s, z, p),
  );
}

setZoneSlows(zoneSlows);

/** Can this creature speak spells here? (Silence.) */
export const silenced = (s: CombatState, c: Combatant) =>
  s.zones.some((z) => z.kind === 'silence' && inZone(s, z, c.pos));

const turnKey = (s: CombatState) => `${s.round}:${s.turnIndex}`;

/** Roll a zone's effect on one creature (its save, its damage). */
function hit(ctx: Ctx, z: Zone, c: Combatant, why: string): void {
  const { s, rng } = ctx;
  if (!conscious(c) && c.side === 'enemy') return;
  const caster = s.combatants[z.casterId];
  z.hitAt = { ...z.hitAt, [c.id]: turnKey(s) };
  if (z.startDamage) {
    const r = roll(z.startDamage.dice, rng);
    say(s, 'dmg', `${z.name} (${why}): ${r.text} ${z.startDamage.type}`);
    dealDamage(ctx, c, [{ amount: r.total, type: z.startDamage.type }], { attacker: caster });
  }
  if (!z.save || !z.damage) return;
  const res = combatSave(ctx, c, z.save.ability, z.save.dc, { magic: true });
  if (res.success && !z.save.half) return;
  const r = roll(z.damage.dice, rng);
  const amount = res.success ? Math.floor(r.total / 2) : r.total;
  say(
    s,
    'dmg',
    `${z.name} (${why}): ${r.text} ${z.damage.type}${res.success ? ` (halved: ${amount})` : ''}`,
  );
  dealDamage(ctx, c, [{ amount, type: z.damage.type }], { attacker: caster });
}

/**
 * PHB: Spirit Guardians, Moonbeam... A creature that starts its turn in the area (or enters it
 * for the first time on a turn) is affected. Flaming Sphere and Hunger of Hadar are folded into
 * the start of the turn too [inferred simplification].
 */
export function startOfTurnZones(ctx: Ctx, c: Combatant): void {
  for (const z of [...ctx.s.zones])
    if ((z.save || z.startDamage) && affects(z, c) && inZone(ctx.s, z, c.pos))
      hit(ctx, z, c, 'starts its turn inside');
}

/** A creature stepped into `p`: entering damage zones, and Spike Growth's thorns. */
export function enterSquare(ctx: Ctx, mover: Combatant, p: Pos): void {
  const { s, rng } = ctx;
  for (const z of [...s.zones]) {
    if (!affects(z, mover) || !inZone(s, z, p)) continue;
    if (z.kind === 'spikes' && z.damage) {
      // PHB: Spike Growth. 2d4 piercing for every 5 feet moved in the area.
      const r = roll(z.damage.dice, rng);
      say(s, 'dmg', `${mover.name} pushes through the thorns: ${r.text} ${z.damage.type}`);
      dealDamage(ctx, mover, [{ amount: r.total, type: z.damage.type }], {
        attacker: s.combatants[z.casterId],
      });
    } else if ((z.save || z.startDamage) && z.hitAt?.[mover.id] !== turnKey(s))
      hit(ctx, z, mover, 'enters the area');
  }
}

/** Build the zone a spell leaves behind. */
export function makeZone(
  caster: Combatant,
  sp: Spell,
  cells: Pos[],
  o: { dc: number; slotLevel: number; upcastDice?: string },
): Zone | null {
  const base = {
    id: `${sp.id}-${caster.id}`,
    spellId: sp.id,
    name: sp.name,
    casterId: caster.id,
    side: caster.side,
    concentration: sp.concentration ? sp.id : undefined,
  };
  const save = sp.effects.find((e) => e.type === 'save');
  const dmg =
    save && save.type === 'save' ? save.onFail.find((x) => x.type === 'damage') : undefined;
  const dice = (d: string) => (o.upcastDice ? `${d}+${o.upcastDice}` : d);
  const saveDamage =
    save && save.type === 'save' && dmg && dmg.type === 'damage'
      ? {
          save: { ability: save.ability as Ability, dc: o.dc, half: save.onSuccess === 'half' },
          damage: { dice: dice(dmg.dice), type: dmg.damageType as DamageType },
        }
      : {};
  switch (sp.id) {
    case 'spirit-guardians':
      return {
        ...base,
        kind: 'damage',
        aura: 15,
        enemiesOnly: true,
        halfSpeed: true,
        ...saveDamage,
      };
    case 'moonbeam':
    case 'flaming-sphere':
      return { ...base, kind: 'damage', cells, ...saveDamage };
    case 'hunger-of-hadar':
      return {
        ...base,
        kind: 'damage',
        cells,
        startDamage: { dice: '2d6', type: 'cold' },
        ...saveDamage,
      };
    case 'spike-growth':
      return { ...base, kind: 'spikes', cells, damage: { dice: '2d4', type: 'piercing' } };
    case 'silence':
      return { ...base, kind: 'silence', cells };
    case 'darkness':
      return { ...base, kind: 'darkness', cells };
  }
  return null;
}

export function addZone(ctx: Ctx, z: Zone): void {
  const { s } = ctx;
  s.zones = [...s.zones.filter((x) => x.id !== z.id), z];
  s.map = { ...s.map, dark: darkCells(s) };
  const where = z.aura ? `around ${s.combatants[z.casterId]!.name}` : 'on the battlefield';
  say(s, z.side === 'party' ? 'you' : 'foe', `${z.name} takes hold ${where}`);
}

/** Zones end with their caster's concentration. */
export function endZones(s: CombatState, casterId: string, spellId: string): void {
  const ending = s.zones.filter((z) => z.casterId === casterId && z.spellId === spellId);
  if (!ending.length) return;
  s.zones = s.zones.filter((z) => !ending.includes(z));
  s.map = { ...s.map, dark: darkCells(s) };
  for (const z of ending) say(s, 'info', `${z.name} fades`);
}

/** Squares within `feet` of a point (Moonbeam's cylinder, Flaming Sphere). */
export const around = (s: CombatState, p: Pos, feet: number) => sphereCells(s.map, p, feet);
export { distanceFeet };
