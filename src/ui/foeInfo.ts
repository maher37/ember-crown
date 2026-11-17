// What the party knows about an enemy at a glance (playtest feedback): its kind, defenses, and
// what this hero has that works especially well (or badly) against it.
import { spells } from '../data';
import { attackOptions, heroOf, type Combatant } from '../game/combat';
import { getMonster } from '../game/creatures';
import { hasItem } from '../game/items';

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const list = (xs: string[]) => xs.map(cap).join(', ');

/** Damage types a spell deals. */
function spellTypes(id: string): string[] {
  const sp = spells.find((x) => x.id === id);
  if (!sp) return [];
  const out: string[] = [];
  const walk = (es: unknown[]) => {
    for (const e of es as {
      type: string;
      damageType?: string;
      onHit?: unknown[];
      onFail?: unknown[];
    }[]) {
      if (e.type === 'damage' && e.damageType) out.push(e.damageType);
      if (e.onHit) walk(e.onHit);
      if (e.onFail) walk(e.onFail);
    }
  };
  walk(sp.effects);
  return out;
}

export interface FoeInfo {
  kind: string;
  defenses: string[];
  traits: string[];
  /** What the active hero has going for (or against) them here. */
  edges: string[];
}

export function foeInfo(foe: Combatant, me: Combatant | undefined): FoeInfo | null {
  if (!foe.monsterId) return null;
  const m = getMonster(foe.monsterId);
  const defenses: string[] = [];
  const bps = ['bludgeoning', 'piercing', 'slashing'];
  const res = m.resistances.filter((t) => !(m.resistancesNonmagicalOnly && bps.includes(t)));
  if (m.resistancesNonmagicalOnly && m.resistances.some((t) => bps.includes(t)))
    defenses.push('Resists nonmagical weapons');
  if (res.length) defenses.push(`Resists ${list(res)}`);
  if (m.immunities.length) defenses.push(`Immune to ${list(m.immunities)}`);
  if (m.vulnerabilities.length) defenses.push(`Vulnerable to ${list(m.vulnerabilities)}`);
  if (m.conditionImmunities.length) defenses.push(`Can't be ${m.conditionImmunities.join(', ')}`);
  const traits = m.traits.filter((t) => !['object', 'shard'].includes(t.id)).map((t) => t.name);

  const edges: string[] = [];
  const h = me ? heroOf(me) : null;
  if (me && h) {
    const opts = attackOptions(me);
    const first = h.name.split(' ')[0];
    const nonmagicalResisted =
      m.resistancesNonmagicalOnly && m.resistances.some((t) => bps.includes(t));
    if (nonmagicalResisted) {
      const magic = opts.filter((o) => o.magical).map((o) => o.name);
      edges.push(
        magic.length
          ? `${magic.join(', ')}: magical, gets through its resistance`
          : `${first}'s weapons are nonmagical: half damage. Spells work fully.`,
      );
    }
    for (const o of opts.filter((x) => !x.unarmed))
      for (const d of o.damage) {
        if (m.vulnerabilities.includes(d.type)) edges.push(`${o.name}: ${d.type}, double damage`);
        if (m.immunities.includes(d.type)) edges.push(`${o.name}: ${d.type}, no effect`);
      }
    if ((m.type === 'undead' || m.type === 'fiend') && hasItem(h, 'mace-of-disruption'))
      edges.push('Mace of Disruption: +2d6 radiant, and can destroy it at 25 HP or less');
    if (m.type === 'dragon' && hasItem(h, 'dragon-slayer'))
      edges.push('Dragon Slayer: +3d6 damage');
    if (h.classId === 'paladin' && h.level >= 2 && (m.type === 'undead' || m.type === 'fiend'))
      edges.push('Divine Smite: +1d8 extra against undead and fiends');
    if (h.classId === 'cleric' && h.level >= 2 && m.type === 'undead')
      edges.push(
        `Turn Undead works on it${h.level >= 5 && ['0', '1/8', '1/4', '1/2'].includes(m.cr) ? ' (and can destroy it)' : ''}`,
      );
    if (h.classId === 'paladin' && h.level >= 3 && (m.type === 'undead' || m.type === 'fiend'))
      edges.push('Turn the Unholy works on it');
    const known = [...h.cantrips, ...h.spells];
    const good = new Set<string>();
    const bad = new Set<string>();
    for (const id of known)
      for (const t of spellTypes(id)) {
        const name = spells.find((x) => x.id === id)!.name;
        if ((m.vulnerabilities as string[]).includes(t)) good.add(name);
        if ((m.immunities as string[]).includes(t)) bad.add(name);
      }
    if (good.size) edges.push(`Double damage: ${[...good].join(', ')}`);
    if (bad.size) edges.push(`No effect: ${[...bad].join(', ')}`);
  }
  return { kind: `${m.size} ${cap(m.type)}`, defenses, traits, edges: [...new Set(edges)] };
}
