// Responsive layout: integer pixel scale, logical canvas that expands (never stretches),
// safe areas, and per-orientation regions. See docs/ARCHITECTURE.md §6.
export interface Rect { x: number; y: number; w: number; h: number }
export interface Layout {
  scale: number;        // device pixels per logical pixel (integer)
  cssScale: number;     // CSS pixels per logical pixel
  w: number;            // logical canvas size
  h: number;
  landscape: boolean;
  safe: { l: number; t: number; r: number; b: number };
  top: Rect | null;     // portrait resource bar
  tabs: Rect | null;    // portrait tab bar
  rail: Rect | null;    // landscape left rail (resources + tabs)
  dock: Rect | null;    // landscape right dock (context panel)
  banner: Rect;         // advisor tip strip
  body: Rect;           // where the current screen draws
}

export const MIN = { portrait: { w: 180, h: 320 }, landscape: { w: 320, h: 180 } };
const TOP_H = 25;
const TAB_H = 28;
const RAIL_W = 60;
const DOCK_W = 92;
export const BANNER_H = 22;
const BANNER_H_NARROW = 31; // three lines of tip text when the content column is narrow

let probe: HTMLDivElement | null = null;
function safeInsetsCss(): { l: number; t: number; r: number; b: number } {
  if (typeof document === 'undefined') return { l: 0, t: 0, r: 0, b: 0 };
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  const n = (v: string) => parseFloat(v) || 0;
  return { t: n(cs.paddingTop), r: n(cs.paddingRight), b: n(cs.paddingBottom), l: n(cs.paddingLeft) };
}

/** Pure layout maths (unit-tested). Sizes are in device pixels; insets in CSS pixels. */
export function layoutFor(deviceW: number, deviceH: number, dpr: number, insetCss = { l: 0, t: 0, r: 0, b: 0 }): Layout {
  const landscape = deviceW > deviceH;
  const min = landscape ? MIN.landscape : MIN.portrait;
  const scale = Math.max(1, Math.floor(Math.min(deviceW / min.w, deviceH / min.h)));
  const w = Math.floor(deviceW / scale);
  const h = Math.floor(deviceH / scale);
  const toLogical = (css: number) => Math.ceil((css * dpr) / scale);
  const safe = { l: toLogical(insetCss.l), t: toLogical(insetCss.t), r: toLogical(insetCss.r), b: toLogical(insetCss.b) };
  const inner: Rect = { x: safe.l, y: safe.t, w: w - safe.l - safe.r, h: h - safe.t - safe.b };
  let top: Rect | null = null;
  let tabs: Rect | null = null;
  let rail: Rect | null = null;
  let dock: Rect | null = null;
  let content: Rect;
  if (landscape) {
    rail = { x: inner.x, y: inner.y, w: RAIL_W, h: inner.h };
    dock = { x: inner.x + inner.w - DOCK_W, y: inner.y, w: DOCK_W, h: inner.h };
    content = { x: inner.x + RAIL_W, y: inner.y, w: inner.w - RAIL_W - DOCK_W, h: inner.h };
  } else {
    top = { x: inner.x, y: inner.y, w: inner.w, h: TOP_H };
    tabs = { x: inner.x, y: inner.y + inner.h - TAB_H, w: inner.w, h: TAB_H };
    content = { x: inner.x, y: inner.y + TOP_H, w: inner.w, h: inner.h - TOP_H - TAB_H };
  }
  const bannerH = content.w < 190 && landscape ? BANNER_H_NARROW : BANNER_H;
  const banner: Rect = { x: content.x, y: content.y, w: content.w, h: bannerH };
  const body: Rect = { x: content.x, y: content.y + bannerH, w: content.w, h: content.h - bannerH };
  return { scale, cssScale: scale / dpr, w, h, landscape, safe, top, tabs, rail, dock, banner, body };
}

export function computeLayout(): Layout {
  const dpr = window.devicePixelRatio || 1;
  return layoutFor(Math.floor(window.innerWidth * dpr), Math.floor(window.innerHeight * dpr), dpr, safeInsetsCss());
}
