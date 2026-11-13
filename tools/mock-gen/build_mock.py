"""Sinh mock HTML theo chuẩn ERP-HTML v1 (docs/kien-truc/02-chuan-html-erp.md) từ metadata Medcom.

Nguồn (chỉ đọc):
  - docs/legacy-analysis/data/menu-medcom.csv, forms-medcom.csv
  - D:/Data/Medcom/TechnicalDocs/db-audit/workflow-config-20261019/*.json (SY_FrmCfg, trạng thái, loại chứng từ)
  - D:/Data/Medcom/TechnicalDocs/db-audit/run-20261019/columns.json, parameters.json (schema MedData)

Dữ liệu dòng là DỮ LIỆU GIẢ, sinh ngẫu nhiên có hạt giống cố định (không có dữ liệu khách hàng thật).
Chạy:  python -I tools/mock-gen/build_mock.py
Kết quả: web/mock/ (xóa và sinh lại toàn bộ).
"""
import collections
import csv
import datetime
import html
import json
import os
import random
import re
import shutil
import sys

sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOC_DATA = os.path.join(ROOT, 'docs', 'legacy-analysis', 'data')
WCFG = 'D:/Data/Medcom/TechnicalDocs/db-audit/workflow-config-20261019/'
RUN = 'D:/Data/Medcom/TechnicalDocs/db-audit/run-20261019/'
OUT = os.path.join(ROOT, 'web', 'mock')
BASE = '/mock'          # URL gốc của mock khi chạy dev server với thư mục web/ làm gốc
TODAY = datetime.date(2026, 11, 11)
TOKEN = '<input type="hidden" name="__RequestVerificationToken" value="mock-token">'


def load(p):
    with open(p, encoding='utf-8-sig') as f:
        return json.load(f)


def e(s):
    return html.escape('' if s is None else str(s), quote=True)


def write(rel, content):
    p = os.path.join(OUT, rel.replace('/', os.sep))
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)


def page(title, body):
    """Mỗi file mock là một trang HTML đầy đủ, hợp lệ; FE tách vai trò data-erp cần dùng."""
    return ('<!doctype html>\n<html lang="vi"><head><meta charset="utf-8">'
            '<meta name="erp-contract" content="1.0">'
            f'<title>{e(title)}</title></head>\n<body>\n{body}\n</body></html>\n')


def slug(s):
    return re.sub(r'[^A-Za-z0-9_.-]+', '-', s).strip('-')


# ---------------------------------------------------------------------------------------------------------------
# Nạp metadata
# ---------------------------------------------------------------------------------------------------------------
menu_rows = list(csv.DictReader(open(os.path.join(DOC_DATA, 'menu-medcom.csv'), encoding='utf-8-sig')))
forms = {r['FormID'].upper(): r for r in csv.DictReader(open(os.path.join(DOC_DATA, 'forms-medcom.csv'), encoding='utf-8-sig'))}
fcfg = collections.defaultdict(list)
for r in load(WCFG + 'form_config.json'):
    fcfg[r['FID'].upper()].append(r)
doc_types = {d['FormID'].upper(): d for d in load(WCFG + 'document_types.json') if d.get('FormID')}
columns = collections.defaultdict(list)
for c in load(RUN + 'columns.json'):
    columns[c['object_name'].upper()].append(c)
for k in columns:
    columns[k].sort(key=lambda c: c['column_id'])
params = collections.defaultdict(list)
for p in load(RUN + 'parameters.json'):
    params[p['object_name'].upper()].append(p)
STATUS_FILES = {
    'IV_INBOUNDREQUESTSTATUSTBL': 'inbound_status.json', 'AR_ORDERSTATUSTBL': 'sales_order_status.json',
    'AP_PURCHASEREQUESTSTATUSTBL': 'purchase_status.json', 'AR_INVOICESTATUSTBL': 'sales_invoice_status.json',
}
GENERIC_STATUS = [(0, 'Nháp', 'neutral'), (1, 'Chờ duyệt', 'warning'), (2, 'Đã duyệt', 'success'),
                  (3, 'Hoàn thành', 'info'), (9, 'Hủy', 'danger')]


def statuses_for(table):
    f = STATUS_FILES.get((table or '').upper())
    if f and os.path.exists(WCFG + f):
        out = []
        for s in load(WCFG + f):
            tone = 'danger' if s.get('IsReject') or s.get('isCancelStatus') else 'info'
            out.append((s['StatusID'], s['StatusName'], tone))
        if out:
            return out
    return GENERIC_STATUS


# Lưới: chỉ hiện cột thật của bảng
def table_cols(table):
    return columns.get((table or '').upper(), [])


def cfg_of(fid):
    return fcfg.get((fid or '').upper(), [])


def cfg_get(rows, key, sub=None):
    for r in rows:
        if r['KeyID'] == key and (sub is None or (r['SubID'] or '') == sub):
            return r['KeyValue'] or ''
    return ''


# ---------------------------------------------------------------------------------------------------------------
# Nhãn tiếng Việt cho tên cột
# ---------------------------------------------------------------------------------------------------------------
FIELD_VI = {
    'DocumentID': 'Số chứng từ', 'DocumentDate': 'Ngày chứng từ', 'ObjectID': 'Mã đối tượng', 'ObjectName': 'Tên đối tượng',
    'ItemID': 'Mã hàng', 'ItemName': 'Tên hàng', 'ItemCode': 'Mã hàng NCC', 'Unit': 'ĐVT', 'UnitID': 'ĐVT', 'Unit2': 'ĐVT 2',
    'UnitFactor': 'Hệ số quy đổi', 'Quantity': 'Số lượng', 'Quantity2': 'Số lượng 2', 'UnitPrice': 'Đơn giá', 'Price': 'Giá',
    'Amount': 'Thành tiền', 'VATPercent': '% VAT', 'VATAmount': 'Tiền VAT', 'TotalAmount': 'Tổng tiền', 'BaseTotal': 'Tổng tiền',
    'DiscountAmount': 'Chiết khấu', 'DiscountPercent': '% chiết khấu', 'Notes': 'Ghi chú', 'Memo': 'Diễn giải',
    'Description': 'Mô tả', 'StatusID': 'Trạng thái', 'StatusName': 'Trạng thái', 'BranchID': 'Chi nhánh',
    'StoreHouseID': 'Kho', 'StoreHouseID2': 'Kho nhận', 'Lot': 'Số lô', 'LotNumber': 'Số lô', 'ExpireDate': 'Hạn dùng',
    'ExpiryDate': 'Hạn dùng', 'CurrencyID': 'Loại tiền', 'RateExchange': 'Tỷ giá', 'EmployeeID': 'Nhân viên',
    'EmployeeName': 'Tên nhân viên', 'CostCenterID': 'Bộ phận', 'CostID': 'Khoản mục', 'AccountID': 'Tài khoản',
    'DebitAccID': 'TK Nợ', 'CreditAccID': 'TK Có', 'PayAccID': 'TK thanh toán', 'InvAccID': 'TK kho',
    'InvoiceNo': 'Số hóa đơn', 'InvoiceDate': 'Ngày hóa đơn', 'InvoiceSerial': 'Ký hiệu HĐ', 'Address': 'Địa chỉ',
    'Phone': 'Điện thoại', 'Tel': 'Điện thoại', 'Mobile': 'Di động', 'Email': 'Email', 'TaxCode': 'Mã số thuế',
    'UserCreate': 'Người tạo', 'DateCreate': 'Ngày tạo', 'UserUpdate': 'Người sửa', 'DateUpdate': 'Ngày sửa',
    'isLock': 'Khóa', 'IsLock': 'Khóa', 'STT': 'STT', 'CategoryID': 'Nhóm hàng', 'CategoryName': 'Tên nhóm',
    'ContractID': 'Hợp đồng', 'ContractNo': 'Số hợp đồng', 'OrderNo': 'Số đơn hàng', 'PONo': 'Số đơn mua',
    'OrderID': 'Số đơn hàng', 'RefDoc': 'Chứng từ gốc', 'LinkID': 'Liên kết', 'Contact': 'Người liên hệ',
    'ContactName': 'Người liên hệ', 'Province': 'Tỉnh/TP', 'BankName': 'Ngân hàng', 'BankName2': 'Chi nhánh NH',
    'AccountNo': 'Số tài khoản', 'HangSX': 'Hãng sản xuất', 'Origin': 'Xuất xứ', 'Serial': 'Số serial',
    'SerialNo': 'Số serial', 'Model': 'Model', 'Barcode': 'Mã vạch', 'QRCode': 'Mã QR', 'Additional': 'Thông tin thêm',
    'ManagerID': 'Quản lý', 'DepartmentID': 'Phòng ban', 'Reason': 'Lý do', 'ReasonID': 'Lý do',
    'FromDate': 'Từ ngày', 'ToDate': 'Đến ngày', 'Template': 'Mẫu in', 'PeriodID': 'Kỳ', 'Year': 'Năm',
    'Month': 'Tháng', 'IsActive': 'Đang dùng', 'isActive': 'Đang dùng', 'Disable': 'Ngừng dùng', 'IsDisable': 'Ngừng dùng',
    'CreditMax': 'Hạn mức nợ', 'OverDeptDay': 'Số ngày nợ', 'DueDate': 'Hạn thanh toán', 'PaymentTerm': 'Điều khoản TT',
    'DeliveryDate': 'Ngày giao', 'ReceiveDate': 'Ngày nhận', 'ThoiGian': 'Thời gian', 'UserName': 'Người dùng',
    'SendTo': 'Gửi đến', 'BackColor': 'Màu', 'Cost': 'Chi phí', 'CostType': 'Loại chi phí', 'SourceAmount': 'Tiền nguyên tệ',
    'Weight': 'Trọng lượng', 'ImageURL': 'Hình ảnh', 'Image': 'Hình ảnh', 'OrderTypeID': 'Loại đơn', 'PackageTypeID': 'Loại kiện',
    'DeclarationNumber': 'Số tờ khai', 'OrderNumber': 'Số thứ tự', 'DeparturePoint': 'Nơi đi', 'DestinationPoint': 'Nơi đến',
    'IsRain': 'Trời mưa', 'NCC': 'Nhà cung cấp', 'AssetID': 'Mã tài sản', 'AssetName': 'Tên tài sản', 'EquipID': 'Mã CCDC',
    'EquipName': 'Tên CCDC', 'Value': 'Giá trị', 'MonthUse': 'Số tháng', 'StartDate': 'Ngày bắt đầu', 'EndDate': 'Ngày kết thúc',
    'Total': 'Tổng', 'Debit': 'Nợ', 'Credit': 'Có', 'Balance': 'Số dư', 'PartID': 'Mã linh kiện', 'PartName': 'Tên linh kiện',
    'Receiver': 'Người nhận', 'PaymentTypeID': 'Hình thức thanh toán', 'PaymentTermID': 'Điều khoản thanh toán',
    'DebtDueDate': 'Hạn công nợ', 'RevAccID': 'TK doanh thu', 'VATAccID': 'TK thuế GTGT', 'CostAccID': 'TK giá vốn',
    'DiscountAccID': 'TK chiết khấu', 'ReceiptAccID': 'TK thu', 'Deliver': 'Người giao', 'Payer': 'Người nộp',
    'ObjectName2': 'Tên đối tượng (HĐ)', 'Address2': 'Địa chỉ (HĐ)', 'ShipAddress': 'Địa chỉ giao hàng',
    'InvoiceForm': 'Mẫu số HĐ', 'VATInvoiceID': 'Số HĐ GTGT', 'ItemGroupID': 'Nhóm hàng', 'ObjectGroupID': 'Nhóm đối tượng',
    'ObjectTypeID': 'Loại đối tượng', 'Fax': 'Fax', 'Website': 'Website', 'BankAccount': 'Tài khoản NH', 'Representative': 'Người đại diện',
    'Position': 'Chức vụ', 'Birthday': 'Ngày sinh', 'Sex': 'Giới tính', 'IDCard': 'CCCD', 'Specification': 'Quy cách',
    'MinStock': 'Tồn tối thiểu', 'MaxStock': 'Tồn tối đa', 'SalePrice': 'Giá bán', 'PurchasePrice': 'Giá mua',
    'ExportTax': 'Thuế XK', 'ImportTax': 'Thuế NK', 'Warranty': 'Bảo hành', 'WarrantyMonth': 'Số tháng bảo hành',
    'tdlap': 'Ngày lập', 'khhdon': 'Ký hiệu HĐ', 'shdon': 'Số HĐ', 'khmshdon': 'Mẫu số HĐ', 'tgtcthue': 'Tiền trước thuế',
    'tgtthue': 'Tiền thuế', 'tgtttbso': 'Tổng thanh toán', 'nbten': 'Tên người bán', 'nbdchi': 'Địa chỉ người bán', 'nbmst': 'MST người bán',
    'nmten': 'Tên người mua', 'nmdchi': 'Địa chỉ người mua', 'nmmst': 'MST người mua', 'tthai': 'Trạng thái HĐ', 'ttxly': 'Trạng thái xử lý',
    'tentthai': 'Trạng thái HĐ', 'tenttxly': 'Trạng thái xử lý', 'stt': 'STT', 'tchat': 'Tính chất', 'ten': 'Tên hàng hóa, dịch vụ',
    'dvtinh': 'ĐVT', 'sluong': 'Số lượng', 'dgia': 'Đơn giá', 'thtien': 'Thành tiền', 'ltsuat': 'Loại thuế suất', 'tsuat': 'Thuế suất',
    'tlckhau': '% chiết khấu', 'tienckhau': 'Tiền chiết khấu', 'tienthue': 'Tiền thuế', 'InvoiceID': 'Mã hóa đơn', 'SourceID': 'Loại chứng từ',
    'AgencyID': 'Đại lý', 'QRCODE': 'Mã QR', 'SL': 'Số lượng', 'OrderQuantity': 'SL đặt', 'OpID': 'Mã đơn vị', 'OpCode': 'Mã hiệu',
    'OpName': 'Tên đơn vị kinh doanh', 'UpLeveID': 'Đơn vị cấp trên', 'LevelCount': 'Cấp', 'ViTriHoTro': 'Vị trí hỗ trợ',
    'LocationID': 'Mã tỉnh/TP', 'LocationName': 'Tên tỉnh/TP', 'LocationGroup': 'Vùng', 'QuanHuyen': 'Quận/huyện', 'GhiChu': 'Ghi chú',
    'ZoneID': 'Khu vực', 'DiemSanPham': 'Điểm sản phẩm', 'AllocateID': 'Mã phân bổ', 'AllocateName': 'Nội dung phân bổ',
    'AllocateAmount': 'Số tiền phân bổ', 'OpenAllocate': 'Đã phân bổ đầu kỳ', 'ExpenseAccID': 'TK chi phí', 'PrepayAccountID': 'TK chờ phân bổ',
}
KIND_HINT = {'tgtcthue': 'money', 'tgtthue': 'money', 'tgtttbso': 'money', 'thtien': 'money', 'dgia': 'money', 'tienckhau': 'money',
             'tienthue': 'money', 'sluong': 'quantity', 'SL': 'quantity'}
WORD_VI = {
    'total': 'tổng', 'quantity': 'số lượng', 'qty': 'số lượng', 'real': 'thực tế', 'document': 'chứng từ', 'date': 'ngày',
    'pallet': 'pallet', 'barrel': 'thùng', 'weight': 'trọng lượng', 'package': 'kiện', 'damage': 'hư hỏng',
    'damaged': 'hư hỏng', 'description': 'mô tả', 'status': 'trạng thái', 'type': 'loại', 'name': 'tên', 'number': 'số',
    'no': 'số', 'note': 'ghi chú', 'notes': 'ghi chú', 'location': 'vị trí', 'image': 'hình ảnh', 'lot': 'lô',
    'expire': 'hạn', 'unit': 'đơn vị', 'price': 'đơn giá', 'amount': 'tiền', 'cost': 'chi phí', 'invoice': 'hóa đơn',
    'contract': 'hợp đồng', 'item': 'hàng', 'object': 'đối tượng', 'branch': 'chi nhánh', 'currency': 'loại tiền',
    'rate': 'tỷ lệ', 'order': 'đơn hàng', 'request': 'đề nghị', 'inbound': 'nhập', 'outbound': 'xuất',
    'transfer': 'điều chuyển', 'warehouse': 'kho', 'excess': 'thừa', 'lack': 'thiếu', 'inside': 'bên trong',
    'outside': 'bên ngoài', 'result': 'kết quả', 'test': 'kiểm tra', 'checker': 'người kiểm', 'random': 'xác suất',
    'set': 'bộ', 'code': 'mã', 'id': 'mã', 'detected': 'phát hiện', 'recorded': 'ghi nhận', 'datetime': 'thời gian',
    'awaiting': 'chờ', 'good': 'hàng', 'goods': 'hàng', 'shipment': 'lô hàng', 'payment': 'thanh toán', 'paid': 'đã trả',
    'tax': 'thuế', 'plan': 'kế hoạch', 'due': 'đến hạn', 'alert': 'cảnh báo', 'alerts': 'cảnh báo', 'part': 'linh kiện',
    'asset': 'tài sản', 'move': 'di chuyển', 'repair': 'sửa chữa', 'machine': 'máy', 'customer': 'khách hàng',
    'supplier': 'nhà cung cấp', 'employee': 'nhân viên', 'user': 'người dùng', 'group': 'nhóm', 'level': 'cấp',
    'approve': 'duyệt', 'approved': 'đã duyệt', 'confirm': 'xác nhận', 'reject': 'từ chối', 'reason': 'lý do',
    'value': 'giá trị', 'percent': 'phần trăm', 'discount': 'chiết khấu', 'vat': 'VAT', 'url': 'liên kết', 'link': 'liên kết',
    'from': 'từ', 'to': 'đến', 'start': 'bắt đầu', 'end': 'kết thúc', 'time': 'thời gian', 'year': 'năm', 'month': 'tháng',
    'day': 'ngày', 'days': 'số ngày', 'source': 'nguồn', 'target': 'đích', 'service': 'dịch vụ', 'accounting': 'kế toán',
    'tech': 'kỹ thuật', 'quality': 'chất lượng', 'control': 'kiểm soát', 'info': 'thông tin', 'event': 'sự kiện',
    'point': 'điểm', 'points': 'điểm', 'balance': 'số dư', 'gift': 'quà tặng', 'gifts': 'quà tặng', 'serial': 'serial',
    'model': 'model', 'country': 'quốc gia', 'origin': 'xuất xứ', 'phone': 'điện thoại', 'address': 'địa chỉ',
    'manager': 'quản lý', 'department': 'phòng ban', 'target2': 'chỉ tiêu', 'sales': 'doanh số', 'stock': 'tồn kho',
    'return': 'trả lại', 'handling': 'xử lý', 'cargo': 'hàng hóa', 'incoming': 'đến', 'approval': 'phê duyệt',
    'collect': 'thu thập', 'accept': 'chấp nhận', 'condition': 'tình trạng', 'is': '', 'by': 'theo', 'of': '',
    'acc': 'tài khoản', 'rev': 'doanh thu', 'debt': 'công nợ', 'term': 'kỳ hạn', 'receiver': 'người nhận', 'ref': 'tham chiếu',
    'doc': 'chứng từ', 'qr': 'QR', 'agent': 'đại lý', 'retail': 'bán lẻ', 'daily': 'đại lý', 'commission': 'hoa hồng',
    'bonus': 'thưởng', 'salary': 'lương', 'tax2': 'thuế', 'export': 'xuất khẩu', 'import': 'nhập khẩu', 'local': 'nội địa',
    'vendor': 'nhà cung cấp', 'buyer': 'người mua', 'seller': 'người bán', 'sign': 'ký', 'signed': 'đã ký', 'file': 'tệp',
}


def split_words(name):
    name = re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', name)
    name = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', name)
    return [w for w in re.split(r'[\s_]+', name) if w]


def humanize(field):
    if field in FIELD_VI:
        return FIELD_VI[field]
    words = split_words(field)
    if not words:
        return field
    low = [w.lower() for w in words]
    prefix, suffix = '', ''
    if low[0] in ('is', 'has'):
        low, words = low[1:], words[1:]
    if low and low[0] == 'total':
        prefix = 'Tổng '
        low, words = low[1:], words[1:]
    if 'by' in low:
        i = low.index('by')
        suffix = ' theo ' + ' '.join(WORD_VI.get(w, words[i + 1 + k]) for k, w in enumerate(low[i + 1:]))
        low, words = low[:i], words[:i]
    head = ''
    if low and low[-1] in ('id', 'code') and len(low) > 1:
        head = 'Mã '
        low, words = low[:-1], words[:-1]
    elif low and low[-1] == 'name' and len(low) > 1:
        head = 'Tên '
        low, words = low[:-1], words[:-1]
    elif low and low[-1] == 'date' and len(low) > 1:
        head = 'Ngày '
        low, words = low[:-1], words[:-1]
    core = ' '.join(WORD_VI.get(w, words[i]) for i, w in reversed(list(enumerate(low)))).strip()
    text = re.sub(r'\s+', ' ', (prefix + head + core + suffix)).strip()
    return (text[:1].upper() + text[1:]) if text else field


lyt_caps = collections.defaultdict(collections.Counter)
for rows in fcfg.values():
    for r in rows:
        if r['KeyID'].startswith('LYT'):
            p = (r['KeyValue'] or '').split(';')
            if len(p) > 7 and p[7].strip():
                lyt_caps[r['SubID']][p[7].replace(':', ';').strip()] += 1


lyt_local = collections.defaultdict(dict)
for fid_, rows_ in fcfg.items():
    for r in rows_:
        if r['KeyID'].startswith('LYT'):
            p = (r['KeyValue'] or '').split(';')
            if len(p) > 7 and p[7].strip():
                lyt_local[fid_][r['SubID']] = p[7].replace(':', ';').strip()


def caption(field, local=None, fid=None):
    """Thứ tự: nhãn riêng của form -> từ điển chuẩn -> nhãn gộp từ mọi form -> tự dịch tên cột."""
    if local:
        return local
    if fid and field in lyt_local.get(fid.upper(), {}):
        return lyt_local[fid.upper()][field]
    if field in FIELD_VI:
        return FIELD_VI[field]
    if field in lyt_caps:
        return lyt_caps[field].most_common(1)[0][0]
    return humanize(field)


# ---------------------------------------------------------------------------------------------------------------
# Kiểu cột và dữ liệu giả
# ---------------------------------------------------------------------------------------------------------------
SECRET_COL = re.compile(r'^(password|passwd|pwd|token|secret|api_?key)$', re.I)   # không bao giờ đưa vào mock
SYSTEM_HIDDEN = {'UserAutoID', 'SearchField', 'UID', 'LinkID', 'ParentID', 'rowguid', 'SSMA_TimeStamp', 'BackColor'}
AUDIT = {'UserCreate', 'DateCreate', 'UserUpdate', 'DateUpdate'}
MONEY_HINT = re.compile(r'(Amount|Price|Total|Cost|Tien|Value|Balance|Debit|Credit|Money|Fee|Phi)', re.I)
QTY_HINT = re.compile(r'(Quantity|Qty|SoLuong|Number)$', re.I)


def col_kind(c):
    t, n = c['data_type'], c['column_name']
    if n in KIND_HINT and t not in ('nvarchar', 'varchar', 'nchar', 'char'):
        return KIND_HINT[n]
    if t in ('bit',):
        return 'bool'
    if t in ('datetime', 'smalldatetime', 'date', 'datetime2'):
        return 'datetime' if re.search(r'(Time|ThoiGian|Recorded)', n) else 'date'
    if t in ('decimal', 'numeric', 'money', 'float', 'real', 'smallmoney'):
        if re.search(r'(Percent|Rate)', n):
            return 'percent' if 'Percent' in n else 'number'
        if MONEY_HINT.search(n):
            return 'money'
        if QTY_HINT.search(n):
            return 'quantity'
        return 'number'
    if t in ('int', 'bigint', 'smallint', 'tinyint'):
        if n == 'StatusID':
            return 'status'
        return 'number'
    if t in ('image', 'varbinary', 'binary', 'timestamp', 'uniqueidentifier', 'xml'):
        return 'skip'
    return 'text'


def decimals_for(kind):
    return {'money': 0, 'quantity': 2, 'number': 0, 'percent': 2}.get(kind, None)


COMPANIES = ['Công ty TNHH Thiết bị Y tế An Phát', 'Bệnh viện Đa khoa Minh Tâm', 'Phòng khám Đa khoa Hòa Bình',
             'Công ty CP Dược phẩm Thành Đạt', 'Trung tâm Y tế Quận 3', 'Công ty TNHH Vật tư Y khoa Bình Minh',
             'Bệnh viện Phụ sản Ánh Dương', 'Công ty CP Công nghệ Sinh học Việt Phát', 'Nhà thuốc Phúc Khang',
             'Công ty TNHH Thương mại Kỹ thuật Đông Á', 'Bệnh viện Mắt Sao Mai', 'Công ty CP Thiết bị Khoa học Tân Tiến',
             'Phòng xét nghiệm Hưng Thịnh', 'Công ty TNHH Medical Supply Sài Gòn', 'Bệnh viện Nhi Hạnh Phúc']
ITEMS = [('Máy đo huyết áp điện tử', 'Cái'), ('Bơm tiêm 5ml', 'Hộp'), ('Găng tay y tế không bột', 'Hộp'),
         ('Máy monitor theo dõi bệnh nhân', 'Bộ'), ('Kim luồn tĩnh mạch 22G', 'Cái'), ('Dây truyền dịch', 'Sợi'),
         ('Máy xét nghiệm sinh hóa', 'Bộ'), ('Hóa chất xét nghiệm Glucose', 'Hộp'), ('Khẩu trang y tế 4 lớp', 'Hộp'),
         ('Máy siêu âm xách tay', 'Bộ'), ('Bông y tế 1kg', 'Gói'), ('Ống nghiệm EDTA', 'Hộp'), ('Đầu dò siêu âm', 'Cái'),
         ('Máy điện tim 12 kênh', 'Bộ'), ('Nhiệt kế điện tử', 'Cái'), ('Que thử đường huyết', 'Hộp'),
         ('Máy thở không xâm nhập', 'Bộ'), ('Bộ dụng cụ phẫu thuật', 'Bộ'), ('Gạc vô trùng 10x10', 'Gói'),
         ('Cồn sát khuẩn 70 độ', 'Chai')]
