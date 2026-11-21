import { SpellTip, Tip } from './Tip';
import { useMemo, useState } from 'react';
import { getClass, getSpecies } from '../game/hero';
import {
  abilityPreview,
  defaultPlan,
  hpGain,
  levelUpOptions,
  newAbilities,
  planProblems,
  rollHitDie,
  spellRules,
  type LevelUpPlan,
} from '../game/levelup';
import { useGame } from '../game/store';
import {
  ABILITIES,
  ABILITY_NAMES,
  abilityModifier,
  SeededRng,
  XP_THRESHOLDS,
  type Ability,
} from '../rules';
import './Explore.css';
import { Portrait } from './Portrait';
import { heroPortrait } from './heroLook';

const SHORT: Record<Ability, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
};
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Level-up with hover previews (rebuilt from docs/mockups/LevelUp.dc.html). */
export function LevelUpScreen() {
  const { game, levelUpId, confirmLevelUp, goHome, rngState } = useGame();
  const hero = game!.party.find((h) => h.id === levelUpId)!;
  const opts = useMemo(() => levelUpOptions(hero), [hero]);
  const [plan, setPlan] = useState<LevelUpPlan>(() => defaultPlan(hero));
  const [hover, setHover] = useState<Ability>(
    getClass(hero.classId).spellcasting?.ability ?? getClass(hero.classId).primaryAbilities[0]!,
  );
  const cls = getClass(hero.classId);
  const used = Object.values(plan.asi).reduce((a, b) => a + (b ?? 0), 0);
  const problems = planProblems(hero, plan);
  const rules = spellRules(hero, opts.newLevel, newAbilities(hero, plan));
  const gain = hpGain(hero, plan);
  const conNow = abilityModifier(newAbilities(hero, plan).con);

  const setAsi = (a: Ability, d: number) =>
    setPlan((p) => ({ ...p, asi: { ...p.asi, [a]: Math.max(0, (p.asi[a] ?? 0) + d) } }));
  const canPlus = (a: Ability) =>
    used < 2 && (plan.asi[a] ?? 0) < 2 && hero.abilities[a] + (plan.asi[a] ?? 0) < 20;
  const toggle = (key: 'cantrips' | 'spells', id: string, max: number) =>
    setPlan((p) => ({
      ...p,
      [key]: p[key].includes(id)
        ? p[key].filter((x) => x !== id)
        : p[key].length < max
          ? [...p[key], id]
          : p[key],
    }));
  const togglePick = (group: string, id: string, max: number) =>
    setPlan((p) => {
      const cur = p.picks[group] ?? [];
      const next = cur.includes(id)
        ? cur.filter((x) => x !== id)
        : max === 1
          ? [id]
          : cur.length < max
            ? [...cur, id]
            : cur;
      return { ...p, picks: { ...p.picks, [group]: next } };
    });

  const hoverScore = Math.min(20, hero.abilities[hover] + Math.max(plan.asi[hover] ?? 0, 1));
  const preview = abilityPreview(hero, hover, hoverScore);
  const summary: [string, string][] = [
    ['Level', `${hero.level} → ${opts.newLevel}`],
    ['Max HP', `${hero.maxHp} → ${hero.maxHp + gain}`],
    ...ABILITIES.filter((a) => plan.asi[a]).map(
      (a) =>
        [ABILITY_NAMES[a], `${hero.abilities[a]} → ${hero.abilities[a] + plan.asi[a]!}`] as [
          string,
          string,
        ],
    ),
    ...(opts.newLevel === 5 ? [['Proficiency', '+2 → +3'] as [string, string]] : []),
  ];

  return (
    <div className="levelup">
      <header className="explore-header">
        <div className="row baseline">
          <h1>Level up!</h1>
          <span className="muted">
            {hero.name} · {cls.name} {hero.level} → <span className="accent">{opts.newLevel}</span>
          </span>
        </div>
        <span className="small muted">
          {opts.asi ? 'Hover or focus any ability to see exactly what it changes' : ''}
        </span>
      </header>
      <div className="levelup-body">
        <section aria-label="Character" className="lu-left">
          <div className="lu-portrait">
            <Portrait {...heroPortrait(hero)} />
          </div>
          <div className="small">
            <div className="row between">
              <span className="muted">XP</span>
              <span>
                {hero.xp.toLocaleString()} / {XP_THRESHOLDS[hero.level]!.toLocaleString()}
              </span>
            </div>
            <div className="xp-bar">
              <div style={{ width: '100%' }} />
            </div>
          </div>
          <div className="lu-step">
            <span className="eyebrow">Step 1 · Hit points (d{opts.hitDie})</span>
            <div className="grid-2">
              <button
                type="button"
                className={`pill ${plan.hp.method === 'average' ? 'on' : ''}`}
                aria-pressed={plan.hp.method === 'average'}
                onClick={() => setPlan({ ...plan, hp: { method: 'average' } })}
              >
                Take average ({opts.averageHp})
              </button>
              <button
                type="button"
                className={`pill ${plan.hp.method === 'roll' ? 'on' : ''}`}
                aria-pressed={plan.hp.method === 'roll'}
                onClick={() => {
                  if (plan.hp.method === 'roll') return;
                  const rng = SeededRng.fromState(rngState);
                  const value = rollHitDie(hero, rng);
                  useGame.setState({ rngState: rng.state });
                  setPlan({ ...plan, hp: { method: 'roll', value } });
                }}
              >
                Roll d{opts.hitDie}
              </button>
            </div>
            <span className="small">
              {plan.hp.method === 'roll'
                ? `Rolled d${opts.hitDie} (${plan.hp.value})`
                : `Average ${opts.averageHp}`}{' '}
              {signed(conNow)} Con = +{gain} HP
            </span>
          </div>
        </section>

        <section aria-label="Choices" className="lu-main">
          <div className="feature-cards">
            <div className="feature-card gained">
              <span className="eyebrow">Gained at level {opts.newLevel}</span>
              {opts.picks.some((p) => p.id === 'subclass') && (
                <div>
                  <span className="strong">
                    {opts.picks.find((p) => p.id === 'subclass')!.name}
                  </span>{' '}
                  <span className="small muted">
                    Choose below; each one says what it gives you.
                  </span>
                </div>
              )}
              {opts.features.map((f) => (
                <div key={f.id}>
                  <span className="strong">{f.name}</span>{' '}
                  <span className="small muted">{f.summary}</span>
                </div>
              ))}
            </div>
            {opts.next && (
              <div className="feature-card">
                <span className="eyebrow muted-eyebrow">Coming at level {opts.next.level}</span>
                <span className="small next-features">
                  {opts.next.features.map((f) => (
                    <Tip
                      key={f.name}
                      title={f.name}
                      meta={`Level ${opts.next!.level}`}
                      wrap={
                        <span tabIndex={0} className="tip-target">
                          {f.name}
                        </span>
                      }
                    >
                      {f.summary}
                    </Tip>
                  ))}
                </span>
              </div>
            )}
          </div>

          {opts.asi && (
            <div className="asi">
              <div className="row between">
                <h2 className="eyebrow">Ability Score Improvement</h2>
                <span className={used === 2 ? 'ok small' : 'gold small'}>
                  {2 - used} point{2 - used === 1 ? '' : 's'} left
                </span>
              </div>
              <p className="small muted">
                Add +2 to one ability, or +1 to two. Maximum 20. A modifier only goes up on even
                scores.
              </p>
              <table className="scores">
                <thead>
                  <tr>
                    <th>Ability</th>
                    <th>Now</th>
                    <th>Mod</th>
                    <th>Change</th>
                    <th>New</th>
                    <th>Mod</th>
                  </tr>
                </thead>
                <tbody>
                  {ABILITIES.map((a) => {
                    const n = hero.abilities[a] + (plan.asi[a] ?? 0);
                    return (
                      <tr
                        key={a}
                        className={hover === a ? 'top' : ''}
                        onMouseEnter={() => setHover(a)}
                      >
                        <th scope="row">{SHORT[a]}</th>
                        <td>{hero.abilities[a]}</td>
                        <td>{signed(abilityModifier(hero.abilities[a]))}</td>
                        <td>
                          <span className="stepper">
                            <button
                              type="button"
                              aria-label={`Decrease ${ABILITY_NAMES[a]}`}
                              disabled={!plan.asi[a]}
                              onFocus={() => setHover(a)}
                              onClick={() => setAsi(a, -1)}
                            >
                              −
                            </button>
                            {plan.asi[a] ? `+${plan.asi[a]}` : '0'}
                            <button
                              type="button"
                              aria-label={`Increase ${ABILITY_NAMES[a]}`}
                              disabled={!canPlus(a)}
                              onFocus={() => setHover(a)}
                              onClick={() => setAsi(a, 1)}
                            >
                              +
                            </button>
                          </span>
                        </td>
                        <td className={plan.asi[a] ? 'ok strong' : 'strong'}>{n}</td>
                        <td
                          className={
                            abilityModifier(n) > abilityModifier(hero.abilities[a])
                              ? 'ok strong'
                              : 'strong'
                          }
                        >
                          {signed(abilityModifier(n))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {opts.picks.map((g) => (
            <div key={g.id} className="pick-group">
              <h2 className="eyebrow">
                {g.name}: choose {g.count} ({(plan.picks[g.id] ?? []).length}/{g.count})
              </h2>
              <div className="pick-grid">
                {g.options.map((o) => {
                  const on = (plan.picks[g.id] ?? []).includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className={`bg-card ${on ? 'on' : ''}`}
                      aria-pressed={on}
                      onClick={() => togglePick(g.id, o.id, g.count)}
                    >
                      <span className="strong">{o.name}</span>
                      <span className="small">{o.summary}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {rules && (
            <div className="pick-group">
              <h2 className="eyebrow">
                Spells ·{' '}
                {rules.style === 'prepared'
                  ? 'prepared'
                  : rules.style === 'spellbook'
                    ? 'spellbook'
                    : 'known'}{' '}
                (up to level {rules.maxLevel || '—'})
              </h2>
              <p className="small muted">
                You can change your whole list now [this game lets you re-pick at each level-up].
              </p>
              {rules.cantrips > 0 && (
                <>
                  <h3 className="small strong">
                    Cantrips {plan.cantrips.length}/{rules.cantrips}
                  </h3>
                  <div className="spell-grid">
                    {rules.cantripPool.map((s) => (
                      <SpellTip
                        key={s.id}
                        spell={s}
                        wrap={
                          <button
                            type="button"
                            className={`pill ${plan.cantrips.includes(s.id) ? 'on' : ''}`}
                            aria-pressed={plan.cantrips.includes(s.id)}
                            aria-description={s.summary}
                            onClick={() => toggle('cantrips', s.id, rules.cantrips)}
                          >
                            {s.name}
                          </button>
                        }
                      />
                    ))}
                  </div>
                </>
              )}
              {rules.spells > 0 && (
                <>
                  <h3 className="small strong">
                    Spells {plan.spells.length}/{rules.spells}
                  </h3>
                  <div className="spell-grid">
                    {rules.spellPool.map((s) => (
                      <SpellTip
                        key={s.id}
                        spell={s}
                        wrap={
                          <button
                            type="button"
                            className={`pill ${plan.spells.includes(s.id) ? 'on' : ''}`}
                            aria-pressed={plan.spells.includes(s.id)}
                            aria-description={s.summary}
                            onClick={() => toggle('spells', s.id, rules.spells)}
                          >
                            {s.name} <span className="faint">{s.level}</span>
                          </button>
                        }
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <aside className="lu-aside">
          {opts.asi && (
            <div className="preview" aria-live="polite">
              <span className="eyebrow">If you raise {ABILITY_NAMES[hover]}</span>
              {preview.map((r) => (
                <div key={r.label} className="row between small">
                  <span>{r.label}</span>
                  <span className={r.before !== r.after ? 'ok strong' : 'faint'}>
                    {r.before === r.after ? r.before : `${r.before} → ${r.after}`}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="preview">
            <span className="eyebrow">Summary of this level-up</span>
            {summary.map(([l, v]) => (
              <div key={l} className="row between small">
                <span>{l}</span>
                <span className="strong">{v}</span>
              </div>
            ))}
            <span className="small muted">
              {getSpecies(hero.speciesId).name} · Hit Dice {hero.hitDice.total + 1}d{opts.hitDie}
            </span>
          </div>
          {problems.length > 0 && (
            <div className="problems-box" role="status">
              <span className="strong">Before you can confirm:</span>
              <ul className="small problems-list">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            className="primary"
            disabled={problems.length > 0}
            onClick={() => confirmLevelUp(hero.id, plan)}
          >
            Confirm level {opts.newLevel}
          </button>
          <button type="button" className="menu-secondary small-btn" onClick={goHome}>
            Not now
          </button>
        </aside>
      </div>
    </div>
  );
}
