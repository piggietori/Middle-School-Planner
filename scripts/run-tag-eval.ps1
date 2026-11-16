# Runs the tag classifier eval and opens its results page, with plain prompts. Started by double-clicking
# "Run tag eval.cmd" or "View tag eval results.cmd" in the project folder. How it works: docs/testing.md.
# Plain ASCII on purpose: Windows PowerShell 5.1 misreads other characters in a file with no byte-order mark.
param(
  [switch]$ViewOnly,                                   # only rebuild and open the latest results page
  [switch]$SkipRefresh,                                # don't re-fetch the school pages first
  [string]$Flow = ".claude/hillclimb/tag-classifier"   # where runs are saved (tests use a -selftest folder)
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
$Reps = 3
$KeyFile = Join-Path $env:LOCALAPPDATA "d20-planner\anthropic-key.txt"

function Ask($question) { return (Read-Host "$question (y/n)") -match '^\s*y' }
function Stop-With($message) { Write-Host ""; Write-Host $message -ForegroundColor Yellow; exit 1 }

function Show-Report($variant) {
  $page = if ($variant) { node scripts/eval-tags-report.js --flow $Flow --variant $variant } else { node scripts/eval-tags-report.js --flow $Flow }
  if ($LASTEXITCODE -ne 0) { Stop-With "There are no results to show yet. Double-click 'Run tag eval' first." }
  Write-Host "Results page: $page"
  if (-not $env:TAG_EVAL_NO_OPEN) { Start-Process $page }
}

# The key is kept encrypted by Windows for this Windows account only, outside the project folder, so it is
# neither in git nor synced by OneDrive. It is put in this process's environment and nowhere else.
function Save-Key {
  $secure = Read-Host "Paste your Anthropic API key and press Enter (it stays hidden)" -AsSecureString
  if ($secure.Length -eq 0) { Stop-With "No key entered. Nothing was run." }
  New-Item -ItemType Directory -Force (Split-Path $KeyFile) | Out-Null
  $secure | ConvertFrom-SecureString | Set-Content $KeyFile -Encoding ascii
  Write-Host "Saved, encrypted, at $KeyFile"
}
function Use-Key {
  if ($env:ANTHROPIC_API_KEY) { return }
  if (-not (Test-Path $KeyFile)) { Write-Host "No API key is saved on this computer yet."; Save-Key }
  try { $secure = Get-Content $KeyFile | ConvertTo-SecureString }
  catch { Write-Host "The saved key can't be read by this Windows account."; Save-Key; $secure = Get-Content $KeyFile | ConvertTo-SecureString }
  $env:ANTHROPIC_API_KEY = (New-Object System.Net.NetworkCredential("", $secure)).Password
}

# Runs the eval, showing its progress as it goes, and returns everything it printed.
function Invoke-Eval($variant, [switch]$Approve) {
  $extra = if ($Approve) { " --approve-harness" } else { "" }
  cmd /c "npm.cmd run --silent eval:tags -- --flow `"$Flow`" --variant $variant --reps $Reps$extra 2>&1" | Tee-Object -Variable log | Out-Host
  $script:EvalExit = $LASTEXITCODE
  return ($log -join "`n")
}

if ($ViewOnly) { Show-Report $null; exit 0 }

Write-Host "Tag classifier eval" -ForegroundColor Cyan
Write-Host "Asks a model whether each school earns Music & band, Arts and Science & tech, and compares with our answers."
Write-Host ""

if (-not $SkipRefresh) {
  Write-Host "Step 1 of 3: refreshing each school's pages and re-checking every stored quote (free)..."
  cmd /c "npm.cmd run --silent fetch:tag-sources 2>&1" | Out-Host
  if ($LASTEXITCODE -ne 0) {
    if (-not (Ask "The refresh reported a problem (see above). Run the eval anyway, on the pages saved earlier?")) { Stop-With "Stopped. Nothing was spent." }
  }
}

$plan = node scripts/eval-tags-report.js --flow $Flow --next-run --reps $Reps | ConvertFrom-Json
$left = $plan.total - $plan.done
Write-Host ""
Write-Host "Step 2 of 3: the run"
if ($plan.resume) { Write-Host "  Picking up the unfinished run '$($plan.variant)': $($plan.done) of $($plan.total) calls are already done." }
else { Write-Host "  New run: '$($plan.variant)'." }
Write-Host "  This makes about $left paid calls to the model."
if ($plan.last) { Write-Host "  For scale: the last full run ('$($plan.last.variant)') used $('{0:N0}' -f $plan.last.in) tokens in and $('{0:N0}' -f $plan.last.out) out." }
if (-not (Ask "Run it now?")) { Stop-With "Stopped. Nothing was spent." }

Use-Key
$log = Invoke-Eval $plan.variant

# The runner refuses to start when the rules, prompt, golden answers or runner changed since you last
# approved them. That check stays; here it is a question instead of a command-line flag.
if ($EvalExit -eq 2 -and $log -match "approve-harness") {
  Write-Host ""
  Write-Host "The eval's own files changed since you last approved them, so it did not start. Nothing was spent." -ForegroundColor Yellow
  $state = "$Flow/_state.json"
  $watched = @((Get-Content $state -Raw | ConvertFrom-Json).harness_paths) + "scripts/eval-tags.mjs", "package-lock.json"
  $since = git log -1 --format=%H -- $state 2>$null
  if ($since) {
    $changed = git diff --name-only $since -- $watched 2>$null
    if ($changed) { Write-Host "Changed since the approval was last saved in git:"; $changed | ForEach-Object { Write-Host "  $_" } }
  }
  Write-Host "Approve only if you made or reviewed these changes (rules, prompt, golden answers, runner)."
  if (-not (Ask "Approve and run?")) { Stop-With "Stopped. Nothing was spent." }
  $log = Invoke-Eval $plan.variant -Approve
}

if ($log -match "credit balance is too low") {
  Stop-With "The Anthropic account is out of credits. Buy more at console.anthropic.com (Settings, Billing), then double-click 'Run tag eval' again: it picks up where it stopped."
}
if ($log -match "authentication_error|invalid x-api-key") {
  Write-Host ""
  Write-Host "Anthropic rejected the API key." -ForegroundColor Yellow
  if (Ask "Replace the saved key now?") { Remove-Item Env:ANTHROPIC_API_KEY; Save-Key; Stop-With "Key replaced. Double-click 'Run tag eval' again: it picks up where it stopped." }
  Stop-With "Stopped. The failed calls were not charged."
}
if ($EvalExit -eq 2) { Stop-With "The eval could not start (see the message above)." }

Write-Host ""
Write-Host "Step 3 of 3: building the results page..."
if ($EvalExit -ne 0) { Write-Host "Some calls failed. They are listed on the page and are retried the next time you run this." -ForegroundColor Yellow }
Show-Report $plan.variant
