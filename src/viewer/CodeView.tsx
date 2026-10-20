import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Timeline } from '../core/history';
import { highlightLines, tokenClass, type Token } from './highlight';

export const LINE_HEIGHT = 20;
const ANIMATE_LIMIT = 4000;

interface Props {
  timeline: Timeline;
  version: number;
  lang: string | null;
  wrap: boolean;
  heat: number[] | null;
  selected: number | null;
  onSelect: (id: number) => void;
  /** Duration of the move animation in ms (0 = none). */
  duration: number;
}

/**
 * The file at one version. Lines are positioned absolutely by index and keyed by their stable id,
 * so going to another version slides kept lines, fades in new ones and fades out deleted ones.
 */
export function CodeView({
  timeline,
  version,
  lang,
  wrap,
  heat,
  selected,
  onSelect,
  duration,
}: Props) {
  const state = timeline.states[version]!;
  const prevVersion = useRef(version);
  const [exiting, setExiting] = useState<{ id: number; index: number; tokens: Token[] }[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const tokens = useMemo(() => highlightLines(state.lines, lang), [state, lang]);
  const big = state.lines.length > ANIMATE_LIMIT || wrap;
  const width = String(state.lines.length).length;

  // Lines removed on the way to this version are kept on screen briefly while they fade out.
  useLayoutEffect(() => {
    const from = prevVersion.current;
    prevVersion.current = version;
    if (from === version || big || duration === 0) {
      setExiting([]);
      return;
    }
    const prev = timeline.states[from]!;
    const now = new Set(state.ids);
    const prevTokens = highlightLines(prev.lines, lang);
    const gone = prev.ids
      .map((id, index) => ({ id, index, tokens: prevTokens[index]! }))
      .filter((x) => !now.has(x.id));
    setExiting(gone.slice(0, 400));
    const t = setTimeout(() => setExiting([]), duration);
    return () => clearTimeout(t);
  }, [version]);

  // Bring the first change into view.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const first = state.ids.findIndex((id) => state.added.has(id) || state.modified.has(id));
    if (first === -1) return;
    const scroller = el.closest('.cl-code-scroll') as HTMLElement | null;
    if (!scroller) return;
    const top = first * LINE_HEIGHT;
    if (top < scroller.scrollTop + 40 || top > scroller.scrollTop + scroller.clientHeight - 80) {
      scroller.scrollTo({
        top: Math.max(0, top - scroller.clientHeight / 3),
        behavior: duration ? 'smooth' : 'auto',
      });
    }
  }, [version]);

  const heatColor = (age: number) => {
    const n = timeline.states.length - 1;
    const t = n > 0 ? age / n : 1;
    return `hsl(${Math.round(220 - 190 * t)} 85% ${Math.round(42 + 10 * t)}% / ${0.25 + 0.75 * t})`;
  };

  if (big) {
    // Wrapped or very large files: normal flow layout, no motion.
    return (
      <div class={`cl-code flow ${wrap ? 'wrap' : ''}`} ref={box} data-testid="code">
        {state.ids.map((id, i) => (
          <Line
            key={id}
            id={id}
            n={i + 1}
            width={width}
            tokens={tokens[i]!}
            kind={state.added.has(id) ? 'added' : state.modified.has(id) ? 'modified' : ''}
            heat={heat ? heatColor(heat[i]!) : undefined}
            selected={selected === id}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  const height = Math.max(state.ids.length, ...exiting.map((e) => e.index + 1)) * LINE_HEIGHT;
  return (
    <div
      class="cl-code"
      ref={box}
      style={{ height: `${height}px`, '--cl-dur': `${duration}ms` }}
      data-testid="code"
    >
      {exiting.map((e) => (
        <Line
          key={`x${e.id}`}
          id={e.id}
          n={null}
          width={width}
          tokens={e.tokens}
          kind="removed"
          top={e.index * LINE_HEIGHT}
          selected={selected === e.id}
        />
      ))}
      {state.ids.map((id, i) => (
        <Line
          key={id}
          id={id}
          n={i + 1}
          width={width}
          tokens={tokens[i]!}
          kind={state.added.has(id) ? 'added' : state.modified.has(id) ? 'modified' : ''}
          top={i * LINE_HEIGHT}
          heat={heat ? heatColor(heat[i]!) : undefined}
          selected={selected === id}
          onSelect={onSelect}
          version={version}
        />
      ))}
    </div>
  );
}

function Line({
  id,
  n,
  width,
  tokens,
  kind,
  top,
  heat,
  selected,
  onSelect,
  version,
}: {
  id: number;
  n: number | null;
  width: number;
  tokens: Token[];
  kind: '' | 'added' | 'modified' | 'removed';
  top?: number;
  heat?: string;
  selected: boolean;
  onSelect?: (id: number) => void;
  version?: number;
}) {
  return (
    <div
      class={`cl-line ${kind} ${selected ? 'selected' : ''}`}
      style={top === undefined ? undefined : { transform: `translateY(${top}px)` }}
      data-line-id={id}
      data-version={version}
      onClick={onSelect ? () => onSelect(id) : undefined}
    >
      {kind && <span class="cl-flash" key={`${kind}${version ?? ''}`} aria-hidden="true" />}
      <span class="cl-gutter" style={heat ? { boxShadow: `inset 3px 0 0 ${heat}` } : undefined}>
        {n === null ? '' : String(n).padStart(width, ' ')}
      </span>
      <code class="cl-text">
        {tokens.length === 0
          ? ' '
          : tokens.map(([type, text], i) =>
              type ? (
                <span key={i} class={tokenClass(type)}>
                  {text}
                </span>
              ) : (
                text
              ),
            )}
      </code>
    </div>
  );
}
