import type { FileHistory } from '../core/history';

declare const __VIEWER_JS__: string | undefined;

const BACKSLASH = String.fromCharCode(92);

/** JSON safe inside an inline script: "<" and the two JS line separators are escaped. */
export function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, `${BACKSLASH}u003c`)
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), `${BACKSLASH}u2028`)
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), `${BACKSLASH}u2029`);
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );
}

/** One self-contained HTML file with the player and the history: works offline, can be shared. */
export function historyToHtml(
  history: FileHistory,
  opts: { line?: number; viewerJs?: string } = {},
): string {
  const js = opts.viewerJs ?? (typeof __VIEWER_JS__ === 'string' ? __VIEWER_JS__ : '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(history.file)} · codelapse</title>
</head>
<body>
<div id="app"></div>
<script id="codelapse-data" type="application/json">${scriptSafeJson({ history, line: opts.line })}</script>
<script>${js.replace(/<\/script/gi, `<${BACKSLASH}/script`)}</script>
</body>
</html>
`;
}
