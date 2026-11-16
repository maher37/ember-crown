import { useGame } from '../game/store';
import { CombatScreen } from './CombatScreen';
import { Creator } from './Creator';
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
      {screen === 'prepare' && <PrepareScreen />}
      {screen === 'combat' && <CombatScreen />}
    </Stage>
  );
}
