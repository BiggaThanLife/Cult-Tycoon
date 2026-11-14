import { DATA } from './data';

/** Look up a player-facing string by key with {param} interpolation. Missing keys render ⟦key⟧. */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = DATA.text[key];
  if (s === undefined) return `[[${key}]]`;
  if (params) for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
  return s;
}
export const hasText = (key: string) => DATA.text[key] !== undefined;
