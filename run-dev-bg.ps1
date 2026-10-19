$root = 'c:\Users\Rogério Herculano\Desktop\PROJETOS\delivery os'
$log = Join-Path $root 'dev-run-bg.log'
$err = Join-Path $root 'dev-run-bg-err.log'

$p = Start-Process -FilePath 'cmd.exe' `
  -ArgumentList '/c', "cd /d `"$root`" && npm run dev 1> `"$log`" 2> `"$err`"" `
  -PassThru -WindowStyle Hidden
Write-Output ("PID=" + $p.Id)
