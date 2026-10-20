import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
});
test.afterEach(() => expect(errors).toEqual([]));

async function commitNumber(page: Page): Promise<number> {
  return Number(await page.locator('.cl-pos b').textContent());
}

test('landing explains the product and lists real demos', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Watch any file');
  await expect(page.locator('.demo')).toHaveCount(3);
  await page.locator('.demo', { hasText: 'Chalk' }).click();
  await expect(page).toHaveURL(/#\/demo\/chalk-index$/);
  await expect(page.getByTestId('commit')).toBeVisible();
});

test('player: step, jump, play, heatmap and the life of a line', async ({ page }) => {
  await page.goto('./#/demo/chalk-index');
  await expect(page.getByTestId('code')).toBeVisible();
  const last = await commitNumber(page);
  expect(last).toBe(97);
  await page.getByRole('button', { name: 'Previous commit' }).click();
  await expect(page.locator('.cl-pos b')).toHaveText(String(last - 1));
  await page.keyboard.press('Home');
  await expect(page.locator('.cl-pos b')).toHaveText('1');
  await expect(page.getByTestId('commit')).toContainText('2013');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.cl-pos b')).toHaveText('2');
  await page.getByRole('button', { name: 'Play' }).click();
  await expect.poll(() => commitNumber(page), { timeout: 5000 }).toBeGreaterThan(2);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.keyboard.press('End');
  await page.getByLabel('Age heatmap').check();
  await expect(page.locator('.cl-gutter[style*="inset"]').first()).toBeVisible();

  await page.locator('.cl-line', { hasText: 'Object.setPrototypeOf' }).first().click();
  const story = page.getByTestId('story');
  await expect(story).toContainText('Life of this line');
  await expect(story.locator('li').first()).toContainText('born');
  await story.locator('li button').first().click();
  await expect(page.locator('.cl-pos b')).not.toHaveText('97');
});

test('plays a GitHub file from its link (API mocked)', async ({ page }) => {
  await page.route('https://api.github.com/**', (route) =>
    route.fulfill({
      json: [
        {
          sha: 'b'.repeat(40),
          commit: {
            author: { name: 'Grace', date: '2021-05-01T00:00:00Z' },
            committer: null,
            message: 'Handle zero',
          },
        },
        {
          sha: 'a'.repeat(40),
          commit: {
            author: { name: 'Ada', date: '2020-01-01T00:00:00Z' },
            committer: null,
            message: 'Initial divide',
          },
        },
      ],
    }),
  );
  await page.route('https://raw.githubusercontent.com/**', (route) => {
    const v1 = 'export function divide(a, b) {\n  return a / b;\n}\n';
    const v2 =
      'export function divide(a, b) {\n  if (b === 0) throw new Error("zero");\n  return a / b;\n}\n';
    route.fulfill({ body: route.request().url().includes('a'.repeat(40)) ? v1 : v2 });
  });
  await page.goto('./');
  await page.getByLabel('GitHub file URL').fill('not a link');
  await page.getByRole('button', { name: 'Play history' }).click();
  await expect(page.getByRole('alert')).toContainText('Paste a link to a file on GitHub');
  await page
    .getByLabel('GitHub file URL')
    .fill('https://github.com/acme/math/blob/main/src/divide.js');
  await page.getByRole('button', { name: 'Play history' }).click();
  await expect(page).toHaveURL(/#\/gh\/acme\/math\/main\/src\/divide\.js$/);
  await expect(page.getByTestId('commit')).toContainText('Handle zero');
  await expect(page.locator('.cl-line.added')).toContainText('throw new Error');
  await expect(page.locator('.cl-title')).toContainText('github.com/acme/math');
});

test('explains the GitHub rate limit and offers a token', async ({ page }) => {
  await page.route('https://api.github.com/**', (route) =>
    route.fulfill({
      status: 403,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'x-ratelimit-remaining, x-ratelimit-reset',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1900000000',
      },
      body: '{"message":"API rate limit exceeded for 1.2.3.4."}',
    }),
  );
  await page.goto('./#/gh/acme/math/main/src/divide.js');
  await expect(page.getByRole('alert')).toContainText('60 per hour');
  await expect(page.getByLabel(/GitHub token/)).toBeVisible();
});

test('exports a real time-lapse file', async ({ page }) => {
  await page.goto('./#/demo/chalk-index');
  await page.getByRole('button', { name: 'Export video / GIF' }).click();
  const run = page.getByTestId('export-run');
  await expect(run).toBeEnabled({ timeout: 15000 });
  const form = page.locator('.cl-form select');
  await form.nth(1).selectOption({ label: 'Last 20' });
  await form.nth(2).selectOption('8');
  const format = await form.nth(0).inputValue();
  await run.click();
  await expect(page.getByTestId('export-result')).toBeVisible({ timeout: 120000 });
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-result').locator('a').click(),
  ]);
  expect(dl.suggestedFilename()).toBe(`index.js-codelapse.${format}`);
  const head = readFileSync((await dl.path())!).subarray(0, 12);
  if (format === 'gif') expect(head.subarray(0, 6).toString()).toBe('GIF89a');
  else if (format === 'mp4') expect(head.subarray(4, 8).toString()).toBe('ftyp');
  else expect(head.subarray(0, 4).toString('hex')).toBe('1a45dfa3'); // WebM/EBML
});

test('opens a history JSON written by the CLI', async ({ page }) => {
  await page.goto('./');
  await page.locator('input[type=file]').setInputFiles({
    name: 'chalk.json',
    mimeType: 'application/json',
    buffer: readFileSync('public/demos/chalk-index.json'),
  });
  await expect(page).toHaveURL(/#\/view$/);
  await expect(page.getByTestId('commit')).toBeVisible();
  await page.goto('./');
  await page.locator('input[type=file]').setInputFiles({
    name: 'x.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"a":1}'),
  });
  await expect(page.getByRole('alert')).toContainText('not a codelapse history');
});

test('no horizontal scrolling on the page', async ({ page }) => {
  for (const hash of ['', '#/demo/express-response']) {
    await page.goto(`./${hash}`);
    await expect(page.locator('main')).toBeVisible();
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
});
