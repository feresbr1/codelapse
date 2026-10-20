/** An edit that turns `a` into `b`. Indices refer to the original arrays. */
export type Op =
  | { type: 'equal'; a: number; b: number }
  | { type: 'delete'; a: number }
  | { type: 'insert'; b: number };

/**
 * Myers' O(ND) line diff. Common prefix and suffix are trimmed first, which makes the typical
 * "small change in a big file" case linear.
 */
export function diffLines(a: string[], b: string[]): Op[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const ops: Op[] = [];
  for (let i = 0; i < start; i++) ops.push({ type: 'equal', a: i, b: i });
  ops.push(...myers(a, b, start, endA, start, endB));
  for (let i = 0; endA + i < a.length; i++) ops.push({ type: 'equal', a: endA + i, b: endB + i });
  return ops;
}

function myers(a: string[], b: string[], a0: number, a1: number, b0: number, b1: number): Op[] {
  const n = a1 - a0;
  const m = b1 - b0;
  if (n === 0) return Array.from({ length: m }, (_, i) => ({ type: 'insert' as const, b: b0 + i }));
  if (m === 0) return Array.from({ length: n }, (_, i) => ({ type: 'delete' as const, a: a0 + i }));
  const max = n + m;
  const offset = max;
  const v = new Int32Array(2 * max + 2);
  const trace: Int32Array[] = [];
  let found = false;
  for (let d = 0; d <= max && !found; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!)) x = v[offset + k + 1]!;
      else x = v[offset + k - 1]! + 1;
      let y = x - k;
      while (x < n && y < m && a[a0 + x] === b[b0 + y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = true;
        break;
      }
    }
  }
  // Walk the trace backwards to recover the edit script.
  const ops: Op[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const vd = trace[d]!;
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && vd[offset + k - 1]! < vd[offset + k + 1]!)) prevK = k + 1;
    else prevK = k - 1;
    const prevX = vd[offset + prevK]!;
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push({ type: 'equal', a: a0 + x - 1, b: b0 + y - 1 });
      x--;
      y--;
    }
    if (d > 0) {
      if (x === prevX) ops.push({ type: 'insert', b: b0 + y - 1 });
      else ops.push({ type: 'delete', a: a0 + x - 1 });
    }
    x = prevX;
    y = prevY;
  }
  return ops.reverse();
}

/** 0..1 similarity of two lines, on their characters (ignoring surrounding whitespace). */
export function lineSimilarity(x: string, y: string): number {
  const a = x.trim();
  const b = y.trim();
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  // Bigram Dice coefficient: cheap and good at "same line, edited".
  const grams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const g = a.slice(i, i + 2);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  let inter = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const g = b.slice(i, i + 2);
    const n = grams.get(g) ?? 0;
    if (n > 0) {
      grams.set(g, n - 1);
      inter++;
    }
  }
  const total = a.length - 1 + (b.length - 1);
  return total > 0 ? (2 * inter) / total : 0;
}

/**
 * Within a run of deleted lines followed by inserted lines, decide which inserted line is an edit
 * of which deleted line (in order). Returns pairs of [deletedIndex, insertedIndex] into the runs.
 */
export function pairEdits(
  deleted: string[],
  inserted: string[],
  threshold = 0.5,
): [number, number][] {
  const n = deleted.length;
  const m = inserted.length;
  if (!n || !m) return [];
  if (n * m > 40_000) {
    // Huge blocks: pair by position when similar enough, without the quadratic alignment.
    const pairs: [number, number][] = [];
    for (let i = 0; i < Math.min(n, m); i++) {
      if (lineSimilarity(deleted[i]!, inserted[i]!) >= threshold) pairs.push([i, i]);
    }
    return pairs;
  }
  // Monotonic alignment that maximises total similarity (Needleman-Wunsch without gap cost).
  const sim = (i: number, j: number) => {
    const s = lineSimilarity(deleted[i]!, inserted[j]!);
    return s >= threshold ? s : 0;
  };
  const score = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      score[i]![j] = Math.max(
        score[i - 1]![j]!,
        score[i]![j - 1]!,
        score[i - 1]![j - 1]! + sim(i - 1, j - 1),
      );
    }
  }
  const pairs: [number, number][] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const s = sim(i - 1, j - 1);
    if (s > 0 && score[i]![j] === score[i - 1]![j - 1]! + s) {
      pairs.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (score[i]![j] === score[i - 1]![j]) i--;
    else j--;
  }
  return pairs.reverse();
}
