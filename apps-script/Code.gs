const SPREADSHEET_ID = '1SbvLwXo7fgx71uY_8R6tU3n9ov-Us93lJP_Xrpl6ftw';
const QUOTES_SHEET = 'Quotes';
const REVISIONS_SHEET = 'Revisions';
const MAX_CLIENT_REVISIONS = 5;

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Sobieski Proposal Builder')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getCurrentUser() {
  return {
    email: currentUserEmail_(),
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit'
  };
}

function listQuoteSummaries() {
  const sheet = quoteSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 13).getValues()
    .filter(function(row) { return String(row[0] || '').trim(); })
    .map(function(row) {
      return {
        id: String(row[0]),
        name: String(row[1] || 'Untitled Account'),
        customerName: String(row[2] || ''),
        serviceAddress: String(row[3] || ''),
        cityStateZip: String(row[4] || ''),
        status: String(row[5] || 'Draft'),
        quoteTotal: Number(row[6]) || 0,
        preparedBy: String(row[7] || ''),
        ownerEmail: String(row[8] || ''),
        serverRevision: Number(row[9]) || 0,
        createdAt: isoString_(row[10]),
        updatedAt: isoString_(row[11]),
        updatedBy: String(row[12] || '')
      };
    })
    .sort(function(a, b) { return a.name.localeCompare(b.name); });
}

function getQuote(quoteId) {
  const found = findQuoteRow_(quoteId);
  if (!found) throw new Error('The selected account no longer exists in the shared database.');
  const account = parseAccount_(found.values[13]);
  account.serverRevision = Number(found.values[9]) || 0;
  return account;
}

function saveQuote(payload) {
  if (!payload || !payload.account) throw new Error('No quote data was supplied.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return saveQuoteUnlocked_(payload.account, Number(payload.expectedRevision) || 0);
  } finally {
    lock.releaseLock();
  }
}

function recoverQuote(quoteId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const revisionSheet = revisionsSheet_();
    const lastRow = revisionSheet.getLastRow();
    if (lastRow < 2) throw new Error('No earlier saved version is available for this account.');
    const values = revisionSheet.getRange(2, 1, lastRow - 1, 6).getValues();
    let previous = null;
    for (let i = values.length - 1; i >= 0; i--) {
      if (String(values[i][1]) === String(quoteId)) {
        previous = parseAccount_(values[i][5]);
        break;
      }
    }
    if (!previous) throw new Error('No earlier saved version is available for this account.');
    const now = new Date().toISOString();
    previous.id = Utilities.getUuid();
    previous.name = uniqueRecoveredName_(previous.name || 'Untitled Account');
    previous.createdAt = now;
    previous.updatedAt = now;
    previous.revisions = [];
    previous.serverRevision = 0;
    return saveQuoteUnlocked_(previous, 0);
  } finally {
    lock.releaseLock();
  }
}

function exportQuoteBackup() {
  const summaries = listQuoteSummaries();
  const accounts = summaries.map(function(summary) { return getQuote(summary.id); });
  return {
    format: 'sobieski-proposal-account-backup',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    accounts: accounts
  };
}

function importQuoteBackup(payload) {
  const source = payload && Array.isArray(payload.accounts) ? payload.accounts : [];
  if (!source.length) return { added: 0, summaries: listQuoteSummaries() };
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    let added = 0;
    let lastAddedId = '';
    source.forEach(function(incoming) {
      if (!incoming || !incoming.state) return;
      const account = JSON.parse(JSON.stringify(incoming));
      if (!account.id || findQuoteRow_(account.id)) account.id = Utilities.getUuid();
      account.name = uniqueImportedName_(account.name || 'Untitled Account');
      account.serverRevision = 0;
      const saved = saveQuoteUnlocked_(account, 0);
      lastAddedId = saved.id;
      added += 1;
    });
    return { added: added, lastAddedId: lastAddedId, summaries: listQuoteSummaries() };
  } finally {
    lock.releaseLock();
  }
}

