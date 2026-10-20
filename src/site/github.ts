import { HistoryError, packHistory, type Commit, type FileHistory } from '../core/history';

export interface GitHubFile {
  owner: string;
  repo: string;
  /** Branch, tag or sha; may contain slashes, so it is resolved against the API. */
  ref: string;
  path: string;
}

/**
 * Accepts github.com/owner/repo/blob/ref/path (with or without https://), raw.githubusercontent
 * URLs, and owner/repo/blob/ref/path. Returns every possible ref/path split (refs can contain "/").
 */
export function parseGitHubUrl(input: string): GitHubFile[] {
  let s = input.trim().replace(/[?#].*$/, '');
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  let parts: string[];
  if (s.startsWith('raw.githubusercontent.com/')) {
    parts = s.split('/').slice(1); // owner/repo/ref.../path
    if (parts.length < 4) return [];
    parts = [parts[0]!, parts[1]!, 'blob', ...parts.slice(2)];
  } else {
    if (s.startsWith('github.com/')) s = s.slice('github.com/'.length);
    parts = s.split('/').filter(Boolean);
  }
  if (parts.length < 5 || (parts[2] !== 'blob' && parts[2] !== 'tree')) return [];
  const [owner, repo, , ...rest] = parts;
  const out: GitHubFile[] = [];
  for (let i = 1; i < rest.length; i++) {
    out.push({
      owner: owner!,
      repo: repo!.replace(/\.git$/, ''),
      ref: rest.slice(0, i).map(decodeURIComponent).join('/'),
      path: rest.slice(i).map(decodeURIComponent).join('/'),
    });
  }
  return out;
}

export class RateLimitError extends HistoryError {
  constructor(public resetAt: Date | null) {
    super(
      `GitHub's limit for anonymous requests (60 per hour) is used up${resetAt ? ` until ${resetAt.toLocaleTimeString()}` : ''}. Add a token, or use the CLI on a local clone.`,
    );
  }
}

export interface LoadOptions {
  max?: number;
  token?: string;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
  fetchImpl?: typeof fetch;
}

interface ApiCommit {
  sha: string;
  commit: {
    author: { name: string; date: string } | null;
    committer: { date: string } | null;
    message: string;
  };
}

async function api(url: string, opts: LoadOptions): Promise<Response> {
  const f = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = { accept: 'application/vnd.github+json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await f(url, { headers, signal: opts.signal });
  if (res.status === 403 || res.status === 429) {
    const body = await res.clone().text();
    if (res.headers.get('x-ratelimit-remaining') === '0' || /rate limit/i.test(body)) {
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      throw new RateLimitError(reset ? new Date(reset * 1000) : null);
    }
  }
  return res;
}

/** Load a public (or token-accessible) file's history from GitHub, oldest version first. */
export async function loadGitHubHistory(
  candidates: GitHubFile[],
  opts: LoadOptions = {},
): Promise<FileHistory> {
  if (!candidates.length) {
    throw new HistoryError(
      'Paste a link to a file on GitHub, like https://github.com/owner/repo/blob/main/src/index.ts',
    );
  }
  const max = opts.max ?? 150;
  let file: GitHubFile | null = null;
  let list: ApiCommit[] = [];
  // Find which ref/path split exists (refs with slashes are rare, so this is usually one call).
  for (const c of candidates.slice(0, 4)) {
    const url = `https://api.github.com/repos/${c.owner}/${c.repo}/commits?path=${encodeURIComponent(c.path)}&sha=${encodeURIComponent(c.ref)}&per_page=${Math.min(100, max)}`;
    const res = await api(url, opts);
    if (res.status === 404 || res.status === 422 || res.status === 409) continue;
    if (!res.ok) throw new HistoryError(`GitHub answered ${res.status} for ${c.owner}/${c.repo}.`);
    const page = (await res.json()) as ApiCommit[];
    if (page.length) {
      file = c;
      list = page;
      break;
    }
  }
  if (!file) {
    throw new HistoryError(
      'No history found. Check the link (it should point to a file), or the repository is private: add a token or use the CLI.',
    );
  }
  for (let page = 2; list.length < max && list.length % 100 === 0; page++) {
    const url = `https://api.github.com/repos/${file.owner}/${file.repo}/commits?path=${encodeURIComponent(file.path)}&sha=${encodeURIComponent(file.ref)}&per_page=100&page=${page}`;
    const res = await api(url, opts);
    if (!res.ok) break;
    const more = (await res.json()) as ApiCommit[];
    if (!more.length) break;
    list.push(...more);
  }
  const truncated = list.length > max;
  const commits: Commit[] = list
    .slice(0, max)
    .reverse()
    .map((c) => ({
      sha: c.sha,
      author: c.commit.author?.name ?? 'unknown',
      date: c.commit.author?.date ?? c.commit.committer?.date ?? '',
      message: c.commit.message.split('\n')[0] ?? '',
      path: file!.path,
    }));

  // File contents come from raw.githubusercontent.com, which does not count against the API limit.
  const texts: (string | null)[] = new Array(commits.length).fill(null);
  let done = 0;
  let next = 0;
  const f = opts.fetchImpl ?? fetch;
  const worker = async () => {
    while (next < commits.length) {
      const i = next++;
      const c = commits[i]!;
      const url = `https://raw.githubusercontent.com/${file!.owner}/${file!.repo}/${c.sha}/${file!.path.split('/').map(encodeURIComponent).join('/')}`;
      const res = await f(url, {
        signal: opts.signal,
        headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
      });
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.includes(0))
          throw new HistoryError(`${file!.path} is a binary file; codelapse shows text files.`);
        texts[i] = new TextDecoder().decode(buf);
      }
      opts.onProgress?.(++done, commits.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  const entries = commits.flatMap((commit, i) =>
    texts[i] === null ? [] : [{ commit, text: texts[i]! }],
  );
  if (!entries.length) throw new HistoryError('Could not download any version of this file.');
  return packHistory(file.path, entries, {
    repo: `github.com/${file.owner}/${file.repo}`,
    commitUrl: `https://github.com/${file.owner}/${file.repo}/commit/{sha}`,
    ...(truncated ? { truncated: true } : {}),
  });
}

/** The shareable in-app route for a file. */
export function routeFor(f: GitHubFile): string {
  return `#/gh/${f.owner}/${f.repo}/${encodeURIComponent(f.ref)}/${f.path.split('/').map(encodeURIComponent).join('/')}`;
}

export function fromRoute(route: string): GitHubFile[] {
  const m = /^\/gh\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(route);
  if (!m) return [];
  return [
    {
      owner: m[1]!,
      repo: m[2]!,
      ref: decodeURIComponent(m[3]!),
      path: m[4]!.split('/').map(decodeURIComponent).join('/'),
    },
  ];
}
