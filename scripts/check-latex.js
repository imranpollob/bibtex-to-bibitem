// Compile generated bibliography fixtures to catch errors string comparisons cannot detect.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseBibTeX, convertToBibitem } from '../src/converter.js';
const directory = mkdtempSync(join(tmpdir(), 'bibitem-latex-'));
const fixture = readFileSync(new URL('../tests/bibtex_test_cases.bib', import.meta.url), 'utf8');
const edge = String.raw`
@article{math, author={{\'E}mile Zola and Jean-Pierre Dupont}, title={On {\textit{DNA}} and $E_{X}=Mc^2$: 50% & A_B}, journal={R&D}, year=2025, url={https://example.org/a%20b?q=x_y&z=1}}
@book{doi, title={{\LaTeX} and {\textbf{Nested {Groups}}}}, publisher={A&B}, year=2025, doi={10.1234/a_b}}
`;
const entries = parseBibTeX(fixture + edge);
const tex = String.raw`\documentclass{article}
\usepackage[T1]{fontenc}
\usepackage{url}
\begin{document}
\begin{thebibliography}{999}
` + convertToBibitem(entries).join('\n\n') + String.raw`
\end{thebibliography}
\end{document}
`;
const path = join(directory, 'bibliography.tex');
writeFileSync(path, tex);
const result = spawnSync(process.env.TECTONIC_BIN || 'tectonic', ['--keep-logs', path], { encoding: 'utf8' });
if (result.error) { console.error('Install Tectonic or set TECTONIC_BIN to its executable.'); process.exit(1); }
console.log(result.stdout);
console.error(result.stderr);
if (result.status !== 0) process.exit(result.status || 1);
console.log(`Compiled ${entries.length} bibliography entries: ${directory}/bibliography.pdf`);
