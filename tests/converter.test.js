import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBibTeX, convertToBibitem, getWarnings, parseName, formatAuthorList, escapeLatex } from '../src/converter.js';
const convert = text => convertToBibitem(parseBibTeX(text)).join('\n\n');

test('exact article output preserves source title, authors, venue and locators', () => {
  assert.equal(convert('@article{smith, author={Smith, John and Brown, Alice}, title={Research on {AI}}, journal={Science}, volume=4, number=2, pages={10-20}, year=2025, doi={https://doi.org/10.1234/test}}'),
    '\\bibitem{smith}\nJ. Smith and A. Brown, ``Research on {AI},\'\' \\emph{Science}, vol. 4, no. 2, pp. 10--20, 2025, doi: 10.1234/test.');
});

test('parenthesized entries, nested braces, quoted braces and macro concatenation', () => {
  const entries = parseBibTeX('@string(prefix="Journal ") @string(name=prefix # {of Tests}) @article(key, title="A {"quoted"} Title", journal=name, year=2025)');
  assert.equal(entries[0].title, 'A {"quoted"} Title');
  assert.equal(entries[0].journal, 'Journal of Tests');
});

test('multiline literal percent, escaped delimiters and comments survive correctly', () => {
  const entries = parseBibTeX(String.raw`% ignored @misc{fake}
@article{k, % comment
 title={An experiment
 with 50% gains and \{braces\}},
 url={https://example.org/a%20b}, year=2025}`);
  assert.equal(entries.length, 1);
  assert.match(entries[0].title, /50% gains/);
  assert.match(convertToBibitem(entries)[0], /50\\% gains/);
  assert.match(convertToBibitem(entries)[0], /a%20b/);
});

for (const [name, bib, error] of [
  ['unclosed entry', '@article{k,title={T}', /comma|closing delimiter/],
  ['unclosed value', '@article{k,title={T', /Unterminated/],
  ['unclosed quote', '@article{k,title="T}', /Unbalanced|Unterminated/],
  ['missing comma', '@article{k,title={T} year=2025}', /comma/],
  ['undefined macro', '@article{k,title=unknown}', /Undefined string/],
  ['duplicate key', '@misc{k,title={A}} @misc{k,title={B}}', /Duplicate citation/],
  ['duplicate field', '@misc{k,title={A}, title={B}}', /Duplicate field/],
  ['unsafe key', '@misc{bad\\key,title={T}}', /Invalid citation key/],
  ['missing parent', '@misc{k,crossref={missing}}', /Missing cross-reference/],
  ['cycle', '@misc{a,crossref={b}} @misc{b,crossref={a}}', /Cyclic/],
  ['broken concat', '@misc{k,title={T} #}', /field value/],
  ['unclosed comment', '@comment{broken', /Unterminated comment/],
]) test(`rejects ${name} rather than returning partial output`, () => assert.throws(() => parseBibTeX(bib), error));

test('crossref resolves recursively in either order and does not substitute a parent title for a missing paper title', () => {
  const entries = parseBibTeX('@inproceedings{c,crossref={p},year=2024} @proceedings{p,title={Conference},crossref={g}} @proceedings{g,year=2025,publisher={Press}}');
  assert.equal(entries[0].booktitle, 'Conference');
  assert.equal(entries[0].publisher, 'Press');
  assert.equal(entries[0].year, '2024');
  assert.equal(entries[0].title, undefined);
  assert.ok(getWarnings(entries).some(w => w.includes('c: Missing title')));
});

test('special object-property names are safe keys and macros', () => {
  const entries = parseBibTeX('@string{constructor="Safe"} @misc{__proto__, title=constructor} @misc{constructor,title={Other}}');
  assert.equal(entries[0].title, 'Safe');
  assert.equal(entries.length, 2);
});

test('comments and preambles are not bibliography records; preambles are disclosed', () => {
  const entries = parseBibTeX('@comment{ignore @misc{fake}} @preamble{"\\newcommand{\\foo}{bar}"} @misc{k,title={T}}');
  assert.equal(entries.length, 1);
  assert.match(getWarnings(entries).join(' '), /preamble/);
});

for (const [input, expected] of [
  ['Jean-Pierre Dupont', 'J.-P. Dupont'],
  ['Smith, Jr., John Michael', 'J. M. Smith, Jr.'],
  ['Ludwig van Beethoven', 'L. van Beethoven'],
  ['de la Cruz, Juan', 'J. de la Cruz'],
  ['{Research and Development Group}', 'Research and Development Group'],
  [String.raw`{\'E}mile Zola`, String.raw`{\'E}. Zola`],
  [String.raw`{\"O}zlem Yilmaz`, String.raw`{\"O}. Yilmaz`],
]) test(`author initials: ${input}`, () => assert.equal(parseName(input), expected));

test('others is rendered as et al., corporate author and multiline separator preserved', () => {
  assert.equal(formatAuthorList('John Smith and others'), 'J. Smith, et al.');
  assert.equal(formatAuthorList('{Research and Development} and\nJohn Smith'), 'Research and Development and J. Smith');
});

test('TeX commands, nested arguments, math and capitalization survive', () => {
  const title = String.raw`On {NASA} and {\textit{DNA}}: $E_{X} = Mc^2$ with {\LaTeX}`;
  const output = convert(`@book{k,title={${title}},publisher={R&D_100%},year=2025}`);
  assert.ok(output.includes(title));
  assert.ok(output.includes(String.raw`R\&D\_100\%`));
  assert.equal(escapeLatex(String.raw`\& \% \_ $x_i^2$ \(y_j\) A_B`), String.raw`\& \% \_ $x_i^2$ \(y_j\) A\_B`);
});

