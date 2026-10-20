import type { Timeline } from '../core/history';
import { colorFor, highlightLines, type Theme, type Token } from './highlight';

export interface RenderOptions {
  width: number;
  height: number;
  theme: Theme;
  fps: number;
  /** Total length of the time-lapse in seconds (the last frame is held a bit longer). */
  seconds: number;
  /** First and last version index (inclusive). */
  from: number;
  to: number;
  /** Text drawn in the corner. */
  watermark?: string;
}

export interface FramePlan {
  /** Version being transitioned to. */
  version: number;
  /** 0..1 progress of the transition from version-1 (1 = settled). */
  p: number;
  /** 0..1 progress through this version's whole slot (for fading highlights). */
  slot: number;
}

export function planFrames(
  opts: Pick<RenderOptions, 'fps' | 'seconds' | 'from' | 'to'>,
): FramePlan[] {
  const count = opts.to - opts.from + 1;
  const perCommit = Math.max(3, Math.round((opts.seconds * opts.fps) / count));
  const transition = Math.max(2, Math.ceil(perCommit * 0.5));
  const frames: FramePlan[] = [];
  for (let v = opts.from; v <= opts.to; v++) {
    for (let f = 0; f < perCommit; f++) {
      const p = v === opts.from ? 1 : Math.min(1, (f + 1) / transition);
      frames.push({ version: v, p, slot: (f + 1) / perCommit });
    }
  }
  // Hold the final state for 1.5 seconds.
  for (let f = 0; f < Math.round(opts.fps * 1.5); f++)
    frames.push({ version: opts.to, p: 1, slot: 1 });
  return frames;
}

const PALETTE = {
  dark: {
    bg: '#0d1117',
    panel: '#151b24',
    line: '#232c38',
    ink: '#e6edf6',
    muted: '#8b98ab',
    gutter: '#4d5a6c',
    add: '61, 220, 151',
    mod: '255, 181, 71',
    del: '255, 107, 107',
    accent: '#7aa2ff',
  },
  light: {
    bg: '#fbfbf9',
    panel: '#f1f2ee',
    line: '#e2e4dc',
    ink: '#1d2430',
    muted: '#5c6675',
    gutter: '#a2a9b4',
    add: '15, 157, 104',
    mod: '183, 121, 31',
    del: '214, 60, 60',
    accent: '#3557d5',
  },
};

const OPERATOR = /[=!<>\-|&*/:.+~#?%^$@\\_]/;

/**
 * Canvas text has no switch for font ligatures, and coding fonts turn "===" or "=>" into single
 * glyphs. Split text into pieces where every operator character stands alone, so each piece can be
 * drawn separately and the code looks exactly as written. Returns [column offset, text] pairs.
 */
export function ligatureSafePieces(s: string): [number, string][] {
  const pieces: [number, string][] = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const op = OPERATOR.test(s[i]!);
    const nextOp = i + 1 < s.length && OPERATOR.test(s[i + 1]!);
    if (op && nextOp) {
      pieces.push([start, s.slice(start, i + 1)]);
      start = i + 1;
    }
  }
  if (start < s.length) pieces.push([start, s.slice(start)]);
  return pieces;
}

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Draws time-lapse frames for one timeline onto a 2D canvas. */
export class Renderer {
  private tokens = new Map<number, Token[][]>();
  private scroll: number[] = [];
  readonly lineHeight: number;
  readonly fontSize: number;
  private charWidth = 8;
  private header: number;
  private rows: number;

  constructor(
    private t: Timeline,
    private lang: string | null,
    private opts: RenderOptions,
  ) {
    const short = Math.min(opts.width, opts.height);
    this.fontSize = Math.round(short / 30);
    this.lineHeight = Math.round(this.fontSize * 1.45);
    this.header = Math.round(short * 0.16);
    this.rows = Math.floor((opts.height - this.header - this.lineHeight) / this.lineHeight);
    this.planCamera();
  }

  private tokensFor(v: number): Token[][] {
    let tk = this.tokens.get(v);
    if (!tk) {
      tk = highlightLines(this.t.states[v]!.lines, this.lang);
      this.tokens.set(v, tk);
      if (this.tokens.size > 6) this.tokens.delete(this.tokens.keys().next().value!);
    }
    return tk;
  }

  /** Where the "camera" looks for each version: around the first change, kept stable otherwise. */
  private planCamera(): void {
    let top = 0;
    this.t.states.forEach((s, v) => {
      const first = s.ids.findIndex((id) => s.added.has(id) || s.modified.has(id));
      let lastChange = -1;
      for (let i = s.ids.length - 1; i >= 0 && lastChange === -1; i--) {
        if (s.added.has(s.ids[i]!) || s.modified.has(s.ids[i]!)) lastChange = i;
      }
      const maxTop = Math.max(0, s.ids.length - this.rows);
      if (first !== -1) {
        const visible = first >= top && lastChange < top + this.rows;
        if (!visible) top = Math.max(0, first - Math.floor(this.rows * 0.25));
      }
      this.scroll[v] = Math.min(top, maxTop);
    });
  }

