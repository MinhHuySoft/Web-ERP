import sys; sys.stdout.reconfigure(encoding="utf-8")
import json, csv, re, os, collections

R = 'D:/Data/Medcom/TechnicalDocs/db-audit/run-20261019/'
OUT = 'D:/Data/Web-ERP/docs/legacy-analysis/'
SCR = os.path.dirname(os.path.abspath(__file__)) + '/'
FR = SCR + 'frag/'


def load(p):
    with open(p, encoding='utf-8-sig') as f:
        return json.load(f)


menu = list(csv.DictReader(open(OUT + 'data/menu-medcom.csv', encoding='utf-8-sig')))
rows_by = {r['table_name']: r['approximate_rows'] for r in load(R + 'row_counts.json')}

X = {}
# handwritten enabled
hw = [m for m in menu if m['FormKind'] == 'viet-tay' and m['EffectiveEnabled'] == '1']
g = collections.OrderedDict([('GetFormAcc', []), ('ERP.NET', []), ('Tools', [])])
for m in hw:
    k = 'GetFormAcc' if m['ResolvedBy'].startswith('GetFormAcc') else ('ERP.NET' if 'ERP.NET' in m['ResolvedBy'] else 'Tools')
    g[k].append('`%s`' % m['FormName'] + (' (Para `%s`)' % m['Para'] if m['Para'] else ''))
X['handwritten_enabled'] = '\n'.join('  - **%s** (%d): %s' % (
    {'GetFormAcc': 'GetFormAcc trong MainFrm', 'ERP.NET': 'lớp trong ERP.NET.exe', 'Tools': 'lớp trong Tools.dll'}[k], len(v),
    ', '.join(sorted(set(v)))) for k, v in g.items())
nf = [m for m in menu if m['FormKind'] == 'khong-tim-thay']
X['notfound'] = ', '.join('`%s` (%s, %s)' % (m['FormName'], m['MenuID'], m['Status']) for m in nf)
sh = [m for m in menu if m['ShadowedDynamicForm']]
X['shadowed'] = ', '.join('`%s` (%s; SY_FrmLstTbl %s)' % (m['FormName'], m['MenuID'], m['FormType']) for m in sh)

# doc tables filtered (keep SY_DocSetup + detected with rows > 0)
lines = open(FR + 'doc_tables.md', encoding='utf-8').read().splitlines()
keep = lines[:2]
for ln in lines[2:]:
    cells = [c.strip() for c in ln.strip('|').split('|')]
    src = cells[-1]
    rows = cells[2]
    if src.startswith('SY_DocSetup') or (rows not in ('', '0')):
        keep.append(ln)
X['doc_tables'] = '\n'.join(keep)

