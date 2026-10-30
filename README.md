# ⚰️ Graveyard: A Funeral for Dead Code

> *"Theme: Ghost in the Machine — Memorializing the code we wrote, loved, refactored, and purged."*

**Graveyard** is a solemn, client-side digital cemetery for retired source code files. It transforms Git deletion logs into atmospheric, Gothic terminal tombstones commemorating deprecated shims, abandoned hacks, and forgotten features.

Built for open-source AI challenges with a strict **security-first** architecture:
- **Zero Frameworks, Zero Build Step, Zero NPM Runtime Dependencies**: Pure HTML5, CSS3, and ES modules.
- **Strict Content-Security-Policy**: Enforced via meta tags (`connect-src` locked exclusively to `'self'` and `http://localhost:11434`).
- **Open-Weight Models Only**: Runs locally through Ollama with Google's open-weight **Gemma** (`gemma3:4b`). No cloud models, no API keys, and no telemetry.
- **Honest Verifier**: Automatically detects model hallucinations, requiring at least 60% keyword match against Git commit logs before verifying cause-of-death claims.

---

## 🏛️ Modes of Operation

1. **Demo Mode (Default & Offline)**:
   - Built-in memorial for 6 realistic historical code deletions (including legacy IE8 polyfills, deprecated SOAP parsers, dead Dogecoin billing adapters, and a notorious `"fix stuff"` memory leak hack).
   - Deterministic, canned eulogies. Zero network requests, 100% offline.
2. **Local Gemma Mode (Ollama)**:
   - Runs inference on your own hardware via Ollama at `http://localhost:11434`.
   - Uses exclusively `gemma3:4b` with a hardcoded runtime security guard.
   - Everything stays strictly on your computer.

---

## 📋 System Requirements

