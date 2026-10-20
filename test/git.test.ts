import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { main, splitLine } from '../src/cli/main';
import { buildTimeline, lineStory } from '../src/core/history';
import { parseLog, readFileHistory, webUrls } from '../src/node/git';
import { historyToHtml, scriptSafeJson } from '../src/node/html';
import {
  loadGitHubHistory,
  parseGitHubUrl,
  RateLimitError,
  routeFor,
  fromRoute,
} from '../src/site/github';

const work = mkdtempSync(join(tmpdir(), 'codelapse-test-'));
const repo = join(work, 'repo');
afterAll(() => rmSync(work, { recursive: true, force: true }));

function g(...args: string[]) {
  execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
}
function commit(file: string, text: string, message: string, author = 'Ada Lovelace') {
  writeFileSync(join(repo, file), text);
  g('add', '-A');
  execFileSync(
    'git',
    ['-c', `user.name=${author}`, '-c', 'user.email=a@example.test', 'commit', '-q', '-m', message],
    {
      cwd: repo,
      stdio: 'pipe',
    },
  );
}

beforeAll(() => {
  mkdirSync(repo);
  g('init', '-q', '-b', 'main');
  g('remote', 'add', 'origin', 'git@github.com:example/demo.git');
  commit('calc.js', 'function add(a, b) {\n  return a + b;\n}\n', 'Add add()');
  commit(
    'calc.js',
    'function add(a, b) {\n  return a + b;\n}\n\nfunction sub(a, b) {\n  return a - b;\n}\n',
    'Add sub()',
    'Linus',
  );
  mkdirSync(join(repo, 'src'));
  g('mv', 'calc.js', 'src/calc.js');
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Grace',
      '-c',
      'user.email=g@example.test',
      'commit',
      '-q',
      '-m',
      'Move to src/',
    ],
    {
      cwd: repo,
      stdio: 'pipe',
    },
  );
  commit(
    'src/calc.js',
    'function add(a, b) {\n  return a + b + 0;\n}\n\nfunction sub(a, b) {\n  return a - b;\n}\n',
    'Tweak add()',
  );
  writeFileSync(join(repo, 'blob.bin'), Buffer.from([0, 1, 2, 3]));
  commit('notes.txt', 'hello\n', 'Add notes and a binary file');
});

describe('git history', () => {
  it('reads every version, following the rename', async () => {
    const h = await readFileHistory('src/calc.js', repo);
    expect(h.file).toBe('src/calc.js');
    expect(h.repo).toBe('github.com/example/demo');
    expect(h.commitUrl).toBe('https://github.com/example/demo/commit/{sha}');
    expect(h.commits.map((c) => c.message)).toEqual([
      'Add add()',
      'Add sub()',
      'Move to src/',
      'Tweak add()',
    ]);
    expect(h.commits.map((c) => c.path)).toEqual([
      'calc.js',
      'calc.js',
      'src/calc.js',
      'src/calc.js',
    ]);
    expect(h.commits[1]!.author).toBe('Linus');
    const t = buildTimeline(h);
    const ret = t.states[0]!.ids[1]!;
    expect(lineStory(t, ret).map((s) => [s.kind, s.version])).toEqual([
      ['born', 0],
      ['edited', 3],
    ]);
  });

  it('limits to the most recent commits', async () => {
    const h = await readFileHistory('src/calc.js', repo, { max: 2 });
    expect(h.commits.map((c) => c.message)).toEqual(['Move to src/', 'Tweak add()']);
    expect(h.truncated).toBe(true);
  });

  it('explains problems', async () => {
    await expect(readFileHistory('nope.js', repo)).rejects.toThrow(/No commits touch nope.js/);
    await expect(readFileHistory('blob.bin', repo)).rejects.toThrow(/binary/);
    await expect(readFileHistory('src', repo)).rejects.toThrow(/is a folder/);
    await expect(readFileHistory('x.js', work)).rejects.toThrow(/not inside a git repository/);
  });

  it('parses log output and remote URLs', () => {
    const RS = String.fromCharCode(0x1e);
    const US = String.fromCharCode(0x1f);
    const TAB = String.fromCharCode(9);
    const log =
      `${RS}aaa${US}Ada${US}2020-01-02T00:00:00Z${US}Rename${'\n'}${'\n'}:100644 100644 1111 2222 R090${TAB}old.js${TAB}new.js${'\n'}` +
      `${RS}bbb${US}Ada${US}2020-01-01T00:00:00Z${US}Delete${'\n'}${'\n'}:100644 000000 3333 0000 D${TAB}new.js${'\n'}`;
    expect(parseLog(log)).toEqual([
      {
        sha: 'aaa',
        author: 'Ada',
        date: '2020-01-02T00:00:00Z',
        message: 'Rename',
        path: 'new.js',
        blob: '2222',
      },
    ]);
    expect(webUrls('https://gitlab.com/group/sub/proj.git')).toEqual({
      repo: 'gitlab.com/group/sub/proj',
      commitUrl: 'https://gitlab.com/group/sub/proj/-/commit/{sha}',
    });
    expect(webUrls('ssh://git@github.com/a/b.git')?.commitUrl).toBe(
      'https://github.com/a/b/commit/{sha}',
    );
    expect(webUrls('https://git.example.com/team/app')).toEqual({
      repo: 'git.example.com/team/app',
    });
  });
});

