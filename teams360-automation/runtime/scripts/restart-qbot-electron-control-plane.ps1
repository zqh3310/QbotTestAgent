param(
  [string]$QbotRoot,
  [Parameter(Mandatory = $true)][string]$ControlPlaneUrl,
  [string]$IgnoredThirdArgument,
  [string]$IgnoredFourthArgument,
  [string]$ExpectedQworkUiUrl,
  [ValidateSet('0','1')][string]$AgentMock = '0'
)

$ErrorActionPreference = 'Stop'
if ($ControlPlaneUrl -in @('http://127.0.0.1:8900', 'http://localhost:8900')) {
  $ControlPlaneUrl = 'http://127.0.0.1:18900'
}
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$relaunch = Join-Path $root 'lib/relaunch-managed-host.mjs'
if ($ExpectedQworkUiUrl -match '^file://.*/\.deepbank(-dev|-local|-uat|-sit)?/ui/[^/]+/index\.html') {
  & node $relaunch $ControlPlaneUrl $ExpectedQworkUiUrl $AgentMock
} else {
  & node $relaunch $ControlPlaneUrl '' $AgentMock
}
exit $LASTEXITCODE
