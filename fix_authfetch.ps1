$dir = "c:\Users\Rakesh\OneDrive\Desktop\Project II\Parking-Slot-Management\smart_parking_react\src\pages"
Get-ChildItem "$dir\*.jsx" | ForEach-Object {
  $content = Get-Content $_.FullName -Raw
  # Fix doubled prefix
  $updated = $content -replace "authauthFetch", "authFetch"
  if ($updated -ne $content) {
    Set-Content $_.FullName $updated -NoNewline
    Write-Host "Fixed: $($_.Name)"
  }
}
Write-Host "Done."
