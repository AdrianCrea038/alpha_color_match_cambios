exportResults() {
    if (this.primaryData.length === 0 && this.secondaryData.length === 0) {
        this.uiRenderer.showToast('No hay datos para exportar', 'warning');
        return;
    }
    
    // ✅ Crear mapa de colores por nombre normalizado
    const colorMap = new Map(); // key: nombre normalizado, value: { cmyk, lab, names: [] }
    
    // 1. Agregar colores de primaryData (valores unificados)
    for (const color of this.primaryData) {
        const normalizedName = this.colorMatcher.normalizeNameForComparison(color.name);
        if (!colorMap.has(normalizedName)) {
            colorMap.set(normalizedName, {
                cmyk: color.cmyk,
                lab: color.lab,
                names: new Map() // Map de id -> nombre completo
            });
        }
        const entry = colorMap.get(normalizedName);
        entry.names.set(color.id, color.name);
    }
    
    // 2. Agregar colores de secondaryData
    for (const color of this.secondaryData) {
        const normalizedName = this.colorMatcher.normalizeNameForComparison(color.name);
        if (!colorMap.has(normalizedName)) {
            // Si no existe en primary, usar valores del secundario
            colorMap.set(normalizedName, {
                cmyk: color.cmyk,
                lab: color.lab,
                names: new Map()
            });
        } else {
            // Si ya existe, mantener los CMYK de primary (valores unificados)
            // No sobrescribir
        }
        const entry = colorMap.get(normalizedName);
        entry.names.set(color.id, color.name);
    }
    
    // 3. Construir lista de colores para exportar
    const colorsToExport = [];
    for (const [normalizedName, data] of colorMap) {
        for (const [id, name] of data.names) {
            colorsToExport.push({
                id: id,
                name: name,
                cmyk: data.cmyk,
                lab: data.lab
            });
        }
    }
    
    // 4. Ordenar por ID
    colorsToExport.sort((a, b) => {
        const numA = parseInt(a.id) || 0;
        const numB = parseInt(b.id) || 0;
        return numA - numB;
    });
    
    console.log(`📤 Exportando ${colorsToExport.length} colores (${colorMap.size} grupos unificados)`);
    
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
    this.uiRenderer.showToast(`📥 Exportados ${colorsToExport.length} colores (${colorMap.size} grupos unificados)`, 'success');
}
