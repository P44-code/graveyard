

import { sanitizeInputData } from './modules/sanitizer.js';
import { DemoAdapter, OllamaAdapter } from './modules/adapters.js';
import { verifyCauseOfDeath, verifyEpitaph } from './modules/verifier.js';

// Application State
const state = {
  mode: 'demo',
  records: [],
  processedCards: [],
  failuresList: [],
  activeAdapter: new DemoAdapter(),
  isProcessing: false,
  metrics: {
    engine: 'Demo (Canned)',
    filesCount: 0,
    totalLatencyMs: 0,
    claimsRemoved: 0
  }
};

// UI Elements
const el = {
  btnModeDemo: document.getElementById('btnModeDemo'),
  btnModeLocal: document.getElementById('btnModeLocal'),
  privacyNotice: document.getElementById('privacyNotice'),
  privacyText: document.getElementById('privacyText'),
  localOllamaBanner: document.getElementById('localOllamaBanner'),
  localOllamaHelpText: document.getElementById('localOllamaHelpText'),
  statusBanner: document.getElementById('statusBanner'),
  statusMessage: document.getElementById('statusMessage'),
  fileUploadInput: document.getElementById('fileUploadInput'),
  jsonTextInput: document.getElementById('jsonTextInput'),
  btnLoadDemo: document.getElementById('btnLoadDemo'),
  btnProcessInput: document.getElementById('btnProcessInput'),
  btnClearInput: document.getElementById('btnClearInput'),
  cemeteryGrid: document.getElementById('cemeteryGrid'),
  metricEngine: document.getElementById('metricEngine'),
  metricFilesCount: document.getElementById('metricFilesCount'),
  metricAvgLatency: document.getElementById('metricAvgLatency'),
  metricClaimsRemoved: document.getElementById('metricClaimsRemoved'),
  btnCopyMetrics: document.getElementById('btnCopyMetrics'),
  btnDownloadFailures: document.getElementById('btnDownloadFailures'),
  // Modal Elements
  resurrectModal: document.getElementById('resurrectModal'),
  modalFileName: document.getElementById('modalFileName'),
  modalMeta: document.getElementById('modalMeta'),
  modalCodeContent: document.getElementById('modalCodeContent'),
  btnModalClose: document.getElementById('btnModalClose'),
  btnModalCopy: document.getElementById('btnModalCopy'),
  btnModalDismiss: document.getElementById('btnModalDismiss')
};


let lastActiveTrigger = null;

/**
 * Initializes the application.
 */
async function init() {
  bindEvents();
  await loadDefaultDemo();
}

/**
 * Event bindings
 */
function bindEvents() {
  el.btnModeDemo.addEventListener('click', () => setMode('demo'));
  el.btnModeLocal.addEventListener('click', () => setMode('local'));

  el.btnLoadDemo.addEventListener('click', () => loadDefaultDemo());
  el.btnProcessInput.addEventListener('click', () => handleManualInput());
  el.btnClearInput.addEventListener('click', () => {
    el.jsonTextInput.value = '';
    el.fileUploadInput.value = '';
    showStatus('Input cleared.', 'normal');
  });

  el.fileUploadInput.addEventListener('change', handleFileUpload);

  el.btnCopyMetrics.addEventListener('click', copyMetricsToClipboard);
  el.btnDownloadFailures.addEventListener('click', downloadFailuresJson);

  // Modal events
  el.btnModalClose.addEventListener('click', closeModal);
  el.btnModalDismiss.addEventListener('click', closeModal);
  el.btnModalCopy.addEventListener('click', copyModalCode);

  el.resurrectModal.addEventListener('click', (e) => {
    if (e.target === el.resurrectModal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.resurrectModal.classList.contains('open')) {
      closeModal();
    }
  });
}

/**
 * Switch operational mode between Demo and Local
 */
