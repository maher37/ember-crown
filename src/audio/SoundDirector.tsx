import { useEffect, useRef } from 'react';
import { useGame } from '../game/store';
import { useSettings } from '../game/settings';
import { ambienceFor, cuesForLog, cuesForMessages, intenseFor, moodFor } from './cues';
import { sound } from './engine';

/**
 * Listens to the game and plays the right music, place sound and effects. Renders nothing.
 * Sound starts on the first click or key press (browsers don't allow it before that).
 */
export function SoundDirector() {
  const screen = useGame((s) => s.screen);
  const location = useGame((s) => s.game?.location ?? null);
  const encounterId = useGame((s) => s.combat?.encounterId ?? s.encounterId);
  const campScene = useGame((s) => s.campScene);
  const difficulty = useGame((s) => s.combat?.difficulty ?? null);
  const settingsDifficulty = useSettings((s) => s.difficulty);
  const { music, ambience, effects, muted } = useSettings();

  useEffect(() => {
    const unlock = () => sound.unlock();
    const onKey = (e: KeyboardEvent) => {
      sound.unlock();
      const typing = (e.target as HTMLElement | null)?.closest('input, textarea, select');
      if (!typing && (e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey)
        useSettings.getState().toggleMute();
    };
    // A soft click for every button press.
    const onClick = (e: MouseEvent) => {
      const b = (e.target as HTMLElement | null)?.closest('button');
      if (b && !b.disabled && b.getAttribute('aria-disabled') !== 'true') sound.play('click');
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick, true);
    };
  }, []);

  useEffect(() => {
    sound.setVolumes({ music, ambience, effects, muted });
  }, [music, ambience, effects, muted]);

  useEffect(() => {
    const scene = {
      screen,
      location,
      encounterId,
      campScene,
      difficulty: difficulty ?? settingsDifficulty,
    };
    sound.setIntensity(intenseFor(scene));
    sound.setMood(moodFor(scene));
    sound.setAmbience(ambienceFor(scene));
  }, [screen, location, encounterId, campScene, difficulty, settingsDifficulty]);

  // Effects that follow what happens: the combat log, journal pop-ups, dice checks, level-ups, travel.
  const seen = useRef({
    log: 0,
    toasts: null as string[] | null,
    check: null as unknown,
    levels: -1,
    location: null as string | null,
    gameId: null as string | null,
  });
  useEffect(
    () =>
      useGame.subscribe((s) => {
        const r = seen.current;
        if ((s.game?.id ?? null) !== r.gameId) {
          // A different game was loaded: start counting afresh.
          r.gameId = s.game?.id ?? null;
          r.levels = -1;
          r.location = null;
        }
        const log = s.combat?.log ?? [];
        if (log.length < r.log) r.log = 0;
        if (log.length > r.log) {
          const fresh = r.log === 0 && log.length > 6 ? log.slice(-3) : log.slice(r.log);
          r.log = log.length;
          cuesForLog(fresh).forEach((c, i) => sound.play(c, i * 140));
        }
        if (!s.combat) r.log = 0;
        if (s.toasts !== r.toasts) {
          r.toasts = s.toasts;
          cuesForMessages(s.toasts).forEach((c, i) => sound.play(c, 150 + i * 250));
        }
        const check = s.conversation?.lastCheck ?? null;
        if (check && check !== r.check) {
          sound.play('dice');
          sound.play(check.success ? 'success' : 'fail', 380);
        }
        r.check = check;
        const levels = s.game ? s.game.party.reduce((n, h) => n + h.level, 0) : -1;
        if (r.levels >= 0 && levels > r.levels) sound.play('levelup');
        r.levels = levels;
        const loc = s.game?.location ?? null;
        if (r.location && loc && loc !== r.location && s.screen !== 'title') sound.play('steps');
        r.location = loc;
      }),
    [],
  );

  return null;
}
