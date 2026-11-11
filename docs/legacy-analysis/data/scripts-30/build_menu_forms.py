import sys; sys.stdout.reconfigure(encoding="utf-8")
import json, csv, re, os, glob, collections

W = 'D:/Data/Medcom/TechnicalDocs/db-audit/workflow-config-20261019/'
R = 'D:/Data/Medcom/TechnicalDocs/db-audit/run-20261019/'
A = 'D:/Data/Medcom/TechnicalDocs/db-audit/analysis/workflow-trace/'
DEC = 'D:/Data/Web-ERP/.legacy/decompiled/'
OUT = 'D:/Data/Web-ERP/docs/legacy-analysis/data/'
SCR = os.path.dirname(os.path.abspath(__file__)) + '/'
RPT = 'D:/Data/Medcom/ERP_Medcom2026/Reports/'
os.makedirs(OUT, exist_ok=True)
os.makedirs(SCR + 'frag', exist_ok=True)


def load(p):
    with open(p, encoding='utf-8-sig') as f:
        return json.load(f)


def nz(v):
    return '' if v is None else str(v)


menus = load(W + 'menus.json')
forms = load(W + 'forms.json')
fc = load(W + 'form_config.json')
obtn = load(W + 'option_buttons.json')
gact = load(W + 'grid_actions.json')
fact = load(W + 'form_actions.json')
fflt = load(W + 'form_filters.json')
gperm = load(W + 'group_permissions.json')
objects = load(R + 'objects.json')
rowcounts = load(R + 'row_counts.json')
avail = load(A + 'menu_availability.json')

obj_by_upper = {}
for o in objects:
    obj_by_upper.setdefault(o['name'].upper(), o)
rows_by_upper = {r['table_name'].upper(): r['approximate_rows'] for r in rowcounts}

# ---------------------------------------------------------------- class inventory
class_re = re.compile(r'^[ \t]*(?:\[[^\]]*\][ \t]*\r?\n[ \t]*)*(?:public|internal|private|protected)?[ \t]*(?:(?:sealed|abstract|partial|static)[ \t]+)*class[ \t]+(\w+)(?:[ \t]*:[ \t]*([\w\.]+))?', re.M)
ns_re = re.compile(r'^namespace\s+([\w\.]+)', re.M)
classes = {}  # upper name -> list of dict
for asm, root in (('ERP.NET', DEC + 'ERP.NET'), ('Tools', DEC + 'Tools')):
    for p in glob.glob(root + '/**/*.cs', recursive=True):
        rel = os.path.relpath(p, DEC).replace(os.sep, '/')
        try:
            s = open(p, encoding='utf-8', errors='replace').read()
        except Exception:
            continue
        nsm = ns_re.search(s)
        ns = nsm.group(1) if nsm else ''
        for m in class_re.finditer(s):
            classes.setdefault(m.group(1).upper(), []).append(
                dict(name=m.group(1), base=(m.group(2) or ''), file=rel, asm=asm, ns=ns))

FORM_BASES = {'FORM', 'SYSTEM.WINDOWS.FORMS.FORM'}


def is_form(name_upper, depth=0):
    if depth > 15:
        return False
    for c in classes.get(name_upper, []):
        b = c['base'].split('.')[-1].upper() if c['base'] else ''
        if c['base'].upper() in FORM_BASES or b == 'FORM':
            return True
        if b and b != name_upper and is_form(b, depth + 1):
            return True
    return False


form_classes = {k: v for k, v in classes.items() if is_form(k)}
print('classes', len(classes), 'form classes', len(form_classes))

# GetFormAcc hardcoded list
mf = open(DEC + 'ERP.NET/ERP/MainFrm.cs', encoding='utf-8', errors='replace').read()
i0 = mf.find('public Form GetFormAcc(')
i1 = mf.find('return null;', i0)
getformacc = re.findall(r'"(\w+)"\.ToUpper\(\)', mf[i0:i1])
GFA = {x.upper() for x in getformacc}
print('GetFormAcc', len(getformacc))

