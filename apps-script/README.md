# Sobieski Proposal Builder — Apps Script sources

Mirror of the Google Apps Script project **Sobieski Proposal Builder**
(`1bX9-eIWiZuh8NxUfqn0xGxJB22lvmOD_v5fSVNclwqQGGrEqCSRPK5jv`), pulled from Drive
so the web app's source is versioned alongside the standalone HTML tool.

| File | Apps Script file |
| --- | --- |
| `Index.html` | `Index` (the whole quote tool UI + client logic) |
| `Code.gs` | `Code` (server side: shared quote database in Sheets) |
| `appsscript.json` | project manifest |

## Applying changes back to the live project

There is no write API available from this environment — Drive can export the
project but not update it. To deploy a change:

1. Open https://script.google.com/d/1bX9-eIWiZuh8NxUfqn0xGxJB22lvmOD_v5fSVNclwqQGGrEqCSRPK5jv/edit
2. Select the matching file in the editor.
3. Replace its full contents with the file from this folder, then save.
4. **Deploy → Manage deployments → edit the active deployment → New version**,
   otherwise the published web app keeps serving the old code.
