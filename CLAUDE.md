# WORK — project notes

## Saving a file to Google Drive
- `create_file` takes the file's bytes **inline** (`textContent` / `base64Content`).
  No upload-from-path, no append/update — the whole file must fit in one call.
- **Files that fit:** delegate to a subagent (keeps the bytes out of the main
  context), then **one `Read` + one `create_file`**. For HTML, pass
  `contentMimeType: "text/html"` and `disableConversionToGoogleType: true` so it
  stays a real `.html` instead of becoming a Google Doc.
- **Never send a truncated snippet** — it creates a broken placeholder, and the
  Drive MCP has **no delete/update tool**, so the only fix is deleting by hand in
  the Drive UI.
- **Files too big to fit inline** (e.g. `Proposal Tool v6.html`, ~350 KB with an
  inline base64 image): the call just fails. Don't keep retrying and don't reach
  for out-of-band tricks — tell the user it's over the limit and offer a manual
  upload, or share it via this repo / GitHub.

## "The Google Script app" — what it means and where it lives
- It means the Apps Script project **Sobieski Proposal Builder**:
  https://script.google.com/home/projects/1bX9-eIWiZuh8NxUfqn0xGxJB22lvmOD_v5fSVNclwqQGGrEqCSRPK5jv/edit
  (Drive file id `1bX9-eIWiZuh8NxUfqn0xGxJB22lvmOD_v5fSVNclwqQGGrEqCSRPK5jv`)
- **Shawn wants changes made AND deployed there** every time he refers to it.
- The canonical source is mirrored in this repo at `apps-script/` — `Index.html`
  (the whole UI, ~10.9k lines), `Code.gs` (Sheets-backed account storage), and
  `appsscript.json`. Work from those files.
- **`Proposal Tool v6.html` in the repo root is NOT the deployed app.** It is an
  older, much smaller standalone copy (~4k lines) whose internals have diverged.
  Editing it does nothing to what Shawn actually uses. Don't mistake it for the app.

### Reading the live project
- `download_file_content` with `exportMimeType:
  "application/vnd.google-apps.script+json"` returns the project. The response is
  **base64**, decoding to `{"files":[{name,type,source}, ...]}`. It is ~1.1 MB, so
  it auto-persists to a file — decode it with python, don't pull it into context.
- Always re-export before editing; the live project may be ahead of `apps-script/`.

### Deploying — no write path from here
- The Drive MCP `update_file` only changes **title and parent**, not content, and
  there is no Apps Script API / clasp tool in this session. So the changes cannot
  be pushed automatically. Do the work, commit it to `apps-script/`, then hand
  Shawn `Index.html` to paste in (Apps Script editor → `Index.html` → select all →
  paste → Save → **Deploy → Manage deployments → edit → Version: New version**).
- Don't claim it is deployed. Say plainly that the paste step is his.

### Testing Index.html locally
- It is a plain template (no `<?= ?>` scriptlets), so it runs in a browser once
  `google.script.run` is stubbed. Inject a stub `<script>` before the app's own
  script tag, then drive it with Playwright (chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`).
- Estimator inputs only register on real typing — use `click()` + `fill()`, not
  `dispatchEvent`.

## Methods that work here (reach for these first)
- **A file you can't find may live on a branch or open PR, not `main`.** Check
  GitHub (`list_pull_requests`, `list_branches`) before concluding it's missing.
- **To read/edit a large file from a branch, `git fetch` it and use local
  Read / grep / Edit.** Pulling big content through MCP `get_file_contents` or a
  PR diff hits size/token limits — don't lead with those.
- **Large files: `grep -n` to find the exact lines, then `Edit`.** Don't `cat`
  the whole file (it overflows as "output too large").
- **Huge tool/diff output: `grep` or slice the persisted file** instead of a
  plain `Read` — long lines defeat offset/limit.
- **PRs:** `create_pull_request` → `merge_pull_request` work cleanly; a branch
  that's a superset of an earlier PR can target `main` directly and the older PR
  auto-closes as merged.
