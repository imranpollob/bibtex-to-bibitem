import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('production app loads assets at the GitHub Pages subpath and converts every sample', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().startsWith('http://127.') && response.status() >= 400) errors.push(response.url()); });
  await page.goto('./');
  await expect(page.locator('h1')).toHaveCount(1);
  for (const sample of ['article', 'conference', 'book', 'suite']) {
    await page.locator(`[data-sample="${sample}"]`).click();
    await expect(page.locator('#bibitem-output')).toHaveValue(/\\bibitem\{/);
    await expect(page.locator('#output-badge')).toHaveText(sample === 'suite' ? '6 converted' : '1 converted');
  }
  await expect(page.locator('#convert-btn')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('malformed input clears stale output and disables export; clear cancels pending conversion', async ({ page }) => {
  await page.goto('./');
  await page.locator('[data-sample="book"]').click();
  await page.locator('#bibtex-input').fill('@misc{k,title={Unclosed');
  await expect(page.locator('#output-info')).toContainText('Error:');
  await expect(page.locator('#bibitem-output')).toHaveValue('');
  await expect(page.locator('#copy-btn')).toBeDisabled();
  await expect(page.locator('#download-btn')).toBeDisabled();
  await expect(page.locator('#output-badge')).toHaveText('0 converted');
  await page.locator('#bibtex-input').fill('@misc{k,title={Okay}}');
  await page.locator('#clear-input').click();
  await page.waitForTimeout(500);
  await expect(page.locator('#bibtex-input')).toHaveValue('');
  await expect(page.locator('#bibitem-output')).toHaveValue('');
});

test('upload, metadata warnings, clipboard and .tex download work', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./');
  await page.locator('#file-upload').setInputFiles({ name: 'references.bib', mimeType: 'text/plain', buffer: Buffer.from('@misc{k,title={Research}}') });
  await expect(page.locator('#conversion-warnings')).toContainText('Missing publication year');
  const output = await page.locator('#bibitem-output').inputValue();
  await page.locator('#copy-btn').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(output);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download-btn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('bibitems.tex');
  expect(await readFile(await download.path(), 'utf8')).toBe(output);
});

test('file names and warnings are displayed as text, not HTML', async ({ page }) => {
  await page.goto('./');
  await page.locator('#file-upload').setInputFiles({ name: '<img src=x onerror=alert(1)>.bib', mimeType: 'text/plain', buffer: Buffer.from('@misc{k,title={T}}') });
  await expect(page.locator('.toast')).toContainText('<img');
  await expect(page.locator('.toast img')).toHaveCount(0);
});

test('mobile layout fits the viewport and theme survives reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('#theme-toggle').click();
  const theme = await page.locator('html').getAttribute('data-theme');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
});

test('conversion still works when persistent browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage denied'); } }));
  await page.goto('./');
  await page.locator('#theme-toggle').click();
  await page.locator('[data-sample="book"]').click();
  await expect(page.locator('#bibitem-output')).toHaveValue(/\\bibitem/);
});
