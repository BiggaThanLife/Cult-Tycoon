// Programmer art: every sprite is drawn in code from the palette and packed into one atlas texture.
// Original art only. Sizes follow docs/ART_BIBLE.md.
import type Phaser from 'phaser';
import { PAL, ROBES } from './palette';

type Ctx = CanvasRenderingContext2D;
interface SpriteDef { key: string; w: number; h: number; draw: (p: Pen) => void }

/** Tiny pixel-drawing helper bound to an offset inside the atlas. */
class Pen {
  constructor(private ctx: Ctx, private ox: number, private oy: number) {}
  r(x: number, y: number, w: number, h: number, c: string): this {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(this.ox + x, this.oy + y, w, h);
    return this;
  }
  px(x: number, y: number, c: string): this { return this.r(x, y, 1, 1, c); }
  /** Filled rect with a 1px outline. */
  box(x: number, y: number, w: number, h: number, fill: string, line: string = PAL.ink): this {
    return this.r(x, y, w, h, line).r(x + 1, y + 1, w - 2, h - 2, fill);
  }
  /** Filled pixel circle (diameter d) with top-left at x,y. */
  disc(x: number, y: number, d: number, c: string): this {
    const rad = d / 2;
    for (let j = 0; j < d; j++) for (let i = 0; i < d; i++) {
      const dx = i + 0.5 - rad;
      const dy = j + 0.5 - rad;
      if (dx * dx + dy * dy <= rad * rad) this.px(x + i, y + j, c);
    }
    return this;
  }
  ring(x: number, y: number, d: number, fill: string, line: string = PAL.ink): this {
    return this.disc(x, y, d, line).disc(x + 1, y + 1, d - 2, fill);
  }
  /** Filled diamond with given half-size centred at cx,cy. */
  diamond(cx: number, cy: number, half: number, c: string): this {
    for (let j = -half; j <= half; j++) {
      const span = half - Math.abs(j);
      this.r(cx - span, cy + j, span * 2 + 1, 1, c);
    }
    return this;
  }
  /** Draw from a character map. '.' and ' ' are transparent. Rows may be ragged. */
  map(x: number, y: number, rows: string[], pal: Record<string, string>): this {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = pal[row[i]];
        if (c) this.px(x + i, y + j, c);
      }
    });
    return this;
  }
}

// ---------- character maps ----------

const FOLLOWER = [
  '................',
  '.....oooooo.....',
  '....oRRRRRRo....',
  '...oRRssssRRo...',
  '...oRssssssRo...',
  '...oRsesseSRo...',
  '...oRssssssRo...',
  '....oRssssRo....',
  '...ooRRRRRRoo...',
  '..orrrrrrrrrro..',
  '..orrrrLLrrrro..',
  '..osrrrLLrrrso..',
  '...orrrrrrrro...',
  '...orrrrrrrro...',
  '...oRRRooRRRo...',
  '....ooo..ooo....',
];

const CAT = [
  '................',
  '................',
  '................',
  '..o.....o.......',
  '.oko...oko......',
  '.okkoookko......',
  '.okkkkkkko...oo.',
  '.okgkkkgko..oko.',
  '.okkkpkkko..oko.',
  '..okkkkkkoookko.',
  '..okkkkkkkkkko..',
  '..okkkkkkkkkko..',
  '..okkokkkokko...',
  '..okoookkooko...',
  '..oo...oo..oo...',
  '................',
];

const MOTHMAN = [
  '................................',
  '...........oo......oo...........',
  '..........okko....okko..........',
  '..........okkko..okkko..........',
  '...........okkoookko............',
  '..oo.......okkkkkkko.......oo...',
  '.okkoo....okkkkkkkkko....ookko..',
  '.okkkkoo..okRRkkkRRko..ookkkko..',
  'okkkkkkkoookRRRkRRRkoookkkkkkko.',
  'okkmmkkkkkkkRRRkRRRkkkkkkkmmkko.',
  'okkmmmkkkkkkkRRkRRkkkkkkkmmmkko.',
  'okkkmmmkkkkkkkkkkkkkkkkkmmmkkko.',
  'okkkkmmmmkkkkkkkkkkkkkmmmmkkkko.',
  'okkkkkmmmmkkkffffkkkkmmmmkkkkko.',
  '.okkkkkmmmkkffffffkkmmmkkkkkko..',
  '.okkkkkkmmkkffffffkkmmkkkkkkko..',
  '.okkmkkkkmkkffffffkkmkkkkmkkko..',
  '..okmmkkkkkkkffffkkkkkkkmmkko...',
  '..okkmmkkkkkkkkkkkkkkkkmmkkko...',
  '...okkmmkkkkkkkkkkkkkkmmkkko....',
  '...okkkmkkkkkkkkkkkkkkmkkkko....',
  '....okkkkkookkkkkkkookkkkko.....',
  '....okkkkoo.okkkkko.ookkkko.....',
  '.....okkoo..okkkkko..ookko......',
  '.....okko...okkokko...okko......',
  '......oo....okkokko....oo.......',
  '............okkokko.............',
  '...........okko.okko............',
  '...........okko.okko............',
  '..........okkko.okkko...........',
  '..........ooooo.ooooo...........',
  '................................',
];

const ADVISOR = [
  '................',
  '..oooooooooo....',
  '..owwwwwwwwoo...',
  '..owwwwwwwwowo..',
  '..owiiiiiiwoooo.',
  '..owwwwwwwwwwo..',
  '..owweewweewwo..',
  '..owweewweewwo..',
  '..owwwwwwwwwwo..',
  '..owwmwwwwmwwo..',
  '..owwwmmmmwwwo..',
  '..owwwwwwwwwwo..',
  '..owiiiiiiiiwo..',
  '..owiiiiiwwwwo..',
  '..oooooooooooo..',
  '................',
];

// ---------- sprite list ----------

function followerSprite(key: string, skin: string, robe: [string, string, string], bob: number): SpriteDef {
  return {
    key, w: 16, h: 16,
    draw: (p) => p.map(0, bob, bob ? FOLLOWER.slice(0, 15) : FOLLOWER, {
      o: PAL.ink, R: robe[2], r: robe[1], L: robe[0], s: skin, e: PAL.ink, S: skin,
    }),
  };
}

function building(key: string, w: number, h: number, draw: (p: Pen) => void): SpriteDef {
  return { key, w, h, draw };
}

function ritualTile(i: number, draw: (p: Pen) => void): SpriteDef {
  return { key: `tile_${i}`, w: 20, h: 20, draw };
}

function paper(p: Pen, x: number, y: number, w: number, h: number, fill: string, lines: string): void {
  p.box(x, y, w, h, fill);
  for (let j = y + 3; j < y + h - 2; j += 2) p.r(x + 2, j, w - 4, 1, lines);
}

