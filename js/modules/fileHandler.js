export class FileHandler {
    constructor() {
        // ✅ TABLA DE UNIFICACIÓN DE NOMBRES (según tu archivo)
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
                resolve(records);
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
    
    // ✅ Función para normalizar espacios en nombres
    normalizeSpaces(str) {
        if (!str) return '';
        return str.trim().replace(/\s+/g, ' ');
    }
    
    // ✅ Función para extraer el código NK del nombre
    extractNKCode(name) {
        const match = name.match(/NK\d+$/);
        return match ? match[0] : null;
    }
    
    // ✅ Función para eliminar el código NK del nombre
    removeNKCode(name) {
        return name.replace(/\s+NK\d+$/, '').trim();
    }
    
    // ✅ Función para normalizar el nombre según la tabla de unificación
    normalizeNameWithMapping(name) {
        // Primero eliminar espacios múltiples
        let normalized = this.normalizeSpaces(name);
        
        // Buscar en el mapa de unificación
        for (let [original, mapped] of this.nameMapping) {
            // Comparar ignorando espacios y mayúsculas
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
            if (line.trim() === 'BEGIN_DATA') {
                dataStarted = true;
                continue;
            }
            if (dataStarted && line.trim() === 'END_DATA') break;
            if (!dataStarted) continue;
            if (line.trim() === '') continue;
            
            const match = line.match(/^(\d+)\s+"([^"]+)"\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)/);
            
            if (match) {
                let originalName = match[2];
                
                // ✅ Extraer código NK
                const nkCode = this.extractNKCode(originalName);
                
                // ✅ Eliminar código NK para normalización
                let nameWithoutNK = this.removeNKCode(originalName);
                
                // ✅ Normalizar nombre según tabla de unificación
                let normalizedBaseName = this.normalizeNameWithMapping(nameWithoutNK);
                
                // ✅ Reconstruir nombre final con código NK (si existía)
                let finalName = normalizedBaseName;
                if (nkCode) {
                    finalName = `${normalizedBaseName} ${nkCode}`;
                }
                
                records.push({
                    id: match[1],
                    name: finalName,
                    originalName: originalName,
                    normalizedBaseName: normalizedBaseName,
                    cmyk: [parseFloat(match[3]), parseFloat(match[4]), parseFloat(match[5]), parseFloat(match[6])],
                    lab: [parseFloat(match[7]), parseFloat(match[8]), parseFloat(match[9])]
                });
            } else {
                const simpleMatch = line.match(/^(\d+)\s+([^\s]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)/);
                if (simpleMatch) {
                    let originalName = simpleMatch[2];
                    
                    const nkCode = this.extractNKCode(originalName);
                    let nameWithoutNK = this.removeNKCode(originalName);
                    let normalizedBaseName = this.normalizeNameWithMapping(nameWithoutNK);
                    
                    let finalName = normalizedBaseName;
                    if (nkCode) {
                        finalName = `${normalizedBaseName} ${nkCode}`;
                    }
                    
                    records.push({
                        id: simpleMatch[1],
                        name: finalName,
                        originalName: originalName,
                        normalizedBaseName: normalizedBaseName,
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
