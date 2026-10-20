import { useEffect, useRef, useState } from 'preact/hooks';
import { HistoryError, validateHistory, type FileHistory } from '../core/history';
import { Player, formatDate } from '../viewer/Player';
import { PLAYER_CSS } from '../viewer/styles';
import demos from './demos.json';
import { fromRoute, loadGitHubHistory, parseGitHubUrl, RateLimitError, routeFor } from './github';

export const REPO = 'https://github.com/feresbr1/codelapse';
const NPX = 'npx github:feresbr1/codelapse';

const style = document.createElement('style');
style.textContent = PLAYER_CSS;
document.head.appendChild(style);

function useRoute(): string {
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => {
    const on = () => setHash(location.hash || '#/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash.replace(/^#/, '');
}

type Loaded = { history: FileHistory; key: string };

export function App() {
  const route = useRoute();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; rate?: boolean } | null>(null);
  const [token, setToken] = useState('');
  const abort = useRef<AbortController | null>(null);

  const load = async (key: string, fn: (signal: AbortSignal) => Promise<FileHistory>) => {
    if (loaded?.key === key) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setError(null);
    setStatus('Loading history…');
    try {
      const history = await fn(ctrl.signal);
      if (ctrl.signal.aborted) return;
      setLoaded({ history, key });
      setStatus(null);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setStatus(null);
      setError({
        message:
          err instanceof HistoryError ? err.message : `Could not load: ${(err as Error).message}`,
        rate: err instanceof RateLimitError,
      });
    }
  };

  useEffect(() => {
    const demo = /^\/demo\/([\w-]+)$/.exec(route)?.[1];
    const gh = fromRoute(route.split('?')[0]!);
    if (demo) {
      void load(route, async (signal) => {
        const res = await fetch(`./demos/${demo}.json`, { signal });
        if (!res.ok) throw new HistoryError('This demo does not exist.');
        return validateHistory(await res.json());
      });
    } else if (gh.length) {
      void load(route + token, (signal) =>
        loadGitHubHistory(gh, {
          token: token || undefined,
          signal,
          onProgress: (d, t) => setStatus(`Downloading versions… ${d} / ${t}`),
        }),
      );
    } else if (route === '/view' && loaded) {
      // a dropped file, already in memory
    } else if (!route.startsWith('/view')) {
      setLoaded(null);
      setError(null);
      setStatus(null);
    }
  }, [route, token]);

  useEffect(() => {
    document.title = loaded
      ? `${loaded.history.file} · codelapse`
      : 'codelapse: time-lapse any file’s git history';
  }, [loaded]);

  const showPlayer = loaded && route !== '/' && route !== '';
  return (
    <div class="cl-root site">
      <a class="sr-only skip" href="#main">
        Skip to content
      </a>
      <header class="site-head">
        <div class="wrap bar">
          <a class="logo" href="#/">
            <Logo />
            codelapse
          </a>
          <nav aria-label="Site">
            <a href={`#/demo/${demos[0]!.id}`}>Demo</a>
            <a href={`${REPO}#readme`} class="hide-sm">
              Docs
            </a>
            <a href={REPO}>GitHub</a>
          </nav>
        </div>
      </header>
      <main id="main">
        {showPlayer ? (
          <div class="wrap player-wrap">
            <Player history={loaded.history} key={loaded.key} />
          </div>
        ) : status || error ? (
          <div class="wrap state">
            {status && (
              <p class="loading" role="status">
                {status}
              </p>
            )}
            {error && (
              <div class="cl-error-box" role="alert">
                <p>{error.message}</p>
                {error.rate && <TokenForm onToken={setToken} />}
                <p>
                  <a href="#/">← Back</a>
                </p>
              </div>
            )}
          </div>
        ) : (
          <Landing
            onFile={(history, name) => {
              setLoaded({ history, key: `file:${name}:${Date.now()}` });
              location.hash = '#/view';
            }}
          />
        )}
      </main>
      <footer class="site-foot">
        <div class="wrap">
          MIT licensed · <a href={REPO}>Source</a> · <a href={`${REPO}/issues`}>Issues</a> ·
          Histories are loaded straight from GitHub into your browser; nothing goes through a server
          of ours.
        </div>
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#151b24" />
      <rect x="6" y="8" width="11" height="3" rx="1.5" fill="#8b98ab" />
      <rect x="6" y="14.5" width="16" height="3" rx="1.5" fill="#ffb547" />
      <rect x="6" y="21" width="8" height="3" rx="1.5" fill="#3ddc97" />
      <circle cx="24" cy="22.5" r="4.5" fill="none" stroke="#e6edf6" stroke-width="2" />
      <path
        d="M24 20.3v2.4l1.6 1"
        stroke="#e6edf6"
        stroke-width="1.6"
        fill="none"
        stroke-linecap="round"
      />
    </svg>
  );
}

function TokenForm({ onToken }: { onToken: (t: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      class="token"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onToken(value.trim());
      }}
    >
      <label for="token">
        GitHub token (a fine-grained token with read-only access is enough; it stays in this tab
        only)
      </label>
      <div>
        <input
          id="token"
          type="password"
          value={value}
          onInput={(e) => setValue(e.currentTarget.value)}
          autocomplete="off"
        />
        <button type="submit" class="cl-btn primary">
          Retry
        </button>
      </div>
    </form>
  );
}

