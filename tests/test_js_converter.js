/**
 * Automated Regression Test Runner for JavaScript BibTeX-to-Bibitem Converter.
 * Validates tests/bibtex_test_cases.bib against tests/expected_bibitems.tex.
 *
 * Usage:
 *   node tests/test_js_converter.js
 */

const fs = require('fs');
const path = require('path');
const { parseBibTeX, convertToBibitem } = require('../docs/script.js');

const TESTS_DIR = __dirname;
const BIB_FILE = path.join(TESTS_DIR, 'bibtex_test_cases.bib');
const TEX_FILE = path.join(TESTS_DIR, 'expected_bibitems.tex');

console.log('='.repeat(70));
console.log('RUNNING JAVASCRIPT REGRESSION SUITE');
console.log('='.repeat(70));

if (!fs.existsSync(BIB_FILE) || !fs.existsSync(TEX_FILE)) {
  console.error(`Error: Missing test files at ${BIB_FILE} or ${TEX_FILE}`);
  process.exit(1);
}

const bibContent = fs.readFileSync(BIB_FILE, 'utf8');
const texContent = fs.readFileSync(TEX_FILE, 'utf8');

// Parse expected bibitems
const expectedMap = {};
const bibitemRegex = /\\bibitem\{([^}]+)\}\n([\s\S]*?)(?=\n\n\\bibitem|$)/g;
let match;
while ((match = bibitemRegex.exec(texContent)) !== null) {
  expectedMap[match[1].trim()] = match[2].trim();
}

console.log(`Loaded ${Object.keys(expectedMap).length} expected \\bibitem entries.`);

// Parse BibTeX and convert
const entries = parseBibTeX(bibContent);
console.log(`Parsed ${entries.length} BibTeX entries.`);

const bibitems = convertToBibitem(entries);

let passed = 0;
let failed = 0;
const failures = [];

for (const item of bibitems) {
  const lines = item.trim().split('\n');
  const keyLine = lines[0];
  const idMatch = keyLine.match(/\\bibitem\{([^}]+)\}/);
  if (!idMatch) {
    failed++;
    failures.push({ id: 'unknown', reason: `Malformed bibitem header: ${keyLine}` });
    continue;
  }
  const id = idMatch[1].trim();
  const actualBody = lines.slice(1).join('\n').trim();
  const expectedBody = expectedMap[id];

  if (!expectedBody) {
    failed++;
    failures.push({ id, reason: 'No expected entry found in expected_bibitems.tex' });
    console.log(`✗ ${id}: MISSING EXPECTED`);
  } else if (actualBody === expectedBody) {
    passed++;
    console.log(`✓ ${id}: PASS`);
  } else {
    failed++;
    failures.push({ id, actual: actualBody, expected: expectedBody });
    console.log(`✗ ${id}: FAIL`);
  }
}

console.log('\n' + '='.repeat(70));
console.log(`JS REGRESSION SUITE RESULTS: ${passed}/${Object.keys(expectedMap).length} passed (Failed: ${failed})`);
console.log('='.repeat(70));

if (failed > 0) {
  console.error('\nFailures breakdown:');
  for (const f of failures) {
    console.error(`\n--- [${f.id}] ---`);
    if (f.reason) {
      console.error(f.reason);
    } else {
      console.error('ACTUAL:\n' + f.actual);
      console.error('EXPECTED:\n' + f.expected);
    }
  }
  process.exit(1);
} else {
  console.log('\n🎉 ALL JAVASCRIPT REGRESSION TESTS PASSED (100% MATCH)!\n');
  process.exit(0);
}

