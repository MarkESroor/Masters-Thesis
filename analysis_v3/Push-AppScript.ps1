[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSCommandPath)
try {
  $clasp = Get-Command clasp -ErrorAction SilentlyContinue
  if ($clasp) { & $clasp.Source push --force }
  else { & npx --yes @google/clasp@latest push --force }
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
