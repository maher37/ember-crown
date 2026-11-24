import { COMPANION_FORMS, companionMaxHp, companionOf, setCompanionForm } from '../game/companion';
import { getMonster } from '../game/creatures';
import type { Hero } from '../game/hero';
import { useGame } from '../game/store';

/** One line about a companion: its numbers with the ranger's bonuses (PHB: Ranger's Companion). */
export function companionLine(id: string, hero: Hero): string {
  const m = getMonster(id);
  const pb = hero.proficiencyBonus;
  const attacks = m.actions.map((a) => a.name).join(' or ');
  return `AC ${m.ac + pb}, ${companionMaxHp(m.hp, hero.level)} HP, speed ${m.speed.walk} ft · ${attacks} (+${pb} to hit and damage)`;
}

/** PHB: Beast Master. Pick the animal companion on the sheet (D36). */
export function CompanionPanel({ hero }: { hero: Hero }) {
  const comp = companionOf(hero);
  if (!comp) return null;
  const pick = (form: string) => {
    const g = useGame.getState().game!;
    useGame.setState({
      game: {
        ...g,
        party: g.party.map((x) => (x.id === hero.id ? setCompanionForm(x, form) : x)),
      },
    });
    useGame.getState().saveTo('autosave');
  };
  return (
    <div className="sheet-box">
      <h3 className="eyebrow">Animal companion (Beast Master)</h3>
      <label className="setting-row">
        <span className="strong">Animal:</span>
        <select
          value={comp.form}
          onChange={(e) => pick(e.target.value)}
          aria-label={`${hero.name}'s animal companion`}
        >
          {COMPANION_FORMS.map((id) => (
            <option key={id} value={id}>
              {getMonster(id).name}
            </option>
          ))}
        </select>
      </label>
      <p className="small muted">{companionLine(comp.form, hero)}</p>
      <p className="small muted">
        {comp.waiting
          ? 'A new companion: it joins after your next long rest.'
          : comp.lost
            ? 'Badly hurt in the last fight. It comes back after a long rest.'
            : `Fights beside ${hero.name} and takes its own turn. If it drops, it comes back after a long rest. A new animal takes a long rest to join.`}
      </p>
    </div>
  );
}