function potion(key: string, liquid: string, glow: string): SpriteDef {
  return {
    key, w: 16, h: 16,
    draw: (p) => {
      p.box(6, 1, 4, 3, PAL.wood);
      p.box(5, 3, 6, 3, PAL.robeL);
      p.ring(2, 5, 12, PAL.robeL);
      p.disc(3, 8, 10, liquid);
      p.r(4, 7, 8, 2, liquid);
      p.r(3, 6, 10, 2, PAL.robeL);
      p.px(5, 10, glow).px(6, 9, glow).px(9, 12, glow);
    },
  };
}

function icon8(key: string, rows: string[], pal: Record<string, string>): SpriteDef {
  return { key, w: 8, h: 8, draw: (p) => p.map(0, 0, rows, pal) };
}

function sprites(): SpriteDef[] {
  const out: SpriteDef[] = [];

  // followers: 4 skins × 4 robes × 2 frames
  PAL.skin.forEach((skin, s) => ROBES.forEach((robe, r) => {
    out.push(followerSprite(`fol_${s}_${r}_0`, skin, robe, 0));
    out.push(followerSprite(`fol_${s}_${r}_1`, skin, robe, 1));
  }));

  // reporter: trench coat, hat, notepad
  out.push({
    key: 'reporter', w: 16, h: 16,
    draw: (p) => {
      p.map(0, 0, FOLLOWER, { o: PAL.ink, R: PAL.woodD, r: PAL.wood, L: PAL.sand, s: PAL.skin[0], e: PAL.ink, S: PAL.skin[0] });
      p.r(3, 1, 10, 2, PAL.ink).r(4, 0, 8, 2, PAL.woodDD).r(2, 2, 12, 1, PAL.woodDD);
      p.box(10, 9, 5, 5, PAL.white).r(11, 11, 3, 1, PAL.ink2);
    },
  });

  out.push({ key: 'cat', w: 16, h: 16, draw: (p) => p.map(0, 0, CAT, { o: PAL.ink, k: PAL.ink2, g: PAL.acid, p: PAL.pink }) });
  out.push({ key: 'mothman', w: 32, h: 32, draw: (p) => p.map(0, 0, MOTHMAN, { o: PAL.ink, k: PAL.ink2, m: PAL.robeDD, R: PAL.red, f: PAL.robeD }) });
  out.push({ key: 'advisor', w: 16, h: 16, draw: (p) => p.map(0, 0, ADVISOR, { o: PAL.ink, w: PAL.white, i: PAL.robe, e: PAL.ink, m: PAL.red }) });

  // ---- more entities (32×32), drawn from shapes ----
  out.push({ key: 'baba_yaga', w: 32, h: 32, draw: (p) => { // the hut on chicken legs; she is home
    p.r(11, 20, 2, 8, PAL.ink).r(19, 20, 2, 8, PAL.ink).r(11, 21, 1, 7, PAL.yellow).r(19, 21, 1, 7, PAL.yellow);
    p.r(8, 28, 7, 2, PAL.ink).r(17, 28, 7, 2, PAL.ink).r(9, 28, 5, 1, PAL.yellow).r(18, 28, 5, 1, PAL.yellow).px(8, 30, PAL.ink).px(14, 30, PAL.ink).px(17, 30, PAL.ink).px(23, 30, PAL.ink);
    p.box(6, 9, 20, 13, PAL.woodD, PAL.ink).r(7, 13, 18, 1, PAL.woodDD).r(7, 17, 18, 1, PAL.woodDD);
    for (let i = 0; i < 8; i++) p.r(4 + i * 2 - 1, 9 - i, 26 - i * 4, 1, i % 2 ? PAL.woodDD : PAL.ink2);
    p.r(3, 9, 26, 2, PAL.ink).box(21, 1, 4, 7, PAL.ink2).disc(20, 0, 3, PAL.robeL).disc(23, 0, 2, PAL.robe);
    p.box(10, 12, 8, 7, PAL.night).r(12, 14, 1, 2, PAL.acid).r(15, 14, 1, 2, PAL.acid).r(13, 17, 3, 1, PAL.bone);
    p.box(20, 13, 4, 9, PAL.woodDD).px(22, 18, PAL.yellow);
  } });
  out.push({ key: 'jersey_devil', w: 32, h: 32, draw: (p) => { // winged, hooved, long-faced
    for (let i = 0; i < 9; i++) { p.r(1 + i, 6 + i, 10 - i, 1, PAL.redD); p.r(21, 6 + i, 10 - i, 1, PAL.redD); }
    p.r(1, 5, 10, 1, PAL.ink).r(21, 5, 10, 1, PAL.ink).r(0, 6, 1, 4, PAL.ink).r(31, 6, 1, 4, PAL.ink);
    p.box(11, 12, 10, 12, PAL.red, PAL.ink).r(13, 14, 6, 8, PAL.pink);
    p.box(12, 2, 8, 6, PAL.red, PAL.ink).box(13, 7, 6, 7, PAL.red, PAL.ink).r(14, 7, 4, 1, PAL.red);
    p.r(11, 0, 2, 3, PAL.ink).r(19, 0, 2, 3, PAL.ink).px(12, 1, PAL.bone).px(19, 1, PAL.bone);
    p.r(14, 4, 1, 2, PAL.yellow).r(17, 4, 1, 2, PAL.yellow).r(15, 11, 2, 1, PAL.ink).px(14, 12, PAL.white).px(17, 12, PAL.white);
    p.r(12, 24, 3, 5, PAL.ink).r(17, 24, 3, 5, PAL.ink).r(13, 24, 1, 4, PAL.redD).r(18, 24, 1, 4, PAL.redD).r(11, 29, 5, 2, PAL.ink).r(16, 29, 5, 2, PAL.ink);
    p.r(21, 20, 6, 1, PAL.ink).r(26, 17, 1, 4, PAL.ink).diamond(27, 15, 2, PAL.redD);
  } });
  out.push({ key: 'anansi', w: 32, h: 32, draw: (p) => { // the spider who owns every story
    for (const [x0, y0, x1, y1] of [[13, 16, 3, 8], [13, 18, 1, 16], [13, 20, 2, 24], [14, 22, 5, 29], [18, 16, 28, 8], [18, 18, 30, 16], [18, 20, 29, 24], [17, 22, 26, 29]] as number[][]) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) p.r(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 2, 2, PAL.ink);
    }
    p.ring(8, 12, 16, PAL.ink2).disc(11, 15, 10, PAL.night2);
    p.diamond(16, 20, 3, PAL.yellow).diamond(16, 20, 1, PAL.ink);
    p.ring(11, 5, 10, PAL.ink2);
    p.r(13, 8, 2, 2, PAL.acid).r(17, 8, 2, 2, PAL.acid).px(12, 11, PAL.acid).px(19, 11, PAL.acid).px(15, 11, PAL.white).px(16, 11, PAL.white);
    p.r(14, 13, 4, 1, PAL.bone);
  } });
  out.push({ key: 'vorl', w: 32, h: 32, draw: (p) => { // one patient eye in deep water
    p.r(0, 0, 32, 32, PAL.night).r(0, 22, 32, 10, PAL.ink);
    for (let x = 0; x < 32; x += 4) p.r(x, 21 + ((x / 4) % 2), 3, 1, PAL.night2);
    for (const [x, h] of [[3, 12], [8, 17], [24, 16], [28, 11]] as number[][]) { p.r(x, 24 - h, 3, h, PAL.ink2).r(x + 1, 24 - h, 1, h, PAL.robeDD).px(x + (h % 2 ? 3 : -1), 24 - h, PAL.ink2).px(x + 1, 26 - h, PAL.teal); }
    p.ring(8, 3, 16, PAL.ink2).disc(10, 5, 12, PAL.bone).disc(12, 7, 8, PAL.teal).r(15, 6, 2, 10, PAL.ink).px(14, 8, PAL.white);
    p.px(5, 4, PAL.teal).px(27, 6, PAL.teal).px(2, 15, PAL.teal).px(29, 18, PAL.teal);
  } });
  out.push({ key: 'unknown_entity', w: 32, h: 32, draw: (p) => { p.ring(4, 2, 24, PAL.robeD, PAL.robeDD).box(6, 20, 20, 12, PAL.robeD, PAL.robeDD); p.r(13, 8, 6, 2, PAL.robeL).r(18, 10, 2, 4, PAL.robeL).r(15, 14, 3, 2, PAL.robeL).r(15, 16, 2, 2, PAL.robeL).r(15, 20, 2, 2, PAL.robeL); } });

  // ---- map tiles (16×16) ----
  out.push({ key: 'grass_0', w: 16, h: 16, draw: (p) => p.r(0, 0, 16, 16, PAL.grassL).px(3, 4, PAL.grass).px(11, 9, PAL.grass).px(7, 13, PAL.grass) });
  out.push({ key: 'grass_1', w: 16, h: 16, draw: (p) => p.r(0, 0, 16, 16, PAL.grassL).px(5, 10, PAL.grass).px(12, 3, PAL.grass).r(8, 6, 2, 1, PAL.grass) });
  out.push({ key: 'grass_2', w: 16, h: 16, draw: (p) => p.r(0, 0, 16, 16, PAL.grassL).px(2, 12, PAL.grass).px(13, 12, PAL.yellow).px(13, 13, PAL.grass).px(6, 3, PAL.pink) });
  out.push({
    key: 'bramble', w: 16, h: 16,
    draw: (p) => {
      p.r(0, 0, 16, 16, PAL.grassD);
      p.disc(1, 1, 8, PAL.grassDD).disc(7, 3, 8, PAL.grassDD).disc(2, 8, 8, PAL.grassDD).disc(8, 8, 7, PAL.grassDD);
      p.px(4, 4, PAL.redD).px(10, 6, PAL.redD).px(6, 11, PAL.redD).px(12, 11, PAL.ink2).px(3, 9, PAL.ink2).px(9, 2, PAL.ink2);
    },
  });
  out.push({ key: 'fence', w: 16, h: 16, draw: (p) => p.r(0, 0, 16, 16, PAL.grassL).r(0, 6, 16, 2, PAL.woodD).r(0, 10, 16, 2, PAL.woodD).box(2, 3, 3, 11, PAL.wood, PAL.woodDD).box(11, 3, 3, 11, PAL.wood, PAL.woodDD) });

  // ---- buildings ----
  out.push(building('b_sermon_hall', 48, 44, (p) => {
    p.box(2, 20, 44, 24, PAL.sand);
    p.r(3, 40, 42, 3, PAL.wood);
    // roof
    for (let i = 0; i < 12; i++) p.r(2 + i * 2 - 2, 20 - i, 48 - i * 4 + 4 - 4, 1, i % 3 === 0 ? PAL.redD : PAL.red);
    p.r(0, 20, 48, 2, PAL.ink);
    // steeple with an eye instead of a cross
    p.box(20, 0, 8, 12, PAL.sand);
    p.ring(21, 2, 6, PAL.white).r(23, 4, 2, 2, PAL.ink);
    // door + windows
    p.box(19, 28, 10, 16, PAL.woodD).r(24, 29, 1, 14, PAL.woodDD).px(26, 37, PAL.yellow);
    p.box(6, 27, 8, 9, PAL.yellow).r(9, 28, 1, 7, PAL.ink2).box(34, 27, 8, 9, PAL.yellow).r(37, 28, 1, 7, PAL.ink2);
    p.px(41, 41, PAL.redD).px(42, 42, PAL.redD); // suspicious stain
  }));
  out.push(building('b_dormitory', 32, 40, (p) => {
    p.box(1, 14, 30, 26, PAL.robeL);
    for (let i = 0; i < 8; i++) p.r(i * 2, 14 - i, 32 - i * 4, 1, i % 2 ? PAL.robeD : PAL.robeDD);
    p.r(0, 14, 32, 2, PAL.ink);
    p.box(12, 26, 8, 14, PAL.woodD).px(18, 33, PAL.yellow);
    p.box(3, 19, 6, 6, PAL.blue).box(23, 19, 6, 6, PAL.blue).box(3, 29, 6, 6, PAL.night2).box(23, 29, 6, 6, PAL.blue);
    p.px(5, 31, PAL.acid).px(7, 31, PAL.acid); // someone is awake
  }));
  out.push(building('b_greenhouse', 32, 40, (p) => {
    p.box(1, 16, 30, 24, PAL.blue, PAL.ink);
    for (let i = 0; i < 7; i++) p.r(1 + i * 2, 16 - i, 30 - i * 4, 1, PAL.blue);
    p.r(1, 16, 30, 1, PAL.ink).r(15, 9, 2, 31, PAL.white).r(1, 27, 30, 1, PAL.white).r(8, 17, 1, 22, PAL.white).r(23, 17, 1, 22, PAL.white);
    for (let i = 0; i < 7; i++) p.px(1 + i * 2, 16 - i, PAL.ink).px(30 - i * 2, 16 - i, PAL.ink);
    p.r(13, 9, 6, 1, PAL.ink);
    p.disc(3, 30, 5, PAL.grassD).disc(10, 31, 5, PAL.grass).disc(18, 30, 5, PAL.grassD).disc(25, 31, 5, PAL.grass);
    p.px(5, 31, PAL.purple).px(20, 31, PAL.pink).r(1, 37, 30, 2, PAL.woodD);
  }));
  out.push(building('b_alchemy_lab', 32, 40, (p) => {
    p.box(2, 16, 28, 24, PAL.night2);
    for (let i = 0; i < 8; i++) p.r(i * 2, 16 - i, 32 - i * 4, 1, i % 2 ? PAL.robeDD : PAL.night);
    p.r(0, 16, 32, 2, PAL.ink);
    p.box(22, 2, 5, 10, PAL.woodDD); // chimney
    p.disc(21, 0, 4, PAL.acid).disc(25, 0, 3, PAL.teal);
    p.box(5, 21, 8, 8, PAL.teal).r(8, 22, 1, 6, PAL.night).r(6, 25, 6, 1, PAL.night);
    p.box(17, 24, 9, 16, PAL.woodD).px(24, 32, PAL.yellow);
    p.ring(5, 31, 8, PAL.ink2).r(7, 32, 4, 2, PAL.acid);
  }));
  out.push({ key: 'ghost_ok', w: 16, h: 16, draw: (p) => p.box(0, 0, 16, 16, PAL.acid, PAL.grassDD) });
  out.push({ key: 'ghost_bad', w: 16, h: 16, draw: (p) => p.box(0, 0, 16, 16, PAL.pink, PAL.red) });

  // ---- ritual tiles (20×20): shape first, colour second ----
  out.push(ritualTile(0, (p) => { // candle: tall rectangle + flame
    p.box(7, 8, 6, 11, PAL.yellow).r(8, 9, 1, 9, PAL.white);
    p.r(9, 6, 2, 2, PAL.ink).diamond(10, 3, 3, PAL.ink).diamond(10, 3, 2, PAL.red).px(10, 4, PAL.yellow);
    p.r(5, 18, 10, 2, PAL.ink).r(6, 18, 8, 1, PAL.wood);
  }));
  out.push(ritualTile(1, (p) => { // skull: round with two dots
    p.ring(2, 1, 16, PAL.bone).box(6, 13, 8, 6, PAL.bone);
    p.r(5, 7, 3, 4, PAL.ink).r(12, 7, 3, 4, PAL.ink).r(9, 11, 2, 2, PAL.ink);
    p.r(8, 15, 1, 3, PAL.ink).r(11, 15, 1, 3, PAL.ink).r(7, 13, 6, 1, PAL.bone);
  }));
  out.push(ritualTile(2, (p) => { // eye: almond + pupil
    for (let j = 0; j < 7; j++) { const s = j * 2 + 3; p.r(10 - Math.min(s, 9), 3 + j, Math.min(s, 9) * 2, 1, PAL.ink); p.r(10 - Math.min(s, 9), 16 - j, Math.min(s, 9) * 2, 1, PAL.ink); }
    for (let j = 0; j < 6; j++) { const s = j * 2 + 2; p.r(10 - Math.min(s, 8), 4 + j, Math.min(s, 8) * 2, 1, PAL.teal); p.r(10 - Math.min(s, 8), 15 - j, Math.min(s, 8) * 2, 1, PAL.teal); }
    p.disc(6, 6, 8, PAL.white).disc(8, 8, 4, PAL.ink).px(9, 8, PAL.white);
  }));
  out.push(ritualTile(3, (p) => { // rune: diamond with glyph
    p.diamond(10, 10, 9, PAL.ink).diamond(10, 10, 8, PAL.purple).diamond(10, 10, 6, PAL.robeDD);
    p.r(10, 6, 1, 9, PAL.white).r(8, 8, 2, 1, PAL.white).r(11, 11, 2, 1, PAL.white);
  }));
  out.push(ritualTile(4, (p) => { // herb: three leaves
    p.ring(6, 1, 8, PAL.grass).ring(1, 7, 8, PAL.grass).ring(11, 7, 8, PAL.grass);
    p.r(9, 9, 2, 10, PAL.ink).r(9, 9, 1, 9, PAL.grassD).px(9, 4, PAL.grassD).px(4, 10, PAL.grassD).px(14, 10, PAL.grassD);
  }));
  out.push(ritualTile(5, (p) => { // coin: circle with a hole
    p.ring(2, 2, 16, PAL.pink).disc(4, 4, 12, PAL.red).disc(5, 5, 10, PAL.pink).box(8, 8, 4, 4, PAL.ink2);
    p.px(6, 6, PAL.white).px(7, 5, PAL.white);
  }));
  out.push({ key: 'relic', w: 20, h: 20, draw: (p) => { // glowing lantern relic
    p.box(7, 1, 6, 3, PAL.woodD).box(4, 4, 12, 13, PAL.night).r(6, 6, 8, 9, PAL.acid).r(8, 8, 4, 5, PAL.white);
    p.r(9, 4, 2, 13, PAL.ink).box(3, 16, 14, 3, PAL.woodD);
  } });
  out.push({ key: 'sp_lineH', w: 20, h: 20, draw: (p) => p.r(0, 8, 20, 4, PAL.ink).r(1, 9, 18, 2, PAL.white).px(0, 9, PAL.white).px(19, 10, PAL.white) });
  out.push({ key: 'sp_lineV', w: 20, h: 20, draw: (p) => p.r(8, 0, 4, 20, PAL.ink).r(9, 1, 2, 18, PAL.white) });
  out.push({ key: 'sp_bomb', w: 20, h: 20, draw: (p) => { p.r(0, 0, 20, 2, PAL.ink).r(0, 18, 20, 2, PAL.ink).r(0, 0, 2, 20, PAL.ink).r(18, 0, 2, 20, PAL.ink); p.r(1, 1, 18, 1, PAL.white).r(1, 18, 18, 1, PAL.white).r(1, 1, 1, 18, PAL.white).r(18, 1, 1, 18, PAL.white); } });
  out.push({ key: 'sp_sigil', w: 20, h: 20, draw: (p) => { p.ring(0, 0, 20, PAL.night).disc(2, 2, 16, PAL.night2); p.diamond(10, 10, 6, PAL.acid).diamond(10, 10, 4, PAL.night).diamond(10, 10, 2, PAL.white); p.px(10, 1, PAL.acid).px(10, 18, PAL.acid).px(1, 10, PAL.acid).px(18, 10, PAL.acid); } });
  out.push({ key: 'web', w: 20, h: 20, draw: (p) => {
    for (let i = 0; i < 20; i++) p.px(i, i, PAL.white).px(19 - i, i, PAL.white);
    p.r(0, 9, 20, 1, PAL.white).r(9, 0, 1, 20, PAL.white);
    for (const d of [3, 6]) { p.r(9 - d, 9 - d, d * 2 + 1, 1, PAL.robeL).r(9 - d, 9 + d, d * 2 + 1, 1, PAL.robeL).r(9 - d, 9 - d, 1, d * 2 + 1, PAL.robeL).r(9 + d, 9 - d, 1, d * 2 + 1, PAL.robeL); }
  } });
  out.push({ key: 'cell_a', w: 20, h: 20, draw: (p) => p.r(0, 0, 20, 20, PAL.night2) });
  out.push({ key: 'cell_b', w: 20, h: 20, draw: (p) => p.r(0, 0, 20, 20, PAL.night) });
  out.push({ key: 'select', w: 20, h: 20, draw: (p) => { p.r(0, 0, 20, 1, PAL.acid).r(0, 19, 20, 1, PAL.acid).r(0, 0, 1, 20, PAL.acid).r(19, 0, 1, 20, PAL.acid); } });

  // ---- merge items (22×22) ----
  out.push({ key: 'm_pamphlet', w: 22, h: 22, draw: (p) => { paper(p, 6, 4, 10, 14, PAL.white, PAL.robe); p.r(8, 6, 6, 2, PAL.red); } });
  out.push({ key: 'm_brochure', w: 22, h: 22, draw: (p) => { paper(p, 2, 4, 7, 14, PAL.white, PAL.robe); paper(p, 8, 3, 7, 15, PAL.white, PAL.robe); paper(p, 14, 4, 7, 14, PAL.white, PAL.robe); p.r(10, 5, 3, 3, PAL.yellow); } });
  out.push({ key: 'm_manifesto', w: 22, h: 22, draw: (p) => { p.box(4, 2, 14, 18, PAL.sand).box(3, 1, 16, 3, PAL.wood).box(3, 18, 16, 3, PAL.wood); for (let j = 6; j < 17; j += 2) p.r(6, j, 10, 1, PAL.woodD); p.disc(13, 13, 5, PAL.red); } });
  out.push({ key: 'm_scripture', w: 22, h: 22, draw: (p) => { p.box(3, 2, 16, 18, PAL.robeD).r(4, 3, 2, 16, PAL.robeDD).box(8, 6, 8, 8, PAL.yellow, PAL.woodD).r(11, 7, 2, 6, PAL.woodD).r(9, 9, 6, 2, PAL.woodD).r(5, 18, 13, 1, PAL.white); } });
  out.push({ key: 'm_tome', w: 22, h: 22, draw: (p) => { p.box(2, 1, 18, 20, PAL.night).r(3, 2, 2, 18, PAL.ink).ring(6, 5, 11, PAL.night2).disc(9, 8, 5, PAL.acid).disc(10, 9, 3, PAL.ink).px(11, 10, PAL.acid).box(17, 8, 4, 5, PAL.yellow, PAL.woodD); } });
  out.push({ key: 'm_unknown', w: 22, h: 22, draw: (p) => { p.box(4, 3, 14, 16, PAL.robeD, PAL.robeDD); p.r(9, 6, 4, 1, PAL.robeL).r(12, 7, 1, 3, PAL.robeL).r(10, 10, 2, 1, PAL.robeL).r(10, 11, 1, 2, PAL.robeL).px(10, 15, PAL.robeL); } });
  out.push({ key: 'g_donation_box', w: 22, h: 22, draw: (p) => { p.box(2, 7, 18, 14, PAL.wood, PAL.ink).box(1, 4, 20, 5, PAL.woodD).r(7, 6, 8, 1, PAL.ink).box(8, 12, 6, 6, PAL.yellow, PAL.woodDD).r(10, 14, 2, 2, PAL.woodDD); } });

  // ---- candle chain (22×22) ----
  const flame = (p: Pen, x: number, y: number) => p.diamond(x, y, 2, PAL.ink).diamond(x, y, 1, PAL.red).px(x, y + 1, PAL.yellow);
  out.push({ key: 'm_stub', w: 22, h: 22, draw: (p) => { p.box(8, 13, 6, 6, PAL.bone).r(10, 11, 1, 2, PAL.ink).r(5, 19, 12, 2, PAL.ink).r(6, 19, 10, 1, PAL.woodD); } });
  out.push({ key: 'm_taper', w: 22, h: 22, draw: (p) => { p.box(9, 7, 4, 13, PAL.bone).r(10, 8, 1, 11, PAL.white); flame(p, 11, 4); p.r(6, 19, 10, 2, PAL.ink).r(7, 19, 8, 1, PAL.wood); } });
  out.push({ key: 'm_votive', w: 22, h: 22, draw: (p) => { p.box(5, 9, 12, 11, PAL.red, PAL.ink).r(6, 10, 10, 3, PAL.pink).box(8, 6, 6, 5, PAL.bone); flame(p, 11, 3); } });
  out.push({ key: 'm_altar_candle', w: 22, h: 22, draw: (p) => { p.box(3, 8, 4, 11, PAL.bone).box(9, 5, 4, 14, PAL.bone).box(15, 8, 4, 11, PAL.bone); flame(p, 5, 5); flame(p, 11, 2); flame(p, 17, 5); p.box(1, 18, 20, 3, PAL.yellow, PAL.woodDD); } });
  out.push({ key: 'm_eternal_flame', w: 22, h: 22, draw: (p) => { p.ring(2, 12, 18, PAL.night2).r(2, 12, 18, 3, PAL.ink).r(3, 13, 16, 1, PAL.night2); p.diamond(11, 8, 7, PAL.ink).diamond(11, 8, 6, PAL.teal).diamond(11, 9, 4, PAL.acid).diamond(11, 10, 2, PAL.white); p.px(4, 4, PAL.acid).px(18, 3, PAL.teal).px(15, 1, PAL.acid); } });
  out.push({ key: 'g_ritual_brazier', w: 22, h: 22, draw: (p) => { p.r(4, 9, 14, 2, PAL.ink).box(5, 10, 12, 6, PAL.woodDD, PAL.ink).r(10, 16, 2, 4, PAL.ink).box(6, 19, 10, 3, PAL.woodDD, PAL.ink); p.diamond(11, 6, 4, PAL.ink).diamond(11, 6, 3, PAL.red).diamond(11, 7, 1, PAL.yellow).px(7, 8, PAL.red).px(15, 8, PAL.red); } });
  out.push({ key: 'ic_up', w: 8, h: 8, draw: (p) => { p.diamond(4, 3, 3, PAL.ink).r(1, 4, 7, 3, PAL.ink).r(3, 4, 3, 4, PAL.ink).r(4, 1, 1, 6, PAL.acid).r(3, 2, 3, 1, PAL.acid).r(2, 3, 5, 1, PAL.acid); } });

  // ---- crops, plots, potions (16×16) ----
  out.push({ key: 'i_basil', w: 16, h: 16, draw: (p) => { p.ring(4, 1, 8, PAL.grass).ring(1, 6, 7, PAL.grass).ring(8, 6, 7, PAL.grass).r(7, 9, 2, 6, PAL.ink).r(7, 9, 1, 6, PAL.grassD).px(7, 4, PAL.grassL); } });
  out.push({ key: 'i_nightshade', w: 16, h: 16, draw: (p) => { p.r(7, 2, 2, 12, PAL.ink).r(7, 3, 1, 10, PAL.grassDD).ring(1, 3, 6, PAL.grassD).ring(9, 2, 6, PAL.grassD).ring(2, 9, 6, PAL.robeDD).ring(8, 9, 6, PAL.robeDD).px(4, 11, PAL.purple).px(10, 11, PAL.purple); } });
  out.push({ key: 'plot_empty', w: 24, h: 16, draw: (p) => { p.box(0, 4, 24, 12, PAL.woodD, PAL.woodDD); for (let i = 3; i < 22; i += 5) p.r(i, 7, 2, 6, PAL.woodDD); } });
  out.push({ key: 'sprout', w: 16, h: 16, draw: (p) => { p.r(7, 9, 2, 6, PAL.grassD).ring(3, 5, 6, PAL.grass).ring(8, 6, 5, PAL.grassL); } });
  out.push({ key: 'i_graveyard_moss', w: 16, h: 16, draw: (p) => { p.ring(1, 7, 8, PAL.grassD).ring(6, 5, 9, PAL.grassDD).ring(8, 9, 7, PAL.grassD).px(5, 10, PAL.grassL).px(10, 8, PAL.grassL).px(12, 12, PAL.grassL).box(2, 2, 5, 6, PAL.bone).r(4, 3, 1, 4, PAL.ink2).r(3, 4, 3, 1, PAL.ink2); } });
  out.push({ key: 'i_moonpetal', w: 16, h: 16, draw: (p) => { p.r(7, 8, 2, 7, PAL.ink).r(7, 9, 1, 6, PAL.grassD).ring(5, 0, 6, PAL.blue).ring(1, 3, 6, PAL.white).ring(9, 3, 6, PAL.white).ring(5, 6, 6, PAL.blue).disc(6, 3, 4, PAL.yellow); } });
  out.push(potion('i_calm_draught', PAL.blue, PAL.white));
  out.push(potion('i_moonlight_tincture', PAL.white, PAL.blue));
  out.push(potion('i_zeal_tonic', PAL.red, PAL.pink));
  out.push(potion('i_amnesia_brew', PAL.purple, PAL.white));
  out.push(potion('i_pesto', PAL.grass, PAL.grassL));
  out.push(potion('i_sludge', PAL.woodDD, PAL.woodD));
  out.push({ key: 'cauldron', w: 32, h: 24, draw: (p) => { p.ring(2, 2, 28, PAL.ink2).r(2, 2, 28, 8, PAL.ink).r(3, 3, 26, 6, PAL.ink2).r(5, 4, 22, 4, PAL.acid).px(9, 5, PAL.white).px(20, 6, PAL.white).r(0, 2, 32, 2, PAL.ink).box(5, 21, 5, 3, PAL.ink2).box(22, 21, 5, 3, PAL.ink2); } });

  // ---- icons (8×8) ----
  const I = { o: PAL.ink, y: PAL.yellow, r: PAL.red, w: PAL.white, p: PAL.purple, g: PAL.grassD, t: PAL.teal, k: PAL.pink, d: PAL.woodD, a: PAL.acid, l: PAL.robeD };
  out.push(icon8('ic_devotion', ['...oo...', '..oyyo..', '..oyro..', '.oyrryo.', '.oyrryo.', '.oyyyyo.', '..oooo..', '...oo...'], I));
  out.push(icon8('ic_donations', ['..oooo..', '.oyyyyo.', 'oyydyyyo', 'oyddddyo', 'oyydyyyo', 'oyddddyo', '.oyyyyo.', '..oooo..'], I));
  out.push(icon8('ic_suspicion', ['........', '..oooo..', '.owwwwo.', 'owwoowwo', 'owwoowwo', '.owwwwo.', '..oooo..', '........'], I));
  out.push(icon8('ic_favor', ['..ooo...', '.oppo...', 'oppo....', 'oppo....', 'oppo...o', 'opppooo.', '.opppo..', '..ooo...'], I));
  out.push(icon8('ic_star', ['...oo...', '..oyyo..', 'oooyyooo', 'oyyyyyyo', '.oyyyyo.', '.oyooyo.', 'oyo..oyo', 'oo....oo'], I));
  out.push(icon8('ic_star_off', ['...oo...', '..ollo..', 'ooollooo', 'ollllllo', '.ollllo.', '.oloolo.', 'olo..olo', 'oo....oo'], I));
  out.push(icon8('ic_lock', ['..oooo..', '.oo..oo.', '.o....o.', 'oooooooo', 'oyyyyyyo', 'oyyooyyo', 'oyyyyyyo', 'oooooooo'], I));
  out.push(icon8('ic_follower', ['..oooo..', '.ollllo.', '.olwwlo.', '.ollllo.', 'oollllo.', 'ollllllo', 'ollllllo', 'oooooooo'], I));
  out.push(icon8('ic_xp', ['...oo...', '..otto..', '.ottwto.', 'ottttwto', 'otttttto', '.otttto.', '..otto..', '...oo...'], I));
  out.push(icon8('ic_check', ['........', '......oo', '.....ogo', 'oo..ogo.', 'ogoogo..', '.oggo...', '..oo....', '........'], I));

  // ---- tab icons (12×12) ----
  out.push({ key: 'tab_compound', w: 12, h: 12, draw: (p) => { for (let i = 0; i < 5; i++) p.r(5 - i, 1 + i, 2 + i * 2, 1, PAL.red); p.box(2, 6, 8, 6, PAL.sand).r(5, 8, 2, 4, PAL.woodD); } });
  out.push({ key: 'tab_rituals', w: 12, h: 12, draw: (p) => { p.box(4, 5, 4, 7, PAL.yellow).diamond(6, 2, 2, PAL.red).px(6, 2, PAL.yellow).r(2, 11, 8, 1, PAL.ink); } });
  out.push({ key: 'tab_reliquary', w: 12, h: 12, draw: (p) => { p.box(1, 4, 10, 8, PAL.wood).box(0, 2, 12, 4, PAL.woodD).r(5, 6, 2, 3, PAL.yellow); } });
  out.push({ key: 'tab_alchemy', w: 12, h: 12, draw: (p) => { p.box(4, 0, 4, 4, PAL.robeL).ring(1, 3, 10, PAL.robeL).disc(2, 6, 8, PAL.purple).r(3, 5, 6, 2, PAL.robeL).px(4, 8, PAL.white); } });
  out.push({ key: 'tab_orders', w: 12, h: 12, draw: (p) => { p.box(1, 1, 10, 11, PAL.sand).r(3, 4, 6, 1, PAL.woodD).r(3, 6, 6, 1, PAL.woodD).r(3, 8, 4, 1, PAL.woodD).box(4, 0, 4, 3, PAL.woodD); } });
  out.push({ key: 'ic_menu', w: 12, h: 12, draw: (p) => p.r(2, 2, 8, 2, PAL.ink).r(2, 5, 8, 2, PAL.ink).r(2, 8, 8, 2, PAL.ink) });
  out.push({ key: 'ic_build', w: 12, h: 12, draw: (p) => { p.box(1, 1, 7, 5, PAL.robeD).r(4, 5, 2, 7, PAL.ink).r(5, 6, 1, 5, PAL.wood).r(8, 2, 3, 2, PAL.ink); } });
  out.push({ key: 'white', w: 4, h: 4, draw: (p) => p.r(0, 0, 4, 4, PAL.white) });
  // ---- ritual feedback particles: one per tile colour, plus a white spark ----
  [PAL.yellow, PAL.bone, PAL.teal, PAL.purple, PAL.grass, PAL.pink].forEach((c, i) => out.push({ key: `p_${i}`, w: 4, h: 4, draw: (p) => p.r(0, 0, 4, 4, PAL.ink).r(0, 0, 3, 3, c).px(0, 0, PAL.white) }));
  out.push({ key: 'spark', w: 5, h: 5, draw: (p) => p.r(2, 0, 1, 5, PAL.white).r(0, 2, 5, 1, PAL.white) });
  out.push({ key: 'spark_gold', w: 5, h: 5, draw: (p) => p.r(2, 0, 1, 5, PAL.yellow).r(0, 2, 5, 1, PAL.yellow).px(2, 2, PAL.white) });

  // ---- Look Busy tile skin (20x20): office shapes, same colour families as tile_0..5 ----
  const officeTile = (i: number, draw: (p: Pen) => void) => out.push({ key: `tile_office_${i}`, w: 20, h: 20, draw });
  officeTile(0, (p) => { // filled-in form: tall rectangle, title bar, lines, signature (yellow)
    p.box(4, 1, 12, 18, PAL.yellow);
    p.r(6, 3, 8, 2, PAL.woodDD);
    for (const y of [7, 10, 13]) p.r(6, y, 8, 1, PAL.woodD);
    p.r(6, 16, 5, 1, PAL.ink).px(12, 15, PAL.ink).px(13, 14, PAL.ink);
    p.px(5, 2, PAL.white).px(5, 3, PAL.white);
  });
  officeTile(1, (p) => { // rubber stamp: round knob, neck, wide base, inked pad (bone)
    p.ring(6, 0, 8, PAL.bone).box(8, 6, 4, 5, PAL.bone).box(3, 10, 14, 5, PAL.bone);
    p.r(3, 15, 14, 3, PAL.ink).r(4, 15, 12, 2, PAL.red).r(4, 17, 12, 1, PAL.redD);
    p.px(8, 2, PAL.white).px(9, 1, PAL.white).r(5, 11, 1, 3, PAL.white);
    p.r(2, 19, 16, 1, PAL.ink2);
  });
  officeTile(2, (p) => { // receipt: narrow strip with zigzag bottom (teal)
    p.r(5, 1, 10, 16, PAL.ink).r(6, 2, 8, 15, PAL.teal);
    for (let i = 0; i < 10; i++) {
      p.r(5 + i, 17, 1, i % 2 ? 2 : 3, PAL.ink);
      p.r(5 + i, 17, 1, i % 2 ? 1 : 2, PAL.teal);
    }
    p.r(7, 4, 6, 1, PAL.ink2).r(7, 6, 4, 1, PAL.ink2).r(7, 8, 6, 1, PAL.ink2).r(7, 10, 5, 1, PAL.ink2).r(7, 13, 6, 2, PAL.white);
  });
  officeTile(3, (p) => { // hairnet: round mesh (purple)
    p.ring(2, 2, 16, PAL.purple);
    for (let j = 0; j < 20; j++) for (let i = 0; i < 20; i++) {
      const dx = i + 0.5 - 10;
      const dy = j + 0.5 - 10;
      if (dx * dx + dy * dy <= 6.6 * 6.6 && ((i + j) % 4 === 0 || (i - j + 20) % 4 === 0)) p.px(i, j, PAL.robeDD);
    }
    p.r(6, 1, 8, 1, PAL.ink).px(9, 3, PAL.white).px(8, 4, PAL.white);
  });
  officeTile(4, (p) => { // green exit sign: wide rectangle, arrow
    p.r(5, 2, 1, 3, PAL.ink).r(14, 2, 1, 3, PAL.ink);
    p.box(1, 5, 18, 10, PAL.grassD).r(2, 6, 16, 8, PAL.grass);
    p.r(4, 9, 8, 2, PAL.white).r(11, 7, 1, 6, PAL.white).r(12, 8, 1, 4, PAL.white).r(13, 9, 1, 2, PAL.white);
    p.r(15, 8, 2, 4, PAL.grassDD);
  });
  officeTile(5, (p) => { // paperclip (pink): ink outline pass then pink pass
    const segs: number[][] = [[7, 2, 6, 2], [5, 4, 2, 12], [7, 16, 8, 2], [14, 6, 2, 10], [12, 4, 2, 10], [8, 12, 4, 2], [8, 7, 2, 6]];
    for (const [x, y, w, h] of segs) p.r(x - 1, y - 1, w + 2, h + 2, PAL.ink);
    for (const [x, y, w, h] of segs) p.r(x, y, w, h, PAL.pink);
    p.px(5, 5, PAL.white).px(5, 6, PAL.white).px(7, 2, PAL.white);
  });

  // red tape overlay (same role as 'web'): X of bundled tape, centre stays open
  out.push({ key: 'web_office', w: 20, h: 20, draw: (p) => {
    const dot = (x: number, y: number, c: string) => { if (x >= 0 && y >= 0 && x < 20 && y < 20) p.px(x, y, c); };
    for (let i = 0; i < 20; i++) for (const d of [-2, 2]) { dot(i + d, i, PAL.ink); dot(19 - i + d, i, PAL.ink); }
    for (let i = 0; i < 20; i++) for (const d of [-1, 0, 1]) {
      const c = i % 4 === 0 ? PAL.redD : PAL.red;
      dot(i + d, i, c); dot(19 - i + d, i, c);
    }
    p.r(7, 7, 6, 6, PAL.ink).r(8, 8, 4, 4, PAL.red).px(9, 9, PAL.pink);
    p.r(9, 9, 2, 2, PAL.redD);
  } });

  // ---- Omen icon and rite icons ----
  out.push(icon8('ic_omen', ['...oo...', '..otto..', '.otttto.', 'otwwwwto', 'otwoowto', 'otwwwwto', '.otttto.', '..oooo..'], { o: PAL.ink, t: PAL.teal, w: PAL.white }));
  out.push(icon8('ic_away', ['..oooo..', '..o..o..', 'oooooooo', 'obbbbbbo', 'obbyybbo', 'obbbbbbo', 'oooooooo', '.o....o.'], { o: PAL.ink, b: PAL.blue, y: PAL.yellow }));
  const rite = (key: string, draw: (p: Pen) => void) => out.push({ key, w: 12, h: 12, draw });
  rite('rite_sermon', (p) => p.map(0, 0, [ // eye with lashes
    '............', '..o..oo..o..', '...oooooo...', '..owwwwwwo..', '.owttttttwo.', 'owttoooottwo',
    'owttoooottwo', '.owttttttwo.', '..owwwwwwo..', '...oooooo...', '............', '............',
  ], { o: PAL.ink, w: PAL.white, t: PAL.teal }));
  rite('rite_recruit', (p) => p.map(0, 0, [ // person plus
    '............', '..oooo......', '.osssso..gg.', '.osssso..gg.', '..oooo..gggg', '.oppppo.gggg',
    '.oppppo..gg.', '.oppppo..gg.', '.oppppo.....', '.oppppo.....', '.oooooo.....', '............',
  ], { o: PAL.ink, s: PAL.skin[0], p: PAL.robeD, g: PAL.grassD }));
  rite('rite_communion', (p) => p.map(0, 0, [ // gentle skull, small heart
    '...oooooo...', '..obbbbbbo..', '.obbbbbbbbo.', '.obooboobbo.', '.obooboobbo.', '.obbbbbbbbo.',
    '..obbbbbbo..', '...obobobo..', '...oooooo...', '.........r.r', '.........rrr', '..........r.',
  ], { o: PAL.ink, b: PAL.bone, r: PAL.red }));
  rite('rite_harvest', (p) => { // herb sprig tied with red twine
    p.r(5, 5, 2, 7, PAL.ink).r(5, 5, 1, 7, PAL.grassD);
    p.ring(4, 0, 5, PAL.grass).ring(0, 3, 5, PAL.grass).ring(7, 3, 5, PAL.grass);
    p.r(4, 9, 4, 1, PAL.red);
  });
  rite('rite_vigil', (p) => { // candle
    p.diamond(6, 2, 2, PAL.ink).diamond(6, 2, 1, PAL.red).px(6, 3, PAL.yellow);
    p.box(4, 5, 5, 6, PAL.yellow).r(5, 6, 1, 4, PAL.white).r(2, 11, 9, 1, PAL.woodDD);
  });
  rite('rite_look_busy', (p) => { // clipboard with a check
    p.box(1, 2, 10, 10, PAL.wood).r(2, 4, 8, 7, PAL.white).box(4, 0, 4, 3, PAL.ink2);
    for (const [x, y] of [[3, 7], [4, 8], [5, 7], [6, 6], [7, 5]]) p.px(x, y, PAL.grassD).px(x, y + 1, PAL.grassD);
    p.r(3, 10, 6, 1, PAL.robe);
  });
  rite('rite_daily', (p) => { // calendar page with a sun
    p.box(1, 1, 10, 10, PAL.white).r(2, 2, 8, 3, PAL.red);
    p.disc(4, 5, 4, PAL.yellow).px(8, 6, PAL.yellow).px(3, 8, PAL.yellow).r(3, 9, 6, 1, PAL.robe);
    p.r(3, 0, 1, 2, PAL.ink).r(8, 0, 1, 2, PAL.ink);
  });

  // ---- Visitors (16x16): civilian clothes only, no badges, no police look ----
  out.push({ key: 'neighbour', w: 16, h: 16, draw: (p) => { // silver hair, green cardigan, casserole dish
    p.map(0, 0, FOLLOWER, { o: PAL.ink, R: PAL.robe, r: PAL.grassD, L: PAL.white, s: PAL.skin[1], e: PAL.ink, S: PAL.skin[1] });
    p.box(10, 10, 6, 4, PAL.blue).r(11, 11, 4, 1, PAL.white);
    p.px(12, 8, PAL.white).px(13, 7, PAL.white);
  } });
  out.push({ key: 'auditor', w: 16, h: 16, draw: (p) => { // glasses, sweater vest, ledger
    p.map(0, 0, FOLLOWER, { o: PAL.ink, R: PAL.woodDD, r: PAL.yellow, L: PAL.white, s: PAL.skin[0], e: PAL.ink, S: PAL.skin[0] });
    p.r(5, 4, 3, 1, PAL.ink).r(5, 6, 3, 1, PAL.ink).px(5, 5, PAL.ink).px(7, 5, PAL.ink);
    p.r(8, 4, 3, 1, PAL.ink).r(8, 6, 3, 1, PAL.ink).px(8, 5, PAL.ink).px(10, 5, PAL.ink);
    p.box(10, 9, 5, 6, PAL.grassD).r(11, 10, 3, 1, PAL.sand).r(11, 12, 3, 1, PAL.sand);
  } });
  out.push({ key: 'inspector', w: 16, h: 16, draw: (p) => { // building inspector: bare head, soft cardigan, clipboard, lanyard (no hat, vest or badge)
    p.map(0, 0, FOLLOWER, { o: PAL.ink, R: PAL.woodD, r: PAL.robe, L: PAL.bone, s: PAL.skin[2], e: PAL.ink, S: PAL.skin[2] });
    p.r(4, 2, 8, 2, PAL.woodDD).px(4, 4, PAL.woodDD).px(11, 4, PAL.woodDD); // hair, no headgear
    p.px(6, 9, PAL.blue).px(6, 10, PAL.blue).px(7, 11, PAL.blue); // lanyard cord
    p.box(10, 9, 5, 6, PAL.woodD).r(11, 10, 3, 4, PAL.white).r(11, 9, 3, 1, PAL.ink2);
  } });
  out.push({ key: 'reviewer', w: 16, h: 16, draw: (p) => { // clerk behind a tall stack of files
    p.map(0, 0, FOLLOWER, { o: PAL.ink, R: PAL.ink2, r: PAL.robe, L: PAL.red, s: PAL.skin[3], e: PAL.ink, S: PAL.skin[3] });
    const cols = [PAL.sand, PAL.white, PAL.wood, PAL.bone, PAL.white, PAL.sand, PAL.wood];
    cols.forEach((c, k) => p.box(11, k * 2, 5, 3, c));
  } });

  // ---- pending-review tape (32x16): plain beige office tape, no hazard colours, no words (D-149) ----
  out.push({ key: 'seal_tape', w: 32, h: 16, draw: (p) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) p.px(x, y, (x + y) % 8 < 4 ? PAL.sand : PAL.bone);
    p.r(0, 0, 32, 1, PAL.woodD).r(0, 15, 32, 1, PAL.woodD);
  } });
  return out;
}

export const ATLAS = 'atlas';

/** Every sprite key in the atlas (used by tests to catch data that points at missing art). */
export const spriteKeys = (): string[] => sprites().map((d) => d.key);

/** Draw every sprite into one canvas texture and register frames (simple shelf packer). */
export function buildAtlas(scene: Phaser.Scene): string[] {
  if (scene.textures.exists(ATLAS)) return scene.textures.get(ATLAS).getFrameNames();
  const defs = sprites().sort((a, b) => b.h - a.h);
  const size = 512;
  const tex = scene.textures.createCanvas(ATLAS, size, size)!;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const d of defs) {
    if (x + d.w + 1 > size) { x = 0; y += rowH + 1; rowH = 0; }
    if (y + d.h > size) throw new Error('atlas full');
    d.draw(new Pen(ctx, x, y));
    tex.add(d.key, 0, x, y, d.w, d.h);
    x += d.w + 1;
    rowH = Math.max(rowH, d.h);
  }
  tex.refresh();
  return defs.map((d) => d.key);
}
