# truonglt phase0 export integrity validator start
"""Check exact bytes/checksums. Does not import, normalize, execute source or certify parity."""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path


def sha(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def validate_export(envelope):
    errors = []
    if envelope.get('format') != 'AFFILIATE_EXPORT_ENVELOPE_V1':
        return {'status': 'FAIL', 'errors': ['INVALID_ENVELOPE_FORMAT'], 'reconciliationStatus': 'NOT_RUN'}
    text = envelope.get('payloadJson')
    if not isinstance(text, str) or sha(text) != envelope.get('payloadSha256'):
        return {'status': 'FAIL', 'errors': ['PAYLOAD_CHECKSUM_MISMATCH'], 'reconciliationStatus': 'NOT_RUN'}
    payload = json.loads(text)
    if payload.get('format') != 'TIKTOK_AFFILIATE_PHASE0_EXPORT_V1':
        errors.append({'code': 'INVALID_PAYLOAD_FORMAT'})
    if payload.get('sourceReadStable') is not True or payload.get('exportComplete') is not True:
        errors.append({'code': 'INCOMPLETE_OR_UNSTABLE_EXPORT'})
    errors.extend(payload.get('problems', []))
    seen = set()
    for item in payload.get('records', []):
        key = item.get('key')
        if key in seen:
            errors.append({'code': 'DUPLICATE_EXPORTED_KEY', 'key': key})
        seen.add(key)
        try:
            normalized = item['normalizedName']
            if key != 'AFF_PRODUCT_' + normalized:
                raise ValueError('STORAGE_KEY_MISMATCH')
            raw = item['decodedJson']
            manifest = item['manifest']
            if sha(manifest) != item['manifestSha256'] or sha(raw) != item['decodedSha256']:
                raise ValueError('RECORD_CHECKSUM_MISMATCH')
            if json.loads(raw) != item['rawRecord']:
                raise ValueError('RAW_RECORD_MISMATCH')
            if manifest.startswith('AFFZ91|'):
                fields = manifest.split('|')
                chunks = item['chunks']
                if len(fields) != 4 or len(chunks) != int(fields[2]):
                    raise ValueError('CHUNK_COUNT_MISMATCH')
                for index, chunk in enumerate(chunks):
                    if chunk['key'] != key + '__' + fields[1] + '_' + str(index):
                        raise ValueError('CHUNK_KEY_MISMATCH')
                    if sha(chunk['value']) != chunk['sha256']:
                        raise ValueError('CHUNK_CHECKSUM_MISMATCH')
                encoded = ''.join(c['value'] for c in chunks)
                if len(encoded) != int(fields[3]):
                    raise ValueError('ENCODED_SIZE_MISMATCH')
                decoded = gzip.decompress(base64.b64decode(encoded, validate=True)).decode('utf-8')
                if decoded != raw:
                    raise ValueError('DECODED_TEXT_MISMATCH')
            elif manifest != raw or item['chunks']:
                raise ValueError('RAW_JSON_STORAGE_MISMATCH')
            history = item['rawRecord'].get('history')
            count = len(history) if isinstance(history, list) else None
            if item['rawHistoryCount'] != count:
                raise ValueError('HISTORY_COUNT_MISMATCH')
            if not item.get('oracle'):
                raise ValueError('MISSING_LEGACY_ORACLE')
        except (ValueError, KeyError, TypeError, OSError) as error:
            errors.append({'code': str(error), 'key': key})
    if len(seen) != payload.get('activeProductCount'):
        errors.append({'code': 'ACTIVE_PRODUCT_COUNT_MISMATCH'})
    return {'status': 'FAIL' if errors else 'INTEGRITY_PASS', 'errors': errors,
            'products': len(seen), 'reconciliationStatus': 'NOT_RUN',
            'note': 'Integrity is not financial reconciliation, history completeness sign-off, or migration authorization.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('export_file', type=Path)
    args = parser.parse_args()
    try:
        report = validate_export(json.loads(args.export_file.read_text(encoding='utf-8-sig')))
    except (ValueError, OSError, TypeError) as error:
        report = {'status': 'FAIL', 'errors': [{'code': type(error).__name__}], 'reconciliationStatus': 'NOT_RUN'}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report['status'] == 'INTEGRITY_PASS' else 1)
# truonglt phase0 export integrity validator end
