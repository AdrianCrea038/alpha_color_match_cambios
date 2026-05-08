$lines = Get-Content "c:\Users\carlos.milla\OneDrive - Tegra\Desktop\AlphaColorMacht2\colores_auditados_limpios.txt"
$groups = @{}
$currentId = ""

foreach ($line in $lines) {
    if ($line -match "\t") {
        $parts = $line -split "\t"
        $name = $parts[0].Trim()
        $id = if ($parts.Length -gt 1) { $parts[1].Trim() } else { "" }
        
        # Si hay un ID nuevo, lo actualizamos
        if ($id -ne "") {
            $currentId = $id
        }
        
        # Si tenemos un ID activo y el nombre no es el encabezado, agregamos al grupo
        if ($currentId -ne "" -and $name -ne "Nombre del Color" -and $name -ne "") {
            if (-not $groups.ContainsKey($currentId)) {
                $groups[$currentId] = New-Object System.Collections.Generic.List[string]
            }
            if (-not $groups[$currentId].Contains($name)) {
                $groups[$currentId].Add($name)
            }
        }
    }
}

Write-Host "TRUNCATE TABLE equivalencias;"
Write-Host "INSERT INTO equivalencias (grupo_id, colores) VALUES"

$sqlEntries = @()
foreach ($gid in $groups.Keys) {
    $names = $groups[$gid]
    $formattedNames = @()
    foreach ($n in $names) {
        $cleanName = $n.Replace("'", "''")
        $formattedNames += "'$cleanName'"
    }
    $namesList = $formattedNames -join ", "
    $sqlEntries += "('$gid', ARRAY[$namesList])"
}

Write-Host ($sqlEntries -join ",`n") + ";"
