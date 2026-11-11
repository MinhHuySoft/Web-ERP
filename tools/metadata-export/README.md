# Xuất metadata ERP.NET (chỉ đọc)

Mục đích: bổ sung phần còn thiếu của giai đoạn phân tích. Snapshot hiện có (Medcom/MedData, 19/10/2026) chỉ chứa ~32 %
`SY_FrmCfg`, 18/244 dòng `SY_FrmFltTbl`, và **không có** `SY_FrmDrdwTbl` (nguồn combobox/F4), `SY_FmtFldTbl` (nhãn cột),
`SY_FrmExpTbl` (công thức), `SY_RpDTbl/SY_RpTbl/SY_RpFTbl` (tham số + mẫu báo cáo), `SY_StTbl` (thông điệp). Các khách
hàng khác chưa có snapshot nào.

## Chạy

Người dùng tự chạy trong terminal (mật khẩu nhập ẩn, không lưu):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\metadata-export\Export-ErpMetadata.ps1 -Server "<server,port>" -Login "<sql login>" -Database "<DB1>","<DB2>" -OutDir ".legacy\metadata" -IncludeSchema
```

- `-Prefix SY,WA` nếu DB có module Web Admin (`WA_*`).
- `-IncludeSchema`: thêm catalog object/cột/tham số SP/định nghĩa SP-view-function/số dòng.
- `-IncludeReportFiles`: lưu nội dung mẫu báo cáo trong `SY_RpFTbl.FileContent` ra file.

Kết quả: `.legacy\metadata\<DB>\*.json` + `manifest.json` (thư mục `.legacy` không commit).

## An toàn

- Chỉ SELECT từ danh sách bảng cố định trong script; kết nối `ApplicationIntent=ReadOnly`. Nên dùng login chỉ có quyền đọc.
- Không xuất: `SY_User`, `SY_UserLog*`, `SY_Link`, `SY_EmlSetupTbl`, `SY_UserToken`, `SY_UsLc`, `SY_APILog`, `SY_MessageTbl`.
- `SY_Setup`: che giá trị các tham số có tên gợi ý bí mật.
- Tuân thủ `D:\Data\Skills\SQL_SERVER_ERP_DATABASE_SAFETY_SKILL.md`.
