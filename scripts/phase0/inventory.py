# truonglt phase0 inventory start
"""Read source/XLSX without modifying references; retain original OOXML values."""
from pathlib import Path
import collections
import difflib
import hashlib
import json
import posixpath
import re
import zipfile
import xml.etree.ElementTree as ET
from decimal import Decimal

ROOT = Path(__file__).resolve().parents[2]
REF = ROOT / 'TikTok_Affiliate_Phase0_References' / 'references'
OUT = ROOT / 'docs' / 'phase0'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def source_inventory():
    sources = {}
    functions = {}
    for path in sorted(REF.iterdir()):
        raw = path.read_bytes()
        sources[path.name] = {'bytes': len(raw), 'sha256': digest(raw)}
        if path.suffix not in ('.gs', '.txt'):
            continue
        text = raw.decode('utf-8-sig')
        matches = list(re.finditer(r'^function\s+(\w+)\s*\(', text, re.M))
        functions[path.name] = []
        for i, match in enumerate(matches):
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            section = text[match.start():end]
            functions[path.name].append({
                'name': match[1], 'line': text.count('\n', 0, match.start()) + 1,
                'sectionSha256': digest(section.encode()),
                'calls': sorted(set(re.findall(r'\b(\w+)\s*\(', section)) - {match[1]}),
            })
    a = (REF / 'Tiktok_Affiliate_V9.1_Original_Backup.gs').read_text(encoding='utf-8-sig')
    b = (REF / 'Tiktok_Affiliate_V9.2_Optimized.gs').read_text(encoding='utf-8-sig')
    pasted = (REF / 'Pasted text(20261014-015629).txt').read_text(encoding='utf-8-sig')
    write_json(OUT / 'source-inventory.json', {'sources': sources, 'functions': functions,
               'pastedTextEqualsV91AfterNewlineNormalization': pasted == a,
               'note': 'Function sections include trailing comments; call scan is lexical, not AST.'})
    (OUT / 'v91-v92.diff').write_text(''.join(difflib.unified_diff(
        a.splitlines(True), b.splitlines(True), fromfile='V9.1', tofile='V9.2')), encoding='utf-8')
    v91 = {f['name']: f['line'] for f in functions['Tiktok_Affiliate_V9.1_Original_Backup.gs']}
    table = ['<!-- truonglt function inventory start -->', '# Danh mục toàn bộ hàm global', '',
             'Source nằm trong `TikTok_Affiliate_Phase0_References/references/`. Tên hàm và số dòng trích từ toàn bộ file; semantics xem LEGACY_RULE_MAP.md.', '',
             '| Hàm | Dòng V9.1 | Dòng V9.2 |', '|---|---:|---:|']
    table += [f"| `{f['name']}` | {v91.get(f['name'], 'không có')} | {f['line']} |"
              for f in functions['Tiktok_Affiliate_V9.2_Optimized.gs']]
    table += ['', '<!-- truonglt function inventory end -->', '']
    (OUT / 'FUNCTION_INVENTORY.md').write_text('\n'.join(table), encoding='utf-8')
    return sources, functions


