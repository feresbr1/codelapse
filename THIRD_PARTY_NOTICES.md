# Third-party notices

The website and the single-file CLI (`dist/cli/codelapse.mjs`, which embeds the player) bundle these
libraries:

| Library                                                                                                                                      | License     | Source                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------- |
| [Preact](https://github.com/preactjs/preact)                                                                                                 | MIT         | https://github.com/preactjs/preact                            |
| [Prism](https://github.com/PrismJS/prism)                                                                                                    | MIT         | https://github.com/PrismJS/prism                              |
| [gifenc](https://github.com/mattdesl/gifenc)                                                                                                 | MIT         | https://github.com/mattdesl/gifenc                            |
| [Mediabunny](https://github.com/Vanilagy/mediabunny)                                                                                         | MPL-2.0     | https://github.com/Vanilagy/mediabunny (unmodified, from npm) |
| [Inter](https://github.com/rsms/inter) and [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) fonts (website only, via Fontsource) | SIL OFL 1.1 | linked                                                        |

Mediabunny is used unmodified under the Mozilla Public License 2.0; its source code is available at
the link above and in the `mediabunny` npm package. The MPL applies to Mediabunny's own files only.
The rest of codelapse is MIT licensed (see [LICENSE](LICENSE)).

The demo histories in `public/demos/` contain source code from
[expressjs/express](https://github.com/expressjs/express),
[preactjs/preact](https://github.com/preactjs/preact) and [chalk/chalk](https://github.com/chalk/chalk),
all MIT licensed, with their commit metadata.
