import { useEffect, useState, type ReactNode } from 'react';
import { useSettings } from '../game/settings';

/** Every screen is designed at 1280×720 (docs/mockups/README.md). */
export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;

function fitScale(): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
}

/** Scales the fixed-size 1280×720 screen to fit the browser window, letterboxed. */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(fitScale);
  const reduceMotion = useSettings((x) => x.reduceMotion);

  useEffect(() => {
    const onResize = () => setScale(fitScale());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="stage-viewport" data-reduce-motion={reduceMotion ? 'true' : undefined}>
      <div
        className="stage"
        style={{ width: STAGE_WIDTH * scale, height: STAGE_HEIGHT * scale }}
        data-testid="stage"
      >
        <div
          className="stage-inner"
          style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
