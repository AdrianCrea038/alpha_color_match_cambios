export class FileHandler {
    constructor() {
        this.nameMapping = new Map([
            ["10F TM WHITE", "10A WHITE"],
            ["03S TM BLACK", "00A BLACK"],
            ["01P TM DK STEEL GREY", "01P DK STEEL GREY"],
            ["03T BLUE GREY", "01V WOLF GREY"],
            ["05X TM ANTHRACITE", "06F ANTHRACITE"],
            ["2AQ TM BROWN", "20Q DARK CINDER"],
            ["2DH TM MEDIUM OLIVE", "2DH MEDIUM OLIVE"],
            ["3EM TM KELLY GREEN", "31W CLASSIC GREEN"],
            ["31V TM DARK GREEN", "39Y GORGE GREEN"],
            ["43V TM NAVY", "41S COLLEGE NAVY"],
            ["44A TM TIDAL BLUE", "44A TIDAL BLUE"],
            ["45W TM BLUSTERY", "45W BLUSTERY"],
            ["4ES TM AERO BLUE", "4ES AERO BLUE"],
            ["49V TM ROYAL", "4EV GAME ROYAL"],
            ["4CV TM LIGHT BLUE", "4EY VALOR BLUE"],
            ["52V TM PURPLE", "56N FIELD PURPLE"],
            ["64V TM SCARLET", "65N UNIVERSITY RED"],
            ["67Y TM DARK MAROON", "66P DEEP MAROON"],
            ["6DR TM PINK FIRE II", "66Z PINK FIRE II"],
            ["69W TM CRIMSON", "69W TEAM CRIMSON"],
            ["69Y TM CARDINAL", "69X TEAM MAROON"],
            ["79Y TM BRIGHT GOLD", "79Q SUNDOWN"],
            ["79S TM YELLOW STRIKE", "79S YELLOW STRIKE"],
            ["79X TM VEGAS GOLD", "79W TEAM GOLD"],
            ["81F DESERT ORANGE", "81F DESERT ORANGE"],
            ["87F TM BRIGHT CERAMIC", "87F BRIGHT CERAMIC"],
            ["82U TM ORANGE", "89L TEAM ORANGE"],
            ["06H FLINT GREY", "06H FLINT GREY"],
            ["15A NATURAL", "15A NATURAL"],
            ["3EY PRO GREEN", "3EY PRO GREEN"],
            ["3HN ACTION GREEN", "3HN ACTION GREEN"],
            ["3GU HYPER TURQUOISE", "3GU HYPER TURQUOISE"],
            ["44U SIGNAL BLUE", "44U SIGNAL BLUE"],
            ["4KB DARK TURQUOISE", "4KB DARK TURQUOISE"],
            ["4LB GYM BLUE", "4LB GYM BLUE"],
            ["48Y ITALY BLUE", "48Y ITALY BLUE"],
            ["52M NEW ORCHID", "52M NEW ORCHID"],
            ["71R VOLT", "71R VOLT"],
            ["77C GOLD", "77C GOLD"],
            ["76I UNIVERSITY GOLD", "76I UNIVERSITY GOLD"],
            ["78H AMARILLO", "78H AMARILLO"],
            ["79V CLUB GOLD", "79V CLUB GOLD"],
            ["89M UNIVERSITY ORANGE", "89M UNIVERSITY ORANGE"],
            ["89N BRILLIANT ORANGE", "89N BRILLIANT ORANGE"],
            ["89Q ORANGE HORIZON", "89Q ORANGE HORIZON"]
        ]);
    }

    normalizeForComparison(str) {
        if (!str) return '';
        return str
            .toUpperCase()
            .replace(/\s+/g, '')
            .replace(/[-_]/g, '')
            .replace(/\./g, '');
    }

    extractNKCode(fullName) {
        const match = fullName.match(/NK\d+$/i);
        return match ? match[0].toUpperCase() : null;
    }

    extractBaseName(fullName) {
        return fullName.replace(/\s+NK\d+$/i, '').trim();
    }

    normalizeNameWithMapping(name) {
        if (!name) return '';
        
        const normalizedInput = this.normalizeForComparison(name);
        
        for (let [original, mapped] of this.nameMapping) {
            const normalizedOriginal = this.normalizeForComparison(original);
            if (normalizedInput === normalizedOriginal) {
                return mapped;
            }
        }
        
        return name.trim().replace(/\s+/g, ' ');
    }

    async parseTxtFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const records = this.parseContent(content);
                const uniqueRecords = this.removeDuplicatesByNK(records);
                resolve(uniqueRecords);
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
    
    removeDuplicatesByNK(records) {
        const seen = new Map();
        const unique = [];
        
        for (const record of records) {
            const key = `${record.nkCode}_${this.normalizeForComparison(record.baseName)}`;
            if (!seen.has(key)) {
                seen.set(key, true);
                unique.push(record);
            }
        }
        
        if (records.length !== unique.length) {
            console.warn(`⚠️ Se eliminaron ${records.length - unique.length} registros duplicados por NK`);
        }
        
        return unique;
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
                    const baseNameRaw = this.extractBaseName(originalName);
                    const normalizedBaseName = this.normalizeNameWithMapping(baseNameRaw);
                    
                    let finalName = normalizedBaseName.toUpperCase();
                    if (nkCode) {
                        finalName = `${normalizedBaseName.toUpperCase()} ${nkCode.toUpperCase()}`;
                    }
                    
                    const existingIndex = records.findIndex(r => r.id === match[1]);
                    if (existingIndex !== -1) {
                        console.warn(`⚠️ ID duplicado encontrado: ${match[1]}, omitiendo duplicado`);
                        continue;
                    }
                    
                    records.push({
                        id: match[1],
                        originalId: match[1],
                        name: finalName,
                        originalName: originalName,
                        baseName: normalizedBaseName.toUpperCase(),
                        nkCode: nkCode,
                        cmyk: [parseFloat(match[4]), parseFloat(match[5]), parseFloat(match[6]), parseFloat(match[7])],
                        lab: [parseFloat(match[8]), parseFloat(match[9]), parseFloat(match[10])]
                    });
                }
            }
        }
        
        console.log(`📄 Parseados ${records.length} registros únicos del archivo`);
        return records;
    }
    
    generateExportContent(colorsToExport) {
        let content = 'CGATS.17\n';
        content += 'ORIGINATOR\t"ALPHA COLOR MATCH"\n';
        content += `CREATED\t"${new Date().toLocaleDateString()}"\n`;
        content += 'NUMBER_OF_FIELDS\t9\n';
        content += 'BEGIN_DATA_FORMAT\n';
        content += 'SAMPLE_ID SAMPLE_NAME CMYK_C CMYK_M CMYK_Y CMYK_K LAB_L LAB_A LAB_B\n';
        content += 'END_DATA_FORMAT\n';
        content += `NUMBER_OF_SETS\t${colorsToExport.length}\n`;
        content += 'BEGIN_DATA\n\n';
        
        colorsToExport.forEach((item, idx) => {
            const counter = idx + 1;
            content += `${counter} "${item.name}" `;
            content += `${item.cmyk[0].toFixed(6)} ${item.cmyk[1].toFixed(6)} ${item.cmyk[2].toFixed(6)} ${item.cmyk[3].toFixed(6)} `;
            content += `${item.lab[0].toFixed(6)} ${item.lab[1].toFixed(6)} ${item.lab[2].toFixed(6)}\n`;
        });
        
        content += '\nEND_DATA\n';
        return content;
    }
    
    generateTxtFromData(data) {
        const colorsToExport = data.map((item, idx) => ({
            name: item.name.toUpperCase(),
            cmyk: [item.cmyk.c, item.cmyk.m, item.cmyk.y, item.cmyk.k],
            lab: [item.lab.l, item.lab.a, item.lab.b]
        }));
        
        return this.generateExportContent(colorsToExport);
    }
}