PEOPLE = ['Nguyễn Văn An', 'Trần Thị Bích', 'Lê Hoàng Cường', 'Phạm Thu Dung', 'Hoàng Minh Đức', 'Vũ Thị Hà',
          'Đặng Quốc Huy', 'Bùi Thanh Lan', 'Đỗ Văn Minh', 'Ngô Thị Ngọc', 'Dương Văn Phúc', 'Lý Thị Quỳnh']
BRANCHES = [('HN', 'Hà Nội'), ('HCM', 'Hồ Chí Minh'), ('DN', 'Đà Nẵng')]
STORES = [('KHO-HN', 'Kho Hà Nội'), ('KHO-HCM', 'Kho Hồ Chí Minh'), ('KHO-DN', 'Kho Đà Nẵng'), ('KHO-BH', 'Kho bảo hành')]
CURRENCIES = [('VND', 'VND'), ('USD', 'USD'), ('EUR', 'EUR')]
ACCOUNTS = [('111', 'Tiền mặt'), ('112', 'Tiền gửi ngân hàng'), ('131', 'Phải thu của khách hàng'),
            ('1331', 'Thuế GTGT được khấu trừ'), ('152', 'Nguyên liệu, vật liệu'), ('153', 'Công cụ, dụng cụ'),
            ('156', 'Hàng hóa'), ('211', 'Tài sản cố định hữu hình'), ('214', 'Hao mòn TSCĐ'),
            ('242', 'Chi phí trả trước'), ('331', 'Phải trả cho người bán'), ('3331', 'Thuế GTGT phải nộp'),
            ('334', 'Phải trả người lao động'), ('338', 'Phải trả, phải nộp khác'), ('411', 'Vốn đầu tư của chủ sở hữu'),
            ('421', 'Lợi nhuận chưa phân phối'), ('511', 'Doanh thu bán hàng và cung cấp dịch vụ'),
            ('515', 'Doanh thu hoạt động tài chính'), ('632', 'Giá vốn hàng bán'), ('635', 'Chi phí tài chính'),
            ('641', 'Chi phí bán hàng'), ('642', 'Chi phí quản lý doanh nghiệp'), ('711', 'Thu nhập khác'),
            ('811', 'Chi phí khác'), ('911', 'Xác định kết quả kinh doanh')]
COSTCENTERS = [('KD', 'Phòng Kinh doanh'), ('KT', 'Phòng Kế toán'), ('KHO', 'Bộ phận Kho'), ('KTH', 'Phòng Kỹ thuật'),
               ('HC', 'Phòng Hành chính')]
STREETS = ['Lê Lợi', 'Trần Hưng Đạo', 'Nguyễn Huệ', 'Hai Bà Trưng', 'Lý Thường Kiệt', 'Điện Biên Phủ', 'Cách Mạng Tháng 8']
CITIES = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Cần Thơ', 'Hải Phòng']

LOOKUPS = {   # trường -> (file lookup, các trường điền kèm)
    'ObjectID': ('CF_ObjectTbl', ['ObjectName', 'Address', 'TaxCode']),
    'ItemID': ('CF_ItemTbl', ['ItemName', 'Unit', 'UnitID']),
    'EmployeeID': ('CF_EmployeeTbl', ['EmployeeName']),
    'ManagerID': ('CF_EmployeeTbl', []),
    'AccountID': ('CF_ChartAccTbl', []), 'DebitAccID': ('CF_ChartAccTbl', []), 'CreditAccID': ('CF_ChartAccTbl', []),
    'PayAccID': ('CF_ChartAccTbl', []), 'InvAccID': ('CF_ChartAccTbl', []),
    'CostCenterID': ('CF_CostCenterTbl', []),
}
SELECTS = {'BranchID': BRANCHES, 'StoreHouseID': STORES, 'StoreHouseID2': STORES, 'CurrencyID': CURRENCIES}


class Gen:
    def __init__(self, seed):
        self.r = random.Random(seed)

    def date(self, back=120):
        return TODAY - datetime.timedelta(days=self.r.randint(0, back))

    def value(self, field, kind, i, statuses=None, doc_prefix='CT', table=''):
        r, n = self.r, field
        if kind == 'status':
            s = statuses[(i * 7 + r.randint(0, 2)) % len(statuses)] if statuses else GENERIC_STATUS[i % 5]
            return s[0], s[1], s[2]
        if kind == 'bool':
            v = r.random() < 0.3
            return ('true' if v else 'false'), ('Có' if v else ''), None
        if kind in ('date', 'datetime'):
            d = self.date()
            if kind == 'datetime':
                dt = datetime.datetime.combine(d, datetime.time(r.randint(7, 18), r.choice([0, 15, 30, 45])))
                return dt.strftime('%Y-%m-%dT%H:%M:00'), dt.strftime('%d/%m/%Y %H:%M'), None
            return d.isoformat(), d.strftime('%d/%m/%Y'), None
        if kind == 'money':
            v = r.choice([1, 2, 5, 10, 25, 50]) * r.randint(10, 990) * 10000
            return str(v), f'{v:,}'.replace(',', '.'), None
        if kind == 'quantity':
            v = r.randint(1, 200)
            return str(v), str(v), None
        if kind == 'percent':
            v = r.choice([0, 5, 8, 10])
            return str(v), f'{v}', None
        if kind == 'number':
            if n == 'RateExchange':
                return '1', '1', None
            v = r.randint(1, 99)
            return str(v), str(v), None
        # text
        if n == 'DocumentID':
            v = f'{doc_prefix}{TODAY:%m%y}/{i + 1:04d}'
            return v, v, None
        if n in ('ObjectID',):
            v = f'KH{(i * 3) % len(COMPANIES) + 1:04d}'
            return v, v, None
        if n in ('ObjectName', 'NCC', 'CustomerName', 'SupplierName', 'nbten', 'nmten'):
            v = COMPANIES[(i * 3) % len(COMPANIES)]
            return v, v, None
        if n == 'ItemID':
            v = f'VT{(i * 7) % len(ITEMS) + 1:04d}'
            return v, v, None
        if n == 'ItemName':
            v = ITEMS[(i * 7) % len(ITEMS)][0]
            return v, v, None
        if n in ('Unit', 'UnitID'):
            v = ITEMS[(i * 7) % len(ITEMS)][1]
            return v, v, None
        if n in ('EmployeeID', 'ManagerID'):
            v = f'NV{i % len(PEOPLE) + 1:03d}'
            return v, v, None
        if n in ('EmployeeName', 'UserName', 'ContactName', 'Contact', 'SendTo', 'UserCreate', 'UserUpdate'):
            v = PEOPLE[(i * 5 + len(n)) % len(PEOPLE)]
            return v, v, None
        if n in SELECTS:
            v = SELECTS[n][i % len(SELECTS[n])]
            return v[0], v[1], None
        if n in ('AccountID', 'DebitAccID', 'CreditAccID', 'PayAccID', 'InvAccID'):
            v = ACCOUNTS[(i * 3 + len(n)) % len(ACCOUNTS)][0]
            return v, v, None
        if n == 'CostCenterID':
            v = COSTCENTERS[i % len(COSTCENTERS)][0]
            return v, v, None
        if n == 'Address':
            v = f'{r.randint(1, 250)} {r.choice(STREETS)}, {r.choice(CITIES)}'
            return v, v, None
        if n in ('Phone', 'Tel', 'Mobile'):
            v = f'09{r.randint(10000000, 99999999)}'
            return v, v, None
        if n == 'Email':
            v = f'lienhe{i + 1}@example.vn'
            return v, v, None
        if n == 'TaxCode':
            v = f'03{r.randint(10000000, 99999999)}'
            return v, v, None
        if n in ('InvoiceNo',):
            v = f'{r.randint(1, 9999):08d}'
            return v, v, None
        if n in ('Lot', 'LotNumber') or n.startswith('LotNumber'):
            v = f'L{TODAY:%y}{r.randint(100, 999)}'
            return v, v, None
        if re.search(r'(Notes|Memo|Description|Desc|Note|Reason|Comment)', n):
            v = r.choice(['', 'Giao hàng trong tuần', 'Theo hợp đồng số 12/2026', 'Hàng nhập khẩu', 'Khách yêu cầu xuất hóa đơn',
                          'Kiểm tra kỹ trước khi nhận', ''])
            return v, v, None
        if n.endswith('ID') or n.endswith('Code') or n.endswith('No'):
            v = f'{re.sub(r"[^A-Z]", "", n)[:3] or "MA"}{i + 1:03d}'
            return v, v, None
        if n.endswith('Name'):
            v = f'{humanize(n)} {i + 1}'
            return v, v, None
        v = f'{humanize(n)} {i + 1}' if r.random() < 0.6 else ''
        return v, v, None


# ---------------------------------------------------------------------------------------------------------------
# Khối HTML theo chuẩn
# ---------------------------------------------------------------------------------------------------------------
def a_btn(action, href, label, **attrs):
    extra = ''.join(f' {k.replace("_", "-")}="{e(v)}"' if v is not True else f' {k.replace("_", "-")}'
                    for k, v in attrs.items() if v not in (None, False))
    return f'<li><a data-action="{action}" href="{e(href)}"{extra}>{e(label)}</a></li>'


def s_btn(action, form_id, formaction, label, **attrs):
    extra = ''.join(f' {k.replace("_", "-")}="{e(v)}"' if v is not True else f' {k.replace("_", "-")}'
                    for k, v in attrs.items() if v not in (None, False))
    fattr = f' form="{e(form_id)}"' if form_id else ''
    return (f'<li><button type="submit"{fattr} formaction="{e(formaction)}" formmethod="post" '
            f'data-action="{action}"{extra}>{e(label)}</button></li>')


def toolbar(items):
    return '<menu data-erp="toolbar">\n  ' + '\n  '.join(items) + '\n</menu>'


def grid_html(grid_id, cols, rows, key_field=None, caption_text=None, editable=False, form_id=None,
              selectable='single', total_rows=None, col_sets=None, sort=None, footer=True, template_row=None):
    """cols: list of dict(field, caption, type, width, decimals, hidden, frozen, sum, editor, readonly, lookup)
       rows: list of dict(key, cells: {field: (raw, display, tone)}, tone)"""
    attrs = [f'data-erp="grid"', f'data-grid-id="{e(grid_id)}"']
    if key_field:
        attrs.append(f'data-key-field="{e(key_field)}"')
    attrs.append(f'data-selectable="{selectable}"')
    if editable:
        attrs.append('data-editable')
    if form_id:
        attrs.append(f'data-form="{e(form_id)}"')
    attrs.append(f'data-total-rows="{total_rows if total_rows is not None else len(rows)}"')
    if sort:
        attrs.append(f'data-sort="{e(sort)}"')
    out = [f'<table {" ".join(attrs)}>']
    if caption_text:
        out.append(f'<caption>{e(caption_text)}</caption>')
    out.append('<thead><tr>')
    for c in cols:
        a = [f'scope="col" data-field="{e(c["field"])}" data-type="{c["type"]}"']
        if c.get('width'):
            a.append(f'data-width="{c["width"]}"')
        if c.get('decimals') is not None:
            a.append(f'data-decimals="{c["decimals"]}"')
        for flag in ('hidden', 'frozen', 'wrap', 'required', 'readonly'):
            if c.get(flag):
                a.append(f'data-{flag}')
        if c.get('sum'):
            a.append(f'data-sum="{c["sum"]}"')
        if c.get('group'):
            a.append(f'data-group="{e(c["group"])}"')
        if editable and c.get('editor'):
            a.append(f'data-editor="{c["editor"]}"')
        if editable and c.get('lookup'):
            src, fill = c['lookup']
            a.append(f'data-lookup-src="{BASE}/lookups/{src}.html?q={{q}}"')
            if fill:
                a.append(f'data-lookup-fill="{",".join(fill)}"')
        out.append(f'<th {" ".join(a)}>{e(c["caption"])}</th>')
    out.append('</tr></thead>')
    out.append('<tbody>')
    for row in rows:
        ra = []
        if row.get('key') is not None:
            ra.append(f'data-key="{e(row["key"])}"')
        if row.get('tone'):
            ra.append(f'data-tone="{row["tone"]}"')
        cells = []
        for c in cols:
            raw, disp, tone = row['cells'].get(c['field'], ('', '', None))
            if c['type'] == 'status':
                inner = f'<data data-erp="status" value="{e(raw)}" data-tone="{tone or "neutral"}">{e(disp)}</data>'
            elif c['type'] == 'link' and row.get('href'):
                inner = f'<a href="{e(row["href"])}" data-target="tab">{e(disp)}</a>'
            elif c['type'] == 'bool':
                inner = 'Có' if raw == 'true' else ''
            else:
                inner = e(disp)
            ta = f' data-value="{e(raw)}"' if raw != disp or c['type'] in ('money', 'quantity', 'number', 'date', 'datetime', 'bool', 'percent') else ''
            cells.append(f'<td{ta}>{inner}</td>')
        out.append(f'<tr {" ".join(ra)}>' + ''.join(cells) + '</tr>')
    out.append('</tbody>')
    sums = [c for c in cols if c.get('sum') == 'sum']
    if footer and sums and rows:
        tds = []
        first = True
        for c in cols:
            if c.get('sum') == 'sum':
                total = sum(float(r['cells'].get(c['field'], ('0',))[0] or 0) for r in rows)
                disp = f'{total:,.0f}'.replace(',', '.') if c['type'] == 'money' else f'{total:g}'
                tds.append(f'<td data-field="{c["field"]}" data-value="{total:.0f}">{disp}</td>')
            elif first:
                tds.append('<td>Tổng cộng</td>')
                first = False
            else:
                tds.append('<td></td>')
        out.append('<tfoot><tr>' + ''.join(tds) + '</tr></tfoot>')
    out.append('</table>')
    if editable:
        for c in cols:
            if c.get('editor') == 'select':
                opts = c.get('options') or SELECTS.get(c['field']) or []
                out.append(f'<template data-erp="options" data-field="{e(c["field"])}">' +
                           ''.join(f'<option value="{e(v)}">{e(t)}</option>' for v, t in opts) + '</template>')
    if template_row is not None:
        out.append(f'<template data-erp="row-template" data-grid-id="{e(grid_id)}">{template_row}</template>')
    return '\n'.join(out)


def option_list(field, value, rng=None):
    opts = SELECTS.get(field) or []
    return ''.join(f'<option value="{e(v)}"{" selected" if v == value else ""}>{e(t)}</option>' for v, t in opts)


def field_html(fid, f, value=None, display=None, mode='view', idp='f'):
    """f: dict(field, caption, control, span, rows, row_start, readonly, required, decimals, lookup, options, gap)"""
    ctl = f['control']
    name = f['field']
    _id = f'{idp}-{slug(fid)}-{slug(name)}'
    ro = mode == 'view' or f.get('readonly')
    attrs = [f'data-erp="field"', f'data-control="{ctl}"', f'data-span="{f.get("span", 10)}"']
    if f.get('rows', 1) > 1:
        attrs.append(f'data-rows="{f["rows"]}"')
    if f.get('row_start'):
        attrs.append('data-row-start')
    if f.get('gap'):
        attrs.append(f'data-gap-after="{f["gap"]}"')
    if f.get('span_mobile'):
        attrs.append(f'data-span-mobile="{f["span_mobile"]}"')
    lab = f'<label for="{_id}">{e(f["caption"])}</label>'
    common = f'id="{_id}" name="{e(name)}"'
    flags = (' readonly' if ro and ctl not in ('select', 'checkbox', 'multiselect') else '') + \
            (' disabled' if ro and ctl in ('select', 'checkbox', 'multiselect') else '') + \
            (' required' if f.get('required') and not ro else '')
    v = '' if value is None else value
    if ctl in ('number', 'money', 'quantity', 'percent'):
        dec = f.get('decimals')
        ctrl = f'<input {common} inputmode="decimal" value="{e(v)}"{f" data-decimals={chr(34)}{dec}{chr(34)}" if dec is not None else ""}{flags}>'
    elif ctl == 'date':
        ctrl = f'<input {common} type="date" value="{e(v[:10] if v else "")}"{flags}>'
    elif ctl == 'datetime':
        ctrl = f'<input {common} type="datetime-local" value="{e(v[:16] if v else "")}"{flags}>'
    elif ctl == 'checkbox':
        ctrl = (f'<input type="hidden" name="{e(name)}" value="false"><input {common} type="checkbox" value="true"'
                f'{" checked" if v == "true" else ""}{flags}>')
    elif ctl == 'select':
        opts = option_list(name, v)
        if not opts and f.get('options'):
            opts = ''.join(f'<option value="{e(o[0])}"{" selected" if str(o[0]) == str(v) else ""}>{e(o[1])}</option>' for o in f['options'])
        ctrl = f'<select {common}{flags}><option value=""></option>{opts}</select>'
    elif ctl == 'multiselect':
        vs = set(str(v).split(',')) if v else set()
        opts = ''.join(f'<option value="{e(o[0])}"{" selected" if str(o[0]) in vs else ""}>{e(o[1])}</option>' for o in f.get('options') or [])
        ctrl = f'<select {common} multiple{flags}>{opts}</select>'
    elif ctl == 'lookup':
        src, fill = f['lookup']
        ctrl = (f'<input {common} value="{e(v)}" data-lookup-src="{BASE}/lookups/{src}.html?q={{q}}"'
                + (f' data-lookup-fill="{",".join(fill)}"' if fill else '') + f'{flags}>'
                + f'<output data-erp="lookup-text" for="{_id}">{e(display or "")}</output>')
    elif ctl == 'password':
        ctrl = f'<input {common} type="password" autocomplete="new-password" value=""{flags}>'
    elif ctl == 'textarea':
        ctrl = f'<textarea {common} rows="{f.get("rows", 2)}"{flags}>{e(v)}</textarea>'
    elif ctl == 'label':
        ctrl = f'<output id="{_id}" name="{e(name)}">{e(display or v)}</output>'
    elif ctl == 'button':
        act = f.get('button_action', 'custom')
        return (f'<div {" ".join(attrs)}><span></span>'
                f'<button type="submit" formaction="{BASE}/actions/custom-ok.html" formmethod="post" data-action="{act}"'
                f' data-icon="{f.get("icon", "")}"{" disabled" if mode != "view" and act == "custom" else ""}>{e(f["caption"])}</button></div>')
    else:
        ctrl = f'<input {common} value="{e(v)}"{flags}>'
    hint = f'<small data-erp="hint">{e(f["hint"])}</small>' if f.get('hint') else ''
    return f'<div {" ".join(attrs)}>{lab}{ctrl}{hint}</div>'


# ---------------------------------------------------------------------------------------------------------------
# Suy ra cấu trúc form
# ---------------------------------------------------------------------------------------------------------------
CTRL_MAP = {1: 'text', 2: 'select', 3: 'multiselect', 4: 'date', 5: 'number', 6: 'checkbox', 7: 'color', 20: 'radio',
            22: 'button', 23: 'group', 24: 'button', 26: 'button', 28: 'label', 30: 'html'}
UC_CAPTION = {'PrintButtonCtl': ('In phiếu', 'print'), 'ExecSQLWithParaButtonCtl': ('Thực hiện', 'custom'),
              'StatusButtonCtl': ('Chuyển trạng thái', 'custom'), 'ApproveButtonCtl': ('Duyệt', 'approve'),
              'WebLinkViewerCtl': ('Mở liên kết', 'custom'), 'EmailButtonCtl': ('Gửi email', 'custom'),
              'ImportExcelButtonCtl': ('Nhập Excel', 'import'), 'ShowFormButtonCtl': ('Mở màn hình', 'custom')}
TAB_ORDER = ['1', '2', '3', 'A', 'B', 'C']


def kind_to_control(field, kind, col=None):
    if field in LOOKUPS:
        return 'lookup'
    if field in SELECTS:
        return 'select'
    if kind == 'status':
        return 'select'
    return {'bool': 'checkbox', 'date': 'date', 'datetime': 'datetime', 'money': 'money', 'quantity': 'quantity',
            'number': 'number', 'percent': 'percent'}.get(kind) or (
        'textarea' if col and col['data_type'] in ('nvarchar', 'varchar', 'ntext') and (col['max_length'] in (-1,) or col['max_length'] >= 800) else 'text')


def master_fields(fid, table, statuses):
    """Trả về danh sách tab: [(tab_id, caption, [field dict...])]"""
    rows = cfg_of(fid)
    cols = {c['column_name']: c for c in table_cols(table)}
    lyt = [r for r in rows if re.fullmatch(r'LYT[123ABC]', r['KeyID'])]
    tabs = []
    if lyt:
        by_tab = collections.defaultdict(list)
        for r in lyt:
            by_tab[r['KeyID'][3:]].append(r)
        for t in TAB_ORDER:
            if t not in by_tab:
                continue
            cap_key = {'1': 'T1V', '2': 'T2V', '3': 'T3V', 'A': 'TAV', 'B': 'TBV', 'C': 'TCV'}[t]
            tcap = cfg_get(rows, cap_key) or ('Thông tin chung' if t == '1' else f'Thông tin {TAB_ORDER.index(t) + 1}')
            fl = []
            for r in sorted(by_tab[t], key=lambda r: (r['SubValue'] or '').zfill(4)):
                p = (r['KeyValue'] or '').split(';') + [''] * 21
                try:
                    ct = int(p[0] or 1)
                except ValueError:
                    ct = 1
                if p[18] == '1':
                    continue
                sub = r['SubID'] or ''
                try:
                    sx = int(p[1] or 3)
                except ValueError:
                    sx = 3
                try:
                    sy = int(p[2] or 1)
                except ValueError:
                    sy = 1
                span = 40 if sx in (99, 0) or sx > 40 else max(sx, 2)
                cap = p[7].replace(':', ';').strip()
                base = re.sub(r'_\d+$', '', sub)
                if ct in (22, 24, 26):
                    if base in ('AttachWebcamImageControlCtl', 'AttachImageControlCtl', 'AttachFileControlCtl'):
                        continue
                    c2, act = UC_CAPTION.get(base, (cap or 'Thực hiện', 'custom'))
                    fl.append(dict(field=sub, caption=cap or c2, control='button', span=max(span, 4), row_start=p[3] == '1',
                                   button_action=act, icon={'print': 'print', 'approve': 'approve'}.get(act, 'run')))
                    continue
                if ct == 23:
                    continue
                col = cols.get(sub)
                kind = col_kind(col) if col else 'text'
                if kind == 'skip' or SECRET_COL.match(sub):
                    continue
                control = CTRL_MAP.get(ct, 'text')
                if control == 'text' and sy > 1:
                    control = 'textarea'
                if control == 'number':
                    control = {'money': 'money', 'quantity': 'quantity', 'percent': 'percent'}.get(kind, 'number')
                if control == 'select' and sub in LOOKUPS:
                    control = 'lookup'
                if control in ('radio', 'color', 'html'):
                    control = 'text'
                if control == 'text' and kind in ('date', 'datetime'):
                    control = kind
                fd = dict(field=sub, caption=caption(sub, cap), control=control, span=span, rows=sy,
                          row_start=p[3] == '1', readonly=p[4] == '1', required=p[17] == '1',
                          decimals=decimals_for(kind if control != 'number' else 'number'), kind=kind,
                          gap=int(p[19]) if (p[19] or '').isdigit() and int(p[19]) > 0 else None,
                          span_mobile=int(p[20]) if (p[20] or '').isdigit() and 0 < int(p[20]) <= 4 else None)
                if control == 'lookup':
                    fd['lookup'] = LOOKUPS.get(sub, ('CF_ObjectTbl', []))
                if control == 'select' and sub == 'StatusID':
                    fd['options'] = [(s[0], s[1]) for s in statuses]
                fl.append(fd)
            if fl:
                tabs.append((t, tcap, fl))
        if tabs:
            return tabs
    # Không có LYT: suy từ cột của bảng
    fl = []
    for c in table_cols(table):
        n = c['column_name']
        kind = col_kind(c)
        if kind == 'skip' or n in SYSTEM_HIDDEN or n in AUDIT or SECRET_COL.match(n):
            continue
        control = kind_to_control(n, kind, c)
        span = {'date': 6, 'datetime': 8, 'checkbox': 6, 'money': 8, 'quantity': 6, 'number': 6, 'percent': 5,
                'textarea': 40, 'lookup': 14, 'select': 8}.get(control, 10)
        if n.endswith('Name') or n in ('Address', 'Memo', 'Description'):
            span = 20
        fd = dict(field=n, caption=caption(n), control=control, span=span, row_start=False, kind=kind,
                  decimals=decimals_for(kind), required=n in ('DocumentDate', 'ObjectID') or (not c['is_nullable'] and n != 'StatusID' and kind != 'bool'),
                  readonly=n in ('DocumentID', 'TotalAmount', 'BaseTotal', 'StatusID'))
        if control == 'lookup':
            fd['lookup'] = LOOKUPS[n]
        if control == 'select' and n == 'StatusID':
            fd['options'] = [(s[0], s[1]) for s in statuses]
        if control == 'textarea':
            fd['rows'] = 2
        fl.append(fd)
        if len(fl) >= 24:
            break
    return [('1', 'Thông tin chung', fl)]


