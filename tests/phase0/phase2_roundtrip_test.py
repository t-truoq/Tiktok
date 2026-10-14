# truonglt phase2 preservation and staging start
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import unittest
from decimal import Decimal

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('phase2_roundtrip', ROOT / 'scripts/phase2/verify_roundtrip.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)

class IndependentRoundTripTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        node = shutil.which('node') or 'C:/Program Files/nodejs/node.exe'
        result = subprocess.run([node, '-e',
            "process.stdout.write(JSON.stringify(require('./scripts/phase2/preservation.cjs').prepare()))"],
            cwd=ROOT, check=True, capture_output=True)
        cls.plan = json.loads(result.stdout, parse_float=Decimal)

    def test_independent_archive_records_and_decimal_values(self):
        report = verifier.validate(self.plan)
        self.assertEqual(report['status'], 'PASS')
        self.assertEqual(report['exactDecimalSlots'], 4694)

    def test_independent_verifier_rejects_tampered_payload_or_decimal(self):
        for kind in ['event', 'decimal', 'blank']:
            with self.subTest(kind=kind):
                plan = copy.deepcopy(self.plan)
                if kind == 'event':
                    next(r for r in plan['records'] if r['history'])['history'].pop()
                else:
                    state = 'NUMBER' if kind == 'decimal' else 'BLANK'
                    slot = next(s for r in plan['records'] for s in r['financialSlots'] if s['state'] == state)
                    slot['decimal' if kind == 'decimal' else 'raw'] = '0.01' if kind == 'decimal' else None
                with self.assertRaises(AssertionError):
                    verifier.validate(plan)

# truonglt phase2 preservation and staging end
