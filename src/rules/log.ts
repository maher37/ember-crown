/** One line in the combat/dialogue log. Every roll produces one, with its full breakdown. */
export interface LogEntry {
  kind: 'check' | 'save' | 'attack' | 'damage' | 'heal' | 'condition' | 'death' | 'rest' | 'level';
  text: string;
}

export const log = (kind: LogEntry['kind'], text: string): LogEntry => ({ kind, text });