describe('cli', () => {
  async function cli(argv: string[]) {
    let out = '';
    let err = '';
    const opened: string[] = [];
    const code = await main(argv, {
      out: (s) => (out += s),
      err: (s) => (err += s),
      cwd: repo,
      open: (f) => opened.push(f),
    });
    return { code, out, err, opened };
  }

  it('writes a self-contained player and opens it', async () => {
    const r = await cli([
      'src/calc.js:2',
      '-o',
      join(work, 'calc.html'),
      '--json',
      join(work, 'calc.json'),
    ]);
    expect(r.code).toBe(0);
    expect(r.err).toMatch(/src\/calc\.js · 4 commits · 3 authors/);
    expect(r.opened).toEqual([join(work, 'calc.html')]);
    const html = readFileSync(join(work, 'calc.html'), 'utf8');
    expect(html).toContain('<script id="codelapse-data" type="application/json">');
    expect(html).toContain('"line":2');
    expect(JSON.parse(readFileSync(join(work, 'calc.json'), 'utf8')).commits).toHaveLength(4);
  });

  it('respects --no-open and validates input', async () => {
    const r = await cli(['src/calc.js', '--no-open']);
    expect(r.code).toBe(0);
    expect(r.opened).toEqual([]);
    expect(existsSync(r.err.match(/wrote (.+\.html)/)![1]!)).toBe(true);
    expect((await cli(['src/calc.js:99', '--no-open'])).err).toMatch(/outside the file/);
    expect((await cli(['src/calc.js', '-n', '0'])).code).toBe(2);
    expect((await cli(['--bogus'])).err).toMatch(/Unknown option/);
    expect((await cli([])).code).toBe(2);
    expect((await cli(['--version'])).out).toMatch(/\d+\.\d+\.\d+/);
  });

  it('splits file:line but not Windows drive letters', () => {
    expect(splitLine('src/a.ts:42')).toEqual({ file: 'src/a.ts', line: 42 });
    expect(splitLine('C:/x/a.ts')).toEqual({ file: 'C:/x/a.ts' });
    expect(splitLine('a.ts')).toEqual({ file: 'a.ts' });
  });

  it('cannot be broken out of by file content', () => {
    const json = scriptSafeJson({ s: '</script><script>alert(1)</script>' });
    expect(json).not.toContain('</script');
    expect(JSON.parse(json).s).toBe('</script><script>alert(1)</script>');
    const html = historyToHtml(
      { version: 1, file: '<b>x</b>.js', commits: [], table: [], versions: [] },
      { viewerJs: 'console.log(1)' },
    );
    expect(html).toContain('<title>&lt;b&gt;x&lt;/b&gt;.js · codelapse</title>');
  });
});

describe('GitHub loader', () => {
  it('parses file links', () => {
    expect(parseGitHubUrl('https://github.com/o/r/blob/main/src/a b.ts')[0]).toEqual({
      owner: 'o',
      repo: 'r',
      ref: 'main',
      path: 'src/a b.ts',
    });
    expect(
      parseGitHubUrl('github.com/o/r/blob/feature/x/lib/y.js').map((c) => `${c.ref}|${c.path}`),
    ).toEqual(['feature|x/lib/y.js', 'feature/x|lib/y.js', 'feature/x/lib|y.js']);
    expect(parseGitHubUrl('https://raw.githubusercontent.com/o/r/main/a.js')[0]?.path).toBe('a.js');
    expect(parseGitHubUrl('https://github.com/o/r')).toEqual([]);
    const f = { owner: 'o', repo: 'r', ref: 'release/1.0', path: 'src/a.ts' };
    expect(fromRoute(routeFor(f).slice(1))).toEqual([f]);
  });

  it('loads commits and contents, oldest first, resolving refs with slashes', async () => {
    const calls: string[] = [];
    const fake = async (url: string | URL) => {
      const u = String(url);
      calls.push(u);
      if (u.includes('api.github.com') && u.includes('sha=feature&'))
        return new Response('[]', { status: 200 });
      if (u.includes('api.github.com')) {
        return Response.json([
          {
            sha: 'c2',
            commit: {
              author: { name: 'B', date: '2020-02-01T00:00:00Z' },
              committer: null,
              message: 'Second\n\nbody',
            },
          },
          {
            sha: 'c1',
            commit: {
              author: { name: 'A', date: '2020-01-01T00:00:00Z' },
              committer: null,
              message: 'First',
            },
          },
        ]);
      }
      if (u.includes('/c1/')) return new Response('one\n');
      if (u.includes('/c2/')) return new Response('one\ntwo\n');
      return new Response('', { status: 404 });
    };
    const h = await loadGitHubHistory(parseGitHubUrl('github.com/o/r/blob/feature/x/a.txt'), {
      fetchImpl: fake as typeof fetch,
    });
    expect(h.file).toBe('a.txt');
    expect(h.commits.map((c) => [c.sha, c.message])).toEqual([
      ['c1', 'First'],
      ['c2', 'Second'],
    ]);
    expect(h.versions.map((v) => v.length)).toEqual([1, 2]);
    expect(calls.some((c) => c.startsWith('https://raw.githubusercontent.com/o/r/c1/a.txt'))).toBe(
      true,
    );
  });

  it('reports the anonymous rate limit clearly', async () => {
    const fake = async () =>
      new Response('{}', {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' },
      });
    await expect(
      loadGitHubHistory(parseGitHubUrl('github.com/o/r/blob/main/a.js'), {
        fetchImpl: fake as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});