SYSTEM_TAGS = {x.upper() for x in ['Exit', 'LogOff', 'WindowList', 'RefreshSystem', 'SearchMenu', 'UltraViewer', 'WindowsClasic',
                                   'WindowsRibbon', 'about', 'anydesk', 'help', 'helpPdf', 'langchina', 'langenglish',
                                   'langvietnam', 'rustdesk', 'skinselect1', 'skinselect2', 'skinselect3', 'skinselect3Black',
                                   'skinselect3Silver', 'skinselect4', 'skinselect4Black', 'skinselect4Green',
                                   'skinselect4Silver', 'skinselect9', 'skinselectfont']}

forms_by_upper = {f['FormID'].upper(): f for f in forms}
rpt_files = {os.path.splitext(x)[0].upper(): x for x in os.listdir(RPT)} if os.path.isdir(RPT) else {}

# config row counts per FID (direct + variants FID_xxx)
cfg_direct = collections.Counter(r['FID'] for r in fc)


def cfg_count(name):
    u = name.upper()
    d = sum(v for k, v in cfg_direct.items() if k.upper() == u)
    var = sum(v for k, v in cfg_direct.items() if k.upper().startswith(u + '_'))
    return d, var


def prefix_of(name):
    if not name:
        return ''
    if '_' in name:
        return name.split('_')[0]
    m = re.match(r'^(v)[A-Z]', name)
    return '(không tiền tố)'


def classify(fn):
    """Return dict describing how MainFrm.MenuClick resolves FormName (case-insensitive)."""
    u = fn.upper()
    d = dict(kind='', sub='', cls_file='', form_type='', form_caption='', table='', shadowed='', rpt_sp='', rpt_file='')
    f = forms_by_upper.get(u)
    if u in SYSTEM_TAGS:
        d.update(kind='lenh-he-thong', sub='TagString xử lý trong MainFrm/Menus.SystemMenu_Action')
        return d
    if u in GFA:
        cl = form_classes.get(u, classes.get(u, [{}]))[0]
        d.update(kind='viet-tay', sub='GetFormAcc (MainFrm, khởi tạo trực tiếp)', cls_file=cl.get('file', ''))
    elif u in form_classes:
        cl = form_classes[u][0]
        d.update(kind='viet-tay', sub='lớp Form trong %s (reflection SysObject.GetFormByNameEx)' % cl['asm'], cls_file=cl['file'])
    elif f is not None:
        d.update(kind='dong', sub='SY_FrmLstTbl -> ' + nz(f['FormType']).upper(), form_type=nz(f['FormType']).upper(),
                 form_caption=nz(f['CaptionVN']), table=nz(f['TableName']))
        return d
    elif len(fn) >= 8 and u.endswith('REPORT'):
        sp = obj_by_upper.get(u + 'STP')
        d.update(kind='bao-cao', sub='App.GetFormForReport -> ReportViewerFrm + %sStp' % fn,
                 rpt_sp=('có' if sp else 'KHÔNG có SP'), rpt_file=rpt_files.get(u, ''))
        return d
    else:
        d.update(kind='khong-tim-thay', sub='không có lớp, không có SY_FrmLstTbl, không phải *Report')
        return d
    # handwritten: note if a SY_FrmLstTbl row of same name exists (shadowed by class)
    if f is not None:
        d.update(shadowed='có dòng SY_FrmLstTbl (%s) nhưng bị lớp viết tay che' % nz(f['FormType']).upper(),
                 form_type=nz(f['FormType']).upper(), form_caption=nz(f['CaptionVN']), table=nz(f['TableName']))
    return d


# ---------------------------------------------------------------- menu tree
by_id = {m['MenuID']: m for m in menus}
children = collections.defaultdict(list)
orphans = []
for m in menus:
    p = m['Parent'] or ''
    if p:
        if p in by_id:
            children[p].append(m['MenuID'])
        else:
            orphans.append(m['MenuID'])


