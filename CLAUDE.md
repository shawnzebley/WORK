# WORK — project notes

## Saving a file to Google Drive (do it this way — it's otherwise slow)

The big HTML apps here (e.g. `Proposal Tool v6.html`, ~350 KB) stall the main
thread if their content passes through it. The slowness is NOT the upload — it's
the model re-emitting hundreds of KB, plus the fumbling around it (`cat` "output
too large", base64 previews, retries). Skip all of that:

1. **Delegate the upload to a subagent** (the `Agent` tool). The file content
   never enters the main context, so no bloat / compaction / "output too large".
2. In the subagent: **`Read` the file once, then call `create_file` once.** Do
   not `cat`, preview, or base64 it first.
3. Call the Google Drive MCP `create_file` (`mcp__<drive-server>__create_file`)
   with:
   - `textContent`: the **entire** file contents
   - `contentMimeType`: `"text/html"` (match the real type)
   - `disableConversionToGoogleType: true` — keeps it as a real `.html` file
     instead of converting to a Google Doc
4. **Never pass a truncated snippet as `textContent`.** It silently creates a
   broken placeholder file, and **the Drive MCP has no delete/update tool**
   (only create, copy, download, read, metadata, permissions, search) — so a
   bad upload can only be removed by hand in the Drive UI.

One Read + one `create_file`, in a subagent. That's the fast path.
