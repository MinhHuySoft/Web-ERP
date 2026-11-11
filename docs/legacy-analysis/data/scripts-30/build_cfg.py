import sys; sys.stdout.reconfigure(encoding="utf-8")
import json, csv, re, os, collections

W = 'D:/Data/Medcom/TechnicalDocs/db-audit/workflow-config-20261019/'
R = 'D:/Data/Medcom/TechnicalDocs/db-audit/run-20261019/'
OUT = 'D:/Data/Web-ERP/docs/legacy-analysis/data/'
SCR = os.path.dirname(os.path.abspath(__file__)) + '/'
IDX = 'D:/Data/Medcom/Medcom/inventories/erp/WINFORMS_PROPERTY_KEY_INDEX.json'


def load(p):
    with open(p, encoding='utf-8-sig') as f:
        return json.load(f)


def nz(v):
    return '' if v is None else str(v)


fc = load(W + 'form_config.json')
forms = {f['FormID'].upper(): f for f in load(W + 'forms.json')}
keys = load(SCR + 'keys_from_source.json')
idx = load(IDX)
columns = load(R + 'columns.json')
obtn = load(W + 'option_buttons.json')
fflt = load(W + 'form_filters.json')
gact = load(W + 'grid_actions.json')
fact = load(W + 'form_actions.json')
menu_rows = list(csv.DictReader(open(OUT + 'menu-medcom.csv', encoding='utf-8-sig')))

cols_by_obj = collections.defaultdict(list)
for c in columns:
    cols_by_obj[c['object_name'].upper()].append(c)

by_cls = collections.defaultdict(dict)
for k in keys:
    by_cls[k['cls']].setdefault(k['key'], k)
idx_by_key = collections.defaultdict(list)
for r in idx['records']:
    idx_by_key[r['key_literal']].append(r)

FORM_LEVEL_CLASSES = ['LayoutX', 'ToolBarSetting', 'CommonDocumentSetting', 'ExecSQLCommand', 'SearchAndSumSetting',
                      'TabMaster', 'TabDetail', 'FormListOptions', 'AutoDocNumberSetting']
CTRL_TYPES = {1: 'EditX (ô nhập text)', 2: 'ComboX (danh sách chọn)', 3: 'ComboCheckX (chọn nhiều)', 4: 'DateX (ngày)',
              5: 'NumberX (số)', 6: 'CheckX (checkbox)', 7: 'ColorPickerX', 20: 'RadioX', 22: 'UserControl',
              23: 'GroupBox', 24: 'ButtonMenuX', 26: 'ButtonX', 28: 'LabelCaption', 30: 'HTMLTextOrScripts'}
PERM = {0: 'AllUser', 2: 'LockDefaultValueNotEmpty', 3: 'LockDefaultValueSQLNotEmpty', 4: 'HideDefaultValueNotEmpty',
        5: 'HideDefaultValueSQLNotEmpty', 7: 'Manager', 9: 'Admin'}
ENABLE = {0: 'NotUse', 1: 'NoneOrNormal', 2: 'EditOrNew', 3: 'AddNewOnly', 4: 'EditOnly', 7: 'Manager', 9: 'Admin'}
LYT_FIELDS = ['ControlType', 'SizeX', 'SizeY', 'isFirstPos', 'isReadOnly', 'CaptionWidth', '(không dùng)', 'CaptionText',
              'EditPermiss', 'VisiblePermiss', 'DefaultValue', 'ComboWidth2', 'ToolTipDataCheck', 'ToolTipDataHint',
              'EnableType', 'DefaultValueSQL', 'AnchorType', 'RequireValue', 'isDisableOrHidden', 'SizeP', 'SizeWebM']


def ctrl_class(sub):
    base = re.sub(r'_\d+$', '', sub or '')
    cands = [base.replace('ControlCtl', 'PropertyX'), base.replace('Ctl', 'PropertyX'), base + 'PropertyX']
    for c in cands:
        if c in by_cls:
            return c
    return ''


def lookup_form_key(k):
    base = re.sub(r'-\d+$', '', k)
    for c in FORM_LEVEL_CLASSES:
        if base in by_cls[c]:
            e = by_cls[c][base]
            return c, e['prop'], e['desc']
    return '', '', ''