def chain(mid):
    out = []
    seen = set()
    cur = by_id.get(mid)
    while cur and (cur['Parent'] or '') and cur['Parent'] in by_id and cur['Parent'] not in seen:
        seen.add(cur['Parent'])
        out.append(cur['Parent'])
        cur = by_id[cur['Parent']]
    return out[::-1]


perm_by_menu = collections.defaultdict(lambda: collections.Counter())
for g in gperm:
    c = perm_by_menu[g['MenuID']]
    c['rows'] += 1
    if g['IsRun']:
        c['run'] += 1
    if g['IsAdd']:
        c['add'] += 1
    if g['IsUpdate']:
        c['upd'] += 1
    if g['IsDelete']:
        c['del'] += 1

avail_by = {a['MenuID']: a for a in avail}
menu_rows = []
for m in sorted(menus, key=lambda x: x['MenuID']):
    mid = m['MenuID']
    anc = chain(mid)
    level = len(anc) + 1
    dis_anc = [a for a in anc if by_id[a]['isDisable']]
    own = bool(m['isDisable'])
    enabled = (not own) and not dis_anc and (not (m['Parent'] or '') or m['Parent'] in by_id)
    if own and dis_anc:
        st = 'tắt (tự tắt + cha tắt)'
    elif own:
        st = 'tắt (tự tắt)'
    elif dis_anc:
        st = 'tắt do cha'
    elif (m['Parent'] or '') and m['Parent'] not in by_id:
        st = 'mồ côi (Parent không tồn tại)'
    else:
        st = 'bật'
    fn = nz(m['FormName']).strip()
    if fn:
        cl = classify(fn)
    else:
        cl = dict(kind='nhom' if children.get(mid) else 'nhom-rong', sub='không có FormName', cls_file='', form_type='',
                  form_caption='', table='', shadowed='', rpt_sp='', rpt_file='')
    d, var = cfg_count(fn) if fn else (0, 0)
    pv = nz(m['Para']).strip()
    if fn and pv:
        d2, _ = cfg_count(fn + '_' + pv)
    else:
        d2 = 0
    pc = perm_by_menu.get(mid, collections.Counter())
    av = avail_by.get(mid)
    menu_rows.append(dict(
        MenuID=mid, Level=level, Parent=nz(m['Parent']),
        Path=' > '.join([by_id[a]['VN'] for a in anc] + [nz(m['VN'])]),
        CaptionVN=nz(m['VN']), FormName=fn, Para=pv, Filter=nz(m['Filter']),
        isDisable=int(own), DisabledAncestors=';'.join(dis_anc), Status=st, EffectiveEnabled=int(enabled),
        ChildCount=len(children.get(mid, [])),
        FormKind=cl['kind'], ResolvedBy=cl['sub'], FormType=cl['form_type'], FormCaptionVN=cl['form_caption'],
        TableName=cl['table'], ClassFile=cl['cls_file'], ShadowedDynamicForm=cl['shadowed'],
        ReportSP=cl['rpt_sp'], ReportFile=cl['rpt_file'],
        RuntimeFormName=(fn + '_' + pv) if (fn and pv) else fn,
        FrmCfgRows=d, FrmCfgRowsVariant=d2 if pv else var,
        GroupsIsRun=pc['run'], GroupsWithRow=pc['rows'],
        CheckPrevAnalysis=('' if av is None else ('khớp' if bool(av['enabled_in_menu_tree']) == enabled else 'LỆCH')),
    ))

