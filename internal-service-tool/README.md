# Sobieski Internal Service Tool

Standalone Apps Script web app for multi-year internal inspection / testing quotes
(NFPA 10, 25 and 72). It replaces the internal service tool that was built into the
inspection proposal builder.

- **Contact and system info** come from the inspection tool's shared account database
  (same spreadsheet, `Quotes` tab, read-only). Pick an account and click
  **Pull contact & systems**, or open the tool with `?account=<account id>`.
- **System Information** (risers, FDCs, standpipes, extinguishers, smokes, heat
  detectors, batteries, and so on) fills the quantity on each service line. Typing
  over a quantity keeps your number.
- **Saved internal quotes** go to a new `Internal Quotes` tab in the same spreadsheet
  (created on first save).
- **Save rates as defaults** stores every line's techs / hours / $ per unit and part
  sell / cost for everyone who uses the tool.
- The internal agreement `.docx` uses the same Word template and builder as the
  inspection tool, with added pages for tanks, sprinkler sample testing, extinguisher
  multi-year service and fire alarm multi-year service.

## Rates

Lines carried over from the old internal tool keep their hours. New multi-year lines
start at 0 hours / $0 and show **Set rate** until a rate is entered. Lines marked
**Flat** bill qty x $/Unit (hours on them only count toward internal cost). Smoke
sensitivity is set to the rate card: 12 min, 1 tech, $20/unit.

## Files

| File | Apps Script file | Type |
| --- | --- | --- |
| `Code.gs` | `Code` | Script |
| `Index.html` | `Index` | HTML |
| `App.html` | `App` | HTML |
| `Styles.html` | `Styles` | HTML (copied from the inspection tool) |
| `Agreement.html` | `Agreement` | HTML (agreement template + Word helpers, copied from the inspection tool) |
| `appsscript.json` | manifest | |

## Deploy (one time)

1. Go to https://script.google.com and click **New project**. Name it
   **Sobieski Internal Service Tool**.
2. Replace the contents of `Code.gs` with `Code.gs` from this folder.
3. For each of `Index`, `App`, `Styles`, `Agreement`: click **+ → HTML**, type the
   name exactly (no `.html`), and paste the full file. Use GitHub's **Raw** view to
   copy; `Agreement.html` is about 290 KB and must end with `</script>`.
4. **Project Settings → Show "appsscript.json" manifest file in editor**, then paste
   `appsscript.json` over it.
5. **Deploy → New deployment → Web app**. Execute as **Me**, access the same as the
   inspection tool. Authorize when asked (it needs Sheets access to the shared
   database). Copy the web app URL.

## Point the inspection tool's button at it

In the inspection tool's Apps Script project, open `Index`, find this line (near the
bottom of the file):

```js
$('openInternalTool').addEventListener('click',()=>window.open('<?= ScriptApp.getService().getUrl() ?>?app=internal','_blank','noopener'));
```

Replace it with (paste your new web app URL):

```js
$('openInternalTool').addEventListener('click',()=>window.open('PASTE_NEW_WEB_APP_URL'+(activeQuoteId?'?account='+encodeURIComponent(activeQuoteId):''),'_blank','noopener'));
```

Save, then **Deploy → Manage deployments → edit → New version**. The button now opens
the new site with the current account already pulled in (the account has to be saved
first).

## Updating later

Paste the changed file over the matching Apps Script file, save, then
**Deploy → Manage deployments → edit the active deployment → New version**.
