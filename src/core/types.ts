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
  /** game time until which this follower is away helping with an inquiry */
  awayUntil?: number;
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
  /** game time until which the building is sealed Pending Review (no production, no use) */
  sealedUntil?: number;
}

/** An order currently on the board. Filled orders are counted in RunState.ordersFilled. */
export interface OrderState { id: string }
export interface PendingEvent { id: string }
/** The rite chosen for the ritual in progress (lives in the save so rotation and reloads keep it). */
export interface ActiveRite { id: string; entity?: string; crop?: string; daily?: boolean }
/** A visit the player chose to answer with Look Busy; its outcome waits for the ritual (or for settling). */
export interface PendingInspection { event: string; choice: string; level: string }
export interface DailyState { day: string; bank: number }
/** One bay of the Sanctum. `progress` and `fed` are per-room work counters (forms, Basil). */
export interface RoomState { id: number; type: string; storey: number; bay: number; level: number; progress: number; fed?: number; sealedUntil?: number }
export interface SanctumState { storeys: number; building: { storey: number; doneAt: number } | null; rooms: RoomState[] }

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
  ordersFilled: Record<string, number>;    // order id → times filled this run
  orderNextAt: Record<string, number>;     // entity id → game time when its next order may appear
  lastOrder: Record<string, string>;       // entity id → last order id handed out (avoid repeats)
  met: string[];                           // entities summoned this run
  hints: string[];                         // recipe ids an entity has hinted at
  omens: number;                           // ritual-only currency
  audiences: string[];                     // entities that granted an audience (4th boon)
  activeRite: ActiveRite | null;
  inspection: PendingInspection | null;
  daily: DailyState;
  visitClock: number;                      // seconds since the last visit roll
  lastVisitAt: number;                     // game time of the last visit
  draftBonus: number;                      // extra cards on the next draft
  sanctum: SanctumState;                   // the side view: storeys and rooms
  walk: import('./inspection').WalkResult | null; // the last inspection walkthrough, until the screen has shown it
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
  | { type: 'boon'; entity: string; index: number }
  | { type: 'tutorial'; step: TutorialStep }
  | { type: 'unlock'; what: string }
  | { type: 'event'; id: string }
  | { type: 'draft' }
  | { type: 'changed' };

export type Emit = (e: GameEvent) => void;