def classify(r):
    """family, pattern, key, class, prop, desc"""
    K = nz(r['KeyID'])
    S = nz(r['SubID'])
    V = nz(r['SubValue'])
    m = re.match(r'^T([0-9A-J])$', K)
    if m:
        e = by_cls['TableInfoX'].get(S)
        return ('TableInfoX (slot T%s)' % m.group(1), 'T{n} + SubID', S, 'TableInfoX', e['prop'] if e else '', e['desc'] if e else '')
    m = re.match(r'^T([0-9A-J])CS$', K)
    if m:
        e = by_cls['ColumnSets'].get(S)
        return ('ColumnSets (nhóm cột lưới)', 'T{n}CS + SubID', S, 'ColumnSets', e['prop'] if e else '', e['desc'] if e else 'Nhóm tiêu đề cột (G1Caption/G1ColumnArr...)')
    m = re.match(r'^T([0-9A-J])C(\d)$', K)
    if m:
        e = by_cls['GridDynamicColorFormat'].get(S)
        return ('GridDynamicColorFormat (tô màu theo cột màu)', 'T{n}C{k} + SubID', S, 'GridDynamicColorFormat', e['prop'] if e else '', e['desc'] if e else '')
    m = re.match(r'^T([0-9A-J])F(\d)$', K)
    if m:
        e = by_cls['GridConditionFormat'].get(S)
        return ('GridConditionFormat (định dạng có điều kiện)', 'T{n}F{k} + SubID', S, 'GridConditionFormat', e['prop'] if e else '', e['desc'] if e else '')
    m = re.match(r'^T([0-9A-J])V$', K)
    if m:
        e = by_cls['TabMaster'].get(K)
        return ('TabMaster/Tab caption', 'T{n}V', K, 'TabMaster', e['prop'] if e else 'Tab%sCaption' % m.group(1), e['desc'] if e else 'Tiêu đề tab %s' % m.group(1))
    m = re.match(r'^LYT(\d+|X)$', K)
    if m:
        return ('LYT (bố cục control trên tab master)', 'LYT{tab} + SubID=control', 'LYT', 'LayoutItemX', 'GetConfig/SetConfig (21 trường ;)', 'Vị trí/kích thước/loại control; SubValue = thứ tự hiển thị')
    m = re.match(r'^LYS(\d+|X)$', K)
    if m:
        cl = ctrl_class(S)
        e = by_cls[cl].get(V) if cl else None
        if not e:
            for c2 in ['PropertyX', 'PropertyNumberX', 'PropertyDateX', 'PropertyEditX', 'PropertyRadioX', 'PropertyLabelCaptionX', 'PropertyButtonX', 'PropertyGroupBox', 'PropertyUserControlX']:
                if V in by_cls[c2]:
                    e = by_cls[c2][V]
                    cl = cl or c2
                    break
        return ('LYS (thuộc tính control)', 'LYS{tab} + SubID=control + SubValue=key', V, cl, e['prop'] if e else '', e['desc'] if e else '')
    if K.startswith('--'):
        return ('rác (dòng chú thích export lọt vào bảng)', K, K, '', '', 'Dòng "-- Export SY_FrmCfg , Rows" do script export/import ghi nhầm')
    c, p, d = lookup_form_key(K)
    return ('Form-level (%s)' % (c or '?'), 'KeyID', K, c, p, d)


agg = collections.OrderedDict()
for r in fc:
    fam, pat, key, cl, prop, desc = classify(r)
    k = (fam, cl, key)
    a = agg.setdefault(k, dict(Family=fam, Pattern=pat, Key=key, Class=cl, Property=prop, Description=desc,
                               Rows=0, Forms=set(), Example='', IndexMatch=''))
    a['Rows'] += 1
    a['Forms'].add(r['FID'])
    if not a['Example']:
        v = nz(r['KeyValue']).replace('\r', ' ').replace('\n', ' ')
        a['Example'] = v[:80]
for a in agg.values():
    ix = idx_by_key.get(a['Key'], [])
    a['IndexMatch'] = ';'.join(sorted({'%s.%s' % (x['consumer_class_hint'], x['property']) for x in ix}))[:120]
