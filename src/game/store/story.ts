import { abilityCheck, abilityModifier, SeededRng, SKILLS } from '../../rules';
import { getEncounter } from '../combat';
import { Conversation, PLACE_SCENES } from '../dialogue';
import { getBounty, markHunted } from '../bounties';
import { bestFor, parseSkill } from '../dialogue';
import { skillBonus } from '../hero';
import { addNote, partyXp } from '../journal';
import { readLetter } from '../letters';
import { arrive, homeScreen, type GameStore, type StoreSet, type StoreGet } from './shared';

/** Dialogue, letters and talking past trouble. */
export const storySlice = (
  set: StoreSet,
  get: StoreGet,
): Pick<GameStore, 'talk' | 'choose' | 'leaveDialogue' | 'answerLetter' | 'talkPast'> => ({
  talk: (knot, story = 'tavern') => {
    const { game, rngState } = get();
    if (!game) return;
    const rng = SeededRng.fromState(rngState);
    const conversation = new Conversation(story, game, rng).start(knot);
    set({
      conversation,
      game: conversation.game,
      rngState: rng.state,
      screen: 'dialogue',
      dialogueTick: get().dialogueTick + 1,
    });
    if (conversation.messages.length) get().toast(conversation.messages);
  },

  choose: (index) => {
    const { conversation, rngState } = get();
    if (!conversation) return;
    const rng = SeededRng.fromState(rngState);
    // The conversation keeps the dice it was made with; give it the current position.
    conversation.rng = rng;
    conversation.choose(index);
    set({ game: conversation.game, rngState: rng.state, dialogueTick: get().dialogueTick + 1 });
    if (conversation.messages.length) get().toast(conversation.messages);
  },

  leaveDialogue: () => {
    const { conversation, game, afterDialogue } = get();
    const travel = conversation?.travel;
    const fight = conversation?.fight;
    set({
      conversation: null,
      afterDialogue: null,
      screen: homeScreen(game),
    });
    // Autosave after every conversation, so story progress is never lost [inferred].
    get().saveTo('autosave');
    if (fight && conversation) {
      set({ resume: { story: conversation.storyId, knot: fight.resume } });
      get().openPrepare(fight.encounterId);
    } else if (travel === 'epilogue') set({ screen: 'epilogue' });
    else if (travel === 'map') get().openMap();
    else if (travel === 'town') get().enterTown();
    else if (travel?.startsWith('scene:')) {
      // Another story's scene, e.g. "scene:ashford.hall" (the tavern's front door → Ashford Hall).
      const [story, ...rest] = travel.slice(6).split('.');
      get().talk(rest.join('.'), story);
    } else if (travel) get().openPrepare(travel);
    else if (afterDialogue === 'place') get().enterPlace();
  },

  answerLetter: (id, replyId) => {
    const { game } = get();
    if (!game) return;
    set({ game: readLetter(game, id, replyId) });
    get().saveTo('autosave');
  },

  talkPast: () => {
    const { game, encounterId, rngState, pendingArrival, backToCamp } = get();
    if (!game || !encounterId) return null;
    const enc = getEncounter(encounterId);
    if (!enc.talk) return null;
    const rng = SeededRng.fromState(rngState);
    const skill = parseSkill(enc.talk.skill);
    const hero = bestFor(game, skill);
    const ability = SKILLS[skill];
    const bonus = skillBonus(hero, skill) - abilityModifier(hero.abilities[ability]);
    const label = enc.talk.skill[0]!.toUpperCase() + enc.talk.skill.slice(1);
    const r = abilityCheck(hero, ability, enc.talk.dc, rng, {
      label,
      bonuses: bonus ? [{ label: 'skill', value: bonus }] : [],
    });
    set({ rngState: rng.state });
    if (!r.success) return { success: false, text: `${r.log.text}. ${enc.talk.failure}` };
    // D16: talking past a fight is worth the same XP.
    let next = partyXp(game, enc.xpPerPc, enc.name).game;
    if (enc.talk.note) next = addNote(next, enc.talk.note).game;
    if (pendingArrival) next = arrive(next, pendingArrival).game;
    const hunt = get().hunt;
    const huntDone = hunt && getBounty(hunt).encounter === enc.id ? markHunted(next, hunt) : null;
    if (huntDone) next = huntDone.game;
    const messages = [
      r.log.text,
      enc.talk.success,
      `+${enc.xpPerPc} XP each: ${enc.name} (talked past)`,
      ...(huntDone?.messages ?? []),
    ];
    set({
      game: next,
      screen: backToCamp ? 'camp' : homeScreen(next),
      hunt: null,
      pendingArrival: null,
      backToCamp: false,
      toasts: messages,
      travelLog: [...messages, ...get().travelLog].slice(0, 30),
      campLog: backToCamp ? [...get().campLog, ...messages] : get().campLog,
    });
    get().saveTo('autosave');
    if (!backToCamp && pendingArrival && PLACE_SCENES[pendingArrival]) get().enterPlace();
    return { success: true, text: r.log.text };
  },
});
