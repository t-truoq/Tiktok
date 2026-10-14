// truonglt phase0 readonly exporter start
/**
 * Add as a NEW script file to the ORIGINAL bound Apps Script project.
 * Run exportAffiliatePhase0ReadOnly manually. Writes only a NEW Drive JSON file.
 * Never calls loadRecord, ensureRecord on originals, save/setup/audit/sync/repair.
 */
function exportAffiliatePhase0ReadOnly() {
  const lock = LockService.getDocumentLock();
  if (!lock) throw new Error('Phải chạy trong Apps Script gốc gắn với spreadsheet.');
  if (!lock.tryLock(5000)) throw new Error('Đang có thao tác khác; thử export lại sau.');
  let payload;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const props = PropertiesService.getDocumentProperties();
    if (!ss || !props) throw new Error('Không truy cập được spreadsheet/Document Properties gốc.');
    const sheet = ss.getSheetByName('Trang tính2');
    if (!sheet) throw new Error('Không tìm thấy Trang tính2; không thay đổi sheet.');
    if (sheet.getLastColumn() < 18) throw new Error('Layout thiếu A:R; cần kiểm tra trước export.');
    const main = affExportP0ReadSheet(sheet);
    const problems = [];
    const groups = new Map();
    for (let i = 2; i < main.displays.length; i++) {
      const name = String(main.displays[i][0] || '').trim();
      if (!name) continue;
      const normalizedName = name.toLowerCase().replace(/\s+/g, ' ');
      const key = 'AFF_PRODUCT_' + normalizedName;
      const row = {row: i + 1, name, values: main.values[i], displays: main.displays[i],
        formulas: main.formulas[i], notes: main.notes[i], numberFormats: main.numberFormats[i]};
      if (!groups.has(key)) groups.set(key, {key, normalizedName, rows: []});
      groups.get(key).rows.push(row);
    }
    if (!groups.size) problems.push({code: 'NO_ACTIVE_PRODUCTS'});
    const records = [];
    const observedProperties = new Map();
    for (const entry of groups.values()) {
      if (entry.rows.length > 1) problems.push({code: 'DUPLICATE_ROOT_NAME', key: entry.key,
        rows: entry.rows.map(r => r.row)});
      try {
        const stored = affExportP0ReadRecord(props, entry.key, observedProperties);
        const rawRecord = JSON.parse(stored.decodedJson);
        if (!rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord)) {
          throw new Error('RECORD_NOT_OBJECT');
        }
        if (typeof rawRecord.name !== 'string' ||
            rawRecord.name.trim().toLowerCase().replace(/\s+/g, ' ') !== entry.normalizedName) {
          problems.push({code: 'RECORD_NAME_MISMATCH', key: entry.key});
        }
        let oracle = null;
        try {
          oracle = affExportP0Oracle(rawRecord, entry.rows[0]);
        } catch (error) {
          problems.push({code: 'ORACLE_FAILED', key: entry.key, message: String(error.message)});
        }
        records.push(Object.assign({}, entry, stored, {rawRecord, oracle,
          rawHistoryCount: Array.isArray(rawRecord.history) ? rawRecord.history.length : null}));
      } catch (error) {
        problems.push({code: 'RECORD_EXPORT_FAILED', key: entry.key, message: String(error.message)});
        records.push(Object.assign({}, entry, {decodedJson: null, rawRecord: null, oracle: null}));
      }
    }
    // Preserve historical audit sheets as observations; never sum their repeated refund column.
    const audits = ss.getSheets().filter(s => /^PAYMENT_AUDIT_V91_/.test(s.getName()))
      .map(s => affExportP0ReadSheet(s));
    const checkMain = affExportP0ReadSheet(sheet);
    if (affExportP0Hash(JSON.stringify(main)) !== affExportP0Hash(JSON.stringify(checkMain))) {
      problems.push({code: 'SOURCE_GRID_CHANGED_DURING_EXPORT'});
    }
    for (const [key, value] of observedProperties) {
      if (props.getProperty(key) !== value) problems.push({code: 'SOURCE_PROPERTY_CHANGED', key});
    }
    for (const audit of audits) {
      const current = ss.getSheetByName(audit.name);
      if (!current || affExportP0Hash(JSON.stringify(audit)) !==
          affExportP0Hash(JSON.stringify(affExportP0ReadSheet(current)))) {
        problems.push({code: 'AUDIT_CHANGED_DURING_EXPORT', name: audit.name});
      }
    }
    const auditNames = ss.getSheets().filter(s => /^PAYMENT_AUDIT_V91_/.test(s.getName()))
      .map(s => s.getName()).sort();
    if (JSON.stringify(auditNames) !== JSON.stringify(audits.map(s => s.name).sort())) {
      problems.push({code: 'AUDIT_LIST_CHANGED_DURING_EXPORT'});
    }
    payload = {
      format: 'TIKTOK_AFFILIATE_PHASE0_EXPORT_V1', exportedAtUtc: new Date().toISOString(),
      spreadsheetId: ss.getId(), spreadsheetName: ss.getName(),
      scriptTimezone: Session.getScriptTimeZone(), spreadsheetTimezone: ss.getSpreadsheetTimeZone(),
      legacyCfgVersion: typeof CFG !== 'undefined' ? CFG.VERSION : null,
      oracleFunctions: affExportP0OracleFingerprints(),
      sheets: ss.getSheets().map(s => ({id: s.getSheetId(), name: s.getName(),
        lastRow: s.getLastRow(), lastColumn: s.getLastColumn()})),
      main, audits, records, problems,
      // Includes invalid manifests/chunks for diagnosis, scoped to active roots only.
      observedProperties: Array.from(observedProperties, ([key, value]) => ({key, value})),
      activeProductCount: groups.size,
      sourceReadStable: !problems.some(p => /CHANGED/.test(p.code)),
      exportComplete: problems.length === 0,
      reconciliationStatus: 'NOT_RUN',
      imagePolicy: 'Cell/over-grid metadata only; original XLSX media retained. Image binaries not migrated.',
    };
  } finally {
    lock.releaseLock();
  }
  // Envelope hashes the exact UTF-8 payloadJson, not a reserialized object.
  const payloadJson = JSON.stringify(payload);
  const envelope = JSON.stringify({format: 'AFFILIATE_EXPORT_ENVELOPE_V1',
    payloadSha256: affExportP0Hash(payloadJson), payloadJson});
  const name = 'TIKTOK_PHASE0_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  const file = DriveApp.createFile(Utilities.newBlob(envelope, 'application/json', name));
  if (affExportP0Hash(file.getBlob().getDataAsString('UTF-8')) !== affExportP0Hash(envelope)) {
    throw new Error('File export không khớp checksum; không dùng để migration.');
  }
  const summary = {fileId: file.getId(), url: file.getUrl(), products: payload.activeProductCount,
    exportComplete: payload.exportComplete, problems: payload.problems.length,
    reconciliationStatus: 'NOT_RUN', payloadSha256: affExportP0Hash(payloadJson)};
  Logger.log(JSON.stringify(summary));
  return summary;
}