def workbook_inventory():
    path = REF / 'Tiktok affiliate.xlsx'
    with zipfile.ZipFile(path) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            for item in ET.fromstring(archive.read('xl/sharedStrings.xml')):
                strings.append(''.join(t.text or '' for t in item.findall('.//s:t', NS)))
        rels = {r.get('Id'): posixpath.normpath(posixpath.join('xl', r.get('Target')))
                for r in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        book = ET.fromstring(archive.read('xl/workbook.xml'))
        sheets = []
        for sheet in book.find('s:sheets', NS):
            rel_id = sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            target = rels[rel_id].lstrip('/')
            tree = ET.fromstring(archive.read(target))
            rows = []
            types = collections.Counter()
            formulas = 0
            for row in tree.findall('s:sheetData/s:row', NS):
                cells = {}
                for cell in row:
                    value_node = cell.find('s:v', NS)
                    raw = value_node.text if value_node is not None else None
                    kind = cell.get('t', 'n')
                    value = strings[int(raw)] if kind == 's' and raw is not None else raw
                    if kind == 'inlineStr':
                        value = ''.join(t.text or '' for t in cell.findall('.//s:t', NS))
                    formula = cell.find('s:f', NS)
                    formulas += int(formula is not None)
                    types[kind if raw is not None or value else 'blank'] += 1
                    cells[re.sub(r'\d+', '', cell.get('r'))] = {
                        'address': cell.get('r'), 'type': kind, 'style': cell.get('s'),
                        'rawValue': raw, 'value': value,
                        'formula': formula.text if formula is not None else None,
                    }
                rows.append({'row': int(row.get('r')), 'cells': cells})
            sheets.append({'name': sheet.get('name'), 'xmlPath': target, 'rows': rows,
                           'cellTypes': dict(types), 'formulaCount': formulas})
        media = [{'path': name, 'bytes': len(archive.read(name)), 'sha256': digest(archive.read(name))}
                 for name in archive.namelist() if name.startswith('xl/media/')]
        report = {'sourceSha256': digest(path.read_bytes()), 'sheets': sheets, 'media': media,
                  'datePolicy': 'Keep numeric date serial + style. Timezone unavailable in XLSX.',
                  'reconciliation': 'NOT_RUN_NO_DOCUMENT_PROPERTIES'}
        write_json(OUT / 'workbook-inventory.json', report)
        main = next(s for s in sheets if s['name'] == 'Trang tính2')
        products = [r for r in main['rows'] if r['row'] >= 3 and (r['cells'].get('A', {}).get('value') or '').strip()]
        names = collections.Counter(re.sub(r'\s+', ' ', r['cells']['A']['value'].strip().lower()) for r in products)
        totals = next(r for r in main['rows'] if r['row'] == 2)['cells']
        comparisons = {}
        for col in ['K', 'M', 'N', 'P', 'Q', 'R']:
            known = [Decimal(r['cells'][col]['value']) for r in products
                     if r['cells'].get(col, {}).get('type') == 'n' and r['cells'][col]['value'] is not None]
            observed = totals.get(col, {}).get('value')
            known_sum = sum(known, Decimal(0))
            comparisons[col] = {'sumOfKnownProductCells': str(known_sum), 'missingProductCells': len(products) - len(known),
                                'observedRow2': observed,
                                'observedDifference': str(known_sum - Decimal(observed)) if observed is not None else None}
        write_json(OUT / 'workbook-observations.json', {
            'kind': 'SNAPSHOT_DIAGNOSTICS_NOT_LEGACY_RECONCILIATION',
            'products': len(products), 'duplicateNormalizedNames': [k for k, count in names.items() if count > 1],
            'summaryCellComparisons': comparisons,
            'auditSnapshots': [{'name': s['name'], 'detailRows': len(s['rows']) - 1,
                               'missingPriceRows': sum(1 for r in s['rows'][1:] if r['cells'].get('F', {}).get('value') == 'THIẾU GIÁ ĐẶT'),
                               'needsReviewRows': sum(1 for r in s['rows'][1:] if r['cells'].get('G', {}).get('value') == 'Can doi soat')}
                              for s in sheets if s['name'].startswith('PAYMENT_AUDIT_')],
        })
        write_json(ROOT / 'tests/golden/xlsx-observed-input.json', {
            'kind': 'XLSX_OBSERVATIONS_ONLY', 'sourceSha256': report['sourceSha256'],
            'legacyRecordsAvailable': False, 'products': products})
        write_json(ROOT / 'tests/golden/xlsx-observed-expected.json', {
            'kind': 'OBSERVED_OUTPUTS_NOT_RECONCILED', 'sourceSha256': report['sourceSha256'],
            'verifiedAgainstLegacyEngine': False,
            'products': [{'row': r['row'], 'name': r['cells']['A']['value'],
                          'observedCells': {col: r['cells'].get(col) for col in ['N', 'P', 'Q', 'R', 'S']},
                          'authoritativeExpected': None} for r in products]})
        return sheets, products, media


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    sources, functions = source_inventory()
    sheets, products, media = workbook_inventory()
    print(json.dumps({'sources': len(sources), 'functionCounts': {k: len(v) for k, v in functions.items()},
                      'sheets': [{'name': s['name'], 'rows': len(s['rows']), 'formulas': s['formulaCount']} for s in sheets],
                      'productRows': len(products), 'media': len(media)}, ensure_ascii=False))
# truonglt phase0 inventory end
