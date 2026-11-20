import { Modal } from './ExploreDialogs';

/** Who made what (assets/CREDITS.md). */
export function CreditsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Credits" onClose={onClose}>
      <div className="journal-scroll credits">
        <h3 className="eyebrow">The Ember Crown</h3>
        <p>
          A personal, non-commercial game. Designed, written and playtested by its owner; code
          written with Claude Code.
        </p>
        <h3 className="eyebrow">Rules</h3>
        <p className="small">
          This work includes material taken from the System Reference Document 5.1 (&ldquo;SRD
          5.1&rdquo;) by Wizards of the Coast LLC, available at
          https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed
          under the Creative Commons Attribution 4.0 International License
          (https://creativecommons.org/licenses/by/4.0/legalcode). Dungeons &amp; Dragons 5th
          edition (2014) rules.
        </p>
        <h3 className="eyebrow">Setting</h3>
        <p className="small">
          Set in the Forgotten Realms, which belongs to Wizards of the Coast. Ashford, its people
          and its story are original to this game. Not affiliated with or endorsed by Wizards of the
          Coast.
        </p>
        <h3 className="eyebrow">Art</h3>
        <p className="small">
          All art is original vector drawing made for this game: portraits, the world map, the
          tavern, place backdrops, the Old Mine and King&apos;s Kiln maps, and camp scenes.
        </p>
        <h3 className="eyebrow">Sound</h3>
        <p className="small">
          All music, place sounds and effects are generated live in the browser by code written for
          this game. No recorded sounds are used.
        </p>
        <h3 className="eyebrow">Fonts</h3>
        <p className="small">
          Cinzel (Natanael Gama), Inter (Rasmus Andersson) and Spectral (Production Type), from
          Google Fonts under the SIL Open Font License 1.1.
        </p>
        <h3 className="eyebrow">Built with</h3>
        <p className="small">React, Vite, TypeScript, Zustand, zod and inkjs (Inkle&apos;s Ink).</p>
      </div>
    </Modal>
  );
}
