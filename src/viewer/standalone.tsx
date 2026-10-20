// Entry point of the HTML files the CLI writes: reads the embedded history and shows the player.
import { render } from 'preact';
import { validateHistory } from '../core/history';
import { Player } from './Player';
import { PLAYER_CSS } from './styles';

const style = document.createElement('style');
style.textContent = `${PLAYER_CSS}
html, body { margin: 0; background: #0d1117; }
@media (prefers-color-scheme: light) { html, body { background: #fbfbf9; } }
.cl-page { max-width: 1400px; margin: 0 auto; padding: 18px 16px 32px; min-height: 100vh; }
.cl-brand { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--muted); margin-bottom: 12px; }
.cl-brand b { color: var(--ink); }
.cl-brand a { color: inherit; }`;
document.head.appendChild(style);

const app = document.getElementById('app')!;
app.className = 'cl-root';
const raw = document.getElementById('codelapse-data')?.textContent ?? 'null';
const data = JSON.parse(raw) as { history: unknown; line?: number };
const history = validateHistory(data.history);
document.title = `${history.file} · codelapse`;

render(
  <div class="cl-page">
    <div class="cl-brand">
      <span>
        <b>codelapse</b> · time-lapse of a file&rsquo;s git history
      </span>
      <a href="https://github.com/feresbr1/codelapse">github.com/feresbr1/codelapse</a>
    </div>
    <Player history={history} initialLine={data.line} />
  </div>,
  app,
);
