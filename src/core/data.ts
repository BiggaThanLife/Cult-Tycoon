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
import text from '../../data/text/en.json';
import type { MergeDefs } from '../puzzle/merge';
import type { LevelDef } from '../puzzle/match3';

export interface BuildingDef {
  id: string; w: number; h: number; cost: { devotion: number; donations: number };
  produces?: { resource: 'devotion' | 'donations'; perMin: number }; storageMin?: number;
  housing?: number; plots?: number; brewSlots?: number; max: number; availableFrom: string;
}
export interface CropDef { id: string; growSec: number; yield: number; seedCost: number }
export interface RecipeDef { id: string; ingredients: string[]; output: string; hinted: boolean }
export interface TraitDef {
  id: string; stats?: Partial<Record<'devotion' | 'sanity' | 'productivity' | 'doubt', number>>;
  outputPct?: number; donationsPerMin?: number; cropYieldBonus?: number; suspicionDecayPct?: number; recruitSuspicion?: number;
}
export type OrderNeed = { item: string; count: number } | { merge: string; tier: number; count: number };
export interface OrderDef { id: string; from: string; kind: string; needs: OrderNeed[]; reward: { devotion?: number; donations?: number; favor?: number } }
export interface EventChoiceDef {
  id: string; requires?: { item: string; count: number };
  effects: { suspicion?: number; devotion?: number; donations?: number; flag?: string; consume?: { item: string; count: number } };
}
export interface EventDef { id: string; sprite: string; choices: EventChoiceDef[] }

export const DATA = {
  balance,
  buildings: buildings.buildings as BuildingDef[],
  crops: crops.crops as CropDef[],
  recipes: recipes as { recipes: RecipeDef[]; failOutput: string; minIngredients: number; maxIngredients: number },
  items: items.items as { id: string; kind: string }[],
  merge: merge as MergeDefs,
  entities: entities.entities,
  orders: orders.orders as OrderDef[],
  events: events.events as EventDef[],
  followers: followers as { names: string[]; traits: TraitDef[]; skins: number; robes: number; draftSize: number },
  rituals: (rituals as unknown as { levels: LevelDef[] }).levels,
  text: text as Record<string, string>,
};
export type Data = typeof DATA;

export const buildingDef = (id: string) => DATA.buildings.find((b) => b.id === id)!;
export const cropDef = (id: string) => DATA.crops.find((c) => c.id === id)!;
export const traitDef = (id: string) => DATA.followers.traits.find((t) => t.id === id)!;
export const orderDef = (id: string) => DATA.orders.find((o) => o.id === id)!;
export const eventDef = (id: string) => DATA.events.find((e) => e.id === id)!;
export const ritualDef = (id: string) => DATA.rituals.find((r) => r.id === id)!;
export const mergeItemKey = (chain: string, tier: number) => DATA.merge.chains.find((c) => c.id === chain)!.tiers[tier - 1];
