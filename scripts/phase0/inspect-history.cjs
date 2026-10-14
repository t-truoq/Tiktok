// truonglt history export inspection start
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const refs = path.join(root, 'TikTok_Affiliate_Phase0_References/references');
const sourcePath = path.join(refs, 'TikTok_Affiliate_HISTORY_20261014_104638.json');
const bytes = fs.readFileSync(sourcePath);
const source = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const props = source.properties;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const normalize = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'tests/golden/baseline-input.json'), 'utf8'));
const active = new Map(baseline.products.map(row => ['AFF_PRODUCT_' + normalize(row.cells.A.value), row]));

function runtime(filename) {
  const forbidden = () => { throw Error('SOURCE_SERVICE_ACCESS_FORBIDDEN'); };
  const ctx = vm.createContext({
    PropertiesService: new Proxy({}, { get: () => forbidden }),
    SpreadsheetApp: new Proxy({}, { get: () => forbidden }),
  });
  vm.runInContext(fs.readFileSync(path.join(refs, filename), 'utf8'), ctx);
  return ctx;
}
const v91 = runtime('Tiktok_Affiliate_V9.1_Original_Backup.gs');
const v92 = runtime('Tiktok_Affiliate_V9.2_Optimized.gs');
const roots = Object.entries(props).filter(([key]) => key.startsWith('AFF_PRODUCT_') &&
  !/__[a-f0-9]{12}_\d+$/.test(key));
const problems = [];
const products = [];
const totals = { paid: 0, unpaid: 0, refundEligible: 0, projectedProfit: 0, missing: 0, review: 0 };

function oracle(ctx, raw) {
  const copy = () => JSON.parse(JSON.stringify(raw));
  return JSON.parse(JSON.stringify({ payment: ctx.getPaymentSummaryForRecord(copy()),
    refund: ctx.getRefundEligible91(copy()), projectedProfit: ctx.calculateProjectedProfit(copy()) }));
}

for (const [key, manifest] of roots) {
  try {
    let decoded = manifest;
    if (manifest.startsWith('AFFZ91|')) {
      const fields = manifest.split('|');
      const count = Number(fields[2]);
      if (fields.length !== 4 || !Number.isInteger(count) || count < 1 || count > 150) throw Error('INVALID_MANIFEST');
      const chunks = Array.from({ length: count }, (_, index) => {
        const part = props[key + '__' + fields[1] + '_' + index];
        if (typeof part !== 'string') throw Error('MISSING_CHUNK');
        return part;
      });
      const encoded = chunks.join('');
      if (encoded.length !== Number(fields[3])) throw Error('SIZE_MISMATCH');
      if (encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw Error('INVALID_BASE64');
      decoded = new TextDecoder('utf-8', { fatal: true }).decode(zlib.gunzipSync(Buffer.from(encoded, 'base64')));
    }
    const raw = JSON.parse(decoded);
    const history = Array.isArray(raw.history) ? raw.history : [];
    const row = active.get(key);
    const item = { key, name: raw.name, activeRelativeToXlsx: !!row, row: row?.row,
      encoding: manifest.startsWith('AFFZ91|') ? 'gzip-base64' : 'raw-json',
      decodedSha256: hash(decoded), schemaVersion: raw.schemaVersion || 'legacy',
      currentProgress: raw.currentProgress, historyCount: history.length,
      historyTypes: Object.fromEntries([...new Set(history.map(h => h.type))]
        .map(type => [type, history.filter(h => h.type === type).length])),
      firstHistory: history[0]?.timestamp, lastHistory: history.at(-1)?.timestamp,
      snapshotCount: Object.keys(raw.stageData || {}).length };
    if (row) {
      const original = JSON.stringify(raw);
      const a = oracle(v91, raw);
      const b = oracle(v92, raw);
      if (JSON.stringify(a) !== JSON.stringify(b)) problems.push({ key, code: 'SOURCE_VERSION_ORACLE_MISMATCH' });
      if (JSON.stringify(raw) !== original) throw Error('RAW_RECORD_MUTATED');
      item.oracle = a;
      item.observationDifferences = [];
      for (const [col, value] of [['P', a.payment.paid], ['Q', a.payment.unpaid],
        ['R', a.refund.total], ['N', a.projectedProfit]]) {
        const cell = row.cells[col];
        if (cell?.value === null || cell?.value === undefined) {
          item.observationDifferences.push({ col, kind: 'BLANK_NOT_ZERO', computed: value });
        } else if (Number(cell.value) !== value) {
          item.observationDifferences.push({ col, kind: 'NUMERIC_DIFFERENCE', observed: cell.value, computed: value });
        }
      }
      totals.paid += a.payment.paid;
      totals.unpaid += a.payment.unpaid;
      totals.refundEligible += a.refund.total;
      totals.projectedProfit += a.projectedProfit;
      totals.missing += a.payment.missing;
      totals.review += a.payment.review;
    }
    products.push(item);
  } catch (error) {
    problems.push({ key, code: String(error.message) });
  }
}

const report = { sourceFile: path.relative(root, sourcePath), sourceSha256: hash(bytes),
  exportedAt: source.exportedAt, declaredProductCount: source.productCount,
  propertyCount: Object.keys(props).length, rootCount: roots.length,
  chunkCount: Object.keys(props).filter(key => /__[a-f0-9]{12}_\d+$/.test(key)).length,
  decodedRecords: products.length, declaredInvalidCount: source.invalidRecords.length,
  activeProducts: products.filter(p => p.activeRelativeToXlsx).length,
  inactiveRelativeToXlsx: products.filter(p => !p.activeRelativeToXlsx).length,
  activeHistoryCount: products.filter(p => p.activeRelativeToXlsx).reduce((sum, p) => sum + p.historyCount, 0),
  activeSnapshotCount: products.filter(p => p.activeRelativeToXlsx).reduce((sum, p) => sum + p.snapshotCount, 0),
  missingActiveKeys: [...active.keys()].filter(key => !products.some(p => p.key === key)),
  problems, totals, products,
  gate0Complete: false,
  limitations: ['Active set based on supplied XLSX, not current row metadata in this export.',
    'No source-export checksum, runtime fingerprints/timezone, or concurrent-read stability proof.',
    'Legacy source oracle comparison is preliminary; missing prices/history completeness remain unresolved.',
    'No import, repair, source mutation, migration or database access.'],
};
const output = path.join(root, 'docs/phase0/HISTORY_EXPORT_REVIEW.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
if (hash(fs.readFileSync(sourcePath)) !== report.sourceSha256) throw Error('SOURCE_CHANGED_DURING_READ');
console.log(JSON.stringify({ decodedRecords: report.decodedRecords, activeProducts: report.activeProducts,
  historyEvents: report.activeHistoryCount, snapshots: report.activeSnapshotCount, totals,
  problems: report.problems, differences: products.flatMap(p => (p.observationDifferences || [])
    .map(d => ({ row: p.row, name: p.name, ...d }))), gate0Complete: false }, null, 2));
// truonglt history export inspection end
