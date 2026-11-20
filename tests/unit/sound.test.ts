// Sound: which music, place sound and effects play. (Presentation only: no rules here.)
import { describe, expect, it } from 'vitest';
import {
  ambienceFor,
  cuesForLog,
  cuesForMessages,
  moodFor,
  spellElement,
} from '../../src/audio/cues';
import { sound } from '../../src/audio/engine';
import { places } from '../../src/data';
import { defaultSettings, useSettings } from '../../src/game/settings';

const line = (kind: 'you' | 'foe' | 'dmg' | 'crit' | 'head' | 'info', text: string) => ({
  kind,
  text,
});

describe('music follows the moment', () => {
  it('tavern, travel, places, fights and bosses', () => {
    expect(moodFor({ screen: 'title' })).toBe('title');
    expect(moodFor({ screen: 'explore', location: 'drowned-lantern' })).toBe('tavern');
    expect(moodFor({ screen: 'map', location: 'mill' })).toBe('travel');
    expect(moodFor({ screen: 'dialogue', location: 'old-mine' })).toBe('dungeon');
    expect(moodFor({ screen: 'dialogue', location: 'abbey' })).toBe('marsh');
    expect(moodFor({ screen: 'combat', encounterId: 'f2-road-ambush' })).toBe('combat');
    expect(moodFor({ screen: 'combat', encounterId: 'f21-crowning-maelis' })).toBe('boss');
    expect(moodFor({ screen: 'prepare', encounterId: 'e1-scald' })).toBe('boss');
    expect(moodFor({ screen: 'camp' })).toBe('camp');
  });
  it('every place on the map has a sound of its own', () => {
    for (const p of places)
      expect(ambienceFor({ screen: 'dialogue', location: p.id }), p.id).not.toBe('none');
    expect(ambienceFor({ screen: 'camp', campScene: 'inn' })).toBe('fire');
    expect(ambienceFor({ screen: 'camp', campScene: 'wild' })).toBe('night');
    expect(ambienceFor({ screen: 'title' })).toBe('none');
  });
});

describe('effects follow the combat log', () => {
  it('melee and ranged hits, misses, crits, blocks, downs and deaths', () => {
    expect(
      cuesForLog([
        line('you', 'Mira attacks Goblin A with Longsword: d20 (14) + 5 = 19 vs AC 15 → HIT'),
        line('foe', 'Goblin B attacks Mira with Shortbow: d20 (3) + 4 = 7 vs AC 19 → MISS'),
      ]),
    ).toEqual(['hit', 'miss']);
    expect(
      cuesForLog([
        line('you', 'Thorn attacks Wolf A with Light crossbow: d20 (15) + 2 = 17 vs AC 13 → HIT'),
      ]),
    ).toEqual(['arrow']);
    expect(
      cuesForLog([
        line(
          'crit',
          'Mira attacks Goblin A with Longsword: d20 (20) + 5 = 25 vs AC 15 → HIT (CRITICAL HIT)',
        ),
      ]),
    ).toEqual(['crit']);
    expect(cuesForLog([line('you', 'Wren casts Shield (+5 AC)')])).toEqual(['block']);
    expect(cuesForLog([line('dmg', 'Ilse falls unconscious and is dying')])).toEqual(['down']);
    expect(cuesForLog([line('head', 'Goblin A dies (reduced to 0 HP)')])).toEqual(['death']);
    expect(cuesForLog([line('head', 'Victory!')])).toEqual(['victory']);
  });
  it('spells sound like their element, read from spells.json', () => {
    expect(spellElement('Fireball')).toBe('fire');
    expect(spellElement('Ray of Frost')).toBe('cold');
    expect(spellElement('Cure Wounds')).toBe('heal');
    expect(spellElement('Sacred Flame')).toBe('radiant');
    expect(spellElement('Not a spell')).toBe('arcane');
    expect(cuesForLog([line('foe', 'Brother Ulric casts Sacred Flame')])).toEqual([
      'spell-radiant',
    ]);
    expect(cuesForLog([line('you', 'Corin casts Fire Bolt at level 1 (Quickened Spell)')])).toEqual(
      ['spell-fire'],
    );
  });
  it('a busy turn plays at most four sounds, without repeats in a row', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      line(
        'you',
        `Mira attacks Goblin ${i} with Longsword: d20 (14) + 5 = 19 vs AC 15 → ${i % 2 ? 'HIT' : 'MISS'}`,
      ),
    );
    const cues = cuesForLog(many);
    expect(cues.length).toBe(4);
    expect(cuesForLog([many[1]!, many[3]!])).toEqual(['hit']);
  });
  it('journal pop-ups', () => {
    expect(
      cuesForMessages(['Quest complete: Lantern Night', 'Received: Potion of Healing ×4']),
    ).toEqual(['quest', 'item']);
    expect(cuesForMessages(['Journal updated: Speak with Brannoc'])).toEqual(['page']);
  });
});

describe('sound settings', () => {
  it('volumes default on, clamp to 0–1, and M mutes', () => {
    useSettings.getState().reset();
    expect(defaultSettings.muted).toBe(false);
    useSettings.getState().setVolume('music', 1.7);
    expect(useSettings.getState().music).toBe(1);
    useSettings.getState().toggleMute();
    expect(useSettings.getState().muted).toBe(true);
    useSettings.getState().reset();
  });
  it('without Web Audio (as in tests), the sound engine quietly does nothing', () => {
    expect(() => {
      sound.unlock();
      sound.setMood('combat');
      sound.play('hit');
    }).not.toThrow();
  });
});