function affExportP0ReadRecord(props, key, observed) {
  const read = propertyKey => {
    const value = props.getProperty(propertyKey);
    observed.set(propertyKey, value);
    return value;
  };
  const manifest = read(key);
  if (manifest === null || manifest === '') throw new Error('MISSING_RECORD');
  let decodedJson = manifest;
  const chunks = [];
  if (manifest.startsWith('AFFZ91|')) {
    const fields = manifest.split('|');
    const count = Number(fields[2]);
    const size = Number(fields[3]);
    if (fields.length !== 4 || !/^[a-f0-9]{12}$/.test(fields[1]) ||
        !/^[1-9]\d*$/.test(fields[2]) || !Number.isSafeInteger(count) || count > 150 ||
        !/^[1-9]\d*$/.test(fields[3]) || !Number.isSafeInteger(size) || size > count * 7300) {
      throw new Error('INVALID_MANIFEST');
    }
    for (let i = 0; i < count; i++) {
      const chunkKey = key + '__' + fields[1] + '_' + i;
      const value = read(chunkKey);
      if (value === null) throw new Error('MISSING_CHUNK_' + i);
      if (!value.length || value.length > 7300) throw new Error('INVALID_CHUNK_SIZE_' + i);
      chunks.push({key: chunkKey, value, sha256: affExportP0Hash(value)});
    }
    const encoded = chunks.map(c => c.value).join('');
    if (encoded.length !== size) throw new Error('BASE64_SIZE_MISMATCH');
    if (encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
      throw new Error('INVALID_BASE64');
    }
    try {
      decodedJson = Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(encoded),
        'application/x-gzip', 'affiliate.gz')).getDataAsString('UTF-8');
    } catch (_) {
      throw new Error('GZIP_DECODE_FAILED');
    }
  }
  // Do not call legacy loadRecord: it normalizes legacy data in memory before returning.
  JSON.parse(decodedJson);
  return {manifest, manifestSha256: affExportP0Hash(manifest), chunks, decodedJson,
    decodedSha256: affExportP0Hash(decodedJson), encoding: chunks.length ? 'gzip-base64' : 'raw-json'};
}

