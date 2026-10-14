# truonglt independent tests start
import copy
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('independent', ROOT / 'scripts/phase0/verify_baseline.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class IndependentBaselineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = module.load(ROOT / 'TikTok_Affiliate_Phase0_References/references/TikTok_Affiliate_HISTORY_20261014_104638.json')
        cls.baseline = module.load(ROOT / 'tests/golden/baseline-input.json')
        cls.expected = module.load(ROOT / 'tests/golden/baseline-expected.json')

    def test_all_46_independent_decode_and_decimal_outputs(self):
        self.assertEqual(module.validate(self.source, self.baseline, self.expected)['status'], 'PASS')

    def test_changed_raw_null_to_blank_detected(self):
        altered = copy.deepcopy(self.baseline)
        item = next(r for r in altered['records'] if r['rawRecord'].get('priceMau1', 'absent') is None)
        item['rawRecord']['priceMau1'] = ''
        self.assertEqual(module.validate(self.source, altered, self.expected)['status'], 'FAIL')

    def test_removed_legacy_record_detected(self):
        altered = copy.deepcopy(self.baseline)
        altered['records'] = [r for r in altered['records'] if r['classification'] != 'LEGACY_UNMATCHED']
        self.assertEqual(module.validate(self.source, altered, self.expected)['status'], 'FAIL')

    def test_modified_history_detected(self):
        altered = copy.deepcopy(self.baseline)
        item = next(r for r in altered['records'] if r['rawRecord'].get('history'))
        item['rawRecord']['history'].pop()
        self.assertEqual(module.validate(self.source, altered, self.expected)['status'], 'FAIL')

    def test_wrong_financial_golden_detected(self):
        altered = copy.deepcopy(self.expected)
        altered['records'][0]['v91']['payment']['paid'] += 1
        self.assertEqual(module.validate(self.source, self.baseline, altered)['status'], 'FAIL')

    def test_null_blank_zero_boolean_are_distinct(self):
        values = [None, '', 0, '0', False]
        self.assertEqual(len({module.semantic(v) for v in values}), 5)


if __name__ == '__main__':
    unittest.main()
# truonglt independent tests end