async function setMode(newMode) {
  if (state.mode === newMode) return;
  state.mode = newMode;

  if (newMode === 'demo') {
    el.btnModeDemo.classList.add('active');
    el.btnModeDemo.setAttribute('aria-checked', 'true');
    el.btnModeLocal.classList.remove('active');
    el.btnModeLocal.setAttribute('aria-checked', 'false');

    el.privacyText.textContent = 'Demo mode: no model is used, nothing leaves your device';
    el.localOllamaBanner.classList.remove('active');
    state.activeAdapter = new DemoAdapter();
    state.metrics.engine = 'Demo (Canned)';
    showStatus('Switched to Demo Mode (offline, canned eulogies).', 'success');
  } else {
    el.btnModeLocal.classList.add('active');
    el.btnModeLocal.setAttribute('aria-checked', 'true');
    el.btnModeDemo.classList.remove('active');
    el.btnModeDemo.setAttribute('aria-checked', 'false');

    el.privacyText.textContent = 'Local mode: everything stays on your computer';
    el.localOllamaBanner.classList.add('active');
    state.activeAdapter = new OllamaAdapter();
    state.metrics.engine = 'Local Gemma (gemma3:4b)';
    showStatus('Switched to Local Gemma Mode (http://localhost:11434).', 'normal');
  }

  updateMetricsDisplay();

  // If there are currently loaded records, re-run memorial processing under new mode
  if (state.records.length > 0) {
    await processMemorials(state.records);
  }
}

/**
 * Loads default sample demo records
 */
async function loadDefaultDemo() {
  try {
    showStatus('Gathering deceased code samples for memorial vigil...', 'normal');
    const response = await fetch('./sample/demo-data.json');
    if (!response.ok) {
      throw new Error(`Failed to load demo-data.json: HTTP ${response.status}`);
    }
    const raw = await response.text();
    const sanitizedResult = sanitizeInputData(raw);

    if (!sanitizedResult.valid) {
      throw new Error(sanitizedResult.error);
    }

    state.records = sanitizedResult.data;
    await processMemorials(state.records);
    showStatus('6 departed files honored with solemn tombstones.', 'success');
  } catch (err) {
    showStatus(`Failed to load sample graveyard: ${err.message}`, 'error');
  }
}

/**
 * Handles JSON file upload from user
 */
function handleFileUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (file.size > 1024 * 1024) {
    showStatus('File exceeds 1 MB limit. Rejected for safety.', 'error');
    el.fileUploadInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (event) => {
    const content = event.target.result;
    el.jsonTextInput.value = content;
    await handleManualInput();
  };
  reader.onerror = () => {
    showStatus('Error reading uploaded file.', 'error');
  };
  reader.readAsText(file);
}

/**
 * Validates and processes user-supplied JSON from textarea
 */
async function handleManualInput() {
  const raw = el.jsonTextInput.value.trim();
  if (!raw) {
    showStatus('Please provide JSON data in the box or upload a graveyard.json file.', 'error');
    return;
  }

  const result = sanitizeInputData(raw);
  if (!result.valid) {
    showStatus(`Validation error: ${result.error}`, 'error');
    return;
  }

  if (result.warnings && result.warnings.length > 0) {
    showStatus(result.warnings.join(' '), 'normal');
  }

  state.records = result.data;
  await processMemorials(state.records);
}

/**
 * Memorial processing pipeline:
 * For each record, calls active ModelAdapter, passes results to Verifier,
 * and renders headstones safely into the DOM.
 */
