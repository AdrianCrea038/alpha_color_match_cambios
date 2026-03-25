export class FileHandler {
    async parseTxtFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const records = this.parseContent(content);
                resolve(records);
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
    
    // ✅ Función para normalizar espacios en nombres
    normalizeSpaces(str) {
        if (!str) return '';
        // Eliminar espacios al inicio y final, y reemplazar múltiples espacios por uno solo
        return str.trim().replace(/\s+/g, ' ');
    }
    
    parseContent(content) {
        const lines = content.split(/\r?\n/);
        let dataStarted = false;
        const records = [];
        
        for (let line of lines) {
            if (line.trim() === 'BEGIN_DATA') {
                dataStarted = true;
                continue;
            }
            if (dataStarted && line.trim() === 'END_DATA') break;
            if (!dataStarted) continue;
            if (line.trim() === '') continue;
            
            const match = line.match(/^(\d+)\s+"([^"]+)"\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)/);
            
            if (match) {
                // ✅ NORMALIZAR ESPACIOS EN EL NOMBRE
                const normalizedName = this.normalizeSpaces(match[2]);
                records.push({
                    id: match[1],
                    name: normalizedName,
                    cmyk: [parseFloat(match[3]), parseFloat(match[4]), parseFloat(match[5]), parseFloat(match[6])],
                    lab: [parseFloat(match[7]), parseFloat(match[8]), parseFloat(match[9])]
                });
            } else {
                const simpleMatch = line.match(/^(\d+)\s+([^\s]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)/);
                if (simpleMatch) {
                    // ✅ NORMALIZAR ESPACIOS EN EL NOMBRE
                    const normalizedName = this.normalizeSpaces(simpleMatch[2]);
                    records.push({
                        id: simpleMatch[1],
                        name: normalizedName,
                        cmyk: [parseFloat(simpleMatch[3]), parseFloat(simpleMatch[4]), parseFloat(simpleMatch[5]), parseFloat(simpleMatch[6])],
                        lab: [parseFloat(simpleMatch[7]), parseFloat(simpleMatch[8]), parseFloat(simpleMatch[9])]
                    });
                }
            }
        }
        
        return records;
    }
    
    generateExportContent(results) {
        let content = 'CGATS.17\n';
        content += 'ORIGINATOR\t"ALPHA COLOR MATCH"\n';
        content += `CREATED\t"${new Date().toLocaleDateString()}"\n`;
        content += 'NUMBER_OF_FIELDS\t9\n';
        content += 'BEGIN_DATA_FORMAT\n';
        content += 'SAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\n';
        content += 'END_DATA_FORMAT\n';
        content += `NUMBER_OF_SETS\t${results.length}\n`;
        content += 'BEGIN_DATA\n\n';
        
        results.forEach(item => {
            const cmyk = item.cmykPrimary || item.cmykSecondary;
            const lab = item.labPrimary || item.labSecondary;
            content += `${item.id} "${item.name}" `;
            content += `${cmyk[0].toFixed(6)} ${cmyk[1].toFixed(6)} ${cmyk[2].toFixed(6)} ${cmyk[3].toFixed(6)} `;
            content += `${lab[0].toFixed(6)} ${lab[1].toFixed(6)} ${lab[2].toFixed(6)}\n`;
        });
        
        content += '\nEND_DATA\n';
        return content;
    }
    
    generateTxtFromData(data) {
        let content = 'CGATS.17\n';
        content += 'ORIGINATOR\t"ALPHA COLOR MATCH"\n';
        content += `CREATED\t"${new Date().toLocaleDateString()}"\n`;
        content += 'NUMBER_OF_FIELDS\t9\n';
        content += 'BEGIN_DATA_FORMAT\n';
        content += 'SAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\n';
        content += 'END_DATA_FORMAT\n';
        content += `NUMBER_OF_SETS\t${data.length}\n`;
        content += 'BEGIN_DATA\n\n';
        
        data.forEach(item => {
            content += `${item.id} "${item.name}" `;
            content += `${item.cmyk.c.toFixed(6)} ${item.cmyk.m.toFixed(6)} ${item.cmyk.y.toFixed(6)} ${item.cmyk.k.toFixed(6)} `;
            content += `${item.lab.l.toFixed(6)} ${item.lab.a.toFixed(6)} ${item.lab.b.toFixed(6)}\n`;
        });
        
        content += '\nEND_DATA\n';
        return content;
    }
}
