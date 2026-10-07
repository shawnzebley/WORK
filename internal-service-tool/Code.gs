// Sobieski Internal Service Tool (multi-year NFPA 10 / 25 / 72 services).
// Standalone Apps Script web app. Reads customer and system information from the
// inspection tool's shared account database (Quotes tab, read-only) and saves its
// own quotes to an "Internal Quotes" tab in the same spreadsheet.

const SPREADSHEET_ID = '1SbvLwXo7fgx71uY_8R6tU3n9ov-Us93lJP_Xrpl6ftw';
const ACCOUNTS_SHEET = 'Quotes';
const INTERNAL_SHEET = 'Internal Quotes';
const INTERNAL_HEADERS = ['ID', 'Name', 'Account ID', 'Customer', 'Service Address', 'Total', 'Updated At', 'Updated By', 'JSON'];
const RATE_CARD_KEY = 'INTERNAL_RATE_CARD';

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  template.initialAccountId = String((e && e.parameter && e.parameter.account) || '').replace(/[^A-Za-z0-9_-]/g, '');
  return template.evaluate()
    .setTitle('Sobieski Internal Service Tool')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function getBootstrap() {
  return {
    email: currentUserEmail_(),
    accounts: listAccounts(),
    internalQuotes: listInternalQuotes(),
    rateCard: getRateCard()
  };
}

/* ---------- Inspection-tool accounts (read-only) ---------- */

function listAccounts() {
  const sheet = spreadsheet_().getSheetByName(ACCOUNTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues()
    .filter(function(row) { return String(row[0] || '').trim(); })
    .map(function(row) {
      return {
        id: String(row[0]),
        name: String(row[1] || 'Untitled Account'),
        customerName: String(row[2] || ''),
        serviceAddress: String(row[3] || ''),
        cityStateZip: String(row[4] || '')
      };
    })
    .sort(function(a, b) { return a.name.localeCompare(b.name); });
}

// Returns only what the internal tool needs: the customer fields and the
// equipment quantities entered on the inspection side.
function getAccount(accountId) {
  const sheet = spreadsheet_().getSheetByName(ACCOUNTS_SHEET);
  if (!sheet) throw new Error('The Quotes tab is missing from the shared database.');
  const row = findRow_(sheet, accountId, 14);
  if (!row) throw new Error('That account no longer exists in the shared database.');
  let account;
  try { account = JSON.parse(String(row.values[13] || '')); }
  catch (error) { throw new Error('That account row has unreadable data. Restore it from the Revisions tab.'); }
  const state = account.state || {};
  const quantities = {};
  (state.rows || []).forEach(function(r) {
    if (!r || !r.id) return;
    quantities[r.id] = r.enabled === false ? 0 : (Number(r.qty) || 0);
  });
  return {
    id: String(account.id || accountId),
    name: String(account.name || ''),
    fields: state.fields || {},
    taxExempt: Boolean(state.taxExempt),
    quantities: quantities
  };
}

/* ---------- Internal quotes (read / write) ---------- */

function listInternalQuotes() {
  const sheet = internalSheet_();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues()
    .filter(function(row) { return String(row[0] || '').trim(); })
    .map(function(row) {
      return {
        id: String(row[0]),
        name: String(row[1] || 'Untitled'),
        accountId: String(row[2] || ''),
        customerName: String(row[3] || ''),
        total: Number(row[5]) || 0,
        updatedAt: isoString_(row[6]),
        updatedBy: String(row[7] || '')
      };
    })
    .sort(function(a, b) { return a.name.localeCompare(b.name); });
}

function getInternalQuote(quoteId) {
  const row = findRow_(internalSheet_(), quoteId, INTERNAL_HEADERS.length);
  if (!row) throw new Error('That internal quote no longer exists.');
  return JSON.parse(String(row.values[8] || '{}'));
}

function saveInternalQuote(quote) {
  if (!quote || !quote.state) throw new Error('No quote data was supplied.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = internalSheet_();
    const saved = JSON.parse(JSON.stringify(quote));
    saved.id = String(saved.id || Utilities.getUuid());
    saved.updatedAt = new Date().toISOString();
    saved.updatedBy = currentUserEmail_();
    const fields = saved.state.fields || {};
    const values = [
      saved.id,
      String(saved.name || fields.internalCustomerName || 'Untitled').trim() || 'Untitled',
      saved.accountId || '',
      fields.internalCustomerName || '',
      fields.internalServiceAddress || '',
      Number(saved.total) || 0,
      saved.updatedAt,
      saved.updatedBy,
      JSON.stringify(saved)
    ];
    const existing = findRow_(sheet, saved.id, INTERNAL_HEADERS.length);
    if (existing) sheet.getRange(existing.row, 1, 1, values.length).setValues([values]);
    else sheet.appendRow(values);
    return { quote: saved, summaries: listInternalQuotes() };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Default techs / hours / $ per service line ---------- */

function getRateCard() {
  const raw = PropertiesService.getScriptProperties().getProperty(RATE_CARD_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (error) { return {}; }
}

function saveRateCard(card) {
  PropertiesService.getScriptProperties().setProperty(RATE_CARD_KEY, JSON.stringify(card || {}));
  return getRateCard();
}

/* ---------- Helpers ---------- */

function spreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function internalSheet_() {
  const ss = spreadsheet_();
  let sheet = ss.getSheetByName(INTERNAL_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(INTERNAL_SHEET);
    sheet.appendRow(INTERNAL_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRow_(sheet, id, width) {
  if (!id || sheet.getLastRow() < 2) return null;
  const match = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(id))
    .matchEntireCell(true)
    .findNext();
  if (!match) return null;
  const row = match.getRow();
  return { row: row, values: sheet.getRange(row, 1, 1, width).getValues()[0] };
}

function currentUserEmail_() {
  return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'Unknown user';
}

function isoString_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return value.toISOString();
  return String(value);
}