def grid_cols_for(fid, slot, table, editable=False, max_visible=12):
    rows = cfg_of(fid)
    tcols = table_cols(table)
    by = {c['column_name']: c for c in tcols}
    order = [x for x in (cfg_get(rows, slot, 'GD2') or '').split(';') if x]
    hide = set(x for x in (cfg_get(rows, slot, 'HDE') or '').split(';') if x)
    lock = set(x for x in (cfg_get(rows, slot, 'LCK') or '').split(';') if x)
    wrap = set(x for x in (cfg_get(rows, slot, 'WWC') or '').split(';') if x)
    names = order + [c['column_name'] for c in tcols if c['column_name'] not in order]
    # nhóm cột (T1CS: 11=caption, 12=cột)
    groups = {}
    for r in rows:
        if r['KeyID'] == f'{slot}CS' and (r['SubID'] or '').endswith('2'):
            gcap = cfg_get(rows, f'{slot}CS', (r['SubID'] or '')[:-1] + '1')
            for x in (r['KeyValue'] or '').split(';'):
                if x:
                    groups[x] = gcap
    out = []
    visible = 0
    for n in names:
        c = by.get(n)
        kind = col_kind(c) if c else ('status' if n == 'StatusName' else 'text')
        if kind == 'skip' or SECRET_COL.match(n):
            continue
        if n == 'StatusID' and 'StatusName' in names:
            continue
        if n == 'StatusName':
            kind = 'status'
        hidden = n in hide or n in SYSTEM_HIDDEN or n in AUDIT or visible >= max_visible or (slot != 'T0' and n == 'DocumentID')
        col = dict(field=n, caption=caption(n, fid=fid), type=kind, decimals=decimals_for(kind), hidden=hidden,
                   wrap=n in wrap, readonly=n in lock, group=groups.get(n))
        col['width'] = {'date': 95, 'datetime': 130, 'money': 120, 'quantity': 80, 'number': 70, 'percent': 60,
                        'bool': 60, 'status': 120}.get(kind) or (240 if n.endswith('Name') or n in ('Address', 'Memo', 'Notes', 'Description') else 110)
        if kind == 'money':
            col['sum'] = 'sum'
        if kind == 'quantity':
            col['sum'] = 'sum'
        if editable and not col['readonly']:
            col['editor'] = 'lookup' if n in LOOKUPS else ('select' if n in SELECTS else
                                                          {'money': 'money', 'quantity': 'number', 'number': 'number', 'percent': 'number',
                                                           'date': 'date', 'datetime': 'date', 'bool': 'checkbox', 'status': 'none'}.get(kind, 'text'))
            if n in LOOKUPS:
                col['lookup'] = LOOKUPS[n]
        out.append(col)
        if not hidden:
            visible += 1
        if len(out) >= max_visible + 18:   # giới hạn cột ẩn để mock gọn
            break
    if out:
        for c in out:
            if not c['hidden']:
                c['frozen'] = True
                break
    return out


def gen_rows(g, cols, n, key_field, statuses, prefix, href_fn=None, offset=0):
    rows = []
    for i in range(offset, offset + n):
        cells = {}
        for c in cols:
            f = c['field']
            kind = c['type'] if c['type'] != 'link' else c.get('base_type', 'text')
            if f == 'StatusName':
                kind = 'status'
            if f == key_field and kind in ('number', 'quantity'):
                cells[f] = (str(i + 1), str(i + 1), None)   # khóa số: duy nhất, tăng dần
                continue
            cells[f] = g.value(f, kind, i, statuses, prefix)
        # thành tiền = số lượng × đơn giá nếu có
        if 'Quantity' in cells and 'UnitPrice' in cells and 'Amount' in cells:
            q, p = float(cells['Quantity'][0] or 0), float(cells['UnitPrice'][0] or 0)
            p = round(p / 1000) * 10
            a = int(q * p)
            cells['UnitPrice'] = (str(int(p)), f'{int(p):,}'.replace(',', '.'), None)
            cells['Amount'] = (str(a), f'{a:,}'.replace(',', '.'), None)
        key = cells.get(key_field, (None,))[0] if key_field else None
        if key_field and (key is None or key == ''):
            key = f'{TODAY:%y%m%d}{i + 1:019d}'[:25]
        row = dict(key=key, cells=cells)
        st = next((cells[c['field']] for c in cols if c['type'] == 'status'), None)
        if st and st[2] == 'danger':
            row['tone'] = 'danger'
        if href_fn:
            row['href'] = href_fn(i)
        rows.append(row)
    return rows


# ---------------------------------------------------------------------------------------------------------------
# Màn hình
# ---------------------------------------------------------------------------------------------------------------
written = collections.Counter()
screen_index = []      # (menu_id, caption, screen_id, kind, url)


def screen_open(sid, form_type, mode, key, title, menu_id=None, para=''):
    a = [f'data-erp="screen"', f'data-screen-id="{e(sid)}"', f'data-form-type="{form_type}"', f'data-mode="{mode}"',
         f'data-screen-key="{e(key)}"']
    if para:
        a.append(f'data-para="{e(para)}"')
    if menu_id:
        a.append(f'data-menu-id="{e(menu_id)}"')
    return f'<section {" ".join(a)}>\n<h1>{e(title)}</h1>'


def filter_form(action, fields_html):
    return (f'<form data-erp="filter" method="get" action="{e(action)}">\n' + '\n'.join(fields_html) +
            '\n<button type="submit" data-action="find">Lọc</button>\n</form>')


def std_filter(sid, action, with_dates=True, with_branch=True):
    fs = []
    if with_dates:
        fs.append(field_html(sid, dict(field='FromDate', caption='Từ ngày', control='date', span=6), (TODAY.replace(day=1)).isoformat(), mode='edit', idp='flt'))
        fs.append(field_html(sid, dict(field='ToDate', caption='Đến ngày', control='date', span=6), TODAY.isoformat(), mode='edit', idp='flt'))
    if with_branch:
        fs.append(field_html(sid, dict(field='BranchID', caption='Chi nhánh', control='select', span=8), '', mode='edit', idp='flt'))
    fs.append(f'<div data-erp="field" data-control="search" data-span="14"><label for="flt-{slug(sid)}-q">Tìm nhanh</label>'
              f'<input id="flt-{slug(sid)}-q" name="q" type="search" placeholder="Nhập mã, tên, số chứng từ…"></div>')
    return filter_form(action, fs)


def build_list(menu, form):
    """FormType LIST / LISTEDIT: danh mục dạng lưới, sửa trực tiếp."""
    sid = form['FormID']
    table = form['TableName']
    g = Gen(sid)
    title = menu['CaptionVN'] or form['CaptionVN']
    pk = form['PrimaryKey'] or 'UserAutoID'
    statuses = statuses_for(cfg_get(cfg_of(sid), 'T0', 'TN2'))
    big = table.upper() == 'CF_OBJECTTBL'
    n = 1000 if big else 18
    url = f'{BASE}/screens/{sid}.html'
    for mode in ('view', 'edit'):
        editable = mode == 'edit'
        cols = grid_cols_for(sid, 'T0', table, editable=editable)
        if not cols:
            cols = [dict(field=pk, caption=caption(pk), type='text', width=120), dict(field='Notes', caption='Ghi chú', type='text', width=240)]
        rows = gen_rows(g if mode == 'view' else Gen(sid), cols, n, pk, statuses, 'DM')
        form_id = f'rec-{slug(sid)}'
        parts = [screen_open(sid, form['FormType'] if form['FormType'] in ('LIST', 'LISTEDIT') else 'LIST', mode, sid, title, menu['MenuID'])]
        if mode == 'view':
            parts.append(toolbar([
                a_btn('edit', f'{BASE}/screens/{sid}.edit.html', 'Sửa', data_target='self', data_shortcut='F3'),
                a_btn('reload', url, 'Nạp lại', data_target='self'),
                a_btn('export', f'{BASE}/actions/export.html', 'Xuất Excel', data_target='_blank'),
                a_btn('print', f'{BASE}/print/CS_ReceiptReport.html', 'In'),
            ]))
            parts.append(std_filter(sid, url, with_dates=False, with_branch='BranchID' in [c['field'] for c in cols]))
            parts.append(grid_html('T0', cols, rows, pk, None, selectable='multi', total_rows=2345 if big else n))
            if big:   # danh mục lớn: BE phân trang 1.000 dòng/trang (chuẩn 11.5)
                parts.append(f'<nav data-erp="pager" data-page="1" data-page-size="1000" data-total="2345" aria-label="Phân trang">'
                             f'<span>Trang 1 / 3 · dòng 1–1.000 / 2.345</span> <a rel="next" href="{url}?page=2" data-target="self">Sau</a> '
                             f'<a rel="last" href="{url}?page=3" data-target="self">Cuối</a></nav>')
        else:
            parts.append(toolbar([
                s_btn('save', form_id, f'{BASE}/screens/{sid}.saved.html', 'Lưu', data_shortcut='Ctrl+S'),
                a_btn('cancel', url, 'Hủy', data_target='self'),
            ]))
            parts.append(f'<form data-erp="record" id="{form_id}" method="post" action="{BASE}/screens/{sid}.saved.html" data-key-field="{e(pk)}">{TOKEN}<input type="hidden" name="__version" value="{TODAY.isoformat()}T09:15:00.000"></form>')
            tmpl_cells = ''.join('<td></td>' for _ in cols)
            parts.append(grid_html('T0', cols, rows[:60], pk, None, editable=True, form_id=form_id, selectable='multi',
                                   total_rows=n, template_row=f'<tr data-key="">{tmpl_cells}</tr>'))
        parts.append('</section>')
        name = f'screens/{sid}.html' if mode == 'view' else f'screens/{sid}.edit.html'
        write(name, page(title, '\n'.join(parts)))
        written['screen'] += 1
    # sau khi lưu: màn xem + thông báo
    saved = open(os.path.join(OUT, 'screens', f'{sid}.html'), encoding='utf-8').read().replace(
        '</h1>', '</h1>\n<div data-erp="messages"><p data-erp="message" data-msg-type="success">Đã lưu thay đổi (mock).</p></div>', 1)
    write(f'screens/{sid}.saved.html', saved)
    return url


def detail_slots(fid, table_detail_fallback=None):
    rows = cfg_of(fid)
    slots = []
    for s in ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9']:
        tn = cfg_get(rows, s, 'TN')
        if tn:
            slots.append((s, tn, cfg_get(rows, s, 'DCP') or f'Chi tiết {s[1]}', cfg_get(rows, s, 'PK') or 'UserAutoID',
                          cfg_get(rows, s, 'RDO') == '1'))
    if not slots and table_detail_fallback:
        for i, tn in enumerate([t for t in table_detail_fallback if t], start=1):
            slots.append((f'T{i}', tn, 'Chi tiết' if i == 1 else f'Chi tiết {i}', 'UserAutoID', False))
    return slots


def guess_pk(table):
    names = [c['column_name'] for c in table_cols(table)]
    for n in names:
        if n.endswith('ID') and n != 'UserAutoID':
            return n
    return names[0] if names else 'UserAutoID'


def build_edit(menu, sid, title, table, details, prefix, para='', pk=None):
    """Chứng từ master–detail: danh sách (find) + bản ghi xem/sửa/thêm."""
    g = Gen(sid + para)
    if not pk:
        pk = 'DocumentID' if any(c['column_name'] == 'DocumentID' for c in table_cols(table)) else (
            (forms.get(sid.upper()) or {}).get('PrimaryKey') or guess_pk(table))
    statuses = statuses_for(cfg_get(cfg_of(sid), 'T0', 'TN2'))
    tabs = master_fields(sid, table, statuses)
    slots = detail_slots(sid, details)
    rec_dir = f'records/{slug(sid + ("_" + para if para else ""))}'
    list_url = f'{BASE}/screens/{slug(sid + ("_" + para if para else ""))}.html'
    n_records = 3
    # --- danh sách chứng từ
    gcols = grid_cols_for(sid, 'T0', table, max_visible=9)
    if not any(c['field'] == pk for c in gcols):
        gcols.insert(0, dict(field=pk, caption=caption(pk), type='text', width=120))
    for c in gcols:
        if c['field'] == pk:
            c['base_type'] = c['type']   # giữ kiểu gốc để sinh giá trị đúng (khóa số vẫn là số)
            c['type'] = 'link'
            c['hidden'] = False
    lrows = gen_rows(g, gcols, 24, pk, statuses, prefix,
                     href_fn=lambda i: f'{BASE}/{rec_dir}/{i + 1}.html' if i < n_records else None)
    master_vals = [r['cells'] for r in lrows[:n_records]]
    parts = [screen_open(sid, 'EDIT', 'find', sid + (f'_{para}' if para else ''), title, menu['MenuID'], para)]
    parts.append(toolbar([
        a_btn('new', f'{BASE}/{rec_dir}/new.html', 'Thêm', data_target='tab', data_shortcut='F2'),
        a_btn('reload', list_url, 'Nạp lại', data_target='self'),
        a_btn('export', f'{BASE}/actions/export.html', 'Xuất Excel', data_target='_blank'),
    ]))
    parts.append(std_filter(sid, list_url))
    parts.append(grid_html('T0', gcols, lrows, pk, None, total_rows=24, sort=f'{pk}:desc'))
    parts.append('</section>')
    write(f'screens/{slug(sid + ("_" + para if para else ""))}.html', page(title, '\n'.join(parts)))
    written['screen'] += 1

    # --- bản ghi
    def record(idx, mode, extra_msg=None, confirm=False):
        gi = Gen(f'{sid}{idx}{mode}')
        vals = {}
        if mode != 'new':
            mv = master_vals[idx - 1]
            for t in tabs:
                for f in t[2]:
                    if f['control'] == 'button':
                        continue
                    vals[f['field']] = mv.get(f['field']) or gi.value(f['field'], f.get('kind', 'text'), idx - 1, statuses, prefix)
            key = vals.get(pk, (f'{prefix}{TODAY:%m%y}/{idx:04d}',))[0]
        else:
            key = ''
            for t in tabs:
                for f in t[2]:
                    if f['field'] == 'DocumentDate':
                        vals[f['field']] = (TODAY.isoformat(), TODAY.strftime('%d/%m/%Y'), None)
                    elif f['field'] == 'DocumentID':
                        vals[f['field']] = (f'{prefix}{TODAY:%m%y}/0025', '', None)
                    elif f['field'] == 'StatusID':
                        vals[f['field']] = (str(statuses[0][0]), statuses[0][1], None)
                    elif f['field'] in ('BranchID', 'CurrencyID'):
                        vals[f['field']] = gi.value(f['field'], 'text', 0)
        rid = f'rec-{slug(sid)}-{idx if mode != "new" else "new"}'
        skey = f'{sid}:{key}' if key else f'{sid}:new'
        ttl = f'{title} — {key}' if key else f'{title} — Thêm mới'
        base = f'{BASE}/{rec_dir}'
        p = [screen_open(sid, 'EDIT', 'view' if mode == 'view' else mode, skey, ttl, menu['MenuID'], para)]
        if extra_msg:
            p.append(extra_msg)
        if mode == 'view':
            items = [a_btn('new', f'{base}/new.html', 'Thêm', data_target='tab', data_shortcut='F2'),
                     a_btn('edit', f'{base}/{idx}.edit.html' if idx == 1 else f'{base}/1.edit.html', 'Sửa', data_target='self', data_shortcut='F3'),
                     s_btn('delete', rid, f'{BASE}/actions/deleted.html', 'Xóa', data_confirm='Xóa chứng từ này?'),
                     a_btn('copy', f'{base}/new.html', 'Sao chép', data_target='tab'),
                     a_btn('print', f'{BASE}/print/AR_InvoiceReport.html', 'In', data_shortcut='Ctrl+P'),
                     a_btn('attach', f'{BASE}/actions/attachments.html', 'Đính kèm', data_target='dialog'),
                     a_btn('prev', f'{base}/{max(idx - 1, 1)}.html', 'Trước', data_target='self'),
                     a_btn('next', f'{base}/{min(idx + 1, n_records)}.html', 'Sau', data_target='self'),
                     a_btn('reload', f'{base}/{idx}.html', 'Nạp lại', data_target='self')]
        else:
            save_to = f'{base}/1.confirm.html' if confirm else (f'{base}/1.saved.html' if mode == 'edit' else f'{base}/1.saved.html')
            items = [s_btn('save', rid, save_to, 'Lưu', data_shortcut='Ctrl+S'),
                     s_btn('save-new', rid, f'{base}/new.html', 'Lưu & thêm'),
                     a_btn('cancel', f'{base}/1.html' if mode == 'edit' else list_url, 'Hủy', data_target='self')]
        p.append(toolbar(items))
        p.append(f'<form data-erp="record" id="{rid}" method="post" action="{e(items[0] if False else save_to if mode != "view" else base + "/1.saved.html")}" '
                 f'data-key-field="{e(pk)}" data-key="{e(key)}">')
        p.append(TOKEN)
        if mode == 'edit':
            p.append(f'<input type="hidden" name="__version" value="{TODAY.isoformat()}T09:15:00.000">')
        for t_id, tcap, fl in tabs:
            p.append(f'<fieldset data-erp="tab" data-tab-id="{t_id}"><legend>{e(tcap)}</legend>')
            for f in fl:
                raw, disp = '', ''
                if f['field'] in vals:
                    raw, disp = vals[f['field']][0], vals[f['field']][1]
                    if f['control'] == 'lookup':
                        if f['field'] == 'ObjectID':
                            disp = COMPANIES[[x for x in range(len(COMPANIES))][(int(re.sub(r'\D', '', raw) or 1) - 1) % len(COMPANIES)]] if raw else ''
                        elif f['field'] == 'ItemID':
                            disp = ITEMS[(int(re.sub(r'\D', '', raw) or 1) - 1) % len(ITEMS)][0] if raw else ''
                        elif f['field'] in ('EmployeeID', 'ManagerID'):
                            disp = PEOPLE[(int(re.sub(r'\D', '', raw) or 1) - 1) % len(PEOPLE)] if raw else ''
                        elif 'Acc' in f['field'] or f['field'] == 'AccountID':
                            disp = dict(ACCOUNTS).get(raw, '')
                        elif f['field'] == 'CostCenterID':
                            disp = dict(COSTCENTERS).get(raw, '')
                p.append(field_html(rid, f, raw, disp, 'view' if mode == 'view' else 'edit'))
            p.append('</fieldset>')
        p.append('</form>')
        if slots:
            p.append('<section data-erp="tabs">')
            for s, tn, dcap, dpk, rdo in slots:
                editable = mode != 'view' and not rdo
                dcols = grid_cols_for(sid, s, tn, editable=editable, max_visible=11)
                if not dcols:
                    continue
                cnt = 0 if mode == 'new' else Gen(f'{sid}{s}{idx}').r.randint(2, 7)
                drows = gen_rows(Gen(f'{sid}{s}{idx}'), dcols, cnt, dpk, statuses_for(None), prefix)
                tmpl = None
                if editable:
                    tmpl = '<tr data-key="">' + ''.join(
                        f'<td data-value="{e(str(TODAY) if c["type"] == "date" else ("0" if c["type"] in ("money", "quantity", "number") else ""))}"></td>'
                        for c in dcols) + '</tr>'
                p.append(f'<section data-erp="tab-panel" data-tab-id="{s}" data-title="{e(dcap)}" data-badge="{cnt}">')
                p.append(grid_html(s, dcols, drows, dpk, None, editable=editable, form_id=rid if editable else None,
                                   selectable='multi' if editable else 'single', template_row=tmpl))
                p.append('</section>')
            p.append('</section>')
        p.append('</section>')
        return page(ttl, '\n'.join(p))

    for i in range(1, n_records + 1):
        write(f'{rec_dir}/{i}.html', record(i, 'view'))
    confirm = sid.upper() in ('AR_INVOICEFRM',)
    write(f'{rec_dir}/1.edit.html', record(1, 'edit', confirm=confirm))
    write(f'{rec_dir}/new.html', record(1, 'new'))
    ok = '<div data-erp="messages"><p data-erp="message" data-msg-type="success">Đã lưu chứng từ (mock).</p></div>'
    write(f'{rec_dir}/1.saved.html', record(1, 'view', extra_msg=ok))
    if confirm:
        write(f'{rec_dir}/1.confirm.html', page('Xác nhận', (
            f'<form data-erp="confirm" method="post" action="{BASE}/{rec_dir}/1.saved.html">'
            '<p data-erp="message" data-msg-type="warning" data-legacy-type="0">Mặt hàng VT0001 xuất vượt số tồn kho hiện có (tồn: 12, xuất: 15). '
            'Bạn vẫn muốn lưu?</p><input type="hidden" name="__confirm" value="mock-stock-check">' + TOKEN +
            '<button type="submit" name="__answer" value="yes" data-action="confirm-yes">Vẫn lưu</button>'
            '<button type="submit" name="__answer" value="no" data-action="confirm-no">Hủy</button></form>')))
    written['record'] += n_records + 3
    return list_url


def build_report(menu):
    sid = menu['FormName']
    title = menu['CaptionVN']
    sp = (sid + 'Stp').upper()
    ps = params.get(sp, [])
    g = Gen(sid)
    url = f'{BASE}/reports/{sid}.html'
    fs = []
    for p in ps:
        n = p['parameter_name'].lstrip('@')
        t = p['data_type']
        if n.lower() in ('username', 'user', 'langid', 'moduleid'):
            continue
        if t in ('datetime', 'date', 'smalldatetime'):
            v = TODAY.replace(day=1).isoformat() if n.lower().startswith('from') else TODAY.isoformat()
            fs.append(field_html(sid, dict(field=n, caption=caption(n), control='date', span=6), v, mode='edit', idp='rp'))
        elif n == 'Template':
            fs.append(field_html(sid, dict(field=n, caption='Mẫu in', control='select', span=10,
                                           options=[('', 'Mẫu mặc định'), ('2', 'Mẫu chi tiết'), ('3', 'Mẫu tổng hợp')]), '', mode='edit', idp='rp'))
        elif n in SELECTS:
            fs.append(field_html(sid, dict(field=n, caption=caption(n), control='select', span=8), '', mode='edit', idp='rp'))
        elif n in LOOKUPS:
            fs.append(field_html(sid, dict(field=n, caption=caption(n), control='lookup', span=12, lookup=LOOKUPS[n]), '', '', mode='edit', idp='rp'))
        elif t == 'bit':
            fs.append(field_html(sid, dict(field=n, caption=caption(n), control='checkbox', span=6), 'false', mode='edit', idp='rp'))
        elif t in ('int', 'decimal', 'numeric', 'float', 'money'):
            fs.append(field_html(sid, dict(field=n, caption=caption(n), control='number', span=6), '', mode='edit', idp='rp'))
        else:
            fs.append(field_html(sid, dict(field=n, caption=caption(n), control='text', span=10), '', mode='edit', idp='rp'))
        if len(fs) >= 10:
            break
    if not fs:
        fs.append(field_html(sid, dict(field='FromDate', caption='Từ ngày', control='date', span=6), TODAY.replace(day=1).isoformat(), mode='edit', idp='rp'))
        fs.append(field_html(sid, dict(field='ToDate', caption='Đến ngày', control='date', span=6), TODAY.isoformat(), mode='edit', idp='rp'))
    # kết quả mẫu: cột chung của báo cáo chứng từ
    rcols = [dict(field='DocumentID', caption='Số chứng từ', type='text', width=120, frozen=True),
             dict(field='DocumentDate', caption='Ngày', type='date', width=95),
             dict(field='ObjectName', caption='Đối tượng', type='text', width=260),
             dict(field='ItemName', caption='Mặt hàng', type='text', width=220),
             dict(field='Quantity', caption='Số lượng', type='quantity', decimals=0, width=90, sum='sum'),
             dict(field='Amount', caption='Thành tiền', type='money', decimals=0, width=130, sum='sum'),
             dict(field='Notes', caption='Ghi chú', type='text', width=200)]
    rrows = gen_rows(g, rcols, 30, 'DocumentID', None, 'BC')
    body = [screen_open(sid, 'REPORT', 'view', sid, title, menu['MenuID'])]
    body.append(filter_form(url, fs).replace('>Lọc</button>', '>Xem báo cáo</button>'))
    body.append('<section data-erp="report-result">')
    body.append('<div data-erp="messages"><p data-erp="message" data-msg-type="info">Dữ liệu mẫu (mock) — cột báo cáo thật do SP '
                f'{e(sid)}Stp quyết định.</p></div>')
    body.append(grid_html('R0', rcols, rrows, 'DocumentID', title, selectable='none'))
    body.append(toolbar([a_btn('export', f'{BASE}/actions/export.html', 'Xuất Excel', data_target='_blank', download=True),
                         a_btn('print', f'{BASE}/actions/print.html', 'In / PDF', data_target='_blank')]))
    body.append('</section></section>')
    write(f'reports/{sid}.html', page(title, '\n'.join(body)))
    written['report'] += 1
    return url


def build_custom(menu, note):
    sid = menu['FormName']
    title = menu['CaptionVN']
    body = [screen_open(sid, 'CUSTOM', 'view', sid, title, menu['MenuID'], menu.get('Para') or ''),
            toolbar([a_btn('reload', f'{BASE}/screens/{slug(sid)}.html', 'Nạp lại', data_target='self')]),
            f'<div data-erp="messages"><p data-erp="message" data-msg-type="info">{e(note)}</p></div>', '</section>']
    write(f'screens/{slug(sid)}.html', page(title, '\n'.join(body)))
    written['custom'] += 1
    return f'{BASE}/screens/{slug(sid)}.html'


# ---------------------------------------------------------------------------------------------------------------
# Màn còn lại: (1) suy bảng nguồn từ tên form / loại chứng từ, (2) mock viết tay cho màn hệ thống & xử lý
# ---------------------------------------------------------------------------------------------------------------
TABLE_OVERRIDE = {   # form -> (bảng master, [bảng chi tiết], tiền tố, khóa chính)
    'AR_STOCKINPUTFRM': ('IV_InputTbl', ['IV_InputDetailTbl'], 'PN', None),
    'AR_STOCKOUTFRM': ('IV_OutputTbl', ['IV_OutputDetailTbl'], 'PX', None),
    'AR_CHIEUKHAUHOPDONGFRM': ('AR_ChietKhauHopDongTbl', ['AR_ChietKhauHopDongDetailTbl'], 'KM', None),
    'AR_OPLISTFRM': ('AR_OpListTbl', ['AR_OpListEmployeeTbl', 'AR_OpListDetailTbl'], 'OP', 'OpID'),
    'AR_STANDARDPRICEZONEFRM': ('AR_PriceTbl', ['AR_PriceDetailTbl'], 'BG', None),
    'AR_STANDARDPRICE2017FRM': ('AR_PriceTbl', ['AR_PriceDetailTbl', 'AR_PriceObjectTbl'], 'BG', None),
    'LOCATIONLISTFRM': ('CF_LocationTbl', ['CF_LocationDetailTbl'], 'TT', 'LocationID'),
    'AG_XUATKHOBANLEORDERFRM': ('AG_XuatKhoCuaHangTbl', ['AG_XuatKhoCuaHangDetailTbl'], 'XL', None),
    'AG_SUAQRCODEDAILYFRM': ('AG_XuatKhoDeleteTbl', ['AG_XuatKhoDeleteDetailTbl'], 'QR', None),
    'GJ_INVOICEINFRM': ('GJ_InvoiceInTbl', ['GJ_InvoiceInDetailTbl'], 'HD', 'InvoiceID'),
    'GJ_INVOICEOUTFRM': ('GJ_InvoiceOutTbl', ['GJ_InvoiceOutDetailTbl'], 'HD', 'InvoiceID'),
    'GJ_ALLOCATESETUPFRM': ('GJ_AllocateSetupTbl', ['GJ_AllocatePeriodSetupTbl'], 'PB', 'AllocateID'),
}
NO_RESOLVE = {'IV_UNITCOSTPROCESSFRM'}   # tên form khớp nhầm bảng (CF_UnitTbl) — dùng mock viết tay


