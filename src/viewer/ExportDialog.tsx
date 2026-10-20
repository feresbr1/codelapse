import { useEffect, useRef, useState } from 'preact/hooks';
import type { Timeline } from '../core/history';
import type { Theme } from './highlight';
import { planFrames, Renderer, type RenderOptions } from './render';
import type { ExportResult, Format } from './encode';

const SIZES = {
  wide: { label: '16:9 (1280×720)', width: 1280, height: 720 },
  square: { label: '1:1 (1080×1080)', width: 1080, height: 1080 },
  tall: { label: '9:16 (720×1280)', width: 720, height: 1280 },
} as const;

type Size = keyof typeof SIZES;

function fileSlug(path: string): string {
  return path
    .split('/')
    .pop()!
    .replace(/[^\w.-]+/g, '-');
}

export function ExportDialog({
  timeline,
  lang,
  onClose,
}: {
  timeline: Timeline;
  lang: string | null;
  onClose: () => void;
}) {
  const last = timeline.states.length - 1;
  const [from, setFrom] = useState(Math.max(0, last - 199));
  const [seconds, setSeconds] = useState(Math.min(30, Math.max(8, Math.round((last + 1) * 0.6))));
  const [size, setSize] = useState<Size>('wide');
  const [theme, setTheme] = useState<Theme>(
    window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
  );
  const [video, setVideo] = useState<Format | null | undefined>(undefined);
  const [format, setFormat] = useState<Format>('gif');
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ url: string; res: ExportResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    import('./encode').then(async (m) => {
      const f = await m.videoFormat();
      if (!alive) return;
      setVideo(f);
      if (f) setFormat(f);
    });
    dialog.current?.querySelector<HTMLElement>('select, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      alive = false;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const opts: RenderOptions = {
    ...SIZES[size],
    ...(format === 'gif'
      ? { width: Math.round(SIZES[size].width * 0.7), height: Math.round(SIZES[size].height * 0.7) }
      : {}),
    theme,
    fps: format === 'gif' ? 12 : 30,
    seconds,
    from,
    to: last,
    watermark: 'made with codelapse',
  };
  // Even dimensions for video encoders.
  opts.width -= opts.width % 2;
  opts.height -= opts.height % 2;

  // Live preview of the last frame with the chosen settings.
  useEffect(() => {
    const c = preview.current;
    if (!c) return;
    c.width = opts.width;
    c.height = opts.height;
    const r = new Renderer(timeline, lang, opts);
    const frames = planFrames(opts);
    r.draw(c.getContext('2d')!, frames[Math.floor(frames.length * 0.6)]!);
  }, [size, theme, from, format, seconds]);

  const frames = planFrames(opts).length;

  const close = () => {
    abort.current?.abort();
    if (result) URL.revokeObjectURL(result.url);
    onClose();
  };

  const run = async () => {
    setError(null);
    setResult(null);
    setProgress(0);
    abort.current = new AbortController();
    try {
      const m = await import('./encode');
      const res = await m.exportTimelapse(
        timeline,
        lang,
        opts,
        format,
        setProgress,
        abort.current.signal,
      );
      setResult({ url: URL.createObjectURL(res.blob), res });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message || String(err));
    } finally {
      setProgress(null);
    }
  };

  const name = `${fileSlug(timeline.history.file)}-codelapse.${format}`;

  return (
    <div
      class="cl-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cl-export-title"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div class="cl-dialog" ref={dialog}>
        <div class="cl-dialog-head">
          <h2 id="cl-export-title">Export the time-lapse</h2>
          <button type="button" class="cl-icon" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>
        <div class="cl-export-grid">
          <canvas ref={preview} class="cl-preview" aria-label="Preview of a frame" />
          <div class="cl-form">
            <label>
              Format
              <select
                value={format}
                onChange={(e) => setFormat(e.currentTarget.value as Format)}
                disabled={progress !== null}
              >
                {video && (
                  <option value={video}>{video.toUpperCase()} video (best for sharing)</option>
                )}
                <option value="gif">GIF (plays everywhere, bigger)</option>
              </select>
            </label>
            {video === null && (
              <p class="cl-small">This browser cannot encode video; GIF is available.</p>
            )}
            <label>
              Commits
              <select
                value={from}
                onChange={(e) => setFrom(Number(e.currentTarget.value))}
                disabled={progress !== null}
              >
                {[
                  0,
                  ...[200, 100, 50, 20].filter((n) => n < last + 1).map((n) => last + 1 - n),
                ].map((f) => (
                  <option key={f} value={f}>
                    {f === 0 ? `All ${last + 1}` : `Last ${last + 1 - f}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Length
              <select
                value={seconds}
                onChange={(e) => setSeconds(Number(e.currentTarget.value))}
                disabled={progress !== null}
              >
                {[8, 15, 30, 45, 60].map((s) => (
                  <option key={s} value={s}>
                    {s} seconds
                  </option>
                ))}
              </select>
            </label>
            <label>
              Shape
              <select
                value={size}
                onChange={(e) => setSize(e.currentTarget.value as Size)}
                disabled={progress !== null}
              >
                {Object.entries(SIZES).map(([k, s]) => (
                  <option key={k} value={k}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Theme
              <select
                value={theme}
                onChange={(e) => setTheme(e.currentTarget.value as Theme)}
                disabled={progress !== null}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <p class="cl-small">
              {frames} frames at {opts.fps} fps, {opts.width}×{opts.height}. Rendered on your
              device.
            </p>
            {progress === null ? (
              <button
                type="button"
                class="cl-btn primary"
                onClick={() => void run()}
                data-testid="export-run"
                disabled={video === undefined}
              >
                {video === undefined
                  ? 'Checking video support…'
                  : result
                    ? 'Export again'
                    : 'Export'}
              </button>
            ) : (
              <div
                class="cl-progress"
                role="progressbar"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div style={{ width: `${progress * 100}%` }} />
                <span>{Math.round(progress * 100)}%</span>
                <button type="button" class="cl-btn" onClick={() => abort.current?.abort()}>
                  Cancel
                </button>
              </div>
            )}
            {error && (
              <p class="cl-error" role="alert">
                Export failed: {error}
              </p>
            )}
            {result && (
              <div class="cl-result" data-testid="export-result">
                <a class="cl-btn primary" href={result.url} download={name}>
                  Download {name} ({(result.res.blob.size / 1024 / 1024).toFixed(1)} MB)
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
