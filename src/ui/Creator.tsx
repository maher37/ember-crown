import { SUBCLASS_TITLE } from '../game/hero';
import { useMemo, useState } from 'react';
import { backgrounds, classes, origins } from '../data';
import type { OriginId } from '../data/schemas/origin';
import {
  bonusSkillCount,
  buildHero,
  CLASS_PRIORITY,
  classSkillChoices,
  getOrigin,
  originDraft,
  defaultHalfElfBonus,
  draftProblems,
  finalAbilities,
  getClass,
  getSpecies,
  grantedSkills,
  levelOneChoices,
  levelOneHp,
  methodPool,
  newDraft,
  speciesBonuses,
  type AbilityMethod,
  type HairStyle,
  type HeroDraft,
} from '../game/hero';
import { PARTY_SIZE, useGame } from '../game/store';
import {
  ABILITIES,
  ABILITY_NAMES,
  abilityModifier,
  canRaisePointBuy,
  placeByPriority,
  POINT_BUY_BUDGET,
  POINT_BUY_MIN,
  pointBuySpent,
  rollAbilitySet,
  STANDARD_ARRAY,
  swapScores,
  type Ability,
  type Skill,
} from '../rules';
import './Creator.css';
import {
  CLASS_COPY,
  EYE_COLORS,
  HAIR_COLORS,
  signed,
  SKILL_NAMES,
  SKIN_TONES,
  SPECIES_ORDER,
} from './creatorCopy';
import { Portrait } from './Portrait';
import { portraitGear, speciesLook } from './heroLook';

const SHORT: Record<Ability, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
};

