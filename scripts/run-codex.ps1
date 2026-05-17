# Thin Codex wrapper: invokes `codex.cmd exec` headlessly or guides the user
# through a manual paste-in. Stateless w.r.t. task slug — caller passes paths.
#
# Modes:
#   cli    — pipes the rendered prompt via stdin to `codex.cmd exec` and writes
#            the last assistant message to OutputFile.
#   manual — confirms the rendered prompt is on disk, prints paste instructions,
#            and returns immediately. The orchestrating skill is responsible for
#            the conversational pause (Bash tool calls must not block).
#
# Defaults: -Mode comes from $env:CODEX_MODE; if unset, defaults to 'manual'
# (safer for first-time users without Codex CLI installed).

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $RenderedPromptFile,

    [Parameter(Mandatory = $true)]
    [string] $OutputFile,

    [string] $RepoRoot = $PWD.Path,

    [ValidateSet('cli', 'manual')]
    [string] $Mode = $(if ($env:CODEX_MODE) { $env:CODEX_MODE } else { 'manual' })
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $RenderedPromptFile)) {
    throw "Rendered prompt file not found: $RenderedPromptFile"
}

# Ensure OutputFile's parent directory exists (Codex won't create it).
$outputDir = Split-Path -Parent $OutputFile
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

if ($Mode -eq 'manual') {
    Write-Output ''
    Write-Output '=== Codex manual mode ==='
    Write-Output "Prompt is rendered at: $RenderedPromptFile"
    Write-Output "Paste Codex's response into:  $OutputFile"
    Write-Output ''
    Write-Output 'Open Codex (web/IDE), paste the rendered prompt, and save Codex'
    Write-Output 'output to the path above. The orchestrating skill will resume'
    Write-Output 'when you confirm.'
    Write-Output ''
    exit 0
}

# CLI mode: codex.cmd is the .cmd extension form, which bypasses PowerShell
# execution-policy blocks on .ps1 shims. `exec -C <repo> -o <out> -` reads the
# prompt from stdin and writes the last assistant message to <out>.

$codexCmd = Get-Command codex.cmd -ErrorAction SilentlyContinue
if (-not $codexCmd) {
    throw "codex.cmd not found on PATH. Install with: npm i -g @openai/codex, or fall back to manual mode with `$env:CODEX_MODE = 'manual'."
}

Get-Content -LiteralPath $RenderedPromptFile -Raw |
    & codex.cmd exec -C $RepoRoot -o $OutputFile -

if ($LASTEXITCODE -ne 0) {
    throw "codex.cmd exec failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path -LiteralPath $OutputFile)) {
    throw "codex.cmd reported success but $OutputFile was not written."
}

Write-Output "Codex response written to: $OutputFile"
