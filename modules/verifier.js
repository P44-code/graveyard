/**
 * Honest Verifier for Graveyard.
 * Verifies model claims against real commit message and input data tokens.
 */
const STOP = new Set(['that', 'this', 'with', 'from', 'were', 'have', 'been', 'file', 'code', 'into', 'also', 'when', 'then', 'than', 'they', 'them', 'will', 'what', 'which', 'their']);

/**
 * Extracts meaningful lowercase words with 4 or more letters.
 * @param {string} text
 * @returns {string[]}
 */
export function extractKeyWords(text) {
  if (typeof text !== 'string') return [];
  const matches = text.toLowerCase().match(/\b[a-z]{4,}\b/g);
  return matches || [];
}

/**
 * Verifies cause of death claim against real commit message.
 * Rule: Take key words (4+ letters, lowercase) from the answer.
 * If at least 60% appear in commit message: "Paraphrased from commit" and show real commit message.
 * Otherwise: Replace with "Cause of death unknown" and mark "Unverified claim removed".
 *
 * @param {string} rawCause
 * @param {string} commitMessage
 * @returns {{ verified: boolean, cause: string, badge: string, ratio: number }}
 */
export function verifyCauseOfDeath(rawCause, commitMessage) {
  const causeWords = extractKeyWords(rawCause || '').filter(w => !STOP.has(w));
  const commitWords = new Set(extractKeyWords(commitMessage || ''));

  if (causeWords.length === 0) {
    return {
      verified: false,
      cause: 'Cause of death unknown',
      badge: 'Unverified claim removed',
      ratio: 0
    };
  }

  const matchCount = causeWords.filter(word => commitWords.has(word)).length;
  const ratio = matchCount / causeWords.length;

  if (ratio >= 0.60) {
    return {
      verified: true,
      cause: (rawCause || '').trim(),
      badge: 'Paraphrased from commit',
      ratio
    };
  }

  return {
    verified: false,
    cause: 'Cause of death unknown',
    badge: 'Unverified claim removed',
    ratio
  };
}

/**
 * Extracts all numbers, dates, or hex hashes from text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractSensitiveTokens(text) {
  if (typeof text !== 'string') return [];

  // 1. Matches standalone numbers, decimals, or years (e.g., 2024, 404, 3.14, 8)
  // 2. Matches dates like 2024-03-15 or 2024/03/15
  // 3. Matches hex strings like a1f4902 or commit hashes
  const tokenRegex = /\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d+(?:\.\d+)?|(?=[0-9a-f]*\d)[0-9a-f]{4,40})\b/gi;
  const found = text.match(tokenRegex) || [];

  return found.map(t => t.toLowerCase());
}

/**
 * Verifies epitaph bounds and factual token containment.
 * Rule: Max 25 words. Any number, hash or date in it must exist in the input data.
 * If not, mark "Epitaph unverified" and show a plain fallback epitaph built from file name and dates.
 *
 * @param {string} rawEpitaph
 * @param {object} inputRecord
 * @returns {{ verified: boolean, epitaph: string, badge: string | null }}
 */
export function verifyEpitaph(rawEpitaph, inputRecord) {
  const text = (rawEpitaph || '').trim();
  const words = text.split(/\s+/).filter(Boolean);

  const fallback = `Here lies ${inputRecord.path || 'departed code'}, created on ${inputRecord.firstCommitDate || 'an unrecorded dawn'} and retired on ${inputRecord.commitDate || 'a quiet dusk'}.`;

  // Condition 1: max 25 words
  if (words.length === 0 || words.length > 25) {
    return {
      verified: false,
      epitaph: fallback,
      badge: 'Epitaph unverified'
    };
  }

  // Build searchable lowercase corpus from trusted ground truth data
  const corpus = [
    inputRecord.path,
    inputRecord.deletedInCommit,
    inputRecord.commitMessage,
    inputRecord.commitDate,
    inputRecord.firstCommitDate,
    inputRecord.lastContent,
    inputRecord.patch
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Find any sensitive token (number, date, or hex hash)
  const tokens = extractSensitiveTokens(text);

  for (const token of tokens) {
    const safe = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exact = new RegExp(`(?<![0-9a-z])${safe}(?![0-9a-z])`);
    if (!exact.test(corpus)) {
      return {
        verified: false,
        epitaph: fallback,
        badge: 'Epitaph unverified'
      };
    }
  }

  return {
    verified: true,
    epitaph: words.join(' '),
    badge: null
  };
}