def real_name(table):
    tc = table_cols(table)
    return tc[0]['object_name'] if tc else table


def detail_of(table):
    b = re.sub(r'Tbl$', '', table, flags=re.I)
    for c in (b + 'DetailTbl', b + 'DetailsTbl'):
        if table_cols(c):
            return [real_name(c)]
    return []


def doc_prefix(fn, words_):
    p = cfg_get(cfg_of(fn), 'DPR')
    if p:
        return p
    ini = ''.join(w[0] for w in words_ if w[:1].isalpha()).upper()
    if len(ini) < 2 and words_:
        ini = words_[0][:2].upper()
    return ini[:3] or 'CT'


def resolve_tables(fn, para=''):
    """Trả (bảng master, [chi tiết], tiền tố, khóa) hoặc None."""
    u = fn.upper()
    if u in NO_RESOLVE:
        return None
    if u in TABLE_OVERRIDE:
        t, d, pre, pk = TABLE_OVERRIDE[u]
        return (real_name(t), [real_name(x) for x in d if table_cols(x)], pre, pk) if table_cols(t) else None
    dt = doc_types.get((fn + ('_' + para if para else '')).upper()) or doc_types.get(u)
    if dt and table_cols(dt.get('TableName')):
        t = real_name(dt['TableName'])
        d = [real_name(dt['TableDetail'])] if dt.get('TableDetail') and table_cols(dt['TableDetail']) else detail_of(t)
        return t, d, dt.get('PreFix') or 'CT', None
    base = re.sub(r'(List)?Frm$', '', fn, flags=re.I)
    pre, _, rest = base.partition('_')
    if not rest:
        return None
    rest = re.sub(r'_?QRCode$', '', rest, flags=re.I)
    w = re.findall(r'[A-Z][a-z0-9]*|[a-z0-9]+|[A-Z]+(?![a-z])', rest)
    for k in range(len(w), 0, -1):
        stem = ''.join(w[:k])
        for s in dict.fromkeys([stem, re.sub(r'\d+$', '', stem)]):
            for cand in (f'{pre}_{s}Tbl', f'{pre}_{s}sTbl', f'{s}Tbl', f'CF_{s}Tbl'):
                if table_cols(cand):
                    t = real_name(cand)
                    return t, detail_of(t), doc_prefix(fn, w), None
    return None


# ---- khối dựng chung cho mock viết tay -------------------------------------------------------------------------
EDITOR_OF = {'money': 'money', 'quantity': 'number', 'number': 'number', 'percent': 'number', 'date': 'date',
             'datetime': 'date', 'bool': 'checkbox', 'status': 'none', 'text': 'text', 'link': 'none'}


def col(field, cap, type='text', width=None, **kw):
    d = dict(field=field, caption=cap, type=type, decimals=decimals_for(type))
    d['width'] = width or {'date': 100, 'datetime': 135, 'money': 130, 'quantity': 90, 'number': 80, 'percent': 70,
                           'bool': 86, 'status': 130}.get(type, 140)
    if type == 'money':
        d['sum'] = 'sum'
    d.update(kw)
    return d


def fv(type, v):
    """Giá trị Python -> (raw bất biến, chữ hiển thị, tone)."""
    if isinstance(v, tuple):
        return tuple(str(x) if i == 0 else x for i, x in enumerate(v)) + ((None,) if len(v) == 2 else ())
    if v is None or v == '':
        return ('', '', None)
    if type == 'money':
        n = int(round(v))
        return (str(n), f'{n:,}'.replace(',', '.'), None)
    if type in ('quantity', 'number', 'percent'):
        s = f'{v:g}' if isinstance(v, float) else str(v)
        return (s, s.replace('.', ','), None)
    if type == 'date':
        return (v.isoformat(), v.strftime('%d/%m/%Y'), None)
    if type == 'datetime':
        return (v.strftime('%Y-%m-%dT%H:%M:00'), v.strftime('%d/%m/%Y %H:%M'), None)
    if type == 'bool':
        return ('true', 'Có', None) if v else ('false', '', None)
    return (str(v), str(v), None)


def mkrows(cols, data, key=None):
    out = []
    for i, d in enumerate(data):
        cells = {c['field']: fv(c['type'], d.get(c['field'])) for c in cols}
        k = d.get(key) if key else None
        if isinstance(k, tuple):
            k = k[0]
        row = dict(key=(str(k) if k not in (None, '') else str(i + 1)) if key else None, cells=cells)
        for a in ('tone', 'href'):
            if d.get('_' + a):
                row[a] = d['_' + a]
        out.append(row)
    return out


def msgs(*items):
    return '<div data-erp="messages">' + ''.join(
        f'<p data-erp="message" data-msg-type="{t}">{e(m)}</p>' for t, m in items) + '</div>'


def F(field, cap, control='text', span=10, **kw):
    d = dict(field=field, caption=cap, control=control, span=span)
    d.update(kw)
    return d


def screen_name(menu):
    return slug(menu['FormName'] + ('_' + menu['Para'] if menu.get('Para') else ''))


def put_screen(menu, name, form_type, mode, parts, key=None):
    sid, title = menu['FormName'], menu['CaptionVN']
    body = [screen_open(sid, form_type, mode, key or sid, title, menu['MenuID'], menu.get('Para') or '')]
    body += [p for p in parts if p]
    body.append('</section>')
    write(f'screens/{name}.html', page(title, '\n'.join(body)))
    written['curated'] += 1
    return f'{BASE}/screens/{name}.html'


def sel_filter(name, fields):
    """Thanh lọc GET về chính màn hình, fields: list field dict (luôn sửa được)."""
    fs = [field_html(name, f, f.get('value', ''), f.get('display', ''), mode='edit', idp='flt') for f in fields]
    return filter_form(f'{BASE}/screens/{name}.html', fs)


def edit_cols(cols):
    out = []
    for c in cols:
        c2 = dict(c)
        if not c.get('readonly') and 'editor' not in c:
            if c['field'] in LOOKUPS and c['type'] == 'text':
                c2['editor'], c2['lookup'] = 'lookup', LOOKUPS[c['field']]
            elif c.get('options') or c['field'] in SELECTS:
                c2['editor'] = 'select'
            else:
                c2['editor'] = EDITOR_OF.get(c['type'], 'text')
        out.append(c2)
    return out


def panels_html(panels, editable=False, form_id=None, add_row=True):
    """panels: list (grid_id, tiêu đề, cols, data, key[, caption]). Một panel: lưới trần; nhiều panel: tab."""
    html_ = []
    for p in panels:
        gid, title, cols, data, key = p[:5]
        cap = p[5] if len(p) > 5 else None
        rows = mkrows(cols, data, key)
        if editable:
            tmpl = ('<tr data-key="">' + ''.join('<td></td>' for _ in cols) + '</tr>') if add_row else None
            g = grid_html(gid, edit_cols(cols), rows, key, cap, editable=True, form_id=form_id, selectable='multi', template_row=tmpl)
        else:
            g = grid_html(gid, cols, rows, key, cap, selectable='multi')
        html_.append((gid, title, len(rows), g))
    if len(html_) == 1:
        return html_[0][3]
    return ('<section data-erp="tabs">' + ''.join(
        f'<section data-erp="tab-panel" data-tab-id="{e(gid)}" data-title="{e(t)}" data-badge="{n}">{g}</section>'
        for gid, t, n, g in html_) + '</section>')


def grid_screen(menu, panels, *, form_type='LISTEDIT', editable=True, filt=None, tools=(), notes=(), add_row=True,
                sel_tools=()):
    """Màn lưới: xem (+ sửa trực tiếp + sau khi lưu). sel_tools: nút POST áp cho các dòng đang chọn."""
    name = screen_name(menu)
    url = f'{BASE}/screens/{name}.html'
    act_id = f'act-{name}'
    if editable:   # lưới sửa được cần khóa dòng: thêm cột khóa ẩn
        panels = [p if p[4] else (p[0], p[1], [col('UserAutoID', 'ID', 'number', hidden=True)] + p[2],
                                  [dict(d, UserAutoID=i + 1) for i, d in enumerate(p[3])], 'UserAutoID') + tuple(p[5:])
                  for p in panels]
    tb = []
    if editable:
        tb.append(a_btn('edit', f'{BASE}/screens/{name}.edit.html', 'Sửa', data_target='self', data_shortcut='F3'))
    for action, label, icon_, confirm_ in sel_tools:
        tb.append(s_btn(action, act_id, f'{BASE}/actions/custom-ok.html', label, data_icon=icon_, data_confirm=confirm_,
                        data_requires_selection=True))
    tb += list(tools)
    tb += [a_btn('reload', url, 'Nạp lại', data_target='self'),
           a_btn('export', f'{BASE}/actions/export.html', 'Xuất Excel', data_target='_blank')]
    need_act = sel_tools or any(f'form="{act_id}"' in t for t in tools)
    act_form = f'<form data-erp="record" id="{act_id}" method="post" action="{BASE}/actions/custom-ok.html">{TOKEN}</form>' if need_act else ''
    view = [toolbar(tb), msgs(*notes) if notes else '', filt or '', act_form, panels_html(panels)]
    put_screen(menu, name, form_type, 'view', view)
    if editable:
        fid = f'rec-{name}'
        saved = f'{BASE}/screens/{name}.saved.html'
        ed = [toolbar([s_btn('save', fid, saved, 'Lưu', data_shortcut='Ctrl+S'), a_btn('cancel', url, 'Hủy', data_target='self')]),
              f'<form data-erp="record" id="{fid}" method="post" action="{saved}">{TOKEN}'
              f'<input type="hidden" name="__version" value="{TODAY.isoformat()}T09:15:00.000"></form>',
              panels_html(panels, editable=True, form_id=fid, add_row=add_row)]
        put_screen(menu, f'{name}.edit', form_type, 'edit', ed)
        put_screen(menu, f'{name}.saved', form_type, 'view', [msgs(('success', 'Đã lưu thay đổi (mock).'))] + view)
    return url


def fields_block(name, tabs, values, mode):
    out = []
    for tid, tcap, fl in tabs:
        out.append(f'<fieldset data-erp="tab" data-tab-id="{e(tid)}"><legend>{e(tcap)}</legend>')
        for f in fl:
            v = values.get(f['field'], '')
            raw, disp = (v[0], v[1]) if isinstance(v, tuple) else (v, v)
            out.append(field_html(name, f, raw, disp, mode))
        out.append('</fieldset>')
    return out


def record_screen(menu, tabs, values, *, tools=(), notes=(), below=None):
    """Màn thiết lập một bản ghi: xem / sửa / đã lưu."""
    name = screen_name(menu)
    url = f'{BASE}/screens/{name}.html'
    rid = f'rec-{name}'
    saved = f'{BASE}/screens/{name}.saved.html'

    def render(mode, extra=None):
        if mode == 'view':
            tb = [a_btn('edit', f'{BASE}/screens/{name}.edit.html', 'Sửa', data_target='self', data_shortcut='F3')]
            tb += [s_btn(a, rid, f'{BASE}/actions/custom-ok.html', lab, data_icon=ic) for a, lab, ic in tools]
            tb.append(a_btn('reload', url, 'Nạp lại', data_target='self'))
        else:
            tb = [s_btn('save', rid, saved, 'Lưu', data_shortcut='Ctrl+S'), a_btn('cancel', url, 'Hủy', data_target='self')]
        p = [extra, toolbar(tb), msgs(*notes) if notes and mode == 'view' else '',
             f'<form data-erp="record" id="{rid}" method="post" action="{saved}" data-key-field="ID" data-key="1">', TOKEN]
        if mode == 'edit':
            p.append(f'<input type="hidden" name="__version" value="{TODAY.isoformat()}T09:15:00.000">')
        p += fields_block(name, tabs, values, mode)
        p.append('</form>')
        if below and mode == 'view':
            p.append(below)
        return p
    put_screen(menu, name, 'CUSTOM', 'view', render('view'))
    put_screen(menu, f'{name}.edit', 'CUSTOM', 'edit', render('edit'))
    put_screen(menu, f'{name}.saved', 'CUSTOM', 'view', render('view', msgs(('success', 'Đã lưu thiết lập (mock).'))))
    return url


def process_screen(menu, fields, values, runs, *, result=None, notes=(), legend='Tham số'):
    """Màn xử lý: form tham số + nút chạy (POST) + lưới kết quả.
       runs: list (action, nhãn, icon, câu xác nhận, hậu tố trang kết quả, thông báo xong)."""
    name = screen_name(menu)
    url = f'{BASE}/screens/{name}.html'
    rid = f'rec-{name}'

    def render(done_msg):
        p = [msgs(('success', done_msg)) if done_msg else '']
        tb = [s_btn(a, rid, f'{BASE}/screens/{name}.{suf}.html', lab, data_icon=ic, data_confirm=cf)
              for a, lab, ic, cf, suf, _ in runs]
        tb.append(a_btn('reload', url, 'Nạp lại', data_target='self'))
        p.append(toolbar(tb))
        if notes and not done_msg:
            p.append(msgs(*notes))
        p.append(f'<form data-erp="record" id="{rid}" method="post" action="{BASE}/screens/{name}.{runs[0][4]}.html">{TOKEN}')
        p += fields_block(name, [('1', legend, fields)], values, 'edit')
        p.append('</form>')
        if result:
            cap, cols, data, key = result
            p.append(grid_html('R0', cols, mkrows(cols, data, key), key, cap if done_msg else f'{cap} — lần chạy gần nhất',
                               selectable='single'))
        return p
    put_screen(menu, name, 'CUSTOM', 'view', render(None))
    for a, lab, ic, cf, suf, done in runs:
        put_screen(menu, f'{name}.{suf}', 'CUSTOM', 'view', render(done))
    return url


# ---- dữ liệu dùng chung ------------------------------------------------------------------------------------------
def ascii_vi(s):
    import unicodedata
    s = s.replace('Đ', 'D').replace('đ', 'd')
    return ''.join(ch for ch in unicodedata.normalize('NFD', s) if unicodedata.category(ch) != 'Mn')


def login_of(name):
    parts = ascii_vi(name).lower().split()
    return parts[-1] + ''.join(x[0] for x in parts[:-1])


def month_end(y, m):
    return (datetime.date(y + (m == 12), m % 12 + 1, 1) - datetime.timedelta(days=1))


PERIODS_2026 = [(f'2026{m:02d}', f'Kỳ {m:02d}/2026', datetime.date(2026, m, 1), month_end(2026, m)) for m in range(1, 13)]
PERIOD_OPTS = [(p[0], p[1]) for p in PERIODS_2026]
USER_GROUPS = [('ADMIN', 'Quản trị hệ thống', ''), ('GIAMDOC', 'Ban giám đốc', ''), ('KETOAN', 'Kế toán', 'HN'),
               ('KETOAN-HCM', 'Kế toán chi nhánh HCM', 'HCM'), ('THUQUY', 'Thủ quỹ', 'HN'), ('KHO', 'Thủ kho', ''),
               ('MUAHANG', 'Mua hàng', 'HN'), ('KINHDOANH', 'Kinh doanh', ''), ('KYTHUAT', 'Kỹ thuật – bảo hành', ''),
               ('CSKH', 'Chăm sóc khách hàng', 'HCM'), ('DAILY', 'Đại lý (Web)', ''), ('NHANSU', 'Hành chính – nhân sự', 'HN')]
GROUP_OPTS = [(g[0], g[1]) for g in USER_GROUPS]
BRANCH_NAME = dict(BRANCHES)
USERS = [('admin', 'Quản trị hệ thống', 'Admin', 'ADMIN', '', '')] + [
    (login_of(n), n, n.split()[-1], USER_GROUPS[(i * 5 + 2) % len(USER_GROUPS)][0], BRANCHES[i % 3][0], f'NV{i + 1:03d}')
    for i, n in enumerate(PEOPLE)]


def br(code):
    return (code, BRANCH_NAME.get(code, '(Tất cả)'), None) if code else ('', '', None)


def B(field, cap, value=False, span=13):
    return F(field, cap, 'checkbox', span), ('true' if value else 'false')


# ---- 1. Hệ thống -------------------------------------------------------------------------------------------------
def c_user_groups(menu):
    cols = [col('UserGroupID', 'Mã nhóm', width=120, frozen=True), col('UserGroupName', 'Tên nhóm', width=260),
            col('BranchID', 'Chi nhánh', width=130), col('UserCount', 'Số người dùng', 'number', readonly=True),
            col('IsDisable', 'Ngừng dùng', 'bool')]
    cnt = collections.Counter(u[3] for u in USERS)
    data = [dict(UserGroupID=g, UserGroupName=n, BranchID=br(b), UserCount=cnt.get(g, 0), IsDisable=g == 'NHANSU')
            for g, n, b in USER_GROUPS]
    perm = next((r for r in menu_rows if r['FormName'] == 'NguoiDungPhanQuyenFrm'), None)
    tools = [a_btn('custom', f'{BASE}/screens/NguoiDungPhanQuyenFrm.html', 'Phân quyền nhóm', data_icon='key', data_target='tab')] if perm else []
    return grid_screen(menu, [('T0', 'Nhóm', cols, data, 'UserGroupID')], tools=tools,
                       notes=[('info', 'Nhóm người dùng (SY_UserGroup). Lưu nhóm sẽ đồng bộ ma trận quyền (SY_Update_Permission): menu mới mặc định được truy cập.')])


def c_users(menu):
    g = Gen('users')
    cols = [col('UserName', 'Tên đăng nhập', width=130, frozen=True), col('HoTen', 'Họ tên', width=200),
            col('TenNgan', 'Tên ngắn', width=100), col('UserGroupID', 'Nhóm', width=170, options=GROUP_OPTS),
            col('BranchID', 'Chi nhánh', width=120), col('EmployeeID', 'Mã nhân viên', width=110),
            col('StoreHouseID', 'Kho mặc định', width=140), col('Manager', 'Quản lý', 'bool'),
            col('Disable', 'Ngừng dùng', 'bool'), col('LastLogin', 'Đăng nhập gần nhất', 'datetime', readonly=True)]
    gname = dict(GROUP_OPTS)
    data = []
    for i, (u, n, short, grp, b, emp) in enumerate(USERS):
        last = datetime.datetime.combine(TODAY - datetime.timedelta(days=g.r.randint(0, 20)), datetime.time(g.r.randint(7, 17), g.r.choice([5, 20, 40])))
        data.append(dict(UserName=u, HoTen=n, TenNgan=short, UserGroupID=(grp, gname[grp], None), BranchID=br(b), EmployeeID=emp,
                         StoreHouseID=STORES[i % 3] + (None,) if i else ('', '', None), Manager=grp in ('ADMIN', 'GIAMDOC', 'KETOAN'),
                         Disable=i == 9, LastLogin=last))
    return grid_screen(menu, [('T0', 'Người dùng', cols, data, 'UserName')],
                       sel_tools=[('custom', 'Đặt lại mật khẩu', 'key', 'Đặt lại mật khẩu cho người dùng đang chọn? Người dùng phải đổi mật khẩu ở lần đăng nhập sau.')],
                       filt=sel_filter(screen_name(menu), [F('BranchID', 'Chi nhánh', 'select', 8), B('ShowDisabled', 'Hiện người dùng ngừng dùng')[0]]),
                       notes=[('info', 'Mật khẩu không bao giờ hiển thị hay gửi về trình duyệt; chỉ đặt lại qua nút “Đặt lại mật khẩu”.')])


PERM_FLAGS = [('IsRun', 'Truy cập'), ('IsAdd', 'Thêm'), ('IsUpdate', 'Sửa'), ('IsDelete', 'Xóa'), ('isManager', 'Manager'),
              ('isAdmin', 'Admin'), ('isAutoLock', 'Tự khóa'), ('isHideAmount', 'Ẩn số tiền'), ('isExportExcel', 'Xuất Excel'),
              ('isLockDoc', 'Khóa CT'), ('isUnLockDoc', 'Mở khóa CT')]


def perm_screen(menu, items, flags):
    g = Gen('perm' + menu['FormName'])
    cols = [col('MenuID', 'Mã menu', width=95, frozen=True, readonly=True), col('MenuName', 'Chức năng', width=330, readonly=True)]
    cols += [col(f, c, 'bool', width=78) for f, c in flags]
    data = []
    for mid, cap, level, is_group in items:
        d = dict(MenuID=mid, MenuName=('  ' * max(level - 1, 0)) + cap)   # em-space: không bị gộp khoảng trắng
        run = is_group or g.r.random() < 0.85
        for j, (f, _) in enumerate(flags):
            d[f] = run if f == 'IsRun' else (run and not is_group and g.r.random() < (0.7 if j < 4 else 0.15))
        data.append(d)
    name = screen_name(menu)
    filt = sel_filter(name, [F('UserGroupID', 'Nhóm người dùng', 'select', 12, options=GROUP_OPTS, value='KETOAN'),
                             F('ModuleID', 'Phân hệ', 'select', 10, options=[('', '(Tất cả)')] + [(r['MenuID'], r['CaptionVN']) for r in menu_rows if r['Level'] == '1' and r['EffectiveEnabled'] == '1'][:14])])
    tools = [a_btn('copy', f'{BASE}/actions/copy-permission.html', 'Sao chép quyền…', data_target='dialog')]
    return grid_screen(menu, [('T0', 'Quyền', cols, data, 'MenuID')], filt=filt, tools=tools, add_row=False,
                       notes=[('info', 'Ma trận quyền nhóm × menu. Nhóm ADMIN luôn có toàn quyền (chống tự khóa). Đánh dấu dòng nhóm menu để áp cho mọi chức năng con.')])


def c_permissions(menu):
    rows = sorted([r for r in menu_rows if r['EffectiveEnabled'] == '1'], key=lambda r: r['MenuID'])[:140]
    return perm_screen(menu, [(r['MenuID'], r['CaptionVN'], int(r['Level'] or 1), not r['FormName']) for r in rows], PERM_FLAGS)


def c_permissions_web(menu):
    web = [('WA01', 'Trang tổng quan', 1, True), ('WA0101', 'Bảng điều khiển', 2, False), ('WA0102', 'Thông báo', 2, False),
           ('WA02', 'Bán hàng', 1, True), ('WA0201', 'Đơn đặt hàng', 2, False), ('WA0202', 'Duyệt đơn hàng', 2, False),
           ('WA0203', 'Đề nghị thu tiền', 2, False), ('WA0204', 'Bảng giá', 2, False), ('WA0205', 'Tồn kho khả dụng', 2, False),
           ('WA03', 'Khách hàng', 1, True), ('WA0301', 'Danh sách khách hàng', 2, False), ('WA0302', 'Yêu cầu thêm khách hàng', 2, False),
           ('WA0303', 'Hợp đồng tham gia', 2, False), ('WA0304', 'Đổi điểm / trả thưởng', 2, False),
           ('WA04', 'Thị trường', 1, True), ('WA0401', 'Kế hoạch đi tuyến', 2, False), ('WA0402', 'Báo cáo ngày', 2, False),
           ('WA0403', 'Check-in khách hàng', 2, False), ('WA05', 'Đại lý', 1, True), ('WA0501', 'Nhập kho đại lý (QR)', 2, False),
           ('WA0502', 'Xuất bán lẻ (QR)', 2, False), ('WA0503', 'Tra cứu mã QR', 2, False)]
    return perm_screen(menu, web, PERM_FLAGS[:6])


def c_fiscal(menu):
    cols = [col('PeriodID', 'Mã kỳ', width=90, frozen=True, readonly=True), col('PeriodName', 'Tên kỳ', width=150),
            col('PeriodName2', 'Tên kỳ (EN)', width=150), col('QuarterID', 'Quý', width=80, readonly=True),
            col('FromDate', 'Từ ngày', 'date'), col('ToDate', 'Đến ngày', 'date'), col('PeriodNo', 'Số thứ tự', 'number', readonly=True),
            col('isUse', 'Sử dụng', 'bool'), col('isLock', 'Đã khóa sổ', 'bool', readonly=True)]
    data = [dict(PeriodID=p, PeriodName=n, PeriodName2=f'Period {i + 1:02d}/2026', QuarterID=f'2026Q{i // 3 + 1}', FromDate=a, ToDate=b,
                 PeriodNo=i + 1, isUse=True, isLock=i < 9) for i, (p, n, a, b) in enumerate(PERIODS_2026)]
    filt = sel_filter(screen_name(menu), [F('YearID', 'Năm tài chính', 'select', 8, options=[('2025', '2025'), ('2026', '2026'), ('2027', '2027')], value='2026')])
    tools = [a_btn('new', f'{BASE}/actions/fiscal-new-year.html', 'Khai báo năm mới…', data_target='dialog')]
    return grid_screen(menu, [('T0', 'Kỳ kế toán', cols, data, 'PeriodID')], filt=filt, tools=tools, add_row=False,
                       notes=[('info', 'Năm 2026: 4 quý, 12 kỳ (SY_Year / SY_Quarter / SY_Period). Kỳ hiện hành luôn theo tháng của ngày máy chủ.')])


