// Record the website's demo histories from real public repositories (all MIT licensed), using the
// CLI itself. Usage: npm run build:cli && npm run demos
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const DEMOS = [
  {
    id: 'express-response',
    repo: 'expressjs/express',
    file: 'lib/response.js',
    max: 150,
    title: "Express's response object",
    license: 'MIT',
  },
  {
    id: 'preact-diff',
    repo: 'preactjs/preact',
    file: 'src/diff/index.js',
    max: 150,
    title: "Preact's diffing algorithm",
    license: 'MIT',
  },
  {
    id: 'chalk-index',
    repo: 'chalk/chalk',
    file: 'source/index.js',
    max: 150,
    title: 'Chalk, followed across a rename',
    license: 'MIT',
  },
];

const cli = resolve('dist/cli/codelapse.mjs');
const work = join(tmpdir(), 'codelapse-demos');
mkdirSync(work, { recursive: true });
mkdirSync('public/demos', { recursive: true });
const index = [];
for (const d of DEMOS) {
  const dir = join(work, d.repo.replace('/', '__'));
  if (!existsSync(dir)) {
    execFileSync(
      'git',
      ['clone', '-q', '--filter=blob:none', `https://github.com/${d.repo}.git`, dir],
      { stdio: 'inherit' },
    );
  } else {
    execFileSync('git', ['-C', dir, 'pull', '-q', '--ff-only'], { stdio: 'inherit' });
  }
  const out = resolve('public/demos', `${d.id}.json`);
  execFileSync(
    process.execPath,
    [
      cli,
      d.file,
      '-n',
      String(d.max),
      '--json',
      out,
      '-o',
      join(work, `${d.id}.html`),
      '--no-open',
    ],
    {
      cwd: dir,
      stdio: 'inherit',
    },
  );
  const h = JSON.parse(readFileSync(out, 'utf8'));
  index.push({
    id: d.id,
    title: d.title,
    repo: `github.com/${d.repo}`,
    file: d.file,
    license: d.license,
    commits: h.commits.length,
    first: h.commits[0].date,
    last: h.commits.at(-1).date,
    lines: h.versions.at(-1).length,
  });
}
writeFileSync('src/site/demos.json', JSON.stringify(index, null, 2) + '\n');
console.log(index);