for (const type of ['book','incollection','phdthesis','mastersthesis','techreport','proceedings','manual','unpublished','software','dataset','misc','online','patent']) {
  test(`retains DOI for @${type}`, () => assert.match(convert(`@${type}{k,title={T},year=2025,doi={DOI: 10.1234/a_b}}`), /doi: 10\.1234\/a\\_b\./));
}

test('preserves notes, non-URL howpublished, proceedings editors and non-US patents', () => {
  assert.match(convert('@misc{k,title={T},howpublished={Technical website},note={Corrected edition},year=2025}'), /Technical website\. Corrected edition\./);
  assert.match(convert('@proceedings{k,title={T},editor={Jane Smith},year=2025}'), /J\. Smith, Ed\./);
  assert.ok(!convert('@patent{k,title={T},number={EP12345},year=2025}').includes('U.S.'));
});

test('does not claim every eprint is arXiv', () => {
  assert.match(convert('@misc{k,title={T},eprint={123},eprinttype={PubMed},year=2025}'), /PubMed:123/);
  assert.match(convert('@misc{k,title={T},eprint={123},year=2025}'), /eprint:123/);
});

test('date warnings catch invalid calendar dates without inventing dates', () => {
  const entries = parseBibTeX('@online{k,title={T},date={2025-02-30},urldate={2025-13-01},url={https://example.org}}');
  const warnings = getWarnings(entries).join(' ');
  assert.match(warnings, /Invalid or unsupported date/);
  assert.match(warnings, /Invalid or unsupported urldate/);
  assert.match(convertToBibitem(entries)[0], /2025-02-30/);
});

test('unknown types and unrendered metadata are disclosed', () => {
  assert.match(getWarnings(parseBibTeX('@custom{k,title={T},eid={123}}')).join(' '), /Unsupported type.*Missing publication.*Field "eid"/);
});

test('all 54 legacy fixture records retain unique keys and produce output', () => {
  const entries = parseBibTeX(readFileSync(new URL('./bibtex_test_cases.bib', import.meta.url), 'utf8'));
  const output = convertToBibitem(entries);
  assert.equal(entries.length, 54);
  assert.equal(output.length, 54);
  assert.equal(new Set(entries.map(e => e.ID)).size, 54);
  for (const [i, item] of output.entries()) assert.ok(item.startsWith(`\\bibitem{${entries[i].ID}}\n`));
});

test('real bibliography corpus preserves every citation key', () => {
  const input = readFileSync(new URL('./fixtures/references.bib', import.meta.url), 'utf8');
  const keys = [...input.matchAll(/@\w+\s*\{\s*([^,]+),/g)].map(m => m[1]);
  // The supplied corpus itself has duplicate keys; ensure users are told.
  assert.throws(() => parseBibTeX(input), /Duplicate citation key/);
  const seen = new Map();
  const uniqueInput = input.replace(/(@\w+\s*\{\s*)([^,]+)(,)/g, (_, prefix, key, comma) => {
    const count = (seen.get(key) || 0) + 1; seen.set(key, count);
    return prefix + key + (count > 1 ? '_duplicate_' + count : '') + comma;
  });
  const entries = parseBibTeX(uniqueInput);
  assert.equal(entries.length, keys.length);
  assert.equal(convertToBibitem(entries).length, keys.length);
});

test('all 54 reference outputs match reviewed expected bibliography text', () => {
  const expected = readFileSync(new URL('./expected_bibitems.tex', import.meta.url), 'utf8');
  const expectedItems = [...expected.matchAll(/\\bibitem\{([^}]+)\}\n([\s\S]*?)(?=\n\n\\bibitem|$)/g)];
  const entries = parseBibTeX(readFileSync(new URL('./bibtex_test_cases.bib', import.meta.url), 'utf8'));
  assert.equal(entries.length, expectedItems.length);
  const actual = new Map(entries.map(e => [e.ID, convertToBibitem([e])[0].trim()]));
  for (const [item, key] of expectedItems) assert.equal(actual.get(key), item.trim(), key);
});

test('book parts include chapter/pages and use the book title', () => {
  assert.equal(convert('@inbook{k,author={John Smith},title={Book Title},chapter=2,pages={10-15},publisher={Press},year=2025}'),
    '\\bibitem{k}\nJ. Smith, \\emph{Book Title}. Press, 2025, ch. 2, pp. 10--15.');
});

test('display math and TeX nonbreaking spaces preserve their meaning', () => {
  assert.equal(escapeLatex('$$x_i^2$$ and Section~2'), '$$x_i^2$$ and Section~2');
  assert.equal(parseName('{Jean} Dupont'), 'J. Dupont');
});

test('incomplete records do not acquire repeated terminal punctuation', () => {
  assert.equal(convert('@misc{k,title={Title}}'), '\\bibitem{k}\n``Title.\'\'');
  assert.equal(convert('@manual{k,title={Title}}'), '\\bibitem{k}\n\\emph{Title}.');
  assert.equal(convert('@proceedings{k,title={Title}}'), '\\bibitem{k}\n\\emph{Title}.');
});
