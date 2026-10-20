# Product decisions

## The bet

**codelapse: time-lapse any file's git history.** Lines slide into place as the code evolves; click
any line to see its whole life (written when, by whom, every edit); export the time-lapse as an MP4
or GIF. A website for GitHub links and a CLI for any local repository, including private ones.

## Evidence of demand

- **The idea already proved itself.** [pomber/git-history](https://github.com/pomber/git-history),
  "Quickly browse the history of a file from any git repository", has 13.7k★. Its last push was
  2024-10-10 and it has 94 open issues (checked 2026-10-20).
- **Its users keep asking for the same things**, sorted by comments plus reactions:
  - [#196](https://github.com/pomber/git-history/issues/196): broken on WSL2 (24 reactions).
  - [#101](https://github.com/pomber/git-history/issues/101): unable to view history in private
    repos (17 comments).
  - [#117](https://github.com/pomber/git-history/issues/117): line numbers (13 reactions).
  - [#64](https://github.com/pomber/git-history/issues/64): highlight the changed lines.
  - [#149](https://github.com/pomber/git-history/issues/149) and #182: long lines truncated or not
    wrapped.
  - [#188](https://github.com/pomber/git-history/issues/188): show the commit hash.
  - [#79](https://github.com/pomber/git-history/issues/79): CLI crash when a file was renamed.
  - [#136](https://github.com/pomber/git-history/issues/136): can't see the full history.
- **Neighbouring tools are popular but answer different questions.**
  [Gource](https://github.com/acaudwell/Gource) (13.2k★) animates a whole repository's file tree,
  not the code. [GitLens](https://github.com/gitkraken/vscode-gitlens) (9.9k★) shows blame and file
  history inside VS Code, but not as a playable animation you can share.

## What codelapse adds

|                                                   | git-history                                                                         | codelapse                                                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Hosted website                                    | public files on GitHub, GitLab and Bitbucket                                        | public files on GitHub (other hosts through the CLI)                                                                                  |
| Private / self-hosted repos                       | website fails on private repos (#101); local repos via its CLI or VS Code extension | the CLI reads your local clone and writes one offline HTML file; the website accepts a GitHub token                                   |
| Renames                                           | open issue: CLI error when the file was renamed (#79)                               | `git log --follow`; the Chalk demo has 97 commits through a rename, where the GitHub API alone returns 29                             |
| Line numbers, changed-line highlight, commit hash | requested (#117, #64, #188)                                                         | yes                                                                                                                                   |
| Long lines                                        | truncated (#149)                                                                    | horizontal scroll or wrap toggle                                                                                                      |
| Per-line history                                  | no                                                                                  | click any line: born, every edit (before/after), deletion, age                                                                        |
| Age heatmap                                       | no                                                                                  | yes                                                                                                                                   |
| Export                                            | no                                                                                  | MP4 (or WebM/GIF), 16:9, square or vertical, rendered on your device                                                                  |
| Big histories                                     |                                                                                     | partial (blobless) clones prefetch all versions in one request: 397 versions of Express's `lib/response.js` in 3.6 s instead of 384 s |

## Candidates considered

|   # | Idea                                                                  | Evidence checked                                                            | Verdict                                       |
| --: | --------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------- |
|   1 | **codelapse**: animated file history + line life story + video export | git-history 13.7k★, stale since 2024-10, 94 open issues with clear requests | **Chosen**                                    |
|   2 | Developer disk cleaner (node_modules, caches)                         | [tw93/Mole](https://github.com/tw93/Mole) 71.5k★, npkill 9.5k★, kondo 2.5k★ | Saturated                                     |
|   3 | AI-agent usage/cost dashboard                                         | [ccusage](https://github.com/ccusage/ccusage) 19k★                          | Saturated                                     |
|   4 | Terminal recording to GIF                                             | [charmbracelet/vhs](https://github.com/charmbracelet/vhs) 21k★              | Solved                                        |
|   5 | Docker image layer explorer                                           | [dive](https://github.com/wagoodman/dive) 54.7k★                            | Solved                                        |
|   6 | Website-to-RSS for any page                                           | [RSSHub](https://github.com/DIYgod/RSSHub) 46.6k★                           | Saturated                                     |
|   7 | Screenshot to code                                                    | [screenshot-to-code](https://github.com/abi/screenshot-to-code) 80.5k★      | Saturated, AI wrapper                         |
|   8 | Repository-wide animation                                             | Gource 13.2k★                                                               | Different question (files, not code)          |
|   9 | Postgres EXPLAIN visualiser                                           | [pev2](https://github.com/dalibo/pev2) 3.6k★                                | Solved for Postgres; small audience elsewhere |
|  10 | Process killer / port manager                                         | [fkill-cli](https://github.com/sindresorhus/fkill-cli) 7k★                  | Solved                                        |
|  11 | Flame-graph viewer                                                    | speedscope 6.8k★                                                            | Solved (and covered by perfproof)             |
|  12 | "Network tab for Node.js" outbound HTTP inspector                     | Node 22 ships experimental network inspection in DevTools                   | Platform is catching up                       |
|  13 | GitHub "wrapped" stats pages                                          | Many seasonal clones                                                        | Seasonal, crowded                             |
|  14 | Commit message / changelog generators                                 | Many AI tools                                                               | Crowded AI wrappers                           |
|  15 | Code-review time-lapse of a whole PR                                  | Would build on #1's engine                                                  | Later extension of codelapse                  |
|  16 | Function-level history (`git log -L`) viewer                          | Little-known git feature                                                    | Folded into #1 as the per-line story          |

## Key design decisions

- **Stable line identity.** Each version is diffed against the previous one (Myers). Within a changed
  block, deleted and inserted lines are paired by similarity, so an edited line keeps its identity.
  That one model drives the sliding animation, the per-line story, the age heatmap and the camera in
  exported videos.
- **Local-first.** The CLI reads `git log --follow --raw` plus one `git cat-file --batch` stream, so a
  300-version history loads in about a second on a normal clone. The website talks to GitHub straight
  from the browser: one API call per 100 commits, with file contents from raw.githubusercontent.com,
  which doesn't count against the 60-requests/hour anonymous API limit.
- **Video export on the device.** Frames are drawn to a canvas and encoded with WebCodecs through
  [Mediabunny](https://github.com/Vanilagy/mediabunny) (MPL-2.0) into MP4 (or WebM). GIF is the
  fallback, via gifenc. Two things were fixed after looking at real exports:
  - Coding-font ligatures turned `===` into one glyph on the canvas, so operator runs are drawn one
    character at a time.
  - A GIF palette taken from the first frame lost the highlight colours, so it is now learned from
    frames sampled across the whole time-lapse.
- **Real demos.** The three demos on the website were recorded by the CLI from Express, Preact and
  Chalk (all MIT), with `scripts/make-demos.mjs`.

## Scope of v1.0

- CLI: `codelapse <file>[:line]` with `-n`, `--rev`, `-o`, `--json` and `--no-open`.
- Player: play, scrub, step, line numbers, syntax highlighting (about 30 languages via Prism),
  changed-line flashes, wrap, age heatmap, line story, sparkline of file size over time, keyboard
  control.
- Export: MP4/WebM/GIF, 16:9 / 1:1 / 9:16, last N commits, 8–60 s, dark/light.
- Website: GitHub links (shareable `#/gh/...` routes, optional token for more API calls), demos,
  opening `--json` histories.

Not in v1: following renames on the website (the GitHub API doesn't), comparing branches, whole-PR
time-lapses.
