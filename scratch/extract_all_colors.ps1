$excelPath = "c:\Users\carlos.milla\OneDrive - Tegra\Desktop\AlphaColorMacht2\nombres colores\base de datos.xlsx"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open($excelPath)
$ws = $wb.Sheets.Item(1)

$groups = @{}
$row = 2 # Empezamos en la fila 2 para saltar encabezados

while ($ws.Cells.Item($row, 1).Value() -ne $null) {
    $name = $ws.Cells.Item($row, 1).Value().ToString().Trim()
    $id = $ws.Cells.Item($row, 2).Value()
    
    if ($id -ne $null) {
        $idStr = $id.ToString().Trim()
        if ($idStr -ne "") {
            if (-not $groups.ContainsKey($idStr)) {
                $groups[$idStr] = New-Object System.Collections.Generic.List[string]
            }
            if (-not $groups[$idStr].Contains($name)) {
                $groups[$idStr].Add($name)
            }
        }
    }
    $row++
}

$wb.Close($false)
$excel.Quit()

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
