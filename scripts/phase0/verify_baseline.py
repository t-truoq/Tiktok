# truonglt independent baseline validation start
"""Independent Python decode/type validation and Decimal ledger/refund/profit checks."""
from pathlib import Path
from decimal import Decimal, InvalidOperation
import base64
import gzip
import hashlib
import json
import math
import re

ROOT = Path(__file__).resolve().parents[2]
PIN = 'b946ef84f65001034d771656bdb56533c158c45b7a8b7c4ca9db139dc3c3f2db'


def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'), parse_float=Decimal)


def number(value):
    if value is None:
        return Decimal(0)
    if isinstance(value, bool):
        return Decimal(int(value))
    if isinstance(value, list):
        value = ','.join('' if v is None else str(v) for v in value)
    try:
        text = str(value).strip()
        if not text:
            return Decimal(0)
        if re.fullmatch(r'0[xob][0-9a-f]+', text, re.I):
            return Decimal(int(text, 0))
        result = Decimal(text)
        return result if result.is_finite() else None
    except (InvalidOperation, ValueError):
        return None


def money(value):
    if value is None or value == '' or isinstance(value, bool):
        return None
    result = number(value)
    return result if result is not None and result >= 0 else None


def stage(value):
    text = re.sub(r'\s+', ' ', str(value or '').strip())
    match = re.fullmatch(r'(đặt|nhận) (mẫu|sample|end) ([1-9]\d*)', text, re.I)
    if not match or int(match[3]) > 9007199254740991:
        return None
    return ('end' if match[2].lower() == 'end' else 'sample', int(match[3]))


def independent_finance(record):
    states = record.get('purchaseState', {})
    keys = set(states)
    labels = list(record.get('stageData', {})) + [h.get('progress') for h in record.get('history', [])]
    labels.append(record.get('currentProgress'))
    for label in labels:
        parsed = stage(label)
        if parsed:
            keys.add(f'{parsed[0]}:{parsed[1]}')
    for key, value in record.items():
        match = re.fullmatch(r'price(Mau|End)([1-9]\d*)', key)
        if match and money(value) is not None:
            keys.add(('sample' if match[1] == 'Mau' else 'end') + ':' + str(int(match[2])))
    details = []
    summary = {k: Decimal(0) for k in ['paid', 'unpaid', 'incurred', 'sampleTotal', 'endTotal']}
    summary.update(missing=0, review=0)
    for key in sorted(keys, key=lambda k: (not k.startswith('sample:'), int(k.split(':')[-1]))):
        group, index = key.split(':')
        if group not in ('sample', 'end') or int(index) < 1:
            continue
        state = states.get(key, {})
        ordered = bool(state.get('ordered')) and not state.get('cancelled')
        received = ordered and bool(state.get('received'))
        amount = money(record.get(('priceMau' if group == 'sample' else 'priceEnd') + index)) if ordered else Decimal(0)
        bucket = 'NOT_INCURRED' if not ordered else 'MISSING_ORDER_PRICE' if amount is None else 'PAID' if received else 'UNPAID'
        status = 'CHƯA PHÁT SINH / ĐÃ HỦY' if not ordered else 'THIẾU GIÁ ĐẶT' if amount is None else 'ĐÃ THANH TOÁN' if received else 'CHƯA THANH TOÁN'
        verified = state.get('verified') is True
        item = {'key': key, 'group': group, 'index': int(index),
                'label': ('Mẫu ' if group == 'sample' else 'End ') + index,
                'ordered': ordered, 'received': received, 'amount': amount, 'verified': verified,
                'issue': state.get('issue') or '', 'bucket': bucket, 'status': status}
        details.append(item)
        if ordered:
            summary['review'] += int(not verified)
            if amount is None:
                summary['missing'] += 1
            else:
                summary['incurred'] += amount
                summary['sampleTotal' if group == 'sample' else 'endTotal'] += amount
                summary['paid' if received else 'unpaid'] += amount
    summary['details'] = details
    samples = {d['index']: d for d in details if d['group'] == 'sample' and d['ordered']}
    refund = {'total': Decimal(0), 'missing': 0}
    revenue = Decimal(0)
    for item in details:
        if item['group'] != 'end':
            continue
        index = str(item['index'])
        if item['ordered']:
            revenue += (money(record.get('sellEnd' + index)) or Decimal(0)) * (money(record.get('qtySellEnd' + index)) or Decimal(0))
        if item['received']:
            sample = samples.get(item['index'])
            if sample and sample['amount'] is not None:
                refund['total'] += sample['amount']
            else:
                refund['missing'] += 1
    profit = (money(record.get('wholesale')) or Decimal(0)) * (number(record.get('qty')) or Decimal(0)) + revenue - summary['endTotal']
    return {'payment': summary, 'refund': refund, 'projectedProfit': profit}


def semantic(value):
    """Strict JSON types: bool is not number; null/blank/zero never equal."""
    if isinstance(value, dict):
        return ('object', tuple(sorted((key, semantic(v)) for key, v in value.items())))
    if isinstance(value, list):
        return ('array', tuple(semantic(v) for v in value))
    if value is None:
        return ('null',)
    if isinstance(value, bool):
        return ('boolean', value)
    if isinstance(value, (int, float, Decimal)):
        return ('number', Decimal(str(value)))
    return ('string', value)


