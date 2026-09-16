import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HtmlValidate } from 'html-validate';

test('HTML validates, with one page title, heading, and canonical URL', async () => {
  const html = readFileSync('index.html', 'utf8');
  const report = await new HtmlValidate().validateString(html);
  assert.equal(report.valid, true, JSON.stringify(report.results));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.ok(!html.includes('BibTeX-to-Bibitem/'));
});
