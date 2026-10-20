import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { HistoryError, packHistory, type Commit, type FileHistory } from '../core/history';

function git(args: string[], cwd: string, input?: string): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const out: Buffer[] = [];
    let err = '';
    child.stdout.on('data', (d: Buffer) => out.push(d));
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('error', (e: NodeJS.ErrnoException) =>
      reject(e.code === 'ENOENT' ? new HistoryError('git is not installed or not on PATH.') : e),
    );
    child.on('close', (code) => {
      if (code === 0) resolvePromise(Buffer.concat(out));
      else reject(new HistoryError(err.trim() || `git ${args[0]} failed (exit ${code})`));
    });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

/** https URL of the repository and a commit link template, from the origin remote. */
export function webUrls(remote: string): { repo: string; commitUrl?: string } | null {
  const m =
    /^(?:git@|ssh:\/\/git@)([^:/]+)[:/](.+?)(?:\.git)?\/?$/.exec(remote) ??
    /^https?:\/\/(?:[^@/]+@)?([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(remote);
  if (!m) return null;
  const host = m[1]!.toLowerCase();
  const path = m[2]!;
  const base = `https://${host}/${path}`;
  if (host.includes('github'))
    return { repo: `${host}/${path}`, commitUrl: `${base}/commit/{sha}` };
  if (host.includes('gitlab'))
    return { repo: `${host}/${path}`, commitUrl: `${base}/-/commit/{sha}` };
  if (host.includes('bitbucket'))
    return { repo: `${host}/${path}`, commitUrl: `${base}/commits/{sha}` };
  if (host.includes('codeberg') || host.includes('gitea')) {
    return { repo: `${host}/${path}`, commitUrl: `${base}/commit/{sha}` };
  }
  return { repo: `${host}/${path}` };
}

const RS = String.fromCharCode(0x1e);
const US = String.fromCharCode(0x1f);
const NEWLINE = String.fromCharCode(10);
const TAB = String.fromCharCode(9);

export interface LoggedCommit extends Commit {
  /** Blob id of the file in this commit (from --raw). */
  blob?: string;
}

/**
 * Parse `git log --follow --raw --no-abbrev` output with RS/US separated headers. Raw lines look
 * like ":100644 100644 <old> <new> M<TAB>path" or ":... R087<TAB>old<TAB>new".
 */
export function parseLog(text: string): LoggedCommit[] {
  const commits: LoggedCommit[] = [];
  for (const record of text.split(RS)) {
    if (!record.trim()) continue;
    const [header, ...rest] = record.split(NEWLINE);
    const [sha, author, date, ...subject] = header!.split(US);
    const raw = rest
      .map((l) => l.trim())
      .filter((l) => l.startsWith(':'))
      .at(-1);
    if (!sha || !raw) continue;
    const [meta = '', ...paths] = raw.split(TAB);
    const fields = meta.slice(1).split(' ');
    const status = fields[4] ?? '';
    if (status.startsWith('D')) continue; // the file was deleted in this commit
    const path = paths.at(-1);
    if (!path) continue;
    commits.push({
      sha,
      author: author ?? '',
      date: date ?? '',
      message: subject.join(US),
      path,
      blob: fields[3],
    });
  }
  return commits;
}

/** Read many blobs through one `git cat-file --batch` process. */
async function readBlobs(root: string, specs: string[]): Promise<(Buffer | null)[]> {
  const out = await git(['cat-file', '--batch'], root, specs.map((s) => `${s}\n`).join(''));
  const blobs: (Buffer | null)[] = [];
  let pos = 0;
  for (let i = 0; i < specs.length; i++) {
    const nl = out.indexOf(10, pos);
    if (nl === -1) break;
    const header = out.subarray(pos, nl).toString();
    pos = nl + 1;
    const m = /^\S+ (\w+) (\d+)$/.exec(header);
    if (!m) {
      blobs.push(null); // "<spec> missing" or ambiguous
      continue;
    }
    const size = Number(m[2]);
    blobs.push(m[1] === 'blob' ? out.subarray(pos, pos + size) : null);
    pos += size + 1; // content + trailing newline
  }
  return blobs;
}

/**
 * In a partial ("blobless") clone, git fetches each missing blob on demand: one network round trip
 * per version. Fetch them all in one request first.
 */
async function prefetchIfPartial(root: string, oids: string[]): Promise<void> {
  let promisor: string;
  try {
    promisor = (await git(['config', '--get', 'remote.origin.promisor'], root)).toString().trim();
  } catch {
    return; // not a partial clone
  }
  if (promisor !== 'true') return;
  const wanted = oids.filter((o) => /^[0-9a-f]{40,64}$/.test(o));
  if (!wanted.length) return;
  try {
    await git(
      [
        '-c',
        'fetch.negotiationAlgorithm=noop',
        'fetch',
        '--no-tags',
        '--no-write-fetch-head',
        '--recurse-submodules=no',
        '--filter=blob:none',
        '--stdin',
        'origin',
      ],
      root,
      wanted.map((o) => o + NEWLINE).join(''),
    );
  } catch {
    /* fall back to on-demand fetching */
  }
}

export interface ReadOptions {
  /** Most recent commits to include (default 300). */
  max?: number;
  /** Start from this revision (default HEAD). */
  rev?: string;
}

/** The history of one file in a local git repository, following renames. */
export async function readFileHistory(
  file: string,
  cwd: string,
  opts: ReadOptions = {},
): Promise<FileHistory> {
  const max = opts.max ?? 300;
  const rev = opts.rev ?? 'HEAD';
  const abs = resolve(cwd, file);
  const dir = existsSync(abs) && statSync(abs).isDirectory() ? abs : dirname(abs);
  if (!existsSync(dir)) throw new HistoryError(`Folder not found: ${dirname(file)}`);
  if (existsSync(abs) && statSync(abs).isDirectory())
    throw new HistoryError(`${file} is a folder. Pass a file.`);
  let root: string;
  try {
    root = (await git(['rev-parse', '--show-toplevel'], dir)).toString().trim();
  } catch {
    throw new HistoryError(`${file} is not inside a git repository.`);
  }
  const rel = relative(root, abs).split('\\').join('/');
  const log = (
    await git(
      [
        'log',
        '--follow',
        '--raw',
        '--no-abbrev',
        '-M',
        `-n${max + 1}`,
        `--format=${RS}%H${US}%an${US}%aI${US}%s`,
        rev,
        '--',
        rel,
      ],
      root,
    )
  ).toString('utf8');
  let commits = parseLog(log);
  if (commits.length === 0) {
    throw new HistoryError(`No commits touch ${rel}. Is it committed (git add + git commit)?`);
  }
  const truncated = commits.length > max;
  commits = commits.slice(0, max).reverse(); // oldest first
  const specs = commits.map((c) => c.blob ?? `${c.sha}:${c.path}`);
  await prefetchIfPartial(root, specs);
  const blobs = await readBlobs(root, specs);
  const entries: { commit: Commit; text: string }[] = [];
  commits.forEach(({ blob: _blob, ...commit }, i) => {
    const blob = blobs[i];
    if (!blob) return;
    if (blob.includes(0))
      throw new HistoryError(`${rel} is a binary file; codelapse shows text files.`);
    entries.push({ commit, text: blob.toString('utf8') });
  });
  let urls: { repo: string; commitUrl?: string } | null = null;
  try {
    urls = webUrls((await git(['remote', 'get-url', 'origin'], root)).toString().trim());
  } catch {
    /* no origin remote */
  }
  return packHistory(rel, entries, {
    repo: urls?.repo ?? basename(root),
    ...(urls?.commitUrl ? { commitUrl: urls.commitUrl } : {}),
    ...(truncated ? { truncated: true } : {}),
  });
}
