import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-scss';

/** [token type ('' for plain text), text] */
export type Token = [string, string];

const BY_EXT: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  json: 'json',
  jsonc: 'json',
  css: 'css',
  scss: 'scss',
  html: 'markup',
  htm: 'markup',
  xml: 'markup',
  svg: 'markup',
  vue: 'markup',
  svelte: 'markup',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  md: 'markdown',
  markdown: 'markdown',
  sql: 'sql',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  toml: 'toml',
};

export function languageFor(file: string): string | null {
  const name = file.split('/').pop()!.toLowerCase();
  if (name === 'dockerfile' || name.endsWith('.dockerfile')) return 'docker';
  if (name === 'makefile' || name.endsWith('.mk')) return null;
  const ext = name.includes('.') ? name.split('.').pop()! : '';
  return BY_EXT[ext] ?? null;
}

function flatten(tokens: (string | Prism.Token)[], type: string, out: Token[]): void {
  for (const t of tokens) {
    if (typeof t === 'string') out.push([type, t]);
    else {
      const alias = Array.isArray(t.alias) ? t.alias[0] : t.alias;
      const name = type ? type : alias ? `${t.type} ${alias}` : t.type;
      if (typeof t.content === 'string') out.push([name, t.content]);
      else flatten(Array.isArray(t.content) ? t.content : [t.content], name, out);
    }
  }
}

/**
 * Highlight a whole file (so multi-line comments and strings are right), then cut the tokens into
 * lines. Very long files fall back to plain text to stay fast.
 */
export function highlightLines(lines: string[], lang: string | null): Token[][] {
  const grammar = lang ? Prism.languages[lang] : undefined;
  if (!grammar || lines.length > 20_000) return lines.map((l) => [['', l]]);
  const flat: Token[] = [];
  try {
    flatten(Prism.tokenize(lines.join('\n'), grammar), '', flat);
  } catch {
    return lines.map((l) => [['', l]]);
  }
  const out: Token[][] = [[]];
  for (const [type, text] of flat) {
    const parts = text.split('\n');
    parts.forEach((part, i) => {
      if (i > 0) out.push([]);
      if (part) out[out.length - 1]!.push([type, part]);
    });
  }
  while (out.length < lines.length) out.push([]);
  return out.slice(0, lines.length);
}

/** CSS class for a token type: "keyword", "string", ... */
export function tokenClass(type: string): string {
  if (!type) return '';
  return type
    .split(' ')
    .map((t) => `tk-${t}`)
    .join(' ');
}

/** Colours shared by the DOM view (as CSS variables) and the video renderer. */
export const TOKEN_COLORS = {
  dark: {
    keyword: '#ff7ab2',
    string: '#a5e075',
    number: '#f9c66b',
    boolean: '#f9c66b',
    comment: '#6b7a90',
    function: '#78c7ff',
    'class-name': '#ffcb6b',
    operator: '#c3cee3',
    punctuation: '#8b96a8',
    property: '#9fd6ff',
    tag: '#ff7ab2',
    'attr-name': '#ffcb6b',
    'attr-value': '#a5e075',
    builtin: '#78c7ff',
    regex: '#f78c6c',
    title: '#ffcb6b',
    default: '#e6edf6',
  },
  light: {
    keyword: '#c41a6b',
    string: '#3b7d1a',
    number: '#b35c00',
    boolean: '#b35c00',
    comment: '#7a8699',
    function: '#0b62c4',
    'class-name': '#8a5a00',
    operator: '#3a4352',
    punctuation: '#5c6675',
    property: '#0a6c94',
    tag: '#c41a6b',
    'attr-name': '#8a5a00',
    'attr-value': '#3b7d1a',
    builtin: '#0b62c4',
    regex: '#b3471f',
    title: '#8a5a00',
    default: '#1d2430',
  },
} as const;

export type Theme = keyof typeof TOKEN_COLORS;

export function colorFor(type: string, theme: Theme): string {
  const palette = TOKEN_COLORS[theme] as Record<string, string>;
  for (const t of type.split(' ')) if (palette[t]) return palette[t]!;
  return palette.default!;
}
