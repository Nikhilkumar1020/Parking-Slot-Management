$dir = "c:\Users\Rakesh\OneDrive\Desktop\Project II\Parking-Slot-Management\smart_parking_react\src\pages"
Get-ChildItem "$dir\*.jsx" | ForEach-Object {
  $content = Get-Content $_.FullName -Raw
  # Replace alert() calls with toast patterns
  $updated = $content
  $updated = $updated -replace "alert\('([^']+)'\)", 'toast.success("$1")'
  $updated = $updated -replace 'alert\("([^"]+)"\)', 'toast.success("$1")'
  if ($updated -ne $content) {
    Set-Content $_.FullName $updated
    Write-Host "Replaced alert() in: $($_.Name)"
  }
}
