# Runs the tag classifier eval and opens its results page, with plain prompts. Started by double-clicking
# "Run tag eval.cmd", "View tag eval results.cmd" or "Compare tag eval models.cmd" in the project folder.
# How it works: docs/testing.md.
# Plain ASCII on purpose: Windows PowerShell 5.1 misreads other characters in a file with no byte-order mark.
param(
  [switch]$ViewOnly,                                   # only rebuild and open a results page
  [switch]$Compare,                                    # only rebuild and open the page comparing the models
  [switch]$SkipRefresh,                                # don't re-fetch the school pages first
  [string]$Model = "",                                 # claude-opus-5-5 or muse-ember-1.0; asked when not given
  [string]$Flow = ""                                   # where runs are saved; by default the model's own folder
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
$Reps = 3
$KeyDir = Join-Path $env:LOCALAPPDATA "d20-planner"

# The models the eval can run. Keep in step with scripts/lib/tag-models.js (same ids, folders and key names).
$Models = [ordered]@{
  "claude-opus-5-5" = @{ Label = "Claude Opus 5.5"; Provider = "Anthropic"; Flow = ".claude/hillclimb/tag-classifier"
                         KeyEnv = "ANTHROPIC_API_KEY"; KeyFile = "anthropic-key.txt"; Console = "console.anthropic.com (Settings, Billing)" }
  "muse-ember-1.0"  = @{ Label = "Muse Ember"; Provider = "Meta"; Flow = ".claude/hillclimb/tag-classifier-muse-ember"
                         KeyEnv = "MODEL_API_KEY"; KeyFile = "meta-key.txt"; Console = "dev.meta.ai (Billing)" }
}

function Ask($question) { return (Read-Host "$question (y/n)") -match '^\s*y' }
function Stop-With($message) { Write-Host ""; Write-Host $message -ForegroundColor Yellow; exit 1 }
function Open-Page($page) { Write-Host "Results page: $page"; if (-not $env:TAG_EVAL_NO_OPEN) { Start-Process $page } }

function Pick-Model($question) {
  $ids = @($Models.Keys)
  Write-Host $question
  for ($i = 0; $i -lt $ids.Count; $i++) { Write-Host "  $($i + 1). $($Models[$ids[$i]].Label) ($($Models[$ids[$i]].Provider))" }
  $n = Read-Host "Type a number and press Enter"
  if ($n -notmatch '^\s*\d+\s*$' -or [int]$n -lt 1 -or [int]$n -gt $ids.Count) { Stop-With "That isn't one of the numbers. Nothing was run." }
  return $ids[[int]$n - 1]
}

function Show-Report($variant) {
  $page = if ($variant) { node scripts/eval-tags-report.js --flow $Flow --variant $variant } else { node scripts/eval-tags-report.js --flow $Flow }
  if ($LASTEXITCODE -ne 0) { Stop-With "There are no $($M.Label) results to show yet. Double-click 'Run tag eval' first." }
  Open-Page $page
}
# The comparison page, when every model has results. Quiet when it can't be built yet, unless asked for.
function Show-Comparison([switch]$Quiet) {
  # Through cmd so its "nothing to compare" line stays quiet: PowerShell 5.1 turns a native program's
  # stderr into an error record, which stops this script.
  $page = cmd /c "node scripts/eval-tags-compare.js 2>nul"
  if ($LASTEXITCODE -ne 0) { if ($Quiet) { return }; Stop-With "Nothing to compare yet: run the eval once with each model first." }
  Write-Host "Comparison of the models: $page"
  if (-not $env:TAG_EVAL_NO_OPEN) { Start-Process $page }
}

# Each provider's key is kept encrypted by Windows for this Windows account only, outside the project folder,
# so it is neither in git nor synced by OneDrive. It is put in this process's environment and nowhere else,
# and only the run's own model gets it: the eval never sends one provider's key to another.
function Save-Key {
  $secure = Read-Host "Paste your $($M.Provider) API key and press Enter (it stays hidden)" -AsSecureString
  if ($secure.Length -eq 0) { Stop-With "No key entered. Nothing was run." }
  New-Item -ItemType Directory -Force $KeyDir | Out-Null
  $secure | ConvertFrom-SecureString | Set-Content $KeyFile -Encoding ascii
  Write-Host "Saved, encrypted, at $KeyFile"
}
function Use-Key {
  if ([Environment]::GetEnvironmentVariable($M.KeyEnv)) { return }
  if (-not (Test-Path $KeyFile)) { Write-Host "No $($M.Provider) API key is saved on this computer yet."; Save-Key }
  try { $secure = Get-Content $KeyFile | ConvertTo-SecureString }
  catch { Write-Host "The saved $($M.Provider) key can't be read by this Windows account."; Save-Key; $secure = Get-Content $KeyFile | ConvertTo-SecureString }
  [Environment]::SetEnvironmentVariable($M.KeyEnv, (New-Object System.Net.NetworkCredential("", $secure)).Password, "Process")
}

# Runs the eval, showing its progress as it goes, and returns everything it printed.
function Invoke-Eval($variant, [switch]$Approve) {
  $extra = if ($Approve) { " --approve-harness" } else { "" }
  cmd /c "npm.cmd run --silent eval:tags -- --flow `"$Flow`" --model $Model --variant $variant --reps $Reps$extra 2>&1" | Tee-Object -Variable log | Out-Host
  $script:EvalExit = $LASTEXITCODE
  return ($log -join "`n")
}

if ($Compare) { Show-Comparison; exit 0 }

Write-Host "Tag classifier eval" -ForegroundColor Cyan
if ($ViewOnly) {
  if (-not $Model) { $Model = Pick-Model "Whose results?" }
} else {
  Write-Host "Asks a model whether each school earns Music & band, Arts and Science & tech, and compares with our answers."
  Write-Host ""
  if (-not $Model) { $Model = Pick-Model "Which model should answer?" }
}
if (-not $Models.Contains($Model)) { Stop-With "Unknown model '$Model'. Known: $(@($Models.Keys) -join ', ')." }
$M = $Models[$Model]
if (-not $Flow) { $Flow = $M.Flow }
$KeyFile = Join-Path $KeyDir $M.KeyFile

if ($ViewOnly) { Show-Report $null; exit 0 }
Write-Host ""
Write-Host "Model: $($M.Label) ($($M.Provider)). Its runs are saved in $Flow."
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
Write-Host "  This makes about $left paid calls to $($M.Label)."
if ($plan.last) { Write-Host "  For scale: the last full run ('$($plan.last.variant)') used $('{0:N0}' -f $plan.last.in) tokens in and $('{0:N0}' -f $plan.last.out) out." }
if (-not (Ask "Run it now?")) { Stop-With "Stopped. Nothing was spent." }

Use-Key
$log = Invoke-Eval $plan.variant

# The runner refuses to start when the rules, prompt, golden answers or runner changed since you last
# approved them (or, for a model's first run, were never approved for its folder). That check stays; here
# it is a question instead of a command-line flag.
if ($EvalExit -eq 2 -and $log -match "approve-harness") {
  Write-Host ""
  Write-Host "The eval's own files changed since you last approved them for $($M.Label), so it did not start. Nothing was spent." -ForegroundColor Yellow
  $state = "$Flow/_state.json"
  $watched = @((Get-Content $state -Raw | ConvertFrom-Json).harness_paths) + "scripts/eval-tags.mjs", "package-lock.json"
  $since = git log -1 --format=%H -- $state 2>$null
  if ($since) {
    $changed = git diff --name-only $since -- $watched 2>$null
    if ($changed) { Write-Host "Changed since the approval was last saved in git:"; $changed | ForEach-Object { Write-Host "  $_" } }
  } else { Write-Host "This is the first run for $($M.Label), so nothing has been approved for it yet." }
  Write-Host "Approve only if you made or reviewed these changes (rules, prompt, golden answers, runner)."
  if (-not (Ask "Approve and run?")) { Stop-With "Stopped. Nothing was spent." }
  $log = Invoke-Eval $plan.variant -Approve
}

if ($log -match "credit balance is too low|billing_error|billing_not_configured|insufficient balance") {
  Stop-With "The $($M.Provider) account is out of credits or has no billing set up. Fix it at $($M.Console), then double-click 'Run tag eval' again: it picks up where it stopped."
}
if ($log -match "authentication_error|invalid x-api-key|invalid_api_key") {
  Write-Host ""
  Write-Host "$($M.Provider) rejected the API key." -ForegroundColor Yellow
  if (Ask "Replace the saved $($M.Provider) key now?") {
    [Environment]::SetEnvironmentVariable($M.KeyEnv, $null, "Process"); Save-Key
    Stop-With "Key replaced. Double-click 'Run tag eval' again: it picks up where it stopped."
  }
  Stop-With "Stopped. The failed calls were not charged."
}
if ($log -match "served model .* != requested") {
  Write-Host ""
  Write-Host "$($M.Provider) answered with a different model than the one asked for, so those answers weren't scored. The message above names both." -ForegroundColor Yellow
}
if ($EvalExit -eq 2) { Stop-With "The eval could not start (see the message above)." }

Write-Host ""
Write-Host "Step 3 of 3: building the results page..."
if ($EvalExit -ne 0) { Write-Host "Some calls failed. They are listed on the page and are retried the next time you run this." -ForegroundColor Yellow }
Show-Report $plan.variant
Show-Comparison -Quiet
