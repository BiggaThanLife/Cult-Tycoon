import type { MergeState } from '../puzzle/merge';

export type TutorialStep =
  | 'welcome' | 'build_hall' | 'collect' | 'ritual1' | 'draft1' | 'ritual2' | 'draft2'
  | 'build_greenhouse' | 'plant' | 'merge' | 'harvest' | 'build_lab' | 'brew' | 'reporter'
  | 'ritual3' | 'orders' | 'away' | 'ascension' | 'done';

export const TUTORIAL_ORDER: TutorialStep[] = [
  'welcome', 'build_hall', 'collect', 'ritual1', 'draft1', 'ritual2', 'draft2',
  'build_greenhouse', 'plant', 'merge', 'harvest', 'build_lab', 'brew', 'reporter',
  'ritual3', 'orders', 'away', 'ascension', 'done',
];

export interface FollowerStats { devotion: number; sanity: number; productivity: number; doubt: number }
export interface Follower {
  id: number;
  name: string;
  traits: string[];
  stats: FollowerStats;
  skin: number;
  robe: number;
  job: number | null; // building id
}

export interface PlotState { crop: string | null; plantedAt: number }
export interface BuildingState {
  id: number;
  type: string;
  x: number;
  y: number;
  level: number;
  stored: number;
  plots?: PlotState[];
}

export interface OrderState { id: string; filled: boolean }
export interface PendingEvent { id: string }

export interface Settings { reducedMotion: boolean; relaxedPuzzles: boolean; speedIndex: number; sound: boolean }

export interface MetaState {
  relics: number;
  ascensions: number;
  grimoire: string[];                      // discovered recipe ids
  mergeCodex: Record<string, number>;      // chain → highest tier reached
  bestiary: string[];                      // entity ids met
  endings: string[];
  settings: Settings;
  stats: { playSec: number; modeSec: Record<string, number>; lastUnlockAt: number; longestGapSec: number };
}

export interface RunState {
  seed: number;
  rng: Record<string, number>;             // named stream states
  time: number;                            // game seconds
  devotion: number;
  donations: number;
  suspicion: number;
  suspicionSeen: boolean;
  xp: number;
  level: number;
  nextId: number;
  inventory: Record<string, number>;
  buildings: BuildingState[];
  followers: Follower[];
  pendingDrafts: number;
  draft: Follower[] | null;
  reliquary: MergeState;
  orders: OrderState[];
  favor: Record<string, number>;
  rituals: Record<string, number>;         // level id → best stars
  activeRitual: unknown | null;            // serialized Match3State while a ritual is in progress
  event: PendingEvent | null;
  flags: Record<string, boolean>;
  tutorial: TutorialStep;
  catAt: number;                           // game time of next cat visit
}

export interface GameState {
  saveVersion: number;
  meta: MetaState;
  run: RunState;
  lastSeenWall: number;
  highWater: number;
}

/** Things the UI may want to react to. Emitted by core, never required by it. */
export type GameEvent =
  | { type: 'float'; textKey: string; params?: Record<string, string | number>; tone: 'gain' | 'loss' | 'irony'; at?: { building?: number; follower?: number } }
  | { type: 'levelUp'; level: number }
  | { type: 'tutorial'; step: TutorialStep }
  | { type: 'unlock'; what: string }
  | { type: 'event'; id: string }
  | { type: 'draft' }
  | { type: 'changed' };

export type Emit = (e: GameEvent) => void;
