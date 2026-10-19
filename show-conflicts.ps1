$files = @('.env.example', '.gitignore', 'src/db/index.ts', 'tsconfig.json')
foreach ($f in $files) {
  Write-Output ("========== " + $f + " ==========")
  Select-String -Path $f -Pattern '<<<<<<<|=======|>>>>>>>' | ForEach-Object {
    Write-Output ($_.LineNumber.ToString() + ': ' + $_.Line)
  }
}
