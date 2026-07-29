$dir = "c:\Users\nikhi\Videos\ParkSystem\smart_parking_react\src\pages"
# Replace fetch('/api/ with authFetch('/api/ in all pages
Get-ChildItem "$dir\*.jsx" | ForEach-Object {
  $content = Get-Content $_.FullName -Raw
  # Replace: fetch('/api/ -> authFetch('/api/
  # but NOT in AuthenticationLogin.jsx (those go to /api/auth/ which has no JWT requirement)
  if ($_.Name -ne "AuthenticationLogin.jsx") {
    $updated = $content -replace "await fetch\('/api/", "await authFetch('/api/"
    $updated = $updated -replace "fetch\('/api/", "authFetch('/api/"
    if ($updated -ne $content) {
      Set-Content $_.FullName $updated
      Write-Host "Replaced fetch->authFetch in: $($_.Name)"
    }
  }
}
