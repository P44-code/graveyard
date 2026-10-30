/**
 * Input validation and sanitization module for Graveyard.
 * Enforces strict length limits, JSON schema compliance, and control-character stripping.
 */

export const LIMITS = {
  MAX_FILE_BYTES: 1024 * 1024, // 1 MB
  MAX_ITEMS: 10,
  MAX_CONTENT_CHARS: 3000,
  MAX_PATCH_CHARS: 3000,
  MAX_PATH_CHARS: 255,
  MAX_COMMIT_MSG_CHARS: 500
};

/**
 * Strips dangerous control characters except \t, \n, and \r.
 */
export function stripControlChars(str) {
  if (typeof str !== 'string') return '';
  // Strips ASCII 0-8, 11-12, 14-31, and 127 (DEL)
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Validates and sanitizes an untrusted JSON string or parsed object into an array of grave records.
 * @param {string | unknown} rawInput
 * @returns {{ valid: boolean, data?: Array<any>, error?: string, warnings?: string[] }}
 */
export function sanitizeInputData(rawInput) {
  const warnings = [];

  // Check byte size if rawInput is string
  if (typeof rawInput === 'string') {
    const byteLength = new Blob([rawInput]).size;
    if (byteLength > LIMITS.MAX_FILE_BYTES) {
      return {
        valid: false,
        error: `Input exceeds maximum allowed size of 1 MB (${(byteLength / 1024 / 1024).toFixed(2)} MB uploaded).`
      };
    }
  }

  let parsed;
  if (typeof rawInput === 'string') {
    try {
      parsed = JSON.parse(rawInput);
    } catch (err) {
      return {
        valid: false,
        error: `Invalid JSON syntax: ${err instanceof Error ? err.message : 'failed to parse'}`
      };
    }
  } else {
    parsed = rawInput;
  }

  if (!Array.isArray(parsed)) {
    return {
      valid: false,
      error: 'Input must be a JSON array of deleted file records [{ path, deletedInCommit, ... }].'
    };
  }

  if (parsed.length === 0) {
    return {
      valid: false,
      error: 'Input array is empty. Please provide at least one dead file record.'
    };
  }

  if (parsed.length > LIMITS.MAX_ITEMS) {
    warnings.push(`Capped input to the 10 most recent files (original contained ${parsed.length}).`);
  }

  const slice = parsed.slice(0, LIMITS.MAX_ITEMS);
  const sanitized = [];

  for (let i = 0; i < slice.length; i++) {
    const item = slice[i];
    if (!item || typeof item !== 'object') {
      return {
        valid: false,
        error: `Entry at index ${i} is not a valid object.`
      };
    }

    const path = stripControlChars(String(item.path || `unnamed-file-${i + 1}`)).slice(0, LIMITS.MAX_PATH_CHARS);
    const deletedInCommit = stripControlChars(String(item.deletedInCommit || 'unknown')).slice(0, 64);
    const commitMessage = stripControlChars(String(item.commitMessage || 'No commit message provided.')).slice(0, LIMITS.MAX_COMMIT_MSG_CHARS);
    const commitDate = stripControlChars(String(item.commitDate || 'Unknown Date')).slice(0, 32);
    const firstCommitDate = stripControlChars(String(item.firstCommitDate || 'Unknown Date')).slice(0, 32);

    let lastContent = stripControlChars(String(item.lastContent || ''));
    if (lastContent.length > LIMITS.MAX_CONTENT_CHARS) {
      lastContent = lastContent.slice(0, LIMITS.MAX_CONTENT_CHARS) + '\n/* ... [Content truncated at 3,000 characters for safety] ... */';
    }

    let patch = stripControlChars(String(item.patch || ''));
    if (patch.length > LIMITS.MAX_PATCH_CHARS) {
      patch = patch.slice(0, LIMITS.MAX_PATCH_CHARS) + '\n/* ... [Patch truncated at 3,000 characters for safety] ... */';
    }

    sanitized.push({
      id: `grave-${i}-${Date.now()}`,
      path,
      deletedInCommit,
      commitMessage,
      commitDate,
      firstCommitDate,
      lastContent,
      patch
    });
  }

  return {
    valid: true,
    data: sanitized,
    warnings
  };
}
