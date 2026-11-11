# Cột của mọi bảng `SY_*` — MedData (Medcom)

Nguồn: `run-20261019/columns.json`, `indexes.json`, `row_counts.json` (catalog 2026-10-19, chỉ metadata). Sinh tự động; số dòng là xấp xỉ (`sys.partitions`). PK đánh dấu 🔑 không dùng — cột PK ghi ở dòng tiêu đề.

61 bảng `SY_*`. Kiểu chuỗi ghi theo số ký tự (nvarchar đã chia 2).


## `SY_APILog`

PK: `—` · 6 cột · ~3367 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `LogTime` | datetime |  |  | `(getdate())` |
| 2 | `Fnc` | nvarchar(250) | x |  |  |
| 3 | `para1` | nvarchar(max) | x |  |  |
| 4 | `para2` | nvarchar(max) | x |  |  |
| 5 | `para3` | nvarchar(max) | x |  |  |
| 6 | `para4` | nvarchar(max) | x |  |  |

## `SY_ApproveCountTbl`

PK: `UserAutoID` · 7 cột · ~0 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  |  |
| 2 | `UserName` | varchar(50) |  |  |  |
| 3 | `STT` | decimal(18,0) |  |  |  |
| 4 | `SourceID` | varchar(50) |  |  |  |
| 5 | `DocumentID` | varchar(50) |  |  |  |
| 6 | `DocumentDate` | datetime |  |  | `(getdate())` |
| 7 | `ApproveDate` | datetime |  |  |  |

## `SY_ApproveDocumentTbl`

PK: `UserAutoID` · 45 cột · ~0 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  |  |
| 2 | `SourceID` | varchar(50) |  |  |  |
| 3 | `DocumentID` | varchar(50) |  |  |  |
| 4 | `DocumentDate` | datetime |  |  | `(getdate())` |
| 5 | `BranchID` | varchar(50) | x |  |  |
| 6 | `UserLevel1` | varchar(50) | x |  |  |
| 7 | `UserLevel2` | varchar(50) | x |  |  |
| 8 | `UserLevel3` | varchar(50) | x |  |  |
| 9 | `UserLevel4` | varchar(50) | x |  |  |
| 10 | `UserLevel5` | varchar(50) | x |  |  |
| 11 | `UserCaption1` | nvarchar(50) | x |  |  |
| 12 | `UserCaption2` | nvarchar(50) | x |  |  |
| 13 | `UserCaption3` | nvarchar(50) | x |  |  |
| 14 | `UserCaption4` | nvarchar(50) | x |  |  |
| 15 | `UserCaption5` | nvarchar(50) | x |  |  |
| 16 | `UserRole1` | nvarchar(50) | x |  |  |
| 17 | `UserRole2` | nvarchar(50) | x |  |  |
| 18 | `UserRole3` | nvarchar(50) | x |  |  |
| 19 | `UserRole4` | nvarchar(50) | x |  |  |
| 20 | `UserRole5` | nvarchar(50) | x |  |  |
| 21 | `isApprove1` | int | x |  |  |
| 22 | `isApprove2` | int | x |  |  |
| 23 | `isApprove3` | int | x |  |  |
| 24 | `isApprove4` | int | x |  |  |
| 25 | `isApprove5` | int | x |  |  |
| 26 | `ApproveDate1` | datetime | x |  |  |
| 27 | `ApproveDate2` | datetime | x |  |  |
| 28 | `ApproveDate3` | datetime | x |  |  |
| 29 | `ApproveDate4` | datetime | x |  |  |
| 30 | `ApproveDate5` | datetime | x |  |  |
| 31 | `ApproveNote1` | nvarchar(150) | x |  |  |
| 32 | `ApproveNote2` | nvarchar(150) | x |  |  |
| 33 | `ApproveNote3` | nvarchar(150) | x |  |  |
| 34 | `ApproveNote4` | nvarchar(150) | x |  |  |
| 35 | `ApproveNote5` | nvarchar(150) | x |  |  |
| 36 | `ToApproveID` | varchar(50) | x |  |  |
| 37 | `ToApproveID2` | varchar(50) | x |  |  |
| 38 | `ToUser1` | varchar(50) | x |  |  |
| 39 | `ToUser2` | varchar(50) | x |  |  |
| 40 | `isFinish` | bit |  |  | `(0)` |
| 41 | `isFinishTo` | bit |  |  | `(0)` |
| 42 | `Notifier1` | varchar(50) | x |  |  |
| 43 | `Notifier2` | varchar(50) | x |  |  |
| 44 | `isNotifier1` | bit |  |  | `(0)` |
| 45 | `isNotifier2` | bit |  |  | `(0)` |

## `SY_ApproveSetupTbl`

PK: `ApproveID` · 34 cột · ~0 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `ApproveID` | varchar(50) |  |  |  |
| 2 | `SourceGroup` | nvarchar(150) |  |  |  |
| 3 | `SourceName` | nvarchar(150) |  |  |  |
| 4 | `SourceID` | varchar(50) |  |  |  |
| 5 | `GhiChu` | nvarchar(150) | x |  |  |
| 6 | `Notifier1` | varchar(50) | x |  |  |
| 7 | `Notifier2` | varchar(50) | x |  |  |
| 8 | `UserLevel1` | varchar(50) | x |  |  |
| 9 | `UserLevel2` | varchar(50) | x |  |  |
| 10 | `UserLevel3` | varchar(50) | x |  |  |
| 11 | `UserLevel4` | varchar(50) | x |  |  |
| 12 | `UserLevel5` | varchar(50) | x |  |  |
| 13 | `UserCaption1` | nvarchar(50) | x |  |  |
| 14 | `UserCaption2` | nvarchar(50) | x |  |  |
| 15 | `UserCaption3` | nvarchar(50) | x |  |  |
| 16 | `UserCaption4` | nvarchar(50) | x |  |  |
| 17 | `UserCaption5` | nvarchar(50) | x |  |  |
| 18 | `UserRole1` | nvarchar(50) | x |  |  |
| 19 | `UserRole2` | nvarchar(50) | x |  |  |
| 20 | `UserRole3` | nvarchar(50) | x |  |  |
| 21 | `UserRole4` | nvarchar(50) | x |  |  |
| 22 | `UserRole5` | nvarchar(50) | x |  |  |
| 23 | `isLevelEnd4` | bit | x |  | `(1)` |
| 24 | `isLevelEnd5` | bit | x |  | `(1)` |
| 25 | `ToApproveID` | varchar(50) | x |  |  |
| 26 | `ToApproveID2` | varchar(50) | x |  |  |
| 27 | `ToUser1` | varchar(50) | x |  |  |
| 28 | `ToUser2` | varchar(50) | x |  |  |
| 29 | `TableName` | varchar(50) | x |  |  |
| 30 | `ToTableName` | varchar(50) | x |  |  |
| 31 | `FilterEx` | nvarchar(100) | x |  |  |
| 32 | `FormID` | varchar(50) | x |  |  |
| 33 | `STT` | int | x |  | `(0)` |
| 34 | `ApproveDay` | int | x |  |  |

## `SY_BalanceAccountTbl`

