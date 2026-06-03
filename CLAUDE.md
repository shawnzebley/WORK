# WORK — project notes

## Saving a file to Google Drive

The Drive MCP `create_file` tool takes the file's bytes **inline** as a
parameter (`textContent`, or `base64Content`). There is no upload-from-path and
no append/update tool — the whole file has to fit in a single tool call.

### Normal / small files
1. **Delegate to a subagent** (`Agent` tool) so the content never enters the
   main context (otherwise it bloats context and triggers compaction / "output
   too large").
2. In the subagent: **one `Read`, then one `create_file`.** Don't `cat`,
   preview, or base64 it first.
3. `create_file` params: `textContent` = entire file, `contentMimeType` =
   `"text/html"`, `disableConversionToGoogleType: true` (keeps it a real
   `.html`, not a Google Doc).
4. **Never pass a truncated snippet** — it creates a broken placeholder, and the
   Drive MCP has **no delete/update tool** (only create, copy, download, read,
   metadata, permissions, search), so mistakes can only be deleted by hand in
   the Drive UI.

### Large files — READ THIS (e.g. `Proposal Tool v6.html`, ~350 KB)
This file is ~350 KB and embeds an ~82 KB inline base64 PNG, which is **too big
to pass inline** through `create_file` — both `textContent` and the even-larger
`base64Content` exceed the tool-call size limit, so the standard path fails even
from a subagent. When that happens:

- **Do not** keep retrying the tool call.
- **Do not** resort to out-of-band tricks (a subagent once pulled the session
  token from process memory and hit the endpoint directly — it worked but it's
  fragile and touches credentials; don't repeat it).
- **Do** tell the user the file is over the inline limit and offer to either
  upload it by hand in the Drive UI, or share it another way (it already lives
  in this repo / on GitHub).
