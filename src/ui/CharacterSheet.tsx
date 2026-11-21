import { useState } from 'react';
import { spells as allSpells } from '../data';
import { attackOptions } from '../game/combat/attacks';
import type { Combatant } from '../game/combat/types';
import { itemName } from '../game/gear';
import { setLabel } from '../game/loadout';
import {
  armorSlows,
  getBackground,
  getClass,
  getSpecies,
  maxSlots,
  resourceLeft,
  resourceMax,
  skillBonus,
  spellNumbers,
  type Hero,
} from '../game/hero';
import { itemMods } from '../game/items';
import { spellRules } from '../game/levelup';
import { prepareProblem, spellChange } from '../game/spellPrep';
import { useGame } from '../game/store';
import {
  ABILITIES,
  abilityModifier,
  canLevelUp,
  SKILLS,
  SKILL_IDS,
  XP_THRESHOLDS,
  type Ability,
} from '../rules';
import { signed, SKILL_NAMES } from './creatorCopy';
import { EquipmentPanel } from './EquipmentPanel';
import { heroPortrait } from './heroLook';
import { Portrait } from './Portrait';
import './Sheet.css';

const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

type Tab = 'sheet' | 'spells' | 'equipment';

/** A full 5e character sheet for one hero: stats, spells and equipment. */
export function CharacterSheet({ hero }: { hero: Hero }) {
  const [tab, setTab] = useState<Tab>('sheet');
  const caster = !!getClass(hero.classId).spellcasting;
  const tabs: [Tab, string][] = [
    ['sheet', 'Character'],
    ['spells', 'Spells'],
    ['equipment', 'Equipment'],
  ];
  return (
    <article className="sheet" aria-label={hero.name}>
      <div role="tablist" aria-label="Sheet sections" className="sheet-tabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'on' : ''}
            onClick={() => setTab(id)}
          >
            {label}
            {id === 'spells' && !caster ? ' (none)' : ''}
          </button>
        ))}
      </div>
      <div className="sheet-body">
        {tab === 'sheet' && <StatsTab hero={hero} />}
        {tab === 'spells' && <SpellsTab hero={hero} />}
        {tab === 'equipment' && <EquipmentTab hero={hero} />}
      </div>
    </article>
  );
}

