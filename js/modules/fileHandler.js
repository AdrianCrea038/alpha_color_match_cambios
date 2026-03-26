export class FileHandler {
    constructor() {
        // Tabla de unificación de nombres (normalizada internamente)
        this.nameMapping = new Map([
            ["10FTM WHITE", "10A WHITE"],
            ["03STM BLACK", "00A BLACK"],
            ["01PTM DK STEEL GREY", "01P DK STEEL GREY"],
            ["03TBLUE GREY", "01V WOLF GREY"],
            ["05XTM ANTHRACITE", "06F ANTHRACITE"],
            ["2AQTM BROWN", "20Q DARK CINDER"],
            ["2DHTM MEDIUM OLIVE", "2DH MEDIUM OLIVE"],
            ["3EMTM KELLY GREEN", "31W CLASSIC GREEN"],
            ["31VTM DARK GREEN", "39Y GORGE GREEN"],
            ["43VTM NAVY", "41S COLLEGE NAVY"],
            ["44ATM TIDAL BLUE", "44A TIDAL BLUE"],
            ["45WTM BLUSTERY", "45W BLUSTERY"],
            ["4ES TM AERO BLUE", "4ES AERO BLUE"],
            ["49VTM ROYAL", "4EV GAME ROYAL"],
            ["4CVTM LIGHT BLUE", "4EY VALOR BLUE"],
            ["52VTM PURPLE", "56N FIELD PURPLE"],
            ["64VTM SCARLET", "65N UNIVERSITY RED"],
            ["67YTM DARK MAROON", "66P DEEP MAROON"],
            ["6DRTM PINK FIRE II", "66Z PINK FIRE II"],
            ["69WTM CRIMSON", "69W TEAM CRIMSON"],
            ["69YTM CARDINAL", "69X TEAM MAROON"],
            ["79YTM BRIGHT GOLD", "79Q SUNDOWN"],
            ["79STM YELLOW STRIKE", "79S YELLOW STRIKE"],
            ["79XTM VEGAS GOLD", "79W TEAM GOLD"],
            ["81FDESERT ORANGE", "81F DESERT ORANGE"],
            ["87FTM BRIGHT CERAMIC", "87F BRIGHT CERAMIC"],
            ["82U TM ORANGE", "89L TEAM ORANGE"],
            ["06HFLINT GREY", "06H FLINT GREY"],
            ["15ANATURAL", "15A NATURAL"],
            ["3EYPRO GREEN", "3EY PRO GREEN"],
            ["3HNACTION GREEN", "3HN ACTION GREEN"],
            ["3GUHYPER TURQUOISE", "3GU HYPER TURQUOISE"],
            ["44USIGNAL BLUE", "44U SIGNAL BLUE"],
            ["4KBDARK TURQUOISE", "4KB DARK TURQUOISE"],
            ["4LBGYM BLUE", "4LB GYM BLUE"],
            ["48YITALY BLUE", "48Y ITALY BLUE"],
            ["52MNEW ORCHID", "52M NEW ORCHID"],
            ["71RVOLT", "71R VOLT"],
            ["77CGOLD", "77C GOLD"],
            ["76IUNIVERSITY GOLD", "76I UNIVERSITY GOLD"],
            ["78HAMARILLO", "78H AMARILLO"],
            ["79VCLUB GOLD", "79V CLUB GOLD"],
            ["89MUNIVERSITY ORANGE", "89M UNIVERSITY ORANGE"],
            ["89NBRILLIANT ORANGE", "89N BRILLIANT ORANGE"],
            ["89QORANGE HORIZON", "89Q ORANGE HORIZON"]
        ]);
    }

    // ✅ Normalización para comparación: MAYÚSCULAS + eliminar espacios, guiones, guiones bajos, puntos
    normalizeForComparison(str) {
        if (!str) return '';
        return str
            .toUpperCase()
            .replace(/\s+/g, '')           // Eliminar todos los espacios
            .replace(/[-_]/g, '')          // Eliminar guiones y guiones bajos
            .replace(/\./g, '');           // Eliminar puntos
    }

    async parseTxtFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const records = this.parseContent(content);
                const uniqueRecords = this.removeDuplicatesById(records);
                resolve(uniqueRecords);
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
    
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
        // Normalizar el nombre para buscar en la tabla
        const normalizedInput = this.normalizeForComparison(name);
        
        for (let [original, mapped] of this.nameMapping) {
            const normalizedOriginal = this.normalizeForComparison(original);
            if (normalizedInput === normalizedOriginal) {
                return mapped;
            }
        }
        
        return name.trim().replace(/\s+/g, ' ');
    }
    
    parseContent(content) {
        const lines = content.split(/\r?\n/);
        let dataStarted = false;
        const records = [];
        
        for (let line of lines) {
            if (line.trim() === '') continue;
            
            if (line.trim() === 'BEGIN_DATA') {
                dataStarted = true;
                continue;
            }
            if (dataStarted && line.trim() === 'END_DATA') break;
            if (!dataStarted) continue;
            
            const match = line.match(/^(\d+)\s+(?:"([^"]+)"|([^\s]+))\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)/);
            
            if (match) {
                let originalName = match[2] || match[3];
                
                if (originalName) {
                    const nkCode = this.extractNKCode(originalName);
                    let nameWithoutNK = this.removeNKCode(originalName);
                    let normalizedBaseName = this.normalizeNameWithMapping(nameWithoutNK);
                    
                    // Mantener los espacios originales del nombre base normalizado
                    let finalName = normalizedBaseName.toUpperCase();
                    if (nkCode) {
                        finalName = `${normalizedBaseName.toUpperCase()} ${nkCode.toUpperCase()}`;
                    } else {
                        finalName = normalizedBaseName.toUpperCase();
                    }
                    
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
                const altMatch = line.match(/^(\d+)\s+([^\s]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)/);
                if (altMatch) {
                    let originalName = altMatch[2];
                    
                    const nkCode = this.extractNKCode(originalName);
                    let nameWithoutNK = this.removeNKCode(originalName);
                    let normalizedBaseName = this.normalizeNameWithMapping(nameWithoutNK);
                    
                    let finalName = normalizedBaseName.toUpperCase();
                    if (nkCode) {
                        finalName = `${normalizedBaseName.toUpperCase()} ${nkCode.toUpperCase()}`;
                    } else {
                        finalName = normalizedBaseName.toUpperCase();
                    }
                    
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
            content += `${item.id} "${item.name.toUpperCase()}" `;
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
            content += `${item.id} "${item.name.toUpperCase()}" `;
            content += `${item.cmyk.c.toFixed(6)} ${item.cmyk.m.toFixed(6)} ${item.cmyk.y.toFixed(6)} ${item.cmyk.k.toFixed(6)} `;
            content += `${item.lab.l.toFixed(6)} ${item.lab.a.toFixed(6)} ${item.lab.b.toFixed(6)}\n`;
        });
        
        content += '\nEND_DATA\n';
        return content;
    }
}
