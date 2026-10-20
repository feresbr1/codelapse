/** Player styles, shared by the website and the standalone HTML the CLI writes. */
export const PLAYER_CSS = `
.cl-root {
  --bg: #0d1117; --panel: #151b24; --panel2: #1b2330; --line: #263040; --ink: #e6edf6; --muted: #8b98ab;
  --accent: #ffb547; --accent-ink: #1a1203; --accent-soft: rgba(255, 181, 71, .14);
  --add: 61, 220, 151; --mod: 255, 181, 71; --del: 255, 107, 107;
  --tk-keyword: #ff7ab2; --tk-string: #a5e075; --tk-number: #f9c66b; --tk-comment: #6b7a90; --tk-function: #78c7ff;
  --tk-class: #ffcb6b; --tk-operator: #c3cee3; --tk-punct: #8b96a8; --tk-property: #9fd6ff; --tk-regex: #f78c6c;
  --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --sans: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--ink); background: var(--bg); font: 15px/1.5 var(--sans);
}
@media (prefers-color-scheme: light) {
  .cl-root:not([data-theme='dark']) {
    --bg: #fbfbf9; --panel: #ffffff; --panel2: #f3f4f0; --line: #e2e4dc; --ink: #1d2430; --muted: #5c6675;
    --accent: #b86e00; --accent-ink: #fff; --accent-soft: rgba(184, 110, 0, .1);
    --add: 15, 157, 104; --mod: 183, 121, 31; --del: 214, 60, 60;
    --tk-keyword: #c41a6b; --tk-string: #3b7d1a; --tk-number: #b35c00; --tk-comment: #7a8699; --tk-function: #0b62c4;
    --tk-class: #8a5a00; --tk-operator: #3a4352; --tk-punct: #5c6675; --tk-property: #0a6c94; --tk-regex: #b3471f;
  }
}
.cl-root * { box-sizing: border-box; }
.cl-root code, .cl-root pre { font-family: var(--mono); font-variant-ligatures: none; }
.cl-root .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.cl-root :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cl-player { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.cl-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.cl-title h1 { margin: 0; font-size: 20px; letter-spacing: -.01em; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; word-break: break-all; }
.cl-file { font-family: var(--mono); font-weight: 700; }
.cl-repo { font-size: 14px; color: var(--muted); font-weight: 500; }
.cl-stats { margin: 4px 0 0; color: var(--muted); font-size: 13.5px; }
.cl-btn { font: 600 14px var(--sans); padding: 8px 14px; border-radius: 9px; border: 1px solid var(--line); background: var(--panel2); color: var(--ink); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; }
.cl-btn:hover:not(:disabled) { border-color: var(--accent); }
.cl-btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.cl-btn:disabled { opacity: .55; cursor: not-allowed; }
.cl-icon { font: 600 14px var(--sans); min-width: 36px; height: 36px; border-radius: 9px; border: 1px solid var(--line); background: var(--panel2); color: var(--ink); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0 8px; }
.cl-icon:hover { border-color: var(--accent); }
.cl-icon.play { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); min-width: 48px; }
.cl-commit { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px 20px; flex-wrap: wrap; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px 16px; }
.cl-commit-main { min-width: 0; flex: 1 1 320px; }
.cl-msg { margin: 0; font-weight: 600; font-size: 16px; word-break: break-word; }
.cl-meta { margin: 2px 0 0; color: var(--muted); font-size: 13.5px; word-break: break-all; }
.cl-meta b { color: var(--ink); font-weight: 600; }
.cl-meta a { color: var(--accent); }
.cl-diffstat { margin: 0; font: 600 13.5px var(--mono); display: flex; gap: 10px; align-items: center; white-space: nowrap; }
.cl-diffstat .add { color: rgb(var(--add)); }
.cl-diffstat .mod { color: rgb(var(--mod)); }
.cl-diffstat .del { color: rgb(var(--del)); }
.cl-count { color: var(--muted); font-weight: 400; margin-left: 4px; }
.cl-controls { display: flex; align-items: center; gap: 12px 16px; flex-wrap: wrap; }
.cl-buttons { display: flex; gap: 6px; }
.cl-scrub { flex: 1 1 260px; position: relative; min-width: 0; }
.cl-spark { position: absolute; left: 0; right: 0; top: -2px; height: 26px; width: 100%; pointer-events: none; opacity: .55; }
.cl-spark polyline { stroke: var(--accent); stroke-width: 1.5; }
.cl-scrub input[type=range] { width: 100%; margin: 14px 0 0; accent-color: var(--accent); position: relative; }
.cl-pos { margin: 0; font-size: 12.5px; color: var(--muted); text-align: right; }
.cl-pos b { color: var(--ink); }
.cl-toggles { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 13.5px; color: var(--muted); }
.cl-toggles input { accent-color: var(--accent); }
.cl-toggles select, .cl-form select { font: inherit; font-size: 13.5px; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--panel2); color: var(--ink); }
.cl-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-items: start; }
.cl-body.with-story { grid-template-columns: minmax(0, 1fr) 360px; }
.cl-code-scroll { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; max-height: 72vh; overflow: auto; padding: 8px 0; }
.cl-code { position: relative; min-width: max-content; font: 13px/20px var(--mono); }
.cl-code.flow { min-width: 0; }
.cl-line { position: absolute; left: 0; right: 0; height: 20px; display: flex; white-space: pre; cursor: pointer; transition: transform var(--cl-dur, 450ms) cubic-bezier(.4, 0, .2, 1), opacity var(--cl-dur, 450ms); }
.cl-code.flow .cl-line { position: relative; height: auto; transition: none; }
.cl-code.wrap .cl-line { white-space: pre-wrap; word-break: break-all; }
.cl-line:hover { background: var(--accent-soft); }
.cl-line.selected { background: var(--accent-soft); box-shadow: inset 2px 0 0 var(--accent); }
.cl-flash { position: absolute; inset: 0; pointer-events: none; animation: cl-flash 1.6s ease-out forwards; }
.cl-line.added .cl-flash { --c: var(--add); }
.cl-line.modified .cl-flash { --c: var(--mod); }
@keyframes cl-flash { from { background: rgba(var(--c), .28); box-shadow: inset 3px 0 0 rgba(var(--c), 1); } to { background: rgba(var(--c), 0); box-shadow: inset 3px 0 0 rgba(var(--c), 0); } }
.cl-line.added { animation: cl-in var(--cl-dur, 450ms) ease-out; }
@keyframes cl-in { from { opacity: 0; } to { opacity: 1; } }
.cl-line.removed { animation: cl-out var(--cl-dur, 450ms) ease-in forwards; background: rgba(var(--del), .2); pointer-events: none; }
@keyframes cl-out { from { opacity: 1; } to { opacity: 0; } }
.cl-gutter { flex: none; padding: 0 14px 0 12px; color: var(--muted); opacity: .7; user-select: none; text-align: right; }
.cl-text { flex: 1; padding-right: 20px; color: var(--ink); }
.tk-keyword, .tk-atrule, .tk-important, .tk-tag { color: var(--tk-keyword); }
.tk-string, .tk-char, .tk-attr-value, .tk-inserted, .tk-url { color: var(--tk-string); }
.tk-number, .tk-boolean, .tk-constant, .tk-symbol { color: var(--tk-number); }
.tk-comment, .tk-prolog, .tk-doctype, .tk-cdata { color: var(--tk-comment); font-style: italic; }
.tk-function, .tk-builtin, .tk-function-variable { color: var(--tk-function); }
.tk-class-name, .tk-attr-name, .tk-title, .tk-selector { color: var(--tk-class); }
.tk-operator, .tk-entity { color: var(--tk-operator); }
.tk-punctuation { color: var(--tk-punct); }
.tk-property, .tk-key, .tk-variable { color: var(--tk-property); }
.tk-regex, .tk-deleted { color: var(--tk-regex); }
.cl-story { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px; max-height: 72vh; overflow: auto; position: sticky; top: 72px; }
.cl-story-head { display: flex; justify-content: space-between; align-items: center; }
.cl-story h2 { font-size: 15px; margin: 0; }
.cl-story-sum { color: var(--muted); font-size: 13.5px; margin: 8px 0 12px; }
.cl-story-sum b { color: var(--ink); }
.cl-steps { list-style: none; margin: 0; padding: 0 0 0 14px; border-left: 2px solid var(--line); display: grid; gap: 12px; }
.cl-steps li { position: relative; }
.cl-steps li::before { content: ''; position: absolute; left: -21px; top: 6px; width: 12px; height: 12px; border-radius: 50%; background: var(--panel); border: 2px solid var(--muted); }
.cl-steps li.born::before { border-color: rgb(var(--add)); }
.cl-steps li.edited::before { border-color: rgb(var(--mod)); }
.cl-steps li.deleted::before { border-color: rgb(var(--del)); }
.cl-steps li.current::before { background: var(--accent); }
.cl-steps button { all: unset; cursor: pointer; display: grid; gap: 1px; width: 100%; }
.cl-steps button:focus-visible { outline: 2px solid var(--accent); }
.cl-step-kind { font: 600 11px var(--sans); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.cl-step-msg { font-weight: 600; font-size: 13.5px; }
.cl-step-meta { font-size: 12px; color: var(--muted); }
.cl-before, .cl-after { margin: 4px 0 0; font-size: 12px; padding: 4px 8px; border-radius: 6px; white-space: pre-wrap; word-break: break-all; }
.cl-before { background: rgba(var(--del), .12); }
.cl-after { background: rgba(var(--add), .12); }
.cl-note { font-size: 13px; color: var(--muted); }
.cl-hint { margin: 0; font-size: 12.5px; color: var(--muted); text-align: center; }
.cl-modal { position: fixed; inset: 0; background: rgba(0, 0, 0, .55); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 50; }
.cl-dialog { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; width: min(980px, 100%); max-height: 92vh; overflow: auto; }
.cl-dialog-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.cl-dialog-head h2 { margin: 0; font-size: 18px; }
.cl-export-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 16px; align-items: start; }
.cl-preview { width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); }
.cl-form { display: grid; gap: 10px; }
.cl-form label { display: grid; gap: 4px; font-size: 13px; color: var(--muted); }
.cl-small { font-size: 12.5px; color: var(--muted); margin: 0; }
.cl-progress { position: relative; height: 38px; border-radius: 9px; background: var(--panel2); overflow: hidden; display: flex; align-items: center; justify-content: space-between; padding: 0 0 0 12px; border: 1px solid var(--line); }
.cl-progress > div { position: absolute; inset: 0 auto 0 0; background: var(--accent-soft); }
.cl-progress span { position: relative; font: 600 13px var(--mono); }
.cl-progress .cl-btn { position: relative; padding: 6px 10px; }
.cl-error { color: rgb(var(--del)); font-size: 13.5px; margin: 0; }
.cl-result { display: grid; gap: 8px; }
@media (max-width: 900px) {
  .cl-body.with-story { grid-template-columns: minmax(0, 1fr); }
  .cl-story { position: static; max-height: none; }
  .cl-export-grid { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 560px) {
  .cl-code { font-size: 12px; }
  .cl-gutter { padding: 0 8px 0 6px; }
  .cl-toggles { width: 100%; }
  .cl-head .cl-btn { width: 100%; }
}
`;