PK: `UserAutoID` · 15 cột · ~9 dòng · FK ra/vào: 1/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  |  |
| 2 | `AccountID` | varchar(50) |  |  |  |
| 3 | `SourceAmount` | decimal(28,2) |  |  | `((0))` |
| 4 | `CurrencyID` | varchar(3) |  |  | `('VND')` |
| 5 | `RateExchange` | float |  |  | `((1))` |
| 6 | `Amount` | decimal(28,0) |  |  | `((0))` |
| 7 | `CostCenterID` | varchar(50) | x |  |  |
| 8 | `isDebit` | bit |  |  | `((1))` |
| 9 | `PeriodID` | varchar(10) |  |  | `((201005))` |
| 10 | `IsBalance` | bit |  |  | `((0))` |
| 11 | `BranchID` | varchar(50) |  |  |  |
| 12 | `SourceDebit` | decimal(18,4) | x |  |  |
| 13 | `SourceCredit` | decimal(18,4) | x |  |  |
| 14 | `AmountDebit` | decimal(18,0) | x |  |  |
| 15 | `AmountCredit` | decimal(18,0) | x |  |  |

## `SY_BalanceFIFO2Tbl`

PK: `UserAutoID` · 16 cột · ~0 dòng · FK ra/vào: 2/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  |  |
| 2 | `StorehouseID` | varchar(50) |  |  |  |
| 3 | `ItemID` | nvarchar(50) |  |  |  |
| 4 | `Lot` | varchar(50) | x |  |  |
| 5 | `InvAccID` | varchar(50) |  |  |  |
| 6 | `Quantity` | decimal(28,8) |  |  |  |
| 7 | `Quantity2` | decimal(28,8) | x |  |  |
| 8 | `Property` | nvarchar(50) | x |  |  |
| 9 | `Property2` | nvarchar(50) | x |  |  |
| 10 | `UnitPrice` | decimal(28,8) | x |  |  |
| 11 | `Amount` | decimal(28,0) | x |  |  |
| 12 | `DocumentID` | varchar(50) | x |  |  |
| 13 | `DocumentDate` | datetime | x |  |  |
| 14 | `QuantityOgrin` | decimal(28,8) | x |  |  |
| 15 | `OutputID` | varchar(50) | x |  |  |
| 16 | `InputID` | varchar(50) | x |  |  |

## `SY_BalanceFIFOTbl`

PK: `UserAutoID` · 14 cột · ~0 dòng · FK ra/vào: 2/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  |  |
| 2 | `StorehouseID` | varchar(50) |  |  |  |
| 3 | `ItemID` | nvarchar(50) |  |  |  |
| 4 | `Lot` | varchar(50) | x |  |  |
| 5 | `InvAccID` | varchar(50) |  |  |  |
| 6 | `Quantity` | decimal(28,8) |  |  |  |
| 7 | `Quantity2` | decimal(28,8) | x |  |  |
| 8 | `Property` | nvarchar(50) | x |  |  |
| 9 | `Property2` | nvarchar(50) | x |  |  |
| 10 | `UnitPrice` | decimal(28,8) | x |  |  |
| 11 | `Amount` | decimal(28,0) | x |  |  |
| 12 | `DocumentID` | varchar(50) | x |  |  |
| 13 | `DocumentDate` | datetime | x |  |  |
| 14 | `isCompleted` | bit | x |  | `((0))` |

## `SY_BalanceItemTbl`

PK: `UserAutoID` · 18 cột · ~690 dòng · FK ra/vào: 3/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(40) |  |  |  |
| 2 | `StorehouseID` | varchar(50) |  |  |  |
| 3 | `ItemID` | nvarchar(50) |  |  |  |
| 4 | `Lot` | varchar(50) | x |  |  |
| 5 | `InvAccID` | varchar(50) |  |  |  |
| 6 | `Quantity` | decimal(28,4) |  |  |  |
| 7 | `Quantity2` | decimal(28,4) | x |  |  |
| 8 | `Property` | nvarchar(50) | x |  |  |
| 9 | `Property2` | nvarchar(50) | x |  |  |
| 10 | `UnitPrice` | decimal(28,4) |  |  | `((0))` |
| 11 | `Amount` | decimal(28,0) |  |  | `((0))` |
| 12 | `PeriodID` | varchar(50) |  |  | `((201005))` |
| 13 | `IsBalance` | bit |  |  | `((0))` |
| 14 | `DocumentID` | varchar(50) | x |  |  |
| 15 | `DocumentDate` | datetime | x |  |  |
| 16 | `CostCenterID` | varchar(50) | x |  |  |
| 17 | `ExpireDate` | datetime | x |  |  |
| 18 | `BranchID` | varchar(50) |  |  |  |

## `SY_BalanceObjectTbl`

PK: `UserAutoID` · 28 cột · ~17 dòng · FK ra/vào: 1/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(40) |  |  |  |
| 2 | `AccountID` | varchar(50) |  |  |  |
| 3 | `ObjectID` | varchar(50) |  |  |  |
| 4 | `SourceAmount` | decimal(28,2) |  |  | `((0))` |
| 5 | `CurrencyID` | varchar(3) |  |  | `('VND')` |
| 6 | `RateExchange` | float |  |  | `((1))` |
| 7 | `Amount` | decimal(28,0) |  |  |  |
| 8 | `IsDebit` | bit |  |  | `((0))` |
| 9 | `ItemID` | nvarchar(50) | x |  |  |
| 10 | `Quantity` | decimal(28,2) | x |  |  |
| 11 | `SourceID` | varchar(3) |  |  | `('BL')` |
| 12 | `DocumentID` | varchar(30) | x |  |  |
| 13 | `DocumentDate` | datetime | x |  |  |
| 14 | `InvoiceNo` | varchar(100) | x |  |  |
| 15 | `PaymentTermID` | varchar(50) | x |  |  |
| 16 | `Memo` | nvarchar(250) | x |  |  |
| 17 | `CostCenterID` | varchar(50) | x |  |  |
| 18 | `PeriodID` | varchar(10) |  |  | `((201005))` |
| 19 | `IsBalance` | bit |  |  | `((0))` |
| 20 | `RefDoc` | varchar(50) | x |  |  |
| 21 | `ContractID` | nvarchar(100) | x |  |  |
| 22 | `EmployeeID` | varchar(50) | x |  |  |
| 23 | `ManagerID` | varchar(50) | x |  |  |
| 24 | `BranchID` | varchar(50) |  |  |  |
| 25 | `SourceDebit` | decimal(18,4) | x |  |  |
| 26 | `SourceCredit` | decimal(18,4) | x |  |  |
| 27 | `AmountDebit` | decimal(18,0) | x |  |  |
| 28 | `AmountCredit` | decimal(18,0) | x |  |  |

## `SY_BalanceOutItemTbl`

