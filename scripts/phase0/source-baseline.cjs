// truonglt authoritative baseline start
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const refs = path.join(root, 'TikTok_Affiliate_Phase0_References/references');
const sourcePath = path.join(refs, 'TikTok_Affiliate_HISTORY_20261014_104638.json');
const PINNED_SHA256 = 'b946ef84f65001034d771656bdb56533c158c45b7a8b7c4ca9db139dc3c3f2db';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const normalizeName = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

function decodeProperties(source) {
  if (source.format !== 'TIKTOK_AFFILIATE_DOCUMENT_PROPERTIES_EXPORT' || source.version !== '1.0' ||
      !source.properties || Array.isArray(source.properties)) throw Error('INVALID_SOURCE_FORMAT');
  const props = source.properties;
  const used = new Set();
  const records = [];
  for (const [key, value] of Object.entries(props)) {
    if (!key.startsWith('AFF_PRODUCT_') || /__[a-f0-9]{12}_\d+$/.test(key)) continue;
    if (typeof value !== 'string') throw Error('INVALID_PROPERTY_VALUE');
    used.add(key);
    let decodedJson = value;
    const chunks = [];
    if (value.startsWith('AFFZ91|')) {
      const fields = value.split('|');
      const count = Number(fields[2]);
      const size = Number(fields[3]);
      if (fields.length !== 4 || !/^[a-f0-9]{12}$/.test(fields[1]) ||
          !/^[1-9]\d*$/.test(fields[2]) || !Number.isSafeInteger(count) || count > 150 ||
          !/^[1-9]\d*$/.test(fields[3]) || !Number.isSafeInteger(size) || size > count * 7300) {
        throw Error('INVALID_MANIFEST');
      }
      for (let i = 0; i < count; i++) {
        const chunkKey = key + '__' + fields[1] + '_' + i;
        const chunk = props[chunkKey];
        if (typeof chunk !== 'string' || !chunk.length || chunk.length > 7300) throw Error('INVALID_OR_MISSING_CHUNK');
        used.add(chunkKey);
        chunks.push({ key: chunkKey, value: chunk, sha256: sha(chunk) });
      }
      const encoded = chunks.map(c => c.value).join('');
      if (encoded.length !== size || encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
        throw Error('INVALID_BASE64_OR_SIZE');
      }
      const compressed = Buffer.from(encoded, 'base64');
      if (compressed.toString('base64') !== encoded) throw Error('NON_CANONICAL_BASE64');
      decodedJson = new TextDecoder('utf-8', { fatal: true }).decode(zlib.gunzipSync(compressed));
    }
    const rawRecord = JSON.parse(decodedJson);
    if (!rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord) ||
        typeof rawRecord.name !== 'string') throw Error('INVALID_RECORD');
    if (key !== 'AFF_PRODUCT_' + normalizeName(rawRecord.name)) throw Error('ROOT_IDENTITY_MISMATCH');
    if (rawRecord.history !== undefined && !Array.isArray(rawRecord.history)) throw Error('INVALID_HISTORY_TYPE');
    records.push({ key, manifest: value, manifestSha256: sha(value), chunks, decodedJson,
      decodedSha256: sha(decodedJson), structuralSha256: sha(JSON.stringify(rawRecord)), rawRecord });
  }
  const otherProperties = Object.entries(props).filter(([key]) => !used.has(key));
  if (otherProperties.some(([key]) => key.startsWith('AFF_PRODUCT_'))) throw Error('UNACCOUNTED_PRODUCT_PROPERTY');
  if (Object.keys(props).length !== source.propertyCount) throw Error('PROPERTY_COUNT_MISMATCH');
  return { records, otherProperties };
}

function sourceRuntime(filename) {
  const forbidden = () => { throw Error('FORBIDDEN_LEGACY_SERVICE'); };
  const context = vm.createContext({ PropertiesService: new Proxy({}, { get: () => forbidden }),
    SpreadsheetApp: new Proxy({}, { get: () => forbidden }),
    ScriptApp: new Proxy({}, { get: () => forbidden }) });
  const bytes = fs.readFileSync(path.join(refs, filename));
  vm.runInContext(bytes.toString('utf8'), context);
  return { context, sha256: sha(bytes), filename };
}

