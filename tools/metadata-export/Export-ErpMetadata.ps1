<#
.SYNOPSIS
  Xuất metadata màn hình ERP.NET (bảng SY_*) và catalog schema của một hoặc nhiều database ra JSON. CHỈ ĐỌC.

.DESCRIPTION
  - Chỉ chạy câu SELECT dựng từ danh sách bảng cố định trong script (không nhận SQL từ ngoài).
  - Kết nối với ApplicationIntent=ReadOnly; mật khẩu nhập ẩn, chỉ giữ trong bộ nhớ của tiến trình.
  - KHÔNG xuất bảng người dùng / mật khẩu / nhật ký / email / license (SY_User, SY_UserLog*, SY_Link,
    SY_EmlSetupTbl, SY_UserToken, SY_UsLc, SY_APILog, SY_MessageTbl ...).
  - SY_Setup: giá trị của các tham số có tên gợi ý bí mật (pass, pwd, token, key, secret...) được che.
  - SY_RpFTbl: mặc định chỉ xuất tên/ngày/tiêu đề mẫu báo cáo; thêm -IncludeReportFiles để lưu nội dung mẫu ra file.

  Chạy bằng Windows PowerShell 5.1 (có sẵn System.Data.SqlClient):
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\metadata-export\Export-ErpMetadata.ps1 `
      -Server "<server,port>" -Login "<sql login>" -Database "TinPhong","X22LienMai" -OutDir ".legacy\metadata"

.PARAMETER Prefix
  Tiền tố bảng hệ thống theo ModuleID (mặc định SY; bản Web Admin dùng WA).
#>
param(
    [Parameter(Mandatory = $true)][string]$Server,
    [Parameter(Mandatory = $true)][string]$Login,
    [Parameter(Mandatory = $true)][string[]]$Database,
    [Parameter(Mandatory = $true)][string]$OutDir,
    [string[]]$Prefix = @('SY'),
    [switch]$IncludeSchema,
    [switch]$IncludeReportFiles,
    [int]$CommandTimeout = 120
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Data

# Bảng cấu hình màn hình (hậu tố sau "<Prefix>_")
$ConfigTables = @(
    'Menu', 'FrmLstTbl', 'FrmCfg', 'FrmDrdwTbl', 'FrmExpTbl', 'FrmFltTbl', 'FrmOptBtnTbl', 'FrmGrdActTbl',
    'FrmMstActTbl', 'FrmParTbl', 'FrmCtrTbl', 'FmtFldTbl', 'FmatTbl', 'StTbl', 'RpTbl', 'RpDTbl',
    'DocSetup', 'Setup', 'InitSetup', 'Period', 'Year', 'Quarter', 'ImDatTbl', 'DshBrdCnt',
    'UserGroup', 'UserGroupPermisstion', 'ApproveSetupTbl'
)
$SecretPattern = '(?i)(pass|pwd|token|secret|key|apikey|api_key|mat ?khau|matkhau|smtp|license)'

function New-Conn([string]$Db, [System.Data.SqlClient.SqlCredential]$Cred) {
    $b = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
    $b['Data Source'] = $Server
    $b['Initial Catalog'] = $Db
    $b['Persist Security Info'] = $false
    $b['Pooling'] = $false
    $b['Connect Timeout'] = 20
    $b['Application Name'] = 'Web-ERP metadata export (SELECT only)'
    $b['ApplicationIntent'] = [System.Data.SqlClient.ApplicationIntent]::ReadOnly
    $c = New-Object System.Data.SqlClient.SqlConnection($b.ConnectionString, $Cred)
    $c.Open()
    return $c
}

function Read-Rows([System.Data.SqlClient.SqlConnection]$Conn, [string]$Sql) {
    $cmd = $Conn.CreateCommand()
    $cmd.CommandText = $Sql
    $cmd.CommandTimeout = $CommandTimeout
    $r = $cmd.ExecuteReader()
    try {
        $rows = New-Object System.Collections.Generic.List[object]
        while ($r.Read()) {
            $o = [ordered]@{}
            for ($i = 0; $i -lt $r.FieldCount; $i++) {
                $v = if ($r.IsDBNull($i)) { $null } else { $r.GetValue($i) }
                if ($v -is [byte[]]) { $v = "<binary $($v.Length) bytes>" }
                elseif ($v -is [datetime]) { $v = $v.ToString('yyyy-MM-ddTHH:mm:ss.fff') }
                $o[$r.GetName($i)] = $v
            }
            $rows.Add([pscustomobject]$o)
        }
        return , $rows.ToArray()
    } finally { $r.Dispose(); $cmd.Dispose() }
}

function Test-Table([System.Data.SqlClient.SqlConnection]$Conn, [string]$Name) {
    $cmd = $Conn.CreateCommand()
    $cmd.CommandText = 'SELECT CASE WHEN OBJECT_ID(@n, ''U'') IS NULL THEN 0 ELSE 1 END'
    [void]$cmd.Parameters.AddWithValue('@n', 'dbo.' + $Name)
    try { return ([int]$cmd.ExecuteScalar()) -eq 1 } finally { $cmd.Dispose() }
}

function Save-Json($Data, [string]$Path) {
    $json = ConvertTo-Json -InputObject $Data -Depth 4 -Compress:$false
    [System.IO.File]::WriteAllText($Path, $json, (New-Object System.Text.UTF8Encoding($false)))
}

$sec = Read-Host "Mật khẩu của $Login trên $Server" -AsSecureString
$sec.MakeReadOnly()
$cred = New-Object System.Data.SqlClient.SqlCredential($Login, $sec)

foreach ($db in $Database) {
    $dir = Join-Path $OutDir $db
    [void][System.IO.Directory]::CreateDirectory($dir)
    $manifest = [ordered]@{ database = $db; exportedUtc = [DateTime]::UtcNow.ToString('o'); mode = 'SELECT only'; tables = @() }
    Write-Host "== $db" -ForegroundColor Cyan
    $conn = New-Conn $db $cred
    try {
        foreach ($p in $Prefix) {
            foreach ($suffix in $ConfigTables) {
                $t = "${p}_$suffix"
                if (-not (Test-Table $conn $t)) { continue }
                $rows = Read-Rows $conn "SELECT * FROM dbo.[$t]"
                if ($suffix -eq 'Setup') {
                    foreach ($row in $rows) {
                        if ("$($row.CodeID) $($row.CodeName)" -match $SecretPattern) {
                            if ($row.PSObject.Properties['CodeValue']) { $row.CodeValue = '<masked>' }
                            if ($row.PSObject.Properties['CodeValue2']) { $row.CodeValue2 = '<masked>' }
                        }
                    }
                }
                Save-Json $rows (Join-Path $dir "$t.json")
                $manifest.tables += [ordered]@{ table = $t; rows = $rows.Count }
                Write-Host ("  {0,-28} {1,7} dòng" -f $t, $rows.Count)
            }
            # Mẫu báo cáo lưu trong DB
            $rpf = "${p}_RpFTbl"
            if (Test-Table $conn $rpf) {
                $rows = Read-Rows $conn "SELECT UserAutoID, FileName, FileDate, Title, Notes, DATALENGTH(FileContent) AS FileBytes FROM dbo.[$rpf]"
                Save-Json $rows (Join-Path $dir "$rpf.json")
                $manifest.tables += [ordered]@{ table = $rpf; rows = $rows.Count }
                Write-Host ("  {0,-28} {1,7} dòng (chỉ thông tin mẫu)" -f $rpf, $rows.Count)
                if ($IncludeReportFiles) {
                    $fdir = Join-Path $dir 'report-files'
                    [void][System.IO.Directory]::CreateDirectory($fdir)
                    $cmd = $conn.CreateCommand()
                    $cmd.CommandText = "SELECT UserAutoID, FileName, FileContent FROM dbo.[$rpf] WHERE FileContent IS NOT NULL"
                    $cmd.CommandTimeout = $CommandTimeout
                    $r = $cmd.ExecuteReader()
                    try {
                        while ($r.Read()) {
                            $name = ($r.GetString(0) + '_' + $(if ($r.IsDBNull(1)) { 'noname' } else { $r.GetString(1) })) -replace '[\\/:*?"<>|]', '_'
                            [System.IO.File]::WriteAllBytes((Join-Path $fdir $name), [byte[]]$r.GetValue(2))
                        }
                    } finally { $r.Dispose(); $cmd.Dispose() }
                }
            }
        }
        if ($IncludeSchema) {
            $q = [ordered]@{
                'schema-objects'    = "SELECT o.object_id, s.name AS schema_name, o.name, o.type, o.type_desc, o.create_date, o.modify_date FROM sys.objects o JOIN sys.schemas s ON s.schema_id = o.schema_id WHERE o.is_ms_shipped = 0"
                'schema-columns'    = "SELECT OBJECT_NAME(c.object_id) AS object_name, c.column_id, c.name, t.name AS type_name, c.max_length, c.precision, c.scale, c.is_nullable, c.is_identity, c.is_computed FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id JOIN sys.objects o ON o.object_id = c.object_id WHERE o.is_ms_shipped = 0"
                'schema-parameters' = "SELECT OBJECT_NAME(p.object_id) AS object_name, p.parameter_id, p.name, t.name AS type_name, p.max_length, p.is_output, p.has_default_value FROM sys.parameters p JOIN sys.types t ON t.user_type_id = p.user_type_id JOIN sys.objects o ON o.object_id = p.object_id WHERE o.is_ms_shipped = 0"
                'schema-modules'    = "SELECT OBJECT_NAME(m.object_id) AS object_name, o.type, m.definition FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id WHERE o.is_ms_shipped = 0"
                'schema-rowcounts'  = "SELECT OBJECT_NAME(p.object_id) AS table_name, SUM(p.rows) AS row_count FROM sys.partitions p JOIN sys.tables t ON t.object_id = p.object_id WHERE p.index_id < 2 GROUP BY p.object_id"
            }
            foreach ($k in $q.Keys) {
                $rows = Read-Rows $conn $q[$k]
                Save-Json $rows (Join-Path $dir "$k.json")
                $manifest.tables += [ordered]@{ table = $k; rows = $rows.Count }
                Write-Host ("  {0,-28} {1,7} dòng" -f $k, $rows.Count)
            }
        }
    } finally { $conn.Dispose() }
    Save-Json $manifest (Join-Path $dir 'manifest.json')
}
Write-Host 'Xong. Mật khẩu không được lưu.' -ForegroundColor Green
