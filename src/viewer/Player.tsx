import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  buildTimeline,
  fileStats,
  lineAges,
  lineStory,
  type FileHistory,
  type Timeline,
} from '../core/history';
import { CodeView } from './CodeView';
import { ExportDialog } from './ExportDialog';
import { languageFor } from './highlight';

const SPEEDS = [
  { label: '0.5×', ms: 1800 },
  { label: '1×', ms: 900 },
  { label: '2×', ms: 450 },
  { label: '4×', ms: 220 },
];

export function formatDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
}

export function age(fromIso: string, toIso: string): string {
  const days = Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000);
  if (!Number.isFinite(days)) return '';
  if (days < 1) return 'less than a day';
  if (days < 60) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.round(days / 30.4);
  if (months < 24) return `${months} months`;
  return `${(days / 365.25).toFixed(1)} years`;
}

function commitLink(h: FileHistory, sha: string): string | undefined {
  return h.commitUrl?.replace('{sha}', sha);
}

export function Player({ history, initialLine }: { history: FileHistory; initialLine?: number }) {
  const timeline: Timeline = useMemo(() => buildTimeline(history), [history]);
  const last = timeline.states.length - 1;
  const [v, setV] = useState(last);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [heatOn, setHeatOn] = useState(false);
  const [wrap, setWrap] = useState(false);
  const [selected, setSelected] = useState<number | null>(() => {
    if (!initialLine) return null;
    return timeline.states[last]?.ids[initialLine - 1] ?? null;
  });
  const [exporting, setExporting] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const lang = useMemo(() => languageFor(history.file), [history.file]);
  const stats = useMemo(() => fileStats(timeline), [timeline]);
  const heat = useMemo(() => (heatOn ? lineAges(timeline, v) : null), [heatOn, timeline, v]);
  const ms = SPEEDS[speed]!.ms;

  useEffect(() => {
    setV(timeline.states.length - 1);
    setPlaying(false);
  }, [timeline]);

  // Opened on a specific line (file.ts:42): bring it into view once.
  useEffect(() => {
    if (selected === null) return;
    const el = root.current?.querySelector<HTMLElement>(`[data-line-id="${selected}"]`);
    const scroller = root.current?.querySelector<HTMLElement>('.cl-code-scroll');
    if (el && scroller) {
      const index = timeline.states[v]!.ids.indexOf(selected);
      if (index >= 0) scroller.scrollTop = Math.max(0, index * 20 - scroller.clientHeight / 3);
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (v >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setV((x) => Math.min(last, x + 1)), ms);
    return () => clearTimeout(t);
  }, [playing, v, ms, last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (exporting) return;
      if (e.key === 'ArrowLeft') setV((x) => Math.max(0, x - 1));
      else if (e.key === 'ArrowRight') setV((x) => Math.min(last, x + 1));
      else if (e.key === 'Home') setV(0);
      else if (e.key === 'End') setV(last);
      else if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'A') play();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const play = () => {
    if (playing) setPlaying(false);
    else {
      if (v >= last) setV(0);
      setPlaying(true);
    }
  };

  const commit = history.commits[v]!;
  const state = timeline.states[v]!;
  const story = selected === null ? [] : lineStory(timeline, selected);
  const selectedLife = selected === null ? undefined : timeline.lives.get(selected);
  // A line present in the first loaded commit of a truncated history may be much older.
  const olderThanCapture = Boolean(selectedLife && selectedLife.born === 0 && history.truncated);
  const counts = timeline.states.map((s) => s.ids.length);
  const maxCount = Math.max(1, ...counts);

  return (
    <div class="cl-player" ref={root}>
      <header class="cl-head">
        <div class="cl-title">
          <h1>
            <span class="cl-file">{history.file}</span>
            {history.repo && <span class="cl-repo">{history.repo}</span>}
          </h1>
          <p class="cl-stats">
            {stats.commits} {stats.commits === 1 ? 'commit' : 'commits'}
            {history.truncated ? ' (most recent)' : ''} · {stats.authors.length}{' '}
            {stats.authors.length === 1 ? 'author' : 'authors'} · {formatDate(stats.firstDate)} →{' '}
            {formatDate(stats.lastDate)}
            {' · '}
            {stats.survivors} of today&rsquo;s lines date from the first version
          </p>
        </div>
        <button type="button" class="cl-btn primary" onClick={() => setExporting(true)}>
          Export video / GIF
        </button>
      </header>

      <section class="cl-commit" aria-live="polite" data-testid="commit">
        <div class="cl-commit-main">
          <p class="cl-msg">{commit.message || '(no message)'}</p>
          <p class="cl-meta">
            <b>{commit.author}</b> · {formatDate(commit.date, true)} ·{' '}
            {commitLink(history, commit.sha) ? (
              <a href={commitLink(history, commit.sha)} target="_blank" rel="noreferrer">
                <code>{commit.sha.slice(0, 7)}</code>
              </a>
            ) : (
              <code>{commit.sha.slice(0, 7)}</code>
            )}
            {commit.path !== history.file && (
              <>
                {' '}
                · as <code>{commit.path}</code>
              </>
            )}
          </p>
        </div>
        <p class="cl-diffstat">
          <span class="add">+{state.added.size}</span>{' '}
          <span class="mod">~{state.modified.size}</span>{' '}
          <span class="del">−{state.removed.length}</span>
          <span class="cl-count">{state.ids.length} lines</span>
        </p>
      </section>

      <div class="cl-controls">
        <div class="cl-buttons">
          <button
            type="button"
            class="cl-icon"
            onClick={() => setV(0)}
            aria-label="First commit"
            title="First commit (Home)"
          >
            ⏮
          </button>
          <button
            type="button"
            class="cl-icon"
            onClick={() => setV(Math.max(0, v - 1))}
            aria-label="Previous commit"
            title="Previous (←)"
          >
            ◀
          </button>
          <button
            type="button"
            class="cl-icon play"
            onClick={play}
            aria-label={playing ? 'Pause' : 'Play'}
            title="Play / pause (Space)"
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <button
            type="button"
            class="cl-icon"
            onClick={() => setV(Math.min(last, v + 1))}
            aria-label="Next commit"
            title="Next (→)"
          >
            ▶︎▶︎
          </button>
          <button
            type="button"
            class="cl-icon"
            onClick={() => setV(last)}
            aria-label="Latest commit"
            title="Latest (End)"
          >
            ⏭
          </button>
        </div>
        <div class="cl-scrub">
          <svg
            class="cl-spark"
            viewBox={`0 0 ${counts.length} 100`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline
              points={counts.map((c, i) => `${i + 0.5},${100 - (c / maxCount) * 92}`).join(' ')}
              fill="none"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <label class="sr-only" for="cl-range">
            Commit
          </label>
          <input
            id="cl-range"
            type="range"
            min={0}
            max={last}
            value={v}
            onInput={(e) => {
              setPlaying(false);
              setV(Number(e.currentTarget.value));
            }}
          />
          <p class="cl-pos">
            commit <b>{v + 1}</b> of {last + 1}
          </p>
        </div>
        <div class="cl-toggles">
          <label>
            <span class="sr-only">Speed</span>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.currentTarget.value))}
              aria-label="Playback speed"
            >
              {SPEEDS.map((s, i) => (
                <option key={s.label} value={i}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input type="checkbox" checked={heatOn} onChange={() => setHeatOn(!heatOn)} /> Age
            heatmap
          </label>
          <label>
            <input type="checkbox" checked={wrap} onChange={() => setWrap(!wrap)} /> Wrap
          </label>
        </div>
      </div>

      <div class={`cl-body ${selected !== null ? 'with-story' : ''}`}>
        <div class="cl-code-scroll">
          <CodeView
            timeline={timeline}
            version={v}
            lang={lang}
            wrap={wrap}
            heat={heat}
            selected={selected}
            onSelect={(id) => setSelected(id === selected ? null : id)}
            duration={playing ? Math.min(600, ms * 0.7) : 450}
          />
        </div>
        {selected !== null && selectedLife && (
          <aside class="cl-story" aria-label="Line history" data-testid="story">
            <div class="cl-story-head">
              <h2>Life of this line</h2>
              <button
                type="button"
                class="cl-icon"
                onClick={() => setSelected(null)}
                aria-label="Close line history"
              >
                ✕
              </button>
            </div>
            <p class="cl-story-sum">
              {olderThanCapture ? (
                <>
                  Already there in the oldest loaded commit ({formatDate(history.commits[0]!.date)};
                  older history not loaded)
                </>
              ) : (
                <>
                  Written by <b>{history.commits[selectedLife.born]!.author}</b> on{' '}
                  {formatDate(history.commits[selectedLife.born]!.date)}
                </>
              )}
              {selectedLife.died === undefined
                ? `, ${selectedLife.edits.length === 0 ? 'never edited' : `edited ${selectedLife.edits.length}×`}, alive for ${olderThanCapture ? 'at least ' : ''}${age(history.commits[selectedLife.born]!.date, history.commits[last]!.date)}.`
                : `, deleted ${formatDate(history.commits[selectedLife.died]!.date)}.`}
            </p>
            <ol class="cl-steps">
              {story.map((s) => {
                const c = history.commits[s.version]!;
                return (
                  <li
                    key={`${s.kind}${s.version}`}
                    class={`${s.kind} ${s.version === v ? 'current' : ''}`}
                  >
                    <button type="button" onClick={() => setV(s.version)}>
                      <span class="cl-step-kind">
                        {s.kind === 'born' && olderThanCapture ? 'first loaded commit' : s.kind}
                      </span>
                      <span class="cl-step-msg">{c.message}</span>
                      <span class="cl-step-meta">
                        {c.author} · {formatDate(c.date)} · <code>{c.sha.slice(0, 7)}</code>
                      </span>
                    </button>
                    {s.before !== undefined && <pre class="cl-before">− {s.before}</pre>}
                    {s.text !== undefined && <pre class="cl-after">+ {s.text}</pre>}
                  </li>
                );
              })}
            </ol>
            {!state.ids.includes(selected) && (
              <p class="cl-note">This line does not exist in the commit you are viewing.</p>
            )}
          </aside>
        )}
      </div>
      <p class="cl-hint">Click any line to see its life story · ← → to step · Space to play</p>
      {exporting && (
        <ExportDialog timeline={timeline} lang={lang} onClose={() => setExporting(false)} />
      )}
    </div>
  );
}