function StatsTab({ hero }: { hero: Hero }) {
  const { openLevelUp } = useGame();
  const cls = getClass(hero.classId);
  const sp = getSpecies(hero.speciesId);
  const bg = getBackground(hero.backgroundId);
  const mods = itemMods(hero);
  const save = (a: Ability) =>
    abilityModifier(hero.abilities[a]) +
    (hero.saveProficiencies.includes(a) ? hero.proficiencyBonus : 0) +
    mods.save;
  const passive = 10 + skillBonus(hero, 'perception');
  const next = XP_THRESHOLDS[hero.level] ?? hero.xp;
  const prev = XP_THRESHOLDS[hero.level - 1] ?? 0;
  const subclass = cls.subclass && hero.level >= cls.subclass.level ? cls.subclass.name : null;
  const attacks = attackOptions({ creature: hero } as unknown as Combatant);
  const features = cls.levels
    .filter((l) => l.level <= hero.level)
    .flatMap((l) => l.features.map((f) => ({ ...f, level: l.level })))
    .filter((f) => !/Ability Score Improvement/.test(f.name));
  const resources = cls.resources.filter((r) => resourceMax(hero, r.id) > 0);

  return (
    <div className="stats">
      <div className="sheet-top">
        <div className="sheet-portrait">
          <Portrait {...heroPortrait(hero)} />
        </div>
        <div className="sheet-id">
          <h2>{hero.name}</h2>
          <p className="muted">
            {sp.name} {cls.name} {hero.level}
            {subclass ? ` · ${subclass}` : ''} · {bg.name}
          </p>
          <div className="xp-line small">
            <span>
              XP {hero.xp} / {next}
            </span>
            <div className="xp-bar" aria-hidden="true">
              <div
                style={{
                  width: `${Math.min(100, Math.round(((hero.xp - prev) / Math.max(1, next - prev)) * 100))}%`,
                }}
              />
            </div>
          </div>
          {canLevelUp(hero) && (
            <button
              type="button"
              className="menu-primary small-btn"
              onClick={() => openLevelUp(hero.id)}
            >
              Level up!
            </button>
          )}
        </div>
        <dl className="big-stats">
          <Stat label="Armor Class" value={hero.ac} />
          <Stat label="Initiative" value={signed(abilityModifier(hero.abilities.dex))} />
          <Stat
            label="Speed"
            value={`${hero.speed} ft`}
            note={armorSlows(hero) ? 'armor too heavy' : undefined}
          />
          <Stat
            label="Hit Points"
            value={`${hero.hp}/${hero.maxHp}`}
            note={hero.tempHp ? `+${hero.tempHp} temp` : undefined}
          />
          <Stat
            label="Hit Dice"
            value={`${hero.hitDice.remaining}/${hero.hitDice.total}`}
            note={`d${hero.hitDice.die}`}
          />
          <Stat label="Proficiency" value={signed(hero.proficiencyBonus)} />
          <Stat label="Passive Perception" value={passive} />
        </dl>
      </div>

      <div className="sheet-cols">
        <section className="sheet-col-abilities" aria-label="Abilities and saving throws">
          <h3 className="eyebrow">Abilities</h3>
          <div className="ability-grid">
            {ABILITIES.map((a) => (
              <div key={a} className="ability-box" title={ABILITY_NAMES[a]}>
                <span className="ab-name">{a.toUpperCase()}</span>
                <span className="ab-mod">{signed(abilityModifier(hero.abilities[a]))}</span>
                <span className="ab-score">{hero.abilities[a]}</span>
              </div>
            ))}
          </div>
          <div className="sheet-box">
            <h3 className="eyebrow">Saving throws</h3>
            <ul className="check-list">
              {ABILITIES.map((a) => (
                <li key={a}>
                  <span
                    className={`dot${hero.saveProficiencies.includes(a) ? ' on' : ''}`}
                    aria-hidden="true"
                  />
                  <span className="num">{signed(save(a))}</span>
                  <span>
                    {ABILITY_NAMES[a]}
                    {hero.saveProficiencies.includes(a) && (
                      <span className="sr-only"> (proficient)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {hero.conditions.length > 0 && (
            <p className="small">
              <span className="eyebrow-inline">Conditions</span>{' '}
              {hero.conditions.map((c) => c.id).join(', ')}
            </p>
          )}
          {hero.exhaustion > 0 && <p className="small">Exhaustion level {hero.exhaustion}</p>}
        </section>

        <section className="sheet-col-skills" aria-label="Skills">
          <div className="sheet-box">
            <h3 className="eyebrow">Skills</h3>
            <ul className="check-list">
              {SKILL_IDS.map((s) => {
                const exp = hero.expertise.includes(s);
                const prof = hero.skills.includes(s);
                return (
                  <li key={s}>
                    <span
                      className={`dot${prof ? ' on' : ''}${exp ? ' exp' : ''}`}
                      aria-hidden="true"
                    />
                    <span className="num">{signed(skillBonus(hero, s))}</span>
                    <span>
                      {SKILL_NAMES[s]} <span className="faint">({SKILLS[s].toUpperCase()})</span>
                      {exp ? (
                        <span className="sr-only"> (expertise)</span>
                      ) : prof ? (
                        <span className="sr-only"> (proficient)</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="small faint">● proficient · ◆ expertise (double proficiency)</p>
        </section>

        <section className="sheet-col-more" aria-label="Attacks, features and proficiencies">
          <div className="sheet-box">
            <h3 className="eyebrow">Attacks</h3>
            <table className="attacks">
              <thead>
                <tr>
                  <th>Weapon</th>
                  <th>To hit</th>
                  <th>Damage</th>
                  <th>Range</th>
                </tr>
              </thead>
              <tbody>
                {attacks.map((o) => (
                  <tr key={o.id}>
                    <td>{o.name}</td>
                    <td>{signed(o.toHit)}</td>
                    <td>{o.damage.map((d) => `${d.dice} ${d.type}`).join(' + ')}</td>
                    <td>
                      {o.kind === 'melee'
                        ? `${o.reach} ft`
                        : o.range
                          ? `${o.range[0]}/${o.range[1]} ft`
                          : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hero.equipment.loadout && (
              <p className="small muted">
                Other weapon set:{' '}
                {setLabel(hero.equipment.loadout, hero.equipment.loadout.active === 1 ? 2 : 1)}{' '}
                (switch in a fight, or on the Equipment tab).
              </p>
            )}
          </div>
          {resources.length > 0 && (
            <>
              <h3 className="eyebrow">Class resources</h3>
              <p className="small">
                {resources
                  .map((r) => `${r.name}: ${resourceLeft(hero, r.id)}/${resourceMax(hero, r.id)}`)
                  .join(' · ')}
              </p>
            </>
          )}
          <div className="sheet-box">
            <h3 className="eyebrow">Features and traits</h3>
            <ul className="feature-list">
              {features.map((f) => (
                <li key={`${f.level}-${f.id}`}>
                  <span className="strong">{f.name}</span>{' '}
                  <span className="faint small">
                    ({cls.name} {f.level})
                  </span>{' '}
                  <span className="small muted">{featureNote(hero, f.id) ?? f.summary}</span>
                </li>
              ))}
              {sp.traits.map((t) => (
                <li key={t.id}>
                  <span className="strong">{t.name}</span>{' '}
                  <span className="faint small">({sp.name})</span>{' '}
                  <span className="small muted">{t.summary}</span>
                </li>
              ))}
              <li>
                <span className="strong">{bg.feature.name}</span>{' '}
                <span className="faint small">({bg.name})</span>{' '}
                <span className="small muted">{bg.feature.summary}</span>
              </li>
            </ul>
          </div>
          <h3 className="eyebrow">Proficiencies and languages</h3>
          <p className="small">
            <span className="eyebrow-inline">Armor</span>{' '}
            {cls.armor.length ? cls.armor.join(', ') : 'none'} ·{' '}
            <span className="eyebrow-inline">Weapons</span> {cls.weapons.join(', ')}
            {bg.tools.length ? (
              <>
                {' '}
                · <span className="eyebrow-inline">Tools</span> {bg.tools.join(', ')}
              </>
            ) : null}
          </p>
          <p className="small">
            <span className="eyebrow-inline">Languages</span> {sp.languages.join(', ')}
            {bg.extraLanguages ? `, and ${bg.extraLanguages} more of your choice` : ''}
          </p>
        </section>
      </div>
    </div>
  );
}

/** What the hero picked for a choice feature (Fighting Style: Defense…). */
function featureNote(hero: Hero, id: string): string | null {
  if (id === 'fighting-style' && hero.fightingStyle)
    return `Chosen: ${pretty(hero.fightingStyle)}.`;
  const picked = hero.choices[id];
  return picked?.length ? `Chosen: ${picked.map(pretty).join(', ')}.` : null;
}
const pretty = (id: string) => id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="big-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {note && <span className="small faint">{note}</span>}
    </div>
  );
}

const ORDINAL = ['Cantrips', '1st level', '2nd level', '3rd level', '4th level', '5th level'];

function SpellsTab({ hero }: { hero: Hero }) {
  const { prepareHeroSpells } = useGame();
  const nums = spellNumbers(hero);
  const change = spellChange(hero);
  const [editing, setEditing] = useState<string[] | null>(null);
  const [msg, setMsg] = useState('');
  if (!nums || !change)
    return (
      <p className="muted">
        {hero.name} doesn&apos;t cast spells. ({getClass(hero.classId).name}s rely on weapons and
        class features.)
      </p>
    );
  const rules = spellRules(hero, hero.level)!;
  const slots = maxSlots(hero);
  const known = hero.spells
    .map((id) => allSpells.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);
  const leveled = known.filter((s) => s.level > 0).map((s) => s.id);
  const howText =
    change === 'after-long-rest'
      ? hero.canPrepare
        ? `${hero.name} has just had a long rest and can change prepared spells (until the next fight).${
            leveled.length > rules.spells
              ? ` (The starting list has ${leveled.length}; the rules allow ${rules.spells} at this level, so preparing trims it.)`
              : ''
          }`
        : `${hero.name} can change prepared spells after a long rest.`
      : change === 'spellbook'
        ? 'Every spell in the spellbook is ready (this game’s simplification). New spells go in at level-up.'
        : `${hero.name} knows these spells; they can be swapped at level-up.`;

  const save = () => {
    const err = prepareHeroSpells(hero.id, editing!);
    if (err) setMsg(err);
    else {
      setMsg('Spells prepared.');
      setEditing(null);
    }
  };

  return (
    <div className="spells-tab">
      <dl className="big-stats compact">
        <Stat label="Spellcasting" value={nums.ability.toUpperCase()} />
        <Stat label="Spell save DC" value={nums.dc} />
        <Stat label="Spell attack" value={signed(nums.attack)} />
        <Stat
          label={change === 'after-long-rest' ? 'Prepared' : 'Known'}
          value={`${leveled.length}/${rules.spells}`}
        />
        {slots.map((n, i) =>
          n > 0 ? (
            <Stat
              key={i}
              label={`${ORDINAL[i + 1]} slots`}
              value={`${n - (hero.slotsUsed[i] ?? 0)}/${n}`}
            />
          ) : null,
        )}
      </dl>
      <p className="small">
        {howText}{' '}
        {change === 'after-long-rest' && hero.canPrepare && !editing && (
          <button
            type="button"
            className="menu-primary small-btn"
            onClick={() => setEditing(leveled.slice(0, rules.spells))}
          >
            Change prepared spells
          </button>
        )}
      </p>
      {editing ? (
        <div className="prep">
          <p className="small">
            Choose up to <strong>{rules.spells}</strong> (
            {getClass(hero.classId).spellcasting!.ability.toUpperCase()} modifier + level). Chosen:{' '}
            <strong>{editing.length}</strong>
          </p>
          {[1, 2, 3].map((lvl) => {
            const pool = rules.spellPool.filter((s) => s.level === lvl);
            if (!pool.length) return null;
            return (
              <div key={lvl}>
                <h3 className="eyebrow">{ORDINAL[lvl]}</h3>
                <div className="spell-picks">
                  {pool.map((s) => {
                    const on = editing.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={on}
                        className={`spell-pick${on ? ' on' : ''}`}
                        title={s.summary}
                        onClick={() =>
                          setEditing(on ? editing.filter((x) => x !== s.id) : [...editing, s.id])
                        }
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="row">
            <button
              type="button"
              className="menu-primary small-btn"
              aria-disabled={!!prepareProblem(hero, editing)}
              onClick={save}
            >
              Prepare these spells
            </button>
            <button
              type="button"
              className="menu-secondary small-btn"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        [0, 1, 2, 3].map((lvl) => {
          const list = known.filter((s) => s.level === lvl);
          if (!list.length) return null;
          return (
            <section key={lvl} aria-label={ORDINAL[lvl]}>
              <h3 className="eyebrow">{ORDINAL[lvl]}</h3>
              <ul className="spell-list">
                {list.map((s) => (
                  <li key={s.id}>
                    <span className="strong">{s.name}</span>{' '}
                    <span className="faint small">
                      {s.castingTime.replace('-', ' ')}
                      {s.concentration ? ' · concentration' : ''}
                    </span>{' '}
                    <span className="small muted">{s.summary}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
      {hero.invocations.length > 0 && (
        <p className="small">
          <span className="eyebrow-inline">Invocations</span>{' '}
          {hero.invocations.map(pretty).join(', ')}
        </p>
      )}
      <p className="small" role="status">
        {msg}
      </p>
    </div>
  );
}

function EquipmentTab({ hero }: { hero: Hero }) {
  const { game } = useGame();
  const g = game!;
  const toggleHelmet = (on: boolean) =>
    useGame.setState({
      game: {
        ...g,
        party: g.party.map((h) =>
          h.id === hero.id ? { ...h, portrait: { ...h.portrait, helmet: on } } : h,
        ),
      },
    });
  const helmetOn = heroPortrait(hero).gear.helmet;
  return (
    <div className="equip-tab">
      <div className="equip-look">
        <div className="sheet-portrait">
          <Portrait {...heroPortrait(hero)} />
        </div>
        <label className="small">
          <input
            type="checkbox"
            checked={helmetOn}
            onChange={(e) => toggleHelmet(e.target.checked)}
          />{' '}
          Show a helmet
        </label>
        <p className="small faint">
          In 5e a helmet is part of a suit of armor, not a separate item; this only changes the
          portrait.
        </p>
        <p className="small">
          <span className="eyebrow-inline">Wearing</span>{' '}
          {[
            hero.equipment.armor && itemName(hero.equipment.armor),
            hero.equipment.shield && 'shield',
          ]
            .filter(Boolean)
            .join(', ') || 'no armor'}
        </p>
      </div>
      <EquipmentPanel heroId={hero.id} />
    </div>
  );
}