PK: `UserAutoID` · 26 cột · ~0 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  | `(newid())` |
| 2 | `SessionDate` | datetime | x |  | `(getdate())` |
| 3 | `SessionID` | varchar(50) | x |  |  |
| 4 | `BranchID` | varchar(50) | x |  |  |
| 5 | `DocumentID` | varchar(50) | x |  |  |
| 6 | `InvAccID` | varchar(50) | x |  |  |
| 7 | `StoreHouseID` | varchar(50) | x |  |  |
| 8 | `ItemID` | varchar(50) | x |  |  |
| 9 | `Quantity` | decimal(18,4) | x |  |  |
| 10 | `QuantityOut` | decimal(18,4) | x |  |  |
| 11 | `Lot` | varchar(50) | x |  |  |
| 12 | `ExpireDate` | datetime | x |  |  |
| 13 | `Property` | varchar(50) | x |  |  |
| 14 | `Property2` | varchar(50) | x |  |  |
| 15 | `StockQuantity` | decimal(18,4) | x |  |  |
| 16 | `UnitPrice2` | decimal(18,6) | x |  |  |
| 17 | `Amount2` | decimal(18,0) | x |  |  |
| 18 | `DiscountPercent2` | decimal(18,6) | x |  |  |
| 19 | `DiscountAmount2` | decimal(18,0) | x |  |  |
| 20 | `VATAmount2` | decimal(18,0) | x |  |  |
| 21 | `Memo` | nvarchar(max) | x |  |  |
| 22 | `Note` | nvarchar(max) | x |  |  |
| 23 | `VATID2` | varchar(50) | x |  |  |
| 24 | `VATPercent2` | decimal(18,0) | x |  |  |
| 25 | `DiscountPercentTT2` | decimal(18,2) | x |  |  |
| 26 | `DiscountAmountTT2` | decimal(18,2) | x |  |  |

## `SY_DbMigrationLogTbl`

PK: `MigrationID` · 8 cột · ~6 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `MigrationID` | varchar(100) |  |  |  |
| 2 | `MigrationName` | nvarchar(250) |  |  |  |
| 3 | `ScriptVersion` | varchar(30) |  |  |  |
| 4 | `StartedAt` | datetime2 |  |  | `(sysdatetime())` |
| 5 | `CompletedAt` | datetime2 | x |  |  |
| 6 | `ExecutedBy` | sysname |  |  | `(suser_sname())` |
| 7 | `Status` | varchar(20) |  |  |  |
| 8 | `Notes` | nvarchar(1000) | x |  |  |

## `SY_DocSetup`

PK: `DocType` · 11 cột · ~44 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `DocType` | varchar(20) |  |  |  |
| 2 | `DocName` | nvarchar(100) |  |  |  |
| 3 | `PreFix` | varchar(4) |  |  |  |
| 4 | `isAuto` | bit |  |  | `(1)` |
| 5 | `AccountID` | varchar(50) | x |  |  |
| 6 | `STT` | int | x |  |  |
| 7 | `TableName` | varchar(150) | x |  |  |
| 8 | `TableDetail` | varchar(150) | x |  |  |
| 9 | `FormID` | varchar(150) | x |  |  |
| 10 | `DocGroupName` | nvarchar(150) | x |  |  |
| 11 | `isAcc` | int | x |  | `(1)` |

## `SY_DocumentCashTbl`

PK: `DocumentType` · 8 cột · ~0 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `DocumentType` | varchar(50) |  |  |  |
| 2 | `DocumentTypeName` | nvarchar(100) | x |  |  |
| 3 | `Prefix` | varchar(10) | x |  |  |
| 4 | `CashAccountID` | varchar(50) | x |  |  |
| 5 | `isPayment` | bit | x |  |  |
| 6 | `isReceipt` | bit | x |  |  |
| 7 | `isBank` | bit | x |  |  |
| 8 | `DocumentMask` | varchar(50) | x |  |  |

## `SY_DshBrd`

PK: `UserAutoID` · 14 cột · ~0 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  |  |
| 2 | `KeyID` | varchar(50) |  |  |  |
| 3 | `KeyName` | nvarchar(150) |  |  |  |
| 4 | `ItemName` | nvarchar(100) | x |  |  |
| 5 | `GiaTri` | decimal(28,4) | x |  |  |
| 6 | `GiaTri2` | decimal(28,4) | x |  |  |
| 7 | `Notes` | nvarchar(100) | x |  |  |
| 8 | `Orderby` | int | x |  | `(9)` |
| 9 | `Action` | nvarchar(100) | x |  |  |
| 10 | `IsWanrning` | bit |  |  | `(0)` |
| 11 | `AccountID` | varchar(50) | x |  |  |
| 12 | `LastUpdate` | datetime | x |  | `(getdate())` |
| 13 | `ItemID` | varchar(50) | x |  |  |
| 14 | `ObjectID` | varchar(50) | x |  |  |

## `SY_DshBrdCnt`

PK: `MenuID` · 3 cột · ~10 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `MenuID` | varchar(50) |  |  |  |
| 2 | `Contain` | image | x |  |  |
| 3 | `Version` | varchar(50) | x |  |  |

## `SY_EmlSetupTbl`

PK: `KeyID` · 26 cột · ~5 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `KeyID` | varchar(50) |  |  |  |
| 2 | `DisplayName` | nvarchar(50) | x |  |  |
| 3 | `Email` | nvarchar(250) |  |  |  |
| 4 | `Pass` | nvarchar(250) | x |  |  |
| 5 | `Subject` | nvarchar(500) | x |  |  |
| 6 | `Recipient` | varchar(2000) | x |  |  |
| 7 | `EmailHeader` | nvarchar(3000) | x |  |  |
| 8 | `EmailFooter` | nvarchar(3000) | x |  |  |
| 9 | `IncomingServer` | nvarchar(250) | x |  |  |
| 10 | `IncomingPort` | int | x |  | `((110))` |
| 11 | `IncomingSecurity` | int | x |  | `((0))` |
| 12 | `IncomingAuthe` | bit | x |  | `((0))` |
| 13 | `IncomingUser` | nvarchar(250) | x |  |  |
| 14 | `IncomingPass` | nvarchar(250) | x |  |  |
| 15 | `ReceiveHeaderOnly` | bit | x |  | `((0))` |
| 16 | `CheckMailInterval` | int | x |  | `((0))` |
| 17 | `CheckEmailAtStartup` | bit | x |  | `((0))` |
| 18 | `MaxEmailSize` | int | x |  | `((0))` |
| 19 | `MaxAttachSize` | int | x |  | `((0))` |
| 20 | `OutgoingServer` | nvarchar(250) | x |  |  |
| 21 | `OutgoingPort` | int | x |  | `((25))` |
| 22 | `OutgoingSecurity` | int | x |  | `((0))` |
| 23 | `OutgoingAuthe` | bit | x |  | `((0))` |
| 24 | `OutgoingUser` | nvarchar(250) | x |  |  |
| 25 | `OutgoingPass` | nvarchar(250) | x |  |  |
| 26 | `isOutlook` | int | x |  |  |

## `SY_FmatTbl`

PK: `FormatID` · 12 cột · ~30 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `FormatID` | varchar(2) |  |  |  |
| 2 | `FormatName` | nvarchar(50) | x |  |  |
| 3 | `NumberDecimal` | int | x |  |  |
| 4 | `FormatString` | nvarchar(100) | x |  |  |
| 5 | `MaskString` | varchar(50) | x |  |  |
| 6 | `MaxLength` | smallint | x |  |  |
| 7 | `Type` | char(1) |  |  | `('S')` |
| 8 | `Params` | varchar(200) | x |  |  |
| 9 | `Align` | char(1) |  |  | `('L')` |
| 10 | `IsComplex` | bit |  |  | `(0)` |
| 11 | `MinValue` | float | x |  |  |
| 12 | `MaxValue` | float | x |  |  |

## `SY_FmtFldTbl`

