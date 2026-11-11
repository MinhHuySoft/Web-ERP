import sys; sys.stdout.reconfigure(encoding="utf-8")
import csv, collections, json, re
rows = list(csv.DictReader(open('D:/Data/Web-ERP/docs/legacy-analysis/data/frmcfg-keys-medcom.csv', encoding='utf-8-sig')))
fc = json.load(open('D:/Data/Medcom/TechnicalDocs/db-audit/workflow-config-20261019/form_config.json', encoding='utf-8-sig'))
def gfam(f):
    return 'TableInfoX (T0..TJ)' if f.startswith('TableInfoX') else f.split(' (')[0]
agg = collections.OrderedDict()
for r in rows:
    k = (gfam(r['Family']), r['Class(source)'], r['Key'])
    a = agg.setdefault(k, dict(rows=0, prop=r['Property(source)'], desc=r['DescriptionVN(source)']))
    a['rows'] += int(r['Rows'])
# forms count per generic key
forms = collections.defaultdict(set)
for x in fc:
    K = x['KeyID'] or ''
    if re.match(r'^T[0-9A-J]$', K): k = ('TableInfoX (T0..TJ)', x['SubID'])
    elif K.startswith('LYS'): k = ('LYS', x['SubValue'])
    elif K.startswith('LYT'): k = ('LYT', 'LYT')
    else: k = ('other', K)
    forms[k].add(x['FID'])
out = ['| Họ | Khóa | Số dòng | Lớp.Thuộc tính (mã nguồn Tools) | Ý nghĩa (rút gọn từ `[Description]`) |', '|---|---|---:|---|---|']
for (fam, cl, key), a in sorted(agg.items(), key=lambda kv: -kv[1]['rows'])[:30]:
    out.append('| %s | `%s` | %d | %s | %s |' % (fam, key, a['rows'], ('%s.%s' % (cl, a['prop'])) if a['prop'] else (cl + ' (không có thuộc tính đọc khóa này)' if cl else '?'), a['desc'].replace('|', '/')[:120]))
open('frag/frmcfg_topkeys_generic.md', 'w', encoding='utf-8').write('\n'.join(out) + '\n')
# LYS control usage
ctl = collections.Counter()
ctlforms = collections.defaultdict(set)
for x in fc:
    if (x['KeyID'] or '').startswith('LYS'):
        b = re.sub(r'_\d+$', '', x['SubID'] or '')
        b = b if b.endswith('Ctl') else '(field thường)'
        ctl[b] += 1; ctlforms[b].add((x['FID'], x['SubID']))
print([(k, v, len(ctlforms[k])) for k, v in ctl.most_common()])
# LYT control types
ct = collections.Counter()
for x in fc:
    if (x['KeyID'] or '').startswith('LYT'):
        ct[(x['KeyValue'] or '').split(';')[0]] += 1
print(ct.most_common())
req = sum(1 for x in fc if (x['KeyID'] or '').startswith('LYT') and len((x['KeyValue'] or '').split(';')) > 17 and (x['KeyValue'] or '').split(';')[17] == '1')
ro = sum(1 for x in fc if (x['KeyID'] or '').startswith('LYT') and len((x['KeyValue'] or '').split(';')) > 4 and (x['KeyValue'] or '').split(';')[4] == '1')
cap = sum(1 for x in fc if (x['KeyID'] or '').startswith('LYT') and len((x['KeyValue'] or '').split(';')) > 7 and (x['KeyValue'] or '').split(';')[7] != '')
print('required', req, 'readonly', ro, 'caption override', cap)
