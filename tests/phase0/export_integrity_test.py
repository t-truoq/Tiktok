# truonglt phase0 integrity tests start
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('validator', ROOT / 'scripts/migration/validate-export.py')
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


def envelope(payload):
    text = json.dumps(payload, ensure_ascii=False)
    return {'format': 'AFFILIATE_EXPORT_ENVELOPE_V1', 'payloadJson': text,
            'payloadSha256': hashlib.sha256(text.encode()).hexdigest()}


def fixture():
    record = {'name': 'Mẫu synthetic', 'history': [{'type': 'ENTER_STAGE'}]}
    raw = json.dumps(record, ensure_ascii=False, indent=2)
    key = 'AFF_PRODUCT_mẫu synthetic'
    return {'format': 'TIKTOK_AFFILIATE_PHASE0_EXPORT_V1', 'exportComplete': True,
            'sourceReadStable': True, 'problems': [], 'activeProductCount': 1,
            'records': [{'key': key, 'normalizedName': 'mẫu synthetic', 'manifest': raw,
                         'manifestSha256': validator.sha(raw), 'decodedJson': raw,
                         'decodedSha256': validator.sha(raw), 'rawRecord': record,
                         'chunks': [], 'rawHistoryCount': 1, 'oracle': {'synthetic': True}}]}


class IntegrityTest(unittest.TestCase):
    def test_exact_unicode_and_whitespace(self):
        report = validator.validate_export(envelope(fixture()))
        self.assertEqual(report['status'], 'INTEGRITY_PASS')
        self.assertEqual(report['reconciliationStatus'], 'NOT_RUN')

    def test_envelope_tamper(self):
        data = envelope(fixture())
        data['payloadJson'] += ' '
        self.assertEqual(validator.validate_export(data)['status'], 'FAIL')

    def test_record_tamper_even_with_new_envelope_checksum(self):
        data = fixture()
        data['records'][0]['decodedJson'] += ' '
        self.assertEqual(validator.validate_export(envelope(data))['status'], 'FAIL')

    def test_history_count_mismatch(self):
        data = fixture()
        data['records'][0]['rawHistoryCount'] = 0
        self.assertEqual(validator.validate_export(envelope(data))['status'], 'FAIL')

    def test_incomplete_not_treated_as_zero_mismatches(self):
        data = fixture()
        data['exportComplete'] = False
        self.assertEqual(validator.validate_export(envelope(data))['status'], 'FAIL')


if __name__ == '__main__':
    unittest.main()
# truonglt phase0 integrity tests end
