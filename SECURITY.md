# Security Policy

Only the latest release and https://feresbr1.github.io/codelapse/ receive fixes. Report
vulnerabilities privately through
[GitHub security advisories](https://github.com/feresbr1/codelapse/security/advisories/new), not in
public issues.

## In scope

- **Generated HTML files.** The CLI embeds file contents and commit metadata in a self-contained
  HTML file. Content (code, commit messages, author names, file names) that runs script when the
  file is opened is a vulnerability.
- **The website.** It loads data from api.github.com and raw.githubusercontent.com only. Anything
  that makes it send data or a pasted token anywhere else, or keeps the token beyond the tab, is a
  vulnerability.
- **The CLI** runs `git` with fixed arguments in your repository. Anything that makes it run other
  commands or write outside the output file you chose (or the temp folder) is in scope.

## Good to know

- An HTML file written by the CLI contains every version of the file. Don't share histories of
  private code with people who shouldn't read it.
- A pasted GitHub token is held in memory for the open tab only and sent only to GitHub.