rows = sorted(agg.values(), key=lambda a: -a['Rows'])
with open(OUT + 'frmcfg-keys-medcom.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['Family', 'Pattern', 'Key', 'Rows', 'Forms', 'Class(source)', 'Property(source)', 'DescriptionVN(source)', 'WINFORMS_INDEX', 'ExampleValue(80c)'])
    for a in rows:
        w.writerow([a['Family'], a['Pattern'], a['Key'], a['Rows'], len(a['Forms']), a['Class'], a['Property'], a['Description'], a['IndexMatch'], a['Example']])

fam_cnt = collections.Counter()
fam_forms = collections.defaultdict(set)
for a in rows:
    fam_cnt[a['Family'].split(' (')[0] if a['Family'].startswith('TableInfoX') else a['Family']] += a['Rows']
for r in fc:
    fam_forms[classify(r)[0]].add(r['FID'])
unknown = [(a['Family'], a['Key'], a['Rows']) for a in rows if not a['Property'] and a['Family'] not in ('LYT (bố cục control trên tab master)',)]
print('families', fam_cnt.most_common())
print('unknown', unknown)
print('rows', len(fc), 'agg', len(rows))
idx_cov = sum(1 for a in rows if a['IndexMatch'])
print('index coverage of keys', idx_cov, '/', len(rows))

with open(SCR + 'frag/frmcfg_families.md', 'w', encoding='utf-8') as f:
    f.write('| Họ KeyID | Số dòng | Số form |\n|---|---:|---:|\n')
    fam2 = collections.Counter()
    for r in fc:
        fam2[classify(r)[0]] += 1
    for k, v in fam2.most_common():
        f.write('| %s | %d | %d |\n' % (k, v, len(fam_forms[k])))
with open(SCR + 'frag/frmcfg_topkeys.md', 'w', encoding='utf-8') as f:
    f.write('| Họ | Khóa | Số dòng | Số form | Thuộc tính (lớp nguồn) | Ý nghĩa (mô tả trong mã nguồn, rút gọn) |\n|---|---|---:|---:|---|---|\n')
    for a in rows[:45]:
        desc = a['Description'].replace('|', '/')[:110]
        f.write('| %s | `%s` | %d | %d | %s | %s |\n' % (a['Family'].split(' (')[0], a['Key'], a['Rows'], len(a['Forms']),
                                                       ('%s.%s' % (a['Class'], a['Property'])) if a['Property'] else (a['Class'] or '?'), desc))

# ------------------------------------------------------------------ decoders


def decode_lyt(v):
    p = (v or '').split(';')
    p += [''] * (21 - len(p))
    d = {}
    try:
        ct = int(p[0])
    except ValueError:
        ct = 0
    d['Loại control'] = CTRL_TYPES.get(ct, str(ct))
    d['Rộng'] = ('X%s' % p[1]) if p[1] not in ('99',) else 'XFull'
    d['Cao'] = 'Y%s' % p[2]
    flags = []
    if p[3] == '1':
        flags.append('xuống dòng mới')
    if p[4] == '1':
        flags.append('chỉ đọc')
    if p[17] == '1':
        flags.append('bắt buộc nhập')
    if p[18] == '1':
        flags.append('ẩn/disable')
    if p[5]:
        flags.append('rộng nhãn %s' % p[5])
    if p[7]:
        flags.append('nhãn="%s"' % p[7].replace(':', ';'))
    if p[8]:
        flags.append('quyền sửa=%s' % PERM.get(int(float(p[8])), p[8]))
    if p[9]:
        flags.append('quyền xem=%s' % PERM.get(int(float(p[9])), p[9]))
    if p[10]:
        flags.append('mặc định=%s' % p[10])
    if p[14]:
        flags.append('EnableType=%s' % ENABLE.get(int(float(p[14])), p[14]))
    if p[15]:
        flags.append('mặc định SQL')
    d['Cờ'] = ', '.join(flags)
    return d


def colinfo(table, col):
    for c in cols_by_obj.get(table.upper(), []):
        if c['column_name'].upper() == col.upper():
            t = c['data_type']
            if t in ('nvarchar', 'varchar', 'nchar', 'char'):
                ln = c['max_length']
                if t.startswith('n') and ln and ln > 0:
                    ln = ln // 2
                t += '(%s)' % ('max' if ln == -1 else ln)
            elif t in ('decimal', 'numeric'):
                t += '(%s,%s)' % (c['precision'], c['scale'])
            return t + ('' if c['is_nullable'] else ' NOT NULL')
    return '(không có trong bảng)'


def describe_form(fid, out):
    rows = [r for r in fc if r['FID'] == fid]
    f = forms.get(fid.upper(), {})
    menus = [m for m in menu_rows if m['FormName'].upper() == fid.upper()]
    out.append('**Form `%s`** — FormType `%s`, tiêu đề "%s"; menu: %s; %d dòng `SY_FrmCfg`.\n' % (
        fid, nz(f.get('FormType')), nz(f.get('CaptionVN')),
        ', '.join('`%s` %s (%s)' % (m['MenuID'], m['Path'], m['Status']) for m in menus) or '—', len(rows)))
    # form-level
    fl = [r for r in rows if classify(r)[0].startswith('Form-level')]
    if fl:
        out.append('\nThiết lập cấp form:\n')
        out.append('| KeyID | Giá trị | Thuộc tính | Ý nghĩa |\n|---|---|---|---|')
        for r in sorted(fl, key=lambda x: x['KeyID']):
            c, p, d = lookup_form_key(r['KeyID'])
            out.append('| `%s` | `%s` | %s.%s | %s |' % (r['KeyID'], nz(r['KeyValue'])[:60], c, p, d.replace('|', '/')[:120]))
    # tables
    slots = sorted({r['KeyID'] for r in rows if re.match(r'^T[0-9A-J]$', r['KeyID'])})
    for s in slots:
        tr = {r['SubID']: nz(r['KeyValue']) for r in rows if r['KeyID'] == s}
        role = 'Master' if s == 'T0' else 'Detail %s' % s[1]
        tn = tr.get('TN') or tr.get('TV') or nz(f.get('TableName'))
        out.append('\nBảng slot `%s` (%s): `TN`=`%s`%s, khóa `PK`=`%s`.\n' % (
            s, role, tr.get('TN', ''), (', `TV`=`%s`' % tr['TV']) if tr.get('TV') else '', tr.get('PK', '')))
        out.append('| SubID | Giá trị | Thuộc tính TableInfoX | Ý nghĩa |\n|---|---|---|---|')
        for sub, val in sorted(tr.items()):
            e = by_cls['TableInfoX'].get(sub)
            out.append('| `%s` | `%s` | %s | %s |' % (sub, val[:90] + ('…' if len(val) > 90 else ''), e['prop'] if e else '?',
                                                   (e['desc'] if e else '').replace('|', '/')[:90]))
        order = [x for x in tr.get('GD2', '').split(';') if x]
        hide = set(x.upper() for x in tr.get('HDE', '').split(';') if x)
        lock = set(x.upper() for x in tr.get('LCK', '').split(';') if x)
        sums = set(x.upper() for x in tr.get('SUM', '').split(';') if x)
        allcols = [c['column_name'] for c in sorted(cols_by_obj.get(tn.upper(), []), key=lambda c: c['column_id'])]
        joined = {}
        for n in range(1, 5):
            if tr.get('TN%d' % n):
                for x in tr.get('SE%d' % n, '').split(','):
                    x = x.strip()
                    if x:
                        joined[x.split('.')[-1].split(' as ')[-1].strip()] = '%s (join %s: %s=%s)' % (x, tr['TN%d' % n], tr.get('FKA%d' % n, ''), tr.get('FKB%d' % n, ''))
        if order or allcols:
            seq = order or allcols
            out.append('\nCột lưới `%s` theo thứ tự `GD2` (%d cột hiển thị cố định; bảng có %d cột):\n' % (s, len(order), len(allcols)))
            out.append('| # | Cột | Kiểu (columns.json) | Ghi chú |\n|---:|---|---|---|')
            for i, cn in enumerate(seq, 1):
                note = []
                if cn.upper() in hide:
                    note.append('ẩn (HDE)')
                if cn.upper() in lock:
                    note.append('khóa sửa (LCK)')
                if cn.upper() in sums:
                    note.append('dòng tổng (SUM)')
                t = colinfo(tn, cn)
                if t.startswith('(không') and cn in joined:
                    t = 'từ bảng join'
                    note.append(joined[cn])
                out.append('| %d | `%s` | %s | %s |' % (i, cn, t, ', '.join(note)))
            rest = [c for c in allcols if c not in seq and c.upper() not in hide]
            if rest and order:
                out.append('\nCột còn lại của bảng không nằm trong `GD2` và không ẩn (vẫn có thể hiện sau các cột cố định): `%s`.' % '`, `'.join(rest[:40]) + (' …' if len(rest) > 40 else ''))
    # LYT editors
    tabs = sorted({r['KeyID'] for r in rows if r['KeyID'].startswith('LYT')})
    for t in tabs:
        items = sorted([r for r in rows if r['KeyID'] == t], key=lambda x: nz(x['SubValue']))
        out.append('\nBố cục ô nhập `%s` (tab master %s, sắp theo `SubValue`):\n' % (t, t[3:]))
        out.append('| STT | Control/Field | Loại control | Rộng×Cao | Kiểu dữ liệu (bảng master) | Cờ |\n|---:|---|---|---|---|---|')
        tn = [r for r in rows if r['KeyID'] == 'T0' and r['SubID'] == 'TN']
        tn = tn[0]['KeyValue'] if tn else nz(f.get('TableName'))
        for r in items:
            d = decode_lyt(r['KeyValue'])
            out.append('| %s | `%s` | %s | %s×%s | %s | %s |' % (nz(r['SubValue']), r['SubID'], d['Loại control'], d['Rộng'], d['Cao'],
                                                            colinfo(tn, r['SubID']) if not r['SubID'].endswith(('Ctl',)) and 'Ctl_' not in r['SubID'] else 'user control', d['Cờ']))
    # LYS properties
    lys = [r for r in rows if r['KeyID'].startswith('LYS')]
    if lys:
        out.append('\nThuộc tính control (`LYS*`):\n')
        out.append('| KeyID | Control | Khóa | Thuộc tính | Giá trị (rút gọn) |\n|---|---|---|---|---|')
        for r in sorted(lys, key=lambda x: (x['KeyID'], x['SubID'], nz(x['SubValue']))):
            fam, pat, key, cl, prop, desc = classify(r)
            out.append('| %s | `%s` | `%s` | %s.%s | `%s` |' % (r['KeyID'], r['SubID'], nz(r['SubValue']), cl, prop,
                                                          nz(r['KeyValue']).replace('|', '/').replace('\n', ' ')[:70]))
    other = [r for r in rows if re.match(r'^T[0-9A-J](CS|C\d|F\d|V)$', r['KeyID'])]
    if other:
        out.append('\nThiết lập lưới khác:\n')
        out.append('| KeyID | SubID | Giá trị | Ý nghĩa |\n|---|---|---|---|')
        for r in other:
            fam, pat, key, cl, prop, desc = classify(r)
            out.append('| `%s` | `%s` | `%s` | %s.%s |' % (r['KeyID'], r['SubID'], nz(r['KeyValue'])[:60], cl, prop))
    # buttons etc.
    for name, data in (('SY_FrmOptBtnTbl (option_buttons)', obtn), ('SY_FrmGrdActTbl (grid_actions)', gact),
                       ('SY_FrmMstActTbl (form_actions)', fact), ('SY_FrmFltTbl (form_filters)', fflt)):
        rr = [x for x in data if x['FormID'].upper() == fid.upper()]
        if rr:
            out.append('\nNút/hành động từ `%s`:\n' % name)
            out.append('| KeyID | Caption | Action | Source (rút gọn) | Para | Before/After | Tắt? |\n|---|---|---|---|---|---|---|')
            for x in rr:
                out.append('| %s | %s | %s | `%s` | %s | %s/%s | %s |' % (nz(x.get('KeyID') or x.get('ColumnID')), nz(x.get('Caption')),
                                                                     nz(x.get('Action')), nz(x.get('Source')).replace('|', '/')[:70],
                                                                     nz(x.get('Para')), nz(x.get('BeforeAction')), nz(x.get('AfterAction')),
                                                                     'tắt' if x.get('IsDisable') else ''))
    out.append('')


for fid in ['AP_BPTMShipmentsFrm', 'FA_Move2026Frm']:
    out = []
    describe_form(fid, out)
    with open(SCR + 'frag/example_%s.md' % fid, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out) + '\n')
    print('\n'.join(out)[:6000])
