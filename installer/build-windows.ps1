$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path $projectRoot 'dist\installer'
$appStage = Join-Path $releaseRoot 'app'
$runtimeStage = Join-Path $appStage 'runtime'
$nextDistDir = '.next-installer'
$buildOutput = Join-Path $projectRoot $nextDistDir
$nodeVersion = '24.18.0'
$nodeArchive = Join-Path $releaseRoot "node-v$nodeVersion-win-x64.zip"
$nodeUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-win-x64.zip"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$File,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory
  )

  Push-Location -LiteralPath $WorkingDirectory
  try {
    & $File @Arguments
    $exitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  if ($exitCode -ne 0) {
    throw "Command failed ($exitCode): $File $($Arguments -join ' ')"
  }
}

New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
if (Test-Path -LiteralPath $buildOutput) {
  throw "The isolated build directory already exists: $buildOutput"
}
if (Test-Path -LiteralPath $appStage) {
  Remove-Item -LiteralPath $appStage -Recurse -Force
}
New-Item -ItemType Directory -Path $appStage | Out-Null

$environmentNames = Get-ChildItem Env: |
  Where-Object { $_.Name -match '^(DATABASE_URL|DIRECT_URL|SESSION_SECRET|NEXT_DIST_DIR|.*SUPABASE.*|.*DATABASE.*PASSWORD.*|.*SERVICE_ROLE.*)$' } |
  Select-Object -ExpandProperty Name
$savedEnvironment = @{}
foreach ($name in $environmentNames) {
  $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
  [Environment]::SetEnvironmentVariable($name, $null, 'Process')
}
$buildStarted = $false

try {
  $env:NEXT_DIST_DIR = $nextDistDir
  $buildStarted = $true
  Invoke-Checked -File 'npm.cmd' -Arguments @('run', 'build') -WorkingDirectory $projectRoot

  $standaloneRoot = Join-Path $buildOutput 'standalone'
  if (-not (Test-Path -LiteralPath (Join-Path $standaloneRoot 'server.js'))) {
    throw 'Next.js did not produce .next-installer/standalone/server.js.'
  }

  Get-ChildItem -LiteralPath $standaloneRoot -Force -File -Filter '.env*' -Recurse |
    Remove-Item -Force
  Copy-Item -Path (Join-Path $standaloneRoot '*') -Destination $appStage -Recurse -Force

  $staticSource = Join-Path $buildOutput 'static'
  if (Test-Path -LiteralPath $staticSource) {
    $staticTarget = Join-Path $appStage "$nextDistDir\static"
    New-Item -ItemType Directory -Path $staticTarget -Force | Out-Null
    Copy-Item -Path (Join-Path $staticSource '*') -Destination $staticTarget -Recurse -Force
  }

  $publicSource = Join-Path $projectRoot 'public'
  if (Test-Path -LiteralPath $publicSource) {
    Copy-Item -LiteralPath $publicSource -Destination (Join-Path $appStage 'public') -Recurse -Force
  }

  $sqlJsTarget = Join-Path $appStage 'node_modules\sql.js'
  New-Item -ItemType Directory -Path $sqlJsTarget -Force | Out-Null
  Copy-Item -Path (Join-Path $projectRoot 'node_modules\sql.js\*') -Destination $sqlJsTarget -Recurse -Force

  foreach ($file in @(
    @{ Source = 'src\db\schema.sql'; Destination = 'src\db\schema.sql' },
    @{ Source = 'db\migrations\001_sync.sql'; Destination = 'db\migrations\001_sync.sql' },
    @{ Source = 'installer\launcher.cjs'; Destination = 'launcher.cjs' },
    @{ Source = 'installer\initialize-local-db.cjs'; Destination = 'initialize-local-db.cjs' },
    @{ Source = 'installer\start.vbs'; Destination = 'start.vbs' },
    @{ Source = 'installer\stop.vbs'; Destination = 'stop.vbs' }
  )) {
    $target = Join-Path $appStage $file.Destination
    New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot $file.Source) -Destination $target -Force
  }

  if (-not (Test-Path -LiteralPath $nodeArchive)) {
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeArchive
  }
  $runtimeExtract = Join-Path $releaseRoot 'node-runtime'
  if (Test-Path -LiteralPath $runtimeExtract) {
    Remove-Item -LiteralPath $runtimeExtract -Recurse -Force
  }
  Expand-Archive -LiteralPath $nodeArchive -DestinationPath $runtimeExtract -Force
  New-Item -ItemType Directory -Path $runtimeStage -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $runtimeExtract "node-v$nodeVersion-win-x64\node.exe") -Destination (Join-Path $runtimeStage 'node.exe')

  $compilerCandidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'),
    (Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 7\ISCC.exe'),
    (Join-Path $env:ProgramFiles 'Inno Setup 7\ISCC.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 7\ISCC.exe')
  )
  $compiler = $compilerCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  if (-not $compiler) {
    $command = Get-Command 'ISCC.exe' -ErrorAction SilentlyContinue
    if ($command) { $compiler = $command.Source }
  }
  if (-not $compiler) {
    throw "Inno Setup 6 or 7 is required to compile the installer. Staged files are ready in '$appStage'."
  }

  Invoke-Checked -File $compiler -Arguments @((Join-Path $PSScriptRoot 'DeliveryOS.iss')) -WorkingDirectory $projectRoot
  Write-Output "Installer created: $(Join-Path $projectRoot 'dist\DeliveryOS-Setup.exe')"
} finally {
  foreach ($name in $savedEnvironment.Keys) {
    [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process')
  }
  if ($buildStarted -and (Test-Path -LiteralPath $buildOutput)) {
    Remove-Item -LiteralPath $buildOutput -Recurse -Force
  }
}
