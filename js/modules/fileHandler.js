export class FileHandler {
    constructor() {
        // TABLA DE UNIFICACIÓN DE NOMBRES
        this.nameMapping = new Map([
            ["10FTM White", "10A White"],
            ["03sTM Black", "00A Black"],
            ["01PTM DK Steel Grey", "01P DK Steel Grey"],
            ["03TBlue Grey", "01V Wolf Grey"],
            ["05XTM Anthracite", "06F Anthracite"],
            ["2AQTM Brown", "20Q Dark Cinder"],
            ["2DHTM Medium Olive", "2DH Medium Olive"],
            ["3EMTM Kelly Green", "31W Classic Green"],
            ["31VTM Dark Green", "39Y Gorge Green"],
            ["43VTM Navy", "41S College Navy"],
            ["44ATM Tidal Blue", "44A Tidal Blue"],
            ["45WTM Blustery", "45W Blustery"],
            ["4ES TM Aero Blue", "4ES Aero Blue"],
            ["49VTM Royal", "4EV Game Royal"],
            ["4CVTM Light Blue", "4EY Valor Blue"],
            ["52VTM Purple", "56N Field Purple"],
            ["64VTM Scarlet", "65N University Red"],
            ["67YTM Dark Maroon", "66P Deep Maroon"],
            ["6DRTM Pink Fire II", "66Z Pink Fire II"],
            ["69WTM Crimson", "69W Team Crimson"],
            ["69YTM Cardinal", "69X Team Maroon"],
            ["79YTM Bright Gold", "79Q Sundown"],
            ["79STM Yellow Strike", "79S Yellow Strike"],
            ["79XTM Vegas Gold", "79W Team Gold"],
            ["81FDesert Orange", "81F Desert Orange"],
            ["87FTM Bright Ceramic", "87F Bright Ceramic"],
            ["82U TM Orange", "89L Team Orange"],
            ["06HFlint Grey", "06H Flint Grey"],
            ["15ANatural", "15A Natural"],
            ["3EYPro Green", "3EY Pro Green"],
            ["3HNAction Green", "3HN Action Green"],
            ["3GUHyper Turquoise", "3GU Hyper Turquoise"],
            ["44USignal Blue", "44U Signal Blue"],
            ["4KBDark Turquoise", "4KB Dark Turquoise"],
            ["4LBGym Blue", "4LB Gym Blue"],
            ["48YItaly Blue", "48Y Italy Blue"],
            ["52MNew Orchid", "52M New Orchid"],
            ["71RVolt", "71R Volt"],
            ["77CGold", "77C Gold"],
            ["76IUniversity Gold", "76I University Gold"],
            ["78HAmarillo", "78H Amarillo"],
            ["79VClub Gold", "79V Club Gold"],
            ["89MUniversity Orange", "89M University Orange"],
            ["89NBrilliant Orange", "89N Brilliant Orange"],
            ["89QOrange Horizon", "89Q Orange Horizon"]
        ]);
    }

    async parseTxtFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const records = this.parseContent(content);
                // ✅ Eliminar duplicados por ID (por si acaso)
                const uniqueRecords = this.removeDuplicatesById(records);
                resolve(uniqueRecords);
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
    
    // ✅ Método para eliminar duplicados por ID
    removeDuplicatesById(records) {
        const seen = new Map();
        const unique = [];
        
        for (const record of records) {
            if (!seen.has(record.id)) {
                seen.set(record.id, true);
                unique.push(record);
            }
        }
        
        if (records.length !== unique.length) {
            console.warn(`⚠️ Se eliminaron ${records.length - unique.length} registros duplicados por ID`);
        }
        
        return unique;
    }
    
    normalizeSpaces(str) {
        if (!str) return '';
        return str.trim().replace(/\s+/g, ' ');
    }
    
    extractNKCode(name) {
        const match = name.match(/NK\d+$/);
        return match ? match[0] : null;
    }
    
    removeNKCode(name) {
        return name.replace(/\s+NK\d+$/, '').trim();
    }
    
    normalizeNameWithMapping(name) {
        let normalized = this.normalizeSpaces(name);
        
        for (let [original, mapped] of this.nameMapping) {
            const normalizedOriginal = this.normalizeSpaces(original).toLowerCase();
            const normalizedName = normalized.toLowerCase();
            
            if (normalizedName === normalizedOriginal || 
                normalizedName.includes(normalizedOriginal) ||
                normalizedOriginal.includes(normalizedName)) {
                return mapped;
            }
        }
        
        return normalized;
    }
    
    parseContent(content) {
        const lines = content.split(/\r?\n/);
        let dataStarted = false;
        const records = [];
        
        for (let line of lines) {
            // Saltar líneas vacías
            if (line.trim() === '') continue;
            
            if (line.trim() === 'BEGIN_DATA') {
                dataStarted = true;
                continue;
            }
            if (dataStarted && line.trim() === 'END_DATA') break;
            if (!dataStarted) continue;
            
            // ✅ UN SOLO PATRÓN DE MATCH - evitar duplicados
            // Patrón que soporta nombres con o sin comillas
            const match = line.match(/^(\d+)\s+(?:"([^"]+)"|([^\s]+))\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)/);
            
            if (match) {
                // Obtener el nombre (con comillas o sin ellas)
                let originalName = match[2] || match[3];
                
                if (originalName) {
                    // Extraer código NK
                    const nkCode = this.extractNKCode(originalName);
                    
                    // Eliminar código NK para normalización
                    let nameWithoutNK = this.removeNKCode(originalName);
                    
                    // Normalizar nombre según tabla de unificación
                    let normalizedBaseName = this.normalizeNameWithMapping(nameWithoutNK);
                    
                    // Reconstruir nombre final con código NK (si existía)
                    let finalName = normalizedBaseName;
                    if (nkCode) {
                        finalName = `${normalizedBaseName} ${nkCode}`;
                    }
                    
                    // Verificar si ya existe un registro con este ID (evitar duplicados en el mismo archivo)
                    const existingIndex = records.findIndex(r => r.id === match[1]);
                    if (existingIndex !== -1) {
                        console.warn(`⚠️ ID duplicado encontrado: ${match[1]}, omitiendo duplicado`);
                        continue;
                    }
                    
                    records.push({
                        id: match[1],
                        name: finalName,
                        originalName: originalName,
                        normalizedBaseName: normalizedBaseName,
                        cmyk: [parseFloat(match[4]), parseFloat(match[5]), parseFloat(match[6]), parseFloat(match[7])],
                        lab: [parseFloat(match[8]), parseFloat(match[9]), parseFloat(match[10])]
                    });
                }
            } else {
                // Si no match con el patrón principal, intentar con formato alternativo
                const altMatch = line.match(/^(\d+)\s+([^\s]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)/);
                if (altMatch) {
                    let originalName = altMatch[2];
                    
                    const nkCode = this.extractNKCode(originalName);
                    let nameWithoutNK = this.removeNKCode(originalName);
                    let normalizedBaseName = this.normalizeNameWithMapping(nameWithoutNK);
                    
                    let finalName = normalizedBaseName;
                    if (nkCode) {
                        finalName = `${normalizedBaseName} ${nkCode}`;
                    }
                    
                    // Verificar si ya existe un registro con este ID
                    const existingIndex = records.findIndex(r => r.id === altMatch[1]);
                    if (existingIndex !== -1) {
                        console.warn(`⚠️ ID duplicado encontrado: ${altMatch[1]}, omitiendo duplicado`);
                        continue;
                    }
                    
                    records.push({
                        id: altMatch[1],
                        name: finalName,
                        originalName: originalName,
                        normalizedBaseName: normalizedBaseName,
                        cmyk: [parseFloat(altMatch[3]), parseFloat(altMatch[4]), parseFloat(altMatch[5]), parseFloat(altMatch[6])],
                        lab: [parseFloat(altMatch[7]), parseFloat(altMatch[8]), parseFloat(altMatch[9])]
                    });
                }
            }
        }
        
        console.log(`📄 Parseados ${records.length} registros únicos del archivo`);
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
