import { describe, expect, it } from 'vitest';
import { diffLines, lineSimilarity, pairEdits } from '../src/core/diff';
import {
  buildTimeline,
  fileStats,
  HistoryError,
  lineAges,
  lineStory,
  packHistory,
  splitLines,
  validateHistory,
  type Commit,
} from '../src/core/history';
import { ligatureSafePieces, planFrames } from '../src/viewer/render';
import { highlightLines, languageFor } from '../src/viewer/highlight';

function apply(a: string[], b: string[]): string[] {
  const ops = diffLines(a, b);
  const out: string[] = [];
  for (const op of ops) {
    if (op.type === 'equal') {
      expect(a[op.a]).toBe(b[op.b]);
      out.push(a[op.a]!);
    } else if (op.type === 'insert') out.push(b[op.b]!);
  }
  // Every line of a is either kept or deleted, in order.
  const kept = ops.filter((o) => o.type !== 'insert').map((o) => (o as { a: number }).a);
  expect(kept).toEqual(a.map((_, i) => i));
  return out;
}

describe('diffLines', () => {
  it('turns a into b with a minimal-looking script', () => {
    expect(apply(['a', 'b', 'c'], ['a', 'x', 'c'])).toEqual(['a', 'x', 'c']);
    expect(apply([], ['a'])).toEqual(['a']);
    expect(apply(['a'], [])).toEqual([]);
    const ops = diffLines(['a', 'b', 'c', 'd'], ['a', 'c', 'd', 'e']);
    expect(ops.filter((o) => o.type !== 'equal')).toEqual([
      { type: 'delete', a: 1 },
      { type: 'insert', b: 3 },
    ]);
  });

  it('is correct on random edits', () => {
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 48271) % 2147483647;
      return seed % n;
    };
    for (let round = 0; round < 200; round++) {
      const a = Array.from({ length: rand(30) }, () => String.fromCharCode(97 + rand(6)));
      const b = [...a];
      for (let k = rand(8); k > 0; k--) {
        const op = rand(3);
        if (op === 0 && b.length) b.splice(rand(b.length), 1);
        else if (op === 1) b.splice(rand(b.length + 1), 0, String.fromCharCode(97 + rand(6)));
        else if (b.length) b[rand(b.length)] = 'z';
      }
      expect(apply(a, b)).toEqual(b);
    }
  });
});

describe('pairEdits', () => {
  it('pairs edited lines and leaves unrelated ones alone', () => {
    expect(lineSimilarity('  return a + b;', 'return a + b + c;')).toBeGreaterThan(0.7);
    expect(lineSimilarity('foo()', 'const x = 42')).toBeLessThan(0.3);
    const pairs = pairEdits(
      ['const timeout = 1000;', 'log("start")'],
      ['// new comment', 'const timeout = 5000;', 'log("start", id)'],
    );
    expect(pairs).toEqual([
      [0, 1],
      [1, 2],
    ]);
  });
});

const commit = (n: number, author = 'Ada'): Commit => ({
  sha: `${n}`.padStart(40, '0'),
  author,
  date: `2020-01-0${n + 1}T10:00:00Z`,
  message: `commit ${n}`,
  path: 'app.js',
});

const VERSIONS = [
  'function add(a, b) {\n  return a + b;\n}\n',
  '// math helpers\nfunction add(a, b) {\n  return a + b;\n}\n',
  '// math helpers\nfunction add(a, b) {\n  // fast path\n  return a + b + 0;\n}\n',
  '// math helpers\nfunction sum(a, b) {\n  return a + b + 0;\n}\n',
];

describe('timeline', () => {
  const h = packHistory(
    'app.js',
    VERSIONS.map((text, i) => ({ commit: commit(i, i < 2 ? 'Ada' : 'Linus'), text })),
    { repo: 'example' },
  );
  const t = buildTimeline(h);

  it('packs line texts into a shared table', () => {
    expect(h.table.length).toBeLessThan(VERSIONS.join('').split('\n').length);
    expect(splitLines('a\r\nb\n')).toEqual(['a', 'b']);
    expect(validateHistory(JSON.parse(JSON.stringify(h)))).toEqual(h);
    expect(() => validateHistory({ version: 1, commits: [], table: [], versions: [[3]] })).toThrow(
      HistoryError,
    );
  });

  it('keeps line identity across insertions and edits', () => {
    const ret0 = t.states[0]!.ids[1]!; // "  return a + b;"
    expect(t.states[1]!.ids[2]).toBe(ret0); // shifted down by the new comment
    expect(t.states[1]!.added.size).toBe(1);
    expect(t.states[2]!.modified.has(ret0)).toBe(true); // edited to "+ 0"
    expect(t.states[2]!.added.size).toBe(1); // "// fast path"
    expect(t.states[3]!.removed).toHaveLength(1); // comment removed
  });

  it('tells the life story of a line', () => {
    const fn = t.states[0]!.ids[0]!; // "function add..." renamed to sum in v3
    expect(lineStory(t, fn).map((s) => [s.kind, s.version])).toEqual([
      ['born', 0],
      ['edited', 3],
    ]);
    const fast = t.states[2]!.ids[2]!;
    expect(lineStory(t, fast).map((s) => s.kind)).toEqual(['born', 'deleted']);
    expect(lineAges(t, 3)).toEqual([1, 3, 2, 0]);
  });

  it('summarises the file', () => {
    const s = fileStats(t);
    expect(s.commits).toBe(4);
    expect(s.authors).toEqual([
      { name: 'Ada', commits: 2 },
      { name: 'Linus', commits: 2 },
    ]);
    expect(s.survivors).toBe(3); // function line, return line (both edited) and the closing brace
  });
});

describe('export helpers', () => {
  it('plans frames for the requested length', () => {
    const frames = planFrames({ fps: 30, seconds: 10, from: 0, to: 99 });
    expect(frames.length).toBe(100 * 3 + 45);
    expect(frames[0]!.p).toBe(1);
    expect(frames.at(-1)).toEqual({ version: 99, p: 1, slot: 1 });
  });

  it('splits operator runs so fonts cannot draw them as ligatures', () => {
    const pieces = ligatureSafePieces('a === b => c');
    expect(pieces).toEqual([
      [0, 'a ='],
      [3, '='],
      [4, '= b ='],
      [9, '> c'],
    ]);
    expect(pieces.map(([, t]) => t).join('')).toBe('a === b => c');
    for (const [, t] of pieces) expect(t).not.toMatch(/[=!<>-][=!<>-]/);
    expect(ligatureSafePieces('plain text')).toEqual([[0, 'plain text']]);
  });

  it('highlights whole files and splits tokens per line', () => {
    expect(languageFor('src/App.tsx')).toBe('tsx');
    expect(languageFor('Dockerfile')).toBe('docker');
    expect(languageFor('notes.unknownext')).toBeNull();
    const lines = highlightLines(['/* a', 'b */ const x = 1;'], 'javascript');
    expect(lines).toHaveLength(2);
    expect(lines[1]![0]![0]).toContain('comment');
    expect(lines[1]!.some(([t, s]) => t.includes('keyword') && s === 'const')).toBe(true);
  });
});