PK: `AutoID` · 10 cột · ~4215 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 2 | `AutoID` | numeric(18,0) |  | x |  |
| 3 | `FormatID` | varchar(2) | x |  |  |
| 4 | `FieldName` | varchar(50) |  |  |  |
| 5 | `FormName` | varchar(100) | x |  |  |
| 6 | `CaptionVN` | nvarchar(200) | x |  |  |
| 7 | `CaptionEN` | nvarchar(200) | x |  |  |
| 8 | `CaptionCH` | nvarchar(200) | x |  |  |
| 9 | `AlignX` | varchar(2) | x |  |  |
| 10 | `MinWidth` | int | x |  |  |
| 11 | `MaxWidth` | int | x |  |  |

## `SY_FrmCfg`

PK: `UserAutoID` · 8 cột · ~10687 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  |  |
| 2 | `FID` | varchar(250) | x |  |  |
| 3 | `KeyID` | varchar(50) |  |  |  |
| 4 | `SubID` | varchar(50) | x |  |  |
| 5 | `KeyValue` | nvarchar(max) | x |  |  |
| 6 | `SubValue` | nvarchar(max) | x |  |  |
| 7 | `VDate` | datetime | x |  |  |
| 8 | `PFID` | varchar(250) | x |  |  |

## `SY_FrmCtrTbl`

PK: `UserAutoID` · 14 cột · ~174 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  |  |
| 2 | `FormID` | varchar(250) | x |  |  |
| 3 | `ParentCtlName` | nvarchar(500) | x |  |  |
| 4 | `CtlName` | varchar(50) |  |  |  |
| 5 | `CaptionVN` | nvarchar(150) | x |  |  |
| 6 | `CaptionEN` | nvarchar(150) | x |  |  |
| 7 | `CtlTop` | int |  |  | `(0)` |
| 8 | `CtlLeft` | int |  |  | `(0)` |
| 9 | `CaptionWidth` | int |  |  | `(0)` |
| 10 | `Width` | int |  |  | `(0)` |
| 11 | `Height` | int |  |  | `(0)` |
| 12 | `OrderBy` | int |  |  | `(5)` |
| 13 | `IsDisable` | bit |  |  | `(0)` |
| 14 | `CaptionCH` | nvarchar(150) | x |  |  |

## `SY_FrmDrdwTbl`

PK: `UserAutoID` · 42 cột · ~2361 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(40) |  |  |  |
| 2 | `FormID` | varchar(250) | x |  |  |
| 3 | `GridName` | varchar(100) | x |  |  |
| 4 | `ColumnID` | varchar(50) |  |  |  |
| 5 | `ValueColumn` | varchar(50) | x |  |  |
| 6 | `DisplayColumn` | varchar(50) | x |  |  |
| 7 | `ColumnArr` | varchar(500) | x |  |  |
| 8 | `WidthArr` | varchar(500) | x |  |  |
| 9 | `Source` | nvarchar(max) | x |  |  |
| 10 | `LinkColumn` | varchar(500) | x |  |  |
| 11 | `DisableAddNew` | bit | x |  |  |
| 12 | `ParaArr` | varchar(200) | x |  |  |
| 13 | `ParaRequireArr` | varchar(100) | x |  |  |
| 14 | `Type` | varchar(10) | x |  |  |
| 15 | `KeepValue` | bit | x |  | `(0)` |
| 16 | `SummaryFieldArr` | varchar(100) | x |  |  |
| 17 | `IsMultiSelect` | bit | x |  |  |
| 18 | `IsNotInList` | bit | x |  |  |
| 19 | `IsDisable` | bit | x |  | `(0)` |
| 20 | `ColumnName_Filter` | varchar(50) | x |  |  |
| 21 | `ColumnValue_Filter` | varchar(50) | x |  |  |
| 22 | `OnlyValue_Filter` | varchar(50) | x |  |  |
| 23 | `ManualSQLSearch` | bit | x |  | `(0)` |
| 24 | `ManualSQLOrderBy` | varchar(50) | x |  |  |
| 25 | `DefaultValue` | nvarchar(100) | x |  |  |
| 26 | `IsReload` | bit |  |  | `(0)` |
| 27 | `EditableColumns` | varchar(250) | x |  |  |
| 28 | `Caption` | nvarchar(150) | x |  |  |
| 29 | `isLock` | bit |  |  | `(0)` |
| 30 | `isInvisible` | bit |  |  | `(0)` |
| 31 | `isWordWrap` | bit |  |  | `(0)` |
| 32 | `isMultiValue` | bit |  |  | `(0)` |
| 33 | `GroupCaption` | nvarchar(250) | x |  |  |
| 34 | `WordWrapArr` | varchar(250) | x |  |  |
| 35 | `GroupColumnArr` | varchar(100) | x |  |  |
| 36 | `DisplayMember2` | varchar(50) | x |  |  |
| 37 | `TreeViewColumn` | varchar(50) | x |  |  |
| 38 | `TreeViewColumnParent` | varchar(50) | x |  |  |
| 39 | `ReloadType` | int | x |  |  |
| 40 | `EditType` | int | x |  |  |
| 41 | `DefaultValueSQL` | nvarchar(250) | x |  |  |
| 42 | `TriggerOnOpenForm` | bit | x |  | `((0))` |

## `SY_FrmExpTbl`

PK: `UserAutoID` · 13 cột · ~424 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(40) |  |  |  |
| 2 | `FormID` | varchar(250) | x |  |  |
| 3 | `DataName` | varchar(50) |  |  |  |
| 4 | `Oderby` | int |  |  | `(6)` |
| 5 | `ColumnID` | varchar(50) |  |  |  |
| 6 | `Expression` | nvarchar(500) | x |  |  |
| 7 | `RefColumn` | varchar(500) | x |  |  |
| 8 | `ParaArr` | varchar(100) | x |  |  |
| 9 | `IsDisable` | bit |  |  | `(0)` |
| 10 | `LevelLoop` | int | x |  |  |
| 11 | `RoundType` | int | x |  |  |
| 12 | `RoundPara` | decimal(18,2) | x |  |  |
| 13 | `ResetColumnArr` | varchar(250) | x |  |  |

## `SY_FrmFltTbl`

PK: `UserAutoID` · 31 cột · ~244 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(40) |  |  |  |
| 2 | `FormID` | varchar(250) | x |  |  |
| 3 | `KeyID` | varchar(50) |  |  | `((0))` |
| 4 | `ColumnID` | varchar(50) |  |  |  |
| 5 | `Caption` | nvarchar(150) | x |  |  |
| 6 | `ControlWidth` | int | x |  |  |
| 7 | `Type` | int | x |  |  |
| 8 | `Source` | nvarchar(max) | x |  |  |
| 9 | `SourceType` | int | x |  |  |
| 10 | `ValueColumn` | varchar(50) | x |  |  |
| 11 | `DisplayColumn` | varchar(50) | x |  |  |
| 12 | `ColumnArr` | varchar(200) | x |  |  |
| 13 | `WidthArr` | varchar(200) | x |  |  |
| 14 | `IsSetDefaultValue` | bit |  |  | `((1))` |
| 15 | `RememberLastValue` | bit |  |  | `((0))` |
| 16 | `isLockWhenEditData` | bit |  |  | `((0))` |
| 17 | `UseLikeOperator` | bit |  |  | `((0))` |
| 18 | `LinkColumn` | varchar(200) | x |  |  |
| 19 | `ParaArr` | varchar(200) | x |  |  |
| 20 | `IsDisable` | bit | x |  | `((0))` |
| 21 | `IsReload` | bit |  |  | `((0))` |
| 22 | `WhereString` | nvarchar(250) | x |  |  |
| 23 | `IsPrimaryKeyCombine` | bit | x |  |  |
| 24 | `PrimaryKeyFormat` | nvarchar(250) | x |  |  |
| 25 | `PrimaryKeyLen` | int |  |  | `((4))` |
| 26 | `Operator` | int | x |  |  |
| 27 | `DefaultValue` | nvarchar(100) | x |  |  |
| 28 | `DefaultValueSQL` | nvarchar(250) | x |  |  |
| 29 | `GroupColumnArr` | nvarchar(250) | x |  |  |
| 30 | `EditType` | int | x |  |  |
| 31 | `DisplayMember2` | varchar(50) | x |  |  |

