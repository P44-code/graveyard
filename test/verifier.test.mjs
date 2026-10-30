import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { verifyCauseOfDeath, verifyEpitaph, extractKeyWords, extractSensitiveTokens } from '../modules/verifier.js';
import { sanitizeInputData } from '../modules/sanitizer.js';
import { OllamaAdapter, OLLAMA_MODEL } from '../modules/adapters.js';

describe('Verifier Unit Tests', () => {
  describe('extractKeyWords', () => {
    test('extracts only lowercase words with 4 or more letters', () => {
      const words = extractKeyWords('Fix the legacy memory leak in Chrome');
      assert.deepEqual(words, ['legacy', 'memory', 'leak', 'chrome']);
    });

    test('returns empty array for short words and non-strings', () => {
      assert.deepEqual(extractKeyWords('fix it up'), []);
      assert.deepEqual(extractKeyWords(null), []);
    });
  });

  describe('verifyCauseOfDeath', () => {
    test('accepts cause when >= 60% of key words appear in commit message', () => {
      const commit = 'Drop Internet Explorer 8 shims and legacy ActiveX event wrappers';
      const cause = 'Drop Internet Explorer 8 shims and legacy wrappers';
      const result = verifyCauseOfDeath(cause, commit);

      assert.equal(result.verified, true);
      assert.equal(result.badge, 'Paraphrased from commit');
      assert.equal(result.cause, cause);
      assert.ok(result.ratio >= 0.60);
    });

    test('rejects cause when keywords do not match commit message (e.g. "fix stuff")', () => {
      const commit = 'fix stuff';
      const cause = 'Catastrophic memory leak crashed the browser runtime repeatedly';
      const result = verifyCauseOfDeath(cause, commit);

      assert.equal(result.verified, false);
      assert.equal(result.cause, 'Cause of death unknown');
      assert.equal(result.badge, 'Unverified claim removed');
    });

    test('handles empty cause gracefully', () => {
      const result = verifyCauseOfDeath('', 'some commit');
      assert.equal(result.verified, false);
      assert.equal(result.cause, 'Cause of death unknown');
    });
  });

  describe('extractSensitiveTokens', () => {
    test('extracts years, numbers, dates and hex hashes', () => {
      const text = 'Buried on 2024-03-15 after 6 confirmations in commit a1f4902 with 404 errors.';
      const tokens = extractSensitiveTokens(text);
      assert.ok(tokens.includes('2024-03-15'));
      assert.ok(tokens.includes('6'));
      assert.ok(tokens.includes('a1f4902'));
      assert.ok(tokens.includes('404'));
    });
  });

  describe('verifyEpitaph', () => {
    const sampleRecord = {
      path: 'src/billing/dogecoin-gateway.ts',
      deletedInCommit: 'a1f490283c7de91e847620bc12304918237192ab',
      commitMessage: 'Remove experimental Dogecoin checkout adapter',
      commitDate: '2023-11-04',
      firstCommitDate: '2021-05-08',
      lastContent: 'const confirmations = 6;',
      patch: '- confirmations = 6;'
    };

    test('accepts epitaph under 25 words with verified numbers from corpus', () => {
      const epitaph = 'Awaiting 6 confirmations that never came in dogecoin-gateway.';
      const result = verifyEpitaph(epitaph, sampleRecord);

      assert.equal(result.verified, true);
      assert.equal(result.badge, null);
      assert.equal(result.epitaph, epitaph);
    });

    test('rejects epitaph exceeding 25 words', () => {
      const longEpitaph = 'Word '.repeat(26);
      const result = verifyEpitaph(longEpitaph, sampleRecord);

      assert.equal(result.verified, false);
      assert.equal(result.badge, 'Epitaph unverified');
      assert.ok(result.epitaph.startsWith('Here lies'));
    });

    test('rejects epitaph containing numbers/dates not present in input record', () => {
      // "999" is not in sampleRecord
      const epitaphWithHallucinatedNumber = 'Failed after 999 retries in production.';
      const result = verifyEpitaph(epitaphWithHallucinatedNumber, sampleRecord);

      assert.equal(result.verified, false);
      assert.equal(result.badge, 'Epitaph unverified');
      assert.ok(result.epitaph.startsWith('Here lies'));
    });
  });
});

describe('Sanitizer Unit Tests', () => {
  test('rejects oversized input payload (> 1 MB)', () => {
    const huge = JSON.stringify(new Array(70000).fill({ path: 'huge-file-name-path.js' }));
    const result = sanitizeInputData(huge);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('1 MB'));
  });

  test('caps records at 10 items', () => {
    const items = [];
    for (let i = 0; i < 15; i++) {
      items.push({
        path: `file-${i}.js`,
        deletedInCommit: 'abc',
        commitMessage: 'delete',
        commitDate: '2024-01-01',
        firstCommitDate: '2020-01-01',
        lastContent: 'code',
        patch: 'diff'
      });
    }
    const result = sanitizeInputData(items);
    assert.equal(result.valid, true);
    assert.equal(result.data.length, 10);
    assert.ok(result.warnings.length > 0);
  });

  test('truncates lastContent and patch at 3,000 characters', () => {
    const item = {
      path: 'long.js',
      deletedInCommit: 'abc',
      commitMessage: 'drop long',
      commitDate: '2024-01-01',
      firstCommitDate: '2020-01-01',
      lastContent: 'A'.repeat(4000),
      patch: 'B'.repeat(4000)
    };
    const result = sanitizeInputData([item]);
    assert.equal(result.valid, true);
    assert.ok(result.data[0].lastContent.includes('[Content truncated at 3,000 characters for safety]'));
    assert.ok(result.data[0].patch.includes('[Patch truncated at 3,000 characters for safety]'));
  });

  test('strips dangerous control characters', () => {
    const item = {
      path: 'bad\x00file\x07.js',
      deletedInCommit: 'abc\x1b',
      commitMessage: 'test\x0cmsg',
      commitDate: '2024-01-01',
      firstCommitDate: '2020-01-01',
      lastContent: 'valid\tcode\nline',
      patch: 'diff'
    };
    const result = sanitizeInputData([item]);
    assert.equal(result.valid, true);
    assert.equal(result.data[0].path, 'badfile.js');
    assert.equal(result.data[0].deletedInCommit, 'abc');
    assert.equal(result.data[0].commitMessage, 'testmsg');
  });
});

describe('Ollama Security Guards', () => {
  test('allows gemma3:4b', () => {
    const adapter = new OllamaAdapter(OLLAMA_MODEL);
    assert.equal(adapter.model, 'gemma3:4b');
  });

  test('throws immediately if model does not start with gemma', () => {
    assert.throws(() => {
      new OllamaAdapter('gemini-2.5-pro');
    }, /Security policy violation/);

    assert.throws(() => {
      new OllamaAdapter('llama3:8b');
    }, /Security policy violation/);

    assert.throws(() => {
      new OllamaAdapter('claude-3-opus');
    }, /Security policy violation/);
  });
});
