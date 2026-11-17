import { useEffect, useMemo, useState } from 'react';
import { difficulties } from '../data';
import {
  areaCells,
  attackOptions,
  castProblem,
  currentAc,
  getSpell,
  featureList,
  hideProblem,
  offhandWeapons,
  posKey,
  reachable,
  spellChoices,
  targeting,
  targetsFor,
  terrainAt,
  type CombatState,
  type Combatant,
  type FeatureId,
  type Metamagic,
  METAMAGIC_NAMES,
  type PlayerAction,
  type Pos,
  zoneCells,
} from '../game/combat';
import { getClass, getSpecies, slotsLeft, type Hero } from '../game/hero';
import { readSlot } from '../game/save';
import { useSettings } from '../game/settings';
import { useGame } from '../game/store';
import { hasCondition, SeededRng } from '../rules';
import './Combat.css';
import { briefLine, hitChance, isDiceLine } from './combatUi';
import { CLASS_COPY, ELF_EARS } from './creatorCopy';
import { Portrait } from './Portrait';
import { terrainFill, terrainName } from './mapStyle';
import { foeInfo } from './foeInfo';
import { getItem } from '../game/items';

const CELL = 48;
const ZONE_FILL: Record<string, string> = {
  damage: '#e8c27a',
  spikes: '#6a8a3a',
  silence: '#7fb3e6',
  darkness: '#05070a',
};

type Mode =
  | { kind: 'idle' }
  | { kind: 'attack'; optionId: string; offhand?: boolean }
  | { kind: 'spell'; spellId: string; level: number; targets: string[]; mm?: Metamagic }
  | { kind: 'item'; itemId: string }
  | { kind: 'feature'; id: FeatureId; target: 'ally' | 'enemy' }
  | { kind: 'help' }
  | { kind: 'shove'; mode: 'prone' | 'push' }
  | { kind: 'grapple' };

const isHero = (c: Combatant): c is Combatant & { creature: Hero } => c.side === 'party';