function saveQuoteUnlocked_(incoming, expectedRevision) {
  const account = JSON.parse(JSON.stringify(incoming));
  if (!account.state || typeof account.state !== 'object') throw new Error('Saved account is missing its proposal data.');
  account.id = String(account.id || Utilities.getUuid());
  account.name = String(account.name || 'Untitled Account').trim() || 'Untitled Account';
  const now = new Date().toISOString();
  const user = currentUserEmail_();
  const found = findQuoteRow_(account.id);
  let serverRevision = 0;

  if (found) {
    serverRevision = Number(found.values[9]) || 0;
    if (expectedRevision !== serverRevision) {
      throw new Error('CONFLICT: This account was changed by someone else. Reload it before saving so their work is not overwritten.');
    }
    const previous = parseAccount_(found.values[13]);
    appendRevision_(previous, serverRevision, user);
    const previousState = previous.state ? JSON.parse(JSON.stringify(previous.state)) : null;
    account.revisions = previousState
      ? [{ savedAt: previous.updatedAt || now, state: previousState }].concat(previous.revisions || []).slice(0, MAX_CLIENT_REVISIONS)
      : (account.revisions || []).slice(0, MAX_CLIENT_REVISIONS);
    account.createdAt = previous.createdAt || account.createdAt || now;
  } else {
    if (expectedRevision !== 0) throw new Error('CONFLICT: This account no longer exists. Save it as a new account instead.');
    account.createdAt = account.createdAt || now;
    account.revisions = Array.isArray(account.revisions) ? account.revisions.slice(0, MAX_CLIENT_REVISIONS) : [];
  }

  account.updatedAt = now;
  account.serverRevision = serverRevision + 1;
  account.updatedBy = user;
  const row = accountRow_(account, user);
  const sheet = quoteSheet_();
  if (found) sheet.getRange(found.row, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  return account;
}

function accountRow_(account, user) {
  const fields = account.state && account.state.fields ? account.state.fields : {};
  return [
    account.id,
    account.name,
    fields.customerName || '',
    fields.serviceAddress || '',
    fields.cityStateZip || '',
    account.status || 'Draft',
    Number(account.quoteTotal) || 0,
    fields.preparedBy || '',
    account.ownerEmail || user,
    Number(account.serverRevision) || 1,
    account.createdAt || new Date().toISOString(),
    account.updatedAt || new Date().toISOString(),
    user,
    JSON.stringify(account)
  ];
}

function appendRevision_(account, revision, user) {
  revisionsSheet_().appendRow([
    Utilities.getUuid(),
    account.id,
    revision,
    new Date().toISOString(),
    user,
    JSON.stringify(account)
  ]);
}

function findQuoteRow_(quoteId) {
  if (!quoteId) return null;
  const sheet = quoteSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const match = sheet.getRange(2, 1, lastRow - 1, 1)
    .createTextFinder(String(quoteId))
    .matchEntireCell(true)
    .findNext();
  if (!match) return null;
  const row = match.getRow();
  return { row: row, values: sheet.getRange(row, 1, 1, 14).getValues()[0] };
}

function uniqueRecoveredName_(baseName) {
  return uniqueImportedName_(String(baseName).replace(/ - Recovered(?: \(\d+\))?$/, '') + ' - Recovered');
}

function uniqueImportedName_(requestedName) {
  const base = String(requestedName || 'Untitled Account').trim() || 'Untitled Account';
  const used = {};
  listQuoteSummaries().forEach(function(item) { used[item.name.toLowerCase()] = true; });
  if (!used[base.toLowerCase()]) return base;
  let number = 2;
  while (used[(base + ' (' + number + ')').toLowerCase()]) number += 1;
  return base + ' (' + number + ')';
}

function parseAccount_(json) {
  try {
    const account = JSON.parse(String(json || ''));
    if (!account || !account.state) throw new Error('missing state');
    return account;
  } catch (error) {
    throw new Error('A quote row contains unreadable JSON. Restore that row from the Revisions tab.');
  }
}

function quoteSheet_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(QUOTES_SHEET);
  if (!sheet) throw new Error('The Quotes tab is missing from the shared database.');
  return sheet;
}

function revisionsSheet_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(REVISIONS_SHEET);
  if (!sheet) throw new Error('The Revisions tab is missing from the shared database.');
  return sheet;
}

function currentUserEmail_() {
  return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'Unknown user';
}

function isoString_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return value.toISOString();
  return String(value);
}
