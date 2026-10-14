# truonglt Phase3 independent Python Decimal parity start
import importlib.util
from pathlib import Path
from decimal import Decimal
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('phase3_reference', ROOT / 'scripts/phase0/verify_baseline.py')
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)


class Phase3IndependentFinanceTest(unittest.TestCase):
    def test_typescript_outputs_match_independent_python_for_every_record_and_round(self):
        actual = reference.load(ROOT / 'docs/phase3/PARITY_RESULT.json')
        expected = reference.load(ROOT / 'tests/golden/baseline-expected.json')
        self.assertEqual(len(actual['records']), 46)
        records = {r['key']: r for r in actual['records']}
        for item in expected['records']:
            # Independent math, using the frozen source-normalization projection.
            # This does not claim an independent Python normalization implementation.
            calculated = reference.independent_finance(item['v91']['normalizedCopy'])
            result = records[item['key']]
            for field in ['paid', 'unpaid', 'incurred', 'sampleTotal', 'endTotal']:
                self.assertEqual(Decimal(result['payment'][field]), calculated['payment'][field])
            for field in ['missing', 'review']:
                self.assertEqual(result['payment'][field], calculated['payment'][field])
            self.assertEqual(Decimal(result['refund']['total']), calculated['refund']['total'])
            self.assertEqual(result['refund']['missing'], calculated['refund']['missing'])
            self.assertEqual(Decimal(result['projectedProfit']), calculated['projectedProfit'])
            self.assertEqual(len(result['payment']['details']), len(calculated['payment']['details']))
            for new, old in zip(result['payment']['details'], calculated['payment']['details']):
                for field in ['key', 'ordered', 'received', 'verified', 'bucket']:
                    self.assertEqual(new[field], old[field])
                self.assertEqual(None if new['amount'] is None else Decimal(new['amount']), old['amount'])


if __name__ == '__main__':
    unittest.main()
# truonglt Phase3 independent Python Decimal parity end
