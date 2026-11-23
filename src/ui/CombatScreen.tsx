import { hasSubclass, resourceLeft as heroResourceLeft } from '../game/hero';
import { heroOf } from '../game/combat/core';
import { useEffect, useMemo, useState } from 'react';
import { difficulties } from '../data';
import {
  areaCells,
  attackOptions,
  featureList,
  posKey,
  reachable,
  spellChoices,
  targeting,
  type Combatant,
  type FeatureId,
  type Metamagic,
  METAMAGIC_NAMES,
  type PlayerAction,
  type Pos,
} from '../game/combat';
import { slotsLeft } from '../game/hero';
import { readSlot } from '../game/save';
import { useSettings } from '../game/settings';
import { useGame } from '../game/store';
import { hasCondition, SeededRng } from '../rules';
import './Combat.css';
import { isDiceLine, tokenDrawOrder } from './combatUi';
import { foeInfo } from './foeInfo';
import { useFxPlayer } from './combat/fxPlayer';
import { FxLayer } from './combat/FxLayer';
import { statusWords, TokenStatus } from './combat/TokenStatus';
import { prefersReducedMotion } from '../game/settings';
import { setLabel } from '../game/loadout';
import { getItem } from '../game/items';
import { getGear, isMagicItem } from '../game/gear';
import { CELL, MapTerrain } from './combat/MapTerrain';
import { CombatHeader, TurnOrder } from './combat/CombatHeader';
import { CombatAside } from './combat/CombatAside';
import { ActionMenu, TurnEconomy, type MenuKind } from './combat/ActionBar';
import { OutcomeDialog, PromptDialog } from './combat/CombatDialogs';
import { isHero, moreActionsFor, targetBanner, validTargetsFor, type Mode } from './combat/modes';

/**
 * Grid combat, rebuilt from docs/mockups/Combat.dc.html. The pieces live in ui/combat/:
 * the map terrain, header, side panel, action menu, dialogs, and the aiming logic (modes.ts).
 */