  draw(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, frame: FramePlan): void {
    const { width, height, theme } = this.opts;
    const pal = PALETTE[theme];
    const fs = this.fontSize;
    const lh = this.lineHeight;
    const v = frame.version;
    const prevV = Math.max(this.opts.from, v - 1);
    const p = ease(frame.p);
    const B = this.t.states[v]!;
    const A = v === this.opts.from ? B : this.t.states[prevV]!;
    const commit = this.t.history.commits[v]!;

    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, width, height);
    ctx.font = `${fs}px "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'middle';
    this.charWidth = ctx.measureText('M').width;

    // Code area.
    const top0 = this.header + lh * 0.5;
    const scroll =
      (this.scroll[prevV] ?? 0) + ((this.scroll[v] ?? 0) - (this.scroll[prevV] ?? 0)) * p;
    const gutterChars = String(Math.max(A.ids.length, B.ids.length)).length;
    const gutterW = (gutterChars + 2) * this.charWidth;
    const x0 = Math.round(width * 0.03);
    const textX = x0 + gutterW;
    const maxChars = Math.floor((width - textX - x0) / this.charWidth);
    const idxA = new Map<number, number>();
    A.ids.forEach((id, i) => idxA.set(id, i));
    const idxB = new Map<number, number>();
    B.ids.forEach((id, i) => idxB.set(id, i));
    const tokB = this.tokensFor(v);
    const tokA = this.tokensFor(prevV);
    const fade = 1 - frame.slot * 0.8;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this.header, width, height - this.header);
    ctx.clip();
    const drawLine = (
      row: number,
      tokens: Token[],
      alpha: number,
      tint: string | null,
      number: number | null,
    ) => {
      const y = top0 + (row - scroll) * lh;
      if (y < this.header - lh || y > height + lh) return;
      if (tint) {
        ctx.fillStyle = `rgba(${tint}, ${0.22 * alpha})`;
        ctx.fillRect(x0 - 6, y - lh / 2, width - 2 * x0 + 12, lh);
        ctx.fillStyle = `rgba(${tint}, ${0.9 * alpha})`;
        ctx.fillRect(x0 - 6, y - lh / 2, 3, lh);
      }
      ctx.globalAlpha = alpha;
      if (number !== null) {
        ctx.fillStyle = pal.gutter;
        ctx.textAlign = 'right';
        ctx.fillText(String(number), textX - this.charWidth * 1.5, y);
        ctx.textAlign = 'left';
      }
      let col = 0;
      for (const [type, raw] of tokens) {
        if (col >= maxChars) break;
        const text = raw.replace(/\t/g, '  ');
        const visible = text.slice(0, maxChars - col);
        ctx.fillStyle = colorFor(type, theme);
        for (const [offset, piece] of ligatureSafePieces(visible)) {
          ctx.fillText(piece, textX + (col + offset) * this.charWidth, y);
        }
        col += text.length;
      }
      ctx.globalAlpha = 1;
    };
    // Deleted lines fade out where they were.
    if (A !== B) {
      A.ids.forEach((id, i) => {
        if (!idxB.has(id)) drawLine(i, tokA[i]!, 1 - p, pal.del, null);
      });
    }
    B.ids.forEach((id, i) => {
      const from = idxA.get(id);
      const row = from === undefined || A === B ? i : from + (i - from) * p;
      const added = A !== B && B.added.has(id);
      const modified = A !== B && B.modified.has(id);
      if (modified && p < 1 && from !== undefined) {
        drawLine(row, tokA[from]!, 1 - p, pal.mod, null);
        drawLine(row, tokB[i]!, p, pal.mod, i + 1);
      } else {
        const tint = added ? pal.add : modified ? pal.mod : null;
        // The highlight fades out over the rest of this commit's slot.
        drawLine(row, tokB[i]!, added ? p : 1, tint && fade > 0 ? tint : null, i + 1);
      }
    });
    ctx.restore();

    // Header.
    ctx.fillStyle = pal.panel;
    ctx.fillRect(0, 0, width, this.header);
    ctx.fillStyle = pal.line;
    ctx.fillRect(0, this.header - 1, width, 1);
    const hx = x0;
    ctx.textAlign = 'left';
    ctx.fillStyle = pal.ink;
    ctx.font = `600 ${Math.round(fs * 1.15)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(fit(ctx, commit.message || '(no message)', width * 0.66), hx, this.header * 0.36);
    ctx.font = `${Math.round(fs * 0.9)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = pal.muted;
    const date = new Date(commit.date);
    const when = Number.isNaN(date.getTime()) ? commit.date : date.toISOString().slice(0, 10);
    ctx.fillText(
      fit(
        ctx,
        `${this.t.history.file} · ${commit.author} · ${when} · ${commit.sha.slice(0, 7)}`,
        width * 0.66,
      ),
      hx,
      this.header * 0.68,
    );
    // Right side: commit counter and diffstat.
    ctx.textAlign = 'right';
    ctx.font = `700 ${Math.round(fs * 1.3)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = pal.ink;
    ctx.fillText(when.slice(0, 4), width - x0, this.header * 0.36);
    ctx.font = `${Math.round(fs * 0.9)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = pal.muted;
    ctx.fillText(
      `commit ${v + 1} / ${this.t.states.length} · ${B.ids.length} lines`,
      width - x0,
      this.header * 0.68,
    );
    // Progress bar.
    const progress =
      (v - this.opts.from + frame.p) / Math.max(1, this.opts.to - this.opts.from + 1);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(0, this.header - 3, width * Math.min(1, progress), 3);
    // Watermark.
    if (this.opts.watermark) {
      ctx.font = `${Math.round(fs * 0.8)}px Inter, ui-sans-serif, system-ui, sans-serif`;
      const w = ctx.measureText(this.opts.watermark).width;
      const pad = fs * 0.5;
      const wy = height - lh * 0.6;
      ctx.fillStyle = pal.panel;
      ctx.globalAlpha = 0.92;
      ctx.fillRect(width - x0 - w - pad, wy - fs * 0.7, w + pad * 2, fs * 1.4);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = pal.muted;
      ctx.fillText(this.opts.watermark, width - x0, wy);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }
}

function fit(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  max: number,
): string {
  if (ctx.measureText(text).width <= max) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= max) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo)}…`;
}
