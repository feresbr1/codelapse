# Launch kit

Nothing here has been posted yet. Each channel needs the maintainer's account; follow each
community's self-promotion rules and post in one place at a time.

**Assets:** https://feresbr1.github.io/codelapse/ · demos `#/demo/express-response`,
`#/demo/preact-diff`, `#/demo/chalk-index` · `docs/images/timelapse.gif` (real export) ·
`docs/images/player.png` · MP4 time-lapse attached to the v1.0.0 release (real export, 30 s, 720p) ·
social card `public/og.png`.

**The best launch asset is a video people make of their own code.** Encourage "export your most
famous file" posts rather than talking about features.

## One-liners

- **codelapse**: watch any file grow up. A time-lapse of a file's git history, where you can click
  any line for its life story and export the result as an MP4.
- `npx github:feresbr1/codelapse src/app.ts`: your file's whole history, animated, offline, private
  repos included.
- Like `git blame`, but the whole story of every line instead of the last change.

## GitHub release announcement

> **codelapse 1.0**: time-lapse any file's git history.
>
> Paste a GitHub file link at https://feresbr1.github.io/codelapse/, or run
> `npx github:feresbr1/codelapse <file>` in any local repo. Lines keep their identity across
> commits, so code slides into place, edits flash, and you can click a line to see when it was
> written, by whom, and every change since. Export the time-lapse as an MP4, WebM or GIF (16:9,
> square or vertical), rendered in your browser. The CLI follows renames and writes one offline HTML
> file. MIT.

## Show HN

**Title:** `Show HN: Codelapse – a time-lapse of any file's git history, exportable as MP4`

> git-history (githistory.xyz) showed how fun it is to watch a file evolve, but it hasn't been
> updated since 2024 and its issues ask for the same things: private repos, line numbers, changed-line
> highlighting, renames, long lines. I rebuilt the idea with a few additions:
>
> - Every line gets a stable identity across commits: a Myers diff per commit, then edited lines are
>   paired with what they replaced by similarity. The same model drives the animation, a "life of
>   this line" panel (written when, by whom, every edit) and an age heatmap.
> - Export: frames are drawn on a canvas and encoded with WebCodecs to MP4, faster than real time, in
>   16:9, square or vertical. One surprise: coding-font ligatures turned `===` into a single glyph on
>   the canvas, so operator characters are drawn one by one.
> - The CLI (`npx github:feresbr1/codelapse file.js`) follows renames with `git log --follow`
>   and reads every version through one `git cat-file --batch` stream. In blobless clones it prefetches
>   all blobs in one request: 397 versions of Express's response.js in 3.6 s instead of 384 s.
>
> Demos are real recordings of Express, Preact and Chalk. Nothing goes through a server: the site
> calls GitHub directly, and the CLI writes a single offline HTML file.

## Reddit

| Community              | Angle                                                                 | Notes                                                                    |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| r/programming          | The MP4 of a famous file evolving over 10+ years                      | Video posts do well; link the repo in a comment if the rules prefer that |
| r/git                  | `--follow`, line identity across commits, the blobless-clone prefetch | Technical angle                                                          |
| r/javascript, r/webdev | WebCodecs MP4 export in the browser, ligature gotcha                  | Showoff Saturday (r/webdev)                                              |
| r/opensource           | Reviving git-history's idea with what its users asked for             |                                                                          |
| r/dataisbeautiful      | A 30-second time-lapse of a well-known file                           | OC rules apply                                                           |

## Other channels

- **X / Bluesky / Mastodon / LinkedIn:** the MP4 (square or vertical export) of a famous file, plus
  a one-line "made with codelapse" and the link.
- **Maintainers of popular projects:** a time-lapse of their core file is a nice anniversary post;
  offer it, don't spam.
- **Teachers and conference speakers:** time-lapses for talks about refactoring and code evolution.
- **Awesome lists:** awesome-git, awesome-git-addons, awesome-visualization.

## Keywords and search queries

`git file history visualization` · `animate git history` · `git history timelapse` ·
`githistory.xyz alternative` · `git-history private repo` · `git blame history of a line` ·
`when was this line added git` · `visualize code evolution` · `code history video` ·
`git log follow visualizer` · `export git history as video`

## Remaining actions (need the maintainer)

- [ ] Post the launch video on LinkedIn/X (see `docs/LINKEDIN.md`).
- [ ] Show HN, then one Reddit post.
- [ ] Submit to awesome-git / awesome-git-addons.
