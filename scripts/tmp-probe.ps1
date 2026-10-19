$ErrorActionPreference = 'Continue'
$targets = @('http://localhost:3000/login', 'http://localhost:3000/dashboard/cadastro/usuarios')

foreach ($u in $targets) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 25 -MaximumRedirection 0
    $sw.Stop()
    Write-Output ("OK   {0} ms  status={1}  bytes={2}  -> {3}" -f $sw.ElapsedMilliseconds, $r.StatusCode, $r.Content.Length, $u)
  } catch {
    $sw.Stop()
    $resp = $_.Exception.Response
    if ($resp) {
      Write-Output ("HTTP {0} ms  status={1}  -> {2}" -f $sw.ElapsedMilliseconds, [int]$resp.StatusCode, $u)
    } else {
      Write-Output ("ERR  {0} ms  {1}  -> {2}" -f $sw.ElapsedMilliseconds, $_.Exception.Message, $u)
    }
  }
}
