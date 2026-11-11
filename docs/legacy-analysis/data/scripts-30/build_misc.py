import sys; sys.stdout.reconfigure(encoding="utf-8")
import json, csv, re, os, glob, collections
import xml.etree.ElementTree as ET

W = 'D:/Data/Medcom/TechnicalDocs/db-audit/workflow-config-20261019/'
R = 'D:/Data/Medcom/TechnicalDocs/db-audit/run-20261019/'
T = 'D:/Data/TinPhong/Tools/BeeCMigration/audit-20261019-01/results/'
TL = 'D:/Data/TinPhong/Layout/'
OUT = 'D:/Data/Web-ERP/docs/legacy-analysis/data/'
SCR = os.path.dirname(os.path.abspath(__file__)) + '/'
FR = SCR + 'frag/'


def load(p):
    with open(p, encoding='utf-8-sig') as f:
        return json.load(f)


def nz(v):
    return '' if v is None else str(v)


def short(v, n=100):
    v = nz(v).replace('\r', ' ').replace('\n', ' ').replace('\t', ' ')
    v = re.sub(r'\s+', ' ', v)
    return v[:n] + ('…' if len(v) > n else '')


menus = load(W + 'menus.json')
menu_rows = list(csv.DictReader(open(OUT + 'menu-medcom.csv', encoding='utf-8-sig')))
form_rows = list(csv.DictReader(open(OUT + 'forms-medcom.csv', encoding='utf-8-sig')))
forms_u = {r['FormID'].upper(): r for r in form_rows}
menu_by_form = collections.defaultdict(list)
for m in menu_rows:
    if m['FormName']:
        menu_by_form[m['FormName'].upper()].append(m)
obtn = load(W + 'option_buttons.json')
gact = load(W + 'grid_actions.json')
fact = load(W + 'form_actions.json')
fflt = load(W + 'form_filters.json')
ug = load(W + 'user_groups.json')
gp = load(W + 'group_permissions.json')
dt = load(W + 'document_types.json')
objects = load(R + 'objects.json')
columns = load(R + 'columns.json')
rowcounts = load(R + 'row_counts.json')
indexes = load(R + 'indexes.json')
fks = load(R + 'foreign_keys.json')
triggers = load(R + 'triggers.json')
form_classes = load(SCR + 'form_classes.json')

# ------------------------------------------------------------------ F. actions
act_rows = []


def menu_state(fid):
    ms = menu_by_form.get(fid.upper(), [])
    if not ms:
        # variants like CS_ReceiptFrm_Bank: base form + para
        base = fid.rsplit('_', 1)[0].upper() if '_' in fid else ''
        ms = [m for m in menu_by_form.get(base, []) if (m['FormName'] + '_' + m['Para']).upper() == fid.upper()]
    if not ms:
        return 'không có menu'
    return 'menu bật' if any(m['EffectiveEnabled'] == '1' for m in ms) else 'menu tắt'


for x in obtn:
    act_rows.append(dict(Table='SY_FrmOptBtnTbl', FormID=x['FormID'], Key=nz(x['KeyID']), Grid=nz(x['GridName']),
                         Trigger='nút trên OptionBar/menu Tùy chọn', Caption=nz(x['Caption']), Action=nz(x['Action']),
                         Source=short(x['Source']), Para=nz(x['Para']), Target=short(nz(x['ReturnMasterField']) + (' | ' + nz(x['ReturnDetailField']) if x['ReturnDetailField'] else ''), 120),
                         BeforeAfter='%s/%s' % (nz(x['BeforeAction']), nz(x['AfterAction'])), EnableStatus=nz(x['EnableStatus']),
                         IsDisable=int(bool(x['IsDisable'])), FormMenu=menu_state(x['FormID'])))
for x in gact:
    act_rows.append(dict(Table='SY_FrmGrdActTbl', FormID=x['FormID'], Key=nz(x['ColumnID']), Grid=nz(x['GridName']),
                         Trigger='khi đổi giá trị cột %s trên lưới' % nz(x['ColumnID']), Caption='', Action='%s/%s' % (nz(x['ActType']), nz(x['Action'])),
                         Source=short(x['Source']), Para=nz(x['Para']), Target=nz(x['TargetColumn']) or nz(x['TargetValue']),
                         BeforeAfter='', EnableStatus='', IsDisable=int(bool(x['IsDisable'])), FormMenu=menu_state(x['FormID'])))
for x in fact:
    act_rows.append(dict(Table='SY_FrmMstActTbl', FormID=x['FormID'], Key=nz(x['ColumnID']), Grid='(master)',
                         Trigger=('sự kiện %s' % x['MaterAction']) if x['MaterAction'] else 'khi đổi giá trị field %s trên master' % nz(x['ColumnID']),
                         Caption='', Action='%s/%s' % (nz(x['ActType']), nz(x['Action'])), Source=short(x['Source']), Para=nz(x['Para']),
                         Target=nz(x['TargetColumn']), BeforeAfter='', EnableStatus='', IsDisable=int(bool(x['IsDisable'])), FormMenu=menu_state(x['FormID'])))