async function processMemorials(records) {
  if (state.isProcessing) return;
  state.isProcessing = true;

  // Clear existing tombstones
  while (el.cemeteryGrid.firstChild) {
    el.cemeteryGrid.removeChild(el.cemeteryGrid.firstChild);
  }

  state.processedCards = [];
  state.metrics.filesCount = records.length;
  state.metrics.totalLatencyMs = 0;
  state.metrics.claimsRemoved = 0;

  // Temporary loading notice
  const loadingNotice = document.createElement('p');
  loadingNotice.className = 'status-banner visible';
  loadingNotice.textContent = `Summoning eulogies via ${state.activeAdapter.name}...`;
  el.cemeteryGrid.appendChild(loadingNotice);

  try {
    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      let rawModelOutput;
      try {
        rawModelOutput = await state.activeAdapter.generateEulogy(record);
      } catch (err) {
        if (state.mode === 'local') {
          // Provide exact required guidance for Ollama troubleshooting
          el.localOllamaBanner.classList.add('active');
          el.localOllamaHelpText.textContent = "Start Ollama and run 'ollama pull gemma3:4b'. If the browser blocks the request, set OLLAMA_ORIGINS=http://localhost:5173 and restart Ollama. Do not use *.";
        }
        throw new Error(`Generation error for "${record.path}": ${err.message}`);
      }

      state.metrics.totalLatencyMs += rawModelOutput.latencyMs;

      // Run Honest Verifier
      const verifiedCause = verifyCauseOfDeath(rawModelOutput.causeOfDeath, record.commitMessage);
      const verifiedEpitaph = verifyEpitaph(rawModelOutput.epitaph, record);

      if (!verifiedCause.verified) {
        state.metrics.claimsRemoved++;
      }

      const cardData = {
        record,
        epitaph: verifiedEpitaph.epitaph,
        rawEpitaph: rawModelOutput.epitaph,
        causeOfDeath: verifiedCause.cause,
        rawCause: rawModelOutput.causeOfDeath,
        causeBadge: verifiedCause.badge,
        causeVerified: verifiedCause.verified,
        epitaphBadge: verifiedEpitaph.badge,
        latencyMs: rawModelOutput.latencyMs,
        markedWrong: false
      };

      state.processedCards.push(cardData);
    }

    // Remove loading placeholder
    if (loadingNotice.parentNode) {
      loadingNotice.parentNode.removeChild(loadingNotice);
    }

    // Render all tombstones
    const fragment = document.createDocumentFragment();
    state.processedCards.forEach((card, index) => {
      const tombstoneEl = renderTombstone(card, index);
      fragment.appendChild(tombstoneEl);
    });
    el.cemeteryGrid.appendChild(fragment);

    updateMetricsDisplay();
    showStatus(`The vigil is prepared. ${records.length} files resting peacefully.`, 'success');
  } catch (err) {
    // Clean loading placeholder
    if (loadingNotice.parentNode) {
      loadingNotice.parentNode.removeChild(loadingNotice);
    }
    showStatus(err.message, 'error');
  } finally {
    state.isProcessing = false;
  }
}

/**
 * Builds a CSS-only arched tombstone using strict textContent / DOM APIs.
 * NO innerHTML or insertAdjacentHTML used anywhere.
 */
