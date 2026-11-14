// The 32-colour palette from docs/ART_BIBLE.md §3. All generated art uses only these.
export const PAL = {
  ink: '#1b1428', ink2: '#3a2a4d',
  skin: ['#f2c9a0', '#d99a6c', '#a8673f', '#6b3f2a'],
  robeL: '#e8dff5', robe: '#b8a5d9', robeD: '#7b62a8', robeDD: '#4b3a73',
  grassL: '#b6e3a1', grass: '#7cc47a', grassD: '#4a8f5a', grassDD: '#2f5e45',
  sand: '#f0d9a8', wood: '#d1a46e', woodD: '#9a6b45', woodDD: '#5e4030',
  pink: '#ff9fb6', yellow: '#ffd36e', blue: '#8fd3ff', purple: '#c39bff',
  night: '#2a1f4a', night2: '#3d3470', teal: '#58e0c6', acid: '#b6ff7a',
  red: '#c2304f', redD: '#7a1630', bone: '#e8e2c8', white: '#ffffff',
} as const;

export const hex = (c: string) => parseInt(c.slice(1), 16);

/** Robe colour sets for follower variants: [light, mid, dark]. */
export const ROBES: [string, string, string][] = [
  [PAL.robeL, PAL.robe, PAL.robeD],
  [PAL.pink, PAL.red, PAL.redD],
  [PAL.blue, PAL.teal, PAL.grassDD],
  [PAL.yellow, PAL.wood, PAL.woodD],
];

/** Font colours available to text (one pre-tinted font texture each). */
export const FONT_COLORS = {
  ink: PAL.ink, white: PAL.white, dim: PAL.robeD, gain: PAL.grassD, loss: PAL.red,
  irony: PAL.robeDD, gold: PAL.woodD, glow: PAL.acid, pale: PAL.robeL,
} as const;
export type FontColor = keyof typeof FONT_COLORS;