def c_setup(menu):
    sel_check = [('NoCheck', 'Không kiểm tra'), ('Warning', 'Cảnh báo, vẫn cho lưu'), ('Cancel', 'Không cho lưu')]
    cost = [('AVG', 'Bình quân cuối kỳ'), ('AVGS', 'Bình quân cuối kỳ theo kho'), ('AVGD', 'Bình quân di động'),
            ('AVGDS', 'Bình quân di động theo kho'), ('LOT', 'Đích danh theo lô'), ('FIFO', 'Nhập trước xuất trước')]
    t1 = [F('COM1', 'Tên công ty', span=40), F('COM2', 'Tên tiếng Anh', span=20), F('ShortName', 'Tên viết tắt', span=10),
          F('TaxCode', 'Mã số thuế', span=10, row_start=True), F('ComPhone', 'Điện thoại', span=10), F('ComEmail', 'Email', span=10),
          F('ComWeb', 'Website', span=10), F('ComAddress', 'Địa chỉ', span=40), F('Director', 'Giám đốc', span=20),
          F('ChiefAccountant', 'Kế toán trưởng', span=20)]
    t2 = [F('CheckStockOut', 'Xuất vượt tồn kho', 'select', 13, options=sel_check), F('CheckCashOut', 'Chi vượt tồn quỹ', 'select', 13, options=sel_check),
          F('DocumentMask', 'Mẫu số chứng từ', span=14)]
    vals = {'COM1': 'CÔNG TY CỔ PHẦN DEMO MEDCOM', 'COM2': 'MEDCOM DEMO JOINT STOCK COMPANY', 'ShortName': 'MEDCOM DEMO',
            'TaxCode': '0300000000', 'ComPhone': '028 3800 0000', 'ComEmail': 'info@example.vn', 'ComWeb': 'www.example.vn',
            'ComAddress': '12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh', 'Director': PEOPLE[4], 'ChiefAccountant': PEOPLE[1],
            'CheckStockOut': 'Warning', 'CheckCashOut': 'Cancel', 'DocumentMask': '{Prefix}{MM}{YY}/{0000}'}
    for f, cap, v in [('CheckStockDate', 'Kiểm tra tồn theo ngày chứng từ', True), ('CheckCostCenter', 'Bắt buộc nhập bộ phận', False),
                      ('CheckCost', 'Bắt buộc nhập khoản mục phí', False), ('isLotDate', 'Quản lý lô / hạn dùng', True),
                      ('isDiscountVoucher', 'Dùng phiếu chiết khấu', False), ('isShowApproveDoc', 'Hiện chứng từ chờ duyệt', True),
                      ('isManagerCanEditDoc', 'Manager được sửa chứng từ người khác', True), ('isManagerNotApproveDoc', 'Manager không được duyệt', False),
                      ('isManagerNotDeApproveDoc', 'Manager không được bỏ duyệt', False), ('isReportPrintDate', 'In ngày in trên báo cáo', True),
                      ('SkipNoInvoice', 'Bỏ qua chứng từ không hóa đơn', False)]:
        fd, val = B(f, cap, v)
        t2.append(fd)
        vals[f] = val
    t3 = [F('DashboardTime', 'Làm mới dashboard (phút)', 'number', 10), F('OverDeptDay', 'Cảnh báo nợ quá hạn (ngày)', 'number', 10),
          F('OverLotDay', 'Cảnh báo lô sắp hết hạn (ngày)', 'number', 10)]
    vals.update(DashboardTime='5', OverDeptDay='30', OverLotDay='90')
    for f, cap, v in [('isManagerNotExcel', 'Manager không được xuất Excel', False), ('isUserNotExcel', 'Người dùng không được xuất Excel', True),
                      ('DisableTabMenu', 'Tắt menu dạng tab', False), ('DisableRecentMenu', 'Tắt menu gần đây', False),
                      ('FullLogDefault', 'Ghi nhật ký đầy đủ (XML bản ghi)', False)]:
        fd, val = B(f, cap, v)
        t3.append(fd)
        vals[f] = val
    t4 = [F('AutoBackupPath', 'Thư mục sao lưu tự động', span=20), F('AutoBackupTime', 'Chu kỳ sao lưu (phút)', 'number', 10),
          F('AutoBackupDay', 'Giữ số bản sao lưu', 'number', 10), F('AutoDownLoadURL', 'URL tải bản sao lưu', span=20),
          F('LinkServer', 'Linked server', span=10), F('LinkDatabase', 'CSDL liên kết', span=10)]
    vals.update(AutoBackupPath='D:\\Backup\\ERP', AutoBackupTime='60', AutoBackupDay='7')
    t5 = [F('PeriodID', 'Kỳ bắt đầu hạch toán', 'select', 10, options=PERIOD_OPTS), F('BalancePeriodID', 'Kỳ nhập số dư đầu', 'select', 10, options=PERIOD_OPTS),
          F('StartDate', 'Ngày bắt đầu sử dụng', 'date', 8), F('CostMethod', 'Phương pháp tính giá xuất', 'select', 12, options=cost)]
    vals.update(PeriodID='202601', BalancePeriodID='202601', StartDate='2026-01-01', CostMethod='AVG')
    tabs = [('1', 'Thông tin công ty', t1), ('2', 'Kiểm soát chứng từ', t2), ('3', 'Giao diện & xuất dữ liệu', t3),
            ('4', 'Sao lưu & liên kết', t4), ('5', 'Kỳ & giá vốn', t5)]
    return record_screen(menu, tabs, vals, notes=[('info', 'Tham số hệ thống (SY_Setup / SY_InitSetup). Thay đổi có hiệu lực sau khi người dùng đăng nhập lại.')])


LANG_STRINGS = [('isSystemLanguage2', 'True', 'True', 'True', 'True'), ('SystemLanguage2', '', 'Tiếng Anh', 'English', '英语'),
                ('SystemLanguage3', '', 'Tiếng Trung', 'Chinese', '中文'), ('MsgSaveOK', '', 'Đã lưu dữ liệu', 'Data saved', '数据已保存'),
                ('MsgDeleteConfirm', '', 'Bạn có chắc muốn xóa?', 'Are you sure you want to delete?', '确定要删除吗？'),
                ('MsgLockedPeriod', '{0}', 'Kỳ {0} đã khóa sổ', 'Period {0} is closed', '期间 {0} 已结账'),
                ('MsgStockOut', '{0};{1}', 'Xuất vượt tồn: tồn {0}, xuất {1}', 'Exceeds stock: on hand {0}, issue {1}', '超出库存：库存 {0}，出库 {1}'),
                ('MsgRequired', '{0}', 'Chưa nhập {0}', '{0} is required', '{0} 为必填项'), ('BtnNew', '', 'Thêm', 'New', '新增'),
                ('BtnEdit', '', 'Sửa', 'Edit', '编辑'), ('BtnSave', '', 'Lưu', 'Save', '保存'), ('BtnDelete', '', 'Xóa', 'Delete', '删除'),
                ('BtnPrint', '', 'In', 'Print', '打印'), ('BtnApprove', '', 'Duyệt', 'Approve', '审批'), ('BtnCancel', '', 'Hủy', 'Cancel', '取消'),
                ('BtnExport', '', 'Xuất Excel', 'Export to Excel', '导出 Excel')]
FIELD_EN = {'DocumentID': ('Document No.', '单据号'), 'DocumentDate': ('Document date', '单据日期'), 'ObjectID': ('Customer/Vendor', '往来单位'),
            'ObjectName': ('Name', '名称'), 'ItemID': ('Item code', '物料编码'), 'ItemName': ('Item name', '物料名称'), 'Unit': ('Unit', '单位'),
            'Quantity': ('Quantity', '数量'), 'UnitPrice': ('Unit price', '单价'), 'Amount': ('Amount', '金额'), 'VATPercent': ('VAT %', '税率'),
            'VATAmount': ('VAT amount', '税额'), 'TotalAmount': ('Total', '合计'), 'Notes': ('Notes', '备注'), 'BranchID': ('Branch', '分公司'),
            'StoreHouseID': ('Warehouse', '仓库'), 'Lot': ('Lot', '批号'), 'ExpireDate': ('Expiry date', '有效期'), 'EmployeeID': ('Employee', '员工'),
            'AccountID': ('Account', '科目')}


def c_lang(menu):
    c1 = [col('StringID', 'Mã chuỗi', width=170, frozen=True), col('StringParam', 'Tham số', width=90), col('StringVN', 'Tiếng Việt', width=260),
          col('StringEN', 'Tiếng Anh', width=260), col('StringCH', 'Tiếng Trung', width=200)]
    d1 = [dict(StringID=a, StringParam=b, StringVN=c, StringEN=d, StringCH=x) for a, b, c, d, x in LANG_STRINGS]
    c2 = [col('FieldName', 'Tên trường', width=150, frozen=True), col('CaptionVN', 'Nhãn tiếng Việt', width=200),
          col('CaptionEN', 'Nhãn tiếng Anh', width=200), col('CaptionCH', 'Nhãn tiếng Trung', width=150),
          col('MinWidth', 'Rộng tối thiểu', 'number'), col('FormatID', 'Định dạng', width=100)]
    d2 = [dict(FieldName=f, CaptionVN=FIELD_VI.get(f, f), CaptionEN=en, CaptionCH=ch, MinWidth=80 + (i % 4) * 20,
               FormatID={'Quantity': 'QTY', 'UnitPrice': 'PRICE', 'Amount': 'AMT', 'VATAmount': 'AMT', 'TotalAmount': 'AMT', 'DocumentDate': 'DATE', 'ExpireDate': 'DATE'}.get(f, ''))
          for i, (f, (en, ch)) in enumerate(FIELD_EN.items())]
    return grid_screen(menu, [('S', 'Thông điệp & cờ (SY_StTbl)', c1, d1, 'StringID'), ('L', 'Nhãn trường (SY_FmtFldTbl)', c2, d2, 'FieldName')],
                       notes=[('info', 'Ngôn ngữ hiển thị: VN / EN / CH. Đa ngữ chỉ bật khi chuỗi isSystemLanguage2 = True.')])


