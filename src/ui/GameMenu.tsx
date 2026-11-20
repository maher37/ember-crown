import { useState } from 'react';
import { useGame } from '../game/store';
import { CreditsDialog } from './CreditsDialog';
import { Modal, SaveDialog } from './ExploreDialogs';
import { SettingsDialog } from './SettingsDialog';

/** The in-game menu: resume, save, settings, credits, or quit to the title screen. */
export function GameMenuButton() {
  const [open, setOpen] = useState<null | 'menu' | 'save' | 'settings' | 'credits'>(null);
  const { saveTo, goto } = useGame();
  return (
    <>
      <button type="button" className="menu-secondary small-btn" onClick={() => setOpen('menu')}>
        Menu
      </button>
      {open === 'menu' && (
        <Modal title="Menu" onClose={() => setOpen(null)}>
          <div className="game-menu">
            <button type="button" className="menu-primary" onClick={() => setOpen(null)}>
              Resume
            </button>
            <button type="button" className="menu-secondary" onClick={() => setOpen('save')}>
              Save
            </button>
            <button type="button" className="menu-secondary" onClick={() => setOpen('settings')}>
              Settings
            </button>
            <button type="button" className="menu-secondary" onClick={() => setOpen('credits')}>
              Credits
            </button>
            <button
              type="button"
              className="menu-secondary"
              onClick={() => {
                saveTo('autosave');
                goto('title');
              }}
            >
              Save and quit to the title screen
            </button>
          </div>
        </Modal>
      )}
      {open === 'save' && <SaveDialog onClose={() => setOpen(null)} />}
      {open === 'settings' && <SettingsDialog onClose={() => setOpen(null)} />}
      {open === 'credits' && <CreditsDialog onClose={() => setOpen(null)} />}
    </>
  );
}
