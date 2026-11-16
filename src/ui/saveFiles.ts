import { serializeSave, type SaveFile } from '../game/save';

/** Download a save as a .json file the player can keep or move to another browser. */
export function downloadSave(save: SaveFile): void {
  const blob = new Blob([serializeSave(save)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = save.savedAt.slice(0, 16).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `ember-crown-save-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
