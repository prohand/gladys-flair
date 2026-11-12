import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rollChangelog } from '../.github/scripts/changelog-release.mjs';

const REPO = 'https://github.com/prohand/gladys-flair';

test('the Unreleased section moves under the new version', () => {
  const before = [
    '# Changelog',
    '',
    '## [Unreleased]',
    '',
    '### Added',
    '',
    '- Something new.',
    '',
    `[Unreleased]: ${REPO}/commits/main`,
    '',
  ].join('\n');
  const after = rollChangelog(before, '1.0.0', '2026-11-12');
  assert.match(
    after,
    /## \[Unreleased\]\n\n## \[1\.0\.0\] - 2026-11-12\n\n### Added\n\n- Something new\./,
  );
  assert.match(after, new RegExp(`\\[Unreleased\\]: ${REPO}/compare/v1\\.0\\.0\\.\\.\\.HEAD`));
  assert.match(after, new RegExp(`\\[1\\.0\\.0\\]: ${REPO}/releases/tag/v1\\.0\\.0`));
});

test('a second release compares with the previous tag', () => {
  const text = `## [Unreleased]\n\n- Fix.\n\n## [1.0.0] - 2026-11-12\n\n- First.\n\n[Unreleased]: ${REPO}/compare/v1.0.0...HEAD\n`;
  const after = rollChangelog(text, '1.0.1', '2026-11-20');
  assert.match(after, new RegExp(`\\[1\\.0\\.1\\]: ${REPO}/compare/v1\\.0\\.0\\.\\.\\.v1\\.0\\.1`));
});

test('an empty Unreleased section still names the release', () => {
  const after = rollChangelog('## [Unreleased]\n', '1.0.1', '2026-11-20');
  assert.match(after, /## \[1\.0\.1\] - 2026-11-20\n\n- Maintenance release/);
});

test('the repository changelog has an Unreleased section the workflow can roll', async () => {
  const text = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  assert.match(text, /^## \[Unreleased\][ \t]*$/m);
  assert.match(text, /^\[Unreleased\]: https:\/\/github\.com\/prohand\/gladys-flair\//m);
});