## `SY_FrmGrdActTbl`

PK: `UserAutoID` · 15 cột · ~52 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(40) |  |  |  |
| 2 | `FormID` | varchar(250) | x |  |  |
| 3 | `GridName` | varchar(100) |  |  |  |
| 4 | `ColumnID` | varchar(50) |  |  |  |
| 5 | `Action` | varchar(50) | x |  |  |
| 6 | `Source` | nvarchar(max) | x |  |  |
| 7 | `Para` | varchar(100) | x |  |  |
| 8 | `TargetValue` | nvarchar(100) | x |  |  |
| 9 | `TargetValue2` | nvarchar(100) | x |  |  |
| 10 | `TargetColumn` | varchar(250) | x |  |  |
| 11 | `TargetColumn2` | varchar(250) | x |  |  |
| 12 | `MsgID` | varchar(50) | x |  |  |
| 13 | `IsDisable` | bit |  |  | `(0)` |
| 14 | `ActType` | varchar(100) | x |  |  |
| 15 | `Oderby` | int | x |  |  |

## `SY_FrmLstTbl`

PK: `FormID` · 23 cột · ~287 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `FormID` | varchar(100) |  |  |  |
| 2 | `FormType` | varchar(50) | x |  | `('LISTEDIT2')` |
| 3 | `CaptionVN` | nvarchar(100) |  |  | `(N'danh mục')` |
| 4 | `CaptionEN` | nvarchar(100) | x |  |  |
| 5 | `TableName` | varchar(100) | x |  |  |
| 6 | `PrimaryKey` | varchar(100) | x |  |  |
| 7 | `HideColumnArr` | varchar(max) | x |  |  |
| 8 | `SummaryColumnArr` | varchar(200) | x |  |  |
| 9 | `AddNewColumnArr` | varchar(max) | x |  |  |
| 10 | `FilterEx` | nvarchar(50) | x |  |  |
| 11 | `LockColumnArr` | varchar(100) | x |  |  |
| 12 | `TableDetail` | varchar(50) | x |  |  |
| 13 | `TableDetailLeftJoinField` | varchar(100) | x |  |  |
| 14 | `TableDetailSelectFrom` | varchar(500) | x |  |  |
| 15 | `TableDetail2` | varchar(50) | x |  |  |
| 16 | `TableDetail2LeftJoinField` | varchar(100) | x |  |  |
| 17 | `TableDetail2SelectFrom` | varchar(500) | x |  |  |
| 18 | `Filter` | nvarchar(100) | x |  |  |
| 19 | `PrimaryKeyFormat` | nvarchar(250) | x |  |  |
| 20 | `PrimaryKeyLen` | int | x |  |  |
| 21 | `DefaultColumnArr` | varchar(250) | x |  |  |
| 22 | `CaptionCH` | nvarchar(200) | x |  |  |
| 23 | `EditorColumnArr` | varchar(max) | x |  |  |

## `SY_FrmMstActTbl`

PK: `UserAutoID` · 17 cột · ~31 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(40) |  |  |  |
| 2 | `FormID` | varchar(250) | x |  |  |
| 3 | `MaterAction` | varchar(50) | x |  |  |
| 4 | `Action` | varchar(50) | x |  |  |
| 5 | `Source` | nvarchar(200) | x |  |  |
| 6 | `Para` | varchar(100) | x |  |  |
| 7 | `ColumnID` | varchar(50) |  |  |  |
| 8 | `TargetValue` | nvarchar(100) | x |  |  |
| 9 | `TargetValue2` | nvarchar(100) | x |  |  |
| 10 | `TargetColumn` | varchar(250) | x |  |  |
| 11 | `TargetColumn2` | varchar(250) | x |  |  |
| 12 | `MsgID` | varchar(50) | x |  |  |
| 13 | `IsDisable` | bit |  |  | `(0)` |
| 14 | `ActType` | varchar(100) | x |  |  |
| 15 | `Oderby` | int | x |  |  |
| 16 | `isLockScreen` | bit | x |  | `((1))` |
| 17 | `ColumnIDArr` | varchar(500) | x |  |  |

## `SY_FrmOptBtnTbl`

PK: `UserAutoID` · 27 cột · ~91 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(40) |  |  |  |
| 2 | `FormID` | varchar(250) | x |  |  |
| 3 | `KeyID` | varchar(100) |  |  |  |
| 4 | `GridName` | varchar(100) | x |  |  |
| 5 | `Caption` | nvarchar(150) |  |  |  |
| 6 | `Width` | int | x |  |  |
| 7 | `Action` | varchar(100) | x |  |  |
| 8 | `Source` | varchar(200) | x |  |  |
| 9 | `WhereStr` | nvarchar(100) | x |  |  |
| 10 | `Para` | varchar(100) | x |  |  |
| 11 | `RequireFieldArr` | varchar(100) | x |  |  |
| 12 | `BeforeAction` | varchar(50) | x |  |  |
| 13 | `AfterAction` | varchar(50) | x |  |  |
| 14 | `EnableStatus` | varchar(50) | x |  |  |
| 15 | `ReturnMasterField` | varchar(max) | x |  |  |
| 16 | `ReturnDetailField` | varchar(max) | x |  |  |
| 17 | `RefTable` | varchar(100) | x |  |  |
| 18 | `RefCompareField` | varchar(100) | x |  |  |
| 19 | `RefDisplayField` | varchar(100) | x |  |  |
| 20 | `RefDisplayField2` | varchar(100) | x |  |  |
| 21 | `MasterHiddenField` | varchar(500) | x |  |  |
| 22 | `DetailHiddenField` | varchar(500) | x |  |  |
| 23 | `IsDisable` | bit |  |  | `(0)` |
| 24 | `IsMultiSelect` | bit | x |  | `(0)` |
| 26 | `IsRecordCompare` | bit |  |  | `(0)` |
| 27 | `RefCompareField2` | varchar(100) | x |  |  |
| 28 | `HiddenFieldList` | varchar(250) | x |  |  |

## `SY_FrmParTbl`

PK: `UserAutoID` · 12 cột · ~0 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  |  |
| 2 | `FormID` | varchar(250) | x |  |  |
| 3 | `GridName` | varchar(100) | x |  |  |
| 4 | `DataName` | varchar(100) | x |  |  |
| 5 | `Type` | varchar(100) |  |  |  |
| 6 | `ColumnID` | varchar(50) | x |  |  |
| 7 | `Value` | nvarchar(150) | x |  |  |
| 8 | `Value2` | nvarchar(150) | x |  |  |
| 9 | `Target` | varchar(50) | x |  |  |
| 10 | `MsgID` | varchar(50) | x |  |  |
| 11 | `isUser` | bit |  |  | `(0)` |
| 12 | `isDisable` | bit |  |  | `(0)` |

