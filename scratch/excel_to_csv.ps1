$excelFile = "c:\Users\carlos.milla\OneDrive - Tegra\Desktop\AlphaColorMacht2\nombres colores\base de datos.xlsx"
$csvFile = "c:\Users\carlos.milla\OneDrive - Tegra\Desktop\AlphaColorMacht2\scratch\full_database.csv"

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    $wb = $excel.Workbooks.Open($excelFile)
    # 6 = xlCSV
    $wb.SaveAs($csvFile, 6)
    $wb.Close($false)
    Write-Host "Exportación exitosa a $csvFile"
} catch {
    Write-Host "Error: $_"
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
