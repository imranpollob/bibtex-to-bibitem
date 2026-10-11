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

test('brand launcher loads from the live theme host and mounts last in the nav actions', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.ok(html.includes('<link rel="stylesheet" href="https://imranpollob.github.io/personal-brand-theme/launcher.css">'));
  assert.ok(html.includes('<script src="https://imranpollob.github.io/personal-brand-theme/launcher.js" defer></script>'));
  const navActions = html.match(/<div class="nav-actions">([\s\S]*?)<\/div>/);
  assert.ok(navActions, 'missing .nav-actions');
  const inner = navActions[1];
  assert.ok(inner.includes('<span data-brand-launcher></span>'));
  assert.ok(inner.indexOf('data-brand-launcher') > inner.indexOf('id="theme-toggle"'));
  assert.match(inner.trimEnd(), /<span data-brand-launcher><\/span>\s*$/);
});
