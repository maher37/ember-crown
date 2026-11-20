import { useEffect } from 'react';
import { npcById } from '../game/dialogue';
import { placeMapFor } from '../game/placeMaps';
import { useGame } from '../game/store';
import { CLASS_COPY, ELF_EARS } from './creatorCopy';
import './Explore.css';
import { Portrait } from './Portrait';
import { isPlaceSpeaker, PlaceArt, sceneFor } from './scenes/PlaceArt';
import { SoundButton } from '../audio/SoundButton';

/** A conversation (rebuilt from docs/mockups/Dialogue.dc.html). */
export function DialogueScreen() {
  const { conversation, choose, leaveDialogue, game, afterDialogue } = useGame();
  useGame((s) => s.dialogueTick); // re-render after each step
  const c = conversation!;
  const npc = npcById(c.speaker) ?? npcById('tavern')!;
  const leader = game!.party.find((h) => !h.dead)!;
  // A place speaking (the mine, the marsh…) gets the whole backdrop instead of a portrait.
  const isPlace = !npc.portrait || isPlaceSpeaker(npc.id);
  const choices = c.choices;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= choices.length) choose(choices[n - 1]!.index);
      if (c.ended && e.key === 'Enter') leaveDialogue();
      if (e.key === 'Escape') leaveDialogue();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choices, choose, c.ended, leaveDialogue]);

  return (
    <div className="dialogue">
      {!c.ended && (
        <button
          type="button"
          className="menu-secondary small-btn dialogue-back"
          onClick={leaveDialogue}
          title="Leave this conversation (you can come back to it)"
        >
          ← Leave
        </button>
      )}
      <div className="sound-corner bottom">
        <SoundButton />
      </div>
      <div className={`dialogue-art${isPlace ? ' place' : ''}`}>
        <PlaceArt scene={sceneFor(npc.id, game!.location)} />
      </div>
      <div className={`npc${isPlace ? ' place' : ''}`}>
        {!isPlace && (
          <div className="npc-portrait">
            <Portrait {...npc.portrait!} ears="human" label={`Portrait of ${npc.name}`} />
          </div>
        )}
        <div className="npc-name">
          <span className="name">{npc.name}</span>
          <span className="title">{npc.title}</span>
        </div>
      </div>
      <section aria-label="Conversation" className="conversation">
        {c.lastCheck && (
          <div className={`check-result ${c.lastCheck.success ? 'ok' : 'fail'}`} role="status">
            {c.lastCheck.text.replace('→ FAIL', '→ FAILURE')}
          </div>
        )}
        <div className="prose" aria-live="polite">
          {c.lines.map((l, i) => (
            <p key={i} className={l.text.startsWith('[') ? 'meta' : ''}>
              {l.text}
            </p>
          ))}
        </div>
        {c.messages.length > 0 && (
          <div className="journal-flash" role="status">
            {c.messages.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        )}
        {c.ended ? (
          <button type="button" className="choice leave" autoFocus onClick={leaveDialogue}>
            <span className="num">↵</span>
            <span>
              {c.fight
                ? 'To battle (prepare)'
                : c.travel === 'epilogue'
                  ? 'Afterwards…'
                  : c.travel?.startsWith('scene:')
                    ? 'Go on'
                    : c.travel
                      ? 'Set out'
                      : afterDialogue === 'place'
                        ? 'Go on'
                        : game!.location === 'drowned-lantern'
                          ? 'Back to the tavern'
                          : placeMapFor(game!.location)
                            ? `Back to ${placeMapFor(game!.location)!.title}`
                            : 'Back to the map'}
            </span>
          </button>
        ) : (
          <div className="choices">
            {choices.map((ch, i) => (
              <button
                key={ch.index}
                type="button"
                className="choice"
                autoFocus={i === 0}
                onClick={() => choose(ch.index)}
              >
                <span className="num">{i + 1}.</span>
                {ch.as && <span className="tag as">[{ch.as.label}]</span>}
                {ch.check && (
                  <span className="tag check">
                    {ch.check.skillName} DC {ch.check.dc} · {ch.check.heroName}{' '}
                    {ch.check.bonus >= 0 ? '+' : ''}
                    {ch.check.bonus}
                  </span>
                )}
                <span>{ch.text}</span>
                {ch.fight && (
                  <span className="tag fight" aria-label="starts combat">
                    ⚔ (starts combat)
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
      <div className="speaker-bar">
        <div className="leader-portrait">
          <Portrait
            {...leader.portrait}
            ears={ELF_EARS.has(leader.speciesId) ? 'elf' : 'human'}
            cloth={CLASS_COPY[leader.classId]!.cloth}
            label={`Portrait of ${leader.name}`}
          />
        </div>
        <span>
          {leader.name.split(' ')[0]} speaks for the party. Skill checks use whoever in the party is
          best at that skill.
        </span>
      </div>
    </div>
  );
}
