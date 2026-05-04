$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open("c:\Users\carlos.milla\OneDrive - Tegra\Desktop\AlphaColorMacht2\nombres colores\base de datos.xlsx")
$sheet = $wb.Sheets.Item(1)
$range = $sheet.UsedRange
$rows = $range.Rows.Count
$cols = $range.Columns.Count

for ($r = 1; $r -le $rows; $r++) {
    $line = @()
    for ($c = 1; $c -le $cols; $c++) {
        $val = $range.Cells.Item($r, $c).Text
        $line += "`"$val`""
    }
    $line -join ","
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
