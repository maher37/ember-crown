// The combat side panel: active hero, party health, inspect tooltip and log (split from CombatScreen.tsx).
import {
  currentAc,
  terrainAt,
  type AttackOption,
  type Combatant,
  type CombatState,
} from '../../game/combat';
import { getClass, getSpecies, slotsLeft, type Hero } from '../../game/hero';
import { briefLine, hitChance } from '../combatUi';
import type { foeInfo } from '../foeInfo';
import { heroPortrait } from '../heroLook';
import { terrainName } from '../mapStyle';
import { Portrait } from '../Portrait';

export function CombatAside({
  s,
  me,
  hero,
  hp,
  maxHp,
  hovered,
  info,
  hoverOpt,
  myTurn,
  showRolls,
  log,
}: {
  s: CombatState;
  me: Combatant;
  hero: (Combatant & { creature: Hero }) | null;
  hp: number;
  maxHp: number;
  hovered: Combatant | undefined;
  info: ReturnType<typeof foeInfo> | null;
  hoverOpt: AttackOption | undefined;
  myTurn: boolean;
  showRolls: boolean;
  log: CombatState['log'];
}) {
  return (
    <aside className="combat-aside">
      <div className={`active-card ${me.side}`}>
        {hero ? (
          <div className="active-portrait">
            <Portrait {...heroPortrait(hero.creature)} />
          </div>
        ) : (
          <div
            className={`active-portrait enemy-face${me.side === 'party' ? ' ally-face' : ''}`}
            aria-hidden="true"
          >
            {me.short}
          </div>
        )}
        <div className="active-info">
          <div className="row between baseline">
            <span className="active-name">{me.name}</span>
            <span className={me.side === 'party' ? 'turn-you' : 'turn-foe'}>
              {s.outcome ? '' : me.side === 'party' ? 'Your turn' : 'Enemy turn'}
            </span>
          </div>
          <span className="muted small">
            {hero
              ? `${getSpecies(hero.creature.speciesId).name} ${getClass(hero.creature.classId).name} ${hero.creature.level}`
              : me.pet
                ? 'Familiar'
                : me.side === 'party'
                  ? 'Ally'
                  : 'Enemy'}{' '}
            · AC {currentAc(me)} · Speed {me.speed} ft
            {me.wildShape ? ' · Wolf form' : ''}
          </span>
          <div className="row">
            <div className="hp-bar" aria-hidden="true">
              <div
                style={{
                  width: `${Math.round((hp / maxHp) * 100)}%`,
                  background: hp > maxHp / 2 ? '#5f9a4a' : '#c9a23a',
                }}
              />
            </div>
            <span className="small strong">
              {hp} / {maxHp} HP{me.creature.tempHp ? ` (+${me.creature.tempHp})` : ''}
            </span>
          </div>
          {hero && slotsLeft(hero.creature).length > 0 && (
            <span className="small muted">
              Spell slots:{' '}
              {slotsLeft(hero.creature)
                .map((n, i) => `${['1st', '2nd', '3rd'][i]} ${n}`)
                .join(' · ')}
            </span>
          )}
        </div>
      </div>
      <section className="party-hp" aria-label="Party health">
        {Object.values(s.combatants)
          .filter((c) => c.side === 'party' && !c.gone)
          .map((c) => {
            const now = c.wildShape ? c.wildShape.hp : c.creature.hp;
            const max = c.wildShape ? c.wildShape.maxHp : c.creature.maxHp;
            const state = c.creature.dead
              ? 'dead'
              : c.creature.hp === 0
                ? c.creature.stable
                  ? 'down, stable'
                  : 'dying'
                : '';
            return (
              <div key={c.id} className={`party-hp-row ${c.id === me.id ? 'on' : ''}`}>
                <span className="party-hp-name" title={c.name}>
                  {/* A familiar shows by its shape ("imp"), not its owner's name. */}
                  {c.pet ? c.name.split(' ').at(-1) : c.name.split(' ')[0]}
                </span>
                <div className="hp-bar" aria-hidden="true">
                  <div
                    style={{
                      width: `${Math.round((now / Math.max(1, max)) * 100)}%`,
                      background: now > max / 2 ? '#5f9a4a' : now > 0 ? '#c9a23a' : '#8a3a2a',
                    }}
                  />
                </div>
                <span className="small">
                  {now}/{max}
                  {c.creature.tempHp ? ` +${c.creature.tempHp}` : ''}
                  {state ? ` · ${state}` : ''}
                  {c.creature.conditions.length > 0 && !state
                    ? ` · ${[...new Set(c.creature.conditions.map((x) => x.id))].join(', ')}`
                    : ''}
                </span>
              </div>
            );
          })}
      </section>
      <div className="row between baseline">
        <h2 className="eyebrow">Combat log · newest first</h2>
        <span className="faint small">
          Dice: {showRolls ? 'automatic, all shown' : 'automatic'}
        </span>
      </div>
      {hovered && (
        <div className={`tooltip inspect ${hovered.side}`} role="status">
          <span className="strong">
            {hovered.name} · AC {currentAc(hovered)} · HP{' '}
            {hovered.wildShape?.hp ?? hovered.creature.hp}/
            {hovered.wildShape?.maxHp ?? hovered.creature.maxHp}
          </span>
          {hovered.side === 'enemy' && myTurn && hoverOpt && (
            <span>
              {hoverOpt.name}: {hitChance(hoverOpt.toHit, currentAc(hovered))}% to hit ·{' '}
              {hoverOpt.damage.map((d) => `${d.dice} ${d.type}`).join(' + ')}
            </span>
          )}
          {info && (
            <>
              <span className="foe-kind">{info.kind}</span>
              {info.defenses.map((d) => (
                <span key={d} className="muted">
                  {d}
                </span>
              ))}
              {info.traits.length > 0 && (
                <span className="muted">Traits: {info.traits.join(', ')}</span>
              )}
              {info.edges.map((d) => (
                <span key={d} className="foe-edge">
                  ★ {d}
                </span>
              ))}
            </>
          )}
          {hovered.creature.conditions.length > 0 && (
            <span className="muted">
              Conditions: {[...new Set(hovered.creature.conditions.map((x) => x.id))].join(', ')}
            </span>
          )}
          {hovered.effects.length > 0 && (
            <span className="muted">
              Under: {[...new Set(hovered.effects.map((e) => e.name))].join(', ')}
            </span>
          )}
          <span className="muted">
            Standing on: {terrainName(s.map.style, terrainAt(s.map, hovered.pos))}
          </span>
        </div>
      )}
      <div className="log" role="log" aria-live="polite">
        {log.map((l, i) => (
          <div key={s.log.length - i} className={`log-${l.kind}`}>
            {showRolls ? l.text : briefLine(l.text)}
          </div>
        ))}
      </div>
    </aside>
  );
}
