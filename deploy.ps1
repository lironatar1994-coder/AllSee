# Deploys AllSee: code -> GitHub (main), then a static release -> https://lawebs.co.il/allsee/
#   .\deploy.ps1                      commit + push + production
#   .\deploy.ps1 -Target GitHub       commit + push only
#   .\deploy.ps1 -Target Prod         production only (tree must be committed and pushed)
[CmdletBinding()]
param(
    [string]$CommitMessage = 'Update AllSee',
    [ValidateSet('All', 'GitHub', 'Prod')][string]$Target = 'All',
    [string]$SSHHost = 'root@vee-app.co.il',
    [string]$Origin = 'https://github.com/lironatar1994-coder/AllSee.git'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function Invoke-Checked([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed ($LASTEXITCODE)" }
}
Push-Location $PSScriptRoot
try {
    if ($SSHHost -notmatch '^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$') { throw 'Invalid SSH host' }
    $currentOrigin = (Invoke-Checked git @('remote', 'get-url', 'origin') | Out-String).Trim()
    if ($currentOrigin -ne $Origin) { throw "Unexpected origin: $currentOrigin" }
    if ((Invoke-Checked git @('branch', '--show-current') | Out-String).Trim() -ne 'main') { throw 'Switch to main before deploying.' }

    # ---- GitHub ----
    if ($Target -ne 'Prod') {
        Invoke-Checked git @('add', '-A')
        if (@(Invoke-Checked git @('diff', '--cached', '--name-only')).Count) {
            Invoke-Checked git @('commit', '-q', '-m', $CommitMessage)
        }
        Invoke-Checked git @('push', '-q', '-u', 'origin', 'HEAD:main')
    }
    if (@(Invoke-Checked git @('status', '--porcelain')).Count) { throw 'Commit changes first (or run without -Target Prod).' }
    $revision = (Invoke-Checked git @('rev-parse', 'HEAD') | Out-String).Trim()
    $remote = ((Invoke-Checked git @('ls-remote', 'origin', 'refs/heads/main') | Out-String).Trim() -split '\s+')[0]
    if ($revision -ne $remote) { throw 'GitHub main does not match this revision - push first.' }
    Write-Host "GitHub: main @ $($revision.Substring(0, 7))" -ForegroundColor Green
    if ($Target -eq 'GitHub') { return }

    # ---- Production ----
    $base = '/opt/allsee'
    $releaseId = Get-Date -Format 'yyyyMMdd-HHmmss'

    # Ship exactly what is committed: index.html + shots/, plus the revision marker.
    if (Test-Path 'dist') { Remove-Item -Recurse -Force 'dist' }
    New-Item -ItemType Directory -Force -Path 'dist/www' | Out-Null
    Invoke-Checked git @('archive', '--format=tar', '--output=dist/src.tar', $revision, 'index.html', 'shots')
    Invoke-Checked tar.exe @('-xf', 'dist/src.tar', '-C', 'dist/www')
    [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'dist/www/revision.txt'), "$revision`n")
    $archive = Join-Path $PSScriptRoot 'dist/release.tar.gz'
    Invoke-Checked tar.exe @('-czf', $archive, '-C', 'dist/www', '.')

    Invoke-Checked ssh @('-o','BatchMode=yes','-o','ConnectTimeout=15',$SSHHost,"mkdir -p $base/incoming")
    Invoke-Checked scp @('-q', $archive, "${SSHHost}:$base/incoming/$releaseId.tar.gz")
    # Uploaded rather than piped: Windows PowerShell prepends a BOM to piped stdin.
    Invoke-Checked scp @('-q', 'scripts/deploy-linux.sh', "${SSHHost}:$base/incoming/deploy-linux.sh")
    & ssh -o BatchMode=yes $SSHHost "tr -d '\r' < $base/incoming/deploy-linux.sh | bash -s -- $releaseId"
    if ($LASTEXITCODE -ne 0) { throw 'Production deployment failed (the previous release stays live)' }

    $liveRevision = (Invoke-WebRequest 'https://lawebs.co.il/allsee/revision.txt' -UseBasicParsing -Headers @{ 'Cache-Control' = 'no-cache' }).Content.Trim()
    if ($liveRevision -ne $revision) { throw "Live revision mismatch (live $liveRevision, expected $revision)" }
    Write-Host "Live: https://lawebs.co.il/allsee/  ($($revision.Substring(0, 7)))" -ForegroundColor Green
} finally { Pop-Location }