def decoded_records(source):
    result = {}
    props = source['properties']
    used = set()
    for key, raw in props.items():
        if not key.startswith('AFF_PRODUCT_') or re.search(r'__[a-f0-9]{12}_\d+$', key):
            continue
        used.add(key)
        text = raw
        if raw.startswith('AFFZ91|'):
            fields = raw.split('|')
            if len(fields) != 4 or not re.fullmatch('[a-f0-9]{12}', fields[1]):
                raise ValueError('MANIFEST_FORMAT')
            count, size = int(fields[2]), int(fields[3])
            if count < 1 or count > 150:
                raise ValueError('MANIFEST_COUNT')
            chunks = []
            for index in range(count):
                chunk_key = f'{key}__{fields[1]}_{index}'
                chunk = props[chunk_key]
                if not isinstance(chunk, str) or not 0 < len(chunk) <= 7300:
                    raise ValueError('CHUNK_SIZE')
                used.add(chunk_key)
                chunks.append(chunk)
            encoded = ''.join(chunks)
            if len(encoded) != size:
                raise ValueError('ENCODED_SIZE')
            compressed = base64.b64decode(encoded, validate=True)
            if base64.b64encode(compressed).decode() != encoded:
                raise ValueError('BASE64_CANONICAL')
            text = gzip.decompress(compressed).decode('utf-8', errors='strict')
        record = json.loads(text, parse_float=Decimal)
        if not isinstance(record, dict):
            raise ValueError('RECORD_TYPE')
        result[key] = (text, record)
    if set(k for k in props if k.startswith('AFF_PRODUCT_')) != used:
        raise ValueError('UNACCOUNTED_PRODUCT_PROPERTIES')
    return result


def validate(source, baseline, expected):
    errors = []
    decoded = decoded_records(source)
    fixtures = {r['key']: r for r in baseline['records']}
    expectations = {r['key']: r for r in expected['records']}
    if len(fixtures) != 46 or set(decoded) != set(fixtures) or set(decoded) != set(expectations):
        errors.append('RECORD_COVERAGE')
    history_count = 0
    snapshots = 0
    for key, (text, record) in decoded.items():
        fixture = fixtures.get(key)
        expectation = expectations.get(key)
        if not fixture or not expectation:
            continue
        if text != fixture['decodedJson'] or hashlib.sha256(text.encode()).hexdigest() != fixture['decodedSha256']:
            errors.append(key + ':DECODED_CHECKSUM')
        if semantic(record) != semantic(fixture['rawRecord']):
            errors.append(key + ':RAW_TYPES_OR_VALUES_CHANGED')
        count = len(record.get('history', []))
        snapshot_count = len(record.get('stageData', {}))
        history_count += count
        snapshots += snapshot_count
        if count != expectation['rawHistoryCount'] or snapshot_count != expectation['rawSnapshotCount']:
            errors.append(key + ':HISTORY_SNAPSHOT_COUNT')
        oracle = expectation['v91']
        independent = independent_finance(oracle['normalizedCopy'])
        for metric in ('payment', 'refund', 'projectedProfit'):
            if semantic(independent[metric]) != semantic(oracle[metric]):
                errors.append(key + ':DECIMAL_' + metric)
    matched = sum(r['classification'] == 'XLSX_MATCHED' for r in fixtures.values())
    if matched != 24 or len(fixtures) - matched != 22 or history_count != 1224 or snapshots != 133:
        errors.append('BASELINE_COUNTS')
    return {'status': 'PASS' if not errors else 'FAIL', 'errors': errors, 'records': len(decoded),
            'historyCount': history_count, 'snapshotCount': snapshots,
            'method': 'Independent Python gzip/JSON/type comparison plus exact Decimal finance on V9.1 calculation projections',
            'limitations': 'Legacy normalization is checked V9.1 vs V9.2; Python math is independent after that projection. Raw source is never replaced.'}


if __name__ == '__main__':
    source_path = ROOT / 'TikTok_Affiliate_Phase0_References/references/TikTok_Affiliate_HISTORY_20261014_104638.json'
    if hashlib.sha256(source_path.read_bytes()).hexdigest() != PIN:
        raise SystemExit('SOURCE_CHECKSUM_CHANGED')
    report = validate(load(source_path), load(ROOT / 'tests/golden/baseline-input.json'),
                      load(ROOT / 'tests/golden/baseline-expected.json'))
    summary = load(ROOT / 'docs/phase0/SOURCE_BASELINE_VALIDATION.json')
    for filename, key in [('baseline-input.json', 'baselineInputSha256'), ('baseline-expected.json', 'baselineExpectedSha256')]:
        if hashlib.sha256((ROOT / 'tests/golden' / filename).read_bytes()).hexdigest() != summary[key]:
            report['errors'].append('FIXTURE_CHECKSUM:' + filename)
            report['status'] = 'FAIL'
    output = ROOT / 'docs/phase0/INDEPENDENT_VALIDATION.json'
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))
    raise SystemExit(0 if report['status'] == 'PASS' else 1)
# truonglt independent baseline validation end
