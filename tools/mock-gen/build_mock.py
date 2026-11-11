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
}
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
SYSTEM_HIDDEN = {'UserAutoID', 'SearchField', 'UID', 'LinkID', 'ParentID', 'rowguid', 'SSMA_TimeStamp', 'BackColor'}
AUDIT = {'UserCreate', 'DateCreate', 'UserUpdate', 'DateUpdate'}
MONEY_HINT = re.compile(r'(Amount|Price|Total|Cost|Tien|Value|Balance|Debit|Credit|Money|Fee|Phi)', re.I)
QTY_HINT = re.compile(r'(Quantity|Qty|SoLuong|Number)$', re.I)


def col_kind(c):
    t, n = c['data_type'], c['column_name']
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
        if n in ('ObjectName', 'NCC', 'CustomerName', 'SupplierName'):
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
    elif ctl == 'lookup':
        src, fill = f['lookup']
        ctrl = (f'<input {common} value="{e(v)}" data-lookup-src="{BASE}/lookups/{src}.html?q={{q}}"'
                + (f' data-lookup-fill="{",".join(fill)}"' if fill else '') + f'{flags}>'
                + f'<output data-erp="lookup-text" for="{_id}">{e(display or "")}</output>')
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
    return f'<div {" ".join(attrs)}>{lab}{ctrl}</div>'


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
                if kind == 'skip':
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
        if kind == 'skip' or n in SYSTEM_HIDDEN or n in AUDIT:
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
        if kind == 'skip':
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
            kind = c['type'] if c['type'] != 'link' else 'text'
            if f == 'StatusName':
                kind = 'status'
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
                a_btn('print', f'{BASE}/actions/print.html', 'In', data_target='_blank'),
            ]))
            parts.append(std_filter(sid, url, with_dates=False, with_branch='BranchID' in [c['field'] for c in cols]))
            parts.append(grid_html('T0', cols, rows, pk, None, selectable='multi', total_rows=n))
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


def build_edit(menu, sid, title, table, details, prefix, para=''):
    """Chứng từ master–detail: danh sách (find) + bản ghi xem/sửa/thêm."""
    g = Gen(sid + para)
    pk = 'DocumentID' if any(c['column_name'] == 'DocumentID' for c in table_cols(table)) else (
        (forms.get(sid.upper()) or {}).get('PrimaryKey') or 'DocumentID')
    statuses = statuses_for(cfg_get(cfg_of(sid), 'T0', 'TN2'))
    tabs = master_fields(sid, table, statuses)
    slots = detail_slots(sid, details)
    rec_dir = f'records/{slug(sid + ("_" + para if para else ""))}'
    list_url = f'{BASE}/screens/{slug(sid + ("_" + para if para else ""))}.html'
    n_records = 3
    # --- danh sách chứng từ
    gcols = grid_cols_for(sid, 'T0', table, max_visible=9)
    if not gcols:
        gcols = [dict(field=pk, caption=caption(pk), type='text', width=120)]
    for c in gcols:
        if c['field'] == pk:
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
                     a_btn('print', f'{BASE}/actions/print.html', 'In', data_target='_blank', data_shortcut='Ctrl+P'),
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
    total = sum(len(fs) for _, _, fs in os.walk(OUT))
    size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
    print(f'Đã sinh {total} file, {size / 1024 / 1024:.1f} MB vào {OUT}')
    print(dict(written))


if __name__ == '__main__':
    main()
