$dir = "c:\Users\nikhi\Videos\ParkSystem\smart_parking_react\src\pages"
$files = @("LandingDashboard.jsx", "NotificationsCenter.jsx", "ReservationModule.jsx", "VehicleManagement.jsx", "VisitorManagement.jsx", "SlotManagement.jsx", "AdminDashboard.jsx")

foreach ($file in $files) {
  $path = Join-Path $dir $file
  if (Test-Path $path) {
    $content = Get-Content $path -Raw
    # Add toast context import after the last import line if not already present
    if ($content -notmatch "useToast") {
      # Add import after AuthContext import
      $updated = $content -replace "(import \{ useAuth, authFetch \} from '\.\.\/context\/AuthContext';)", "`$1`nimport { useToast } from '../context/ToastContext';"
      # Add const toast = useToast(); after const { user } = useAuth(); or const { user, socket } = ...
      $updated = $updated -replace "(const \{ user(?:[^}]*)?\} = useAuth\(\);)", "`$1`n  const toast = useToast();"
      if ($updated -ne $content) {
        Set-Content $path $updated
        Write-Host "Added useToast to: $file"
      }
    }
  }
}
