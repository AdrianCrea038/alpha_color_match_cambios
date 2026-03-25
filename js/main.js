exportResults() {
    if (this.primaryData.length === 0 && this.comparisonResults.length === 0) {
        this.uiRenderer.showToast('No hay datos para exportar', 'warning');
        return;
    }
    
    // ✅ Crear un conjunto único de colores para exportar
    // Usamos primaryData como base porque contiene los valores unificados
    const colorsToExport = [];
    const exportedIds = new Set();
    
    // 1. Agregar todos los colores de primaryData (valores unificados)
    for (const color of this.primaryData) {
        colorsToExport.push({
            id: color.id,
            name: color.name,
            cmyk: color.cmyk,
            lab: color.lab
        });
        exportedIds.add(color.id);
    }
    
    // 2. Agregar colores de secondaryData que no estén en primaryData
    //    (por si hay colores que no se unificaron pero están en secundario)
    for (const color of this.secondaryData) {
        if (!exportedIds.has(color.id)) {
            // Verificar si el color existe en primaryData por nombre normalizado
            const normalizedName = this.colorMatcher.normalizeNameForComparison(color.name);
            const existsInPrimary = this.primaryData.some(p => 
                this.colorMatcher.normalizeNameForComparison(p.name) === normalizedName
            );
            
            if (!existsInPrimary) {
                colorsToExport.push({
                    id: color.id,
                    name: color.name,
                    cmyk: color.cmyk,
                    lab: color.lab
                });
            }
        }
    }
    
    // 3. Ordenar por ID para mantener consistencia
    colorsToExport.sort((a, b) => {
        const numA = parseInt(a.id) || 0;
        const numB = parseInt(b.id) || 0;
        return numA - numB;
    });
    
    console.log(`📤 Exportando ${colorsToExport.length} colores con valores unificados`);
    
    // Generar contenido del archivo TXT
    let content = 'CGATS.17\n';
    content += 'ORIGINATOR\t"ALPHA COLOR MATCH"\n';
    content += `CREATED\t"${new Date().toLocaleDateString()}"\n`;
    content += 'NUMBER_OF_FIELDS\t9\n';
    content += 'BEGIN_DATA_FORMAT\n';
    content += 'SAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\n';
    content += 'END_DATA_FORMAT\n';
    content += `NUMBER_OF_SETS\t${colorsToExport.length}\n`;
    content += 'BEGIN_DATA\n\n';
    
    colorsToExport.forEach(item => {
        content += `${item.id} "${item.name}" `;
        content += `${item.cmyk[0].toFixed(6)} ${item.cmyk[1].toFixed(6)} ${item.cmyk[2].toFixed(6)} ${item.cmyk[3].toFixed(6)} `;
        content += `${item.lab[0].toFixed(6)} ${item.lab[1].toFixed(6)} ${item.lab[2].toFixed(6)}\n`;
    });
    
    content += '\nEND_DATA\n';
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alpha_color_export_${new Date().toISOString().slice(0,19)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    this.uiRenderer.showToast(`📥 Exportados ${colorsToExport.length} colores con valores unificados`, 'success');
}
