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
