# truonglt phase2 preservation and staging start
"""Independent cross-language verification of the persisted offline plan."""
import base64
import gzip
import hashlib
import json
import re
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PIN = 'b946ef84f65001034d771656bdb56533c158c45b7a8b7c4ca9db139dc3c3f2db'

def strict_equal(a, b):
    if isinstance(a, dict):
        return isinstance(b, dict) and a.keys() == b.keys() and all(strict_equal(v, b[k]) for k, v in a.items())
    if isinstance(a, list):
        return isinstance(b, list) and len(a) == len(b) and all(strict_equal(x, y) for x, y in zip(a, b))
    return type(a) is type(b) and a == b

def validate(plan):
    archive = base64.b64decode(plan['originalBase64'], validate=True)
    assert hashlib.sha256(archive).hexdigest() == PIN
    assert archive == (ROOT / 'TikTok_Affiliate_Phase0_References/references/TikTok_Affiliate_HISTORY_20261014_104638.json').read_bytes()
    props = json.loads(archive)['properties']
    keys = {k for k in props if k.startswith('AFF_PRODUCT_') and not re.search(r'__[a-f0-9]{12}_\d+$', k)}
    assert len(plan['records']) == len(keys) == 46
    assert set(r['key'] for r in plan['records']) == keys
    events = snapshots = checked = 0
    for record in plan['records']:
        text = props[record['key']]
        if text.startswith('AFFZ91|'):
            _, version, parts, size = text.split('|')
            chunks = ''.join(props[f"{record['key']}__{version}_{i}"] for i in range(int(parts)))
            assert len(chunks) == int(size)
            text = gzip.decompress(base64.b64decode(chunks, validate=True)).decode('utf-8')
        assert text == record['decodedJson']
        assert hashlib.sha256(text.encode()).hexdigest() == record['decodedSha256']
        raw = json.loads(text, parse_float=Decimal)
        assert strict_equal(raw, record['rawRecord'])
        assert strict_equal(raw.get('history', []), [r['payload'] for r in record['history']])
        assert strict_equal(raw.get('stageData', {}), {r['label']: r['payload'] for r in record['snapshots']})
        assert strict_equal(raw.get('purchaseState', {}), {r['key']: r['payload'] for r in record['rounds']})
        events += len(record['history'])
        snapshots += len(record['snapshots'])
        for slot in record['financialSlots']:
            value = raw
            for token in slot['pointer'].split('/')[1:]:
                key = token.replace('~1', '/').replace('~0', '~')
                value = value[int(key)] if isinstance(value, list) else value[key]
            assert strict_equal(value, slot['raw'])
            if slot['state'] == 'NUMBER':
                assert Decimal(slot['decimal']) == Decimal(str(value))
                checked += 1
            else:
                assert slot['decimal'] is None
    assert (events, snapshots) == (1224, 133)
    return {'status': 'PASS', 'records': 46, 'history': events, 'snapshots': snapshots,
            'exactDecimalSlots': checked, 'method': 'Independent Python archive/gzip/type/Decimal verification',
            'databaseExecuted': False}

if __name__ == '__main__':
    plan = json.loads((ROOT / 'artifacts/preservation-plan.json').read_text(encoding='utf-8'), parse_float=Decimal)
    report = validate(plan)
    (ROOT / 'docs/phase2/INDEPENDENT_ROUNDTRIP.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report))

# truonglt phase2 preservation and staging end
