param([string]$Asm,[string]$TypeName,[string]$Method,[string]$IdsFile,[string]$OutFile)
$ErrorActionPreference='Stop'
$a=[Reflection.Assembly]::LoadFile($Asm)
$t=$a.GetType($TypeName,$true)
$m=$t.GetMethod($Method,[Reflection.BindingFlags]'NonPublic,Public,Static')
$sb=New-Object System.Text.StringBuilder
$ok=0;$fail=0
foreach($line in [IO.File]::ReadAllLines($IdsFile)){
  if(-not $line){continue}
  $id=[int]$line
  try{ $s=[string]$m.Invoke($null,@([object]$id)); $enc=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($s)); [void]$sb.AppendLine("$id`t$enc"); $ok++ }
  catch{ [void]$sb.AppendLine("$id`t!ERR"); $fail++ }
}
[IO.File]::WriteAllText($OutFile,$sb.ToString(),[Text.Encoding]::UTF8)
"ok=$ok fail=$fail"