def c_userlog(menu):
    g = Gen('userlog')
    c1 = [col('LogID', 'Mã phiên', 'number', width=85, frozen=True), col('UserName', 'Người dùng', width=110),
          col('ComputerName', 'Máy tính', width=130), col('LoginDate', 'Đăng nhập', 'datetime'), col('LogoutDate', 'Đăng xuất', 'datetime'),
          col('Duration', 'Thời lượng', width=95), col('AppVer', 'Phiên bản', width=110)]
    d1 = []
    for i in range(40):
        u = USERS[(i * 7) % len(USERS)]
        a = datetime.datetime.combine(TODAY - datetime.timedelta(days=i // 4), datetime.time(7 + (i * 3) % 10, (i * 17) % 60))
        mins = g.r.randint(12, 420)
        b = a + datetime.timedelta(minutes=mins) if i > 2 else None
        d1.append(dict(LogID=58210 - i, UserName=u[0], ComputerName=f'PC-{["KT", "KHO", "KD", "GD"][i % 4]}-{(i % 9) + 1:02d}', LoginDate=a,
                       LogoutDate=b, Duration=f'{mins // 60} giờ {mins % 60:02d} phút' if b else 'Đang làm việc', AppVer='26.10.19.1'))
    forms_ = [('AR_InvoiceFrm', 'Bán hàng'), ('IV_StockInputFrm', 'Nhập kho'), ('CS_ReceiptFrm', 'Phiếu thu'), ('AP_PurchaseFrm', 'Mua hàng')]
    c2 = [col('LogDate', 'Thời gian', 'datetime', frozen=True), col('FormID', 'Màn hình', width=150), col('Para', 'Thao tác', width=150),
          col('PrimaryValue', 'Khóa bản ghi', width=130), col('Note', 'Ghi chú', width=320)]
    d2 = []
    for i in range(24):
        f, cap = forms_[i % 4]
        t = datetime.datetime.combine(TODAY, datetime.time(8 + i // 4, (i * 11) % 60))
        op = ['Open', 'Thêm', 'Sửa', 'In', 'Xóa'][i % 5]
        d2.append(dict(LogDate=t, FormID=f, Para=op if op == 'Open' else f'{op} {cap.lower()}', PrimaryValue='' if op == 'Open' else f'{["SI", "PN", "PT", "PI"][i % 4]}{TODAY:%m%y}/{i + 1:04d}',
                       Note=f'Thời gian nạp {g.r.randint(120, 900)} ms' if op == 'Open' else ('Giá trị cũ: số lượng 10 → 12' if op == 'Sửa' else '')))
    filt = sel_filter(screen_name(menu), [F('FromDate', 'Từ ngày', 'date', 6, value=(TODAY - datetime.timedelta(days=10)).isoformat()),
                                          F('ToDate', 'Đến ngày', 'date', 6, value=TODAY.isoformat()),
                                          F('UserName', 'Người dùng', 'select', 8, options=[(u[0], u[1]) for u in USERS]),
                                          B('ShowSystem', 'Hiện log hệ thống')[0]])
    return grid_screen(menu, [('T0', 'Phiên đăng nhập', c1, d1, 'LogID'), ('T1', 'Chi tiết phiên 58210', c2, d2, None)],
                       editable=False, form_type='LIST', filt=filt)


BACKUPS = [(f'MedData_{(TODAY - datetime.timedelta(days=d)):%Y%m%d}_{h:02d}00.bak', datetime.datetime.combine(TODAY - datetime.timedelta(days=d), datetime.time(h, 0)), s, t)
           for d, h, s, t in [(0, 6, 1843.6, 'Tự động'), (1, 18, 1841.2, 'Thủ công'), (1, 6, 1839.9, 'Tự động'), (2, 6, 1836.4, 'Tự động'),
                              (3, 6, 1832.0, 'Tự động'), (4, 6, 1829.7, 'Tự động'), (5, 6, 1826.1, 'Tự động')]]


def c_backup(menu):
    fn = f'MedData_{TODAY:%Y%m%d}_0930.bak'
    fields = [F('Database', 'Cơ sở dữ liệu', 'label', 10), F('BackupPath', 'Thư mục sao lưu (trên máy chủ)', span=20),
              F('FileName', 'Tên tệp', span=20, row_start=True), B('Compression', 'Nén bản sao lưu', span=10)[0], B('CopyOnly', 'Sao lưu COPY_ONLY', span=10)[0]]
    vals = dict(Database='MedData', BackupPath='D:\\Backup\\ERP\\', FileName=fn, Compression='true', CopyOnly='false')
    cols = [col('FileName', 'Tệp sao lưu', width=250, frozen=True), col('BackupDate', 'Thời gian', 'datetime'), col('SizeMB', 'Dung lượng (MB)', 'number', decimals=1),
            col('Type', 'Kiểu', width=100), col('UserName', 'Người thực hiện', width=120), col('Status', 'Kết quả', 'status')]
    data = [dict(FileName=f, BackupDate=t, SizeMB=s, Type=ty, UserName='admin' if ty == 'Thủ công' else 'Hệ thống', Status=('1', 'Thành công', 'success'))
            for f, t, s, ty in BACKUPS]
    return process_screen(menu, fields, vals, [('custom', 'Sao lưu ngay', 'export', None, 'done', f'Đã sao lưu MedData vào D:\\Backup\\ERP\\{fn} (mock).')],
                          result=('Lịch sử sao lưu', cols, data, 'FileName'),
                          notes=[('info', 'Sao lưu tự động: mỗi 60 phút, giữ 7 bản gần nhất (thiết lập ở Tham số hệ thống).'),
                                 ('warning', 'Tùy chọn nâng cao (sao lưu từ xa, tải về máy) chỉ dành cho tài khoản quản trị.')])


def c_restore(menu):
    fields = [F('BackupFile', 'Tệp sao lưu', 'select', 20, options=[(b[0], f'{b[0]} — {b[2]:.0f} MB') for b in BACKUPS]),
              F('TargetDatabase', 'Phục hồi vào CSDL', span=12), B('ReplaceExisting', 'Ghi đè nếu đã tồn tại', span=8)[0]]
    vals = dict(BackupFile=BACKUPS[0][0], TargetDatabase='MedData_Restore', ReplaceExisting='false')
    cols = [col('LogicalName', 'Tên logic', width=160, frozen=True), col('Type', 'Loại', width=70), col('PhysicalName', 'Đường dẫn khi phục hồi', width=380),
            col('SizeMB', 'Dung lượng (MB)', 'number', decimals=1)]
    data = [dict(LogicalName='MedData', Type='D', PhysicalName='D:\\SQLData\\MedData_Restore.mdf', SizeMB=1612.0),
            dict(LogicalName='MedData_log', Type='L', PhysicalName='D:\\SQLData\\MedData_Restore_log.ldf', SizeMB=231.6)]
    return process_screen(menu, fields, vals, [('custom', 'Phục hồi', 'import', 'Phục hồi sẽ đưa CSDL đích về chế độ một người dùng và ngắt mọi kết nối. Tiếp tục?', 'done',
                                                'Đã phục hồi MedData_Restore từ tệp sao lưu (mock).')],
                          result=('Nội dung tệp sao lưu', cols, data, 'LogicalName'),
                          notes=[('warning', 'Phục hồi ghi đè toàn bộ dữ liệu của CSDL đích. Nên phục hồi vào CSDL mới rồi kiểm tra trước.')])


def c_epost(menu):
    services = [('VCN', 'Chuyển phát nhanh'), ('VTK', 'Chuyển phát tiết kiệm'), ('VHT', 'Hỏa tốc')]
    t1 = [F('ApiUrl', 'Địa chỉ API', span=30), F('ApiVersion', 'Phiên bản', span=10), F('ApiUser', 'Tài khoản API', span=15),
          F('ApiPassword', 'Mật khẩu API', 'password', 15), B('IsSandbox', 'Môi trường thử nghiệm', span=10)[0]]
    t2 = [F('SenderName', 'Tên người gửi', span=20), F('SenderPhone', 'Điện thoại', span=10), F('SenderProvince', 'Tỉnh/TP', 'select', 10,
          options=[(c, c) for c in CITIES]), F('SenderAddress', 'Địa chỉ lấy hàng', span=40),
          F('DefaultService', 'Dịch vụ mặc định', 'select', 14, options=services),
          F('DefaultPayer', 'Người trả cước', 'select', 13, options=[('1', 'Người gửi trả'), ('2', 'Người nhận trả')]),
          B('CODDefault', 'Thu hộ (COD) mặc định', span=13)[0]]
    vals = dict(ApiUrl='https://partner-api.example.vn/v2', ApiVersion='2.0', ApiUser='demo-api', IsSandbox='true',
                SenderName='CÔNG TY CỔ PHẦN DEMO MEDCOM', SenderPhone='028 3800 0000', SenderProvince='TP. Hồ Chí Minh',
                SenderAddress='Kho Hồ Chí Minh, 25 Điện Biên Phủ, Quận Bình Thạnh', DefaultService='VCN', DefaultPayer='1', CODDefault='false')
    return record_screen(menu, [('1', 'Kết nối API', t1), ('2', 'Người gửi & dịch vụ', t2)], vals,
                         tools=[('custom', 'Kiểm tra kết nối', 'check')],
                         notes=[('info', 'Mật khẩu/token API chỉ lưu ở máy chủ, không hiển thị lại. Để trống ô mật khẩu khi lưu nghĩa là giữ nguyên.')])


def c_change_password(menu):
    name = screen_name(menu)
    rid = f'rec-{name}'
    saved = f'{BASE}/screens/{name}.saved.html'
    starts = [('', '(Trang chủ)')] + [(r['FormName'], r['CaptionVN']) for r in menu_rows if r['FormName'] in
                                      ('AR_InvoiceFrm', 'IV_StockInputFrm', 'CS_ReceiptFrm', 'AP_PurchaseFrm', 'IV_InboundRequestFrm')]
    fl = [F('UserName', 'Tên đăng nhập', 'label', 20), F('HoTen', 'Họ tên', span=20, required=True),
          F('OldPassword', 'Mật khẩu hiện tại', 'password', 20, row_start=True, required=True),
          F('NewPassword', 'Mật khẩu mới', 'password', 20, row_start=True, required=True,
            hint='Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số.'),
          F('ConfirmPassword', 'Nhập lại mật khẩu mới', 'password', 20, required=True),
          F('StartupForm', 'Màn hình mở khi đăng nhập', 'select', 20, row_start=True, options=starts)]
    vals = dict(UserName='admin', HoTen='Quản trị hệ thống', StartupForm='')
    parts = [toolbar([s_btn('save', rid, saved, 'Lưu', data_shortcut='Ctrl+S')]),
             f'<form data-erp="record" id="{rid}" method="post" action="{saved}" data-key-field="UserName" data-key="admin">{TOKEN}'
             f'<input type="hidden" name="__version" value="{TODAY.isoformat()}T09:15:00.000">']
    parts += fields_block(name, [('1', 'Tài khoản', fl)], vals, 'edit')
    parts.append('</form>')
    url = put_screen(menu, name, 'CUSTOM', 'edit', parts, key=f'{menu["FormName"]}:admin')
    done = [msgs(('success', 'Đã đổi mật khẩu. Lần đăng nhập sau dùng mật khẩu mới (mock).')),
            toolbar([a_btn('reload', url, 'Đổi lại', data_target='self')]),
            f'<form data-erp="record" id="{rid}" method="post" action="{saved}">{TOKEN}']
    done += fields_block(name, [('1', 'Tài khoản', [f for f in fl if f['control'] != 'password'])], vals, 'view')
    done.append('</form>')
    put_screen(menu, f'{name}.saved', 'CUSTOM', 'view', done)
    return url


def period_rows(lock_upto=9, lock_data_upto=8):
    g = Gen('periods')
    out = []
    for i, (p, n, a, b) in enumerate(PERIODS_2026):
        locked = i < lock_upto
        out.append(dict(PeriodID=p, PeriodName=n, FromDate=a, ToDate=b,
                        isLock=locked, isLockData=i < lock_data_upto,
                        Status=('1', 'Đã khóa sổ', 'success') if locked else (('0', 'Đang mở', 'info') if i <= TODAY.month - 1 else ('0', 'Chưa đến kỳ', 'neutral')),
                        LockedBy='admin' if locked else '', LockedDate=datetime.datetime.combine(b + datetime.timedelta(days=g.r.randint(3, 9)), datetime.time(17, 30)) if locked else None))
    return out


def c_period_close(menu):
    fields = [F('FromPeriod', 'Từ kỳ', 'select', 10, options=PERIOD_OPTS), F('ToPeriod', 'Đến kỳ', 'select', 10, options=PERIOD_OPTS)]
    vals = dict(FromPeriod='202610', ToPeriod='202610')
    for f, cap, v in [('CheckBeforeClose', 'Kiểm tra dữ liệu trước khi khóa', True), ('StepDepreciate', 'Trích khấu hao TSCĐ', True),
                      ('StepUnitCost', 'Tính giá xuất kho', True), ('StepAllocateEquip', 'Phân bổ công cụ dụng cụ', True),
                      ('StepAllocateCost', 'Phân bổ chi phí trả trước', True), ('StepTransfer', 'Kết chuyển cuối kỳ', True)]:
        fd, val = B(f, cap, v, span=13)
        fields.append(fd)
        vals[f] = val
    cols = [col('PeriodID', 'Mã kỳ', width=90, frozen=True), col('PeriodName', 'Kỳ', width=130), col('FromDate', 'Từ ngày', 'date'),
            col('ToDate', 'Đến ngày', 'date'), col('Status', 'Trạng thái', 'status'), col('LockedBy', 'Người khóa', width=110),
            col('LockedDate', 'Thời điểm khóa', 'datetime')]
    return process_screen(menu, fields, vals, [
        ('lock', 'Khóa sổ', 'lock', 'Khóa sổ kỳ 10/2026? Hệ thống sẽ chạy lần lượt các bước đã chọn rồi khóa kỳ.', 'done', 'Đã khóa sổ kỳ 10/2026: khấu hao, giá vốn, phân bổ và kết chuyển đã chạy xong (mock).'),
        ('unlock', 'Mở sổ', 'unlock', 'Mở lại sổ kỳ đã chọn? Chứng từ trong kỳ sẽ sửa được.', 'opened', 'Đã mở sổ kỳ 10/2026 (mock).')],
        result=('Tình trạng các kỳ năm 2026', cols, period_rows(), 'PeriodID'), legend='Khóa sổ cuối kỳ')


def c_period_lock_data(menu):
    cols = [col('PeriodID', 'Mã kỳ', width=90, frozen=True, readonly=True), col('PeriodName', 'Kỳ', width=130, readonly=True),
            col('FromDate', 'Từ ngày', 'date', readonly=True), col('ToDate', 'Đến ngày', 'date', readonly=True),
            col('isLockData', 'Khóa dữ liệu', 'bool'), col('isLock', 'Đã khóa sổ', 'bool', readonly=True),
            col('LockedBy', 'Người khóa', width=110, readonly=True)]
    return grid_screen(menu, [('T0', 'Kỳ', cols, period_rows(), 'PeriodID')], form_type='LISTEDIT', add_row=False,
                       notes=[('info', 'Kỳ khóa dữ liệu: không ai được thêm / sửa / xóa chứng từ có ngày thuộc kỳ (trừ chế độ quản trị).')])


DOC_SOURCES = [('SI', 'Hóa đơn bán hàng'), ('PI', 'Mua hàng'), ('PN', 'Phiếu nhập kho'), ('PX', 'Phiếu xuất kho'), ('PT', 'Phiếu thu'),
               ('PC', 'Phiếu chi'), ('PK', 'Phiếu kế toán')]


def c_lock_documents(menu):
    g = Gen('lockdoc')
    cols = [col('DocumentID', 'Số chứng từ', width=125, frozen=True), col('SourceName', 'Loại chứng từ', width=150), col('DocumentDate', 'Ngày', 'date'),
            col('ObjectName', 'Đối tượng', width=260), col('Memo', 'Diễn giải', width=220), col('Amount', 'Số tiền', 'money'),
            col('IsApprove', 'Đã duyệt', 'bool'), col('IsLock', 'Đã khóa', 'bool')]
    data = []
    for i in range(36):
        s, sn = DOC_SOURCES[i % len(DOC_SOURCES)]
        d = TODAY.replace(day=1) - datetime.timedelta(days=g.r.randint(1, 30))
        data.append(dict(DocumentID=f'{s}{d:%m%y}/{i + 1:04d}', SourceName=sn, DocumentDate=d, ObjectName=COMPANIES[(i * 4) % len(COMPANIES)],
                         Memo=['Bán hàng theo đơn', 'Nhập hàng NCC', 'Thu tiền khách hàng', 'Chi trả nhà cung cấp', 'Xuất kho bán'][i % 5],
                         Amount=g.r.randint(5, 900) * 100000, IsApprove=i % 3 != 2, IsLock=i % 4 == 0))
    c2 = [col('DebitAccID', 'TK Nợ', width=90), col('CreditAccID', 'TK Có', width=90), col('Amount', 'Số tiền', 'money'), col('Memo', 'Diễn giải', width=300)]
    d2 = [dict(DebitAccID='131', CreditAccID='5111', Amount=48500000, Memo='Doanh thu bán hàng'),
          dict(DebitAccID='131', CreditAccID='33311', Amount=3880000, Memo='Thuế GTGT đầu ra 8%'),
          dict(DebitAccID='632', CreditAccID='156', Amount=36120000, Memo='Giá vốn hàng bán')]
    filt = sel_filter(screen_name(menu), [F('PeriodID', 'Kỳ', 'select', 8, options=[('*', 'Tất cả kỳ')] + PERIOD_OPTS, value='202610'),
                                          F('SourceID', 'Loại chứng từ', 'select', 10, options=DOC_SOURCES),
                                          F('LockState', 'Tình trạng', 'select', 8, options=[('0', 'Chưa khóa'), ('1', 'Đã khóa')])])
    return grid_screen(menu, [('T0', 'Chứng từ', cols, data, 'DocumentID'), ('T1', 'Định khoản chứng từ đang chọn', c2, d2, None)],
                       editable=False, form_type='LIST', filt=filt,
                       sel_tools=[('approve', 'Duyệt', 'approve', None), ('lock', 'Khóa', 'lock', 'Khóa các chứng từ đang chọn?'),
                                  ('unlock', 'Mở khóa', 'unlock', 'Mở khóa các chứng từ đang chọn?')],
                       notes=[('info', 'Nút Khóa / Mở khóa chỉ dành cho người có quyền Manager.')])


def c_notify(menu):
    kinds = [('1', 'Chờ duyệt', 'warning'), ('2', 'Nhắc việc', 'info'), ('3', 'Hệ thống', 'neutral'), ('4', 'Cảnh báo', 'danger')]
    titles = [('Đơn hàng chờ duyệt', 'Đơn hàng {d} của {o} đang chờ anh/chị duyệt.', 0), ('Đề nghị thanh toán', 'Đề nghị thanh toán {d} cần duyệt trước 17:00.', 0),
              ('Lô hàng sắp hết hạn', 'Lô L26{n} của {i} còn 45 ngày hết hạn.', 3), ('Công nợ quá hạn', '{o} quá hạn thanh toán 12 ngày.', 3),
              ('Lịch giao hàng', 'Giao hàng cho {o} lúc 14:00 ngày mai.', 1), ('Sao lưu dữ liệu', 'Sao lưu tự động lúc 06:00 thành công.', 2)]
    cols = [col('MsgTime', 'Thời gian', 'datetime', frozen=True), col('NotifyType', 'Loại', 'status', width=115), col('Title', 'Tiêu đề', width=200),
            col('Message', 'Nội dung', width=420, wrap=True), col('FromUserID', 'Người gửi', width=110), col('DocumentID', 'Chứng từ', width=125),
            col('IsView', 'Đã xem', 'bool')]
    data = []
    for i in range(30):
        t, m, k = titles[i % len(titles)]
        doc = f'{["DH", "TT", "", "", "DH", ""][i % 6]}{TODAY:%m%y}/{i + 3:04d}' if i % 6 in (0, 1, 4) else ''
        data.append(dict(MsgTime=datetime.datetime.combine(TODAY - datetime.timedelta(days=i // 5), datetime.time(17 - (i % 5) * 2, (i * 13) % 60)),
                         NotifyType=kinds[k], Title=t, Message=m.format(d=doc, o=COMPANIES[i % len(COMPANIES)], n=100 + i, i=ITEMS[i % len(ITEMS)][0]),
                         FromUserID='Hệ thống' if k >= 2 else USERS[1 + i % 6][0], DocumentID=doc, IsView=i > 4))
    return grid_screen(menu, [('T0', 'Thông báo', cols, data, None)], editable=False, form_type='LIST',
                       sel_tools=[('custom', 'Đánh dấu đã xem', 'check', None)],
                       filt=sel_filter(screen_name(menu), [F('FromDate', 'Từ ngày', 'date', 6, value=(TODAY - datetime.timedelta(days=7)).isoformat()),
                                                           F('ToDate', 'Đến ngày', 'date', 6, value=TODAY.isoformat()),
                                                           B('OnlyUnread', 'Chỉ thông báo chưa xem')[0]]))


# ---- 2. Kế toán: số dư đầu kỳ, thiết lập báo cáo tài chính, phân bổ, khấu hao, giá vốn -------------------------
BAL_FILTER = [F('PeriodID', 'Kỳ nhập số dư', 'select', 8, options=PERIOD_OPTS, value='202601'), F('BranchID', 'Chi nhánh', 'select', 8)]


def c_balance_account(menu):
    credit_side = {'214', '331', '3331', '334', '338', '411', '421'}
    g = Gen('balacc')
    data = []
    for a, n in ACCOUNTS:
        if a[0] in '56789':
            continue
        v = g.r.randint(20, 900) * 1000000
        data.append(dict(AccountID=a, AccountName=n, DebitBalance=0 if a in credit_side else v, CreditBalance=v if a in credit_side else 0))
    diff = sum(d['DebitBalance'] for d in data) - sum(d['CreditBalance'] for d in data)
    for d in data:   # cân đối tổng dư Nợ = tổng dư Có
        if diff >= 0 and d['AccountID'] == '411':
            d['CreditBalance'] += diff
        elif diff < 0 and d['AccountID'] == '111':
            d['DebitBalance'] -= diff
    cols = [col('AccountID', 'Tài khoản', width=100, frozen=True), col('AccountName', 'Tên tài khoản', width=280, readonly=True),
            col('DebitBalance', 'Dư Nợ đầu kỳ', 'money'), col('CreditBalance', 'Dư Có đầu kỳ', 'money'),
            col('DebitBalanceFC', 'Dư Nợ nguyên tệ', 'money', sum=None), col('CreditBalanceFC', 'Dư Có nguyên tệ', 'money', sum=None)]
    return grid_screen(menu, [('T0', 'Số dư tài khoản', cols, data, 'AccountID')], filt=sel_filter(screen_name(menu), BAL_FILTER),
                       notes=[('info', 'Tổng dư Nợ phải bằng tổng dư Có. Tài khoản có chi tiết đối tượng / hàng tồn nhập ở màn số dư công nợ và số dư hàng tồn.')])


def c_balance_object(menu):
    g = Gen('balobj')
    data = []
    for i in range(18):
        acc = '131' if i < 12 else '331'
        v = g.r.randint(5, 400) * 1000000
        data.append(dict(AccountID=acc, ObjectID=f'KH{(i * 3) % len(COMPANIES) + 1:04d}', ObjectName=COMPANIES[(i * 3) % len(COMPANIES)],
                         DebitBalance=v if acc == '131' else 0, CreditBalance=v if acc == '331' else 0, CurrencyID=('VND', 'VND', None),
                         DueDate=datetime.date(2026, 1, 1) + datetime.timedelta(days=g.r.randint(10, 90))))
    cols = [col('AccountID', 'Tài khoản', width=90, frozen=True), col('ObjectID', 'Mã đối tượng', width=110), col('ObjectName', 'Tên đối tượng', width=280, readonly=True),
            col('DebitBalance', 'Dư Nợ', 'money'), col('CreditBalance', 'Dư Có', 'money'), col('CurrencyID', 'Loại tiền', width=80),
            col('DueDate', 'Hạn thanh toán', 'date')]
    return grid_screen(menu, [('T0', 'Số dư công nợ', cols, data, None)], filt=sel_filter(screen_name(menu), BAL_FILTER + [
        F('AccountID', 'Tài khoản', 'lookup', 10, lookup=LOOKUPS['AccountID'])]))


def c_balance_item(menu):
    g = Gen('balitem')
    data = []
    for i in range(22):
        it, unit = ITEMS[(i * 7) % len(ITEMS)]
        q = g.r.randint(5, 300)
        p = g.r.choice([12, 45, 85, 150, 320, 1250, 4800]) * 1000
        data.append(dict(StoreHouseID=STORES[i % 3] + (None,), ItemID=f'VT{(i * 7) % len(ITEMS) + 1:04d}', ItemName=it, Unit=unit,
                         Lot=f'L26{100 + i * 7}', ExpireDate=datetime.date(2027 + i % 3, 1 + i % 12, 28), Quantity=q, UnitPrice=p, Amount=q * p))
    cols = [col('StoreHouseID', 'Kho', width=140, frozen=True), col('ItemID', 'Mã hàng', width=100), col('ItemName', 'Tên hàng', width=250, readonly=True),
            col('Unit', 'ĐVT', width=70, readonly=True), col('Lot', 'Số lô', width=90), col('ExpireDate', 'Hạn dùng', 'date'),
            col('Quantity', 'Số lượng', 'quantity', sum='sum', decimals=0), col('UnitPrice', 'Đơn giá', 'money', sum=None), col('Amount', 'Thành tiền', 'money')]
    return grid_screen(menu, [('T0', 'Số dư hàng tồn', cols, data, None)], filt=sel_filter(screen_name(menu), BAL_FILTER + [
        F('StoreHouseID', 'Kho', 'select', 10)]))


B01 = [('100', 'A. TÀI SẢN NGẮN HẠN', '', '110+120+130+140+150', 1), ('110', 'I. Tiền và các khoản tương đương tiền', '', '111+112', 1),
       ('111', '1. Tiền', 'V.01', 'Dư Nợ 111, 112, 113', 0), ('112', '2. Các khoản tương đương tiền', '', 'Dư Nợ 1281, 1288', 0),
       ('120', 'II. Đầu tư tài chính ngắn hạn', 'V.02', '121+122+123', 1), ('130', 'III. Các khoản phải thu ngắn hạn', '', '131+132+136+137', 1),
       ('131', '1. Phải thu ngắn hạn của khách hàng', '', 'Dư Nợ chi tiết 131', 0), ('132', '2. Trả trước cho người bán ngắn hạn', '', 'Dư Nợ chi tiết 331', 0),
       ('136', '6. Phải thu ngắn hạn khác', 'V.03', 'Dư Nợ 1388, 141, 244', 0), ('137', '7. Dự phòng phải thu ngắn hạn khó đòi (*)', '', 'Dư Có 2293 (ghi âm)', 0),
       ('140', 'IV. Hàng tồn kho', '', '141+149', 1), ('141', '1. Hàng tồn kho', 'V.04', 'Dư Nợ 151, 152, 153, 154, 155, 156, 157', 0),
       ('149', '2. Dự phòng giảm giá hàng tồn kho (*)', '', 'Dư Có 2294 (ghi âm)', 0), ('150', 'V. Tài sản ngắn hạn khác', '', '151+152+153', 1),
       ('151', '1. Chi phí trả trước ngắn hạn', '', 'Dư Nợ 242 (ngắn hạn)', 0), ('152', '2. Thuế GTGT được khấu trừ', '', 'Dư Nợ 133', 0),
       ('200', 'B. TÀI SẢN DÀI HẠN', '', '210+220+240+250+260', 1), ('220', 'II. Tài sản cố định', '', '221+224+227', 1),
       ('221', '1. Tài sản cố định hữu hình', 'V.05', '222+223', 0), ('222', '   - Nguyên giá', '', 'Dư Nợ 211', 0),
       ('223', '   - Giá trị hao mòn lũy kế (*)', '', 'Dư Có 2141 (ghi âm)', 0), ('270', 'TỔNG CỘNG TÀI SẢN (270 = 100 + 200)', '', '100+200', 1),
       ('300', 'C. NỢ PHẢI TRẢ', '', '310+330', 1), ('310', 'I. Nợ ngắn hạn', '', '311+...+324', 1),
       ('311', '1. Phải trả người bán ngắn hạn', '', 'Dư Có chi tiết 331', 0), ('312', '2. Người mua trả tiền trước ngắn hạn', '', 'Dư Có chi tiết 131', 0),
       ('313', '3. Thuế và các khoản phải nộp Nhà nước', 'V.06', 'Dư Có 333', 0), ('314', '4. Phải trả người lao động', '', 'Dư Có 334', 0),
       ('319', '9. Phải trả ngắn hạn khác', '', 'Dư Có 338, 344', 0), ('400', 'D. VỐN CHỦ SỞ HỮU', '', '410+430', 1),
       ('410', 'I. Vốn chủ sở hữu', 'V.07', '411+...+422', 1), ('411', '1. Vốn góp của chủ sở hữu', '', 'Dư Có 4111', 0),
       ('421', '11. Lợi nhuận sau thuế chưa phân phối', '', 'Dư Có 421 (Dư Nợ ghi âm)', 0), ('440', 'TỔNG CỘNG NGUỒN VỐN (440 = 300 + 400)', '', '300+400', 1)]
B02 = [('01', '1. Doanh thu bán hàng và cung cấp dịch vụ', 'VI.01', 'PS Có 511 / Nợ 911', 0), ('02', '2. Các khoản giảm trừ doanh thu', '', 'PS Nợ 511 / Có 521', 0),
       ('10', '3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)', '', '01-02', 1), ('11', '4. Giá vốn hàng bán', 'VI.02', 'PS Có 632 / Nợ 911', 0),
       ('20', '5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)', '', '10-11', 1), ('21', '6. Doanh thu hoạt động tài chính', 'VI.03', 'PS Nợ 515 / Có 911', 0),
       ('22', '7. Chi phí tài chính', 'VI.04', 'PS Có 635 / Nợ 911', 0), ('23', '   - Trong đó: Chi phí lãi vay', '', 'PS Nợ 635 chi tiết lãi vay', 0),
       ('25', '8. Chi phí bán hàng', '', 'PS Có 641 / Nợ 911', 0), ('26', '9. Chi phí quản lý doanh nghiệp', '', 'PS Có 642 / Nợ 911', 0),
       ('30', '10. Lợi nhuận thuần từ hoạt động kinh doanh (30 = 20 + 21 - 22 - 25 - 26)', '', '20+21-22-25-26', 1),
       ('31', '11. Thu nhập khác', '', 'PS Nợ 711 / Có 911', 0), ('32', '12. Chi phí khác', '', 'PS Có 811 / Nợ 911', 0),
       ('40', '13. Lợi nhuận khác (40 = 31 - 32)', '', '31-32', 1), ('50', '14. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)', '', '30+40', 1),
       ('51', '15. Chi phí thuế TNDN hiện hành', 'VI.05', 'PS Có 8211 / Nợ 911', 0), ('52', '16. Chi phí thuế TNDN hoãn lại', '', 'PS Có 8212 / Nợ 911', 0),
       ('60', '17. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51 - 52)', '', '50-51-52', 1)]
B03 = [('01', '1. Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác', '', 'Nợ 111, 112 / Có 511, 131, 3331', 0),
       ('02', '2. Tiền chi trả cho người cung cấp hàng hóa và dịch vụ', '', 'Có 111, 112 / Nợ 331, 152, 156, 133', 0),
       ('03', '3. Tiền chi trả cho người lao động', '', 'Có 111, 112 / Nợ 334', 0), ('04', '4. Tiền lãi vay đã trả', '', 'Có 111, 112 / Nợ 635, 335', 0),
       ('05', '5. Thuế thu nhập doanh nghiệp đã nộp', '', 'Có 111, 112 / Nợ 3334', 0), ('06', '6. Tiền thu khác từ hoạt động kinh doanh', '', 'Nợ 111, 112 / Có 711, 138, 344', 0),
       ('07', '7. Tiền chi khác cho hoạt động kinh doanh', '', 'Có 111, 112 / Nợ 811, 138, 338', 0),
       ('20', 'Lưu chuyển tiền thuần từ hoạt động kinh doanh', '', '01+02+...+07', 1),
       ('21', '1. Tiền chi để mua sắm, xây dựng TSCĐ và các tài sản dài hạn khác', '', 'Có 111, 112 / Nợ 211, 213, 241', 0),
       ('30', 'Lưu chuyển tiền thuần từ hoạt động đầu tư', '', '21+22+...+27', 1), ('33', '3. Tiền thu từ đi vay', '', 'Nợ 111, 112 / Có 341', 0),
       ('34', '4. Tiền trả nợ gốc vay', '', 'Có 111, 112 / Nợ 341', 0), ('40', 'Lưu chuyển tiền thuần từ hoạt động tài chính', '', '31+32+...+36', 1),
       ('50', 'Lưu chuyển tiền thuần trong kỳ (50 = 20 + 30 + 40)', '', '20+30+40', 1), ('60', 'Tiền và tương đương tiền đầu kỳ', '', 'Dư Nợ đầu kỳ 111, 112, 1281', 0),
       ('70', 'Tiền và tương đương tiền cuối kỳ (70 = 50 + 60 + 61)', 'VII.34', '50+60+61', 1)]


def fin_setup_screen(menu, lines, detail_cols, detail_data, note):
    cols = [col('CodeID', 'Mã số', width=80, frozen=True), col('CodeName', 'Chỉ tiêu', width=430, wrap=True),
            col('Statement', 'Thuyết minh', width=100), col('Formula', 'Cách lấy số liệu', width=300),
            col('IsBold', 'In đậm', 'bool'), col('IsNotPrint', 'Không in', 'bool')]
    data = [dict(CodeID=c, CodeName=n, Statement=s, Formula=f, IsBold=bool(b), IsNotPrint=False) for c, n, s, f, b in lines]
    return grid_screen(menu, [('T0', 'Chỉ tiêu', cols, data, 'CodeID'), ('T1', 'Công thức chỉ tiêu đang chọn', detail_cols, detail_data, None)],
                       notes=[('info', note)])


def c_bs_setup(menu):
    dc = [col('AccountID', 'Tài khoản', width=100), col('IsDebitBal', 'Lấy dư Nợ', 'bool'), col('IsObject', 'Chi tiết theo đối tượng', 'bool', width=150),
          col('SumID', 'Cộng vào mã', width=100), col('ReverseSign', 'Đổi dấu', 'bool')]
    dd = [dict(AccountID='131', IsDebitBal=True, IsObject=True, SumID='130', ReverseSign=False),
          dict(AccountID='1388', IsDebitBal=True, IsObject=False, SumID='130', ReverseSign=False)]
    return fin_setup_screen(menu, B01, dc, dd, 'Bảng cân đối kế toán mẫu B01-DN (Thông tư 200). Chỉ tiêu tổng cộng lấy theo công thức mã số; chỉ tiêu chi tiết lấy số dư tài khoản.')


def c_pl_setup(menu):
    dc = [col('DebitAccID', 'TK Nợ', width=100), col('CreditAccID', 'TK Có', width=100), col('SumID', 'Cộng vào mã', width=100), col('ReverseSign', 'Đổi dấu', 'bool')]
    dd = [dict(DebitAccID='511', CreditAccID='911', SumID='10', ReverseSign=False)]
    return fin_setup_screen(menu, B02, dc, dd, 'Báo cáo kết quả hoạt động kinh doanh mẫu B02-DN: lấy phát sinh đối ứng giữa tài khoản doanh thu/chi phí và TK 911.')


def c_cf_setup(menu):
    dc = [col('DebitAccIDs', 'Các TK Nợ', width=140), col('CreditAccIDs', 'Các TK Có', width=160), col('SumID', 'Cộng vào mã', width=100),
          col('ReverseSign', 'Đổi dấu', 'bool'), col('Type', 'Kiểu lấy', width=120)]
    dd = [dict(DebitAccIDs='111;112', CreditAccIDs='511;131;3331', SumID='20', ReverseSign=False, Type='Phát sinh đối ứng')]
    return fin_setup_screen(menu, B03, dc, dd, 'Báo cáo lưu chuyển tiền tệ mẫu B03-DN (phương pháp trực tiếp): lấy phát sinh đối ứng của tài khoản tiền.')


def run_fields(period='202610', extra=()):
    fields = [F('PeriodID', 'Kỳ', 'select', 8, options=PERIOD_OPTS), F('BranchID', 'Chi nhánh', 'select', 8),
              F('DocumentDate', 'Ngày hạch toán', 'date', 6)] + list(extra)
    p = next(x for x in PERIODS_2026 if x[0] == period)
    return fields, dict(PeriodID=period, BranchID='HN', DocumentDate=p[3].isoformat())


def c_allocate_cost(menu):
    items = [('PB001', 'Thuê văn phòng Hà Nội 12 tháng', 360000000, 12, '6427', 'HC'), ('PB002', 'Bản quyền phần mềm ERP 36 tháng', 288000000, 36, '6428', 'KT'),
             ('PB003', 'Bảo hiểm tài sản năm 2026', 54000000, 12, '6427', 'HC'), ('PB004', 'Sửa chữa kho Hồ Chí Minh', 126000000, 18, '6417', 'KHO'),
             ('PB005', 'Chi phí hội chợ thiết bị y tế', 96000000, 6, '6418', 'KD'), ('PB006', 'Đồng phục nhân viên', 42000000, 12, '6421', 'HC'),
             ('PB007', 'Thuê kho Đà Nẵng 24 tháng', 432000000, 24, '6417', 'KHO')]
    data = []
    for i, (aid, n, amt, mu, acc, cc) in enumerate(items):
        per = round(amt / mu)
        used = min(mu - 1, 3 + i)
        data.append(dict(AllocateID=aid, AllocateName=n, DocumentDate=datetime.date(2026, 1 + i % 6, 1), Amount=amt, MonthUse=mu, OpenAllocate=per * used,
                         PeriodAmount=per, EndAllocate=per * (used + 1), RemainAmount=amt - per * (used + 1), ExpenseAccID=acc,
                         CostCenterID=(cc, dict(COSTCENTERS)[cc], None)))
    cols = [col('AllocateID', 'Mã phân bổ', width=95, frozen=True), col('AllocateName', 'Nội dung', width=260), col('DocumentDate', 'Ngày ghi nhận', 'date'),
            col('Amount', 'Tổng tiền', 'money'), col('MonthUse', 'Số kỳ', 'number'), col('OpenAllocate', 'Đã phân bổ đầu kỳ', 'money'),
            col('PeriodAmount', 'Phân bổ kỳ này', 'money'), col('EndAllocate', 'Lũy kế', 'money'), col('RemainAmount', 'Còn lại', 'money'),
            col('ExpenseAccID', 'TK chi phí', width=90), col('CostCenterID', 'Bộ phận', width=140)]
    fields, vals = run_fields()
    return process_screen(menu, fields, vals, [('custom', 'Tính phân bổ', 'run', None, 'done', 'Đã phân bổ chi phí trả trước kỳ 10/2026 và sinh phiếu kế toán PK1026/0031 (mock).')],
                          result=('Bảng phân bổ chi phí trả trước kỳ 10/2026', cols, data, 'AllocateID'),
                          notes=[('info', 'Phân bổ theo định nghĩa ở màn “Định nghĩa phân bổ chi phí trả trước” (GJ_AllocateSetupTbl). Chạy lại sẽ thay bút toán phân bổ cũ của kỳ.')])


def depreciation_rows(items, acc_credit):
    out = []
    for i, (aid, n, cost_, months, acc, cc, used) in enumerate(items):
        per = round(cost_ / months)
        out.append(dict(AssetID=aid, AssetName=n, CostCenterID=(cc, dict(COSTCENTERS)[cc], None), OriginalCost=cost_, MonthUse=months,
                        MonthlyAmount=per, Accumulated=per * (used + 1), Remaining=cost_ - per * (used + 1), DebitAccID=acc, CreditAccID=acc_credit))
    return out


def c_depreciate(menu):
    items = [('TS001', 'Máy siêu âm trình diễn GE', 1250000000, 60, '6414', 'KD', 21), ('TS002', 'Xe tải giao hàng 1,5 tấn', 680000000, 96, '6414', 'KHO', 33),
             ('TS003', 'Máy chủ ERP và lưu trữ', 245000000, 36, '6424', 'KT', 14), ('TS004', 'Hệ thống phòng cháy kho Hà Nội', 318000000, 120, '6424', 'KHO', 40),
             ('TS005', 'Máy xét nghiệm sinh hóa trưng bày', 890000000, 60, '6414', 'KTH', 9), ('TS006', 'Kệ kho tự động', 420000000, 84, '6424', 'KHO', 27),
             ('TS007', 'Xe ô tô 7 chỗ', 1150000000, 120, '6424', 'HC', 52)]
    cols = [col('AssetID', 'Mã tài sản', width=90, frozen=True), col('AssetName', 'Tên tài sản', width=250), col('CostCenterID', 'Bộ phận sử dụng', width=150),
            col('OriginalCost', 'Nguyên giá', 'money'), col('MonthUse', 'Số tháng KH', 'number'), col('MonthlyAmount', 'Khấu hao kỳ này', 'money'),
            col('Accumulated', 'Hao mòn lũy kế', 'money'), col('Remaining', 'Giá trị còn lại', 'money'), col('DebitAccID', 'TK chi phí', width=90),
            col('CreditAccID', 'TK hao mòn', width=90)]
    fields, vals = run_fields(extra=[F('Memo', 'Diễn giải', span=20)])
    vals['Memo'] = 'Trích khấu hao TSCĐ tháng 10/2026'
    return process_screen(menu, fields, vals, [('custom', 'Trích khấu hao', 'run', None, 'done', 'Đã trích khấu hao 7 tài sản, sinh phiếu kế toán KH1026/0001 (mock).'),
                                               ('delete', 'Xóa khấu hao kỳ', 'delete', 'Xóa bút toán khấu hao đã trích của kỳ đã chọn?', 'deleted', 'Đã xóa bút toán khấu hao kỳ 10/2026 (mock).')],
                          result=('Bảng tính khấu hao kỳ 10/2026', cols, depreciation_rows(items, '2141'), 'AssetID'))


def c_allocate_equip(menu):
    items = [('CC001', 'Máy tính xách tay nhân viên kinh doanh', 186000000, 24, '6413', 'KD', 7), ('CC002', 'Bàn ghế văn phòng', 64000000, 24, '6423', 'HC', 11),
             ('CC003', 'Máy in mã vạch kho', 38500000, 12, '6413', 'KHO', 5), ('CC004', 'Dụng cụ sửa chữa thiết bị', 52000000, 18, '6273', 'KTH', 8),
             ('CC005', 'Máy quét QR cầm tay', 27600000, 12, '6413', 'KHO', 3), ('CC006', 'Điều hòa phòng mẫu', 45000000, 36, '6423', 'HC', 16)]
    cols = [col('AssetID', 'Mã CCDC', width=90, frozen=True), col('AssetName', 'Tên công cụ dụng cụ', width=260), col('CostCenterID', 'Bộ phận sử dụng', width=150),
            col('OriginalCost', 'Giá trị', 'money'), col('MonthUse', 'Số kỳ phân bổ', 'number'), col('MonthlyAmount', 'Phân bổ kỳ này', 'money'),
            col('Accumulated', 'Đã phân bổ lũy kế', 'money'), col('Remaining', 'Còn lại', 'money'), col('DebitAccID', 'TK chi phí', width=90),
            col('CreditAccID', 'TK chờ phân bổ', width=110)]
    fields, vals = run_fields()
    return process_screen(menu, fields, vals, [('custom', 'Phân bổ CCDC', 'run', None, 'done', 'Đã phân bổ 6 công cụ dụng cụ kỳ 10/2026, sinh phiếu PB1026/0002 (mock).')],
                          result=('Bảng phân bổ công cụ dụng cụ kỳ 10/2026', cols, depreciation_rows(items, '242'), 'AssetID'))


def c_unit_cost(menu):
    g = Gen('unitcost')
    data = []
    for i in range(18):
        it, unit = ITEMS[(i * 7) % len(ITEMS)]
        oq, iq = g.r.randint(0, 120), g.r.randint(10, 300)
        op, ip = g.r.choice([12, 45, 85, 150, 320, 1250]) * 1000, 0
        ip = round(op * g.r.uniform(0.95, 1.08) / 100) * 100
        oa, ia = oq * op, iq * ip
        uc = round((oa + ia) / (oq + iq)) if oq + iq else 0
        xq = min(oq + iq, g.r.randint(5, 250))
        xa = xq * uc
        data.append(dict(ItemID=f'VT{(i * 7) % len(ITEMS) + 1:04d}', ItemName=it, Unit=unit, OpenQty=oq, OpenAmount=oa, InQty=iq, InAmount=ia,
                         UnitCost=uc, OutQty=xq, OutAmount=xa, EndQty=oq + iq - xq, EndAmount=oa + ia - xa))
    cols = [col('ItemID', 'Mã hàng', width=95, frozen=True), col('ItemName', 'Tên hàng', width=240), col('Unit', 'ĐVT', width=65),
            col('OpenQty', 'Tồn đầu SL', 'quantity', sum='sum', decimals=0), col('OpenAmount', 'Tồn đầu tiền', 'money'), col('InQty', 'Nhập SL', 'quantity', sum='sum', decimals=0),
            col('InAmount', 'Nhập tiền', 'money'), col('UnitCost', 'Đơn giá xuất', 'money', sum=None), col('OutQty', 'Xuất SL', 'quantity', sum='sum', decimals=0),
            col('OutAmount', 'Giá vốn xuất', 'money'), col('EndQty', 'Tồn cuối SL', 'quantity', sum='sum', decimals=0), col('EndAmount', 'Tồn cuối tiền', 'money')]
    cost = [('AVG', 'Bình quân cuối kỳ'), ('AVGS', 'Bình quân cuối kỳ theo kho'), ('AVGD', 'Bình quân di động'), ('FIFO', 'Nhập trước xuất trước')]
    fields = [F('FromPeriod', 'Từ kỳ', 'select', 8, options=PERIOD_OPTS), F('ToPeriod', 'Đến kỳ', 'select', 8, options=PERIOD_OPTS),
              F('CostMethod', 'Phương pháp', 'select', 12, options=cost), F('StoreHouseID', 'Kho', 'select', 10),
              F('ItemID', 'Mặt hàng (để trống = tất cả)', 'lookup', 14, lookup=LOOKUPS['ItemID'], row_start=True),
              B('UpdateOutput', 'Cập nhật giá vốn vào phiếu xuất', span=13)[0]]
    vals = dict(FromPeriod='202610', ToPeriod='202610', CostMethod='AVG', StoreHouseID='', UpdateOutput='true')
    return process_screen(menu, fields, vals, [('custom', 'Tính giá xuất kho', 'run', 'Tính lại giá vốn kỳ 10/2026? Giá vốn trên phiếu xuất sẽ được cập nhật.', 'done',
                                                'Đã tính giá xuất kho kỳ 10/2026 cho 18 mặt hàng; cập nhật 214 dòng phiếu xuất (mock).')],
                          result=('Bảng tính giá xuất kho kỳ 10/2026', cols, data, 'ItemID'),
                          notes=[('info', 'Phương pháp mặc định lấy từ Tham số hệ thống (SY_InitSetup.CostMethod). Kỳ đã khóa sổ không tính lại được.')])


# ---- 3. Kinh doanh -----------------------------------------------------------------------------------------------
def c_daily_sales(menu):
    g = Gen('dailysales')
    data = []
    for i in range(24):
        e_ = i % 8
        d = TODAY - datetime.timedelta(days=i // 8)
        orders = g.r.randint(1, 9)
        rev = orders * g.r.randint(3, 60) * 500000
        data.append(dict(DocumentDate=d, EmployeeID=f'NV{e_ + 1:03d}', EmployeeName=PEOPLE[e_], Route=f'Tuyến {["Q1-Q3", "Q5-Q10", "Thủ Đức", "Bình Thạnh", "Gò Vấp", "Hoàn Kiếm", "Cầu Giấy", "Hải Châu"][e_]}',
                         NewCustomers=g.r.randint(0, 4), VisitedCustomers=g.r.randint(4, 16), Orders=orders, Revenue=rev,
                         Collected=round(rev * g.r.choice([0, 0.3, 0.5, 1]) / 1000) * 1000, Notes=g.r.choice(['', '', 'Khách hẹn tuần sau', 'Đề xuất giảm giá 3%', 'Cần hỗ trợ kỹ thuật demo'])))
    cols = [col('DocumentDate', 'Ngày', 'date', frozen=True), col('EmployeeID', 'Mã NV', width=80), col('EmployeeName', 'Nhân viên', width=170),
            col('Route', 'Tuyến', width=140), col('NewCustomers', 'Khách mới', 'number', sum='sum'), col('VisitedCustomers', 'Khách cũ ghé thăm', 'number', sum='sum', width=110),
            col('Orders', 'Số đơn', 'number', sum='sum'), col('Revenue', 'Doanh số', 'money'), col('Collected', 'Đã thu', 'money'), col('Notes', 'Ghi chú', width=220)]
    filt = sel_filter(screen_name(menu), [F('FromDate', 'Từ ngày', 'date', 6, value=(TODAY - datetime.timedelta(days=2)).isoformat()),
                                          F('ToDate', 'Đến ngày', 'date', 6, value=TODAY.isoformat()),
                                          F('EmployeeID', 'Nhân viên', 'lookup', 12, lookup=LOOKUPS['EmployeeID']), F('BranchID', 'Chi nhánh', 'select', 8)])
    return grid_screen(menu, [('T0', 'Báo cáo ngày', cols, data, None)], editable=False, form_type='LIST', filt=filt)

def c_invoice_log(menu):
    g = Gen('invlog')
    kinds = ['Đồng bộ HĐ đầu vào', 'Đồng bộ HĐ đầu ra', 'Tải XML hóa đơn', 'Đối chiếu chứng từ']
    data = []
    for i in range(32):
        err = i % 9 == 4
        k = kinds[i % 4]
        n = g.r.randint(3, 60)
        t = datetime.datetime.combine(TODAY - datetime.timedelta(days=i // 6), datetime.time(22 - (i % 6) * 3, (i * 7) % 60))
        memo = (f'{k}: lỗi kết nối cổng hóa đơn (hết thời gian chờ), sẽ thử lại lần sau' if err else
                f'{k} từ {t - datetime.timedelta(days=1):%d/%m/%Y} đến {t:%d/%m/%Y}: {n} hóa đơn, {g.r.randint(0, n // 4)} hóa đơn mới')
        data.append(dict(Logtime=t, LogType=k, Memo=memo, UserName='Hệ thống' if i % 3 else 'admin',
                         isError=('1', 'Lỗi', 'danger') if err else ('0', 'Thành công', 'success'), _tone='danger' if err else None))
    cols = [col('Logtime', 'Thời gian', 'datetime', frozen=True), col('LogType', 'Loại đồng bộ', width=170), col('Memo', 'Nội dung', width=460, wrap=True),
            col('UserName', 'Người chạy', width=110), col('isError', 'Kết quả', 'status', width=110)]
    filt = sel_filter(screen_name(menu), [F('FromDate', 'Từ ngày', 'date', 6, value=(TODAY - datetime.timedelta(days=7)).isoformat()),
                                          F('ToDate', 'Đến ngày', 'date', 6, value=TODAY.isoformat()),
                                          F('LogType', 'Loại', 'select', 10, options=[(k, k) for k in kinds]), B('OnlyError', 'Chỉ dòng lỗi')[0]])
    return grid_screen(menu, [('T0', 'Lịch sử', cols, data, None)], editable=False, form_type='LIST', filt=filt,
                       tools=[s_btn('custom', f'act-{screen_name(menu)}', f'{BASE}/actions/custom-ok.html', 'Đồng bộ ngay', data_icon='reload')],
                       sel_tools=[])



CURATED = {
    'NGUOIDUNGNHOMFRM': c_user_groups, 'NGUOIDUNGFRM': c_users, 'NGUOIDUNGPHANQUYENFRM': c_permissions,
    'NGUOIDUNGPHANQUYENWAFRM': c_permissions_web, 'FISCALFRM': c_fiscal, 'SETUPFRM': c_setup, 'SYSTEMLANGSETUPFRM': c_lang,
    'USERLOGFRM': c_userlog, 'BACKUPDATAFRM': c_backup, 'RESTOREDATAFRM': c_restore, 'EPOSTSETTINGVIETTELFRM': c_epost,
    'CHANGEPASSWORDFRM': c_change_password, 'PERIODSETUPFRM': c_period_close, 'PERIODLOCKDATAFRM': c_period_lock_data,
    'SY_LOCKDOCUMENTFRM': c_lock_documents, 'SY_NOTIFYLISTFRM': c_notify,
    'GJ_BALANCEACCOUNTFRM': c_balance_account, 'GJ_BALANCEOBJECTFRM': c_balance_object, 'GJ_BALANCEITEMFRM': c_balance_item,
    'GJ_BALANCESHEETSETUPFRM': c_bs_setup, 'GJ_PROFITLOSSSETUPFRM': c_pl_setup, 'GJ_CASHFLOWSETUPFRM': c_cf_setup,
    'GJ_ALLOCATEFRM': c_allocate_cost, 'FA_DEPRECIATEFRM': c_depreciate, 'EQ_ALLOCATEFRM': c_allocate_equip,
    'IV_UNITCOSTPROCESSFRM': c_unit_cost, 'AR_BAOCAONGAYTONGHOPFRM': c_daily_sales, 'GJ_INVOICELOGFRM': c_invoice_log,
}


def build_dialogs():
    """Hộp thoại phụ của các màn viết tay."""
    write('actions/copy-permission.html', page('Sao chép quyền', f'''<section data-erp="dialog" data-size="sm"><h1>Sao chép quyền từ nhóm khác</h1>
<form data-erp="record" id="dlg-copyperm" method="post" action="{BASE}/actions/custom-ok.html">{TOKEN}
{field_html('dlg', F('FromGroup', 'Sao chép từ nhóm', 'select', 40, options=GROUP_OPTS), 'KINHDOANH', mode='edit')}
{field_html('dlg', F('ToGroups', 'Áp cho các nhóm', 'multiselect', 40, options=GROUP_OPTS), '', mode='edit')}
{field_html('dlg', F('Overwrite', 'Ghi đè quyền đang có', 'checkbox', 40), 'false', mode='edit')}
<button type="submit" data-action="save">Sao chép</button> <button type="button" data-action="close">Đóng</button></form></section>'''))
    write('actions/fiscal-new-year.html', page('Khai báo năm', f'''<section data-erp="dialog" data-size="sm"><h1>Khai báo năm tài chính</h1>
<form data-erp="record" id="dlg-fiscal" method="post" action="{BASE}/actions/custom-ok.html">{TOKEN}
{field_html('dlg', F('YearID', 'Năm', 'number', 20, decimals=0), '2027', mode='edit')}
{field_html('dlg', F('StartMonth', 'Tháng bắt đầu', 'select', 20, options=[(str(m), f'Tháng {m}') for m in range(1, 13)]), '1', mode='edit')}
{field_html('dlg', F('CopyFrom', 'Sao chép cấu trúc từ năm', 'select', 40, options=[('', '(Không)'), ('2026', '2026'), ('2025', '2025')]), '', mode='edit')}
<button type="submit" data-action="save">Tạo 4 quý, 12 kỳ</button> <button type="button" data-action="close">Đóng</button></form></section>'''))

# ---------------------------------------------------------------------------------------------------------------
# Lookup, phiên, đăng nhập, trang chủ, hành động
# ---------------------------------------------------------------------------------------------------------------
def build_lookups():
    def lk(name, head, rows):
        out = [f'<table data-erp="lookup-result" data-total="{len(rows)}"><thead><tr>']
        out += [f'<th data-field="{f}"{" data-hidden" if h else ""}>{e(c)}</th>' for f, c, h in head]
        out.append('</tr></thead><tbody>')
        for v, t, cells in rows:
            out.append(f'<tr data-value="{e(v)}" data-text="{e(t)}">' + ''.join(f'<td>{e(x)}</td>' for x in cells) + '</tr>')
        out.append('</tbody></table>')
        write(f'lookups/{name}.html', page(name, ''.join(out)))
    g = Gen('lookups')
    objs = []
    for i, c in enumerate(COMPANIES):
        addr = f'{g.r.randint(1, 250)} {g.r.choice(STREETS)}, {g.r.choice(CITIES)}'
        objs.append((f'KH{i + 1:04d}', c, [f'KH{i + 1:04d}', c, addr, f'03{g.r.randint(10000000, 99999999)}']))
    lk('CF_ObjectTbl', [('ObjectID', 'Mã', 0), ('ObjectName', 'Tên đối tượng', 0), ('Address', 'Địa chỉ', 0), ('TaxCode', 'MST', 0)], objs)
    lk('CF_ItemTbl', [('ItemID', 'Mã hàng', 0), ('ItemName', 'Tên hàng', 0), ('Unit', 'ĐVT', 0), ('UnitID', 'ĐVT', 1)],
       [(f'VT{i + 1:04d}', n, [f'VT{i + 1:04d}', n, u, u]) for i, (n, u) in enumerate(ITEMS)])
    lk('CF_EmployeeTbl', [('EmployeeID', 'Mã NV', 0), ('EmployeeName', 'Họ tên', 0)],
       [(f'NV{i + 1:03d}', n, [f'NV{i + 1:03d}', n]) for i, n in enumerate(PEOPLE)])
    lk('CF_ChartAccTbl', [('AccountID', 'Tài khoản', 0), ('AccountName', 'Tên tài khoản', 0)],
       [(a, n, [a, n]) for a, n in ACCOUNTS])
    lk('CF_CostCenterTbl', [('CostCenterID', 'Mã bộ phận', 0), ('CostCenterName', 'Tên bộ phận', 0)],
       [(a, n, [a, n]) for a, n in COSTCENTERS])


def build_session_login_home(first_screens):
    write('session.html', page('Phiên làm việc', '''<section data-erp="session">
<dl>
<div data-key="company"><dt>Công ty</dt><dd>CÔNG TY CỔ PHẦN DEMO MEDCOM</dd></div>
<div data-key="tax-code"><dt>MST</dt><dd>0300000000</dd></div>
<div data-key="branch"><dt>Chi nhánh</dt><dd data-value="HN">Hà Nội</dd></div>
<div data-key="period"><dt>Kỳ</dt><dd data-value="202611">11/2026</dd></div>
<div data-key="database"><dt>Dữ liệu</dt><dd>MedData (mock)</dd></div>
<div data-key="user"><dt>Người dùng</dt><dd data-value="admin">Quản trị hệ thống</dd></div>
<div data-key="language"><dt>Ngôn ngữ</dt><dd data-value="vi">Tiếng Việt</dd></div>
</dl>
<a data-action="change-password" href="/mock/actions/change-password.html" data-target="dialog">Đổi mật khẩu</a>
<a data-action="logout" href="/mock/login.html">Đăng xuất</a>
</section>'''))
    write('login.html', page('Đăng nhập', f'''<form data-erp="login" method="post" action="{BASE}/session.html">
<h1>Đăng nhập ERP</h1>
<div data-erp="field" data-control="select" data-span="40"><label for="lg-db">Dữ liệu</label>
<select id="lg-db" name="Database"><option value="MedData">Medcom – MedData</option><option value="Medcom">Medcom – Medcom (cũ)</option></select></div>
<div data-erp="field" data-control="text" data-span="40"><label for="lg-u">Tên đăng nhập</label>
<input id="lg-u" name="UserName" autocomplete="username" required value="admin"></div>
<div data-erp="field" data-control="password" data-span="40"><label for="lg-p">Mật khẩu</label>
<input id="lg-p" name="Password" type="password" autocomplete="current-password" required></div>
{TOKEN}
<button type="submit" data-action="login">Đăng nhập</button>
</form>'''))
    kpis = [('Doanh thu tháng', '4.825.000.000', 'success'), ('Công nợ phải thu', '1.932.500.000', 'warning'),
            ('Đơn hàng chờ duyệt', '17', 'info'), ('Đề nghị nhập chờ xử lý', '9', 'neutral')]
    kp = ''.join(f'<section data-erp="kpi" data-tone="{t}"><h2>{e(n)}</h2><data value="{v.replace(".", "")}">{v}</data></section>' for n, v, t in kpis)
    months = [('T6', 3.1), ('T7', 3.6), ('T8', 4.2), ('T9', 3.9), ('T10', 4.6), ('T11', 4.8)]
    chart = ('<table data-erp="chart" data-chart="bar"><caption>Doanh thu 6 tháng (tỷ đồng)</caption><thead><tr><th data-field="m">Tháng</th>'
             '<th data-field="v" data-type="number">Doanh thu</th></tr></thead><tbody>' +
             ''.join(f'<tr><td>{m}</td><td data-value="{v}">{v}</td></tr>' for m, v in months) + '</tbody></table>')
    links = ''.join(f'<li><a href="{e(u)}" data-target="tab">{e(c)}</a></li>' for c, u in first_screens[:8])
    write('home.html', page('Trang chủ', f'''<section data-erp="screen" data-screen-id="Home" data-form-type="DASHBOARD" data-mode="view" data-screen-key="Home">
<h1>Trang chủ</h1>
{kp}
{chart}
<section data-erp="tab-panel" data-title="Truy cập nhanh"><ul>{links}</ul></section>
<div data-erp="messages"><p data-erp="message" data-msg-type="info">Đây là bản demo chạy bằng mock HTML sinh từ metadata Medcom. Dữ liệu là dữ liệu giả.</p></div>
</section>'''))


def tw(mm):
    """mm → twip (đơn vị của .rpx)."""
    return str(round(mm * 1440 / 25.4))


def build_print():
    """Mẫu in (chuẩn 15.1): hai màn in với dữ liệu giả.
    - Phiếu thu: mẫu JSON erp-print-template/1 (mẫu web).
    - Hóa đơn: tệp .rpx tự viết theo cấu trúc ActiveReports 3 (FE tự chuyển, như mẫu WinForms của khách)."""
    T = lambda id, x, y, w, h, value, **kw: dict(id=id, type='text', x=x, y=y, w=w, h=h, value=value, **kw)
    B = {'top': {'style': 'solid'}, 'right': {'style': 'solid'}, 'bottom': {'style': 'solid'}, 'left': {'style': 'solid'}}
    bold = {'bold': True}
    receipt = {
        '$schema': 'erp-print-template/1', 'id': 'CS_ReceiptReport', 'title': 'Phiếu thu', 'unit': 'mm',
        'page': {'paper': 'A5', 'orientation': 'portrait', 'width': 148, 'height': 210,
                 'margin': {'top': 8, 'right': 8, 'bottom': 8, 'left': 10}, 'bodyWidth': 130},
        'data': {'sort': {'auto': True}},
        'styles': {'Normal': {'font': 'Times New Roman', 'size': 10}},
        'groups': [{'id': 'GH1', 'by': 'DocumentID', 'newPage': 'before', 'keepTogether': 'firstDetail', 'repeatHeader': 'onPage'}],
        'bands': [
            {'id': 'PageHeader', 'type': 'pageHeader', 'height': 11, 'controls': [
                T('SysCom1', 0, 0, 80, 5, {'sys': 'SysCom1', 'fallback': 'TÊN CÔNG TY'}, style={'bold': True, 'size': 10}, role='company.line1'),
                T('SysCom2', 0, 5, 80, 5, {'sys': 'SysCom2', 'fallback': 'Địa chỉ'}, style={'size': 8}, role='company.line2'),
                T('mau', 82, 0, 48, 10, {'text': 'Mẫu số 01 - TT\n(Ban hành theo TT 200/2014/TT-BTC)'}, style={'size': 7, 'align': 'center', 'italic': True}),
            ]},
            {'id': 'GH1', 'type': 'groupHeader', 'group': 'GH1', 'height': 54, 'keepTogether': True, 'controls': [
                T('title', 0, 2, 130, 8, {'text': 'PHIẾU THU'}, style={'bold': True, 'size': 16, 'align': 'center', 'valign': 'middle'}),
                T('ngay', 0, 10, 130, 5, {'dateText': 'Ngày {D} tháng {M} năm {Y}', 'field': 'DocumentDate'}, style={'italic': True, 'align': 'center'}),
                T('soL', 88, 15, 12, 5, {'text': 'Số:'}), T('so', 100, 15, 30, 5, {'field': 'DocumentID'}, style=bold),
                T('nopL', 0, 21, 42, 5, {'text': 'Họ và tên người nộp tiền:'}), T('nop', 42, 21, 88, 5, {'field': 'ObjectName'}, style=bold, canGrow=True),
                T('dcL', 0, 26, 18, 5, {'text': 'Địa chỉ:'}), T('dc', 18, 26, 112, 5, {'field': 'Address'}, canGrow=True),
                T('ldL', 0, 31, 22, 5, {'text': 'Lý do nộp:'}), T('ld', 22, 31, 108, 5, {'field': 'Description'}, canGrow=True),
                T('stL', 0, 36, 18, 5, {'text': 'Số tiền:'}),
                T('st', 18, 36, 50, 5, {'field': 'Amount'}, style=bold, format='#,##0',
                  summary={'func': 'sum', 'scope': 'group:GH1', 'running': 'none', 'lookAhead': True}),
                T('vbcL', 0, 41, 26, 5, {'text': 'Viết bằng chữ:'}),
                T('vbc', 26, 41, 104, 5, {'field': 'Amount'}, style={'italic': True}, canGrow=True, format={'kind': 'words', 'currency': 'VND', 'lang': 'VN'},
                  summary={'func': 'sum', 'scope': 'group:GH1', 'running': 'none', 'lookAhead': True}),
                T('h1', 0, 48, 10, 6, {'text': 'STT'}, border=B, style={'bold': True, 'align': 'center', 'valign': 'middle'}),
                T('h2', 10, 48, 70, 6, {'text': 'Diễn giải'}, border=B, style={'bold': True, 'align': 'center', 'valign': 'middle'}),
                T('h3', 80, 48, 20, 6, {'text': 'TK Có'}, border=B, style={'bold': True, 'align': 'center', 'valign': 'middle'}),
                T('h4', 100, 48, 30, 6, {'text': 'Số tiền'}, border=B, style={'bold': True, 'align': 'center', 'valign': 'middle'}),
            ]},
            {'id': 'Detail', 'type': 'detail', 'height': 6, 'keepTogether': True, 'stretchControls': True, 'controls': [
                T('stt', 0, 0, 10, 6, {'field': 'LineID'}, border=B, canGrow=True, style={'align': 'center', 'valign': 'middle'},
                  summary={'func': 'count', 'scope': 'group:GH1', 'running': 'group'}),
                T('dg', 10, 0, 70, 6, {'field': 'LineDescription'}, border=B, canGrow=True, padding={'l': 2, 'r': 2}, style={'valign': 'middle'}),
                T('tk', 80, 0, 20, 6, {'field': 'CreditAccount'}, border=B, canGrow=True, style={'align': 'center', 'valign': 'middle'}),
                T('tien', 100, 0, 30, 6, {'field': 'LineAmount'}, border=B, canGrow=True, format='#,###', padding={'r': 2},
                  style={'align': 'right', 'valign': 'middle'}, rules=[{'when': 'LineAmount < 0', 'style': {'color': '#c00000'}}]),
            ]},
            {'id': 'GF1', 'type': 'groupFooter', 'group': 'GH1', 'height': 34, 'controls': [
                T('tcL', 10, 0, 90, 6, {'text': 'Cộng'}, border=B, style={'bold': True, 'align': 'center', 'valign': 'middle'}),
                T('tc', 100, 0, 30, 6, {'field': 'LineAmount'}, border=B, format='#,###', padding={'r': 2}, style={'bold': True, 'align': 'right', 'valign': 'middle'},
                  summary={'func': 'sum', 'scope': 'group:GH1', 'running': 'none'}),
                T('k0', 0, 0, 10, 6, {'text': ''}, border=B),
                *[T(f'sig{i}', i * 26, 10, 26, 5, {'text': t}, style={'bold': True, 'align': 'center'}) for i, t in
                  enumerate(['Giám đốc', 'Kế toán trưởng', 'Người nộp tiền', 'Người lập phiếu', 'Thủ quỹ'])],
                *[T(f'sigh{i}', i * 26, 15, 26, 4, {'text': '(Ký, họ tên)'}, style={'italic': True, 'size': 8, 'align': 'center'}) for i in range(5)],
                T('lap', 78, 29, 26, 5, {'field': 'UserCreateName'}, style={'align': 'center'}),
            ]},
            {'id': 'PageFooter', 'type': 'pageFooter', 'height': 5, 'controls': [
                {'id': 'line', 'type': 'line', 'x1': 0, 'y1': 0.3, 'x2': 130, 'y2': 0.3},
                T('in', 0, 0.6, 70, 4, {'printDate': True}, style={'size': 7, 'italic': True}),
                T('LngPageInfo', 90, 0.6, 40, 4, {'pageInfo': 'VN'}, style={'size': 8, 'align': 'right'}, role='page.info'),
            ]},
        ],
        'assets': {},
        'source': {'kind': 'web', 'converter': '', 'warnings': []},
    }
    write('print/templates/CS_ReceiptReport.json', json.dumps(receipt, ensure_ascii=False, indent=1) + '\n')

    # ---- .rpx giả (cấu trúc ActiveReports 3.1 như mẫu WinForms) ----
    def ctl(typ, name, x, y, w, h, **a):
        attrs = ''.join(f' {k}="{e(v)}"' for k, v in a.items())
        return f'      <Control Type="{typ}" Name="{name}" Left="{tw(x)}" Top="{tw(y)}" Width="{tw(w)}" Height="{tw(h)}"{attrs} />\n'
    cell = dict(BorderLeftStyle='1', BorderRightStyle='1', BorderTopStyle='1', BorderBottomStyle='1')
    st = lambda extra='': f'font-family: Arial; font-size: 9pt; vertical-align: middle; {extra}'
    gh = (ctl('AR.Label', 'SysCom1', 0, 0, 110, 5, Caption='', Style=st('font-weight: bold'))
          + ctl('AR.Label', 'SysCom2', 0, 5, 110, 4, Caption='', Style=st('font-size: 8pt'))
          + ctl('AR.Label', 'aaTitle', 0, 12, 190, 8, Caption='HÓA ĐƠN BÁN HÀNG', Style='font-family: Arial; font-size: 16pt; font-weight: bold; text-align: center')
          + ctl('AR.Field', 'DATETIMEREPORT_01', 0, 20, 190, 5, DataField='DocumentDate', Text='Ngày {D} tháng {M} năm {Y}', CanGrow='0', Style=st('font-style: italic; text-align: center'))
          + ctl('AR.Label', 'aaSo', 140, 25, 15, 5, Caption='Số:', Style=st())
          + ctl('AR.Field', 'SoCT', 155, 25, 35, 5, DataField='DocumentID', Style=st('font-weight: bold'))
          + ctl('AR.Label', 'aaKH', 0, 31, 30, 5, Caption='Khách hàng:', Style=st())
          + ctl('AR.Field', 'ObjectName', 30, 31, 160, 5, DataField='ObjectName', Style=st('font-weight: bold'))
          + ctl('AR.Label', 'aaDC', 0, 36, 30, 5, Caption='Địa chỉ:', Style=st())
          + ctl('AR.Field', 'Address', 30, 36, 160, 5, DataField='Address', Style=st())
          + ctl('AR.Label', 'aaMST', 0, 41, 30, 5, Caption='Mã số thuế:', Style=st())
          + ctl('AR.Field', 'TaxCode', 30, 41, 60, 5, DataField='TaxCode', Style=st())
          + ''.join(ctl('AR.Label', f'hd{i}', x, 48, w, 7, Caption=c, Style=st('font-weight: bold; text-align: center'), **cell)
                    for i, (x, w, c) in enumerate([(0, 10, 'STT'), (10, 25, 'Mã hàng'), (35, 70, 'Tên hàng hóa, dịch vụ'), (105, 15, 'ĐVT'),
                                                   (120, 20, 'Số lượng'), (140, 22, 'Đơn giá'), (162, 28, 'Thành tiền')])))
    det = (ctl('AR.Field', 'STT', 0, 0, 10, 6, DataField='ItemID', SummaryType='3', SummaryFunc='2', SummaryRunning='1', SummaryGroup='GroupHeader1', Style=st('text-align: center'), **cell)
           + ctl('AR.Field', 'ItemID', 10, 0, 25, 6, DataField='ItemID', Style=st(), **cell)
           + ctl('AR.Field', 'ItemName', 35, 0, 70, 6, DataField='ItemName', Style=st(), Tag='isBold', **cell)
           + ctl('AR.Field', 'UnitID', 105, 0, 15, 6, DataField='UnitID', Style=st('text-align: center'), **cell)
           + ctl('AR.Field', 'Quantity', 120, 0, 20, 6, DataField='Quantity', OutputFormat='#,##0.##', Style=st('text-align: right'), **cell)
           + ctl('AR.Field', 'Price', 140, 0, 22, 6, DataField='Price', OutputFormat='#,###', Style=st('text-align: right'), **cell)
           + ctl('AR.Field', 'Amount', 162, 0, 28, 6, DataField='Amount', OutputFormat='#,###', Style=st('text-align: right'), **cell))
    gf = (ctl('AR.Label', 'aaCong', 0, 0, 162, 6, Caption='Cộng tiền hàng', Style=st('font-weight: bold; text-align: right'), **cell)
          + ctl('AR.Field', 'TongTien', 162, 0, 28, 6, DataField='Amount', OutputFormat='#,###', SummaryType='3', SummaryGroup='GroupHeader1', Style=st('font-weight: bold; text-align: right'), **cell)
          + ctl('AR.Label', 'aaVAT', 0, 6, 162, 6, Caption='Thuế GTGT (10%)', Style=st('text-align: right'), **cell)
          + ctl('AR.Field', 'TienThue', 162, 6, 28, 6, DataField='=Amount * 0.1', OutputFormat='#,###', SummaryType='3', SummaryGroup='GroupHeader1', Style=st('text-align: right'), **cell)
          + ctl('AR.Label', 'aaTT', 0, 12, 162, 6, Caption='Tổng cộng tiền thanh toán', Style=st('font-weight: bold; text-align: right'), **cell)
          + ctl('AR.Field', 'TongTT', 162, 12, 28, 6, DataField='=Amount * 1.1', OutputFormat='#,###', SummaryType='3', SummaryGroup='GroupHeader1', Style=st('font-weight: bold; text-align: right'), **cell)
          + ctl('AR.Label', 'aaBC', 0, 19, 40, 5, Caption='Số tiền viết bằng chữ:', Style=st())
          + ctl('AR.Field', 'COUNTNUMBER_01', 40, 19, 150, 5, DataField='=Amount * 1.1', SummaryType='3', SummaryGroup='GroupHeader1', Tag='CountNumber;VND;VN', Style=st('font-style: italic'))
          + ctl('AR.Label', 'aaNM', 10, 28, 60, 5, Caption='Người mua hàng', Style=st('font-weight: bold; text-align: center'))
          + ctl('AR.Label', 'aaNB', 120, 28, 60, 5, Caption='Người bán hàng', Style=st('font-weight: bold; text-align: center')))
    pf = (ctl('AR.Field', 'LngPageInfo', 140, 0, 50, 5, SummaryType='4', Style=st('font-size: 8pt; text-align: right'))
          + ctl('AR.Label', 'sysReportPrintDate', 0, 0, 60, 5, Caption='', Style=st('font-size: 7pt; font-style: italic')))
    rpx = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           f'<ActiveReportsLayout Version="3.1" PrintWidth="{tw(190)}" DocumentName="ARNet Document" ScriptLang="VB.NET" MasterReport="0">\n'
           '  <StyleSheet>\n    <Style Name="Normal" Value="font-family: Arial; font-size: 10pt; color: Black" />\n  </StyleSheet>\n'
           '  <Sections>\n'
           '    <Section Type="ReportHeader" Name="ReportHeader" Visible="0" Height="0" />\n'
           '    <Section Type="PageHeader" Name="PageHeader" Visible="0" Height="0" />\n'
           f'    <Section Type="GroupHeader" Name="GroupHeader1" Height="{tw(55)}" DataField="DocumentID" NewPage="1" KeepTogether="1" RepeatStyle="1">\n{gh}    </Section>\n'
           f'    <Section Type="Detail" Name="Detail" Height="{tw(6)}" KeepTogether="1">\n{det}    </Section>\n'
           f'    <Section Type="GroupFooter" Name="GroupFooter1" Height="{tw(45)}">\n{gf}    </Section>\n'
           f'    <Section Type="PageFooter" Name="PageFooter" Height="{tw(6)}">\n{pf}    </Section>\n'
           '    <Section Type="ReportFooter" Name="ReportFooter" Visible="0" Height="0" />\n'
           '  </Sections>\n'
           f'  <PageSettings LeftMargin="{tw(10)}" RightMargin="{tw(10)}" TopMargin="{tw(10)}" BottomMargin="{tw(10)}" PaperSize="9" />\n'
           '  <Script><![CDATA[Sub ActiveReport_ReportStart\nEnd Sub]]></Script>\n'
           '</ActiveReportsLayout>\n')
    write('print/templates/AR_InvoiceReport.rpx', rpx)

    # ---- dữ liệu giả ----
    sys_rows = [('Sys.SysCom1', 'CÔNG TY TNHH THƯƠNG MẠI MẪU'), ('Sys.SysCom2', 'Số 1 Đường Mẫu, Quận 1, TP. Hồ Chí Minh'),
                ('Sys.SysCom3', 'MST: 0300000000'), ('Sys.ReportLocation', 'TP. Hồ Chí Minh'), ('Sys.ReportPrintDate', '1')]
    def params_dl(extra):
        items = ''.join(f'<dt>{e(k)}</dt><dd data-name="{e(k)}">{e(v)}</dd>' for k, v in sys_rows + extra)
        return f'<dl data-erp="print-params">{items}</dl>'
    fmts = {'DocumentDate': 'dd/MM/yyyy', 'Amount': '#,##0', 'LineAmount': '#,##0', 'Price': '#,##0', 'Quantity': '#,##0.##'}

    def tbl(cols, rows):
        head = ''.join(f'<th data-field="{c}" data-type="{t}"' + (f' data-format="{e(fmts[c])}"' if c in fmts else '') + f'>{c}</th>' for c, t in cols)
        body = []
        for r in rows:
            tds = []
            for (c, t), v in zip(cols, r):
                if v is None:
                    tds.append('<td data-null></td>')
                elif t in ('money', 'quantity', 'number', 'bool'):
                    tds.append(f'<td data-value="{v}">{e(v)}</td>')
                elif t == 'date':
                    tds.append(f'<td data-value="{v}">{v[8:10]}/{v[5:7]}/{v[0:4]}</td>')
                else:
                    tds.append(f'<td>{e(v)}</td>')
            body.append('<tr>' + ''.join(tds) + '</tr>')
        return f'<table data-erp="grid" data-grid-id="R0"><thead><tr>{head}</tr></thead><tbody>{"".join(body)}</tbody></table>'
    def screen(sid, title, key, tpl_src, fmt, tbl_html, docs, templates):
        opts = ''.join(f'<option value="{e(v)}"{" selected" if i == 0 else ""}>{e(t)}</option>' for i, (v, t) in enumerate(templates))
        flt = (f'<form data-erp="filter" method="get" action="{BASE}/print/{sid}.html">'
               f'<input type="hidden" name="DocumentID" value="{e(";".join(docs))}">'
               f'<div data-erp="field" data-control="select" data-span="12"><label for="pt-{sid}">Mẫu in</label><select id="pt-{sid}" name="Template">{opts}</select></div>'
               '<button type="submit" data-action="find">Xem</button></form>')
        return page(title, f'''<section data-erp="screen" data-screen-id="{sid}" data-form-type="REPORT" data-mode="view" data-screen-key="{e(key)}">
<h1>{e(title)}</h1>
{flt}
<section data-erp="print-document" data-template-src="{BASE}/print/templates/{tpl_src}" data-template-format="{fmt}" data-design-href="{BASE}/print/{sid}.designer.html" data-title="{e(title)} {e(docs[0])}" data-number-group="." data-number-decimal=",">
{params_dl([('Template', templates[0][0]), ('DocumentID', ';'.join(docs))])}
{tbl_html}
</section>
<div data-erp="messages"><p data-erp="message" data-msg-type="info">Mock: mẫu và dữ liệu giả. Backend thật trả dữ liệu của SP {e(sid)}Stp (@Template, @DocumentID) và mẫu từ kho mẫu in.</p></div>
</section>''')
    people = ['Nguyễn Văn An', 'Trần Thị Bình', 'Công ty CP Dược phẩm Minh Châu (chi nhánh miền Nam, khu công nghiệp Tân Bình mở rộng)']
    rc = [('DocumentID', 'text'), ('DocumentDate', 'date'), ('ObjectName', 'text'), ('Address', 'text'), ('Description', 'text'),
          ('LineID', 'text'), ('LineDescription', 'text'), ('CreditAccount', 'text'), ('LineAmount', 'money'), ('Amount', 'money'), ('UserCreateName', 'text')]
    rr = []
    docs = []
    for d, (n, who) in enumerate([(3, people[0]), (1, people[1]), (22, people[2])]):
        doc = f'PT1126/{d + 1:04d}'
        docs.append(doc)
        for i in range(n):
            amt = (i + 1) * 1250000 + d * 375000 + (-300000 if (d, i) == (2, 5) else 0)
            rr.append([doc, f'2026-11-{10 + d:02d}', who, f'{12 + d} Đường Số {d + 3}, Phường {d + 1}, TP. Hồ Chí Minh',
                       'Thu tiền bán hàng theo hóa đơn' if d != 2 else 'Thu tiền công nợ tháng 10 và tháng 11 theo biên bản đối chiếu',
                       f'{i + 1}', f'Thu tiền hóa đơn HD{d + 1}{i + 1:03d}' + (' — kèm phí vận chuyển và bốc xếp tại kho' if i % 7 == 3 else ''),
                       '131' if i % 3 else '5111', amt, amt, 'Lê Thu Hà'])
    write('print/CS_ReceiptReport.html', screen('CS_ReceiptReport', 'Phiếu thu', 'print:CS_ReceiptReport', 'CS_ReceiptReport.json', 'json', tbl(rc, rr), docs,
                                                 [('CS_ReceiptReport', 'Phiếu thu (mẫu web)'), ('CS_Receipt2Report', 'Phiếu thu 2 liên')]))
    ic = [('DocumentID', 'text'), ('DocumentDate', 'date'), ('ObjectName', 'text'), ('Address', 'text'), ('TaxCode', 'text'), ('ItemID', 'text'),
          ('ItemName', 'text'), ('UnitID', 'text'), ('Quantity', 'quantity'), ('Price', 'money'), ('Amount', 'money'), ('IsBold', 'bool')]
    ir = []
    idocs = []
    for d, n in enumerate([4, 2]):
        doc = f'HD1126/{d + 1:04d}'
        idocs.append(doc)
        for i in range(n):
            q = [10, 2.5, 120, 1][i % 4]
            p = [185000, 1240000, 9500, 3600000][i % 4]
            ir.append([doc, f'2026-11-{12 + d:02d}', people[d], f'{30 + d} Lê Lợi, Quận 1, TP. Hồ Chí Minh', f'03{d}1234567',
                       f'VT{d}{i:03d}', ['Băng gạc vô trùng 10x10 cm', 'Dung dịch sát khuẩn tay nhanh 500 ml', 'Găng tay y tế', 'Máy đo huyết áp điện tử'][i % 4],
                       ['Hộp', 'Chai', 'Đôi', 'Cái'][i % 4], q, p, round(q * p), 'true' if i == 0 else 'false'])
    write('print/AR_InvoiceReport.html', screen('AR_InvoiceReport', 'Hóa đơn bán hàng', 'print:AR_InvoiceReport', 'AR_InvoiceReport.rpx', 'rpx', tbl(ic, ir), idocs,
                                                 [('AR_InvoiceReport', 'Hóa đơn (mẫu .rpx)')]))

    # ---- trình thiết kế (chuẩn 15.2): mẫu + dữ liệu xem trước + form lưu có token ----
    def designer(sid, title, tpl_src, fmt):
        return page(f'Thiết kế mẫu in — {title}', f'''<section data-erp="screen" data-screen-id="{sid}" data-form-type="CUSTOM" data-mode="edit" data-screen-key="design:{sid}">
<h1>Thiết kế mẫu in — {e(title)}</h1>
<section data-erp="print-designer" data-template-src="{BASE}/print/templates/{tpl_src}" data-template-format="{fmt}" data-preview-src="{BASE}/print/{sid}.html" data-template-name="{sid}">
<form method="post" action="{BASE}/actions/print-template-saved.html">{TOKEN}<input type="hidden" name="Template" value="{sid}"></form>
</section>
<div data-erp="messages"><p data-erp="message" data-msg-type="info">Mock: lưu mẫu trả về thông báo giả, không ghi gì. Backend thật lưu phiên bản vào web.PrintTemplateVersion.</p></div>
</section>''')
    write('print/CS_ReceiptReport.designer.html', designer('CS_ReceiptReport', 'Phiếu thu', 'CS_ReceiptReport.json', 'json'))
    write('print/AR_InvoiceReport.designer.html', designer('AR_InvoiceReport', 'Hóa đơn bán hàng', 'AR_InvoiceReport.rpx', 'rpx'))
    write('actions/print-template-saved.html', page('Đã lưu mẫu in', '<div data-erp="messages"><p data-erp="message" data-msg-type="success">Đã lưu mẫu in (mock, phiên bản nháp 2).</p></div>'))


def build_actions():
    write('actions/custom-ok.html', page('Kết quả', '<div data-erp="messages"><p data-erp="message" data-msg-type="success">Đã thực hiện thao tác (mock).</p></div>'))
    write('actions/deleted.html', page('Đã xóa', '<div data-erp="messages"><p data-erp="message" data-msg-type="success">Đã xóa chứng từ (mock).</p></div>'))
    write('actions/locked.html', page('Lỗi', '<div data-erp="messages"><p data-erp="message" data-msg-type="error" data-legacy-type="1">Ngày chứng từ thuộc kỳ đã khóa sổ, không thể lưu.</p></div>'))
    write('actions/export.html', page('Xuất Excel', '<div data-erp="messages"><p data-erp="message" data-msg-type="info">Mock: backend thật sẽ trả file .xlsx (Content-Disposition: attachment).</p></div>'))
    write('actions/print.html', page('In', '<div data-erp="messages"><p data-erp="message" data-msg-type="info">Mock: backend thật sẽ trả bản in PDF/HTML của mẫu báo cáo.</p></div>'))
    write('actions/attachments.html', page('Đính kèm', f'''<section data-erp="dialog" data-size="md"><h1>Tệp đính kèm</h1>
<section data-erp="attachments" data-upload="{BASE}/actions/custom-ok.html"><ul>
<li><a href="#" download>hop-dong-12-2026.pdf</a> <small>245 KB</small></li>
<li><a href="#" download>bien-ban-giao-nhan.jpg</a> <small>1,2 MB</small></li></ul>
<form method="post" enctype="multipart/form-data" action="{BASE}/actions/custom-ok.html">{TOKEN}<input type="file" name="files" multiple>
<button type="submit" data-action="attach">Tải lên</button></form></section>
<button type="button" data-action="close">Đóng</button></section>'''))
    write('actions/change-password.html', page('Đổi mật khẩu', f'''<section data-erp="dialog" data-size="sm"><h1>Đổi mật khẩu</h1>
<form method="post" action="{BASE}/actions/custom-ok.html">
<div data-erp="field" data-control="password" data-span="40"><label for="cp-o">Mật khẩu cũ</label><input id="cp-o" name="OldPassword" type="password" required></div>
<div data-erp="field" data-control="password" data-span="40"><label for="cp-n">Mật khẩu mới</label><input id="cp-n" name="NewPassword" type="password" required></div>
{TOKEN}<button type="submit" data-action="save">Lưu</button> <button type="button" data-action="close">Đóng</button></form></section>'''))


# ---------------------------------------------------------------------------------------------------------------
# Menu + điều phối
# ---------------------------------------------------------------------------------------------------------------
ROOT_ICON = {'01': 'system', '02': 'catalog', '04': 'office', '05': 'purchase', '06': 'sales', '07': 'warehouse',
             '08': 'stock', '09': 'cash', '10': 'cash', '11': 'tools', '12': 'asset', '14': 'cost', '16': 'ledger',
             '40': 'business', '60': 'hr'}
CORE_DOCS = {   # form viết tay lõi -> (bảng master, [bảng chi tiết], tiền tố)
    'AR_INVOICEFRM': ('AR_InvoiceTbl', ['AR_InvoiceDetailTbl'], 'SI'),
    'AR_RETURNFRM': ('AR_ReturnTbl', ['AR_ReturnDetailTbl'], 'SR'),
    'AR_SERVICEFRM': ('AR_ServiceTbl', ['AR_ServiceDetailTbl'], 'SS'),
    'AP_PURCHASEFRM': ('AP_PurchaseTbl', ['AP_PurchaseDetailTbl'], 'PI'),
    'AP_RETURNFRM': ('AP_ReturnTbl', ['AP_ReturnDetailTbl'], 'PR'),
    'AP_SERVICEFRM': ('AP_ServiceTbl', ['AP_ServiceDetailTbl'], 'PS'),
    'CS_RECEIPTFRM': ('CS_ReceiptTbl', ['CS_ReceiptDetailTbl'], 'PT'),
    'CS_PAYMENTFRM': ('CS_PaymentTbl', ['CS_PaymentDetailTbl'], 'PC'),
    'IV_STOCKINPUTFRM': ('IV_InputTbl', ['IV_InputDetailTbl'], 'PN'),
    'IV_STOCKOUTPUTFRM': ('IV_OutputTbl', ['IV_OutputDetailTbl'], 'PX'),
    'IV_STOCKTRANFERFRM': ('IV_InOutTbl', ['IV_InOutDetailTbl'], 'CK'),
    'IV_STOCKADJUSTFRM': ('IV_StockAdjustTbl', ['IV_StockAdjustDetailTbl'], 'DC'),
    'GJ_ENTRYFRM': ('GJ_EntryTbl', ['GJ_EntryDetailTbl'], 'PK'),
    'AR_STOCKOUTFRM': ('AR_StockOutTbl', ['AR_StockOutDetailTbl'], 'XK'),
    'AR_STOCKINPUTFRM': ('AR_StockInputTbl', ['AR_StockInputDetailTbl'], 'NK'),
}


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    enabled = [r for r in menu_rows if r['EffectiveEnabled'] == '1']
    by_parent = collections.defaultdict(list)
    for r in enabled:
        by_parent[r['Parent']].append(r)
    for k in by_parent:
        by_parent[k].sort(key=lambda r: r['MenuID'])
    urls = {}
    first_screens = []
    built = set()
    for r in enabled:
        fn = r['FormName']
        if not fn:
            continue
        key = (fn.upper(), r['Para'])
        if key in built:
            continue
        built.add(key)
        kind = r['FormKind']
        form = forms.get(fn.upper())
        try:
            if kind == 'bao-cao':
                urls[key] = build_report(r)
            elif kind == 'lenh-he-thong':
                urls[key] = f'{BASE}/login.html'
            elif fn.upper() in CURATED:
                urls[key] = CURATED[fn.upper()](r)
            elif kind == 'dong' and form and form['FormType'] in ('LIST', 'LISTEDIT') and table_cols(form['TableName']):
                urls[key] = build_list(r, form)
            elif kind == 'dong' and form and form['FormType'] == 'EDIT' and table_cols(cfg_get(cfg_of(fn), 'T0', 'TN') or form['TableName']):
                t0 = cfg_get(cfg_of(fn), 'T0', 'TN') or form['TableName']
                prefix = cfg_get(cfg_of(fn), 'DPR') or 'CT'
                urls[key] = build_edit(r, fn, r['CaptionVN'], t0, [form.get('TableDetail'), form.get('TableDetail2')], prefix)
            elif fn.upper() in CORE_DOCS and table_cols(CORE_DOCS[fn.upper()][0]):
                t, d, pre = CORE_DOCS[fn.upper()]
                dt = doc_types.get((fn + (('_' + r['Para']) if r['Para'] else '')).upper()) or doc_types.get(fn.upper())
                if dt:
                    t, d, pre = dt['TableName'] or t, [dt['TableDetail']] if dt.get('TableDetail') else d, dt.get('PreFix') or pre
                urls[key] = build_edit(r, fn, r['CaptionVN'], t, d, pre, r['Para'])
            elif resolve_tables(fn, r['Para']):
                t, d, pre, pk = resolve_tables(fn, r['Para'])
                ft = (form or {}).get('FormType', '')
                if ft in ('LIST', 'LISTEDIT') and not d:
                    urls[key] = build_list(r, dict(FormID=fn, TableName=t, PrimaryKey=pk or guess_pk(t), FormType=ft, CaptionVN=r['CaptionVN']))
                else:
                    urls[key] = build_edit(r, fn, r['CaptionVN'], t, d, pre, r['Para'], pk=pk)
                written['resolved'] += 1
            else:
                note = ('Màn hình viết tay trong ERP.NET — mock chưa dựng. Backend thật sẽ trả HTML theo chuẩn ERP-HTML.'
                        if kind == 'viet-tay' else 'Form động chưa có dữ liệu cấu hình/bảng trong snapshot — mock chưa dựng.')
                urls[key] = build_custom(r, note)
        except Exception as ex:   # không để một form lỗi làm hỏng cả bộ mock
            print('LỖI', fn, ex)
            urls[key] = build_custom(r, f'Lỗi sinh mock: {ex}')
        if kind in ('dong', 'viet-tay') and len(first_screens) < 12 and fn.upper() in CORE_DOCS | {k: 1 for k in ('AP_PURPOSEREQUESTLISTFRM', 'IV_INBOUNDREQUESTFRM')}:
            first_screens.append((r['CaptionVN'], urls[key]))

    def li(r, depth):
        kids = by_parent.get(r['MenuID'], [])
        icon = ROOT_ICON.get(r['MenuID'][:2], '')
        if not r['FormName']:
            if not kids:
                return ''
            inner = ''.join(li(k, depth + 1) for k in kids)
            if not inner:
                return ''
            ic = f' data-icon="{icon}"' if depth == 1 else ''
            return f'<li data-erp="menu-group" data-menu-id="{r["MenuID"]}"{ic}><span>{e(r["CaptionVN"])}</span><ul>{inner}</ul></li>\n'
        kind = {'bao-cao': 'report', 'lenh-he-thong': 'command'}.get(r['FormKind'], 'form')
        url = urls.get((r['FormName'].upper(), r['Para']), '#')
        a = [f'data-erp="menu-item"', f'data-menu-id="{r["MenuID"]}"', f'data-kind="{kind}"',
             f'data-screen-id="{e(r["FormName"])}"']
        if r['Para']:
            a.append(f'data-para="{e(r["Para"])}"')
        if kind == 'command':
            act = 'logout' if r['FormName'].lower() in ('logoff', 'exit') else 'custom'
            return f'<li {" ".join(a)}><a href="{url}" data-action="{act}">{e(r["CaptionVN"])}</a></li>\n'
        return f'<li {" ".join(a)}><a href="{e(url)}">{e(r["CaptionVN"])}</a></li>\n'

    roots = sorted([r for r in enabled if r['Level'] == '1'], key=lambda r: r['MenuID'])
    menu = '<nav data-erp="menu" aria-label="Menu chính"><ul>\n' + ''.join(li(r, 1) for r in roots) + '</ul></nav>'
    write('menu.html', page('Menu', menu))
    build_lookups()
    build_session_login_home(first_screens)
    build_actions()
    build_print()
    build_dialogs()
    total = sum(len(fs) for _, _, fs in os.walk(OUT))
    size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
    print(f'Đã sinh {total} file, {size / 1024 / 1024:.1f} MB vào {OUT}')
    print(dict(written))


if __name__ == '__main__':
    main()
