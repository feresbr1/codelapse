# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.1] - 2026-10-20

### Fixed

- `codelapse --version` printed the help text instead of the version.
- Files that no longer exist on disk (deleted or moved away) can be played again: their history is
  still in git.

## [1.0.0] - 2026-10-20

### Added

- Player: animated file history with stable line identities, line numbers, syntax highlighting,
  changed-line flashes, commit card with hash and link, timeline with a file-size sparkline,
  play/step/scrub, speed, wrap, age heatmap, keyboard control.
- Life of a line: click any line to see when it was written, by whom, every edit (before/after) and
  its deletion; jump to any of those commits.
- Export: MP4 (WebCodecs via Mediabunny), WebM, or GIF; 16:9, 1:1 or 9:16; last N commits; 8–60 s;
  dark or light; rendered on the device.
- CLI: `codelapse <file>[:line]` with `-n`, `--rev`, `-o`, `--json`, `--no-open`; follows renames;
  fast batch reading and one-request prefetch for partial clones; writes one offline HTML file.
- Website: GitHub file links and shareable `#/gh/...` routes, optional token, real demos from
  Express, Preact and Chalk, opening `--json` histories.

[1.0.1]: https://github.com/feresbr1/codelapse/releases/tag/v1.0.1
[1.0.0]: https://github.com/feresbr1/codelapse/releases/tag/v1.0.0
