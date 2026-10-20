# Contributing to codelapse

Welcome contributions:

1. **Line-identity bugs.** A history where an edited line is shown as deleted and re-added, or two
   unrelated lines are treated as the same one. Add the versions as a test in `test/core.test.ts`.
2. **Languages.** Highlighting comes from Prism; add a component import and an extension mapping in
   `src/viewer/highlight.ts`.
3. **Export polish.** Layouts, fonts or encoders that make the time-lapse better to share
   (`src/viewer/render.ts`, `src/viewer/encode.ts`).

## Development

Requires git and Node.js 20+ (22 recommended for the tooling).

```sh
npm install
npm run check                     # format, lint, typecheck, tests, build
npx playwright install chromium
npm run test:e2e                  # website and player, desktop and mobile
npm run dev                       # http://localhost:5173/codelapse/
```

## Layout

```
src/core/     line diff and pairing (diff.ts), stable line identities and stories (history.ts)
src/node/     reading history from git, writing the standalone HTML
src/cli/      command line
src/viewer/   the player, highlighting, canvas renderer and video/GIF encoders
src/site/     the website and the GitHub loader
scripts/      CLI bundling, demo recording, Pages deploy
```

## Rules

- Demos must be real recordings (`npm run demos`), from repositories whose licence allows it.
- Rebuild and commit `dist/cli/` (`npm run build:cli`) when core, node, CLI or viewer code changes.

By contributing you agree that your contributions are licensed under the MIT License and that you
will follow the [Code of Conduct](CODE_OF_CONDUCT.md).