cols = list(menu_rows[0].keys())
with open(OUT + 'menu-medcom.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(menu_rows)

# ---- stats
st = collections.Counter(r['Status'] for r in menu_rows)
kinds_all = collections.Counter(r['FormKind'] for r in menu_rows)
kinds_en = collections.Counter(r['FormKind'] for r in menu_rows if r['EffectiveEnabled'])
ft_en = collections.Counter(r['FormType'] for r in menu_rows if r['EffectiveEnabled'] and r['FormKind'] == 'dong')
ft_all = collections.Counter(r['FormType'] for r in menu_rows if r['FormKind'] == 'dong')
lv = collections.Counter(r['Level'] for r in menu_rows)
mism = [r['MenuID'] for r in menu_rows if r['CheckPrevAnalysis'] == 'LỆCH']
print('menu status', st)
print('kinds all', kinds_all)
print('kinds enabled', kinds_en)
print('formtype enabled', ft_en, 'all', ft_all)
print('levels', lv, 'orphans', orphans, 'mismatch prev analysis', mism)
notfound = [(r['MenuID'], r['FormName'], r['Status']) for r in menu_rows if r['FormKind'] == 'khong-tim-thay']
print('notfound', len(notfound), notfound[:80])
shadow = [(r['MenuID'], r['FormName'], r['ShadowedDynamicForm']) for r in menu_rows if r['ShadowedDynamicForm']]
print('shadowed', len(shadow), shadow)
rep = [(r['MenuID'], r['FormName'], r['ReportSP'], r['ReportFile'], r['Status']) for r in menu_rows if r['FormKind'] == 'bao-cao']
print('reports', len(rep), collections.Counter((x[2], bool(x[3])) for x in rep))
print('reports enabled', collections.Counter((x[2], bool(x[3])) for x in rep if x[4] == 'bật'))
paras = [(r['MenuID'], r['FormName'], r['Para'], r['Filter']) for r in menu_rows if r['Para'] or r['Filter']]
print('para/filter', len(paras), paras)
dupform = collections.Counter(r['FormName'].upper() for r in menu_rows if r['FormName'])
print('FormName used by >1 menu', [(k, v) for k, v in dupform.items() if v > 1])

# top-level summary per root
roots = [r for r in menu_rows if r['Level'] == 1]
summary = []
for rt in roots:
    sub = [r for r in menu_rows if r['MenuID'] == rt['MenuID'] or rt['MenuID'] in (chain(r['MenuID']))]
    leaf = [r for r in sub if r['FormName']]
    leaf_en = [r for r in leaf if r['EffectiveEnabled']]
    kc = collections.Counter(r['FormKind'] for r in leaf_en)
    summary.append(dict(MenuID=rt['MenuID'], VN=rt['CaptionVN'], Status=rt['Status'], items=len(sub) - 1,
                        forms=len(leaf), forms_en=len(leaf_en), dong=kc['dong'], viet=kc['viet-tay'],
                        bc=kc['bao-cao'], kt=kc['khong-tim-thay'], ht=kc['lenh-he-thong']))

with open(SCR + 'frag/menu_summary.md', 'w', encoding='utf-8') as f:
    f.write('| MenuID | Phân hệ (VN) | Trạng thái | Số mục con (mọi cấp) | Mục có FormName | Đang bật | Động | Viết tay | Báo cáo | Không thấy | Lệnh HT |\n')
    f.write('|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|\n')
    for s in summary:
        f.write('| %(MenuID)s | %(VN)s | %(Status)s | %(items)d | %(forms)d | %(forms_en)d | %(dong)d | %(viet)d | %(bc)d | %(kt)d | %(ht)d |\n' % s)

# ---- markdown tree (enabled only)
KIND_TAG = {'dong': 'Đ', 'viet-tay': 'V', 'bao-cao': 'BC', 'khong-tim-thay': '??', 'lenh-he-thong': 'HT', 'nhom': '', 'nhom-rong': ''}
lines = []
lines.append('# Cây menu Medcom (MedData) — chỉ các mục đang bật\n')
lines.append('Nguồn: `SY_Menu` snapshot 2026-10-19 (`menus.json`), sinh tự động từ `menu-medcom.csv`. '
             'Chỉ liệt kê mục có `isDisable = 0` và mọi cấp cha đều bật. Thụt lề theo cấp.\n')
lines.append('Ký hiệu: **[Đ:LIST]** form động (SY_FrmLstTbl, kèm FormType) · **[V]** form viết tay (lớp C# trong ERP.NET/Tools) · '
             '**[BC]** báo cáo (`<FormName>Stp` + `.rpx`) · **[??]** không tìm thấy · **[HT]** lệnh hệ thống. '
             '`Para`/`Filter` ghi sau dấu `|`.\n')
en_set = {r['MenuID'] for r in menu_rows if r['EffectiveEnabled']}
rows_by = {r['MenuID']: r for r in menu_rows}


def walk(mid, depth):
    r = rows_by[mid]
    if mid not in en_set:
        return
    tag = KIND_TAG.get(r['FormKind'], '')
    if r['FormKind'] == 'dong':
        tag = 'Đ:' + r['FormType']
    s = '  ' * depth + '- `%s` %s' % (mid, r['CaptionVN'])
    if r['FormName']:
        s += ' — `%s` [%s]' % (r['FormName'], tag)
    extra = []
    if r['Para']:
        extra.append('Para=`%s`' % r['Para'])
    if r['Filter']:
        extra.append('Filter=`%s`' % r['Filter'].replace('|', '/'))
    if extra:
        s += ' | ' + ', '.join(extra)
    lines.append(s)
    for c in sorted(children.get(mid, [])):
        walk(c, depth + 1)


for rt in sorted([m['MenuID'] for m in menus if not (m['Parent'] or '')]):
    walk(rt, 0)
with open(OUT + 'menu-medcom-tree.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

# ---------------------------------------------------------------- forms catalogue
menus_by_form = collections.defaultdict(list)
for r in menu_rows:
    if r['FormName']:
        menus_by_form[r['FormName'].upper()].append(r)
cnt_ob = collections.Counter(x['FormID'].upper() for x in obtn)
cnt_ga = collections.Counter(x['FormID'].upper() for x in gact)
cnt_fa = collections.Counter(x['FormID'].upper() for x in fact)
cnt_ff = collections.Counter(x['FormID'].upper() for x in fflt)
form_rows = []
for f in sorted(forms, key=lambda x: x['FormID'].upper()):
    fid = f['FormID']
    u = fid.upper()
    ms = menus_by_form.get(u, [])
    d, var = cfg_count(fid)
    tn = nz(f['TableName'])
    tobj = obj_by_upper.get(tn.upper()) if tn else None
    td = nz(f['TableDetail'])
    form_rows.append(dict(
        FormID=fid, Prefix=prefix_of(fid), FormType=nz(f['FormType']).upper(), CaptionVN=nz(f['CaptionVN']),
        TableName=tn, TableObjectType=(tobj['type_desc'] if tobj else ('' if not tn else 'KHÔNG TỒN TẠI')),
        TableRows=rows_by_upper.get(tn.upper(), '') if tn else '',
        PrimaryKey=nz(f['PrimaryKey']), TableDetail=td, TableDetailLeftJoinField=nz(f['TableDetailLeftJoinField']),
        TableDetailSelectFrom=nz(f['TableDetailSelectFrom']), TableDetail2=nz(f['TableDetail2']),
        TableDetail2LeftJoinField=nz(f['TableDetail2LeftJoinField']), TableDetail2SelectFrom=nz(f['TableDetail2SelectFrom']),
        Filter=nz(f['Filter']), FilterEx=nz(f['FilterEx']), AddNewColumnArr=nz(f['AddNewColumnArr']),
        DefaultColumnArr=nz(f['DefaultColumnArr']), LockColumnArr=nz(f['LockColumnArr']),
        FrmCfgRows=d, FrmCfgRowsVariants=var,
        OptionButtons=cnt_ob[u], GridActions=cnt_ga[u], FormActions=cnt_fa[u], FormFilters=cnt_ff[u],
        MenuCount=len(ms), MenuIDs=';'.join(x['MenuID'] for x in ms),
        MenuEnabled=int(any(x['EffectiveEnabled'] for x in ms)),
        ShadowedByClass=('có (%s)' % form_classes[u][0]['file']) if u in form_classes or u in GFA else '',
    ))
with open(OUT + 'forms-medcom.csv', 'w', encoding='utf-8-sig', newline='') as fo:
    w = csv.DictWriter(fo, fieldnames=list(form_rows[0].keys()))
    w.writeheader()
    w.writerows(form_rows)

ftc = collections.Counter(r['FormType'] for r in form_rows)
print('forms by type', ftc)
pref = collections.defaultdict(collections.Counter)
for r in form_rows:
    pref[r['Prefix']][r['FormType']] += 1
    pref[r['Prefix']]['_menu'] += 1 if r['MenuCount'] else 0
    pref[r['Prefix']]['_menu_en'] += r['MenuEnabled']
    pref[r['Prefix']]['_cfg'] += 1 if (r['FrmCfgRows'] or r['FrmCfgRowsVariants']) else 0
print('forms with menu', sum(1 for r in form_rows if r['MenuCount']), 'enabled', sum(r['MenuEnabled'] for r in form_rows),
      'with cfg', sum(1 for r in form_rows if r['FrmCfgRows']), 'shadowed', sum(1 for r in form_rows if r['ShadowedByClass']))
print('table missing', [(r['FormID'], r['TableName']) for r in form_rows if r['TableObjectType'] == 'KHÔNG TỒN TẠI'])
print('empty table', collections.Counter((r['FormType'], bool(r['TableName'])) for r in form_rows))
print('detail', sum(1 for r in form_rows if r['TableDetail']), 'detail2', sum(1 for r in form_rows if r['TableDetail2']))
types_order = ['LIST', 'LISTEDIT', 'EDIT', 'EDITTOP', 'POS', 'TIMELINE', 'CALENDAR', 'TREE']
extra_types = sorted(t for t in ftc if t not in types_order)
with open(SCR + 'frag/forms_by_prefix.md', 'w', encoding='utf-8') as fo:
    tl = [t for t in types_order + extra_types if ftc.get(t)]
    fo.write('| Tiền tố | Tổng | ' + ' | '.join(tl) + ' | Có menu | Menu đang bật | Có SY_FrmCfg |\n')
    fo.write('|---|---:|' + '---:|' * len(tl) + '---:|---:|---:|\n')
    for p, c in sorted(pref.items(), key=lambda x: -sum(v for k, v in x[1].items() if not k.startswith('_'))):
        tot = sum(v for k, v in c.items() if not k.startswith('_'))
        fo.write('| %s | %d | ' % (p, tot) + ' | '.join(str(c.get(t, 0)) for t in tl) +
                 ' | %d | %d | %d |\n' % (c['_menu'], c['_menu_en'], c['_cfg']))
# forms config coverage
cfg_fids = sorted(cfg_direct)
nolist = [x for x in cfg_fids if x.upper() not in forms_by_upper]
print('FrmCfg FIDs', len(cfg_fids), 'not in SY_FrmLstTbl', nolist)
json.dump(dict(menu_status=st, kinds_all=kinds_all, kinds_en=kinds_en, ft_en=ft_en, ft_all=ft_all, levels=lv,
               notfound=notfound, shadow=shadow, reports=rep, paras=paras, forms_by_type=ftc, getformacc=getformacc,
               form_classes=len(form_classes), classes=len(classes), orphans=orphans, mism=mism,
               cfg_fids=cfg_fids, cfg_nolist=nolist),
          open(SCR + 'stats_menu_forms.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=str)

# list of form classes for later comparison
json.dump({k: v[0] for k, v in form_classes.items()}, open(SCR + 'form_classes.json', 'w', encoding='utf-8'), ensure_ascii=False)