## `SY_ImDatTbl`

PK: `UserAutoID` · 8 cột · ~44 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  | `(newid())` |
| 2 | `Source` | varchar(150) |  |  |  |
| 3 | `ImportName` | nvarchar(100) |  |  |  |
| 4 | `ImportSQL` | nvarchar(1000) |  |  |  |
| 5 | `DeleteSQL` | nvarchar(1000) | x |  |  |
| 6 | `STT` | int |  |  | `(50)` |
| 7 | `TableName` | varchar(150) |  |  |  |
| 8 | `ImportLocalSQL` | nvarchar(1000) | x |  |  |

## `SY_InitSetup`

PK: `—` · 5 cột · ~1 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `PeriodID` | varchar(10) |  |  |  |
| 2 | `BalancePeriodID` | varchar(10) |  |  |  |
| 3 | `StartDate` | datetime |  |  |  |
| 4 | `CostMethod` | varchar(50) |  |  |  |
| 5 | `CostBranchID` | varchar(50) | x |  |  |

## `SY_InvoiceDebtDateErrorLogTbl`

PK: `LogID` · 6 cột · ~0 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `LogID` | bigint |  | x |  |
| 2 | `EventName` | varchar(30) | x |  |  |
| 3 | `RawDocumentDate` | nvarchar(100) | x |  |  |
| 4 | `RawDueDate` | nvarchar(100) | x |  |  |
| 5 | `PaymentTermID` | varchar(50) | x |  |  |
| 6 | `LogDate` | datetime |  |  | `(getdate())` |

## `SY_Link`

PK: `LinkCode` · 6 cột · ~2 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `LinkCode` | varchar(50) |  |  |  |
| 2 | `ServerName` | varchar(50) | x |  |  |
| 3 | `DatabaseName` | varchar(50) | x |  |  |
| 4 | `UserName` | varchar(50) | x |  |  |
| 5 | `Password` | varchar(50) | x |  |  |
| 6 | `LinkType` | varchar(50) | x |  |  |

## `SY_Menu`

PK: `MenuID` · 19 cột · ~482 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `MenuID` | varchar(50) |  |  |  |
| 2 | `VN` | nvarchar(200) |  |  |  |
| 3 | `EN` | nvarchar(200) | x |  |  |
| 4 | `CH` | nvarchar(200) | x |  |  |
| 5 | `MenuType` | int |  |  |  |
| 6 | `IconIndex` | int | x |  |  |
| 7 | `FormName` | varchar(100) | x |  |  |
| 8 | `Parent` | varchar(50) | x |  |  |
| 9 | `isBeginGroup` | bit |  |  | `((0))` |
| 10 | `isDisable` | bit |  |  | `((0))` |
| 11 | `isBold` | bit |  |  | `((0))` |
| 12 | `isNotCheckPermission` | bit | x |  |  |
| 13 | `Para` | varchar(50) | x |  |  |
| 14 | `ReportPara` | nvarchar(200) | x |  |  |
| 15 | `SubReportPara` | nvarchar(200) | x |  |  |
| 16 | `MenuKey` | varchar(100) | x |  |  |
| 17 | `ShortKey` | varchar(50) | x |  |  |
| 18 | `ShowDialog` | bit | x |  |  |
| 19 | `Filter` | nvarchar(150) | x |  |  |

## `SY_MessageTbl`

PK: `AutoID` · 11 cột · ~48 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `AutoID` | varchar(50) |  |  | `(newid())` |
| 2 | `FromUser` | varchar(20) |  |  |  |
| 3 | `Content` | nvarchar(500) |  |  |  |
| 4 | `ToUser` | varchar(500) |  |  |  |
| 5 | `DateCreate` | datetime |  |  | `(getdate())` |
| 6 | `DateUpdate` | datetime | x |  |  |
| 7 | `isRead` | bit |  |  | `((0))` |
| 8 | `isSendDelete` | bit |  |  | `((0))` |
| 9 | `isRecieveDelete` | bit |  |  | `((0))` |
| 10 | `GroupID` | int | x |  |  |
| 11 | `DetailID` | int | x |  |  |

## `SY_NotifyMsg`

