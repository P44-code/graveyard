#!/usr/bin/env node
/**
 * @file scripts/export-deleted.mjs
 * Extracts the 10 most recently deleted files from the current Git repository
 * and exports them to `graveyard.json` for the Graveyard web application.
 *
 * Security: Uses only Node built-in modules and `child_process.execFile` with argument arrays.
 * Never executes code from the repository or invokes a shell.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);

// Non-negotiable security warning
console.warn('\x1b[33m%s\x1b[0m', 'Run this only on repositories you trust, because git can run commands from a repo\'s own config.');

async function runGit(args) {
  try {
    const { stdout } = await execFileAsync('git', args, {
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true
    });
    return stdout;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('Git executable not found in PATH.');
    }
    throw err;
  }
}

async function exportDeletedFiles() {
  console.log('Inspecting repository burial records...');

  // 1. Fetch commits containing deletions
  // Format: COMMIT:<hash>|<date>|<subject>
  const logOutput = await runGit([
    'log',
    '--diff-filter=D',
    '--name-only',
    '-n', '30',
    '--format=COMMIT:%H|%ad|%s',
    '--date=short'
  ]);

  const lines = logOutput.split('\n');
  const deletedEntries = [];
  let currentCommit = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('COMMIT:')) {
      const parts = line.slice('COMMIT:'.length).split('|');
      currentCommit = {
        hash: parts[0] || '',
        date: parts[1] || 'Unknown Date',
        message: parts.slice(2).join('|') || 'No commit message'
      };
    } else if (currentCommit) {
      // The line is a deleted file path
      const filePath = line;
      // Deduplicate by path
      if (!deletedEntries.some(e => e.path === filePath)) {
        deletedEntries.push({
          path: filePath,
          deletedInCommit: currentCommit.hash,
          commitDate: currentCommit.date,
          commitMessage: currentCommit.message
        });
      }
    }

    if (deletedEntries.length >= 10) break;
  }

  if (deletedEntries.length === 0) {
    console.log('No deleted files discovered in this repository history.');
    return;
  }

  console.log(`Found ${deletedEntries.length} deceased files. Retrieving final states and patches...`);

  const results = [];

  for (const entry of deletedEntries) {
    // 2. Fetch the last committed content right before deletion (commit^:path)
    let lastContent = '';
    try {
      lastContent = await runGit(['show', `${entry.deletedInCommit}^:${entry.path}`]);
    } catch {
      lastContent = '/* Unable to retrieve parent content snapshot. */';
    }

    // 3. Fetch deletion patch diff
    let patch = '';
    try {
      patch = await runGit(['show', entry.deletedInCommit, '--', entry.path]);
    } catch {
      patch = '';
    }

    // 4. Retrieve initial birth date (first commit touching this path)
    let firstCommitDate = entry.commitDate;
    try {
      const firstLog = await runGit([
        'log',
        '--follow',
        '--format=%ad',
        '--date=short',
        '--',
        entry.path
      ]);
      const dates = firstLog.trim().split('\n').filter(Boolean);
      if (dates.length > 0) {
        firstCommitDate = dates[dates.length - 1];
      }
    } catch {
      // Fallback to commitDate
    }

    results.push({
      path: entry.path,
      deletedInCommit: entry.deletedInCommit,
      commitMessage: entry.commitMessage,
      commitDate: entry.commitDate,
      firstCommitDate,
      lastContent: lastContent.slice(0, 3000),
      patch: patch.slice(0, 3000)
    });
  }

  const outputPath = resolve(process.cwd(), 'graveyard.json');
  await writeFile(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\x1b[32mSuccessfully exported ${results.length} records to ${outputPath}\x1b[0m`);
  console.log('You can now upload or paste graveyard.json into the Graveyard web application.');
}

exportDeletedFiles().catch((err) => {
  console.error('\x1b[31mError exporting deleted files:\x1b[0m', err.message);
  process.exit(1);
});
