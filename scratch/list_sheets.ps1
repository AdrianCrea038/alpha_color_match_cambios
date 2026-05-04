$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open("c:\Users\carlos.milla\OneDrive - Tegra\Desktop\AlphaColorMacht2\nombres colores\base de datos.xlsx")
foreach ($sheet in $wb.Sheets) {
    Write-Output $sheet.Name
}
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
