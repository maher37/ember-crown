import { getMonster } from '../game/creatures';
import { familiarForms, familiarOf, hasChain, setFamiliarForm } from '../game/familiar';
import type { Hero } from '../game/hero';
import { useGame } from '../game/store';

/** One line about a familiar shape: its numbers and what it can do in a fight. */
export function familiarLine(id: string, canAttack: boolean): string {
  const m = getMonster(id);
  const move = [
    m.speed.walk ? `walk ${m.speed.walk} ft` : null,
    m.speed.fly ? `fly ${m.speed.fly} ft` : null,
    m.speed.swim ? `swim ${m.speed.swim} ft` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const attacks =
    canAttack && m.actions.length ? ` · ${m.actions.map((a) => a.name).join(', ')}` : '';
  const stuck = Math.max(m.speed.walk, m.speed.fly ?? 0) === 0 ? ' · can’t move on land' : '';
  return `AC ${m.ac}, ${m.hp} HP, ${move}${attacks}${stuck}`;
}

/** PHB: Find Familiar / Pact of the Chain. Pick the familiar's shape on the sheet. */
export function FamiliarPanel({ hero }: { hero: Hero }) {
  const fam = familiarOf(hero);
  if (!fam) return null;
  const chain = hasChain(hero);
  const pick = (form: string) => {
    const g = useGame.getState().game!;
    useGame.setState({
      game: {
        ...g,
        party: g.party.map((x) => (x.id === hero.id ? setFamiliarForm(x, form) : x)),
      },
    });
    useGame.getState().saveTo('autosave');
  };
  return (
    <div className="sheet-box">
      <h3 className="eyebrow">Familiar{chain ? ' (Pact of the Chain)' : ''}</h3>
      <label className="setting-row">
        <span className="strong">Shape:</span>
        <select
          value={fam.form}
          onChange={(e) => pick(e.target.value)}
          aria-label={`${hero.name}'s familiar shape`}
        >
          {familiarForms(hero).map((id) => (
            <option key={id} value={id}>
              {getMonster(id).name}
            </option>
          ))}
        </select>
      </label>
      <p className="small muted">{familiarLine(fam.form, chain)}</p>
      <p className="small muted">
        {fam.lost
          ? 'Killed in the last fight. It comes back after a long rest.'
          : `Joins every fight beside ${hero.name} and takes its own turn. ${
              chain ? 'It can attack or Help.' : 'It can’t attack, but it can Help an ally.'
            } If it dies, it comes back after a long rest.`}
      </p>
    </div>
  );
}
