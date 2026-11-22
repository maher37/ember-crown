// D34: spells cast on the Prepare screen just before a fight. They're cast once everyone is
// placed and has rolled initiative, before the first turn, so they carry into the fight with
// their normal duration counted from round 1.
import { getSpell, castSpell } from './spells';
import { heroOf, say, type Ctx } from './core';
import { freshTurn } from './turn';
import { precastProblems, precastTarget, type Precast } from '../precast';

export function castBeforeFight(ctx: Ctx, list: Precast[]): void {
  const { s } = ctx;
  if (!list.length) return;
  const party = Object.values(s.combatants)
    .map(heroOf)
    .filter((h) => !!h);
  // A list that no longer fits (not enough slots, two concentration spells) is cast only as far
  // as it does: anything after the first problem for that caster is skipped.
  const ok: Precast[] = [];
  for (const p of list) if (!precastProblems(party, [...ok, p]).length) ok.push(p);
  if (ok.length) say(s, 'head', 'Before the fight');
  for (const p of ok) {
    const caster = s.combatants[p.casterId];
    const h = caster && heroOf(caster);
    if (!caster || !h || h.dead || h.hp <= 0) continue;
    const sp = getSpell(p.spellId);
    const t = precastTarget(sp, p.slotLevel);
    // Everyone stands together before the fight, so range doesn't matter for allies [inferred].
    const targetIds =
      t.kind === 'self'
        ? undefined
        : p.targetIds
            .filter((id) => s.combatants[id] && !s.combatants[id]!.gone)
            .slice(0, t.kind === 'foe' ? 1 : t.count);
    if (t.kind !== 'self' && !targetIds?.length) continue;
    castSpell(ctx, caster, { spellId: p.spellId, slotLevel: p.slotLevel, targetIds });
    // Casting before the fight doesn't use the caster's first turn.
    caster.turn = freshTurn(caster.speed);
  }
}