export function CombatScreen() {
  const { combat, combatAct, combatAdvance, setCombatDifficulty, endFight, loadGame, goto } =
    useGame();
  const settings = useSettings();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [menu, setMenu] = useState<MenuKind | null>(null);
  const [hover, setHover] = useState<Pos | null>(null);
  const [message, setMessage] = useState('');
  const [smite, setSmite] = useState(0);
  const [mm, setMm] = useState<Metamagic | ''>('');
  const [stun, setStun] = useState(false);
  const [maneuver, setManeuver] = useState<'' | 'trip' | 'push'>('');
  const [inspect, setInspect] = useState<string | null>(null);
  const s = combat!;
  const reduceMotion = settings.reduceMotion || prefersReducedMotion();
  const fx = useFxPlayer(s, { speed: settings.animSpeed, reduceMotion });
  const { busyMs } = fx;
  const hitNow = new Set(
    fx.playing.flatMap((p) => (p.ev.type === 'damage' && p.ev.amount > 0 ? [p.ev.targetId] : [])),
  );
  const me = s.combatants[s.order[s.turnIndex]!]!;
  const myTurn = me.side === 'party' && !s.outcome && !s.prompt;
  const myLevel = heroOf(me)?.level ?? 1;

  // Enemy turns play out one at a time so the log can be followed.
  useEffect(() => {
    if (s.outcome || s.prompt || me.side !== 'enemy') return;
    // M11: the next enemy step waits for the last one's animation to finish.
    const t = setTimeout(combatAdvance, 450 + busyMs());
    return () => clearTimeout(t);
  }, [s, me.side, combatAdvance, busyMs]);

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
      // Movement squares show while aiming too: clicking one cancels the aim and moves (playtest).
      myTurn && mode.kind !== 'spell' && !hasCondition(me.creature, 'prone')
        ? reachable(s, me, me.turn.movement)
        : new Map(),
    [s, me, myTurn, mode.kind],
  );
  const options = useMemo(() => (myTurn ? attackOptions(me) : []), [me, myTurn]);
  const spells = useMemo(() => (myTurn ? spellChoices(me, mm || undefined) : []), [me, myTurn, mm]);
  const knownMetamagic = (isHero(me) ? (me.creature.choices['metamagic'] ?? []) : []).filter(
    (x): x is Metamagic => x in METAMAGIC_NAMES,
  );
  const potions = Object.entries(s.inventory).filter(
    ([id, n]) => n > 0 && isMagicItem(id) && getItem(id).consumable,
  );
  // Adventuring gear for a fight: thrown flasks and the healer's kit.
  const fightGear = Object.entries(s.inventory)
    .filter(([id, n]) => n > 0 && !!getGear(id)?.use)
    .map(([id, n]) => ({ g: getGear(id)!, n }));
  const features = myTurn ? featureList(me, s) : [];

  // Which tokens can be clicked in the current mode.
  const validTargets = useMemo(
    () => validTargetsFor(s, me, myTurn, mode, options, spells, myLevel),
    [s, me, myTurn, mode, options, spells, myLevel],
  );

  const areaPreview = useMemo(() => {
    if (mode.kind !== 'spell' || !hover) return new Set<string>();
    const sp = spells.find((x) => x.spell.id === mode.spellId)?.spell;
    if (!sp) return new Set<string>();
    if (targeting(sp, mode.level, undefined, myLevel).kind === 'point')
      return new Set([posKey(hover)]);
    if (targeting(sp, mode.level, undefined, myLevel).kind !== 'area') return new Set<string>();
    return new Set(areaCells({ s, rng: new SeededRng(1) }, me, sp, hover).map(posKey));
  }, [mode, hover, spells, s, me, myLevel]);

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
              maneuver: maneuver || undefined,
            },
      );
    else if (mode.kind === 'help') doAct({ type: 'help', allyId: c.id });
    else if (mode.kind === 'shove') doAct({ type: 'shove', targetId: c.id, mode: mode.mode });
    else if (mode.kind === 'grapple') doAct({ type: 'grapple', targetId: c.id });
    else if (mode.kind === 'feature') doAct({ type: 'feature', id: mode.id, targetId: c.id });
    else if (mode.kind === 'item') doAct({ type: 'use-item', itemId: mode.itemId, targetId: c.id });
    else if (mode.kind === 'spell') {
      const sp = spells.find((x) => x.spell.id === mode.spellId)!.spell;
      const t = targeting(sp, mode.level, mode.mm, myLevel);
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
    if (routes.has(posKey(p))) {
      if (mode.kind !== 'idle') setMode({ kind: 'idle' });
      doAct({ type: 'move', to: p });
    }
  };

  const pickSpell = (spellId: string, level: number) => {
    setMenu(null);
    const sp = spells.find((x) => x.spell.id === spellId)!.spell;
    const meta = mm || undefined;
    const t = targeting(sp, level, meta, myLevel);
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
  const moreActions = moreActionsFor({
    s,
    me,
    hero,
    actionLeft,
    potions,
    fightGear,
    options,
    doAct,
    setMode,
  });

  return (
    <div className="combat">
      <CombatHeader
        s={s}
        encounterText={encounterText}
        onDifficulty={(d) => {
          settings.setDifficulty(d);
          setCombatDifficulty(d);
        }}
      />

      <TurnOrder s={s} meId={me.id} />

      <div className="combat-main">
        <div
          className="map"
          style={{ width: s.map.width * CELL, height: s.map.height * CELL }}
          onMouseLeave={() => setHover(null)}
          onContextMenu={(e) => {
            // Right-click cancels whatever is being aimed.
            if (mode.kind !== 'idle') {
              e.preventDefault();
              setMode({ kind: 'idle' });
            }
          }}
        >
          <MapTerrain s={s} />
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
          {tokenDrawOrder(Object.values(s.combatants).filter((c) => !c.gone)).map((c) => {
            const dead = c.creature.dead || (c.side === 'enemy' && c.creature.hp === 0);
            const down = c.creature.hp === 0 && !c.creature.dead;
            const target = validTargets.has(c.id);
            const chosen = mode.kind === 'spell' && mode.targets.filter((x) => x === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                className={`token ${c.side} ${c.id === me.id ? 'active' : ''} ${target ? 'target' : ''} ${dead ? 'dead' : ''} ${down && !dead ? 'downed' : ''} ${hitNow.has(c.id) ? `hit${settings.reduceFlashing ? ' calm' : ''}${settings.shake ? '' : ' still'}` : ''} ${hasCondition(c.creature, 'prone') ? 'prone' : ''} ${hasCondition(c.creature, 'invisible') ? 'invisible' : ''}`}
                style={{ left: c.pos.x * CELL + 4, top: c.pos.y * CELL + 4 }}
                aria-label={`${c.name}, ${c.side === 'party' ? 'ally' : 'enemy'}, ${dead ? 'dead' : down ? 'down' : `HP ${c.wildShape?.hp ?? c.creature.hp} of ${c.wildShape?.maxHp ?? c.creature.maxHp}`}${statusWords(c)}${target ? ', valid target' : ''}`}
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
                <TokenStatus c={c} />
              </button>
            );
          })}
          <FxLayer s={s} playing={fx.playing} reduceFlashing={settings.reduceFlashing} />
          {banner && myTurn && (
            <div className="banner" role="status">
              {banner}{' '}
              {mode.kind !== 'spell' && (
                <span className="muted small">Or click a blue square to move instead. </span>
              )}
              <button type="button" className="link" onClick={() => setMode({ kind: 'idle' })}>
                Cancel (Esc or right-click)
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

        <CombatAside
          s={s}
          me={me}
          hero={hero}
          hp={hp}
          maxHp={maxHp}
          hovered={hovered}
          info={info}
          hoverOpt={hoverOpt}
          myTurn={myTurn}
          showRolls={settings.showRolls}
          log={log}
        />
      </div>

      <footer className="combat-footer">
        <TurnEconomy me={me} actionLeft={actionLeft} />
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
                aria-pressed={mode.kind === 'attack' && mode.optionId === o.id}
                onClick={() =>
                  // Clicking the same attack again puts it away.
                  setMode(
                    mode.kind === 'attack' && mode.optionId === o.id
                      ? { kind: 'idle' }
                      : { kind: 'attack', optionId: o.id },
                  )
                }
              >
                <span className="act-name">Attack · {o.name}</span>
                <span className="act-detail">
                  {o.toHit >= 0 ? '+' : ''}
                  {o.toHit} to hit · {o.damage.map((d) => d.dice).join(' + ')}
                </span>
              </button>
            ))}
          {hero && hero.creature.equipment.loadout && (
            <button
              type="button"
              className="act"
              disabled={!myTurn || !!me.turn.swappedWeapons}
              title="Free, once a turn"
              onClick={() => doAct({ type: 'swap-weapons' })}
            >
              <span className="act-name">Switch weapons</span>
              <span className="act-detail">
                to{' '}
                {setLabel(
                  hero.creature.equipment.loadout,
                  hero.creature.equipment.loadout.active === 1 ? 2 : 1,
                )}{' '}
                · free
              </span>
            </button>
          )}
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
          {hero && hasSubclass(hero.creature, 'fighter', 'battle-master', 3) && (
            <label className="act smite">
              <span className="act-name">Maneuver</span>
              <select
                value={maneuver}
                onChange={(e) => setManeuver(e.target.value as '' | 'trip' | 'push')}
                aria-label="Maneuver on the next hit"
              >
                <option value="">off</option>
                <option value="trip">Trip (prone)</option>
                <option value="push">Push 15 ft</option>
              </select>
              <span className="act-detail">
                {heroResourceLeft(hero.creature, 'superiority-dice')} superiority dice
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
            <ActionMenu
              menu={menu}
              setMenu={setMenu}
              knownMetamagic={knownMetamagic}
              mm={mm}
              setMm={setMm}
              spells={spells}
              hero={hero}
              pickSpell={pickSpell}
              features={features}
              pickFeature={pickFeature}
              moreActions={moreActions}
            />
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
        <OutcomeDialog
          s={s}
          onContinue={endFight}
          onLoadAutosave={() => {
            const auto = readSlot('autosave').save;
            if (auto) loadGame(auto);
            else goto('title');
          }}
          onTitle={() => goto('title')}
        />
      )}
    </div>
  );
}