PK: `UID` · 13 cột · ~12 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UID` | int |  | x |  |
| 2 | `FromUserID` | varchar(100) |  |  |  |
| 3 | `ToUserID` | varchar(100) |  |  |  |
| 4 | `Title` | nvarchar(100) |  |  |  |
| 5 | `Message` | nvarchar(max) |  |  |  |
| 6 | `MsgTime` | datetime | x |  | `(getdate())` |
| 7 | `Status` | int | x |  | `((0))` |
| 8 | `DocumentID` | varchar(50) | x |  |  |
| 9 | `isView` | bit | x |  | `((0))` |
| 10 | `viewdate` | datetime | x |  |  |
| 11 | `notitype` | int | x |  |  |
| 12 | `OrderNo` | varchar(50) | x |  |  |
| 13 | `StatusID` | int | x |  |  |

## `SY_NotifyMsgTbl`

PK: `ID` · 22 cột · ~6 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `ID` | int |  | x |  |
| 2 | `FromUserID` | varchar(50) |  |  | `('System')` |
| 3 | `ToUserID` | varchar(50) |  |  |  |
| 4 | `Title` | nvarchar(200) |  |  |  |
| 5 | `Message` | nvarchar(2000) |  |  |  |
| 6 | `MsgTime` | datetime2 |  |  | `(sysdatetime())` |
| 7 | `NotifyType` | varchar(20) |  |  | `('Info')` |
| 8 | `ColorHex` | varchar(7) | x |  |  |
| 9 | `SourceSystem` | varchar(20) |  |  | `('SYSTEM')` |
| 10 | `ERPFormName` | varchar(100) | x |  |  |
| 11 | `WebFormName` | varchar(100) | x |  |  |
| 12 | `WebRoute` | nvarchar(400) | x |  |  |
| 13 | `DocumentID` | varchar(100) | x |  |  |
| 14 | `OrderNo` | varchar(50) | x |  |  |
| 15 | `StatusID` | int | x |  |  |
| 16 | `IsView` | bit |  |  | `((0))` |
| 17 | `ViewDate` | datetime2 | x |  |  |
| 18 | `IsActive` | bit |  |  | `((1))` |
| 19 | `ShowERP` | bit |  |  | `((1))` |
| 20 | `ShowWeb` | bit |  |  | `((1))` |
| 21 | `ExpireAt` | datetime2 | x |  |  |
| 22 | `EventKey` | varchar(200) | x |  |  |

## `SY_Period`

PK: `PeriodID` · 10 cột · ~24 dòng · FK ra/vào: 1/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `PeriodID` | varchar(6) |  |  |  |
| 2 | `PeriodName` | nvarchar(100) |  |  |  |
| 3 | `PeriodName2` | nvarchar(100) | x |  |  |
| 4 | `FromDate` | datetime |  |  |  |
| 5 | `ToDate` | datetime |  |  |  |
| 6 | `YearID` | smallint |  |  |  |
| 7 | `PeriodNo` | tinyint | x |  |  |
| 8 | `isLock` | bit | x |  | `(0)` |
| 9 | `isUse` | bit | x |  | `(0)` |
| 10 | `isLockData` | bit | x |  | `((0))` |

## `SY_Quarter`

PK: `QuarterID` · 7 cột · ~8 dòng · FK ra/vào: 1/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `QuarterID` | varchar(10) |  |  |  |
| 2 | `QuarterName` | nvarchar(50) |  |  |  |
| 3 | `QuarterName2` | nvarchar(50) | x |  |  |
| 4 | `FromDate` | datetime | x |  |  |
| 5 | `ToDate` | datetime | x |  |  |
| 6 | `YearID` | smallint |  |  |  |
| 7 | `QuarterNo` | tinyint | x |  |  |

## `SY_Res`

PK: `ResID` · 3 cột · ~0 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `ResID` | varchar(50) |  |  |  |
| 2 | `ResValue` | image | x |  |  |
| 3 | `Notes` | nvarchar(150) | x |  |  |

## `SY_ResUser`

PK: `KeyID` · 5 cột · ~84 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `KeyID` | varchar(250) |  |  |  |
| 2 | `KeyName` | nvarchar(250) | x |  |  |
| 3 | `KeyValue` | nvarchar(max) | x |  |  |
| 4 | `KeyValue2` | decimal(18,4) | x |  |  |
| 5 | `KeyValue3` | datetime | x |  |  |

## `SY_ResUx`

PK: `FID` · 6 cột · ~5 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `FID` | nvarchar(500) |  |  |  |
| 2 | `FN` | nvarchar(200) | x |  |  |
| 3 | `FD` | datetime |  |  |  |
| 4 | `FV` | varchar(50) |  |  |  |
| 5 | `FC` | image | x |  |  |
| 6 | `FixVersion` | bit | x |  | `((0))` |

## `SY_RpDTbl`

PK: `UserAutoID` · 20 cột · ~2231 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(100) |  |  |  |
| 2 | `RpName` | varchar(100) |  |  |  |
| 3 | `PName` | varchar(50) |  |  |  |
| 4 | `isSub` | bit |  |  | `(0)` |
| 5 | `isReq` | bit |  |  | `(0)` |
| 6 | `DefaultValueVN` | nvarchar(1000) | x |  |  |
| 7 | `DefaultValueEN` | nvarchar(1000) | x |  |  |
| 8 | `DefaultSQL` | nvarchar(150) | x |  |  |
| 9 | `Link` | varchar(50) | x |  |  |
| 10 | `SourceType` | varchar(50) | x |  |  |
| 11 | `Width` | int | x |  | `(0)` |
| 12 | `Height` | int | x |  | `(0)` |
| 15 | `Caption` | nvarchar(250) | x |  |  |
| 16 | `isMultiSelect` | bit | x |  |  |
| 17 | `LockExpression` | nvarchar(250) | x |  |  |
| 18 | `UserType` | int | x |  |  |
| 19 | `SourceNew` | nvarchar(max) | x |  |  |
| 20 | `ParaArr` | nvarchar(250) | x |  |  |
| 21 | `EditType` | int | x |  |  |
| 22 | `LockExpressionSQL` | nvarchar(500) | x |  |  |

## `SY_RpFTbl`

PK: `UserAutoID` · 6 cột · ~2441 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  |  |
| 2 | `FileName` | nvarchar(250) | x |  |  |
| 3 | `FileDate` | datetime | x |  |  |
| 4 | `Title` | nvarchar(150) | x |  |  |
| 5 | `Notes` | nvarchar(150) | x |  |  |
| 6 | `FileContent` | image | x |  |  |

## `SY_RpTbl`

PK: `ParaName` · 23 cột · ~50 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `ParaName` | varchar(50) |  |  |  |
| 2 | `VN` | nvarchar(50) | x |  |  |
| 3 | `Type` | int |  |  |  |
| 4 | `W` | int | x |  | `((250))` |
| 5 | `H` | int | x |  | `((0))` |
| 6 | `RequireCondition` | nvarchar(100) | x |  |  |
| 7 | `ActionEnum` | int |  |  | `((0))` |
| 8 | `ValueList` | nvarchar(max) | x |  |  |
| 9 | `ValueMember` | varchar(50) | x |  |  |
| 10 | `DisplayMember` | varchar(50) | x |  |  |
| 11 | `DisplayMember2` | varchar(50) | x |  |  |
| 12 | `ColArr` | varchar(100) | x |  |  |
| 13 | `WidthArr` | varchar(50) | x |  |  |
| 14 | `LinkColumn` | varchar(100) | x |  |  |
| 15 | `GroupColumnArr` | varchar(100) | x |  |  |
| 16 | `ArrangeEnum` | int | x |  | `((0))` |
| 17 | `WUnit` | int | x |  | `((0))` |
| 18 | `L` | int | x |  | `((0))` |
| 19 | `T` | int | x |  | `((0))` |
| 20 | `ShowComboButton` | bit | x |  | `((0))` |
| 21 | `isMultiSelect` | bit | x |  | `((0))` |
| 22 | `isManualSearch` | bit | x |  |  |
| 23 | `IsReload` | bit | x |  | `((1))` |

## `SY_Setup`

PK: `CodeID` · 10 cột · ~63 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `CodeID` | varchar(50) |  |  |  |
| 2 | `CodeName` | nvarchar(100) | x |  |  |
| 3 | `ValueType` | int | x |  |  |
| 4 | `CodeValue` | nvarchar(1000) | x |  |  |
| 5 | `SourceTable` | varchar(50) | x |  |  |
| 6 | `FieldName` | varchar(50) | x |  |  |
| 7 | `GroupID` | varchar(2) | x |  |  |
| 8 | `CodeValue2` | nvarchar(1000) | x |  |  |
| 9 | `IndexID` | int | x |  |  |
| 10 | `Ghichu` | varchar(200) | x |  |  |

## `SY_STT`

PK: `STT` · 2 cột · ~100815 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `STT` | int |  | x |  |
| 2 | `Note` | varchar(50) | x |  |  |

## `SY_StTbl`

PK: `StringID` · 5 cột · ~582 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `StringID` | varchar(250) |  |  |  |
| 2 | `StringParam` | nvarchar(500) | x |  |  |
| 3 | `StringVN` | nvarchar(500) | x |  |  |
| 4 | `StringEN` | nvarchar(500) | x |  |  |
| 5 | `StringCH` | nvarchar(500) | x |  |  |

## `SY_StupAcTbl`

PK: `SystemAccountType` · 5 cột · ~12 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `SystemAccountType` | varchar(50) |  |  |  |
| 2 | `Description` | nvarchar(100) |  |  |  |
| 3 | `AccountID` | varchar(20) | x |  |  |
| 4 | `IsIncludeDetail` | bit |  |  | `((0))` |
| 5 | `IsDebit` | bit |  |  | `((1))` |

## `SY_SynDate`

PK: `—` · 4 cột · ~0 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `SynDate` | datetime |  |  |  |
| 2 | `SynDate2` | datetime | x |  |  |
| 3 | `Notes` | nvarchar(150) | x |  |  |
| 4 | `isData` | int |  |  | `((1))` |

## `SY_User`

PK: `UserName` · 20 cột · ~42 dòng · FK ra/vào: 0/2 · trigger: 2

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserName` | varchar(100) |  |  |  |
| 2 | `HoTen` | nvarchar(150) |  |  |  |
| 3 | `TenNgan` | nvarchar(100) |  |  |  |
| 4 | `Password` | varchar(200) | x |  |  |
| 5 | `Manager` | bit | x |  |  |
| 6 | `PM` | bit | x |  |  |
| 8 | `Disable` | bit |  |  |  |
| 9 | `UserGroupID` | varchar(50) | x |  |  |
| 10 | `TempDate` | datetime | x |  |  |
| 11 | `UserAuthority` | varchar(100) | x |  |  |
| 12 | `BranchID` | varchar(50) | x |  |  |
| 13 | `CeoID` | varchar(50) | x |  |  |
| 14 | `ManagerID` | varchar(50) | x |  |  |
| 15 | `EmployeeID` | varchar(50) | x |  |  |
| 16 | `CostCenterID` | varchar(50) | x |  |  |
| 17 | `StoreHouseID` | varchar(50) | x |  |  |
| 18 | `StartupForm` | varchar(50) | x |  |  |
| 19 | `DisableAutoBackup` | bit | x |  | `((0))` |
| 20 | `KhongHienDashboard` | bit | x |  | `((0))` |
| 21 | `ObjectID` | varchar(50) | x |  |  |