function renderTombstone(card, index) {
  const { record, epitaph, causeOfDeath, causeBadge, causeVerified, epitaphBadge } = card;

  const tombstone = document.createElement('article');
  tombstone.className = 'tombstone';
  tombstone.setAttribute('tabindex', '0');
  tombstone.setAttribute('aria-label', `Tombstone of ${record.path}`);

  // Headstone ornament / symbol
  const ornament = document.createElement('div');
  ornament.className = 'tombstone-ornament';
  ornament.setAttribute('aria-hidden', 'true');
  ornament.textContent = '\u2020'; // Dagger / cross symbol
  tombstone.appendChild(ornament);

  // Header: file path + dates
  const header = document.createElement('header');
  header.className = 'tombstone-header';

  const nameEl = document.createElement('h3');
  nameEl.className = 'tombstone-name';
  nameEl.textContent = record.path;
  header.appendChild(nameEl);

  const datesEl = document.createElement('div');
  datesEl.className = 'tombstone-dates';
  datesEl.textContent = `b. ${record.firstCommitDate} \u2014 d. ${record.commitDate}`;
  header.appendChild(datesEl);

  tombstone.appendChild(header);

  // Body: Epitaph + Cause of death
  const body = document.createElement('div');
  body.className = 'tombstone-body';

  const epitaphEl = document.createElement('blockquote');
  epitaphEl.className = 'epitaph-box';
  epitaphEl.textContent = `\u201C${epitaph}\u201D`;
  body.appendChild(epitaphEl);

  const causeBox = document.createElement('div');
  causeBox.className = 'cause-box';

  const causeTitle = document.createElement('div');
  causeTitle.className = 'cause-title';

  const causeLabel = document.createElement('span');
  causeLabel.textContent = 'Cause of Death';
  causeTitle.appendChild(causeLabel);

  // Commit hash pill
  const shortHash = record.deletedInCommit ? record.deletedInCommit.slice(0, 7) : 'unknown';
  const hashPill = document.createElement('span');
  hashPill.className = 'commit-hash-pill';
  hashPill.textContent = `[${shortHash}]`;
  hashPill.title = `Buried in commit ${record.deletedInCommit}`;
  causeTitle.appendChild(hashPill);

  causeBox.appendChild(causeTitle);

  const causeDesc = document.createElement('p');
  causeDesc.className = 'cause-desc';
  causeDesc.textContent = causeOfDeath;
  causeBox.appendChild(causeDesc);

  // If paraphrased from commit, show the real commit message beside it
  if (causeVerified) {
    const realNote = document.createElement('div');
    realNote.className = 'commit-real-note';
    realNote.textContent = `Commit: \u201C${record.commitMessage}\u201D`;
    causeBox.appendChild(realNote);
  } else {
    // When claim was removed, also show real commit message for full transparency
    const unverifiedNote = document.createElement('div');
    unverifiedNote.className = 'commit-real-note';
    unverifiedNote.textContent = `Original commit msg: \u201C${record.commitMessage}\u201D`;
    causeBox.appendChild(unverifiedNote);
  }

  body.appendChild(causeBox);

  // Status badges
  const badgeStack = document.createElement('div');
  badgeStack.className = 'badge-stack';

  if (causeBadge) {
    const b = document.createElement('span');
    b.className = `badge ${causeVerified ? 'badge-verified' : 'badge-unverified'}`;
    b.textContent = causeBadge;
    badgeStack.appendChild(b);
  }

  if (epitaphBadge) {
    const b = document.createElement('span');
    b.className = 'badge badge-unverified';
    b.textContent = epitaphBadge;
    badgeStack.appendChild(b);
  }

  if (card.markedWrong) {
    const b = document.createElement('span');
    b.className = 'badge badge-wronged';
    b.textContent = 'User Flagged';
    badgeStack.appendChild(b);
  }

  body.appendChild(badgeStack);
  tombstone.appendChild(body);

  // Footer: Resurrect button and Mark this wrong button
  const footer = document.createElement('footer');
  footer.className = 'tombstone-footer';

  const btnResurrect = document.createElement('button');
  btnResurrect.type = 'button';
  btnResurrect.className = 'btn-resurrect';
  btnResurrect.textContent = '\u2699 Resurrect Code';
  btnResurrect.setAttribute('aria-label', `Resurrect code snippet for ${record.path}`);
  btnResurrect.addEventListener('click', () => {
    lastActiveTrigger = btnResurrect;
    openResurrectModal(record);
  });
  footer.appendChild(btnResurrect);

  const btnWrong = document.createElement('button');
  btnWrong.type = 'button';
  btnWrong.className = `btn-mark-wrong ${card.markedWrong ? 'marked' : ''}`;
  btnWrong.textContent = card.markedWrong ? '\u2713 Flagged' : 'Mark this wrong';
  btnWrong.setAttribute('aria-label', `Flag memorial as inaccurate for ${record.path}`);
  btnWrong.addEventListener('click', () => toggleMarkWrong(card, btnWrong, tombstone));
  footer.appendChild(btnWrong);

  tombstone.appendChild(footer);
  return tombstone;
}

/**
 * Flags or unflags a tombstone as wrong, updating in-memory failures audit list
 */
function toggleMarkWrong(card, buttonEl, tombstoneEl) {
  card.markedWrong = !card.markedWrong;

  if (card.markedWrong) {
    buttonEl.classList.add('marked');
    buttonEl.textContent = '\u2713 Flagged';
    state.failuresList.push({
      path: card.record.path,
      commitHash: card.record.deletedInCommit,
      commitMessage: card.record.commitMessage,
      generatedEpitaph: card.rawEpitaph,
      generatedCauseOfDeath: card.rawCause,
      flaggedAt: new Date().toISOString()
    });
    showStatus(`Flagged "${card.record.path}" for audit inspection.`, 'normal');
  } else {
    buttonEl.classList.remove('marked');
    buttonEl.textContent = 'Mark this wrong';
    state.failuresList = state.failuresList.filter(f => f.path !== card.record.path);
    showStatus(`Unflagged "${card.record.path}".`, 'normal');
  }

  // Update failure download button state
  el.btnDownloadFailures.disabled = state.failuresList.length === 0;
  el.btnDownloadFailures.textContent = `Download Failures (${state.failuresList.length})`;
}

