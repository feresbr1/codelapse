import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_MEDIUM,
  WebMOutputFormat,
  canEncodeVideo,
} from 'mediabunny';
import type { Timeline } from '../core/history';
import { planFrames, Renderer, type RenderOptions } from './render';

export type Format = 'mp4' | 'webm' | 'gif';

export interface ExportResult {
  blob: Blob;
  format: Format;
  frames: number;
}

export async function videoFormat(): Promise<Format | null> {
  try {
    if (typeof VideoEncoder === 'undefined') return null;
    if (await canEncodeVideo('avc', { width: 1280, height: 720 })) return 'mp4';
    if (await canEncodeVideo('vp9', { width: 1280, height: 720 })) return 'webm';
  } catch {
    /* no WebCodecs */
  }
  return null;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Render and encode a time-lapse. `onProgress` gets 0..1; `signal` cancels. */
export async function exportTimelapse(
  timeline: Timeline,
  lang: string | null,
  opts: RenderOptions,
  format: Format,
  onProgress: (p: number) => void,
  signal: AbortSignal,
): Promise<ExportResult> {
  await document.fonts?.ready;
  const frames = planFrames(opts);
  const renderer = new Renderer(timeline, lang, opts);
  const canvas = makeCanvas(opts.width, opts.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: format === 'gif' })!;
  const tick = () => new Promise((r) => setTimeout(r, 0));

  if (format === 'gif') {
    const gif = GIFEncoder();
    // One shared palette for the whole GIF, learned from frames spread over the time-lapse (taken
    // mid-transition, so the green/amber/red highlight colours are in it).
    const samples: Uint8ClampedArray[] = [];
    for (let k = 1; k <= 8; k++) {
      const i = Math.min(frames.length - 1, Math.floor((frames.length * k) / 9));
      const f = frames[i]!;
      renderer.draw(ctx, { ...f, p: Math.min(f.p, 0.6), slot: Math.min(f.slot, 0.2) });
      const d = ctx.getImageData(0, 0, opts.width, opts.height).data;
      const sub = new Uint8ClampedArray(Math.ceil(d.length / 16) * 4);
      for (let px = 0, o = 0; px < d.length; px += 16, o += 4) sub.set(d.subarray(px, px + 4), o);
      samples.push(sub);
    }
    const all = new Uint8ClampedArray(samples.reduce((n, x) => n + x.length, 0));
    let offset = 0;
    for (const x of samples) {
      all.set(x, offset);
      offset += x.length;
    }
    const palette = quantize(all, 256);
    const delay = Math.round(1000 / opts.fps);
    for (let i = 0; i < frames.length; i++) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
      renderer.draw(ctx, frames[i]!);
      const { data } = ctx.getImageData(0, 0, opts.width, opts.height);
      gif.writeFrame(applyPalette(data, palette), opts.width, opts.height, { palette, delay });
      if (i % 8 === 0) {
        onProgress(i / frames.length);
        await tick();
      }
    }
    gif.finish();
    onProgress(1);
    return { blob: new Blob([gif.bytes()], { type: 'image/gif' }), format, frames: frames.length };
  }

  const output = new Output({
    format: format === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, {
    codec: format === 'mp4' ? 'avc' : 'vp9',
    quality: QUALITY_MEDIUM,
  });
  output.addVideoTrack(source, { frameRate: opts.fps });
  await output.start();
  const dt = 1 / opts.fps;
  for (let i = 0; i < frames.length; i++) {
    if (signal.aborted) {
      await output.cancel();
      throw new DOMException('Export cancelled', 'AbortError');
    }
    renderer.draw(ctx, frames[i]!);
    await source.add(i * dt, dt);
    if (i % 10 === 0) {
      onProgress(i / frames.length);
      await tick();
    }
  }
  await output.finalize();
  onProgress(1);
  const buffer = (output.target as BufferTarget).buffer!;
  return {
    blob: new Blob([buffer], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' }),
    format,
    frames: frames.length,
  };
}
