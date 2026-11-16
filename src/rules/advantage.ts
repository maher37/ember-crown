export type RollMode = 'normal' | 'advantage' | 'disadvantage';

/**
 * PHB: Advantage and Disadvantage. If anything gives advantage and anything gives disadvantage,
 * they cancel out, no matter how many of each there are.
 */
export function resolveMode(advantageSources: number, disadvantageSources: number): RollMode {
  const adv = advantageSources > 0;
  const dis = disadvantageSources > 0;
  if (adv && !dis) return 'advantage';
  if (dis && !adv) return 'disadvantage';
  return 'normal';
}

/** Collects the reasons for advantage and disadvantage on one roll, for the log. */
export class Edge {
  readonly advantage: string[] = [];
  readonly disadvantage: string[] = [];

  adv(reason: string, when = true): this {
    if (when) this.advantage.push(reason);
    return this;
  }

  dis(reason: string, when = true): this {
    if (when) this.disadvantage.push(reason);
    return this;
  }

  get mode(): RollMode {
    return resolveMode(this.advantage.length, this.disadvantage.length);
  }
}