/** Grid combat, rebuilt from docs/mockups/Combat.dc.html. */
export function CombatScreen() {
  const { combat, combatAct, combatAdvance, setCombatDifficulty, endFight, loadGame, goto } =
    useGame();
  const settings = useSettings();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [menu, setMenu] = useState<null | 'spells' | 'features' | 'more'>(null);
  const [hover, setHover] = useState<Pos | null>(null);
  const [message, setMessage] = useState('');
  const [smite, setSmite] = useState(0);
  const [mm, setMm] = useState<Metamagic | ''>('');
  const [stun, setStun] = useState(false);
  const [inspect, setInspect] = useState<string | null>(null);
  const s = combat!;
  const me = s.combatants[s.order[s.turnIndex]!]!;
  const myTurn = me.side === 'party' && !s.outcome && !s.prompt;

  // Enemy turns play out one at a time so the log can be followed.
  useEffect(() => {
    if (s.outcome || s.prompt || me.side !== 'enemy') return;
    const t = setTimeout(combatAdvance, 450);
    return () => clearTimeout(t);
  }, [s, me.side, combatAdvance]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMode({ kind: 'idle' });
        setMenu(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const doAct = (a: PlayerAction) => {
    const err = combatAct(a);
    setMessage(err ?? '');
    if (!err) {
      setMode({ kind: 'idle' });
      setMenu(null);
    }
    return err;
  };

  const routes = useMemo(
    () =>
      myTurn && mode.kind === 'idle' && !hasCondition(me.creature, 'prone')
        ? reachable(s, me, me.turn.movement)
        : new Map(),
    [s, me, myTurn, mode.kind],
  );
  const options = useMemo(() => (myTurn ? attackOptions(me) : []), [me, myTurn]);
  const spells = useMemo(() => (myTurn ? spellChoices(me, mm || undefined) : []), [me, myTurn, mm]);
  const knownMetamagic = (isHero(me) ? (me.creature.choices['metamagic'] ?? []) : []).filter(
    (x): x is Metamagic => x in METAMAGIC_NAMES,
  );
  const potions = Object.entries(s.inventory).filter(([id, n]) => n > 0 && getItem(id).consumable);
  const features = myTurn ? featureList(me, s) : [];

  // Which tokens can be clicked in the current mode.
  const validTargets = useMemo(() => {
    if (!myTurn) return new Set<string>();
    const all = Object.values(s.combatants).filter((c) => !c.gone && !c.creature.dead);
    if (mode.kind === 'attack') {
      const opt = options.find((o) => o.id === mode.optionId);
      return new Set(opt ? targetsFor(s, me, opt) : []);
    }
    if (mode.kind === 'shove' || mode.kind === 'grapple')
      return new Set(
        all
          .filter(
            (c) =>
              c.side === 'enemy' &&
              Math.max(Math.abs(c.pos.x - me.pos.x), Math.abs(c.pos.y - me.pos.y)) === 1,
          )
          .map((c) => c.id),
      );
    if (mode.kind === 'help')
      return new Set(all.filter((c) => c.side === 'party' && c.id !== me.id).map((c) => c.id));
    if (mode.kind === 'item')
      return new Set(
        all
          .filter(
            (c) =>
              c.side === 'party' &&
              (c.id === me.id ||
                (Math.abs(c.pos.x - me.pos.x) <= 1 && Math.abs(c.pos.y - me.pos.y) <= 1)),
          )
          .map((c) => c.id),
      );
    if (mode.kind === 'feature')
      return new Set(
        all
          .filter((c) => (mode.target === 'ally' ? c.side === 'party' : c.side === 'enemy'))
          .map((c) => c.id),
      );
    if (mode.kind === 'spell') {
      const sp = spells.find((x) => x.spell.id === mode.spellId)?.spell;
      if (!sp) return new Set<string>();
      const t = targeting(sp, mode.level, mode.mm);
      if (t.kind !== 'creatures') return new Set<string>();
      return new Set(
        all
          .filter(
            (c) =>
              !castProblem({ s, rng: new SeededRng(1) }, me, {
                spellId: sp.id,
                slotLevel: mode.level,
                targetIds: [c.id],
                metamagic: mode.mm,
              }),
          )
          .map((c) => c.id),
      );
    }
    return new Set<string>();
  }, [s, me, myTurn, mode, options, spells]);

  const areaPreview = useMemo(() => {
    if (mode.kind !== 'spell' || !hover) return new Set<string>();
    const sp = spells.find((x) => x.spell.id === mode.spellId)?.spell;
    if (!sp) return new Set<string>();
    if (targeting(sp, mode.level).kind === 'point') return new Set([posKey(hover)]);
    if (targeting(sp, mode.level).kind !== 'area') return new Set<string>();
    return new Set(areaCells({ s, rng: new SeededRng(1) }, me, sp, hover).map(posKey));
  }, [mode, hover, spells, s, me]);

  const clickToken = (c: Combatant) => {
    if (!myTurn) return;
    if (mode.kind === 'attack')
      doAct(
        mode.offhand
          ? { type: 'offhand', targetId: c.id, optionId: mode.optionId }
          : {
              type: 'attack',
              targetId: c.id,
              optionId: mode.optionId,
              smiteLevel: smite || undefined,
              stun: stun || undefined,
            },
      );
    else if (mode.kind === 'help') doAct({ type: 'help', allyId: c.id });
    else if (mode.kind === 'shove') doAct({ type: 'shove', targetId: c.id, mode: mode.mode });
    else if (mode.kind === 'grapple') doAct({ type: 'grapple', targetId: c.id });
    else if (mode.kind === 'feature') doAct({ type: 'feature', id: mode.id, targetId: c.id });
    else if (mode.kind === 'item') doAct({ type: 'use-item', itemId: mode.itemId, targetId: c.id });
    else if (mode.kind === 'spell') {
      const sp = spells.find((x) => x.spell.id === mode.spellId)!.spell;
      const t = targeting(sp, mode.level, mode.mm);
      if (t.kind === 'area') return clickCell(c.pos);
      if (t.kind !== 'creatures') return;
      if (!t.repeat && mode.targets.includes(c.id))
        return setMode({ ...mode, targets: mode.targets.filter((x) => x !== c.id) });
      const targets = [...mode.targets, c.id];
      if (targets.length >= t.count)
        doAct({
          type: 'cast',
          spellId: sp.id,
          slotLevel: mode.level,
          targetIds: targets,
          metamagic: mode.mm,
        });
      else setMode({ ...mode, targets });
    }
  };

  const clickCell = (p: Pos) => {
    if (!myTurn) return;
    if (mode.kind === 'spell') {
      doAct({
        type: 'cast',
        spellId: mode.spellId,
        slotLevel: mode.level,
        point: p,
        metamagic: mode.mm,
      });
      return;
    }
    if (mode.kind === 'idle' && routes.has(posKey(p))) doAct({ type: 'move', to: p });
  };

  const pickSpell = (spellId: string, level: number) => {
    setMenu(null);
    const sp = spells.find((x) => x.spell.id === spellId)!.spell;
    const meta = mm || undefined;
    const t = targeting(sp, level, meta);
    if (t.kind === 'self' || (t.kind === 'area' && sp.area!.shape === 'aura'))
      doAct({ type: 'cast', spellId, slotLevel: level, metamagic: meta });
    else setMode({ kind: 'spell', spellId, level, targets: [], mm: meta });
    setMm('');
  };

  const pickFeature = (id: FeatureId) => {
    setMenu(null);
    const f = features.find((x) => x.id === id)!;
    if (f.target) setMode({ kind: 'feature', id, target: f.target });
    else doAct({ type: 'feature', id });
  };

  const encounterText = useMemo(() => {
    const foes = Object.values(s.combatants).filter((c) => c.side === 'enemy');
    return `${foes.length} enemies · ${difficulties.levels.find((d) => d.id === s.difficulty)!.name}`;
  }, [s]);

  const log = [...s.log].reverse().filter((l) => settings.showRolls || !isDiceLine(l.text));
  const hero = isHero(me) ? me : null;
  const hp = me.wildShape ? me.wildShape.hp : me.creature.hp;
  const maxHp = me.wildShape ? me.wildShape.maxHp : me.creature.maxHp;
  const hoveredNow = hover
    ? Object.values(s.combatants).find(
        (c) => !c.gone && !c.creature.dead && c.pos.x === hover.x && c.pos.y === hover.y,
      )
    : undefined;
  // Clicking an enemy that isn't a target pins its details (playtest feedback).
  const pinnedFoe = inspect ? s.combatants[inspect] : undefined;
  const hovered =
    hoveredNow ??
    (pinnedFoe && !pinnedFoe.gone && !pinnedFoe.creature.dead ? pinnedFoe : undefined);
  const info =
    hovered && hovered.side === 'enemy' ? foeInfo(hovered, isHero(me) ? me : undefined) : null;
  const hoverOpt =
    mode.kind === 'attack' ? options.find((o) => o.id === mode.optionId) : options[0];
  const banner = targetBanner(mode, options, spells);
  const actionLeft = !me.turn.actionUsed || me.turn.extraActions > 0 || !!me.turn.hasteAction;
  const moreActions: { label: string; detail: string; onClick: () => void; blocked?: string }[] = [
    ...(s.parley
      ? [
          {
            label: 'Talk them down',
            detail: `${s.parley.skills.join(' or ')} check · uses your action · once each`,
            onClick: () => doAct({ type: 'parley' }),
            blocked: s.parleyTried.includes(me.id)
              ? 'already tried'
              : actionLeft
                ? undefined
                : 'no action left',
          },
        ]
      : []),
    ...potions.map(([id, n]) => ({
      label: `${getItem(id).name} (${n})`,
      detail: 'drink it, or give it to an adjacent ally · action',
      onClick: () => setMode({ kind: 'item', itemId: id }),
      blocked:
        actionLeft ||
        (hero &&
          hero.creature.classId === 'rogue' &&
          hero.creature.level >= 3 &&
          !me.turn.bonusUsed)
          ? undefined
          : 'no action left',
    })),
    {
      label: 'Help',
      detail: 'an ally gets advantage on their next attack',
      onClick: () => setMode({ kind: 'help' }),
    },
    {
      label: 'Hide',
      detail: 'Stealth vs passive Perception',
      onClick: () => doAct({ type: 'hide' }),
      blocked: hideProblem(s, me) ?? undefined,
    },
    {
      label: 'Shove: knock prone',
      detail: 'Athletics contest (uses an attack)',
      onClick: () => setMode({ kind: 'shove', mode: 'prone' }),
    },
    {
      label: 'Shove: push 5 ft',
      detail: 'Athletics contest (uses an attack)',
      onClick: () => setMode({ kind: 'shove', mode: 'push' }),
    },
    {
      label: 'Grapple',
      detail: 'Athletics contest (uses an attack)',
      onClick: () => setMode({ kind: 'grapple' }),
    },
    {
      label: 'Stand up',
      detail: 'costs half your speed',
      onClick: () => doAct({ type: 'stand' }),
      blocked: hasCondition(me.creature, 'prone') ? undefined : 'not prone',
    },
    ...offhandWeapons(me).map((id) => ({
      label: `Off-hand: ${options.find((o) => o.id === id)?.name}`,
      detail: 'bonus action',
      onClick: () => setMode({ kind: 'attack', optionId: id, offhand: true }),
      blocked: me.turn.bonusUsed
        ? 'bonus action used'
        : me.turn.lightWeaponUsed
          ? undefined
          : 'attack with a light weapon first',
    })),
  ];

  return (
    <div className="combat">
      <header className="combat-header">
        <div className="row baseline">
          <h1>{s.name}</h1>
          <span className="muted">
            Round {s.round} · {encounterText}
          </span>
        </div>
        <div role="radiogroup" aria-label="Difficulty" className="seg">
          {difficulties.levels.map((d) => (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={s.difficulty === d.id}
              className={s.difficulty === d.id ? 'on' : ''}
              onClick={() => {
                settings.setDifficulty(d.id);
                setCombatDifficulty(d.id);
              }}
            >
              {d.name}
            </button>
          ))}
        </div>
      </header>

      <div className="initiative" aria-label="Turn order">
        <span className="eyebrow muted-eyebrow">Initiative</span>
        {s.order.map((id) => {
          const c = s.combatants[id]!;
          const down = c.gone || c.creature.dead || c.creature.hp === 0;
          return (
            <div
              key={id}
              className={`chip ${id === me.id ? 'on' : ''} ${down ? 'down' : ''}`}
              aria-current={id === me.id ? 'true' : undefined}
            >
              <span className={`dot ${c.side}`} aria-hidden="true" />
              <span>{c.name}</span>
              <span className="faint">{c.initiative}</span>
            </div>
          );
        })}
      </div>

      <div className="combat-main">
        <div
          className="map"
          style={{ width: s.map.width * CELL, height: s.map.height * CELL }}
          onMouseLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${s.map.width * CELL} ${s.map.height * CELL}`}
            width={s.map.width * CELL}
            height={s.map.height * CELL}
            aria-hidden="true"
            className="map-svg"
          >
            {s.map.terrain.flatMap((row, y) =>
              row.map((t, x) => (
                <g key={`${x},${y}`}>
                  <rect
                    x={x * CELL}
                    y={y * CELL}
                    width={CELL}
                    height={CELL}
                    fill={terrainFill(s.map.style, t)}
                  />
                  {t === 'trees' && s.map.style === 'forest-road' && (
                    <circle cx={x * CELL + 24} cy={y * CELL + 24} r={22} fill="#2f4226" />
                  )}
                  {t === 'boulder' && (s.map.style === 'forest-road' || s.map.style === 'cave') && (
                    <path
                      d={`M${x * CELL + 8} ${y * CELL + 34} L${x * CELL + 16} ${y * CELL + 12} L${x * CELL + 36} ${y * CELL + 10} L${x * CELL + 42} ${y * CELL + 32} L${x * CELL + 24} ${y * CELL + 42} Z`}
                      fill="#6f6a62"
                      stroke="#3b3833"
                      strokeWidth="2"
                    />
                  )}
                  {t === 'boulder' && s.map.style !== 'forest-road' && s.map.style !== 'cave' && (
                    <rect
                      x={x * CELL + 6}
                      y={y * CELL + 6}
                      width={CELL - 12}
                      height={CELL - 12}
                      rx={s.map.style === 'mill' ? 18 : 3}
                      fill="none"
                      stroke="#00000055"
                      strokeWidth="3"
                    />
                  )}
                  {t === 'brush' && s.map.style === 'forest-road' && (
                    <path
                      d={`M${x * CELL + 10} ${y * CELL + 40} q6 -18 12 0 q6 -22 12 0 q6 -16 10 0`}
                      fill="none"
                      stroke="#5f8a45"
                      strokeWidth="3"
                    />
                  )}
                </g>
              )),
            )}
            <g stroke="#000" strokeOpacity="0.18">
              {Array.from({ length: s.map.width + 1 }, (_, i) => (
                <line key={`v${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={s.map.height * CELL} />
              ))}
              {Array.from({ length: s.map.height + 1 }, (_, i) => (
                <line key={`h${i}`} x1={0} y1={i * CELL} x2={s.map.width * CELL} y2={i * CELL} />
              ))}
            </g>
            {s.zones.map((z) =>
              zoneCells(s, z).map((p) => (
                <rect
                  key={`${z.id}-${p.x},${p.y}`}
                  x={p.x * CELL}
                  y={p.y * CELL}
                  width={CELL}
                  height={CELL}
                  fill={ZONE_FILL[z.kind]}
                  opacity={z.kind === 'darkness' ? 0.75 : 0.3}
                >
                  <title>{z.name}</title>
                </rect>
              )),
            )}
          </svg>
          {s.map.terrain.flatMap((row, y) =>
            row.map((_, x) => {
              const k = `${x},${y}`;
              const route = routes.get(k);
              const inArea = areaPreview.has(k);
              const aiming = mode.kind === 'spell';
              const cls = `cell ${route ? 'reach' : ''} ${inArea ? 'area' : ''}`;
              const style = { left: x * CELL, top: y * CELL };
              if (route || aiming) {
                return (
                  <button
                    key={k}
                    type="button"
                    className={cls}
                    style={style}
                    aria-label={
                      route
                        ? `Move to column ${x + 1}, row ${y + 1} (${route.cost} ft)`
                        : `Aim at column ${x + 1}, row ${y + 1}`
                    }
                    onMouseEnter={() => setHover({ x, y })}
                    onFocus={() => setHover({ x, y })}
                    onClick={() => clickCell({ x, y })}
                  />
                );
              }
              return (
                <div
                  key={k}
                  className={cls}
                  style={style}
                  onMouseEnter={() => setHover({ x, y })}
                />
              );
            }),
          )}
          {Object.values(s.combatants)
            .filter((c) => !c.gone)
            .map((c) => {
              const dead = c.creature.dead || (c.side === 'enemy' && c.creature.hp === 0);
              const down = c.creature.hp === 0 && !c.creature.dead;
              const target = validTargets.has(c.id);
              const chosen = mode.kind === 'spell' && mode.targets.filter((x) => x === c.id).length;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`token ${c.side} ${c.id === me.id ? 'active' : ''} ${target ? 'target' : ''} ${dead ? 'dead' : ''} ${down && !dead ? 'downed' : ''}`}
                  style={{ left: c.pos.x * CELL + 4, top: c.pos.y * CELL + 4 }}
                  aria-label={`${c.name}, ${c.side === 'party' ? 'ally' : 'enemy'}, ${dead ? 'dead' : down ? 'down' : `HP ${c.wildShape?.hp ?? c.creature.hp} of ${c.wildShape?.maxHp ?? c.creature.maxHp}`}${target ? ', valid target' : ''}`}
                  aria-disabled={!target && !(mode.kind === 'spell' && validTargets.size === 0)}
                  onMouseEnter={() => setHover(c.pos)}
                  onFocus={() => setHover(c.pos)}
                  onClick={() =>
                    target || (mode.kind === 'spell' && validTargets.size === 0)
                      ? clickToken(c)
                      : setInspect(inspect === c.id ? null : c.id)
                  }
                >
                  {c.wildShape ? 'Wf' : c.short}
                  {chosen ? <span className="badge">{chosen}</span> : null}
                </button>
              );
            })}
          {hovered && (
            <div
              className={`tooltip ${hovered.side}`}
              style={{
                left: Math.min(hovered.pos.x * CELL + 50, s.map.width * CELL - 270),
                top: Math.max(4, hovered.pos.y * CELL - 70),
              }}
              role="status"
            >
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
                  {[...new Set(hovered.creature.conditions.map((x) => x.id))].join(', ')}
                </span>
              )}
              {hovered.effects.length > 0 && (
                <span className="muted">{hovered.effects.map((e) => e.name).join(', ')}</span>
              )}
              <span className="muted">
                {terrainName(s.map.style, terrainAt(s.map, hovered.pos))}
              </span>
            </div>
          )}
          {banner && myTurn && (
            <div className="banner" role="status">
              {banner}{' '}
              <button type="button" className="link" onClick={() => setMode({ kind: 'idle' })}>
                Cancel (Esc)
              </button>
              {mode.kind === 'spell' && mode.targets.length > 0 && (
                <button
                  type="button"
                  className="link"
                  onClick={() =>
                    doAct({
                      type: 'cast',
                      spellId: mode.spellId,
                      slotLevel: mode.level,
                      targetIds: mode.targets,
                      metamagic: mode.mm,
                    })
                  }
                >
                  Cast now
                </button>
              )}
            </div>
          )}
        </div>

        <aside className="combat-aside">
          <div className={`active-card ${me.side}`}>
            {hero ? (
              <div className="active-portrait">
                <Portrait
                  {...hero.creature.portrait}
                  ears={ELF_EARS.has(hero.creature.speciesId) ? 'elf' : 'human'}
                  cloth={CLASS_COPY[hero.creature.classId]!.cloth}
                  label={`Portrait of ${me.name}`}
                />
              </div>
            ) : (
              <div className="active-portrait enemy-face" aria-hidden="true">
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
                    <span className="party-hp-name">{c.name.split(' ')[0]}</span>
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
              Dice: {settings.showRolls ? 'automatic, all shown' : 'automatic'}
            </span>
          </div>
          <div className="log" role="log" aria-live="polite">
            {log.map((l, i) => (
              <div key={s.log.length - i} className={`log-${l.kind}`}>
                {settings.showRolls ? l.text : briefLine(l.text)}
              </div>
            ))}
          </div>
        </aside>
      </div>

      <footer className="combat-footer">
        <div className="economy">
          <div className="row small">
            <span className="pip-row">
              <span className={`pip action ${actionLeft ? '' : 'used'}`} />
              Action
              {me.turn.extraActions > 0 ? ` +${me.turn.extraActions} extra` : ''}
              {me.turn.hasteAction ? ' +1 (Haste)' : ''}
            </span>
            <span className="pip-row">
              <span className={`pip bonus ${me.turn.bonusUsed ? 'used' : ''}`} />
              Bonus
            </span>
            <span className="pip-row">
              <span className={`pip reaction ${me.reactionUsed ? 'used' : ''}`} />
              Reaction
            </span>
          </div>
          <div className="row between small">
            <span>Movement</span>
            <span className="muted">
              {me.turn.movement} / {me.speed} ft
            </span>
          </div>
          <div className="move-bar">
            <div
              style={{
                width: `${Math.min(100, Math.round((me.turn.movement / Math.max(1, me.speed)) * 100))}%`,
              }}
            />
          </div>
        </div>
        <div className="actions">
          {options
            .filter((o) => !o.unarmed || me.wildShape)
            .slice(0, 2)
            .map((o, i) => (
              <button
                key={o.id}
                type="button"
                className={i === 0 ? 'act primary-act' : 'act'}
                disabled={!myTurn || (!actionLeft && me.turn.attacksLeft === 0)}
                onClick={() => setMode({ kind: 'attack', optionId: o.id })}
              >
                <span className="act-name">Attack · {o.name}</span>
                <span className="act-detail">
                  {o.toHit >= 0 ? '+' : ''}
                  {o.toHit} to hit · {o.damage.map((d) => d.dice).join(' + ')}
                </span>
              </button>
            ))}
          {hero && hero.creature.classId === 'monk' && hero.creature.level >= 5 && (
            <label className="act smite">
              <span className="act-name">Stunning Strike</span>
              <span className="row small">
                <input
                  type="checkbox"
                  checked={stun}
                  onChange={(e) => setStun(e.target.checked)}
                  aria-label="Stunning Strike on the next melee hit (1 ki)"
                />{' '}
                1 ki on a hit
              </span>
            </label>
          )}
          {hero && hero.creature.classId === 'paladin' && hero.creature.level >= 2 && (
            <label className="act smite">
              <span className="act-name">Divine Smite</span>
              <select
                value={smite}
                onChange={(e) => setSmite(Number(e.target.value))}
                aria-label="Divine Smite slot"
              >
                <option value={0}>off</option>
                {slotsLeft(hero.creature).map((n, i) =>
                  n > 0 ? <option key={i} value={i + 1}>{`level ${i + 1}`}</option> : null,
                )}
              </select>
            </label>
          )}
          {spells.length > 0 && (
            <button
              type="button"
              className="act"
              aria-expanded={menu === 'spells'}
              disabled={!myTurn}
              onClick={() => setMenu(menu === 'spells' ? null : 'spells')}
            >
              <span className="act-name">Spells ▴</span>
              <span className="act-detail">{spells.filter((x) => !x.blocked).length} ready</span>
            </button>
          )}
          {features.length > 0 && (
            <button
              type="button"
              className="act"
              aria-expanded={menu === 'features'}
              disabled={!myTurn}
              onClick={() => setMenu(menu === 'features' ? null : 'features')}
            >
              <span className="act-name">Features ▴</span>
              <span className="act-detail">{features.filter((f) => !f.blocked).length} ready</span>
            </button>
          )}
          {(['dash', 'dodge', 'disengage'] as const).map((a) => (
            <button
              key={a}
              type="button"
              className="act plain"
              disabled={!myTurn || !actionLeft}
              onClick={() => doAct({ type: a })}
            >
              {a[0]!.toUpperCase() + a.slice(1)}
            </button>
          ))}
          {/* PHB: Rogue, Cunning Action: Dash, Disengage or Hide as a bonus action. */}
          {features
            .filter((f) => f.id.startsWith('cunning-'))
            .map((f) => (
              <button
                key={f.id}
                type="button"
                className="act plain"
                disabled={!myTurn || !!f.blocked}
                title={f.blocked ?? 'Cunning Action (bonus action)'}
                onClick={() => doAct({ type: 'feature', id: f.id })}
              >
                {f.name.replace('Cunning Action: ', '')} (bonus)
              </button>
            ))}
          <button
            type="button"
            className="act plain"
            aria-expanded={menu === 'more'}
            disabled={!myTurn}
            onClick={() => setMenu(menu === 'more' ? null : 'more')}
          >
            More ▴
          </button>
          {menu && myTurn && (
            <div
              className="menu"
              role="menu"
              aria-label={
                menu === 'spells'
                  ? 'Spells'
                  : menu === 'features'
                    ? 'Class features'
                    : 'More actions'
              }
            >
              {menu === 'spells' && knownMetamagic.length > 0 && (
                <div className="menu-row">
                  <label className="small">
                    Metamagic{' '}
                    <select
                      value={mm}
                      onChange={(e) => setMm(e.target.value as Metamagic | '')}
                      aria-label="Metamagic"
                    >
                      <option value="">none</option>
                      {knownMetamagic.map((m) => (
                        <option key={m} value={m}>
                          {METAMAGIC_NAMES[m]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {menu === 'spells' &&
                spells.map((c) => (
                  <div key={c.spell.id} className="menu-row">
                    <span>
                      <span className="strong">{c.spell.name}</span>{' '}
                      <span className="muted small">
                        {c.spell.level === 0 ? 'cantrip' : `level ${c.spell.level}`} ·{' '}
                        {c.spell.castingTime}
                        {c.spell.concentration ? ' · concentration' : ''}
                      </span>
                      <br />
                      <span className="small muted">{c.blocked ?? c.spell.summary}</span>
                    </span>
                    <span className="row">
                      {c.levels.map((lv) => (
                        <button
                          key={lv}
                          type="button"
                          role="menuitem"
                          className="mini"
                          disabled={!!c.blocked}
                          onClick={() => pickSpell(c.spell.id, lv)}
                        >
                          {lv === 0 ? 'Cast' : `Lv ${lv}`}
                        </button>
                      ))}
                    </span>
                  </div>
                ))}
              {menu === 'features' &&
                features.map((f) => (
                  <div key={f.id} className="menu-row">
                    <span>
                      <span className="strong">{f.name}</span>{' '}
                      <span className="muted small">{f.cost}</span>
                      <br />
                      <span className="small muted">{f.blocked ?? f.detail}</span>
                    </span>
                    <button
                      type="button"
                      role="menuitem"
                      className="mini"
                      disabled={!!f.blocked}
                      onClick={() => pickFeature(f.id)}
                    >
                      Use
                    </button>
                  </div>
                ))}
              {menu === 'more' &&
                moreActions.map((m) => (
                  <div key={m.label} className="menu-row">
                    <span>
                      <span className="strong">{m.label}</span>
                      <br />
                      <span className="small muted">{m.blocked ?? m.detail}</span>
                    </span>
                    <button
                      type="button"
                      role="menuitem"
                      className="mini"
                      disabled={!!m.blocked}
                      onClick={() => {
                        setMenu(null);
                        m.onClick();
                      }}
                    >
                      Do it
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
        <div className="end-col">
          <button
            type="button"
            className="end-turn"
            disabled={!myTurn}
            onClick={() => doAct({ type: 'end-turn' })}
          >
            End turn
          </button>
          <span className="error small" role="alert">
            {message}
          </span>
        </div>
      </footer>

      {s.prompt && (
        <PromptDialog state={s} onAnswer={(yes) => doAct({ type: 'react', accept: yes })} />
      )}

      {s.outcome && (
        <div className="dialog-backdrop">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="outcome-title"
            className="dialog outcome"
          >
            <h2 id="outcome-title">
              {s.outcome === 'victory'
                ? 'Victory!'
                : s.outcome === 'parley'
                  ? 'The fight is over'
                  : s.defeatContinues
                    ? 'Beaten'
                    : 'Defeat'}
            </h2>
            {s.outcome !== 'defeat' || s.defeatContinues ? (
              <>
                <p>
                  {s.outcome === 'defeat'
                    ? 'Your party is knocked flat, but the story goes on.'
                    : `${s.outcome === 'parley' ? 'Words won where swords would have.' : 'The enemy is beaten.'} Each surviving hero earns ${s.xpPerPc} XP.`}
                </p>
                <button type="button" className="primary" autoFocus onClick={endFight}>
                  Continue
                </button>
              </>
            ) : (
              <>
                <p>Your party has fallen.</p>
                <button
                  type="button"
                  className="primary"
                  autoFocus
                  onClick={() => {
                    const auto = readSlot('autosave').save;
                    if (auto) loadGame(auto);
                    else goto('title');
                  }}
                >
                  Load the autosave from before the fight
                </button>
                <button
                  type="button"
                  className="menu-secondary small-btn"
                  onClick={() => goto('title')}
                >
                  Title screen
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PromptDialog({
  state,
  onAnswer,
}: {
  state: CombatState;
  onAnswer: (yes: boolean) => void;
}) {
  const p = state.prompt!;
  const name = (id: string) => state.combatants[id]!.name;
  const text =
    p.kind === 'opportunity-attack'
      ? `${name(p.targetId)} is leaving ${name(p.reactorId)}'s reach. Make an opportunity attack?`
      : p.kind === 'shield'
        ? `${name(p.attackerId)} hits ${name(p.reactorId)} with a ${p.total}. Cast Shield (+5 AC, uses a spell slot) to turn it into a miss?`
        : p.kind === 'protection'
          ? `${name(p.attackerId)} attacks ${name(p.targetId)}. Should ${name(p.reactorId)} use Protection (disadvantage on the attack)?`
          : p.kind === 'cutting-words'
            ? `${name(p.attackerId)} hits ${name(p.targetId)} with a ${p.total}. Should ${name(p.reactorId)} use Cutting Words (a Bardic Inspiration die off the roll)?`
            : p.kind === 'counterspell'
              ? `${name(p.casterId)} starts casting ${getSpell(p.spellId).name}. Should ${name(p.reactorId)} cast Counterspell (a 3rd-level slot) to stop it?`
              : `${name(p.attackerId)} just hurt ${name(p.reactorId)}. Answer with Hellish Rebuke (uses a spell slot)?`;
  return (
    <div className="dialog-backdrop">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="prompt-title"
        aria-describedby="prompt-text"
        className="dialog"
      >
        <h2 id="prompt-title">Reaction</h2>
        <p id="prompt-text">{text}</p>
        <div className="row">
          <button type="button" className="primary" autoFocus onClick={() => onAnswer(true)}>
            Yes
          </button>
          <button
            type="button"
            className="menu-secondary small-btn"
            onClick={() => onAnswer(false)}
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}

function targetBanner(
  mode: Mode,
  options: { id: string; name: string }[],
  spells: { spell: { id: string; name: string } }[],
): string | null {
  switch (mode.kind) {
    case 'idle':
      return null;
    case 'attack':
      return `Choose a target for ${options.find((o) => o.id === mode.optionId)?.name ?? 'the attack'}.`;
    case 'spell':
      return `${spells.find((x) => x.spell.id === mode.spellId)?.spell.name}: choose ${mode.targets.length ? 'more targets or cast now' : 'a target or a square'}.`;
    case 'feature':
      return `Choose ${mode.target === 'ally' ? 'an ally' : 'an enemy'}.`;
    case 'help':
      return 'Choose an ally to help.';
    case 'shove':
      return 'Choose an enemy next to you to shove.';
    case 'grapple':
      return 'Choose an enemy next to you to grapple.';
    case 'item':
      return 'Choose who drinks it: yourself or an ally next to you.';
  }
}
