import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { buildTimeline, fileStats, HistoryError } from '../core/history';
import { readFileHistory } from '../node/git';
import { historyToHtml } from '../node/html';

declare const __VERSION__: string | undefined;
export const VERSION = typeof __VERSION__ === 'string' ? __VERSION__ : '0.0.0-dev';

export interface Io {
  out: (s: string) => void;
  err: (s: string) => void;
  cwd: string;
  open?: (file: string) => void;
}

const HELP = `codelapse ${VERSION}: time-lapse any file's git history.

Usage
  codelapse <file>[:line] [options]

Opens an interactive player in your browser: watch the file evolve commit by commit, click any
line to see its life story, export the time-lapse as an MP4 or GIF.

Options
  -n, --max <count>    Most recent commits to include (default 300)
  --rev <revision>     Start from this branch, tag or commit (default HEAD)
  -o, --out <file>     Write the player to this HTML file (default: a temporary file)
  --json <file>        Also write the raw history as JSON (open it on the website)
  --no-open            Don't open the browser
  -h, --help           Show this help
  -v, --version        Show the version

Examples
  codelapse src/index.ts
  codelapse README.md:12          open with line 12's history selected
  codelapse lib/router.js -n 1000 -o router-history.html

Works with any git repository on your machine: private, self-hosted, any host. Nothing is uploaded.
Docs: https://github.com/feresbr1/codelapse
`;

export class UsageError extends Error {
  override name = 'UsageError';
}

export function parseArgs(argv: string[]) {
  const flags = new Map<string, string | true>();
  const positionals: string[] = [];
  const valued = new Set(['-n', '--max', '--rev', '-o', '--out', '--json']);
  const bools = new Set(['--no-open', '-h', '--help', '-v', '--version']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const name = eq > 0 ? arg.slice(0, eq) : arg;
    if (valued.has(name)) {
      const value = eq > 0 ? arg.slice(eq + 1) : argv[++i];
      if (value === undefined) throw new UsageError(`${name} needs a value.`);
      flags.set(name, value);
    } else if (bools.has(name)) flags.set(name, true);
    else if (arg.startsWith('-') && arg.length > 1) throw new UsageError(`Unknown option: ${arg}`);
    else positionals.push(arg);
  }
  return { flags, positionals };
}

/** "src/a.ts:42" -> { file: "src/a.ts", line: 42 } (Windows drive letters are left alone). */
export function splitLine(arg: string): { file: string; line?: number } {
  const m = /^(.+?):(\d+)$/.exec(arg);
  if (m && !/^[A-Za-z]$/.test(m[1]!)) return { file: m[1]!, line: Number(m[2]) };
  return { file: arg };
}

/** Relative when inside the working folder, absolute otherwise. */
function shown(cwd: string, path: string): string {
  const rel = relative(cwd, path);
  return rel && !rel.startsWith('..') ? rel : path;
}

function openFile(file: string): void {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '""', file]]
      : process.platform === 'darwin'
        ? ['open', [file]]
        : ['xdg-open', [file]];
  spawn(cmd, args, { stdio: 'ignore', detached: true })
    .on('error', () => {})
    .unref();
}

export async function main(argv: string[], io: Io): Promise<number> {
  try {
    const { flags, positionals } = parseArgs(argv);
    if (flags.has('-v') || flags.has('--version')) {
      io.out(`${VERSION}\n`);
      return 0;
    }
    if (flags.has('-h') || flags.has('--help')) {
      io.out(HELP);
      return 0;
    }
    if (positionals.length === 0) {
      io.out(HELP);
      return 2;
    }
    if (positionals.length > 1) throw new UsageError('Give one file at a time.');
    const { file, line } = splitLine(positionals[0]!);
    const maxFlag = flags.get('-n') ?? flags.get('--max');
    const max = typeof maxFlag === 'string' ? Number(maxFlag) : 300;
    if (!Number.isInteger(max) || max < 1)
      throw new UsageError('--max must be a whole number ≥ 1.');
    const rev = flags.get('--rev');

    const started = Date.now();
    const history = await readFileHistory(file, io.cwd, {
      max,
      rev: typeof rev === 'string' ? rev : undefined,
    });
    const stats = fileStats(buildTimeline(history));
    io.err(
      `codelapse: ${history.file} · ${stats.commits} ${stats.commits === 1 ? 'commit' : 'commits'}${history.truncated ? ` (most recent ${max}; use -n for more)` : ''} · ${stats.authors.length} ${stats.authors.length === 1 ? 'author' : 'authors'} · read in ${Date.now() - started} ms\n`,
    );
    if (line !== undefined) {
      const lines = history.versions.at(-1)!.length;
      if (line < 1 || line > lines)
        throw new UsageError(`Line ${line} is outside the file (it has ${lines} lines).`);
    }

    const json = flags.get('--json');
    if (typeof json === 'string') {
      const path = resolve(io.cwd, json);
      writeFileSync(path, JSON.stringify(history));
      io.err(`codelapse: wrote ${shown(io.cwd, path)}\n`);
    }
    const outFlag = flags.get('-o') ?? flags.get('--out');
    let out: string;
    if (typeof outFlag === 'string') out = resolve(io.cwd, outFlag);
    else {
      const dir = join(tmpdir(), 'codelapse');
      mkdirSync(dir, { recursive: true });
      out = join(dir, `${history.file.replace(/[^\w.-]+/g, '_')}-${Date.now()}.html`);
    }
    writeFileSync(out, historyToHtml(history, { line }));
    io.err(`codelapse: wrote ${out}\n`);
    if (!flags.has('--no-open')) (io.open ?? openFile)(out);
    return 0;
  } catch (err) {
    if (err instanceof UsageError) {
      io.err(`codelapse: ${err.message}\nRun "codelapse --help" for usage.\n`);
      return 2;
    }
    if (err instanceof HistoryError) {
      io.err(`codelapse: ${err.message}\n`);
      return 2;
    }
    io.err(`codelapse: ${(err as Error).message}\n`);
    return 1;
  }
}