## `SY_UserBranch`

PK: `UserAutoID` · 5 cột · ~0 dòng · FK ra/vào: 1/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  |  |
| 2 | `UserName` | varchar(100) | x |  |  |
| 3 | `BranchID` | varchar(50) | x |  |  |
| 4 | `isDefault` | bit | x |  |  |
| 5 | `Notes` | nvarchar(50) | x |  |  |

## `SY_UserGroup`

PK: `UserGroupID` · 4 cột · ~28 dòng · FK ra/vào: 0/1 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserGroupID` | varchar(20) |  |  |  |
| 2 | `UserGroupName` | nvarchar(100) |  |  |  |
| 3 | `IsDisable` | bit |  |  |  |
| 4 | `BranchID` | varchar(50) | x |  |  |

## `SY_UserGroupDetail`

PK: `UserAutoID` · 7 cột · ~168 dòng · FK ra/vào: 1/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  |  |
| 2 | `UserGroupID` | varchar(20) |  |  |  |
| 3 | `KeyID` | varchar(50) |  |  |  |
| 4 | `KeyName` | nvarchar(100) |  |  |  |
| 5 | `isDisable` | bit |  |  | `(0)` |
| 6 | `Value` | decimal(18,0) | x |  |  |
| 7 | `Notes` | nvarchar(50) | x |  |  |

## `SY_UserGroupPermisstion`

PK: `ID` · 14 cột · ~11961 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `ID` | varchar(50) |  |  | `(newid())` |
| 2 | `UserGroupID` | varchar(20) |  |  |  |
| 3 | `MenuID` | varchar(50) |  |  |  |
| 4 | `IsRun` | bit |  |  |  |
| 5 | `IsAdd` | bit |  |  |  |
| 6 | `IsUpdate` | bit |  |  |  |
| 7 | `IsDelete` | bit |  |  |  |
| 8 | `isManager` | bit | x |  |  |
| 9 | `isAdmin` | bit |  |  |  |
| 10 | `isAutoLock` | bit | x |  | `((0))` |
| 11 | `isHideAmount` | bit | x |  |  |
| 12 | `isLockDoc` | bit | x |  |  |
| 13 | `isUnLockDoc` | bit | x |  |  |
| 14 | `isExportExcel` | bit | x |  |  |

## `SY_UserLog`

PK: `UserAutoID` · 8 cột · ~879 dòng · FK ra/vào: 0/1 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  |  |
| 2 | `SPID` | numeric(18,0) | x |  |  |
| 3 | `ComputerName` | varchar(100) | x |  |  |
| 4 | `UserName` | varchar(50) |  |  |  |
| 5 | `LoginDate` | datetime | x |  |  |
| 6 | `LogoutDate` | datetime | x |  |  |
| 7 | `AppVer` | varchar(50) | x |  |  |
| 8 | `tmpDate` | datetime | x |  |  |

## `SY_UserLogDetail`

PK: `UserAutoID` · 9 cột · ~20933 dòng · FK ra/vào: 1/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  |  |
| 2 | `LogID` | varchar(50) |  |  |  |
| 3 | `FormID` | nvarchar(150) | x |  |  |
| 4 | `Para` | nvarchar(50) |  |  |  |
| 5 | `LogDate` | datetime | x |  |  |
| 6 | `Note` | nvarchar(500) | x |  |  |
| 7 | `FormKey` | varchar(250) | x |  |  |
| 8 | `PrimaryValue` | nvarchar(250) | x |  |  |
| 9 | `DataValue` | nvarchar(max) | x |  |  |

## `SY_UserPermisstion`

PK: `ID` · 14 cột · ~17934 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `ID` | varchar(50) |  |  | `(newid())` |
| 2 | `UserName` | varchar(100) |  |  |  |
| 3 | `MenuID` | varchar(50) |  |  |  |
| 4 | `IsRun` | bit |  |  |  |
| 5 | `IsAdd` | bit |  |  |  |
| 6 | `IsUpdate` | bit |  |  |  |
| 7 | `IsDelete` | bit |  |  |  |
| 8 | `isManager` | bit | x |  |  |
| 9 | `isAdmin` | bit |  |  |  |
| 10 | `isAutoLock` | bit | x |  | `((0))` |
| 11 | `isHideAmount` | bit | x |  |  |
| 12 | `isLockDoc` | bit | x |  |  |
| 13 | `isUnLockDoc` | bit | x |  |  |
| 14 | `isExportExcel` | bit | x |  |  |

## `SY_UserStorehouse`

PK: `UserAutoID` · 5 cột · ~0 dòng · FK ra/vào: 1/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserAutoID` | varchar(50) |  |  |  |
| 2 | `UserName` | varchar(100) | x |  |  |
| 3 | `StoreHouseID` | varchar(50) | x |  |  |
| 4 | `isDefault` | bit | x |  |  |
| 5 | `Notes` | nvarchar(50) | x |  |  |

## `SY_UserToken`

PK: `UserName` · 4 cột · ~9 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UserName` | varchar(50) |  |  |  |
| 2 | `endpoint` | varchar(500) |  |  |  |
| 3 | `TokenTime` | datetime | x |  | `(getdate())` |
| 4 | `DeviceType` | varchar(100) | x |  |  |

## `SY_UsLc`

PK: `UHardID` · 10 cột · ~108 dòng · FK ra/vào: 0/0 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `UHardID` | varchar(100) |  |  |  |
| 2 | `USeri` | varchar(100) | x |  |  |
| 3 | `Version` | varchar(50) | x |  |  |
| 4 | `LastDate` | datetime | x |  |  |
| 5 | `LastLogin` | varchar(50) | x |  |  |
| 6 | `LastIPAddress` | varchar(50) | x |  |  |
| 7 | `LastComputer` | varchar(50) | x |  |  |
| 8 | `isLockComputer` | bit | x |  | `((0))` |
| 9 | `Notes` | nvarchar(250) | x |  |  |
| 10 | `RegisterDate` | datetime | x |  |  |

## `SY_Year`

PK: `YearID` · 3 cột · ~2 dòng · FK ra/vào: 0/2 · trigger: 0

| # | Cột | Kiểu | Null | Identity | Mặc định |
|---:|---|---|:---:|:---:|---|
| 1 | `YearID` | smallint |  |  |  |
| 2 | `YearName` | nvarchar(50) |  |  |  |
| 3 | `YearName2` | nvarchar(50) | x |  |  |
