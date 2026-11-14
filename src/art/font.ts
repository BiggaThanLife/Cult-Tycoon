// 5×7 dot-matrix bitmap font (the classic public LCD character matrix), rendered proportionally.
// Columns are bytes, bit 0 = top row. One pre-coloured texture per font colour so it works in
// both WebGL and Canvas renderers without tinting.
import Phaser from 'phaser';
import { FONT_COLORS } from './palette';

const G =
  '0000000000 00005F0000 0007000700 147F147F14 242A7F2A12 2313086462 3649552250 0005030000 001C224100 0041221C00 ' +
  '14083E0814 08083E0808 0050300000 0808080808 0060600000 2010080402 3E5149453E 00427F4000 4261514946 2141454B31 ' +
  '1814127F10 2745454539 3C4A494930 0171090503 3649494936 064949291E 0036360000 0056360000 0814224100 1414141414 ' +
  '0041221408 0201510906 324979413E 7E1111117E 7F49494936 3E41414122 7F4141221C 7F49494941 7F09090901 3E4149497A ' +
  '7F0808087F 00417F4100 2040413F01 7F08142241 7F40404040 7F020C027F 7F0408107F 3E4141413E 7F09090906 3E4151215E ' +
  '7F09192946 4649494931 01017F0101 3F4040403F 1F2040201F 3F4038403F 6314081463 0708700807 6151494543 007F414100 ' +
  '0204081020 0041417F00 0402010204 4040404040 0001020400 2054545478 7F48444438 3844444420 384444487F 3854545418 ' +
  '087E090102 18A4A4A47C 7F08040478 00447D4000 0080847D00 7F10284400 00417F4000 7C04180478 7C08040478 3844444438 ' +
  'FC24242418 18242424FC 7C08040408 4854545420 043F444020 3C4040207C 1C2040201C 3C4030403C 4428102844 1CA0A0A07C ' +
  '4464544C44 0008364100 00007F0000 0041360800 0804081008';

export const FONT_SIZE = 8;
export const LINE_HEIGHT = 9;
const CELL_W = 6;
const CELL_H = 8;
const PER_ROW = 16;

interface Glyph { cols: number[]; width: number }

function glyphs(): Glyph[] {
  return G.split(' ').map((hexStr, i) => {
    let cols: number[] = [];
    for (let c = 0; c < 5; c++) cols.push(parseInt(hexStr.slice(c * 2, c * 2 + 2), 16));
    if (i === 0) return { cols: [], width: 3 }; // space
    while (cols.length && cols[0] === 0) cols.shift();
    while (cols.length && cols[cols.length - 1] === 0) cols.pop();
    return { cols, width: cols.length };
  });
}

export const fontKey = (color: string) => `font_${color}`;

export function buildFonts(scene: Phaser.Scene): void {
  const gl = glyphs();
  const texW = PER_ROW * CELL_W;
  const texH = Math.ceil(gl.length / PER_ROW) * CELL_H;
  for (const [name, color] of Object.entries(FONT_COLORS)) {
    const key = fontKey(name);
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, texW, texH)!;
    const ctx = tex.getContext();
    ctx.fillStyle = color;
    const chars: Record<number, unknown> = {};
    gl.forEach((g, i) => {
      const x0 = (i % PER_ROW) * CELL_W;
      const y0 = Math.floor(i / PER_ROW) * CELL_H;
      g.cols.forEach((bits, cx) => {
        for (let r = 0; r < 8; r++) if (bits & (1 << r)) ctx.fillRect(x0 + cx, y0 + r, 1, 1);
      });
      chars[32 + i] = {
        x: x0, y: y0, width: g.width, height: CELL_H,
        centerX: Math.floor(g.width / 2), centerY: Math.floor(CELL_H / 2),
        xOffset: 0, yOffset: 0, xAdvance: g.width + 1, data: {}, kerning: {},
        u0: x0 / texW, v0: y0 / texH, u1: (x0 + g.width) / texW, v1: (y0 + CELL_H) / texH,
      };
    });
    tex.refresh();
    scene.cache.bitmapFont.add(key, { data: { font: key, size: FONT_SIZE, lineHeight: LINE_HEIGHT, retroFont: true, chars }, texture: key, frame: null });
  }
}

/** Pixel width of a single line of text. */
let widths: number[] | null = null;
export function textWidth(s: string): number {
  if (!widths) widths = glyphs().map((g) => g.width + 1);
  let w = 0;
  for (let i = 0; i < s.length; i++) w += widths[s.charCodeAt(i) - 32] ?? 4;
  return Math.max(0, w - 1);
}

/** Greedy word wrap to a pixel width. */
export function wrapText(s: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const trial = line ? `${line} ${word}` : word;
      if (line && textWidth(trial) > maxWidth) {
        out.push(line);
        line = word;
      } else line = trial;
    }
    out.push(line);
  }
  return out;
}
