# Dịch ngược ERP.NET / Tools.dll

Các bản build ERP.NET bị obfuscate bằng .NET Reactor: chuỗi ký tự được mã hóa sau một hàm tĩnh
`<Lớp>.<Hàm>(int id)`. Tên lớp/hàm đổi theo từng bản build.

## Quy trình

1. Dịch ngược (ilspycmd 11.1 có sẵn ở `D:\Data\Medcom\TechnicalDocs\db-audit\tools\decompiler\`):

   ```bash
   /d/Data/Medcom/TechnicalDocs/db-audit/tools/decompiler/ilspycmd.exe -p -o .legacy/decompiled/ERP.NET <đường dẫn>/ERP.NET.exe
   ```

2. Tìm hàm giải mã: lời gọi xuất hiện nhiều nhất dạng `Xxxxxxxxxxxxxxxxxx.Yyyyyyyyyyy(123)`:

   ```bash
   grep -rhoE "[A-Za-z0-9]{12,24}\.[A-Za-z0-9]{8,14}\([0-9]+\)" --include=*.cs .legacy/decompiled/ERP.NET | sed -E 's/\([0-9]+\)//' | sort | uniq -c | sort -rn | head -1
   ```

3. Gom các id, rồi chạy `decrypt.ps1` bằng **Windows PowerShell 5.1** (cần .NET Framework để nạp assembly):

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\legacy-decompile\decrypt.ps1 `
     -Asm <exe/dll> -TypeName <Namespace.Lớp> -Method <Hàm> -IdsFile ids.txt -OutFile strings.tsv
   ```

4. Chèn chuỗi trở lại mã nguồn:

   ```bash
   PYTHONIOENCODING=utf-8 python -I tools/legacy-decompile/inline_strings.py .legacy/decompiled/ERP.NET strings.tsv <Lớp>.<Hàm>
   ```

Kết quả nằm trong `.legacy/` (không commit).
