$url = 'https://cdiwriptqmqnexxukqaf.supabase.co'
$key = 'sb_publishable_vX6RQCfPpA14Pg9ZVgDrFg_l3jY7KVw'
$headers = @{
    'apikey' = $key
    'Authorization' = "Bearer $key"
    'Content-Type' = 'application/json'
    'Prefer' = 'return=minimal'
}

$allPerms = '["comparator","history","paletteValidator","development","assignment","reports","dashboard","backup","admin","linearization"]'
$body = "{""is_master"": false, ""permisos"": $allPerms}"

$users = @('ARYANIE','BAEZ','EVALDIM','KEVIN','MARVINC','NICOLE.NUÑEZ09')

foreach ($username in $users) {
    $encoded = [System.Uri]::EscapeDataString($username)
    $uri = "$url/rest/v1/usuarios?username=eq.$encoded"
    try {
        $response = Invoke-RestMethod -Uri $uri -Method Patch -Headers $headers -Body $body
        Write-Host "✅ OK: $username"
    } catch {
        Write-Host "❌ ERROR: $username - $_"
    }
}
Write-Host ""
Write-Host "Migración completada."
