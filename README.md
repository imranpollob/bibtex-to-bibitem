# BibTeX to Bibitem

A browser-only website that converts BibTeX references into IEEE-like LaTeX `\bibitem` entries. Paste references, upload or drop a `.bib` file, then copy or download `bibitems.tex`. Bibliography text is processed locally in the browser.

**[Open the website](https://imranpollob.github.io/bibtex-to-bibitem/)**

## Development

Use Node.js 22.12 or later:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. This repository has no Python converter, Python dependencies, backend, or conversion CLI. Node.js is used for website development and verification.

```text
index.html                 Accessible page and LaTeX usage guide
src/
  app.js                   Browser interactions and sample references
  converter.js             BibTeX parser, formatter, metadata diagnostics
  styles.css               Responsive light/dark theme
public/
  logo.png                 Static website asset
scripts/                   Website verification helpers
tests/                    Regression, HTML, and browser checks
.github/workflows/         Test, build, and GitHub Pages deployment
```

`npm run build` produces `dist/`. `npm run preview` serves that production build locally. Build output and dependencies are ignored by Git.

## Conversion behavior

- Handles braced and quoted values, nested groups, multiline values, numeric values, `@string` macros, `#` concatenation, and parenthesized entries.
- Resolves recursive `crossref` inheritance, retaining explicit child fields. Missing parents, cycles, duplicate keys/fields, undefined macros, and malformed input produce errors instead of incomplete exports.
- Formats personal names as initials and surnames, including common particles, suffixes, hyphens, accents, corporate authors, and `and others`.
- Preserves source title capitalization, LaTeX groups, commands, and math. Escapes plain-text `&`, `%`, `#`, and underscores outside math; existing escapes are retained. TeX nonbreaking spaces (`~`) remain intact.
- Retains DOIs across entry types, normalizes DOI resolver prefixes, formats URLs with `\url`, and normalizes numeric page ranges.
- Supports article, conference/inproceedings, book, inbook, incollection, proceedings, thesis, report, manual, unpublished, software, dataset, patent, misc, and online records. Unknown types use generic formatting and produce a warning.
- Shows warnings for incomplete metadata, unsupported fields/types, unusual DOI syntax, invalid dates, and omitted preambles.

## Academic use and limits

This is a deterministic **IEEE-like formatter**, not an implementation of `IEEEtran.bst`, ACM, Springer, or any other publisher's bibliography style. It does not verify reference authenticity, author spelling, publication details, or whether a DOI resolves. Examples and test fixtures include synthetic references.

Check the generated bibliography against the source and the target venue's requirements. For exact publisher formatting, use the venue's supplied bibliography style and incorporate its generated `.bbl` if a self-contained submission is required.

Titles retain their source case, so any required sentence casing must be reviewed manually. Complex names, custom macros, unusual BibLaTeX features, and uncommon fields may need editing. `@preamble` definitions are not copied; define required commands in your document. A supplied DOI takes precedence over a URL. Records stay in input order, including cross-reference parent records; arrange them in citation order if your venue requires it.

Paste output inside:

```latex
\documentclass{article}
\usepackage[T1]{fontenc}
\usepackage{url}
\begin{document}
A citation goes here: \cite{your-key}.
\begin{thebibliography}{99}
% Paste generated \bibitem entries here.
\end{thebibliography}
\end{document}
```

Use a label width such as `{999}` for 100 or more entries. Unicode support depends on the document's LaTeX engine and fonts; custom input commands may require additional packages.

## Verification

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

The browser suite tests the production build under `/bibtex-to-bibitem/`, matching project-site hosting. See [tests/README.md](tests/README.md) for coverage and audit findings.

An optional compiler check requires [Tectonic](https://tectonic-typesetting.github.io/en-US/install.html):

```sh
npm run test:latex
# Or: TECTONIC_BIN=/path/to/tectonic npm run test:latex
```

This compiles generated references from the 54-entry fixture plus LaTeX edge cases in a temporary directory. Tectonic may download TeX support files on first use.

## GitHub Pages

In repository **Settings → Pages → Build and deployment**, select **GitHub Actions**. Push the changes to the default branch. The workflow runs unit/HTML tests, builds the site, runs Chromium checks, and publishes only `dist/`; pull requests run the same checks without deployment.

The site uses relative asset URLs, so it works beneath a GitHub project path. The canonical URL is lowercase, matching this repository. A `docs/` publishing folder is not required. The workflow follows GitHub's [custom Pages workflow guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

If deployment fails, inspect the Actions run and check that Pages uses GitHub Actions and that the `github-pages` environment permits the default branch. Local code changes do not update the public site until committed, pushed, and successfully deployed.

## License

[MIT](LICENSE)
