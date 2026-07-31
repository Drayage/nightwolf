export type RelicId = 'villager' | 'seer' | 'minion' | 'sacrifice';

export interface Villager {
  id: string;
  name: string;
  relic: RelicId;
  alive: boolean;
  jailed: boolean;
}

export interface LogEntry {
  day: number;
  phase: 'night' | 'day';
  text: string;
}

export type RunStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  day: number;
  maxDays: number;
  villagers: Villager[];
  sacrificeHolderId: string;
  minionId: string;
  log: LogEntry[];
  status: RunStatus;
  lossReason?: string;
}