/** Party creation, rebuilt from docs/mockups/CharacterCreator.dc.html. */
export function Creator() {
  const { pendingParty, addHero, removeHero, beginAdventure, goto, withRng, startNewGame } =
    useGame();
  const takenOrigins = new Set(pendingParty.map((h) => h.origin));
  const freeOrigins = origins.filter((o) => !takenOrigins.has(o.id));
  const [draft, setDraft] = useState<HeroDraft>(() => newDraft());
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState('');
  const origin = draft.origin === 'custom' ? null : getOrigin(draft.origin);
  const isOrigin = origin !== null;
  const cls = getClass(draft.classId);
  const sp = getSpecies(draft.speciesId);
  const abilities = finalAbilities(draft);
  const bonuses = speciesBonuses(draft);
  const mods = Object.fromEntries(
    ABILITIES.map((a) => [a, abilityModifier(abilities[a])]),
  ) as Record<Ability, number>;
  const problems = useMemo(() => draftProblems(draft), [draft]);
  const update = (patch: Partial<HeroDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const pickClass = (classId: string) =>
    setDraft((d) => ({
      ...d,
      classId,
      baseAbilities:
        d.method === 'point'
          ? d.baseAbilities
          : placeByPriority(methodPool(d.method, d.rolled), CLASS_PRIORITY[classId]!),
      halfElfBonus: defaultHalfElfBonus(classId),
      classSkills: [],
      expertise: [],
      fightingStyle: null,
      subclassId: undefined,
    }));
  const pickSpecies = (speciesId: string) =>
    setDraft((d) => {
      const granted = grantedSkills({ speciesId, backgroundId: d.backgroundId });
      return {
        ...d,
        speciesId,
        bonusSkills: [],
        halfElfBonus: defaultHalfElfBonus(d.classId),
        classSkills: d.classSkills.filter((s) => !granted.includes(s)),
        expertise: [],
      };
    });
  const pickBackground = (backgroundId: string) =>
    setDraft((d) => {
      const granted = grantedSkills({ speciesId: d.speciesId, backgroundId });
      return {
        ...d,
        backgroundId,
        classSkills: d.classSkills.filter((s) => !granted.includes(s)),
        bonusSkills: d.bonusSkills.filter((s) => !granted.includes(s)),
        expertise: [],
      };
    });
  const pickMethod = (method: AbilityMethod) =>
    setDraft((d) => ({
      ...d,
      method,
      baseAbilities:
        method === 'roll' && !d.rolled
          ? d.baseAbilities
          : placeByPriority(methodPool(method, d.rolled), CLASS_PRIORITY[d.classId]!),
    }));
  const roll = () => {
    const rolls = withRng((rng) => rollAbilitySet(rng));
    const rolled = rolls.map((r) => r.total);
    setDraft((d) => ({
      ...d,
      method: 'roll',
      rolled,
      rollLog: rolls.map((r) => r.text),
      baseAbilities: placeByPriority(rolled, CLASS_PRIORITY[d.classId]!),
    }));
  };
  const setOrigin = (id: OriginId | null) => {
    setDraft(id ? originDraft(id) : newDraft());
    setStep(1);
  };

  const addToParty = () => {
    setError('');
    try {
      const hero = buildHero(draft, `hero-${Date.now().toString(36)}-${pendingParty.length + 1}`);
      addHero(hero);
      if (pendingParty.length + 1 === PARTY_SIZE) {
        beginAdventure();
        return;
      }
      setDraft(newDraft());
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const memberNumber = pendingParty.length + 1;
  const hp = levelOneHp(draft);

  return (
    <div className="creator">
      <header className="creator-header">
        <div className="row">
          <button
            type="button"
            className="icon-btn"
            aria-label={step === 2 ? 'Back: species, class & abilities' : 'Back to title screen'}
            title={step === 2 ? 'Back: species, class & abilities' : 'Back to title screen'}
            onClick={() => (step === 2 ? setStep(1) : goto('title'))}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                d="M11 3 L5 9 L11 15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h1>Create your party</h1>
          {(pendingParty.length > 0 || step === 2) && (
            <button
              type="button"
              className="menu-secondary small-btn"
              onClick={() => {
                if (!confirmReset) return setConfirmReset(true);
                setConfirmReset(false);
                startNewGame();
                setDraft(newDraft());
                setStep(1);
              }}
              onBlur={() => setConfirmReset(false)}
            >
              {confirmReset ? 'Really start over? Click again' : 'Start over'}
            </button>
          )}
          <div role="radiogroup" aria-label="Character type" className="seg">
            <button
              type="button"
              role="radio"
              aria-checked={!isOrigin}
              className={!isOrigin ? 'on' : ''}
              onClick={() => setOrigin(null)}
            >
              Custom hero
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={isOrigin}
              className={isOrigin ? 'on' : ''}
              disabled={!isOrigin && freeOrigins.length === 0}
              title={
                freeOrigins.length === 0 ? 'Every origin hero is already in your party' : undefined
              }
              onClick={() => !isOrigin && setOrigin(freeOrigins[0]!.id)}
            >
              Origin hero
            </button>
          </div>
        </div>
        <div className="row" aria-label={`Party member ${memberNumber} of ${PARTY_SIZE}`}>
          <span className="muted">
            Party member {memberNumber} of {PARTY_SIZE}
          </span>
          {Array.from({ length: PARTY_SIZE }, (_, i) => (
            <span
              key={i}
              className={`dot ${i < pendingParty.length ? 'done' : i === pendingParty.length ? 'current' : ''}`}
              title={pendingParty[i]?.name}
            >
              {i + 1}
            </span>
          ))}
        </div>
      </header>

      {step === 1 ? (
        <div className="creator-body">
          <section aria-label="Appearance" className="col-appearance">
            <div className="row bottom">
              <div className="portrait-frame">
                <Portrait
                  {...draft.portrait}
                  {...speciesLook(sp.id)}
                  cloth={CLASS_COPY[cls.id]!.cloth}
                  gear={portraitGear({
                    classId: cls.id,
                    portrait: draft.portrait,
                    equipment: {
                      armor: cls.startingKit.armor ?? null,
                      shield: cls.startingKit.shield,
                    },
                  })}
                  label="Portrait of your character"
                />
              </div>
              <div className="stack-4">
                <span className="hero-species">{sp.name}</span>
                <span className="muted small">{cls.name} · Level 1</span>
              </div>
            </div>
            {isOrigin ? (
              <div className="field">
                Name
                <div className="name-fixed">
                  {origin.name}
                  <span className="tag">Origin</span>
                </div>
              </div>
            ) : (
              <label className="field">
                Name
                <input
                  type="text"
                  value={draft.name}
                  maxLength={40}
                  placeholder="Mira Ashgrove"
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
            )}
            <Swatches
              label="Skin"
              word="Skin tone"
              colors={SKIN_TONES}
              value={draft.portrait.skin}
              disabled={isOrigin}
              onPick={(skin) => update({ portrait: { ...draft.portrait, skin } })}
            />
            <Swatches
              label="Hair"
              word="Hair color"
              colors={HAIR_COLORS}
              value={draft.portrait.hair}
              disabled={isOrigin}
              onPick={(hair) => update({ portrait: { ...draft.portrait, hair } })}
            />
            <Swatches
              label="Eyes"
              word="Eye color"
              colors={EYE_COLORS}
              value={draft.portrait.eyes}
              disabled={isOrigin}
              onPick={(eyes) => update({ portrait: { ...draft.portrait, eyes } })}
            />
            <div className="grid-4">
              {(['short', 'long', 'bald', 'hood'] as HairStyle[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`pill ${draft.portrait.hairStyle === s ? 'on' : ''}`}
                  aria-pressed={draft.portrait.hairStyle === s}
                  disabled={isOrigin}
                  onClick={() => update({ portrait: { ...draft.portrait, hairStyle: s } })}
                >
                  {s[0]!.toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <div className="grid-2">
              {(['beard', 'scar'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`pill ${draft.portrait[f] ? 'on' : ''}`}
                  aria-pressed={draft.portrait[f]}
                  disabled={isOrigin}
                  onClick={() =>
                    update({ portrait: { ...draft.portrait, [f]: !draft.portrait[f] } })
                  }
                >
                  {f === 'beard' ? 'Beard' : 'Scar'}
                </button>
              ))}
            </div>
            <p className="note">
              Elf and half-elf ears are set automatically. Horns and scales for other species come
              in v2.
            </p>
          </section>

          <section aria-label="Species and class" className="col-main">
            {isOrigin && (
              <>
                <div role="radiogroup" aria-label="Origin hero" className="origin-picks">
                  {origins.map((o) => {
                    const on = o.id === origin.id;
                    const taken = takenOrigins.has(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={`bg-card ${on ? 'on' : ''}`}
                        disabled={taken && !on}
                        title={taken ? `${o.name} is already in your party` : undefined}
                        onClick={() => setOrigin(o.id)}
                      >
                        <span className="bg-name">{o.name}</span>
                        <span className="small">
                          {getSpecies(o.speciesId).name} {getClass(o.classId).name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="origin-banner">
                  <span className="origin-title">
                    {origin.name} · {origin.title}
                  </span>
                  <span>{origin.pitch}</span>
                </div>
              </>
            )}
            <h2 className="eyebrow">Species</h2>
            <div className="wrap">
              {SPECIES_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`pill ${id === sp.id ? 'on' : ''}`}
                  aria-pressed={id === sp.id}
                  disabled={isOrigin && id !== sp.id}
                  onClick={() => pickSpecies(id)}
                >
                  {getSpecies(id).name}
                </button>
              ))}
            </div>
            <h2 className="eyebrow">Class</h2>
            <div className="class-grid">
              {classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`class-card ${c.id === cls.id ? 'on' : ''}`}
                  aria-pressed={c.id === cls.id}
                  disabled={isOrigin && c.id !== cls.id}
                  onClick={() => pickClass(c.id)}
                >
                  <span className="class-name">{c.name}</span>
                  <span className="class-role">
                    {CLASS_COPY[c.id]!.role} · d{c.hitDie}
                  </span>
                </button>
              ))}
            </div>
            <div className="panel">
              <div className="row between baseline">
                <span className="panel-title">{cls.name}</span>
                <span className="accent small">{CLASS_COPY[cls.id]!.role}</span>
              </div>
              <p>{CLASS_COPY[cls.id]!.blurb}</p>
              <div className="grid-4 facts">
                <Fact label="Hit die" value={`d${cls.hitDie}`} />
                <Fact
                  label="Primary"
                  value={cls.primaryAbilities.map((a) => SHORT[a]).join(', ')}
                />
                <Fact label="Saves" value={cls.saves.map((a) => SHORT[a]).join(', ')} />
                <Fact
                  label="Subclass"
                  value={`${
                    cls.subclasses?.find((x) => x.id === (draft.subclassId ?? cls.subclass.id))
                      ?.name ?? cls.subclass.name
                  } (${cls.subclass.level})`}
                />
              </div>
            </div>
          </section>

          <section aria-label="Ability scores" className="col-abilities">
            <h2 className="eyebrow">Ability scores</h2>
            <div role="radiogroup" aria-label="Score method" className="grid-3">
              {(
                [
                  ['array', 'Standard'],
                  ['point', 'Point buy'],
                  ['roll', 'Roll'],
                ] as [AbilityMethod, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={draft.method === id}
                  className={`pill ${draft.method === id ? 'on' : ''}`}
                  onClick={() => pickMethod(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="row between method-row">
              <span className="muted small" aria-live="polite">
                {draft.method === 'array' &&
                  `Standard array ${STANDARD_ARRAY.join(', ')}, placed for your class. Use the menus to swap.`}
                {draft.method === 'point' &&
                  `27-point buy: ${POINT_BUY_BUDGET - pointBuySpent(draft.baseAbilities)} points left.`}
                {draft.method === 'roll' &&
                  (draft.rolled
                    ? `Rolled (4d6, drop lowest): ${draft.rolled.join(', ')}`
                    : 'Press Roll to roll 4d6, drop the lowest, six times.')}
              </span>
              {draft.method === 'roll' && (
                <button type="button" className="roll-btn" onClick={roll}>
                  Roll 4d6
                </button>
              )}
            </div>
            <table className="scores">
              <thead>
                <tr>
                  <th>Ability</th>
                  <th>Base</th>
                  <th>Species</th>
                  <th>Total</th>
                  <th>Mod</th>
                </tr>
              </thead>
              <tbody>
                {ABILITIES.map((a) => (
                  <tr key={a} className={CLASS_PRIORITY[cls.id]![0] === a ? 'top' : ''}>
                    <th scope="row" title={ABILITY_NAMES[a]}>
                      {SHORT[a]}
                    </th>
                    <td>
                      {draft.method === 'point' ? (
                        <span className="stepper">
                          <button
                            type="button"
                            aria-label={`Lower ${ABILITY_NAMES[a]}`}
                            disabled={draft.baseAbilities[a] <= POINT_BUY_MIN}
                            onClick={() =>
                              update({
                                baseAbilities: {
                                  ...draft.baseAbilities,
                                  [a]: draft.baseAbilities[a] - 1,
                                },
                              })
                            }
                          >
                            −
                          </button>
                          {draft.baseAbilities[a]}
                          <button
                            type="button"
                            aria-label={`Raise ${ABILITY_NAMES[a]}`}
                            disabled={!canRaisePointBuy(draft.baseAbilities, a)}
                            onClick={() =>
                              update({
                                baseAbilities: {
                                  ...draft.baseAbilities,
                                  [a]: draft.baseAbilities[a] + 1,
                                },
                              })
                            }
                          >
                            +
                          </button>
                        </span>
                      ) : (
                        <select
                          aria-label={`${ABILITY_NAMES[a]} base score`}
                          value={draft.baseAbilities[a]}
                          disabled={draft.method === 'roll' && !draft.rolled}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            const other = ABILITIES.find(
                              (b) => b !== a && draft.baseAbilities[b] === v,
                            );
                            if (other)
                              update({ baseAbilities: swapScores(draft.baseAbilities, a, other) });
                          }}
                        >
                          {[...new Set(methodPool(draft.method, draft.rolled))].map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="accent">{bonuses[a] ? `+${bonuses[a]}` : '—'}</td>
                    <td className="strong">{abilities[a]}</td>
                    <td className="strong heading">{signed(mods[a])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="grid-4">
              <Stat label="HP" value={String(hp)} />
              <Stat label="Initiative" value={signed(mods.dex)} />
              <Stat label="Prof." value="+2" />
              <Stat label="Speed" value={`${sp.speed} ft`} />
            </div>
            <button type="button" className="primary next" onClick={() => setStep(2)}>
              Next: Background &amp; skills
            </button>
          </section>
        </div>
      ) : (
        <StepTwo
          draft={draft}
          update={update}
          pickBackground={pickBackground}
          problems={problems}
          error={error}
          onAdd={addToParty}
          memberNumber={memberNumber}
          party={pendingParty.map((h) => ({
            id: h.id,
            label: `${h.name} (${getClass(h.classId).name})`,
          }))}
          onRemove={removeHero}
        />
      )}
    </div>
  );
}

function StepTwo({
  draft,
  update,
  pickBackground,
  problems,
  error,
  onAdd,
  memberNumber,
  party,
  onRemove,
}: {
  draft: HeroDraft;
  update: (p: Partial<HeroDraft>) => void;
  pickBackground: (id: string) => void;
  problems: string[];
  error: string;
  onAdd: () => void;
  memberNumber: number;
  party: { id: string; label: string }[];
  onRemove: (id: string) => void;
}) {
  const granted = grantedSkills(draft);
  const { choose, from } = classSkillChoices(draft.classId);
  const bonusCount = bonusSkillCount(draft.speciesId);
  const choices = levelOneChoices(draft.classId);
  const sp = getSpecies(draft.speciesId);
  const cls = getClass(draft.classId);
  const fixedSubclass = draft.origin !== 'custom' && !!getOrigin(draft.origin).subclassId;
  const owned = new Set<Skill>([...granted, ...draft.classSkills, ...draft.bonusSkills]);
  const toggle = (list: Skill[], s: Skill, max: number) =>
    list.includes(s) ? list.filter((x) => x !== s) : list.length < max ? [...list, s] : list;

  return (
    <div className="creator-body">
      <section aria-label="Background" className="col-bg">
        <h2 className="eyebrow">Background</h2>
        <div className="bg-list" role="radiogroup" aria-label="Background">
          {backgrounds.map((b) => (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={b.id === draft.backgroundId}
              className={`bg-card ${b.id === draft.backgroundId ? 'on' : ''}`}
              onClick={() => pickBackground(b.id)}
            >
              <span className="bg-name">{b.name}</span>
              <span className="small">{b.skills.map((s) => SKILL_NAMES[s]).join(', ')}</span>
              <span className="small muted">
                {b.feature.name} · {b.dialogueTag}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Skills" className="col-main">
        <h2 className="eyebrow">
          Class skills: choose {choose} ({draft.classSkills.length}/{choose})
        </h2>
        <div className="skill-grid">
          {from.map((s) => {
            const isGranted = granted.includes(s);
            const on = draft.classSkills.includes(s) || isGranted;
            return (
              <button
                key={s}
                type="button"
                className={`pill ${on ? 'on' : ''}`}
                aria-pressed={on}
                disabled={isGranted}
                title={isGranted ? 'Already granted by your background or species' : undefined}
                onClick={() =>
                  update({ classSkills: toggle(draft.classSkills, s, choose), expertise: [] })
                }
              >
                {SKILL_NAMES[s]}
              </button>
            );
          })}
        </div>
        {bonusCount > 0 && (
          <>
            <h2 className="eyebrow">
              Skill Versatility: choose {bonusCount} ({draft.bonusSkills.length}/{bonusCount})
            </h2>
            <div className="skill-grid">
              {(Object.keys(SKILL_NAMES) as Skill[])
                .filter((s) => !granted.includes(s) && !draft.classSkills.includes(s))
                .map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`pill ${draft.bonusSkills.includes(s) ? 'on' : ''}`}
                    aria-pressed={draft.bonusSkills.includes(s)}
                    onClick={() =>
                      update({
                        bonusSkills: toggle(draft.bonusSkills, s, bonusCount),
                        expertise: [],
                      })
                    }
                  >
                    {SKILL_NAMES[s]}
                  </button>
                ))}
            </div>
          </>
        )}
        {choices.expertise > 0 && (
          <>
            <h2 className="eyebrow">
              Expertise: choose {choices.expertise} of your skills ({draft.expertise.length}/
              {choices.expertise})
            </h2>
            <div className="skill-grid">
              {[...owned].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`pill ${draft.expertise.includes(s) ? 'on' : ''}`}
                  aria-pressed={draft.expertise.includes(s)}
                  onClick={() =>
                    update({ expertise: toggle(draft.expertise, s, choices.expertise) })
                  }
                >
                  {SKILL_NAMES[s]}
                </button>
              ))}
            </div>
          </>
        )}
        {cls.subclasses && cls.subclass.level === 1 && (
          <>
            <h2 className="eyebrow">{SUBCLASS_TITLE[cls.id]}</h2>
            <div className="style-list" role="radiogroup" aria-label={SUBCLASS_TITLE[cls.id]}>
              {cls.subclasses.map((o) => {
                const on = (draft.subclassId ?? cls.subclass.id) === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`bg-card ${on ? 'on' : ''}`}
                    disabled={fixedSubclass && !on}
                    onClick={() => update({ subclassId: o.id })}
                  >
                    <span className="bg-name">{o.name}</span>
                    <span className="small">{o.summary}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {choices.fightingStyles && (
          <>
            <h2 className="eyebrow">Fighting style</h2>
            <div className="style-list" role="radiogroup" aria-label="Fighting style">
              {choices.fightingStyles.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={draft.fightingStyle === o.id}
                  className={`bg-card ${draft.fightingStyle === o.id ? 'on' : ''}`}
                  onClick={() => update({ fightingStyle: o.id })}
                >
                  <span className="bg-name">{o.name}</span>
                  <span className="small">{o.summary}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {sp.abilityChoice && (
          <>
            <h2 className="eyebrow">Half-elf: +1 to two abilities</h2>
            <div className="grid-5">
              {ABILITIES.filter((a) => !sp.abilityChoice!.exclude.includes(a)).map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`pill ${draft.halfElfBonus.includes(a) ? 'on' : ''}`}
                  aria-pressed={draft.halfElfBonus.includes(a)}
                  onClick={() =>
                    update({
                      halfElfBonus: draft.halfElfBonus.includes(a)
                        ? draft.halfElfBonus.filter((x) => x !== a)
                        : draft.halfElfBonus.length < 2
                          ? [...draft.halfElfBonus, a]
                          : draft.halfElfBonus,
                    })
                  }
                >
                  {SHORT[a]}
                </button>
              ))}
            </div>
          </>
        )}
        <p className="note">
          Spells, favored enemies and other level-1 picks use sensible defaults for now; choosing
          them arrives with the level-up screen (M5).
        </p>
      </section>

      <section aria-label="Summary" className="col-abilities">
        <h2 className="eyebrow">Skills you'll have</h2>
        <p className="small">
          {[...owned]
            .map((s) => SKILL_NAMES[s] + (draft.expertise.includes(s) ? ' ★' : ''))
            .join(', ') || '—'}
        </p>
        {party.length > 0 && (
          <>
            <h2 className="eyebrow">Party so far</h2>
            <ul className="party-list">
              {party.map((p) => (
                <li key={p.id}>
                  <span>{p.label}</span>
                  <button
                    type="button"
                    className="link"
                    onClick={() => onRemove(p.id)}
                    aria-label={`Remove ${p.label}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {problems.length > 0 && (
          <div className="problems" role="status">
            <span className="eyebrow">Still to do</span>
            <ul>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="stack-6 push-down">
          <button type="button" className="primary" disabled={problems.length > 0} onClick={onAdd}>
            {memberNumber === PARTY_SIZE
              ? 'Add to party and begin'
              : `Add to party (${memberNumber} of ${PARTY_SIZE})`}
          </button>
        </div>
      </section>
    </div>
  );
}

function Swatches({
  label,
  word,
  colors,
  value,
  disabled,
  onPick,
}: {
  label: string;
  word: string;
  colors: string[];
  value: string;
  disabled: boolean;
  onPick: (c: string) => void;
}) {
  return (
    <div className="row swatches" role="group" aria-label={label}>
      <span className="swatch-label">{label}</span>
      {colors.map((c, i) => (
        <button
          key={c}
          type="button"
          className={`swatch ${value === c ? 'on' : ''}`}
          style={{ background: c }}
          aria-label={`${word} ${i + 1}`}
          aria-pressed={value === c}
          disabled={disabled}
          onClick={() => onPick(c)}
        />
      ))}
    </div>
  );
}

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className="fact">
    <span className="fact-label">{label}</span>
    <span className="strong">{value}</span>
  </div>
);
const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="stat">
    <span className="fact-label">{label}</span>
    <span className="stat-value">{value}</span>
  </div>
);
