import { diffLines, pairEdits } from './diff';

export interface Commit {
  sha: string;
  author: string;
  /** ISO 8601 */
  date: string;
  message: string;
  /** Path of the file in this commit (it can change across renames). */
  path: string;
}

/** A file's history as captured: compact, JSON-friendly, oldest version first. */
export interface FileHistory {
  version: 1;
  /** Display name, e.g. "src/index.ts" */
  file: string;
  /** e.g. "github.com/owner/repo" or a local folder name */
  repo?: string;
  /** Link template for a commit, with {sha}, e.g. https://github.com/o/r/commit/{sha} */
  commitUrl?: string;
  commits: Commit[];
  /** Distinct line texts. */
  table: string[];
  /** Per commit: the file's lines as indices into `table`. */
  versions: number[][];
  /** The capture stopped at this many commits (older history not included). */
  truncated?: boolean;
}

export interface VersionState {
  /** Stable line ids, in file order. */
  ids: number[];
  /** Line texts, parallel to ids. */
  lines: string[];
  added: Set<number>;
  modified: Set<number>;
  /** Ids present in the previous version and gone in this one. */
  removed: number[];
}

export interface LineLife {
  id: number;
  /** Version index where the line first appeared. */
  born: number;
  /** Version indices where its text changed (after birth). */
  edits: number[];
  /** Version index where it was deleted, if it was. */
  died?: number;
  /** Text at birth and after each edit, parallel to [born, ...edits]. */
  texts: string[];
}

export interface Timeline {
  history: FileHistory;
  states: VersionState[];
  lives: Map<number, LineLife>;
}

export function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

/** Build a compact FileHistory from full texts (oldest first). */
export function packHistory(
  file: string,
  entries: { commit: Commit; text: string }[],
  extra: Partial<Pick<FileHistory, 'repo' | 'commitUrl' | 'truncated'>> = {},
): FileHistory {
  const index = new Map<string, number>();
  const table: string[] = [];
  const versions = entries.map((e) =>
    splitLines(e.text).map((line) => {
      let i = index.get(line);
      if (i === undefined) {
        i = table.length;
        table.push(line);
        index.set(line, i);
      }
      return i;
    }),
  );
  return { version: 1, file, ...extra, commits: entries.map((e) => e.commit), table, versions };
}

export class HistoryError extends Error {
  override name = 'HistoryError';
}

export function validateHistory(data: unknown): FileHistory {
  const h = data as FileHistory;
  if (
    !h ||
    h.version !== 1 ||
    !Array.isArray(h.commits) ||
    !Array.isArray(h.table) ||
    !Array.isArray(h.versions) ||
    h.commits.length !== h.versions.length
  ) {
    throw new HistoryError('This is not a codelapse history file.');
  }
  for (const v of h.versions) {
    if (!Array.isArray(v) || v.some((i) => typeof i !== 'number' || i < 0 || i >= h.table.length)) {
      throw new HistoryError('The history file is damaged (a line points outside the line table).');
    }
  }
  return h;
}

/**
 * Give every line a stable identity across versions: unchanged lines keep their id, edited lines
 * (paired by similarity within a changed block) keep it and are marked modified, new lines get a new
 * id. That is what makes lines slide instead of blinking, and what lets you follow one line.
 */
export function buildTimeline(history: FileHistory): Timeline {
  const states: VersionState[] = [];
  const lives = new Map<number, LineLife>();
  let nextId = 0;
  let prev: VersionState = {
    ids: [],
    lines: [],
    added: new Set(),
    modified: new Set(),
    removed: [],
  };
  history.versions.forEach((version, vi) => {
    const lines = version.map((i) => history.table[i]!);
    const ops = diffLines(prev.lines, lines);
    const ids = new Array<number>(lines.length);
    const added = new Set<number>();
    const modified = new Set<number>();
    const removed: number[] = [];
    // Walk the edit script, pairing each run of deletes with the inserts that follow it.
    let k = 0;
    while (k < ops.length) {
      const op = ops[k]!;
      if (op.type === 'equal') {
        ids[op.b] = prev.ids[op.a]!;
        k++;
        continue;
      }
      const dels: number[] = [];
      const ins: number[] = [];
      while (k < ops.length && ops[k]!.type !== 'equal') {
        const o = ops[k]!;
        if (o.type === 'delete') dels.push(o.a);
        else ins.push(o.b);
        k++;
      }
      const pairs = pairEdits(
        dels.map((a) => prev.lines[a]!),
        ins.map((b) => lines[b]!),
      );
      const pairedDel = new Set<number>();
      const pairedIns = new Set<number>();
      for (const [d, i] of pairs) {
        const id = prev.ids[dels[d]!]!;
        ids[ins[i]!] = id;
        modified.add(id);
        pairedDel.add(d);
        pairedIns.add(i);
        const life = lives.get(id)!;
        life.edits.push(vi);
        life.texts.push(lines[ins[i]!]!);
      }
      dels.forEach((a, d) => {
        if (pairedDel.has(d)) return;
        const id = prev.ids[a]!;
        removed.push(id);
        lives.get(id)!.died = vi;
      });
      ins.forEach((b, i) => {
        if (pairedIns.has(i)) return;
        const id = nextId++;
        ids[b] = id;
        added.add(id);
        lives.set(id, { id, born: vi, edits: [], texts: [lines[b]!] });
      });
    }
    const state: VersionState = { ids, lines, added, modified, removed };
    states.push(state);
    prev = state;
  });
  return { history, states, lives };
}

/** For each line of version v: the version index where its current text was written. */
export function lineAges(t: Timeline, v: number): number[] {
  return t.states[v]!.ids.map((id) => {
    const life = t.lives.get(id)!;
    let last = life.born;
    for (const e of life.edits) if (e <= v) last = e;
    return last;
  });
}

export interface StoryStep {
  version: number;
  kind: 'born' | 'edited' | 'deleted';
  text?: string;
  /** Text before this change (for edits). */
  before?: string;
}

/** The life of one line: when it was written, every edit, and its deletion. */
export function lineStory(t: Timeline, id: number): StoryStep[] {
  const life = t.lives.get(id);
  if (!life) return [];
  const steps: StoryStep[] = [{ version: life.born, kind: 'born', text: life.texts[0] }];
  life.edits.forEach((v, i) =>
    steps.push({ version: v, kind: 'edited', text: life.texts[i + 1], before: life.texts[i] }),
  );
  if (life.died !== undefined)
    steps.push({ version: life.died, kind: 'deleted', before: life.texts.at(-1) });
  return steps;
}

export interface FileStats {
  commits: number;
  authors: { name: string; commits: number }[];
  firstDate: string;
  lastDate: string;
  maxLines: number;
  /** Lines in the latest version that survived since the first version. */
  survivors: number;
}

export function fileStats(t: Timeline): FileStats {
  const byAuthor = new Map<string, number>();
  for (const c of t.history.commits) byAuthor.set(c.author, (byAuthor.get(c.author) ?? 0) + 1);
  const last = t.states.at(-1);
  return {
    commits: t.history.commits.length,
    authors: [...byAuthor]
      .map(([name, commits]) => ({ name, commits }))
      .sort((a, b) => b.commits - a.commits),
    firstDate: t.history.commits[0]?.date ?? '',
    lastDate: t.history.commits.at(-1)?.date ?? '',
    maxLines: Math.max(0, ...t.states.map((s) => s.ids.length)),
    survivors: last ? last.ids.filter((id) => t.lives.get(id)!.born === 0).length : 0,
  };
}
