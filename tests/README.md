# Verification and conversion audit

Run `npm test`, then `npm run build && npm run test:browser` (install Chromium with `npx playwright install chromium` first).

## Coverage

- 54 reviewed golden reference outputs covering common publication types, names, accents, URLs, DOIs, macros, and cross-references. Expected output changes deliberately preserve source title case and grouping, retain notes, and avoid assuming all patents are US patents.
- Parser failure cases: unbalanced values, missing commas, undefined macros, duplicate keys/fields, unsafe citation keys, missing parents, and cyclic inheritance.
- Formatter cases: nested TeX commands and math, escaping, hyphenated/accented initials, corporate names, `others`, book chapters, date diagnostics, notes, proceedings editors, and DOI preservation across types.
- Original `references.bib` retained as `fixtures/references.bib`. It contains duplicate keys; tests verify rejection of the original and record preservation after renaming duplicate keys only in memory. The source fixture is unchanged.
- HTML validation catches malformed markup, duplicate attributes and missing accessibility metadata.
- Browser tests exercise production assets under a repository subpath, samples, file uploads, clipboard, downloads, error recovery, injection-safe notifications, mobile overflow, and theme persistence, including unavailable local storage.
- `npm run test:latex` compiles the golden input plus two TeX edge-case references (56 entries). It checks actual TeX compilation, not merely string matching.

## Issues addressed

The previous page contained duplicate HTML elements and malformed metadata/links. Styling contained overlapping revisions. Application code and converter logic shared one script, and deployment published a source directory without running checks.

The previous parser silently skipped damaged entries, dropped duplicate keys, did not handle parenthesized entries, incorrectly tracked multiline comments, and resolved cross-references in an order-dependent pass. Its test runner could pass despite missing expected entries.

Formatting could strip required TeX grouping, change proper-name capitalization, add repeated dots to hyphenated initials, omit DOIs for several types, omit editors and notes, label every eprint as arXiv, and label every patent as US. These behaviors now have explicit regression coverage.

## Scope of assurance

Passing tests establishes behavior for the tested syntax and metadata. It does not certify publisher-style compliance, factual reference correctness, DOI existence, arbitrary custom TeX, or every BibLaTeX extension. Titles deliberately retain input case. Review warnings and compare output with the original publications before submission. The formatter's policy and limits are documented in the main README and website.
