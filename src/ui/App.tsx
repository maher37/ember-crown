import { useGame } from '../game/store';
import { Creator } from './Creator';
import { PartyScreen } from './PartyScreen';
import { Stage } from './Stage';
import { TitleScreen } from './TitleScreen';

export function App() {
  const screen = useGame((s) => s.screen);
  return (
    <Stage>
      {screen === 'title' && <TitleScreen />}
      {screen === 'creator' && <Creator />}
      {screen === 'party' && <PartyScreen />}
    </Stage>
  );
}