/**
 * Downloads flagged failures as a formatted JSON file
 */
function downloadFailuresJson() {
  if (state.failuresList.length === 0) return;

  const jsonStr = JSON.stringify(state.failuresList, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `graveyard-failures-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showStatus(`Exported ${state.failuresList.length} failure records.`, 'success');
}

/**
 * Opens the Resurrect Modal to inspect deleted source code
 */
function openResurrectModal(record) {
  el.modalFileName.textContent = record.path;
  const shortHash = record.deletedInCommit ? record.deletedInCommit.slice(0, 7) : 'unknown';
  el.modalMeta.textContent = `Buried in commit ${shortHash} on ${record.commitDate} \u2022 Original message: "${record.commitMessage}"`;
  el.modalCodeContent.textContent = record.lastContent || record.patch || '/* No source content found in repository burial records. */';

  el.resurrectModal.classList.add('open');
  el.resurrectModal.setAttribute('aria-hidden', 'false');
  el.btnModalClose.focus();
}

/**
 * Closes Resurrect Modal and returns focus
 */
function closeModal() {
  el.resurrectModal.classList.remove('open');
  el.resurrectModal.setAttribute('aria-hidden', 'true');
  if (lastActiveTrigger) {
    lastActiveTrigger.focus();
  }
}

/**
 * Copies resurrect modal code to clipboard
 */
async function copyModalCode() {
  const code = el.modalCodeContent.textContent;
  try {
    await navigator.clipboard.writeText(code);
    const originalText = el.btnModalCopy.textContent;
    el.btnModalCopy.textContent = '\u2713 Copied!';
    setTimeout(() => {
      el.btnModalCopy.textContent = originalText;
    }, 1500);
  } catch (err) {
    showStatus('Failed to copy to clipboard.', 'error');
  }
}

/**
 * Copies current metrics to clipboard
 */
async function copyMetricsToClipboard() {
  const avgLat = state.metrics.filesCount > 0
    ? Math.round(state.metrics.totalLatencyMs / state.metrics.filesCount)
    : 0;

  const text = [
    '=== Graveyard Cemetery Metrics ===',
    `Active Engine: ${state.metrics.engine}`,
    `Files Memorialized: ${state.metrics.filesCount}`,
    `Average Latency: ${avgLat} ms`,
    `Unverified Claims Filtered: ${state.metrics.claimsRemoved}`,
    `User Flagged Failures: ${state.failuresList.length}`
  ].join('\n');

  try {
    await navigator.clipboard.writeText(text);
    const orig = el.btnCopyMetrics.textContent;
    el.btnCopyMetrics.textContent = '\u2713 Copied!';
    setTimeout(() => {
      el.btnCopyMetrics.textContent = orig;
    }, 1500);
    showStatus('Metrics summary copied to clipboard.', 'success');
  } catch (err) {
    showStatus('Could not access clipboard.', 'error');
  }
}

/**
 * Updates metrics panel numbers
 */
function updateMetricsDisplay() {
  el.metricEngine.textContent = state.metrics.engine;
  el.metricFilesCount.textContent = String(state.metrics.filesCount);

  const avgLat = state.metrics.filesCount > 0
    ? Math.round(state.metrics.totalLatencyMs / state.metrics.filesCount)
    : 0;
  el.metricAvgLatency.textContent = `${avgLat} ms`;
  el.metricClaimsRemoved.textContent = String(state.metrics.claimsRemoved);
}

/**
 * Accessible status announcement banner
 */
function showStatus(message, type = 'normal') {
  el.statusMessage.textContent = message;
  el.statusBanner.className = `status-banner visible ${type}`;
}

// Start app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