for x in fflt:
    act_rows.append(dict(Table='SY_FrmFltTbl', FormID=x['FormID'], Key=nz(x['KeyID']), Grid='(toolbar lọc)',
                         Trigger='ô lọc trên toolbar', Caption=nz(x['Caption']) or nz(x['ColumnID']), Action='Type=%s' % nz(x['Type']),
                         Source=short(x['Source']), Para=nz(x['ColumnID']), Target='%s/%s' % (nz(x['ValueColumn']), nz(x['DisplayColumn'])),
                         BeforeAfter='', EnableStatus='mặc định=%s%s' % (nz(x['DefaultValue']), (' / SQL' if x['DefaultValueSQL'] else '')),
                         IsDisable=int(bool(x['IsDisable'])), FormMenu=menu_state(x['FormID'])))
with open(OUT + 'form-actions-medcom.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(act_rows[0].keys()))
    w.writeheader()
    w.writerows(act_rows)
print('actions', len(act_rows), collections.Counter((r['Table'], r['FormMenu']) for r in act_rows))
print('optbtn action x before', collections.Counter((x['Action'], nz(x['BeforeAction']), nz(x['AfterAction'])) for x in obtn).most_common(12))
print('optbtn forms', len({x['FormID'] for x in obtn}), 'enabled', sum(1 for x in obtn if not x['IsDisable']))
print('optbtn showuser src', collections.Counter(x['Source'] for x in obtn if x['Action'] == 'ShowUserForm'))
print('optbtn showselect src', collections.Counter(x['Source'] for x in obtn if x['Action'] == 'ShowSelectForm'))
print('grid act', collections.Counter(x['Action'] for x in gact), 'forms', len({x['FormID'] for x in gact}))
print('form act', collections.Counter((x['Action'], nz(x['MaterAction'])) for x in fact))
print('filter types', collections.Counter(nz(x['Type']) for x in fflt))

# ------------------------------------------------------------------ G. permissions
gname = {g['UserGroupID']: g for g in ug}
menu_ids = {m['MenuID'] for m in menus}
en_form_menus = {m['MenuID'] for m in menu_rows if m['EffectiveEnabled'] == '1' and m['FormName']}
perm = collections.defaultdict(collections.Counter)
for r in gp:
    c = perm[r['UserGroupID']]
    c['rows'] += 1
    for k in ('IsRun', 'IsAdd', 'IsUpdate', 'IsDelete', 'isManager', 'isAdmin', 'isAutoLock', 'isLockDoc', 'isUnLockDoc'):
        if r[k]:
            c[k] += 1
    if r['IsRun'] and r['MenuID'] in en_form_menus:
        c['run_en_forms'] += 1
    if r['MenuID'] not in menu_ids:
        c['menu_missing'] += 1
pr = []
for g in ug:
    c = perm[g['UserGroupID']]
    pr.append(dict(UserGroupID=g['UserGroupID'], UserGroupName=g['UserGroupName'], BranchID=nz(g['BranchID']), IsDisable=int(bool(g['IsDisable'])),
                   PermissionRows=c['rows'], IsRun=c['IsRun'], IsAdd=c['IsAdd'], IsUpdate=c['IsUpdate'], IsDelete=c['IsDelete'],
                   isManager=c['isManager'], isAdmin=c['isAdmin'], isAutoLock=c['isAutoLock'], isLockDoc=c['isLockDoc'],
                   isUnLockDoc=c['isUnLockDoc'], RunOnEnabledFormMenus=c['run_en_forms'], RowsWithUnknownMenu=c['menu_missing']))
with open(OUT + 'group-permissions-summary-medcom.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(pr[0].keys()))
    w.writeheader()
    w.writerows(pr)
print('perm groups', len(pr), 'enabled-form-menus', len(en_form_menus))
null_counts = {k: sum(1 for r in gp if r[k] is None) for k in gp[0]}
print('nulls', null_counts)
pair = collections.Counter((r['UserGroupID'], r['MenuID']) for r in gp)
print('dup pairs', sum(1 for v in pair.values() if v > 1))
combo = collections.Counter(tuple(int(bool(r[k])) for k in ('IsRun', 'IsAdd', 'IsUpdate', 'IsDelete', 'isManager', 'isAdmin')) for r in gp)
print('combos', combo.most_common(8))
menus_no_perm = [m['MenuID'] for m in menu_rows if m['MenuID'] not in {r['MenuID'] for r in gp}]
print('menus without any perm row', len(menus_no_perm))
with open(FR + 'perm_groups.md', 'w', encoding='utf-8') as f:
    f.write('| UserGroupID | Tên nhóm | Chi nhánh | Số dòng quyền | IsRun | IsAdd | IsUpdate | IsDelete | isManager | isAdmin | isLockDoc | isUnLockDoc | IsRun trên menu-form đang bật |\n')
    f.write('|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n')
    for r in pr:
        f.write('| %(UserGroupID)s | %(UserGroupName)s | %(BranchID)s | %(PermissionRows)d | %(IsRun)d | %(IsAdd)d | %(IsUpdate)d | %(IsDelete)d | %(isManager)d | %(isAdmin)d | %(isLockDoc)d | %(isUnLockDoc)d | %(RunOnEnabledFormMenus)d |\n' % r)

# ------------------------------------------------------------------ H. doc types & statuses
with open(FR + 'doctypes.md', 'w', encoding='utf-8') as f:
    f.write('| DocType | Tên chứng từ | Tiền tố số CT | Bảng master | Bảng chi tiết | FormID | Nhóm | Hạch toán (isAcc) | Form được menu trỏ tới? |\n')
    f.write('|---|---|---|---|---|---|---|:---:|---|\n')
    for r in dt:
        fid = nz(r['FormID'])
        ms = menu_by_form.get(fid.upper(), [])
        if not ms and '_' in fid:
            base, para = fid.rsplit('_', 1)
            ms = [m for m in menu_by_form.get(base.upper(), []) if m['Para'].upper() == para.upper()]
        st = ('bật (' + ','.join(m['MenuID'] for m in ms) + ')') if any(m['EffectiveEnabled'] == '1' for m in ms) else ('tắt' if ms else '—')
        f.write('| %s | %s | %s | %s | %s | %s | %s | %s | %s |\n' % (r['DocType'], r['DocName'], nz(r['PreFix']), nz(r['TableName']), nz(r['TableDetail']),
                                                                fid, nz(r['DocGroupName']), nz(r['isAcc']), st))
status_files = sorted(glob.glob(W + '*_status.json')) + [W + 'inbound_order_types.json']
STATUS_TABLE = {}
mods = load(R + 'modules.json')
with open(FR + 'statuses.md', 'w', encoding='utf-8') as f:
    for p in status_files:
        d = load(p)
        name = os.path.basename(p)[:-5]
        f.write('\n#### `%s` (%d dòng)\n\n' % (name, len(d)))
        if not d:
            continue
        cols = list(d[0].keys())
        f.write('| ' + ' | '.join(cols) + ' |\n|' + '---|' * len(cols) + '\n')
        for r in d:
            f.write('| ' + ' | '.join(nz(r[c]) for c in cols) + ' |\n')
print('status files', [os.path.basename(p) for p in status_files])

# ------------------------------------------------------------------ I. schema
TYPES = {'USER_TABLE': 'Bảng', 'VIEW': 'View', 'SQL_STORED_PROCEDURE': 'SP', 'SQL_TABLE_VALUED_FUNCTION': 'Function',
         'SQL_SCALAR_FUNCTION': 'Function', 'SQL_INLINE_TABLE_VALUED_FUNCTION': 'Function', 'SQL_TRIGGER': 'Trigger'}
PREFIX_MEANING = {
    'AP': 'Mua hàng / công nợ phải trả (Accounts Payable)', 'AR': 'Bán hàng / công nợ phải thu (Accounts Receivable)',
    'IV': 'Kho (Inventory)', 'CS': 'Thu chi tiền mặt / ngân hàng (Cash)', 'GJ': 'Kế toán tổng hợp (General Journal)',
    'GL': 'Báo cáo tài chính (General Ledger)', 'FA': 'Tài sản cố định (Fixed Asset)', 'EQ': 'Công cụ dụng cụ (Equipment)',
    'CF': 'Danh mục dùng chung (Config / master data)', 'SY': 'Hệ thống (menu, form, quyền, tham số, số dư...)',
    'HR': 'Nhân sự - tiền lương', 'ER': 'Sản xuất / định mức (ERP production) — không có bảng ở MedData',
    'PC': 'Giá thành (Product Cost)', 'OF': 'Văn phòng điện tử (eOffice: đơn từ, tạm ứng, tờ trình)',
    'AG': 'Xuất kho đại lý / mã QR (Agency)', 'API': 'SP phục vụ API (web/mobile)', 'WA': 'Ứng dụng web (Web App: báo cáo, dashboard, đơn theo hợp đồng)',
    'WB': 'Hàm cho web (WB_*Fnc)', 'KD': 'Phân hệ "Kinh doanh" có menu/quyền riêng (KD_Menu, KD_UserGroupPermisstion)',
    'SL': 'Lương doanh số (Sales salary)', 'PL': 'Kế hoạch (Plan)', 'CC': 'Giá thành kiểu cũ (CostPrice)', 'CL': 'Báo cáo "CL" (bảng cân đối, công nợ, tồn kho)',
    'EI': 'Hóa đơn điện tử (eInvoice)', 'EP': 'Vận chuyển (ePost)', 'EL': 'Danh sách hóa đơn (eInvoice list)', 'IS': 'Nhập/xuất phụ (IS)',
    'AD': 'Duyệt (Approve setup)', 'TR': 'Trigger đặt tên theo quy ước TR_<bảng>_<mục đích>', 'dt': 'SP hệ thống cũ của SQL Server (database diagram/source control)',
    'ZZ': 'Bảng backup kỹ thuật', 'Temp': 'Bảng tạm', 'Temp2': 'Bảng tạm', 'Temp3': 'Bảng tạm', 'SP': 'SP tiện ích', 'vIS': 'View IS',
    'MedcomErpCommand': '', '(none)': 'Không có tiền tố (chủ yếu view v*)',
}


def prefix(name):
    if '_' in name:
        return name.split('_')[0]
    return '(none)'


pk = collections.defaultdict(list)
for i in indexes:
    if i['is_primary_key'] and i['column_name'] and not i['is_included_column']:
        pk[i['table_name']].append((i['key_ordinal'], i['column_name']))
cols_by = collections.defaultdict(list)
for c in columns:
    cols_by[c['object_name']].append(c)
rows_by = {r['table_name']: r['approximate_rows'] for r in rowcounts}
fk_out = collections.Counter(f['parent_table'] for f in fks if f['constraint_column_id'] == 1)
fk_in = collections.Counter(f['referenced_table'] for f in fks if f['constraint_column_id'] == 1)
trg = collections.Counter(t['parent_name'] for t in triggers)
STD = ['DocumentID', 'DocumentDate', 'StatusID', 'isLock', 'BranchID', 'UserCreate', 'DateCreate', 'UserUpdate', 'DateUpdate', 'UserAutoID', 'ObjectID', 'ItemID', 'Notes', 'Memo']
doc_tables = set()
for r in dt:
    doc_tables.add(nz(r['TableName']))
    doc_tables.add(nz(r['TableDetail']))
form_tables = collections.Counter(r['TableName'] for r in form_rows if r['TableName'])
tables = [o for o in objects if o['type_desc'] == 'USER_TABLE']
trows = []
for o in sorted(tables, key=lambda x: x['name'].upper()):
    n = o['name']
    cs = sorted(cols_by.get(n, []), key=lambda c: c['column_id'])
    cn = {c['column_name'].upper() for c in cs}
    pkc = [c for _, c in sorted(pk.get(n, []))]
    has = {s: (s.upper() in cn) for s in STD}
    if n.upper().startswith('CF_'):
        kind = 'danh mục (CF)'
    elif n.upper().startswith('SY_'):
        kind = 'hệ thống (SY)'
    elif has['DocumentID'] and has['DocumentDate'] and pkc == ['DocumentID']:
        kind = 'chứng từ - master'
    elif has['DocumentID'] and 'DETAIL' in n.upper():
        kind = 'chứng từ - chi tiết'
    elif re.search(r'(Temp|Backup|^ZZ_|^AAA$)', n, re.I):
        kind = 'tạm / backup'
    else:
        kind = 'khác (danh mục phân hệ / cấu hình / log)'
    trows.append(dict(TableName=n, Prefix=prefix(n), PrefixMeaning=PREFIX_MEANING.get(prefix(n), ''), Kind=kind,
                      Columns=len(cs), PrimaryKey=';'.join(pkc), IdentityColumn=';'.join(c['column_name'] for c in cs if c['is_identity']),
                      ApproxRows=rows_by.get(n, ''), FKOut=fk_out[n], FKIn=fk_in[n], Triggers=trg[n],
                      InSY_DocSetup=int(n in doc_tables), UsedBySY_FrmLstTbl=form_tables.get(n, 0),
                      **{('has_' + s): int(has[s]) for s in STD}))
with open(OUT + 'db-tables-medcom.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(trows[0].keys()))
    w.writeheader()
    w.writerows(trows)
print('tables', len(trows), collections.Counter(r['Kind'] for r in trows))
print('no PK', sum(1 for r in trows if not r['PrimaryKey']), 'empty', sum(1 for r in trows if r['ApproxRows'] == 0))
pkpat = collections.Counter(r['PrimaryKey'] for r in trows)
print('pk patterns', pkpat.most_common(15))
# std column coverage
std_cov = {s: sum(1 for r in trows if r['has_' + s]) for s in STD}
print('std cov', std_cov)
# std col in doc masters
masters = [r for r in trows if r['Kind'] == 'chứng từ - master']
details = [r for r in trows if r['Kind'] == 'chứng từ - chi tiết']
print('masters', len(masters), {s: sum(1 for r in masters if r['has_' + s]) for s in STD})
print('details', len(details), {s: sum(1 for r in details if r['has_' + s]) for s in STD})
colfreq = collections.Counter()
for o in tables:
    for c in cols_by.get(o['name'], []):
        colfreq[c['column_name']] += 1
print('top cols', colfreq.most_common(45))
# data types of std cols
dtype = collections.defaultdict(collections.Counter)
for o in tables:
    for c in cols_by.get(o['name'], []):
        if c['column_name'] in STD:
            t = c['data_type'] + ('(%s)' % c['max_length'] if c['data_type'] in ('varchar', 'nvarchar', 'char', 'nchar') else '')
            dtype[c['column_name']][t] += 1
for s in STD:
    print('dtype', s, dtype[s].most_common(4))
# defaults of std cols
dflt = collections.defaultdict(collections.Counter)
for o in tables:
    for c in cols_by.get(o['name'], []):
        if c['column_name'] in ('UserAutoID', 'DateCreate', 'DateUpdate', 'isLock', 'UserCreate'):
            dflt[c['column_name']][nz(c['default_definition'])] += 1
for k, v in dflt.items():
    print('default', k, v.most_common(4))

# objects by prefix/type
ob_stats = collections.defaultdict(collections.Counter)
for o in objects:
    t = TYPES.get(o['type_desc'])
    if t:
        ob_stats[prefix(o['name'])][t] += 1
with open(FR + 'objects_by_prefix.md', 'w', encoding='utf-8') as f:
    f.write('| Tiền tố | Ý nghĩa | Bảng | View | SP | Function | Trigger | Tổng |\n|---|---|---:|---:|---:|---:|---:|---:|\n')
    tot = collections.Counter()
    for p, c in sorted(ob_stats.items(), key=lambda x: -sum(x[1].values())):
        s = sum(c.values())
        tot.update(c)
        f.write('| %s | %s | %d | %d | %d | %d | %d | %d |\n' % (p, PREFIX_MEANING.get(p, ''), c['Bảng'], c['View'], c['SP'], c['Function'], c['Trigger'], s))
    f.write('| **Tổng** | | **%d** | **%d** | **%d** | **%d** | **%d** | **%d** |\n' % (tot['Bảng'], tot['View'], tot['SP'], tot['Function'], tot['Trigger'], sum(tot.values())))
# naming suffix stats
suf = collections.Counter()
for o in objects:
    t = TYPES.get(o['type_desc'])
    if not t:
        continue
    n = o['name']
    m = re.search(r'(Tbl|View|ReportStp|Stp|Fnc)$', n)
    s = m.group(1) if m else ('v* (tiền tố v)' if re.match(r'^v[A-Z]', n) else ('TR_*' if n.startswith('TR_') else '(khác)'))
    suf[(t, s)] += 1
print('suffix', sorted(suf.items()))
json.dump({'%s|%s' % k: v for k, v in suf.items()}, open(SCR + 'suffix.json', 'w', encoding='utf-8'), ensure_ascii=False)

# CF tables fragment
with open(FR + 'cf_tables.md', 'w', encoding='utf-8') as f:
    f.write('| Bảng | Khóa chính | Số cột | Số dòng (xấp xỉ) | FK vào | Dùng bởi SY_FrmLstTbl |\n|---|---|---:|---:|---:|---:|\n')
    for r in sorted([r for r in trows if r['Prefix'] == 'CF'], key=lambda r: -(r['ApproxRows'] or 0)):
        f.write('| `%s` | %s | %d | %s | %d | %d |\n' % (r['TableName'], r['PrimaryKey'] or '—', r['Columns'], r['ApproxRows'], r['FKIn'], r['UsedBySY_FrmLstTbl']))
# document tables fragment: pairs from SY_DocSetup + detected masters
tr_by = {r['TableName'].upper(): r for r in trows}
with open(FR + 'doc_tables.md', 'w', encoding='utf-8') as f:
    f.write('| Bảng master | PK | Số dòng | Bảng chi tiết | PK chi tiết | Số dòng chi tiết | Nguồn nhận diện |\n|---|---|---:|---|---|---:|---|\n')
    seen = set()
    pairs = []
    for r in dt:
        mt, de = nz(r['TableName']), nz(r['TableDetail'])
        if mt in seen or not mt:
            continue
        seen.add(mt)
        pairs.append((mt, de, 'SY_DocSetup ' + r['DocType']))
    for r in masters:
        if r['TableName'] in seen:
            continue
        cand = r['TableName'][:-3] + 'DetailTbl' if r['TableName'].endswith('Tbl') else ''
        de = cand if cand.upper() in tr_by else ''
        seen.add(r['TableName'])
        pairs.append((r['TableName'], de, 'cấu trúc cột (PK DocumentID + DocumentDate)'))
    pairs.sort(key=lambda p: -(tr_by.get(p[0].upper(), {}).get('ApproxRows') or 0))
    for mt, de, src in pairs:
        a = tr_by.get(mt.upper(), {})
        b = tr_by.get(de.upper(), {}) if de else {}
        f.write('| `%s` | %s | %s | %s | %s | %s | %s |\n' % (mt, a.get('PrimaryKey', '(view/không có)'), a.get('ApproxRows', ''),
                                                       ('`%s`' % de) if de else '—', b.get('PrimaryKey', ''), b.get('ApproxRows', ''), src))
print('doc pairs', len(pairs))

# SY tables columns md
sy = [r for r in trows if r['Prefix'] == 'SY']
lines = ['# Cột của mọi bảng `SY_*` — MedData (Medcom)\n',
         'Nguồn: `run-20261019/columns.json`, `indexes.json`, `row_counts.json` (catalog 2026-10-19, chỉ metadata). '
         'Sinh tự động; số dòng là xấp xỉ (`sys.partitions`). PK đánh dấu 🔑 không dùng — cột PK ghi ở dòng tiêu đề.\n',
         '%d bảng `SY_*`. Kiểu chuỗi ghi theo số ký tự (nvarchar đã chia 2).\n' % len(sy)]
for r in sy:
    lines.append('\n## `%s`\n' % r['TableName'])
    lines.append('PK: `%s` · %d cột · ~%s dòng · FK ra/vào: %d/%d · trigger: %d\n' % (r['PrimaryKey'] or '—', r['Columns'], r['ApproxRows'], r['FKOut'], r['FKIn'], r['Triggers']))
    lines.append('| # | Cột | Kiểu | Null | Identity | Mặc định |\n|---:|---|---|:---:|:---:|---|')
    for c in sorted(cols_by[r['TableName']], key=lambda c: c['column_id']):
        t = c['data_type']
        if t in ('nvarchar', 'varchar', 'nchar', 'char', 'varbinary', 'binary'):
            ln = c['max_length']
            if t in ('nvarchar', 'nchar') and ln > 0:
                ln //= 2
            t += '(%s)' % ('max' if ln == -1 else ln)
        elif t in ('decimal', 'numeric'):
            t += '(%s,%s)' % (c['precision'], c['scale'])
        dfl = nz(c['default_definition']).replace('|', '/')
        lines.append('| %d | `%s` | %s | %s | %s | %s |' % (c['column_id'], c['column_name'], t, 'x' if c['is_nullable'] else '', 'x' if c['is_identity'] else '',
                                                        ('`%s`' % dfl) if dfl else ''))
with open(OUT + 'sy-tables-columns.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

# ------------------------------------------------------------------ J. TinPhong comparison
tp = {}
for n in ['SY_FrmLstTbl', 'SY_FrmCfg', 'SY_FrmOptBtnTbl', 'SY_FrmFltTbl', 'SY_FmtFldTbl']:
    tp[n] = load(T + 'ui-%s.json' % n)['rows']
tp_menu = load(T + 'source-menu.json')['rows']
tp_menu_conf = load(T + 'target-menu-conflicts.json')['rows']
tp_keys = load(T + 'source-config-keys.json')['rows']
tp_tmpl = load(T + 'source-config-form-templates.json')['rows']
print('TP forms', [(r['FormID'], r['FormType'], r['TableName']) for r in tp['SY_FrmLstTbl']])
print('TP cfg FIDs', collections.Counter(r['FID'] for r in tp['SY_FrmCfg']))
print('TP menu', [(r['MenuID'], r['VN'], r['FormName'], r['Parent'], r['isDisable']) for r in tp_menu])
print('TP menu conflicts', [(r['MenuID'], r['VN'], r['FormName']) for r in tp_menu_conf])
print('TP templates', [(r['FormID'], r['FormType'], r['TableName']) for r in tp_tmpl])
print('TP config keys', [(r['KeyID'], r['SubID']) for r in tp_keys])
# key vocabulary comparison
fc = load(W + 'form_config.json')


def fam(k):
    k = nz(k)
    for pat, name in ((r'^T[0-9A-J]$', 'T{n}'), (r'^T[0-9A-J]CS$', 'T{n}CS'), (r'^T[0-9A-J]C\d$', 'T{n}C{k}'), (r'^T[0-9A-J]F\d$', 'T{n}F{k}'),
                      (r'^T[0-9A-J]V$', 'T{n}V'), (r'^LYT\d+$', 'LYT{n}'), (r'^LYS\d+$', 'LYS{n}')):
        if re.match(pat, k):
            return name
    return k


mk = collections.Counter(fam(r['KeyID']) for r in fc)
tk = collections.Counter(fam(r['KeyID']) for r in tp['SY_FrmCfg'])
print('TP key fams', tk)
print('TP fams not in Medcom', [k for k in tk if k not in mk])
msub = {(fam(r['KeyID']), r['SubID'] if fam(r['KeyID']) == 'T{n}' else r['SubValue'] if fam(r['KeyID']) == 'LYS{n}' else '') for r in fc}
tsub = {(fam(r['KeyID']), r['SubID'] if fam(r['KeyID']) == 'T{n}' else r['SubValue'] if fam(r['KeyID']) == 'LYS{n}' else '') for r in tp['SY_FrmCfg']}
print('TP subkeys not in Medcom', sorted(tsub - msub))
# schema columns of SY tables compare
med_cols = {t: [c['column_name'] for c in sorted(cols_by[t], key=lambda c: c['column_id'])] for t in ['SY_Menu', 'SY_FrmLstTbl', 'SY_FrmCfg', 'SY_FrmOptBtnTbl', 'SY_FrmFltTbl', 'SY_FmtFldTbl']}
tp_cols = {'SY_Menu': list(tp_menu[0].keys()) if tp_menu else []}
for n in ['SY_FrmLstTbl', 'SY_FrmCfg', 'SY_FrmOptBtnTbl', 'SY_FrmFltTbl', 'SY_FmtFldTbl']:
    tp_cols[n] = list(tp[n][0].keys()) if tp[n] else []
schema_cmp = {}
for t in med_cols:
    a, b = set(x.upper() for x in med_cols[t]), set(x.upper() for x in tp_cols.get(t, []))
    schema_cmp[t] = dict(medcom=len(a), tinphong=len(b), only_medcom=sorted(a - b), only_tinphong=sorted(b - a))
    print('schema', t, schema_cmp[t])
# Layout .dat names and RecentlyList menus (TinPhong DB folders)
lay = {}
for d in sorted(glob.glob(TL + '*/')):
    db = os.path.basename(os.path.dirname(d))
    names = set()
    rec = []
    for p in glob.glob(d + '*.dat'):
        b = os.path.basename(p)[:-4]
        if b.endswith('_RecentlyList') or 'RecentlyList' in b:
            try:
                root = ET.parse(p).getroot()
                for t1 in root.iter('Table1'):
                    rec.append(dict(MenuID=nz(t1.findtext('MenuID')), VN=nz(t1.findtext('VN')), FormName=nz(t1.findtext('FormName')),
                                    Para=nz(t1.findtext('Para')), Parent=nz(t1.findtext('Parent'))))
            except Exception as e:
                print('xml err', p, e)
            continue
        b = re.sub(r'(_filter_d|_filter|2)$', '', b) if b.endswith(('_filter', '_filter_d')) else b
        names.add(b)
    lay[db] = dict(names=sorted(names), recent=rec)
med_menu_by_id = {m['MenuID']: m for m in menu_rows}
fc_u = {k.upper() for k in form_classes}
cmp_rows = []
for db, d in lay.items():
    for n in d['names']:
        u = n.upper()
        base = u.split('_')[0] if False else u
        cmp_rows.append(dict(DB=db, Source='Layout .dat', MenuID='', Name=n, CaptionVN='',
                             InMedcomForms=('có (%s)' % forms_u[u]['FormType']) if u in forms_u else '',
                             InMedcomMenu='có' if u in menu_by_form else '',
                             HandwrittenClass='có' if u in fc_u else '', MedcomSameMenuID=''))
    for r in d['recent']:
        u = r['FormName'].upper()
        mm = med_menu_by_id.get(r['MenuID'])
        cmp_rows.append(dict(DB=db, Source='RecentlyList (menu)', MenuID=r['MenuID'], Name=r['FormName'], CaptionVN=r['VN'],
                             InMedcomForms=('có (%s)' % forms_u[u]['FormType']) if u in forms_u else '',
                             InMedcomMenu='có' if u in menu_by_form else '', HandwrittenClass='có' if u in fc_u else '',
                             MedcomSameMenuID=('cùng FormName' if mm and mm['FormName'].upper() == u else ('khác: %s' % (mm['FormName'] or '(nhóm)') if mm else 'không có MenuID'))))
for r in tp['SY_FrmLstTbl']:
    u = r['FormID'].upper()
    cmp_rows.append(dict(DB='TinPhong', Source='SY_FrmLstTbl (lọc %BeeC%)', MenuID='', Name=r['FormID'], CaptionVN=nz(r['CaptionVN']),
                         InMedcomForms=('có (%s)' % forms_u[u]['FormType']) if u in forms_u else '', InMedcomMenu='có' if u in menu_by_form else '',
                         HandwrittenClass='có' if u in fc_u else '', MedcomSameMenuID=''))
for r in tp_tmpl:
    u = r['FormID'].upper()
    cmp_rows.append(dict(DB='TinPhong', Source='SY_FrmLstTbl (mẫu cấu hình)', MenuID='', Name=r['FormID'], CaptionVN=nz(r['CaptionVN']),
                         InMedcomForms=('có (%s)' % forms_u[u]['FormType']) if u in forms_u else '', InMedcomMenu='có' if u in menu_by_form else '',
                         HandwrittenClass='có' if u in fc_u else '', MedcomSameMenuID=''))
for r in tp_menu + tp_menu_conf:
    u = nz(r['FormName']).upper()
    mm = med_menu_by_id.get(r['MenuID'])
    cmp_rows.append(dict(DB='TinPhong', Source='SY_Menu (lọc BeeC / xung đột)', MenuID=r['MenuID'], Name=nz(r['FormName']), CaptionVN=nz(r['VN']),
                         InMedcomForms=('có (%s)' % forms_u[u]['FormType']) if u in forms_u else '', InMedcomMenu='có' if u in menu_by_form else '',
                         HandwrittenClass='có' if u in fc_u else '',
                         MedcomSameMenuID=('cùng FormName' if mm and mm['FormName'].upper() == u else ('khác: %s / %s' % (mm['FormName'] or '(nhóm)', mm['CaptionVN']) if mm else 'không có MenuID'))))
with open(OUT + 'tinphong-vs-medcom.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(cmp_rows[0].keys()))
    w.writeheader()
    w.writerows(cmp_rows)
# summary
obj_u = {o['name'].upper() for o in objects}
SYS_CMD = {'LOGOFF', 'EXIT'}
for r in cmp_rows:
    u = r['Name'].upper()
    base = u.rsplit('_', 1)[0] if '_' in u else ''
    if u in SYS_CMD:
        r['Category'] = 'lệnh hệ thống'
    elif r['InMedcomForms']:
        r['Category'] = 'chung: form động cùng FormID'
    elif r['HandwrittenClass']:
        r['Category'] = 'chung: lớp viết tay dùng chung code'
    elif u.endswith('REPORT') and (u + 'STP') in obj_u:
        r['Category'] = 'chung: báo cáo (SP %sStp có ở MedData)' % r['Name']
    elif base and (base in forms_u or base in fc_u):
        r['Category'] = 'chung: biến thể Para của %s' % base
    elif u.endswith('REPORT'):
        r['Category'] = 'riêng: báo cáo không có SP ở MedData'
    else:
        r['Category'] = 'riêng TinPhong'
with open(OUT + 'tinphong-vs-medcom.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(cmp_rows[0].keys()))
    w.writeheader()
    w.writerows(cmp_rows)
uniq = {}
for r in cmp_rows:
    if r['DB'] != 'TinPhong' or not r['Name']:
        continue
    uniq.setdefault(r['Name'].upper(), r)
c = collections.Counter(r['Category'].split(' (')[0] if r['Category'].startswith('chung: báo cáo') else (r['Category'] if not r['Category'].startswith('chung: biến thể') else 'chung: biến thể Para') for r in uniq.values())
print('TP unique names', len(uniq), c)
print('TP riêng', sorted('%s' % r['Name'] for r in uniq.values() if r['Category'].startswith('riêng')))
json.dump(dict(cat=c, uniq={k: v['Category'] for k, v in uniq.items()}), open(SCR + 'stats_tp_cat.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('TP only', sorted(r['Name'] for r in uniq.values() if not (r['InMedcomForms'] or r['HandwrittenClass'])))
print('TP common', sorted('%s[%s%s]' % (r['Name'], r['InMedcomForms'], ' lớp' if r['HandwrittenClass'] else '') for r in uniq.values() if (r['InMedcomForms'] or r['HandwrittenClass'])))
menu_cmp = [r for r in cmp_rows if r['DB'] == 'TinPhong' and r['MenuID']]
print('TP menuID compare', collections.Counter(r['MedcomSameMenuID'].split(':')[0] for r in menu_cmp))
print([(r['MenuID'], r['Name'], r['CaptionVN'], r['MedcomSameMenuID']) for r in menu_cmp])
json.dump(dict(schema_cmp=schema_cmp, tp_key_fams=tk, med_key_fams=mk), open(SCR + 'stats_tp.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# customer-specific class names in shared code
cust = collections.Counter()
for k, v in form_classes.items():
    for tag in ('TINPHONG', 'THANHTAM', 'VIETDUC', 'MEDCOM', 'VD2', 'WA_', 'MERACINE', 'SANTINO', 'KEIKO', 'NOVO', 'KONA', 'DIM'):
        if tag in k:
            cust[tag] += 1
print('customer-named classes', cust, sorted(v['name'] for k, v in form_classes.items() if any(t in k for t in ('TINPHONG', 'THANHTAM', 'VIETDUC'))))
