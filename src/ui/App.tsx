import { useGame } from '../game/store';
import { CombatScreen } from './CombatScreen';
import { Creator } from './Creator';
import { DialogueScreen } from './DialogueScreen';
import { ExploreScreen } from './ExploreScreen';
import { LevelUpScreen } from './LevelUpScreen';
import './Creator.css';
import './LoadDialog.css';
import { PartyScreen } from './PartyScreen';
import { PrepareScreen } from './PrepareScreen';
import { Stage } from './Stage';
import { TitleScreen } from './TitleScreen';

export function App() {
  const screen = useGame((s) => s.screen);
  return (
    <Stage>
      {screen === 'title' && <TitleScreen />}
      {screen === 'creator' && <Creator />}
      {screen === 'party' && <PartyScreen />}
      {screen === 'explore' && <ExploreScreen />}
      {screen === 'dialogue' && <DialogueScreen />}
      {screen === 'levelup' && <LevelUpScreen />}
      {screen === 'prepare' && <PrepareScreen />}
      {screen === 'combat' && <CombatScreen />}
    </Stage>
  );
}
