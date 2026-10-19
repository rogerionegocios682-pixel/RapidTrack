$root = 'c:\Users\Rogério Herculano\Desktop\PROJETOS\delivery os'
$log = Join-Path $root 'dev-run-bg.log'

Write-Output '--- PROCESSOS NODE ---'
Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, ProcessName | Format-Table -AutoSize

Write-Output '--- LOG (tail) ---'
if (Test-Path $log) {
  Get-Content $log -Tail 20
} else {
  Write-Output 'SEM LOG'
}

Write-Output '--- HTTP ---'
try {
  $r = Invoke-WebRequest 'http://localhost:3000/login' -UseBasicParsing -TimeoutSec 15
  Write-Output ('HTTP=' + $r.StatusCode)
} catch {
  Write-Output ('PORTA FECHADA: ' + $_.Exception.Message)
}