- **Node.js**: Version 18.0.0 or higher (used strictly for the optional static server and Git export script; no `npm install` needed).
- **Web Browser**: Any modern evergreen browser (Chrome, Edge, Firefox, Safari).
- **For Local Gemma Mode**:
  - [Ollama](https://ollama.com/) installed and running.
  - The `gemma3:4b` model pulled locally (`ollama pull gemma3:4b`).

---

## 🪟 How to Run on Windows

### 1. Running in Demo Mode (Zero Configuration)
You can run Graveyard immediately without installing any software or starting any background service:

**Option A (Using the zero-dependency built-in Node server):**
```powershell
node scripts/serve.mjs
```
Then open your browser to [http://localhost:5173](http://localhost:5173).

**Option B (Direct file load):**
Simply double-click `index.html` in Windows Explorer or open it in your browser.

---

### 2. Running Local Gemma Mode on Windows

#### Step 1: Install Ollama & Pull Gemma
1. Download and install Ollama from [ollama.com/download/windows](https://ollama.com/download/windows).
2. Open PowerShell or Command Prompt and download `gemma3:4b`:
   ```powershell
   ollama pull gemma3:4b
   ```

#### Step 2: Configure CORS (Crucial for Localhost Web Apps)
By default, browsers block web pages from sending `fetch()` requests to Ollama on `http://localhost:11434` due to Cross-Origin Resource Sharing (CORS). You must grant permission to `http://localhost:5173`:

- **In PowerShell**:
  ```powershell
  $env:OLLAMA_ORIGINS="http://localhost:5173"
  ollama serve
  ```

- **In Command Prompt (cmd.exe)**:
  ```cmd
  set OLLAMA_ORIGINS=http://localhost:5173
  ollama serve
  ```

- **If Ollama runs as a Windows Background Task / Tray App**:
  1. Open Windows Search and type **"Edit system environment variables"**.
  2. Click **Environment Variables...**.
  3. Under User or System variables, click **New...**:
     - Variable name: `OLLAMA_ORIGINS`
     - Variable value: `http://localhost:5173` *(Never use `*`)*
  4. Right-click the Ollama icon in the Windows notification tray, select **Quit Ollama**, and restart it from the Start menu.

#### Step 3: Launch the Graveyard App
1. Start the static server:
   ```powershell
   node scripts/serve.mjs
   ```
2. Navigate to [http://localhost:5173](http://localhost:5173).
3. Toggle the top mode switch to **Local Gemma (Ollama)**.
4. Process your files or click **Load Demo Sample**.

---



## 🌐 GitHub Pages Notice

When Graveyard is hosted on a live remote domain (such as GitHub Pages):
- **Demo Mode works 100% offline and seamlessly.**
- **Local Gemma Mode is restricted by design**: Modern browsers enforce *Private Network Access (PNA)* and mixed-content security rules that block public HTTPS websites from issuing unprompted network calls to `http://localhost`. To run Local Gemma mode, always host the frontend locally using `node scripts/serve.mjs`.

---

## 📜 Exporting Dead Code from Your Git Repository

To generate a `graveyard.json` file containing real deleted code from your own Git projects:

```bash
node scripts/export-deleted.mjs
```

### Safety Features of `scripts/export-deleted.mjs`:
- Uses Node.js built-ins only (`child_process.execFile`).
- Runs read-only `git log` and `git show` commands with strict array argument vectors (never a shell string).
- Displays a visible security advisory:
  > *"Run this only on repositories you trust, because git can run commands from a repo's own config."*
- Extracts up to the 10 most recent deletions, truncates files at 3,000 characters, and outputs standard JSON.

---

## 🔍 The Honest Verifier

AI models tend to invent dramatic stories or hallucinate dates and metrics. Graveyard implements a deterministic, multi-stage verifier that audits model outputs before rendering:

1. **Cause of Death Audit**:
   - Extracts all key words ($\ge 4$ characters, lowercase) from Gemma's response.
   - Calculates the percentage of these words that exist in the real Git commit message.
   - **Pass ($\ge 60\%$)**: Marked **"Paraphrased from commit"**; the real commit message is displayed beside it.
   - **Fail ($< 60\%$)**: Cause of death is erased, replaced with `"Cause of death unknown"`, and stamped with the badge **"Unverified claim removed"**.
2. **Epitaph Integrity Audit**:
   - Enforces a strict maximum of **25 words**.
   - Identifies any numbers, dates, or commit hashes mentioned in the epitaph.
   - Every single sensitive token must exist in the trusted input data corpus (`path`, `commitDate`, `firstCommitDate`, `patch`, `lastContent`). If any token was hallucinated by the model, the epitaph is marked **"Epitaph unverified"** and replaced with a factual fallback.
3. **User Flagging & Failure Export**:
   - Each headstone features a **"Mark this wrong"** button.
   - Flagged inaccuracies are stored in an in-memory audit list.
   - Click **"Download Failures"** to export flagged hallucinations as a timestamped JSON file.

---

## ⚖️ Open-Weight Model & License Terms

Graveyard exclusively supports the open-weight **Gemma** model series developed by Google, accessed via local Ollama inference.
- Model constant: `gemma3:4b`
- Terms: Gemma is provided under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms).
- Graveyard source code is released under the [MIT License](LICENSE).

---

## ⚠️ Honest Limits

1. **Local Compute Throughput**: Local inference speed depends entirely on your GPU/CPU hardware. On mid-range consumer laptops, `gemma3:4b` typically processes a tombstone in 1 to 4 seconds.
2. **10-File Batch Ceiling**: Batches are capped at 10 deceased files to prevent memory exhaustion and UI lag.
3. **Payload Truncation**: Code diffs and content snapshots are capped at 3,000 characters per file.
4. **Zero Model Authority**: Model outputs are only ever allowed to populate text nodes (`causeOfDeath` and `epitaph`). Model responses can never dictate file names, dates, commit hashes, or app configurations.

---

## 🔒 Security Self-Audit Checklist

You can verify the security posture of this codebase yourself using these quick tests:

1. **Search for `innerHTML`**:
   Verify that no unsafe DOM injection methods exist anywhere in the code:
   ```bash
   git grep "innerHTML"
   git grep "outerHTML"
   git grep "insertAdjacentHTML"
   ```
   *(Result should be completely empty.)*

2. **Search for Hosted Model APIs**:
   Verify that no remote cloud models or API keys are imported:
   ```bash
   git grep -i "gemini"
   git grep -i "OPENAI"
   git grep -i "CLAUDE"
   ```
   *(Result should return zero runtime integration code.)*

3. **Test a Malicious JSON Payload**:
   Paste an XSS or prototype pollution payload into the JSON text box:
   ```json
   [
     {
       "path": "<script>alert('XSS')</script>",
       "deletedInCommit": "7b8e19c<img src=x onerror=alert(1)>",
       "commitMessage": "Drop shims \"><script>evil()</script>",
       "commitDate": "2024-01-01",
       "firstCommitDate": "2020-01-01",
       "lastContent": "alert('hacked')",
       "patch": "alert('hacked')"
     }
   ]
   ```
   *Verify that the markup is rendered strictly as harmless literal text nodes and never executed.*

4. **Test an Oversized Payload**:
   Upload or paste a JSON payload larger than 1 MB or containing more than 10 files.
   *Verify that files $> 1\text{ MB}$ are cleanly rejected, and file arrays $> 10$ entries are capped with an explanatory warning.*

5. **Test Ollama Unavailability**:
   Switch to "Local Gemma" mode with Ollama shut down.
   *Verify that the app catches the error, displays the guided setup banner, and avoids unhandled exceptions.*

---

“The online demo uses fake data and no model. Real mode needs Ollama and Gemma installed once, then works offline.”




---
*Rest in peace, dear code. May your garbage collectors be gentle.*
