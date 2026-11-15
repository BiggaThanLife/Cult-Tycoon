// Static content tables. Everything here comes from /data JSON so new content needs no code changes.
import balance from '../../data/balance.json';
import buildings from '../../data/buildings.json';
import crops from '../../data/crops.json';
import recipes from '../../data/recipes.json';
import items from '../../data/items.json';
import merge from '../../data/merge.json';
import entities from '../../data/entities.json';
import orders from '../../data/orders.json';
import events from '../../data/events.json';
import followers from '../../data/followers.json';
import rituals from '../../data/levels/rituals.json';
import rites from '../../data/rites.json';
import rooms from '../../data/rooms.json';
import text from '../../data/text/en.json';
import type { MergeDefs } from '../puzzle/merge';
import type { LevelDef } from '../puzzle/match3';

export interface BuildingDef {
  id: string; w: number; h: number; cost: { devotion: number; donations: number };
  produces?: { resource: 'devotion' | 'donations'; perMin: number }; storageMin?: number;
  housing?: number; plots?: number; brewSlots?: number; max: number; availableFrom: string;
  /** what each level above 1 adds */
  perLevel?: { outputPct?: number; housing?: number; plots?: number; brewBonus?: number };
  /** Devotion storage cap by building level (Sermon Hall) */
  devotionCap?: number[];
  /** upgrades[0] takes the building from level 1 to 2, and so on */
  upgrades?: UpgradeDef[];
}
export interface UpgradeDef { cost: { devotion: number; donations: number }; merge?: { chain: string; tier: number }; omens?: number }
export type BoonField = 'ritualDevotionPct' | 'suspicionDecayPct' | 'outputPct' | 'cropYieldBonus' | 'donationsPerMin' | 'favorPerOrder';
export interface EntityDef {
  id: string; archetype: string; summonRitual: string; hintsRecipe: string | null;
  boons: { favor: number; field: BoonField; value: number }[];
  /** 4th boon, bought with Omens once Favor reaches the audience threshold */
  audience: { field: BoonField; value: number };
  reviewStatus: string; reviewNotes: string; sources: string[];
}
export interface CropDef { id: string; growSec: number; yield: number; seedCost: number; unlockLevel: number }
export interface RecipeDef { id: string; ingredients: string[]; output: string; hinted: boolean }
export interface TraitDef {
  id: string; stats?: Partial<Record<'devotion' | 'sanity' | 'productivity' | 'doubt', number>>;
  outputPct?: number; donationsPerMin?: number; cropYieldBonus?: number; suspicionDecayPct?: number; recruitSuspicion?: number;
}
export type OrderNeed = { item: string; count: number } | { merge: string; tier: number; count: number };
/** kind: 'entity' plain, 'trial' big ask and big pay (Baba Yaga), 'gamble' reward is rolled when delivered (Anansi). */
export interface OrderDef { id: string; from: string; kind: 'entity' | 'trial' | 'gamble'; needs: OrderNeed[]; reward: { devotion?: number; donations?: number; favor?: number }; tutorial?: boolean }
export interface VisitEffects {
  suspicion?: number; suspicionTo?: number; finePct?: number; sealSec?: number; awaySec?: number;
}
export interface EventChoiceDef {
  id: string; requires?: { item: string; count: number };
  effects: VisitEffects & { devotion?: number; donations?: number; flag?: string; consume?: { item: string; count: number }; lookBusy?: string };
}
/** band: Suspicion band (1-3) a visit belongs to, 4 = Full Review. visitor: an inspection-style visit. */
export interface EventDef { id: string; sprite: string; choices: EventChoiceDef[]; band?: number; visitor?: boolean }
export interface RoomDef {
  id: string; key: string | null; slots: number[]; unlockLevel: number; cost: { devotion: number; donations: number };
  effect: Record<string, number | number[]>; upgrades: UpgradeDef[];
}
export interface RoomsData {
  storeys: { level: number; cost: { devotion: number; donations: number }; omens: number; sec: number }[];
  baysPerStorey: number; heightSuspicion: { fromStorey: number; perStoreyPerMin: number }; mergeBonusPct: number[];
  demolishRefund: number; formCutPct: number; formMaxPerVisit: number; rooms: RoomDef[];
}
export interface RiteDef {
  id: string; focus: number; choose?: 'entity' | 'crop';
  pays: { doubtPerTiles?: number; draft?: number; bigDraftAt?: number; bigDraftSize?: number; favorPerTile?: number; cropPerTiles?: number; stubPerTiles?: number; cutPerStar?: number; winSuspicion?: number };
  show: { metAny?: boolean; building?: string; generator?: string; inspection?: boolean };
}

export const DATA = {
  balance,
  buildings: buildings.buildings as BuildingDef[],
  crops: crops.crops as CropDef[],
  recipes: recipes as { recipes: RecipeDef[]; failOutput: string; minIngredients: number; maxIngredients: number },
  items: items.items as { id: string; kind: string }[],
  merge: merge as MergeDefs,
  entities: entities.entities as EntityDef[],
  orders: orders.orders as OrderDef[],
  events: events.events as EventDef[],
  followers: followers as { names: string[]; traits: TraitDef[]; skins: number; robes: number; draftSize: number },
  rituals: (rituals as unknown as { levels: LevelDef[] }).levels,
  rooms: rooms as unknown as RoomsData,
  rites: rites as unknown as { rites: RiteDef[]; omens: { perStar: number; relaxedFlat: number; firstThreeStar: number; rerollCost: number; audienceCost: number; audienceFavor: number }; daily: { bonus: number; bankMax: number } },
  text: text as Record<string, string>,
};
export type Data = typeof DATA;

export const buildingDef = (id: string) => DATA.buildings.find((b) => b.id === id)!;
export const cropDef = (id: string) => DATA.crops.find((c) => c.id === id)!;
export const traitDef = (id: string) => DATA.followers.traits.find((t) => t.id === id)!;
export const entityDef = (id: string) => DATA.entities.find((e) => e.id === id)!;
export const riteDef = (id: string) => DATA.rites.rites.find((r) => r.id === id)!;
export const orderDef = (id: string) => DATA.orders.find((o) => o.id === id)!;
export const eventDef = (id: string) => DATA.events.find((e) => e.id === id)!;
export const ritualDef = (id: string) => DATA.rituals.find((r) => r.id === id)!;
export const mergeItemKey = (chain: string, tier: number) => DATA.merge.chains.find((c) => c.id === chain)!.tiers[tier - 1];