SY_MEAN = [
    ('SY_Menu', 'Cây menu desktop (MenuID phân cấp, FormName, Para, Filter, isDisable, ShowDialog, isNotCheckPermission...)', 'có (7/19 cột)'),
    ('SY_FrmLstTbl', 'Đăng ký form động: FormID → FormType, CaptionVN/EN/CH, TableName, PrimaryKey, Filter...', 'có (16/23 cột)'),
    ('SY_FrmCfg', 'Cấu hình layout/thuộc tính form động dạng key-value (FID, KeyID, SubID, KeyValue, SubValue, PFID, VDate)', 'một phần (3.419 dòng)'),
    ('SY_FmtFldTbl', 'Từ điển nhãn/định dạng field (FieldName, FormName, CaptionVN/EN/CH, AlignX, Min/MaxWidth)', 'không'),
    ('SY_FmatTbl', 'Định dạng số/chuỗi (FormatString, MaskString, NumberDecimal...)', 'không'),
    ('SY_FrmDrdwTbl', 'Nguồn combobox/dropdown theo form + grid + cột (Source SQL, ValueColumn, DisplayColumn, ColumnArr...)', 'không'),
    ('SY_FrmExpTbl', 'Biểu thức/công thức cột (Expression, RefColumn, RoundType...)', 'không'),
    ('SY_FrmCtrTbl', 'Vị trí control kiểu cũ (CtlTop/CtlLeft/Width/Height)', 'không'),
    ('SY_FrmParTbl', 'Tham số/điều kiện theo grid (Type, ColumnID, Value, Target)', 'không (0 dòng)'),
    ('SY_FrmFltTbl', 'Ô lọc trên toolbar của form (KeyID, ColumnID, Type=SearchControlTypes, Source...)', 'một phần (18 dòng)'),
    ('SY_FrmOptBtnTbl', 'Nút tùy chọn (OptionBar) của form', 'có'),
    ('SY_FrmGrdActTbl', 'Hành động khi đổi giá trị cột trên lưới', 'có'),
    ('SY_FrmMstActTbl', 'Hành động khi đổi field master / sau khi lưu', 'có'),
    ('SY_StTbl', 'Chuỗi ngôn ngữ / thông điệp (StringID, StringVN/EN/CH)', 'không'),
    ('SY_RpTbl', 'Định nghĩa tham số báo cáo dùng chung (ParaName, Type, ValueList...)', 'không'),
    ('SY_RpDTbl', 'Tham số theo từng báo cáo (RpName, PName, DefaultSQL, LockExpression...)', 'không'),
    ('SY_RpFTbl', 'File mẫu lưu trong DB (FileName, FileContent): file báo cáo từ DesignerForm, mẫu Word/Excel của AttachWordX', 'không'),
    ('SY_DocSetup', 'Loại chứng từ: DocType, tiền tố số CT, bảng master/detail, FormID, isAcc', 'có (8/11 cột)'),
    ('SY_Setup', 'Tham số hệ thống (CodeID/CodeValue)', 'không'),
    ('SY_InitSetup', 'Kỳ bắt đầu, phương pháp tính giá', 'không'),
    ('SY_Period', 'Kỳ kế toán (tháng), cờ khóa sổ isLock/isLockData', 'không'),
    ('SY_Year', 'Năm tài chính', 'không'),
    ('SY_Quarter', 'Quý', 'không'),
    ('SY_User', 'Người dùng (UserName, nhóm, chi nhánh, kho, ủy quyền UserAuthority, mật khẩu...)', 'không (cố ý)'),
    ('SY_UserGroup', 'Nhóm người dùng', 'có'),
    ('SY_UserGroupDetail', 'Thuộc tính mở rộng của nhóm (KeyID/KeyName/Value)', 'không'),
    ('SY_UserGroupPermisstion', 'Quyền theo nhóm × menu', 'có (11/14 cột)'),
    ('SY_UserPermisstion', 'Quyền riêng theo người dùng × menu (cộng dồn với quyền nhóm)', 'không'),
    ('SY_UserBranch', 'Người dùng × chi nhánh', 'không'),
    ('SY_UserStorehouse', 'Người dùng × kho', 'không'),
    ('SY_UserLog', 'Nhật ký thao tác', 'không'),
    ('SY_UserLogDetail', 'Chi tiết nhật ký', 'không'),
    ('SY_ApproveSetupTbl', 'Thiết lập duyệt nhiều cấp', 'có (0 dòng)'),
    ('SY_ApproveDocumentTbl', 'Chứng từ chờ/đã duyệt', 'không'),
    ('SY_BalanceItemTbl', 'Số dư đầu kỳ hàng tồn', 'không'),
    ('SY_BalanceObjectTbl', 'Số dư đầu kỳ công nợ', 'không'),
    ('SY_BalanceAccountTbl', 'Số dư đầu kỳ tài khoản', 'không'),
    ('SY_NotifyMsg', 'Thông báo cho người dùng', 'không'),
    ('SY_MessageTbl', 'Tin nhắn nội bộ', 'không'),
    ('SY_UserToken', 'Token thiết bị (push notification)', 'không'),
    ('SY_APILog', 'Log gọi API', 'không'),
    ('SY_UsLc', 'Đăng ký máy/bản quyền', 'không'),
    ('SY_STT', 'Bảng số thứ tự 1..N (tiện ích SQL)', 'không'),
    ('SY_ResUser', 'Tài nguyên/khóa cấu hình theo người dùng', 'không'),
    ('SY_DshBrdCnt', 'Nội dung dashboard theo MenuID', 'không'),
    ('SY_ImDatTbl', 'Kịch bản import dữ liệu (ImportSQL/DeleteSQL)', 'không'),
    ('SY_Link', 'Liên kết DB khác (LinkServer)', 'không (cố ý)'),
]
t = ['| Bảng | Vai trò | Số dòng (xấp xỉ) | Có trong snapshot workflow-config? |', '|---|---|---:|---|']
for n, m, s in SY_MEAN:
    t.append('| `%s` | %s | %s | %s |' % (n, m, rows_by.get(n, '?'), s))
X['sy_tables'] = '\n'.join(t)

# suffix stats
suf = load(SCR + 'suffix.json')
X['suffix'] = '; '.join('%s `%s`: %d' % (k.split('|')[0], k.split('|')[1], v) for k, v in sorted(suf.items()))

tpl = open(SCR + 'doc_template.md', encoding='utf-8').read()


def rep(m):
    kind, name = m.group(1), m.group(2)
    if kind == 'F':
        return open(FR + name, encoding='utf-8').read().rstrip('\n')
    return X[name]


doc = re.sub(r'\{\{(F|X):([\w\.]+)\}\}', rep, tpl)
open(OUT + '30-metadata-menu-form-db.md', 'w', encoding='utf-8').write(doc)
print(len(doc), 'chars', doc.count('\n'), 'lines')
left = re.findall(r'\{\{[^}]*\}\}', doc)
print('unresolved', left)