function oracle(runtime, record) {
  const normalizedCopy = clone(record);
  runtime.context.ensureRecord(normalizedCopy);
  const result = { normalizedCopy, payment: runtime.context.getPaymentSummaryForRecord(clone(record)),
    refund: runtime.context.getRefundEligible91(clone(record)),
    projectedProfit: runtime.context.calculateProjectedProfit(clone(record)) };
  return clone(result);
}

function valueTypes(value, prefix = '') {
  const types = [];
  if (value === null || typeof value !== 'object') {
    types.push({ path: prefix, type: value === null ? 'null' : value === '' ? 'blank' :
      typeof value === 'number' && value === 0 ? 'zero' : typeof value });
  } else {
    for (const [key, item] of Object.entries(value)) {
      types.push(...valueTypes(item, prefix + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1')));
    }
  }
  return types;
}

function buildBaseline() {
  const originalBytes = fs.readFileSync(sourcePath);
  if (sha(originalBytes) !== PINNED_SHA256) throw Error('SOURCE_CHECKSUM_CHANGED');
  const source = JSON.parse(originalBytes.toString('utf8').replace(/^\uFEFF/, ''));
  const decoded = decodeProperties(source);
  if (decoded.records.length !== 46) throw Error('EXPECTED_46_RECORDS');
  const xlsx = JSON.parse(fs.readFileSync(path.join(root, 'tests/golden/xlsx-observed-input.json'), 'utf8'));
  const matched = new Map(xlsx.products.map(row => ['AFF_PRODUCT_' + normalizeName(row.cells.A.value), row.row]));
  const a = sourceRuntime('Tiktok_Affiliate_V9.1_Original_Backup.gs');
  const b = sourceRuntime('Tiktok_Affiliate_V9.2_Optimized.gs');
  const findings = [];
  const expected = [];
  for (const item of decoded.records) {
    item.classification = matched.has(item.key) ? 'XLSX_MATCHED' : 'LEGACY_UNMATCHED';
    item.xlsxRow = matched.get(item.key) ?? null;
    item.valueTypes = valueTypes(item.rawRecord);
    const rawBefore = JSON.stringify(item.rawRecord);
    const v91 = oracle(a, item.rawRecord);
    const v92 = oracle(b, item.rawRecord);
    if (JSON.stringify(v91) !== JSON.stringify(v92)) throw Error('V91_V92_MISMATCH:' + item.key);
    if (JSON.stringify(item.rawRecord) !== rawBefore) throw Error('RAW_MUTATION');
    const history = item.rawRecord.history || [];
    const snapshots = item.rawRecord.stageData || {};
    expected.push({ key: item.key, classification: item.classification,
      rawHistoryCount: history.length, rawSnapshotCount: Object.keys(snapshots).length,
      historySha256: sha(JSON.stringify(history)), snapshotsSha256: sha(JSON.stringify(snapshots)),
      rawStatePresence: Object.hasOwn(item.rawRecord, 'purchaseState'),
      rawStateSha256: Object.hasOwn(item.rawRecord, 'purchaseState') ? sha(JSON.stringify(item.rawRecord.purchaseState)) : null,
      v91, v92Equal: true, normalizationChanged: JSON.stringify(v91.normalizedCopy) !== rawBefore });
    for (const round of v91.payment.details) {
      const origin = item.rawRecord.schemaVersion === '9.1' ? 'RAW_STATE' : 'DERIVED_V91_ONLY';
      if (round.ordered && round.amount === null) findings.push({ key: item.key, classification: item.classification,
        kind: 'MISSING_ORDER_PRICE', round: round.key, origin });
      if (round.ordered && !round.verified) findings.push({ key: item.key, classification: item.classification,
        kind: 'UNVERIFIED', round: round.key, origin, issue: round.issue });
      if (!round.ordered && !round.verified) findings.push({ key: item.key, classification: item.classification,
        kind: 'UNVERIFIED_NOT_INCURRED', round: round.key, origin, issue: round.issue });
      if (round.issue) findings.push({ key: item.key, kind: 'STORED_OR_DERIVED_ISSUE', round: round.key, origin, issue: round.issue });
      const cfg = { group: round.group, index: round.index };
      const receivedLabel = 'Nhận ' + (cfg.group === 'sample' ? 'mẫu ' : 'End ') + cfg.index;
      const current = (() => { try { return a.context.parseAffiliateStage(item.rawRecord.currentProgress); } catch (_) { return null; } })();
      const wasReceived = Object.keys(snapshots).some(label => {
        try { return a.context.normalizeProgress(label) === receivedLabel; } catch (_) { return false; }
      }) || history.some(event => {
        try { return event.type === 'ENTER_STAGE' && a.context.normalizeProgress(event.progress) === receivedLabel; }
        catch (_) { return false; }
      });
      if (current && !current.done && current.key === round.key && !current.received && wasReceived) {
        findings.push({ key: item.key, kind: 'CURRENT_ORDER_WITH_RECEIVE_HISTORY', round: round.key,
          origin, resolution: 'PRESERVE_SOURCE_NO_REPAIR' });
      }
      const field = cfg.group === 'sample' ? 'price' : 'endPrice';
      const orderedLabel = 'Đặt ' + (cfg.group === 'sample' ? 'mẫu ' : 'End ') + cfg.index;
      for (const [label, snapshot] of Object.entries(snapshots)) {
        let normalized;
        try { normalized = a.context.normalizeProgress(label); } catch (_) { continue; }
        if (normalized === orderedLabel && a.context.amount91(snapshot[field]) !== null &&
            a.context.amount91(snapshot[field]) !== round.amount) {
          findings.push({ key: item.key, kind: 'ORDER_SNAPSHOT_VS_CURRENT_LEDGER_PRICE', round: round.key,
            snapshotAmount: snapshot[field], ledgerAmount: round.amount, origin,
            resolution: 'HISTORICAL_EVIDENCE_ONLY_NO_OVERWRITE' });
        }
      }
    }
  }
  if (decoded.records.filter(r => r.classification === 'XLSX_MATCHED').length !== 24) throw Error('CLASSIFICATION_MISMATCH');
  if (sha(fs.readFileSync(sourcePath)) !== PINNED_SHA256) throw Error('SOURCE_CHANGED_DURING_BUILD');
  const input = { kind: 'OWNER_CONFIRMED_SOURCE_OF_TRUTH', sourceFile: path.relative(root, sourcePath),
    sourceSha256: PINNED_SHA256, sourceMetadata: Object.fromEntries(Object.entries(source).filter(([key]) => key !== 'properties')),
    otherProperties: decoded.otherProperties, xlsxRole: 'CLASSIFICATION_AND_REFERENCE_ONLY', records: decoded.records };
  const expectation = { kind: 'V91_GOLDEN_EXPECTED_ALL_46', sourceSha256: PINNED_SHA256,
    sourceAlgorithms: [a, b].map(({ filename, sha256 }) => ({ filename, sha256 })),
    records: expected, importApproved: false,
    rule: 'Raw record is immutable. normalizedCopy is a calculation projection, never a replacement for source.' };
  const outputDir = path.join(root, 'tests/golden');
  const inputText = JSON.stringify(input, null, 2) + '\n';
  const expectedText = JSON.stringify(expectation, null, 2) + '\n';
  fs.writeFileSync(path.join(outputDir, 'baseline-input.json'), inputText);
  fs.writeFileSync(path.join(outputDir, 'baseline-expected.json'), expectedText);
  const summary = { sourceSha256: PINNED_SHA256, baselineInputSha256: sha(inputText),
    baselineExpectedSha256: sha(expectedText), records: input.records.length, matched: 24, legacy: 22,
    rawHistoryCount: expected.reduce((sum, r) => sum + r.rawHistoryCount, 0),
    rawSnapshotCount: expected.reduce((sum, r) => sum + r.rawSnapshotCount, 0),
    parityMismatches: 0, findings, independentValidation: 'PENDING', importApproved: false,
    timestampPolicy: 'Preserve raw local timestamp text; do not invent UTC or actor.' };
  fs.writeFileSync(path.join(root, 'docs/phase0/SOURCE_BASELINE_VALIDATION.json'), JSON.stringify(summary, null, 2) + '\n');
  return summary;
}

module.exports = { decodeProperties, sourceRuntime, oracle, valueTypes, buildBaseline, sha, PINNED_SHA256, sourcePath };
if (require.main === module) {
  const report = buildBaseline();
  console.log(JSON.stringify({ records: report.records, matched: report.matched, legacy: report.legacy,
    rawHistoryCount: report.rawHistoryCount, rawSnapshotCount: report.rawSnapshotCount,
    parityMismatches: report.parityMismatches, findings: report.findings.length, independentValidation: 'PENDING' }));
}
// truonglt authoritative baseline end