function affExportP0Cell(value) {
  if (value instanceof Date) return {type: 'date', utc: value.toISOString()};
  if (value === '' || value === null) return {type: 'blank', value};
  if (['string', 'number', 'boolean'].includes(typeof value)) return {type: typeof value, value};
  if (value && value.valueType === SpreadsheetApp.ValueType.IMAGE) {
    return {type: 'cell-image', altTitle: value.getAltTextTitle(), altDescription: value.getAltTextDescription()};
  }
  return {type: 'unsupported', display: String(value)};
}

function affExportP0ReadSheet(sheet) {
  const rows = sheet.getLastRow();
  const columns = sheet.getLastColumn();
  const range = rows && columns ? sheet.getRange(1, 1, rows, columns) : null;
  const images = sheet.getImages().map(image => ({
    row: image.getAnchorCell().getRow(), column: image.getAnchorCell().getColumn(),
    altTitle: image.getAltTextTitle(), altDescription: image.getAltTextDescription(),
    width: image.getWidth(), height: image.getHeight(),
  }));
  return {id: sheet.getSheetId(), name: sheet.getName(), rows, columns,
    values: range ? range.getValues().map(row => row.map(affExportP0Cell)) : [],
    displays: range ? range.getDisplayValues() : [], formulas: range ? range.getFormulas() : [],
    notes: range ? range.getNotes() : [], numberFormats: range ? range.getNumberFormats() : [], images};
}

function affExportP0Hash(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('');
}

function affExportP0Oracle(record, row) {
  // All legacy arithmetic here runs only on independent copies and is an observation.
  const clone = () => JSON.parse(JSON.stringify(record));
  const summary = getPaymentSummaryForRecord(clone());
  const refund = getRefundEligible91(clone());
  const profit = calculateProjectedProfit(clone());
  const normalizedCopy = clone();
  ensureRecord(normalizedCopy);
  const dateCell = row.values[5];
  const date = dateCell.type === 'date' ? new Date(dateCell.utc) : dateCell.value;
  const status = calculateStatus(row.displays[3], row.values[2].value,
    date, row.displays[6], row.displays[14]);
  return {observedAtUtc: new Date().toISOString(), mode: 'LEGACY_RECORD_WITHOUT_SHEET_SYNC',
    summary, refundEligible: refund, projectedProfit: profit, calculatedStatus: status,
    normalizedCopy, normalizationChanged: JSON.stringify(record) !== JSON.stringify(normalizedCopy)};
}

function affExportP0OracleFingerprints() {
  return [parseAffiliateStage, isNumericMoney, amount91, toMoney, ensureRecord,
    lastBuyEdit91, findStage91, getPaymentPurchaseConfigs, getPurchaseLedger,
    getPaymentSummaryForRecord, getRefundEligible91, calculateProjectedProfit,
    getEndBuyTotal, getEndSellRevenue, calculateStatus, daysBetween, hoursBetween,
    passedHours, isOutOfStock, isFinalRefundStatus, normalizeProgress, statusResult]
    .map(fn => ({name: fn.name, sha256: affExportP0Hash(fn.toString()), source: fn.toString()}));
}
// truonglt phase0 readonly exporter end