function Landing({ onFile }: { onFile: (h: FileHistory, name: string) => void }) {
  const [url, setUrl] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const go = (e: Event) => {
    e.preventDefault();
    const c = parseGitHubUrl(url);
    if (!c.length) {
      setProblem(
        'Paste a link to a file on GitHub, like https://github.com/expressjs/express/blob/master/lib/router.js',
      );
      return;
    }
    // The route keeps the first split; the loader tries the others if the ref contains slashes.
    location.hash = routeFor(c[0]!);
  };
  return (
    <>
      <section class="hero wrap">
        <p class="kicker">git history, as a time-lapse</p>
        <h1>
          Watch any file <span>grow up.</span>
        </h1>
        <p class="lede">
          codelapse replays a file&rsquo;s git history commit by commit, with lines sliding into
          place as the code evolves. Click any line to see its life story, and export the whole
          thing as an MP4 or GIF.
        </p>
        <form class="gh-form" onSubmit={go}>
          <label class="sr-only" for="gh-url">
            GitHub file URL
          </label>
          <input
            id="gh-url"
            type="text"
            inputMode="url"
            autocomplete="off"
            spellcheck={false}
            placeholder="https://github.com/owner/repo/blob/main/src/index.ts"
            value={url}
            onInput={(e) => {
              setUrl(e.currentTarget.value);
              setProblem(null);
            }}
          />
          <button type="submit" class="cl-btn primary">
            Play history
          </button>
        </form>
        {problem && (
          <p class="cl-error" role="alert">
            {problem}
          </p>
        )}
        <p class="alt">
          Local or private repo? <code>{NPX} src/app.ts</code> · or{' '}
          <button type="button" class="linklike" onClick={() => fileInput.current?.click()}>
            open a history .json
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label="Open a codelapse history JSON file"
            onChange={async (e) => {
              const f = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (!f) return;
              try {
                onFile(validateHistory(JSON.parse(await f.text())), f.name);
              } catch (err) {
                setProblem(
                  err instanceof HistoryError
                    ? err.message
                    : 'That file is not a codelapse history (.json from codelapse --json).',
                );
              }
            }}
          />
        </p>
      </section>

      <section class="wrap demos" aria-labelledby="demos-title">
        <h2 id="demos-title">Real histories to play</h2>
        <div class="demo-grid">
          {demos.map((d) => (
            <a class="demo" href={`#/demo/${d.id}`} key={d.id}>
              <span class="demo-file">{d.file}</span>
              <b>{d.title}</b>
              <span class="demo-meta">
                {d.repo.replace('github.com/', '')} · {d.commits} commits ·{' '}
                {formatDate(d.first).split(',').pop()?.trim()}–
                {formatDate(d.last).split(',').pop()?.trim()}
              </span>
              <span class="demo-go">Play ▶</span>
            </a>
          ))}
        </div>
        <p class="small muted">
          Recorded with the codelapse CLI from the public repositories (MIT licensed).
        </p>
      </section>

      <section class="wrap features" aria-labelledby="f-title">
        <h2 id="f-title">More than a diff</h2>
        <div class="grid">
          <div>
            <h3>Lines that move</h3>
            <p>
              Every line keeps its identity across commits, so unchanged code slides when lines are
              added above it, edited lines light up amber, new lines fade in green and deleted ones
              fade out red.
            </p>
          </div>
          <div>
            <h3>The life of a line</h3>
            <p>
              Click a line: when it was written, by whom, every edit since (before and after), and
              how long it has survived. Like <code>git blame</code>, but for the whole story instead
              of the last change.
            </p>
          </div>
          <div>
            <h3>Export the time-lapse</h3>
            <p>
              Render an MP4 (or GIF) in 16:9, square or vertical, with a camera that follows the
              changes. Made on your device, ready for a README, a talk or a post.
            </p>
          </div>
          <div>
            <h3>Follows renames</h3>
            <p>
              The CLI uses <code>git log --follow</code>, so a file&rsquo;s history doesn&rsquo;t
              stop when it was moved. It works on private and self-hosted repos because it reads
              your local clone.
            </p>
          </div>
          <div>
            <h3>Age heatmap</h3>
            <p>
              Colour every line by when it was last written to see which parts of a file are ancient
              and which are hot, at any point in time.
            </p>
          </div>
          <div>
            <h3>Shareable</h3>
            <p>
              Every GitHub file has a link (<code>#/gh/owner/repo/ref/path</code>), and the CLI
              writes a single offline HTML file you can send to anyone.
            </p>
          </div>
        </div>
      </section>

      <section class="wrap cli" aria-labelledby="cli-title">
        <h2 id="cli-title">From your terminal, on any repo</h2>
        <pre class="term">{`$ npx github:feresbr1/codelapse lib/response.js
codelapse: lib/response.js · 300 commits (most recent 300; use -n for more) · 86 authors · read in 826 ms
codelapse: wrote C:\\Users\\me\\AppData\\Local\\Temp\\codelapse\\lib_response.js-1792457679294.html`}</pre>
        <p class="small muted">
          Real output on a clone of Express. Opens the player in your browser.{' '}
          <code>file.ts:42</code> opens with line 42&rsquo;s story selected;{' '}
          <code>-o history.html</code> saves a shareable file. Needs git and Node.js 20+.
        </p>
      </section>
    </>
  );
}
